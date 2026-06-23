/* =============================================================================
   EMPYREAN INTERNATIONAL — DIRECT MESSAGES / CHAT
   app-chat.js  |  Step 0.12a  |  Refactor Roadmap v1.0
   =============================================================================

   PURPOSE
   ───────
   Complete messaging system extracted from app-fixes.js.  Covers:

     • createMessageElement(text, isSent, isFile, fileUrl, fileType, messageId)
     • renderContactList()        — contact list with unread badges, last preview
     • openChat(userId)           — open thread, load history, Firestore listener
     • Message form submit        — localStorage + Firestore dual persistence
     • Mobile back button         — responsive contact ↔ chat panel switching
     • Contact search filter      — live filter by name
     • Firestore real-time sync   — incoming message listener per conversation
     • Media attachments          — image / video / audio / file send

   LOAD ORDER
   ──────────
   Must come AFTER: firebase-init, app-state, app-helpers, app-notifications,
   app-auth.

   DEPENDS ON
   ──────────
   • window.EmpState / window.userState / window.mockUsers
   • window.isGuest / window._firebaseLoaded / window.fbDb
   • window._timeAgo          (app-helpers.js)
   • window.formatWhatsAppText (app-helpers.js)
   • window.showNotification   (app-helpers.js)
   • window.pushNotification   (app-notifications.js)
   • window.uploadToCloudinary (app-dom.js — for media attachments)

   PUBLIC API
   ──────────
   window.createMessageElement(text, isSent, isFile?, fileUrl?, fileType?, msgId?)
   window.renderContactList()
   window.openChat(userId)

   SECTION MAP
   ───────────
   §1  createMessageElement — message bubble builder
   §2  renderContactList    — contact list with badges + search
   §3  openChat             — conversation view, history load, Firestore listener
   §4  Message send handler — submit form, localStorage, Firestore write
   §5  Media attachment     — file input + Cloudinary upload
   §6  Firestore real-time  — incoming message onSnapshot per thread
   §7  Event delegation     — contact click, mobile back, message input
   §8  Bootstrap

   ============================================================================= */

(function empyreanChatModule() {
    'use strict';

    if (window._empyreanChatLoaded) {
        console.warn('[EmpChat] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanChatLoaded = true;

    /* ── State accessors ── */
    function _S()       { return window.EmpState || {}; }
    function _us()      { return _S().userState  || window.userState || {}; }
    function _mu()      { return (_S().mockUsers) || window.mockUsers || {}; }
    function _isGuest() { var s = _S(); return s.isGuest != null ? s.isGuest : !!window.isGuest; }

    /** Active Firestore message listener handle (unsubscribe fn) */
    var _activeMsgListener = null;

    function _esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* =========================================================================
       §1  createMessageElement
       Builds a single message bubble div for the chat view.
       Supports plain text, images, videos, audio, and generic files.
       ========================================================================= */

    function createMessageElement(text, isSent, isFile, fileUrl, fileType, messageId) {
        isFile    = isFile    || false;
        fileUrl   = fileUrl   || '';
        fileType  = fileType  || '';
        messageId = messageId || ('msg-' + Date.now());

        var el = document.createElement('div');
        el.className        = 'message ' + (isSent ? 'sent' : 'received');
        el.dataset.messageId = messageId;
        el.style.cssText    =
            'max-width:72%;padding:10px 14px;'
            + 'border-radius:' + (isSent ? '18px 18px 4px 18px' : '18px 18px 18px 4px') + ';'
            + 'background:' + (isSent ? 'var(--secondary,#1B2B8B)' : 'white') + ';'
            + 'color:' + (isSent ? 'white' : 'var(--primary)') + ';'
            + 'font-size:0.88rem;line-height:1.45;'
            + 'align-self:' + (isSent ? 'flex-end' : 'flex-start') + ';'
            + 'box-shadow:0 1px 4px rgba(10,14,39,0.08);word-break:break-word;margin-bottom:4px;';

        var contentHTML;
        if (isFile && fileUrl) {
            if (fileType.startsWith('image/')) {
                contentHTML = (text ? '<p>' + _esc(text) + '</p>' : '')
                    + '<img src="' + _esc(fileUrl) + '" class="message-media" alt="Sent image" '
                    + 'style="max-width:100%;border-radius:8px;margin-top:6px;display:block;">';
            } else if (fileType.startsWith('video/')) {
                contentHTML = (text ? '<p>' + _esc(text) + '</p>' : '')
                    + '<video src="' + _esc(fileUrl) + '" class="message-media" controls '
                    + 'style="max-width:100%;border-radius:8px;margin-top:6px;display:block;"></video>';
            } else if (fileType.startsWith('audio/')) {
                contentHTML = (text ? '<p>' + _esc(text) + '</p>' : '')
                    + '<audio src="' + _esc(fileUrl) + '" class="message-media" controls '
                    + 'style="width:100%;margin-top:6px;"></audio>';
            } else {
                contentHTML = '<p><i class="fas fa-file-alt"></i> '
                    + 'Sent a file: <a href="' + _esc(fileUrl) + '" target="_blank" '
                    + 'rel="noopener" style="color:inherit;text-decoration:underline;">'
                    + _esc(text || 'Download') + '</a></p>';
            }
        } else {
            contentHTML = typeof window.formatWhatsAppText === 'function'
                ? window.formatWhatsAppText(text)
                : '<p>' + _esc(text) + '</p>';
        }

        el.innerHTML = contentHTML;
        return el;
    }
    window.createMessageElement = createMessageElement;


    /* =========================================================================
       §2  renderContactList
       Builds the contact list from followedUserIds + mockUsers.
       Shows unread badge, last message preview, and timestamp.
       ========================================================================= */

    function renderContactList() {
        if (_isGuest()) return;

        var container = document.getElementById('contacts-inner')
            || document.getElementById('contact-list-container');
        if (!container) return;

        container.innerHTML = '';

        var us      = _us();
        var mu      = _mu();
        var allUids = new Set(us.followedUserIds instanceof Set
            ? us.followedUserIds : (Array.isArray(us.followedUserIds) ? us.followedUserIds : []));
        Object.values(mu).forEach(function (u) { if (u.id !== us.id) allUids.add(u.id); });

        /* Load localStorage message threads */
        var msgStore = {};
        try { msgStore = JSON.parse(localStorage.getItem('empyrean_msgs') || '{}'); } catch (e) {}

        var count = 0;
        allUids.forEach(function (uid) {
            var u = mu[uid];
            if (!u || u.id === us.id) return;
            count++;

            var thread    = msgStore[uid] || [];
            var lastMsg   = thread.length ? thread[thread.length - 1] : null;
            var lastText  = lastMsg
                ? (lastMsg.text.length > 38 ? lastMsg.text.slice(0, 38) + '…' : lastMsg.text)
                : 'Tap to start a conversation';
            var unreadCnt = thread.filter(function (m) { return m.from !== us.id && !m.read; }).length;
            var timeStr   = (lastMsg && typeof window._timeAgo === 'function')
                ? window._timeAgo(lastMsg.ts) : '';

            var fallbackAv = 'https://ui-avatars.com/api/?name='
                + encodeURIComponent(u.fullName || 'U') + '&background=1B2B8B&color=fff&size=96';
            var avatar = u.avatar || fallbackAv;

            var el = document.createElement('div');
            el.className = 'contact-item';
            el.dataset.userId = uid;
            el.style.cssText =
                'display:flex;align-items:center;gap:12px;padding:13px 16px;'
                + 'border-bottom:1px solid rgba(10,14,39,0.05);cursor:pointer;transition:background 0.15s;';

            el.innerHTML =
                '<div style="position:relative;flex-shrink:0;">'
                + '<img src="' + _esc(avatar) + '" data-fb="' + _esc(fallbackAv) + '"'
                + ' style="width:48px;height:48px;border-radius:50%;object-fit:cover;'
                + 'border:2px solid rgba(27,43,139,0.12);"'
                + ' onerror="this.onerror=null;this.src=this.dataset.fb;">'
                + '<div class="online-dot" style="position:absolute;bottom:2px;right:2px;width:10px;'
                + 'height:10px;border-radius:50%;background:#9CA3AF;border:2px solid white;"></div>'
                + (unreadCnt > 0
                    ? '<span style="position:absolute;top:-1px;right:-1px;background:#EF4444;color:white;'
                    + 'font-size:0.6rem;font-weight:700;min-width:16px;height:16px;border-radius:50%;'
                    + 'display:flex;align-items:center;justify-content:center;border:1.5px solid white;'
                    + 'padding:0 2px;">' + (unreadCnt > 9 ? '9+' : unreadCnt) + '</span>'
                    : '')
                + '</div>'
                + '<div style="flex:1;min-width:0;">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">'
                + '<strong style="font-size:0.92rem;color:var(--primary);white-space:nowrap;'
                + 'overflow:hidden;text-overflow:ellipsis;max-width:160px;">' + _esc(u.fullName || '') + '</strong>'
                + (timeStr
                    ? '<span style="font-size:0.7rem;color:var(--text-muted);flex-shrink:0;margin-left:6px;">'
                    + _esc(timeStr) + '</span>'
                    : '')
                + '</div>'
                + '<p style="font-size:0.79rem;color:'
                + (unreadCnt > 0 ? 'var(--secondary)' : 'var(--text-muted)') + ';'
                + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;'
                + 'font-weight:' + (unreadCnt > 0 ? '600' : '400') + ';">'
                + _esc(lastText) + '</p>'
                + '</div>';

            container.appendChild(el);
        });

        if (count === 0) {
            container.innerHTML =
                '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);">'
                + '<i class="fas fa-users" style="font-size:2.2rem;display:block;margin-bottom:14px;opacity:0.35;"></i>'
                + '<p style="font-size:0.9rem;line-height:1.5;">No contacts yet.<br>'
                + 'Follow users to message them.</p></div>';
        }

        /* Live search filter */
        var searchInput = document.getElementById('contacts-search');
        if (searchInput) {
            if (searchInput._chatFilter) searchInput.removeEventListener('input', searchInput._chatFilter);
            searchInput._chatFilter = function () {
                var q = searchInput.value.toLowerCase().trim();
                container.querySelectorAll('.contact-item').forEach(function (item) {
                    var name = ((item.querySelector('strong') || {}).textContent || '').toLowerCase();
                    item.style.display = (!q || name.includes(q)) ? '' : 'none';
                });
            };
            searchInput.addEventListener('input', searchInput._chatFilter);
            var searchBtn = searchInput.parentElement
                && searchInput.parentElement.querySelector('button');
            if (searchBtn) {
                searchBtn.onclick = function (e) {
                    e.preventDefault();
                    searchInput._chatFilter();
                    searchInput.focus();
                };
            }
        }
    }
    window.renderContactList = renderContactList;


    /* =========================================================================
       §3  openChat
       Opens the conversation view for a user. Loads localStorage history,
       starts a Firestore real-time listener for the thread.
       ========================================================================= */

    function openChat(userId) {
        if (_isGuest()) {
            if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
            return;
        }

        var mu   = _mu();
        var us   = _us();
        var user = mu[userId];
        if (!user) { console.warn('[Chat] User not found:', userId); return; }

        /* ── Highlight active contact ── */
        document.querySelectorAll('.contact-item').forEach(function (c) {
            c.classList.remove('active');
            c.style.background = '';
        });
        var activeItem = document.querySelector('.contact-item[data-user-id="' + userId + '"]');
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.style.background = 'rgba(27,43,139,0.05)';
        }

        /* ── Show chat panel, hide placeholder ── */
        var chatView    = document.getElementById('chat-view-container');
        var placeholder = document.getElementById('chat-placeholder');
        var contactList = document.querySelector('.contact-list');
        if (chatView) {
            chatView.style.display = 'flex';
            chatView.classList.add('active');
            if (window.innerWidth <= 700) {
                chatView.classList.add('mobile-active');
                if (contactList) contactList.style.display = 'none';
            }
        }
        if (placeholder) placeholder.style.display = 'none';

        /* ── Chat header ── */
        var chatHeader = document.getElementById('chat-header-info');
        if (chatHeader) {
            var userAv  = (user.avatar || '').replace(/'/g, '%27');
            var userFb  = 'https://ui-avatars.com/api/?name='
                + encodeURIComponent(user.fullName || 'U') + '&background=1B2B8B&color=fff';
            var backBtn = window.innerWidth <= 700
                ? '<button id="chat-back-btn" style="background:none;border:none;font-size:1.1rem;'
                + 'cursor:pointer;color:var(--secondary);padding:4px 8px 4px 0;">'
                + '<i class="fas fa-arrow-left"></i></button>'
                : '';

            chatHeader.innerHTML =
                '<div style="display:flex;align-items:center;gap:10px;flex:1;">'
                + backBtn
                + '<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;">'
                + '<img src="' + _esc(userAv) + '" alt="' + _esc(user.fullName || '') + '" '
                + 'style="width:100%;height:100%;object-fit:cover;" '
                + 'onerror="this.onerror=null;this.src=\'' + userFb + '\'"></div>'
                + '<div><strong style="display:block;color:var(--primary);">' + _esc(user.fullName || '') + '</strong>'
                + '<span style="font-size:0.78rem;color:var(--text-muted);">@' + _esc(user.username || '') + '</span>'
                + '</div></div>';

            /* Mobile back button handler */
            var backBtnEl = document.getElementById('chat-back-btn');
            if (backBtnEl) {
                backBtnEl.onclick = function () {
                    if (chatView) { chatView.style.display = 'none'; chatView.classList.remove('active', 'mobile-active'); }
                    if (contactList) contactList.style.display = '';
                    if (placeholder) placeholder.style.display = '';
                    document.querySelectorAll('.contact-item').forEach(function (c) {
                        c.classList.remove('active'); c.style.background = '';
                    });
                    /* Detach Firestore listener */
                    if (_activeMsgListener) {
                        try { _activeMsgListener(); } catch (e) {}
                        _activeMsgListener = null;
                    }
                };
            }
        }

        /* ── Render existing thread from localStorage ── */
        var msgsContainer = document.getElementById('chat-messages-container');
        if (!msgsContainer) return;
        msgsContainer.dataset.activeChat = userId;
        msgsContainer.style.cssText =
            'display:flex;flex-direction:column;gap:8px;padding:16px;overflow-y:auto;flex:1;';
        msgsContainer.innerHTML = '';

        var msgStore = {};
        try { msgStore = JSON.parse(localStorage.getItem('empyrean_msgs') || '{}'); } catch (e) {}
        var thread = msgStore[userId] || [];

        if (thread.length === 0) {
            msgsContainer.innerHTML =
                '<div id="chat-empty-hint" style="text-align:center;padding:48px 20px;color:var(--text-muted);">'
                + '<i class="fas fa-comments" style="font-size:2.2rem;display:block;margin-bottom:14px;opacity:0.3;"></i>'
                + '<p style="font-size:0.88rem;">No messages yet. Say hello! 👋</p></div>';
        } else {
            thread.forEach(function (msg) {
                var isSent = msg.from === us.id;
                if (msg.fileUrl) {
                    msgsContainer.appendChild(
                        createMessageElement(msg.text || '', isSent, true, msg.fileUrl, msg.fileType || '', msg.id)
                    );
                } else {
                    var bubble = document.createElement('div');
                    bubble.style.cssText =
                        'max-width:72%;padding:10px 14px;'
                        + 'border-radius:' + (isSent ? '18px 18px 4px 18px' : '18px 18px 18px 4px') + ';'
                        + 'background:' + (isSent ? 'var(--secondary,#1B2B8B)' : 'white') + ';'
                        + 'color:' + (isSent ? 'white' : 'var(--primary)') + ';'
                        + 'font-size:0.88rem;line-height:1.45;'
                        + 'align-self:' + (isSent ? 'flex-end' : 'flex-start') + ';'
                        + 'box-shadow:0 1px 4px rgba(10,14,39,0.08);word-break:break-word;margin-bottom:4px;';
                    bubble.textContent = msg.text || '';
                    msgsContainer.appendChild(bubble);
                }
                /* Mark as read */
                if (!isSent) msg.read = true;
            });
            /* Persist read status */
            if (thread.some(function (m) { return !m.read && m.from !== us.id; })) {
                try {
                    var ms2 = JSON.parse(localStorage.getItem('empyrean_msgs') || '{}');
                    if (ms2[userId]) ms2[userId].forEach(function (m) { if (m.from !== us.id) m.read = true; });
                    localStorage.setItem('empyrean_msgs', JSON.stringify(ms2));
                } catch (e) {}
            }
        }
        msgsContainer.scrollTop = msgsContainer.scrollHeight;

        /* ── Start Firestore real-time listener for this thread ── */
        _attachFirestoreListener(userId, msgsContainer);
    }
    window.openChat = openChat;


    /* =========================================================================
       §4  MESSAGE SEND HANDLER
       Wired on first openChat call via form submit event on #message-form.
       Writes to localStorage immediately, then fires Firestore in background.
       ========================================================================= */

    var _formWired = false;

    function _wireMessageForm() {
        if (_formWired) return;
        var form  = document.getElementById('message-form');
        var input = document.getElementById('message-text-input');
        if (!form) return;
        _formWired = true;

        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var text  = input ? input.value.trim() : '';
            var msgsC = document.getElementById('chat-messages-container');
            if (!text || !msgsC) return;
            var auid  = msgsC.dataset.activeChat;
            if (!auid) return;
            var us    = _us();

            /* Clear empty-state hint */
            var hint = document.getElementById('chat-empty-hint');
            if (hint) hint.remove();

            /* Render sent bubble immediately */
            var bubble = document.createElement('div');
            bubble.style.cssText =
                'max-width:72%;padding:10px 14px;border-radius:18px 18px 4px 18px;'
                + 'background:var(--secondary,#1B2B8B);color:white;font-size:0.88rem;'
                + 'line-height:1.45;align-self:flex-end;box-shadow:0 1px 4px rgba(10,14,39,0.08);'
                + 'word-break:break-word;margin-bottom:4px;';
            bubble.textContent = text;
            msgsC.appendChild(bubble);
            msgsC.scrollTop = msgsC.scrollHeight;
            if (input) input.value = '';

            /* Persist to localStorage */
            try {
                var ms = JSON.parse(localStorage.getItem('empyrean_msgs') || '{}');
                if (!ms[auid]) ms[auid] = [];
                ms[auid].push({ from: us.id, text: text, ts: Date.now(), read: true });
                localStorage.setItem('empyrean_msgs', JSON.stringify(ms));
            } catch (e) {}

            /* Persist to Firestore (background) */
            try {
                if (window.fbDb && window._firebaseLoaded && us.id) {
                    var tid = [us.id, auid].sort().join('_');
                    window.fbDb.collection('messages').doc(tid).collection('msgs').add({
                        from:     us.id,
                        to:       auid,
                        text:     text,
                        ts:       new Date().toISOString(),
                        fileUrl:  '',
                        fileType: '',
                        read:     false
                    }).catch(function () {});
                }
            } catch (e) {}

            /* Refresh contact list to update last message */
            setTimeout(renderContactList, 300);
        });
    }


    /* =========================================================================
       §5  MEDIA ATTACHMENT
       Handles file selection and Cloudinary upload for in-chat media.
       ========================================================================= */

    document.addEventListener('change', function (e) {
        var fileInput = e.target;
        if (!fileInput || fileInput.id !== 'chat-media-input') return;
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;

        var msgsC = document.getElementById('chat-messages-container');
        var us    = _us();
        var auid  = msgsC && msgsC.dataset.activeChat;
        if (!msgsC || !auid) return;

        /* Show uploading indicator */
        var hint = document.createElement('div');
        hint.style.cssText = 'align-self:flex-end;font-size:0.8rem;color:var(--text-muted);padding:6px 10px;';
        hint.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Uploading…';
        msgsC.appendChild(hint);
        msgsC.scrollTop = msgsC.scrollHeight;

        /* Upload to Cloudinary */
        var doUpload = typeof window.uploadToCloudinary === 'function'
            ? window.uploadToCloudinary(file, null)
            : Promise.reject(new Error('uploadToCloudinary not available'));

        doUpload.then(function (url) {
            hint.remove();
            if (!url) return;
            /* Render media bubble */
            var msgEl = createMessageElement(file.name, true, true, url, file.type, 'msg-' + Date.now());
            msgsC.appendChild(msgEl);
            msgsC.scrollTop = msgsC.scrollHeight;

            /* Persist */
            try {
                var ms = JSON.parse(localStorage.getItem('empyrean_msgs') || '{}');
                if (!ms[auid]) ms[auid] = [];
                ms[auid].push({ from: us.id, text: file.name, ts: Date.now(), read: true, fileUrl: url, fileType: file.type });
                localStorage.setItem('empyrean_msgs', JSON.stringify(ms));
            } catch (e) {}

            try {
                if (window.fbDb && window._firebaseLoaded && us.id) {
                    var tid = [us.id, auid].sort().join('_');
                    window.fbDb.collection('messages').doc(tid).collection('msgs').add({
                        from: us.id, to: auid, text: file.name,
                        fileUrl: url, fileType: file.type,
                        ts: new Date().toISOString(), read: false
                    }).catch(function () {});
                }
            } catch (e) {}
        }).catch(function () {
            hint.textContent = 'Upload failed.';
            setTimeout(function () { hint.remove(); }, 2000);
        });

        fileInput.value = '';
    });


    /* =========================================================================
       §6  FIRESTORE REAL-TIME INCOMING MESSAGE LISTENER
       ========================================================================= */

    function _attachFirestoreListener(recipientId, msgsContainer) {
        /* Detach any existing listener */
        if (_activeMsgListener) {
            try { _activeMsgListener(); } catch (e) {}
            _activeMsgListener = null;
        }
        if (!window.fbDb || !window._firebaseLoaded) return;

        var us  = _us();
        var uid = us.id;
        if (!uid) return;

        var tid = [uid, recipientId].sort().join('_');

        _activeMsgListener = window.fbDb
            .collection('messages').doc(tid).collection('msgs')
            .orderBy('ts', 'asc').limit(100)
            .onSnapshot(function (snap) {
                if (!snap) return;
                snap.docChanges().forEach(function (change) {
                    if (change.type !== 'added') return;
                    var msg = change.doc.data();
                    if (!msg || msg.from === uid) return; /* skip own messages already rendered */

                    /* Check if already in localStorage */
                    var ms = {};
                    try { ms = JSON.parse(localStorage.getItem('empyrean_msgs') || '{}'); } catch (e) {}
                    var thr = ms[recipientId] || [];
                    if (thr.some(function (m) { return m.text === msg.text && m.from === msg.from
                        && Math.abs(new Date(m.ts).getTime() - new Date(msg.ts).getTime()) < 5000; })) return;

                    /* Persist to localStorage */
                    thr.push({ from: msg.from, text: msg.text || '', ts: msg.ts, read: false,
                        fileUrl: msg.fileUrl || '', fileType: msg.fileType || '' });
                    ms[recipientId] = thr;
                    try { localStorage.setItem('empyrean_msgs', JSON.stringify(ms)); } catch (e) {}

                    /* Only add bubble if this chat is still the active one */
                    if (msgsContainer.dataset.activeChat !== recipientId) {
                        if (typeof window.pushNotification === 'function') {
                            var mu  = _mu();
                            var sender = (mu[msg.from] || {}).fullName || 'Message';
                            window.pushNotification('💬 ' + sender + ': ' + (msg.text || '').slice(0, 40), 'info');
                        }
                        renderContactList();
                        return;
                    }

                    /* Render received bubble */
                    var hint2 = document.getElementById('chat-empty-hint');
                    if (hint2) hint2.remove();

                    if (msg.fileUrl) {
                        msgsContainer.appendChild(
                            createMessageElement(msg.text || '', false, true, msg.fileUrl, msg.fileType || '')
                        );
                    } else {
                        var bubble = document.createElement('div');
                        bubble.style.cssText =
                            'max-width:72%;padding:10px 14px;border-radius:18px 18px 18px 4px;'
                            + 'background:white;color:var(--primary);font-size:0.88rem;line-height:1.45;'
                            + 'align-self:flex-start;box-shadow:0 1px 4px rgba(10,14,39,0.08);'
                            + 'word-break:break-word;margin-bottom:4px;';
                        bubble.textContent = msg.text || '';
                        msgsContainer.appendChild(bubble);
                    }
                    msgsContainer.scrollTop = msgsContainer.scrollHeight;
                    renderContactList();
                });
            }, function (err) {
                console.warn('[Chat] Firestore listener error:', err && err.message);
                _activeMsgListener = null;
            });
    }


    /* =========================================================================
       §7  EVENT DELEGATION
       ========================================================================= */

    document.addEventListener('click', function (e) {
        /* Contact item click → open chat */
        var contactItem = e.target.closest('.contact-item');
        if (contactItem && contactItem.dataset.userId) {
            e.preventDefault();
            e.stopPropagation();
            openChat(contactItem.dataset.userId);
            _wireMessageForm();
            return;
        }

        /* Chat media attach button */
        if (e.target.closest('#chat-attach-btn, .chat-attach-btn')) {
            e.preventDefault();
            var fi = document.getElementById('chat-media-input');
            if (!fi) {
                fi = document.createElement('input');
                fi.type   = 'file';
                fi.id     = 'chat-media-input';
                fi.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx';
                fi.style.display = 'none';
                document.body.appendChild(fi);
            }
            fi.click();
        }
    });

    /* Wire message form on empyrean-init-done (DOM is guaranteed ready) */
    document.addEventListener('empyrean-init-done', function () {
        setTimeout(_wireMessageForm, 400);
    });


    /* =========================================================================
       §8  BOOTSTRAP
       ========================================================================= */

    document.addEventListener('empyrean-init-done', function () {
        setTimeout(function () {
            if (!_isGuest()) {
                renderContactList();
                _wireMessageForm();
            }
        }, 500);
    });

    document.addEventListener('empyrean-user-ready', function () {
        setTimeout(function () {
            if (!_isGuest()) renderContactList();
        }, 600);
    });

    console.log('[EmpChat] ✅ Chat module ready.');

})();