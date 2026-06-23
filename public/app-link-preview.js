/* ═══════════════════════════════════════════════════════════════════
   EMPYREAN — LINK PREVIEW PATCH  (v2.0)
   ─────────────────────────────────────────────────────────────────
   Features:
   1. URL auto-linkification in post text (formatWhatsAppText patch)
   2. Empyrean internal links → fetch post from Firestore → rich card
      (handles ?post=ID, #post/ID, #post/crisis, #post/sos patterns)
   3. External links → OGP preview card via allorigins proxy
   4. MutationObserver watches chat container for new messages
   ═══════════════════════════════════════════════════════════════════ */

(function empyreanLinkPreview() {
    'use strict';

    if (window._empLinkPreviewLoaded) return;
    window._empLinkPreviewLoaded = true;

    /* ── URL regex ─────────────────────────────────────────────────── */
    var URL_RE = /(https?:\/\/[^\s<>"']{4,})/gi;

    /* ── HTML escape ────────────────────────────────────────────────── */
    function _esc(s) {
        return String(s || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /* ── Extract domain ─────────────────────────────────────────────── */
    function _domain(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); }
        catch(e) { return ''; }
    }

    /* ── Is this an internal Empyrean URL? ──────────────────────────── */
    function _parseEmpyreanUrl(url) {
        /* Matches patterns like:
           ?post=post-1780644841148-5012
           ?post=crisis-1780172173329
           ?post=sos-...
           #post/crisis   (with data-post-id on a card)
           #post/1780...
        */
        try {
            var parsed = new URL(url);
            /* Query param style: ?post=<id> */
            var postParam = parsed.searchParams.get('post');
            if (postParam) return _classifyId(postParam);
            /* Hash style: #post/crisis or #post/<id> */
            var hash = parsed.hash || '';
            var hashMatch = hash.match(/^#post\/(.+)$/);
            if (hashMatch) return _classifyId(hashMatch[1]);
            /* Fragment in path (localhost dev URLs) */
            var pathMatch = url.match(/[#?]post[=/]([^&\s]+)/);
            if (pathMatch) return _classifyId(pathMatch[1]);
        } catch(e) {}
        return null;
    }

    function _classifyId(id) {
        if (!id) return null;
        if (id.startsWith('crisis')) return { collection: 'crisis_reports', id: id };
        if (id.startsWith('sos'))    return { collection: 'sos_queue',       id: id };
        return { collection: 'posts', id: id };
    }


    /* ═══════════════════════════════════════════════════════════════
       §1  CSS
    ═══════════════════════════════════════════════════════════════ */
    (function _css() {
        if (document.getElementById('_elp_css')) return;
        var s = document.createElement('style');
        s.id = '_elp_css';
        s.textContent = [
            /* Clickable highlighted links */
            'a.elp-link{',
            '  color:#1B2B8B;font-weight:600;',
            '  text-decoration:underline;text-decoration-color:rgba(27,43,139,.35);',
            '  word-break:break-all;cursor:pointer;transition:color .15s;',
            '}',
            'a.elp-link:hover{ color:#0d1f7a; }',
            '[data-elp-sent="1"] a.elp-link{ color:#cce0ff;text-decoration-color:rgba(204,224,255,.5); }',
            '[data-elp-sent="1"] a.elp-link:hover{ color:#fff; }',

            /* Preview card */
            '.elp-card{',
            '  display:flex;flex-direction:column;',
            '  border-radius:14px;overflow:hidden;',
            '  border:1px solid rgba(27,43,139,.18);',
            '  background:#f8f9ff;margin-top:10px;',
            '  max-width:320px;cursor:pointer;',
            '  box-shadow:0 2px 12px rgba(27,43,139,.12);',
            '  text-decoration:none;',
            '  transition:box-shadow .18s,transform .18s;',
            '}',
            '.elp-card:hover{ box-shadow:0 6px 22px rgba(27,43,139,.2);transform:translateY(-2px); }',
            '.elp-card-img{',
            '  width:100%;max-height:170px;object-fit:cover;display:block;',
            '  background:linear-gradient(135deg,#e8eaf6,#c5cae9);',
            '}',
            '.elp-card-body{ padding:10px 13px 12px; }',
            '.elp-card-domain{',
            '  font-size:.68rem;color:#1B2B8B;font-weight:700;',
            '  letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px;',
            '  display:flex;align-items:center;gap:5px;',
            '}',
            '.elp-card-domain-dot{',
            '  width:6px;height:6px;border-radius:50%;',
            '  background:#1B2B8B;flex-shrink:0;',
            '}',
            '.elp-card-title{',
            '  font-size:.88rem;font-weight:700;color:#0A0E27;',
            '  margin:0 0 4px;line-height:1.35;',
            '  display:-webkit-box;-webkit-line-clamp:2;',
            '  -webkit-box-orient:vertical;overflow:hidden;',
            '}',
            '.elp-card-desc{',
            '  font-size:.76rem;color:#374151;line-height:1.45;',
            '  display:-webkit-box;-webkit-line-clamp:3;',
            '  -webkit-box-orient:vertical;overflow:hidden;',
            '}',

            /* Loading state */
            '.elp-loading{',
            '  display:flex;align-items:center;gap:9px;',
            '  padding:11px 13px;font-size:.78rem;color:#6B7280;',
            '  border-radius:12px;border:1px solid rgba(27,43,139,.13);',
            '  background:#f8f9ff;margin-top:8px;max-width:320px;',
            '}',
            '.elp-spinner{',
            '  width:15px;height:15px;border-radius:50%;flex-shrink:0;',
            '  border:2px solid #e5e7eb;border-top-color:#1B2B8B;',
            '  animation:elpSpin .7s linear infinite;',
            '}',
            '@keyframes elpSpin{ to{ transform:rotate(360deg); } }',

            /* Sent bubble dark variants */
            '[data-elp-sent="1"] .elp-card{ background:rgba(255,255,255,.13);border-color:rgba(255,255,255,.24); }',
            '[data-elp-sent="1"] .elp-card-domain{ color:#93c5fd; }',
            '[data-elp-sent="1"] .elp-card-domain-dot{ background:#93c5fd; }',
            '[data-elp-sent="1"] .elp-card-title{ color:#fff; }',
            '[data-elp-sent="1"] .elp-card-desc{ color:rgba(255,255,255,.8); }',
            '[data-elp-sent="1"] .elp-loading{ background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.7); }',
        ].join('\n');
        document.head.appendChild(s);
    })();


    /* ═══════════════════════════════════════════════════════════════
       §2  Linkify raw text → HTML with <a> tags
    ═══════════════════════════════════════════════════════════════ */
    function _linkify(html) {
        return html.replace(URL_RE, function(url) {
            return '<a class="elp-link" href="' + _esc(url)
                + '" target="_blank" rel="noopener noreferrer">' + _esc(url) + '</a>';
        });
    }


    /* ═══════════════════════════════════════════════════════════════
       §3  Patch formatWhatsAppText → linkify post body text
    ═══════════════════════════════════════════════════════════════ */
    function _patchFormat() {
        var orig = window.formatWhatsAppText;
        if (typeof orig !== 'function' || orig._elpPatched) return;
        window.formatWhatsAppText = function(t) {
            return _linkify(orig.apply(this, arguments));
        };
        window.formatWhatsAppText._elpPatched = true;
    }
    _patchFormat();
    window.addEventListener('empyrean:firebase-ready', function(){ setTimeout(_patchFormat, 200); });
    document.addEventListener('empyrean-init-done',    function(){ setTimeout(_patchFormat, 300); });


    /* ═══════════════════════════════════════════════════════════════
       §4  Fetch preview data — Empyrean post (Firestore) or OGP
    ═══════════════════════════════════════════════════════════════ */
    var _cache = {};

    /* Internal: fetch from Firestore */
    function _fetchInternal(info) {
        var key = info.collection + '/' + info.id;
        if (_cache[key]) return _cache[key];
        _cache[key] = new Promise(function(resolve) {
            /* Wait for Firebase to be ready */
            function _attempt(tries) {
                if (!window.fbDb || !window._firebaseLoaded) {
                    if (tries < 15) { setTimeout(function(){ _attempt(tries+1); }, 400); }
                    else { resolve(null); }
                    return;
                }
                window.fbDb.collection(info.collection).doc(info.id).get()
                    .then(function(snap) {
                        if (!snap || !snap.exists) { resolve(null); return; }
                        var d = snap.data();
                        /* Normalise across posts / crisis / sos */
                        var title  = d.text || d.story || d.description || d.title || '';
                        var author = d.author || d.username || d.authorName || d.reportedBy || 'Empyrean';
                        var media  = d.mediaFiles || d.media || d.mediaUrls || [];
                        var img    = '';
                        if (Array.isArray(media) && media.length) {
                            var first = media[0];
                            img = (typeof first === 'string') ? first
                                : (first._cloudUrl || first.url || '');
                            /* Skip video URLs for thumbnail */
                            if (/\.(mp4|webm|mov|avi|mkv)/i.test(img)) img = '';
                        }
                        if (!img && d.avatar)       img = d.avatar;
                        if (!img && d.coverPhoto)   img = d.coverPhoto;
                        resolve({
                            type:   'internal',
                            title:  (author ? '@' + author + ': ' : '') + title.slice(0, 140),
                            desc:   d.type || d.crisisType || d.category || '',
                            image:  img,
                            domain: 'Empyrean',
                            label:  info.collection === 'crisis_reports' ? '🚨 Crisis Report'
                                  : info.collection === 'sos_queue'       ? '🆘 SOS Alert'
                                  : '📣 Post',
                        });
                    })
                    .catch(function(){ resolve(null); });
            }
            _attempt(0);
        });
        return _cache[key];
    }

    /* External: OGP via allorigins */
    function _fetchExternal(url) {
        if (_cache[url]) return _cache[url];
        _cache[url] = fetch(
            'https://api.allorigins.win/get?url=' + encodeURIComponent(url),
            { cache: 'force-cache', signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }
        )
        .then(function(r){ return r.json(); })
        .then(function(d){
            var html = d.contents || '';
            var get = function(prop) {
                var m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]+content=["\']([^"\']*)["\']','i'))
                     || html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + prop + '["\']','i'));
                return m ? m[1].trim() : '';
            };
            var title = get('og:title') || get('twitter:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)||[])[1] || '';
            var desc  = get('og:description') || get('twitter:description') || get('description') || '';
            var image = get('og:image') || get('twitter:image') || '';
            if (!title && !image) return null;
            return { type:'external', title:title.slice(0,120), desc:desc.slice(0,180), image:image, domain:_domain(url), label:_domain(url) };
        })
        .catch(function(){ return null; });
        return _cache[url];
    }

    function _fetchPreview(url) {
        var info = _parseEmpyreanUrl(url);
        return info ? _fetchInternal(info) : _fetchExternal(url);
    }


    /* ═══════════════════════════════════════════════════════════════
       §5  Build preview card DOM element
    ═══════════════════════════════════════════════════════════════ */
    function _buildCard(meta, url) {
        if (!meta) return null;
        var a = document.createElement('a');
        a.className = 'elp-card';
        a.href      = url;
        a.target    = '_blank';
        a.rel       = 'noopener noreferrer';
        a.addEventListener('click', function(e){ e.stopPropagation(); });
        a.innerHTML =
            (meta.image
                ? '<img class="elp-card-img" src="' + _esc(meta.image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
                : '') +
            '<div class="elp-card-body">' +
            '<div class="elp-card-domain"><span class="elp-card-domain-dot"></span>' + _esc(meta.label || meta.domain) + '</div>' +
            (meta.title ? '<div class="elp-card-title">' + _esc(meta.title) + '</div>' : '') +
            (meta.desc  ? '<div class="elp-card-desc">'  + _esc(meta.desc)  + '</div>' : '') +
            '</div>';
        return a;
    }


    /* ═══════════════════════════════════════════════════════════════
       §6  Process a single chat message row element
    ═══════════════════════════════════════════════════════════════ */
    function _processRow(row) {
        if (row._elpDone) return;
        row._elpDone = true;

        /* Detect sent vs received */
        var isSent = row.style.justifyContent === 'flex-end'
                  || row.classList.contains('sent')
                  || row.classList.contains('outgoing')
                  || !!(row.querySelector('[style*="1B2B8B"]'));
        if (isSent) row.setAttribute('data-elp-sent','1');

        /* Find the inner text container (the bubble div) */
        var bubble = row.querySelector('[style*="border-radius"],[class*="bubble"],[class*="message-text"]')
                  || row.querySelector('div');
        if (!bubble) return;

        var raw = bubble.innerHTML || '';
        URL_RE.lastIndex = 0;
        if (!URL_RE.test(raw)) { URL_RE.lastIndex = 0; return; }
        URL_RE.lastIndex = 0;

        /* Linkify */
        bubble.innerHTML = _linkify(raw);
        bubble.querySelectorAll('a.elp-link').forEach(function(a){
            a.addEventListener('click', function(e){ e.stopPropagation(); });
        });

        /* Extract first URL → preview card */
        var urls = raw.match(URL_RE) || [];
        URL_RE.lastIndex = 0;
        if (!urls.length) return;
        var firstUrl = urls[0];

        /* Loading placeholder */
        var loader = document.createElement('div');
        loader.className = 'elp-loading';
        loader.innerHTML = '<div class="elp-spinner"></div><span>Loading preview…</span>';
        row.appendChild(loader);

        _fetchPreview(firstUrl).then(function(meta) {
            loader.remove();
            var card = _buildCard(meta, firstUrl);
            if (card) row.appendChild(card);
        });
    }


    /* ═══════════════════════════════════════════════════════════════
       §7  Scan chat container + MutationObserver
    ═══════════════════════════════════════════════════════════════ */
    var _mo = null;

    function _getContainer() {
        return document.getElementById('chat-messages-container')
            || document.getElementById('messages-list')
            || document.querySelector('#chat-view-container .messages-list,.chat-messages,.vf-chat-messages');
    }

    function _scan(root) {
        var rows = (root || document).querySelectorAll(
            '[style*="justify-content"],[class*="message-row"],[class*="msg-row"],[class*="chat-msg"]'
        );
        rows.forEach(function(r){
            URL_RE.lastIndex = 0;
            if (URL_RE.test(r.textContent)) { URL_RE.lastIndex = 0; _processRow(r); }
            URL_RE.lastIndex = 0;
        });
    }

    function _attach() {
        var c = _getContainer();
        if (!c) return;
        if (_mo) _mo.disconnect();
        _mo = new MutationObserver(function(muts){
            muts.forEach(function(m){
                m.addedNodes.forEach(function(n){
                    if (n.nodeType !== 1) return;
                    URL_RE.lastIndex = 0;
                    if (URL_RE.test(n.textContent)) { URL_RE.lastIndex = 0; _processRow(n); }
                    URL_RE.lastIndex = 0;
                    _scan(n);
                });
            });
        });
        _mo.observe(c, { childList:true, subtree:true });
        _scan(c);
    }

    /* Watch for the chat container to appear in the DOM */
    new MutationObserver(function(){ _attach(); })
        .observe(document.body || document.documentElement, { childList:true, subtree:true });

    /* Section-change hook */
    document.addEventListener('empyrean-section-change', function(ev){
        if (ev && ev.detail && ev.detail.section === 'messages') setTimeout(_attach, 380);
    });

    /* Init hooks */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){ setTimeout(_attach, 500); });
    } else {
        setTimeout(_attach, 500);
    }
    document.addEventListener('empyrean-init-done', function(){ setTimeout(_attach, 650); });


    /* ═══════════════════════════════════════════════════════════════
       §8  Retroactively linkify post text already in the DOM
    ═══════════════════════════════════════════════════════════════ */
    function _linkifyPosts() {
        document.querySelectorAll('.story-content p, .post-text p').forEach(function(p){
            if (p._elpDone) return;
            p._elpDone = true;
            URL_RE.lastIndex = 0;
            if (!URL_RE.test(p.innerHTML)) { URL_RE.lastIndex = 0; return; }
            URL_RE.lastIndex = 0;
            p.innerHTML = _linkify(p.innerHTML);
            p.querySelectorAll('a.elp-link').forEach(function(a){
                a.addEventListener('click', function(e){ e.stopPropagation(); });
            });
        });
    }
    document.addEventListener('empyrean-init-done', function(){ setTimeout(_linkifyPosts, 900); });

    console.log('[ELP v2] Link preview — Empyrean internal + external OGP active.');

})();