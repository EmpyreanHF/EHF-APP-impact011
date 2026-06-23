/* =============================================================================
   EMPYREAN INTERNATIONAL — IMPACT MINING LOGIC ARCHITECTURE FRAMEWORK
   app-impact-mining.js  |  Step 0.15  |  Refactor Roadmap v1.0
   =============================================================================

   PURPOSE
   ───────
   Extracted from app-fixes.js. Central reward engine for the Empyrean
   impact-mining system. Manages all EMPY reward logic and connects it to
   every user action across the platform.

   REWARD ACTIONS COVERED
   ──────────────────────
     Social engagement:
       • ENGAGE_LIKE           — user likes a post
       • ENGAGE_COMMENT        — user comments on a post
       • RECEIVE_LIKE          — post author receives a like
       • RECEIVE_COMMENT       — post author receives a comment
       • RETWEET_POST          — user retweets
       • SHARE_POST            — user shares a post externally (cross-posting)
       • SEND_GIFT             — user sends a symbolic gift

     Content creation:
       • CREATE_POST           — user publishes a feed post
       • CREATE_REEL           — user publishes a reel
       • PUBLISH_NEWS          — user publishes a news article

     Download:
       • DOWNLOAD_MEDIA        — user downloads media from the platform

     Live streaming:
       • LIVE_STREAM_INTERVAL  — host reward tick every 2 min
       • GUEST_JOINED_LIVE     — guest joins a live stream
       • HOST_INVITED_GUEST    — host invites a co-host

     SOS / Crisis:
       • VERIFIED_SOS_REQUEST  — SOS request is admin-verified
       • VERIFIED_CRISIS_REPORT— crisis report is admin-verified

     Commerce:
       • SUCCESSFUL_ESCROW_SELLER — escrow sale completed (seller)
       • SUCCESSFUL_ESCROW_BUYER  — escrow purchase completed (buyer)

     Referral / Cross-post:
       • SUCCESSFUL_REFERRAL   — referred user signs up
       • CROSS_POST            — user cross-posts to external platform

   REWARD SPLIT (premium actions)
   ──────────────────────────────
     60% → immediately withdrawable (added to empyBalance)
     40% → locked for 6 months (added to userLockedStakedBalance)

   POOL MANAGEMENT
   ───────────────
   • Daily budget = 90% of IMPACT_MINING_TOTAL_POOL ÷ (12 years × 365.25 days)
   • Resets at midnight each calendar day
   • Stops issuing rewards once daily budget is exhausted

   LOAD ORDER
   ──────────
   Must come AFTER: firebase-init, app-state, app-helpers.

   DEPENDS ON
   ──────────
   • window.EmpState.*          — userState, impactMiningState, staking balances
   • window.showNotification    (app-helpers.js)
   • window.updateWalletUI      (app-wallet.js, called if available)
   • window.fbDb / _firebaseLoaded — background Firestore balance sync

   PUBLIC API
   ──────────
   window.rewardUserForAction(action, targetUserId?)
   window.getImpactMiningStats()     → { dailyBudget, dailySpent, remaining, pct }
   window.getReferralLink()          → string URL with ?ref= parameter
   window.handleCrossPost(platform, postData) → Promise resolves after share

   SECTION MAP
   ───────────
   §1  Reward table
   §2  rewardUserForAction()
   §3  getImpactMiningStats()
   §4  Referral link generator + tracker
   §5  Cross-post handler (share to external platform with SHARE_POST reward)
   §6  Download media handler (watermarked)
   §7  Realtime listener integration hooks
   §8  Bootstrap

   ============================================================================= */

(function empyreanImpactMiningModule() {
    'use strict';

    if (window._empyreanImpactMiningLoaded) {
        console.warn('[EmpImpact] Already loaded — skipping.');
        return;
    }
    window._empyreanImpactMiningLoaded = true;

    /* ── State helpers ── */
    function _S()   { return window.EmpState || {}; }
    function _us()  { return _S().userState  || window.userState  || {}; }
    function _ims() { return _S().impactMiningState || window.impactMiningState || { dailyBudget: 0, dailySpent: 0, rankingPoolSpent: 0, lastReset: 0 }; }
    function _mu()  { return _S().mockUsers  || window.mockUsers  || {}; }

    function _isGuest() { var s = _S(); return s.isGuest != null ? s.isGuest : !!window.isGuest; }

    function _notify(msg, type) {
        if (typeof window.showNotification === 'function') window.showNotification(msg, type);
    }

    function _getConst(name, fallback) {
        var s = _S();
        return (s[name] != null) ? s[name] : (window[name] != null ? window[name] : fallback);
    }


    /* =========================================================================
       §1  REWARD TABLE
       EMPY amounts per action. Verified / creation actions use 60/40 split.
       Engagement actions go directly to withdrawable balance.
       ========================================================================= */

    var REWARD_TABLE = {
        /* SOS / Crisis — highest value (verified by admin) */
        VERIFIED_CRISIS_REPORT:  50,
        VERIFIED_SOS_REQUEST:    25,

        /* Commerce */
        SUCCESSFUL_ESCROW_SELLER: 15,
        SUCCESSFUL_ESCROW_BUYER:   5,

        /* Content creation */
        CREATE_REEL:              2.0,
        CREATE_POST:              1.0,
        PUBLISH_NEWS:             10,

        /* Live streaming */
        LIVE_STREAM_INTERVAL:     2.0,
        GUEST_JOINED_LIVE:        5,
        HOST_INVITED_GUEST:       2,

        /* Referral & cross-post */
        SUCCESSFUL_REFERRAL:      20,
        CROSS_POST:               1.0,

        /* Social engagement (received) */
        RECEIVE_COMMENT:          0.2,
        RECEIVE_LIKE:             0.1,

        /* Social engagement (sent) */
        ENGAGE_COMMENT:           0.05,
        ENGAGE_LIKE:              0.02,
        SHARE_POST:               0.5,
        RETWEET_POST:             0.5,
        SEND_GIFT:                0.1,

        /* Download */
        DOWNLOAD_MEDIA:           0.05
    };

    /**
     * Actions that use the 60/40 locked/withdrawable split.
     * Everything else goes directly to withdrawable balance.
     */
    var PREMIUM_ACTIONS = new Set([
        'VERIFIED_CRISIS_REPORT', 'VERIFIED_SOS_REQUEST',
        'CREATE_REEL', 'CREATE_POST', 'PUBLISH_NEWS',
        'LIVE_STREAM_INTERVAL',
        'RECEIVE_COMMENT', 'RECEIVE_LIKE',
        'SUCCESSFUL_REFERRAL',
        'GUEST_JOINED_LIVE', 'HOST_INVITED_GUEST'
    ]);


    /* =========================================================================
       §2  rewardUserForAction
       Central reward dispatcher. Call this from any user-action handler.
       @param {string} action        — key from REWARD_TABLE
       @param {string|null} targetUserId — optional: reward a different user
       ========================================================================= */

    function rewardUserForAction(action, targetUserId) {
        if (_isGuest()) return;

        var ims = _ims();

        /* ── Daily reset check ── */
        var today = new Date().setHours(0, 0, 0, 0);
        if (today > ims.lastReset) {
            ims.dailySpent  = 0;
            ims.lastReset   = today;
        }

        /* ── Budget guard ── */
        if (ims.dailySpent >= ims.dailyBudget) return;

        var rewardAmount = REWARD_TABLE[action] || 0;
        if (rewardAmount === 0) return;
        if (ims.dailySpent + rewardAmount > ims.dailyBudget) return;

        /* ── Determine recipient ── */
        var mu = _mu();
        var recipient = (targetUserId && mu[targetUserId]) ? mu[targetUserId] : _us();
        var us        = _us();
        if (!recipient.empyBalance) recipient.empyBalance = 0;

        /* ── Apply reward ── */
        if (PREMIUM_ACTIONS.has(action) && recipient.id === us.id) {
            /* 60/40 split — only for the acting user themselves */
            var STAKING_LOCK_DURATION = _getConst('STAKING_LOCK_DURATION', 6 * 30 * 24 * 60 * 60 * 1000);
            var lockedPortion      = rewardAmount * 0.40;
            var withdrawablePortion= rewardAmount * 0.60;

            /* Update staking state */
            if (_S().userLockedStakedBalance != null) {
                _S().userLockedStakedBalance = (_S().userLockedStakedBalance || 0) + lockedPortion;
            } else {
                window.userLockedStakedBalance = (window.userLockedStakedBalance || 0) + lockedPortion;
            }
            var lockEnd = Date.now() + STAKING_LOCK_DURATION;
            if (_S().userLockedStakingEndTime != null) {
                _S().userLockedStakingEndTime = lockEnd;
            } else {
                window.userLockedStakingEndTime = lockEnd;
            }

            recipient.empyBalance += withdrawablePortion;

            /* Append to rewards history */
            var history = _S().userClaimedRewardsHistory || window.userClaimedRewardsHistory || [];
            history.push({
                type: 'Earned (60% claimable)', amount: withdrawablePortion,
                date: new Date().toLocaleDateString()
            });
            history.push({
                type: 'Earned (40% locked)', amount: lockedPortion,
                date: new Date().toLocaleDateString(),
                lockExpiry: new Date(lockEnd).toLocaleDateString()
            });

            _notify(
                '+' + withdrawablePortion.toFixed(2) + ' EMPY (60% claimable), '
                + lockedPortion.toFixed(2) + ' EMPY locked for 6 months!',
                'success'
            );
        } else {
            /* Direct to withdrawable */
            recipient.empyBalance += rewardAmount;
            if (recipient.id === us.id) {
                _notify('+' + rewardAmount.toFixed(2) + ' EMPY for your contribution!', 'success');
            } else {
                _notify('+' + rewardAmount.toFixed(2) + ' EMPY for their contribution!', 'success');
            }
        }

        /* ── Update pool spend ── */
        ims.dailySpent = (ims.dailySpent || 0) + rewardAmount;

        /* ── Refresh wallet UI ── */
        if (typeof window.updateWalletUI === 'function') window.updateWalletUI();

        /* ── Persist balance to Firestore (background, non-blocking) ── */
        try {
            if (!_isGuest() && us.id && window.fbDb && window._firebaseLoaded) {
                window.fbDb.collection('users').doc(us.id)
                    .update({ empyBalance: us.empyBalance })
                    .catch(function () {});
            }
        } catch (e) {}
    }
    window.rewardUserForAction = rewardUserForAction;


    /* =========================================================================
       §3  getImpactMiningStats
       Returns a snapshot of the current daily budget status.
       ========================================================================= */

    function getImpactMiningStats() {
        var ims = _ims();
        var budget    = ims.dailyBudget || 0;
        var spent     = ims.dailySpent  || 0;
        var remaining = Math.max(0, budget - spent);
        var pct       = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
        return {
            dailyBudget: budget,
            dailySpent:  spent,
            remaining:   remaining,
            pct:         pct
        };
    }
    window.getImpactMiningStats = getImpactMiningStats;


    /* =========================================================================
       §4  REFERRAL LINK GENERATOR + TRACKER
       Generates a referral URL containing the current user's ID.
       Listens for the signup success event and fires SUCCESSFUL_REFERRAL reward
       when a referred user completes registration.
       ========================================================================= */

    function getReferralLink() {
        var us = _us();
        if (!us.id || _isGuest()) return window.location.href;
        var base = window.location.href.split('?')[0].split('#')[0];
        return base + '?ref=' + encodeURIComponent(us.id);
    }
    window.getReferralLink = getReferralLink;

    /**
     * Call this after a new user successfully signs up via a referral link.
     * Reads ?ref= from the URL and rewards the referrer.
     */
    function _checkAndRewardReferrer() {
        try {
            var params   = new URLSearchParams(window.location.search);
            var referrerId = params.get('ref');
            if (!referrerId) return;
            /* Don't reward self-referral */
            var us = _us();
            if (referrerId === us.id) return;
            /* Fire referral reward for referrer */
            rewardUserForAction('SUCCESSFUL_REFERRAL', referrerId);
            /* Clean the URL */
            try {
                var cleanUrl = window.location.href.replace(/[?&]ref=[^&]+/, '').replace(/[?&]$/, '');
                window.history.replaceState(null, '', cleanUrl);
            } catch (e) {}
        } catch (e) {}
    }
    /* Hook into signup completion event */
    document.addEventListener('empyrean-user-ready', function () {
        setTimeout(_checkAndRewardReferrer, 800);
    });


    /* =========================================================================
       §5  CROSS-POST HANDLER
       Shares content to an external platform (Web Share API / clipboard).
       Fires SHARE_POST reward and optionally CROSS_POST for verified external
       sharing to specific platforms.
       @param {string} platform   — 'twitter'|'whatsapp'|'telegram'|'copy'|'native'
       @param {Object} postData   — { title, text, url }
       @returns {Promise}
       ========================================================================= */

    function handleCrossPost(platform, postData) {
        var data = postData || {};
        var url  = data.url  || window.location.href;
        var text = data.text || '';
        var title= data.title|| 'Check this out on Empyrean';

        var platformUrls = {
            twitter:  'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url),
            whatsapp: 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url),
            telegram: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
            facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url)
        };

        var promise;

        if (platform === 'copy') {
            promise = (navigator.clipboard
                ? navigator.clipboard.writeText(url).then(function () {
                    if (typeof window.showNotification === 'function') window.showNotification('Link copied to clipboard!', 'success');
                })
                : Promise.resolve()).catch(function () {
                    if (typeof window.showNotification === 'function') window.showNotification('Could not copy link.', 'error');
                });
        } else if (platform === 'native' && navigator.share) {
            promise = navigator.share({ title: title, text: text, url: url }).catch(function () {});
        } else if (platformUrls[platform]) {
            window.open(platformUrls[platform], '_blank', 'noopener,width=600,height=450');
            promise = Promise.resolve();
        } else if (navigator.share) {
            promise = navigator.share({ title: title, text: text, url: url }).catch(function () {});
        } else {
            /* Fallback: clipboard */
            if (navigator.clipboard) {
                promise = navigator.clipboard.writeText(url).then(function () {
                    if (typeof window.showNotification === 'function') window.showNotification('Link copied!', 'success');
                });
            } else {
                promise = Promise.resolve();
                if (typeof window.showNotification === 'function') window.showNotification('Sharing not available on this browser.', 'info');
            }
        }

        /* Fire reward */
        rewardUserForAction('SHARE_POST');
        if (platform && platform !== 'copy' && platform !== 'native') {
            rewardUserForAction('CROSS_POST');
        }

        if (typeof window.updateLiveInteractionCount === 'function') {
            window.updateLiveInteractionCount('share');
        }

        return promise || Promise.resolve();
    }
    window.handleCrossPost = handleCrossPost;

    /* Expose legacy shareContent wrapper for backward compat */
    if (!window.shareContent) {
        window.shareContent = function (shareData) { return handleCrossPost('native', shareData); };
    }


    /* =========================================================================
       §6  DOWNLOAD MEDIA HANDLER
       Provides watermarked image download and direct video download.
       Fires DOWNLOAD_MEDIA reward on success.
       ========================================================================= */

    function downloadPostMedia(container) {
        if (!container) {
            if (typeof window.showNotification === 'function') window.showNotification('No content found.', 'info');
            return;
        }
        var mediaEls = container.querySelectorAll('img[src], video[src]');
        var urls = [];
        mediaEls.forEach(function (el) {
            var url = el.src || el.dataset.src;
            if (url && !url.startsWith('data:') && !url.startsWith('blob:') && !urls.some(function (u) { return u.url === url; })) {
                urls.push({ url: url, type: el.tagName === 'VIDEO' ? 'video' : 'image' });
            }
        });
        if (container.dataset.mediaUrl) {
            var u = container.dataset.mediaUrl;
            if (u && !u.startsWith('blob:')) {
                urls.push({ url: u, type: /\.(mp4|webm|mov)/i.test(u) ? 'video' : 'image' });
            }
        }

        if (urls.length === 0) {
            if (typeof window.showNotification === 'function') window.showNotification('No downloadable media found in this post.', 'info');
            return;
        }

        if (typeof window.showNotification === 'function') {
            window.showNotification('⬇ Preparing ' + urls.length + ' file' + (urls.length > 1 ? 's' : '') + ' with Empyrean watermark…', 'info');
        }

        urls.forEach(function (item) {
            var ts = Date.now();
            if (item.type === 'image') {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function () {
                    try {
                        var canvas = document.createElement('canvas');
                        canvas.width  = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        /* Watermark bar */
                        var barH = Math.max(36, canvas.height * 0.055);
                        ctx.fillStyle = 'rgba(10,14,39,0.72)';
                        ctx.fillRect(0, canvas.height - barH, canvas.width, barH);

                        /* Logo circle */
                        var cx = 22, cy = canvas.height - barH / 2;
                        ctx.beginPath();
                        ctx.arc(cx, cy, barH * 0.38, 0, Math.PI * 2);
                        ctx.fillStyle = '#F5C518'; ctx.fill();
                        ctx.fillStyle = '#0A0E27';
                        ctx.font = 'bold ' + Math.round(barH * 0.42) + 'px Arial';
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText('E', cx, cy);

                        /* Brand text */
                        ctx.fillStyle = 'white';
                        ctx.font = 'bold ' + Math.round(barH * 0.44) + 'px Arial';
                        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                        ctx.fillText('Empyrean', cx + barH * 0.52, cy);

                        /* URL */
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.font = Math.round(barH * 0.32) + 'px Arial';
                        ctx.textAlign = 'right';
                        ctx.fillText('empyrean.app', canvas.width - 10, cy);

                        canvas.toBlob(function (blob) {
                            if (!blob) return;
                            var blobUrl = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = 'empyrean-' + ts + '.jpg';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 5000);
                            rewardUserForAction('DOWNLOAD_MEDIA');
                        }, 'image/jpeg', 0.92);
                    } catch (err) {
                        /* CORS fallback: open in new tab */
                        window.open(item.url, '_blank', 'noopener');
                        rewardUserForAction('DOWNLOAD_MEDIA');
                    }
                };
                img.onerror = function () { window.open(item.url, '_blank', 'noopener'); };
                img.src = item.url;
            } else {
                /* Video — direct download */
                var a = document.createElement('a');
                a.href     = item.url;
                a.download = 'empyrean-video-' + ts + '.mp4';
                a.target   = '_blank';
                a.rel      = 'noopener';
                document.body.appendChild(a);
                a.click();
                a.remove();
                rewardUserForAction('DOWNLOAD_MEDIA');
            }
        });
    }
    window.downloadPostMedia = downloadPostMedia;


    /* =========================================================================
       §7  EVENT DELEGATION — download button click
       Intercepts .download-media-btn clicks anywhere in the document and
       routes them to downloadPostMedia().
       ========================================================================= */

    document.addEventListener('click', function (e) {
        var dlBtn = e.target.closest('.download-media-btn');
        if (!dlBtn) return;
        e.preventDefault();
        e.stopPropagation();

        /* Find nearest post/card container */
        var container = dlBtn.closest('.impact-story')
            || dlBtn.closest('.reel-card')
            || dlBtn.closest('.news-list-item')
            || dlBtn.closest('.property-card')
            || dlBtn.closest('[data-media-url]')
            || dlBtn.closest('[data-post-id]');

        downloadPostMedia(container);
    });


    /* =========================================================================
       §8  REALTIME LISTENER HOOKS
       These helpers are called by the Firestore listeners in app-feed.js when
       engagement events fire (like, comment, retweet, share).
       They exist here so all reward logic is centralised in this module.
       ========================================================================= */

    /**
     * Called when the current user likes a post.
     * @param {string} postAuthorId — user who created the post
     */
    function onLikePost(postAuthorId) {
        rewardUserForAction('ENGAGE_LIKE');
        if (postAuthorId && postAuthorId !== _us().id) {
            rewardUserForAction('RECEIVE_LIKE', postAuthorId);
        }
    }
    window.onLikePost = onLikePost;

    /**
     * Called when the current user comments on a post.
     * @param {string} postAuthorId — user who created the post
     */
    function onCommentPost(postAuthorId) {
        rewardUserForAction('ENGAGE_COMMENT');
        if (postAuthorId && postAuthorId !== _us().id) {
            rewardUserForAction('RECEIVE_COMMENT', postAuthorId);
        }
    }
    window.onCommentPost = onCommentPost;

    /**
     * Called when the current user retweets a post.
     */
    function onRetweetPost() {
        rewardUserForAction('RETWEET_POST');
    }
    window.onRetweetPost = onRetweetPost;

    /**
     * Called when the current user shares a post.
     * @param {string} platform — sharing platform identifier
     * @param {Object} postData — { title, text, url }
     */
    function onSharePost(platform, postData) {
        return handleCrossPost(platform || 'native', postData);
    }
    window.onSharePost = onSharePost;

    /**
     * Called when a bubble like (live stream tap) fires.
     */
    function onBubbleLike() {
        rewardUserForAction('ENGAGE_LIKE');
    }
    window.onBubbleLike = onBubbleLike;


    console.log('[EmpImpact] ✅ Impact mining framework ready.');

})();