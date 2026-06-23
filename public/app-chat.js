// =====================================================
// APP-GIFTS.JS  —  Empyrean Platform  (Module 0.12e)
// Covers: EMPY gift catalog, full-screen catalog modal,
//         quick-send side tab, gift animations (standard
//         + Heart Mills), send-gift handler, recipient
//         crediting, live-goal update integration.
// Depends on: app-state.js, app-wallet.js, app-live.js
// =====================================================
(function initGiftsModule() {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // SECTION 1: Gift Catalog Data
    // Single source of truth — re-exposed on window so any module
    // that loads before or after this one can read it.
    // ─────────────────────────────────────────────────────────────
    const EMPY_GIFT_CATALOG = [
        // ── Tier 1: Micro (1–20 EMPY) ──
        { name: 'Rose',           symbol: '🌹',   price: 1   },
        { name: 'Like',           symbol: '👍',   price: 2   },
        { name: 'Heart',          symbol: '❤️',   price: 3   },
        { name: 'Coffee',         symbol: '☕',   price: 5   },
        { name: 'Star',           symbol: '⭐',   price: 7   },
        { name: 'Chocolate',      symbol: '🍫',   price: 10  },
        { name: 'Ice Cream',      symbol: '🍦',   price: 12  },
        { name: 'Balloon',        symbol: '🎈',   price: 15  },
        { name: 'Cupcake',        symbol: '🧁',   price: 18  },
        { name: 'Candy',          symbol: '🍬',   price: 20  },
        // ── Tier 2: Small (25–100 EMPY) ──
        { name: 'Teddy Bear',     symbol: '🧸',   price: 25  },
        { name: 'Pizza Slice',    symbol: '🍕',   price: 30  },
        { name: 'Popcorn',        symbol: '🍿',   price: 35  },
        { name: 'Music Note',     symbol: '🎵',   price: 40  },
        { name: 'Flower Bouquet', symbol: '💐',   price: 50  },
        { name: 'Football',       symbol: '⚽',   price: 60  },
        { name: 'Sunglasses',     symbol: '😎',   price: 70  },
        { name: 'Perfume',        symbol: '💄',   price: 80  },
        { name: 'Cat',            symbol: '🐱',   price: 90  },
        { name: 'Dog',            symbol: '🐶',   price: 100 },
        // ── Tier 3: Mid (120–500 EMPY) ──
        { name: 'Diamond Ring',   symbol: '💍',   price: 120 },
        { name: 'Camera',         symbol: '📷',   price: 150 },
        { name: 'Champagne',      symbol: '🍾',   price: 180 },
        { name: 'Heart Mills',    symbol: '💖',   price: 200 },
        { name: 'Guitar',         symbol: '🎸',   price: 200 },
        { name: 'Laptop',         symbol: '💻',   price: 250 },
        { name: 'Gold Medal',     symbol: '🥇',   price: 300 },
        { name: 'Airplane',       symbol: '✈️',   price: 350 },
        { name: 'Luxury Watch',   symbol: '⌚',   price: 400 },
        { name: 'Car',            symbol: '🚗',   price: 450 },
        { name: 'Yacht',          symbol: '🛥️',  price: 500 },
        // ── Tier 4: Premium (1 000–10 000 EMPY) ──
        { name: 'Mansion',        symbol: '🏠',   price: 1000  },
        { name: 'Helicopter',     symbol: '🚁',   price: 2000  },
        { name: 'Private Jet',    symbol: '🛫',   price: 3500  },
        { name: 'Crown',          symbol: '👑',   price: 5000  },
        { name: 'Island',         symbol: '🏝️',  price: 7500  },
        { name: 'Diamond Trophy', symbol: '🏆💎', price: 10000 },
    ];

    // Expose catalog so other modules can reference it without duplicating the array
    window.empyGiftCatalog = EMPY_GIFT_CATALOG;

    // Currently selected gift (set by catalog click, consumed by send handler)
    window._selectedGift = null;

    // ─────────────────────────────────────────────────────────────
    // SECTION 2: CSS – inject keyframes once
    // ─────────────────────────────────────────────────────────────
    (function injectGiftStyles() {
        if (document.getElementById('_gift_keyframes')) return;
        const s = document.createElement('style');
        s.id    = '_gift_keyframes';
        s.textContent = `
            /* Standard gift float */
            @keyframes giftFloat {
                from { opacity:1; transform:translateY(0) scale(1); }
                to   { opacity:0; transform:translateY(-130px) scale(1.6); }
            }
            /* Heart Mills shower */
            @keyframes heartMill {
                0%   { opacity:0; transform:translateY(0)      scale(0.6) rotate(0deg); }
                15%  { opacity:1; }
                100% { opacity:0; transform:translateY(-200px) scale(1.2) rotate(30deg); }
            }
            .gift-animation {
                position: absolute;
                bottom: 80px;
                font-size: 2.5rem;
                z-index: 10;
                pointer-events: none;
                animation: giftFloat 2.2s ease-out forwards;
            }
            .heart-mill-animation {
                position: absolute;
                bottom: 60px;
                font-size: 1.6rem;
                color: #e11d48;
                z-index: 10;
                pointer-events: none;
                animation: heartMill 2.8s ease-out forwards;
            }
            /* Gift catalog grid item */
            .gift-item {
                display: flex; flex-direction: column; align-items: center;
                gap: 4px; padding: 10px 6px; border-radius: 14px;
                border: 2px solid transparent; cursor: pointer;
                background: rgba(10,14,39,0.03); transition: all 0.18s;
                user-select: none;
            }
            .gift-item:hover   { background: rgba(27,43,139,0.08); border-color: rgba(27,43,139,0.2); }
            .gift-item.selected{
                background: rgba(245,197,24,0.15);
                border-color: #F5C518;
                box-shadow: 0 0 0 3px rgba(245,197,24,0.25);
            }
            .gift-item .symbol { font-size: 2rem; line-height: 1; }
            .gift-item .name   { font-size: 0.68rem; font-weight: 700; color: var(--primary); text-align:center; }
            .gift-item .price  { font-size: 0.72rem; color: var(--secondary); font-weight: 700; }
            /* Quick-send side tab */
            .gift-quick-item {
                display: flex; flex-direction: column; align-items: center;
                gap: 2px; padding: 7px 4px; border-radius: 10px; cursor: pointer;
                transition: background 0.15s; user-select: none;
            }
            .gift-quick-item:hover { background: rgba(255,255,255,0.12); }
            .gift-quick-item .g-sym   { font-size: 1.5rem; line-height: 1; }
            .gift-quick-item .g-price {
                font-size: 0.6rem; color: #F5C518; font-weight: 700;
                display: flex; align-items: center; gap: 2px;
            }
        `;
        document.head.appendChild(s);
    })();

    // ─────────────────────────────────────────────────────────────
    // SECTION 3: Animation helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * showGiftAnimation(symbol)
     * Plays the floating emoji animation inside #gift-animation-layer.
     * Heart Mills (💖) triggers the multi-heart shower instead.
     */
    function showGiftAnimation(symbol) {
        const layer = document.getElementById('gift-animation-layer');
        if (!layer) return;

        if (symbol === '💖') {
            showHeartMillsAnimation(layer);
        } else {
            const el       = document.createElement('div');
            el.className   = 'gift-animation';
            el.textContent = symbol;
            el.style.left  = (20 + Math.random() * 60) + '%';
            layer.appendChild(el);
            setTimeout(function () { el.remove(); }, 3000);
        }
    }
    window.showGiftAnimation = showGiftAnimation;

    /**
     * triggerGiftAnimation(symbol)
     * Alias used by the live quick-send side tab.
     * Plays directly inside #gift-animation-layer with giftFloat keyframe.
     */
    function triggerGiftAnimation(symbol) {
        const layer = document.getElementById('gift-animation-layer');
        if (!layer) return;

        if (symbol === '💖') {
            showHeartMillsAnimation(layer);
            return;
        }
        const el       = document.createElement('div');
        el.className   = 'gift-animation';
        el.textContent = symbol;
        el.style.left  = (20 + Math.random() * 60) + '%';
        layer.appendChild(el);
        setTimeout(function () { el.remove(); }, 2200);
    }
    window.triggerGiftAnimation = triggerGiftAnimation;

    /**
     * showHeartMillsAnimation(layer)
     * Spawns 20 animated hearts for the Heart Mills gift (💖).
     */
    function showHeartMillsAnimation(layer) {
        layer = layer || document.getElementById('gift-animation-layer');
        if (!layer) return;
        for (let i = 0; i < 20; i++) {
            const heart       = document.createElement('span');
            heart.className   = 'heart-mill-animation';
            heart.innerHTML   = '<svg viewBox="0 0 24 24" width="16" height="16" fill="crimson" stroke="crimson" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
            const startX      = Math.random() * 100;
            const delay       = Math.random() * 2000;
            heart.style.left  = startX + 'vw';
            heart.style.animationDelay = delay + 'ms';
            layer.appendChild(heart);
            setTimeout(function () { heart.remove(); }, 4000 + delay);
        }
    }
    window.showHeartMillsAnimation = showHeartMillsAnimation;

    // ─────────────────────────────────────────────────────────────
    // SECTION 4: populateGiftCatalog
    // Renders the full grid inside #gift-grid-container (modal).
    // ─────────────────────────────────────────────────────────────
    function populateGiftCatalog() {
        const container = document.getElementById('gift-grid-container');
        if (!container) return;
        container.innerHTML = '';

        EMPY_GIFT_CATALOG.forEach(function (gift) {
            const el         = document.createElement('div');
            el.className     = 'gift-item';
            el.dataset.name  = gift.name;
            el.dataset.symbol = gift.symbol;
            el.dataset.price = gift.price;
            el.innerHTML     = `
                <div class="symbol">${gift.symbol}</div>
                <div class="name">${gift.name}</div>
                <div class="price"><i class="fa-solid fa-coins"></i> ${gift.price.toLocaleString()}</div>`;
            container.appendChild(el);
        });
    }
    window.populateGiftCatalog = populateGiftCatalog;

    // ─────────────────────────────────────────────────────────────
    // SECTION 5: renderGiftSideTab
    // Populates the quick-send side strip shown during live streams
    // (#live-gift-quick-items). Shows the top 8 gifts by tier order.
    // ─────────────────────────────────────────────────────────────
    function renderGiftSideTab() {
        const container = document.getElementById('live-gift-quick-items');
        if (!container) return;

        const topGifts = EMPY_GIFT_CATALOG.slice(0, 8);
        container.innerHTML = topGifts.map(function (g) {
            return `<div class="gift-quick-item"
                        data-gift-name="${g.name}"
                        data-gift-symbol="${g.symbol}"
                        data-gift-price="${g.price}"
                        title="${g.name} — ${g.price} EMPY">
                        <span class="g-sym">${g.symbol}</span>
                        <span class="g-price">${g.price}
                            <i class="fa-solid fa-coins" style="font-size:0.55rem;margin-left:2px;"></i>
                        </span>
                    </div>`;
        }).join('');

        // Wire quick-send clicks
        container.querySelectorAll('.gift-quick-item').forEach(function (item) {
            item.addEventListener('click', function () {
                // Guest guard
                if (window.isGuest) {
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('Please log in to send gifts.', 'warning');
                    }
                    return;
                }
                const price = parseInt(this.dataset.giftPrice, 10);
                const us    = window.userState || {};
                if ((us.empyBalance || 0) < price) {
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(
                            'Insufficient EMPY. You need ' + price + ' EMPY for this gift.', 'error'
                        );
                    }
                    const buyModal = document.getElementById('buy-empy-modal');
                    if (buyModal) buyModal.classList.add('show');
                    return;
                }

                // Deduct and animate
                us.empyBalance -= price;
                if (typeof window.updateWalletUI === 'function') window.updateWalletUI();

                const hostName = (
                    document.getElementById('live-host-name') || {}
                ).textContent || 'the host';

                if (typeof window.showNotification === 'function') {
                    window.showNotification(
                        '🎁 ' + this.dataset.giftSymbol + ' ' + this.dataset.giftName
                        + ' sent to ' + hostName + '!', 'success'
                    );
                }
                triggerGiftAnimation(this.dataset.giftSymbol);

                // Reward sender
                if (typeof window.rewardUserForAction === 'function') {
                    window.rewardUserForAction('SEND_GIFT');
                }

                // Credit live goal
                const lsd = window.liveStreamData;
                if (lsd && lsd.liveGoal) {
                    lsd.liveGoal.currentAmount = (lsd.liveGoal.currentAmount || 0) + price;
                    if (typeof window.updateLiveUI === 'function') window.updateLiveUI();
                }

                // Persist to Firestore
                try {
                    if (window.fbDb && window._firebaseLoaded && lsd) {
                        window.fbDb.collection('live_gifts').add({
                            senderId:   us.id,
                            senderName: us.fullName || us.username || 'Someone',
                            hostId:     lsd.hostUserId || null,
                            streamId:   lsd.streamId   || null,
                            giftName:   this.dataset.giftName,
                            giftSymbol: this.dataset.giftSymbol,
                            amount:     price,
                            createdAt:  new Date().toISOString()
                        }).catch(function () {});
                    }
                } catch (e) {}
            });
        });
    }
    window.renderGiftSideTab = renderGiftSideTab;

    // ─────────────────────────────────────────────────────────────
    // SECTION 6: Core send-gift handler
    // Called when user clicks #send-gift-btn inside the full catalog
    // modal (#live-gift-catalog-modal).
    // ─────────────────────────────────────────────────────────────
    window.handleSendGift = function handleSendGift() {
        const gift = window._selectedGift;
        const us   = window.userState || {};

        if (!gift) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Please select a gift first.', 'error');
            }
            return;
        }
        if ((us.empyBalance || 0) < gift.price) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Insufficient EMPY balance to send this gift.', 'error');
            }
            return;
        }

        // Deduct sender's balance
        us.empyBalance -= gift.price;

        // Play animation
        showGiftAnimation(gift.symbol);

        // Resolve recipient
        const catalogModal  = document.getElementById('live-gift-catalog-modal');
        const lsd           = window.liveStreamData || {};
        const recipientId   = (catalogModal && catalogModal.dataset.recipientId)   || lsd.hostUserId   || null;
        const recipientName = (catalogModal && catalogModal.dataset.recipientName) ||
            (document.getElementById('live-host-name') || {}).textContent || 'host';

        // Clean up modal recipient attrs
        if (catalogModal) {
            delete catalogModal.dataset.recipientId;
            delete catalogModal.dataset.recipientName;
        }

        // Announce in live chat
        if (typeof window.createLiveComment === 'function') {
            window.createLiveComment(
                us.fullName || 'Someone',
                'Sent a ' + gift.name + ' to ' + recipientName + '! ' + gift.symbol
            );
        }

        if (typeof window.showNotification === 'function') {
            window.showNotification(
                '🎁 You sent ' + gift.name + ' (' + gift.price + ' EMPY) to ' + recipientName + '!',
                'success'
            );
        }

        // Credit recipient's wallet (local mock + Firestore)
        if (recipientId && recipientId !== us.id) {
            const mockUsers   = window.mockUsers || {};
            const recipient   = mockUsers[recipientId];
            if (recipient) {
                recipient.empyBalance = (recipient.empyBalance || 0) + gift.price;
            }
            // Push notification to recipient if they're viewing
            if (typeof window.pushNotification === 'function') {
                window.pushNotification(
                    (us.fullName || 'Someone') + ' sent you a ' + gift.name + '! +' + gift.price + ' EMPY',
                    'success'
                );
            }
            // Persist gift transaction
            try {
                if (window.fbDb && window._firebaseLoaded) {
                    window.fbDb.collection('live_gifts').add({
                        senderId:      us.id,
                        senderName:    us.fullName  || us.username || 'Someone',
                        recipientId:   recipientId,
                        recipientName: recipientName,
                        streamId:      lsd.streamId || null,
                        giftName:      gift.name,
                        giftSymbol:    gift.symbol,
                        amount:        gift.price,
                        createdAt:     new Date().toISOString()
                    }).catch(function () {});
                }
            } catch (e) {}
        }

        // Reward sender for gifting
        if (typeof window.rewardUserForAction === 'function') {
            window.rewardUserForAction('SEND_GIFT');
        }

        // Update wallet display
        if (typeof window.updateWalletUI === 'function') window.updateWalletUI();

        // Credit live goal
        if (lsd.liveGoal) {
            lsd.liveGoal.currentAmount = (lsd.liveGoal.currentAmount || 0) + gift.price;
            if (typeof window.updateLiveUI === 'function') window.updateLiveUI();
        }

        // Reset selection
        window._selectedGift = null;
        document.querySelectorAll('.gift-item.selected').forEach(function (el) {
            el.classList.remove('selected');
        });

        // Close catalog modal
        if (catalogModal) catalogModal.classList.remove('show');
        document.body.classList.remove('modal-open');
    };

    // ─────────────────────────────────────────────────────────────
    // SECTION 7: openGiftCatalog
    // Opens the full catalog modal, optionally pre-targeting a recipient
    // (used from the participant popup in live streams).
    // ─────────────────────────────────────────────────────────────
    window.openGiftCatalog = function openGiftCatalog(recipientId, recipientName) {
        const modal = document.getElementById('live-gift-catalog-modal');
        if (!modal) return;

        if (recipientId)   modal.dataset.recipientId   = recipientId;
        if (recipientName) modal.dataset.recipientName = recipientName;

        // Update title if targeting a specific person
        const titleEl = modal.querySelector('h3');
        if (titleEl) {
            titleEl.innerHTML = recipientName
                ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg> Send Gift to ' + recipientName
                : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg> Send a Gift';
        }

        // Ensure grid is populated
        populateGiftCatalog();
        modal.classList.add('show');
        document.body.classList.add('modal-open');
    };

    // ─────────────────────────────────────────────────────────────
    // SECTION 8: Event delegation — catalog item selection & buttons
    // ─────────────────────────────────────────────────────────────
    document.addEventListener('click', function (e) {
        const closest = function (sel) { return e.target.closest ? e.target.closest(sel) : null; };

        // ── Gift item selection (in full catalog modal) ──────────
        const giftItem = closest('.gift-item');
        if (giftItem) {
            document.querySelectorAll('.gift-item.selected').forEach(function (el) {
                el.classList.remove('selected');
            });
            giftItem.classList.add('selected');
            window._selectedGift = {
                name:   giftItem.dataset.name,
                symbol: giftItem.dataset.symbol,
                price:  parseFloat(giftItem.dataset.price)
            };
            // Also update legacy alias used by app-fixes.js consolidated handler
            // (harmless to keep both in sync during transition)
            return;
        }

        // ── Send Gift button ─────────────────────────────────────
        if (closest('#send-gift-btn')) {
            e.preventDefault();
            window.handleSendGift();
            return;
        }

        // ── Live "Gift" button toggles full catalog ──────────────
        if (closest('#live-gift-btn')) {
            const catalog = document.getElementById('live-gift-catalog-modal');
            if (catalog) {
                catalog.classList.toggle('show');
                if (catalog.classList.contains('show')) populateGiftCatalog();
            }
            return;
        }

        // ── "All Gifts" tab button in side tab → open full catalog ──
        if (closest('#live-gift-all-btn')) {
            window.openGiftCatalog();
            return;
        }
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 9: Auto-populate catalog when modal opens (MutationObserver)
    // and show/hide side tab with live modal.
    // ─────────────────────────────────────────────────────────────
    (function wireModals() {
        // Full catalog modal — populate on first show
        const catalogModal = document.getElementById('live-gift-catalog-modal');
        if (catalogModal) {
            const obs = new MutationObserver(function (muts) {
                muts.forEach(function (m) {
                    if (m.attributeName === 'class') {
                        if (catalogModal.classList.contains('show')) {
                            populateGiftCatalog();
                        }
                    }
                });
            });
            obs.observe(catalogModal, { attributes: true, attributeFilter: ['class'] });
        }

        // Live stream modal — show/hide gift side tab
        const liveModal = document.getElementById('go-live-modal-overlay');
        if (liveModal) {
            const obs2 = new MutationObserver(function () {
                const sideTab = document.getElementById('live-gift-side-tab');
                if (liveModal.classList.contains('show')) {
                    renderGiftSideTab();
                    if (sideTab) sideTab.style.display = 'flex';
                } else {
                    if (sideTab) sideTab.style.display = 'none';
                }
            });
            obs2.observe(liveModal, { attributes: true, attributeFilter: ['class'] });
        }
    })();

    // ─────────────────────────────────────────────────────────────
    // SECTION 10: DOMContentLoaded — initial catalog seeding
    // ─────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', populateGiftCatalog);
    } else {
        // DOM already ready (script loaded late)
        populateGiftCatalog();
    }

    console.log('[Gifts] Module 0.12e loaded — ' + EMPY_GIFT_CATALOG.length + ' gifts in catalog. ✅');
})();