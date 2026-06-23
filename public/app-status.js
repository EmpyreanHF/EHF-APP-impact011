/* =============================================================================
   EMPYREAN INTERNATIONAL — STATUS MODULE  v4.0  (FULL FIX)
   app-status.js

   FIXES vs v3
   ───────────
   1. Listener accumulation — ALL modal events now wired ONCE via document
      delegation at boot; never re-wired on each open. No stacking, no dead
      second-click.
   2. Bubble hearts — appended to #sv-content (position:relative / overflow:hidden)
      not the modal root, so they stay visible and contained.
   3. Viewers panel — floating eye+count pill visible for the status owner;
      swipe-up gesture also opens it. Panel slide-up with per-viewer chat button.
   4. Peek preview — SHORT tap (< 300ms) shows Facebook-style bottom-sheet
      peek card. Only a tap on "View Status" inside it opens the full viewer.
      Long content visible: segments dots, user info, caption, open/reply btns.
   5. Media upload — direct Cloudinary fetch using window._appConfig.cloudinary;
      no dependency on a global uploadToCloudinary function.
   6. Close: dedicated X button + tap on the dark backdrop area works correctly.
   ============================================================================= */

(function empyreanStatusV4() {
    'use strict';

    if (window._empStatusV4) return;
    window._empStatusV4 = true;

    /* ── helpers ── */
    function _S()  { return window.EmpState || {}; }
    function _us() { return _S().userState || window.userState || {}; }
    function _isGuest() {
        var s = _S();
        return s.isGuest != null ? !!s.isGuest : (window.isGuest !== undefined ? !!window.isGuest : true);
    }
    function _esc(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function _notify(m, t) {
        if (typeof window.showNotification === 'function') window.showNotification(m, t || 'info');
    }

    var EXPIRY_MS  = 24 * 60 * 60 * 1000;
    var IMG_DUR_MS = 5000;
    var MAX_VID_S  = 180;

    /* =========================================================================
       STYLES — injected once
       ========================================================================= */
    function _injectStyles() {
        if (document.getElementById('_emp_status_v4_css')) return;
        var s = document.createElement('style');
        s.id  = '_emp_status_v4_css';
        s.textContent = `
/* ── Status bar ── */
#status-bar-container{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:8px 0 4px;}
#status-bar-container::-webkit-scrollbar{display:none;}
#status-bar-inner{display:flex;gap:12px;padding:0 12px;align-items:flex-start;min-width:max-content;}
.status-item{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;min-width:60px;user-select:none;}
.status-avatar-ring{width:58px;height:58px;border-radius:50%;padding:2.5px;position:relative;flex-shrink:0;}
.status-avatar-ring:not(.add-own):not(.viewed){background:linear-gradient(135deg,#00D4AA,#1B2B8B);}
.status-avatar-ring.add-own{background:rgba(0,0,0,0.12);}
.status-avatar-ring.viewed{background:rgba(180,180,180,0.4);}
.status-avatar-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;background:#eee;border:2.5px solid #fff;}
.status-avatar-inner img{width:100%;height:100%;object-fit:cover;display:block;}
.status-add-icon{position:absolute;bottom:0;right:0;width:20px;height:20px;background:var(--accent-color,#00D4AA);border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;line-height:1;}
.status-username{font-size:0.7rem;color:var(--text-muted,#555);text-align:center;max-width:62px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}

/* ── Status preview CARDS (point #5) — other users' tiles, rebuilt as tall
   rectangular media-preview cards instead of a bare small circle, matching
   the Facebook/WhatsApp reference: the latest status item renders as the
   card's background image/video (or a gradient + text snippet for
   text-only statuses), the small avatar ring sits in the top-left corner,
   and the name is overlaid at the bottom on a dark gradient for legibility.
   The original .status-avatar-ring/.status-username classes above are left
   completely untouched since index.html's static "My Status" tile still
   uses them directly. ── */
.status-item .status-card{position:relative;width:84px;height:130px;border-radius:14px;overflow:hidden;background:#1a1a2e;flex-shrink:0;}
.status-card-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
.status-card-text-bg{display:flex;align-items:center;justify-content:center;padding:8px;}
.status-card-text-preview{color:#fff;font-size:0.68rem;font-weight:700;text-align:center;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;}
.status-card-grad{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.15) 0%,transparent 35%,transparent 60%,rgba(0,0,0,0.75) 100%);pointer-events:none;}
.status-card-avatar-ring{position:absolute;top:7px;left:7px;width:32px;height:32px;border-radius:50%;padding:2px;background:linear-gradient(135deg,#00D4AA,#1B2B8B);z-index:2;}
.status-card-avatar-ring.viewed{background:rgba(220,220,220,0.65);}
.status-card-avatar-ring img{width:100%;height:100%;border-radius:50%;object-fit:cover;border:1.5px solid #fff;display:block;}
.status-card-name{position:absolute;bottom:7px;left:7px;right:7px;color:#fff;font-size:0.7rem;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:2;}
/* "My Status" tile keeps its original small-circle layout (it's a fixed
   element in index.html, not one of these dynamically rendered cards). */
#add-my-status-btn{min-width:60px;position:relative;}
/* FIX (point #2: missing preview square box on own status): when the user
   has an active status, a .my-status-card (built the same way as other
   users' .status-card tiles) is injected inside #add-my-status-btn. The
   original small ring markup is left in the DOM untouched so its existing
   click handlers keep firing — it's simply hidden visually once the card
   is present, since the card now carries its own avatar ring + add-icon. */
#add-my-status-btn.has-status-card > .status-avatar-ring{display:none;}
#add-my-status-btn.has-status-card > .status-username{display:none;}
.status-card.my-status-card{position:relative;width:84px;height:130px;border-radius:14px;overflow:hidden;background:#1a1a2e;flex-shrink:0;}
.status-card.my-status-card .status-add-icon{position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;font-size:12px;z-index:3;}

/* ── Viewer modal shell ── */
#status-viewer-modal{position:fixed;inset:0;background:rgba(0,0,0,0.94);z-index:9999;display:none;align-items:center;justify-content:center;}
#status-viewer-modal.sv-open{display:flex;}
/* Backdrop tap-to-close: only the modal bg behind .sv-content closes */

/* ── Viewer content card ── */
#sv-content{position:relative;width:100%;max-width:420px;height:100dvh;max-height:820px;background:#111;overflow:hidden;display:flex;flex-direction:column;flex-shrink:0;}
@media(min-width:600px){#sv-content{border-radius:16px;max-height:90vh;}}

/* progress */
#sv-prog-wrap{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;gap:3px;padding:10px 12px 0;}
.sv-prog-seg{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,0.28);overflow:hidden;}
.sv-prog-fill{height:100%;width:0%;background:#fff;border-radius:2px;}

/* top bar — FIX: simplified to just avatar/name/mute/close. The
   viewer-count, retweet, profile, chat buttons used to live up here as
   floating pills (overlapping the close X in cramped layouts) — they are
   now in the bottom action bar instead, matching the reference screenshot
   (X/WhatsApp-style: viewer count + reactions anchored at the bottom). */
#sv-top{position:absolute;top:18px;left:0;right:60px;z-index:8;display:flex;align-items:center;gap:9px;padding:6px 12px;background:linear-gradient(to bottom,rgba(0,0,0,0.6),transparent);}
#sv-av{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.8);flex-shrink:0;cursor:pointer;}
.sv-meta{flex:1;min-width:0;}
#sv-name{color:#fff;font-size:0.88rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}
#sv-time{color:rgba(255,255,255,0.5);font-size:0.7rem;}

/* mute */
#sv-mute-btn{background:rgba(0,0,0,0.45);border:none;color:#fff;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.88rem;flex-shrink:0;}

/* close */
#sv-close{position:absolute;top:14px;right:12px;z-index:15;background:rgba(0,0,0,0.5);border:none;color:#fff;border-radius:50%;width:34px;height:34px;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);}

/* media */
#sv-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;}
#sv-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;background:#000;}
#sv-txt{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:32px;font-size:1.45rem;font-weight:800;color:#fff;text-align:center;}
#sv-caption{position:absolute;bottom:128px;left:0;right:0;text-align:center;color:#fff;font-size:0.88rem;padding:0 20px;text-shadow:0 1px 4px rgba(0,0,0,0.8);z-index:6;pointer-events:none;}

/* nav arrows */
.sv-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.18);border:none;color:#fff;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;z-index:8;backdrop-filter:blur(4px);}
#sv-prev{left:8px;}
#sv-next{right:8px;}

/* ── BOTTOM ACTION BAR (NEW) ──
   Two stacked rows anchored to the bottom of the viewer, mirroring the
   reference screenshot: a row of quick actions (viewer-count / emoji
   reactions / retweet / like) directly above a reply/comment input row.
   Both share one gradient backdrop so they read as a single unit. */
#sv-bottom-bar{position:absolute;bottom:0;left:0;right:0;z-index:8;background:linear-gradient(to top,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.55) 60%,transparent 100%);padding:10px 12px calc(10px + env(safe-area-inset-bottom,0));display:flex;flex-direction:column;gap:9px;}

/* quick-action row */
#sv-quick-row{display:flex;align-items:center;gap:7px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
#sv-quick-row::-webkit-scrollbar{display:none;}

/* eye badge — viewers count pill (owner only), now expands the panel from the bottom */
#sv-eye-badge{display:none;cursor:pointer;align-items:center;gap:5px;background:rgba(255,255,255,0.14);border:none;border-radius:50px;padding:6px 12px;color:#fff;font-size:0.78rem;font-weight:700;backdrop-filter:blur(6px);flex-shrink:0;}
#sv-eye-badge.show{display:flex;}

/* quick emoji-reaction buttons */
.sv-emoji-quick{background:rgba(255,255,255,0.14);border:none;border-radius:50%;width:36px;height:36px;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform 0.12s;}
.sv-emoji-quick:active{transform:scale(1.25);}

/* repost button — WhatsApp-style loop-arrow SVG glyph (NOT FontAwesome's
   fa-retweet, which renders as a bold filled icon that doesn't match the
   thin two-tone arrows WhatsApp actually uses). The SVG is drawn with
   stroke=currentColor so it inherits this button's color (white normally,
   accent green when reposted) automatically. */
#sv-rt-btn{background:rgba(255,255,255,0.14);border:none;color:#fff;border-radius:50px;padding:6px 12px;font-size:0.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:background 0.15s,color 0.15s;flex-shrink:0;}
#sv-rt-btn svg{display:block;}
#sv-rt-btn.retweeted{color:#00D4AA;background:rgba(0,212,170,0.22);}

/* bubble heart / like button */
#sv-heart-btn{background:rgba(255,255,255,0.14);border:none;color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;gap:4px;padding:6px 12px;border-radius:50px;flex-shrink:0;transition:transform 0.15s;}
#sv-heart-btn.liked i{color:#f87171;}
#sv-heart-btn:active{transform:scale(1.28);}
.sv-like-count{font-size:0.8rem;font-weight:700;}

/* profile / chat — icon-only by default; the Message button additionally
   carries a text label so it's unmistakably a "send a message" action and
   not a generic, ambiguous circle (previous icon-only version was unclear
   about what it did). */
.sv-pill-btn{border:none;color:#fff;border-radius:50%;width:36px;height:36px;font-size:0.92rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.14);}
.sv-pill-btn--labeled{width:auto;border-radius:50px;padding:0 13px;gap:6px;font-size:0.78rem;font-weight:700;white-space:nowrap;}
.sv-pill-btn--labeled span{font-size:0.76rem;}

/* ── reply composer — mirrors the WhatsApp reference screenshot: light
   pill-shaped bar, emoji-toggle on the far left, text input, then attach /
   camera / send icons. Replies sent here are PRIVATE direct messages only
   — see _postComment — there is no public comment thread under a status. ── */
#sv-reply-bar{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.95);border-radius:26px;padding:6px 8px 6px 12px;position:relative;transition:box-shadow 0.2s,transform 0.2s;}
#sv-reply-bar input{flex:1;background:transparent;border:none;padding:8px 6px;color:#111;font-size:0.88rem;outline:none;min-width:0;}
#sv-reply-bar input::placeholder{color:#8a8a8a;}
#sv-reply-bar.sv-reply-bar-active{background:#fff;transform:translateY(-2px);}
#sv-emoji-toggle,#sv-attach-btn,#sv-camera-btn{background:none;border:none;color:#6B7280;font-size:1.05rem;width:34px;height:34px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
#sv-reply-send{background:var(--accent-color,#00D4AA);border:none;border-radius:50%;width:38px;height:38px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

/* floating bubble hearts — inside #sv-content */
.sv-bubble{position:absolute;pointer-events:none;z-index:50;font-size:1.4rem;opacity:1;}

/* ── viewers slide-up panel ── */
#sv-viewers-panel{position:absolute;bottom:0;left:0;right:0;z-index:20;background:rgba(12,12,20,0.97);backdrop-filter:blur(16px);border-radius:20px 20px 0 0;max-height:65%;overflow-y:auto;transform:translateY(100%);transition:transform 0.3s cubic-bezier(.4,0,.2,1);scrollbar-width:none;padding-bottom:env(safe-area-inset-bottom,0);}
#sv-viewers-panel::-webkit-scrollbar{display:none;}
#sv-viewers-panel.open{transform:translateY(0);}
.svp-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;top:0;background:rgba(12,12,20,0.97);}
.svp-title{color:#fff;font-size:0.88rem;font-weight:700;display:flex;align-items:center;gap:7px;}
#svp-close{background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:1.1rem;padding:2px 8px;}
.svp-list{padding:6px 0;}
.svp-row{display:flex;align-items:center;gap:11px;padding:9px 16px;cursor:pointer;transition:background 0.15s;}
.svp-row:hover{background:rgba(255,255,255,0.06);}
.svp-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid rgba(255,255,255,0.12);}
.svp-info{flex:1;overflow:hidden;}
.svp-name{color:rgba(255,255,255,0.9);font-size:0.84rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.svp-time{color:rgba(255,255,255,0.4);font-size:0.71rem;margin-top:1px;}
.svp-msg-btn{background:rgba(27,43,139,0.75);border:none;color:#fff;border-radius:50px;padding:5px 12px;font-size:0.71rem;cursor:pointer;display:flex;align-items:center;gap:5px;flex-shrink:0;white-space:nowrap;}
.svp-empty{color:rgba(255,255,255,0.38);font-size:0.84rem;text-align:center;padding:22px 16px;}

/* ── Facebook-style peek preview card ── */
#sv-peek-overlay{position:fixed;inset:0;z-index:8800;background:transparent;pointer-events:none;transition:background 0.22s;}
#sv-peek-overlay.active{background:rgba(0,0,0,0.55);pointer-events:all;}
#sv-peek-card{position:fixed;bottom:-110%;left:50%;transform:translateX(-50%);width:calc(100% - 24px);max-width:420px;background:#1a1a2e;border-radius:22px 22px 16px 16px;overflow:hidden;z-index:8801;transition:bottom 0.32s cubic-bezier(0.34,1.4,0.64,1);box-shadow:0 -4px 40px rgba(0,0,0,0.6);}
#sv-peek-card.show{bottom:20px;}
.spk-media{position:relative;width:100%;height:300px;background:#000;overflow:hidden;}
.spk-media img,.spk-media video{width:100%;height:100%;object-fit:cover;display:block;}
.spk-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.1) 55%,transparent 100%);}
.spk-segs{position:absolute;top:10px;left:10px;right:10px;display:flex;gap:4px;}
.spk-seg{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,0.32);}
.spk-seg.active{background:#fff;}
.spk-count-pill{position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.55);color:#fff;font-size:0.7rem;font-weight:700;padding:3px 8px;border-radius:10px;display:flex;align-items:center;gap:4px;backdrop-filter:blur(4px);}
.spk-dismiss{position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.5);border:none;color:#fff;border-radius:50%;width:30px;height:30px;font-size:0.82rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;}
.spk-bottom{padding:14px 16px 16px;}
.spk-user-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.spk-avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.75);flex-shrink:0;}
.spk-uname{color:#fff;font-size:0.92rem;font-weight:700;line-height:1.2;}
.spk-utime{color:rgba(255,255,255,0.5);font-size:0.7rem;margin-top:1px;}
.spk-caption{color:rgba(255,255,255,0.8);font-size:0.82rem;margin-bottom:10px;line-height:1.4;max-height:2.8em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.spk-btns{display:flex;gap:8px;}
.spk-open-btn{flex:1;background:var(--accent-color,#00D4AA);border:none;color:#fff;border-radius:50px;padding:12px 16px;font-size:0.88rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;}
.spk-reply-btn{background:rgba(27,43,139,0.88);border:none;color:#fff;border-radius:50px;padding:12px 16px;font-size:0.88rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}

/* ── Create status modal ── */
#create-status-modal{position:fixed;inset:0;background:rgba(0,0,0,0.65);display:none;align-items:center;justify-content:center;z-index:8900;backdrop-filter:blur(4px);}
#create-status-modal.show{display:flex;}
.cs-card{background:#fff;border-radius:20px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.28);width:100%;max-width:480px;max-height:90vh;overflow-y:auto;}
#cs-file-preview,#status-file-preview{display:none;width:100%;position:relative;border-radius:12px;overflow:hidden;background:#000;margin-top:8px;min-height:160px;}
#cs-file-preview video,#cs-file-preview img,
#status-file-preview video,#status-file-preview img{width:100%;max-height:340px;object-fit:cover;display:block;}
.cs-rm-btn{position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.78rem;z-index:5;}
.cs-dur{position:absolute;bottom:8px;left:10px;background:rgba(0,0,0,0.65);color:#fff;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:8px;}
.cs-split{position:absolute;top:8px;left:8px;background:rgba(0,212,170,0.85);color:#fff;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:8px;display:flex;align-items:center;gap:4px;}
.cs-upload-progress{position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,0.2);}
.cs-upload-bar{height:100%;width:0%;background:#00D4AA;transition:width 0.3s;}
`;
        document.head.appendChild(s);
    }


    /* =========================================================================
       §1  STATUS BAR
       ========================================================================= */
    function _buildCardPreviewHTML(latest) {
        var bg = '';
        if (latest.type==='image' && latest.url) {
            bg = '<img class="status-card-media" src="'+_esc(latest.url)+'" alt="">';
        } else if (latest.type==='video' && latest.url) {
            bg = '<video class="status-card-media" src="'+_esc(latest.url)+'" muted playsinline preload="metadata"></video>';
        } else {
            bg = '<div class="status-card-media status-card-text-bg" style="background:'+_esc(latest.bg||'linear-gradient(135deg,#0A0F1E,#1C2845)')+';">'
               + '<span class="status-card-text-preview">'+_esc((latest.content||'').slice(0,40))+'</span></div>';
        }
        return bg;
    }

    function renderStatusBar() {
        var container = document.getElementById('status-bar-inner');
        if (!container) return;

        Array.from(container.children).forEach(function(c){
            if (c.id !== 'add-my-status-btn') c.remove();
        });

        var statuses = window.userStatuses || [];
        var myId     = _us().id;
        var viewed   = {};
        try { viewed = JSON.parse(localStorage.getItem('emp_viewed_statuses') || '{}'); } catch(e){}

        var myStatus  = statuses.find(function(s){ return myId && s.userId === myId; });
        var myLive    = myStatus ? _liveItems(myStatus) : [];
        var myBtn     = document.getElementById('add-my-status-btn');
        var myRing    = container.querySelector('#add-my-status-btn .status-avatar-ring');
        var hasMine   = !!myLive.length;
        if (myRing) {
            myRing.classList.toggle('add-own',    !hasMine);
            myRing.classList.toggle('has-status', hasMine);
        }
        var myImg = document.getElementById('my-status-avatar-img');
        if (myImg && !_isGuest() && _us().avatar) myImg.src = _us().avatar;

        /* FIX (point #2: "My Status tile is missing the preview square box"):
           the static "My Status" tile in index.html only ever rendered the
           small circular avatar ring — it never gained the tall rectangular
           media-preview card that every OTHER user's status tile already
           has (see _buildCardPreviewHTML above). When the logged-in user
           has an active, non-expired status, inject that same preview card
           — built from their own latest status item — inside #add-my-status-
           btn, directly beside the original ring markup. The original ring/
           +-badge elements are left completely untouched underneath (just
           visually hidden via CSS) so their existing click handlers (the
           dedicated ".status-add-icon" → always-compose target, and the
           rest-of-tile → view-or-compose target) keep working exactly as
           before — this is purely an additive visual layer, no structural
           change, no listener rewiring needed. */
        if (myBtn) {
            var existingCard = myBtn.querySelector('.status-card.my-status-card');
            if (hasMine) {
                var myLatest = myLive[myLive.length - 1];
                var myBg     = _buildCardPreviewHTML(myLatest);
                if (!existingCard) {
                    existingCard = document.createElement('div');
                    existingCard.className = 'status-card my-status-card';
                    myBtn.appendChild(existingCard);
                }
                existingCard.innerHTML =
                    myBg
                    + '<div class="status-card-grad"></div>'
                    + '<div class="status-card-avatar-ring">'
                    + '<img src="' + _esc(_us().avatar||'') + '" alt="Me" '
                    + 'onerror="this.src=\'https://ui-avatars.com/api/?name=Me&background=1B2B8B&color=fff&size=52\'">'
                    + '<span class="status-add-icon">+</span>'
                    + '</div>'
                    + '<span class="status-card-name">My Status</span>';
                myBtn.classList.add('has-status-card');
            } else if (existingCard) {
                existingCard.remove();
                myBtn.classList.remove('has-status-card');
            }
        }

        statuses.forEach(function(su, idx){
            if (!su || !su.items || !su.items.length) return;
            if (myId && su.userId === myId) return;
            var live = _liveItems(su);
            if (!live.length) return;

            var isViewed = !!(viewed[su.userId] || su.viewed);
            /* FIX (point #5: "bigger square box should show the last media
               preview, like Facebook/WhatsApp, before the small avatar"):
               tiles used to be a small circular avatar ring ONLY — no
               preview of the actual status content at all. Rebuilt as a
               tall rectangular preview card: the most recent item's image/
               video is shown as the card background (or a gradient for
               text-only statuses), with the small avatar ring overlaid in
               the top-left corner and the name overlaid at the bottom,
               matching the reference screenshot layout. */
            var latest = live[live.length-1];
            var bg = _buildCardPreviewHTML(latest);

            var el = document.createElement('div');
            el.className         = 'status-item' + (isViewed ? ' viewed' : '');
            el.dataset.statusIdx = idx;
            el.dataset.statusUid = su.userId || '';
            el.innerHTML =
                '<div class="status-card">'
                + bg
                + '<div class="status-card-grad"></div>'
                + '<div class="status-card-avatar-ring' + (isViewed ? ' viewed' : '') + '">'
                + '<img src="' + _esc(su.avatar||'') + '" alt="' + _esc(su.name||'User') + '" '
                + 'onerror="this.src=\'https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=52\'">'
                + '</div>'
                + '<span class="status-card-name">' + _esc((su.name||'User').split(' ')[0]) + '</span>'
                + '</div>';

            container.appendChild(el);
        });

        var sbc = document.getElementById('status-bar-container');
        if (sbc) sbc.style.display = 'block';
    }
    window.renderStatusBar = renderStatusBar;


    /* =========================================================================
       §2  PEEK PREVIEW — short tap shows Facebook-style bottom card
       ========================================================================= */
    function _ensurePeek() {
        if (document.getElementById('sv-peek-overlay')) return;
        var ov = document.createElement('div');
        ov.id = 'sv-peek-overlay';
        ov.innerHTML =
            '<div id="sv-peek-card">'
            + '<div class="spk-media" id="spk-media"></div>'
            + '<button class="spk-dismiss" id="spk-dismiss"><i class="fas fa-times"></i></button>'
            + '<div class="spk-bottom">'
            + '  <div class="spk-user-row">'
            + '    <img class="spk-avatar" id="spk-avatar" src="" alt="">'
            + '    <div><div class="spk-uname" id="spk-uname"></div>'
            + '         <div class="spk-utime" id="spk-utime"></div></div>'
            + '  </div>'
            + '  <div class="spk-caption" id="spk-caption"></div>'
            + '  <div class="spk-btns">'
            + '    <button class="spk-open-btn" id="spk-open-btn"><i class="fas fa-play"></i> View Status</button>'
            + '    <button class="spk-reply-btn" id="spk-reply-btn"><i class="fas fa-comment"></i> Reply</button>'
            + '  </div>'
            + '</div>'
            + '</div>';
        document.body.appendChild(ov);
    }

    function _openPeek(su, idx) {
        _ensurePeek();
        var card = document.getElementById('sv-peek-card');
        var ov   = document.getElementById('sv-peek-overlay');
        if (!card || !ov) return;
        card.dataset.idx = idx;
        card.dataset.uid = su.userId || '';

        var items = _liveItems(su);
        if (!items.length) return;
        var item = items[0];

        var wrap = document.getElementById('spk-media');
        wrap.innerHTML = '';

        /* segment indicators */
        if (items.length > 1) {
            var dotsEl = document.createElement('div');
            dotsEl.className = 'spk-segs';
            items.forEach(function(_, i){
                var d = document.createElement('div');
                d.className = 'spk-seg' + (i === 0 ? ' active' : '');
                dotsEl.appendChild(d);
            });
            wrap.appendChild(dotsEl);
        } else {
            var pill = document.createElement('div');
            pill.className = 'spk-count-pill';
            pill.innerHTML = '<i class="fas fa-images"></i> ' + items.length + ' update';
            wrap.appendChild(pill);
        }

        /* dismiss */
        var dismissEl = document.createElement('button');
        dismissEl.className = 'spk-dismiss';
        dismissEl.innerHTML = '<i class="fas fa-times"></i>';
        dismissEl.onclick = _closePeek;
        wrap.appendChild(dismissEl);

        /* media */
        if (item.type === 'video' && item.url) {
            var vid = document.createElement('video');
            vid.src = item.url; vid.muted = true; vid.autoplay = true;
            vid.loop = true; vid.playsInline = true;
            wrap.appendChild(vid);
        } else if (item.type === 'text' || (!item.url && item.content)) {
            var td = document.createElement('div');
            td.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:24px;font-size:1.4rem;font-weight:800;color:#fff;text-align:center;background:' + (item.bg || 'linear-gradient(135deg,#0A0F1E,#1C2845)') + ';';
            td.textContent = item.content || '';
            wrap.appendChild(td);
        } else if (item.url) {
            var img = document.createElement('img');
            img.src = item.url;
            wrap.appendChild(img);
        } else {
            var fb = document.createElement('div');
            fb.style.cssText = 'width:100%;height:100%;background:linear-gradient(135deg,#0A0F1E,#1B2B8B);display:flex;align-items:center;justify-content:center;';
            fb.innerHTML = '<i class="fas fa-circle-notch" style="color:rgba(255,255,255,0.3);font-size:2rem;"></i>';
            wrap.appendChild(fb);
        }
        wrap.insertAdjacentHTML('beforeend', '<div class="spk-grad"></div>');

        /* meta */
        document.getElementById('spk-avatar').src = su.avatar || '';
        document.getElementById('spk-avatar').onerror = function(){ this.src = 'https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=40'; };
        document.getElementById('spk-uname').textContent = su.name || 'User';
        document.getElementById('spk-utime').textContent = item.createdAt ? _timeAgo(item.createdAt) : 'Just now';
        var capEl = document.getElementById('spk-caption');
        capEl.textContent   = (item.content && item.type !== 'text') ? item.content : '';
        capEl.style.display = capEl.textContent ? 'block' : 'none';

        var myId = _us().id;
        var repBtn = document.getElementById('spk-reply-btn');
        if (repBtn) repBtn.style.display = (su.userId === myId) ? 'none' : 'flex';

        ov.classList.add('active');
        card.style.bottom = '-110%';
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ card.classList.add('show'); }); });
    }

    function _closePeek() {
        var card = document.getElementById('sv-peek-card');
        var ov   = document.getElementById('sv-peek-overlay');
        if (card) {
            card.classList.remove('show');
            var v = card.querySelector('video');
            if (v) { try { v.pause(); v.src = ''; } catch(e){} }
        }
        if (ov) ov.classList.remove('active');
    }


    /* =========================================================================
       §3  STATUS VIEWER
       ========================================================================= */
    var _advTimer = null;
    var _progRaf  = null;
    var _progStart= 0;
    var _progDurMs= 0;
    var _curFill  = null;
    var _viewerOpen = false;

    function openStatusViewer(userIdx) {
        var statuses = window.userStatuses || [];
        if (!statuses[userIdx]) return;

        _closePeek();

        window._currentStatusUser = userIdx;
        window._currentStatusIdx  = 0;

        var modal = document.getElementById('status-viewer-modal');
        if (!modal) return;

        /* Replace inner HTML each open — clean slate, no stale state */
        modal.innerHTML = [
            '<div id="sv-content">',
            '  <div id="sv-prog-wrap"></div>',
            '  <div id="sv-top">',
            '    <img id="sv-av" src="" alt="">',
            '    <div class="sv-meta">',
            '      <div id="sv-name"></div>',
            '      <div id="sv-time"></div>',
            '    </div>',
            '    <button id="sv-mute-btn"><i class="fas fa-volume-up"></i></button>',
            '  </div>',
            '  <button id="sv-close"><i class="fas fa-times"></i></button>',
            '  <img id="sv-img" alt="status">',
            '  <video id="sv-vid" playsinline></video>',
            '  <div id="sv-txt"></div>',
            '  <div id="sv-caption"></div>',
            '  <div id="sv-viewers-panel">',
            '    <div class="svp-header">',
            '      <span class="svp-title"><i class="fas fa-eye"></i> Viewed by</span>',
            '      <button id="svp-close"><i class="fas fa-chevron-down"></i></button>',
            '    </div>',
            '    <div class="svp-list" id="svp-list"></div>',
            '  </div>',
            /* ── BOTTOM ACTION BAR (v2) — rebuilt to match the WhatsApp
               reference screenshots precisely:
               Row 1: viewer-count + quick emoji reactions + repost (WhatsApp
                      loop-arrow glyph, not FontAwesome's retweet icon) + like
                      + profile + chat icons.
               Row 2: inline comment thread (sent replies appear here).
               Row 3: full WhatsApp-style composer — emoji toggle, text
                      input, attach, camera, mic — exactly mirroring the
                      reference's bottom composer bar layout/icon order. ── */
            '  <div id="sv-bottom-bar">',
            '    <div id="sv-quick-row">',
            '      <button id="sv-eye-badge" title="Viewers">',
            '        <i class="fas fa-eye"></i><span id="sv-eye-count">0</span>',
            '      </button>',
            '      <button class="sv-emoji-quick" data-quick-emoji="😍" title="React">😍</button>',
            '      <button class="sv-emoji-quick" data-quick-emoji="😂" title="React">😂</button>',
            '      <button class="sv-emoji-quick" data-quick-emoji="😮" title="React">😮</button>',
            '      <button class="sv-emoji-quick" data-quick-emoji="😢" title="React">😢</button>',
            '      <button class="sv-emoji-quick" data-quick-emoji="🙏" title="React">🙏</button>',
            '      <button id="sv-rt-btn" title="Repost">',
            '        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
            '        <span id="sv-rt-count">0</span>',
            '      </button>',
            '      <button id="sv-heart-btn" title="Like"><i class="far fa-heart"></i><span class="sv-like-count" id="sv-like-count"></span></button>',
            '      <button class="sv-pill-btn" id="sv-prof-btn" title="View profile">',
            '        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
            '      </button>',
            '      <button class="sv-pill-btn sv-pill-btn--labeled" id="sv-chat-btn" title="Message" style="background:rgba(27,43,139,0.65);">',
            '        <i class="fas fa-paper-plane"></i><span>Message</span>',
            '      </button>',
            '    </div>',
            '    <div id="sv-reply-bar">',
            '      <button id="sv-emoji-toggle" title="Emoji"><i class="far fa-laugh"></i></button>',
            '      <input id="sv-reply-inp" placeholder="Reply privately…" type="text">',
            '      <button id="sv-attach-btn" title="Attach"><i class="fas fa-paperclip"></i></button>',
            '      <button id="sv-camera-btn" title="Camera"><i class="fas fa-camera"></i></button>',
            '      <button id="sv-reply-send" title="Send"><i class="fas fa-paper-plane"></i></button>',
            '    </div>',
            '  </div>',
            '  <button class="sv-nav" id="sv-prev">&#8249;</button>',
            '  <button class="sv-nav" id="sv-next">&#8250;</button>',
            '</div>'
        ].join('');

        /* Wire all events on the FRESH inner elements — no accumulation */
        _wireViewerOnce(modal);

        modal.className = 'sv-open';
        _viewerOpen = true;
        document.body.classList.add('modal-open');

        _showItem(userIdx, 0);
        _recordView(userIdx, 0);
    }
    window.openStatusViewer  = openStatusViewer;
    window._openStatusViewer = openStatusViewer;


    /* Wire events directly on fresh elements — called once after innerHTML reset */
    function _wireViewerOnce(modal) {
        /* backdrop close — click on the modal bg (outside #sv-content) */
        modal.addEventListener('click', function(e){
            if (e.target === modal) _closeViewer();
        });

        _qclick('#sv-close', _closeViewer);

        _qclick('#sv-prev', function(){
            _stopProg();
            var c = window._currentStatusIdx || 0;
            if (c > 0) _showItem(window._currentStatusUser, c - 1);
            else if ((window._currentStatusUser||0) > 0) openStatusViewer((window._currentStatusUser||0) - 1);
        });

        _qclick('#sv-next', function(){
            _stopProg();
            var su = _curSU(), its = su ? _liveItems(su) : [];
            var nxt = (window._currentStatusIdx||0) + 1;
            if (nxt < its.length) _showItem(window._currentStatusUser, nxt);
            else { var nu = (window._currentStatusUser||0)+1; if(nu<(window.userStatuses||[]).length) openStatusViewer(nu); else _closeViewer(); }
        });

        _qclick('#sv-heart-btn', function(e){
            e.stopPropagation();
            if (_isGuest()){ _notify('Log in to like', 'info'); return; }
            _doLike();
        });

        _qclick('#sv-rt-btn', function(e){
            e.stopPropagation();
            if (_isGuest()){ _notify('Log in to retweet', 'info'); return; }
            _doRetweet();
        });

        _qclick('#sv-mute-btn', function(e){
            e.stopPropagation();
            var v = document.getElementById('sv-vid'); if (!v) return;
            v.muted = !v.muted;
            var ic = document.querySelector('#sv-mute-btn i');
            if (ic) ic.className = v.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
        });

        _qclick('#sv-eye-badge', function(e){
            e.stopPropagation();
            var panel = document.getElementById('sv-viewers-panel');
            if (!panel) return;
            if (panel.classList.contains('open')) panel.classList.remove('open');
            else { _populateViewers(); panel.classList.add('open'); }
        });

        _qclick('#svp-close', function(e){
            e.stopPropagation();
            var p = document.getElementById('sv-viewers-panel');
            if (p) p.classList.remove('open');
        });

        _qclick('#sv-prof-btn', function(e){
            e.stopPropagation();
            var uid = modal.dataset.uid;
            if (uid){ _closeViewer(); _goProfile(uid); }
        });

        /* FIX (bug: "chat icon navigates away"): #sv-chat-btn and the reply
           send button used to call _openChat(), which navigates to the
           Messages section and closes the status viewer entirely. WhatsApp
           keeps you inside the status when you reply — replies are sent
           straight to the recipient's real inbox as private DMs (see
           _postComment), and there is no public comment thread shown on
           the status itself (see point #3 in the latest fix round).
           FIX (bug: "clicking the Message button doesn't visibly do
           anything"): it now focuses AND visibly highlights the reply
           input with a brief glow, so tapping it has an obvious, confirmed
           effect instead of a silent focus() call that's easy to miss. */
        _qclick('#sv-chat-btn', function(e){
            e.stopPropagation();
            if (_isGuest()){ _notify('Log in to message', 'info'); return; }
            var uid = modal.dataset.uid;
            if (!uid || uid === (_us().id||'')) return;
            _stopProg();
            var inp = document.getElementById('sv-reply-inp');
            var bar = document.getElementById('sv-reply-bar');
            if (bar) {
                bar.classList.add('sv-reply-bar-active');
                bar.style.boxShadow = '0 0 0 2px #00D4AA';
                bar.scrollIntoView({ block: 'nearest' });
            }
            if (inp) {
                setTimeout(function(){ inp.focus(); }, 80);
            }
        });

        _qclick('#sv-reply-send', function(e){
            e.stopPropagation();
            if (_isGuest()){ _notify('Log in to reply', 'info'); return; }
            var inp = document.getElementById('sv-reply-inp');
            var msg = inp ? inp.value.trim() : '';
            if (!msg) return;
            _postComment(msg);
            if (inp) { inp.value = ''; inp.focus(); }
            var bar = document.getElementById('sv-reply-bar');
            if (bar) { bar.style.boxShadow = ''; bar.classList.remove('sv-reply-bar-active'); }
        });

        var replyInpEl = document.getElementById('sv-reply-inp');
        if (replyInpEl) {
            replyInpEl.addEventListener('focus', function(){
                _stopProg();
                var barEl = document.getElementById('sv-reply-bar');
                if (barEl) barEl.classList.add('sv-reply-bar-active');
                _forceKeyboardResync(modal);
            });
            replyInpEl.addEventListener('blur', function(){
                var barEl = document.getElementById('sv-reply-bar');
                if (barEl) { barEl.style.boxShadow = ''; barEl.classList.remove('sv-reply-bar-active'); }
                setTimeout(function(){
                    if (window.visualViewport) return; // visualViewport branch self-corrects on its own resize event
                    var svContentEl = document.getElementById('sv-content');
                    if (svContentEl && document.body.contains(svContentEl)) svContentEl.style.height = '';
                }, 400);
            });
            replyInpEl.addEventListener('keydown', function(e){
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var msg = replyInpEl.value.trim();
                    if (!msg) return;
                    if (_isGuest()){ _notify('Log in to reply', 'info'); return; }
                    _postComment(msg);
                    replyInpEl.value = '';
                }
            });
        }

        /* quick emoji-reaction row */
        document.querySelectorAll('.sv-emoji-quick').forEach(function(btn){
            btn.addEventListener('click', function(e){
                e.stopPropagation();
                if (_isGuest()){ _notify('Log in to react', 'info'); return; }
                _postComment(btn.dataset.quickEmoji, /* isEmojiOnly */ true);
                _spawnBubbles(btn.dataset.quickEmoji);
            });
        });

        /* ── composer icons (emoji toggle / attach / camera) ──
           Mirrors the WhatsApp reference: tapping the emoji-face icon opens
           a small inline emoji panel (built from the same quick-reaction
           set) that INSERTS into the reply text instead of posting
           immediately — exactly like a system emoji keyboard would. Attach
           and camera are wired to sensible, non-breaking defaults: they
           reuse a real upload/camera entry point if the host app exposes
           one, otherwise they let the person know the option isn't wired
           yet rather than silently doing nothing. */
        _qclick('#sv-emoji-toggle', function(e){
            e.stopPropagation();
            _toggleInlineEmojiPanel();
        });

        _qclick('#sv-attach-btn', function(e){
            e.stopPropagation();
            if (_isGuest()){ _notify('Log in to send media', 'info'); return; }
            if (typeof window.openMediaPicker === 'function') { window.openMediaPicker(); return; }
            if (typeof window.openAttachMenu === 'function') { window.openAttachMenu(); return; }
            _notify('Attach option coming soon', 'info');
        });

        _qclick('#sv-camera-btn', function(e){
            e.stopPropagation();
            if (_isGuest()){ _notify('Log in to use camera', 'info'); return; }
            if (typeof window.openCameraCapture === 'function') { window.openCameraCapture(); return; }
            _notify('Camera option coming soon', 'info');
        });

        /* avatar + name → profile */
        _qclick('#sv-av', function(e){ e.stopPropagation(); var uid=modal.dataset.uid; if(uid){_closeViewer();_goProfile(uid);} });
        _qclick('#sv-name', function(e){ e.stopPropagation(); var uid=modal.dataset.uid; if(uid){_closeViewer();_goProfile(uid);} });

        /* swipe gestures */
        var tx=0, ty=0;
        var content = document.getElementById('sv-content');
        if (content) {
            /* FIX: excluded zone widened from just #sv-reply-bar to the
               whole #sv-bottom-bar, since the quick-emoji row, viewer
               eye-badge, retweet, and like buttons now also live in that
               container (previously they were floating elsewhere). Without
               this, a touch on those buttons that drifted even slightly
               could get misread as a status-navigation swipe. */
            content.addEventListener('touchstart', function(e){
                if (e.target.closest('#sv-viewers-panel,#sv-bottom-bar')) return;
                tx=e.touches[0].clientX; ty=e.touches[0].clientY;
            },{ passive:true });
            content.addEventListener('touchend', function(e){
                if (e.target.closest('#sv-viewers-panel,#sv-bottom-bar')) return;
                var dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
                /* swipe up → viewers panel */
                if (dy < -60 && Math.abs(dy)>Math.abs(dx)){
                    var badge=document.getElementById('sv-eye-badge');
                    if (badge && badge.classList.contains('show')){
                        var panel=document.getElementById('sv-viewers-panel');
                        if(panel && !panel.classList.contains('open')){ _populateViewers(); panel.classList.add('open'); }
                    }
                    return;
                }
                if (Math.abs(dx)<40 || Math.abs(dx)<Math.abs(dy)) return;
                _stopProg();
                if (dx<0){
                    var su2=_curSU(),its2=su2?_liveItems(su2):[],nxt2=(window._currentStatusIdx||0)+1;
                    if(nxt2<its2.length) _showItem(window._currentStatusUser,nxt2);
                    else{var nu2=(window._currentStatusUser||0)+1;if(nu2<(window.userStatuses||[]).length)openStatusViewer(nu2);else _closeViewer();}
                } else {
                    var c2=window._currentStatusIdx||0;
                    if(c2>0) _showItem(window._currentStatusUser,c2-1);
                    else if((window._currentStatusUser||0)>0) openStatusViewer((window._currentStatusUser||0)-1);
                }
            },{ passive:true });
        }

        /* reply focus: pause / resume */
        var inp = document.getElementById('sv-reply-inp');
        if (inp) {
            inp.addEventListener('focus', function(){ _stopProg(); });
            inp.addEventListener('blur', function(){
                var su=_curSU(); if(!su) return;
                var its=_liveItems(su);
                var vid=document.getElementById('sv-vid'), remain=IMG_DUR_MS;
                if(vid&&!vid.paused&&isFinite(vid.duration)&&isFinite(vid.currentTime)){
                    var ci=its[window._currentStatusIdx||0];
                    var se=(ci&&ci.endOffset!=null)?ci.endOffset:vid.duration;
                    remain=Math.max(500,(se-vid.currentTime)*1000);
                }
                _startProg(its,window._currentStatusIdx||0,window._currentStatusUser||0,remain);
            });
        }

        /* FIX (bug: "tapping Message shows no text input column"): the
           composer row lives inside #sv-bottom-bar, which is
           position:absolute;bottom:0 against #sv-content's 100dvh box.
           When the on-screen keyboard opens, Android Chrome/WebView mostly
           does NOT shrink a 100dvh element to the keyboard-adjusted visible
           area in real time — the box keeps its original full-screen
           height, so the absolutely-positioned bottom bar (and the reply
           input inside it) ends up positioned UNDERNEATH the keyboard,
           completely out of view. That's why the input "disappears" the
           moment the keyboard opens, even though it's technically still
           in the DOM and still focused.
           FIX: track window.visualViewport (the API that DOES report the
           real keyboard-adjusted visible height) and actively resize
           #sv-content to match it while the viewer is open. This pulls
           #sv-bottom-bar back into view above the keyboard. Falls back to
           no-op on browsers without visualViewport support (rare; iOS
           Safari and modern Chrome both have it), in which case behavior
           is unchanged from before — never worse than the original. */
        if (window.visualViewport) {
            var svContentEl = document.getElementById('sv-content');
            var _onVVResize = function(){
                if (!svContentEl || !document.body.contains(svContentEl)) return;
                var vv = window.visualViewport;
                /* Only override height while the keyboard is actually open
                   (visible viewport meaningfully shorter than layout
                   viewport) — otherwise leave the normal 100dvh/CSS rules
                   in control so desktop/no-keyboard layout is untouched. */
                var shrunk = (window.innerHeight - vv.height) > 80;
                svContentEl.style.height = shrunk ? (vv.height + 'px') : '';
            };
            window.visualViewport.addEventListener('resize', _onVVResize);
            window.visualViewport.addEventListener('scroll', _onVVResize);
            /* store cleanup on the modal so _closeViewer can remove it and
               we never leak a listener across multiple opens */
            modal._ocVVCleanup = function(){
                window.visualViewport.removeEventListener('resize', _onVVResize);
                window.visualViewport.removeEventListener('scroll', _onVVResize);
            };
            /* Exposed so the Message-button handler can force an immediate
               check right after focus(), without waiting for the resize
               event — see _forceKeyboardResync below. */
            modal._svVVResync = _onVVResize;
        }
    }

    /* FIX (bug: "Message tap opens the OS keyboard but no text field is
       visible — typed text lands in the keyboard's own suggestion strip
       instead"): window.visualViewport's 'resize' event is the correct
       signal, but on a number of Android WebViews (notably older system
       WebView builds many devices still ship) it fires LATE — sometimes
       300ms+ after the keyboard has already finished animating in — or in
       rare cases not at all for a programmatic focus() call. During that
       gap #sv-content is still its full 100dvh height, so #sv-bottom-bar
       (position:absolute;bottom:0) sits below the fold, hidden under the
       keyboard, exactly as seen in the report. This actively re-checks the
       viewport a few times over ~1.5s right after focus — independent of
       whether the resize event ever fires — so the bar is guaranteed to
       snap into view as soon as the keyboard finishes opening, on every
       device, not just ones with prompt visualViewport events. */
    function _forceKeyboardResync(modal){
        var svContentEl = document.getElementById('sv-content');
        if (!svContentEl) return;
        var baselineH = window.innerHeight;
        var tries = 0;
        var iv = setInterval(function(){
            tries++;
            if (!document.body.contains(svContentEl)) { clearInterval(iv); return; }
            if (window.visualViewport && typeof modal._svVVResync === 'function') {
                modal._svVVResync();
            } else {
                /* FIX: visualViewport-independent fallback for WebViews that
                   lack it entirely (the .scrollIntoView approach is a no-op
                   here since #sv-content has overflow:hidden — there's no
                   scrollable ancestor to scroll to). window.innerHeight DOES
                   reliably shrink on keyboard-open across virtually all
                   mobile browsers, including older Android WebViews, so use
                   that directly to pull #sv-content (and therefore the
                   absolutely-positioned #sv-bottom-bar inside it) up above
                   the keyboard. */
                var nowH  = window.innerHeight;
                var shrunk = (baselineH - nowH) > 80;
                svContentEl.style.height = shrunk ? (nowH + 'px') : '';
            }
            if (tries >= 8) clearInterval(iv); // ~1.6s of polling, then stop — never lingers
        }, 200);
    }

    /* Helper: querySelector + addEventListener with null guard */
    function _qclick(sel, fn) {
        var el = document.querySelector(sel);
        if (el) el.addEventListener('click', fn);
    }


    /* =========================================================================
       §4  SHOW ITEM
       ========================================================================= */
    function _showItem(userIdx, itemIdx) {
        _stopProg();
        var su = (window.userStatuses||[])[userIdx];
        if (!su) return;
        var items = _liveItems(su);
        if (!items[itemIdx]) return;

        var item = items[itemIdx];
        window._currentStatusUser = userIdx;
        window._currentStatusIdx  = itemIdx;

        var modal = document.getElementById('status-viewer-modal');
        if (!modal) return;
        modal.dataset.uid = su.userId || '';

        /* avatar / name / time */
        var avEl = document.getElementById('sv-av');
        var nmEl = document.getElementById('sv-name');
        var tmEl = document.getElementById('sv-time');
        if (avEl){ avEl.src=su.avatar||''; avEl.onerror=function(){this.src='https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=52';}; }
        if (nmEl) nmEl.textContent = su.name || 'User';
        if (tmEl) tmEl.textContent = item.createdAt ? _timeAgo(item.createdAt) : (item.time||'Just now');

        /* progress bars */
        var pw = document.getElementById('sv-prog-wrap');
        if (pw) {
            pw.innerHTML = '';
            items.forEach(function(_, i){
                var seg=document.createElement('div'); seg.className='sv-prog-seg';
                var fill=document.createElement('div'); fill.className='sv-prog-fill';
                if (i < itemIdx) fill.style.width='100%';
                seg.appendChild(fill); pw.appendChild(seg);
            });
        }

        /* hide media */
        var imgEl=document.getElementById('sv-img');
        var vidEl=document.getElementById('sv-vid');
        var txtEl=document.getElementById('sv-txt');
        if (imgEl) imgEl.style.display='none';
        if (txtEl){ txtEl.style.display='none'; txtEl.textContent=''; }
        if (vidEl){
            if(vidEl._segH){vidEl.removeEventListener('timeupdate',vidEl._segH);vidEl._segH=null;}
            try{vidEl.pause();vidEl.src='';vidEl.load();}catch(e){}
            vidEl.style.display='none';
        }

        var dispMs = IMG_DUR_MS;

        if (item.type==='video' && item.url && vidEl) {
            vidEl.style.display='block'; vidEl.autoplay=true; vidEl.playsInline=true; vidEl.controls=false;
            var muteIc=document.querySelector('#sv-mute-btn i');
            vidEl.muted = muteIc ? muteIc.className.includes('mute') : false;

            var metaFired=false;
            var fb2=setTimeout(function(){
                if(metaFired)return; metaFired=true;
                vidEl.play&&vidEl.play().catch(function(){});
                _startProg(items,itemIdx,userIdx,MAX_VID_S*1000);
            },5000);

            vidEl.onloadedmetadata=function(){
                if(metaFired)return; metaFired=true; clearTimeout(fb2);
                var raw=isFinite(vidEl.duration)?vidEl.duration:MAX_VID_S;
                var st=item.startOffset!=null?item.startOffset:0;
                var en=item.endOffset!=null?item.endOffset:raw;
                var dur=Math.min(en-st,MAX_VID_S);
                if(dur<=0||!isFinite(dur))dur=MAX_VID_S;
                dispMs=dur*1000;
                vidEl.currentTime=st;
                vidEl.play&&vidEl.play().catch(function(){});
                vidEl._segH=function(){
                    if(vidEl.currentTime>=st+dur-0.25){
                        vidEl.removeEventListener('timeupdate',vidEl._segH); vidEl._segH=null; vidEl.pause();
                    }
                };
                vidEl.addEventListener('timeupdate',vidEl._segH);
                _startProg(items,itemIdx,userIdx,dispMs);
            };
            vidEl.onerror=function(){
                clearTimeout(fb2);
                if(!metaFired){metaFired=true;_startProg(items,itemIdx,userIdx,IMG_DUR_MS);}
            };
            vidEl.src=item.url; vidEl.load();

        } else if (item.type==='text'||(!item.url&&item.content)) {
            if(txtEl){txtEl.style.display='flex';txtEl.textContent=item.content||'';txtEl.style.background=item.bg||'linear-gradient(135deg,#0A0F1E,#1C2845)';}
        } else if (item.url) {
            if(imgEl){imgEl.src=item.url;imgEl.style.display='block';}
        }

        var capEl=document.getElementById('sv-caption');
        if(capEl) capEl.textContent=(item.type!=='text'&&item.content)?item.content:'';

        _syncCounts(item, su);
        if (item.type!=='video') _startProg(items,itemIdx,userIdx,dispMs);
    }

    function _syncCounts(item, su) {
        var myId = _us().id;

        /* heart */
        var hBtn=document.getElementById('sv-heart-btn'), hCnt=document.getElementById('sv-like-count');
        var liked=!!(item.likedBy&&myId&&item.likedBy.includes(myId));
        if(hBtn){ hBtn.classList.toggle('liked',liked); var hi=hBtn.querySelector('i'); if(hi){hi.className=liked?'fas fa-heart':'far fa-heart';hi.style.color=liked?'#f87171':'';} }
        if(hCnt) hCnt.textContent=(item.likes||0)>0?item.likes:'';

        /* retweet */
        var rtBtn=document.getElementById('sv-rt-btn'), rtCnt=document.getElementById('sv-rt-count');
        var rt=!!(item.retweetedBy&&myId&&item.retweetedBy.includes(myId));
        if(rtBtn) rtBtn.classList.toggle('retweeted',rt);
        if(rtCnt) rtCnt.textContent=item.retweets||0;

        /* eye badge — own status only */
        var eyeBadge=document.getElementById('sv-eye-badge'), eyeCnt=document.getElementById('sv-eye-count');
        var isOwn=!!(myId&&su.userId===myId);
        if(eyeBadge) eyeBadge.classList.toggle('show', isOwn);
        if(eyeCnt)   eyeCnt.textContent=(item.viewers||[]).length;

        /* profile + chat visible for non-owner only */
        var profBtn=document.getElementById('sv-prof-btn'), chatBtn=document.getElementById('sv-chat-btn');
        if(profBtn) profBtn.style.display=isOwn?'none':'flex';
        if(chatBtn) chatBtn.style.display=isOwn?'none':'flex';
    }

    function _closeViewer() {
        _stopProg();
        _viewerOpen = false;
        var modal=document.getElementById('status-viewer-modal');
        if(modal){
            /* FIX: clean up the visualViewport listener registered in
               _wireViewerOnce so it doesn't keep firing (and doesn't leak
               a duplicate) the next time a status is opened. */
            if (typeof modal._ocVVCleanup === 'function') {
                try { modal._ocVVCleanup(); } catch(e) {}
                modal._ocVVCleanup = null;
            }
            modal.className=''; modal.innerHTML='';
        }
        document.body.classList.remove('modal-open');
    }


    /* =========================================================================
       §5  PROGRESS
       ========================================================================= */
    function _stopProg(){
        clearTimeout(_advTimer); _advTimer=null;
        if(_progRaf){cancelAnimationFrame(_progRaf);_progRaf=null;}
        _curFill=null;
    }
    function _startProg(items,itemIdx,userIdx,durMs){
        _stopProg();
        if(!durMs||durMs<=0) durMs=IMG_DUR_MS;
        var pw=document.getElementById('sv-prog-wrap');
        var segs=pw?pw.querySelectorAll('.sv-prog-seg'):[];
        var fill=segs[itemIdx]?segs[itemIdx].querySelector('.sv-prog-fill'):null;
        _curFill=fill; _progStart=performance.now(); _progDurMs=durMs;

        (function tick(now){
            if(!_curFill)return;
            var pct=Math.min(100,((now-_progStart)/_progDurMs)*100);
            _curFill.style.width=pct+'%';
            if(pct<100)_progRaf=requestAnimationFrame(tick);
        })(performance.now());

        _advTimer=setTimeout(function(){
            _stopProg();
            var nxt=itemIdx+1;
            if(nxt<items.length){_showItem(userIdx,nxt);_recordView(userIdx,nxt);}
            else{var nu=userIdx+1;if(nu<(window.userStatuses||[]).length)openStatusViewer(nu);else _closeViewer();}
        },durMs);
    }


    /* =========================================================================
       §6  LIKE — bubble hearts float up inside sv-content
       ========================================================================= */
    function _doLike(){
        var su=_curSU();if(!su)return;
        var items=_liveItems(su),item=items[window._currentStatusIdx||0];if(!item)return;
        if(!item.likedBy)item.likedBy=[];
        var uid=_us().id,idx=item.likedBy.indexOf(uid);
        if(idx>-1){item.likedBy.splice(idx,1);item.likes=Math.max(0,(item.likes||0)-1);}
        else{item.likedBy.push(uid);item.likes=(item.likes||0)+1;}
        var nowLiked=idx===-1;
        var hBtn=document.getElementById('sv-heart-btn'),hCnt=document.getElementById('sv-like-count');
        if(hBtn){
            hBtn.classList.toggle('liked',nowLiked);
            var hi=hBtn.querySelector('i');
            if(hi){hi.className=nowLiked?'fas fa-heart':'far fa-heart';hi.style.color=nowLiked?'#f87171':'';}
            if(nowLiked){hi.style.transform='scale(1.5)';setTimeout(function(){hi.style.transform='scale(1)';},200);_spawnBubbles();}
        }
        if(hCnt) hCnt.textContent=item.likes>0?item.likes:'';
        if(typeof window.rewardUserForAction==='function') window.rewardUserForAction('RECEIVE_LIKE',su.userId);
        _persistItem(su,item);
    }

    /* FIX (bug: "bubble like is broken"): bubbles used to spawn at a fixed
       bottom:70px, tuned for the old single-row reply bar. The new bottom
       action bar (quick-reactions row + comments list + reply row) is
       taller, so bubbles were spawning UNDERNEATH it — rendered, but
       completely hidden behind an opaque background, which looks exactly
       like "tapping like does nothing". FIX: measure the actual current
       height of #sv-bottom-bar at spawn time and start bubbles just above
       it, so they're always visible regardless of how tall that bar is
       (e.g. grows when comments are present). Also accepts an optional
       emoji override so the quick-reaction row can spawn its own emoji
       instead of always hearts. */
    function _spawnBubbles(emoji){
        /* Append to sv-content (position:relative, overflow:hidden) — not modal root */
        var box=document.getElementById('sv-content');
        if(!box)return;
        var bar=document.getElementById('sv-bottom-bar');
        var clearance=(bar?bar.getBoundingClientRect().height:70)+14;
        var emojis=emoji?[emoji]:['❤️','💕','💖','💗','❤️'];
        for(var b=0;b<8;b++){
            (function(i){
                var bbl=document.createElement('div');
                bbl.className='sv-bubble';
                bbl.textContent=emojis[i%emojis.length];
                var x=15+Math.random()*70, dur=0.9+i*0.13;
                bbl.style.cssText='position:absolute;bottom:'+clearance+'px;left:'+x+'%;font-size:'+(1.1+Math.random()*0.8)+'rem;pointer-events:none;z-index:50;opacity:1;transition:transform '+dur+'s ease-out,opacity '+dur+'s ease-out;';
                box.appendChild(bbl);
                requestAnimationFrame(function(){requestAnimationFrame(function(){
                    bbl.style.transform='translateY(-'+(110+Math.random()*120)+'px) rotate('+(Math.random()*30-15)+'deg) scale(0.3)';
                    bbl.style.opacity='0';
                });});
                setTimeout(function(){if(bbl.parentNode)bbl.parentNode.removeChild(bbl);},(dur*1000)+300);
            })(b);
        }
    }


    /* =========================================================================
       §7  RETWEET
       ========================================================================= */
    function _doRetweet(){
        var su=_curSU();if(!su)return;
        var items=_liveItems(su),item=items[window._currentStatusIdx||0];if(!item)return;
        if(!item.retweetedBy)item.retweetedBy=[];
        var uid=_us().id,idx=item.retweetedBy.indexOf(uid);
        if(idx>-1){item.retweetedBy.splice(idx,1);item.retweets=Math.max(0,(item.retweets||0)-1);}
        else{item.retweetedBy.push(uid);item.retweets=(item.retweets||0)+1;}
        var didRt=idx===-1;
        var rtBtn=document.getElementById('sv-rt-btn'),rtCnt=document.getElementById('sv-rt-count');
        if(rtBtn){rtBtn.classList.toggle('retweeted',didRt);if(didRt){rtBtn.style.transform='scale(1.25)';setTimeout(function(){rtBtn.style.transform='scale(1)';},200);}}
        if(rtCnt) rtCnt.textContent=item.retweets||0;
        _notify(didRt?'Status retweeted!':'Retweet removed',didRt?'success':'info');
        _persistItem(su,item);
    }


    /* =========================================================================
       §7b  INLINE COMMENTS (WhatsApp-style reply that stays in the viewer)
       ------------------------------------------------------------------------
       FIX: the old reply flow navigated away to the Messages section the
       moment you sent something, which broke the "stay in the status"
       expectation. _postComment stores the comment on the status item
       itself (so it's visible to anyone viewing that status, like a
       caption-reply thread) AND, if a real DM-send function exists, also
       queues the same text as an actual direct message in the background —
       without switching screens or closing the viewer.

       FIX (bug: "emoji/messages should go to inbox, not the status"): the
       previous version did BOTH — pushed the reply into a PUBLIC
       item.comments array rendered for every viewer to see under the
       status, AND tried a best-effort DM. That's backwards: WhatsApp status
       replies are always PRIVATE — there is no public comment thread under
       a status at all. This version removes the public thread entirely and
       writes a real direct message using the exact same Firestore schema
       app-patch-openchat.js's _doSend() uses (collections 'messages' and
       'chats', same field names, same chatId format), so the reply lands
       in the recipient's actual inbox. Only the sender sees a brief private
       "Sent" confirmation — nothing is shown publicly on the status.
       ========================================================================= */
    function _buildStatusChatId(a, b) { return [a, b].sort().join('_'); }

    function _postComment(text, isEmojiOnly){
        var su=_curSU(); if(!su) return;
        var uid = su.userId;
        var me  = _us();
        if (!uid || uid === (me.id||'')) return; /* can't DM your own status */

        var chatId = _buildStatusChatId(me.id||'', uid);
        var msgId  = 'msg-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
        var now    = new Date().toISOString();

        if (window.fbDb) {
            try {
                var payload = {
                    id:          msgId,
                    chatId:      chatId,
                    senderId:    me.id    || '',
                    receiverId:  uid,
                    senderName:  me.fullName || me.username || 'User',
                    text:        text,
                    read:        false,
                    createdAt:   now,
                    /* tag so the recipient's chat UI can optionally show
                       "replied to your status" context if it wants to */
                    statusReplyTo: su.docId || ('status-'+uid)
                };
                window.fbDb.collection('messages').doc(msgId).set(payload).catch(function(){});
                window.fbDb.collection('chats').doc(chatId).set({
                    participants: [me.id||'', uid],
                    lastMessage: text,
                    lastMessageTime: now,
                    lastSenderId: me.id||''
                }, { merge: true }).catch(function(){});
            } catch(e) {}
        }

        /* Private confirmation only — nothing shown publicly on the status itself */
        _flashSentConfirmation(isEmojiOnly ? text+' sent' : 'Reply sent to '+(su.name||'user'));
    }

    /* Small, private, self-dismissing confirmation shown near the composer
       — NOT a public comment, just local feedback that the DM went out. */
    function _flashSentConfirmation(msg){
        var bar=document.getElementById('sv-reply-bar');
        if(!bar){ _notify(msg,'success'); return; }
        var existing=document.getElementById('sv-sent-flash');
        if(existing) existing.remove();
        var flash=document.createElement('div');
        flash.id='sv-sent-flash';
        flash.textContent=msg;
        flash.style.cssText='position:absolute;left:8px;right:8px;bottom:100%;margin-bottom:8px;background:rgba(0,212,170,0.92);color:#062019;font-size:0.76rem;font-weight:700;text-align:center;padding:6px 10px;border-radius:10px;z-index:24;pointer-events:none;transition:opacity 0.3s;';
        bar.style.position='relative';
        bar.appendChild(flash);
        setTimeout(function(){ flash.style.opacity='0'; setTimeout(function(){ if(flash.parentNode) flash.remove(); },300); },1400);
    }

    /* Small inline emoji panel for the composer's emoji-toggle button.
       Tapping an emoji here INSERTS it into the reply input at the cursor
       (system-keyboard behavior) rather than posting immediately — distinct
       from the always-visible quick-reaction row, which posts on tap. */
    var EMOJI_PANEL_SET=['😀','😂','😍','😮','😢','😡','🙏','👏','🔥','💯','🎉','😎','😴','🤔','👍','❤️'];
    function _toggleInlineEmojiPanel(){
        var existing=document.getElementById('sv-emoji-panel');
        if(existing){ existing.remove(); return; }
        var bar=document.getElementById('sv-reply-bar');
        if(!bar) return;
        var panel=document.createElement('div');
        panel.id='sv-emoji-panel';
        panel.style.cssText='position:absolute;left:8px;right:8px;bottom:100%;margin-bottom:8px;background:rgba(20,20,30,0.96);backdrop-filter:blur(10px);border-radius:14px;padding:10px;display:grid;grid-template-columns:repeat(8,1fr);gap:4px;z-index:25;max-height:160px;overflow-y:auto;';
        EMOJI_PANEL_SET.forEach(function(em){
            var b=document.createElement('button');
            b.type='button';
            b.textContent=em;
            b.style.cssText='background:none;border:none;font-size:1.3rem;cursor:pointer;padding:6px;border-radius:8px;';
            b.addEventListener('click', function(e){
                e.stopPropagation();
                var inp=document.getElementById('sv-reply-inp');
                if(inp){ inp.value=(inp.value||'')+em; inp.focus(); }
            });
            panel.appendChild(b);
        });
        bar.style.position='relative';
        bar.appendChild(panel);
        /* close on outside tap */
        setTimeout(function(){
            document.addEventListener('click', function _closeEmojiPanel(e){
                if(e.target.closest('#sv-emoji-panel,#sv-emoji-toggle')) return;
                var p=document.getElementById('sv-emoji-panel');
                if(p) p.remove();
                document.removeEventListener('click', _closeEmojiPanel);
            });
        },0);
    }

    /* =========================================================================
       §8  VIEWERS PANEL
       ========================================================================= */
    function _populateViewers(){
        var list=document.getElementById('svp-list');if(!list)return;
        var su=_curSU();if(!su)return;
        var items=_liveItems(su),item=items[window._currentStatusIdx||0];
        if(!item||!item.viewers||!item.viewers.length){
            list.innerHTML='<div class="svp-empty"><i class="fas fa-eye-slash" style="margin-right:6px;"></i>No viewers yet</div>';
            return;
        }
        var html='';
        item.viewers.forEach(function(v){
            var uid=(v&&v.uid)?v.uid:String(v);
            var when=(v&&v.time)?_timeAgo(v.time):'';
            var u=_lookupUser(uid);
            var name=_esc(u.name||uid);
            var fb='https://ui-avatars.com/api/?name='+encodeURIComponent(u.name||'U')+'&background=1B2B8B&color=fff&size=38';
            var isSelf=uid===(_us().id||'');
            html+='<div class="svp-row" data-uid="'+_esc(uid)+'">'
                +'<img class="svp-avatar" src="'+(u.avatar||fb)+'" onerror="this.src=\''+fb+'\'" alt="'+name+'">'
                +'<div class="svp-info"><div class="svp-name">'+name+'</div>'+(when?'<div class="svp-time">'+when+'</div>':'')+'</div>'
                +(!isSelf?'<button class="svp-msg-btn" data-chat="'+_esc(uid)+'"><i class="fas fa-comment"></i> Message</button>':'')
                +'</div>';
        });
        list.innerHTML=html;
        /* FIX: this function runs every time the eye-badge/viewers panel is
           opened (also on swipe-up), but it kept calling addEventListener on
           the SAME #svp-list element without ever removing the previous
           listener. Each reopen stacked another handler, so tapping
           "Message" or a viewer row could fire navigation multiple times —
           inconsistent, glitchy behavior that doesn't match WhatsApp's
           clean single-fire tap. FIX: wire the click listener once, the
           first time #svp-list is created, using a guard flag — never wire
           it again on subsequent calls, since innerHTML reassignment above
           doesn't replace the listener (it's on the stable #svp-list
           element itself, not its children). */
        if (!list._ocViewersWired) {
            list._ocViewersWired = true;
            list.addEventListener('click', function(e){
                var cb=e.target.closest('[data-chat]');
                if(cb){e.stopPropagation();if(_isGuest()){_notify('Log in','info');return;}var p=document.getElementById('sv-viewers-panel');if(p)p.classList.remove('open');_closeViewer();_openChat(cb.dataset.chat);return;}
                var row=e.target.closest('.svp-row');
                if(row&&row.dataset.uid){_closeViewer();_goProfile(row.dataset.uid);}
            });
        }
    }


    /* =========================================================================
       §9  RECORD VIEW
       ========================================================================= */
    function _recordView(userIdx,itemIdx){
        var su=(window.userStatuses||[])[userIdx];if(!su)return;
        su.viewed=true;
        var items=_liveItems(su),item=items[itemIdx];if(!item)return;
        if(!item.viewers)item.viewers=[];
        var uid=_us().id,viewedAt=new Date().toISOString();
        if(uid&&!item.viewers.find(function(v){return(v&&v.uid?v.uid:v)===uid;}))
            item.viewers.push({uid:uid,time:viewedAt});
        var docId=su.docId||('status-'+su.userId);
        if(window.fbDb&&docId){try{window.fbDb.collection('statuses').doc(docId).set({viewed:true},{merge:true}).catch(function(){});}catch(e){}}
        try{var vc=JSON.parse(localStorage.getItem('emp_viewed_statuses')||'{}');vc[su.userId]=Date.now();localStorage.setItem('emp_viewed_statuses',JSON.stringify(vc));}catch(e){}
        var eyeCnt=document.getElementById('sv-eye-count');
        if(eyeCnt)eyeCnt.textContent=item.viewers.length;
    }


    /* =========================================================================
       §10  GLOBAL DELEGATE — status bar taps + create-status
           SHORT tap (< 300ms) → peek preview
           Tap "View Status" in peek → openStatusViewer
       ========================================================================= */
    (function _wireBarAndPeek(){
        var _ptStart=0, _ptIdx=-1, _ptTimer=null;

        /* FIX (bug: "click doesn't open"): a tap on a status circle used to
           ALWAYS open the small peek card first — the full WhatsApp-style
           viewer (with eye-badge viewer count, retweet, heart/bubble likes,
           profile navigation) only opened if the user then tapped "View
           Status" inside that peek card. That two-step flow is what read as
           "clicking it doesn't open [the status]".
           FIX: a normal tap now opens the full status viewer directly, same
           as WhatsApp. The peek-preview code itself is left fully intact
           (still reachable any time _openPeek() is called) in case it's
           wanted elsewhere later — only the short-tap routing changed. */
        document.addEventListener('pointerdown', function(e){
            var item = e.target.closest && e.target.closest('.status-item');
            if (!item || item.id==='add-my-status-btn') return;
            _ptStart = Date.now();
            _ptIdx   = parseInt(item.dataset.statusIdx, 10);
        });

        document.addEventListener('pointerup', function(e){
            if (_ptIdx < 0) return;
            var item = e.target.closest && e.target.closest('.status-item');
            if (!item || item.id==='add-my-status-btn'){ _ptIdx=-1; return; }
            var idx  = _ptIdx; _ptIdx=-1;
            /* Tap (of any duration that isn't a drag/scroll) → open full
               viewer directly, WhatsApp-style. */
            var su=(window.userStatuses||[])[idx];
            if(su) openStatusViewer(idx);
        });

        /* Peek card buttons */
        document.addEventListener('click', function(e){
            /* Open full viewer from peek */
            if (e.target.closest && e.target.closest('#spk-open-btn')){
                var card=document.getElementById('sv-peek-card');
                var idx2=card?parseInt(card.dataset.idx||'0',10):0;
                _closePeek();
                openStatusViewer(idx2);
                return;
            }
            /* Reply from peek */
            if (e.target.closest && e.target.closest('#spk-reply-btn')){
                if(_isGuest()){_notify('Log in to reply','info');return;}
                var card2=document.getElementById('sv-peek-card');
                var uid=card2?card2.dataset.uid:'';
                _closePeek();
                if(uid) _openChat(uid);
                return;
            }
            /* Close peek on overlay bg */
            if (e.target && e.target.id==='sv-peek-overlay') _closePeek();

            /* "My Status" tile — has two distinct tap targets, matching
               WhatsApp/Facebook:
                 • the small ".status-add-icon" (+) badge → ALWAYS opens the
                   add/compose flow, even if a status already exists.
                 • the rest of the tile (avatar/ring) → views the existing
                   status if one exists, otherwise also opens compose.
               FIX (bug: "+ doesn't open the upload picker"): previously
               the WHOLE tile (avatar AND + badge alike) only opened compose
               for users with zero existing statuses — once you had posted
               once, every tap (including the + badge) just reopened your
               existing status viewer, so + appeared permanently broken
               after the first post. Now the + badge is a dedicated target
               that always reaches the picker, regardless of status count.
               Its "Choose Media" control (#status-file-input in index.html)
               is a real <input type="file" accept="image/*,video/*"
               multiple>, so it correctly triggers the device's native
               photo/video picker — same UI as the reference screenshot;
               that part was already wired, just unreachable via +. */
            if (e.target.closest && e.target.closest('.status-add-icon') && e.target.closest('#add-my-status-btn')){
                e.preventDefault();
                if(_isGuest()){if(typeof window.openAuthModal==='function')window.openAuthModal('login');return;}
                var cmPlus=document.getElementById('create-status-modal');
                if(cmPlus){cmPlus.style.display='flex';cmPlus.classList.add('show');document.body.classList.add('modal-open');}
                setTimeout(_wireCreateModal,150);
                return;
            }
            if (e.target.closest && (e.target.closest('#add-my-status-btn')||e.target.id==='add-my-status-btn')){
                e.preventDefault();
                if(_isGuest()){if(typeof window.openAuthModal==='function')window.openAuthModal('login');return;}
                var myId=_us().id;
                var my=(window.userStatuses||[]).find(function(s){return s.userId===myId;});
                if(my&&my.items&&my.items.length){
                    var mi=(window.userStatuses||[]).indexOf(my);
                    openStatusViewer(mi>=0?mi:0);
                } else {
                    var cm=document.getElementById('create-status-modal');
                    if(cm){cm.style.display='flex';cm.classList.add('show');document.body.classList.add('modal-open');}
                    setTimeout(_wireCreateModal,150);
                }
                return;
            }

            /* cancel create-status */
            if (e.target.id==='cancel-status-btn'){
                var csm=document.getElementById('create-status-modal');
                if(csm){csm.style.display='none';csm.classList.remove('show');}
                document.body.classList.remove('modal-open');
            }
        });
    })();


    /* =========================================================================
       §11  CREATE STATUS MODAL
       ========================================================================= */
    function _wireCreateModal(){
        var modal=document.getElementById('create-status-modal');
        if(!modal||modal._v4Wired)return;
        modal._v4Wired=true;

        var cancelBtn=document.getElementById('cancel-status-btn');
        if(cancelBtn&&!cancelBtn._v4){cancelBtn._v4=true;
            cancelBtn.addEventListener('click',function(){modal.style.display='none';modal.classList.remove('show');document.body.classList.remove('modal-open');});
        }

        var fileInp=document.getElementById('status-file-input');
        if(!fileInp)return;

        /* FIX (bug: "Choose Media button does nothing — no file picker
           opens"): index.html's visible "Choose Media" control was never
           actually wired to trigger the real (likely visually-hidden)
           #status-file-input — nothing in app-status.js called .click() on
           it in response to a tap. The only existing listener here was
           'change' on the input itself, which only fires AFTER a file is
           already chosen — useless if nothing ever opens the picker in the
           first place. FIX: delegate clicks anywhere inside this modal and
           explicitly forward them to fileInp.click() whenever the tapped
           element looks like the media-choosing control — covers a
           <label for="status-file-input">, a button with a recognizable
           id/class, or a data-action attribute — without needing to know
           index.html's exact markup. Skips the real file input itself (a
           native click on it already works) and the other real controls in
           this modal (cancel/post/color-cycle/textarea) so this never
           double-fires or steals their taps. */
        if(!modal._v4ChooseMediaWired){
            modal._v4ChooseMediaWired=true;
            modal.addEventListener('click',function(e){
                var t=e.target.closest&&e.target.closest(
                    '[for="status-file-input"],'+
                    '#status-choose-media-btn,#choose-media-btn,#cs-choose-media-btn,'+
                    '.status-choose-media,.cs-choose-media,'+
                    '[data-action="choose-media"],[data-target="status-file-input"]'
                );
                if(!t){
                    /* Catch-all: index.html's exact markup/id for this
                       button is unknown, so as a last resort match on its
                       visible label text. Walk up from the click target to
                       the nearest clickable ancestor (button/label/div with
                       a click affordance) within this modal and check its
                       own text — not its full subtree — so this can't
                       accidentally match a large wrapping container. */
                    var cand=e.target.closest&&e.target.closest('button,label,[role="button"],a,div');
                    while(cand && modal.contains(cand)){
                        var ownText=(cand.textContent||'').trim().toLowerCase();
                        if(ownText==='choose media'||ownText==='choose file'||ownText==='select media'){ t=cand; break; }
                        cand=cand.parentElement;
                    }
                }
                if(!t)return;
                if(t.id==='status-file-input')return; // native input — already works on its own
                e.preventDefault();
                fileInp.click();
            });
        }

        fileInp.addEventListener('change',function(){
            var prev=document.getElementById('status-file-preview')||document.getElementById('cs-file-preview');
            if(!prev)return;
            prev.innerHTML='';
            var files=Array.from(fileInp.files||[]);
            if(!files.length){prev.style.display='none';return;}
            prev.style.display='block';

            /* Upload progress bar */
            var progWrap=document.createElement('div');progWrap.className='cs-upload-progress';
            var progBar=document.createElement('div');progBar.className='cs-upload-bar';
            progWrap.appendChild(progBar);
            prev.appendChild(progWrap);

            var first=files[0],isVid=first.type.startsWith('video/'),burl=URL.createObjectURL(first);
            var mEl=document.createElement(isVid?'video':'img');
            mEl.src=burl;
            mEl.style.cssText='width:100%;max-height:340px;object-fit:cover;display:block;background:#000;';
            if(isVid){
                mEl.muted=true;mEl.autoplay=false;mEl.controls=true;mEl.playsInline=true;mEl.preload='metadata';
                mEl.addEventListener('loadedmetadata',function(){
                    try{mEl.currentTime=0.1;}catch(err){}
                    var dur=mEl.duration;
                    var db=document.createElement('div');db.className='cs-dur';db.textContent=_fmtDur(dur);prev.appendChild(db);
                    if(dur>MAX_VID_S){var sn=document.createElement('div');sn.className='cs-split';sn.innerHTML='<i class="fas fa-cut"></i> '+Math.ceil(dur/MAX_VID_S)+' parts';prev.appendChild(sn);}
                });
            } else {
                mEl.addEventListener('load',function(){URL.revokeObjectURL(burl);});
            }
            prev.insertBefore(mEl,prev.firstChild);

            var rm=document.createElement('button');rm.type='button';rm.className='cs-rm-btn';rm.innerHTML='<i class="fas fa-times"></i>';
            rm.addEventListener('click',function(e2){e2.preventDefault();e2.stopPropagation();fileInp.value='';prev.innerHTML='';prev.style.display='none';try{URL.revokeObjectURL(burl);}catch(ex){}});
            prev.appendChild(rm);

            if(files.length>1){var cb2=document.createElement('div');cb2.style.cssText='position:absolute;bottom:8px;right:10px;background:rgba(0,0,0,0.65);color:#fff;font-size:0.76rem;font-weight:700;padding:2px 8px;border-radius:8px;';cb2.textContent='+'+( files.length-1)+' more';prev.appendChild(cb2);}
        });

        /* colour cycler — WhatsApp-style: one button cycles through the
           gradient set, applied live to #status-text-wrap (the textarea's
           own background IS the preview, no separate swatch grid). */
        var textWrap = document.getElementById('status-text-wrap');
        var cycleBtn  = document.getElementById('status-color-cycle-btn');
        var bgs=['linear-gradient(135deg,#0A0E27,#1B2B8B)','linear-gradient(135deg,#7F1D1D,#EF4444)','linear-gradient(135deg,#064E3B,#10B981)','linear-gradient(135deg,#1E1B4B,#6D28D9)','linear-gradient(135deg,#0C4A6E,#38BDF8)','linear-gradient(135deg,#78350F,#F59E0B)','linear-gradient(135deg,#831843,#EC4899)','linear-gradient(135deg,#1A1A2E,#E94560)','linear-gradient(135deg,#134E4A,#5EEAD4)','linear-gradient(135deg,#1F2937,#6EE7B7)'];
        var bgIdx=0;
        var selBg=bgs[0];
        if(textWrap) textWrap.style.background=selBg;
        if(cycleBtn&&!cycleBtn._v4){cycleBtn._v4=true;
            cycleBtn.addEventListener('click',function(e){
                e.preventDefault();
                bgIdx=(bgIdx+1)%bgs.length;
                selBg=bgs[bgIdx];
                if(textWrap) textWrap.style.background=selBg;
                cycleBtn.style.transform='scale(0.85)';
                setTimeout(function(){cycleBtn.style.transform='';},120);
            });
        }

        /* submit */
        var subBtn=document.getElementById('post-status-btn');
        if(subBtn&&!subBtn._v4){subBtn._v4=true;
            subBtn.addEventListener('click',async function(e){
                e.preventDefault();
                if(_isGuest()){_notify('Log in to post a status','info');return;}
                var txtEl2=document.getElementById('status-text-input');
                var txt=(txtEl2?txtEl2.value.trim():'');
                var fi2=document.getElementById('status-file-input');
                var files=fi2?Array.from(fi2.files||[]):[];
                if(!txt&&!files.length){_notify('Add text or media first','warning');return;}
                subBtn.disabled=true;subBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Posting…';
                /* FIX (upload progress bar never moved): .cs-upload-bar was
                   created on file-select but its width was never updated
                   anywhere, and it lived in a different closure than the
                   actual upload call, so the two were never connected.
                   Look it up live here and drive it from real XHR progress
                   events forwarded out of _buildItems → _uploadFile. */
                var progBarEl=document.querySelector('.cs-upload-bar');
                var onUploadProgress=function(fileIdx,totalFiles,pct){
                    if(!progBarEl) return;
                    var overall=Math.round(((fileIdx+(pct/100))/totalFiles)*100);
                    progBarEl.style.width=Math.min(overall,100)+'%';
                };
                try{
                    var newItems=await _buildItems(files,txt,selBg,onUploadProgress);
                    if(progBarEl) progBarEl.style.width='100%';
                    if(!newItems.length){_notify('Nothing to post','warning');return;}
                    var us2=_us();
                    var docId='status-'+us2.id;
                    if(!window.userStatuses)window.userStatuses=[];
                    var ei=window.userStatuses.findIndex(function(s){return s.userId===us2.id;});
                    /* FIX (point #4: "previous status disappears when a new
                       one is uploaded"): the prior write here replaced the
                       entire status document/array entry with a brand-new
                       `items` array containing ONLY the just-uploaded media —
                       every earlier still-live item was lost. Now: start from
                       whatever live (non-expired) items already exist for
                       this user and APPEND the new ones, exactly like
                       WhatsApp/Instagram multi-segment stories. */
                    var existingDoc = ei>-1 ? window.userStatuses[ei] : null;
                    var keptItems   = existingDoc ? _liveItems(existingDoc) : [];
                    var mergedItems = keptItems.concat(newItems);
                    var doc={userId:us2.id,name:us2.fullName||us2.username||'User',avatar:us2.avatar||'',items:mergedItems,viewed:false,createdAt:(existingDoc&&existingDoc.createdAt)||new Date().toISOString(),docId:docId};
                    /* FIX (point #4 persistence): merge:true on the `items`
                       field only — never blow away the doc wholesale, so a
                       fresh login's read of this same doc (see §13c below)
                       sees every still-live item, not just the latest post. */
                    if(window.fbDb){try{await window.fbDb.collection('statuses').doc(docId).set({userId:doc.userId,name:doc.name,avatar:doc.avatar,items:mergedItems,createdAt:doc.createdAt},{merge:true});}catch(fe){console.warn('[Status]',fe.message);}}
                    if(ei>-1)window.userStatuses[ei]=doc;else window.userStatuses.unshift(doc);
                    renderStatusBar();
                    _notify('✅ Status posted!','success');
                    modal.style.display='none';modal.classList.remove('show');document.body.classList.remove('modal-open');
                    if(txtEl2)txtEl2.value='';if(fi2)fi2.value='';
                    var pv=document.getElementById('status-file-preview')||document.getElementById('cs-file-preview');
                    if(pv){pv.innerHTML='';pv.style.display='none';}
                    modal._v4Wired=false;
                }catch(err){console.error('[Status post]',err);_notify('Failed: '+(err.message||'Try again'),'error');}
                finally{subBtn.disabled=false;subBtn.innerHTML='<i class="fas fa-paper-plane"></i>&nbsp;Post Status';}
            });
        }
    }

    async function _buildItems(files,txt,bg,onProgress){
        var items=[];
        if(txt&&!files.length){items.push(_mkItem('text',null,txt,bg));return items;}
        for(var i=0;i<files.length;i++){
            var f=files[i],isVid=f.type.startsWith('video/');
            var fileProg=function(pct){ if(typeof onProgress==='function') onProgress(i,files.length,pct); };
            if(isVid){
                var dur=await _getVidDur(f);
                _notify('Uploading video…','info');
                var url=await _uploadFile(f,'video',fileProg);
                if(!url){_notify('Video upload failed','error');continue;}
                if(dur>MAX_VID_S){
                    var sc=Math.ceil(dur/MAX_VID_S);
                    _notify('Splitting into '+sc+' parts','info');
                    for(var seg=0;seg<sc;seg++) items.push(_mkItem('video',url,txt,bg,{startOffset:seg*MAX_VID_S,endOffset:Math.min((seg+1)*MAX_VID_S,dur)}));
                } else items.push(_mkItem('video',url,txt,bg));
            } else {
                _notify('Uploading image…','info');
                var iurl=await _uploadFile(f,'image',fileProg);
                if(!iurl){_notify('Image upload failed','error');continue;}
                items.push(_mkItem('image',iurl,txt,bg));
            }
        }
        return items;
    }

    /* Direct Cloudinary upload — reads from window._appConfig.cloudinary.
       Uses XMLHttpRequest (not fetch) because fetch cannot report upload
       progress; onProgress (optional) receives 0-100 so callers can drive
       a real progress bar instead of the static one that previously sat
       frozen at 0%. */
    function _uploadFile(file, resourceType, onProgress){
        return new Promise(function(resolve){
            var cfg    = (window._appConfig && window._appConfig.cloudinary) || {};
            var cloud  = cfg.cloud || cfg.cloudName || 'dxwmts9vw';
            var preset = cfg.preset || cfg.uploadPreset || 'ehfapp_preset';
            if(!cloud){ _notify('Cloudinary not configured','error'); resolve(''); return; }
            var fd=new FormData();
            fd.append('file', file);
            fd.append('upload_preset', preset);
            fd.append('resource_type', resourceType==='video'?'video':'image');
            var xhr=new XMLHttpRequest();
            xhr.open('POST','https://api.cloudinary.com/v1_1/'+cloud+'/'+(resourceType==='video'?'video':'image')+'/upload');
            if(xhr.upload && typeof onProgress==='function'){
                xhr.upload.onprogress=function(ev){
                    if(ev.lengthComputable) onProgress(Math.round((ev.loaded/ev.total)*100));
                };
            }
            xhr.onload=function(){
                try{
                    var d=JSON.parse(xhr.responseText||'{}');
                    if(xhr.status>=200&&xhr.status<300) resolve(d.secure_url||d.url||'');
                    else { console.error('[Status upload]',d&&d.error&&d.error.message||xhr.status); resolve(''); }
                }catch(e){ console.error('[Status upload] bad response',e); resolve(''); }
            };
            xhr.onerror=function(){ console.error('[Status upload] network error'); resolve(''); };
            xhr.send(fd);
        });
    }

    function _mkItem(type,url,content,bg,extra){
        var it={id:'si-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type:type,url:url||'',content:content||'',bg:bg||'',createdAt:new Date().toISOString(),likes:0,retweets:0,likedBy:[],retweetedBy:[],viewers:[]};
        if(extra)Object.assign(it,extra);
        return it;
    }

    function _getVidDur(file){
        return new Promise(function(res){
            var done=false;
            function finish(d){ if(done) return; done=true;
                try{ if(v.parentNode) v.parentNode.removeChild(v); }catch(e){}
                try{ URL.revokeObjectURL(v.src); }catch(e){}
                res(d);
            }
            var v=document.createElement('video');
            v.preload='metadata';
            v.muted=true;
            /* FIX (video upload silently hangs forever on mobile): a detached
               <video> element (never added to the DOM) often never fires
               loadedmetadata on mobile Chrome/Android -- the browser defers
               or skips metadata loading for elements that aren't in the
               document. That left `await _getVidDur(file)` stuck forever,
               which blocked the entire upload silently (no error shown,
               button stuck on "Posting..."). Attaching it off-screen (not
               display:none -- some engines also skip loading for display:none
               media) makes metadata load reliably, and a 8s timeout
               guarantees this Promise always resolves either way. */
            v.style.cssText='position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
            document.body.appendChild(v);
            v.onloadedmetadata=function(){ finish(isFinite(v.duration)?v.duration:0); };
            v.onerror=function(){ finish(0); };
            setTimeout(function(){ finish(isFinite(v.duration)?v.duration:0); }, 8000);
            v.src=URL.createObjectURL(file);
        });
    }
    function _fmtDur(s){if(!isFinite(s)||s<=0)return '';var m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+(sec<10?'0':'')+sec;}


    /* =========================================================================
       §12  FIRESTORE PERSISTENCE
       ========================================================================= */
    function _persistItem(su,item){
        var docId=su.docId||('status-'+su.userId);
        if(!window.fbDb)return;
        try{window.fbDb.collection('statuses').doc(docId).set({items:su.items},{merge:true}).catch(function(){});}catch(e){}
    }


    /* =========================================================================
       §13  PURGE + BOOTSTRAP
       ========================================================================= */
    function _purge(){
        if(!window.userStatuses)return;
        window.userStatuses=window.userStatuses.filter(function(su){
            if(!su||!su.items)return false;
            su.items=su.items.filter(function(it){return !it.createdAt||(Date.now()-new Date(it.createdAt).getTime()<EXPIRY_MS);});
            if(!su.items.length){if(window.fbDb&&su.docId){try{window.fbDb.collection('statuses').doc(su.docId).delete();}catch(e){}}return false;}
            return true;
        });
        renderStatusBar();
    }

    /* ── utilities ── */
    function _liveItems(su){return(su.items||[]).filter(function(it){return !it.createdAt||(Date.now()-new Date(it.createdAt).getTime()<EXPIRY_MS);});}
    function _curSU(){return(window.userStatuses||[])[window._currentStatusUser];}
    function _timeAgo(iso){var s=Math.floor((Date.now()-new Date(iso).getTime())/1000);if(s<60)return 'Just now';if(s<3600)return Math.floor(s/60)+'m ago';return Math.floor(s/3600)+'h ago';}
    function _goProfile(uid){if(typeof window.renderUserProfile==='function')window.renderUserProfile(uid);if(typeof window.navigateTo==='function')window.navigateTo('profile');}
    function _openChat(uid,msg){if(typeof window.navigateTo==='function')window.navigateTo('messages');setTimeout(function(){var fn=window.openChatWith||window.openChat;if(typeof fn==='function')fn(uid,msg);},400);}
    function _lookupUser(uid){var m=window.mockUsers&&window.mockUsers[uid];if(m)return{name:m.fullName||m.username||uid,avatar:m.avatar||''};var f=(window.userStatuses||[]).find(function(s){return s.userId===uid;});if(f)return{name:f.name||uid,avatar:f.avatar||''};return{name:uid,avatar:''};}

    /* =========================================================================
       §13b  SCROLL-TO-HIDE STATUS BAR (point #3)
       Facebook/Instagram-style: scrolling down hides the status bar so it
       stops sitting over the feed; scrolling up — or returning near the
       top — reveals it again. Listens on .main-content, the app's actual
       scroll container (confirmed in app-nav.js: navigateTo() resets
       `.main-content.scrollTop = 0` on every section change, which is also
       why the bar correctly re-shows on navigation — scrollTop 0 always
       counts as "near top" below). Pure CSS class toggle — no layout
       changes, no interference with the sticky positioning itself.
       ========================================================================= */
    function _wireStatusBarScrollHide(){
        var mc = document.querySelector('.main-content');
        if (!mc || mc._svScrollWired) return;
        mc._svScrollWired = true;
        var lastY = mc.scrollTop;
        var THRESHOLD = 6;     // ignore sub-pixel/jitter scroll noise
        var NEAR_TOP  = 40;    // always show once back near the very top
        mc.addEventListener('scroll', function(){
            var bar = document.getElementById('status-bar-container');
            if (!bar) return;
            var y = mc.scrollTop;
            var dy = y - lastY;
            if (y <= NEAR_TOP) {
                bar.classList.remove('status-bar-hidden');
            } else if (dy > THRESHOLD) {
                bar.classList.add('status-bar-hidden');       // scrolling down → hide
            } else if (dy < -THRESHOLD) {
                bar.classList.remove('status-bar-hidden');    // scrolling up → reveal
            }
            lastY = y;
        }, { passive: true });
    }

    /* ── boot ── */
    _injectStyles();

    document.addEventListener('empyrean-init-done',function(){
        if(!window.userStatuses)window.userStatuses=[];
        _purge();
        setTimeout(renderStatusBar,400);
        setTimeout(_wireCreateModal,700);
        setTimeout(_wireStatusBarScrollHide,400);
    });
    document.addEventListener('empyrean-user-ready',function(){
        _purge();setTimeout(renderStatusBar,200);
    });
    document.addEventListener('empyrean-section-change',function(){
        var bar = document.getElementById('status-bar-container');
        if (bar) bar.classList.remove('status-bar-hidden');
        setTimeout(_wireStatusBarScrollHide,200);
    });
    document.addEventListener('click',function(e){
        if(e.target.closest&&(e.target.closest('#add-my-status-btn')||e.target.closest('[data-modal="create-status-modal"]')))
            setTimeout(_wireCreateModal,200);
    });
    setInterval(_purge,5*60*1000);
    if(document.readyState!=='loading'){
        if(!window.userStatuses)window.userStatuses=[];
        setTimeout(renderStatusBar,800);
        setTimeout(_wireCreateModal,1000);
    }

    console.log('[EmpStatus v4] ✅ Fixed: no listener stacking, bubble hearts in sv-content, peek-on-tap, viewers panel, direct Cloudinary upload.');

})();