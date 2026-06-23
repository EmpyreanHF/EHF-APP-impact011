/* =============================================================================
   EMPYREAN INTERNATIONAL — NOTIFICATION SYSTEM
   app-notifications.js  |  Step 0.5  |  Refactor Roadmap v1.0
   =============================================================================

   PURPOSE
   ───────
   Full notification infrastructure extracted from the initNotificationSystem
   IIFE inside app-fixes.js.  Manages the bell icon, unread badge, notification
   panel, Firestore loader, online-presence simulation, and live-stream alerts.

   LOAD ORDER
   ──────────
   <script src="firebase-init.js">
   <script src="app-state.js">
   <script src="app-helpers.js">     ← showNotification, _timeAgo
   <script src="app-contracts.js">
   <script src="app-notifications.js">   ← THIS FILE
   ... remaining modules ...

   DEPENDS ON
   ──────────
   • window.showNotification  (app-helpers.js)  — toast fallback
   • window._timeAgo          (app-helpers.js)  — relative time in panel
   • window.EmpState / window.isGuest            — auth guard
   • window.userState                            — user.id, followedUserIds
   • window.mockUsers                            — friend profile lookup
   • window.fbDb              (firebase-init.js) — Firestore read/write

   PUBLIC API (all on window.*)
   ────────────────────────────
   window.pushNotification(message, type, icon?, extraData?)
       Add a notification to the bell panel and show a toast if the
       panel is closed.  extraData is merged into the notification object
       (supports channelName, streamId, hostName for live-stream entries;
       navTarget for any notification that should navigate to a
       content-section on tap). Returns the created entry (with .id) so
       callers can later update it via updateNotification().

   window.updateNotification(id, patch)
       Merge `patch` into an existing notification (looked up by the id
       returned from pushNotification) without creating a new bell entry
       or firing another toast. Used for live status like download
       progress. Re-renders the panel only if it's open.

   window.notifyFriendsUserIsLive(hostName, streamId)
       Push a "TAP TO JOIN" live notification to all followers and
       write a Firestore record for server-side push delivery.

   window.loadUserNotifications()
       (Re-)fetch the user's notification history from Firestore.
       Safe to call after login or re-authentication.

   window.empyreanNotifications   []   — full notification store array

   SECTION MAP
   ───────────
   §1  Store & unread counter
   §2  Bell icon & panel builder
   §3  Badge updater
   §4  Panel list renderer
   §5  pushNotification (public)
   §6  Online-presence simulation
   §7  Live-stream notification dispatch
   §8  Firestore notification loader
   §9  Contact-list online dots
   §10 Bootstrap & polling

   ============================================================================= */

(function empyreanNotificationsModule() {
    'use strict';

    if (window._empyreanNotifLoaded) {
        console.warn('[EmpNotif] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanNotifLoaded = true;

    /* =========================================================================
       §1  NOTIFICATION STORE & UNREAD COUNTER
       ========================================================================= */

    /** In-memory notification array. Persists for the session lifetime. */
    if (!window.empyreanNotifications) window.empyreanNotifications = [];

    /** Count of notifications the user hasn't seen yet. */
    let _unread = 0;

    /** Set of user-IDs currently considered online (for presence simulation). */
    const _onlineFriends = new Set();


    /* =========================================================================
       §2  BELL ICON & PANEL BUILDER
       ========================================================================= */

    /**
     * Inject the notification bell button and dropdown panel into the page
     * header.  Idempotent — does nothing if the bell already exists.
     * Target insertion point: #main-header-actions.
     */
    function buildNotificationBell() {
        const headerActions = document.getElementById('main-header-actions');
        if (!headerActions || document.getElementById('notif-bell-btn')) return;

        /* ── Bell button ── */
        const bellWrap = document.createElement('div');
        bellWrap.style.cssText = 'position:relative;display:inline-flex;margin-right:8px;';
        bellWrap.innerHTML = `
            <button id="notif-bell-btn"
                style="background:rgba(10,14,39,0.05);border:1.5px solid rgba(10,14,39,0.08);
                       border-radius:50%;width:40px;height:40px;display:flex;align-items:center;
                       justify-content:center;cursor:pointer;transition:all 0.2s;position:relative;"
                title="Notifications" aria-label="Notifications" aria-haspopup="true">
                <i class="fas fa-bell" style="font-size:1rem;color:var(--primary);"></i>
                <span id="notif-badge"
                    style="display:none;position:absolute;top:-3px;right:-3px;
                           background:#EF4444;color:white;font-size:0.6rem;font-weight:800;
                           min-width:18px;height:18px;border-radius:50%;
                           align-items:center;justify-content:center;
                           border:2px solid white;">0</span>
            </button>`;
        headerActions.prepend(bellWrap);

        /* ── Dropdown panel ── */
        const panel = document.createElement('div');
        panel.id = 'notif-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Notifications');
        panel.style.cssText =
            'display:none;position:fixed;top:64px;right:12px;width:340px;max-height:480px;'
            + 'background:white;border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,0.15);'
            + 'border:1px solid rgba(10,14,39,0.08);z-index:var(--z-toast, 4000);overflow:hidden;';
        panel.innerHTML = `
            <div style="padding:16px 20px;border-bottom:1px solid rgba(10,14,39,0.07);
                        display:flex;align-items:center;justify-content:space-between;">
                <strong style="font-family:'Syne',sans-serif;font-size:1rem;
                               color:var(--primary);">Notifications</strong>
                <button id="notif-mark-all-read"
                    style="background:none;border:none;color:var(--secondary);
                           font-size:0.78rem;cursor:pointer;font-weight:600;">
                    Mark all read
                </button>
            </div>
            <div id="notif-list" style="overflow-y:auto;max-height:400px;" role="list"></div>`;
        document.body.appendChild(panel);

        /* ── Bell click — open / close panel ── */
        document.getElementById('notif-bell-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            const p      = document.getElementById('notif-panel');
            const isOpen = p.style.display === 'block';
            p.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) {
                _unread = 0;
                updateBadge();
                renderNotifList();
            }
        });

        /* ── Click outside panel — close ── */
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-bell-btn')) {
                const p = document.getElementById('notif-panel');
                if (p) p.style.display = 'none';
            }
        });

        /* ── Mark all read ── */
        document.getElementById('notif-mark-all-read').addEventListener('click', function() {
            window.empyreanNotifications.forEach(function(n) { n.read = true; });
            _unread = 0;
            updateBadge();
            renderNotifList();
        });
    }


    /* =========================================================================
       §3  BADGE UPDATER
       ========================================================================= */

    /**
     * Sync the red unread-count badge on the bell icon with the current
     * _unread counter.  Hides the badge when count reaches zero.
     */
    function updateBadge() {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (_unread > 0) {
            badge.style.display = 'flex';
            badge.textContent   = _unread > 9 ? '9+' : String(_unread);
        } else {
            badge.style.display = 'none';
        }
    }


    /* =========================================================================
       §4  PANEL LIST RENDERER
       ========================================================================= */

    /**
     * Map of notification type → emoji prefix shown in the panel.
     * Extend this object to support new notification types without modifying
     * the renderer.
     */
    const _ICON_MAP = {
        success:      '✅',
        error:        '❌',
        warning:      '⚠️',
        info:         'ℹ️',
        live:         '🔴',
        online:       '🟢',
        sos:          '🆘',
        new_reel:     '🎬',
        new_news:     '📰',
        new_listing:  '🛒',
        announcement: '📢',
        new_post:     '📝',
        new_follower: '👤',
        mention:      '🔔',
        like:         '❤️',
        comment:      '💬',
        gift:         '🎁',
        reward:       '💰',
        bookmark:     '🔖',
        download:     '⬇️'
    };

    /**
     * Re-render the full notification list inside #notif-list.
     * Shows the 30 most recent entries. Live-stream entries are tappable.
     */
    function renderNotifList() {
        const list = document.getElementById('notif-list');
        if (!list) return;

        const notifs = window.empyreanNotifications;

        if (!notifs.length) {
            list.innerHTML =
                '<div style="text-align:center;padding:30px;color:var(--text-muted);">'
                + '<i class="fas fa-bell-slash" style="font-size:1.8rem;display:block;margin-bottom:8px;"></i>'
                + 'No notifications yet</div>';
            return;
        }

        list.innerHTML = '';

        notifs.slice(0, 30).forEach(function(n) {
            const isLive = n.type === 'live' && n.channelName;
            /* Generic deep-link support: any notification can carry a
               navTarget (a content-section id) to become tappable, without
               the renderer needing a hardcoded branch per notification
               type. Live entries keep their existing special-cased
               auto-join behaviour below; everything else (bookmarks,
               downloads, future types) just navigates on tap. */
            const isNavTappable = !isLive && !!n.navTarget;
            const tappable = isLive || isNavTappable;
            const icon   = _ICON_MAP[n.type] || 'ℹ️';
            const bg     = n.read ? 'transparent' : 'rgba(27,43,139,0.03)';
            const time   = window._timeAgo ? window._timeAgo(n.ts) : (n.time || '');

            const item = document.createElement('div');
            item.setAttribute('role', 'listitem');
            item.style.cssText =
                'padding:14px 20px;border-bottom:1px solid rgba(10,14,39,0.05);'
                + 'background:' + bg + ';display:flex;gap:12px;align-items:flex-start;'
                + (tappable ? 'cursor:pointer;' : '');

            if (isLive) {
                item.title = 'Tap to join live stream';
                item.addEventListener('click', function() {
                    /* Close the panel */
                    const p = document.getElementById('notif-panel');
                    if (p) p.style.display = 'none';

                    /* Navigate to the live section */
                    if (typeof window.navigateTo === 'function') window.navigateTo('go-live');

                    /* Attempt to auto-join */
                    setTimeout(function() {
                        if (typeof window.joinLiveAsViewer === 'function') {
                            window.joinLiveAsViewer(n.channelName, n.hostName);
                        }
                        const joinBtn = document.querySelector(
                            '.join-live-btn[data-stream-id="' + (n.streamId || '') + '"]'
                        );
                        if (joinBtn) {
                            joinBtn.click();
                        } else {
                            const lm = document.getElementById('go-live-modal-overlay');
                            if (lm) {
                                lm.style.display = 'flex';
                                lm.classList.add('show');
                                document.body.classList.add('modal-open');
                            }
                        }
                    }, 300);
                });
            } else if (isNavTappable) {
                item.title = 'Tap to view';
                item.addEventListener('click', function() {
                    const p = document.getElementById('notif-panel');
                    if (p) p.style.display = 'none';
                    if (typeof window.navigateTo === 'function') window.navigateTo(n.navTarget);
                });
            }

            const joinTag = isLive
                ? ' <span style="color:#EF4444;font-size:0.72rem;font-weight:700;">TAP TO JOIN →</span>'
                : (isNavTappable
                    ? ' <span style="color:var(--secondary,#1D9BF0);font-size:0.72rem;font-weight:700;">VIEW →</span>'
                    : '');

            item.innerHTML =
                '<span style="font-size:1.2rem;flex-shrink:0;">' + icon + '</span>'
                + '<div style="flex:1;min-width:0;">'
                + '<p style="font-size:0.85rem;color:var(--primary);margin:0 0 3px;line-height:1.4;">'
                + _escapeHtml(n.message) + joinTag + '</p>'
                + '<span style="font-size:0.72rem;color:var(--text-muted);">' + time + '</span>'
                + '</div>';

            list.appendChild(item);
        });
    }

    /**
     * Minimal HTML escaper to prevent XSS from notification message strings.
     * @param {string} str
     * @returns {string}
     */
    function _escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }


    /* =========================================================================
       §5  PUSH NOTIFICATION (PUBLIC)
       ========================================================================= */

    /**
     * Add a notification to the in-memory store and update the bell UI.
     * If the panel is closed, also shows a toast via showNotification().
     *
     * @param {string}  message    — Notification text
     * @param {string}  [type]     — One of the keys in _ICON_MAP (default: 'info')
     * @param {string}  [icon]     — Unused param kept for backward compat
     * @param {Object}  [extraData]— Merged into the notification object.
     *                               Set { channelName, streamId, hostName } for live entries.
     */
    window.pushNotification = function pushNotification(message, type, icon, extraData) {
        if (!window.empyreanNotifications) window.empyreanNotifications = [];

        const entry = Object.assign(
            {
                id:      'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                message: message,
                type:    type   || 'info',
                time:    new Date().toLocaleTimeString(),
                ts:      Date.now(),
                read:    false
            },
            extraData || {}
        );

        window.empyreanNotifications.unshift(entry);
        _unread++;
        updateBadge();

        /* Show toast only when panel is not open */
        const panel = document.getElementById('notif-panel');
        if (!panel || panel.style.display !== 'block') {
            if (typeof window.showNotification === 'function') {
                window.showNotification(message, type || 'info');
            }
        } else {
            /* Panel is open — re-render the list in real-time */
            renderNotifList();
        }

        return entry;
    };


    /**
     * Mutate an existing notification in place (e.g. advancing a download's
     * progress percentage) without creating a new bell entry or firing a
     * toast each time. Re-renders the panel only if it's actually open, so
     * a fast-ticking progress update doesn't thrash the DOM for no reason.
     *
     * @param {string} id     — the id returned by pushNotification()
     * @param {Object} patch  — fields to merge into the notification
     * @returns {Object|null} the updated entry, or null if not found
     */
    window.updateNotification = function updateNotification(id, patch) {
        if (!id || !window.empyreanNotifications) return null;
        const entry = window.empyreanNotifications.find(function(n) { return n.id === id; });
        if (!entry) return null;
        Object.assign(entry, patch || {});
        const panel = document.getElementById('notif-panel');
        if (panel && panel.style.display === 'block') renderNotifList();
        return entry;
    };


    /* =========================================================================
       §6  ONLINE-PRESENCE SIMULATION
       ========================================================================= */

    /**
     * Randomly simulate followed users coming online and notify the current
     * user when they do.  Runs every 45 seconds (see §10).
     *
     * Each followed user has an 8% chance of toggling online status per cycle.
     * Online-dot colours in the contact list are updated in real time.
     */
    function _checkFriendOnlineStatus() {
        const S   = window.EmpState || {};
        const us  = S.userState || window.userState || {};
        if (S.isGuest || window.isGuest || !us.followedUserIds) return;

        const followed   = Array.from(us.followedUserIds);
        const mockUsers  = S.mockUsers || window.mockUsers || {};

        followed.forEach(function(uid) {
            const user = mockUsers[uid];
            if (!user) return;

            if (Math.random() < 0.08) {
                if (!_onlineFriends.has(uid)) {
                    _onlineFriends.add(uid);
                    window.pushNotification(
                        '🟢 ' + (user.fullName || ('@' + user.username)) + ' is now online',
                        'online'
                    );
                    /* Update dots in the contact list */
                    document.querySelectorAll(
                        '.contact-item[data-user-id="' + uid + '"] .online-dot'
                    ).forEach(function(dot) {
                        dot.style.background = 'var(--success-color, #10B981)';
                    });
                } else {
                    _onlineFriends.delete(uid);
                }
            }
        });
    }


    /* =========================================================================
       §7  LIVE-STREAM NOTIFICATION DISPATCH
       ========================================================================= */

    /**
     * Push a "user went live" notification to all of this user's followers
     * (in the current session), and write a Firestore record so server-side
     * push notifications can be delivered to offline followers.
     *
     * Called by app-live.js when the host starts a stream.
     *
     * @param {string} hostName  — Display name of the host
     * @param {string} streamId  — Firestore stream document ID
     */
    window.notifyFriendsUserIsLive = function notifyFriendsUserIsLive(hostName, streamId) {
        const S  = window.EmpState || {};
        const us = S.userState || window.userState || {};
        if (S.isGuest || window.isGuest) return;

        const followed  = Array.from(us.followedUserIds || []);
        const mockUsers = S.mockUsers || window.mockUsers || {};

        followed.forEach(function(uid) {
            /* Only notify users who are present in this session */
            if (mockUsers[uid]) {
                window.pushNotification(
                    '🔴 ' + hostName + ' just went LIVE! Tap to join the stream.',
                    'live',
                    null,
                    { channelName: streamId, streamId: streamId, hostName: hostName }
                );
            }
        });

        /* Firestore record for server-side / offline push delivery */
        try {
            const db = window.fbDb;
            if (db) {
                db.collection('live_notifications').add({
                    hostId:    us.id,
                    hostName:  hostName,
                    streamId:  streamId,
                    message:   hostName + ' is now live!',
                    createdAt: new Date().toISOString()
                });
            }
        } catch (e) { /* silent — never blocks the stream */ }
    };


    /* =========================================================================
       §8  FIRESTORE NOTIFICATION LOADER
       ========================================================================= */

    /**
     * Fetch this user's notification history from Firestore on login.
     * Runs two queries in parallel:
     *   1. Community-wide notifications (announcements, new content, etc.)
     *   2. User-specific notifications (mentions, likes, follows, etc.)
     *
     * Both result sets are de-duplicated against the in-memory store.
     * Safe to call multiple times — duplicate IDs are ignored.
     */
    function loadUserNotifications() {
        const S  = window.EmpState || {};
        const us = S.userState || window.userState || {};
        if (S.isGuest || window.isGuest || !us.id) return;

        const db = window.fbDb;
        if (!db) return;

        /* ── Query 1: Community-wide (recent 20) ── */
        try {
            db.collection('notifications')
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get()
                .then(function(snap) {
                    if (!snap || snap.empty) return;
                    snap.forEach(function(doc) {
                        const n = doc.data();
                        /* Skip already loaded */
                        if (window.empyreanNotifications.find(function(x) { return x.id === doc.id; })) return;
                        /* Skip user-specific notifications that target a different user */
                        if (n.userId && n.userId !== us.id) return;

                        window.empyreanNotifications.push({
                            id:      doc.id,
                            message: n.message,
                            type:    n.type   || 'info',
                            time:    n.createdAt
                                ? new Date(n.createdAt).toLocaleString('en-GB', {
                                    day: 'numeric', month: 'short',
                                    hour: '2-digit', minute: '2-digit'
                                  })
                                : '',
                            ts:   n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
                            read: n.read || false
                        });
                        if (!n.read) _unread++;
                    });
                    updateBadge();
                    renderNotifList();
                })
                .catch(function() {});
        } catch (e) {}

        /* ── Query 2: User-specific ── */
        try {
            db.collection('notifications')
                .where('userId', '==', us.id)
                .get()
                .then(function(snap) {
                    if (!snap || snap.empty) return;
                    snap.forEach(function(doc) {
                        if (window.empyreanNotifications.find(function(x) { return x.id === doc.id; })) return;
                        const n = doc.data();
                        window.empyreanNotifications.push({
                            id:      doc.id,
                            message: n.message,
                            type:    n.type || 'info',
                            time:    n.createdAt ? new Date(n.createdAt).toLocaleTimeString() : '',
                            ts:      n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
                            read:    n.read || false
                        });
                        if (!n.read) _unread++;
                    });
                    updateBadge();
                })
                .catch(function() {});
        } catch (e) {}
    }

    /* Expose so app-auth.js can call it after login */
    window.loadUserNotifications = loadUserNotifications;


    /* =========================================================================
       §9  CONTACT-LIST ONLINE DOTS
       ========================================================================= */

    /**
     * Append a small coloured presence dot to every .contact-item avatar
     * that doesn't already have one.  Initial colour is grey (offline).
     * _checkFriendOnlineStatus() will update dot colours for online users.
     */
    function _addOnlineDotsToContacts() {
        document.querySelectorAll('.contact-item').forEach(function(item) {
            if (item.querySelector('.online-dot')) return;
            const avatar = item.querySelector('.avatar-placeholder');
            if (!avatar) return;
            avatar.style.position = 'relative';
            const dot        = document.createElement('div');
            dot.className    = 'online-dot';
            dot.style.cssText =
                'position:absolute;bottom:2px;right:2px;width:10px;height:10px;'
                + 'border-radius:50%;background:#9CA3AF;border:2px solid white;'
                + 'transition:background 0.4s ease;';
            avatar.appendChild(dot);
        });
    }


    /* =========================================================================
       §10  BOOTSTRAP & POLLING
       ========================================================================= */

    /**
     * Run the initial setup after a short delay to ensure the DOM has settled
     * and app-auth.js has had a chance to authenticate the user.
     */
    setTimeout(function() {
        buildNotificationBell();
        loadUserNotifications();
        _addOnlineDotsToContacts();
    }, 800);

    /**
     * Poll online-presence simulation and refresh contact dots every 45 s.
     * Low frequency — this is UI polish, not critical infrastructure.
     */
    setInterval(function() {
        _checkFriendOnlineStatus();
        _addOnlineDotsToContacts();
    }, 45_000);

    /**
     * Re-initialise the bell after the app fully boots (e.g. after a guest→
     * authenticated transition that rebuilds the sidebar/header).
     */
    document.addEventListener('empyrean-init-done', function() {
        setTimeout(function() {
            buildNotificationBell();
            loadUserNotifications();
        }, 600);
    });

    /**
     * Re-initialise the bell when the user logs in from an already-loaded page.
     * app-auth.js dispatches 'empyrean-user-ready' after onAuthStateChanged resolves.
     */
    document.addEventListener('empyrean-user-ready', function() {
        setTimeout(function() {
            buildNotificationBell();
            loadUserNotifications();
            _addOnlineDotsToContacts();
        }, 400);
    });

    console.log('[EmpNotif] ✅ Notification system ready.');

})();