/* =============================================================================
   EMPYREAN INTERNATIONAL — app-patch-openchat.js
   Load AFTER app-patch-v2.js

   WHAT THIS FILE DOES
   ────────────────────
   Defines  window.openChat(userId)  — the one function that was called
   everywhere (contact-item clicks, profile message button, marketplace)
   but never implemented.

   FEATURES
   ────────
   [1] Looks up the user from window.mockUsers → Firestore fallback
   [2] Populates #chat-header-info with avatar, name, online dot
   [3] Shows   #chat-view-container, hides #chat-placeholder
   [4] Adds a sticky WhatsApp-style header: back ← | avatar | name | video 📹 | call 📞 | ⋮
   [5] Subscribes to Firestore messages for this thread in real-time
   [6] Renders bubbles into #chat-messages-container (independent scroll)
   [7] Wires #message-form / #vf-msg-send → saves to Firestore messages collection
   [8] Keeps input + send button fixed at bottom via existing flex CSS
   [9] Mobile full-screen (position:absolute, covers status bar)
   [10] Long-press on any bubble → WhatsApp emoji reaction bar
        (👍 ❤️ 😂 😮 😢 🙏 ❌ +) with live Firestore update
   ============================================================================= */

(function empyreanOpenChat() {
    'use strict';

    /* ── tiny helpers (safe even before EmpState exists) ── */
    function _us()      { return (window.EmpState && window.EmpState.userState) || window.userState || {}; }
    function _isGuest() { var s = window.EmpState || {}; return s.isGuest != null ? !!s.isGuest : !!window.isGuest; }
    function _fbOk()    { return !!(window._firebaseLoaded && window.fbDb); }
    function _notify(m, t) { if (typeof window.showNotification === 'function') window.showNotification(m, t||'info'); }
    function _esc(s)    { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function _fmt(ts)   {
        /* Format timestamp as WhatsApp-style HH:MM */
        if (!ts) return '';
        var d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function _ready(fn) {
        if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
    }


    /* =========================================================================
       §1  INJECT STYLES (once)
       ========================================================================= */
    function _injectStyles() {
        if (document.getElementById('_oc_styles')) return;
        var s = document.createElement('style');
        s.id = '_oc_styles';
        s.textContent = [

            /* ── FIX: defensive backstop against overlapping / split-screen
               sections (screenshots showed two sections rendering at once
               after closing a chat, then tapping the nav bar). Root cause
               was inline style.display being written directly onto
               .content-section elements, which beats class-based CSS and
               can survive a later real navigation. The JS call sites that
               did this have been fixed, but this CSS rule is a backstop:
               no matter what inline style anything sets in the future, a
               non-active .content-section can never paint, and an active
               one is never blocked. !important on both sides means this
               wins regardless of inline style write order. ── */
            '.content-section:not(.active){ display:none!important; }',
            '.content-section.active{ display:block!important; }',

            /* ── messages-view outer container ── */
            '#messages-view{',
            '  display:flex!important;',
            '  height:calc(100dvh - 120px)!important;',
            '  overflow:hidden!important;',
            '  background:#f0f2f5;',
            '  position:relative;',
            '}',

            /* ── contact list (left panel) ── */
            '.contact-list{',
            '  flex:0 0 320px;min-width:320px;max-width:320px;',
            '  overflow-y:auto;',
            '  background:#fff;',
            '  border-right:1px solid rgba(10,14,39,0.08);',
            '  display:flex;flex-direction:column;',
            '}',
            '.contact-item{',
            '  display:flex;align-items:center;gap:12px;',
            '  padding:12px 16px;cursor:pointer;',
            '  border-bottom:1px solid rgba(10,14,39,0.05);',
            '  transition:background 0.14s;',
            '}',
            '.contact-item:hover{ background:rgba(27,43,139,0.05); }',
            '.contact-item.active{ background:rgba(27,43,139,0.10); }',

            /* ── chat placeholder (desktop: no chat selected) ── */
            '#chat-placeholder{',
            '  flex:1;display:flex;align-items:center;justify-content:center;',
            '  flex-direction:column;gap:16px;color:#9CA3AF;',
            '  background:#f7f8fc;',
            '}',

            /* ── chat-view-container ── */
            /* Default HIDDEN on mobile — only shown via .oc-mobile-open (added by openChat).
               The desktop @media below overrides this for wide screens. */
            '#chat-view-container{',
            '  flex:1;display:none;flex-direction:column;',
            '  min-width:0;height:100%;min-height:0;',
            '  background:#f0f2f5;',
            '  position:relative;',
            '}',

            /* ── WhatsApp-style sticky header ── */
            '#oc-chat-header{',
            '  display:flex;align-items:center;gap:10px;',
            '  padding:10px 14px;',
            '  background:#1B2B8B;',
            '  color:#fff;',
            '  flex-shrink:0;',
            '  position:sticky;top:0;z-index:2147483646;',
            '  box-shadow:0 2px 8px rgba(10,14,39,0.22);',
            '}',
            '#oc-back-btn{',
            '  background:rgba(255,255,255,0.20);border:none;color:#fff;cursor:pointer;',
            '  width:36px;height:36px;min-width:36px;min-height:36px;border-radius:50%;',
            '  display:flex;align-items:center;justify-content:center;',
            '  flex-shrink:0;margin-left:auto;',
            '  transition:background 0.15s,transform 0.12s;',
            '  order:99;',
            '  position:relative;z-index:2147483647;',
            '  -webkit-tap-highlight-color:rgba(255,255,255,0.3);',
            '  touch-action:manipulation;',
            '  pointer-events:all!important;',
            '}',
            '#oc-back-btn:hover,#oc-back-btn:focus{ background:rgba(255,255,255,0.35); outline:none; }',
            '#oc-back-btn:active{ transform:scale(0.88);background:rgba(255,255,255,0.50); }',
            '#oc-back-btn svg{ width:20px;height:20px;fill:#fff;pointer-events:none; }',
            '#oc-peer-avatar{',
            '  width:38px;height:38px;border-radius:50%;object-fit:cover;',
            '  background:rgba(255,255,255,0.2);flex-shrink:0;',
            '  border:2px solid rgba(255,255,255,0.35);',
            '}',
            '#oc-peer-info{flex:1;min-width:0;}',
            '#oc-peer-name{',
            '  font-weight:700;font-size:0.95rem;',
            '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
            '}',
            '#oc-peer-status{font-size:0.72rem;opacity:0.8;margin-top:1px;}',
            '.oc-header-btn{',
            '  background:none;border:none;color:#fff;cursor:pointer;',
            '  width:36px;height:36px;border-radius:50%;',
            '  display:flex;align-items:center;justify-content:center;',
            '  flex-shrink:0;transition:background 0.15s;',
            '}',
            '.oc-header-btn:hover{ background:rgba(255,255,255,0.15); }',
            '.oc-header-btn svg{ width:20px;height:20px;fill:#fff; }',

            /* ── messages scroll area ── */
            '#oc-messages-body{',
            '  flex:1;overflow-y:auto;overflow-x:hidden;',
            '  -webkit-overflow-scrolling:touch;',
            '  overscroll-behavior:contain;',
            '  min-height:0;',
            '  padding:12px 8px 8px;',
            '  display:flex;flex-direction:column;gap:3px;',
            '  background:#f0f2f5;',
            '  scroll-behavior:smooth;',
            '}',
            /* WhatsApp wallpaper subtle pattern */
            '#oc-messages-body::before{',
            '  content:"";position:fixed;inset:0;pointer-events:none;z-index:0;',
            '  background-image:url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%231B2B8B\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");',
            '  opacity:1;',
            '}',

            /* ── date separator ── */
            '.oc-date-sep{',
            '  text-align:center;margin:8px 0;position:relative;z-index:1;',
            '}',
            '.oc-date-sep span{',
            '  background:rgba(255,255,255,0.85);color:#6B7280;',
            '  font-size:0.72rem;font-weight:600;',
            '  padding:3px 12px;border-radius:12px;',
            '  box-shadow:0 1px 3px rgba(0,0,0,0.10);',
            '}',

            /* ── message bubble row ── */
            '.oc-row{',
            '  display:flex;position:relative;z-index:1;',
            '  padding:1px 8px;',
            '}',
            '.oc-row.sent{ justify-content:flex-end; }',
            '.oc-row.recv{ justify-content:flex-start; }',

            /* ── bubble ── */
            '.oc-bubble{',
            '  max-width:78%;min-width:60px;',
            '  padding:7px 12px 20px;',
            '  border-radius:10px;',
            '  font-size:0.88rem;line-height:1.45;',
            '  word-break:break-word;',
            '  position:relative;',
            '  box-shadow:0 1px 3px rgba(0,0,0,0.12);',
            '  cursor:default;',
            '  user-select:text;',
            '  -webkit-user-select:text;',
            '}',
            '.oc-row.sent .oc-bubble{',
            '  background:#DCF8C6;color:#111;',
            '  border-bottom-right-radius:2px;',
            '}',
            '.oc-row.recv .oc-bubble{',
            '  background:#fff;color:#111;',
            '  border-bottom-left-radius:2px;',
            '}',

            /* ── tail on bubble ── */
            '.oc-row.sent .oc-bubble::after{',
            '  content:"";position:absolute;bottom:0;right:-7px;',
            '  width:0;height:0;',
            '  border-left:8px solid #DCF8C6;',
            '  border-bottom:8px solid transparent;',
            '}',
            '.oc-row.recv .oc-bubble::before{',
            '  content:"";position:absolute;bottom:0;left:-7px;',
            '  width:0;height:0;',
            '  border-right:8px solid #fff;',
            '  border-bottom:8px solid transparent;',
            '}',

            /* ── timestamp inside bubble ── */
            '.oc-ts{',
            '  position:absolute;bottom:4px;right:8px;',
            '  font-size:0.62rem;color:#6B7280;',
            '  display:flex;align-items:center;gap:3px;white-space:nowrap;',
            '}',
            /* sent double-tick */
            '.oc-row.sent .oc-ts::after{',
            '  content:"✓✓";font-size:0.65rem;color:#34B7F1;',
            '}',

            /* ── emoji reactions on bubble ── */
            '.oc-reactions{',
            '  position:absolute;bottom:-12px;',
            '  display:flex;gap:2px;',
            '  background:#fff;border-radius:20px;',
            '  padding:2px 6px;',
            '  box-shadow:0 2px 8px rgba(0,0,0,0.15);',
            '  font-size:0.80rem;',
            '  z-index:2;',
            '}',
            '.oc-row.sent .oc-reactions{ right:8px; }',
            '.oc-row.recv .oc-reactions{ left:8px; }',

            /* ── reaction bar popup (long press) ── */
            '#oc-emoji-bar{',
            '  position:fixed;',
            '  background:#fff;',
            '  border-radius:28px;',
            '  padding:8px 12px;',
            '  display:none;align-items:center;gap:6px;',
            '  box-shadow:0 8px 30px rgba(0,0,0,0.20);',
            '  z-index:99999;',
            '  transform:translateY(-8px);',
            '  transition:transform 0.18s,opacity 0.18s;',
            '  opacity:0;',
            '}',
            '#oc-emoji-bar.visible{ display:flex;transform:translateY(0);opacity:1; }',
            '.oc-emoji-opt{',
            '  font-size:1.6rem;cursor:pointer;',
            '  transition:transform 0.15s;',
            '  user-select:none;',
            '}',
            '.oc-emoji-opt:hover{ transform:scale(1.35); }',
            '.oc-emoji-close{',
            '  font-size:1.1rem;cursor:pointer;color:#6B7280;',
            '  width:28px;height:28px;',
            '  display:flex;align-items:center;justify-content:center;',
            '  border-radius:50%;background:#f3f4f6;',
            '}',

            /* ── composer bar ── */
            '#oc-composer{',
            '  display:flex;align-items:flex-end;gap:8px;',
            '  padding:8px 10px;',
            '  padding-bottom:calc(8px + env(safe-area-inset-bottom,0px));',
            '  background:#f0f2f5;',
            '  border-top:1px solid rgba(10,14,39,0.08);',
            '  flex-shrink:0;',
            '  position:relative;z-index:10;',
            '}',
            '.oc-composer-inner{',
            '  flex:1;min-width:0;',
            '  display:flex;align-items:flex-end;',
            '  background:#fff;border-radius:24px;',
            '  border:1px solid rgba(10,14,39,0.10);',
            '  padding:6px 10px;gap:8px;',
            '}',
            '#oc-emoji-btn,#oc-attach-btn{',
            '  background:none;border:none;cursor:pointer;padding:4px;',
            '  color:#6B7280;display:flex;align-items:center;',
            '  flex-shrink:0;',
            '}',
            '#oc-emoji-btn svg,#oc-attach-btn svg{ width:22px;height:22px;fill:#6B7280; }',
            '#oc-text-input{',
            '  flex:1;min-width:0;border:none;outline:none;',
            '  resize:none;background:transparent;',
            '  font-size:0.92rem;line-height:1.4;',
            '  max-height:120px;overflow-y:auto;',
            '  padding:2px 0;font-family:inherit;',
            '  color:#111;',
            '}',
            '#oc-text-input::placeholder{ color:#9CA3AF; }',
            '#oc-send-btn,#oc-mic-btn{',
            '  width:44px;height:44px;min-width:44px;min-height:44px;',
            '  border-radius:50%;border:none;cursor:pointer;',
            '  background:#1B2B8B;color:#fff;',
            '  display:flex!important;align-items:center;justify-content:center;',
            '  flex-shrink:0;',
            '  box-shadow:0 2px 8px rgba(27,43,139,0.30);',
            '  transition:background 0.15s,transform 0.12s;',
            '}',
            '#oc-send-btn:hover,#oc-mic-btn:hover{ background:#2d45c8; }',
            '#oc-send-btn:active,#oc-mic-btn:active{ transform:scale(0.92); }',
            '#oc-send-btn svg,#oc-mic-btn svg{ width:20px;height:20px;fill:#fff; }',
            /* hidden file input */
            '#oc-file-input{ display:none; }',

            /* ── loading spinner inside messages body ── */
            '#oc-loading{',
            '  text-align:center;padding:32px;color:#9CA3AF;font-size:0.85rem;',
            '}',

            /* ── MOBILE: chat panel goes full-screen ── */
            '@media(max-width:699px){',
            '  .contact-list{flex:1;min-width:0;max-width:none;}',
            '  #chat-view-container{',
            '    display:none!important;',
            '    position:fixed!important;',
            '    top:0!important;left:0!important;right:0!important;bottom:0!important;',
            '    z-index:99999!important;',
            '    flex-direction:column!important;',
            '    height:100%!important;height:100dvh!important;',
            '    width:100%!important;',
            '    background:#f0f2f5!important;',
            '    overflow:hidden!important;',
            '  }',
            '  #chat-view-container.oc-mobile-open{display:flex!important;}',
            '  #chat-placeholder{display:none!important;}',
            '  #messages-view{height:calc(100dvh - 60px)!important;}',
            '  /* Ensure messages body fills remaining space and is scrollable */',
            '  #chat-view-container.oc-mobile-open #oc-messages-body{',
            '    flex:1!important;',
            '    overflow-y:scroll!important;',
            '    -webkit-overflow-scrolling:touch!important;',
            '    min-height:0!important;',
            '  }',
            '  /* Composer sticks to bottom */',
            '  #chat-view-container.oc-mobile-open #oc-composer{',
            '    flex-shrink:0!important;',
            '    position:relative!important;',
            '    bottom:0!important;',
            '    width:100%!important;',
            '  }',
            '}',

            /* ── WIDTH-INDEPENDENT: once .oc-mobile-open is applied, the fixed
               full-screen takeover always wins, regardless of what width the
               browser reports (rotation, OS zoom/DPI, "desktop site" mode).
               This is what actually stops the desktop two-column layout from
               bleeding through and causing page overflow on a phone. ── */
            '#chat-view-container.oc-mobile-open{',
            '  display:flex!important;',
            '  position:fixed!important;',
            '  top:0!important;left:0!important;right:0!important;bottom:0!important;',
            '  z-index:99999!important;',
            '  flex-direction:column!important;',
            '  height:100%!important;height:100dvh!important;',
            '  width:100%!important;',
            '  background:#f0f2f5!important;',
            '  overflow:hidden!important;',
            '}',
            'body.oc-chat-open{ overflow:hidden!important; position:fixed!important; width:100%!important; height:100%!important; }',
            'body.oc-chat-open .stories-bar,',
            'body.oc-chat-open .status-bar,',
            'body.oc-chat-open .status-row,',
            'body.oc-chat-open .stories-row,',
            'body.oc-chat-open .status-avatars,',
            'body.oc-chat-open .story-avatars,',
            'body.oc-chat-open [class*="status-scroll"],',
            'body.oc-chat-open [class*="stories"],',
            'body.oc-in-messages .stories-bar,',
            'body.oc-in-messages .status-bar,',
            'body.oc-in-messages .status-row,',
            'body.oc-in-messages .stories-row,',
            'body.oc-in-messages .status-avatars,',
            'body.oc-in-messages .story-avatars,',
            'body.oc-in-messages [class*="status-scroll"],',
            'body.oc-in-messages [class*="stories"]{display:none!important;}',
            /* Also hide when the messages section itself is shown (even before a chat is opened) */
            '#messages-view .stories-bar,',
            '#messages-view .status-bar,',
            '#messages-view .status-row,',
            '#messages-view .stories-row,',
            '#messages-view .status-avatars,',
            '#messages-view .story-avatars,',
            '#messages-view [class*="status-scroll"],',
            '#messages-view [id*="status"],',
            '#messages-view [id*="stories"]{display:none!important;}',
            /* Hide app navigation elements when chat is open full-screen */
            'body.oc-chat-open #nav-bar,',
            'body.oc-chat-open .nav-bar,',
            'body.oc-chat-open .bottom-nav,',
            'body.oc-chat-open .app-nav,',
            'body.oc-chat-open nav,',
            'body.oc-chat-open .main-header,',
            'body.oc-chat-open header,',
            'body.oc-chat-open #main-nav,',
            'body.oc-chat-open .sidebar,',
            /* Also hide the "← Messages" section title bar that sits above our blue header */
            'body.oc-chat-open #messages-view > p,',
            'body.oc-chat-open #messages-view > h1,',
            'body.oc-chat-open #messages-view > h2,',
            'body.oc-chat-open #messages-view > h3,',
            'body.oc-chat-open #messages-view > .section-header,',
            'body.oc-chat-open #messages-view > .page-header,',
            'body.oc-chat-open #messages-view > [class*="section-title"],',
            'body.oc-chat-open #messages-view > [class*="page-title"],',
            'body.oc-chat-open #messages-view > [class*="header"]:not(#oc-chat-header):not(#oc-cl-header){display:none!important;}',

            /* ── DESKTOP: both panels side by side ──
               IMPORTANT: this must never win against the mobile full-screen
               takeover (#chat-view-container.oc-mobile-open, position:fixed,
               set above in the max-width:699px block). If a phone ever
               reports a >=700px layout viewport (rotation, OS-level zoom/
               DPI scaling, "desktop site" mode), this rule used to force
               display:flex on the BARE selector and stomp the fixed overlay,
               causing the two-column desktop chrome to bleed through and the
               page to overflow. Scoping to :not(.oc-mobile-open) makes the
               two states mutually exclusive regardless of viewport quirks. */
            '@media(min-width:700px){',
            '  #chat-view-container:not(.oc-mobile-open){ display:flex!important; }',
            '}',


            /* (Legacy nth-of-type CSS hacks removed — replaced by a runtime
               sweep in _buildChatView that finds and removes any stray call/
               video icon button that isn't one of ours. CSS positional
               selectors broke every time the header's child order changed.) */

            /* FIX-3: lightbox for image messages */
            '#oc-lightbox{',
            '  position:fixed;inset:0;z-index:9999999;',
            '  background:rgba(0,0,0,0.92);',
            '  display:flex;align-items:center;justify-content:center;',
            '  cursor:zoom-out;',
            '}',
            '#oc-lightbox img{',
            '  max-width:96vw;max-height:90vh;',
            '  border-radius:8px;',
            '  box-shadow:0 8px 40px rgba(0,0,0,0.6);',
            '  object-fit:contain;',
            '}',
            '#oc-lightbox-close{',
            '  position:absolute;top:16px;right:16px;',
            '  background:rgba(255,255,255,0.15);border:none;color:#fff;',
            '  width:36px;height:36px;border-radius:50%;cursor:pointer;',
            '  font-size:1.2rem;display:flex;align-items:center;justify-content:center;',
            '}',
            '.oc-bubble img{ cursor:zoom-in; }',

            /* FIX-4: ALWAYS hide status icons strip inside messages-view — no class condition needed */
            '#messages-view #status-bar-container,',
            '#messages-view #status-bar-inner,',
            '#messages-view .status-bar,',
            '#messages-view .status-row,',
            '#messages-view .stories-bar,',
            '#messages-view .stories-row,',
            '#messages-view .stories-container,',
            '#messages-view #stories-row,',
            '#messages-view [id*="status-bar"],',
            '#messages-view [class*="status-bar"]{display:none!important;}',
            /* Also hide via body class as belt-and-suspenders */
            'body.oc-in-messages #status-bar-container,',
            'body.oc-in-messages #status-bar-inner,',
            'body.oc-in-messages .status-scroll,',
            'body.oc-in-messages .stories-container,',
            'body.oc-in-messages #stories-row{display:none!important;}',
            '#messages-view > div:first-child[class*="status"],',
            '#messages-view > div:first-child[class*="stor"]{display:none!important;}',

            /* FIX-5: 3-dot dropdown menu */
            '#oc-more-menu{',
            '  position:absolute;top:52px;right:8px;',
            '  background:#fff;border-radius:8px;',
            '  box-shadow:0 4px 24px rgba(0,0,0,0.18);',
            '  z-index:99999;min-width:180px;',
            '  overflow:hidden;',
            '  animation:oc-menu-in 0.15s ease;',
            '}',
            '@keyframes oc-menu-in{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}',
            '.oc-menu-item{',
            '  padding:13px 18px;font-size:0.88rem;color:#111;',
            '  cursor:pointer;white-space:nowrap;',
            '  transition:background 0.12s;',
            '}',
            '.oc-menu-item:hover{background:#f3f4f6;}',
            '.oc-menu-item + .oc-menu-item{border-top:1px solid rgba(0,0,0,0.05);}',

            /* FIX-8: full emoji panel */
            '#oc-emoji-panel{',
            '  position:absolute;bottom:68px;left:0;right:0;',
            '  background:#fff;',
            '  border-radius:16px 16px 0 0;',
            '  box-shadow:0 -4px 24px rgba(0,0,0,0.15);',
            '  z-index:9999;',
            '  display:flex;flex-direction:column;',
            '  max-height:320px;',
            '  overflow:hidden;',
            '}',
            '.oc-emoji-cats{',
            '  display:flex;',
            '  border-bottom:1px solid #e5e7eb;',
            '  overflow-x:auto;flex-shrink:0;',
            '  scrollbar-width:none;',
            '}',
            '.oc-emoji-cats::-webkit-scrollbar{display:none;}',
            '.oc-emoji-cat-btn{',
            '  flex-shrink:0;border:none;background:none;cursor:pointer;',
            '  padding:8px 12px;font-size:1.3rem;',
            '  border-bottom:2px solid transparent;',
            '  transition:border-color 0.15s;',
            '}',
            '.oc-emoji-cat-btn.active{border-bottom-color:#1B2B8B;}',
            '.oc-emoji-search{',
            '  padding:6px 10px;border:none;outline:none;',
            '  border-bottom:1px solid #e5e7eb;',
            '  font-size:0.85rem;flex-shrink:0;',
            '}',
            '.oc-emoji-grid{',
            '  display:flex;flex-wrap:wrap;gap:2px;',
            '  overflow-y:auto;padding:8px;',
            '  flex:1;',
            '}',
            '.oc-emoji-grid span{',
            '  font-size:1.5rem;cursor:pointer;width:36px;height:36px;',
            '  display:flex;align-items:center;justify-content:center;',
            '  border-radius:8px;',
            '  transition:background 0.12s;',
            '}',
            '.oc-emoji-grid span:hover{background:#f3f4f6;}',

            /* FIX-4: chat panel fully covers screen including browser chrome */
            /* FIX (bug: "voice/video calls and emojis don't work inside the
               chat box — only seem to fire after tapping X, and then render
               OVER the contact list"): this block used to also declare
               z-index:2147483647!important here, on the SAME selector as the
               z-index:99999!important rule above. Equal specificity + equal
               !important means the LAST declared rule wins on mobile, so the
               open chat panel was actually painting at the absolute max
               z-index — higher than #oc-call-modal (999999), the bubble
               long-press emoji sheet/overlay (9999998/9999999), and the
               lightbox/media panel (9999998/9999999). Those elements were
               still being created correctly when their buttons were tapped,
               but they rendered UNDERNEATH the opaque chat panel, so nothing
               appeared to happen. The instant X was tapped, .oc-mobile-open
               was removed, the chat panel's inflated z-index went away, and
               whatever had silently opened became visible — now floating
               over the contact list instead of the chat.
               FIX: drop the z-index override here entirely. The earlier
               z-index:99999!important rule (already more than enough to
               cover the rest of the app/nav bar, which was this block's
               original purpose) now applies uncontested, restoring the
               correct stacking order: chat panel < call modal < emoji /
               lightbox overlays. */
            '@media(max-width:699px){',
            '  body.oc-chat-open{ overflow:hidden!important; }',
            '  #chat-view-container.oc-mobile-open{',
            '    position:fixed!important;',
            '    top:0!important;left:0!important;right:0!important;bottom:0!important;',
            '    height:100%!important;height:100dvh!important;',
            '    width:100vw!important;',
            '    display:flex!important;flex-direction:column!important;',
            '    background:#f0f2f5!important;',
            '  }',
            '}',
            /* Hide status bar ONLY inside messages section + when chat is open */
            '#messages-view #status-bar-container,',
            '#messages-view #status-bar-inner,',
            'body.oc-chat-open #status-bar-container,',
            'body.oc-chat-open #status-bar-inner,',
            'body.oc-in-messages #status-bar-container,',
            'body.oc-in-messages #status-bar-inner{display:none!important;}',

            /* Pull the contact avatar scroll row (Akhigbe, Williams…) to the top of messages-view */
            '#messages-view .contact-list{margin-top:0!important;padding-top:0!important;}',

            /* Hide the app's native "← Messages" back link when our chat is open full-screen */
            'body.oc-chat-open .messages-back,',
            'body.oc-chat-open [class*="messages-back"],',
            'body.oc-chat-open .chat-back,',
            'body.oc-chat-open [class*="chat-back"],',
            'body.oc-chat-open #messages-back,',
            /* Hide ANY ← arrow / back link sitting directly above our blue header */
            'body.oc-chat-open #messages-view > a,',
            'body.oc-chat-open #messages-view > .back-link,',
            'body.oc-chat-open #messages-view > [class*="back"]{display:none!important;}',
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    }


    /* =========================================================================
       §2  EMOJI REACTION BAR (long-press)
       ========================================================================= */
    var _emojiBar   = null;
    var _emojiTarget = null; /* { msgId, row } */
    var _emojiBarCloseListener = null; /* FIX: tracks the single active outside-tap listener so repeated _showEmojiBar() calls can never stack capture-phase listeners on document */
    var _longPressTimer = null;
    var EMOJIS = ['👍','❤️','😂','😮','😢','🙏'];

    function _buildEmojiBar() {
        if (document.getElementById('oc-emoji-bar')) return;
        var bar = document.createElement('div');
        bar.id = 'oc-emoji-bar';
        EMOJIS.forEach(function(em) {
            var span = document.createElement('span');
            span.className = 'oc-emoji-opt';
            span.textContent = em;
            span.addEventListener('click', function() { _sendReaction(em); });
            bar.appendChild(span);
        });
        /* close button */
        var close = document.createElement('span');
        close.className = 'oc-emoji-close';
        close.innerHTML = '&#x2715;';
        close.addEventListener('click', _hideEmojiBar);
        bar.appendChild(close);
        document.body.appendChild(bar);
        _emojiBar = bar;
    }

    function _showEmojiBar(row, msgId, x, y) {
        _buildEmojiBar();
        _emojiTarget = { msgId: msgId, row: row };
        var bar = document.getElementById('oc-emoji-bar');
        /* Position above the tap point */
        var barW = 320, barH = 56;
        var left = Math.max(8, Math.min(x - barW/2, window.innerWidth - barW - 8));
        var top  = Math.max(8, y - barH - 12);
        bar.style.left = left + 'px';
        bar.style.top  = top  + 'px';
        bar.classList.add('visible');
        /* FIX-6: ensure target row is visible */
        if (_emojiTarget && _emojiTarget.row) { _emojiTarget.row.style.opacity = '1'; _emojiTarget.row.style.display = ''; }
        /* FIX-6: close on outside tap — use 400 ms delay so touch-end doesn't immediately close.
           FIX (compounding bug): every call to _showEmojiBar used to add a
           NEW capture-phase 'click' listener on document without ever
           removing a previous one that might still be active (e.g. if the
           bar was shown again before the prior listener had fired and
           self-removed). These run before ANY other click handler on the
           page, including the header's video/call buttons — over a
           session with repeated long-presses, they could accumulate,
           adding overhead to every single click and increasing the risk of
           one of them swallowing a tap meant for something else. FIX:
           track the single active listener at module scope and always
           remove it first, so there is never more than one at a time. */
        if (_emojiBarCloseListener) {
            document.removeEventListener('click', _emojiBarCloseListener, true);
            _emojiBarCloseListener = null;
        }
        setTimeout(function() {
            _emojiBarCloseListener = function _closeBar(e) {
                /* Don't close if the click was on an emoji option */
                if (e.target && e.target.classList && e.target.classList.contains('oc-emoji-opt')) return;
                _hideEmojiBar();
                document.removeEventListener('click', _emojiBarCloseListener, true);
                _emojiBarCloseListener = null;
            };
            document.addEventListener('click', _emojiBarCloseListener, { capture: true });
        }, 400);
    }

    function _hideEmojiBar() {
        var bar = document.getElementById('oc-emoji-bar');
        if (bar) bar.classList.remove('visible');
        _emojiTarget = null;
    }

    function _sendReaction(emoji) {
        /* FIX-7: if composer is focused, insert into text instead of reacting */
        var inp = document.getElementById('oc-text-input');
        if (inp && document.activeElement === inp) {
            var pos = inp.selectionStart || inp.value.length;
            inp.value = inp.value.slice(0, pos) + emoji + inp.value.slice(pos);
            inp.dispatchEvent(new Event('input'));
            inp.focus();
            _hideEmojiBar();
            return;
        }
        _hideEmojiBar();
        if (!_emojiTarget) return;
        var msgId = _emojiTarget.msgId;
        var row   = _emojiTarget.row;
        /* Optimistic render */
        _renderReaction(row, emoji);
        /* Firestore persist */
        if (_fbOk() && msgId) {
            var u = _us();
            try {
                window.fbDb.collection('messages').doc(msgId).update({
                    ['reactions.' + (u.id||'anon')]: emoji
                }).catch(function(){});
            } catch(e){}
        }
    }

    function _renderReaction(row, emoji) {
        var existing = row.querySelector('.oc-reactions');
        if (!existing) {
            existing = document.createElement('div');
            existing.className = 'oc-reactions';
            var bubble = row.querySelector('.oc-bubble');
            if (bubble) bubble.appendChild(existing);
        }
        /* Show reaction count-style badge */
        var found = false;
        existing.querySelectorAll('.oc-rx-item').forEach(function(el) {
            if (el.dataset.em === emoji) {
                var cnt = parseInt(el.dataset.count||'1',10) + 1;
                el.dataset.count = cnt;
                el.textContent = emoji + (cnt > 1 ? ' '+cnt : '');
                found = true;
            }
        });
        if (!found) {
            var item = document.createElement('span');
            item.className = 'oc-rx-item';
            item.dataset.em = emoji;
            item.dataset.count = '1';
            item.textContent = emoji;
            existing.appendChild(item);
        }
    }


    /* =========================================================================
       FIX (bug: "voice/video calls and emojis respond outside the chat box,
       after exit") — second half of the fix.
       -------------------------------------------------------------------------
       Even with the z-index conflict above corrected, there's still a path
       to the same symptom: if the user taps X WHILE the bubble emoji
       catalog (or the composer's full emoji panel, or the quick-react bar,
       or the 3-dot menu) happens to be open, none of those elements were
       ever torn down by _doCloseChat() — they live independently of
       #chat-view-container. Closing the chat would leave them floating on
       top of the now-visible contact list. This single helper removes all
       of them; it's called from _doCloseChat() below, every time the chat
       closes, so nothing from the chat box can ever survive past exit.
       NOTE: #oc-call-modal is deliberately NOT included here — an in-progress
       call is meant to keep running after the chat panel closes (same as a
       phone call surviving you backgrounding the app), and it already has
       its own correct teardown in _rtcHangup().
       ========================================================================= */
    function _closeFloatingChatUI() {
        var ids = ['oc-bubble-emoji-sheet', 'oc-sheet-overlay', 'oc-emoji-panel', 'oc-more-menu'];
        ids.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
        _hideEmojiBar();
    }

    /* =========================================================================
       FIX-5  BUBBLE LONG-PRESS EMOJI CATALOG (slide-up bottom sheet)
       ========================================================================= */
    function _showBubbleEmojiCatalog(row, msgId) {
        /* FIX (bug: "nothing responds to clicks until X is pressed"): this
           only ever removed a stale #oc-bubble-emoji-sheet here — it never
           removed a stale #oc-sheet-overlay. The overlay is a
           position:fixed;inset:0 element at z-index:9999998, covering the
           ENTIRE chat (including the header's video/call buttons and every
           message bubble). If a previous catalog open didn't get fully
           torn down (e.g. a new long-press fired while the previous
           sheet's 50ms close-delay was still pending), a stray overlay
           could outlive its sheet and silently sit on top of everything,
           swallowing every tap meant for a real button underneath it.
           FIX: remove BOTH stale elements here, unconditionally, every
           time the catalog is about to open. */
        var old = document.getElementById('oc-bubble-emoji-sheet');
        if (old) old.remove();
        var oldOv = document.getElementById('oc-sheet-overlay');
        if (oldOv) oldOv.remove();

        /* Keep the row visible */
        row.style.opacity = '1';

        var sheet = document.createElement('div');
        sheet.id = 'oc-bubble-emoji-sheet';
        sheet.style.cssText = [
            'position:fixed;bottom:0;left:0;right:0;',
            'z-index:9999999;',
            'background:#fff;',
            'border-radius:20px 20px 0 0;',
            'box-shadow:0 -4px 30px rgba(0,0,0,0.22);',
            'display:flex;flex-direction:column;',
            'max-height:55vh;',
            'animation:oc-sheet-up 0.22s ease;',
        ].join('');

        /* Inject animation once */
        if (!document.getElementById('oc-sheet-anim')) {
            var st = document.createElement('style');
            st.id = 'oc-sheet-anim';
            st.textContent = '@keyframes oc-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}';
            document.head.appendChild(st);
        }

        /* Quick-react row at the top */
        var quickRow = document.createElement('div');
        quickRow.style.cssText = 'display:flex;align-items:center;justify-content:space-around;padding:14px 10px 8px;border-bottom:1px solid #e5e7eb;flex-shrink:0;';
        var QUICK = ['👍','❤️','😂','😮','😢','🙏','🔥','👏'];
        QUICK.forEach(function(em) {
            var sp = document.createElement('span');
            sp.textContent = em;
            sp.style.cssText = 'font-size:1.8rem;cursor:pointer;transition:transform 0.1s;padding:4px;';
            sp.addEventListener('touchstart', function(){ sp.style.transform='scale(1.3)'; }, { passive:true });
            sp.addEventListener('touchend',   function(){ sp.style.transform='scale(1)'; },  { passive:true });
            sp.addEventListener('click', function(e) {
                e.stopPropagation();
                sheet.remove();
                _renderReaction(row, em);
                /* Persist to Firestore */
                if (_fbOk() && msgId) {
                    var u = _us();
                    try { window.fbDb.collection('messages').doc(msgId)
                        .update({ ['reactions.' + (u.id||'anon')]: em }).catch(function(){}); } catch(e){}
                }
            });
            quickRow.appendChild(sp);
        });
        sheet.appendChild(quickRow);

        /* Category tabs */
        var cats = document.createElement('div');
        cats.style.cssText = 'display:flex;overflow-x:auto;border-bottom:1px solid #e5e7eb;flex-shrink:0;scrollbar-width:none;';

        /* Search */
        var searchRow = document.createElement('div');
        searchRow.style.cssText = 'padding:6px 10px;flex-shrink:0;';
        var searchInp = document.createElement('input');
        searchInp.placeholder = '🔍 Search emoji…';
        searchInp.style.cssText = 'width:100%;padding:6px 10px;border:1px solid #e5e7eb;border-radius:20px;font-size:0.85rem;outline:none;box-sizing:border-box;';

        /* Grid */
        var grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;overflow-y:auto;padding:8px;flex:1;';

        var _CATS = {
            '😊': ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','😵','🤠','🥸','😷','🤒','🤕','🤢','🤮','🤧','🥴','😇','🤡'],
            '👋': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','💅','🤳','✍️'],
            '❤️': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','❤️‍🔥','❤️‍🩹'],
            '🐶': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🦖','🦕','🐙','🐠','🐟','🐬','🐳','🦈','🦊','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿','🦔'],
            '🍎': ['🍎','🍊','🍋','🍇','🍓','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🌶','🥒','🧅','🧄','🍞','🥐','🥖','🧀','🥚','🍳','🥞','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯','🍱','🍣','🍤','🍜','🍝','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','☕','🧃','🥤','🧋','🍺','🥂','🍷','🍸','🍹'],
            '⚽': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🎱','🏓','🏸','⛳','🎣','🥊','🥋','🎽','🛹','⛸','🥌','🎿','🏆','🥇','🥈','🥉','🏅','🎖','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🎷','🎺','🎸','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'],
            '✈️': ['🚗','🚕','🚙','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🚲','🛴','⛵','🚤','🛳','✈️','🛩','🛫','🛬','🚁','🚀','🛸','🌍','🌎','🌏','🗺','🏔','⛰','🌋','🏕','🏖','🏜','🏝','🏠','🏡','🏢','🏣','🏦','🏨','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🕍','⛩','🕋'],
            '💡': ['⌚','📱','💻','⌨️','🖥','🖨','🖱','💾','💿','📷','📸','📹','🎥','📞','☎️','📺','📻','🔋','🔌','💡','🔦','🕯','💰','💳','💹','📈','📉','📊','📋','📌','📍','✂️','🔐','🔑','🗝','🔨','🪓','⚒','🛠','🔧','🔩','⚙️','🔭','🔬','💊','💉','🩺','🛋','🚿','🛁'],
            '🔣': ['❤️','✅','❎','🔴','🟠','🟡','🟢','🔵','🟣','🔺','🔻','💠','💯','🆗','🆙','🆒','🆕','🆓','🔞','📵','🚫','⭕','❌','❓','❔','❕','❗','💤','🔅','🔆','🔱','♻️','💢','💥','💫','💦','💨','⬛','⬜','▪️','▫️','🔷','🔶','🔹','🔸']
        };
        var catKeys = Object.keys(_CATS);
        var _curCat = catKeys[0];

        function _renderGrid(catKey) {
            grid.innerHTML = '';
            var emojis = _CATS[catKey] || [];
            emojis.forEach(function(em) {
                var sp = document.createElement('span');
                sp.textContent = em;
                sp.style.cssText = 'font-size:1.5rem;cursor:pointer;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:background 0.1s;';
                sp.addEventListener('touchstart', function(){ sp.style.background='#f3f4f6'; }, { passive:true });
                sp.addEventListener('touchend',   function(){ sp.style.background=''; }, { passive:true });
                sp.addEventListener('click', function(e) {
                    e.stopPropagation();
                    /* Apply emoji: react to bubble */
                    sheet.remove();
                    _renderReaction(row, em);
                    if (_fbOk() && msgId) {
                        var u = _us();
                        try { window.fbDb.collection('messages').doc(msgId)
                            .update({ ['reactions.' + (u.id||'anon')]: em }).catch(function(){}); } catch(e){}
                    }
                    /* Also insert into text input if it has focus */
                    var inp = document.getElementById('oc-text-input');
                    if (inp && document.activeElement === inp) {
                        var pos = inp.selectionStart || inp.value.length;
                        inp.value = inp.value.slice(0,pos) + em + inp.value.slice(pos);
                        inp.dispatchEvent(new Event('input'));
                    }
                });
                grid.appendChild(sp);
            });
        }

        catKeys.forEach(function(key) {
            var btn = document.createElement('button');
            btn.style.cssText = 'flex-shrink:0;border:none;background:none;cursor:pointer;padding:8px 12px;font-size:1.3rem;border-bottom:2px solid transparent;transition:border-color 0.15s;';
            btn.textContent = key;
            btn.title = key;
            if (key === _curCat) btn.style.borderBottomColor = '#1B2B8B';
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                cats.querySelectorAll('button').forEach(function(b){ b.style.borderBottomColor='transparent'; });
                btn.style.borderBottomColor = '#1B2B8B';
                _curCat = key;
                searchInp.value = '';
                _renderGrid(key);
            });
            cats.appendChild(btn);
        });

        searchInp.addEventListener('input', function(e) {
            e.stopPropagation();
            var kw = searchInp.value.toLowerCase().trim();
            if (!kw) { _renderGrid(_curCat); return; }
            grid.innerHTML = '';
            catKeys.forEach(function(key) {
                (_CATS[key] || []).forEach(function(em) {
                    var sp = document.createElement('span');
                    sp.textContent = em;
                    sp.style.cssText = 'font-size:1.5rem;cursor:pointer;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:8px;';
                    sp.addEventListener('click', function(evt) {
                        evt.stopPropagation();
                        sheet.remove();
                        _renderReaction(row, em);
                        if (_fbOk() && msgId) {
                            var u = _us();
                            try { window.fbDb.collection('messages').doc(msgId)
                                .update({ ['reactions.' + (u.id||'anon')]: em }).catch(function(){}); } catch(e){}
                        }
                    });
                    grid.appendChild(sp);
                });
            });
        });

        /* Handle outside tap — close sheet */
        var _sheetOverlay = document.createElement('div');
        _sheetOverlay.id = 'oc-sheet-overlay';
        _sheetOverlay.style.cssText = 'position:fixed;inset:0;z-index:9999998;background:rgba(0,0,0,0.3);';

        /* Central close: always removes BOTH sheet and overlay */
        function _closeSheet() {
            var ov = document.getElementById('oc-sheet-overlay');
            if (ov) ov.remove();
            var sh = document.getElementById('oc-bubble-emoji-sheet');
            if (sh) sh.remove();
        }

        _sheetOverlay.addEventListener('click', _closeSheet);

        /* Patch every quick-react span click to also close overlay */
        quickRow.querySelectorAll('span').forEach(function(sp) {
            sp.addEventListener('click', function() { setTimeout(_closeSheet, 50); });
        });

        /* Patch grid emoji clicks — wrap _renderGrid to close after pick */
        var _origRenderGrid = _renderGrid;
        _renderGrid = function(catKey) {
            _origRenderGrid(catKey);
            grid.querySelectorAll('span').forEach(function(sp) {
                sp.addEventListener('click', function() { setTimeout(_closeSheet, 50); });
            });
        };
        /* Re-patch search results too */
        searchInp.addEventListener('input', function() {
            setTimeout(function() {
                grid.querySelectorAll('span').forEach(function(sp) {
                    sp.addEventListener('click', function() { setTimeout(_closeSheet, 50); });
                });
            }, 80);
        });

        searchRow.appendChild(searchInp);
        sheet.appendChild(quickRow);
        sheet.appendChild(cats);
        sheet.appendChild(searchRow);
        sheet.appendChild(grid);

        document.body.appendChild(_sheetOverlay);
        document.body.appendChild(sheet);

        _renderGrid(_curCat);
    }

    function _attachLongPress(row, msgId) {
        var _startX, _startY;

        function _onStart(e) {
            var pt = e.touches ? e.touches[0] : e;
            _startX = pt.clientX; _startY = pt.clientY;
            _longPressTimer = setTimeout(function() {
                /* FIX-5: long-press opens FULL emoji catalog panel */
                _emojiTarget = { msgId: msgId, row: row };
                _showBubbleEmojiCatalog(row, msgId);
            }, 480);
        }
        function _onEnd()  { clearTimeout(_longPressTimer); }
        function _onMove(e) {
            var pt = e.touches ? e.touches[0] : e;
            if (Math.abs(pt.clientX - _startX) > 10 || Math.abs(pt.clientY - _startY) > 10) {
                clearTimeout(_longPressTimer);
            }
        }

        row.addEventListener('touchstart',  _onStart, { passive: true });
        row.addEventListener('touchend',    _onEnd,   { passive: true });
        row.addEventListener('touchcancel', _onEnd,   { passive: true });
        row.addEventListener('touchmove',   _onMove,  { passive: true });
        /* Desktop: right-click still shows quick bar */
        row.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            _showEmojiBar(row, msgId, e.clientX, e.clientY);
        });
    }


    /* =========================================================================
       §3  BUILD CHAT BUBBLE
       ========================================================================= */
    function _buildBubble(data, myId) {
        var isSent = (data.senderId === myId);
        var row = document.createElement('div');
        row.className = 'oc-row ' + (isSent ? 'sent' : 'recv');
        row.dataset.msgId = data.id || data.msgId || '';

        var bubble = document.createElement('div');
        bubble.className = 'oc-bubble';

        /* Content */
        if (data.mediaUrl) {
            var media;
            var mt = (data.mediaType || '');
            if (mt.startsWith('image/')) {
                media = document.createElement('img');
                media.src = data.mediaUrl;
                media.style.cssText = 'max-width:100%;border-radius:8px;margin-bottom:4px;display:block;cursor:zoom-in;';
                (function(src){ media.addEventListener('click', function(){ _openLightbox(src); }); })(data.mediaUrl);
                bubble.appendChild(media);
            } else if (mt.startsWith('video/')) {
                media = document.createElement('video');
                media.src = data.mediaUrl; media.controls = true;
                media.style.cssText = 'max-width:100%;border-radius:8px;margin-bottom:4px;display:block;';
                bubble.appendChild(media);
            } else if (mt.startsWith('audio/')) {
                /* ── WhatsApp-style voice note player ── */
                var vnWrap = document.createElement('div');
                vnWrap.style.cssText = [
                    'display:flex;align-items:center;gap:10px;',
                    'min-width:200px;max-width:100%;',
                    'padding:4px 0 18px;',
                    'position:relative;',
                ].join('');

                /* Hidden real audio element */
                var vnAudio = document.createElement('audio');
                vnAudio.src = data.mediaUrl;
                vnAudio.preload = 'metadata';
                vnAudio.style.display = 'none';
                vnWrap.appendChild(vnAudio);

                /* Play/Pause circle button */
                var vnPlay = document.createElement('button');
                vnPlay.style.cssText = [
                    'width:40px;height:40px;min-width:40px;border-radius:50%;border:none;',
                    'background:#075E54;color:#fff;cursor:pointer;',
                    'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
                    'box-shadow:0 1px 4px rgba(0,0,0,0.25);',
                ].join('');
                var _vnPlaying = false;
                vnPlay.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';

                vnPlay.addEventListener('click', function() {
                    if (_vnPlaying) {
                        vnAudio.pause();
                        _vnPlaying = false;
                        vnPlay.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
                    } else {
                        document.querySelectorAll('audio._oc_vn_active').forEach(function(a) {
                            a.pause();
                            a.classList.remove('_oc_vn_active');
                            var btn = a.parentNode && a.parentNode.querySelector('button');
                            if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
                        });
                        vnAudio.play().catch(function(){});
                        vnAudio.classList.add('_oc_vn_active');
                        _vnPlaying = true;
                        vnPlay.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
                    }
                });

                vnAudio.addEventListener('ended', function() {
                    _vnPlaying = false;
                    vnAudio.classList.remove('_oc_vn_active');
                    vnPlay.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
                    vnProgressWrap.style.width = '0%';
                });

                vnWrap.appendChild(vnPlay);

                /* Waveform + progress */
                var vnWaveWrap = document.createElement('div');
                vnWaveWrap.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;';

                var vnTrack = document.createElement('div');
                vnTrack.style.cssText = 'position:relative;height:28px;cursor:pointer;display:flex;align-items:center;';

                var barHeights = [6,10,14,18,22,16,12,8,14,20,24,18,10,6,12,16,20,14,8,10,18,22,16,12,6,10,14,20,18,12,8,16,22,14,10,6,12,18,20,16,10,8,14,18,22,16,12,6,10,14,20,18,12,8,16,22,14,10,6,12,18,20,16,10];
                var barCount = barHeights.length;
                var barW = 160 / barCount;

                function _makeBars(fillColor) {
                    var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
                    svg.setAttribute('viewBox','0 0 160 28');
                    svg.setAttribute('preserveAspectRatio','none');
                    svg.style.cssText = 'width:100%;height:28px;display:block;';
                    barHeights.forEach(function(h,i) {
                        var rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
                        rect.setAttribute('x',(i*barW+barW*0.15).toFixed(1));
                        rect.setAttribute('y',((28-h)/2).toFixed(1));
                        rect.setAttribute('width',(barW*0.7).toFixed(1));
                        rect.setAttribute('height',h);
                        rect.setAttribute('rx','2');
                        rect.setAttribute('fill',fillColor);
                        svg.appendChild(rect);
                    });
                    return svg;
                }

                /* Grey track (background) */
                var vnSvgBg = _makeBars('rgba(0,0,0,0.18)');
                vnSvgBg.style.position = 'absolute';
                vnSvgBg.style.left = '0';
                vnSvgBg.style.top = '0';
                vnTrack.appendChild(vnSvgBg);

                /* Green progress (clipped) */
                var vnProgressWrap = document.createElement('div');
                vnProgressWrap.style.cssText = 'position:absolute;left:0;top:0;height:100%;width:0%;overflow:hidden;pointer-events:none;';
                var vnSvgFg = _makeBars('#075E54');
                vnSvgFg.style.position = 'absolute';
                vnSvgFg.style.left = '0';
                vnSvgFg.style.top = '0';
                vnProgressWrap.appendChild(vnSvgFg);
                vnTrack.appendChild(vnProgressWrap);

                /* Scrub */
                vnTrack.addEventListener('click', function(e) {
                    var r = vnTrack.getBoundingClientRect();
                    var ratio = Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
                    if (vnAudio.duration) {
                        vnAudio.currentTime = ratio * vnAudio.duration;
                        vnProgressWrap.style.width = (ratio*100)+'%';
                    }
                });

                /* Duration helper */
                function _fmtDur(sec) {
                    sec = Math.round(sec||0);
                    var m = Math.floor(sec/60), s = sec%60;
                    return m+':'+(s<10?'0':'')+s;
                }

                /* Duration label */
                var vnDur = document.createElement('span');
                vnDur.style.cssText = 'font-size:0.62rem;color:#6B7280;margin-top:2px;display:block;';
                vnDur.textContent = '0:00';
                vnAudio.addEventListener('loadedmetadata', function() {
                    vnDur.textContent = _fmtDur(vnAudio.duration);
                });
                vnAudio.addEventListener('timeupdate', function() {
                    if (!vnAudio.duration) return;
                    vnProgressWrap.style.width = (vnAudio.currentTime/vnAudio.duration*100)+'%';
                    vnDur.textContent = _fmtDur(vnAudio.duration - vnAudio.currentTime);
                });

                vnWaveWrap.appendChild(vnTrack);
                vnWaveWrap.appendChild(vnDur);
                vnWrap.appendChild(vnWaveWrap);

                bubble.style.minWidth = '220px';
                bubble.style.paddingBottom = '22px';
                bubble.appendChild(vnWrap);
            }
        }

        /* FIX-1: only show text if there is no media (no filename labels) */
        if (data.text && !data.mediaUrl) {
            var p = document.createElement('p');
            p.style.margin = '0 24px 0 0';
            if (typeof window.formatWhatsAppText === 'function') {
                p.innerHTML = window.formatWhatsAppText(data.text);
            } else {
                p.textContent = data.text;
            }
            bubble.appendChild(p);
        }

        /* Timestamp */
        var ts = document.createElement('span');
        ts.className = 'oc-ts';
        ts.textContent = _fmt(data.createdAt || data.timestamp);
        bubble.appendChild(ts);

        row.appendChild(bubble);

        /* Render existing reactions */
        if (data.reactions) {
            Object.values(data.reactions).forEach(function(em) { _renderReaction(row, em); });
        }

        /* Long-press → emoji bar */
        var msgId = data.id || data.msgId || '';
        if (msgId) _attachLongPress(row, msgId);

        return row;
    }


    /* =========================================================================
       §4  DATE SEPARATOR
       ========================================================================= */
    function _dateSep(ts) {
        var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        if (!d) return null;
        var label;
        var today = new Date();
        var yest  = new Date(today); yest.setDate(yest.getDate()-1);
        if (d.toDateString() === today.toDateString()) label = 'Today';
        else if (d.toDateString() === yest.toDateString()) label = 'Yesterday';
        else label = d.toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'});
        var div = document.createElement('div');
        div.className = 'oc-date-sep';
        div.innerHTML = '<span>' + label + '</span>';
        div.dataset.date = d.toDateString();
        return div;
    }


    /* =========================================================================
       §5  FIRESTORE LISTENER STATE
       ========================================================================= */
    var _unsub   = null;   /* current Firestore listener unsubscribe fn */
    var _peerId  = '';
    var _peerName = '';
    var _peerAvatar = '';
    var _seenDates = {};
    var _closeDebounce = false;     /* shared by real button + geometric fallback (§7b) */
    var _activeCloseHandler = null; /* always points at the CURRENT _doCloseChat */
    var _chatHistoryPushed = false; /* true while a history entry is open for the back-button close (§7c) */

    function _stopListener() {
        if (_unsub) { try { _unsub(); } catch(e){} _unsub = null; }
    }

    function _buildChatId(a, b) { return [a, b].sort().join('_'); }


    /* =========================================================================
       §6b  WEBRTC ENGINE  —  Firestore signalling
       =========================================================================
       Firestore schema:
         calls/{callId}  {
           callerId, calleeId, type ('voice'|'video'),
           callerName, callerAvatar,
           offer: { type, sdp },
           answer: { type, sdp },
           status: 'ringing' | 'active' | 'ended',
           createdAt
         }
         calls/{callId}/callerCandidates/{auto}  { candidate, sdpMid, sdpMLineIndex }
         calls/{callId}/calleeCandidates/{auto}  { candidate, sdpMid, sdpMLineIndex }
       ========================================================================= */

    var _rtc = {
        pc:           null,   /* RTCPeerConnection                          */
        localStream:  null,   /* MediaStream from getUserMedia              */
        remoteStream: null,   /* MediaStream assembled from remote tracks   */
        callId:       null,   /* Firestore doc ID                           */
        role:         null,   /* 'caller' | 'callee'                        */
        unsubOffer:   null,   /* Firestore listener unsub fns               */
        unsubAnswer:  null,
        unsubCands:   null,
        dotTimer:     null,
        muted:        false,
        camOff:       false,
        speakerEl:    null,   /* <audio> element for remote voice           */
        isVideo:      false
    };

    var ICE_SERVERS = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    };

    /* ── clean up everything ─────────────────────────────── */
    function _rtcHangup(callId) {
        /* Stop timers / listeners */
        if (_rtc.dotTimer)   { clearInterval(_rtc.dotTimer);  _rtc.dotTimer  = null; }
        if (_rtc.unsubOffer) { try{_rtc.unsubOffer();}catch(e){} _rtc.unsubOffer = null; }
        if (_rtc.unsubAnswer){ try{_rtc.unsubAnswer();}catch(e){} _rtc.unsubAnswer = null; }
        if (_rtc.unsubCands) { try{_rtc.unsubCands();}catch(e){} _rtc.unsubCands = null; }

        /* Stop local media */
        if (_rtc.localStream) {
            _rtc.localStream.getTracks().forEach(function(t){ try{t.stop();}catch(e){} });
            _rtc.localStream = null;
        }

        /* Close peer connection */
        if (_rtc.pc) { try{_rtc.pc.close();}catch(e){} _rtc.pc = null; }

        /* Remove remote audio element */
        if (_rtc.speakerEl) { try{_rtc.speakerEl.srcObject=null; _rtc.speakerEl.remove();}catch(e){} _rtc.speakerEl = null; }

        /* Mark call ended in Firestore */
        var cid = callId || _rtc.callId;
        if (_fbOk() && cid) {
            try {
                window.fbDb.collection('calls').doc(cid)
                    .update({ status: 'ended' })
                    .catch(function(){});
            } catch(e){}
        }

        _rtc.callId = null;
        _rtc.role   = null;

        /* Remove modal */
        var m = document.getElementById('oc-call-modal');
        if (m) m.remove();
    }

    /* ── build the full-screen call modal ──────────────────── */
    function _buildCallModal(type, name, avatar, callId) {
        var existing = document.getElementById('oc-call-modal');
        if (existing) existing.remove();

        var isVideo = (type === 'video');
        _rtc.isVideo = isVideo;

        var modal = document.createElement('div');
        modal.id = 'oc-call-modal';
        modal.style.cssText = [
            'position:fixed;inset:0;z-index:999999;',
            'background:#000;',
            'display:flex;flex-direction:column;',
            'color:#fff;font-family:inherit;',
            '-webkit-tap-highlight-color:transparent;',
            'user-select:none;'
        ].join('');

        /* ── remote video (fills background for video calls) ── */
        var remoteVideo = document.createElement('video');
        remoteVideo.id = 'oc-remote-video';
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.style.cssText = [
            'position:absolute;inset:0;width:100%;height:100%;',
            'object-fit:cover;',
            isVideo ? 'display:block;' : 'display:none;',
            'background:#111;'
        ].join('');
        modal.appendChild(remoteVideo);

        /* ── local video (pip, bottom-right) ── */
        var localVideo = document.createElement('video');
        localVideo.id = 'oc-local-video';
        localVideo.autoplay = true;
        localVideo.playsInline = true;
        localVideo.muted = true;   /* never echo own audio */
        localVideo.style.cssText = [
            'position:absolute;bottom:110px;right:16px;',
            'width:90px;height:120px;border-radius:12px;',
            'object-fit:cover;border:2px solid rgba(255,255,255,0.5);',
            'box-shadow:0 4px 16px rgba(0,0,0,0.4);',
            'z-index:2;',
            isVideo ? 'display:block;' : 'display:none;'
        ].join('');
        modal.appendChild(localVideo);

        /* ── overlay panel (voice calls / ringing state) ── */
        var overlay = document.createElement('div');
        overlay.id = 'oc-call-overlay';
        overlay.style.cssText = [
            'position:relative;z-index:3;',
            'display:flex;flex-direction:column;align-items:center;',
            'padding-top:80px;gap:14px;flex:1;',
            'background:' + (isVideo
                ? 'linear-gradient(180deg,rgba(0,0,0,0.55) 0%,transparent 40%)'
                : 'linear-gradient(180deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)')
        ].join('');

        var callTypeLabel = document.createElement('div');
        callTypeLabel.style.cssText = 'font-size:0.82rem;opacity:0.7;letter-spacing:0.5px;text-transform:capitalize;';
        callTypeLabel.textContent = (isVideo ? 'Video' : 'Voice') + ' Call';
        overlay.appendChild(callTypeLabel);

        var avEl = document.createElement('img');
        avEl.src = avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=1B2B8B&color=fff&size=160');
        avEl.onerror = function() { this.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=1B2B8B&color=fff&size=160'; };
        avEl.id = 'oc-call-avatar';
        avEl.style.cssText = [
            'width:96px;height:96px;border-radius:50%;object-fit:cover;',
            'border:3px solid rgba(255,255,255,0.35);',
            'box-shadow:0 0 0 10px rgba(255,255,255,0.07);',
            isVideo ? 'opacity:0;transition:opacity 0.5s;' : ''
        ].join('');
        overlay.appendChild(avEl);

        var nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size:1.35rem;font-weight:700;';
        nameEl.textContent = name;
        overlay.appendChild(nameEl);

        var statusEl = document.createElement('div');
        statusEl.id = 'oc-call-status';
        statusEl.style.cssText = 'font-size:0.88rem;opacity:0.65;';
        statusEl.textContent = 'Calling…';
        overlay.appendChild(statusEl);

        modal.appendChild(overlay);

        /* ── controls bar ── */
        var controls = document.createElement('div');
        controls.id = 'oc-call-controls';
        controls.style.cssText = [
            'position:absolute;bottom:0;left:0;right:0;z-index:4;',
            'display:flex;align-items:center;justify-content:center;gap:20px;',
            'padding:20px 24px;',
            'padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));',
            'background:linear-gradient(0deg,rgba(0,0,0,0.75) 0%,transparent 100%);'
        ].join('');

        function _makeCtrlBtn(id, iconHtml, bg, label) {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;';
            var btn = document.createElement('button');
            btn.id = id;
            btn.style.cssText = [
                'width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;',
                'background:' + bg + ';color:#fff;',
                'display:flex;align-items:center;justify-content:center;',
                'box-shadow:0 4px 16px rgba(0,0,0,0.35);',
                'transition:transform 0.12s,background 0.2s;',
                '-webkit-tap-highlight-color:transparent;outline:none;'
            ].join('');
            btn.innerHTML = iconHtml;
            btn.addEventListener('touchstart', function(){ btn.style.transform='scale(0.88)'; }, { passive:true });
            btn.addEventListener('touchend',   function(){ btn.style.transform='scale(1)'; },   { passive:true });
            var lbl = document.createElement('span');
            lbl.style.cssText = 'font-size:0.7rem;opacity:0.85;color:#fff;';
            lbl.textContent = label;
            wrap.appendChild(btn);
            wrap.appendChild(lbl);
            return wrap;
        }

        /* SVG icons */
        var SVG = {
            micOn:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M12 15c1.66 0 3-1.34 3-3V6a3 3 0 0 0-6 0v6c0 1.66 1.34 3 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2z"/></svg>',
            micOff: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M19 11h-1.7A5 5 0 0 1 7.05 13H5a7 7 0 0 0 5 6.71V22h2v-2.29A7 7 0 0 0 19 13v-2zm-7 4a3 3 0 0 0 3-3V6a3 3 0 0 0-5.12-2.12L19 14.11A7 7 0 0 0 19 12h-2a5 5 0 0 1-.88 2.89L4.27 3.27 3 4.54l3.55 3.55A7 7 0 0 0 5 12H3a7 7 0 0 0 4.92 6.67L5 21.59 6.41 23 12 17.41l7.59 7.59L21 23.59 19 21.59 12 14.59V15z"/></svg>',
            camOn:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
            camOff: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z"/></svg>',
            flip:   '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M9 12c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3-3 1.34-3 3zm-4.5 0A7.5 7.5 0 0 1 12 4.5c2.04 0 3.88.82 5.22 2.14L15 9h6V3l-2.14 2.14A9.48 9.48 0 0 0 12 3C7.03 3 3.01 7.01 3 12H4.5zm13.5 0A7.5 7.5 0 0 1 12 19.5a7.44 7.44 0 0 1-5.22-2.14L9 15H3v6l2.14-2.14A9.48 9.48 0 0 0 12 21c4.97 0 8.99-4.01 9-9H19.5z"/></svg>',
            spkOn:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06A7 7 0 0 1 14 20.71v2.06a9 9 0 0 0 0-19.54z"/></svg>',
            endCall:'<svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9a11.07 11.07 0 0 0-2.66 1.85c-.37.36-.98.36-1.41-.01L.29 13.08A.996.996 0 0 1 0 12.38c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48a.994.994 0 0 1-1.4 0 11.13 11.13 0 0 0-2.67-1.85c-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>'
        };

        /* Row 1: Mute | Cam-toggle (video only) | Flip cam (video only) | Speaker */
        var muteWrap  = _makeCtrlBtn('oc-btn-mute',    SVG.micOn,  'rgba(255,255,255,0.2)', 'Mute');
        controls.appendChild(muteWrap);

        var camWrap, flipWrap;
        if (isVideo) {
            camWrap  = _makeCtrlBtn('oc-btn-cam',  SVG.camOn,  'rgba(255,255,255,0.2)', 'Camera');
            flipWrap = _makeCtrlBtn('oc-btn-flip', SVG.flip,   'rgba(255,255,255,0.2)', 'Flip');
            controls.appendChild(camWrap);
            controls.appendChild(flipWrap);
        }

        var spkWrap   = _makeCtrlBtn('oc-btn-spk',     SVG.spkOn,  'rgba(255,255,255,0.2)', 'Speaker');
        var endWrap   = _makeCtrlBtn('oc-btn-end',      SVG.endCall,'#E53935',               'End');
        controls.appendChild(spkWrap);
        controls.appendChild(endWrap);

        modal.appendChild(controls);
        document.body.appendChild(modal);

        /* ── wire buttons ── */
        var muteBtn = document.getElementById('oc-btn-mute');
        muteBtn.addEventListener('click', function() {
            _rtc.muted = !_rtc.muted;
            if (_rtc.localStream) {
                _rtc.localStream.getAudioTracks().forEach(function(t){ t.enabled = !_rtc.muted; });
            }
            muteBtn.style.background = _rtc.muted ? '#E53935' : 'rgba(255,255,255,0.2)';
            muteBtn.innerHTML = _rtc.muted ? SVG.micOff : SVG.micOn;
            muteBtn.nextSibling && (muteBtn.parentNode.querySelector('span').textContent = _rtc.muted ? 'Unmute' : 'Mute');
        });

        if (isVideo) {
            var camBtn  = document.getElementById('oc-btn-cam');
            var flipBtn = document.getElementById('oc-btn-flip');

            camBtn.addEventListener('click', function() {
                _rtc.camOff = !_rtc.camOff;
                if (_rtc.localStream) {
                    _rtc.localStream.getVideoTracks().forEach(function(t){ t.enabled = !_rtc.camOff; });
                }
                camBtn.style.background = _rtc.camOff ? '#E53935' : 'rgba(255,255,255,0.2)';
                camBtn.innerHTML = _rtc.camOff ? SVG.camOff : SVG.camOn;
            });

            var _facingMode = 'user';
            flipBtn.addEventListener('click', function() {
                _facingMode = (_facingMode === 'user') ? 'environment' : 'user';
                if (!_rtc.localStream || !_rtc.pc) return;
                var constraints = { video: { facingMode: _facingMode }, audio: true };
                navigator.mediaDevices.getUserMedia(constraints).then(function(newStream) {
                    /* Replace video track in peer connection */
                    var newVideoTrack = newStream.getVideoTracks()[0];
                    var sender = _rtc.pc.getSenders().find(function(s){ return s.track && s.track.kind === 'video'; });
                    if (sender && newVideoTrack) sender.replaceTrack(newVideoTrack);
                    /* Update local preview */
                    var lv = document.getElementById('oc-local-video');
                    if (lv) lv.srcObject = newStream;
                    /* Stop old tracks */
                    _rtc.localStream.getTracks().forEach(function(t){ t.stop(); });
                    _rtc.localStream = newStream;
                }).catch(function(){});
            });
        }

        var spkBtn = document.getElementById('oc-btn-spk');
        var _spkOn = false;
        spkBtn.addEventListener('click', function() {
            _spkOn = !_spkOn;
            spkBtn.style.background = _spkOn ? '#1B2B8B' : 'rgba(255,255,255,0.2)';
            /* setSinkId is supported on Chrome/Android for routing to speaker */
            if (_rtc.speakerEl && _rtc.speakerEl.setSinkId) {
                _rtc.speakerEl.setSinkId(_spkOn ? 'default' : '').catch(function(){});
            }
        });

        var endBtn = document.getElementById('oc-btn-end');
        endBtn.addEventListener('click', function() {
            _rtcHangup(_rtc.callId);
        });

        return { modal: modal, remoteVideo: remoteVideo, localVideo: localVideo, statusEl: statusEl, avEl: avEl };
    }

    /* ── set remote stream on video/audio elements ──────── */
    function _attachRemoteStream(stream, isVideo) {
        _rtc.remoteStream = stream;
        if (isVideo) {
            var rv = document.getElementById('oc-remote-video');
            if (rv) { rv.srcObject = stream; rv.play().catch(function(){}); }
            /* Hide avatar when remote video flows */
            var av = document.getElementById('oc-call-avatar');
            if (av) av.style.opacity = '0';
        } else {
            /* Voice: route audio through an <audio> element */
            if (!_rtc.speakerEl) {
                _rtc.speakerEl = document.createElement('audio');
                _rtc.speakerEl.autoplay = true;
                _rtc.speakerEl.style.display = 'none';
                document.body.appendChild(_rtc.speakerEl);
            }
            _rtc.speakerEl.srcObject = stream;
            _rtc.speakerEl.play().catch(function(){});
        }
        var st = document.getElementById('oc-call-status');
        if (st) st.textContent = 'Connected';
    }

    /* ── create RTCPeerConnection with handlers ──────────── */
    function _createPC(callId, role, isVideo) {
        var pc = new RTCPeerConnection(ICE_SERVERS);
        _rtc.pc = pc;

        /* Send ICE candidates to Firestore */
        var candColl = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
        pc.onicecandidate = function(e) {
            if (!e.candidate) return;
            if (!_fbOk()) return;
            try {
                window.fbDb.collection('calls').doc(callId)
                    .collection(candColl).add({
                        candidate:     e.candidate.candidate,
                        sdpMid:        e.candidate.sdpMid,
                        sdpMLineIndex: e.candidate.sdpMLineIndex
                    }).catch(function(){});
            } catch(ex){}
        };

        /* Remote track arrives */
        pc.ontrack = function(e) {
            var stream = e.streams && e.streams[0];
            if (!stream) { stream = new MediaStream(); stream.addTrack(e.track); }
            _attachRemoteStream(stream, isVideo);
        };

        pc.onconnectionstatechange = function() {
            var st = document.getElementById('oc-call-status');
            if (!st) return;
            switch(pc.connectionState) {
                case 'connecting':   st.textContent = 'Connecting…'; break;
                case 'connected':    st.textContent = 'Connected';
                    if (_rtc.dotTimer) { clearInterval(_rtc.dotTimer); _rtc.dotTimer = null; }
                    break;
                case 'disconnected': st.textContent = 'Reconnecting…'; break;
                case 'failed':
                case 'closed':       _rtcHangup(callId); break;
            }
        };

        return pc;
    }

    /* ── CALLER flow ─────────────────────────────────────── */
    function _startCallModal(type, name, avatar) {
        if (!_fbOk()) { _notify('No internet connection', 'warning'); return; }
        var isVideo = (type === 'video');
        var u = _us();
        if (!u.id) { _notify('Please log in to make calls', 'warning'); return; }

        var ui = _buildCallModal(type, name, avatar);
        _rtc.role = 'caller';

        /* Animate status */
        var dots = 0;
        _rtc.dotTimer = setInterval(function() {
            dots = (dots + 1) % 4;
            var st = document.getElementById('oc-call-status');
            if (st && st.textContent.startsWith('Call')) {
                st.textContent = 'Calling' + '.'.repeat(dots);
            }
        }, 600);

        /* Get local media */
        var constraints = isVideo
            ? { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: true }
            : { audio: true, video: false };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(function(stream) {
                _rtc.localStream = stream;
                var lv = document.getElementById('oc-local-video');
                if (lv && isVideo) { lv.srcObject = stream; lv.play().catch(function(){}); }

                /* Generate a call doc ID */
                var callId = _buildChatId(u.id, _peerId) + '-' + Date.now();
                _rtc.callId = callId;

                var pc = _createPC(callId, 'caller', isVideo);

                /* Add local tracks */
                stream.getTracks().forEach(function(t){ pc.addTrack(t, stream); });

                /* Create offer */
                return pc.createOffer().then(function(offer) {
                    return pc.setLocalDescription(offer).then(function() {
                        /* Write call doc */
                        return window.fbDb.collection('calls').doc(callId).set({
                            callerId:    u.id,
                            calleeId:    _peerId,
                            callerName:  u.fullName || u.username || 'User',
                            callerAvatar:u.avatar || u.profilePicture || '',
                            type:        type,
                            offer:       { type: offer.type, sdp: offer.sdp },
                            status:      'ringing',
                            createdAt:   new Date().toISOString()
                        });
                    });
                });
            })
            .then(function() {
                var callId = _rtc.callId;

                /* Listen for answer */
                _rtc.unsubAnswer = window.fbDb.collection('calls').doc(callId)
                    .onSnapshot(function(snap) {
                        if (!snap.exists) return;
                        var data = snap.data();
                        if (data.status === 'ended') { _rtcHangup(callId); return; }
                        if (data.answer && _rtc.pc && !_rtc.pc.currentRemoteDescription) {
                            var ans = new RTCSessionDescription(data.answer);
                            _rtc.pc.setRemoteDescription(ans).catch(function(){});
                        }
                    });

                /* Listen for callee ICE candidates */
                _rtc.unsubCands = window.fbDb.collection('calls').doc(callId)
                    .collection('calleeCandidates')
                    .onSnapshot(function(snap) {
                        snap.docChanges().forEach(function(ch) {
                            if (ch.type !== 'added') return;
                            var d = ch.doc.data();
                            if (_rtc.pc) {
                                _rtc.pc.addIceCandidate(new RTCIceCandidate({
                                    candidate:     d.candidate,
                                    sdpMid:        d.sdpMid,
                                    sdpMLineIndex: d.sdpMLineIndex
                                })).catch(function(){});
                            }
                        });
                    });

                /* Auto-end if no answer in 45 s */
                setTimeout(function() {
                    var m = document.getElementById('oc-call-modal');
                    var st = document.getElementById('oc-call-status');
                    if (m && st && st.textContent.startsWith('Calling')) {
                        _rtcHangup(callId);
                        _notify(name + ' did not answer', 'info');
                    }
                }, 45000);
            })
            .catch(function(err) {
                _rtcHangup(null);
                var msg = err.name === 'NotAllowedError'
                    ? 'Microphone/camera permission denied'
                    : 'Could not start call: ' + (err.message || err);
                _notify(msg, 'warning');
            });
    }

    /* ── CALLEE flow — show incoming call UI ─────────────── */
    function _handleIncomingCall(callDoc) {
        var data = callDoc.data();
        var callId = callDoc.id;
        if (!data || data.status !== 'ringing') return;

        /* Don't show if already in a call */
        if (_rtc.callId) return;

        var isVideo = (data.type === 'video');

        /* Build incoming call UI */
        var ring = document.createElement('div');
        ring.id = 'oc-incoming-call';
        ring.style.cssText = [
            'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);',
            'z-index:999998;',
            'background:#1a1a2e;color:#fff;',
            'border-radius:20px;padding:18px 24px;',
            'display:flex;align-items:center;gap:16px;',
            'box-shadow:0 8px 40px rgba(0,0,0,0.5);',
            'min-width:300px;max-width:90vw;',
            'animation:oc-ring-in 0.3s ease;'
        ].join('');

        /* inject ring animation once */
        if (!document.getElementById('oc-ring-style')) {
            var rs = document.createElement('style');
            rs.id = 'oc-ring-style';
            rs.textContent = '@keyframes oc-ring-in{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
            document.head.appendChild(rs);
        }

        var avEl = document.createElement('img');
        avEl.src = data.callerAvatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(data.callerName||'User') + '&background=1B2B8B&color=fff&size=80');
        avEl.style.cssText = 'width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;';
        ring.appendChild(avEl);

        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        info.innerHTML = '<div style="font-weight:700;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
            + _esc(data.callerName || 'Someone') + '</div>'
            + '<div style="font-size:0.78rem;opacity:0.65;">' + (isVideo ? '📹 Incoming video call' : '📞 Incoming voice call') + '</div>';
        ring.appendChild(info);

        var declineBtn = document.createElement('button');
        declineBtn.style.cssText = 'width:46px;height:46px;border-radius:50%;border:none;background:#E53935;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
        declineBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9A11.07 11.07 0 0 0 4.18 15.57c-.37.36-.98.36-1.41-.01L.29 13.08A.996.996 0 0 1 0 12.38c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48a.994.994 0 0 1-1.4 0 11.13 11.13 0 0 0-2.67-1.85c-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>';
        declineBtn.title = 'Decline';
        ring.appendChild(declineBtn);

        var acceptBtn = document.createElement('button');
        acceptBtn.style.cssText = 'width:46px;height:46px;border-radius:50%;border:none;background:#25D366;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
        acceptBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>';
        acceptBtn.title = 'Accept';
        ring.appendChild(acceptBtn);

        document.body.appendChild(ring);

        /* Pulse the accept button */
        var pulseTimer = setInterval(function() {
            acceptBtn.style.transform = 'scale(1.15)';
            setTimeout(function(){ acceptBtn.style.transform = 'scale(1)'; }, 200);
        }, 800);

        /* Auto-dismiss after 40 s */
        var autoDecline = setTimeout(function() {
            ring.remove();
            clearInterval(pulseTimer);
            window.fbDb.collection('calls').doc(callId).update({ status: 'ended' }).catch(function(){});
        }, 40000);

        declineBtn.addEventListener('click', function() {
            clearTimeout(autoDecline);
            clearInterval(pulseTimer);
            ring.remove();
            if (_fbOk()) {
                window.fbDb.collection('calls').doc(callId).update({ status: 'ended' }).catch(function(){});
            }
        });

        acceptBtn.addEventListener('click', function() {
            clearTimeout(autoDecline);
            clearInterval(pulseTimer);
            ring.remove();
            _answerCall(callDoc);
        });
    }

    /* ── CALLEE: answer the call ─────────────────────────── */
    function _answerCall(callDoc) {
        var data   = callDoc.data();
        var callId = callDoc.id;
        var isVideo = (data.type === 'video');
        _rtc.callId = callId;
        _rtc.role   = 'callee';

        _buildCallModal(data.type, data.callerName || 'Caller', data.callerAvatar || '');
        var st = document.getElementById('oc-call-status');
        if (st) st.textContent = 'Connecting…';

        var constraints = isVideo
            ? { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: true }
            : { audio: true, video: false };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(function(stream) {
                _rtc.localStream = stream;
                var lv = document.getElementById('oc-local-video');
                if (lv && isVideo) { lv.srcObject = stream; lv.play().catch(function(){}); }

                var pc = _createPC(callId, 'callee', isVideo);
                stream.getTracks().forEach(function(t){ pc.addTrack(t, stream); });

                /* Set remote offer */
                return pc.setRemoteDescription(new RTCSessionDescription(data.offer))
                    .then(function() { return pc.createAnswer(); })
                    .then(function(answer) {
                        return pc.setLocalDescription(answer).then(function() {
                            return window.fbDb.collection('calls').doc(callId).update({
                                answer: { type: answer.type, sdp: answer.sdp },
                                status: 'active'
                            });
                        });
                    });
            })
            .then(function() {
                /* Listen for caller ICE candidates */
                _rtc.unsubCands = window.fbDb.collection('calls').doc(callId)
                    .collection('callerCandidates')
                    .onSnapshot(function(snap) {
                        snap.docChanges().forEach(function(ch) {
                            if (ch.type !== 'added') return;
                            var d = ch.doc.data();
                            if (_rtc.pc) {
                                _rtc.pc.addIceCandidate(new RTCIceCandidate({
                                    candidate:     d.candidate,
                                    sdpMid:        d.sdpMid,
                                    sdpMLineIndex: d.sdpMLineIndex
                                })).catch(function(){});
                            }
                        });
                    });

                /* Watch for caller ending */
                _rtc.unsubAnswer = window.fbDb.collection('calls').doc(callId)
                    .onSnapshot(function(snap) {
                        if (snap.exists && snap.data().status === 'ended') {
                            _rtcHangup(callId);
                        }
                    });
            })
            .catch(function(err) {
                _rtcHangup(null);
                var msg = err.name === 'NotAllowedError'
                    ? 'Microphone/camera permission denied'
                    : 'Could not connect call: ' + (err.message || err);
                _notify(msg, 'warning');
            });
    }

    /* ── Expose so header buttons call into WebRTC ───────── */
    function _showCallModal(type, peerName, peerAvatar) {
        _startCallModal(type, peerName, peerAvatar);
    }

    /* Expose globally so other modules can answer a call */
    window.empyreanAnswerCall  = _answerCall;
    window.empyreanHangupCall  = _rtcHangup;

    /* ── Listen for incoming calls once user is known ─────── */
    function _watchIncomingCalls() {
        var u = _us();
        if (!u || !u.id || !_fbOk()) {
            /* Retry until Firebase + auth are ready */
            setTimeout(_watchIncomingCalls, 2500);
            return;
        }
        try {
            window.fbDb.collection('calls')
                .where('calleeId', '==', u.id)
                .where('status',   '==', 'ringing')
                .onSnapshot(function(snap) {
                    snap.docChanges().forEach(function(ch) {
                        if (ch.type === 'added') _handleIncomingCall(ch.doc);
                    });
                }, function(){});
        } catch(e){}
    }
    _ready(_watchIncomingCalls);


    /* =========================================================================
       §6  RENDER MESSAGES AREA
       ========================================================================= */
    function _getOrCreateBody() {
        /* Use existing chat-messages-container if the app already built it */
        var existing = document.getElementById('chat-messages-container')
                    || document.querySelector('#chat-view-container .chat-messages');
        if (existing) { existing.id = 'oc-messages-body'; return existing; }
        /* Otherwise create our own */
        var body = document.createElement('div');
        body.id  = 'oc-messages-body';
        return body;
    }

    /* =========================================================================
       §6c  CONTACT-LIST BACK BUTTON  (second-level: contact list -> exit messages)
       ========================================================================= */
    function _installContactListBackBtn() {
        /* Don't inject more than once */
        if (document.getElementById('oc-cl-back-btn')) return;

        var mView = document.getElementById('messages-view');
        if (!mView) return;

        /* HARD GUARD: if the in-chat view is still open (oc-mobile-open), don't run yet */
        var chatView = document.getElementById('chat-view-container');
        if (chatView && chatView.classList.contains('oc-mobile-open')) return;

        /* ── Strategy: try to wire into the app's EXISTING back/close button first ──
           Many apps render their own "← Messages" or "✕" button in the contact-list header.
           If one exists, add our handler to it instead of injecting a duplicate header.

           CRITICAL FIX: #oc-back-btn (the in-chat back arrow built in §7, also
           title="Back") lives inside this same #messages-view container as a
           child of #chat-view-container, even while hidden via CSS. The old
           selector below matched it too, so this function was silently adding
           a SECOND click listener (_doExitMessages -> dashboard) onto the
           in-chat back arrow. Result: tapping that arrow correctly showed the
           contact list AND, in the same click, immediately jumped to
           dashboard — looking exactly like "exit always goes home". We now
           explicitly exclude #oc-back-btn and anything inside
           #chat-view-container from this query.                              */
        var existingBackBtn = mView.querySelector(
            '.back-btn:not(#oc-back-btn):not([data-oc-chat-back]), .back-button:not(#oc-back-btn):not([data-oc-chat-back]), ' +
            '[class*="back-btn"]:not(#oc-back-btn):not([data-oc-chat-back]), [class*="back-button"]:not(#oc-back-btn):not([data-oc-chat-back]), ' +
            '[data-action="back"]:not(#oc-back-btn):not([data-oc-chat-back]), ' +
            '[aria-label="Back"]:not(#oc-back-btn):not([data-oc-chat-back]), ' +
            '[title="Back"]:not(#oc-back-btn):not([data-oc-chat-back])'
        );
        /* Belt-and-suspenders: even if a future selector tweak matches it again,
           never let the candidate be the in-chat back arrow or live inside the
           chat panel. */
        if (existingBackBtn && (
            existingBackBtn.id === 'oc-back-btn' ||
            existingBackBtn.getAttribute('data-oc-chat-back') ||
            existingBackBtn.closest('#chat-view-container')
        )) {
            existingBackBtn = null;
        }

        function _doExitMessages() {
            /* ── 1. Remove our injected header ── */
            var injected = document.getElementById('oc-cl-header');
            if (injected) injected.remove();

            /* ── 2. Drop body classes ── */
            document.body.classList.remove('oc-in-messages');
            document.body.classList.remove('oc-chat-open');
            _showStatusBar();

            /* ── 3. Navigate back to dashboard (home) ──
                   This button sits on the Messages contact list — pressing it
                   exits the Messages section entirely and returns to home.       */
            if (typeof window.navigateTo === 'function') {
                try { window.navigateTo('dashboard'); } catch(e) {}
            } else if (typeof window._origNavigateTo === 'function') {
                try { window._origNavigateTo('dashboard'); } catch(e) {}
            } else {
                /* Hard fallback: manually activate dashboard section.
                   FIX: use removeProperty (not a forced 'none'/'block' value)
                   so we never leave an inline style behind that could later
                   override the real router's own class-based CSS once the
                   user navigates elsewhere via the nav bar. */
                document.querySelectorAll('.content-section').forEach(function(s) {
                    s.classList.remove('active');
                    s.style.removeProperty('display');
                });
                var dash = document.getElementById('dashboard');
                if (dash) { dash.classList.add('active'); dash.style.removeProperty('display'); }
            }

            /* ── 4. DOM cleanup after router tick ──
                   FIX: removeProperty instead of forcing 'none'/'block' so this
                   never leaves a stale inline override that blocks a later
                   nav-bar click from showing its section (the original cause
                   of "every nav tap still shows Messages" + overlapping/
                   split-screen sections). */
            setTimeout(function() {
                /* Ensure messages section is hidden */
                var msgSection = document.getElementById('messages');
                if (msgSection) {
                    msgSection.classList.remove('active');
                    msgSection.style.removeProperty('display');
                }
                /* Ensure dashboard is visible */
                var dash = document.getElementById('dashboard');
                if (dash && dash.offsetParent === null) {
                    dash.classList.add('active');
                    dash.style.removeProperty('display');
                }
            }, 80);
        }

        if (existingBackBtn && !existingBackBtn._ocWired) {
            /* Just wire our exit handler onto the existing button — no new DOM */
            existingBackBtn._ocWired = true;
            existingBackBtn.addEventListener('click', _doExitMessages);
            /* Mark with our ID so the duplicate-guard above still works */
            existingBackBtn.id = 'oc-cl-back-btn';
            return;
        }

        /* ── Fallback: inject a slim top bar ONLY if no existing header is present ── */
        /* Check whether messages-view already has a coloured header row */
        var existingHeader = mView.querySelector(
            '.messages-header, .chat-list-header, #messages-header, ' +
            '[class*="messages-header"], [class*="chat-list-header"]'
        );

        var clHdr = document.createElement('div');
        clHdr.id = 'oc-cl-header';
        clHdr.style.cssText = [
            'display:flex;align-items:center;gap:10px;',
            'padding:10px 14px;',
            'background:#1B2B8B;',
            'color:#fff;',
            'flex-shrink:0;',
            'position:sticky;top:0;z-index:20;',
            'box-shadow:0 2px 8px rgba(10,14,39,0.22);'
        ].join('');

        var clBackBtn = document.createElement('button');
        clBackBtn.id = 'oc-cl-back-btn';
        clBackBtn.title = 'Back to home';
        clBackBtn.style.cssText = 'background:none;border:none;color:#fff;cursor:pointer;padding:4px 8px 4px 0;display:flex;align-items:center;flex-shrink:0;';
        clBackBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';

        var clTitle = document.createElement('span');
        clTitle.style.cssText = 'font-weight:700;font-size:1rem;flex:1;';
        clTitle.textContent = 'Messages';

        clHdr.appendChild(clBackBtn);
        clHdr.appendChild(clTitle);

        clBackBtn.addEventListener('click', _doExitMessages);

        /* FIX: Insert into .contact-list as its first child so it sits as a TOP
           HEADER above the contact items — NOT into #messages-view which is a
           row-flex container (inserting there made #oc-cl-header a left column,
           causing the half-screen split layout bug on mobile). */
        var contactList = mView.querySelector('.contact-list, #contact-list-container');
        if (contactList) {
            if (existingHeader && contactList.contains(existingHeader)) {
                existingHeader.style.display = 'none';
                contactList.insertBefore(clHdr, existingHeader);
            } else {
                contactList.insertBefore(clHdr, contactList.firstChild);
            }
        } else {
            /* Fallback: add to mView but make it full-width so it doesn't split */
            clHdr.style.cssText += 'width:100%;flex-shrink:0;';
            if (existingHeader) {
                existingHeader.style.display = 'none';
                mView.insertBefore(clHdr, existingHeader);
            } else {
                mView.insertBefore(clHdr, mView.firstChild);
            }
        }
    }

    /* =========================================================================
       §6b  BUILD DESKTOP PLACEHOLDER (no chat selected)
       index.html no longer ships a static #chat-placeholder — it raced against
       our CSS via its inline style attribute. We own the whole lifecycle here:
       build once, let CSS (#chat-placeholder rules + mobile display:none) and
       the inline style set in openChat()/_doCloseChat() handle visibility.
       ========================================================================= */
    function _ensurePlaceholder() {
        if (document.getElementById('chat-placeholder')) return;
        var mView = document.getElementById('messages-view');
        if (!mView) return;

        var ph = document.createElement('div');
        ph.id = 'chat-placeholder';
        ph.innerHTML = [
            '<div style="width:100px;height:100px;border-radius:28px;background:var(--g-navy);display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 8px 30px rgba(27,43,139,0.25);">',
            '  <i class="fas fa-comments" style="font-size:2.5rem;color:white;"></i>',
            '</div>',
            '<h3 style="font-family:\'Syne\',sans-serif;color:var(--primary);font-size:1.2rem;margin-bottom:8px;">Your Messages</h3>',
            '<p style="color:var(--text-muted);font-size:0.9rem;max-width:260px;line-height:1.6;">Select a contact to start a private, secure conversation.</p>'
        ].join('');

        var cv = document.getElementById('chat-view-container');
        if (cv && cv.parentNode === mView) {
            mView.insertBefore(ph, cv.nextSibling);
        } else {
            mView.appendChild(ph);
        }
    }

    /* =========================================================================
       §7  BUILD / REBUILD CHAT VIEW
       ========================================================================= */
    function _buildChatView(peerId, peerName, peerAvatar) {
        var cv = document.getElementById('chat-view-container');
        if (!cv) return;

        /* Clear previous content */
        cv.innerHTML = '';
        _seenDates = {};

        /* FIX (bug: "nothing in the chat responds to clicks until X is
           pressed"): traced to #oc-sheet-overlay (the long-press emoji
           catalog's backdrop) sometimes outliving its sheet — it's a
           position:fixed;inset:0 element at z-index:9999998 appended
           directly to document.body (a SIBLING of #chat-view-container,
           not a descendant), so the old cv.innerHTML='' above never
           touched it. A stray copy would silently sit on top of the
           entire chat, including the header's video/call buttons,
           swallowing every tap. The root leak in _showBubbleEmojiCatalog
           is fixed directly (see that function), but this is a second,
           defensive line: every time a chat is (re)built fresh, sweep away
           any stray copies of these ONE-SHOT, disposable overlay elements
           that might have been left behind from a previous session.
           NOTE: #oc-emoji-bar is intentionally excluded — _buildEmojiBar()
           builds it once and reuses it for the life of the page (toggled
           via a CSS class, not recreated), so removing it here would just
           force a wasteful rebuild and risk invalidating the cached
           _emojiBar module reference for no benefit. */
        ['oc-sheet-overlay', 'oc-bubble-emoji-sheet'].forEach(function(staleId) {
            var stale = document.getElementById(staleId);
            if (stale && stale.parentNode === document.body) stale.remove();
        });

        /* ── HEADER ── */
        var hdr = document.createElement('div');
        hdr.id = 'oc-chat-header';

        /* Close (X) button — right side of header */
        var backBtn = document.createElement('button');
        backBtn.id = 'oc-back-btn';
        backBtn.setAttribute('aria-label', 'Close chat');
        backBtn.setAttribute('data-oc-chat-back', '1');
        backBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

        function _doCloseChat(ev, _viaPopstate) {
            /* RE-ENTRANCY GUARD — prevents the stack overflow that occurs when:
               1. X button tap fires _doCloseChat
               2. _doCloseChat calls history.back()
               3. history.back() fires popstate (synchronously in some browsers)
               4. popstate calls _activeCloseHandler → _doCloseChat again → infinite loop */
            if (_doCloseChat._running) return;
            _doCloseChat._running = true;
            setTimeout(function() { _doCloseChat._running = false; }, 800);

            if (ev) { try { ev.stopPropagation(); } catch(e) {} try { ev.preventDefault(); } catch(e) {} }
            /* FIX: tear down any open emoji catalog/panel/menu the instant the
               chat closes — see _closeFloatingChatUI() for why. */
            _closeFloatingChatUI();
            _stopListener();
            _peerId = '';

            /* IMPORTANT: clear the flag BEFORE calling history.back() so that
               the synchronous popstate handler sees _chatHistoryPushed===false
               and does NOT re-enter _doCloseChat a second time. */
            var _shouldBack = (_chatHistoryPushed && !_viaPopstate);
            _chatHistoryPushed = false;
            if (_shouldBack) {
                try { history.back(); } catch(err) {}
            }

            /* ── 1. Hide the chat panel and restore it to its original DOM position ──
                   FIX (bug: "UI disrupted, doesn't return to contact list" —
                   reported after ending a video call): this used to trust
                   the cached _ocOrigParent/_ocOrigNextSibling references
                   unconditionally. If ANYTHING rebuilt that parent's
                   innerHTML while the chat was open (e.g. a contact-list
                   re-render triggered by a Firestore listener recovering
                   from the "missing or insufficient permissions" errors
                   seen in the console, or any other script's DOM rebuild),
                   _ocOrigParent silently became a DETACHED node — no longer
                   part of the live document. insertBefore() on a detached
                   node doesn't throw, so the try/catch below never caught
                   it; the chat panel just silently failed to return to a
                   visible location, leaving the broken/overlapping layout
                   reported.
                   FIX: verify _ocOrigParent is still actually attached to
                   the live document (document.contains()) before trusting
                   it. If it's gone, fall back to a fresh, reliable lookup
                   of the real mount point by selector instead of silently
                   doing nothing. */
            var _cv = document.getElementById('chat-view-container');
            if (_cv) {
                _cv.classList.remove('oc-mobile-open');
                var _origParentStillLive = _cv._ocOrigParent && document.contains(_cv._ocOrigParent);
                if (_origParentStillLive) {
                    try {
                        _cv._ocOrigParent.insertBefore(_cv, _cv._ocOrigNextSibling || null);
                    } catch(err) {
                        _origParentStillLive = false; /* fall through to fresh lookup below */
                    }
                }
                if (!_origParentStillLive) {
                    /* Fresh fallback: find the live messages-section container
                       and re-attach cv there directly, so the panel is never
                       left orphaned on <body> with no way back. */
                    var _freshMount = document.getElementById('messages')
                                    || document.querySelector('.content-section#messages, [data-section="messages"]');
                    if (_freshMount && _cv.parentNode !== _freshMount) {
                        try { _freshMount.appendChild(_cv); } catch(err2) { /* last resort: leave on body, still hidden via class removal above */ }
                    }
                }
            }
            /* Restore desktop placeholder (openChat set inline display:none on open) */
            var _ph = document.getElementById('chat-placeholder');
            if (_ph) { _ph.style.removeProperty('display'); }
            document.body.classList.remove('oc-chat-open');

            /* ── 2. Remove active highlight on contact items ── */
            document.querySelectorAll('.contact-item.active').forEach(function(el) {
                el.classList.remove('active');
            });

            /* ── 3. Show the messages section (contact list) ──
                   FIX: previously this (and the two blocks below) set inline
                   style.display DIRECTLY on every .content-section. Inline
                   styles always beat the app's class-based CSS, so once this
                   ran, #messages was permanently pinned to display:block and
                   every other section permanently pinned to display:none —
                   even after the user later clicked Reels/Status/etc in the
                   nav bar. The real navigateTo() would toggle the correct
                   .active classes, but the leftover inline styles from here
                   silently overrode it, which is why every nav-bar tap kept
                   showing (or partially overlapping with) Messages.
                   FIX: only toggle .active classes here; never touch inline
                   style.display. Visibility is driven purely by CSS rules
                   tied to .active, same as the rest of the app's router. */
            document.querySelectorAll('.content-section').forEach(function(s) {
                s.classList.toggle('active', s.id === 'messages');
            });

            /* Call router as courtesy */
            try {
                var _nav = window._origNavigateTo || window.navigateTo;
                if (typeof _nav === 'function') _nav('messages');
            } catch(err) {}

            /* After router settles: restore contact list UI */
            setTimeout(function() {
                /* Triple-check messages section is the active one (class only —
                   no inline style writes, see note above) */
                document.querySelectorAll('.content-section').forEach(function(s) {
                    s.classList.toggle('active', s.id === 'messages');
                });

                /* Show contact list panel */
                var mList = document.querySelector('.contact-list, #messages-list, #chat-list');
                if (mList) mList.style.removeProperty('display');

                try { window.scrollTo(0, 0); } catch(err) {}
                if (mList) mList.scrollTop = 0;

                /* Keep status bar hidden — still inside messages section */
                _hideStatusBar();

                /* Install the contacts-list back button (→ home) */
                var oldCl = document.getElementById('oc-cl-header');
                if (oldCl) oldCl.remove();
                var oldClBtn = document.getElementById('oc-cl-back-btn');
                if (oldClBtn) { oldClBtn._ocWired = false; oldClBtn.removeAttribute('id'); }
                _installContactListBackBtn();
            }, 50);
        }

        /* Use BOTH touchend (mobile) and click (desktop) — whichever fires first wins.
           Debounce flag is now SHARED at module scope (see §7b below) so the
           geometric fallback listener can never double-trigger a close. */
        _activeCloseHandler = _doCloseChat;
        backBtn.addEventListener('touchend', function(ev) {
            if (_closeDebounce) return;
            _closeDebounce = true;
            setTimeout(function() { _closeDebounce = false; }, 600);
            _doCloseChat(ev);
        }, { passive: false });
        backBtn.addEventListener('click', function(ev) {
            if (_closeDebounce) return;
            _closeDebounce = true;
            setTimeout(function() { _closeDebounce = false; }, 600);
            _doCloseChat(ev);
        });

        /* Peer avatar */
        var av = document.createElement('img');
        av.id  = 'oc-peer-avatar';
        av.alt = peerName;
        av.src = peerAvatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(peerName) + '&background=1B2B8B&color=fff&size=80');
        av.onerror = function() { this.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(peerName) + '&background=1B2B8B&color=fff&size=80'; };
        av.style.cursor = 'pointer';
        av.title = 'View profile picture';
        av.addEventListener('click', function() { _openLightbox(av.src); }); /* FIX-2 */
        hdr.appendChild(av);

        /* Name + status */
        var info = document.createElement('div');
        info.id = 'oc-peer-info';
        info.innerHTML = '<div id="oc-peer-name">' + _esc(peerName) + '</div>'
                       + '<div id="oc-peer-status">online</div>';
        hdr.appendChild(info);

        /* Video call button */
        var vidBtn = document.createElement('button');
        vidBtn.className = 'oc-header-btn';
        vidBtn.title = 'Video call';
        vidBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
        vidBtn.addEventListener('click', function() {
            if (typeof window.startVideoCall === 'function') {
                window.startVideoCall(_peerId, _peerName, _peerAvatar); return;
            }
            if (typeof window.openVideoCall === 'function') {
                window.openVideoCall(_peerId, _peerName); return;
            }
            if (typeof window._initVideoCall === 'function') {
                window._initVideoCall(_peerId, _peerName, _peerAvatar); return;
            }
            _showCallModal('video', _peerName, _peerAvatar);
        });
        hdr.appendChild(vidBtn);

        /* Voice call button */
        var callBtn = document.createElement('button');
        callBtn.className = 'oc-header-btn';
        callBtn.title = 'Voice call';
        callBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>';
        callBtn.addEventListener('click', function() {
            if (typeof window.startVoiceCall === 'function') {
                window.startVoiceCall(_peerId, _peerName, _peerAvatar); return;
            }
            if (typeof window.openVoiceCall === 'function') {
                window.openVoiceCall(_peerId, _peerName); return;
            }
            if (typeof window._initVoiceCall === 'function') {
                window._initVoiceCall(_peerId, _peerName, _peerAvatar); return;
            }
            _showCallModal('voice', _peerName, _peerAvatar);
        });
        hdr.appendChild(callBtn);

        /* More options button */
        var moreBtn = document.createElement('button');
        moreBtn.className = 'oc-header-btn';
        moreBtn.title = 'More options';
        moreBtn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
        moreBtn.addEventListener('click', function(e){ e.stopPropagation(); _buildMoreMenu(moreBtn, peerId, peerName); });
        hdr.appendChild(moreBtn);

        /* Wire peer data so the rest of the app can read it (renamed away from
           'chat-header-info' to avoid colliding with the static element of the
           same ID in index.html, which we already removed via cv.innerHTML='' —
           reusing that ID risked other scripts' getElementById calls picking up
           this hidden node instead of expecting a real header). */
        var infoEl = document.createElement('span');
        infoEl.id = 'oc-chat-header-info';
        infoEl.dataset.userId   = peerId;
        infoEl.dataset.peerId   = peerId;
        infoEl.dataset.peerName = peerName;
        infoEl.style.display = 'none';
        hdr.appendChild(infoEl);

        /* X close button — appended last so it sits on the far right */
        hdr.appendChild(backBtn);

        cv.appendChild(hdr);

        /* ── SWEEP: remove any stray call/video/back button that some other
           script injected directly into #chat-view-container (outside our
           #oc-chat-header). This is the actual fix for the "two phone icons"
           bug — a previous patch tried to hide it with brittle nth-of-type
           CSS instead of removing the rogue element, which silently broke
           the moment the header's child order changed. ── */
        Array.prototype.slice.call(cv.children).forEach(function(child) {
            if (child === hdr) return; /* keep our header */
            if (child.id === 'oc-messages-body') return; /* will be added below, not yet present, harmless */
            if (child.tagName === 'BUTTON' || child.querySelector('button, svg, i.fas, i.fa')) {
                /* Anything button-like or icon-like that isn't our header → remove */
                child.remove();
            }
        });

        /* ── MESSAGES BODY ── */
        var body = document.createElement('div');
        body.id  = 'oc-messages-body';
        /* Also expose as chat-messages-container so app-fixes.js can append to it */
        body.setAttribute('data-role','chat-messages-container');
        /* Ensure the existing ID is also available */
        var legacyAnchor = document.createElement('div');
        legacyAnchor.id  = 'chat-messages-container';
        legacyAnchor.style.display = 'none';
        body.appendChild(legacyAnchor);

        var loadingEl = document.createElement('div');
        loadingEl.id = 'oc-loading';
        loadingEl.textContent = 'Loading messages…';
        body.appendChild(loadingEl);

        cv.appendChild(body);

        /* ── COMPOSER ── */
        var composer = document.createElement('div');
        composer.id = 'oc-composer';

        var fileInput = document.createElement('input');
        fileInput.id     = 'oc-file-input';
        fileInput.type   = 'file';
        fileInput.accept = 'image/*,video/*,application/pdf,audio/*';
        fileInput.multiple = true;
        composer.appendChild(fileInput);

        var inner = document.createElement('div');
        inner.className = 'oc-composer-inner';

        /* Emoji icon */
        var emojiBtn = document.createElement('button');
        emojiBtn.id = 'oc-emoji-btn';
        emojiBtn.title = 'Emoji';
        emojiBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm0-9c-.83 0-1.5-.67-1.5-1.5S9.17 4.5 10 4.5s1.5.67 1.5 1.5S10.83 7.5 10 7.5zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 4.5 14 4.5s1.5.67 1.5 1.5S14.83 7.5 14 7.5zm2 9c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
        /* Show quick emoji picker inline */
        emojiBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            _showFullEmojiPanel(inner, _getTextInput()); /* FIX-8: full emoji panel */
        });
        inner.appendChild(emojiBtn);

        /* Text area */
        var textInput = document.createElement('textarea');
        textInput.id  = 'oc-text-input';
        textInput.rows = 1;
        textInput.placeholder = 'Message';
        textInput.setAttribute('aria-label', 'Message');
        /* Also wire as message-text-input so app-fixes.js form handler works */
        textInput.name = 'message-text-input';
        textInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _doSend(); }
        });
        inner.appendChild(textInput);

        /* Attach button */
        var attachBtn = document.createElement('button');
        attachBtn.id = 'oc-attach-btn';
        attachBtn.title = 'Attach';
        attachBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>';
        attachBtn.addEventListener('click', function() { fileInput.click(); });
        inner.appendChild(attachBtn);

        composer.appendChild(inner);

        /* Mic button (shown when input is empty — WhatsApp style) */
        var micBtn = document.createElement('button');
        micBtn.id = 'oc-mic-btn';
        micBtn.type = 'button';
        micBtn.title = 'Voice note';
        micBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zM17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V22h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
        micBtn.style.display = 'flex';
        _wiresMicBtn(micBtn);
        composer.appendChild(micBtn);

        /* Send button — always present, shown when text is typed */
        var sendBtn = document.createElement('button');
        sendBtn.id = 'oc-send-btn';
        sendBtn.type = 'button';
        sendBtn.title = 'Send';
        sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        sendBtn.style.display = 'none';
        sendBtn.addEventListener('click', _doSend);
        composer.appendChild(sendBtn);

        /* Toggle mic ↔ send based on input content */
        textInput.addEventListener('input', function() {
            textInput.style.height = 'auto';
            textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
            var hasText = (textInput.value || '').trim().length > 0;
            micBtn.style.display  = hasText ? 'none' : 'flex';
            sendBtn.style.display = hasText ? 'flex' : 'none';
        });

        /* File input change */
        fileInput.addEventListener('change', function() {
            Array.from(fileInput.files || []).forEach(function(f) { _sendFile(f); });
            fileInput.value = '';
            /* After file selected, briefly show send is in progress */
            var sb = document.getElementById('oc-send-btn') || sendBtn;
            var mb = document.getElementById('oc-mic-btn')  || micBtn;
            if (sb) sb.style.display = 'none';
            if (mb) mb.style.display = 'flex';
        });

        cv.appendChild(composer);

        /* Also expose a hidden #message-form so app-fixes.js submit handler keeps working */
        var dummyForm = document.getElementById('message-form');
        if (!dummyForm) {
            dummyForm = document.createElement('form');
            dummyForm.id = 'message-form';
            dummyForm.style.display = 'none';
            var dummyInp = document.createElement('input');
            dummyInp.id   = 'message-text-input';
            dummyInp.type = 'text';
            dummyForm.appendChild(dummyInp);
            cv.appendChild(dummyForm);
            /* Wire submit → our send */
            dummyForm.addEventListener('submit', function(e) {
                e.preventDefault();
                var val = dummyInp.value.trim();
                if (val) { textInput.value = val; _doSend(); dummyInp.value = ''; }
            });
        }

        function _getTextInput() {
            return document.getElementById('oc-text-input') || textInput;
        }

        function _doSend() {
            var inp = document.getElementById('oc-text-input') || textInput;
            var text = (inp.value || '').trim();
            if (!text) return;
            if (_isGuest()) { if (typeof window.openAuthModal === 'function') window.openAuthModal('login'); return; }

            var msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
            var u = _us();
            var now = new Date().toISOString();
            var chatId = _buildChatId(u.id||'', _peerId);

            /* Optimistic render */
            var row = _buildBubble({
                id: msgId, text: text, senderId: u.id,
                createdAt: now
            }, u.id);
            _appendBubble(row, now);

            /* Reset input */
            inp.value = '';
            inp.style.height = 'auto';
            var sb = document.getElementById('oc-send-btn') || sendBtn;
            var mb = document.getElementById('oc-mic-btn')  || micBtn;
            if (sb) sb.style.display = 'none';
            if (mb) mb.style.display = 'flex';

            /* Firestore write — same schema as app-fixes.js */
            if (_fbOk()) {
                var payload = {
                    id:          msgId,
                    chatId:      chatId,
                    senderId:    u.id    || '',
                    receiverId:  _peerId,
                    senderName:  u.fullName || u.username || 'User',
                    text:        text,
                    read:        false,
                    createdAt:   now
                };
                try {
                    window.fbDb.collection('messages').doc(msgId).set(payload).catch(function(){});
                    /* Also update chat metadata */
                    window.fbDb.collection('chats').doc(chatId).set({
                        participants: [u.id||'', _peerId],
                        lastMessage: text,
                        lastMessageTime: now,
                        lastSenderId: u.id||''
                    }, { merge: true }).catch(function(){});
                } catch(e){}
            }
        }
        window._ocDoSend = _doSend; /* expose for tests */
    }


    /* =========================================================================
       §8  APPEND BUBBLE WITH DATE SEPARATOR
       ========================================================================= */
    function _appendBubble(row, ts) {
        var body = document.getElementById('oc-messages-body');
        if (!body) return;
        var loading = document.getElementById('oc-loading');
        if (loading) { loading.remove(); }

        /* Date separator */
        var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        if (d) {
            var dateKey = d.toDateString();
            if (!_seenDates[dateKey]) {
                _seenDates[dateKey] = true;
                var sep = _dateSep(ts);
                if (sep) body.appendChild(sep);
            }
        }

        body.appendChild(row);
        body.scrollTop = body.scrollHeight;
    }


    /* =========================================================================
       §9  SEND FILE
       ========================================================================= */
    function _sendFile(file) {
        var u = _us();
        var msgId = 'msg-' + Date.now() + '-f';
        var chatId = _buildChatId(u.id||'', _peerId);
        var cfg = (window._appConfig && window._appConfig.cloudinary) || {};
        var cloud  = cfg.cloud || cfg.cloudName || 'dxwmts9vw';
        var preset = cfg.preset || cfg.uploadPreset || 'ehfapp_preset';

        /* Optimistic local preview */
        var localUrl = URL.createObjectURL(file);
        var row = _buildBubble({
            id: msgId, /* no text — media speaks for itself */
            mediaUrl: localUrl, mediaType: file.type,
            senderId: u.id, createdAt: new Date().toISOString()
        }, u.id);
        _appendBubble(row, new Date().toISOString());

        /* Upload to Cloudinary */
        var fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', preset);
        if (file.type.startsWith('video/') || file.type.startsWith('audio/')) fd.append('resource_type','video');

        fetch('https://api.cloudinary.com/v1_1/' + cloud + '/auto/upload', { method:'POST', body:fd })
            .then(function(r){ return r.json(); })
            .then(function(d){
                var url = d.secure_url || d.url || '';
                if (!url) return;
                /* Update the local preview src */
                var media = row.querySelector('img,video,audio,a');
                if (media) { if (media.tagName==='A') media.href=url; else media.src=url; }
                /* Firestore */
                if (_fbOk()) {
                    try {
                        window.fbDb.collection('messages').doc(msgId).set({
                            id:msgId, chatId:chatId,
                            senderId:u.id||'', receiverId:_peerId,
                            senderName:u.fullName||u.username||'User',
                            mediaUrl:url, mediaType:file.type, fileName:file.name,
                            read:false, createdAt:new Date().toISOString()
                        }).catch(function(){});
                    } catch(e){}
                }
            })
            .catch(function(){ _notify('File upload failed — check connection.','warning'); });
    }


    /* =========================================================================
       §10  INLINE EMOJI PICKER
       ========================================================================= */
    var COMMON_EMOJIS = ['😊','😂','❤️','👍','🙏','😢','🔥','🎉','😎','🤔','💯','😍','🙌','✅','🥰','😅','👏','💪'];
    function _showInlineEmojiPicker(anchor, textInput) {
        var existing = document.getElementById('oc-inline-emoji');
        if (existing) { existing.remove(); return; }
        var picker = document.createElement('div');
        picker.id = 'oc-inline-emoji';
        picker.style.cssText = 'position:absolute;bottom:64px;left:8px;background:#fff;border-radius:16px;padding:10px;display:flex;flex-wrap:wrap;gap:6px;max-width:280px;box-shadow:0 8px 24px rgba(0,0,0,0.18);z-index:9999;';
        COMMON_EMOJIS.forEach(function(em) {
            var span = document.createElement('span');
            span.textContent = em;
            span.style.cssText = 'font-size:1.5rem;cursor:pointer;';
            span.addEventListener('click', function() {
                if (textInput) {
                    var pos = textInput.selectionStart || textInput.value.length;
                    textInput.value = textInput.value.slice(0,pos) + em + textInput.value.slice(pos);
                    textInput.dispatchEvent(new Event('input'));
                    textInput.focus();
                }
                picker.remove();
            });
            picker.appendChild(span);
        });
        var cv = document.getElementById('chat-view-container');
        if (cv) { cv.style.position = 'relative'; cv.appendChild(picker); }
        setTimeout(function() {
            document.addEventListener('click', function() { picker.remove(); }, { once:true });
        }, 50);
    }




    /* =========================================================================
       FIX-8  FULL EMOJI PANEL WITH CATEGORIES
       ========================================================================= */
    var _EMOJI_CATS = {
        '😊 Smileys': ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','🤠','🥸','😷','🤒','🤕','🤢','🤮','🤧','🥴','😇','🤡','🤥','🤫','🤭','🧐','🤓'],
        '👍 Gestures': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄'],
        '❤️ Hearts':   ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎'],
        '😸 Animals':  ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿','🦔'],
        '🍕 Food':     ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🫒','🥑','🍆','🥔','🥕','🌽','🌶','🥒','🥬','🧅','🧄','🍞','🥐','🥖','🫓','🥨','🥯','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🥚','🍿','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','☕','🫖','🍵','🧃','🥤','🧋','🍺','🍻','🥂','🍷','🥃','🍸','🍹'],
        '⚽ Activity': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🥌','🎿','⛷','🏂','🏋','🤼','🤸','⛹','🤺','🏇','🧘','🏊','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎗','🎫','🎟','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'],
        '✈️ Travel':   ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🦽','🦼','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','⛽','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🛶','🚤','🛳','⛴','🛥','🚢','✈️','🛩','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰','🚀','🛸','🌍','🌎','🌏','🌐','🗺','🧭','🏔','⛰','🌋','🗻','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🧱','🪝','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩','🕋','⛲','⛺','🌁','🌉'],
        '💡 Objects':  ['⌚','📱','📲','💻','⌨️','🖥','🖨','🖱','🖲','🗜','💾','💿','📀','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🧭','⏰','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯','💸','💵','💴','💶','💷','🪙','💰','💳','🧾','💹','📈','📉','📊','📋','🗒','🗓','📆','📅','🗑','📁','📂','🗂','🗄','🗃','📊','📋','📌','📍','✂️','🗃','📌','📍','🗃','🗄','📊','🔐','🔑','🗝','🔨','🪓','⛏','⚒','🛠','🗡','⚔️','🔫','🛡','🔧','🔩','⚙️','🗜','🪝','⚗️','🔭','🔬','🩺','🩻','💊','💉','🩸','🩹','🩼','🩺','🪞','🪟','🛋','🚿','🛁','🪣'],
        '🔣 Symbols':  ['❤️','🧡','💛','💚','💙','💜','🖤','✅','❎','🔴','🟠','🟡','🟢','🔵','🟣','🔺','🔻','💠','🔘','🔲','🔳','⬛','⬜','◼️','◻️','◾','◽','▪️','▫️','🔷','🔶','🔹','🔸','🔷','💯','🆗','🆙','🆒','🆕','🆓','🔞','📵','🚫','⭕','❌','❓','❔','❕','❗','💤','🔅','🔆','🔱','♻️','💢','💥','💫','💦','💨','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛','🕜','🕝','🕞','🕟','🕠','🕡','🕢','🕣','🕤','🕥','🕦','🕧']
    };

    function _showFullEmojiPanel(anchor, textInput) {
        var existing = document.getElementById('oc-emoji-panel');
        if (existing) { existing.remove(); return; }

        var panel = document.createElement('div');
        panel.id = 'oc-emoji-panel';

        /* Search bar */
        var search = document.createElement('input');
        search.className = 'oc-emoji-search';
        search.placeholder = 'Search emoji…';
        panel.appendChild(search);

        /* Category tabs */
        var cats = document.createElement('div');
        cats.className = 'oc-emoji-cats';

        var grid = document.createElement('div');
        grid.className = 'oc-emoji-grid';

        var catKeys = Object.keys(_EMOJI_CATS);
        var _currentCat = catKeys[0];

        function _renderCat(catKey) {
            grid.innerHTML = '';
            var emojis = _EMOJI_CATS[catKey] || [];
            emojis.forEach(function(em) {
                var sp = document.createElement('span');
                sp.textContent = em;
                sp.title = em;
                sp.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (textInput) {
                        var pos = textInput.selectionStart || textInput.value.length;
                        textInput.value = textInput.value.slice(0,pos) + em + textInput.value.slice(pos);
                        textInput.dispatchEvent(new Event('input'));
                        textInput.focus();
                    }
                    /* keep panel open for multi-selection */
                });
                grid.appendChild(sp);
            });
        }

        catKeys.forEach(function(key) {
            var btn = document.createElement('button');
            btn.className = 'oc-emoji-cat-btn' + (key === catKeys[0] ? ' active' : '');
            btn.textContent = key.split(' ')[0]; /* just the emoji icon */
            btn.title = key.replace(/^.+ /,'');
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                cats.querySelectorAll('.oc-emoji-cat-btn').forEach(function(b){ b.classList.remove('active'); });
                btn.classList.add('active');
                _currentCat = key;
                _renderCat(key);
            });
            cats.appendChild(btn);
        });

        panel.appendChild(cats);
        panel.appendChild(grid);
        _renderCat(catKeys[0]);

        /* Search filter */
        search.addEventListener('input', function(e) {
            e.stopPropagation();
            var kw = search.value.toLowerCase();
            if (!kw) { _renderCat(_currentCat); return; }
            grid.innerHTML = '';
            catKeys.forEach(function(key) {
                _EMOJI_CATS[key].forEach(function(em) {
                    if (key.toLowerCase().includes(kw) || em.includes(kw)) {
                        var sp = document.createElement('span');
                        sp.textContent = em;
                        sp.addEventListener('click', function(evt) {
                            evt.stopPropagation();
                            if (textInput) {
                                var pos = textInput.selectionStart || textInput.value.length;
                                textInput.value = textInput.value.slice(0,pos) + em + textInput.value.slice(pos);
                                textInput.dispatchEvent(new Event('input'));
                                textInput.focus();
                            }
                        });
                        grid.appendChild(sp);
                    }
                });
            });
        });

        /* Append to chat-view-container */
        var cv = document.getElementById('chat-view-container');
        if (cv) { cv.style.position = 'relative'; cv.appendChild(panel); }
        else { document.body.appendChild(panel); }

        /* Close on outside click but NOT on panel itself */
        setTimeout(function() {
            document.addEventListener('click', function _cp(e) {
                if (!panel.contains(e.target) && e.target !== document.getElementById('oc-emoji-btn')) {
                    panel.remove();
                    document.removeEventListener('click', _cp, true);
                }
            }, { capture: true });
        }, 50);
    }

    /* =========================================================================
       FIX-5  3-DOT MORE OPTIONS DROPDOWN
       ========================================================================= */
    function _buildMoreMenu(moreBtn, peerId, peerName) {
        var existing = document.getElementById('oc-more-menu');
        if (existing) { existing.remove(); return; }

        var menu = document.createElement('div');
        menu.id = 'oc-more-menu';

        var ITEMS = [
            { label: 'View contact',        action: function(){ if(typeof window.openProfile==='function') window.openProfile(peerId); else _notify('Opening profile…','info'); } },
            { label: 'Search',              action: function(){ var b=document.getElementById('oc-messages-body'); if(b){ var kw=prompt('Search messages:'); if(kw) _searchMessages(kw); } } },
            { label: 'Add to list',         action: function(){ _notify('Added to list','info'); } },
            { label: 'Media, links & docs', action: function(){ _openMediaPanel(); } },
            { label: 'Mute notifications',  action: function(){ _notify('Notifications muted','info'); } },
            { label: 'Disappearing msgs',   action: function(){ _notify('Disappearing messages — coming soon','info'); } },
            { label: 'Clear chat',          action: function(){ if(confirm('Clear all messages in this chat?')) { var b=document.getElementById('oc-messages-body'); if(b) b.querySelectorAll('.oc-row,.oc-date-sep').forEach(function(r){r.remove()}); } } }
        ];

        ITEMS.forEach(function(item) {
            var div = document.createElement('div');
            div.className = 'oc-menu-item';
            div.textContent = item.label;
            div.addEventListener('click', function(e) {
                e.stopPropagation();
                menu.remove();
                item.action();
            });
            menu.appendChild(div);
        });

        /* Position relative to header */
        var hdr = document.getElementById('oc-chat-header');
        if (hdr) { hdr.style.position = 'relative'; hdr.appendChild(menu); }
        else { document.body.appendChild(menu); }

        /* Close on outside click */
        setTimeout(function() {
            document.addEventListener('click', function _close(){ menu.remove(); document.removeEventListener('click',_close); }, { once:true });
        }, 30);
    }

    function _searchMessages(kw) {
        var body = document.getElementById('oc-messages-body');
        if (!body) return;
        var lkw = kw.toLowerCase();
        body.querySelectorAll('.oc-bubble p').forEach(function(p) {
            var row = p.closest('.oc-row');
            if (!row) return;
            row.style.outline = p.textContent.toLowerCase().includes(lkw) ? '2px solid #1B2B8B' : '';
        });
    }

    function _openMediaPanel() {
        var body = document.getElementById('oc-messages-body');
        if (!body) { _notify('No chat open','info'); return; }
        var imgs = body.querySelectorAll('.oc-bubble img');
        if (!imgs.length) { _notify('No media in this chat','info'); return; }
        var panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;inset:0;z-index:9999998;background:#fff;overflow-y:auto;';
        var hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px;background:#1B2B8B;color:#fff;position:sticky;top:0;';
        hdr.innerHTML = '<button onclick="this.closest(\'div[style]\').remove()" style="background:none;border:none;color:#fff;font-size:1.4rem;cursor:pointer;">&#8592;</button><span style="font-weight:700;">Media</span>';
        panel.appendChild(hdr);
        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:3px;';
        imgs.forEach(function(img) {
            var thumb = document.createElement('img');
            thumb.src = img.src;
            thumb.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;cursor:zoom-in;';
            thumb.addEventListener('click', function(){ _openLightbox(img.src); });
            grid.appendChild(thumb);
        });
        panel.appendChild(grid);
        document.body.appendChild(panel);
    }

    /* =========================================================================
       FIX-3  IMAGE LIGHTBOX
       ========================================================================= */
    function _openLightbox(src) {
        var lb = document.createElement('div');
        lb.id = 'oc-lightbox';
        var img = document.createElement('img');
        img.src = src;
        var close = document.createElement('button');
        close.id = 'oc-lightbox-close';
        close.innerHTML = '&#x2715;';
        lb.appendChild(img);
        lb.appendChild(close);
        document.body.appendChild(lb);
        function _closeLb() { lb.remove(); }
        close.addEventListener('click', function(e){ e.stopPropagation(); _closeLb(); });
        lb.addEventListener('click', _closeLb);
        img.addEventListener('click', function(e){ e.stopPropagation(); }); /* don't close on img click */
        document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ _closeLb(); document.removeEventListener('keydown',esc); } });
    }

    /* =========================================================================
       FIX-2  VOICE RECORDING  — WhatsApp press-and-hold style
       MediaRecorder + Cloudinary upload + live recording bar
       ========================================================================= */
    var _micRec = { recorder: null, chunks: [], stream: null, active: false, timer: null, elapsed: 0 };

    /* Build the recording bar that replaces the composer while recording */
    function _showRecordingBar(micBtn, onStop, onCancel) {
        var composer = document.getElementById('oc-composer');
        if (!composer) return;

        var bar = document.createElement('div');
        bar.id = 'oc-rec-bar';
        bar.style.cssText = [
            'position:absolute;inset:0;',
            'display:flex;align-items:center;gap:10px;',
            'padding:8px 12px;',
            'background:#f0f2f5;',
            'z-index:50;',
            'border-top:1px solid rgba(10,14,39,0.08);',
        ].join('');

        /* Cancel (trash) button */
        var cancelBtn = document.createElement('button');
        cancelBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;flex-shrink:0;';
        cancelBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#E53935"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
        cancelBtn.addEventListener('click', function() { onCancel(); });
        bar.appendChild(cancelBtn);

        /* Timer */
        var timerEl = document.createElement('span');
        timerEl.id = 'oc-rec-timer';
        timerEl.style.cssText = 'color:#E53935;font-size:0.88rem;font-weight:600;flex-shrink:0;min-width:38px;';
        timerEl.textContent = '0:00';
        bar.appendChild(timerEl);

        /* Animated waveform dots */
        var wave = document.createElement('div');
        wave.id = 'oc-rec-wave';
        wave.style.cssText = 'flex:1;display:flex;align-items:center;gap:3px;overflow:hidden;';
        for (var w = 0; w < 28; w++) {
            var dot = document.createElement('div');
            var h = (8 + Math.random() * 18) | 0;
            dot.style.cssText = 'width:3px;border-radius:2px;background:#1B2B8B;opacity:0.5;flex-shrink:0;height:' + h + 'px;';
            dot.style.animation = 'oc-wave-anim ' + (0.5 + Math.random() * 0.6).toFixed(2) + 's ease-in-out infinite alternate';
            dot.style.animationDelay = (Math.random() * 0.4).toFixed(2) + 's';
            wave.appendChild(dot);
        }
        bar.appendChild(wave);

        /* Inject wave animation keyframes once */
        if (!document.getElementById('_oc_wave_style')) {
            var ws = document.createElement('style');
            ws.id = '_oc_wave_style';
            ws.textContent = '@keyframes oc-wave-anim{from{transform:scaleY(0.4);opacity:0.4}to{transform:scaleY(1);opacity:1}}';
            document.head.appendChild(ws);
        }

        /* Send (checkmark) button */
        var sendVn = document.createElement('button');
        sendVn.style.cssText = [
            'width:44px;height:44px;min-width:44px;border-radius:50%;border:none;cursor:pointer;',
            'background:#1B2B8B;color:#fff;',
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
            'box-shadow:0 2px 8px rgba(27,43,139,0.30);',
        ].join('');
        sendVn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
        sendVn.addEventListener('click', function() { onStop(); });
        bar.appendChild(sendVn);

        /* Make composer relative so absolute bar covers it */
        composer.style.position = 'relative';
        composer.appendChild(bar);

        /* Start elapsed timer */
        _micRec.elapsed = 0;
        _micRec.timer = setInterval(function() {
            _micRec.elapsed++;
            var m = Math.floor(_micRec.elapsed / 60);
            var s = _micRec.elapsed % 60;
            var timerEl2 = document.getElementById('oc-rec-timer');
            if (timerEl2) timerEl2.textContent = m + ':' + (s < 10 ? '0' : '') + s;
        }, 1000);
    }

    function _hideRecordingBar() {
        clearInterval(_micRec.timer);
        _micRec.timer = null;
        var bar = document.getElementById('oc-rec-bar');
        if (bar) bar.remove();
    }

    function _startRecording(micBtn) {
        if (_micRec.active) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            _notify('Microphone not available on this device.', 'warning'); return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                _micRec.stream   = stream;
                _micRec.chunks   = [];
                _micRec.active   = true;
                _micRec.recorder = new MediaRecorder(stream);

                _micRec.recorder.addEventListener('dataavailable', function(e) {
                    if (e.data && e.data.size > 0) _micRec.chunks.push(e.data);
                });

                _micRec.recorder.addEventListener('stop', function() {
                    _micRec.active = false;
                    if (_micRec.stream) {
                        _micRec.stream.getTracks().forEach(function(t){ t.stop(); });
                        _micRec.stream = null;
                    }
                    if (!_micRec._cancelled) {
                        var blob = new Blob(_micRec.chunks, { type: 'audio/webm' });
                        var file = new File([blob], 'voice-note-' + Date.now() + '.webm', { type: 'audio/webm' });
                        _sendFile(file);
                    }
                    _micRec.chunks = [];
                    _micRec._cancelled = false;
                });

                _micRec.recorder.start();

                _showRecordingBar(
                    micBtn,
                    /* onStop  */ function() { _stopRecording(false); },
                    /* onCancel*/ function() { _stopRecording(true);  }
                );
            })
            .catch(function(err) {
                _notify('Microphone permission denied: ' + (err.message || err), 'warning');
            });
    }

    function _stopRecording(cancel) {
        _hideRecordingBar();
        _micRec._cancelled = !!cancel;
        if (_micRec.recorder && _micRec.active) {
            try { _micRec.recorder.stop(); } catch(e) {}
        }
    }

    function _wiresMicBtn(micBtn) {
        /* WhatsApp behaviour: click once to start, click send-checkmark to send,
           click trash to cancel. The mic button itself only starts recording. */
        micBtn.addEventListener('click', function() {
            if (_micRec.active) return; /* recording bar handles stop */
            _startRecording(micBtn);
        });
    }

    /* =========================================================================
       §11  SUBSCRIBE TO FIRESTORE MESSAGES
       ========================================================================= */
    function _subscribe(myId, peerId) {
        _stopListener();
        if (!_fbOk()) {
            var loading = document.getElementById('oc-loading');
            if (loading) loading.textContent = 'You appear to be offline.';
            return;
        }
        var chatId = _buildChatId(myId, peerId);
        _seenDates = {};
        var body = document.getElementById('oc-messages-body');

        /* Clear loading */
        var loading = document.getElementById('oc-loading');
        if (loading) loading.textContent = 'Loading…';

        /* Try chatId query first, fall back to where senderId/receiverId */
        try {
            _unsub = window.fbDb.collection('messages')
                .where('chatId', '==', chatId)
                .orderBy('createdAt', 'asc')
                .limit(80)
                .onSnapshot(function(snap) {
                    var loading2 = document.getElementById('oc-loading');
                    if (loading2) loading2.remove();
                    if (!snap || snap.empty) {
                        var body2 = document.getElementById('oc-messages-body');
                        if (body2 && !body2.querySelector('.oc-row')) {
                            var empty = document.createElement('div');
                            empty.id = 'oc-empty';
                            empty.style.cssText = 'text-align:center;padding:40px 20px;color:#9CA3AF;font-size:0.88rem;';
                            empty.innerHTML = '<div style="font-size:2rem;margin-bottom:8px;">👋</div>Say hello to <strong>' + _esc(_peerName) + '</strong>';
                            body2.appendChild(empty);
                        }
                        return;
                    }
                    snap.docChanges().forEach(function(ch) {
                        if (ch.type !== 'added') return;
                        var data = ch.doc.data();
                        data.id  = ch.doc.id;
                        /* Skip if already rendered */
                        var b2 = document.getElementById('oc-messages-body');
                        if (b2 && b2.querySelector('[data-msg-id="' + data.id + '"]')) return;
                        /* Remove empty state */
                        var em = document.getElementById('oc-empty');
                        if (em) em.remove();
                        var row = _buildBubble(data, myId);
                        row.dataset.msgId = data.id;
                        _appendBubble(row, data.createdAt);
                    });
                }, function(err) {
                    /* chatId query likely missing composite index — use fallback */
                    console.warn('[OC] chatId query failed:', err.message, '— trying fallback');
                    _subscribeByParticipants(myId, peerId);
                });
        } catch(e) {
            _subscribeByParticipants(myId, peerId);
        }
    }

    function _subscribeByParticipants(myId, peerId) {
        /* Fallback: two parallel queries, merge in JS */
        _stopListener();
        if (!_fbOk()) return;
        var rendered = {};

        function _handleSnap(snap) {
            if (!snap) return;
            var loading = document.getElementById('oc-loading');
            if (loading) loading.remove();
            snap.docChanges().forEach(function(ch) {
                if (ch.type !== 'added') return;
                var data = ch.doc.data();
                data.id  = ch.doc.id;
                /* Only between these two users */
                var ok = (data.senderId===myId && data.receiverId===peerId) ||
                         (data.senderId===peerId && data.receiverId===myId);
                if (!ok) return;
                if (rendered[data.id]) return;
                rendered[data.id] = true;
                var em = document.getElementById('oc-empty');
                if (em) em.remove();
                var row = _buildBubble(data, myId);
                row.dataset.msgId = data.id;
                _appendBubble(row, data.createdAt);
            });
        }

        try {
            var unsub1 = window.fbDb.collection('messages')
                .where('senderId',  '==', myId)
                .where('receiverId','==', peerId)
                .orderBy('createdAt','asc').limit(80)
                .onSnapshot(_handleSnap, function(){});
            var unsub2 = window.fbDb.collection('messages')
                .where('senderId',  '==', peerId)
                .where('receiverId','==', myId)
                .orderBy('createdAt','asc').limit(80)
                .onSnapshot(_handleSnap, function(){});
            _unsub = function() { try{ unsub1(); }catch(e){} try{ unsub2(); }catch(e){} };
        } catch(e){
            var loading = document.getElementById('oc-loading');
            if (loading) loading.textContent = 'Could not load messages.';
        }
    }


    /* =========================================================================
       §12  LOOK UP PEER USER
       ========================================================================= */
    function _lookUpUser(userId, cb) {
        /* 1. Check mockUsers (in-memory, populated from Firestore on login) */
        var mu = window.mockUsers && window.mockUsers[userId];
        if (mu) return cb(mu);

        /* 2. Firestore lookup */
        if (_fbOk()) {
            window.fbDb.collection('users').doc(userId).get()
                .then(function(doc) {
                    if (doc.exists) {
                        var data = doc.data(); data.id = doc.id;
                        if (window.mockUsers) window.mockUsers[userId] = data;
                        cb(data);
                    } else {
                        cb({ id:userId, fullName:'', username:'', avatar:'' });
                    }
                })
                .catch(function() { cb({ id:userId, fullName:'', username:'', avatar:'' }); });
        } else {
            cb({ id:userId, fullName:'', username:'', avatar:'' });
        }
    }


    /* =========================================================================
       §12b  HIDE STATUS/STORY BAR  (runtime — handles any class name)
       ========================================================================= */
    function _hideStatusBar() {
        /* Directly hide by ID — works regardless of where it lives in the DOM */
        var sbc = document.getElementById('status-bar-container');
        if (sbc) sbc.style.setProperty('display', 'none', 'important');
    }
    function _showStatusBar() {
        /* Restore status bar when leaving messages section */
        var sbc = document.getElementById('status-bar-container');
        if (sbc) sbc.style.removeProperty('display');
    }

    /* =========================================================================
       §13  MAIN: window.openChat(userId, optionalName)
       ========================================================================= */
    window.openChat = function(userId, optionalName) {
        if (!userId) return;
        if (_isGuest()) { if (typeof window.openAuthModal==='function') window.openAuthModal('login'); return; }

        var myUser = _us();

        /* Inject styles once */
        _injectStyles();
        _buildEmojiBar();

        /* Mark active in contact list */
        document.querySelectorAll('.contact-item').forEach(function(el) {
            el.classList.toggle('active', el.dataset.userId === userId);
        });

        /* Show chat-view-container, hide placeholder on mobile */
        var cv = document.getElementById('chat-view-container');
        var ph = document.getElementById('chat-placeholder');
        if (cv) {
            /* Move to direct child of <body> to escape any parent overflow/transform/
               stacking-context traps that prevent position:fixed from covering the full
               viewport (causing the "← Messages" header to bleed through above). */
            if (cv.parentNode !== document.body) {
                cv._ocOrigParent = cv.parentNode;
                cv._ocOrigNextSibling = cv.nextSibling;
                document.body.appendChild(cv);
            }
            cv.classList.add('oc-mobile-open');
        }
        if (!_chatHistoryPushed) {
            try {
                history.pushState({ _ocChatOpen: true }, '', location.href);
                _chatHistoryPushed = true;
            } catch (err) { /* pushState unsupported/blocked — silently skip, taps/X still work */ }
        }
        if (ph) { ph.style.display = 'none'; }
        document.body.classList.add('oc-chat-open');
        document.body.classList.add('oc-in-messages');

        /* Wipe any stale legacy markup (old composer with its own attach/voice/
           emoji/send icons) the INSTANT the panel goes full-screen — don't wait
           for _buildChatView(), which only runs after the async user lookup
           below resolves. On a slow connection (or while the Firestore
           permissions/listener errors are being worked around) that gap was
           visible as a half-built panel with the wrong icons. A simple loading
           skeleton here means the user never sees old markup, only ever sees
           "our" UI, even before the peer's name/avatar have loaded. */
        if (cv && !(_peerId === userId && document.getElementById('oc-chat-header'))) {
            cv.innerHTML = '<div id="oc-chat-header" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1B2B8B;min-height:58px;"></div>' +
                            '<div id="oc-loading" style="text-align:center;padding:32px;color:#9CA3AF;font-size:0.85rem;flex:1;">Loading…</div>';
        }

        /* Remove the contact-list back header if present — chat panel supersedes it */
        var staleClHdr = document.getElementById('oc-cl-header');
        if (staleClHdr) staleClHdr.remove();
        var staleClBtn = document.getElementById('oc-cl-back-btn');
        if (staleClBtn) { staleClBtn._ocWired = false; staleClBtn.removeAttribute('id'); }
        /* Restore any app header that _installContactListBackBtn may have hidden */
        var mV0 = document.getElementById('messages-view');
        if (mV0) {
            var hiddenHdr = mV0.querySelector('.messages-header,.chat-list-header,#messages-header,[class*="messages-header"],[class*="chat-list-header"]');
            if (hiddenHdr && hiddenHdr.style.display === 'none') hiddenHdr.style.removeProperty('display');
        }
        /* Actively hide the status/stories avatar strip */
        _hideStatusBar();

        /* If same peer, just scroll to bottom */
        if (_peerId === userId && document.getElementById('oc-chat-header')) {
            var body = document.getElementById('oc-messages-body');
            if (body) body.scrollTop = body.scrollHeight;
            return;
        }

        _peerId = userId;

        /* Use optionalName immediately so call modal shows the right name before Firestore returns */
        if (optionalName) { _peerName = optionalName; }

        /* Also try to read name from the clicked contact-item in the DOM (fastest path) */
        if (!_peerName || _peerName === 'User') {
            var contactEl = document.querySelector('.contact-item[data-user-id="' + userId + '"],.contact-item[data-userId="' + userId + '"]');
            if (contactEl) {
                var nameNode = contactEl.querySelector('.contact-name,.contact-info h4,.contact-info strong,strong,b,[class*="name"]');
                if (nameNode && nameNode.textContent.trim()) { _peerName = nameNode.textContent.trim(); }
                if (!_peerAvatar) {
                    var avNode = contactEl.querySelector('img');
                    if (avNode && avNode.src) { _peerAvatar = avNode.src; }
                }
            }
        }

        /* Look up peer profile */
        _lookUpUser(userId, function(peer) {
            var resolved = peer.fullName || peer.username || peer.displayName || '';
            _peerName   = (optionalName && optionalName !== 'User') ? optionalName
                        : (resolved && resolved !== 'User')         ? resolved
                        : _peerName || 'User';
            _peerAvatar = peer.avatar   || peer.profilePicture || peer.photoURL || peer.profilePhoto || _peerAvatar || '';

            /* Build the WhatsApp-style UI */
            _buildChatView(_peerId, _peerName, _peerAvatar);

            /* Subscribe to messages */
            _subscribe(myUser.id || '', _peerId);
        });
    };

    /* Also expose as openChatWith for marketplace overlay compatibility */
    window.openChatWith = window.openChatWith || function(userId, name) {
        window.openChat(userId, name);
    };

    /* =========================================================================
       §13b  GUARD AGAINST COMPETING BACK-BUTTON INJECTORS
       -------------------------------------------------------------------------
       app-fix-final.js (§9) wraps window.openChat AFTER this file runs and,
       400ms after every openChat() call, injects its OWN button
       (#vf-chat-back-btn) as the first child of #chat-view-container. That
       button has different close logic than ours and is what produces the
       "two back/exit controls" + visual duplication bugs. We can't safely
       edit app-fix-final.js (it owns many unrelated features), so instead we
       watch #chat-view-container and strip that button the instant it
       appears — every time, for the life of the page.
       ========================================================================= */
    (function _guardAgainstDuplicateBackBtn() {
        function _strip() {
            /* Search the WHOLE document, not just cv — some versions of
               app-fix-final.js append their button straight to <body> as a
               fixed-position overlay rather than nesting it inside
               #chat-view-container, which a cv-scoped query would miss. */
            var dup = document.querySelector('#vf-chat-back-btn');
            if (dup) dup.remove();
        }
        function _attach() {
            var cv = document.getElementById('chat-view-container');
            if (!cv || cv._ocGuarded) return;
            cv._ocGuarded = true;
            _strip();
            if (window.MutationObserver) {
                /* subtree:true — catches insertions anywhere under <body>,
                   not just direct children of cv, in case the duplicate is
                   nested inside our own header or appended elsewhere. */
                new MutationObserver(_strip).observe(document.body, { childList: true, subtree: true });
            }
            /* Safety-net poll: some WebViews fire MutationObserver callbacks
               in batched/async ways that can lag behind a fast 400ms
               inject-then-tap sequence, so also check on a timer. */
            if (!window._ocBackBtnPoll) {
                window._ocBackBtnPoll = setInterval(_strip, 300);
            }
        }
        if (document.readyState !== 'loading') _attach();
        else document.addEventListener('DOMContentLoaded', _attach);
        /* chat-view-container gets moved to <body> on open — re-check then too */
        var _origOpenChat = window.openChat;
        window.openChat = function() {
            _attach();
            return _origOpenChat.apply(this, arguments);
        };
    })();

    /* =========================================================================
       §13c  GEOMETRIC FALLBACK FOR THE CLOSE (X) BUTTON
       -------------------------------------------------------------------------
       Belt-and-suspenders against the exact symptom reported: the X looks
       right and sits at max z-index, but tapping it does nothing. That
       happens when some OTHER element — invisible, transparent, or simply
       unknown to us — is physically on top of it in the paint order and
       swallows the tap before it ever reaches #oc-back-btn. Rather than
       trying to guess every possible culprit element, we hit-test by
       SCREEN COORDINATES: any tap/click landing inside the close button's
       visible box closes the chat, regardless of which element actually
       received the event. Shares _closeDebounce with the button's own
       listeners (§7) so a tap that DOES reach the real button correctly
       can never double-fire this fallback.
       ========================================================================= */
    (function _installCloseBtnGeometricFallback() {
        /* FIX: this used to hit-test by SCREEN COORDINATES ONLY, with no check
           on what was actually clicked. Once the section-overlap/inline-style
           bug was fixed and the chat header started laying out at its correct,
           stable position, the video-call, voice-call, emoji, and voice-note
           buttons in that same header could end up sitting inside (or very
           near) #oc-back-btn's last-measured bounding box during a reflow.
           Any click landing in that box — including clicks squarely on those
           OTHER buttons — was treated as a tap on the X, and _doCloseChat()
           immediately calls ev.stopPropagation()/preventDefault(), which
           killed the click before it ever reached the real button's own
           listener. That's why those four controls silently stopped working.
           FIX: require the click's TARGET to actually be #oc-back-btn (or a
           descendant of it, e.g. its inner <svg>/<path>) in addition to the
           coordinate check. This still catches the original "invisible
           overlay sitting on top of the real button" case the coordinate
           check was built for, since closest() walks up from whatever
           element was actually clicked — but it can no longer fire for a
           click that lands on a completely different, unrelated button. */
        function _hit(x, y) {
            var btn = document.getElementById('oc-back-btn');
            if (!btn || !document.body.contains(btn)) return false;
            var r = btn.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false; /* hidden/detached */
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }
        function _isActualBackBtnTarget(ev) {
            var btn = document.getElementById('oc-back-btn');
            if (!btn) return false;
            var t = ev.target;
            return !!(t && typeof t.closest === 'function' && t.closest('#oc-back-btn') === btn);
        }
        function _trigger(ev) {
            /* Only close if the chat panel is actually open — prevents spurious
               triggers after the chat has already been closed (e.g. tapping the
               same screen region on the contact list). */
            var cv = document.getElementById('chat-view-container');
            if (!cv || !cv.classList.contains('oc-mobile-open')) return;
            if (_closeDebounce) return;
            _closeDebounce = true;
            setTimeout(function() { _closeDebounce = false; }, 600);
            if (typeof _activeCloseHandler === 'function') _activeCloseHandler(ev);
        }
        /* IMPORTANT: only ever trigger via coordinates when the click target is
           NOT a recognizable interactive control of its own (button, link, or
           anything with a click handler-bearing role). That preserves the
           original goal — catching a truly invisible/transparent overlay that
           swallows taps meant for the X — without ever stealing a click that
           legitimately landed on the video/call/emoji/mic buttons (or any
           other real control) just because it happened to sit inside the X
           button's last-measured box. */
        function _targetIsOtherInteractiveControl(ev) {
            var t = ev.target;
            if (!t || typeof t.closest !== 'function') return false;
            var el = t.closest('button, a, input, textarea, select, [role="button"], [onclick]');
            return !!(el && el.id !== 'oc-back-btn');
        }
        document.addEventListener('click', function(ev) {
            if (_isActualBackBtnTarget(ev)) return; /* real listener on the button already handles this */
            if (_targetIsOtherInteractiveControl(ev)) return; /* never steal clicks meant for a different control */
            if (_hit(ev.clientX, ev.clientY)) _trigger(ev);
        }, true); /* capture phase — runs before whatever intercepted the event can stop it */
        document.addEventListener('touchend', function(ev) {
            if (_isActualBackBtnTarget(ev)) return;
            if (_targetIsOtherInteractiveControl(ev)) return;
            var t = ev.changedTouches && ev.changedTouches[0];
            if (t && _hit(t.clientX, t.clientY)) _trigger(ev);
        }, { capture: true, passive: false });
    })();

    /* =========================================================================
       §13d  CLOSE VIA HARDWARE/BROWSER BACK BUTTON
       -------------------------------------------------------------------------
       A deliberately DIFFERENT mechanism from everything above: this doesn't
       listen for clicks or taps on any element at all. openChat() pushes a
       history entry; pressing the phone's back button (hardware key, gesture,
       or the browser's own back control) fires a native 'popstate' event
       BEFORE the event ever touches page-level DOM elements, so it cannot be
       swallowed by an overlapping element, an inspector overlay, or any
       other script's click handling the way a tap on #oc-back-btn can be.
       This gives the user a guaranteed second way to exit the chat even in
       environments where every tap-based approach is being intercepted.
       ========================================================================= */
    window.addEventListener('popstate', function(ev) {
        if (!_chatHistoryPushed) return; /* no chat-related entry was open — not ours to handle */
        var cv = document.getElementById('chat-view-container');
        var isOpen = !!(cv && cv.classList.contains('oc-mobile-open'));
        /* Clear flag FIRST before calling handler, so any synchronous side-effects
           that check _chatHistoryPushed see the correct state immediately. */
        _chatHistoryPushed = false;
        if (isOpen && typeof _activeCloseHandler === 'function') {
            _activeCloseHandler(ev, /* _viaPopstate */ true);
        }
    });

    /* Legacy alias used inside app-fixes.js scope */
    if (!window._openChatWithUser) {
        window._openChatWithUser = function(userObj) {
            window.openChat((userObj||{}).id || '', (userObj||{}).fullName || (userObj||{}).username || '');
        };
    }

    /* =========================================================================
       §14  REWIRE CONTACT-ITEM CLICKS (belt-and-suspenders)
            app-fixes.js wires .contact-item clicks and calls openChat().
            Now that openChat exists, those clicks will work automatically.
            But we also add a direct listener as fallback.
       ========================================================================= */
    _ready(function() {
        /* Styles + placeholder must exist before any chat is opened, not just
           lazily inside openChat() — otherwise desktop shows a blank panel
           until the first click. */
        _injectStyles();
        _ensurePlaceholder();

        /* Mark body when messages section is active — hides status bar avatars */
        function _checkMessagesVisible() {
            var mView = document.getElementById('messages-view');
            var visible = mView && mView.style.display !== 'none' && mView.offsetParent !== null;
            document.body.classList.toggle('oc-in-messages', !!visible);
            /* Directly control status bar visibility based on whether messages section is open */
            if (visible) {
                _hideStatusBar();
            } else {
                _showStatusBar();
            }
        }
        _checkMessagesVisible();

        /* FIX (bug: nav bar always landing on Messages / overlapping-split
           sections): several functions in this file (chat close button,
           contact-list exit button) used to write inline style.display
           directly onto .content-section elements. Inline styles always
           beat the app's own class-based CSS, so once one of those ran,
           a section could get permanently stuck visible or hidden no
           matter what the real router did afterward — which is exactly
           why every nav-bar tap kept showing/overlapping with Messages.
           Those call sites have been fixed to stop writing inline styles,
           but as a safety net (covering any stale styles already present,
           or written by other scripts) we strip inline display from every
           .content-section EXCEPT the one being navigated to, on every
           single navigateTo() call. */
        function _clearStaleSectionDisplay(targetSection) {
            document.querySelectorAll('.content-section').forEach(function(s) {
                if (s.id !== targetSection) s.style.removeProperty('display');
            });
        }

        /* Patch navigateTo so we track when messages section opens/closes */
        var _origNavigateTo = window.navigateTo;
        window._origNavigateTo = _origNavigateTo; /* expose for back button */
        window.navigateTo = function(section) {
            if (typeof _origNavigateTo === 'function') _origNavigateTo(section);
            /* Clean up immediately, then again after the router's own async
               work (if any) settles — matches the existing 80ms tick below. */
            _clearStaleSectionDisplay(section);
            setTimeout(function() {
                _clearStaleSectionDisplay(section);
                _checkMessagesVisible();
            }, 80);
        };
        /* Also watch for display changes via MutationObserver */
        if (window.MutationObserver) {
            var _navObs = new MutationObserver(_checkMessagesVisible);
            var _root = document.getElementById('main-content') || document.getElementById('app-content') || document.body;
            _navObs.observe(_root, { attributes: true, subtree: true, attributeFilter: ['style','class'] });
        }

        document.addEventListener('click', function(e) {
            var item = e.target.closest('.contact-item');
            if (!item) return;
            var uid = item.dataset.userId;
            if (!uid) return;
            e.preventDefault();
            var mView = document.getElementById('messages-view');
            if (!mView || mView.style.display === 'none') {
                if (typeof window.navigateTo === 'function') window.navigateTo('messages');
                setTimeout(function() { window.openChat(uid); }, 220);
            } else {
                window.openChat(uid);
            }
        }, true); /* capture phase */
    });

    /* ── Patch renderStatusBar so it cannot override our status bar hide while in messages ── */
    (function() {
        function _messagesVisible() {
            var mView = document.getElementById('messages-view');
            return !!(mView && mView.style.display !== 'none' && mView.offsetParent !== null);
        }
        function _patchRenderStatusBar() {
            var orig = window.renderStatusBar;
            if (!orig || orig._ocPatched) return;
            window.renderStatusBar = function() {
                orig.apply(this, arguments);
                /* app-status.js sets sbc.style.display='block' — override it if messages is open */
                if (_messagesVisible() || document.body.classList.contains('oc-chat-open')) {
                    var sbc = document.getElementById('status-bar-container');
                    if (sbc) sbc.style.setProperty('display', 'none', 'important');
                }
            };
            window.renderStatusBar._ocPatched = true;
        }
        if (window.renderStatusBar) {
            _patchRenderStatusBar();
        } else {
            var _pi = setInterval(function() {
                if (window.renderStatusBar) { _patchRenderStatusBar(); clearInterval(_pi); }
            }, 200);
        }
    })();

    /* =========================================================================
       §15  BROKEN AVATAR FALLBACK (contact list + status strip)
       ========================================================================= */
    (function _fixBrokenAvatars() {
        function _fallbackUrl(img) {
            var name = img.alt || '';
            if (!name) {
                var row = img.closest('.contact-item') || img.closest('[class*="status"]') || img.parentElement;
                if (row) {
                    var nameNode = row.querySelector('.contact-name,strong,b,h4,h3,[class*="name"]');
                    if (nameNode) name = nameNode.textContent.trim();
                }
            }
            return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || '?') + '&background=1B2B8B&color=fff&size=80';
        }
        function _wire(img) {
            if (!img || img._ocAvatarWired) return;
            img._ocAvatarWired = true;
            function _handleBroken() {
                if (img._ocFellBack) return;
                img._ocFellBack = true;
                img.src = _fallbackUrl(img);
            }
            img.addEventListener('error', _handleBroken);
            if (img.complete && img.naturalWidth === 0 && img.src) _handleBroken();
        }
        function _scan(root) {
            if (!root || !root.querySelectorAll) return;
            root.querySelectorAll('#contact-list-container img, #status-bar-container img, .contact-item img').forEach(_wire);
        }
        _ready(function() {
            _scan(document);
            if (window.MutationObserver) {
                var obs = new MutationObserver(function(mutations) {
                    mutations.forEach(function(m) {
                        m.addedNodes && m.addedNodes.forEach(function(node) {
                            if (node.nodeType !== 1) return;
                            if (node.tagName === 'IMG') { _wire(node); return; }
                            _scan(node);
                        });
                    });
                });
                var clRoot = document.getElementById('contact-list-container');
                var sbRoot = document.getElementById('status-bar-container');
                if (clRoot) obs.observe(clRoot, { childList: true, subtree: true });
                if (sbRoot) obs.observe(sbRoot, { childList: true, subtree: true });
            }
            var _tries = 0;
            var _rescan = setInterval(function() {
                _scan(document);
                if (++_tries >= 10) clearInterval(_rescan);
            }, 500);
        });
    })();

    console.log('[EmpyreanOpenChat] ✅ window.openChat defined — WhatsApp-style chat UI + emoji reactions ready.');

})();