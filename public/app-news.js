/* =============================================================================
   APP-NEWS.JS  —  Empyrean News Media Module  (v1.0)
   =============================================================================
   A fully self-contained module that owns every aspect of the News feature:

     1. Firestore real-time listener  →  writes to #news-list-container (News section)
     2. Dashboard strip renderer      →  reads from the in-memory cache, NOT from DOM
     3. Publish / Delete helpers      →  called by admin panel
     4. Search / filter               →  live filtering inside #news section
     5. MutationObserver bridge       →  keeps dashboard strip in sync automatically

   WHY THIS REPLACES THE SCATTERED APPROACH
   -----------------------------------------
   The previous code had two separate systems for news:
     • app-feed.js  §2  — Firestore listener that appended to #news-list-container
     • app-feed.js  §5  — renderDashboardNews() that scraped DOM from '#news .news-list-item'

   The selector '#news .news-list-item' only matches when the #news section is
   currently visible (offsetParent ≠ null on some browsers). Because the dashboard
   is the default active section, the news section is hidden when the listener fires
   and the dashboard scrape finds zero items → the strip stays empty.

   This module fixes the root cause:
     • News articles are stored in a JS array (_newsCache) as they arrive from
       Firestore, independently of which section is active.
     • The dashboard strip is built from _newsCache, never from the DOM.
     • Both the section list and the dashboard strip are updated in one atomic call.

   USAGE
   -----
   Add this script AFTER firebase-init.js and BEFORE app-fix-final.js in index.html:

       <script src="app-news.js" defer></script>

   Remove (or comment out) the old §2 news block in app-feed.js to avoid
   double-listening.  The module exposes:

       window.renderDashboardNews()   — re-renders the dashboard strip
       window.addNewsPost(data)       — called by admin after successful Firestore write
       window.deleteNewsPost(id)      — called by admin delete button
       window._newsCache              — live array of all cached news objects

============================================================================= */

(function EmpyreanNews() {
    'use strict';

    /* ── Wait for DOM ──────────────────────────────────────────────────────── */
    function _ready(fn) {
        if (document.readyState !== 'loading') { fn(); }
        else { document.addEventListener('DOMContentLoaded', fn); }
    }

    /* ── Tiny helpers (mirrors of app-feed.js private helpers) ────────────── */
    function _esc(s) {
        if (typeof s !== 'string') return '';
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function _attr(s) { return _esc(s); }

    function _fbOk() {
        return !!(window._firebaseLoaded && window.fbDb &&
                  typeof window.fbDb.collection === 'function');
    }

    function _us() {
        return (window.EmpState && window.EmpState.userState)
            || window.userState
            || {};
    }

    function _isAdmin() {
        if (typeof window.isAdmin === 'boolean' && window.isAdmin) return true;
        var u = _us();
        return !!(u && (u.role === 'admin' || u.email === 'admin@empyrean.com'));
    }

    function _notify(msg, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(msg, type || 'success');
        }
    }

    /* ── In-memory news cache (source-of-truth for dashboard strip) ─────── */
    window._newsCache = window._newsCache || [];

    /* ─────────────────────────────────────────────────────────────────────────
       §1  BUILD ONE NEWS-LIST ITEM  (used in #news-list-container)
    ───────────────────────────────────────────────────────────────────────── */
    function _buildNewsItem(n) {
        var us     = _us();
        var isVid  = n.mediaUrl && (
            (n.mediaType || '').startsWith('video/')
            || /\/video\/upload\//i.test(n.mediaUrl)
            || /\.(mp4|webm|mov)(\?|$)/i.test(n.mediaUrl)
        );

        var mediaHtml = n.mediaUrl
            ? ('<div class="news-item-image">'
                + (isVid
                    ? '<video src="' + _esc(n.mediaUrl) + '" controls playsinline '
                      + 'style="width:100%;height:100%;object-fit:cover;">'
                      + '<source src="' + _esc(n.mediaUrl) + '" type="' + _esc(n.mediaType || 'video/mp4') + '">'
                      + '</video>'
                    : '<img src="' + _esc(n.mediaUrl) + '" loading="lazy">')
                + '</div>')
            : '';

        var ownerOpts = (n.userId === us.id || _isAdmin())
            ? '<div class="post-options" style="position:absolute;top:8px;right:8px;">'
              + '<button class="options-btn"><i class="fas fa-ellipsis-h"></i></button>'
              + '<div class="options-menu">'
              + '<a href="#" class="edit-post-btn"><i class="fas fa-edit"></i> Edit</a>'
              + '<a href="#" class="delete-news-btn" data-news-id="' + _esc(n.id) + '" '
              + 'style="color:#e53935;"><i class="fas fa-trash"></i> Delete</a>'
              + '</div></div>'
            : '';

        var dateStr = n.createdAt
            ? new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Recently';

        var el = document.createElement('div');
        el.className        = 'news-list-item';
        el.dataset.postId   = n.id;
        el.dataset.userId   = n.userId || '';
        el.dataset.img      = (!isVid && n.mediaUrl) ? n.mediaUrl : '';
        el.dataset.vid      = (isVid && n.mediaUrl)  ? n.mediaUrl : '';
        el.style.position   = 'relative';
        el.innerHTML = ownerOpts + mediaHtml
            + '<div class="news-item-content-wrapper">'
            + '<div class="news-item-content">'
            + '<h4>' + _esc(n.title || '') + '</h4>'
            + '<span class="news-meta"><i class="fas fa-calendar-alt"></i> ' + dateStr + '</span>'
            + '<p>' + _esc(n.content || '') + '</p>'
            + '</div>'
            + '<div class="story-actions" style="margin-top:8px;">'
            + '<a class="action-btn like-btn"><i class="far fa-heart"></i>'
            + '<span class="like-count">' + (n.likes || 0) + '</span></a>'
            + '<a class="action-btn comment-btn"><i class="far fa-comment"></i>'
            + '<span class="comment-count">' + (n.commentCount || 0) + '</span></a>'
            + '<a class="action-btn retweet-btn"><i class="fas fa-retweet"></i>'
            + '<span class="retweet-count">' + (n.retweets || 0) + '</span></a>'
            + '<a class="action-btn share-btn"><i class="fas fa-share"></i></a>'
            + '<a class="action-btn download-media-btn"><i class="fas fa-download"></i></a>'
            + '<span class="action-btn view-count-display" style="margin-left:auto;color:var(--text-muted);'
            + 'font-size:0.72rem;pointer-events:none;">'
            + '<i class="fas fa-eye"></i><span class="view-count">' + (n.views || 0) + '</span></span>'
            + '</div>'
            + '<div class="comment-section"><div class="comment-list"></div>'
            + '<form class="comment-form" novalidate>'
            + '<input type="text" name="comment-text" placeholder="Add a comment..." required>'
            + '<button type="submit"><i class="fas fa-paper-plane"></i></button>'
            + '</form></div>'
            + '</div>';
        return el;
    }


    /* ─────────────────────────────────────────────────────────────────────────
       §2  SYNC EMPTY-STATE  (#news-empty-state visibility)
    ───────────────────────────────────────────────────────────────────────── */
    function _syncEmpty() {
        var es = document.getElementById('news-empty-state');
        var nl = document.getElementById('news-list-container');
        if (!es || !nl) return;
        var hasItems = nl.querySelector('.news-list-item') !== null;
        es.style.display = hasItems ? 'none' : 'block';
    }


    /* ─────────────────────────────────────────────────────────────────────────
       §3  ADD ONE ITEM TO #news-list-container
    ───────────────────────────────────────────────────────────────────────── */
    function _addToNewsList(n, prepend) {
        var nl = document.getElementById('news-list-container');
        if (!nl) return;
        if (nl.querySelector('[data-post-id="' + n.id + '"]')) return; // dedup
        var el = _buildNewsItem(n);
        if (prepend) { nl.prepend(el); } else { nl.appendChild(el); }
        _syncEmpty();
    }


    /* ─────────────────────────────────────────────────────────────────────────
       §4  DASHBOARD STRIP RENDERER
       Reads from _newsCache — never touches the DOM of #news section.
    ───────────────────────────────────────────────────────────────────────── */
    function renderDashboardNews() {
        var container = document.getElementById('dashboard-news-container')
            || document.getElementById('news-dashboard-container')
            || document.querySelector('.dashboard-news-container, [data-news-strip]');
        var slider    = document.getElementById('dashboard-news-slider')
            || document.getElementById('news-dashboard-slider')
            || document.querySelector('.dashboard-news-slider, [data-news-slider]');
        if (!container || !slider) return;

        var cache = window._newsCache || [];
        if (cache.length === 0) {
            container.style.display = 'none';
            return;
        }

        slider.innerHTML = '';

        cache.slice(0, 8).forEach(function (n) {
            var isVid = !!(n.mediaUrl && (
                (n.mediaType || '').startsWith('video/')
                || /\/video\/upload\//i.test(n.mediaUrl)
                || /\.(mp4|webm|mov)(\?|$)/i.test(n.mediaUrl)
            ));
            var src = (!isVid && n.mediaUrl) ? n.mediaUrl
                : 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80';

            var card = document.createElement('div');
            card.className       = 'dashboard-news-card';
            card.dataset.navTarget = 'news';
            card.dataset.postId  = n.id || '';
            card.style.cssText   = [
                'flex:0 0 220px',
                'width:220px',
                'border-radius:14px',
                'overflow:hidden',
                'cursor:pointer',
                'box-shadow:0 4px 16px rgba(91,14,166,0.12)',
                'transition:transform 0.22s,box-shadow 0.22s',
                'background:white',
                'scroll-snap-align:start',
            ].join(';');

            var mediaPart = isVid
                ? '<video src="' + _esc(n.mediaUrl) + '" muted loop autoplay playsinline '
                  + 'style="width:100%;height:140px;object-fit:cover;display:block;"></video>'
                : '<img src="' + _esc(src) + '" alt="' + _attr(n.title || 'News') + '" loading="lazy" '
                  + 'style="width:100%;height:140px;object-fit:cover;display:block;" '
                  + 'onerror="this.src=\'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80\'">';

            var dateStr = n.createdAt
                ? new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                : '';

            card.innerHTML = mediaPart
                + '<div class="dashboard-news-card-info" style="padding:12px;">'
                + '<h5 style="font-size:0.85rem;font-weight:700;color:var(--primary-color,#0A0E27);'
                + 'white-space:normal;line-height:1.3;margin:0 0 4px;">' + _esc(n.title || 'News') + '</h5>'
                + (dateStr ? '<span style="font-size:0.72rem;color:#888;">' + dateStr + '</span>' : '')
                + '</div>';

            card.addEventListener('mouseenter', function () {
                card.style.transform   = 'translateY(-4px)';
                card.style.boxShadow   = '0 10px 28px rgba(91,14,166,0.2)';
            });
            card.addEventListener('mouseleave', function () {
                card.style.transform   = '';
                card.style.boxShadow   = '0 4px 16px rgba(91,14,166,0.12)';
            });
            card.addEventListener('click', function () {
                if (typeof window.navigateTo === 'function') window.navigateTo('news');
                /* Scroll to the specific article after a short delay */
                setTimeout(function () {
                    var nl = document.getElementById('news-list-container');
                    if (!nl) return;
                    var target = nl.querySelector('[data-post-id="' + n.id + '"]');
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 350);
            });

            slider.appendChild(card);
        });

        /* Ensure slider has proper scroll styles */
        slider.style.display             = 'flex';
        slider.style.flexWrap            = 'nowrap';
        slider.style.overflowX           = 'auto';
        slider.style.gap                 = '12px';
        slider.style.scrollSnapType      = 'x mandatory';
        slider.style.webkitOverflowScrolling = 'touch';
        slider.style.paddingBottom       = '8px';

        container.style.display = 'block';
    }

    /* Expose publicly */
    window.renderDashboardNews = renderDashboardNews;
    window._startNewsListener  = _startNewsListener; // exposed for auth resets in app-fixes.js / app-feed.js


    /* ─────────────────────────────────────────────────────────────────────────
       §5  ADD NEWS POST  (called externally after admin publishes)
    ───────────────────────────────────────────────────────────────────────── */
    function addNewsPost(n) {
        if (!n || !n.id) return;
        /* Update cache — prevent duplicates */
        var idx = window._newsCache.findIndex(function (x) { return x.id === n.id; });
        if (idx === -1) {
            window._newsCache.unshift(n); /* newest first */
        } else {
            window._newsCache[idx] = n;
        }
        /* Add to news section list */
        _addToNewsList(n, true /* prepend — newest first */);
        /* Refresh dashboard strip from updated cache */
        renderDashboardNews();
        /* Update admin news table if present */
        _syncAdminTable(n, 'add');
    }
    window.addNewsPost = addNewsPost;


    /* ─────────────────────────────────────────────────────────────────────────
       §6  DELETE NEWS POST
    ───────────────────────────────────────────────────────────────────────── */
    function deleteNewsPost(id) {
        if (!id) return;
        /* Remove from cache */
        window._newsCache = window._newsCache.filter(function (x) { return x.id !== id; });
        /* Remove from news list */
        var nl = document.getElementById('news-list-container');
        if (nl) {
            var el = nl.querySelector('[data-post-id="' + id + '"]');
            if (el) el.remove();
        }
        /* Remove from dashboard strip */
        var slider = document.getElementById('dashboard-news-slider');
        if (slider) {
            var card = slider.querySelector('[data-post-id="' + id + '"]');
            if (card) card.remove();
        }
        _syncEmpty();
        renderDashboardNews();
        /* Remove from admin table */
        _syncAdminTable({ id: id }, 'remove');
        /* Delete from Firestore */
        if (_fbOk()) {
            window.fbDb.collection('news_posts').doc(id).delete()
                .then(function () { _notify('Article deleted.', 'success'); })
                .catch(function (e) { console.warn('[News] delete error:', e && e.message); });
        }
    }
    window.deleteNewsPost = deleteNewsPost;


    /* ─────────────────────────────────────────────────────────────────────────
       §7  ADMIN TABLE SYNC
    ───────────────────────────────────────────────────────────────────────── */
    function _syncAdminTable(n, action) {
        var tbody = document.querySelector('#admin-news-table-body');
        if (!tbody) return;
        if (action === 'remove') {
            var row = tbody.querySelector('tr[data-post-id="' + n.id + '"]');
            if (row) row.remove();
            return;
        }
        if (action === 'add') {
            if (tbody.querySelector('tr[data-post-id="' + n.id + '"]')) return;
            var tr = document.createElement('tr');
            tr.dataset.postId = n.id;
            var dateStr = n.createdAt
                ? new Date(n.createdAt).toLocaleDateString('en-GB')
                : 'Now';
            tr.innerHTML = '<td>' + _esc(n.title || '') + '</td>'
                + '<td>' + dateStr + '</td>'
                + '<td><button class="btn btn-small btn-danger" onclick="window.deleteNewsPost(\'' + _esc(n.id) + '\')">'
                + '<i class="fas fa-trash"></i> Delete</button></td>';
            tbody.prepend(tr);
        }
    }


    /* ─────────────────────────────────────────────────────────────────────────
       §8  FIRESTORE REAL-TIME LISTENER
       Owns window._newsListener so it won't clash with existing listeners.
       Guards against double-start with _newsListenerActive flag.
    ───────────────────────────────────────────────────────────────────────── */
    function _startNewsListener() {
        if (window._newsListenerActive) return;
        if (!_fbOk()) return;

        /* Cancel any stale listener set up by the old system */
        if (window._newsListener && typeof window._newsListener === 'function') {
            try { window._newsListener(); } catch (_) {}
            window._newsListener = null;
        }

        window._newsListenerActive = true;
        var initialBatch = true;

        window._newsListener = window.fbDb
            .collection('news_posts')
            .orderBy('createdAt', 'desc')
            .limit(30)
            .onSnapshot(function (snap) {
                if (!snap) return;

                snap.docChanges().forEach(function (change) {
                    var n = change.doc.data();
                    if (!n) return;
                    if (!n.id) n.id = change.doc.id;
                    if (!n.id) return;

                    if (change.type === 'removed') {
                        /* Remove everywhere */
                        window._newsCache = window._newsCache.filter(function (x) { return x.id !== n.id; });
                        var nl2 = document.getElementById('news-list-container');
                        if (nl2) { var r2 = nl2.querySelector('[data-post-id="' + n.id + '"]'); if (r2) r2.remove(); }
                        var s2 = document.getElementById('dashboard-news-slider');
                        if (s2) { var c2 = s2.querySelector('[data-post-id="' + n.id + '"]'); if (c2) c2.remove(); }
                        _syncAdminTable(n, 'remove');
                        _syncEmpty();
                        renderDashboardNews();
                        return;
                    }

                    if (change.type === 'added' || change.type === 'modified') {
                        /* Update cache */
                        var cIdx = window._newsCache.findIndex(function (x) { return x.id === n.id; });
                        if (cIdx === -1) {
                            window._newsCache.unshift(n);
                        } else {
                            window._newsCache[cIdx] = n;
                        }
                        /* Update news section */
                        var nl3 = document.getElementById('news-list-container');
                        if (nl3) {
                            var existing = nl3.querySelector('[data-post-id="' + n.id + '"]');
                            if (existing) {
                                /* Replace element in-place for modified */
                                var fresh = _buildNewsItem(n);
                                nl3.replaceChild(fresh, existing);
                            } else {
                                /* New item: prepend if live, append if initial load */
                                var isNew = n.createdAt && (Date.now() - new Date(n.createdAt).getTime() < 30000);
                                var shouldPrepend = !initialBatch || isNew;
                                _addToNewsList(n, shouldPrepend);
                            }
                        }
                        _syncAdminTable(n, 'add');
                    }
                });

                /* After each Firestore batch, re-render the dashboard strip from cache */
                renderDashboardNews();
                _syncEmpty();

                /* Switch off initial-batch mode */
                initialBatch = false;

            }, function (err) {
                console.error('[News] Firestore listener error:', err && err.code, err && err.message);
                window._newsListener        = null;
                window._newsListenerActive  = false;
                /* Retry with backoff */
                setTimeout(_startNewsListener, 4000);
            });

        console.log('[News] ✅ news_posts listener active (app-news.js)');
    }


    /* ─────────────────────────────────────────────────────────────────────────
       §9  LIVE SEARCH IN #news SECTION
    ───────────────────────────────────────────────────────────────────────── */
    function _wireSearch() {
        var inp = document.getElementById('news-search-input');
        if (!inp || inp._newsSearchWired) return;
        inp._newsSearchWired = true;

        inp.addEventListener('input', function () {
            var q = (inp.value || '').trim().toLowerCase();
            var nl = document.getElementById('news-list-container');
            if (!nl) return;
            nl.querySelectorAll('.news-list-item').forEach(function (el) {
                var text = (el.textContent || '').toLowerCase();
                el.style.display = (!q || text.includes(q)) ? '' : 'none';
            });
        });
    }


    /* ─────────────────────────────────────────────────────────────────────────
       §10  DELETE BUTTON DELEGATION  (handles dynamically created delete links)
    ───────────────────────────────────────────────────────────────────────── */
    function _wireDeleteDelegation() {
        if (window._newsDeleteDelegated) return;
        window._newsDeleteDelegated = true;

        document.addEventListener('click', function (e) {
            var btn = e.target && e.target.closest && e.target.closest('.delete-news-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            var id = btn.dataset.newsId || (btn.closest('[data-post-id]') || {}).dataset.postId || '';
            if (!id) return;
            if (!confirm('Delete this news article? This cannot be undone.')) return;
            deleteNewsPost(id);
        });
    }


    /* ─────────────────────────────────────────────────────────────────────────
       §11  MUTATION OBSERVER — keep strip in sync when other code
            (admin panel, old app-fixes.js) directly injects items into
            #news-list-container.
    ───────────────────────────────────────────────────────────────────────── */
    function _observeNewsList() {
        var nl = document.getElementById('news-list-container');
        if (!nl || nl._newsObserved) return;
        nl._newsObserved = true;

        new MutationObserver(function (muts) {
            var changed = false;
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    var items = [];
                    if (node.classList && node.classList.contains('news-list-item')) items.push(node);
                    node.querySelectorAll && node.querySelectorAll('.news-list-item').forEach(function (n) { items.push(n); });
                    items.forEach(function (item) {
                        var id = item.dataset.postId;
                        if (!id) return;
                        /* If this item is not yet in cache, synthesise a minimal entry */
                        if (!window._newsCache.find(function (x) { return x.id === id; })) {
                            var titleEl = item.querySelector('h4');
                            var imgEl   = item.querySelector('.news-item-image img');
                            var vidEl   = item.querySelector('.news-item-image video');
                            window._newsCache.unshift({
                                id:       id,
                                userId:   item.dataset.userId || '',
                                title:    titleEl ? titleEl.textContent : '',
                                mediaUrl: (imgEl && imgEl.src) || (vidEl && vidEl.src) || '',
                                mediaType:(vidEl ? 'video/mp4' : 'image/jpeg'),
                                createdAt: Date.now()
                            });
                            changed = true;
                        }
                    });
                });
            });
            if (changed) renderDashboardNews();
        }).observe(nl, { childList: true, subtree: false });
    }


    /* ─────────────────────────────────────────────────────────────────────────
       §12  SECTION-CHANGE HOOK  — re-render strip whenever user navigates
            to dashboard (handles edge-case where strip was hidden before
            Firebase fired).
    ───────────────────────────────────────────────────────────────────────── */
    document.addEventListener('empyrean-section-change', function (ev) {
        if (!ev || !ev.detail) return;
        var sec = ev.detail.section;
        if (sec === 'dashboard') {
            setTimeout(renderDashboardNews, 150);
        }
    });
    document.addEventListener('empyrean-init-done', function () {
        setTimeout(renderDashboardNews, 400);
        setTimeout(_wireSearch, 600);
        _observeNewsList();
    });


    /* ─────────────────────────────────────────────────────────────────────────
       §13  STARTUP SEQUENCE
    ───────────────────────────────────────────────────────────────────────── */

    /* ── Fallback / migration read: news_articles ──────────────────────────
       Some articles were historically saved only to `news_articles` (the
       admin "archive" collection), before `news_posts` existed. The live
       listener only watches `news_posts`, so those older articles never
       appeared in the News section or dashboard strip. This does a single
       one-time read of `news_articles`, normalises field names to match the
       `news_posts` shape (content/mediaUrl), and merges any missing entries
       into _newsCache so they render too. New articles already write to both
       collections, so this is purely a backfill for older data. ──────────── */
    function _loadLegacyNewsArticles() {
        if (!_fbOk()) return;
        window.fbDb.collection('news_articles').orderBy('createdAt', 'desc').limit(30).get()
            .then(function (snap) {
                if (!snap || snap.empty) return;
                var added = false;
                snap.forEach(function (doc) {
                    var a = doc.data();
                    if (!a) return;
                    var id = a.id || doc.id;
                    if (window._newsCache.find(function (x) { return x.id === id; })) return;

                    var mediaUrl = a.mediaUrl || a.image || (Array.isArray(a.media) && a.media[0]) || null;
                    var n = {
                        id:        id,
                        title:     a.title || '',
                        content:   a.content || a.body || a.summary || '',
                        mediaUrl:  mediaUrl,
                        mediaType: a.mediaType || null,
                        userId:    a.userId || a.publishedBy || '',
                        username:  a.username || a.writer || 'admin',
                        createdAt: a.createdAt || null,
                        likes:     a.likes || 0,
                        retweets:  a.retweets || 0,
                        commentCount: a.commentCount || 0,
                        views:     a.views || 0
                    };

                    window._newsCache.push(n); /* push — these are older items, keep newest-first order from news_posts on top */
                    _addToNewsList(n, false /* append — these are the older items */);
                    added = true;
                });
                if (added) {
                    /* Re-sort cache newest-first by createdAt */
                    window._newsCache.sort(function (a, b) {
                        var ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        var tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return tb - ta;
                    });
                    renderDashboardNews();
                    _syncEmpty();
                }
            })
            .catch(function (err) {
                console.warn('[News] legacy news_articles read failed:', err && err.message);
            });
    }

    function _init() {
        _wireSearch();
        _wireDeleteDelegation();
        _observeNewsList();

        /* Try to start listener immediately */
        if (_fbOk()) {
            _startNewsListener();
            _loadLegacyNewsArticles();
        } else {
            /* Wait for Firebase to initialise */
            window.addEventListener('empyrean:firebase-ready', function () {
                setTimeout(_startNewsListener, 200);
                setTimeout(_loadLegacyNewsArticles, 600);
                setTimeout(renderDashboardNews, 3000);
            });
            /* Fallback: poll until Firebase is ready */
            var _poll = setInterval(function () {
                if (_fbOk()) {
                    clearInterval(_poll);
                    _startNewsListener();
                    _loadLegacyNewsArticles();
                }
            }, 500);
            /* Give up polling after 30 s — Firebase may never load (offline mode) */
            setTimeout(function () { clearInterval(_poll); }, 30000);
        }

        /* Render whatever is already in the DOM on first load */
        setTimeout(renderDashboardNews, 800);
        setTimeout(renderDashboardNews, 2500);
        /* Extra retries to catch slow Firestore responses */
        setTimeout(renderDashboardNews, 5000);
        setTimeout(renderDashboardNews, 9000);

        /* Safety: if cache is still empty after 6s and Firebase is ready,
           the listener flag may be stuck from a prior failed attempt —
           reset and retry once. */
        setTimeout(function () {
            if ((window._newsCache || []).length === 0 && _fbOk()) {
                window._newsListenerActive = false;
                _startNewsListener();
                _loadLegacyNewsArticles();
            }
        }, 6000);
    }

    _ready(_init);

    console.log('[News] app-news.js loaded — standalone News Media module v1.0');

})();