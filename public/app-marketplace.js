/* =============================================================================
   EMPYREAN INTERNATIONAL — MARKETPLACE  (v2 — Full Fix)
   app-marketplace.js

   FIXES IN THIS VERSION
   ─────────────────────
   • Marketplace uploads now auto-reflect on home dashboard strip
   • Edit & Delete buttons on property cards are fully functional
   • Direct sales cards get Edit & Delete buttons
   • "Expand Contact" button correctly reveals/hides contact info
   • Action button row is horizontally scrollable (no wrapping)
   • Cart section fully re-engineered (all buttons work)
   • Flutterwave checkout connected via window._appConfig.flutterwave.publicKey
   ============================================================================= */

(function empyreanMarketplaceModule() {
    'use strict';

    if (window._empyreanMarketplaceLoaded) {
        console.warn('[EmpMarket] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanMarketplaceLoaded = true;

    /* ── State accessors ── */
    function _cart()    { return (window.EmpState && window.EmpState.cart) || window.cart || []; }
    function _S()       { return window.EmpState || {}; }
    function _us()      { return _S().userState || window.userState || {}; }
    function _isGuest() { var s = _S(); return s.isGuest != null ? s.isGuest : (window.isGuest !== undefined ? window.isGuest : true); }
    function _isAdmin() { var s = _S(); return s.isAdmin != null ? s.isAdmin : (window.isAdmin || false); }

    function _setCart(v) {
        if (window.EmpState) window.EmpState.cart = v;
        window.cart = v;
    }

    function _esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _notify(msg, type) {
        if (typeof window.showNotification === 'function') window.showNotification(msg, type || 'info');
    }

    /* ── Inject action-row scroll CSS once ── */
    (function _injectActionRowCSS() {
        if (document.getElementById('_mkt_action_style')) return;
        var s = document.createElement('style');
        s.id = '_mkt_action_style';
        s.textContent = [
            '.property-actions {',
            '  display: flex !important;',
            '  flex-wrap: nowrap !important;',
            '  overflow-x: auto !important;',
            '  gap: 8px !important;',
            '  padding: 8px 12px !important;',
            '  scrollbar-width: none !important;',
            '  -webkit-overflow-scrolling: touch !important;',
            '}',
            '.property-actions::-webkit-scrollbar { display: none; }',
            '.property-actions .btn { flex-shrink: 0 !important; white-space: nowrap !important; }',
            /* Direct contact info expand panel */
            '.direct-contact-info {',
            '  padding: 0;',
            '  overflow: hidden;',
            '  max-height: 0;',
            '  transition: max-height 0.3s ease, padding 0.3s ease;',
            '  background: rgba(0,212,170,0.06);',
            '  border-top: 1px solid rgba(0,212,170,0.12);',
            '}',
            '.direct-contact-info.open {',
            '  max-height: 300px !important;',
            '  padding: 12px 16px !important;',
            '}',
            '.direct-contact-info p { margin: 4px 0; font-size: 0.88rem; }',
        ].join('\n');
        document.head.appendChild(s);
    })();

    /* ── Inject premium gallery-lightbox CSS once ──
       Scoped entirely to the existing gallery selectors that
       app-marketplace.js and app-fixes.js already read/write
       (#marketplace-gallery-modal, .gallery-main-image-container,
       #gallery-thumbnails-container, .gallery-thumbnail,
       #gallery-prev-btn/#gallery-next-btn). Does not touch or assume
       anything about the modal's outer HTML shell — only restyles
       these existing classes/ids, and adds a couple of new elements
       (slide counter, drag track) that §5 below creates itself. */
    (function _injectGalleryCSS() {
        if (document.getElementById('_mkt_gallery_style')) return;
        var s = document.createElement('style');
        s.id = '_mkt_gallery_style';
        s.textContent = [
            /* Backdrop: deep cinema-black with blur, fades in */
            '#marketplace-gallery-modal {',
            '  background: rgba(4,6,16,0.97) !important;',
            '  backdrop-filter: blur(6px);',
            '  -webkit-backdrop-filter: blur(6px);',
            '}',
            '#marketplace-gallery-modal.show {',
            '  animation: _mktGalleryFadeIn 0.22s ease both;',
            '}',
            '@keyframes _mktGalleryFadeIn { from { opacity: 0; } to { opacity: 1; } }',

            /* Main image stage: edge-to-edge, no letterboxed look */
            '.gallery-main-image-container {',
            '  position: relative !important;',
            '  width: 100% !important;',
            '  max-width: 720px !important;',
            '  margin: 0 auto !important;',
            '  overflow: hidden !important;',
            '  border-radius: 18px !important;',
            '  background: linear-gradient(160deg, rgba(255,255,255,0.02), rgba(255,255,255,0)) !important;',
            '  box-shadow: 0 24px 70px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.04) inset !important;',
            '  touch-action: pan-y !important;',
            '}',
            '.gallery-main-image-container img, .gallery-main-image-container video {',
            '  border-radius: 18px !important;',
            '  will-change: transform, opacity;',
            '  user-select: none;',
            '  -webkit-user-drag: none;',
            '}',
            /* Slide-transition state classes — toggled by renderMarketplaceGalleryView */
            '.gallery-main-image-container img.mkt-slide-enter-right, .gallery-main-image-container video.mkt-slide-enter-right {',
            '  animation: _mktSlideInRight 0.32s cubic-bezier(.22,.61,.36,1) both;',
            '}',
            '.gallery-main-image-container img.mkt-slide-enter-left, .gallery-main-image-container video.mkt-slide-enter-left {',
            '  animation: _mktSlideInLeft 0.32s cubic-bezier(.22,.61,.36,1) both;',
            '}',
            '@keyframes _mktSlideInRight { from { opacity:0; transform: translateX(28px) scale(0.985); } to { opacity:1; transform: translateX(0) scale(1); } }',
            '@keyframes _mktSlideInLeft  { from { opacity:0; transform: translateX(-28px) scale(0.985); } to { opacity:1; transform: translateX(0) scale(1); } }',

            /* Nav arrows: soft glass pills instead of bare circles */
            '#gallery-prev-btn, #gallery-next-btn {',
            '  width: 44px !important; height: 44px !important;',
            '  border-radius: 50% !important;',
            '  background: rgba(255,255,255,0.08) !important;',
            '  border: 1px solid rgba(255,255,255,0.14) !important;',
            '  backdrop-filter: blur(8px);',
            '  display: flex !important; align-items: center !important; justify-content: center !important;',
            '  color: #fff !important;',
            '  transition: background 0.18s, transform 0.18s !important;',
            '}',
            '#gallery-prev-btn:hover, #gallery-next-btn:hover {',
            '  background: rgba(255,255,255,0.16) !important;',
            '  transform: scale(1.06) !important;',
            '}',
            '#gallery-prev-btn:active, #gallery-next-btn:active { transform: scale(0.94) !important; }',

            /* Close button: consistent glass treatment */
            '#marketplace-gallery-modal .close-modal, #marketplace-gallery-modal .close-gallery-btn, #marketplace-gallery-modal #gallery-close-btn {',
            '  background: rgba(255,255,255,0.08) !important;',
            '  border: 1px solid rgba(255,255,255,0.14) !important;',
            '  backdrop-filter: blur(8px);',
            '  border-radius: 50% !important;',
            '  color: #fff !important;',
            '  transition: background 0.18s, transform 0.18s !important;',
            '}',
            '#marketplace-gallery-modal .close-modal:hover, #marketplace-gallery-modal .close-gallery-btn:hover, #marketplace-gallery-modal #gallery-close-btn:hover {',
            '  background: rgba(255,255,255,0.16) !important; transform: scale(1.06) !important;',
            '}',

            /* Thumbnail strip: centered, premium active state, smooth scroll */
            '#gallery-thumbnails-container {',
            '  display: flex !important;',
            '  justify-content: center !important;',
            '  gap: 10px !important;',
            '  padding: 14px 16px calc(14px + env(safe-area-inset-bottom,0)) !important;',
            '  overflow-x: auto !important;',
            '  scroll-behavior: smooth;',
            '  scrollbar-width: none !important;',
            '}',
            '#gallery-thumbnails-container::-webkit-scrollbar { display: none; }',
            '.gallery-thumbnail {',
            '  width: 56px !important; height: 56px !important;',
            '  border-radius: 10px !important;',
            '  overflow: hidden !important;',
            '  flex-shrink: 0 !important;',
            '  cursor: pointer !important;',
            '  opacity: 0.5 !important;',
            '  border: 2px solid transparent !important;',
            '  transition: opacity 0.2s, border-color 0.2s, transform 0.2s !important;',
            '}',
            '.gallery-thumbnail:hover { opacity: 0.8 !important; transform: translateY(-2px) !important; }',
            '.gallery-thumbnail.active {',
            '  opacity: 1 !important;',
            '  border-color: #00D4AA !important;',
            '  box-shadow: 0 4px 14px rgba(0,212,170,0.35) !important;',
            '}',

            /* Slide counter badge — created by renderMarketplaceGalleryView */
            '.mkt-gallery-counter {',
            '  position: absolute; top: 14px; left: 50%; transform: translateX(-50%);',
            '  background: rgba(255,255,255,0.10); backdrop-filter: blur(8px);',
            '  color: #fff; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.02em;',
            '  padding: 5px 14px; border-radius: 50px; z-index: 6; pointer-events: none;',
            '  border: 1px solid rgba(255,255,255,0.14);',
            '}',

            /* Dot pager — under the main image, Marketplace-style */
            '.mkt-gallery-dots {',
            '  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);',
            '  display: flex; align-items: center; gap: 6px; z-index: 6; pointer-events: none;',
            '}',
            '.mkt-gallery-dot {',
            '  width: 6px; height: 6px; border-radius: 50%;',
            '  background: rgba(255,255,255,0.4);',
            '  transition: background 0.18s, transform 0.18s;',
            '}',
            '.mkt-gallery-dot.active {',
            '  background: #fff;',
            '  transform: scale(1.3);',
            '}',
        ].join('\n');
        document.head.appendChild(s);
    })();



    /* =========================================================================
       §1  PRICE FORMATTER
       ========================================================================= */
    function _fmtPrice(price, currency) {
        var p = parseFloat(price) || 0;
        var cur = (currency || 'NGN').toUpperCase();
        switch (cur) {
            case 'NGN':  return '₦' + p.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            case 'EUR':  return '€' + p.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            case 'GBP':  return '£' + p.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            case 'GHS':  return '₵' + p.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            case 'EMPY': return p.toLocaleString() + ' EMPY';
            case 'USDT': return 'USDT ' + p.toLocaleString(undefined, { minimumFractionDigits: 2 });
            default:
                return typeof window.formatUsdPrice === 'function'
                    ? window.formatUsdPrice(p)
                    : '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2 });
        }
    }
    window._fmtPrice = _fmtPrice;


    /* =========================================================================
       §1b  _openMarketChatOverlay — floating WhatsApp-style chat box
            Opens on top of the marketplace without navigating away.
            Messages are saved to Firestore 'messages' collection with
            senderId / receiverId so the seller sees them in their inbox.
       ========================================================================= */
    function _openMarketChatOverlay(sellerId, sellerName) {
        var OVERLAY_ID = 'mkt-chat-overlay';
        var existing   = document.getElementById(OVERLAY_ID);
        if (existing) {
            /* If same seller, just show it; otherwise rebuild */
            if (existing.dataset.sellerId === sellerId) {
                existing.style.display = 'flex';
                var inp = existing.querySelector('.mkt-chat-input');
                if (inp) inp.focus();
                return;
            }
            existing.remove();
        }

        var us = _us();
        if (!us.id) { if (typeof window.openAuthModal === 'function') window.openAuthModal('login'); return; }
        var db = window.fbDb;

        /* ── CSS (injected once) ── */
        if (!document.getElementById('_mkt_chat_css')) {
            var css = document.createElement('style');
            css.id  = '_mkt_chat_css';
            css.textContent = [
                '#mkt-chat-overlay{position:fixed;bottom:0;right:16px;width:320px;max-height:480px;display:flex;flex-direction:column;background:#fff;border-radius:16px 16px 0 0;box-shadow:0 -4px 32px rgba(10,14,39,0.22);z-index:99999;font-family:inherit;overflow:hidden;}',
                '@media(max-width:480px){#mkt-chat-overlay{right:0;left:0;width:100%;border-radius:16px 16px 0 0;}}',
                '#mkt-chat-overlay .mkt-chat-header{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1B2B8B,#0A0E27);color:#fff;cursor:default;}',
                '#mkt-chat-overlay .mkt-chat-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,0.15);flex-shrink:0;}',
                '#mkt-chat-overlay .mkt-chat-title{flex:1;font-weight:700;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
                '#mkt-chat-overlay .mkt-chat-close{background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;padding:0 4px;opacity:0.8;line-height:1;flex-shrink:0;}',
                '#mkt-chat-overlay .mkt-chat-close:hover{opacity:1;}',
                '#mkt-chat-overlay .mkt-chat-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:160px;max-height:320px;background:#f7f8fc;}',
                '#mkt-chat-overlay .mkt-msg{max-width:82%;padding:8px 12px;border-radius:14px;font-size:0.84rem;line-height:1.4;word-break:break-word;}',
                '#mkt-chat-overlay .mkt-msg.sent{align-self:flex-end;background:#1B2B8B;color:#fff;border-bottom-right-radius:4px;}',
                '#mkt-chat-overlay .mkt-msg.recv{align-self:flex-start;background:#fff;color:#0A0E27;border:1px solid rgba(10,14,39,0.10);border-bottom-left-radius:4px;}',
                '#mkt-chat-overlay .mkt-msg .mkt-msg-time{font-size:0.68rem;opacity:0.6;margin-top:3px;display:block;text-align:right;}',
                '#mkt-chat-overlay .mkt-chat-empty{color:#9CA3AF;font-size:0.82rem;text-align:center;margin:auto;padding:20px 0;}',
                '#mkt-chat-overlay .mkt-chat-composer{display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid rgba(10,14,39,0.08);background:#fff;flex-shrink:0;}',
                '#mkt-chat-overlay .mkt-chat-input{flex:1;border:1px solid rgba(10,14,39,0.14);border-radius:20px;padding:8px 14px;font-size:0.85rem;outline:none;resize:none;line-height:1.3;max-height:80px;overflow-y:auto;font-family:inherit;}',
                '#mkt-chat-overlay .mkt-chat-input:focus{border-color:#1B2B8B;}',
                '#mkt-chat-overlay .mkt-chat-send{flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#1B2B8B;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.18s;}',
                '#mkt-chat-overlay .mkt-chat-send:hover{background:#2d45c8;}',
                '#mkt-chat-overlay .mkt-chat-send svg{width:16px;height:16px;fill:#fff;}',
                '#mkt-chat-overlay .mkt-chat-send:disabled{background:#9CA3AF;cursor:not-allowed;}',
            ].join('');
            document.head.appendChild(css);
        }

        /* ── DOM ── */
        var overlay = document.createElement('div');
        overlay.id             = OVERLAY_ID;
        overlay.dataset.sellerId = sellerId;
        overlay.innerHTML = [
            '<div class="mkt-chat-header">',
            '  <img class="mkt-chat-avatar" src="https://ui-avatars.com/api/?name='+encodeURIComponent(sellerName)+'&background=1B2B8B&color=fff&size=80" id="mkt-chat-av">',
            '  <span class="mkt-chat-title">'+_esc(sellerName)+'</span>',
            '  <button class="mkt-chat-close" title="Close">&times;</button>',
            '</div>',
            '<div class="mkt-chat-body" id="mkt-chat-body">',
            '  <span class="mkt-chat-empty">Say hello to '+_esc(sellerName)+'</span>',
            '</div>',
            '<div class="mkt-chat-composer">',
            '  <div class="mkt-chat-input" contenteditable="true" role="textbox" placeholder="Message '+_esc(sellerName)+'…"></div>',
            '  <button class="mkt-chat-send" title="Send">',
            '    <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
            '  </button>',
            '</div>',
        ].join('');
        document.body.appendChild(overlay);

        var body    = overlay.querySelector('#mkt-chat-body');
        var inp     = overlay.querySelector('.mkt-chat-input');
        var sendBtn = overlay.querySelector('.mkt-chat-send');

        /* ── Load seller avatar from Firestore users ── */
        if (db) {
            try {
                db.collection('users').doc(sellerId).get().then(function(doc) {
                    if (!doc.exists) return;
                    var d = doc.data();
                    var av = d.avatar || d.profilePicture || d.photoURL || '';
                    if (av) overlay.querySelector('#mkt-chat-av').src = av;
                }).catch(function(){});
            } catch(e){}
        }

        /* ── Helper: add a bubble ── */
        function _bubble(text, isSent, ts) {
            var empty = body.querySelector('.mkt-chat-empty');
            if (empty) empty.remove();
            var d = document.createElement('div');
            d.className = 'mkt-msg ' + (isSent ? 'sent' : 'recv');
            var t = document.createElement('span');
            t.textContent = text;
            var tm = document.createElement('span');
            tm.className = 'mkt-msg-time';
            tm.textContent = ts ? new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'now';
            d.appendChild(t);
            d.appendChild(tm);
            body.appendChild(d);
            body.scrollTop = body.scrollHeight;
            return d;
        }

        /* ── Compose a chatId that is the same for both parties (sorted) ── */
        var chatId = [us.id, sellerId].sort().join('_');

        /* ── Load history + real-time listener ── */
        var _unsub = null;
        if (db) {
            try {
                _unsub = db.collection('messages')
                    .where('chatId', '==', chatId)
                    .orderBy('createdAt', 'asc')
                    .limit(50)
                    .onSnapshot(function(snap) {
                        if (!snap) return;
                        snap.docChanges().forEach(function(ch) {
                            if (ch.type !== 'added') return;
                            var msg = ch.doc.data();
                            var msgDocId = ch.doc.id;
                            if (body.querySelector('[data-msgid="'+msgDocId+'"]')) return; /* dedup */
                            var bubble = _bubble(msg.text || '', msg.senderId === us.id, msg.createdAt);
                            bubble.dataset.msgid = msgDocId;
                        });
                    }, function(err) {
                        /* If chatId query fails (no index yet), fall back to senderId+receiverId query */
                        console.warn('[MktChat] chatId query failed, trying fallback:', err.message);
                        try {
                            db.collection('messages')
                                .where('senderId', 'in', [us.id, sellerId])
                                .where('receiverId', 'in', [us.id, sellerId])
                                .orderBy('createdAt', 'asc')
                                .limit(50)
                                .onSnapshot(function(snap2) {
                                    if (!snap2) return;
                                    snap2.docChanges().forEach(function(ch) {
                                        if (ch.type !== 'added') return;
                                        var msg = ch.doc.data();
                                        /* Only show messages between these two users */
                                        var between = (msg.senderId === us.id && msg.receiverId === sellerId) ||
                                                      (msg.senderId === sellerId && msg.receiverId === us.id);
                                        if (!between) return;
                                        var msgDocId = ch.doc.id;
                                        if (body.querySelector('[data-msgid="'+msgDocId+'"]')) return;
                                        var bubble = _bubble(msg.text || '', msg.senderId === us.id, msg.createdAt);
                                        bubble.dataset.msgid = msgDocId;
                                    });
                                }, function(){});
                        } catch(e2){}
                    });
            } catch(e){}
        }

        /* ── Send ── */
        function _send() {
            var text = inp.textContent.trim() || inp.innerText.trim();
            if (!text) return;
            inp.textContent = '';
            inp.innerText   = '';
            sendBtn.disabled = true;

            /* Optimistic bubble */
            _bubble(text, true, new Date().toISOString());

            if (db) {
                var msgId  = 'mkt-msg-' + Date.now();
                var payload = {
                    id:          msgId,
                    chatId:      chatId,       /* shared key both parties can query */
                    senderId:    us.id,
                    receiverId:  sellerId,
                    senderName:  us.fullName || us.username || 'Buyer',
                    text:        text,
                    source:      'marketplace',
                    read:        false,
                    createdAt:   new Date().toISOString()
                };
                try {
                    db.collection('messages').doc(msgId).set(payload)
                        .then(function() { sendBtn.disabled = false; })
                        .catch(function(err) {
                            console.warn('[MktChat] send error:', err.message);
                            sendBtn.disabled = false;
                            _notify('Message not saved — check connection.', 'warning');
                        });
                } catch(e) { sendBtn.disabled = false; }
            } else {
                sendBtn.disabled = false;
                _notify('You are offline — message not saved.', 'warning');
            }
        }

        /* ── Events ── */
        sendBtn.addEventListener('click', _send);
        inp.addEventListener('keydown', function(ev) {
            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); _send(); }
        });
        inp.addEventListener('input', function() {
            sendBtn.disabled = !(inp.textContent.trim() || inp.innerText.trim());
        });
        sendBtn.disabled = true;

        overlay.querySelector('.mkt-chat-close').addEventListener('click', function() {
            overlay.style.display = 'none';
            if (_unsub) { try { _unsub(); } catch(e){} }
        });

        inp.focus();
        console.log('[MktChat] Overlay opened for seller:', sellerId);
    }
    window._openMarketChatOverlay = _openMarketChatOverlay;


    /* =========================================================================
       §2  renderMarketplaceCards
       ========================================================================= */
    function renderMarketplaceCards() {
        document.querySelectorAll('#marketplace .property-card, #property-grid-container .property-card')
            .forEach(function (card) {
                var priceEl = card.querySelector('.property-info div:last-child');
                if (priceEl && card.dataset.price) {
                    var cur = (card.dataset.displayCurrency || card.dataset.currency || 'NGN').toUpperCase();
                    var existing = priceEl.querySelector('.currency-badge');
                    if (existing) existing.remove();
                    priceEl.textContent = _fmtPrice(card.dataset.price, cur);
                    var badge = document.createElement('span');
                    badge.className = 'currency-badge';
                    badge.textContent = cur;
                    badge.style.cssText = 'display:inline-block;margin-left:6px;font-size:0.65rem;font-weight:700;background:rgba(0,212,170,0.12);padding:2px 7px;border-radius:20px;color:#00D4AA;vertical-align:middle;';
                    priceEl.appendChild(badge);
                }

                var salesType   = card.dataset.salesType;
                var addToCartBtn = card.querySelector('.add-to-cart-btn');
                var contactBtn   = card.querySelector('.contact-seller-btn');
                var warningEl    = card.querySelector('.direct-trade-warning');

                if (addToCartBtn) addToCartBtn.style.display = 'none';
                if (contactBtn)   contactBtn.style.display   = 'none';
                if (warningEl)    warningEl.style.display    = 'none';

                if (salesType === 'escrow') {
                    if (addToCartBtn) addToCartBtn.style.display = '';
                } else {
                    if (contactBtn) {
                        contactBtn.style.display = '';
                        /* Relabel to "Message Seller" so click opens inbox directly */
                        if (!contactBtn._vfMsgLabelled) {
                            contactBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> Message Seller';
                            contactBtn._vfMsgLabelled = true;
                        }
                    }
                    if (warningEl)  warningEl.style.display  = '';
                }

                /* Ensure Edit/Delete are shown for owner/admin */
                _ensureOwnerActions(card);
            });
    }
    window.renderMarketplaceCards = renderMarketplaceCards;

    /**
     * Add Edit, Delete (and Promote) buttons to a card if the current user
     * is the seller or admin, and those buttons aren't already present.
     */
    function _ensureOwnerActions(card) {
        if (!card) return;
        var us = _us();
        var sellerId = card.dataset.sellerId || card.dataset.userId || '';
        var isOwner  = (us.id && sellerId && sellerId === us.id) || _isAdmin();
        if (!isOwner) return;

        var actions = card.querySelector('.property-actions');
        if (!actions) {
            /* Create an actions row for cards that don't have one (e.g. escrow cards) */
            actions = document.createElement('div');
            actions.className = 'property-actions';
            /* Insert before the first .direct-contact-info or at end of card */
            var contactInfo = card.querySelector('.direct-contact-info');
            if (contactInfo) {
                card.insertBefore(actions, contactInfo);
            } else {
                card.appendChild(actions);
            }
        }

        if (!actions.querySelector('.edit-post-btn')) {
            var editBtn = document.createElement('button');
            editBtn.className = 'btn edit-post-btn';
            editBtn.style.cssText = 'background:rgba(0,212,170,0.10);color:#00D4AA;border:1px solid rgba(0,212,170,0.25);flex-shrink:0;';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            actions.appendChild(editBtn);
        }
        if (!actions.querySelector('.delete-post-btn')) {
            var delBtn = document.createElement('button');
            delBtn.className = 'btn delete-post-btn';
            delBtn.style.cssText = 'background:rgba(229,57,53,0.08);color:#e53935;border:1px solid rgba(229,57,53,0.2);flex-shrink:0;';
            delBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
            actions.appendChild(delBtn);
        }
    }


    /* =========================================================================
       §3  Dashboard strip sync — addMarketItemToDashboardStrip
       Called after every successful marketplace upload.
       ========================================================================= */
    function addMarketItemToDashboardStrip(data) {
        var cont   = document.getElementById('dashboard-market-container');
        var slider = document.getElementById('dashboard-market-slider');
        if (!cont || !slider) return;
        cont.style.display = 'block';

        /* Don't duplicate */
        if (data.id && slider.querySelector('[data-id="' + data.id + '"]')) return;

        var card = document.createElement('div');
        card.className = 'dashboard-market-card';
        card.dataset.id        = data.id || '';
        card.dataset.navTarget = 'marketplace';

        var firstUrl = (data.media && data.media[0]) || data.img || data.videoSrc || '';
        var isVid = /\.(mp4|webm|mov)(\?|$)/i.test(firstUrl) || /\/video\/upload\//i.test(firstUrl);
        var priceStr = _fmtPrice(data.price || 0, data.currency || 'NGN');

        if (firstUrl) {
            card.innerHTML = (isVid
                ? '<video src="' + _esc(firstUrl) + '" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video>'
                : '<img src="' + _esc(firstUrl) + '" alt="' + _esc(data.name || '') + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;">')
                + '<div class="dashboard-market-card-info"><h5>' + _esc(data.name || '') + '</h5><p>' + priceStr + '</p></div>';
        } else {
            card.innerHTML = '<div style="width:100%;height:80px;background:rgba(0,212,170,0.08);display:flex;align-items:center;justify-content:center;"><i class="fas fa-store" style="font-size:2rem;color:rgba(0,212,170,0.5);"></i></div>'
                + '<div class="dashboard-market-card-info"><h5>' + _esc(data.name || '') + '</h5><p>' + priceStr + '</p></div>';
        }

        slider.prepend(card);
    }
    window.addMarketItemToDashboardSlider = addMarketItemToDashboardStrip; /* alias for app-fixes.js */
    window.addMarketItemToDashboardStrip  = addMarketItemToDashboardStrip;


    /* =========================================================================
       §4  updateCartUI
       ========================================================================= */
    function updateCartUI() {
        var cart = _cart();

        /* Badge */
        document.querySelectorAll('.cart-item-count').forEach(function (el) {
            el.textContent = cart.length;
        });

        var itemsCont   = document.getElementById('cart-items-container');
        var cartTotalEl = document.getElementById('cart-total');
        var checkoutBtn = document.querySelector('.checkout-btn');

        if (!itemsCont || !cartTotalEl) return;

        /* Show cart view, hide checkout view */
        var cartView     = document.getElementById('cart-view');
        var checkoutView = document.getElementById('checkout-view');
        if (cartView)     cartView.style.display     = 'block';
        if (checkoutView) checkoutView.style.display = 'none';

        if (cart.length === 0) {
            itemsCont.innerHTML = '<p style="text-align:center;padding:30px 20px;color:var(--text-muted);">'
                + '<i class="fas fa-shopping-cart" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:0.35;"></i>'
                + 'Your cart is empty</p>';
            cartTotalEl.textContent = 'Total: $0.00';
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }

        if (checkoutBtn) checkoutBtn.disabled = false;

        var html = '';
        cart.forEach(function (item) {
            var priceStr = _fmtPrice(item.price, item.currency || 'NGN');
            html += '<div class="cart-item" data-id="' + _esc(item.id) + '" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.06);">'
                + '<img src="' + _esc(item.img || '') + '" alt="' + _esc(item.name) + '" '
                + 'onerror="this.style.display=\'none\'" style="width:70px;height:70px;object-fit:cover;border-radius:10px;flex-shrink:0;">'
                + '<div style="flex:1;min-width:0;">'
                + '<div style="font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(item.name) + '</div>'
                + '<div style="color:var(--accent-color,#00D4AA);font-weight:700;font-size:0.95rem;margin-top:4px;">' + priceStr + '</div>'
                + '</div>'
                + '<button class="remove-cart-item-btn" data-id="' + _esc(item.id) + '" '
                + 'style="background:none;border:none;color:#e53935;cursor:pointer;font-size:1.1rem;padding:4px 8px;border-radius:6px;flex-shrink:0;" '
                + 'title="Remove"><i class="fas fa-times"></i></button>'
                + '</div>';
        });
        itemsCont.innerHTML = html;

        /* Group totals by currency */
        var totals = {};
        cart.forEach(function (item) {
            var cur = (item.currency || 'NGN').toUpperCase();
            totals[cur] = (totals[cur] || 0) + parseFloat(item.price || 0);
        });
        var totalStr = Object.keys(totals).map(function (cur) {
            return _fmtPrice(totals[cur], cur);
        }).join(' + ');
        cartTotalEl.textContent = 'Total: ' + totalStr;
    }
    window.updateCartUI = updateCartUI;


    /* =========================================================================
       §5  GALLERY LIGHTBOX
       ========================================================================= */
    function _mgs() {
        return (window.EmpState && window.EmpState.marketplaceGalleryState)
            || window.marketplaceGalleryState
            || { media: [], currentIndex: 0 };
    }
    function _setMgs(patch) {
        var s = _mgs();
        Object.assign(s, patch);
        if (window.EmpState) window.EmpState.marketplaceGalleryState = s;
        else window.marketplaceGalleryState = s;
    }

    function showMarketplaceGallery(media, startIndex) {
        startIndex = startIndex || 0;
        _setMgs({ media: media, currentIndex: startIndex });
        var modal = document.getElementById('marketplace-gallery-modal');
        if (!modal) return;
        modal.style.display = '';
        modal.style.visibility = '';
        modal.classList.add('show');
        document.body.classList.add('modal-open');
        renderMarketplaceGalleryView();
    }
    window.showMarketplaceGallery = showMarketplaceGallery;

    function _stopGalleryVideo() {
        var v = document.querySelector('.gallery-main-image-container video');
        if (v) { try { v.pause(); v.src = ''; } catch (e) {} }
    }

    function renderMarketplaceGalleryView(direction) {
        var mainCont   = document.querySelector('.gallery-main-image-container');
        var thumbsCont = document.getElementById('gallery-thumbnails-container');
        if (!mainCont || !thumbsCont) return;

        var state = _mgs();
        Array.from(mainCont.childNodes).forEach(function (node) {
            if (node.nodeType === 1 && node.tagName !== 'BUTTON') node.remove();
        });

        var rawMedia = state.media[state.currentIndex];
        if (!rawMedia) return;

        var currentUrl  = typeof rawMedia === 'string' ? rawMedia : (rawMedia.url || rawMedia);
        var currentType = typeof rawMedia === 'object' ? (rawMedia.type || '') : '';
        var isVideo     = currentType.startsWith('video/')
            || /\.(mp4|webm|mov)(\?|$)/i.test(currentUrl)
            || /\/video\/upload\//i.test(currentUrl);

        var mainEl;
        if (isVideo) {
            mainEl = document.createElement('video');
            mainEl.src = currentUrl; mainEl.controls = true; mainEl.autoplay = true; mainEl.loop = true;
            mainEl.style.cssText = 'width:100%;max-height:80vh;object-fit:contain;';
        } else {
            mainEl = document.createElement('img');
            mainEl.src = currentUrl; mainEl.alt = 'Marketplace item'; mainEl.loading = 'lazy';
            mainEl.style.cssText = 'width:100%;max-height:80vh;object-fit:contain;';
        }
        mainEl.onerror = function () { this.style.opacity = '0.3'; };
        /* FIX (premium redesign): apply a slide-in transition class that
           matches the navigation direction — +1 (next) enters from the
           right, -1 (prev) enters from the left, matching the physical
           direction of a swipe/arrow tap. No direction passed (first open,
           thumbnail jump) → no animation class, so those stay an instant
           cut as before. Purely a CSS class; the underlying element swap
           logic is unchanged. */
        if (direction === 1)      mainEl.classList.add('mkt-slide-enter-right');
        else if (direction === -1) mainEl.classList.add('mkt-slide-enter-left');
        mainCont.appendChild(mainEl);

        /* Slide counter badge ("2 / 5") — created once, reused on every
           render. Skipped entirely for single-image listings since a
           counter showing "1 / 1" adds nothing. */
        var counter = mainCont.querySelector('.mkt-gallery-counter');
        if (state.media.length > 1) {
            if (!counter) {
                counter = document.createElement('div');
                counter.className = 'mkt-gallery-counter';
                mainCont.appendChild(counter);
            } else {
                mainCont.appendChild(counter); /* keep on top of freshly-appended media */
            }
            counter.textContent = (state.currentIndex + 1) + ' / ' + state.media.length;
        } else if (counter) {
            counter.remove();
        }

        /* Dot pager — small dots under the main image, one per slide,
           current slide highlighted. Mirrors the familiar Marketplace-
           style pager shown under listing photos. Skipped for single
           image listings same as the counter above. */
        var dots = mainCont.querySelector('.mkt-gallery-dots');
        if (state.media.length > 1) {
            if (!dots) {
                dots = document.createElement('div');
                dots.className = 'mkt-gallery-dots';
                mainCont.appendChild(dots);
            } else {
                mainCont.appendChild(dots); /* keep on top of freshly-appended media */
            }
            dots.innerHTML = state.media.map(function (_, idx) {
                return '<span class="mkt-gallery-dot' + (idx === state.currentIndex ? ' active' : '') + '"></span>';
            }).join('');
        } else if (dots) {
            dots.remove();
        }

        thumbsCont.innerHTML = state.media.map(function (item, idx) {
            var thumbUrl  = typeof item === 'string' ? item : (item.url || item);
            var thumbType = typeof item === 'object' ? (item.type || '') : '';
            var isThumbVid = thumbType.startsWith('video/') || /\.(mp4|webm|mov)(\?|$)/i.test(thumbUrl);
            var active = idx === state.currentIndex ? 'active' : '';
            return '<div class="gallery-thumbnail ' + active + '" data-index="' + idx + '">'
                + (isThumbVid
                    ? '<video src="' + thumbUrl + '#t=0.5" preload="metadata" muted style="width:100%;height:100%;object-fit:cover;"></video>'
                    : '<img src="' + thumbUrl + '" alt="Thumb" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.opacity=0.3">')
                + '</div>';
        }).join('');

        /* Keep the active thumbnail scrolled into view as the user
           navigates, so the strip tracks the current slide automatically
           instead of requiring a manual scroll to find it. */
        var activeThumb = thumbsCont.querySelector('.gallery-thumbnail.active');
        if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
            activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }
    window.renderMarketplaceGalleryView = renderMarketplaceGalleryView;

    function navigateMarketplaceGallery(direction) {
        _stopGalleryVideo();
        var state = _mgs(), len = state.media.length;
        if (!len) return;
        _setMgs({ currentIndex: (((state.currentIndex + direction) % len) + len) % len });
        renderMarketplaceGalleryView();
    }
    window.navigateMarketplaceGallery = navigateMarketplaceGallery;

    function _closeGallery() {
        _stopGalleryVideo();
        var modal = document.getElementById('marketplace-gallery-modal');
        if (modal) { modal.classList.remove('show'); modal.style.display = 'none'; }
        document.body.classList.remove('modal-open');
        _setMgs({ media: [], currentIndex: 0 });
    }
    /* NOTE: horizontal swipe-to-navigate for this modal is already
       implemented in app-fixes.js ("FIX 9b: Swipe navigation inside
       marketplace gallery modal"). Do not add a second touch handler
       here — two handlers firing on the same swipe causes the gallery
       to skip two slides per swipe instead of one. */


    /* =========================================================================
       §6  PROMOTION MODAL
       ========================================================================= */
    function updatePromoReachPreview() {
        var budgetInput = document.getElementById('promo-budget');
        var previewEl   = document.getElementById('promo-reach-preview');
        if (!budgetInput || !previewEl) return;
        var budget = parseFloat(budgetInput.value) || 0;
        if (budget < 1000) { previewEl.textContent = 'Minimum budget is ₦1,000'; return; }
        var reach;
        if      (budget <= 10000)  reach = budget * 2;
        else if (budget <= 50000)  reach = 20000 + (budget - 10000) * 2.5;
        else if (budget <= 200000) reach = 120000 + (budget - 50000) * 3;
        else if (budget <= 500000) reach = 570000 + (budget - 200000) * 4;
        else                       reach = 1770000 + (budget - 500000) * 5;
        previewEl.textContent = 'Estimated Reach: ~' + Math.floor(reach).toLocaleString() + ' people';
    }
    window.updatePromoReachPreview = updatePromoReachPreview;

    function promptForPromotion(postId) {
        if (_isGuest()) { if (typeof window.openAuthModal === 'function') window.openAuthModal('login'); return; }
        if (!postId) { _notify('Cannot promote: item has no ID.', 'warning'); return; }
        setTimeout(function () {
            var promoModal = document.getElementById('promotion-modal-overlay');
            if (!promoModal) return;
            var setupView = document.getElementById('promotion-setup-view');
            var payEl     = document.getElementById('promotion-payment-details');
            var postIdIn  = promoModal.querySelector('#promote-post-id');
            if (setupView) setupView.style.display = 'block';
            if (payEl)     payEl.style.display     = 'none';
            if (postIdIn)  postIdIn.value           = postId;
            updatePromoReachPreview();
            promoModal.classList.add('show');
            document.body.classList.add('modal-open');
        }, 100);
    }
    window.promptForPromotion = promptForPromotion;


    /* =========================================================================
       §7  CART CHECKOUT with Flutterwave
       ========================================================================= */
    function _doFlutterwaveCheckout() {
        var cart = _cart();
        if (!cart.length) { _notify('Your cart is empty.', 'warning'); return; }

        var nameEl  = document.getElementById('checkout-name');
        var addrEl  = document.getElementById('checkout-address');
        var emailEl = document.getElementById('checkout-buyer-email');
        var phoneEl = document.getElementById('checkout-buyer-phone');

        var buyerName  = nameEl  ? nameEl.value.trim()  : '';
        var buyerAddr  = addrEl  ? addrEl.value.trim()  : '';
        var buyerEmail = emailEl ? emailEl.value.trim() : (_us().email || 'buyer@empyrean.com');
        var buyerPhone = phoneEl ? phoneEl.value.trim() : '';

        if (!buyerName || !buyerAddr) {
            _notify('Please fill in your name and shipping address.', 'error');
            if (nameEl && !nameEl.value.trim()) nameEl.style.borderColor = 'var(--danger-color,#e53935)';
            if (addrEl && !addrEl.value.trim()) addrEl.style.borderColor = 'var(--danger-color,#e53935)';
            return;
        }

        var totalsObj = {};
        cart.forEach(function (item) {
            var cur = (item.currency || 'NGN').toUpperCase();
            totalsObj[cur] = (totalsObj[cur] || 0) + parseFloat(item.price || 0);
        });

        /* Convert to NGN for Flutterwave (use first currency total) */
        var totalNGN = 0;
        var USD_TO_NGN = (window.EmpState && window.EmpState.USD_TO_NGN_RATE) || window.USD_TO_NGN_RATE || 1600;
        Object.keys(totalsObj).forEach(function (cur) {
            var amt = totalsObj[cur];
            if (cur === 'NGN')  totalNGN += amt;
            else if (cur === 'USD') totalNGN += amt * USD_TO_NGN;
            else if (cur === 'GBP') totalNGN += amt * USD_TO_NGN * 1.27;
            else totalNGN += amt;
        });
        totalNGN = Math.round(totalNGN);

        var fwKey = (window._appConfig && window._appConfig.flutterwave && window._appConfig.flutterwave.publicKey) || '';

        if (typeof FlutterwaveCheckout !== 'function') {
            _notify('Payment gateway not loaded. Please refresh and try again.', 'error');
            return;
        }

        FlutterwaveCheckout({
            public_key:      fwKey,
            tx_ref:          'EMPY-MKT-' + Date.now(),
            amount:          totalNGN,
            currency:        'NGN',
            payment_options: 'card,banktransfer,ussd,mobilemoney',
            customer: {
                email:        buyerEmail,
                phone_number: buyerPhone,
                name:         buyerName
            },
            customizations: {
                title:       'Empyrean Marketplace',
                description: 'Secure escrow for ' + cart.length + ' item(s). Funds held until delivery confirmed.',
                logo:        'https://cdn-icons-png.flaticon.com/512/6001/6001527.png'
            },
            callback: function (data) {
                if (data.status === 'successful' || data.status === 'completed') {
                    _notify('✅ Payment successful! Seller notified. You have 48hrs to confirm delivery.', 'success');
                    _setCart([]);
                    updateCartUI();
                    _closeCartModal();
                    if (typeof window.rewardUserForAction === 'function') window.rewardUserForAction('SUCCESSFUL_ESCROW_BUYER');
                } else {
                    _notify('Payment was not completed. Please try again.', 'error');
                }
            },
            onclose: function () {}
        });
    }
    window._doFlutterwaveCheckout = _doFlutterwaveCheckout;

    function _closeCartModal() {
        var m = document.getElementById('cart-modal-container') || document.getElementById('cart-modal-overlay');
        if (m) { m.classList.remove('show'); m.style.display = 'none'; }
        document.body.classList.remove('modal-open');
    }

    /* Open cart modal helper */
    function _openCartModal() {
        updateCartUI();
        var m = document.getElementById('cart-modal-container') || document.getElementById('cart-modal-overlay');
        if (m) { m.style.display = 'flex'; m.classList.add('show'); document.body.classList.add('modal-open'); }
    }
    window.openCartModal  = _openCartModal;
    window.closeCartModal = _closeCartModal;


    /* =========================================================================
       §8  MARKETPLACE EDIT MODAL — inject if missing
       ========================================================================= */
    function _ensureEditModal() {
        if (document.getElementById('mkt-edit-modal')) return;
        var modal = document.createElement('div');
        modal.id = 'mkt-edit-modal';
        modal.className = 'modal-overlay-container';
        modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;';
        modal.innerHTML = [
            '<div class="modal-card" style="background:#fff;border-radius:16px;padding:28px;width:90%;max-width:480px;max-height:90vh;overflow-y:auto;">',
            '<h3 style="margin:0 0 20px;font-size:1.1rem;"><i class="fas fa-edit" style="color:#00D4AA;margin-right:8px;"></i>Edit Listing</h3>',
            '<div class="form-group"><label>Title</label><input type="text" id="mkt-edit-name" class="form-control"></div>',
            '<div class="form-group"><label>Price</label><input type="number" id="mkt-edit-price" class="form-control" min="0" step="0.01"></div>',
            '<div class="form-group"><label>Description</label><textarea id="mkt-edit-desc" class="form-control" rows="4" style="resize:vertical;"></textarea></div>',
            '<input type="hidden" id="mkt-edit-id">',
            '<input type="hidden" id="mkt-edit-collection" value="marketplace_listings">',
            '<div style="display:flex;gap:12px;margin-top:20px;">',
            '<button type="button" id="mkt-edit-save-btn" class="btn btn-accent" style="flex:1;"><i class="fas fa-save"></i> Save Changes</button>',
            '<button type="button" id="mkt-edit-cancel-btn" class="btn" style="flex:1;"><i class="fas fa-times"></i> Cancel</button>',
            '</div></div>'
        ].join('');
        document.body.appendChild(modal);

        modal.querySelector('#mkt-edit-cancel-btn').addEventListener('click', function () {
            modal.style.display = 'none';
            modal.classList.remove('show');
        });

        modal.addEventListener('click', function (e) {
            if (e.target === modal) { modal.style.display = 'none'; modal.classList.remove('show'); }
        });

        modal.querySelector('#mkt-edit-save-btn').addEventListener('click', async function () {
            var itemId  = document.getElementById('mkt-edit-id').value;
            var newName = document.getElementById('mkt-edit-name').value.trim();
            var newPriceStr = document.getElementById('mkt-edit-price').value;
            var newDesc = document.getElementById('mkt-edit-desc').value.trim();
            var newPrice = parseFloat(newPriceStr) || 0;

            if (!newName) { _notify('Please enter a title.', 'error'); return; }

            /* Update card in DOM */
            document.querySelectorAll('[data-post-id="' + itemId + '"],[data-id="' + itemId + '"]')
                .forEach(function (el) {
                    var h4 = el.querySelector('h4, .property-name');
                    var priceDiv = el.querySelector('.property-info div:last-child, .price-display');
                    if (h4) h4.textContent = newName;
                    if (priceDiv) priceDiv.textContent = _fmtPrice(newPrice, el.dataset.currency || 'NGN');
                    el.dataset.price = newPrice;
                    var descEl = el.querySelector('.item-description, .property-desc');
                    if (descEl) descEl.textContent = newDesc;
                });

            /* Firestore update */
            if (window.fbDb && itemId) {
                try {
                    await window.fbDb.collection('marketplace_listings').doc(itemId).update({
                        name: newName, price: newPrice, description: newDesc,
                        updatedAt: new Date().toISOString()
                    });
                    _notify('✅ Listing updated!', 'success');
                } catch (e) {
                    _notify('Updated locally. Cloud sync may be delayed.', 'info');
                }
            } else {
                _notify('Listing updated locally.', 'success');
            }

            modal.style.display = 'none';
            modal.classList.remove('show');
        });
    }


    /* =========================================================================
       §9  EVENT DELEGATION
       ========================================================================= */
    document.addEventListener('click', function (e) {
        var t = e.target;

        /* ── Gallery thumbnail ── */
        var thumb = t.closest('.gallery-thumbnail');
        if (thumb && thumb.dataset.index != null) {
            e.preventDefault();
            _stopGalleryVideo();
            _setMgs({ currentIndex: parseInt(thumb.dataset.index, 10) });
            renderMarketplaceGalleryView();
            return;
        }

        /* ── Gallery nav ── */
        if (t.id === 'gallery-prev-btn' || t.closest('#gallery-prev-btn')) { e.preventDefault(); navigateMarketplaceGallery(-1); return; }
        if (t.id === 'gallery-next-btn' || t.closest('#gallery-next-btn')) { e.preventDefault(); navigateMarketplaceGallery(1);  return; }

        /* ── Close gallery ── */
        var galModal = document.getElementById('marketplace-gallery-modal');
        if (galModal && galModal.classList.contains('show')) {
            if (t.closest('.close-modal, .close-gallery-btn, #gallery-close-btn') || (t === galModal)) {
                e.preventDefault(); _closeGallery(); return;
            }
        }

        /* ── Add to cart ── */
        var addBtn = t.closest('.add-to-cart-btn');
        if (addBtn) {
            e.preventDefault();
            if (_isGuest()) { if (typeof window.openAuthModal === 'function') window.openAuthModal('login'); return; }
            var card = addBtn.closest('.property-card');
            if (!card) return;
            var cart = _cart();
            var itemId = card.dataset.id || card.dataset.postId || ('item-' + Date.now());
            if (cart.find(function (i) { return i.id === itemId; })) {
                _notify('Already in cart!', 'info'); return;
            }
            var mediaArr = [];
            try { mediaArr = JSON.parse(card.dataset.media || '[]'); } catch (_) {}
            var firstImg = card.querySelector('img');
            cart.push({
                id:       itemId,
                name:     card.dataset.name || (card.querySelector('h4, .property-name') || {}).textContent || 'Item',
                price:    card.dataset.price || '0',
                currency: card.dataset.displayCurrency || card.dataset.currency || 'NGN',
                img:      (mediaArr[0]) || (firstImg ? firstImg.src : '') || '',
                sellerId: card.dataset.sellerId || ''
            });
            _setCart(cart);
            updateCartUI();
            _notify('✅ Added to cart!', 'success');
            return;
        }

        /* ── Remove from cart ── */
        var rmBtn = t.closest('.remove-cart-item-btn');
        if (rmBtn) {
            e.preventDefault();
            var id = rmBtn.dataset.id;
            _setCart(_cart().filter(function (i) { return i.id !== id; }));
            updateCartUI();
            return;
        }

        /* ── Open cart ── */
        if (t.closest('.cart-icon-button, #cart-icon-btn')) {
            e.preventDefault(); _openCartModal(); return;
        }

        /* ── Close cart ── */
        var cartEl = document.getElementById('cart-modal-container') || document.getElementById('cart-modal-overlay');
        if (cartEl && cartEl.classList.contains('show')) {
            if (t.closest('#close-cart-btn, .close-cart-btn, .close-modal') || t === cartEl) {
                e.preventDefault(); _closeCartModal(); return;
            }
        }

        /* ── Back to cart (from checkout) ── */
        if (t.closest('#back-to-cart-btn, .back-to-cart-btn')) {
            e.preventDefault();
            var cv = document.getElementById('cart-view');
            var chv = document.getElementById('checkout-view');
            if (cv)  cv.style.display  = 'block';
            if (chv) chv.style.display = 'none';
            return;
        }

        /* ── Proceed to checkout ── */
        if (t.closest('.checkout-btn')) {
            e.preventDefault();
            var cart2 = _cart();
            if (!cart2.length) { _notify('Your cart is empty.', 'warning'); return; }
            var cv2  = document.getElementById('cart-view');
            var chv2 = document.getElementById('checkout-view');
            if (cv2)  cv2.style.display  = 'none';
            if (chv2) chv2.style.display = 'block';
            return;
        }

        /* ── Complete payment (inside checkout form) ── */
        if (t.closest('#checkout-pay-btn, .complete-payment-btn, [data-action="pay"]')) {
            e.preventDefault(); _doFlutterwaveCheckout(); return;
        }

        /* ── Promote ── */
        var proBtn = t.closest('.promote-post-btn, .promote-item-btn');
        if (proBtn) {
            e.preventDefault();
            var pEl = proBtn.closest('[data-post-id],[data-id]');
            promptForPromotion(pEl ? (pEl.dataset.postId || pEl.dataset.id) : null);
            return;
        }

        /* ── Edit marketplace listing ── */
        var editBtn = t.closest('.edit-post-btn');
        if (editBtn) {
            var propCard = editBtn.closest('.property-card');
            if (!propCard) return; /* Let app-fixes.js handle non-marketplace edits */
            e.preventDefault();
            e.stopPropagation();
            var sellerId = propCard.dataset.sellerId || '';
            var us = _us();
            if (!_isAdmin() && sellerId && sellerId !== us.id) {
                _notify('You can only edit your own listings.', 'warning'); return;
            }
            _ensureEditModal();
            var modal = document.getElementById('mkt-edit-modal');
            var itemId2 = propCard.dataset.id || propCard.dataset.postId || '';
            document.getElementById('mkt-edit-id').value    = itemId2;
            document.getElementById('mkt-edit-name').value  = (propCard.querySelector('h4, .property-name') || {}).textContent || '';
            document.getElementById('mkt-edit-price').value = propCard.dataset.price || '';
            document.getElementById('mkt-edit-desc').value  = (propCard.querySelector('.item-description, .property-desc') || {}).textContent || '';
            modal.style.display = 'flex';
            modal.classList.add('show');
            return;
        }

        /* ── Delete marketplace listing ── */
        var delBtn2 = t.closest('.delete-post-btn');
        if (delBtn2) {
            var propCard2 = delBtn2.closest('.property-card');
            if (!propCard2) return;
            e.preventDefault();
            e.stopPropagation();
            var sellerId2 = propCard2.dataset.sellerId || '';
            var us2 = _us();
            if (!_isAdmin() && sellerId2 && sellerId2 !== us2.id) {
                _notify('You can only delete your own listings.', 'warning'); return;
            }
            if (!confirm('Delete this listing? This cannot be undone.')) return;
            var docId2 = propCard2.dataset.id || propCard2.dataset.postId || '';
            propCard2.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            propCard2.style.opacity = '0';
            propCard2.style.transform = 'scale(0.95)';
            setTimeout(function () {
                document.querySelectorAll('[data-id="' + docId2 + '"],[data-post-id="' + docId2 + '"]')
                    .forEach(function (el) { el.remove(); });
            }, 320);
            if (window.fbDb && docId2) {
                try {
                    window.fbDb.collection('marketplace_listings').doc(docId2).delete();
                    _notify('✅ Listing deleted.', 'success');
                } catch (err) {
                    _notify('Removed from view.', 'info');
                }
            } else {
                _notify('Listing removed.', 'success');
            }
            return;
        }

        /* ── Contact seller / Message Seller button — DISABLED ──
           This used to toggle the .direct-contact-info panel directly.
           app-patch-v2.js's patchMarketplaceContact (§P3, loads later in
           index.html) now owns this button exclusively: it builds the
           same panel (animated, with Firestore fallback + loading state)
           via its own addEventListener on each card, independent of this
           delegated handler. Having both wired meant every tap fired
           twice and the two panels fought over the same innerHTML.
           Left here disabled rather than deleted in case app-patch-v2.js
           is ever removed and this needs to be the fallback again. */
        /*
        var contactBtn = t.closest('.contact-seller-btn, .expand-contact-btn, .vf-chat-seller-btn');
        if (contactBtn) {
            e.preventDefault(); e.stopPropagation();
            if (_isGuest()) { if (typeof window.openAuthModal === 'function') window.openAuthModal('login'); return; }
            var cardEl   = contactBtn.closest('.property-card') || contactBtn.closest('.market-card') || contactBtn.closest('.listing-card');
            var sellerId = (cardEl && (cardEl.dataset.sellerId || cardEl.dataset.userId)) || contactBtn.dataset.sellerId || '';
            var sellerName = (cardEl && (cardEl.dataset.sellerName || cardEl.dataset.contactName)) ||
                             contactBtn.dataset.sellerName ||
                             (cardEl && (cardEl.querySelector('h4,.property-name') || {}).textContent) || 'Seller';
            var us = _us();
            var isOwner = _isAdmin() || (us.id && sellerId && sellerId === us.id);
            if (cardEl) {
                var directInfo = cardEl.querySelector('.direct-contact-info');
                if (!directInfo) { directInfo = document.createElement('div'); directInfo.className = 'direct-contact-info'; cardEl.appendChild(directInfo); }
                var isOpen = directInfo.classList.contains('open');
                if (isOpen) {
                    directInfo.classList.remove('open');
                    contactBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> Contact Seller';
                } else {
                    var cName=cardEl.dataset.contactName||'', cPhone=cardEl.dataset.contactPhone||'', cEmail=cardEl.dataset.contactEmail||'', cAddr=cardEl.dataset.contactAddress||'';
                    var chatBtnHtml = (!isOwner && sellerId)
                        ? '<button type="button" class="btn mkt-msg-seller-btn" style="margin-top:8px;width:100%;"><i class="fas fa-comment-dots"></i> Message Seller</button>'
                        : '';
                    directInfo.innerHTML = (cName||cPhone||cEmail||cAddr)
                        ? ['<p style="font-weight:700;margin-bottom:8px;">Seller Contact</p>',
                           cName?'<p>'+_esc(cName)+'</p>':'',
                           cPhone?'<p><a href="tel:'+_esc(cPhone)+'">'+_esc(cPhone)+'</a></p>':'',
                           cEmail?'<p><a href="mailto:'+_esc(cEmail)+'">'+_esc(cEmail)+'</a></p>':'',
                           cAddr?'<p>'+_esc(cAddr)+'</p>':'',
                           chatBtnHtml].join('')
                        : '<p>No contact details posted.</p>' + chatBtnHtml;
                    directInfo.classList.add('open');
                    contactBtn.innerHTML = 'Hide Contact';
                }
            }
            return;
        }
        */

        /* ── In-panel "Message Seller" button (buyers only) ──
           Lives inside the expanded .direct-contact-info panel above and
           opens the same floating chat overlay used everywhere else —
           no navigation to a separate inbox/messages section. Kept active:
           harmless even though app-patch-v2.js's own panel uses a
           different class (.vf-panel-msg-btn) for the same purpose. */
        var inPanelChatBtn = t.closest('.mkt-msg-seller-btn');
        if (inPanelChatBtn) {
            e.preventDefault(); e.stopPropagation();
            if (_isGuest()) { if (typeof window.openAuthModal === 'function') window.openAuthModal('login'); return; }
            var chatCardEl = inPanelChatBtn.closest('.property-card') || inPanelChatBtn.closest('.market-card') || inPanelChatBtn.closest('.listing-card');
            var chatSellerId = (chatCardEl && (chatCardEl.dataset.sellerId || chatCardEl.dataset.userId)) || '';
            var chatSellerName = (chatCardEl && (chatCardEl.dataset.sellerName || chatCardEl.dataset.contactName)) ||
                                  (chatCardEl && (chatCardEl.querySelector('h4,.property-name') || {}).textContent) || 'Seller';
            if (chatSellerId) _openMarketChatOverlay(chatSellerId, chatSellerName.trim());
            return;
        }

        /* ── Promo budget live preview ── */
        var budgetEl = document.getElementById('promo-budget');
        if (budgetEl && t === budgetEl) updatePromoReachPreview();
    });

    document.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'promo-budget') updatePromoReachPreview();
    });

    document.addEventListener('keydown', function (e) {
        var modal = document.getElementById('marketplace-gallery-modal');
        if (!modal || !modal.classList.contains('show')) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); navigateMarketplaceGallery(1);  }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); navigateMarketplaceGallery(-1); }
        if (e.key === 'Escape')     { e.preventDefault(); _closeGallery();                }
    });

    /* ── Bootstrap ── */
    document.addEventListener('empyrean-init-done', function () {
        setTimeout(renderMarketplaceCards, 300);
        setTimeout(updateCartUI, 400);
        /* Ensure any already-rendered cards (both escrow & direct sales) have owner action buttons */
        setTimeout(function () {
            document.querySelectorAll('.property-card').forEach(_ensureOwnerActions);
        }, 600);
    });

    /* Re-apply owner actions whenever new cards are injected into the DOM */
    var _mktObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            m.addedNodes.forEach(function(node) {
                if (!node.querySelectorAll) return;
                node.querySelectorAll('.property-card').forEach(_ensureOwnerActions);
                if (node.classList && node.classList.contains('property-card')) _ensureOwnerActions(node);
            });
        });
    });
    _mktObserver.observe(document.body, { childList: true, subtree: true });

    console.log('[EmpMarket] ✅ Marketplace v2 ready — edit/delete/contact/cart/dashboard-sync active.');

})();