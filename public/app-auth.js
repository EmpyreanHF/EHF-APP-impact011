/* =============================================================================
   EMPYREAN INTERNATIONAL — AUTHENTICATION & SESSION
   app-auth.js  |  Step 0.7  |  Refactor Roadmap v1.0
   =============================================================================

   PURPOSE
   ───────
   Complete authentication system extracted from app-fixes.js.  Covers every
   path a user can take to establish or destroy a session:

     • Page-load session restore (localStorage + Firebase onAuthStateChanged)
     • Email/password login (Firebase Auth primary, localStorage fallback)
     • Email/password registration (localStorage-first, Firebase async)
     • Google Sign-In (Firebase Auth popup)
     • Forgot-password email dispatch
     • Sign-out (Firebase + localStorage + state reset)
     • Admin detection and PIN modal guard
     • Core app initialiser — initializeApp()
     • Firestore user profile helpers — loadUserFromFirestore / saveUserToFirestore
     • Avatar propagation — propagateProfilePicture()
     • Auth modal open/close/switch-view

   LOAD ORDER
   ──────────
   Must load AFTER all prior modules:
   firebase-init.js → app-state.js → app-helpers.js → app-contracts.js
   → app-notifications.js → app-tags.js → app-dom.js → app-auth.js

   DEPENDS ON
   ──────────
   • window.fbAuth / window.fbDb   (firebase-init.js stubs)
   • window.EmpState               (app-state.js)
   • window.showNotification       (app-helpers.js)
   • window.showFormFeedback       (app-helpers.js)
   • window.generateCaptcha        (app-helpers.js)
   • window.handleAvatarUpload     (app-helpers.js)
   • window.rewardUserForAction    (app-helpers.js)
   • window.pushNotification       (app-notifications.js)
   • window.loadUserNotifications  (app-notifications.js)
   • window.navigateTo             (app-dom.js)
   • window.buildSidebar / buildHeader / renderDynamicUI  (app-dom.js)
   • window.updateWalletUI / updateCartUI / updateStakingUI  (app-wallet.js)
   • window.renderMarketplaceCards  (app-marketplace.js)
   • window.renderUserProfile / renderBusinessPage  (app-profile.js)
   • window.renderCommunityTasks / renderGrantLedger / renderNgoGrid  (app-ngo.js)
   • window.renderDashboardNews / renderSuggestedUsers  (app-feed.js)
   • window.renderAdminQueues      (app-admin.js)
   • window.renderContactList      (app-chat.js)
   • window.populateBackgroundSelector / populateGiftCatalog  (app-live.js)
   • window._startRealtimeListeners  (app-feed.js)
   • window.startLiveStreamListener  (app-live.js)

   PUBLIC API
   ──────────
   window.initializeApp(guestMode, isAdminUser, customUserData)
   window.loadUserFromFirestore(uid)  → Promise<Object|null>
   window.saveUserToFirestore(uid, data) → Promise<void>
   window.propagateProfilePicture()
   window.signOutUser()

   SECTION MAP
   ───────────
   §1  Constants
   §2  Firestore user helpers — load / save
   §3  Set-field normaliser
   §4  initializeApp — core app bootstrapper
   §5  restoreLocalSession — page-load localStorage restore
   §6  Firebase onAuthStateChanged — canonical session observer
   §7  Login handler
   §8  Register handler
   §9  Google Sign-In handler
   §10 Forgot-password handler
   §11 Sign-out handler
   §12 Auth modal — open / close / view switching
   §13 propagateProfilePicture
   §14 Listener retry + network resume logic

   ============================================================================= */

(function empyreanAuthModule() {
    'use strict';

    if (window._empyreanAuthLoaded) {
        console.warn('[EmpAuth] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanAuthLoaded = true;

    /* =========================================================================
       §1  CONSTANTS
       ========================================================================= */

    const ADMIN_EMAILS = new Set([
        'admin@empyrean.com',
        'chiefadmin@empyreanhumanitarianfoundation.com'
    ]);

    /** Keys that must be stored as Set objects on userState */
    const SET_KEYS = [
        'likedPostIds', 'followedUserIds', 'retweetedPostIds',
        'awardedRanks', 'completedTasks', 'viewedStatusUserIds'
    ];

    /** Default avatar used before a user uploads their own */
    const DEFAULT_AVATAR =
        'https://ui-avatars.com/api/?name=EM&background=1B2B8B&color=fff&size=150';

    /** Default cover photo */
    const DEFAULT_COVER =
        'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80';


    /* =========================================================================
       §2  FIRESTORE USER HELPERS
       ========================================================================= */

    /**
     * Load a user profile document from Firestore.
     * Returns the profile object with Set fields normalised,
     * or null if the document does not exist or Firebase is unavailable.
     *
     * @param {string} uid — Firebase Auth UID
     * @returns {Promise<Object|null>}
     */
    async function loadUserFromFirestore(uid) {
        if (!uid || !window.fbDb || !window._firebaseLoaded) return null;
        try {
            const doc = await window.fbDb.collection('users').doc(uid).get();
            if (!doc || !doc.exists) return null;
            const data = doc.data();
            _normaliseSets(data);
            if (!data.statuses) data.statuses = [];
            return data;
        } catch (e) {
            console.warn('[Auth] loadUserFromFirestore failed:', e.message);
            return null;
        }
    }
    window.loadUserFromFirestore = loadUserFromFirestore;

    /**
     * Write (merge) a user profile to Firestore.
     * Serialises Set fields to plain arrays before writing.
     *
     * @param {string} uid  — Firebase Auth UID
     * @param {Object} data — User profile object
     * @returns {Promise<void>}
     */
    async function saveUserToFirestore(uid, data) {
        if (!uid || !window.fbDb || !window._firebaseLoaded) return;
        const safe = Object.assign({}, data);
        SET_KEYS.forEach(function (k) {
            if (safe[k] instanceof Set) safe[k] = Array.from(safe[k]);
        });
        safe.statuses = [];       // never persist blob-URL stories
        delete safe.password;     // never write plaintext password to Firestore
        try {
            await window.fbDb.collection('users').doc(uid).set(safe, { merge: true });
        } catch (e) {
            console.warn('[Auth] saveUserToFirestore failed:', e.message);
        }
    }
    window.saveUserToFirestore = saveUserToFirestore;


    /* =========================================================================
       §3  SET-FIELD NORMALISER
       ========================================================================= */

    /**
     * Convert any array-or-missing Set fields on a user object to proper Set
     * instances.  Mutates in place.
     * @param {Object} u
     */
    function _normaliseSets(u) {
        if (!u) return;
        SET_KEYS.forEach(function (k) {
            u[k] = new Set(Array.isArray(u[k]) ? u[k] : []);
        });
    }

    /**
     * Produce a localStorage-safe copy of a user object (Sets → arrays,
     * statuses cleared, password removed).
     * @param {Object} u
     * @returns {Object}
     */
    function _serialiseUser(u) {
        const safe = Object.assign({}, u);
        SET_KEYS.forEach(function (k) {
            safe[k] = u[k] instanceof Set ? Array.from(u[k]) : (u[k] || []);
        });
        safe.statuses = [];
        delete safe.password;
        return safe;
    }

    /** Persist current session to localStorage */
    function _persistSession(profile) {
        try {
            localStorage.setItem('empyrean_session', JSON.stringify(_serialiseUser(profile)));
            localStorage.setItem('empyrean_session_email', profile.email || '');
            const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
            stored[profile.email] = _serialiseUser(profile);
            localStorage.setItem('empyrean_users', JSON.stringify(stored));
        } catch (e) {}
    }


    /* =========================================================================
       §4  CORE APP INITIALISER
       ========================================================================= */

    /**
     * Bootstrap the application for a given session type.
     * Called by: restoreLocalSession, onAuthStateChanged, login handler,
     *            Google sign-in handler, and the admin login path.
     *
     * Debounced: a second call within 1 500 ms is blocked unless it carries a
     * real Firebase UID upgrading from a transient guest session.
     *
     * @param {boolean}     guestMode      — true = guest session
     * @param {boolean}     isAdminUser    — true = admin privileges
     * @param {Object|null} customUserData — profile object; null = use defaults
     */
    function initializeApp(guestMode, isAdminUser, customUserData) {
        isAdminUser    = isAdminUser    || false;
        customUserData = customUserData || null;

        /* ── Debounce guard ── */
        const _now       = Date.now();
        const _upgrading = !guestMode && customUserData && customUserData.id
            && customUserData.id !== 'user-main';

        if (window._initAppRunning
            && ((_now - (window._initAppLastRun || 0)) < 1500)
            && !_upgrading) {
            console.warn('[Auth] initializeApp blocked by debounce.');
            return;
        }
        window._initAppRunning     = true;
        window._initAppLastRun     = _now;
        window._initAppLastGuestMode = guestMode;
        setTimeout(function () { window._initAppRunning = false; }, 1500);

        /* ── Blank-screen guard ── */
        setTimeout(function () {
            const sections   = document.querySelectorAll('.content-section');
            const anyVisible = Array.from(sections).some(function (s) {
                return s.style.display !== 'none' && s.offsetParent !== null;
            });
            if (!anyVisible) {
                sections.forEach(function (s) { s.style.display = 'none'; });
                const dash = document.getElementById('dashboard');
                if (dash) dash.style.display = 'block';
            }
        }, 2500);

        /* ── Close auth modal ── */
        const authModal = document.getElementById('auth-modal-overlay');
        if (authModal) {
            authModal.classList.remove('show');
            authModal.style.display = 'none';
        }
        ['signup-view', 'forgot-password-view'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';

        /* ── Default user shapes ── */
        const guestState = {
            id: null, fullName: 'Guest', username: 'guest',
            avatar: 'https://source.unsplash.com/random/150x150/?avatar',
            coverPhoto: 'https://source.unsplash.com/random/1200x400/?pattern',
            likedPostIds: new Set(), followedUserIds: new Set(),
            retweetedPostIds: new Set(), statuses: [],
            awardedRanks: new Set(), empyBalance: 0,
            isVerified: false, businessPage: null,
            completedTasks: new Set(), viewedStatusUserIds: new Set()
        };

        const defaultUserState = {
            id: 'user-main', fullName: '', username: 'member', email: '',
            password: '', avatar: DEFAULT_AVATAR, coverPhoto: DEFAULT_COVER,
            bio: '', phone: '', website: '', profession: '', education: '',
            maritalStatus: '', hobbies: '', location: '',
            likedPostIds: new Set(), followedUserIds: new Set(),
            retweetedPostIds: new Set(), statuses: [],
            viewedStatusUserIds: new Set(), empyBalance: 0,
            isVerified: false, followerCount: 0, businessPage: null,
            awardedRanks: new Set(), completedTasks: new Set()
        };

        const adminState = Object.assign({}, defaultUserState, {
            id: 'admin-user', fullName: 'Admin User',
            username: 'admin', email: 'admin@empyrean.com'
        });

        /* ── Resolve userState ── */
        const S = window.EmpState;
        let userState;
        if (guestMode) {
            userState = guestState;
        } else if (customUserData) {
            userState = Object.assign({}, guestState, customUserData);
            _normaliseSets(userState);
        } else {
            userState = isAdminUser ? adminState : defaultUserState;
        }

        /* ── Apply to state ── */
        if (S) {
            S.isGuest   = guestMode;
            S.isAdmin   = isAdminUser;
            S.userState = userState;
            S.cart      = [];
            S.newAvatarFile  = null;
            S.newCoverFile   = null;
            S.newsMediaFile  = null;
            S.newPageProfileFile = null;
            S.newPageCoverFile   = null;
        } else {
            window.isGuest   = guestMode;
            window.isAdmin   = isAdminUser;
            window.userState = userState;
            window.cart      = [];
        }

        const mu = S ? S.mockUsers : window.mockUsers;
        if (userState.id && mu && !mu[userState.id]) mu[userState.id] = userState;

        /* BUG FIX: Synchronise isGuest on ALL global state paths BEFORE any
           rendering call. app-nav._isGuest() checks multiple sources; any stale
           one causes "Guest" to display in the sidebar after a successful login. */
        window.isGuest   = guestMode;
        if (S) S.isGuest = guestMode;
        if (S) S.userState = userState;
        window.userState = userState;

        /* ── Call domain renderers (all guarded — safe if module not yet loaded) ── */
        function _safe(fn) {
            if (typeof window[fn] === 'function') window[fn]();
        }
        _safe('buildSidebar');
        _safe('buildHeader');
        _safe('updateWalletUI');
        _safe('updateCartUI');
        _safe('renderDynamicUI');
        _safe('renderMarketplaceCards');
        _safe('populateBackgroundSelector');
        _safe('populateGiftCatalog');
        _safe('renderGrantLedger');
        _safe('renderNgoGrid');
        _safe('renderDashboardNews');

        if (!guestMode) {
            if (userState.id && typeof window.renderUserProfile === 'function') {
                window.renderUserProfile(userState.id);
            }
            _safe('renderCommunityTasks');
            _safe('renderSuggestedUsers');
            _safe('renderBusinessPage');
            _safe('updateStakingUI');
            _safe('renderContactList');
        }

        if (isAdminUser) {
            /* Load pending SOS queue from Firestore for admin view */
            (async function () {
                try {
                    if (window.fbDb) {
                        const snap = await window.fbDb.collection('sos_queue')
                            .where('status', '==', 'pending_approval').get();
                        if (!snap.empty) {
                            const mq = S ? S.mockAdminSosQueue : window.mockAdminSosQueue;
                            snap.forEach(function (doc) {
                                const d = doc.data();
                                if (!mq.find(function (x) { return x.id === d.id; })) mq.push(d);
                            });
                        }
                    }
                } catch (e) {}
                _safe('renderAdminQueues');
            })();
        }

        /* ── Section navigation ── */
        const lastSection = (function () {
            try { return localStorage.getItem('empyrean_last_section'); } catch (e) { return null; }
        })();
        const sectionToOpen = (!guestMode && !isAdminUser && lastSection
            && document.getElementById(lastSection))
            ? lastSection
            : (!guestMode && !isAdminUser ? 'profile' : 'dashboard');

        if (typeof window.navigateTo === 'function') window.navigateTo(sectionToOpen);

        /* ── Mobile bottom-nav rebuild ── */
        if (typeof window._buildMobileBottomNav === 'function') {
            setTimeout(window._buildMobileBottomNav, 100);
        }

        /* ── Pre-fill settings fields ── */
        setTimeout(function () {
            if (!guestMode) {
                [
                    ['profile-fullname', 'fullName'],
                    ['profile-username', 'username'],
                    ['profile-bio',      'bio'],
                    ['profile-email',    'email']
                ].forEach(function (pair) {
                    const el = document.getElementById(pair[0]);
                    if (el) el.value = userState[pair[1]] || '';
                });
            }
            /* Fire init-done so notification system + other subscribers respond */
            document.dispatchEvent(new CustomEvent('empyrean-init-done'));
            document.dispatchEvent(new CustomEvent('empyrean-user-ready'));
        }, 300);

        console.log('[Auth] initializeApp — guest:', guestMode, '| admin:', isAdminUser,
            '| user:', userState.fullName || userState.username || '(guest)');
    }
    window.initializeApp = initializeApp;


    /* =========================================================================
       §5  RESTORE LOCAL SESSION (page-load)
       ========================================================================= */

    (function restoreLocalSession() {
        try {
            const sessionEmail = localStorage.getItem('empyrean_session_email');
            if (!sessionEmail) return;
            const stored     = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
            const storedUser = stored[sessionEmail];
            if (!storedUser) return;
            _normaliseSets(storedUser);
            if (!storedUser.statuses) storedUser.statuses = [];

            /* Give Firebase onAuthStateChanged a head-start (800 ms) */
            setTimeout(function () {
                const S = window.EmpState || {};
                if (!S.isGuest && !window.isGuest) return; // Firebase already logged in
                console.log('[Auth] Restoring localStorage session for:', sessionEmail);
                window._listenerRetryCount = 0;
                initializeApp(false, ADMIN_EMAILS.has(storedUser.email), storedUser);
            }, 800);
        } catch (e) {}
    })();


    /* =========================================================================
       §6  FIREBASE onAuthStateChanged
       ========================================================================= */

    try {
        window.fbAuth.onAuthStateChanged(async function (fbUser) {
            if (fbUser && !fbUser.isAnonymous) {
                try {
                    let profile = await loadUserFromFirestore(fbUser.uid);

                    /* New signup — build minimal profile */
                    if (!profile) {
                        profile = {
                            id:         fbUser.uid,
                            email:      fbUser.email      || '',
                            fullName:   fbUser.displayName
                                || (fbUser.email ? fbUser.email.split('@')[0] : 'User'),
                            username:   fbUser.email
                                ? fbUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
                                : 'user' + fbUser.uid.slice(-4),
                            avatar:     fbUser.photoURL   || DEFAULT_AVATAR,
                            coverPhoto: DEFAULT_COVER,
                            bio: '', empyBalance: 0, isVerified: false,
                            followerCount: 0, businessPage: null,
                            likedPostIds: new Set(), followedUserIds: new Set(),
                            retweetedPostIds: new Set(), awardedRanks: new Set(),
                            completedTasks: new Set(), viewedStatusUserIds: new Set(),
                            statuses: [], createdAt: new Date().toISOString()
                        };
                        try { await saveUserToFirestore(fbUser.uid, profile); } catch (e) {}
                        console.log('[Auth] New user — created Firestore profile:', fbUser.uid);
                    }

                    profile.id = fbUser.uid;
                    const S    = window.EmpState || {};
                    const ru   = S.registeredUsers || window.registeredUsers || {};
                    if (profile.email) ru[profile.email] = profile;
                    const mu   = S.mockUsers || window.mockUsers || {};
                    mu[profile.id] = profile;

                    const isAdminUser = ADMIN_EMAILS.has(profile.email);
                    initializeApp(false, isAdminUser, profile);

                    /* Reset stale listener handles */
                    ['_postsListener', '_newsListener', '_mktListener',
                     '_reelsListener', '_usersListener', '_sosListener',
                     '_crisisListener', '_announcementsListener'].forEach(function (k) {
                        window[k] = null;
                    });
                    window._suggestedFetchDone      = false;
                    window._firestoreSuggestedUsers = null;

                    /* Start real-time listeners after DOM settles */
                    setTimeout(function () {
                        console.log('[Auth] ✅ Confirmed user:', profile.fullName || profile.email);
                        if (typeof window._startRealtimeListeners  === 'function') window._startRealtimeListeners();
                        if (typeof window.startLiveStreamListener   === 'function') window.startLiveStreamListener();
                        if (typeof window.loadUserNotifications      === 'function') window.loadUserNotifications();

                        /* Real-time user_notifications snapshot */
                        if (window.fbDb && window._firebaseLoaded && profile.id) {
                            window.fbDb.collection('user_notifications')
                                .where('userId', '==', profile.id)
                                .where('read',   '==', false)
                                .orderBy('createdAt', 'desc')
                                .limit(20)
                                .onSnapshot(function (snap) {
                                    if (!snap) return;
                                    snap.docChanges().forEach(function (ch) {
                                        if (ch.type !== 'added') return;
                                        const n = ch.doc.data();
                                        if (!n) return;
                                        if (typeof window.showNotification === 'function') {
                                            window.showNotification(
                                                n.message,
                                                n.type === 'sos_rejected' ? 'error' : (n.type || 'info')
                                            );
                                        }
                                        const badge = document.getElementById('notif-badge');
                                        if (badge) {
                                            badge.textContent    = (parseInt(badge.textContent) || 0) + 1;
                                            badge.style.display  = 'inline-flex';
                                        }
                                        try { ch.doc.ref.update({ read: true }); } catch (e) {}
                                    });
                                }, function (err) {
                                    console.warn('[Notif] listener error:', err.message);
                                });
                        }
                    }, 800);

                } catch (e) {
                    console.error('[Auth] onAuthStateChanged error:', e.message);
                }

            } else {
                /* No Firebase session — try localStorage fallback */
                try {
                    const sessionEmail = localStorage.getItem('empyrean_session_email') || '';
                    if (sessionEmail) {
                        const stored     = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                        const storedUser = stored[sessionEmail];
                        if (storedUser && !window._initAppRunning) {
                            _normaliseSets(storedUser);
                            if (!storedUser.statuses) storedUser.statuses = [];
                            console.log('[Auth] Restoring localStorage session:', sessionEmail);
                            initializeApp(false, ADMIN_EMAILS.has(storedUser.email), storedUser);
                            setTimeout(function () {
                                if (typeof window._startRealtimeListeners === 'function') window._startRealtimeListeners();
                                if (typeof window.startLiveStreamListener  === 'function') window.startLiveStreamListener();
                            }, 600);
                            return;
                        }
                    }
                } catch (e) {}

                /* Truly no session */
                if (!window._initAppRunning) {
                    console.log('[Auth] No session — initialising as guest.');
                    initializeApp(true);
                }
            }
        });
    } catch (e) {
        console.warn('[Auth] onAuthStateChanged registration failed:', e.message);
        /* Fallback: start as guest immediately */
        setTimeout(function () {
            if (window.EmpState && window.EmpState.isGuest !== false) initializeApp(true);
            else if (window.isGuest !== false)                         initializeApp(true);
        }, 1200);
    }


    /* =========================================================================
       §7  LOGIN HANDLER
       Called from the submit event on #login-form.
       Dual-path: Firebase Auth (primary) → localStorage (offline fallback).
       ========================================================================= */

    window._handleLoginSubmit = async function (e) {
        e.preventDefault();
        const emailEl    = document.getElementById('login-email');
        const passEl     = document.getElementById('login-password');
        const captchaEl  = document.getElementById('login-captcha-input');

        if (!emailEl || !passEl) return;

        const email    = (emailEl.value || '').trim().toLowerCase();
        const password = (passEl.value  || '').trim();

        /* ── Captcha validation ── */
        const S = window.EmpState || {};
        const expectedCaptcha = S.captchaCode || window.captchaCode || '';
        if (captchaEl && expectedCaptcha
            && captchaEl.value.toUpperCase() !== expectedCaptcha.toUpperCase()) {
            if (typeof window.showFormFeedback === 'function') {
                window.showFormFeedback('login', 'Incorrect security code. Please try again.', 'error');
            }
            if (typeof window.generateCaptcha === 'function') window.generateCaptcha();
            return;
        }

        if (!email || !password) {
            if (typeof window.showFormFeedback === 'function') {
                window.showFormFeedback('login', 'Please enter your email and password.', 'error');
            }
            return;
        }

        if (typeof window.showFormFeedback === 'function') {
            window.showFormFeedback('login', 'Signing in…', 'info');
        }

        /* ── Step 1: Check localStorage ── */
        let localUser = null;
        try {
            const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
            const entry  = stored[email];
            if (entry && entry.password === password) {
                localUser = entry;
                _normaliseSets(localUser);
            }
        } catch (e) {}

        /* ── Step 2: Firebase Auth (primary) ── */
        if (window._firebaseLoaded && window.fbAuth
            && typeof window.fbAuth.signInWithEmailAndPassword === 'function') {
            try {
                const cred = await window.fbAuth.signInWithEmailAndPassword(email, password);
                if (cred && cred.user) {
                    const uid     = cred.user.uid;
                    let profile   = await loadUserFromFirestore(uid);

                    if (!profile) {
                        profile = localUser || {
                            id: uid,
                            fullName: email.split('@')[0],
                            email,
                            username: email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase(),
                            avatar: DEFAULT_AVATAR, coverPhoto: DEFAULT_COVER,
                            bio: '', empyBalance: 0, isVerified: false,
                            followerCount: 0, businessPage: null,
                            likedPostIds: new Set(), followedUserIds: new Set(),
                            retweetedPostIds: new Set(), awardedRanks: new Set(),
                            completedTasks: new Set(), viewedStatusUserIds: new Set(),
                            statuses: []
                        };
                    }
                    profile.id = uid;
                    _normaliseSets(profile);

                    const ru = S.registeredUsers || window.registeredUsers || {};
                    ru[email] = profile;
                    const mu = S.mockUsers || window.mockUsers || {};
                    mu[uid]  = profile;
                    _persistSession(profile);

                    ['_postsListener','_newsListener','_mktListener',
                     '_reelsListener','_usersListener'].forEach(function (k) { window[k] = null; });

                    initializeApp(false, ADMIN_EMAILS.has(email), profile);

                    const am = document.getElementById('auth-modal-overlay');
                    if (am) { am.classList.remove('show'); am.style.display = 'none'; }
                    document.body.classList.remove('modal-open');

                    if (typeof window.showNotification === 'function') {
                        window.showNotification('✅ Welcome back, ' + (profile.fullName || email.split('@')[0]) + '!', 'success');
                    }

                    setTimeout(function () {
                        if (typeof window._startRealtimeListeners === 'function') window._startRealtimeListeners();
                        if (typeof window.startLiveStreamListener  === 'function') window.startLiveStreamListener();
                        if (typeof window.loadUserNotifications    === 'function') window.loadUserNotifications();
                    }, 600);
                    return;
                }
            } catch (fbErr) {
                /* Wrong password / user-not-found → fall through to localStorage */
                if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/user-not-found') {
                    if (!localUser) {
                        if (typeof window.showFormFeedback === 'function') {
                            window.showFormFeedback('login', 'Incorrect email or password.', 'error');
                        }
                        if (typeof window.generateCaptcha === 'function') window.generateCaptcha();
                        return;
                    }
                } else {
                    console.warn('[Login] Firebase error:', fbErr.code, fbErr.message);
                }
            }
        }

        /* ── Step 3: localStorage-only fallback ── */
        if (localUser) {
            const ru = S.registeredUsers || window.registeredUsers || {};
            ru[email] = localUser;
            _persistSession(localUser);
            initializeApp(false, ADMIN_EMAILS.has(email), localUser);
            const am = document.getElementById('auth-modal-overlay');
            if (am) { am.classList.remove('show'); am.style.display = 'none'; }
            document.body.classList.remove('modal-open');
            if (typeof window.showNotification === 'function') {
                window.showNotification('✅ Welcome back, ' + (localUser.fullName || email) + '!', 'success');
            }
        } else {
            if (typeof window.showFormFeedback === 'function') {
                window.showFormFeedback('login', 'Incorrect email or password.', 'error');
            }
            if (typeof window.generateCaptcha === 'function') window.generateCaptcha();
        }
    };


    /* =========================================================================
       §8  REGISTER HANDLER
       Called from submit on #signup-form.
       Strategy: save to localStorage immediately (works offline), then
       create Firebase Auth account + Firestore profile asynchronously.
       ========================================================================= */

    window._handleRegisterSubmit = async function (e) {
        e.preventDefault();

        const fullNameEl = document.getElementById('signup-fullname');
        const emailEl    = document.getElementById('signup-email');
        const passEl     = document.getElementById('signup-password');
        const typeEls    = document.querySelectorAll('input[name="user-type"]');

        if (!emailEl || !passEl) return;

        const fullName = (fullNameEl ? fullNameEl.value : '').trim();
        const email    = (emailEl.value || '').trim().toLowerCase();
        const password = (passEl.value  || '').trim();
        let   userType = 'individual';
        typeEls.forEach(function (el) { if (el.checked) userType = el.value; });

        if (!email || !password) {
            if (typeof window.showFormFeedback === 'function') {
                window.showFormFeedback('signup', 'Please fill in all required fields.', 'error');
            }
            return;
        }
        if (password.length < 6) {
            if (typeof window.showFormFeedback === 'function') {
                window.showFormFeedback('signup', 'Password must be at least 6 characters.', 'error');
            }
            return;
        }

        /* Check duplicate email */
        const existingStored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
        if (existingStored[email]) {
            if (typeof window.showFormFeedback === 'function') {
                window.showFormFeedback('signup', 'That email already has an account. Please log in.', 'warning');
            }
            return;
        }

        const S = window.EmpState || {};

        /* ── Build new user object ── */
        const avatarSrc = (window.newAvatarFile || (S.newAvatarFile))
            || ('https://ui-avatars.com/api/?name='
                + encodeURIComponent(fullName || email.split('@')[0])
                + '&background=1B2B8B&color=fff&size=150');

        const newUser = {
            id:          'local-' + Date.now(),
            fullName:    fullName || email.split('@')[0],
            username:    (fullName || email.split('@')[0])
                .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            email:       email,
            password:    password,
            avatar:      avatarSrc,
            coverPhoto:  DEFAULT_COVER,
            bio:         '',
            phone:       '',
            userType:    userType,
            empyBalance: 0,
            isVerified:  false,
            followerCount: 0,
            businessPage:  null,
            likedPostIds:  new Set(), followedUserIds: new Set(),
            retweetedPostIds: new Set(), awardedRanks: new Set(),
            completedTasks: new Set(), viewedStatusUserIds: new Set(),
            statuses: [],
            createdAt: new Date().toISOString()
        };

        /* ── Save to localStorage immediately ── */
        const ru = S.registeredUsers || window.registeredUsers || {};
        const mu = S.mockUsers || window.mockUsers || {};
        ru[email]        = newUser;
        mu[newUser.id]   = newUser;
        existingStored[email] = _serialiseUser(newUser);
        try { localStorage.setItem('empyrean_users', JSON.stringify(existingStored)); } catch (e) {}
        _persistSession(newUser);

        if (typeof window.showFormFeedback === 'function') {
            window.showFormFeedback('signup', '⏳ Creating your account…', 'info');
        }

        /* ── Firebase Auth + Firestore (async) ── */
        try {
            if (!window._firebaseLoaded || !window.fbAuth) {
                /* Wait up to 10 s for Firebase */
                await new Promise(function (resolve) {
                    let tries = 0;
                    const t = setInterval(function () {
                        if (window._firebaseLoaded || ++tries > 20) { clearInterval(t); resolve(); }
                    }, 500);
                });
            }

            if (window._firebaseLoaded && window.fbAuth
                && typeof window.fbAuth.createUserWithEmailAndPassword === 'function') {
                const fbCred = await window.fbAuth.createUserWithEmailAndPassword(email, password);
                if (fbCred && fbCred.user) {
                    newUser.id   = fbCred.user.uid;
                    ru[email].id = fbCred.user.uid;
                    mu[fbCred.user.uid] = newUser;
                    await saveUserToFirestore(fbCred.user.uid, newUser);
                    /* Update localStorage with real UID */
                    try {
                        const ls2 = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                        if (ls2[email]) { ls2[email].id = fbCred.user.uid; }
                        localStorage.setItem('empyrean_users', JSON.stringify(ls2));
                    } catch (e) {}
                    console.log('[Auth] ✅ Firebase account created. UID:', fbCred.user.uid);
                }
            }
        } catch (fbErr) {
            if (fbErr.code === 'auth/email-already-in-use') {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('That email already has an account. Please log in.', 'warning');
                }
            } else {
                console.warn('[Register] Firebase error:', fbErr.code, fbErr.message);
            }
        }

        if (typeof window.showFormFeedback === 'function') {
            window.showFormFeedback('signup', '✅ Account created! You can now log in.', 'success');
        }
        if (typeof window.rewardUserForAction === 'function') {
            window.rewardUserForAction('SUCCESSFUL_REFERRAL');
        }

        /* Switch to login view */
        setTimeout(function () {
            const sv = document.getElementById('signup-view');
            const lv = document.getElementById('login-view');
            if (sv) sv.style.display  = 'none';
            if (lv) lv.style.display  = 'block';
            if (S.newAvatarFile != null) S.newAvatarFile = null;
            else window.newAvatarFile  = null;
            const form = document.getElementById('signup-form');
            if (form) form.reset();
            if (typeof window.handleAvatarUpload === 'function') {
                window.handleAvatarUpload(null, 'avatar-preview');
            }
        }, 1500);
    };


    /* =========================================================================
       §9  GOOGLE SIGN-IN HANDLER
       ========================================================================= */

    window._handleGoogleSignIn = async function () {
        if (!window._firebaseLoaded || typeof firebase === 'undefined' || !firebase.auth) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Google sign-in is not available right now.', 'error');
            }
            return;
        }
        try {
            const gProvider = new firebase.auth.GoogleAuthProvider();
            gProvider.setCustomParameters({ prompt: 'select_account' });
            const result = await firebase.auth().signInWithPopup(gProvider);
            const fbUser = result.user;
            if (!fbUser) throw new Error('No user returned from Google popup');

            let profile = null;
            try {
                const doc = await window.fbDb.collection('users').doc(fbUser.uid).get();
                if (doc && doc.exists) {
                    profile = doc.data();
                    _normaliseSets(profile);
                }
            } catch (e) {}

            if (!profile) {
                profile = {
                    id:          fbUser.uid,
                    fullName:    fbUser.displayName || 'Google User',
                    username:    (fbUser.displayName || 'user')
                        .toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 999),
                    email:       fbUser.email,
                    avatar:      fbUser.photoURL || DEFAULT_AVATAR,
                    coverPhoto:  DEFAULT_COVER,
                    bio:         'Joined via Google',
                    empyBalance: 0, isVerified: false,
                    followerCount: 0, businessPage: null,
                    likedPostIds: new Set(), followedUserIds: new Set(),
                    retweetedPostIds: new Set(), awardedRanks: new Set(),
                    completedTasks: new Set(), viewedStatusUserIds: new Set(),
                    statuses: []
                };
                try {
                    await window.fbDb.collection('users').doc(fbUser.uid)
                        .set(profile, { merge: true });
                } catch (e) {}
            }
            if (!profile.statuses) profile.statuses = [];

            const S  = window.EmpState || {};
            const ru = S.registeredUsers || window.registeredUsers || {};
            const mu = S.mockUsers || window.mockUsers || {};
            ru[profile.email] = profile;
            mu[profile.id]    = profile;
            _persistSession(profile);

            if (typeof window.rewardUserForAction === 'function') {
                window.rewardUserForAction('SUCCESSFUL_REFERRAL');
            }
            initializeApp(false, ADMIN_EMAILS.has(profile.email), profile);

            const am = document.getElementById('auth-modal-overlay');
            if (am) { am.classList.remove('show'); am.style.display = 'none'; }
            document.body.classList.remove('modal-open');

            if (typeof window.showNotification === 'function') {
                window.showNotification('✅ Signed in with Google as ' + profile.fullName + '!', 'success');
            }
        } catch (gErr) {
            if (gErr.code !== 'auth/popup-closed-by-user') {
                console.warn('[Google Auth]', gErr.message);
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Google sign-in failed. Please try again.', 'error');
                }
            }
        }
    };


    /* =========================================================================
       §10  FORGOT PASSWORD HANDLER
       ========================================================================= */

    window._handleForgotPassword = async function (e) {
        e.preventDefault();
        const emailEl = document.getElementById('forgot-email');
        if (!emailEl) return;
        const email = (emailEl.value || '').trim().toLowerCase();
        if (!email) {
            if (typeof window.showFormFeedback === 'function') {
                window.showFormFeedback('forgot', 'Please enter your email address.', 'error');
            }
            return;
        }
        try {
            if (window._firebaseLoaded && window.fbAuth
                && typeof window.fbAuth.sendPasswordResetEmail === 'function') {
                await window.fbAuth.sendPasswordResetEmail(email);
                if (typeof window.showFormFeedback === 'function') {
                    window.showFormFeedback('forgot', '✅ Reset email sent! Check your inbox.', 'success');
                }
            } else {
                if (typeof window.showFormFeedback === 'function') {
                    window.showFormFeedback('forgot', 'Email service unavailable. Please try again later.', 'error');
                }
            }
        } catch (err) {
            if (typeof window.showFormFeedback === 'function') {
                window.showFormFeedback('forgot',
                    err.code === 'auth/user-not-found'
                        ? 'No account found with that email.'
                        : 'Failed to send reset email. Please try again.', 'error');
            }
        }
    };


    /* =========================================================================
       §11  SIGN-OUT HANDLER
       ========================================================================= */

    /**
     * Complete sign-out: clears Firebase session, localStorage, EmpState,
     * and reinitialises as guest.
     */
    async function signOutUser() {
        try {
            if (window._firebaseLoaded && window.fbAuth
                && typeof window.fbAuth.signOut === 'function') {
                await window.fbAuth.signOut();
            }
        } catch (e) {}

        /* Clear localStorage session (keep empyrean_users for next login) */
        try {
            localStorage.removeItem('empyrean_session');
            localStorage.removeItem('empyrean_session_email');
        } catch (e) {}

        /* Reset all state */
        if (window.EmpState && typeof window.EmpState.reset === 'function') {
            window.EmpState.reset();
        } else {
            window.isGuest   = true;
            window.isAdmin   = false;
            window.userState = {};
        }

        /* Stop live stream if active */
        const ld = (window.EmpState && window.EmpState.liveStreamData) || window.liveStreamData || {};
        if (ld.isLive && typeof window.endLiveStream === 'function') {
            window.endLiveStream();
        }

        if (typeof window.showNotification === 'function') {
            window.showNotification('You have been signed out.', 'info');
        }

        initializeApp(true);
    }
    window.signOutUser = signOutUser;


    /* =========================================================================
       §11b  DELETE MY ACCOUNT (self-service)
       =========================================================================
       Wires the existing #delete-account-btn (Settings → Security → Danger
       Zone). Fully removes the logged-in user from the platform:

         1. Deletes any business_pages owned by this user + their
            business_posts.
         2. Deletes this user's authored business_posts (pageless too).
         3. Deletes the users/{uid} Firestore profile document.
         4. Deletes the Firebase Auth credential via
            fbAuth.currentUser.delete().

       Firebase requires a RECENT login before currentUser.delete() will
       succeed (auth/requires-recent-login). If that error occurs, this
       shows a password re-entry prompt, re-authenticates via
       reauthenticateWithCredential, then retries the deletion.

       Guests / localStorage-only accounts (no Firebase user) are handled
       by simply clearing local session data.
       ========================================================================= */
    (function initDeleteOwnAccount() {

        function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        function _notify(msg, type) { if (typeof window.showNotification === 'function') window.showNotification(msg, type); else console.log('[DeleteAccount]', msg); }
        function _fbOk() { return !!(window._firebaseLoaded && window.fbDb && window.fbAuth); }

        /* Wipe this user's Firestore data: their business page(s) + posts,
           any pageless authored posts, and their user profile document. */
        function _wipeFirestoreData(uid) {
            if (!_fbOk() || !uid) return Promise.resolve();
            return window.fbDb.collection('business_pages').where('ownerId', '==', uid).get()
                .then(function (pagesSnap) {
                    var pageDeletes = [];
                    pagesSnap.forEach(function (pageDoc) {
                        var pid = pageDoc.id;
                        pageDeletes.push(
                            window.fbDb.collection('business_posts').where('pageId', '==', pid).get().then(function (postsSnap) {
                                var dels = [];
                                postsSnap.forEach(function (pd) { dels.push(pd.ref.delete().catch(function () {})); });
                                return Promise.all(dels);
                            }).then(function () { return pageDoc.ref.delete().catch(function () {}); })
                        );
                    });
                    return Promise.all(pageDeletes);
                })
                .then(function () {
                    return window.fbDb.collection('business_posts').where('userId', '==', uid).get().then(function (snap) {
                        var dels = [];
                        snap.forEach(function (doc) { dels.push(doc.ref.delete().catch(function () {})); });
                        return Promise.all(dels);
                    });
                })
                .then(function () { return window.fbDb.collection('users').doc(uid).delete().catch(function () {}); });
        }

        /* Show a small inline password prompt for re-authentication.
           Resolves with the entered password, or rejects if cancelled. */
        function _promptPassword() {
            return new Promise(function (resolve, reject) {
                var existing = document.getElementById('reauth-password-modal');
                if (existing) existing.remove();

                var modal = document.createElement('div');
                modal.id = 'reauth-password-modal';
                modal.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(10,14,39,0.65);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
                modal.innerHTML =
                    '<div style="background:#fff;border-radius:18px;width:100%;max-width:380px;padding:24px;box-shadow:0 12px 40px rgba(10,14,39,0.25);">' +
                    '<h3 style="margin:0 0 8px;font-size:1.02rem;font-weight:900;color:#0A0E27;"><i class="fas fa-lock" style="color:#EF4444;margin-right:8px;"></i>Confirm Your Password</h3>' +
                    '<p style="margin:0 0 14px;font-size:0.85rem;color:#6B7280;line-height:1.5;">For your security, please re-enter your password to permanently delete your account.</p>' +
                    '<input type="password" id="reauth-password-input" placeholder="Current password" style="width:100%;box-sizing:border-box;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;padding:11px 13px;font-size:0.9rem;outline:none;margin-bottom:14px;">' +
                    '<div id="reauth-password-error" style="display:none;color:#EF4444;font-size:0.8rem;margin-bottom:10px;"></div>' +
                    '<div style="display:flex;gap:10px;">' +
                    '<button id="reauth-cancel-btn" style="flex:1;padding:11px;border-radius:10px;background:rgba(10,14,39,0.06);color:#374151;border:none;font-weight:700;cursor:pointer;">Cancel</button>' +
                    '<button id="reauth-confirm-btn" style="flex:1;padding:11px;border-radius:10px;background:#EF4444;color:#fff;border:none;font-weight:800;cursor:pointer;">Confirm</button>' +
                    '</div></div>';
                document.body.appendChild(modal);

                var input = document.getElementById('reauth-password-input');
                input.focus();
                document.getElementById('reauth-cancel-btn').addEventListener('click', function () {
                    modal.remove();
                    reject(new Error('cancelled'));
                });
                document.getElementById('reauth-confirm-btn').addEventListener('click', function () {
                    var pw = input.value || '';
                    if (!pw) {
                        var err = document.getElementById('reauth-password-error');
                        err.textContent = 'Please enter your password.';
                        err.style.display = 'block';
                        return;
                    }
                    modal.remove();
                    resolve(pw);
                });
                input.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') document.getElementById('reauth-confirm-btn').click();
                });
            });
        }

        /* Re-authenticate the current Firebase user with their password,
           then retry currentUser.delete(). */
        function _reauthAndDelete(fbUser, btn) {
            return _promptPassword().then(function (password) {
                if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth.EmailAuthProvider) {
                    throw new Error('Re-authentication is unavailable in this environment.');
                }
                var cred = firebase.auth.EmailAuthProvider.credential(fbUser.email, password);
                return fbUser.reauthenticateWithCredential(cred).then(function () {
                    return fbUser.delete();
                });
            });
        }

        function _finishLocalCleanup() {
            try {
                localStorage.removeItem('empyrean_session');
                localStorage.removeItem('empyrean_session_email');
                /* Remove this user from the saved-accounts switcher list */
                var raw = localStorage.getItem('empyrean_users');
                if (raw && window.userState && window.userState.email) {
                    var users = JSON.parse(raw);
                    if (users && users[window.userState.email]) {
                        delete users[window.userState.email];
                        localStorage.setItem('empyrean_users', JSON.stringify(users));
                    }
                }
            } catch (e) {}

            if (window.EmpState && typeof window.EmpState.reset === 'function') {
                window.EmpState.reset();
            } else {
                window.isGuest   = true;
                window.isAdmin   = false;
                window.userState = {};
            }

            _notify('Your account has been permanently deleted.', 'success');
            if (typeof initializeApp === 'function') initializeApp(true);
        }

        function _runDeletion(btn) {
            var us  = (window.EmpState && window.EmpState.userState) || window.userState || {};
            var uid = us.id || '';

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting account…';

            var fbUser = (window._firebaseLoaded && window.fbAuth && window.fbAuth.currentUser) || null;

            _wipeFirestoreData(uid)
                .then(function () {
                    if (!fbUser) return _finishLocalCleanup();
                    return fbUser.delete()
                        .then(_finishLocalCleanup)
                        .catch(function (err) {
                            if (err && err.code === 'auth/requires-recent-login') {
                                return _reauthAndDelete(fbUser, btn).then(_finishLocalCleanup);
                            }
                            throw err;
                        });
                })
                .catch(function (err) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-trash"></i> Delete My Account';
                    if (err && err.message === 'cancelled') return;
                    _notify('Could not delete account: ' + (err && err.message ? err.message : 'Please try again.'), 'error');
                });
        }

        function _wire() {
            var btn = document.getElementById('delete-account-btn');
            if (!btn || btn._wired) return;
            btn._wired = true;
            var originalLabel = btn.innerHTML;

            btn.addEventListener('click', function () {
                if (window.isGuest) { _notify('Please log in first.', 'info'); return; }

                if (!btn._confirming) {
                    btn._confirming = true;
                    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Tap again to permanently delete your account';
                    setTimeout(function () {
                        if (btn._confirming) {
                            btn._confirming = false;
                            btn.innerHTML = originalLabel;
                        }
                    }, 5000);
                    return;
                }
                btn._confirming = false;
                _runDeletion(btn);
            });
        }

        if (document.readyState !== 'loading') _wire();
        else document.addEventListener('DOMContentLoaded', _wire);
        document.addEventListener('empyrean-init-done', function () { setTimeout(_wire, 400); });
        document.addEventListener('empyrean-section-change', function (ev) {
            if (ev && ev.detail && ev.detail.section === 'settings') setTimeout(_wire, 150);
        });

        console.log('[EmpAuth] ✅ Delete My Account wired — Firestore wipe + Firebase Auth delete + re-auth handling.');
    })();


    /* =========================================================================
       §12  AUTH MODAL — OPEN / CLOSE / VIEW SWITCHING
       ========================================================================= */

    /**
     * Open the auth modal and optionally jump to a specific view.
     * @param {'login'|'signup'|'forgot'} [view='login']
     */
    window.openAuthModal = function openAuthModal(view) {
        view = view || 'login';
        const am = document.getElementById('auth-modal-overlay');
        if (!am) return;
        am.style.display = 'flex';
        am.classList.add('show');
        document.body.classList.add('modal-open');

        ['login-view', 'signup-view', 'forgot-password-view'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        const target = view === 'signup'  ? 'signup-view'
            : view === 'forgot' ? 'forgot-password-view'
            : 'login-view';
        const targetEl = document.getElementById(target);
        if (targetEl) targetEl.style.display = 'block';

        if (view === 'login' && typeof window.generateCaptcha === 'function') {
            window.generateCaptcha();
        }
    };

    /** Close the auth modal and reset to login view. */
    window.closeAuthModal = function closeAuthModal() {
        const am = document.getElementById('auth-modal-overlay');
        if (am) { am.classList.remove('show'); am.style.display = 'none'; }
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
    };

    /* Wire form submit events */
    document.addEventListener('DOMContentLoaded', function () {
        const loginForm  = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const forgotForm = document.getElementById('forgot-password-form');
        if (loginForm  && !loginForm._empAuthWired) {
            loginForm._empAuthWired  = true;
            loginForm.addEventListener('submit', window._handleLoginSubmit);
        }
        if (signupForm && !signupForm._empAuthWired) {
            signupForm._empAuthWired = true;
            signupForm.addEventListener('submit', window._handleRegisterSubmit);
        }
        if (forgotForm && !forgotForm._empAuthWired) {
            forgotForm._empAuthWired = true;
            forgotForm.addEventListener('submit', window._handleForgotPassword);
        }
    });

    /* Delegate auth modal button clicks (works even if buttons load later) */
    document.addEventListener('click', function (e) {
        const t = e.target;

        if (t.closest('#login-signup-btn, .open-auth-modal')) {
            e.preventDefault();
            window.openAuthModal('login');
        }
        if (t.closest('#show-signup')) {
            e.preventDefault();
            window.openAuthModal('signup');
        }
        if (t.closest('#show-login, #back-to-login')) {
            e.preventDefault();
            window.openAuthModal('login');
        }
        if (t.closest('#show-forgot-password')) {
            e.preventDefault();
            window.openAuthModal('forgot');
        }
        if (t.closest('.close-modal, .close-modal-btn, #auth-modal-overlay')
            && !t.closest('.auth-card, .modal-card')) {
            window.closeAuthModal();
        }
        if (t.closest('#logout-btn, #admin-logout-btn')) {
            e.preventDefault();
            signOutUser();
        }
        if (t.closest('.btn-google')) {
            e.preventDefault();
            window._handleGoogleSignIn();
        }

        /* #refresh-captcha */
        if (t.id === 'refresh-captcha' || t.closest('#refresh-captcha')) {
            e.preventDefault();
            if (typeof window.generateCaptcha === 'function') window.generateCaptcha();
        }
    });


    /* =========================================================================
       §13  propagateProfilePicture
       ========================================================================= */

    /**
     * Push the current userState.avatar to every avatar element that belongs
     * to the logged-in user.  Call after any avatar update.
     */
    function propagateProfilePicture() {
        const S  = window.EmpState || {};
        const us = S.userState || window.userState || {};
        if (!us.avatar) return;
        const src = us.avatar;

        const sba = document.getElementById('sidebar-user-avatar');
        if (sba) sba.src = src;

        document.querySelectorAll('.user-own-avatar').forEach(function (el) {
            if (el.tagName === 'IMG') el.src = src;
            else el.style.backgroundImage = "url('" + src + "')";
        });

        const ld = S.liveStreamData || window.liveStreamData || {};
        if (ld.hostUserId === us.id) {
            ['live-host-avatar', 'live-stream-host-avatar'].forEach(function (id) {
                const el = document.getElementById(id);
                if (el) el.src = src;
            });
        }

        const sa = document.querySelector('.sidebar-user-avatar');
        if (sa) sa.src = src;
    }
    window.propagateProfilePicture = propagateProfilePicture;


    /* =========================================================================
       §14  LISTENER RETRY + NETWORK RESUME
       ========================================================================= */

    /** Exponential-backoff retry for _startRealtimeListeners on bad connections. */
    window._scheduleListenerRetry = function () {
        window._listenerRetryCount = (window._listenerRetryCount || 0) + 1;
        if (window._listenerRetryCount > 15) {
            console.warn('[Listeners] Max retries — waiting for network.');
            return;
        }
        if (!window._listenerRetryScheduled) {
            window._listenerRetryScheduled = true;
            const delay = Math.min(1500 * window._listenerRetryCount, 12000);
            setTimeout(function () {
                window._listenerRetryScheduled = false;
                if (typeof window._startRealtimeListeners === 'function') {
                    window._startRealtimeListeners();
                }
            }, delay);
        }
    };

    /* Resume listeners when network comes back (critical for Lagos users) */
    if (!window._empyreanOnlineListenerAdded) {
        window._empyreanOnlineListenerAdded = true;
        window.addEventListener('online', function () {
            console.log('[Listeners] Network restored — restarting…');
            window._listenerRetryCount     = 0;
            window._listenerRetryScheduled = false;
            setTimeout(function () {
                if (typeof window._startRealtimeListeners === 'function') {
                    window._startRealtimeListeners();
                }
            }, 1000);
        });
    }

    console.log('[EmpAuth] ✅ Authentication module ready.');

})();