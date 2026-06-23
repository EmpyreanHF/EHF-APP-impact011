/* ═══════════════════════════════════════════════════════════════════════════════
   EMPYREAN  —  app-nav.js  v3.0
   Navigation Engine + Upload Bridge + Close Button Wiring
   ═══════════════════════════════════════════════════════════════════════════════

   WHY THIS FILE EXISTS
   ─────────────────────
   app-fixes.js defines buildSidebar / navigateTo / buildHeader / renderDynamicUI
   as LOCAL functions inside a DOMContentLoaded closure. They are exposed to
   window at the very end of that closure, but app-auth.js calls them BEFORE
   app-fixes.js has finished executing. This file installs lightweight stubs
   that queue calls, then drains the queue once the real functions arrive.

   It also owns two cross-cutting concerns that broke because they were
   scattered across multiple files with competing event handlers:

   1. UPLOAD BUTTONS  — Every <label for="…"> that wraps a hidden file <input>
      must NOT have its default click behaviour cancelled. The master body
      click handler in app-fixes.js calls e.preventDefault() on many clicks
      before checking whether the target is a label. This file adds an early
      capture-phase listener that lets label→input clicks through first.

   2. CLOSE / EXIT BUTTONS — Same issue: close-modal × buttons sit inside
      .modal-overlay-container elements. The body listener fires e.preventDefault
      for many selectors without explicitly allowing close buttons that are
      children of non-matching ancestors. This file adds a capture-phase
      handler that runs before the bubbling handlers in app-fixes.js.

   LOAD ORDER: after app-helper.js, BEFORE app-auth.js
   ═══════════════════════════════════════════════════════════════════════════════ */

(function empyreanNav() {
    'use strict';

    /* ── 1. NAV ITEM REGISTRY ──────────────────────────────────────────────── */
    var NAV = [
        { id: 'dashboard',       label: 'Dashboard',       icon: 'fa-border-all'              },
        { id: 'my-wallet',       label: 'My Wallet',       icon: 'fa-wallet'           },
        { id: 'messages',        label: 'Messages',        icon: 'fa-comment-dots'                 },
        { id: 'marketplace',     label: 'Marketplace',     icon: 'fa-shop'                 },
        { id: 'go-live',         label: 'Go Live',         icon: 'fa-broadcast-tower'                },
        { id: 'reels',           label: 'Reels',           icon: 'fa-film'           },
        { id: 'news',            label: 'News',            icon: 'fa-newspaper'                   },
        { id: 'saved-posts',     label: 'Saved',           icon: 'fa-bookmark'                     },
        { id: 'download-log',    label: 'Downloads',       icon: 'fa-download'                     },
        { id: 'business-page',   label: 'Business Page',   icon: 'fa-building'             },
        { id: 'community-tasks', label: 'Community Tasks', icon: 'fa-list-check'          },
        { id: 'request-help',    label: 'Request Help',    icon: 'fa-hand-holding-heart'         },
        { id: 'report-crisis',   label: 'Report Crisis',   icon: 'fa-triangle-exclamation'  },
        { id: 'grant-portal',    label: 'Grant Portal',    icon: 'fa-file-contract'   },
        { id: 'ngo-partners',    label: 'NGO Partners',    icon: 'fa-earth-africa'                 },
        { id: 'profile',         label: 'My Profile',      icon: 'fa-circle-user'                  },
        { id: 'settings',        label: 'Settings',        icon: 'fa-gear'             },
        { id: 'admin',           label: 'Admin Panel',     icon: 'fa-shield-halved', adminOnly: true }
    ];

    var MOBILE_NAV = [
        { id: 'dashboard',   label: 'Home',    icon: 'fa-border-all'    },
        { id: 'messages',    label: 'Messages',icon: 'fa-comment-dots'       },
        { id: 'marketplace', label: 'Market',  icon: 'fa-shop'       },
        { id: 'reels',       label: 'Reels',   icon: 'fa-film' },
        { id: 'profile',     label: 'Profile', icon: 'fa-circle-user'        }
    ];

    /* ── 2. HELPERS ────────────────────────────────────────────────────────── */
    function _isGuest() {
        /* BUG FIX: Check all authoritative sources in priority order.
           EmpState is the canonical source set by app-auth.js on login.
           fbAuth.currentUser is the ground truth from Firebase.
           window.isGuest is a fallback that may lag behind auth state. */
        if (window.EmpState && window.EmpState.isGuest === false) return false;
        if (window.fbAuth && window.fbAuth.currentUser) return false;
        if (window.EmpState && window.EmpState.isGuest === true) return true;
        if (window.isGuest === false) return false;
        if (window.isGuest === true)  return true;
        /* Default: guest until auth confirms otherwise */
        return true;
    }
    function _isAdmin()  { return !!( window.isAdmin  !== undefined ? window.isAdmin  : false ); }
    function _us()       { return window.userState || {}; }
    function _esc(s)     { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    var _activeSection = 'dashboard';

    /* ── 3. navigateTo — the ONE authoritative section switcher ────────────── */

    /** Stop and unload every playing video that is NOT inside the reel-viewer
     *  or go-live modals (those have their own teardown logic). */
    function _stopAllVideos() {
        document.querySelectorAll('video').forEach(function(v) {
            // Skip reel viewer and live stream — they manage their own video lifecycle
            if (v.closest('#reel-viewer-modal-overlay, #reel-viewer-container, ' +
                          '#go-live-modal-overlay, #live-stream-container')) return;
            try {
                if (!v.paused) v.pause();
            } catch(e) {}
        });
    }

    function navigateTo(id, fromClick) {
        if (!id) id = 'dashboard';
        // alias map
        var aliases = { home:'dashboard', feed:'dashboard', chat:'messages',
                        wallet:'my-wallet', live:'go-live', sos:'request-help',
                        saved:'saved-posts', bookmarks:'saved-posts',
                        downloads:'download-log' };
        id = aliases[id] || id;

        var target = document.getElementById(id);
        if (!target) { console.warn('[Nav] Section not found:', id); return; }

        // Stop any playing videos in the section we are leaving
        _stopAllVideos();

        document.querySelectorAll('.content-section').forEach(function(s){ s.classList.remove('active'); });
        target.classList.add('active');
        _activeSection = id;

        // sidebar active link  (data-target used by app-fixes.js, data-section used by this module)
        document.querySelectorAll('.sidebar-nav .nav-link').forEach(function(a){
            a.classList.toggle('active',
                a.dataset.target === id || a.dataset.section === id);
        });

        // mobile bottom nav
        var mbn = document.getElementById('mobile-bottom-nav');
        if (mbn) {
            mbn.querySelectorAll('.mobile-nav-item').forEach(function(b){
                b.classList.toggle('active', b.dataset.target === id || b.dataset.section === id);
            });
        }

        // breadcrumb
        var bc = document.getElementById('breadcrumb-text');
        if (bc) {
            var labels = {};
            NAV.forEach(function(n){ labels[n.id] = n.label; });
            bc.textContent = labels[id] || id;
        }

        // quick-post FAB
        var fab = document.getElementById('quick-post-fab');
        if (fab) fab.style.display = (id === 'dashboard' && !_isGuest()) ? 'flex' : 'none';

        // close sidebar on mobile
        var sb = document.querySelector('.sidebar');
        var ov = document.getElementById('content-overlay');
        if (sb && sb.classList.contains('open') && window.innerWidth <= 992) {
            sb.classList.remove('open');
            if (ov) ov.classList.remove('show');
            document.body.classList.remove('modal-open');
        }

        var mc = document.querySelector('.main-content');
        if (mc) mc.scrollTop = 0;

        try { localStorage.setItem('empyrean_last_section', id); } catch(e){}
        try { document.dispatchEvent(new CustomEvent('empyrean-section-change',{detail:{section:id}})); } catch(e){}

        // notify app-fixes.js listeners / admin panel
        if (typeof window.updateQuickPostFab === 'function') window.updateQuickPostFab(id);
        if (typeof window._startRealtimeListeners === 'function' && !_isGuest()) {
            var need = !window._postsListener || !window._mktListener || !window._newsListener;
            if (need) setTimeout(window._startRealtimeListeners, 100);
        }
    }
    window.navigateTo = navigateTo;

    /* ── 4. buildSidebar ───────────────────────────────────────────────────── */
    function buildSidebar() {
        var ul = document.querySelector('.sidebar-nav');
        var footerEl = document.querySelector('.sidebar-footer');
        if (!ul) return;

        var guest = _isGuest();
        var admin = _isAdmin();
        var us    = _us();

        // Build nav items
        ul.innerHTML = '';
        NAV.forEach(function(item) {
            if (item.adminOnly && !admin) return;
            if (['my-wallet','messages','go-live','business-page','community-tasks',
                 'request-help','report-crisis','profile','settings','saved-posts','download-log'].indexOf(item.id) !== -1
                && guest) return;

            var li = document.createElement('li');
            var a  = document.createElement('a');
            a.href = '#';
            a.className = 'nav-link' + (item.id === _activeSection ? ' active' : '');
            a.dataset.target  = item.id;   // app-fixes.js uses data-target
            a.dataset.section = item.id;   // this module uses data-section
            a.setAttribute('aria-label', item.label);
            a.innerHTML =
                '<span class="nav-icon-box"><i class="fas ' + item.icon + '"></i></span>'
                + '<span style="flex:1;letter-spacing:0.01em;">' + item.label + '</span>';

            a.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                navigateTo(item.id, true);
            });
            li.appendChild(a);
            ul.appendChild(li);
        });

        // Build footer
        if (footerEl) _buildSidebarFooter(footerEl, guest, admin, us);

        console.log('[Nav] Sidebar built — ' + ul.children.length + ' items');
    }
    window.buildSidebar = buildSidebar;

    function _buildSidebarFooter(el, guest, admin, us) {
        var avatar = us.avatar || us.profilePic || '';
        var name   = us.fullName || us.username || (guest ? 'Guest' : 'User');
        var uname  = us.username ? '@' + us.username : (admin ? 'Administrator' : '');
        var avatarHTML = avatar
            ? '<img src="'+_esc(avatar)+'" alt="avatar" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid rgba(245,197,24,0.6);" onerror="this.src=\'https://ui-avatars.com/api/?name='+encodeURIComponent(name)+'&background=1B2B8B&color=fff&size=80\'">'
            : '<div style="width:44px;height:44px;border-radius:50%;background:rgba(245,197,24,0.15);border:2px solid rgba(245,197,24,0.4);display:flex;align-items:center;justify-content:center;"><i class="fas fa-circle-user" style="color:rgba(245,197,24,0.8);font-size:1.1rem;"></i></div>';

        el.innerHTML = (!guest ? (
            '<div class="nav-link" data-target="'+(admin?'admin':'profile')+'" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.06);border-radius:12px;margin-bottom:10px;cursor:pointer;border:1px solid rgba(255,255,255,0.07);">'
            + '<div style="position:relative;flex-shrink:0;">' + avatarHTML
            + '<div style="position:absolute;bottom:0;right:0;width:11px;height:11px;background:#10B981;border-radius:50%;border:2px solid #1a1a2e;"></div></div>'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-weight:700;font-size:0.87rem;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(name) + '</div>'
            + '<div style="font-size:0.72rem;color:rgba(255,255,255,0.4);">' + _esc(uname) + '</div></div>'
            + '<i class="fas fa-chevron-right" style="color:rgba(255,255,255,0.2);font-size:0.7rem;flex-shrink:0;"></i></div>'
            + '<a href="#" id="logout-btn" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);border-radius:10px;color:#FCA5A5;font-weight:600;font-size:0.83rem;text-decoration:none;margin-bottom:10px;"><i class="fas fa-sign-out-alt"></i> Sign Out</a>'
        ) : (
            '<button id="login-signup-btn" class="btn btn-accent" style="width:100%;margin-bottom:10px;padding:12px;font-size:0.9rem;font-weight:700;"><i class="fas fa-sign-in-alt"></i> Login / Sign Up</button>'
        ))
        + '<div class="social-links" style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">'
        + '<a href="https://www.youtube.com/@EmpyreanHFNewsTV" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>'
        + '<a href="https://x.com/EmpyToken" target="_blank" title="X / Twitter"><i class="fab fa-twitter"></i></a>'
        + '<a href="https://www.instagram.com/empyreantoken_empy" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>'
        + '<a href="https://www.linkedin.com/company/108660039" target="_blank" title="LinkedIn"><i class="fab fa-linkedin"></i></a>'
        + '<a href="https://t.me/EmpyreanToken" target="_blank" title="Telegram"><i class="fab fa-telegram-plane"></i></a>'
        + '<a href="https://whatsapp.com/channel/0029VbAyfxaAzNc45vhje92j" target="_blank" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>'
        + '</div>';

        // bind footer card click → profile / admin
        var card = el.querySelector('.nav-link[data-target]');
        if (card) {
            card.addEventListener('click', function(e) {
                e.preventDefault();
                navigateTo(card.dataset.target, true);
            });
        }
    }

    /* ── 5. buildHeader ────────────────────────────────────────────────────── */
    function buildHeader() {
        if (typeof window._populateHomeBioCard === 'function') window._populateHomeBioCard();
        var ha = document.getElementById('main-header-actions');
        if (!ha) return;
        var empLink = '<a href="https://empyreanhumanitarianfoundation.com" target="_blank" rel="noopener" title="Empyrean Official Website" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0A0E27,#1B2B8B);border:2px solid rgba(245,197,24,0.6);cursor:pointer;text-decoration:none;flex-shrink:0;margin-right:6px;"><i class="fas fa-earth-africa" style="color:#F5C518;font-size:0.9rem;"></i></a>';
        ha.innerHTML = _isGuest()
            ? empLink
            : empLink + '<button class="btn cart-icon-button" id="cart-icon-btn"><i class="fas fa-shopping-cart"></i> Cart <span class="cart-item-count">0</span></button>';
    }
    window.buildHeader = buildHeader;

    /* ── 6. renderDynamicUI ────────────────────────────────────────────────── */
    function renderDynamicUI() {
        buildSidebar();
        buildHeader();
        _buildMobileBottomNav();
        var fab = document.getElementById('quick-post-fab');
        if (fab) fab.style.display = (_activeSection === 'dashboard' && !_isGuest()) ? 'flex' : 'none';
        if (typeof window.updateWalletUI === 'function') window.updateWalletUI();
        if (typeof window.updateCartUI   === 'function') window.updateCartUI();
    }
    window.renderDynamicUI = renderDynamicUI;

    /* ── 7. _buildMobileBottomNav ──────────────────────────────────────────── */
    function _buildMobileBottomNav() {
        var old = document.getElementById('mobile-bottom-nav');
        if (old) old.remove();

        var guest = _isGuest();
        var items = guest
            ? [
                { id:'dashboard',   label:'Home',    icon: 'fa-border-all'    },
                { id:'marketplace', label:'Market',  icon: 'fa-shop'       },
                { id:'reels',       label:'Reels',   icon: 'fa-film' },
                { id:'news',        label:'News',    icon: 'fa-newspaper'         },
                { id:'ngo-partners',label:'NGOs',    icon: 'fa-earth-africa'       }
              ]
            : [
                { id:'dashboard',      label:'Home',     icon: 'fa-border-all'           },
                { id:'reels',          label:'Reels',    icon: 'fa-film'        },
                { id:'news',           label:'News',     icon: 'fa-newspaper'                },
                { id:'marketplace',    label:'Market',   icon: 'fa-shop'              },
                { id:'report-crisis',  label:'Crisis',   icon: 'fa-triangle-exclamation'},
                { id:'messages',       label:'Messages', icon: 'fa-comment-dots'              },
                { id:'go-live',        label:'Go Live',  icon: 'fa-broadcast-tower'             },
                { id:'request-help',   label:'SOS',      icon: 'fa-hand-holding-heart'      },
                { id:'saved-posts',    label:'Saved',    icon: 'fa-bookmark'        },
                { id:'download-log',   label:'Downloads',icon: 'fa-download'        },
                { id:'my-wallet',      label:'Wallet',   icon: 'fa-wallet'        },
                { id:'profile',        label:'Profile',  icon: 'fa-circle-user'               }
              ];

        var nav = document.createElement('nav');
        nav.id = 'mobile-bottom-nav';
        nav.setAttribute('role', 'navigation');
        nav.setAttribute('aria-label', 'Bottom navigation');

        items.forEach(function(item) {
            var btn = document.createElement('button');
            btn.className = 'mobile-nav-item' + (item.id === _activeSection ? ' active' : '');
            btn.dataset.target  = item.id;
            btn.dataset.section = item.id;
            btn.setAttribute('aria-label', item.label);
            btn.innerHTML = '<i class="fas ' + item.icon + '"></i><span>' + item.label + '</span>';
            nav.appendChild(btn);
        });

        nav.addEventListener('click', function(e) {
            var btn = e.target.closest('.mobile-nav-item');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            nav.querySelectorAll('.mobile-nav-item').forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
            navigateTo(btn.dataset.target, true);
        });

        document.body.appendChild(nav);
        window._buildMobileBottomNav = _buildMobileBottomNav;
    }
    window._buildMobileBottomNav = _buildMobileBottomNav;

    /* ── 8. AUTH MODAL OPENER ──────────────────────────────────────────────── */
    window._openAuthModal = function(view) {
        var am = document.getElementById('auth-modal-overlay');
        var lv = document.getElementById('login-view');
        var sv = document.getElementById('signup-view');
        if (!am) return;
        am.style.display = 'flex'; am.classList.add('show');
        document.body.classList.add('modal-open');
        if (view === 'signup' && sv && lv) { sv.style.display='block'; lv.style.display='none'; }
        else if (lv) lv.style.display = 'block';
        setTimeout(function(){ if(typeof window.generateCaptcha==='function') window.generateCaptcha(); }, 80);
    };

    /* ── 9. UPLOAD BUTTONS — capture-phase, runs before body handler ───────── */
    /* Root cause of broken uploads:
       app-fixes.js attaches document.body.addEventListener('click', ...) with bubbling.
       Some paths inside that handler call e.preventDefault() before checking if the
       target is a <label>. Because labels rely on their default click-to-input behaviour,
       preventDefault() breaks them.

       Fix: attach a CAPTURE-PHASE listener on document. Capture fires before bubbling.
       If the click target is a <label[for]> that points to a file input, we let it
       through and mark the event so the body handler skips it. */
    document.addEventListener('click', function(e) {
        var t = e.target;
        var label = t.tagName === 'LABEL' ? t : t.closest('label');
        if (!label) return;

        var forId = label.getAttribute('for') || label.dataset.uploadFor;
        if (!forId) return;

        var inp = document.getElementById(forId);
        if (!inp || inp.type !== 'file') return;

        // Mark event so downstream handlers know it's a file-label click
        e._isFileLabelClick = true;
        // Don't call stopPropagation — we want the default label→input click to proceed
        // Just ensure no downstream handler calls preventDefault
    }, true /* capture phase */);

    /* Patch: intercept the body click handler's preventDefault for file labels.
       We override EventTarget.prototype.preventDefault during capture to be a no-op
       when _isFileLabelClick is set. Too invasive — instead, we bind a second
       capture listener that calls inp.click() explicitly then stops propagation
       so the body handler never sees it. */
    document.addEventListener('click', function(e) {
        var t = e.target;
        var label = t.tagName === 'LABEL' ? t : t.closest('label');
        if (!label) return;

        var forId = label.getAttribute('for') || label.dataset.uploadFor;
        if (!forId) return;
        var inp = document.getElementById(forId);
        if (!inp || inp.type !== 'file') return;

        // Prevent the body handler from seeing this click at all
        e.stopImmediatePropagation();
        // Trigger the file input ourselves
        inp.click();
    }, true /* capture, runs before all bubbling handlers */);

    /* ── 10. CLOSE / EXIT BUTTONS — capture-phase ──────────────────────────── */
    /* Root cause: body handler checks for .close-modal only when a
       .modal-overlay-container.show ancestor exists. Some close buttons live
       inside overlays that don't have the .show class (display:flex instead).
       Also standalone close buttons like #status-viewer-close are not in
       the selector list at all.

       Fix: capture-phase handler that runs before everything else. */
    document.addEventListener('click', function(e) {
        var t = e.target;

        // ── × on any modal overlay (data-dismiss or .close-modal class) ──
        var closeBtn = t.closest && (
            t.closest('[data-dismiss="modal"]') ||
            t.closest('.close-modal') ||
            t.closest('.close-modal-btn') ||
            t.closest('.modal-close-btn')
        );
        if (closeBtn) {
            e.stopImmediatePropagation();
            var overlay = closeBtn.closest('.modal-overlay-container, .live-sub-modal, [id$="-modal"], [id$="-overlay"]');
            if (overlay) {
                overlay.classList.remove('show','active');
                overlay.style.display = 'none';
            }
            document.body.classList.remove('modal-open');
            return;
        }

        // ── Specific IDs ────────────────────────────────────────────────
        var id = t.id || (t.closest('[id]') && t.closest('[id]').id);
        var closeIds = {
            'status-viewer-close':     'status-viewer-modal',
            'cancel-status-btn':       'create-status-modal',
            'close-auth-modal':        'auth-modal-overlay',
            'status-viewer-close-btn': 'status-viewer-modal',
            'close-status-viewers-panel': 'status-viewers-panel',
            'close-sos-donation-modal':'sos-donation-modal',
            'close-edit-post-modal':   'edit-post-modal-overlay',
            'close-dispute-modal':     'dispute-detail-modal',
            'close-complaint-modal':   'submit-complaint-modal',
            'gallery-close-btn':       'marketplace-gallery-modal'
        };
        if (closeIds[id]) {
            e.stopImmediatePropagation();
            var m = document.getElementById(closeIds[id]);
            if (m) { m.classList.remove('show','active'); m.style.display='none'; }
            document.body.classList.remove('modal-open');
            return;
        }

        // ── Auth modal close (× button inside auth modal) ────────────
        if (t.closest && t.closest('#auth-modal-overlay') && (t.classList.contains('auth-close-btn') || t.textContent.trim() === '×')) {
            var am = document.getElementById('auth-modal-overlay');
            if (am) { am.classList.remove('show'); am.style.display='none'; }
            document.body.classList.remove('modal-open');
            e.stopImmediatePropagation();
            return;
        }

        // ── Click outside modal (on overlay itself) ──────────────────
        if (t.classList && t.classList.contains('modal-overlay-container')) {
            t.classList.remove('show','active');
            t.style.display = 'none';
            document.body.classList.remove('modal-open');
            e.stopImmediatePropagation();
            return;
        }

        // ── Live stream close ─────────────────────────────────────────
        if (t.id === 'live-close-btn') {
            var ls = document.getElementById('go-live-modal-overlay');
            if (ls) { ls.classList.remove('show'); ls.style.display='none'; }
            document.body.classList.remove('modal-open');
            if (typeof window.endLiveStream === 'function') window.endLiveStream();
            e.stopImmediatePropagation();
            return;
        }

    }, true /* capture phase */);

    /* ── 11. HAMBURGER TOGGLE ───────────────────────────────────────────────── */
    function _wireHamburger() {
        var toggle = document.querySelector('.mobile-menu-toggle');
        var sb     = document.querySelector('.sidebar');
        var ov     = document.getElementById('content-overlay');
        if (!toggle || toggle._navWired) return;
        toggle._navWired = true;
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (sb) sb.classList.toggle('open');
            if (ov) ov.classList.toggle('show');
            document.body.classList.toggle('modal-open', !!(sb && sb.classList.contains('open')));
        });
        if (ov && !ov._navWired) {
            ov._navWired = true;
            ov.addEventListener('click', function() {
                if (sb) sb.classList.remove('open');
                ov.classList.remove('show');
                document.body.classList.remove('modal-open');
            });
        }
    }

    /* ── 12. RESPONSIVE ─────────────────────────────────────────────────────── */
    function _applyResponsive() {
        var mobile = window.innerWidth <= 992;
        var sb     = document.querySelector('.sidebar');
        var toggle = document.querySelector('.mobile-menu-toggle');
        var mc     = document.querySelector('.main-content');
        if (mobile) {
            if (sb && !sb.classList.contains('open')) sb.style.transform = 'translateX(-100%)';
            if (toggle) toggle.style.display = 'flex';
            if (mc)     mc.style.marginLeft  = '0';
        } else {
            if (sb) { sb.style.transform = 'translateX(0)'; sb.classList.remove('open'); }
            if (toggle) toggle.style.display = 'none';
            if (mc)     mc.style.marginLeft  = '270px';
            var mbn = document.getElementById('mobile-bottom-nav');
            // keep mobile nav even on desktop so tablet users aren't stranded
        }
    }

    /* ── 13. BRIDGE QUEUE — drain once app-fixes.js exposes real functions ── */
    window._navBridgeQueue = window._navBridgeQueue || [];
    document.addEventListener('empyrean-init-done', function() {
        // app-fixes.js now exposes its own buildSidebar / navigateTo — let them win
        // but only if they exist. Otherwise our implementations stand.
        if (typeof window._appFixesBuildSidebar === 'function') {
            window.buildSidebar = window._appFixesBuildSidebar;
        }
        window._navBridgeQueue.forEach(function(c) {
            try { if(typeof window[c.fn]==='function') window[c.fn].apply(window,c.args); } catch(e){}
        });
        window._navBridgeQueue = [];
    });

    /* ── 14. INIT ────────────────────────────────────────────────────────────── */
    function _init() {
        _wireHamburger();
        _applyResponsive();
        window.addEventListener('resize', _applyResponsive);

        // Restore last section
        var last = 'dashboard';
        try { last = localStorage.getItem('empyrean_last_section') || 'dashboard'; } catch(e){}
        // Ensure only dashboard is active on first paint
        document.querySelectorAll('.content-section').forEach(function(s){
            s.classList.toggle('active', s.id === (last || 'dashboard'));
        });
        _activeSection = last || 'dashboard';

        // Build sidebar immediately with whatever state is available
        setTimeout(function() {
            buildSidebar();
            _buildMobileBottomNav();
        }, 0);

        console.log('[Nav] app-nav.js v3.0 ready — upload capture, close capture, nav engine active.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

    // Re-run after user logs in/out
    document.addEventListener('empyrean-user-ready',   function(){ buildSidebar(); _buildMobileBottomNav(); });
    document.addEventListener('empyrean-init-done',    function(){ buildSidebar(); _buildMobileBottomNav(); });
    document.addEventListener('empyrean-section-change', function(e) {
        if (e.detail && e.detail.section) _activeSection = e.detail.section;
    });

})();