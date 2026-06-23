/* =============================================================================
   EMPYREAN INTERNATIONAL — BUSINESS PAGE MODULE
   app-business.js  |  v3.1  |  Complete rewrite
   =============================================================================

   PURPOSE
   ───────
   Standalone module that owns everything related to Business Pages:

     • renderBusinessPage(bizId)    — full page renderer into #business-page
     • renderDashboardBusinesses()  — dashboard business-pages slider
     • submitBusinessPost()         — create/upload a post for the page
     • Post composer ownership      — owner sees composer, visitors never do
     • Business posts feed          — product/listing cards with media
     • Create business page form    — modal wire-up with Cloudinary upload

   DESIGN REFERENCES
   ─────────────────
   Facebook business pages (cover + avatar + about + tabs + posts)
   with Empyrean brand colours (navy #0A0E27 / royal #1B2B8B / violet #5B0EA6)

   FIRESTORE COLLECTIONS
   ─────────────────────
   business_pages   — page documents  { id, ownerId, name, industry, bio,
                                        coverPhoto, profilePhoto, website,
                                        email, phone, followers[], createdAt }
   business_posts   — post documents  { id, pageId, userId, text, media[],
                                        pageName, createdAt, likes, comments }

   DOM TARGETS
   ───────────
   #business-page              — section that receives full rendered page
   #dashboard-bizposts-container / #dashboard-bizposts-slider  — dashboard strip
   #dashboard-business-container / #dashboard-business-slider  — alias strip (§14 compat)
   #create-business-page-form  — create-page modal form
   window._activeBizPageId     — shared state: currently viewed biz page id
   window._activeBizData       — shared state: currently viewed biz page data
   window._firestoreBusinessPages — shared cache of all fetched pages

   PUBLIC API
   ──────────
   window.renderBusinessPage(bizId)
   window.renderDashboardBusinesses()
   window.submitBusinessPost()

   SECTION MAP
   ───────────
   §1  Module guard + state helpers
   §2  HTML escape / attribute escape utilities
   §3  Cloudinary upload helper
   §4  Create Business Page modal — form wire-up
   §5  renderBusinessPage(bizId) — full page renderer
   §6  renderDashboardBusinesses() — dashboard slider
   §7  submitBusinessPost() — post creation
   §8  Post composer ownership enforcement
   §9  Navigation + section-change listeners
   §10 Dashboard business posts (product cards) slider — #dashboard-bizposts-slider

   ============================================================================= */

(function empyreanBusinessModule() {
    'use strict';

    /* =========================================================================
       §1  MODULE GUARD + STATE HELPERS
       ========================================================================= */

    if (window._empyreanBusinessLoaded) {
        console.warn('[EmpBusiness] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanBusinessLoaded = true;

    function _S()       { return window.EmpState || {}; }
    function _us()      { return _S().userState || window.userState || {}; }
    function _isGuest() { var s = _S(); return s.isGuest != null ? !!s.isGuest : !!window.isGuest; }
    function _isAdmin() { return !!(window.isAdmin || (_S().isAdmin)); }
    function _fbOk()    { return !!(window._firebaseLoaded && window.fbDb); }

    function ready(fn) {
        if (document.readyState !== 'loading') { fn(); }
        else { document.addEventListener('DOMContentLoaded', fn); }
    }


    /* =========================================================================
       §2  UTILITIES
       ========================================================================= */

    function _esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _attr(s) { return String(s || '').replace(/"/g, '&quot;'); }

    function _notify(msg, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(msg, type || 'info');
        }
    }

    function _ts(createdAt) {
        if (!createdAt) return '';
        var d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }


    /* =========================================================================
       §3  CLOUDINARY UPLOAD HELPER
       ========================================================================= */

    function _uploadMedia(file) {
        return new Promise(function (resolve, reject) {
            if (!file) return reject(new Error('No file'));
            var isVid = file.type && file.type.startsWith('video/');
            var _cfg  = (window._appConfig && window._appConfig.cloudinary) || {};
            var _cloud  = _cfg.cloud  || 'dxwmts9vw';
            var _preset = _cfg.preset || 'ehfapp_preset';
            var fd = new FormData();
            fd.append('file', file);
            fd.append('upload_preset', _preset);
            fd.append('tags', 'empyrean_business');
            fetch('https://api.cloudinary.com/v1_1/' + _cloud + '/' + (isVid ? 'video' : 'image') + '/upload', {
                method: 'POST', body: fd
            })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (d) { if (!d.secure_url) throw new Error('No URL'); resolve(d.secure_url); })
            .catch(reject);
        });
    }
    window._bizUploadMedia = _uploadMedia;


    /* =========================================================================
       §4  CREATE BUSINESS PAGE MODAL — FORM WIRE-UP
       ========================================================================= */

    (function wireCreatePageModal() {

        var _coverUrl   = '';
        var _avatarUrl  = '';

        function _openModal() {
            var m = document.getElementById('create-business-page-modal');
            if (m) { m.style.display = 'flex'; m.classList.add('show'); document.body.classList.add('modal-open'); }
        }

        function _closeModal() {
            var m = document.getElementById('create-business-page-modal');
            if (m) { m.style.display = 'none'; m.classList.remove('show'); document.body.classList.remove('modal-open'); }
        }

        function _wireImageUploader(inputId, previewId, isAvatar) {
            var input   = document.getElementById(inputId);
            var preview = document.getElementById(previewId);
            if (!input || !preview) return;
            input.addEventListener('change', function () {
                var file = input.files && input.files[0];
                if (!file) return;
                preview.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                _uploadMedia(file).then(function (url) {
                    if (isAvatar) {
                        _avatarUrl = url;
                        preview.style.backgroundImage = 'url(' + url + ')';
                        preview.style.backgroundSize  = 'cover';
                        preview.innerHTML = '';
                    } else {
                        _coverUrl = url;
                        preview.style.backgroundImage = 'url(' + url + ')';
                        preview.style.backgroundSize  = 'cover';
                        preview.innerHTML = '';
                    }
                    _notify('Image uploaded!', 'success');
                }).catch(function () {
                    _notify('Upload failed — please try again.', 'error');
                    preview.innerHTML = '<i class="fas fa-camera"></i>&nbsp; Add Cover Image';
                });
            });
        }

        function _wireForm() {
            var form = document.getElementById('create-business-page-form');
            if (!form || form._bizWired) return;
            form._bizWired = true;

            _wireImageUploader('page-cover-photo-input',   'page-cover-photo-preview',   false);
            _wireImageUploader('page-profile-photo-input', 'page-profile-photo-preview', true);

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                if (!_fbOk()) { _notify('Not connected — please try again.', 'error'); return; }

                var us   = _us();
                var name = (document.getElementById('page-name')    || {}).value || '';
                var tag  = (document.getElementById('page-tagline') || {}).value || '';
                var ind  = (document.getElementById('page-industry')|| {}).value || '';
                var email= (document.getElementById('page-email')   || {}).value || '';
                var phone= (document.getElementById('page-phone')   || {}).value || '';
                var addr = (document.getElementById('page-address') || {}).value || '';

                if (!name.trim()) { _notify('Organisation name is required.', 'error'); return; }

                var btn = form.querySelector('[type="submit"]');
                if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

                var pageId = 'biz-' + Date.now() + '-' + (Math.random() * 1e6 | 0);
                var doc = {
                    id: pageId,
                    ownerId: us.id || '',
                    name: name.trim(),
                    tagline: tag.trim(),
                    industry: ind,
                    email: email.trim(),
                    phone: phone.trim(),
                    address: addr.trim(),
                    bio: tag.trim(),
                    coverPhoto: _coverUrl,
                    profilePhoto: _avatarUrl,
                    followers: [],
                    createdAt: Date.now()
                };

                window.fbDb.collection('business_pages').doc(pageId).set(doc)
                    .then(function () {
                        /* Attach page to user's profile */
                        us.businessPage = doc;
                        if (us.id) {
                            window.fbDb.collection('users').doc(us.id).update({ businessPage: doc }).catch(function () {});
                        }
                        if (!window._firestoreBusinessPages) window._firestoreBusinessPages = [];
                        window._firestoreBusinessPages.unshift(doc);
                        window._activeBizData    = doc;
                        window._activeBizPageId  = pageId;

                        _notify('Business page created!', 'success');
                        _closeModal();
                        form.reset();
                        _coverUrl  = '';
                        _avatarUrl = '';

                        /* Navigate to the new page */
                        setTimeout(function () {
                            if (typeof window.navigateTo === 'function') window.navigateTo('business-page');
                            setTimeout(function () {
                                if (typeof window.renderBusinessPage === 'function') window.renderBusinessPage(pageId);
                            }, 120);
                        }, 200);
                    })
                    .catch(function (err) {
                        _notify('Could not create page: ' + (err.message || 'unknown error'), 'error');
                    })
                    .finally(function () {
                        if (btn) { btn.disabled = false; btn.textContent = 'Create Page'; }
                    });
            });

            /* Close button */
            var closeBtn = form.closest('.modal-card') && form.closest('.modal-card').querySelector('.close-modal');
            if (closeBtn && !closeBtn._bizWired) {
                closeBtn._bizWired = true;
                closeBtn.addEventListener('click', _closeModal);
            }
        }

        /* Wire a "Create Business Page" button if present */
        function _wireOpenBtn() {
            document.querySelectorAll('[data-action="create-business-page"], #create-business-page-btn, .create-business-page-btn')
                .forEach(function (btn) {
                    if (btn._bizOpenWired) return;
                    btn._bizOpenWired = true;
                    btn.addEventListener('click', function (e) {
                        e.preventDefault();
                        if (_isGuest()) { _notify('Please log in to create a business page.', 'info'); return; }
                        _openModal();
                        _wireForm();
                    });
                });
        }

        ready(function () {
            setTimeout(function () { _wireForm(); _wireOpenBtn(); }, 400);
        });
        document.addEventListener('empyrean-init-done', function () {
            setTimeout(function () { _wireForm(); _wireOpenBtn(); }, 300);
        });
        document.addEventListener('empyrean-section-change', function (ev) {
            if (ev && ev.detail && ev.detail.section === 'business-page') {
                setTimeout(function () { _wireForm(); _wireOpenBtn(); }, 150);
            }
        });

    })();


    /* =========================================================================
       §5  renderBusinessPage(bizId) — FULL PAGE RENDERER
       ========================================================================= */

    /**
     * Renders a complete business page into #business-page.
     * Fetches page data from Firestore if not cached.
     * Shows post composer only for the page owner.
     * Shows a full product/post grid with media.
     *
     * @param {string} [bizId] — Firestore document ID of the business page
     */
    function renderBusinessPage(bizId) {
        var id = bizId || window._activeBizPageId || '';
        var cached = window._activeBizData;

        /* Use cached data when it matches the requested id */
        if (cached && (cached.id === id || !id)) {
            _renderBizPageFull(id || cached.id, cached);
            return;
        }

        /* Search in-memory cache first */
        var pages = window._firestoreBusinessPages || [];
        var us    = _us();
        if (us.businessPage) pages = [us.businessPage].concat(pages);
        var found = pages.find(function (p) { return p.id === id; });
        if (found) {
            window._activeBizData = found;
            _renderBizPageFull(id, found);
            return;
        }

        /* Firestore fetch */
        if (_fbOk() && id) {
            var sec = document.getElementById('business-page');
            if (sec) {
                sec.innerHTML =
                    '<div style="padding:60px 20px;text-align:center;color:#9CA3AF;">'
                    + '<i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:#1B2B8B;"></i>'
                    + '<p style="margin-top:16px;font-size:0.95rem;">Loading business page…</p></div>';
            }
            window.fbDb.collection('business_pages').doc(id).get()
                .then(function (doc) {
                    if (!doc.exists) {
                        var s = document.getElementById('business-page');
                        if (s) s.innerHTML = _emptyState('Business page not found.', 'fa-store-slash');
                        return;
                    }
                    var data = doc.data();
                    data.id = doc.id;
                    window._activeBizData = data;
                    if (!window._firestoreBusinessPages) window._firestoreBusinessPages = [];
                    if (!window._firestoreBusinessPages.find(function (p) { return p.id === data.id; })) {
                        window._firestoreBusinessPages.push(data);
                    }
                    _renderBizPageFull(id, data);
                })
                .catch(function (err) {
                    console.warn('[EmpBusiness] Firestore fetch error:', err);
                    var s = document.getElementById('business-page');
                    if (s) s.innerHTML = _emptyState('Could not load this page. Check your connection.', 'fa-wifi');
                });
            return;
        }

        /* No id, no cache — show own page or empty state */
        if (us.businessPage) {
            var own = typeof us.businessPage === 'object' ? us.businessPage : { id: us.businessPage };
            window._activeBizPageId = own.id;
            window._activeBizData   = typeof us.businessPage === 'object' ? us.businessPage : null;
            renderBusinessPage(own.id);
        } else {
            var sec2 = document.getElementById('business-page');
            if (sec2) sec2.innerHTML = _noPageYetState();
        }
    }
    window.renderBusinessPage = renderBusinessPage;

    /* Mark so app-fix-final.js §P6 wrapper can detect this as the authoritative version */
    renderBusinessPage._bizModuleV3 = true;

    /* Save a permanent reference to this raw renderer.
       Patch files (app-patch-v2/v3/v4) wrap window.renderBusinessPage after this module
       loads. Any of them can call window._appBizRenderer(id) directly to invoke the full
       app-business.js renderer, bypassing the wrapper chain entirely. */
    window._appBizRenderer = renderBusinessPage;


    /**
     * Core renderer — called once page data is available.
     */
    function _renderBizPageFull(bizId, data) {
        var sec = document.getElementById('business-page');
        if (!sec) return;

        var us      = _us();
        var isOwner = _isAdmin()
            || (us.id && data.ownerId && data.ownerId === us.id)
            || (us.id && us.businessPage && (
                us.businessPage.id === bizId ||
                (typeof us.businessPage === 'string' && us.businessPage === bizId)
            ));

        var name     = data.name     || data.businessName || 'Business Page';
        var cover    = data.coverPhoto  || data.coverImage  || '';
        var avatar   = data.profilePhoto|| data.logo        || '';
        var bio      = data.bio      || data.description   || data.tagline || '';
        var industry = data.industry || data.category      || '';
        var website  = data.website  || '';
        var email    = data.email    || '';
        var phone    = data.phone    || data.contactPhone  || '';
        var addr     = data.address  || '';
        var followers = Array.isArray(data.followers) ? data.followers.length : (data.followerCount || 0);
        var isFollowing = Array.isArray(data.followers) && us.id && data.followers.indexOf(us.id) > -1;

        var coverBg  = cover
            ? 'url("' + _attr(cover) + '") center/cover no-repeat'
            : 'linear-gradient(135deg,#0A0E27 0%,#1B2B8B 60%,#5B0EA6 100%)';
        var avatarSrc = avatar || (
            'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) +
            '&background=1B2B8B&color=fff&size=200'
        );

        /* ── Update body class for CSS composer visibility ── */
        document.body.classList.toggle('biz-visitor', !isOwner);

        /* ── Build page HTML ── */
        var html = [];

        /* Cover photo */
        html.push(
            '<div style="position:relative;height:200px;background:' + coverBg + ';'
            + 'border-radius:18px 18px 0 0;flex-shrink:0;overflow:hidden;">'
        );
        if (isOwner) {
            html.push(
                '<label for="biz-cover-change-input" title="Change cover photo"'
                + ' style="position:absolute;bottom:12px;right:14px;background:rgba(0,0,0,0.55);'
                + 'color:white;border-radius:10px;padding:7px 14px;font-size:0.78rem;font-weight:700;'
                + 'cursor:pointer;display:flex;align-items:center;gap:6px;backdrop-filter:blur(4px);">'
                + '<i class="fas fa-camera"></i> Edit Cover</label>'
                + '<input type="file" id="biz-cover-change-input" accept="image/*" style="display:none;">'
            );
        }
        /* Avatar */
        html.push(
            '<div style="position:absolute;bottom:-40px;left:20px;width:84px;height:84px;'
            + 'border-radius:50%;border:4px solid #fff;overflow:hidden;'
            + 'box-shadow:0 4px 18px rgba(0,0,0,0.28);background:#e8eaf6;z-index:2;">'
            + '<img src="' + _attr(avatarSrc) + '" alt="' + _attr(name) + '"'
            + ' style="width:100%;height:100%;object-fit:cover;"'
            + ' onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=1B2B8B&color=fff&size=200\'">'
            + '</div>'
        );
        if (isOwner) {
            html.push(
                '<label for="biz-avatar-change-input" title="Change profile photo"'
                + ' style="position:absolute;bottom:-28px;left:74px;z-index:3;'
                + 'background:#1B2B8B;color:white;border-radius:50%;width:28px;height:28px;'
                + 'display:flex;align-items:center;justify-content:center;cursor:pointer;'
                + 'box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">'
                + '<i class="fas fa-camera" style="font-size:0.65rem;"></i></label>'
                + '<input type="file" id="biz-avatar-change-input" accept="image/*" style="display:none;">'
            );
        }
        html.push('</div>'); /* end cover */

        /* Action row (follow / edit) */
        html.push(
            '<div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;'
            + 'padding:14px 18px 0;">'
        );
        if (!isOwner) {
            html.push(
                '<button id="biz-follow-btn" data-biz-id="' + _attr(bizId) + '"'
                + ' style="padding:9px 26px;border-radius:50px;font-size:0.88rem;font-weight:700;'
                + 'background:' + (isFollowing ? 'rgba(27,43,139,0.1)' : 'linear-gradient(135deg,#1B2B8B,#5B0EA6)') + ';'
                + 'color:' + (isFollowing ? '#1B2B8B' : 'white') + ';'
                + 'border:' + (isFollowing ? '2px solid #1B2B8B' : 'none') + ';cursor:pointer;">'
                + (isFollowing
                    ? '<i class="fas fa-check" style="margin-right:6px;"></i>Following'
                    : '<i class="fas fa-plus" style="margin-right:6px;"></i>Follow Page')
                + '</button>'
            );
        } else {
            html.push(
                '<button id="biz-edit-page-btn"'
                + ' style="padding:9px 22px;border-radius:50px;font-size:0.88rem;font-weight:700;'
                + 'background:rgba(27,43,139,0.08);color:#1B2B8B;border:2px solid rgba(27,43,139,0.25);cursor:pointer;">'
                + '<i class="fas fa-edit" style="margin-right:6px;"></i>Edit Page</button>'
            );
        }
        html.push('</div>');

        /* Page info */
        html.push(
            '<div style="padding:50px 20px 16px;">'
            + '<h2 style="margin:0 0 4px;font-size:1.35rem;font-weight:900;color:#0A0E27;'
            + 'line-height:1.2;">' + _esc(name) + '</h2>'
        );
        if (industry) {
            html.push(
                '<span style="display:inline-block;font-size:0.72rem;font-weight:700;'
                + 'padding:3px 12px;background:rgba(27,43,139,0.1);color:#1B2B8B;'
                + 'border-radius:20px;margin-bottom:10px;">' + _esc(industry) + '</span>'
            );
        }
        /* Follower count */
        html.push(
            '<p style="font-size:0.82rem;color:#6B7280;margin:4px 0 10px;">'
            + '<i class="fas fa-users" style="margin-right:5px;color:#1B2B8B;"></i>'
            + '<strong style="color:#0A0E27;">' + followers.toLocaleString() + '</strong> followers</p>'
        );
        if (bio) {
            html.push('<p style="font-size:0.9rem;color:#374151;margin:0 0 12px;line-height:1.55;">' + _esc(bio) + '</p>');
        }
        /* Contact info */
        if (website) {
            html.push('<p style="font-size:0.82rem;margin:5px 0;"><i class="fas fa-globe" style="color:#1B2B8B;width:16px;margin-right:7px;"></i>'
                + '<a href="' + _attr(website) + '" target="_blank" rel="noopener noreferrer" style="color:#1B2B8B;font-weight:600;">' + _esc(website) + '</a></p>');
        }
        if (email) {
            html.push('<p style="font-size:0.82rem;margin:5px 0;"><i class="fas fa-envelope" style="color:#1B2B8B;width:16px;margin-right:7px;"></i>'
                + '<a href="mailto:' + _attr(email) + '" style="color:#1B2B8B;">' + _esc(email) + '</a></p>');
        }
        if (phone) {
            html.push('<p style="font-size:0.82rem;margin:5px 0;"><i class="fas fa-phone" style="color:#1B2B8B;width:16px;margin-right:7px;"></i>'
                + '<a href="tel:' + _attr(phone) + '" style="color:#1B2B8B;">' + _esc(phone) + '</a></p>');
        }
        if (addr) {
            html.push('<p style="font-size:0.82rem;margin:5px 0;"><i class="fas fa-map-marker-alt" style="color:#1B2B8B;width:16px;margin-right:7px;"></i>'
                + '<span style="color:#374151;">' + _esc(addr) + '</span></p>');
        }
        html.push('</div>'); /* end page info */

        /* ── Featured Products strip — populated by app-business-feedcard.js's
           renderBizPageFeaturedProducts(), same horizontally-scrollable
           thumbnail row used on the feed card, scoped to this page's own
           products. Hidden until that function finds at least one product. */
        html.push('<div id="vf-biz-featured-products" style="display:none;"></div>');

        /* ── Visitor notice ── */
        if (!isOwner) {
            html.push(
                '<div style="margin:0 16px 16px;padding:11px 16px;background:rgba(27,43,139,0.06);'
                + 'border-radius:12px;font-size:0.82rem;color:#1B2B8B;text-align:center;'
                + 'border:1px solid rgba(27,43,139,0.12);">'
                + '<i class="fas fa-eye" style="margin-right:7px;"></i>'
                + 'You are viewing <strong>' + _esc(name) + '</strong> as a visitor.</div>'
            );
        }

        /* ── Post composer (owners only) ── */
        if (isOwner) {
            html.push(
                '<div id="biz-post-composer" class="business-post-composer"'
                + ' style="margin:0 16px 16px;background:white;border-radius:16px;'
                + 'box-shadow:0 2px 12px rgba(10,14,39,0.08);border:1px solid rgba(10,14,39,0.07);'
                + 'padding:16px;overflow:hidden;">'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
                + '<img src="' + _attr(avatarSrc) + '" alt="' + _attr(name) + '"'
                + ' style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;">'
                + '<textarea id="business-post-content" placeholder="Share an update, product, or offer with your followers…"'
                + ' style="flex:1;border:1px solid rgba(10,14,39,0.1);border-radius:12px;padding:10px 14px;'
                + 'font-size:0.88rem;color:#374151;resize:none;min-height:60px;outline:none;'
                + 'font-family:inherit;line-height:1.45;background:#F9FAFB;"'
                + ' rows="2"></textarea>'
                + '</div>'
                /* Media preview strip */
                + '<div id="biz-media-preview" style="display:none;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>'
                /* Action bar */
                + '<div style="display:flex;align-items:center;justify-content:space-between;'
                + 'padding-top:10px;border-top:1px solid rgba(10,14,39,0.07);">'
                + '<div style="display:flex;gap:8px;">'
                + '<label for="biz-media-input" title="Add photos or videos"'
                + ' style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;'
                + 'border-radius:10px;background:rgba(27,43,139,0.07);color:#1B2B8B;'
                + 'font-size:0.82rem;font-weight:700;cursor:pointer;transition:background 0.18s;">'
                + '<i class="fas fa-image"></i> Photo/Video</label>'
                + '<input type="file" id="biz-media-input" accept="image/*,video/*" multiple style="display:none;">'
                + '</div>'
                + '<button id="biz-post-submit-btn"'
                + ' style="padding:9px 26px;border-radius:50px;background:linear-gradient(135deg,#1B2B8B,#5B0EA6);'
                + 'color:white;border:none;font-weight:700;font-size:0.88rem;cursor:pointer;'
                + 'transition:opacity 0.18s;">'
                + '<i class="fas fa-paper-plane" style="margin-right:6px;"></i>Post</button>'
                + '</div>'
                + '</div>'
            );
        }

        /* ── Posts/Listings area ── */
        html.push(
            '<div id="vf-biz-posts-area" style="padding:0 14px 40px;">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;'
            + 'margin-bottom:14px;padding:12px 2px 0;">'
            + '<h3 style="font-size:1rem;font-weight:800;color:#0A0E27;margin:0;display:flex;align-items:center;gap:8px;">'
            + '<span style="width:28px;height:28px;border-radius:8px;background:rgba(27,43,139,0.1);'
            + 'display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">'
            + '<i class="fas fa-store" style="color:#1B2B8B;font-size:0.8rem;"></i></span>'
            + 'Posts &amp; Listings</h3>'
            + '</div>'
            + '<div id="vf-biz-posts-list" style="display:flex;flex-direction:column;gap:14px;">'
            + '<div style="text-align:center;color:#9CA3AF;font-size:0.88rem;padding:32px 20px;">'
            + '<i class="fas fa-spinner fa-spin" style="font-size:1.6rem;color:#1B2B8B;margin-bottom:10px;display:block;"></i>'
            + 'Loading posts…</div>'
            + '</div>'
            + '</div>'
        );

        sec.innerHTML = html.join('');
        /* Ensure section is properly scrollable */
        sec.style.overflowY = 'auto';
        sec.style.webkitOverflowScrolling = 'touch';

        /* ── Wire cover/avatar change for owner ── */
        if (isOwner) {
            _wireCoverChange(bizId, data);
            _wireAvatarChange(bizId, data);
        }

        /* ── Wire follow button ── */
        var followBtn = sec.querySelector('#biz-follow-btn');
        if (followBtn) _wireFollowBtn(followBtn, bizId, data);

        /* ── Wire edit page button ── */
        if (isOwner) { _wireEditPageBtn(bizId, data); }

        /* ── Wire post composer ── */
        if (isOwner) {
            _wirePostComposer(bizId, data, avatarSrc, name);
        }

        /* ── Load posts from Firestore ── */
        _loadBizPosts(bizId, data, avatarSrc, name);

        /* ── Featured Products strip (app-business-feedcard.js) ── */
        if (typeof window.renderBizPageFeaturedProducts === 'function') {
            window.renderBizPageFeaturedProducts(bizId, sec.querySelector('#vf-biz-featured-products'));
        }
    }


    /* Wire Edit Page button */
    function _wireEditPageBtn(bizId, data) {
        var btn = document.getElementById('biz-edit-page-btn');
        if (!btn || btn._wired) return;
        btn._wired = true;
        btn.addEventListener('click', function () {
            var existing = document.getElementById('biz-edit-form-panel');
            if (existing) { existing.remove(); return; }
            if (!document.getElementById('_biz-edit-anim')) {
                var st = document.createElement('style');
                st.id = '_biz-edit-anim';
                st.textContent = '@keyframes slideUpEdit{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}';
                document.head.appendChild(st);
            }
            var panel = document.createElement('div');
            panel.id = 'biz-edit-form-panel';
            panel.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(10,14,39,0.65);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);';
            var inner = document.createElement('div');
            inner.style.cssText = 'background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;padding:24px 20px 36px;box-shadow:0 -8px 40px rgba(10,14,39,0.22);animation:slideUpEdit 0.28s cubic-bezier(0.34,1.56,0.64,1);';
            function _f(label, id, val, type) {
                return '<div style="margin-bottom:14px;"><label style="display:block;font-size:0.75rem;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:5px;">' + label + '</label>' +
                    (type === 'textarea'
                        ? '<textarea id="' + id + '" rows="3" style="width:100%;box-sizing:border-box;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;padding:9px 12px;font-size:0.88rem;color:#374151;resize:vertical;font-family:inherit;outline:none;">' + _esc(val || '') + '</textarea>'
                        : '<input type="text" id="' + id + '" value="' + _attr(val || '') + '" style="width:100%;box-sizing:border-box;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;padding:9px 12px;font-size:0.88rem;color:#374151;outline:none;">') + '</div>';
            }
            inner.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
                '<h3 style="margin:0;font-size:1.05rem;font-weight:900;color:#0A0E27;"><i class="fas fa-edit" style="color:#1B2B8B;margin-right:8px;"></i>Edit Business Page</h3>' +
                '<button id="biz-edit-close-btn" style="background:rgba(10,14,39,0.07);border:none;width:34px;height:34px;border-radius:50%;font-size:1rem;cursor:pointer;color:#6B7280;"><i class="fas fa-times"></i></button></div>' +
                _f('Business Name', 'biz-edit-name', data.name || data.businessName, 'input') +
                _f('Industry / Category', 'biz-edit-industry', data.industry || data.category, 'input') +
                _f('Bio / Description', 'biz-edit-bio', data.bio || data.description || data.tagline, 'textarea') +
                _f('Website', 'biz-edit-website', data.website, 'input') +
                _f('Email', 'biz-edit-email', data.email, 'input') +
                _f('Phone', 'biz-edit-phone', data.phone || data.contactPhone, 'input') +
                _f('Address', 'biz-edit-address', data.address, 'input') +
                '<button id="biz-edit-save-btn" style="width:100%;padding:13px;border-radius:14px;background:linear-gradient(135deg,#1B2B8B,#5B0EA6);color:#fff;border:none;font-weight:800;font-size:0.92rem;cursor:pointer;margin-top:6px;"><i class="fas fa-save" style="margin-right:7px;"></i>Save Changes</button>' +
                '<button id="biz-edit-delete-btn" style="width:100%;padding:13px;border-radius:14px;background:rgba(239,68,68,0.08);color:#EF4444;border:2px solid rgba(239,68,68,0.25);font-weight:800;font-size:0.92rem;cursor:pointer;margin-top:10px;"><i class="fas fa-trash" style="margin-right:7px;"></i>Delete Page &amp; All Posts</button>';
            panel.appendChild(inner);
            document.body.appendChild(panel);
            document.getElementById('biz-edit-close-btn').addEventListener('click', function () { panel.remove(); });
            panel.addEventListener('click', function (e) { if (e.target === panel) panel.remove(); });

            /* ── Delete Page button ── */
            document.getElementById('biz-edit-delete-btn').addEventListener('click', function () {
                var delBtn = this;
                if (!delBtn._confirming) {
                    delBtn._confirming = true;
                    delBtn.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:7px;"></i>Tap again to permanently delete';
                    setTimeout(function () {
                        if (delBtn._confirming) {
                            delBtn._confirming = false;
                            delBtn.innerHTML = '<i class="fas fa-trash" style="margin-right:7px;"></i>Delete Page &amp; All Posts';
                        }
                    }, 4000);
                    return;
                }
                delBtn._confirming = false;
                delBtn.disabled = true;
                delBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:7px;"></i>Deleting…';

                function _finishDelete() {
                    /* Clear local references */
                    if (window._activeBizData && window._activeBizData.id === bizId) window._activeBizData = null;
                    if (window._viewingBizPage && window._viewingBizPage.id === bizId) window._viewingBizPage = null;
                    window._activeBizPageId = '';
                    var pages = window._firestoreBusinessPages || [];
                    window._firestoreBusinessPages = pages.filter(function (p) { return p.id !== bizId; });
                    var us = _us();
                    if (us && us.businessPage && (us.businessPage.id === bizId || us.businessPage === bizId)) {
                        us.businessPage = null;
                        if (_fbOk() && us.id) {
                            window.fbDb.collection('users').doc(us.id).update({ businessPage: null }).catch(function () {});
                        }
                    }
                    panel.remove();
                    /* Remove cards from dashboard slider */
                    document.querySelectorAll('[data-biz-id="' + bizId + '"],[data-page-id="' + bizId + '"]').forEach(function (c) { c.remove(); });
                    if (typeof window.renderDashboardBusinesses === 'function') {
                        try { window.renderDashboardBusinesses(); } catch (e) {}
                    }
                    _notify('Business page deleted.', 'success');
                    if (typeof window.navigateTo === 'function') window.navigateTo('dashboard');
                }

                if (!_fbOk() || !bizId) { _finishDelete(); return; }

                /* Delete all business_posts belonging to this page, then the page itself */
                window.fbDb.collection('business_posts').where('pageId', '==', bizId).get()
                    .then(function (snap) {
                        var batchDeletes = [];
                        snap.forEach(function (doc) { batchDeletes.push(doc.ref.delete().catch(function () {})); });
                        return Promise.all(batchDeletes);
                    })
                    .catch(function () { /* ignore post-cleanup errors, still delete the page */ })
                    .then(function () {
                        return window.fbDb.collection('business_pages').doc(bizId).delete();
                    })
                    .then(_finishDelete)
                    .catch(function (err) {
                        delBtn.disabled = false;
                        delBtn.innerHTML = '<i class="fas fa-trash" style="margin-right:7px;"></i>Delete Page &amp; All Posts';
                        _notify('Failed to delete: ' + (err && err.message ? err.message : 'Please try again.'), 'error');
                    });
            });

            document.getElementById('biz-edit-save-btn').addEventListener('click', function () {
                var sb = document.getElementById('biz-edit-save-btn');
                if (sb) { sb.disabled = true; sb.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:7px;"></i>Saving…'; }
                var updates = {
                    name:      (document.getElementById('biz-edit-name')     || {}).value || data.name || '',
                    industry:  (document.getElementById('biz-edit-industry')  || {}).value || '',
                    bio:       (document.getElementById('biz-edit-bio')       || {}).value || '',
                    website:   (document.getElementById('biz-edit-website')   || {}).value || '',
                    email:     (document.getElementById('biz-edit-email')     || {}).value || '',
                    phone:     (document.getElementById('biz-edit-phone')     || {}).value || '',
                    address:   (document.getElementById('biz-edit-address')   || {}).value || '',
                    updatedAt: new Date()
                };
                if (!window._firebaseLoaded || !window.fbDb) {
                    Object.assign(data, updates);
                    if (window._activeBizData) Object.assign(window._activeBizData, updates);
                    panel.remove();
                    if (typeof window.renderBusinessPage === 'function') window.renderBusinessPage(bizId);
                    _notify('Changes saved locally.', 'success');
                    return;
                }
                window.fbDb.collection('business_pages').doc(bizId).update(updates)
                    .then(function () {
                        Object.assign(data, updates);
                        if (window._activeBizData) Object.assign(window._activeBizData, updates);
                        var pages = window._firestoreBusinessPages || [];
                        var pg = pages.find(function (p) { return p.id === bizId; });
                        if (pg) Object.assign(pg, updates);
                        panel.remove();
                        if (typeof window.renderBusinessPage === 'function') window.renderBusinessPage(bizId);
                        _notify('Business page updated!', 'success');
                    })
                    .catch(function (err) {
                        if (sb) { sb.disabled = false; sb.innerHTML = '<i class="fas fa-save" style="margin-right:7px;"></i>Save Changes'; }
                        _notify('Failed to save: ' + (err && err.message ? err.message : 'Please try again.'), 'error');
                    });
            });
        });
    }

    /* Wire cover photo change */
    function _wireCoverChange(bizId, data) {
        var input = document.getElementById('biz-cover-change-input');
        if (!input || input._wired) return;
        input._wired = true;
        input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            if (!file) return;
            _notify('Uploading cover photo…', 'info');
            _uploadMedia(file).then(function (url) {
                data.coverPhoto = url;
                if (_fbOk() && bizId) {
                    window.fbDb.collection('business_pages').doc(bizId).update({ coverPhoto: url }).catch(function () {});
                }
                var coverDiv = document.querySelector('#business-page > div:first-child');
                if (coverDiv) coverDiv.style.background = 'url("' + url + '") center/cover no-repeat';
                _notify('Cover photo updated!', 'success');
            }).catch(function () { _notify('Upload failed.', 'error'); });
        });
    }

    /* Wire avatar change */
    function _wireAvatarChange(bizId, data) {
        var input = document.getElementById('biz-avatar-change-input');
        if (!input || input._wired) return;
        input._wired = true;
        input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            if (!file) return;
            _notify('Uploading profile photo…', 'info');
            _uploadMedia(file).then(function (url) {
                data.profilePhoto = url;
                if (_fbOk() && bizId) {
                    window.fbDb.collection('business_pages').doc(bizId).update({ profilePhoto: url }).catch(function () {});
                }
                var imgs = document.querySelectorAll('#business-page img[alt="' + (data.name || '').replace(/"/g, '&quot;') + '"]');
                imgs.forEach(function (img) { img.src = url; });
                _notify('Profile photo updated!', 'success');
            }).catch(function () { _notify('Upload failed.', 'error'); });
        });
    }

    /* Wire follow button */
    function _wireFollowBtn(btn, bizId, data) {
        if (btn._wired) return;
        btn._wired = true;
        btn.addEventListener('click', function () {
            var us = _us();
            if (_isGuest() || !us.id) { _notify('Please log in to follow a page.', 'info'); return; }
            var followers = Array.isArray(data.followers) ? data.followers : [];
            var idx = followers.indexOf(us.id);
            if (idx > -1) {
                followers.splice(idx, 1);
                btn.innerHTML = '<i class="fas fa-plus" style="margin-right:6px;"></i>Follow Page';
                btn.style.background = 'linear-gradient(135deg,#1B2B8B,#5B0EA6)';
                btn.style.color = 'white';
                btn.style.border = 'none';
                _notify('Unfollowed page.', 'info');
            } else {
                followers.push(us.id);
                btn.innerHTML = '<i class="fas fa-check" style="margin-right:6px;"></i>Following';
                btn.style.background = 'rgba(27,43,139,0.1)';
                btn.style.color = '#1B2B8B';
                btn.style.border = '2px solid #1B2B8B';
                _notify('Following ' + (data.name || 'page') + '!', 'success');
            }
            data.followers = followers;
            if (_fbOk() && bizId) {
                window.fbDb.collection('business_pages').doc(bizId)
                    .update({ followers: followers })
                    .catch(function () {});
            }
            /* Update follower count display */
            var countEl = document.querySelector('#business-page .biz-follower-count');
            if (countEl) countEl.textContent = followers.length.toLocaleString();
        });
    }


    /* =========================================================================
       §6  renderDashboardBusinesses() — DASHBOARD SLIDER
       ========================================================================= */

    /**
     * Populate the business pages horizontal slider on the dashboard.
     * Targets both #dashboard-bizposts-container/#dashboard-bizposts-slider (real IDs)
     * and #dashboard-business-container/#dashboard-business-slider (alias IDs used by §14).
     */
    function renderDashboardBusinesses() {
        /* Resolve real vs alias slider.
           FIX (duplicate business-page cards): previously this resolved
           #dashboard-business-slider OR #dashboard-bizposts-slider fresh on
           EVERY call, and renamed #dashboard-bizposts-slider into
           #dashboard-business-slider the first time no alias existed yet.
           If this function got called more than once before §44's hidden
           alias was created (e.g. two independent callers firing on the same
           empyrean-init-done dispatch, or two separate init-done dispatches
           in one session), the rename could happen against the real,
           VISIBLE #dashboard-bizposts-slider — putting page-cards directly
           into the visible Business Posts strip — and a later call could
           re-resolve a different slider reference, producing duplicate
           cards. We now cache the resolved slider on window._bizDashSlider
           the first time it's found, so every subsequent call — no matter
           when or how many times it's invoked — targets the exact same
           element. */
        var slider = window._bizDashSlider || document.getElementById('dashboard-business-slider')
            || document.getElementById('dashboard-bizposts-slider');
        if (!slider) return;
        window._bizDashSlider = slider;

        /* Ensure alias IDs exist for §14 compatibility */
        if (!document.getElementById('dashboard-business-slider') && slider) {
            slider.id = 'dashboard-business-slider';
        }

        var us    = _us();
        var pages = (window._firestoreBusinessPages || []).slice();
        if (us.businessPage && typeof us.businessPage === 'object' && us.businessPage.id) {
            if (!pages.find(function (p) { return p.id === us.businessPage.id; })) {
                pages.unshift(us.businessPage);
            }
        }

        /* Remove placeholder/demo cards if real data is present */
        if (pages.length) {
            slider.querySelectorAll('[data-biz-id^="biz-demo-"],[data-biz-id^="demo-"]').forEach(function (c) { c.remove(); });
        }

        /* Render page cards */
        pages.forEach(function (biz) {
            if (!biz || !biz.id) return;
            if (slider.querySelector('[data-biz-id="' + biz.id + '"]')) return;

            var name    = biz.name || biz.businessName || 'Business';
            var avatar  = biz.profilePhoto || biz.logo || '';
            var cover   = biz.coverPhoto   || biz.coverImage || '';
            var ind     = biz.industry     || '';
            var isOwn   = (us.id && biz.ownerId === us.id);
            var followers = Array.isArray(biz.followers) ? biz.followers.length : 0;

            var card = document.createElement('div');
            card.className = 'dashboard-business-card';
            card.dataset.bizId   = biz.id;
            card.dataset.bizData = JSON.stringify(biz);
            card.style.cssText =
                'flex:0 0 200px;width:200px;border-radius:18px;overflow:hidden;cursor:pointer;'
                + 'box-shadow:0 4px 18px rgba(10,14,39,0.12);background:white;'
                + 'border:1px solid rgba(10,14,39,0.07);scroll-snap-align:start;'
                + 'transition:transform 0.2s,box-shadow 0.2s;display:flex;flex-direction:column;flex-shrink:0;';

            var coverBg = cover
                ? 'url("' + _attr(cover) + '") center/cover no-repeat'
                : 'linear-gradient(135deg,#0A0E27,#1B2B8B)';
            var avatarSrc = avatar || (
                'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=1B2B8B&color=fff&size=100'
            );

            card.innerHTML =
                '<div style="height:88px;background:' + coverBg + ';position:relative;flex-shrink:0;">'
                + (isOwn ? '<span style="position:absolute;top:8px;right:9px;font-size:0.58rem;font-weight:800;'
                    + 'padding:3px 8px;border-radius:8px;background:rgba(245,197,24,0.95);color:#0A0E27;'
                    + 'letter-spacing:0.3px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">YOURS</span>' : '')
                + '<div style="position:absolute;bottom:-22px;left:14px;width:46px;height:46px;'
                + 'border-radius:50%;border:3px solid white;overflow:hidden;background:#e8eaf6;'
                + 'box-shadow:0 3px 10px rgba(0,0,0,0.2);">'
                + '<img src="' + _attr(avatarSrc) + '" style="width:100%;height:100%;object-fit:cover;"'
                + ' onerror="this.src=\'https://ui-avatars.com/api/?name=B&background=1B2B8B&color=fff&size=100\'"></div>'
                + '</div>'
                + '<div style="padding:28px 12px 10px;">'
                + '<strong style="display:block;font-size:0.85rem;font-weight:800;color:#0A0E27;'
                + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(name) + '</strong>'
                + (ind ? '<span style="font-size:0.64rem;color:#5B0EA6;font-weight:700;display:block;margin-top:3px;'
                    + 'background:rgba(91,14,166,0.08);padding:2px 8px;border-radius:20px;display:inline-block;">' + _esc(ind) + '</span>' : '')
                + '<span style="font-size:0.68rem;color:#6B7280;display:block;margin-top:5px;">'
                + '<i class="fas fa-users" style="color:#1B2B8B;font-size:0.6rem;margin-right:3px;"></i>'
                + followers.toLocaleString() + ' followers</span>'
                + '</div>'
                + '<div style="padding:0 12px 14px;margin-top:auto;">'
                + '<button class="vf-biz-card-follow-btn biz-card-action-btn" data-biz-id="' + biz.id + '"'
                + ' style="width:100%;padding:8px;border-radius:10px;font-size:0.75rem;font-weight:700;'
                + 'background:' + (isOwn ? 'linear-gradient(135deg,#1B2B8B,#5B0EA6)' : 'rgba(27,43,139,0.07)') + ';'
                + 'color:' + (isOwn ? 'white' : '#1B2B8B') + ';'
                + 'border:' + (isOwn ? 'none' : '1.5px solid rgba(27,43,139,0.2)') + ';cursor:pointer;">'
                + (isOwn ? '<i class="fas fa-cog" style="margin-right:5px;font-size:0.65rem;"></i>Manage Page'
                         : '<i class="fas fa-eye" style="margin-right:5px;font-size:0.65rem;"></i>View Page') + '</button>'
                + '</div>';

            card.addEventListener('mouseenter', function () {
                card.style.transform = 'translateY(-4px)';
                card.style.boxShadow = '0 10px 28px rgba(10,14,39,0.2)';
            });
            card.addEventListener('mouseleave', function () {
                card.style.transform = '';
                card.style.boxShadow = '0 4px 16px rgba(10,14,39,0.12)';
            });
            card.addEventListener('click', function (e) {
                if (e.target.closest('.biz-card-action-btn,.vf-biz-card-follow-btn')) return;
                _navToBizPage(biz);
            });
            card.querySelector('.vf-biz-card-follow-btn').addEventListener('click', function (e) {
                e.stopPropagation();
                _navToBizPage(biz);
            });

            slider.appendChild(card);
        });

        /* Fetch from Firestore if cache is empty */
        if (!pages.length && _fbOk() && !window._bizPagesFetchDone) {
            window._bizPagesFetchDone = true;
            window.fbDb.collection('business_pages').orderBy('createdAt', 'desc').limit(20).get()
                .then(function (snap) {
                    if (!window._firestoreBusinessPages) window._firestoreBusinessPages = [];
                    snap.forEach(function (doc) {
                        var d = doc.data(); d.id = doc.id;
                        if (!window._firestoreBusinessPages.find(function (p) { return p.id === d.id; })) {
                            window._firestoreBusinessPages.push(d);
                        }
                    });
                    renderDashboardBusinesses();
                })
                .catch(function (err) { console.warn('[EmpBusiness] dashboard fetch error:', err && err.message); });
        }
    }
    window.renderDashboardBusinesses = renderDashboardBusinesses;

    function _navToBizPage(biz) {
        window._activeBizPageId = biz.id;
        window._activeBizData   = biz;
        if (typeof window.navigateTo === 'function') window.navigateTo('business-page');
        /* Use 250ms — enough to let navigateTo + section-change at 100ms complete first.
           Always prefer _appBizRenderer (the raw app-business.js version) to bypass wrappers. */
        setTimeout(function () {
            var renderer = window._appBizRenderer || window.renderBusinessPage;
            if (typeof renderer === 'function') renderer(biz.id);
        }, 250);
    }


    /* =========================================================================
       §7  submitBusinessPost() — POST CREATION
       ========================================================================= */

    /**
     * Upload queued media files and write a business_posts document to Firestore.
     * Called by the composer submit button.
     */
    var _lastBizPostContent = '';
    var _lastBizPostTime    = 0;

    async function submitBusinessPost() {
        if (_isGuest()) { _notify('Please log in to post.', 'info'); return; }
        if (!_fbOk())   { _notify('Not connected — please try again.', 'error'); return; }

        var us      = _us();
        var bizId   = window._activeBizPageId || (us.businessPage && us.businessPage.id) || '';
        var bizData = window._activeBizData   || us.businessPage || {};
        var content = (document.getElementById('business-post-content') || {}).value || '';
        var files   = window._bizPendingMedia || [];

        if (!content.trim() && !files.length) {
            _notify('Please write something or add a photo/video.', 'info'); return;
        }
        /* Dedup guard */
        var now = Date.now();
        if (content === _lastBizPostContent && now - _lastBizPostTime < 6000) {
            _notify('Post already submitted — please wait.', 'info'); return;
        }
        _lastBizPostContent = content;
        _lastBizPostTime    = now;

        /* Disable submit button */
        var submitBtn = document.getElementById('biz-post-submit-btn');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting…'; }

        var mediaUrls = [];
        var products  = []; /* { url, isVideo, name, price } — one entry per uploaded file,
                                read from the name/price inputs added in §8's composer preview.
                                Kept alongside media[] (not replacing it) so any older renderer
                                that only reads media[] keeps working unchanged. */
        try {
            if (files.length) {
                _notify('Uploading media…', 'info');
                for (var i = 0; i < files.length; i++) {
                    var url = await _uploadMedia(files[i]);
                    mediaUrls.push(url);
                    products.push({
                        url: url,
                        isVideo: !!(files[i].type && files[i].type.startsWith('video/')),
                        name: (files[i]._bizProductName  || '').trim(),
                        price: (files[i]._bizProductPrice || '').trim()
                    });
                }
            }
        } catch (err) {
            _notify('Media upload failed: ' + (err.message || 'unknown'), 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:6px;"></i>Post'; }
            return;
        }

        var postId  = 'bizpost-' + Date.now() + '-' + (Math.random() * 1e6 | 0);
        var pageName   = bizData.name    || bizData.businessName || 'Business';
        var pageAvatar = bizData.profilePhoto || bizData.logo    || '';
        var pageCover  = bizData.coverPhoto   || bizData.coverImage || '';

        var doc = {
            id: postId,
            pageId: bizId,
            userId: us.id || '',
            username: us.username || us.fullName || 'User',
            pageName: pageName,
            pageAvatar: pageAvatar,
            pageCover: pageCover,
            text: content.trim(),
            media: mediaUrls,
            products: products,
            likes: 0,
            comments: [],
            createdAt: Date.now()
        };

        window.fbDb.collection('business_posts').doc(postId).set(doc)
            .then(function () {
                _notify('Post published!', 'success');
                /* Clear composer */
                var ta = document.getElementById('business-post-content');
                if (ta) ta.value = '';
                window._bizPendingMedia = [];
                var preview = document.getElementById('biz-media-preview');
                if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
                /* Prepend to the live posts list */
                var list = document.getElementById('vf-biz-posts-list');
                if (list) {
                    var empty = list.querySelector('[style*="Loading posts"]');
                    if (empty) empty.remove();
                    var noPostsEl = list.querySelector('[style*="No posts yet"]');
                    if (noPostsEl) noPostsEl.remove();
                    var card = _buildBizPostCard(doc, pageAvatar, pageName);
                    list.prepend(card);
                }
            })
            .catch(function (err) {
                _notify('Could not save post: ' + (err.message || 'error'), 'error');
            })
            .finally(function () {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:6px;"></i>Post'; }
            });
    }
    window.submitBusinessPost = submitBusinessPost;


    /* =========================================================================
       §8  POST COMPOSER — WIRE-UP & MEDIA PREVIEW
       ========================================================================= */

    function _wirePostComposer(bizId, data, avatarSrc, pageName) {
        window._bizPendingMedia = [];

        var submitBtn = document.getElementById('biz-post-submit-btn');
        var mediaInput = document.getElementById('biz-media-input');
        var preview    = document.getElementById('biz-media-preview');

        if (submitBtn && !submitBtn._wired) {
            submitBtn._wired = true;
            submitBtn.addEventListener('click', function (e) {
                e.preventDefault();
                submitBusinessPost();
            });
        }

        if (mediaInput && !mediaInput._wired) {
            mediaInput._wired = true;
            mediaInput.addEventListener('change', function () {
                var files = Array.from(mediaInput.files || []);
                window._bizPendingMedia = (window._bizPendingMedia || []).concat(files);
                if (!preview) return;
                preview.style.display = 'flex';
                preview.style.flexWrap = 'wrap';
                files.forEach(function (file) {
                    var thumbUrl = URL.createObjectURL(file);
                    var wrap = document.createElement('div');
                    wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;width:84px;flex-shrink:0;';
                    var isVid = file.type.startsWith('video/');

                    var thumb = document.createElement('div');
                    thumb.style.cssText = 'position:relative;width:84px;height:84px;border-radius:10px;overflow:hidden;flex-shrink:0;';
                    thumb.innerHTML = isVid
                        ? '<video src="' + thumbUrl + '" style="width:100%;height:100%;object-fit:cover;" muted preload="metadata"></video>'
                            + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);">'
                            + '<i class="fas fa-play" style="color:white;font-size:1.1rem;"></i></div>'
                        : '<img src="' + thumbUrl + '" style="width:100%;height:100%;object-fit:cover;">';
                    thumb.innerHTML += '<button style="position:absolute;top:3px;right:3px;width:18px;height:18px;'
                        + 'border-radius:50%;background:rgba(0,0,0,0.65);color:white;border:none;'
                        + 'cursor:pointer;font-size:0.65rem;display:flex;align-items:center;justify-content:center;">'
                        + '<i class="fas fa-times"></i></button>';
                    thumb.querySelector('button').addEventListener('click', function () {
                        var idx = window._bizPendingMedia.indexOf(file);
                        if (idx > -1) window._bizPendingMedia.splice(idx, 1);
                        wrap.remove();
                        if (!preview.children.length) preview.style.display = 'none';
                    });
                    wrap.appendChild(thumb);

                    /* Product name + price — stored directly on the file object so
                       submitBusinessPost() can read them off window._bizPendingMedia
                       without keeping a separate array in sync. Optional: a post can
                       still be plain media with no product info, same as before. */
                    var nameInput = document.createElement('input');
                    nameInput.type = 'text';
                    nameInput.placeholder = 'Product name';
                    nameInput.maxLength = 60;
                    nameInput.style.cssText = 'width:100%;font-size:0.68rem;padding:4px 6px;border-radius:6px;'
                        + 'border:1px solid rgba(0,0,0,0.12);outline:none;box-sizing:border-box;';
                    nameInput.addEventListener('input', function () { file._bizProductName = nameInput.value; });
                    wrap.appendChild(nameInput);

                    var priceInput = document.createElement('input');
                    priceInput.type = 'text';
                    priceInput.inputMode = 'decimal';
                    priceInput.placeholder = 'Price (optional)';
                    priceInput.maxLength = 20;
                    priceInput.style.cssText = 'width:100%;font-size:0.68rem;padding:4px 6px;border-radius:6px;'
                        + 'border:1px solid rgba(0,0,0,0.12);outline:none;box-sizing:border-box;';
                    priceInput.addEventListener('input', function () { file._bizProductPrice = priceInput.value; });
                    wrap.appendChild(priceInput);

                    preview.appendChild(wrap);
                });
                mediaInput.value = '';
            });
        }
    }


    /* =========================================================================
       §9  LOAD POSTS FROM FIRESTORE
       ========================================================================= */

    function _loadBizPosts(bizId, data, avatarSrc, pageName) {
        var list = document.getElementById('vf-biz-posts-list');
        if (!list) return;

        if (!_fbOk() || !bizId) {
            list.innerHTML = _emptyState('No posts yet.', 'fa-pen-nib');
            return;
        }

        /* FIX (failed-precondition / "missing composite index"): Firestore
           requires a composite index for where('pageId','==',x) combined
           with orderBy('createdAt','desc'). Until that index is created in
           the Firebase console, this query throws every time. Drop the
           orderBy from the server-side query and sort the results in JS
           instead — cheap for the volumes here and avoids the index dep. */
        window.fbDb.collection('business_posts')
            .where('pageId', '==', bizId)
            .limit(30)
            .get()
            .then(function (snap) {
                var rows = [];
                snap.forEach(function (doc) { var p = doc.data(); p.id = doc.id; rows.push(p); });
                rows.sort(function (a, b) {
                    var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
                    var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
                    return tb - ta;
                });
                list.innerHTML = '';
                if (!rows.length) {
                    list.innerHTML =
                        '<div style="text-align:center;padding:40px 20px;color:#9CA3AF;">'
                        + '<i class="fas fa-store" style="font-size:2rem;color:rgba(27,43,139,0.2);margin-bottom:10px;display:block;"></i>'
                        + '<p style="margin:0;font-size:0.88rem;">No posts yet.'
                        + (window._activeBizData && window._activeBizData.ownerId === _us().id
                            ? ' Share your first update above!' : '') + '</p></div>';
                    return;
                }
                rows.forEach(function (p) {
                    var av = p.pageAvatar || avatarSrc;
                    var pn = p.pageName   || pageName;
                    list.appendChild(_buildBizPostCard(p, av, pn));
                });
            })
            .catch(function (err) {
                console.warn('[EmpBusiness] loadBizPosts error:', err);
                if (list) {
                    list.innerHTML =
                        '<div style="text-align:center;padding:30px;color:#9CA3AF;font-size:0.85rem;">'
                        + 'Could not load posts — check your connection.</div>';
                }
            });
    }

    /**
     * Build a styled post card element for the business page posts list.
     */
    function _buildBizPostCard(p, avatarSrc, pageName) {
        var card = document.createElement('div');
        card.className   = 'biz-post-card';   // ← targeted by app-patch-share-likes.js
        card.dataset.postId    = p.id;
        card.dataset.collection = 'business_posts'; // §45 like/share routing
        card.style.cssText =
            'background:#fff;border-radius:16px;overflow:hidden;'
            + 'box-shadow:0 2px 12px rgba(0,0,0,0.07);border:1px solid rgba(0,0,0,0.06);';

        var us      = _us();
        var isOwner = _isAdmin() || (us.id && p.userId && p.userId === us.id);
        var ts      = _ts(p.createdAt);
        var media   = p.media || [];

        /* Media HTML */
        var mediaHTML = '';
        if (media.length > 0) {
            var mc = media.length;
            var cols = mc === 1 ? '1fr' : mc === 2 ? '1fr 1fr' : mc === 3 ? '2fr 1fr' : '1fr 1fr';
            mediaHTML = '<div style="display:grid;grid-template-columns:' + cols + ';gap:2px;background:#f3f4f6;">';
            media.slice(0, 4).forEach(function (url, mi) {
                if (!url || url.startsWith('blob:')) return;
                var isVid = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url);
                var extra = mc === 3 && mi === 0 ? 'grid-row:span 2;' : '';
                var cellHeight = mc === 1 ? '320px' : '200px';
                mediaHTML += '<div style="overflow:hidden;max-height:' + cellHeight + ';' + extra + '">';
                if (isVid) {
                    mediaHTML += '<video src="' + _attr(url) + '" controls preload="metadata" playsinline'
                        + ' style="width:100%;height:100%;object-fit:cover;display:block;"></video>';
                } else {
                    mediaHTML += '<img src="' + _attr(url) + '" alt="Post media" loading="lazy"'
                        + ' style="width:100%;height:100%;object-fit:cover;display:block;"'
                        + ' onerror="this.closest(\'div\').style.display=\'none\'">';
                }
                mediaHTML += '</div>';
            });
            if (media.length > 4) {
                mediaHTML += '<div style="display:flex;align-items:center;justify-content:center;'
                    + 'background:rgba(0,0,0,0.55);color:white;font-size:1.3rem;font-weight:800;min-height:100px;">'
                    + '+' + (media.length - 4) + '</div>';
            }
            mediaHTML += '</div>';
        }

        /* Options menu (owner only) */
        var optsHTML = isOwner
            ? '<div class="post-options" style="position:relative;">'
              + '<button class="options-btn" style="background:none;border:none;cursor:pointer;padding:4px 8px;">'
              + '<i class="fas fa-ellipsis-h" style="color:#6B7280;"></i></button>'
              + '<div class="options-menu" style="display:none;position:absolute;right:0;top:28px;background:white;'
              + 'border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.15);min-width:130px;z-index:50;overflow:hidden;border:1px solid rgba(0,0,0,0.07);">'
              + '<a href="#" class="delete-biz-post-btn" data-post-id="' + p.id + '"'
              + ' style="display:flex;align-items:center;gap:8px;padding:11px 14px;font-size:0.83rem;'
              + 'color:#e53935;font-weight:600;text-decoration:none;">'
              + '<i class="fas fa-trash"></i> Delete</a></div></div>'
            : '';

        card.innerHTML =
            /* Header */
            '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px 10px;">'
            + '<img src="' + _attr(avatarSrc) + '" alt="' + _attr(pageName) + '"'
            + ' style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;"'
            + ' onerror="this.src=\'https://ui-avatars.com/api/?name=B&background=1B2B8B&color=fff&size=100\'">'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-weight:800;font-size:0.9rem;color:#0A0E27;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
            + _esc(pageName) + '</div>'
            + '<div style="font-size:0.72rem;color:#9CA3AF;">' + ts + '</div>'
            + '</div>'
            + optsHTML
            + '</div>'
            /* Text */
            + (p.text
                ? '<div style="padding:0 16px 12px;font-size:0.9rem;color:#374151;line-height:1.55;">'
                  + _esc(p.text) + '</div>'
                : '')
            /* Media */
            + mediaHTML
            /* Action bar */
            + '<div style="display:flex;align-items:center;gap:16px;padding:10px 16px;'
            + 'border-top:1px solid rgba(0,0,0,0.06);margin-top:2px;">'
            + '<a class="action-btn like-btn" style="display:flex;align-items:center;gap:5px;'
            + 'font-size:0.82rem;color:#6B7280;text-decoration:none;cursor:pointer;transition:transform 0.15s,color 0.15s;">'
            + '<i class="far fa-heart" style="font-size:15px;"></i>'
            + '<span class="like-count" style="font-size:11px;font-weight:400;">'
            + ((p.likes && p.likes > 0) ? p.likes : '') + '</span></a>'
            + '<a class="action-btn comment-btn" style="display:flex;align-items:center;gap:5px;'
            + 'font-size:0.82rem;color:#6B7280;text-decoration:none;cursor:pointer;">'
            + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
            + '<span class="comment-count" style="font-size:11px;">'
            + ((p.comments && p.comments.length) || 0) + '</span></a>'
            + '<a class="action-btn share-btn" data-action="share" style="display:flex;align-items:center;gap:5px;'
            + 'font-size:0.82rem;color:#6B7280;text-decoration:none;cursor:pointer;">'
            + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
            + '<span class="share-count" style="font-size:11px;">'
            + ((p.shareCount && p.shareCount > 0) ? p.shareCount : '') + '</span></a>'
            + '</div>';

        /* Wire options menu toggle */
        var optBtn = card.querySelector('.options-btn');
        var optMenu = card.querySelector('.options-menu');
        if (optBtn && optMenu) {
            optBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = optMenu.style.display !== 'none';
                optMenu.style.display = open ? 'none' : 'block';
            });
            document.addEventListener('click', function () { optMenu.style.display = 'none'; });
        }

        /* Wire delete */
        var delBtn = card.querySelector('.delete-biz-post-btn');
        if (delBtn) {
            delBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (!confirm('Delete this post?')) return;
                if (_fbOk()) {
                    window.fbDb.collection('business_posts').doc(p.id).delete()
                        .then(function () { card.remove(); _notify('Post deleted.', 'success'); })
                        .catch(function () { _notify('Could not delete post.', 'error'); });
                }
            });
        }

        return card;
    }


    /* =========================================================================
       §10  DASHBOARD BUSINESS POSTS (PRODUCT CARDS) — #dashboard-bizposts-slider
       ========================================================================= */

    (function initDashboardBizPostsSlider() {

        function _buildProductCard(post, pageName, pageAvatar, pageCover, pageId, listingCount) {
            var card = document.createElement('div');
            card.dataset.postId = post.id;
            card.dataset.pageId = pageId || post.pageId || '';
            card.style.cssText =
                'flex:0 0 220px;width:220px;border-radius:20px;overflow:hidden;cursor:pointer;'
                + 'box-shadow:0 6px 24px rgba(10,14,39,0.14);background:white;'
                + 'border:1px solid rgba(10,14,39,0.07);scroll-snap-align:start;'
                + 'transition:transform 0.22s,box-shadow 0.22s;display:flex;flex-direction:column;flex-shrink:0;';

            var fm     = post.media && post.media.length ? post.media[0] : '';
            var isVid  = fm && (/\.(mp4|webm|mov)/i.test(fm) || /\/video\/upload\//i.test(fm));
            var avatarSrc = pageAvatar || (
                'https://ui-avatars.com/api/?name=' + encodeURIComponent(pageName || 'B') + '&background=1B2B8B&color=fff&size=100'
            );

            var count = listingCount || 1;
            var catalogBadge = count > 1
                ? '<div style="position:absolute;top:10px;right:10px;background:rgba(10,14,39,0.72);'
                  + 'color:white;font-size:0.58rem;font-weight:800;padding:3px 9px;border-radius:20px;'
                  + 'letter-spacing:0.4px;backdrop-filter:blur(4px);display:flex;align-items:center;gap:4px;">'
                  + '<i class="fas fa-layer-group" style="font-size:0.55rem;"></i>' + count + ' Listings</div>'
                : '';

            /* ── Product image: large & prominent ── */
            var productBox = fm && !isVid
                ? '<div style="width:100%;height:200px;overflow:hidden;background:#f3f4f6;flex-shrink:0;position:relative;">'
                  + '<img src="' + _attr(fm) + '" style="width:100%;height:100%;object-fit:cover;display:block;"'
                  + ' onerror="this.parentNode.style.display=\'none\'">'
                  + '<div style="position:absolute;top:10px;left:10px;background:linear-gradient(135deg,#1B2B8B,#5B0EA6);'
                  + 'color:white;font-size:0.58rem;font-weight:800;padding:3px 10px;border-radius:20px;'
                  + 'letter-spacing:0.6px;text-transform:uppercase;box-shadow:0 2px 8px rgba(27,43,139,0.35);">For Sale</div>'
                  + catalogBadge
                  + '</div>'
                : fm && isVid
                    ? '<div style="width:100%;height:200px;overflow:hidden;background:#0A0E27;position:relative;flex-shrink:0;">'
                      + '<video src="' + _attr(fm) + '" style="width:100%;height:100%;object-fit:cover;display:block;" muted playsinline preload="metadata"></video>'
                      + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">'
                      + '<div style="width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.6);'
                      + 'display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);">'
                      + '<i class="fas fa-play" style="color:white;font-size:0.9rem;margin-left:3px;"></i></div></div>'
                      + '<div style="position:absolute;top:10px;left:10px;background:linear-gradient(135deg,#1B2B8B,#5B0EA6);'
                      + 'color:white;font-size:0.58rem;font-weight:800;padding:3px 10px;border-radius:20px;'
                      + 'letter-spacing:0.6px;text-transform:uppercase;">Video</div>'
                      + catalogBadge
                      + '</div>'
                    : '<div style="width:100%;height:120px;background:linear-gradient(135deg,rgba(27,43,139,0.07),rgba(91,14,166,0.12));'
                      + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
                      + '<i class="fas fa-store" style="font-size:2.8rem;color:rgba(27,43,139,0.22);"></i></div>';

            card.innerHTML =
                productBox
                /* Seller strip */
                + '<div style="display:flex;align-items:center;gap:9px;padding:11px 13px 7px;">'
                + '<div style="width:32px;height:32px;border-radius:50%;border:2px solid #fff;overflow:hidden;'
                + 'box-shadow:0 2px 8px rgba(0,0,0,0.18);background:#e8eaf6;flex-shrink:0;">'
                + '<img src="' + _attr(avatarSrc) + '" style="width:100%;height:100%;object-fit:cover;"'
                + ' onerror="this.src=\'https://ui-avatars.com/api/?name=B&background=1B2B8B&color=fff&size=100\'"></div>'
                + '<div style="min-width:0;">'
                + '<strong style="display:block;font-size:0.74rem;font-weight:800;color:#0A0E27;'
                + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(pageName || 'Business') + '</strong>'
                + '<span style="font-size:0.59rem;color:#5B0EA6;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">Business Page</span>'
                + '</div></div>'
                /* Description */
                + (post.text
                    ? '<div style="padding:2px 13px 10px;">'
                      + '<p style="margin:0;font-size:0.76rem;color:#374151;line-height:1.45;'
                      + 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">'
                      + _esc(post.text) + '</p></div>'
                    : '<div style="height:6px;"></div>')
                /* CTA */
                + '<div style="padding:0 13px 14px;margin-top:auto;">'
                + '<div style="background:linear-gradient(135deg,#1B2B8B,#5B0EA6);color:white;'
                + 'border-radius:10px;padding:9px;text-align:center;font-size:0.74rem;font-weight:700;'
                + 'letter-spacing:0.2px;display:flex;align-items:center;justify-content:center;gap:6px;">'
                + '<i class="fas fa-eye" style="font-size:0.66rem;"></i>View Listing</div>'
                + '</div>';

            card.addEventListener('mouseenter', function () {
                card.style.transform = 'translateY(-5px)';
                card.style.boxShadow = '0 14px 34px rgba(10,14,39,0.22)';
            });
            card.addEventListener('mouseleave', function () {
                card.style.transform = '';
                card.style.boxShadow = '0 6px 24px rgba(10,14,39,0.14)';
            });
            card.addEventListener('click', function () {
                var pid = post.pageId || '';
                if (pid) window._activeBizPageId = pid;
                var pages = window._firestoreBusinessPages || [];
                var biz   = pages.find(function (p) { return p.id === pid; });
                if (biz)  window._activeBizData = biz;
                if (typeof window.navigateTo === 'function') window.navigateTo('business-page');
                setTimeout(function () {
                    if (typeof window.renderBusinessPage === 'function') window.renderBusinessPage(pid);
                }, 80);
            });

            return card;
        }

        /* Track, per business page, the most recent post + total listing count
           so each page shows exactly ONE card in the dashboard timeline
           (a "catalog" card), rather than one card per post. */
        var _pageListingCounts = {};   // pageId -> total post count seen
        var _pageLatestPost    = {};   // pageId -> most recent post object

        function _upsertProductCard(post, name, avatar, cover) {
            var slider = document.getElementById('dashboard-bizposts-slider');
            if (!slider) return;
            var pid = post.pageId || ('post-' + post.id); // fallback key for pages without an id

            /* Update running totals — keep the newest post as the cover */
            _pageListingCounts[pid] = (_pageListingCounts[pid] || 0) + 1;
            var prevLatest = _pageLatestPost[pid];
            var postTime   = post.createdAt && post.createdAt.toMillis ? post.createdAt.toMillis() : (post.createdAt || 0);
            var prevTime   = prevLatest && prevLatest.createdAt && prevLatest.createdAt.toMillis ? prevLatest.createdAt.toMillis() : (prevLatest && prevLatest.createdAt || 0);
            if (!prevLatest || postTime >= prevTime) {
                _pageLatestPost[pid] = post;
            }
            var latest = _pageLatestPost[pid];
            var count  = _pageListingCounts[pid];

            var empty = document.getElementById('bizposts-empty');
            if (empty) { try { slider.removeChild(empty); } catch (_e) {} }

            /* Remove any existing card for this page (will be re-inserted at the front) */
            var existing = slider.querySelector('[data-page-id="' + pid + '"]');
            if (existing) { try { slider.removeChild(existing); } catch (_e2) {} }

            /* Most recently updated page's card appears first in the timeline */
            slider.insertBefore(_buildProductCard(latest, name, avatar, cover, pid, count), slider.firstChild);
        }

        function _loadProductCards() {
            if (!_fbOk()) return;
            if (window._bizPostsListenerActive) return; /* guard: only one listener */
            window._bizPostsListenerActive = true;
            try {
                window.fbDb.collection('business_posts')
                    .orderBy('createdAt', 'desc').limit(20)
                    .onSnapshot(function (snap) {
                        if (!snap || snap.empty) return;
                        snap.docChanges().forEach(function (change) {
                            if (change.type !== 'added') return;
                            var post = change.doc.data();
                            post.id  = change.doc.id;
                            var name = post.pageName || post.orgName || post.businessName || 'Business';
                            if (post.pageId) {
                                window.fbDb.collection('business_pages').doc(post.pageId).get()
                                    .then(function (d) {
                                        var data = d.exists ? d.data() : {};
                                        _upsertProductCard(post, data.name || name, data.profilePhoto || '', data.coverPhoto || '');
                                    })
                                    .catch(function () { _upsertProductCard(post, name, '', ''); });
                            } else {
                                _upsertProductCard(post, name, '', '');
                            }
                        });
                    }, function (err) {
                        console.warn('[EmpBusiness] biz-posts slider:', err && err.message);
                    });
            } catch (e) { /* silent */ }
        }

        function _init() {
            var container = document.getElementById('dashboard-bizposts-container');
            if (container) container.style.display = 'block';
            _loadProductCards();
            renderDashboardBusinesses();
        }

        /* ID rename removed — it caused duplicate cards */

        document.addEventListener('empyrean-init-done', function () { setTimeout(_init, 600); });
        document.addEventListener('empyrean-section-change', function (ev) {
            if (ev && ev.detail && ev.detail.section === 'dashboard') {
                setTimeout(function () {
                    if (!document.getElementById('dashboard-bizposts-container')) _init();
                    else renderDashboardBusinesses();
                }, 600);
            }
        });

        ready(function () { setTimeout(_init, 1200); });

    })();


    /* =========================================================================
       SECTION-CHANGE LISTENER — render page on navigate
       ========================================================================= */

    document.addEventListener('empyrean-section-change', function (ev) {
        if (!ev || !ev.detail) return;
        var sec = ev.detail.section;
        if (sec === 'business-page') {
            setTimeout(function () {
                /* Use the raw renderer directly — not window.renderBusinessPage which
                   may have been wrapped by patch files and point to a stripped version */
                var renderer = window._appBizRenderer || window.renderBusinessPage;
                if (typeof renderer === 'function') {
                    renderer(window._activeBizPageId || '');
                }
            }, 100);
        }
    });

    /* Also fire if navigateTo is called directly before this module was loaded */
    ready(function () {
        setTimeout(function () {
            var active = document.querySelector('.content-section.active');
            if (active && active.id === 'business-page') {
                renderBusinessPage(window._activeBizPageId || '');
            }
        }, 800);
    });


    /* =========================================================================
       EMPTY STATE HELPERS
       ========================================================================= */

    function _emptyState(msg, icon) {
        return '<div style="padding:60px 24px;text-align:center;color:#9CA3AF;">'
            + '<i class="fas ' + (icon || 'fa-store') + '" style="font-size:2.5rem;color:rgba(27,43,139,0.2);margin-bottom:14px;display:block;"></i>'
            + '<p style="margin:0;font-size:0.9rem;">' + _esc(msg) + '</p></div>';
    }

    function _noPageYetState() {
        var us = _us();
        if (_isGuest()) {
            return _emptyState('Please log in to view business pages.', 'fa-user-lock');
        }
        return '<div style="padding:60px 24px;text-align:center;">'
            + '<div style="width:80px;height:80px;border-radius:24px;'
            + 'background:linear-gradient(135deg,rgba(27,43,139,0.08),rgba(91,14,166,0.08));'
            + 'display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">'
            + '<i class="fas fa-store" style="font-size:2.2rem;color:rgba(27,43,139,0.3);"></i></div>'
            + '<h3 style="margin:0 0 8px;font-size:1.1rem;font-weight:800;color:#0A0E27;">No Business Page Yet</h3>'
            + '<p style="color:#6B7280;font-size:0.88rem;margin:0 0 22px;line-height:1.5;">'
            + 'Create your business page to start showcasing products,<br>posts, and offers to the community.</p>'
            + '<button onclick="(function(){var m=document.getElementById(\'create-business-page-modal\');if(m){m.style.display=\'flex\';m.classList.add(\'show\');}})()"'
            + ' style="padding:12px 32px;border-radius:50px;background:linear-gradient(135deg,#1B2B8B,#5B0EA6);'
            + 'color:white;border:none;font-weight:700;font-size:0.92rem;cursor:pointer;'
            + 'box-shadow:0 4px 18px rgba(91,14,166,0.35);">'
            + '<i class="fas fa-plus" style="margin-right:8px;"></i>Create Business Page</button>'
            + '</div>';
    }

    console.log('[EmpBusiness] ✅ Business module v3.0 ready — page renderer, dashboard slider, post composer, ownership enforcement loaded.');

})();