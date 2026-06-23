/* =============================================================================
   EMPYREAN INTERNATIONAL — REELS ENGAGEMENT MODULE  (v2 — Full Engagement)
   app-reels.js

   FEATURES
   ────────
   • Full comment & sub-comment thread with collapse/expand
   • Bubble like on posts, comments, and sub-comments
   • Retweet with count
   • Share button
   • Real-time downloadable button (downloads to device)
   • Exit / close button at top of viewer
   • Swipeable vertically (IntersectionObserver + touch)
   • Connects to impact mining (CREATE_REEL, ENGAGE_LIKE, ENGAGE_COMMENT)
   ============================================================================= */

(function empyreanReelsModule() {
    'use strict';

    if (window._empyreanReelsLoaded) { return; }
    window._empyreanReelsLoaded = true;

    function _S()       { return window.EmpState || {}; }
    function _us()      { return _S().userState || window.userState || {}; }
    function _isGuest() { var s = _S(); return s.isGuest != null ? s.isGuest : (window.isGuest !== undefined ? window.isGuest : true); }
    function _esc(s)    { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function _notify(m, t) { if (typeof window.showNotification === 'function') window.showNotification(m, t||'info'); }
    function _reward(action, uid) { if (typeof window.rewardUserForAction === 'function') window.rewardUserForAction(action, uid); }
    function _timeAgo(ts) { return typeof window._timeAgo === 'function' ? window._timeAgo(ts) : 'now'; }

    /* ── CSS ── */
    (function _css() {
        if (document.getElementById('_reels_eng_style')) return;
        var s = document.createElement('style');
        s.id = '_reels_eng_style';
        s.textContent = [
            /* Reel viewer overlay */
            '#reel-viewer-modal-overlay { position:fixed;inset:0;z-index:9900;background:#000;display:none;flex-direction:column;overflow:hidden; }',
            '#reel-viewer-modal-overlay.show { display:flex !important; }',
            /* Exit button — fixed to viewport, shown only when overlay is active */
            '#reel-exit-btn { position:fixed;top:18px;right:18px;z-index:10000;background:rgba(10,14,30,0.75);border:1.5px solid rgba(255,255,255,0.22);cursor:pointer;color:white;width:46px;height:46px;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:1.15rem;backdrop-filter:blur(10px);box-shadow:0 4px 22px rgba(0,0,0,0.6);transition:background 0.2s,transform 0.15s; }',
            '#reel-viewer-modal-overlay.show ~ #reel-exit-btn, body.reel-open #reel-exit-btn { display:flex !important; }',
            '#reel-exit-btn:hover { background:rgba(229,57,53,0.8);transform:scale(1.1); }',
            '#reel-exit-btn:active { transform:scale(0.94); }',
            /* Reel container — vertical scroll */
            '#reel-viewer-container { flex:1;overflow-y:auto;scroll-snap-type:y mandatory;scrollbar-width:none; }',
            '#reel-viewer-container::-webkit-scrollbar { display:none; }',
            /* Each reel item */
            '.reel-viewer-item { position:relative;width:100%;height:100vh;background:#000;flex-shrink:0;display:flex;align-items:center;justify-content:center;scroll-snap-align:start; }',
            '.reel-viewer-item video { width:100%;height:100%;object-fit:contain;display:block; }',
            /* Right-side engagement bar */
            '.reel-engagement-bar { position:absolute;right:12px;bottom:100px;display:flex;flex-direction:column;align-items:center;gap:18px;z-index:10; }',
            '.reel-eng-btn { background:rgba(0,0,0,0.5);border:none;cursor:pointer;color:white;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px;border-radius:12px;font-size:0.7rem;backdrop-filter:blur(4px);transition:transform 0.15s,background 0.15s;min-width:44px; }',
            '.reel-eng-btn:active { transform:scale(0.92); }',
            '.reel-eng-btn i { font-size:1.3rem; }',
            '.reel-eng-btn.liked i { color:#f87171; }',
            '.reel-eng-btn.retweeted i { color:#00D4AA; }',
            /* Bottom info strip */
            '.reel-info-strip { position:absolute;bottom:0;left:0;right:0;padding:60px 16px 20px;background:linear-gradient(transparent,rgba(0,0,0,0.80));color:white; }',
            '.reel-info-strip .reel-username { font-weight:700;font-size:0.92rem;display:flex;align-items:center;gap:8px;margin-bottom:4px; }',
            '.reel-info-strip .reel-caption { font-size:0.85rem;opacity:0.9;max-height:60px;overflow:hidden; }',
            /* Comments drawer */
            '.reel-comments-drawer { position:absolute;bottom:0;left:0;right:0;background:rgba(15,15,25,0.97);border-radius:18px 18px 0 0;max-height:70vh;display:flex;flex-direction:column;transform:translateY(100%);transition:transform 0.3s ease;z-index:20; }',
            '.reel-comments-drawer.open { transform:translateY(0) !important; }',
            '.reel-comments-header { padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0; }',
            '.reel-comments-list { flex:1;overflow-y:auto;padding:12px 16px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.15) transparent; }',
            /* Comment item */
            '.reel-comment { display:flex;gap:10px;margin-bottom:14px; }',
            '.reel-comment-avatar { width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0; }',
            '.reel-comment-body { flex:1;min-width:0; }',
            '.reel-comment-username { font-weight:700;font-size:0.82rem;color:#E8F0FF;margin-bottom:2px; }',
            '.reel-comment-text { font-size:0.85rem;color:rgba(255,255,255,0.85);word-break:break-word; }',
            '.reel-comment-actions { display:flex;align-items:center;gap:10px;margin-top:4px; }',
            '.reel-comment-like-btn { background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.5);font-size:0.75rem;padding:0;display:flex;align-items:center;gap:4px; }',
            '.reel-comment-like-btn.liked { color:#f87171; }',
            '.reel-comment-reply-btn { background:none;border:none;cursor:pointer;color:rgba(0,212,170,0.8);font-size:0.75rem;padding:0; }',
            /* Sub-comments */
            '.reel-subcomments { margin-left:46px;margin-top:8px; }',
            /* Comment input */
            '.reel-comment-input-row { padding:10px 16px;display:flex;gap:10px;align-items:center;border-top:1px solid rgba(255,255,255,0.07);flex-shrink:0;background:rgba(15,15,25,0.98);padding-bottom:calc(10px + env(safe-area-inset-bottom,0px)); }',
            '.reel-comment-input { flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:8px 14px;color:white;font-size:0.88rem;outline:none; }',
            '.reel-comment-input::placeholder { color:rgba(255,255,255,0.4); }',
            '.reel-comment-send-btn { background:#00D4AA;border:none;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#0A0F1E; }',
        ].join('\n');
        document.head.appendChild(s);
    })();


    /* =========================================================================
       §1  REEL VIEWER — build / open
       ========================================================================= */

    /* Reel data store: reelId → { likes, comments, retweets, likedBy, retweetedBy } */
    var _reelData = {};

    function _getReelData(reelId) {
        if (!_reelData[reelId]) {
            _reelData[reelId] = { likes: 0, likedBy: [], retweets: 0, retweetedBy: [], comments: [] };
        }
        return _reelData[reelId];
    }

    function openReelViewer(clickedCard) {
        var overlay   = document.getElementById('reel-viewer-modal-overlay');
        var container = document.getElementById('reel-viewer-container');
        if (!overlay || !container) {
            _buildReelViewerDOM();
            overlay   = document.getElementById('reel-viewer-modal-overlay');
            container = document.getElementById('reel-viewer-container');
            if (!overlay || !container) return;
        }

        container.innerHTML = '';

        /* Collect all reel cards from the grid */
        var allCards = Array.from(document.querySelectorAll('#reels-grid-container .reel-card, .reel-preview-card'));
        if (!allCards.length) allCards = [clickedCard];

        var startIdx = 0;
        allCards.forEach(function (card, idx) {
            if (card === clickedCard) startIdx = idx;
            var item = _buildReelViewerItem(card);
            container.appendChild(item);
        });

        overlay.classList.add('show');
        document.body.classList.add('modal-open', 'reel-open');

        /* Scroll to clicked reel */
        setTimeout(function () {
            var items = container.querySelectorAll('.reel-viewer-item');
            if (items[startIdx]) items[startIdx].scrollIntoView({ behavior: 'auto' });
        }, 50);

        /* Intersection observer for auto-play */
        _setupReelObserver(container);

        /* Touch swipe support */
        _setupSwipe(container);
    }
    window.openReelViewer  = openReelViewer;
    /* Register the full viewer so app-feed.js defers to this module
       rather than overwriting it with its simplified stub. */
    window._reelViewerFull = openReelViewer;

    function _buildReelViewerDOM() {
        if (document.getElementById('reel-viewer-modal-overlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'reel-viewer-modal-overlay';

        var container = document.createElement('div');
        container.id = 'reel-viewer-container';

        overlay.appendChild(container);
        document.body.appendChild(overlay);

        /* Exit button appended to <body> at fixed position — never clipped by
           the overlay scroll container or video stacking context (bug 2 fix). */
        var exitBtn = document.createElement('button');
        exitBtn.id = 'reel-exit-btn';
        exitBtn.setAttribute('aria-label', 'Close reels');
        exitBtn.title = 'Close reels';
        exitBtn.innerHTML = '<i class="fas fa-times"></i>';
        document.body.appendChild(exitBtn);

        exitBtn.addEventListener('click', function () {
            _closeReelViewer();
        });
    }

    function _closeReelViewer() {
        var overlay = document.getElementById('reel-viewer-modal-overlay');
        if (!overlay) return;
        /* Pause all videos */
        overlay.querySelectorAll('video').forEach(function (v) {
            try { v.pause(); v.src = ''; } catch(e) {}
        });
        overlay.classList.remove('show');
        document.body.classList.remove('modal-open', 'reel-open');
        /* Close any open comment drawers */
        overlay.querySelectorAll('.reel-comments-drawer.open').forEach(function (d) {
            d.classList.remove('open');
        });
    }

    function _buildReelViewerItem(card) {
        var reelId   = card.dataset.postId || card.dataset.reelId || ('reel-' + Date.now());
        var videoUrl = card.dataset.videoUrl || (card.querySelector('video') ? card.querySelector('video').src : '') || '';
        var username = card.dataset.username || (card.querySelector('[class*=username]') ? card.querySelector('[class*=username]').textContent : 'user');
        var caption  = card.dataset.caption  || (card.querySelector('p') ? card.querySelector('p').textContent : '');
        var avatar   = card.dataset.avatar   || (card.querySelector('img') ? card.querySelector('img').src : '');
        var userId   = card.dataset.userId   || '';

        var data = _getReelData(reelId);
        var uid  = _us().id;
        var liked     = data.likedBy.includes(uid);
        var retweeted = data.retweetedBy.includes(uid);

        var item = document.createElement('div');
        item.className = 'reel-viewer-item';
        item.dataset.reelId = reelId;

        var vid = document.createElement('video');
        vid.src = videoUrl;
        vid.loop = true;
        vid.muted = false;
        vid.playsinline = true;
        vid.preload = 'metadata';
        vid.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
        item.appendChild(vid);

        /* ── Engagement bar ── */
        var engBar = document.createElement('div');
        engBar.className = 'reel-engagement-bar';
        engBar.innerHTML = [
            '<button class="reel-eng-btn reel-like-btn' + (liked ? ' liked' : '') + '" data-reel-id="' + _esc(reelId) + '" data-user-id="' + _esc(userId) + '">',
            '<i class="fas fa-heart"></i><span class="reel-like-count">' + data.likes + '</span></button>',

            '<button class="reel-eng-btn reel-comment-btn" data-reel-id="' + _esc(reelId) + '">',
            '<i class="fas fa-comment-dots"></i><span class="reel-comment-count">' + data.comments.length + '</span></button>',

            '<button class="reel-eng-btn reel-retweet-btn' + (retweeted ? ' retweeted' : '') + '" data-reel-id="' + _esc(reelId) + '">',
            '<i class="fas fa-retweet"></i><span class="reel-retweet-count">' + data.retweets + '</span></button>',

            '<button class="reel-eng-btn reel-share-btn" data-reel-id="' + _esc(reelId) + '" data-url="' + _esc(videoUrl) + '">',
            '<i class="fas fa-share-alt"></i><span>Share</span></button>',

            '<button class="reel-eng-btn reel-download-btn" data-url="' + _esc(videoUrl) + '" data-reel-id="' + _esc(reelId) + '">',
            '<i class="fas fa-download"></i><span>Save</span></button>',
        ].join('');
        item.appendChild(engBar);

        /* ── Info strip ── */
        var infoStrip = document.createElement('div');
        infoStrip.className = 'reel-info-strip';
        infoStrip.innerHTML = '<div class="reel-username">'
            + '<img src="' + _esc(avatar) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">'
            + '<span style="cursor:pointer;" data-view-profile="' + _esc(userId) + '">@' + _esc(username) + '</span>'
            + '</div>'
            + '<div class="reel-caption">' + _esc(caption) + '</div>';
        item.appendChild(infoStrip);

        /* ── Comments drawer ── */
        var drawer = document.createElement('div');
        drawer.className = 'reel-comments-drawer';
        drawer.dataset.reelId = reelId;
        drawer.innerHTML = [
            '<div class="reel-comments-header">',
            '<span style="color:white;font-weight:700;font-size:0.95rem;"><i class="fas fa-comment-dots" style="color:#00D4AA;margin-right:6px;"></i>Comments</span>',
            '<button class="reel-comments-close-btn" style="background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.6);font-size:1rem;"><i class="fas fa-chevron-down"></i></button>',
            '</div>',
            '<div class="reel-comments-list" id="reel-cl-' + _esc(reelId) + '"></div>',
            '<div class="reel-comment-input-row">',
            '<img src="' + _esc(_us().avatar || '') + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">',
            '<input type="text" class="reel-comment-input" placeholder="Add a comment…">',
            '<button class="reel-comment-send-btn"><i class="fas fa-paper-plane" style="font-size:0.85rem;"></i></button>',
            '</div>',
        ].join('');
        item.appendChild(drawer);

        return item;
    }

    function _renderComments(reelId, container) {
        var data = _getReelData(reelId);
        var uid  = _us().id;
        if (!container) container = document.getElementById('reel-cl-' + reelId);
        if (!container) return;

        container.innerHTML = '';
        if (!data.comments.length) {
            container.innerHTML = '<p style="color:rgba(255,255,255,0.45);text-align:center;padding:20px 0;font-size:0.88rem;">No comments yet. Be the first!</p>';
            return;
        }

        data.comments.forEach(function (c) {
            var liked = c.likedBy && c.likedBy.includes(uid);
            var cEl = document.createElement('div');
            cEl.className = 'reel-comment';
            cEl.dataset.commentId = c.id;
            cEl.innerHTML = [
                '<img class="reel-comment-avatar" src="' + _esc(c.avatar || '') + '" onerror="this.style.display=\'none\'">',
                '<div class="reel-comment-body">',
                '<div class="reel-comment-username">' + _esc(c.username || 'User') + ' <span style="font-weight:400;font-size:0.72rem;color:rgba(255,255,255,0.4);">' + _timeAgo(c.createdAt) + '</span></div>',
                '<div class="reel-comment-text">' + _esc(c.text) + '</div>',
                '<div class="reel-comment-actions">',
                '<button class="reel-comment-like-btn' + (liked ? ' liked' : '') + '" data-comment-id="' + _esc(c.id) + '" data-reel-id="' + _esc(reelId) + '"><i class="fas fa-heart"></i> ' + (c.likes || 0) + '</button>',
                '<button class="reel-comment-reply-btn" data-comment-id="' + _esc(c.id) + '" data-reel-id="' + _esc(reelId) + '">Reply</button>',
                '</div>',
                /* Sub-comments */
                _renderSubComments(c, reelId),
                '</div>'
            ].join('');
            container.appendChild(cEl);
        });
    }

    function _renderSubComments(comment, reelId) {
        var subs = comment.replies || [];
        if (!subs.length) return '<div class="reel-subcomments" data-parent-id="' + _esc(comment.id) + '" data-reel-id="' + _esc(reelId) + '"></div>';
        var uid = _us().id;
        var html = '<div class="reel-subcomments" data-parent-id="' + _esc(comment.id) + '" data-reel-id="' + _esc(reelId) + '">';
        subs.forEach(function (sub) {
            var liked = sub.likedBy && sub.likedBy.includes(uid);
            html += '<div class="reel-comment" data-subcomment-id="' + _esc(sub.id) + '">'
                + '<img class="reel-comment-avatar" src="' + _esc(sub.avatar || '') + '" style="width:28px;height:28px;" onerror="this.style.display=\'none\'">'
                + '<div class="reel-comment-body">'
                + '<div class="reel-comment-username" style="font-size:0.78rem;">' + _esc(sub.username || 'User') + ' <span style="font-weight:400;font-size:0.68rem;color:rgba(255,255,255,0.4);">' + _timeAgo(sub.createdAt) + '</span></div>'
                + '<div class="reel-comment-text" style="font-size:0.82rem;">' + _esc(sub.text) + '</div>'
                + '<div class="reel-comment-actions">'
                + '<button class="reel-comment-like-btn' + (liked ? ' liked' : '') + '" data-subcomment-id="' + _esc(sub.id) + '" data-parent-id="' + _esc(comment.id) + '" data-reel-id="' + _esc(reelId) + '"><i class="fas fa-heart"></i> ' + (sub.likes || 0) + '</button>'
                + '</div></div></div>';
        });
        html += '</div>';
        return html;
    }


    /* =========================================================================
       §2  IntersectionObserver — auto play/pause
       ========================================================================= */
    function _setupReelObserver(container) {
        if (!('IntersectionObserver' in window)) return;
        var obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var vid = entry.target.querySelector('video');
                if (!vid) return;
                if (entry.isIntersecting) {
                    vid.play && vid.play().catch(function () {});
                } else {
                    vid.pause && vid.pause();
                }
            });
        }, { root: container, threshold: 0.6 });
        container.querySelectorAll('.reel-viewer-item').forEach(function (item) {
            obs.observe(item);
        });
        container._reelObs = obs;
    }

    function _setupSwipe(container) {
        var startY = 0;
        container.addEventListener('touchstart', function (e) {
            startY = e.touches[0].clientY;
        }, { passive: true });
        container.addEventListener('touchend', function (e) {
            var deltaY = startY - e.changedTouches[0].clientY;
            if (Math.abs(deltaY) > 50) {
                var h = container.clientHeight;
                container.scrollBy({ top: deltaY > 0 ? h : -h, behavior: 'smooth' });
            }
        }, { passive: true });
    }


    /* =========================================================================
       §3  EVENT DELEGATION for reel viewer
       ========================================================================= */
    document.addEventListener('click', function (e) {
        var t = e.target;

        /* ── Like reel ── */
        var likeBtn = t.closest('.reel-like-btn');
        if (likeBtn) {
            if (_isGuest()) { _notify('Login to like reels.', 'info'); return; }
            var reelId = likeBtn.dataset.reelId;
            var uid    = _us().id;
            var data   = _getReelData(reelId);
            var idx    = data.likedBy.indexOf(uid);
            if (idx > -1) {
                data.likedBy.splice(idx, 1); data.likes = Math.max(0, data.likes - 1);
                likeBtn.classList.remove('liked');
            } else {
                data.likedBy.push(uid); data.likes++;
                likeBtn.classList.add('liked');
                _reward('ENGAGE_LIKE', likeBtn.dataset.userId);
            }
            likeBtn.querySelector('.reel-like-count').textContent = data.likes;
            return;
        }

        /* ── Open comments ── */
        var commentBtn = t.closest('.reel-comment-btn');
        if (commentBtn) {
            var reelId2 = commentBtn.dataset.reelId;
            var item2   = commentBtn.closest('.reel-viewer-item');
            if (!item2) return;
            var drawer = item2.querySelector('.reel-comments-drawer');
            if (!drawer) return;
            drawer.classList.add('open');
            _renderComments(reelId2, item2.querySelector('.reel-comments-list'));
            return;
        }

        /* ── Close comments ── */
        var closeCom = t.closest('.reel-comments-close-btn');
        if (closeCom) {
            var drawer2 = closeCom.closest('.reel-comments-drawer');
            if (drawer2) drawer2.classList.remove('open');
            return;
        }

        /* ── Send comment ── */
        var sendBtn = t.closest('.reel-comment-send-btn');
        if (sendBtn) {
            if (_isGuest()) { _notify('Login to comment.', 'info'); return; }
            var inputRow = sendBtn.closest('.reel-comment-input-row');
            var inputEl  = inputRow ? inputRow.querySelector('.reel-comment-input') : null;
            if (!inputEl || !inputEl.value.trim()) return;
            var drawer3  = sendBtn.closest('.reel-comments-drawer');
            var reelId3  = drawer3 ? drawer3.dataset.reelId : '';
            if (!reelId3) return;
            var text3 = inputEl.value.trim();
            /* Check if it's a reply */
            var parentId = inputEl.dataset.replyTo || '';
            var us = _us();
            var comment = {
                id:        'c-' + Date.now(),
                reelId:    reelId3,
                parentId:  parentId,
                userId:    us.id,
                username:  us.fullName || us.username || 'User',
                avatar:    us.avatar || '',
                text:      text3,
                createdAt: new Date().toISOString(),
                likes:     0, likedBy: [], replies: []
            };
            var data3 = _getReelData(reelId3);
            if (parentId) {
                var parent = data3.comments.find(function (c) { return c.id === parentId; });
                if (parent) { if (!parent.replies) parent.replies = []; parent.replies.push(comment); }
            } else {
                data3.comments.push(comment);
            }
            inputEl.value = '';
            delete inputEl.dataset.replyTo;
            var placeholder = inputEl.getAttribute('data-original-placeholder') || 'Add a comment…';
            inputEl.placeholder = placeholder;
            /* Update Firestore */
            if (window.fbDb && reelId3) {
                try { window.fbDb.collection('reels').doc(reelId3).update({ comments: data3.comments }); } catch(e){}
            }
            _renderComments(reelId3, drawer3.querySelector('.reel-comments-list'));
            var cc = document.querySelector('.reel-viewer-item[data-reel-id="' + reelId3 + '"] .reel-comment-count');
            if (cc) cc.textContent = data3.comments.length;
            _reward('ENGAGE_COMMENT');
            return;
        }

        /* ── Reply to comment ── */
        var replyBtn = t.closest('.reel-comment-reply-btn');
        if (replyBtn) {
            var drawer4 = replyBtn.closest('.reel-comments-drawer');
            var inputEl2 = drawer4 ? drawer4.querySelector('.reel-comment-input') : null;
            if (!inputEl2) return;
            var commentId4 = replyBtn.dataset.commentId;
            inputEl2.dataset.replyTo = commentId4;
            if (!inputEl2.dataset.originalPlaceholder) inputEl2.dataset.originalPlaceholder = inputEl2.placeholder;
            inputEl2.placeholder = 'Replying…';
            inputEl2.focus();
            return;
        }

        /* ── Like a comment ── */
        var commentLikeBtn = t.closest('.reel-comment-like-btn');
        if (commentLikeBtn && commentLikeBtn.dataset.commentId) {
            if (_isGuest()) { _notify('Login to like comments.', 'info'); return; }
            var reelId5  = commentLikeBtn.dataset.reelId;
            var cId5     = commentLikeBtn.dataset.commentId;
            var subId5   = commentLikeBtn.dataset.subcommentId;
            var parentId5= commentLikeBtn.dataset.parentId;
            var uid5     = _us().id;
            var data5    = _getReelData(reelId5);
            var targetComment;
            if (subId5 && parentId5) {
                var parent5 = data5.comments.find(function (c) { return c.id === parentId5; });
                if (parent5) targetComment = (parent5.replies || []).find(function (r) { return r.id === subId5; });
            } else {
                targetComment = data5.comments.find(function (c) { return c.id === cId5; });
            }
            if (!targetComment) return;
            if (!targetComment.likedBy) targetComment.likedBy = [];
            var cIdx = targetComment.likedBy.indexOf(uid5);
            if (cIdx > -1) {
                targetComment.likedBy.splice(cIdx, 1);
                targetComment.likes = Math.max(0, (targetComment.likes || 0) - 1);
                commentLikeBtn.classList.remove('liked');
            } else {
                targetComment.likedBy.push(uid5);
                targetComment.likes = (targetComment.likes || 0) + 1;
                commentLikeBtn.classList.add('liked');
                _reward('ENGAGE_LIKE');
            }
            commentLikeBtn.innerHTML = '<i class="fas fa-heart"></i> ' + targetComment.likes;
            return;
        }

        /* ── Retweet reel ── */
        var rtBtn = t.closest('.reel-retweet-btn');
        if (rtBtn) {
            if (_isGuest()) { _notify('Login to retweet.', 'info'); return; }
            var reelId6 = rtBtn.dataset.reelId;
            var uid6    = _us().id;
            var data6   = _getReelData(reelId6);
            var idx6    = data6.retweetedBy.indexOf(uid6);
            if (idx6 > -1) {
                data6.retweetedBy.splice(idx6, 1); data6.retweets = Math.max(0, data6.retweets - 1);
                rtBtn.classList.remove('retweeted');
            } else {
                data6.retweetedBy.push(uid6); data6.retweets++;
                rtBtn.classList.add('retweeted');
                _notify('Reel retweeted!', 'success');
                _reward('RETWEET_POST');
            }
            rtBtn.querySelector('.reel-retweet-count').textContent = data6.retweets;
            return;
        }

        /* ── Share reel ── */
        var shareBtn = t.closest('.reel-share-btn');
        if (shareBtn) {
            var url7 = shareBtn.dataset.url || window.location.href;
            if (navigator.share) {
                navigator.share({ title: 'Empyrean Reel', url: url7 }).catch(function () {});
            } else {
                navigator.clipboard && navigator.clipboard.writeText(url7);
                _notify('Link copied!', 'success');
            }
            return;
        }

        /* ── Download reel ── */
        var dlBtn = t.closest('.reel-download-btn');
        if (dlBtn) {
            var url8 = dlBtn.dataset.url || '';
            if (!url8) { _notify('Video URL not available.', 'error'); return; }
            var a = document.createElement('a');
            a.href = url8;
            a.download = 'empyrean-reel-' + (dlBtn.dataset.reelId || Date.now()) + '.mp4';
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            _notify('Download started!', 'success');
            return;
        }

        /* ── Profile tap in reel ── */
        var profTap = t.closest('[data-view-profile]');
        if (profTap && profTap.dataset.viewProfile) {
            var uid9 = profTap.dataset.viewProfile;
            if (uid9) {
                if (typeof window.renderUserProfile === 'function') window.renderUserProfile(uid9);
                if (typeof window.navigateTo === 'function') window.navigateTo('profile');
                _closeReelViewer();
            }
            return;
        }

        /* ── Close reel viewer ── */
        if (t.id === 'reel-exit-btn' || t.closest('#reel-exit-btn')) {
            _closeReelViewer();
            return;
        }

        /* ── Reel card click (from grid) ── */
        var reelCard = t.closest('.reel-card, .reel-preview-card, .dashboard-reel-card');
        if (reelCard) {
            /* dashboard cards navigate to reels section */
            if (reelCard.dataset.navTarget === 'reels' || reelCard.classList.contains('dashboard-reel-card')) {
                if (typeof window.navigateTo === 'function') window.navigateTo('reels');
                return;
            }
            openReelViewer(reelCard);
            return;
        }
    });

    /* Enter key to send comment */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            var active = document.activeElement;
            if (active && active.classList.contains('reel-comment-input')) {
                e.preventDefault();
                var sendBtn2 = active.closest('.reel-comment-input-row') ? active.closest('.reel-comment-input-row').querySelector('.reel-comment-send-btn') : null;
                if (sendBtn2) sendBtn2.click();
            }
        }
    });

    /* Keyboard exit */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            var ov = document.getElementById('reel-viewer-modal-overlay');
            if (ov && ov.classList.contains('show')) _closeReelViewer();
        }
    });

    console.log('[EmpReels] ✅ Reels engagement module ready — comments/likes/retweet/share/download/swipe active.');

})();