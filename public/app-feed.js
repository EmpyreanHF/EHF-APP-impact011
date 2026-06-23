/* =============================================================================
   EMPYREAN INTERNATIONAL — SOCIAL FEED
   app-feed.js  |  Step 0.8  |  Refactor Roadmap v1.0
   =============================================================================

   PURPOSE
   ───────
   Complete social feed system extracted from app-fixes.js.  Covers:

     • Post card builder — createNewPostElement()
     • SOS feed card — createSosPostOnFeed()
     • Crisis feed card — createCrisisPostOnFeed()
     • All 8 real-time Firestore onSnapshot listeners — _startRealtimeListeners()
         posts | news | marketplace | reels | sos_queue | crisis_reports
         announcements | users
     • Dashboard news slider — renderDashboardNews()
     • Suggested users widget — renderSuggestedUsers()
     • Profile gallery URL accumulator — _addUrlsToProfileGallery()
     • Reel viewer — setupReelViewerObserver() + openReelViewer()
     • View-count IntersectionObserver setup

   LOAD ORDER
   ──────────
   ... all prior modules (state, helpers, contracts, notifications, tags,
       dom, auth) must be loaded before this file.
   <script src="app-feed.js">

   DEPENDS ON
   ──────────
   • window.fbDb / window._firebaseLoaded (firebase-init.js)
   • window.EmpState / window.userState / window.isGuest / window.isAdmin
   • window.formatWhatsAppText   (app-helpers.js)
   • window.handleYoutubeEmbed   (app-tags.js)
   • window.showNotification     (app-helpers.js)
   • window.pushNotification     (app-notifications.js)
   • window._processPostTags     (app-tags.js)
   • window.renderUserProfile    (app-profile.js)
   • window.navigateTo           (app-dom.js)
   • window.createSosPostOnFeed  — defined here, used by sos listener
   • window.createCrisisPostOnFeed — defined here, used by crisis listener
   • window._scheduleListenerRetry (app-auth.js)

   PUBLIC API
   ──────────
   window.createNewPostElement(text, mediaFiles, authorData, isBusinessPost, retweetData)
   window.createSosPostOnFeed(sosData)
   window.createCrisisPostOnFeed(crisisData)
   window._startRealtimeListeners()
   window.renderDashboardNews()
   window.renderSuggestedUsers()
   window._addUrlsToProfileGallery(urls)
   window.setupReelViewerObserver()
   window.openReelViewer(clickedCard)

   SECTION MAP
   ───────────
   §1  Post card builder — createNewPostElement
   §2  SOS post card — createSosPostOnFeed
   §3  Crisis report card — createCrisisPostOnFeed
   §4  Realtime listeners — _startRealtimeListeners (8 collections)
   §5  Dashboard news slider — renderDashboardNews
   §6  Suggested users widget — renderSuggestedUsers
   §7  Profile gallery helper — _addUrlsToProfileGallery
   §8  Reel viewer — setupReelViewerObserver + openReelViewer
   §9  View-count observer

   ============================================================================= */

(function empyreanFeedModule() {
    'use strict';

    if (window._empyreanFeedLoaded) {
        console.warn('[EmpFeed] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanFeedLoaded = true;

    /* Shorthand state accessors */
    function _S()       { return window.EmpState || {}; }
    function _us()      { return _S().userState  || window.userState  || {}; }
    function _isGuest() { var s=_S(); return s.isGuest != null ? s.isGuest : window.isGuest; }
    function _isAdmin() { var s=_S(); return s.isAdmin != null ? s.isAdmin : window.isAdmin; }


    /* =========================================================================
       §1  POST CARD BUILDER
       ========================================================================= */

    /**
     * Build and return a fully-rendered .impact-story <div> element.
     * Does NOT insert it into the DOM — caller is responsible for placement.
     *
     * @param {string}      text            — Raw post text (markdown + @mention + #tag)
     * @param {Array}       mediaFiles      — File objects or { _cloudUrl, url, type } objects
     * @param {Object|null} authorData      — { id, fullName, avatar, businessPage? }
     *                                        Defaults to current userState
     * @param {boolean}     isBusinessPost  — If true, uses business page avatar/name
     * @param {Object|null} retweetData     — { retweeterName } if this is a retweet
     * @returns {HTMLElement}
     */
    function createNewPostElement(text, mediaFiles, authorData, isBusinessPost, retweetData) {
        isBusinessPost = isBusinessPost || false;
        retweetData    = retweetData    || null;

        const us     = _us();
        const author = authorData || us;

        const avatar = isBusinessPost
            ? (author.businessPage ? author.businessPage.profilePhoto
                : 'https://ui-avatars.com/api/?name=Business&background=5B0EA6&color=fff&size=150')
            : (author.avatar || author.logo
                || ('https://ui-avatars.com/api/?name='
                    + encodeURIComponent(author.fullName || 'U')
                    + '&background=5B0EA6&color=fff&size=150'));

        const name   = isBusinessPost
            ? (author.businessPage ? author.businessPage.name : 'Business Page')
            : (author.fullName || author.name || 'User');

        /* ── Text processing ── */
        const preprocessed = (text || '')
            .replace(/==(.*?)==/g,
                '<mark style="background:rgba(245,197,24,0.3);padding:1px 4px;border-radius:3px;">$1</mark>')
            .replace(/__(.*?)__/g, '<u>$1</u>');

        const ytResult = (typeof window.handleYoutubeEmbed === 'function')
            ? window.handleYoutubeEmbed(preprocessed)
            : { html: '<p>' + (typeof window.formatWhatsAppText === 'function'
                ? window.formatWhatsAppText(preprocessed) : preprocessed) + '</p>', found: false };

        const formattedText = ytResult.html;
        const youtubeFound  = ytResult.found;

        /* ── Read-more truncation ── */
        function _withReadMore(html) {
            const plain = html.replace(/<[^>]*>/g, '');
            if (plain.length <= 280) return html;
            let cutIdx = 0, cnt = 0, inTag = false;
            for (let ci = 0; ci < html.length && cnt < 280; ci++) {
                if (html[ci] === '<') inTag = true;
                if (!inTag) cnt++;
                if (html[ci] === '>') inTag = false;
                cutIdx = ci;
            }
            const preview = html.substring(0, cutIdx + 1);
            const rest    = html.substring(cutIdx + 1);
            return preview
                + '<span class="post-text-overflow">…</span>'
                + '<span class="post-text-rest" style="display:none;">' + rest + '</span><br>'
                + '<a href="#" class="post-read-more" style="font-size:0.82rem;font-weight:700;'
                + 'color:var(--secondary);text-decoration:none;display:inline-block;margin-top:4px;">Read more ▼</a>'
                + '<a href="#" class="post-read-less" style="font-size:0.82rem;font-weight:700;'
                + 'color:var(--secondary);text-decoration:none;display:none;margin-top:4px;">Show less ▲</a>';
        }

        /* ── Media HTML ── */
        let mediaHTML = '';
        if (mediaFiles && mediaFiles.length > 0) {
            const mc = mediaFiles.length;
            const ml = mc === 1 ? 'solo' : mc === 2 ? 'duo' : mc === 3 ? 'trio' : 'grid';
            mediaHTML = '<div class="story-media-container" data-count="' + mc + '" data-layout="' + ml + '">';
            mediaFiles.forEach(function (file, mi) {
                let url, mimeType;
                if (typeof file === 'string') {
                    url = file;
                    mimeType = (/\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(file) || /\/video\/upload\//i.test(file))
                        ? 'video/' : 'image/';
                } else if (file && file._cloudUrl) {
                    url = file._cloudUrl; mimeType = file.type || '';
                } else if (file && file.url) {
                    url = file.url; mimeType = file.type || '';
                } else if (file instanceof File) {
                    url = URL.createObjectURL(file); mimeType = file.type || '';
                } else { return; }
                if (!url || url.startsWith('blob:')) return;

                const isVid = mimeType.startsWith('video/')
                    || /\/video\/upload\//i.test(url)
                    || /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url);

                mediaHTML += '<div class="story-media-item" data-index="' + mi + '">';
                if (isVid) {
                    mediaHTML += '<video src="' + url + '" class="story-video" controls preload="metadata"'
                        + ' loading="lazy" playsinline onerror="this.closest(\'.story-media-item\').style.display=\'none\'"></video>';
                } else {
                    mediaHTML += '<img src="' + url + '" class="story-main-image" alt="Post media"'
                        + ' loading="lazy" onerror="this.closest(\'.story-media-item\').style.display=\'none\'">';
                }
                mediaHTML += '</div>';
            });
            mediaHTML += '</div>';
        }

        /* ── Retweet / Quote embed header & card ── */
        const isQuotePost = retweetData && retweetData.isQuote;
        const isRetweetPost = retweetData && !retweetData.isQuote;

        const retweetHeaderHTML = isRetweetPost
            ? '<div class="retweet-header" style="display:flex;align-items:center;gap:7px;'
                + 'padding:8px 16px 0;font-size:0.80rem;font-weight:700;color:#1B2B8B;'
                + 'border-bottom:none;">'
                + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#1B2B8B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> '
                + _esc(retweetData.retweeterName || name) + ' Retweeted</div>'
            : '';

        /* Build the quoted-post embed block for quote posts */
        let quoteEmbedHTML = '';
        if (isQuotePost && retweetData.originalPost) {
            const op = retweetData.originalPost;
            const opName   = _esc(op.authorName   || op.name   || 'Original Author');
            const opAvatar = op.authorAvatar || op.avatar || '';
            const opText   = _esc((op.text || op.content || '').substring(0, 200));
            const opMedia  = op.media || op.mediaUrls || op.mediaFiles || [];
            const firstMedia = Array.isArray(opMedia) ? opMedia[0] : (typeof opMedia === 'string' ? opMedia : '');
            const firstMediaUrl = (typeof firstMedia === 'object' && firstMedia)
                ? (firstMedia._cloudUrl || firstMedia.url || '') : (firstMedia || '');
            const isVidEmbed = firstMediaUrl && (
                /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(firstMediaUrl) ||
                /\/video\/upload\//i.test(firstMediaUrl)
            );

            let embedMediaHTML = '';
            if (firstMediaUrl && !firstMediaUrl.startsWith('blob:')) {
                if (isVidEmbed) {
                    embedMediaHTML = '<video src="' + firstMediaUrl + '" class="vf-quote-embed-img"'
                        + ' style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;display:block;"'
                        + ' muted playsinline preload="metadata"'
                        + ' onerror="this.style.display=\'none\'"></video>';
                } else {
                    embedMediaHTML = '<img src="' + firstMediaUrl + '" class="vf-quote-embed-img"'
                        + ' style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;display:block;"'
                        + ' loading="lazy" onerror="this.style.display=\'none\'">';
                }
            }

            quoteEmbedHTML =
                '<div class="vf-quote-card-embed" style="margin:6px 14px 10px;border:1.5px solid rgba(27,43,139,0.18);'
                + 'border-radius:14px;overflow:hidden;background:rgba(27,43,139,0.03);">'
                /* Embed media */
                + (embedMediaHTML
                    ? '<div style="overflow:hidden;max-height:120px;">' + embedMediaHTML + '</div>'
                    : '')
                /* Embed header */
                + '<div style="display:flex;align-items:center;gap:7px;padding:9px 12px 6px;">'
                + (opAvatar
                    ? '<img src="' + _attr(opAvatar) + '" style="width:26px;height:26px;border-radius:50%;'
                      + 'object-fit:cover;flex-shrink:0;border:1.5px solid rgba(27,43,139,0.15);"'
                      + ' onerror="this.style.display=\'none\'">'
                    : '<div style="width:26px;height:26px;border-radius:50%;background:rgba(27,43,139,0.15);flex-shrink:0;'
                      + 'display:flex;align-items:center;justify-content:center;">'
                      + '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#1B2B8B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>')
                + '<span style="font-size:0.75rem;font-weight:800;color:#0A0E27;white-space:nowrap;'
                + 'overflow:hidden;text-overflow:ellipsis;">' + opName + '</span>'
                + '<span style="margin-left:auto;font-size:0.62rem;background:rgba(27,43,139,0.1);'
                + 'color:#1B2B8B;font-weight:700;padding:2px 8px;border-radius:20px;flex-shrink:0;">'
                + '<svg viewBox="0 0 24 24" width="10" height="10" fill="#1B2B8B"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>Original</span>'
                + '</div>'
                /* Embed text */
                + (opText
                    ? '<div style="padding:0 12px 10px;font-size:0.78rem;color:#374151;line-height:1.45;'
                      + 'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">'
                      + opText + '</div>'
                    : '')
                + '</div>';
        }

        const postId = 'post-' + Date.now();
        const ts = new Date().toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const showOpts = (author.id === us.id || _isAdmin()) ? 'block' : 'none';

        const el = document.createElement('div');
        el.className     = 'impact-story';
        el.dataset.postId = postId;
        el.dataset.userId = author.id;
        if (isRetweetPost) el.dataset.isRetweet = '1';
        if (isQuotePost)   el.dataset.isQuote   = '1';
        el.innerHTML =
            retweetHeaderHTML
            + '<div class="story-header">'
            + '<div class="avatar-placeholder square" style="' + (isBusinessPost ? 'border-radius:8px;' : '') + '">'
            + '<img src="' + _attr(avatar) + '" alt="' + _attr(name) + '" loading="lazy"></div>'
            + '<div class="story-user-info"><strong>' + _esc(name) + '</strong><span>' + ts + '</span></div>'
            + '<div class="post-options" style="display:' + showOpts + ';">'
            + '<button class="options-btn"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>'
            + '<div class="options-menu">'
            + '<a href="#" class="edit-post-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</a>'
            + '<a href="#" class="delete-post-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete</a>'
            + '<a href="#" class="promote-post-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg> Promote</a>'
            + '</div></div></div>'
            + (!youtubeFound ? mediaHTML : '')
            + '<div class="story-content">' + _withReadMore(formattedText) + '</div>'
            /* Quote embed (shown below the quoter's own text) */
            + quoteEmbedHTML
            + '<div class="story-actions">'
            + '<a class="action-btn comment-btn" data-action="comment" title="Reply"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z"/></svg><span class="comment-count x-count"></span></span></a>'
            + '<a class="action-btn retweet-btn" data-action="retweet" title="Repost"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.932 9.48.568 8.02 5 3.88zM19.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2H11V4h5.5c2.209 0 4 1.79 4 4v8.45l1.568-1.93 1.364 1.46-4.432 4.14z"/></svg><span class="retweet-count x-count"></span></span></a>'
            + '<a class="action-btn like-btn" data-action="like" title="Like"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z"/></svg><span class="like-count x-count"></span></span></a>'
            + '<a class="action-btn quote-btn" data-action="quote" title="Quote"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z"/><path d="M9 10.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5.22.5.5.5.5-.22.5-.5zm3.5 0c0-.28-.22-.5-.5-.5s-.5.22-.5.5.22.5.5.5.5-.22.5-.5zm3.5 0c0-.28-.22-.5-.5-.5s-.5.22-.5.5.22.5.5.5.5-.22.5-.5z" fill="currentColor" stroke="none"/></svg><span class="quote-count x-count"></span></span></a>'
            + '<span class="action-btn view-count-display" title="Views"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span class="view-count x-count"></span></span>'
            + '<a class="action-btn bookmark-btn" data-action="bookmark" title="Bookmark" style="margin-left:auto;"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l.5 1v16.5l-6-3.5-6 3.5V4l.5-1z"/></svg></span></a>'
            + '<a class="action-btn share-btn" data-action="share" title="Share"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.59l3.77 3.77-1.06 1.06L13 5.75V15h-1.5V5.75l-1.72 1.67-1.06-1.06L12 2.59zM3 12.5h2v5.5c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-5.5h2v5.5c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20.5 3 19.38 3 18v-5.5z"/></svg><span class="share-count x-count"></span></span></a>'
            + '<a class="action-btn download-media-btn" data-action="download" title="Download"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.29l-3.77-3.77 1.06-1.06 1.97 1.97V3h1.5v15.43l1.97-1.97 1.06 1.06L12 21.29z"/><path d="M3 18.5h2V19c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-.5h2V19c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 21.5 3 20.38 3 19v-.5z"/></svg><span class="download-count x-count"></span></span></a>'
            + '</div>'
            + '<div class="comment-section"><div class="comment-list"></div>'
            + '<form class="comment-form" novalidate>'
            + '<input type="text" name="comment-text" placeholder="Add a comment..." required>'
            + '<button type="submit"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
            + '</form></div>';

        return el;
    }
    window.createNewPostElement = createNewPostElement;


    /* =========================================================================
       §2  SOS POST CARD
       ========================================================================= */

    /**
     * Build and prepend an approved SOS post into #feed-container.
     * @param {Object} sosData — Firestore sos_queue document
     */
    function createSosPostOnFeed(sosData) {
        const fc = document.getElementById('feed-container');
        if (!fc) return;

        const el = document.createElement('div');
        el.className      = 'impact-story sos-request';
        el.dataset.postId  = sosData.id;
        el.dataset.userId  = sosData.userId;
        el.dataset.amount  = sosData.amount;
        el.dataset.currency= sosData.currency;
        el.dataset.username= sosData.username;

        let mediaHTML = '';
        if (sosData.media && sosData.media.length > 0) {
            const mc = sosData.media.length;
            const ml = mc === 1 ? 'solo' : mc === 2 ? 'duo' : mc === 3 ? 'trio' : 'grid';
            mediaHTML = '<div class="story-media-container" data-count="' + mc + '" data-layout="' + ml + '">';
            sosData.media.forEach(function (mi, idx) {
                /* Normalise: media items may be {url, type} objects or bare URL strings */
                if (typeof mi === 'string') mi = { url: mi, type: /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mi) ? 'video/mp4' : 'image/jpeg' };
                if (!mi || !mi.url || mi.url.startsWith('blob:')) return;
                const isVid = (mi.type && mi.type.startsWith('video/'))
                    || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mi.url);
                mediaHTML += '<div class="story-media-item" data-index="' + idx + '">';
                if (isVid) {
                    mediaHTML += '<video src="' + mi.url + '" class="story-video" controls preload="metadata" playsinline></video>';
                } else {
                    mediaHTML += '<img src="' + mi.url + '" class="story-main-image" alt="SOS Evidence" loading="lazy">';
                }
                mediaHTML += '</div>';
            });
            mediaHTML += '</div>';
        }

        let amountStr = sosData.amount;
        try {
            const fmt = new Intl.NumberFormat('en-US', {
                style: 'currency', currency: sosData.currency || 'USD',
                minimumFractionDigits: (sosData.currency === 'EMPY' || sosData.currency === 'USDT') ? 2 : 0
            });
            amountStr = fmt.format(parseFloat(sosData.amount));
        } catch (e) {}

        const storyText = (typeof window.formatWhatsAppText === 'function')
            ? window.formatWhatsAppText(sosData.story || '') : (sosData.story || '');
        const ts = new Date().toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        el.innerHTML =
            '<div class="story-header">'
            + '<div class="avatar-placeholder square"><img src="' + _attr(sosData.avatar) + '" alt="' + _attr(sosData.username) + '" loading="lazy"></div>'
            + '<div class="story-user-info"><strong>SOS: ' + _esc(sosData.title) + '</strong>'
            + '<span>Request by ' + _esc(sosData.username) + ' · ' + ts + '</span></div>'
            + '<span class="sos-badge">SOS</span>'
            + '</div>'
            + '<div class="story-content">'
            + '<p>' + storyText + '</p>'
            + '<p>I urgently need <b class="amount-needed">' + amountStr + '</b> to cover my needs.</p>'
            + '</div>'
            + mediaHTML
            + '<div class="story-actions">'
            + '<a class="action-btn comment-btn" data-action="comment" title="Reply"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z"/></svg><span class="comment-count x-count"></span></span></a>'
            + '<a class="action-btn retweet-btn" data-action="retweet" title="Repost"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.932 9.48.568 8.02 5 3.88zM19.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2H11V4h5.5c2.209 0 4 1.79 4 4v8.45l1.568-1.93 1.364 1.46-4.432 4.14z"/></svg><span class="retweet-count x-count"></span></span></a>'
            + '<a class="action-btn like-btn" data-action="like" title="Like"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z"/></svg><span class="like-count x-count"></span></span></a>'
            + '<a class="action-btn quote-btn" data-action="quote" title="Quote"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z"/><path d="M9 10.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5.22.5.5.5.5-.22.5-.5zm3.5 0c0-.28-.22-.5-.5-.5s-.5.22-.5.5.22.5.5.5.5-.22.5-.5zm3.5 0c0-.28-.22-.5-.5-.5s-.5.22-.5.5.22.5.5.5.5-.22.5-.5z" fill="currentColor" stroke="none"/></svg><span class="quote-count x-count"></span></span></a>'
            + '<span class="action-btn view-count-display" title="Views"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span class="view-count x-count"></span></span>'
            + '<a class="action-btn bookmark-btn" data-action="bookmark" title="Bookmark" style="margin-left:auto;"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l.5 1v16.5l-6-3.5-6 3.5V4l.5-1z"/></svg></span></a>'
            + '<a class="action-btn share-btn" data-action="share" title="Share"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.59l3.77 3.77-1.06 1.06L13 5.75V15h-1.5V5.75l-1.72 1.67-1.06-1.06L12 2.59zM3 12.5h2v5.5c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-5.5h2v5.5c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20.5 3 19.38 3 18v-5.5z"/></svg><span class="share-count x-count"></span></span></a>'
            + '<a class="action-btn download-media-btn" data-action="download" title="Download"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.29l-3.77-3.77 1.06-1.06 1.97 1.97V3h1.5v15.43l1.97-1.97 1.06 1.06L12 21.29z"/><path d="M3 18.5h2V19c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-.5h2V19c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 21.5 3 20.38 3 19v-.5z"/></svg><span class="download-count x-count"></span></span></a>'
            + '</div>'
            + '<div style="padding:10px 16px 14px;">'
            + '<button class="gift-button sos-button help-now-btn"'
            + ' style="width:100%;padding:12px;font-size:0.95rem;font-weight:700;border-radius:12px;'
            + 'background:linear-gradient(135deg,#EF4444,#B91C1C);color:white;border:none;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;gap:8px;">'
            + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Donate Now — Help ' + _esc(sosData.username)
            + '</button></div>'
            + '<div class="comment-section"><div class="comment-list"></div>'
            + '<form class="comment-form" novalidate>'
            + '<input type="text" name="comment-text" placeholder="Add a comment..." required>'
            + '<button type="submit"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
            + '</form></div>';

        fc.prepend(el);
    }
    window.createSosPostOnFeed = createSosPostOnFeed;


    /* =========================================================================
       §3  CRISIS REPORT CARD
       ========================================================================= */

    /**
     * Build and prepend a crisis report into #feed-container.
     * @param {Object} crisisData — Firestore crisis_reports document
     */
    function createCrisisPostOnFeed(crisisData) {
        const fc = document.getElementById('feed-container');
        if (!fc) return;

        const us = _us();
        let mediaHTML = '';
        if (crisisData.media && crisisData.media.length > 0) {
            mediaHTML = '<div class="story-media-container" data-count="' + crisisData.media.length + '">';
            crisisData.media.forEach(function (mi) {
                if (!mi || !mi.url || mi.url.startsWith('blob:')) return;
                const isVid = (mi.type || '').startsWith('video/')
                    || /\/video\/upload\//i.test(mi.url)
                    || /\.(mp4|webm|mov)(\?|$)/i.test(mi.url);
                mediaHTML += '<div class="story-media-item">';
                if (isVid) {
                    mediaHTML += '<video src="' + mi.url + '" class="story-video" controls preload="metadata" playsinline></video>';
                } else {
                    mediaHTML += '<img src="' + mi.url + '" class="story-main-image" alt="Crisis Evidence" loading="lazy">';
                }
                mediaHTML += '</div>';
            });
            mediaHTML += '</div>';
        }

        const descHtml = (typeof window.formatWhatsAppText === 'function')
            ? window.formatWhatsAppText(crisisData.description || '') : (crisisData.description || '');
        const locationHtml = '<p style="font-size:0.9rem;color:#666;margin-top:10px;">'
            + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> <strong>Location:</strong> '
            + _esc(crisisData.location || 'Unknown') + '</p>';

        const canDelete = (crisisData.userId === us.id || _isAdmin());
        const ts = crisisData.createdAt
            ? new Date(crisisData.createdAt).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : 'Recently';

        const el = document.createElement('div');
        el.className       = 'impact-story crisis-report';
        el.dataset.postId   = crisisData.id || ('crisis-' + Date.now());
        el.dataset.userId   = crisisData.userId;

        el.innerHTML =
            '<div class="story-header">'
            + '<div class="avatar-placeholder square"><img src="' + _attr(crisisData.avatar) + '" alt="' + _attr(crisisData.username) + '" loading="lazy"></div>'
            + '<div class="story-user-info">'
            + '<strong>Crisis Report: ' + _esc(crisisData.type) + '</strong>'
            + '<span>Reported by ' + _esc(crisisData.username) + ' · ' + ts + '</span></div>'
            + '<div class="post-options"><button class="options-btn"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>'
            + '<div class="options-menu">'
            + '<a href="#" class="promote-post-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg> Promote</a>'
            + (canDelete ? '<a href="#" class="delete-post-btn" style="color:#e53935;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete</a>' : '')
            + '</div></div></div>'
            + '<div class="story-content"><p>' + descHtml + '</p>' + locationHtml + '</div>'
            + mediaHTML
            + '<div class="story-actions">'
            + '<a class="action-btn comment-btn" data-action="comment" title="Reply"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z"/></svg><span class="comment-count x-count"></span></span></a>'
            + '<a class="action-btn retweet-btn" data-action="retweet" title="Repost"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.932 9.48.568 8.02 5 3.88zM19.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2H11V4h5.5c2.209 0 4 1.79 4 4v8.45l1.568-1.93 1.364 1.46-4.432 4.14z"/></svg><span class="retweet-count x-count"></span></span></a>'
            + '<a class="action-btn like-btn" data-action="like" title="Like"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z"/></svg><span class="like-count x-count"></span></span></a>'
            + '<span class="action-btn view-count-display" title="Views"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span class="view-count x-count"></span></span>'
            + '<a class="action-btn bookmark-btn" data-action="bookmark" title="Bookmark" style="margin-left:auto;"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l.5 1v16.5l-6-3.5-6 3.5V4l.5-1z"/></svg></span></a>'
            + '<a class="action-btn share-btn" data-action="share" title="Share"><span class="x-pill"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.59l3.77 3.77-1.06 1.06L13 5.75V15h-1.5V5.75l-1.72 1.67-1.06-1.06L12 2.59zM3 12.5h2v5.5c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-5.5h2v5.5c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20.5 3 19.38 3 18v-5.5z"/></svg><span class="share-count x-count"></span></span></a>'
            + '</div>'
            + '<div class="comment-section"><div class="comment-list"></div>'
            + '<form class="comment-form" novalidate>'
            + '<input type="text" name="comment-text" placeholder="Add a comment..." required>'
            + '<button type="submit"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
            + '</form></div>';

        fc.prepend(el);
    }
    window.createCrisisPostOnFeed = createCrisisPostOnFeed;


    /* =========================================================================
       §4  REAL-TIME FIRESTORE LISTENERS
       ========================================================================= */

    /**
     * Start all 8 real-time Firestore onSnapshot listeners.
     * Requires Firebase to be loaded and a valid session to exist.
     * Guards against duplicate registrations using window._*Listener handles.
     * Called by: app-auth.js onAuthStateChanged, login handler, online-resume handler.
     */
    window._startRealtimeListeners = function () {
        var db = window.fbDb;

        /* ── Session validation ── */
        var _uid    = (window.fbAuth && window.fbAuth.currentUser && window.fbAuth.currentUser.uid) || null;
        var _lsUser = window.userState && window.userState.id
            && window.userState.id !== 'user-main' && !window.isGuest;
        var hasValidSession = !!_uid || !!_lsUser;

        if (!window._firebaseLoaded || !db) {
            console.warn('[Listeners] Firebase not ready — will retry.');
            if (typeof window._scheduleListenerRetry === 'function') window._scheduleListenerRetry();
            return;
        }
        if (!hasValidSession) {
            try {
                var _se = localStorage.getItem('empyrean_session_email');
                if (_se && window.userState && !window.isGuest) hasValidSession = true;
            } catch (e) {}
        }
        if (!hasValidSession) {
            console.warn('[Listeners] No authenticated user — will retry.');
            if (typeof window._scheduleListenerRetry === 'function') window._scheduleListenerRetry();
            return;
        }

        var uid = _uid || (window.userState && window.userState.id) || 'local';
        console.log('[Listeners] Starting real-time listeners for uid:', uid);

        function _unsub(handle) { try { if (typeof handle === 'function') handle(); } catch (e) {} }

        /* Clear Firebase pre-stubs on first real init */
        if (window._firstRealFirebaseInit) {
            window._firstRealFirebaseInit = false;
            ['_postsListener','_newsListener','_mktListener','_reelsListener',
             '_sosListener','_crisisListener','_announcementsListener','_usersListener']
                .forEach(function (k) {
                    var h = window[k];
                    if (h && typeof h === 'function') {
                        try { h(); } catch (e) {}
                        window[k] = null;
                    }
                });
            /* Also reset the app-news.js active flag so it can restart cleanly */
            window._newsListenerActive = false;
        }

        var us    = _us();
        var mu    = (_S().mockUsers)    || window.mockUsers    || {};
        var ru    = (_S().registeredUsers) || window.registeredUsers || {};

        /* ── 1. POSTS ─────────────────────────────────────────────────────── */
        if (!window._postsListener) {
            var _postsInitialBatch = true;
            window._postsListener = db.collection('posts')
                .orderBy('createdAt', 'desc').limit(40)
                .onSnapshot(function (snap) {
                    if (!snap) return;
                    var fc = document.getElementById('feed-container');
                    var es = document.getElementById('feed-empty-state');
                    snap.docChanges().forEach(function (change) {
                        var post = change.doc.data();
                        if (!post || !post.id) return;

                        if (change.type === 'added') {
                            /* SOS posts are rendered by the sos_queue listener with
                               their own card structure — skip them here to prevent a
                               plain generic card from blocking createSosPostOnFeed()
                               on refresh (duplicate-id guard would swallow the real card).
                               Guard: check isSOS flag first; fall back to id prefix for
                               older records that were saved before the isSOS flag existed. */
                            var _isSosPost = post.isSOS || /^sos-/i.test(post.id || '');
                            if (_isSosPost) {
                                /* If the sos_queue listener hasn't rendered it yet
                                   (e.g. sos_queue listener lost race), render it now
                                   so the card is never absent. createSosPostOnFeed has
                                   its own duplicate guard. */
                                if (fc && !fc.querySelector('[data-post-id="' + post.id + '"]')) {
                                    var _sosForFeed = {
                                        id:       post.id,
                                        userId:   post.userId,
                                        username: post.displayUsername || post.username,
                                        avatar:   post.avatar,
                                        title:    post.title  || 'SOS Request',
                                        story:    post.story  || post.text || '',
                                        amount:   post.sosAmount  || post.amount  || '',
                                        currency: post.sosCurrency || post.currency || 'NGN',
                                        media:    post.media  || [],
                                        status:   'approved'
                                    };
                                    if (typeof window.createSosPostOnFeed === 'function') {
                                        window.createSosPostOnFeed(_sosForFeed);
                                    }
                                }
                                return;
                            }
                            var alreadyInFeed = !!(fc && fc.querySelector('[data-post-id="' + post.id + '"]'));
                            var media = (post.media || [])
                                .filter(function (u) { return u && !u.startsWith('blob:'); })
                                .map(function (u) {
                                    return {
                                        _cloudUrl: u, url: u,
                                        type: (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(u) || /\/video\/upload\//i.test(u))
                                            ? 'video/mp4' : 'image/jpeg'
                                    };
                                });
                            var av = post.avatar
                                || ('https://ui-avatars.com/api/?name='
                                    + encodeURIComponent(post.username || 'U')
                                    + '&background=5B0EA6&color=fff&size=150');
                            var el = createNewPostElement(
                                post.text || '', media,
                                { id: post.userId, fullName: post.username || 'User', avatar: av }
                            );
                            el.dataset.postId = post.id;
                            el.dataset.userId = post.userId;

                            /* Restore server timestamp */
                            var tsEl = el.querySelector('.story-user-info span');
                            if (tsEl && post.createdAt) {
                                tsEl.textContent = new Date(post.createdAt).toLocaleString('en-GB', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                });
                            }
                            /* Restore persisted like count */
                            var lkN  = post.likes || 0;
                            var rtN  = post.retweetCount || post.retweets || 0;
                            var qtN  = post.quoteCount   || 0;
                            var shN  = post.shareCount   || 0;
                            var dlN  = post.downloadCount|| 0;
                            var vcN  = post.views        || 0;
                            var cmN  = post.commentCount || 0;
                            var fmt  = function(n) { return n > 0 ? new Intl.NumberFormat().format(n) : ''; };
                            var lc = el.querySelector('.like-count');     if (lc) lc.textContent = fmt(lkN);
                            var rc = el.querySelector('.retweet-count');  if (rc) rc.textContent = fmt(rtN);
                            var qc = el.querySelector('.quote-count');    if (qc) qc.textContent = fmt(qtN);
                            var sc = el.querySelector('.share-count');    if (sc) sc.textContent = fmt(shN);
                            var dc = el.querySelector('.download-count'); if (dc) dc.textContent = fmt(dlN);
                            var vc = el.querySelector('.view-count');     if (vc) vc.textContent = fmt(vcN);
                            var cc = el.querySelector('.comment-count');  if (cc) cc.textContent = fmt(cmN);

                            if (fc && !alreadyInFeed) {
                                if (_postsInitialBatch) { fc.appendChild(el); } else {
                                    fc.prepend(el);
                                    /* Show "↑ N new posts" pill if user is scrolled down */
                                    if (typeof window._notifyNewPost === 'function') window._notifyNewPost();
                                }
                                if (es) es.style.display = 'none';
                            }

                            /* Mirror own posts to profile feeds */
                            if (post.userId === us.id && !post.isRetweet) {
                                ['profile-dash-feed', 'profile-posts-feed'].forEach(function (fid) {
                                    var pf = document.getElementById(fid);
                                    if (pf && !pf.querySelector('[data-post-id="' + post.id + '"]')) {
                                        var clone = el.cloneNode(true);
                                        if (_postsInitialBatch) { pf.appendChild(clone); } else { pf.prepend(clone); }
                                    }
                                });
                                if (post.media && post.media.length) {
                                    _addUrlsToProfileGallery(
                                        post.media.filter(function (u) { return u && !u.startsWith('blob:'); })
                                    );
                                }
                            }

                        } else if (change.type === 'removed') {
                            ['feed-container', 'profile-dash-feed', 'profile-posts-feed'].forEach(function (fid) {
                                var f2 = document.getElementById(fid);
                                if (f2) { var e2 = f2.querySelector('[data-post-id="' + post.id + '"]'); if (e2) e2.remove(); }
                            });
                        } else if (change.type === 'modified') {
                            /* Sync all interaction counts on the feed card when Firestore updates */
                            ['feed-container', 'profile-dash-feed', 'profile-posts-feed'].forEach(function (fid) {
                                var f3 = document.getElementById(fid);
                                if (!f3) return;
                                var card = f3.querySelector('[data-post-id="' + post.id + '"]');
                                if (!card) return;
                                var fmt = function(n) { return n > 0 ? new Intl.NumberFormat().format(n) : ''; };
                                var lkEl = card.querySelector('.like-count');
                                var rtEl = card.querySelector('.retweet-count');
                                var qtEl = card.querySelector('.quote-count');
                                var shEl = card.querySelector('.share-count');
                                var dlEl = card.querySelector('.download-count');
                                var vcEl = card.querySelector('.view-count');
                                var cmEl = card.querySelector('.comment-count');
                                if (lkEl) lkEl.textContent = fmt(post.likes);
                                if (rtEl) rtEl.textContent = fmt(post.retweetCount || post.retweets);
                                if (qtEl) qtEl.textContent = fmt(post.quoteCount);
                                if (shEl) shEl.textContent = fmt(post.shareCount);
                                if (dlEl) dlEl.textContent = fmt(post.downloadCount);
                                if (vcEl) vcEl.textContent = fmt(post.views);
                                if (cmEl) cmEl.textContent = fmt(post.commentCount);
                            });
                        }
                    });
                    _postsInitialBatch = false;
                }, function (err) {
                    console.error('[Listener:posts]', err.code, err.message);
                    window._postsListener = null;
                });
            console.log('[Firestore] ✅ posts listener active');
        }

        /* ── 2. NEWS — owned by app-news.js ──────────────────────────────── */
        /* app-news.js starts window._newsListener via its own _startNewsListener().
           It uses window._newsCache as source-of-truth so renderDashboardNews()
           never needs to scrape a hidden DOM section. Do not start a second
           listener here — the _newsListenerActive flag prevents double-starts. */
        if (typeof window._startNewsListener === 'function' && !window._newsListenerActive) {
            window._startNewsListener();
        }

        /* ── 3. MARKETPLACE ───────────────────────────────────────────────── */
        if (!window._mktListener) {
            window._mktListener = db.collection('marketplace_listings')
                .orderBy('createdAt', 'desc').limit(40)
                .onSnapshot(function (snap) {
                    if (!snap) return;
                    var grid      = document.getElementById('property-grid-container');
                    var mktSlider = document.getElementById('dashboard-market-slider');
                    snap.docChanges().forEach(function (change) {
                        var item = change.doc.data();
                        if (!item || !item.id) return;
                        if (change.type === 'added') {
                            var firstUrl = item.media && item.media[0] ? item.media[0] : '';
                            var isVid = (item.mediaTypes && (item.mediaTypes[0] || '').startsWith('video/'))
                                || /\/video\/upload\//i.test(firstUrl)
                                || /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(firstUrl);
                            var syms = { NGN: '₦', USD: '$', EUR: '€', GBP: '£', GHS: '₵', EMPY: 'EMPY ', USDT: 'USDT ' };
                            var sym      = syms[item.currency] || '$';
                            var priceStr = sym + parseFloat(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
                            var isNew    = item.createdAt && (Date.now() - new Date(item.createdAt).getTime() < 30000);

                            if (grid && !grid.querySelector('[data-id="' + item.id + '"]')) {
                                var allUrls = item.media || [];
                                var mktMediaHTML = '';
                                if (allUrls.length === 0) {
                                    mktMediaHTML = '<div style="width:100%;height:200px;background:linear-gradient(135deg,#1B2B8B,#0A0E27);'
                                        + 'display:flex;align-items:center;justify-content:center;">'
                                        + '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
                                } else if (allUrls.length === 1) {
                                    mktMediaHTML = isVid
                                        ? '<video src="' + firstUrl + '" autoplay loop muted playsinline controls style="width:100%;height:200px;object-fit:cover;display:block;"></video>'
                                        : '<img src="' + firstUrl + '" alt="' + _esc(item.name || '') + '" loading="lazy" style="width:100%;height:200px;object-fit:cover;display:block;">';
                                } else {
                                    var cols = allUrls.length === 2 ? '1fr 1fr' : allUrls.length === 3 ? '2fr 1fr' : '1fr 1fr';
                                    mktMediaHTML = '<div style="display:grid;grid-template-columns:' + cols + ';gap:3px;height:200px;overflow:hidden;">';
                                    allUrls.slice(0, 4).forEach(function (mu, mi) {
                                        var isV = /\.(mp4|webm|mov)(\?|$)/i.test(mu) || /\/video\/upload\//i.test(mu);
                                        var extra = allUrls.length === 3 && mi === 0 ? 'grid-row:1/3;' : '';
                                        mktMediaHTML += isV
                                            ? '<video src="' + mu + '" controls muted playsinline style="width:100%;height:100%;object-fit:cover;' + extra + '"></video>'
                                            : '<img src="' + mu + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;' + extra + '">';
                                    });
                                    if (allUrls.length > 4) {
                                        mktMediaHTML += '<div style="display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);color:white;font-size:1.2rem;font-weight:800;">+'
                                            + (allUrls.length - 4) + '</div>';
                                    }
                                    mktMediaHTML += '</div>';
                                }

                                var card = document.createElement('div');
                                card.className = 'property-card';
                                card.dataset.id      = item.id;
                                card.dataset.price   = item.price;
                                card.dataset.name    = item.name || '';
                                card.dataset.displayCurrency = item.currency;
                                card.dataset.salesType = item.salesType || '';
                                card.dataset.media   = JSON.stringify(item.media || []);
                                card.dataset.sellerId = item.sellerId || '';
                                card.innerHTML = mktMediaHTML
                                    + '<div class="property-info"><h4>' + _esc(item.name || '') + '</h4>'
                                    + '<p><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ' + _esc(item.location || '') + '</p>'
                                    + '<div style="font-weight:700;color:var(--accent-color);font-size:1rem;">' + priceStr + '</div></div>'
                                    + '<div class="property-seller-info"><strong>@' + _esc(item.sellerName || item.username || 'Seller') + '</strong>'
                                    + (item.salesType === 'escrow'
                                        ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>'
                                        : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>')
                                    + '<span style="font-size:0.72rem;color:var(--text-muted);">'
                                    + (item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently')
                                    + '</span></div>'
                                    + (item.salesType === 'direct'
                                        ? '<div class="direct-trade-warning" style="display:block;"><p><strong><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Direct Sales:</strong> Please conduct due diligence.</p></div>'
                                        : '')
                                    + '<div class="direct-contact-info" style="display:none;"></div>'
                                    + '<div class="property-actions">'
                                    + (item.salesType === 'escrow'
                                        ? '<button class="btn btn-accent add-to-cart-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Add to Cart</button>'
                                        : '<button class="btn btn-danger contact-seller-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.27a16 16 0 0 0 5.82 5.82l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Contact Seller</button>')
                                    + '<button class="btn promote-post-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg> Promote</button>'
                                    + ((item.sellerId === us.id || _isAdmin())
                                        ? '<button class="btn edit-post-btn" style="background:rgba(27,43,139,0.08);color:var(--secondary);border:1px solid rgba(27,43,139,0.2);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>'
                                        + '<button class="btn delete-post-btn" style="background:rgba(229,57,53,0.08);color:#e53935;border:1px solid rgba(229,57,53,0.2);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete</button>'
                                        : '')
                                    + '</div>';

                                if (isNew) { grid.prepend(card); } else { grid.appendChild(card); }

                                /* Dashboard slider card */
                                if (mktSlider && !mktSlider.querySelector('[data-id="' + item.id + '"]')) {
                                    var dc = document.createElement('div');
                                    dc.className = 'dashboard-market-card';
                                    dc.dataset.id = item.id;
                                    dc.dataset.navTarget = 'marketplace';
                                    dc.innerHTML = (firstUrl
                                        ? (isVid
                                            ? '<video src="' + firstUrl + '" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video>'
                                            : '<img src="' + firstUrl + '" alt="' + _esc(item.name || '') + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;">')
                                        : '')
                                        + '<div class="dashboard-market-card-info"><h5>' + _esc(item.name || '') + '</h5><p>' + priceStr + '</p></div>';
                                    if (isNew) { mktSlider.prepend(dc); } else { mktSlider.appendChild(dc); }
                                }
                                if (isNew && window.pushNotification) {
                                    window.pushNotification(
                                        '🛒 New listing: ' + (item.name || 'item') + ' by @' + (item.sellerName || 'seller'),
                                        'new_listing'
                                    );
                                }
                            }
                        } else if (change.type === 'removed') {
                            var e2 = grid && grid.querySelector('[data-id="' + item.id + '"]');
                            if (e2) e2.remove();
                        }
                    });
                }, function (err) {
                    console.error('[Listener:mkt]', err.code, err.message);
                    window._mktListener = null;
                });
            console.log('[Firestore] ✅ marketplace_listings listener active');
        }

        /* ── 4. REELS ─────────────────────────────────────────────────────── */
        if (!window._reelsListener) {
            window._reelsListener = db.collection('reels')
                .orderBy('createdAt', 'desc').limit(30)
                .onSnapshot(function (snap) {
                    if (!snap) return;
                    snap.docChanges().forEach(function (change) {
                        var reel = change.doc.data();
                        if (!reel || !reel.id || !reel.videoUrl || reel.videoUrl.startsWith('blob:')) return;
                        if (change.type !== 'added') return;

                        var isNew = reel.createdAt && (Date.now() - new Date(reel.createdAt).getTime() < 30000);

                        /* Dashboard slider */
                        var slider  = document.getElementById('dashboard-reels-slider');
                        var reelCnt = document.getElementById('dashboard-reels-container');
                        if (slider) {
                            if (reelCnt) reelCnt.style.display = 'block';
                            var existing = slider.querySelector('[data-reel-id="' + reel.id + '"]');
                            if (existing) {
                                var ev = existing.querySelector('video');
                                if (ev) ev.src = reel.videoUrl;
                                existing.dataset.reelId = reel.id;
                            } else {
                                var dc2 = document.createElement('div');
                                dc2.className = 'dashboard-reel-card';
                                dc2.dataset.navTarget = 'reels';
                                dc2.dataset.reelId    = reel.id;
                                dc2.innerHTML =
                                    '<video src="' + reel.videoUrl + '" loop muted autoplay playsinline'
                                    + ' style="width:100%;height:100%;object-fit:cover;display:block;">'
                                    + '<source src="' + reel.videoUrl + '" type="video/mp4"></video>'
                                    + '<div class="reel-content"><div class="reel-user-info">'
                                    + '<div class="avatar-placeholder square" style="width:35px;height:35px;">'
                                    + '<img src="' + _attr(reel.avatar || '') + '" alt="@' + _attr(reel.username || '') + '"></div>'
                                    + '<span>@' + _esc(reel.username || 'user') + '</span></div>'
                                    + '<p>' + _esc(reel.caption || '') + '</p></div>';
                                if (isNew) { slider.prepend(dc2); } else { slider.appendChild(dc2); }
                            }
                        }

                        /* Main reels grid */
                        var rg = document.getElementById('reels-grid-container');
                        if (rg) {
                            var existCard = rg.querySelector('[data-post-id="' + reel.id + '"]');
                            if (existCard) {
                                var ev2 = existCard.querySelector('video');
                                if (ev2 && reel.videoUrl) ev2.src = reel.videoUrl;
                                existCard.dataset.videoUrl = reel.videoUrl;
                            } else {
                                var rc = document.createElement('div');
                                rc.className        = 'reel-card';
                                rc.dataset.postId   = reel.id;
                                rc.dataset.videoUrl = reel.videoUrl;
                                rc.dataset.userId   = reel.userId || '';
                                rc.innerHTML =
                                    '<video src="' + reel.videoUrl + '" loop muted playsinline preload="metadata"'
                                    + ' style="width:100%;height:100%;object-fit:cover;display:block;"></video>'
                                    + '<div class="reel-content" style="position:absolute;bottom:0;left:0;right:0;'
                                    + 'padding:12px;background:linear-gradient(transparent,rgba(0,0,0,0.8));color:white;">'
                                    + '<div class="reel-user-info" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'
                                    + '<div class="avatar-placeholder" style="width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;">'
                                    + '<img src="' + _attr(reel.avatar || '') + '"></div>'
                                    + '<span style="font-weight:700;font-size:0.85rem;">@' + _esc(reel.username || 'user') + '</span></div>'
                                    + '<p style="font-size:0.82rem;opacity:0.9;margin:0;">' + _esc(reel.caption || '') + '</p></div>';

                                var rv = rc.querySelector('video');
                                if (rv) {
                                    rc.addEventListener('mouseenter', function () { rv.play().catch(function () {}); });
                                    rc.addEventListener('mouseleave', function () { rv.pause(); rv.currentTime = 0; });
                                }

                                if (reel.userId === us.id || _isAdmin()) {
                                    var opts = document.createElement('div');
                                    opts.style.cssText = 'position:absolute;top:8px;right:8px;z-index:10;';
                                    opts.innerHTML =
                                        '<button class="options-btn" style="background:rgba(0,0,0,0.55);border:none;color:white;'
                                        + 'border-radius:50%;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;">'
                                        + '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="font-size:0.75rem;pointer-events:none;"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>'
                                        + '<div class="options-menu" style="position:absolute;top:34px;right:0;background:white;border-radius:10px;'
                                        + 'box-shadow:0 4px 20px rgba(0,0,0,0.2);min-width:130px;z-index:100;overflow:hidden;">'
                                        + '<a href="#" class="edit-post-btn" style="display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:0.82rem;color:var(--secondary);font-weight:600;text-decoration:none;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</a>'
                                        + '<a href="#" class="delete-post-btn" style="display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:0.82rem;color:#e53935;font-weight:600;text-decoration:none;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete</a>'
                                        + '</div>';
                                    rc.style.position = 'relative';
                                    rc.appendChild(opts);
                                }

                                var reEmpty = document.getElementById('reels-empty-state');
                                if (reEmpty) reEmpty.style.display = 'none';
                                if (isNew) { rg.prepend(rc); } else { rg.appendChild(rc); }
                            }
                        }

                        if (isNew && window.pushNotification) {
                            window.pushNotification('🎬 New reel from @' + (reel.username || 'someone') + '!', 'new_reel');
                        }
                    });
                }, function (err) {
                    console.error('[Listener:reels]', err.code, err.message);
                    window._reelsListener = null;
                    if (err.code !== 'permission-denied') {
                        setTimeout(function () {
                            if (!window._reelsListener && typeof window._startRealtimeListeners === 'function') {
                                window._startRealtimeListeners();
                            }
                        }, 5000);
                    }
                });
            console.log('[Firestore] ✅ reels listener active');
        }

        /* ── 5. SOS QUEUE ─────────────────────────────────────────────────── */
        if (!window._sosListener) {
            window._sosListener = db.collection('sos_queue').limit(30)
                .onSnapshot(function (snap) {
                    if (!snap) return;
                    snap.docChanges().forEach(function (change) {
                        var sos = change.doc.data();
                        if (!sos || !sos.id) return;

                        /* 'added'    — document first seen by this client (fresh posts + on page reload)
                           'modified' — admin called .update({status:'approved'}) on an existing doc;
                                        Firestore fires 'modified', NOT 'added', so we must handle both. */
                        if ((change.type === 'added' || change.type === 'modified') && sos.status === 'approved') {
                            var fc = document.getElementById('feed-container');
                            if (fc) {
                                /* If a plain generic card was previously rendered for this id
                                   (e.g. from the posts listener on refresh), remove it first
                                   so the proper SOS card can take its place. */
                                var existing = fc.querySelector('[data-post-id="' + sos.id + '"]');
                                if (existing && !existing.classList.contains('sos-request')) {
                                    existing.remove();
                                }
                                if (!fc.querySelector('[data-post-id="' + sos.id + '"]')) {
                                    createSosPostOnFeed(sos);
                                }
                            }
                        }

                        /* When status changes away from approved (held/rejected), remove from feed */
                        if (change.type === 'modified' && sos.status !== 'approved') {
                            var staleEl = document.querySelector('[data-post-id="' + sos.id + '"]');
                            if (staleEl && staleEl.classList.contains('sos-request')) staleEl.remove();
                        }

                        if (change.type === 'removed') {
                            var el2 = document.querySelector('[data-post-id="' + sos.id + '"]');
                            if (el2) el2.remove();
                        }
                    });
                    /* Repair: inject donate button on any SOS card that is missing it */
                    setTimeout(function () {
                        document.querySelectorAll('.impact-story.sos-request').forEach(function (p) {
                            if (!p.querySelector('.help-now-btn')) {
                                var uname = p.dataset.username || 'this cause';
                                var wrap  = document.createElement('div');
                                wrap.style.cssText = 'padding:10px 16px 14px;';
                                wrap.innerHTML = '<button class="gift-button sos-button help-now-btn" style="width:100%;padding:12px;'
                                    + 'font-size:0.95rem;font-weight:700;border-radius:12px;background:linear-gradient(135deg,#EF4444,#B91C1C);'
                                    + 'color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">'
                                    + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Donate Now — Help ' + _esc(uname) + '</button>';
                                var ac = p.querySelector('.story-actions');
                                if (ac) { p.insertBefore(wrap, ac.nextSibling); } else { p.appendChild(wrap); }
                            }
                        });
                    }, 400);
                }, function (err) {
                    console.error('[Listener:sos]', err.code, err.message);
                    window._sosListener = null;
                });
            console.log('[Firestore] ✅ sos_queue listener active');
        }

        /* ── 6. CRISIS REPORTS ────────────────────────────────────────────── */
        if (!window._crisisListener) {
            window._crisisListener = db.collection('crisis_reports')
                .orderBy('createdAt', 'desc').limit(20)
                .onSnapshot(function (snap) {
                    if (!snap) return;
                    snap.docChanges().forEach(function (change) {
                        var cr = change.doc.data();
                        if (!cr) return;
                        cr.id = cr.id || change.doc.id;
                        if (change.type === 'removed') {
                            var fc = document.getElementById('feed-container');
                            if (fc) { var r = fc.querySelector('[data-post-id="' + cr.id + '"]'); if (r) r.remove(); }
                            return;
                        }
                        if (change.type === 'added') {
                            var fc2 = document.getElementById('feed-container');
                            if (!fc2) return;
                            if (fc2.querySelector('[data-post-id="' + cr.id + '"]')) return;
                            createCrisisPostOnFeed(cr);
                        }
                    });
                }, function (err) {
                    console.error('[Listener:crisis]', err.code, err.message);
                    window._crisisListener = null;
                });
            console.log('[Firestore] ✅ crisis_reports listener active');
        }

        /* ── 7. ANNOUNCEMENTS ─────────────────────────────────────────────── */
        if (!window._announcementsListener) {
            window._announcementsListener = db.collection('announcements').limit(10)
                .onSnapshot(function (snap) {
                    if (!snap) return;
                    snap.docChanges().forEach(function (change) {
                        var ann = change.doc.data();
                        if (!ann || change.type !== 'added') return;
                        var icons = { announcement: '📢', appreciation: '🏆', update: '🔔', 'sos-thanks': '❤️' };
                        var icon  = icons[ann.type] || '📢';
                        if (window.pushNotification) {
                            window.pushNotification(icon + ' ' + (ann.title || 'Admin Announcement'), 'announcement');
                        }
                    });
                }, function (err) {
                    console.error('[Listener:announcements]', err.code, err.message);
                    window._announcementsListener = null;
                });
            console.log('[Firestore] ✅ announcements listener active');
        }

        /* ── 8. USERS (suggested / follow) ───────────────────────────────── */
        if (!window._usersListener) {
            window._usersListener = db.collection('users').limit(50)
                .onSnapshot(function (snap) {
                    if (!snap) return;
                    snap.docChanges().forEach(function (change) {
                        var u = change.doc.data();
                        if (!u || !u.id || u.id === us.id) return;
                        ['likedPostIds','followedUserIds','retweetedPostIds',
                         'awardedRanks','completedTasks','viewedStatusUserIds'].forEach(function (k) {
                            u[k] = new Set(Array.isArray(u[k]) ? u[k] : []);
                        });
                        if (change.type === 'added' || change.type === 'modified') {
                            mu[u.id] = u;
                            if (u.email) ru[u.email] = u;
                        } else if (change.type === 'removed') {
                            delete mu[u.id];
                        }
                    });
                    if (typeof window.renderSuggestedUsers === 'function') window.renderSuggestedUsers();
                }, function (err) {
                    console.error('[Listener:users]', err.code, err.message);
                    window._usersListener = null;
                });
            console.log('[Firestore] ✅ users listener active');
        }

        /* ── 9. STATUSES — load all non-expired statuses from Firestore ──── */
        /* BUG FIX: statuses were never fetched on app start, so they disappeared
           after every page refresh. This listener keeps userStatuses in sync. */
        if (!window._statusesListener) {
            var STATUS_EXPIRY_MS_FEED = 24 * 60 * 60 * 1000;
            window._statusesListener = db.collection('statuses')
                .orderBy('createdAt', 'desc').limit(60)
                .onSnapshot(function (snap) {
                    if (!snap) return;
                    if (!window.userStatuses) window.userStatuses = [];
                    snap.docChanges().forEach(function (change) {
                        var s = change.doc.data();
                        if (!s || !s.userId) return;
                        s.docId = s.docId || change.doc.id;
                        /* Filter expired items */
                        if (s.items) {
                            s.items = s.items.filter(function (item) {
                                return !item.createdAt ||
                                    (Date.now() - new Date(item.createdAt).getTime()) < STATUS_EXPIRY_MS_FEED;
                            });
                        }
                        if (!s.items || s.items.length === 0) {
                            /* Remove from local array — all items expired */
                            window.userStatuses = window.userStatuses.filter(function (x) { return x.userId !== s.userId; });
                            return;
                        }
                        if (change.type === 'removed') {
                            window.userStatuses = window.userStatuses.filter(function (x) { return x.userId !== s.userId; });
                        } else {
                            var idx = window.userStatuses.findIndex(function (x) { return x.userId === s.userId; });
                            /* Preserve viewed flag from current local state if newer */
                            if (idx > -1) {
                                s.viewed = s.viewed || window.userStatuses[idx].viewed;
                                window.userStatuses[idx] = s;
                            } else {
                                window.userStatuses.push(s);
                            }
                        }
                    });
                    /* Sort: own status first, then unviewed, then by createdAt */
                    var myId = (window.userState && window.userState.id) || '';
                    window.userStatuses.sort(function(a, b) {
                        if (a.userId === myId) return -1;
                        if (b.userId === myId) return 1;
                        if (!a.viewed && b.viewed) return -1;
                        if (a.viewed && !b.viewed) return 1;
                        return 0;
                    });
                    if (typeof window.renderStatusBar === 'function') window.renderStatusBar();
                }, function (err) {
                    console.warn('[Listener:statuses]', err.code, err.message);
                    window._statusesListener = null;
                });
            console.log('[Firestore] ✅ statuses listener active');
        }

        /* ── 10. SOS QUEUE + CRISIS REPORTS — delegated to app-sos.js ─────── */
        /* BUG FIX: app-sos.js defines startSosListeners(db) which attaches the
           'sos_queue' and 'crisis_reports' onSnapshot listeners responsible for
           publishing an admin-approved SOS request onto the public dashboard
           feed (createSosPostOnFeed). That function was never invoked anywhere
           in the app, so window._sosListener/_crisisListener were always null —
           meaning an approval only ever rendered locally in the admin's own
           browser tab and never reached any other user's dashboard, even after
           a refresh. Starting it here, alongside the other 8 listeners, fixes
           that without touching the donation-button code path. */
        if (typeof window.startSosListeners === 'function') {
            window.startSosListeners(db);
        } else {
            console.warn('[Listeners] startSosListeners() not found — SOS posts will not sync to dashboard.');
        }

        console.log('[Firestore] ✅ ALL real-time listeners active — full cross-device sync enabled');

        setTimeout(function () {
            if (typeof window._populateHomeBioCard === 'function') window._populateHomeBioCard();
            if (typeof window.renderSuggestedUsers  === 'function') window.renderSuggestedUsers();
        }, 500);
    };


    /* =========================================================================
       §5  DASHBOARD NEWS SLIDER — delegated to app-news.js
       =========================================================================
       app-news.js defines window.renderDashboardNews() using window._newsCache
       as source-of-truth, avoiding the hidden-section DOM-scraping bug.
       This stub ensures any legacy call to renderDashboardNews() before
       app-news.js loads is safely silenced.
       ========================================================================= */
    if (typeof window.renderDashboardNews !== 'function') {
        window.renderDashboardNews = function () {
            /* no-op until app-news.js loads and overwrites this */
        };
    }


    /* =========================================================================
       §6  SUGGESTED USERS WIDGET
       ========================================================================= */

    /**
     * Populate the suggested users slider in #suggested-users-container.
     * Fetches users from Firestore once per session; subsequent calls use cache.
     */
    function renderSuggestedUsers() {
        var container = document.getElementById('suggested-users-container');
        var slider    = document.getElementById('suggested-users-slider');
        var bioCard   = document.getElementById('home-user-bio-card');
        var us        = _us();
        if (_isGuest() || !container || !slider) return;

        /* Kick off Firestore fetch once */
        if (window.fbDb && window._firebaseLoaded && !window._suggestedFetchDone) {
            window._suggestedFetchDone = true;
            window.fbDb.collection('users').limit(40).get()
                .then(function (snap) {
                    window._firestoreSuggestedUsers = snap.docs.map(function (d) {
                        var u = d.data(); u.id = d.id; return u;
                    }).filter(function (u) { return u.id && u.username; });
                    renderSuggestedUsers();
                }).catch(function (e) { console.warn('[SuggestedUsers] fetch failed:', e && e.message); });
        }

        /* Merge Firestore + mockUsers */
        var allUsers = Object.assign({}, window.mockUsers || {});
        (window._firestoreSuggestedUsers || []).forEach(function (u) { allUsers[u.id] = u; });

        var followedSet = us.followedUserIds instanceof Set
            ? us.followedUserIds
            : new Set(Array.isArray(us.followedUserIds) ? us.followedUserIds : []);

        var toSuggest = Object.values(allUsers).filter(function (u) {
            return u.id !== us.id && !followedSet.has(u.id);
        });

        slider.innerHTML = '';

        if (toSuggest.length > 0) {
            toSuggest.slice(0, 5).forEach(function (user) {
                var cvr  = (user.coverPhoto && user.coverPhoto.startsWith('http')) ? user.coverPhoto : '';
                var av   = user.avatar
                    || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName || 'U') + '&background=1B2B8B&color=fff&size=150');
                var flwrs = (user.followerCount || 0).toLocaleString();
                var flwing = (user.followedUserIds
                    ? (typeof user.followedUserIds.size === 'number' ? user.followedUserIds.size
                        : (Array.isArray(user.followedUserIds) ? user.followedUserIds.length : 0)) : 0).toLocaleString();
                var empy  = typeof user.empyBalance === 'number' ? user.empyBalance.toFixed(2) : '0.00';
                var bio   = user.bio ? (user.bio.length > 60 ? user.bio.substring(0, 58) + '…' : user.bio) : '';

                var card = document.createElement('div');
                card.className     = 'suggested-user-card';
                card.dataset.userId = user.id;
                card.title          = 'View ' + (user.fullName || user.username || 'profile');
                card.innerHTML =
                    '<div style="height:110px;background:'
                    + (cvr ? 'url(' + cvr + ') center/cover no-repeat' : 'linear-gradient(135deg,#e8eaf6 0%,#c5cae9 100%)')
                    + ';border-radius:14px 14px 0 0;flex-shrink:0;position:relative;"></div>'
                    + '<div style="padding:0 16px 16px;position:relative;">'
                    + '<img src="' + _attr(av) + '" alt="' + _attr(user.fullName || '') + '" loading="lazy"'
                    + ' style="width:72px;height:72px;border-radius:50%;object-fit:cover;'
                    + 'border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.15);margin-top:-36px;display:block;background:#e8eaf6;"'
                    + ' onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName || 'U') + '&background=1B2B8B&color=fff&size=150\'">'
                    + '<button class="btn follow-btn" data-user-id="' + user.id + '"'
                    + ' style="position:absolute;top:10px;right:16px;padding:8px 22px;border-radius:50px;'
                    + 'font-size:0.85rem;font-weight:700;background:transparent;'
                    + 'border:2px solid var(--primary,#1B2B8B);color:var(--primary,#1B2B8B);cursor:pointer;white-space:nowrap;">Follow</button>'
                    + '<div style="margin-top:8px;">'
                    + '<strong style="display:block;font-size:1.05rem;font-weight:800;color:var(--primary,#0A0E27);'
                    + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
                    + _esc(user.fullName || user.username || 'User') + '</strong>'
                    + '<span style="font-size:0.82rem;color:#888;display:block;margin-top:1px;">@' + _esc(user.username || '') + '</span>'
                    + (bio ? '<p style="font-size:0.85rem;color:#444;margin:8px 0 0;line-height:1.4;">' + _esc(bio) + '</p>' : '')
                    + '<div style="border-top:1px solid rgba(10,14,39,0.1);margin:12px 0;"></div>'
                    + '<div style="display:flex;gap:24px;font-size:0.85rem;color:#555;margin-bottom:8px;">'
                    + '<span><b style="font-size:1rem;font-weight:800;color:var(--primary,#0A0E27);">' + flwrs + '</b> Followers</span>'
                    + '<span><b style="font-size:1rem;font-weight:800;color:var(--primary,#0A0E27);">' + flwing + '</b> Following</span>'
                    + '</div>'
                    + '<div style="display:flex;align-items:center;gap:7px;font-size:0.9rem;color:#444;">'
                    + '<span style="font-size:1.1rem;">🏛️</span>'
                    + '<b style="font-size:1rem;font-weight:800;color:var(--primary,#0A0E27);">' + _esc(empy) + '</b>'
                    + '<span style="font-weight:600;color:#888;">EMPY</span></div>'
                    + '</div></div>';

                card.addEventListener('click', function (e) {
                    if (e.target.classList.contains('follow-btn') || e.target.closest('.follow-btn')) return;
                    window._viewingOtherProfile = (user.id !== us.id);
                    if (typeof window.renderUserProfile === 'function') window.renderUserProfile(user.id);
                    if (typeof window.navigateTo       === 'function') window.navigateTo('profile', true);
                });

                slider.appendChild(card);
            });

            container.style.display = 'block';
            if (bioCard) bioCard.style.display = 'block';
        } else {
            container.style.display = 'none';
            if (bioCard) bioCard.style.display = 'none';
        }
    }
    window.renderSuggestedUsers = renderSuggestedUsers;


    /* =========================================================================
       §7  PROFILE GALLERY HELPER
       ========================================================================= */

    /**
     * Accumulate Cloudinary URLs into the profile gallery grid.
     * Skips duplicates and blob:// URLs.
     * @param {string[]} urls
     */
    function _addUrlsToProfileGallery(urls) {
        var gallery = document.getElementById('profile-gallery');
        if (!gallery || !urls || !urls.length) return;
        urls.forEach(function (url) {
            if (!url || url.startsWith('blob:')) return;
            if (gallery.querySelector('[data-url="' + url + '"]')) return;

            var isVid = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url);
            var item  = document.createElement('div');
            item.className      = 'gallery-item';
            item.dataset.url     = url;
            item.style.cssText   = 'position:relative;overflow:hidden;border-radius:12px;cursor:pointer;background:#f0f0f0;';
            item.innerHTML = isVid
                ? '<video src="' + url + '" style="width:100%;height:100%;object-fit:cover;" muted preload="metadata" playsinline></video>'
                : '<img src="' + url + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;"'
                    + ' onerror="this.closest(\'.gallery-item\').style.display=\'none\'">';
            gallery.appendChild(item);
        });
    }
    window._addUrlsToProfileGallery = _addUrlsToProfileGallery;


    /* =========================================================================
       §8  REEL VIEWER
       ========================================================================= */

    /**
     * Attach click handlers to reel cards and preview cards so they open
     * the full-screen reel viewer.
     * Uses MutationObserver to catch cards added dynamically.
     */
    function setupReelViewerObserver() {
        function _bindCard(card) {
            if (card._reelViewerBound) return;
            card._reelViewerBound = true;
            card.addEventListener('click', function (e) {
                if (e.target.closest('.options-btn, .options-menu, .edit-post-btn, .delete-post-btn')) return;
                openReelViewer(card);
            });
        }

        document.querySelectorAll('.reel-card, .reel-preview-card, .dashboard-reel-card')
            .forEach(_bindCard);

        var obs = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (!node || node.nodeType !== 1) return;
                    if (node.classList && (
                        node.classList.contains('reel-card') ||
                        node.classList.contains('reel-preview-card') ||
                        node.classList.contains('dashboard-reel-card')
                    )) { _bindCard(node); }
                    node.querySelectorAll && node.querySelectorAll(
                        '.reel-card,.reel-preview-card,.dashboard-reel-card'
                    ).forEach(_bindCard);
                });
            });
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }
    window.setupReelViewerObserver = setupReelViewerObserver;

    /**
     * Open the full-screen reel viewer for a given reel card.
     * Defers to app-reel.js (empyreanReelsModule) if it has loaded,
     * since that module has the full engagement bar (like/comment/retweet/share/download).
     * This stub only runs if app-reel.js has NOT loaded yet.
     * @param {HTMLElement} clickedCard — .reel-card or .reel-preview-card
     */
    function openReelViewer(clickedCard) {
        /* If app-reel.js already registered a full openReelViewer, use it */
        if (window._empyreanReelsLoaded && window._reelViewerFull) {
            window._reelViewerFull(clickedCard);
            return;
        }

        var videoUrl = clickedCard.dataset.videoUrl
            || (clickedCard.querySelector('video') && clickedCard.querySelector('video').src)
            || '';
        if (!videoUrl || videoUrl.startsWith('blob:')) return;

        var overlay = document.getElementById('reel-viewer-modal-overlay');
        var ct      = document.getElementById('reel-viewer-container');
        if (!overlay || !ct) return;

        /* Pause every feed/page video before opening the viewer so audio does not overlap */
        document.querySelectorAll('video').forEach(function(v) {
            if (v.closest('#reel-viewer-modal-overlay, #reel-viewer-container, #go-live-modal-overlay, #live-stream-container')) return;
            try { if (!v.paused) v.pause(); } catch(e) {}
        });

        ct.innerHTML = '';
        var vi = document.createElement('div');
        vi.className      = 'reel-viewer-item';
        vi.style.cssText  = 'position:relative;width:100%;height:100%;background:#000;'
            + 'flex-shrink:0;display:flex;align-items:center;justify-content:center;';
        vi.innerHTML =
            '<video src="' + videoUrl + '" style="width:100%;height:100%;object-fit:contain;"'
            + ' controls autoplay playsinline></video>';
        ct.appendChild(vi);
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';

        /* Wire the close button every time the viewer opens */
        var closeBtn = overlay.querySelector('.reel-viewer-close');
        if (closeBtn) {
            closeBtn.onclick = function() {
                overlay.style.display = 'none';
                document.body.style.overflow = '';
                ct.querySelectorAll('video').forEach(function(v) {
                    try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e) {}
                });
                ct.innerHTML = '';
            };
        }
    }
    window.openReelViewer = openReelViewer;

    /* Also wire on DOM ready so the button works even before first reel tap */
    (function() {
        function _w() {
            var ov = document.getElementById('reel-viewer-modal-overlay');
            var cb = ov && ov.querySelector('.reel-viewer-close');
            if (!cb || cb._wired) return;
            cb._wired = true;
            cb.addEventListener('click', function() {
                ov.style.display = 'none';
                document.body.style.overflow = '';
                var ct2 = document.getElementById('reel-viewer-container');
                if (ct2) {
                    ct2.querySelectorAll('video').forEach(function(v) {
                        try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e) {}
                    });
                    ct2.innerHTML = '';
                }
            });
        }
        if (document.readyState !== 'loading') _w();
        else document.addEventListener('DOMContentLoaded', _w);
        document.addEventListener('empyrean-init-done', function() { setTimeout(_w, 300); });
    })();


    /* =========================================================================
       §9  VIEW-COUNT OBSERVER
       ========================================================================= */

    /**
     * IntersectionObserver that increments view counts on post cards
     * when they scroll into view.  Only counts once per post per session.
     */
    /* NOTE: view-count Firestore writes are handled by app-fixes.js
       (_viewCountObserver). This observer only mirrors DOM counts for
       cards that app-fixes.js hasn't yet stamped with [data-obs]. */
    (function _setupViewCountObserver() {
        /* Bail out if app-fixes.js observer is already running — it owns
           the Firestore write AND the DOM update. No duplication needed. */
        if (window._viewCountObserver) return;

        var viewed = new Set();
        var obs    = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el     = entry.target;
                var postId = el.dataset.postId;
                /* Skip cards that app-fixes.js observer is already watching */
                if (!postId || viewed.has(postId) || el.dataset.obs) return;
                viewed.add(postId);
                obs.unobserve(el);
                /* DOM-only optimistic update — Firestore write is app-fixes.js's job */
                var vc = el.querySelector('.view-count');
                if (vc) vc.textContent = parseInt(vc.textContent || '0') + 1;
            });
        }, { threshold: 0.5 });

        var cardObs = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (!node || node.nodeType !== 1) return;
                    /* Only observe cards app-fixes.js hasn't claimed yet */
                    if (node.classList && node.classList.contains('impact-story') && !node.dataset.obs) obs.observe(node);
                    node.querySelectorAll && node.querySelectorAll('.impact-story:not([data-obs])').forEach(function (s) { obs.observe(s); });
                });
            });
        });
        cardObs.observe(document.body, { childList: true, subtree: true });

        /* Observe already-present cards not yet claimed by app-fixes.js */
        document.querySelectorAll('.impact-story:not([data-obs])').forEach(function (s) { obs.observe(s); });
    })();


    /* =========================================================================
       PRIVATE UTILITIES
       ========================================================================= */

    function _attr(str) { return String(str || '').replace(/"/g, '&quot;'); }
    function _esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }


    /* =========================================================================
       §10  SCROLL-PAUSE OBSERVER
       =========================================================================
       Mirrors standard social-media behaviour: a feed video pauses automatically
       when it scrolls out of view and resumes only if the user had previously
       started playing it (i.e. it was not paused by the user themselves).

       Excluded: reel-viewer overlay, go-live / live-stream containers — those
       have their own lifecycle management and must never be interrupted here.
       ========================================================================= */

    (function _setupScrollPauseObserver() {

        var EXCLUDED = '#reel-viewer-modal-overlay, #reel-viewer-container, '
                     + '#go-live-modal-overlay, #live-stream-container';

        /**
         * Bind scroll-pause behaviour to a single <video> element.
         * Safe to call multiple times — guarded by _scrollPauseBound flag.
         */
        function _bindVideo(vid) {
            if (vid._scrollPauseBound) return;
            if (vid.closest && vid.closest(EXCLUDED)) return;
            vid._scrollPauseBound = true;

            /* Track whether the user intentionally started the video */
            vid._userPlaying = false;
            vid.addEventListener('play',  function() { vid._userPlaying = true;  });
            vid.addEventListener('pause', function() {
                /* Only clear the flag when the user pauses manually,
                   not when we pause programmatically via the observer. */
                if (!vid._scrollPauseInProgress) vid._userPlaying = false;
            });
        }

        /* One shared observer for all feed videos */
        var scrollObs = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                var vid = entry.target;
                if (vid.closest && vid.closest(EXCLUDED)) return;

                if (!entry.isIntersecting) {
                    /* Scrolled away — pause if playing */
                    if (!vid.paused) {
                        vid._scrollPauseInProgress = true;
                        try { vid.pause(); } catch(e) {}
                        vid._scrollPauseInProgress = false;
                        /* Remember we paused it so we can resume on scroll-back */
                        vid._pausedByScroll = true;
                    }
                } else {
                    /* Scrolled back into view — resume only if we paused it */
                    if (vid._pausedByScroll && vid._userPlaying) {
                        vid._pausedByScroll = false;
                        try { vid.play().catch(function(){}); } catch(e) {}
                    } else {
                        vid._pausedByScroll = false;
                    }
                }
            });
        }, {
            /* Pause as soon as less than 30 % of the video is visible —
               matches Instagram / TikTok feel */
            threshold: 0.3
        });

        /** Observe a video element (bind + start watching) */
        function _watchVideo(vid) {
            if (vid._scrollPauseBound) return;
            if (vid.closest && vid.closest(EXCLUDED)) return;
            _bindVideo(vid);
            scrollObs.observe(vid);
        }

        /** Sweep a DOM subtree for any video elements */
        function _sweepVideos(root) {
            (root || document).querySelectorAll('video').forEach(_watchVideo);
        }

        /* Watch for new video elements added dynamically (new posts loaded) */
        var vidMutObs = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                m.addedNodes.forEach(function(node) {
                    if (!node || node.nodeType !== 1) return;
                    if (node.tagName === 'VIDEO') { _watchVideo(node); return; }
                    if (node.querySelectorAll) _sweepVideos(node);
                });
            });
        });
        vidMutObs.observe(document.body, { childList: true, subtree: true });

        /* Observe videos already in the DOM */
        _sweepVideos();

        /* Also sweep after feed listeners have loaded their first batch */
        document.addEventListener('empyrean-init-done', function() {
            setTimeout(_sweepVideos, 600);
        });

        /* Expose so other modules can call _sweepVideos() after injecting content */
        window._sweepFeedVideos = _sweepVideos;

    })();


    /* ── Download count ──────────────────────────────────────────────────
       REMOVED (was double-incrementing): this used to write downloadCount
       on every .download-media-btn click, but app-fixes.js's master click
       handler (setupMasterEventListeners) ALSO writes downloadCount on the
       same click — with correct collection routing (posts / crisis_reports
       / business_posts), where this listener always hardcoded 'posts'
       regardless of the post's actual collection. Net effect: every
       download incremented the counter twice, and for non-'posts' content
       wrote to the wrong (or a nonexistent) document. app-fixes.js's write
       is now the single source of truth for this counter. */


    /* ── GLOBAL SHARE HANDLER — opens the real OS share drawer on every device ──
       navigator.share() MUST be called synchronously inside the click handler
       (user-gesture requirement). We call e.preventDefault() but NOT
       e.stopPropagation() so the gesture trust token is preserved for the
       navigator.share() call that follows immediately.
       On desktop (no navigator.share) we copy the link to clipboard. */
    document.addEventListener('click', function (e) {
        var shareBtn = e.target && e.target.closest && e.target.closest('.share-btn, [data-action="share"], .action-btn.share-btn, #biz-share-btn, .biz-share-trigger');
        if (!shareBtn) return;

        /* Don't intercept reel share — reel module manages its own */
        if (shareBtn.closest('.reel-overlay, .reel-card, [data-reel-action]')) return;

        e.preventDefault();
        /* NOTE: do NOT call e.stopPropagation() here — it can break the
           user-gesture trust token that navigator.share() requires on Android. */

        var card   = shareBtn.closest('[data-post-id], [data-biz-id], [data-page-id], .impact-story, .story-card, .crisis-card, .news-card, .business-card');
        var postId = card && (card.dataset.postId || card.dataset.bizId || card.dataset.pageId || '');

        /* Route through _empShare (app-thread.js) — handles count + mining + native share */
        if (typeof window._empShare === 'function') {
            window._empShare(null, postId || null);
            return;
        }

        /* Direct fallback if thread module hasn't loaded yet */
        var shareUrl = window.location.origin + (postId ? '/?post=' + encodeURIComponent(postId) : window.location.pathname);
        if (typeof navigator.share === 'function') {
            navigator.share({ title: 'Empyrean International', url: shareUrl }).catch(function (err) {
                if (err && err.name !== 'AbortError' && navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrl).then(function () {
                        if (typeof window.showNotification === 'function') window.showNotification('Link copied!', 'success');
                    }).catch(function(){});
                }
            });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(function () {
                if (typeof window.showNotification === 'function') window.showNotification('Link copied!', 'success');
            }).catch(function(){});
        }
    }, false);


    /* ═══════════════════════════════════════════════════════════════════
       NEW POSTS PILL NOTIFICATION
       Shows "↑ N new posts" when a new post arrives while the user is
       scrolled below 200px. Tapping scrolls to top and dismisses it.
    ═══════════════════════════════════════════════════════════════════ */
    (function initNewPostsPill() {
        var _newCount = 0;
        var _pill = null;

        function _getPill() {
            if (_pill) return _pill;
            _pill = document.createElement('div');
            _pill.id = 'empyrean-new-posts-pill';
            _pill.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg><span id="emp-pill-label">new posts</span>';
            document.body.appendChild(_pill);
            _pill.addEventListener('click', function () {
                _newCount = 0;
                _hide();
                /* Scroll the feed to top */
                var fc = document.getElementById('feed-container');
                var scrollTarget = (fc && fc.closest('.dashboard-section, [data-section], main, .content-area')) || window;
                if (scrollTarget === window) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    scrollTarget.scrollTo({ top: 0, behavior: 'smooth' });
                }
                /* Also try scrolling the page wrapper */
                var pageWrap = document.querySelector('.page-content, .main-content, #app-root');
                if (pageWrap) pageWrap.scrollTo({ top: 0, behavior: 'smooth' });
            });
            return _pill;
        }

        function _show() {
            var p = _getPill();
            var label = document.getElementById('emp-pill-label');
            if (label) label.textContent = _newCount === 1 ? '1 new post' : _newCount + ' new posts';
            p.classList.add('visible');
        }

        function _hide() {
            if (_pill) _pill.classList.remove('visible');
        }

        function _isScrolledDown() {
            var fc = document.getElementById('feed-container');
            if (fc) {
                var wrap = fc.closest('.dashboard-section, [data-section], main, .content-area');
                if (wrap && wrap.scrollTop > 200) return true;
            }
            return window.scrollY > 200 || document.documentElement.scrollTop > 200;
        }

        /* Hide pill when user scrolls back to top */
        var _scrollHandler = function () {
            if (!_isScrolledDown()) { _newCount = 0; _hide(); }
        };
        window.addEventListener('scroll', _scrollHandler, { passive: true });
        document.addEventListener('scroll', _scrollHandler, { passive: true, capture: true });

        /* Expose so the posts listener can call it when a new post arrives */
        window._notifyNewPost = function () {
            if (!_isScrolledDown()) return; /* already at top — no need for pill */
            _newCount++;
            _show();
        };

        /* Hide when navigating away from dashboard */
        document.addEventListener('empyrean-section-change', function (ev) {
            if (!ev || !ev.detail || ev.detail.section !== 'dashboard') {
                _newCount = 0;
                _hide();
            }
        });
    })();


    /* Bootstrap reel viewer on load */
    document.addEventListener('empyrean-init-done', function () {
        setTimeout(setupReelViewerObserver, 400);
    });
    setTimeout(setupReelViewerObserver, 1000);

    console.log('[EmpFeed] ✅ Feed module ready — post builder, 8 listeners, dashboard widgets loaded.');

})();