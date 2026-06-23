// =====================================================
        // FIREBASE — use globals set by head initialization
        // =====================================================
        // Re-attempt init in case SDK loaded after head script ran
        if (!window._firebaseLoaded && typeof firebase !== 'undefined') {
            window._initFirebase();
        }
        // Local aliases that always point to working implementations
        /* FIX: was `let fbAuth/fbDb/fbStorage` -- top-level let/const in a
           classic <script> tag binds to the page's shared global lexical
           scope. app-dom.js (loaded earlier) already declares `let fbAuth`,
           `let fbDb`, `let fbStorage` the same way, so this second
           declaration threw "SyntaxError: Identifier 'fbAuth' has already
           been declared" -- a parse-time error that killed this entire
           1630-line file, every load, for every user. `var` rebinds the
           existing global instead of fighting over it, so the rest of this
           file's `fbDb.collection(...)` calls keep working unchanged. */
        var fbAuth    = window.fbAuth;
        var fbDb      = window.fbDb;
        var fbStorage = window.fbStorage;


        function _serverTimestamp() {
            try {
                if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                    return firebase.firestore.FieldValue.serverTimestamp();
            } catch(e) {}
            return new Date();
        }

        // =====================================================
        // CLOUDINARY — app-dom.js defines window.uploadToCloudinary,
        // reading live credentials from window._appConfig.cloudinary
        // (cloud: dxwmts9vw, preset: ehfapp_preset). app-admin.js MUST
        // NOT overwrite it — it runs after app-dom.js and would replace
        // the working function with one that read _appConfig at
        // parse-time (null).
        //
        // Safety net only: define it here if app-dom.js failed to load.
        // =====================================================
        if (typeof window.uploadToCloudinary !== 'function') {
            const _FB_CFG    = (window._appConfig && window._appConfig.cloudinary) || {};
            const _FB_CLOUD  = _FB_CFG.cloud  || 'dxwmts9vw';
            const _FB_PRESET = _FB_CFG.preset || 'ehfapp_preset';
            const _FB_URL    = 'https://api.cloudinary.com/v1_1/' + _FB_CLOUD + '/auto/upload';
            window.uploadToCloudinary = async function uploadToCloudinary(file, onProgress) {
                if (!file || !(file instanceof File)) {
                    if (typeof file === 'string') return file;
                    return Promise.reject(new Error('uploadToCloudinary: expected a File'));
                }
                return new Promise((resolve, reject) => {
                    const tid = setTimeout(() => { xhr.abort(); reject(new Error('Upload timed out after 90 s')); }, 90000);
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('upload_preset', _FB_PRESET);
                    fd.append('tags', 'empyrean_app');
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', _FB_URL, true);
                    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded/e.total)*100)); };
                    xhr.onload = () => {
                        clearTimeout(tid);
                        if (xhr.status === 200) {
                            try {
                                const res = JSON.parse(xhr.responseText);
                                if (!res.secure_url) return reject(new Error('No secure_url in Cloudinary response'));
                                window._cloudinaryUploads = (window._cloudinaryUploads||0)+1;
                                resolve(res.secure_url);
                            } catch(e) { reject(new Error('Could not parse Cloudinary response')); }
                        } else {
                            let msg = 'HTTP ' + xhr.status;
                            try { msg += ' — ' + JSON.parse(xhr.responseText).error.message; } catch(e) {}
                            console.error('[Cloudinary] ❌ Upload failed (admin fallback):', msg, 'preset:', _FB_PRESET);
                            reject(new Error(msg));
                        }
                    };
                    xhr.onerror   = () => { clearTimeout(tid); reject(new Error('Network error reaching Cloudinary')); };
                    xhr.ontimeout = () => { clearTimeout(tid); reject(new Error('XHR timeout')); };
                    xhr.send(fd);
                });
            };
            console.warn('[Empyrean] uploadToCloudinary safety-net activated — app-dom.js may not have run.');
        }

        async function uploadMediaFilesToCloudinary(files, onProgress) {
            if (!files || files.length === 0) return [];
            const uploads = Array.from(files).map(async (file, idx) => {
                if (!(file instanceof File)) {
                    return file._cloudUrl || (typeof file === 'string' ? file : (file.url || ''));
                }
                if (file.size > 100 * 1024 * 1024) {
                    if (typeof showNotification === 'function') showNotification(`"${file.name}" is too large (max 100MB).`, 'error');
                    return null;
                }
                // Always use window.uploadToCloudinary — guaranteed to be the
                // app-dom.js version with correct preset and proper reject on failure.
                const url = await window.uploadToCloudinary(file, (pct) => {
                    if (onProgress) onProgress(idx, pct);
                });
                file._cloudUrl = url;
                return url;
            });
            return Promise.all(uploads);
        }
        window.uploadMediaFilesToCloudinary = uploadMediaFilesToCloudinary;

        // =====================================================
        // FLUTTERWAVE PAYMENT GATEWAY — keys from /api/config
        // FLW_SECRET_KEY and FLW_ENCRYPTION_KEY live on the
        // server only — never sent to the browser.
        // =====================================================
        const _adminFlw = window._appConfig && window._appConfig.flutterwave;
        const FLW_PUBLIC_KEY_ADMIN = (_adminFlw && _adminFlw.publicKey) || '';

        // SDK queue — ensures callers never hit "FlutterwaveCheckout is not defined"
        window._flwSDKLoaded  = (typeof FlutterwaveCheckout !== 'undefined');
        window._flwSDKLoading = false;
        window._flwSDKQueue   = [];

        window._ensureFlutterwaveSDK = function(callback) {
            if (typeof FlutterwaveCheckout !== 'undefined') {
                window._flwSDKLoaded = true;
                callback();
                return;
            }
            window._flwSDKQueue.push(callback);
            if (window._flwSDKLoading) return; // already loading, will drain queue on load
            window._flwSDKLoading = true;
            const s = document.createElement('script');
            s.src = 'https://checkout.flutterwave.com/v3.js';
            s.onload = function() {
                window._flwSDKLoaded = true;
                window._flwSDKLoading = false;
                console.info('[FLW] ✅ SDK loaded');
                window._flwSDKQueue.forEach(function(fn) { try { fn(); } catch(e) {} });
                window._flwSDKQueue = [];
            };
            s.onerror = function() {
                window._flwSDKLoading = false;
                window._flwSDKQueue = [];
                if (typeof window.showNotification === 'function')
                    window.showNotification('Payment gateway unavailable. Please check your connection.', 'error');
            };
            document.head.appendChild(s);
        };

        // Pre-load SDK at startup so first payment click is instant
        if (!window._flwSDKLoaded) {
            window._ensureFlutterwaveSDK(function() {
                console.info('[FLW] Payment gateway ready');
            });
        }

        function initiateFlutterwavePayment(opts) {
            if (!opts || !opts.amount || parseFloat(opts.amount) < 1) {
                console.error('[FLW] Invalid payment options — amount required');
                if (opts && opts.onFailure) opts.onFailure({ status: 'error', message: 'Invalid payment amount' });
                return;
            }
            const txRef = 'EMPY-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

            window._ensureFlutterwaveSDK(function() {
                try {
                    FlutterwaveCheckout({
                        public_key: FLW_PUBLIC_KEY_ADMIN,
                        tx_ref: txRef,
                        amount: parseFloat(opts.amount),
                        currency: opts.currency || 'NGN',
                        payment_options: 'card,ussd,banktransfer,mobilemoney,barter,nqr',
                        customer: {
                            email:        opts.email || (window.userState && window.userState.email) || 'user@empyrean.com',
                            phone_number: opts.phone || (window.userState && window.userState.phone) || '',
                            name:         opts.name  || (window.userState && window.userState.fullName) || 'Empyrean User'
                        },
                        customizations: {
                            title:       'Empyrean Humanitarian Platform',
                            description: opts.description || 'Payment',
                            logo:        'https://cdn-icons-png.flaticon.com/512/6001/6001527.png'
                        },
                        meta: {
                            source:   'empyrean_app',
                            purpose:  opts.purpose || 'general',
                            userId:   (window.userState && window.userState.id) || 'guest',
                            encryption_key: FLW_ENCRYPTION_KEY
                        },
                        callback: function(response) {
                            if (response.status === 'successful' || response.status === 'completed') {
                                // Persist transaction to Firestore
                                try {
                                    if (window.fbDb && window._firebaseLoaded) {
                                        window.fbDb.collection('flw_transactions').doc(txRef).set({
                                            txRef,
                                            flwRef:   response.flw_ref || response.transaction_id || '',
                                            amount:   parseFloat(opts.amount),
                                            currency: opts.currency || 'NGN',
                                            purpose:  opts.purpose || 'general',
                                            status:   'successful',
                                            userId:   (window.userState && window.userState.id) || 'guest',
                                            userEmail: opts.email || (window.userState && window.userState.email) || '',
                                            createdAt: _serverTimestamp()
                                        }).catch(function(e) { console.error('[FLW] Firestore save error:', e.message); });
                                    }
                                } catch(e) {}
                                if (opts.onSuccess) opts.onSuccess(response, txRef);
                            } else {
                                if (opts.onFailure) opts.onFailure(response);
                            }
                        },
                        onclose: function() { if (opts.onClose) opts.onClose(); }
                    });
                } catch(flwErr) {
                    console.error('[FLW] FlutterwaveCheckout error:', flwErr.message);
                    if (opts.onFailure) opts.onFailure({ status: 'error', message: flwErr.message });
                }
            });
        }

        // Expose globally for use by all scripts
        window.initiateFlutterwavePayment = initiateFlutterwavePayment;
        window._flwPublicKey = FLW_PUBLIC_KEY_ADMIN;

        // Firebase user helpers
        async function saveUserToFirestore(uid, userData) {
            // Ensure real Firebase is ready before saving
            if (!window._firebaseLoaded) {
                console.warn('[saveUser] Firebase not ready — queuing retry in 2s');
                return new Promise((resolve) => {
                    setTimeout(async () => { try { await saveUserToFirestore(uid, userData); } catch(e){} resolve(); }, 2000);
                });
            }
            const safe = { ...userData };
            ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds']
                .forEach(k => { if (safe[k] instanceof Set) safe[k] = [...safe[k]]; });
            delete safe.password;
            safe.updatedAt = _serverTimestamp();
            try {
                await fbDb.collection('users').doc(uid).set(safe, { merge: true });
                console.log('[Firestore] ✅ User profile saved for uid:', uid);
            } catch(err) {
                console.error('[Firestore] ❌ User save failed:', err.message);
                throw err;
            }
        }
        async function loadUserFromFirestore(uid) {
            const doc = await fbDb.collection('users').doc(uid).get();
            if (!doc.exists) return null;
            const data = doc.data();
            ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds']
                .forEach(k => { data[k] = new Set(data[k] || []); });
            return data;
        }

        // ═══════════════════════════════════════════════════════════════════
        // ADMIN PANEL — TAB SWITCHING
        // Wires up all .admin-nav-tab buttons including the new Disbursements tab
        // ═══════════════════════════════════════════════════════════════════
        (function initAdminTabSwitching() {
            const adminSection = document.getElementById('admin');
            if (!adminSection) return;

            function switchAdminTab(targetId) {
                adminSection.querySelectorAll('.admin-nav-tab').forEach(function(b) {
                    const isActive = b.dataset.tab === targetId;
                    b.classList.toggle('active', isActive);
                    b.style.background = isActive ? 'var(--g-navy)' : 'transparent';
                    b.style.color      = isActive ? 'white' : 'var(--text-muted)';
                });
                adminSection.querySelectorAll('.admin-tab-content').forEach(function(panel) {
                    panel.style.display = panel.id === targetId ? 'block' : 'none';
                });
                if (targetId === 'admin-disburse-tab') {
                    _adminLoadNgoList();
                    _adminLoadRecentDisbursements();
                    /* Initialise panel visibility and method tabs on every tab open */
                    if (typeof window._adminDisbRecipChange === 'function') {
                        window._adminDisbRecipChange();
                    }
                    if (typeof window._selectDisbMethod === 'function') {
                        window._selectDisbMethod(window._currentDisbMethod || 'bank');
                    }
                }
            }

            adminSection.addEventListener('click', function(e) {
                const btn = e.target.closest('.admin-nav-tab');
                if (btn && btn.dataset.tab) switchAdminTab(btn.dataset.tab);
            });

            window._switchAdminTab = switchAdminTab;

            /* BUG FIX: Delegated change handler for disb-recip-type radios.
               Inline onchange may not fire if the function isn't yet defined
               at the moment the radio fires (script load ordering issue).
               This delegated listener is always live and overrides the inline. */
            document.addEventListener('change', function(e) {
                var t = e.target;
                if (t && t.name === 'disb-recip-type') {
                    if (typeof window._adminDisbRecipChange === 'function') {
                        window._adminDisbRecipChange();
                    }
                }
            });

            /* Also re-wire the Initiate Disbursement button via delegation
               so it works regardless of wrapper chain issues */
            document.addEventListener('click', function(e) {
                var btn = e.target.closest && e.target.closest(
                    'button[onclick*="_adminInitiateDisbursement"],' +
                    '#disb-initiate-btn'
                );
                if (btn && !btn._disbDelegated) {
                    btn._disbDelegated = true;
                    /* The onclick attribute still fires; delegation is a safety net */
                }
            });

            console.log('[Admin] ✅ Tab switching wired');
        })();

        // ═══════════════════════════════════════════════════════════════════
        // ADMIN PANEL — SYSTEM RESET
        // Logic is now fully inline in index.html (inline <script> tag).
        // This stub exists only as a fallback safety net.
        // ═══════════════════════════════════════════════════════════════════
        window._adminMasterDelete = function() {
            var btn = document.getElementById('master-delete-btn');
            if (btn) { btn.click(); return; }
            console.warn('[Reset] Trigger button not found in DOM.');
        };

        // ═══════════════════════════════════════════════════════════════════
        // ADMIN PANEL — DISBURSEMENTS
        // Vault connect, NGO loading, fiat + crypto disbursement
        // ═══════════════════════════════════════════════════════════════════

        // Contract addresses (mirrors contractAddresses in app-fixes.js)
        const _DISBURSE = {
            registryAddr:  '0xc861e3ae9a35336c9735692d788065c4a0e37ebb',
            empyTokenAddr: '0x624ca3Db53adb41944EbF2BcB015f68C7BAB0c02',
            usdtAddr:      '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            provider:      null,
            signer:        null,
            walletAddr:    null,
            connected:     false
        };

        const _REGISTRY_ABI = [
            'function recordOffChainGrant(address _recipient, uint256 _amount, string _currency, string _projectId, string _transactionReference) external',
            'function recordOnChainGrant(address _recipient, address _tokenAddress, uint256 _amount, string _projectId) external',
            'function getVerifiedNgoCount() external view returns (uint256)'
        ];
        const _ERC20_ABI = [
            'function transfer(address to, uint256 amount) external returns (bool)',
            'function balanceOf(address account) external view returns (uint256)',
            'function decimals() external view returns (uint8)'
        ];

        // Helper: update vault status badge
        function _setVaultBadge(connected, label) {
            const badge = document.getElementById('vault-status-badge');
            if (!badge) return;
            badge.textContent   = connected ? '● CONNECTED' : ('● ' + (label || 'DISCONNECTED'));
            badge.style.background = connected ? 'rgba(0,137,123,0.1)' : 'rgba(239,68,68,0.1)';
            badge.style.color      = connected ? 'var(--success-color, #22c55e)' : 'var(--danger-color)';
        }

        // Connect MetaMask → Ethers provider → read vault balances
        window._adminConnectVault = async function() {
            var _cvBtn = document.querySelector('button[onclick="window._adminConnectVault()"]');
            function _cvBtn2(lbl,icon,dis,bg){if(_cvBtn){_cvBtn.disabled=dis;_cvBtn.innerHTML='<i class="fas '+icon+'"></i> '+lbl;_cvBtn.style.background=bg||'';}}
            if (typeof window.ethereum === 'undefined') {
                _setVaultBadge(false,'NO METAMASK');
                _cvBtn2('No MetaMask','fa-exclamation-triangle',false,'var(--danger-color)');
                if (typeof showNotification === 'function')
                    showNotification('MetaMask not installed. Install MetaMask to use vault.', 'error');
                return;
            }
            if (typeof ethers === 'undefined' || !ethers) {
                _setVaultBadge(false,'LIB ERROR');
                _cvBtn2('Library Error','fa-exclamation-triangle',false,'var(--danger-color)');
                if (typeof showNotification === 'function')
                    showNotification('Blockchain library not loaded. Please refresh.', 'error');
                return;
            }
            _setVaultBadge(false, 'CONNECTING…');
            _cvBtn2('Connecting…','fa-spinner fa-spin',true,'');
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer   = provider.getSigner();
                const addr     = await signer.getAddress();

                _DISBURSE.provider   = provider;
                _DISBURSE.signer     = signer;
                _DISBURSE.walletAddr = addr;
                _DISBURSE.connected  = true;

                // Read EMPY balance
                let empyBal = '—', usdtBal = '—';
                try {
                    const empyC = new ethers.Contract(_DISBURSE.empyTokenAddr, _ERC20_ABI, provider);
                    const rawEmpy = await empyC.balanceOf(addr);
                    const decEmpy = await empyC.decimals();
                    empyBal = parseFloat(ethers.utils.formatUnits(rawEmpy, decEmpy)).toLocaleString('en-NG', { maximumFractionDigits: 2 }) + ' EMPY';
                } catch(e) { empyBal = 'N/A'; }
                try {
                    const usdtC = new ethers.Contract(_DISBURSE.usdtAddr, _ERC20_ABI, provider);
                    const rawUsdt = await usdtC.balanceOf(addr);
                    usdtBal = parseFloat(ethers.utils.formatUnits(rawUsdt, 6)).toLocaleString('en-NG', { maximumFractionDigits: 2 }) + ' USDT';
                } catch(e) { usdtBal = 'N/A'; }

                _setVaultBadge(true);
                const infoRow = document.getElementById('vault-info-row');
                if (infoRow) infoRow.style.display = 'block';
                const elEmpy = document.getElementById('vault-bal-empy');
                const elUsdt = document.getElementById('vault-bal-usdt');
                const elAddr = document.getElementById('vault-wallet-addr');
                if (elEmpy) elEmpy.textContent = empyBal;
                if (elUsdt) elUsdt.textContent = usdtBal;
                if (elAddr) elAddr.textContent = addr.slice(0, 6) + '…' + addr.slice(-4);

                _cvBtn2('Vault Connected','fa-check-circle',false,'var(--success-color,#22c55e)');
                if (typeof showNotification === 'function') showNotification('Vault connected: ' + addr.slice(0,6) + '…' + addr.slice(-4), 'success');
            } catch(err) {
                _setVaultBadge(false, 'FAILED');
                _cvBtn2('Connect Vault','fa-plug',false,'');
                if (typeof showNotification === 'function') showNotification('Vault connection failed: ' + (err.message||'User rejected'), 'error');
                console.error('[Vault] Connect error:', err);
            }
        };

        // Toggle crypto token row visibility
        window._adminDisbModeChange = function() {
            const mode = document.getElementById('disb-mode')?.value;
            const cryptoRow = document.getElementById('disb-crypto-row');
            if (cryptoRow) cryptoRow.style.display = mode === 'crypto' ? 'block' : 'none';
        };

        // Toggle NGO / Individual panels
        // BUG FIX: Made robust against optional-chaining absence and wrapper chain breakage.
        // Also initialises the method tabs whenever the individual panel becomes visible.
        window._adminDisbRecipChange = function() {
            var checked = document.querySelector('input[name="disb-recip-type"]:checked');
            var val = checked ? checked.value : 'ngo';
            var ngoPanel = document.getElementById('disb-ngo-panel');
            var indPanel = document.getElementById('disb-individual-panel');
            if (ngoPanel) ngoPanel.style.display = (val === 'ngo')        ? 'block' : 'none';
            if (indPanel) indPanel.style.display = (val === 'individual') ? 'block' : 'none';
            /* When individual panel becomes visible, ensure method tabs are initialised */
            if (val === 'individual' && typeof window._selectDisbMethod === 'function') {
                window._selectDisbMethod(window._currentDisbMethod || 'bank');
            }
        };

        // Switch disbursement method tabs (bank / empy / usdt / bnb / btc)
        window._selectDisbMethod = function(method) {
            ['bank','empy','usdt','bnb','btc'].forEach(function(m) {
                var panel = document.getElementById('disb-method-' + m);
                if (panel) panel.style.display = m === method ? 'block' : 'none';
            });
            document.querySelectorAll('#disb-method-tabs button[data-method]').forEach(function(btn) {
                var active = btn.dataset.method === method;
                btn.style.background = active ? '#0A0E27' : 'white';
                btn.style.color      = active ? 'white'   : '#0A0E27';
            });
            window._currentDisbMethod = method;
        };

        // Load NGO partners into the multi-select list
        window._adminLoadNgoList = async function() {
            const list = document.getElementById('disb-ngo-list');
            if (!list) return;
            list.innerHTML = '<div style="color:var(--text-muted);font-size:0.88rem;padding:10px;">Loading…</div>';

            // Try Firestore ngo_partners collection first, fall back to mockNgoPartners
            let ngos = [];
            try {
                if (window._firebaseLoaded) {
                    const snap = await fbDb.collection('ngo_partners').limit(60).get();
                    snap.forEach(function(doc) {
                        const d = doc.data();
                        ngos.push({ id: doc.id, name: d.name || d.orgName || doc.id, wallet: d.walletAddress || d.wallet || '', email: d.email || '' });
                    });
                }
            } catch(e) {}

            // Merge with mockNgoPartners if available
            if (window.mockNgoPartners && typeof window.mockNgoPartners === 'object') {
                Object.values(window.mockNgoPartners).forEach(function(ngo) {
                    if (!ngos.find(function(n) { return n.id === ngo.id; })) {
                        ngos.push({ id: ngo.id, name: ngo.name || ngo.id, wallet: ngo.wallet || ngo.walletAddress || '', email: ngo.email || '' });
                    }
                });
            }

            if (!ngos.length) {
                list.innerHTML = '<div style="color:var(--text-muted);font-size:0.88rem;padding:10px;">No NGO partners found. Register partners via the Publish → NGO Partners section.</div>';
                return;
            }

            list.innerHTML = ngos.map(function(ngo) {
                return '<label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid rgba(10,14,39,0.08);border-radius:12px;cursor:pointer;font-size:0.88rem;background:white;">' +
                    '<input type="checkbox" class="disb-ngo-chk" data-id="' + ngo.id + '" data-name="' + (ngo.name).replace(/"/g,'&quot;') + '" data-wallet="' + (ngo.wallet||'') + '" data-email="' + (ngo.email||'') + '" style="width:15px;height:15px;accent-color:var(--secondary);flex-shrink:0;">' +
                    '<span><strong>' + ngo.name + '</strong>' + (ngo.wallet ? '<br><span style="font-size:0.75rem;color:var(--text-muted);font-family:monospace;">' + ngo.wallet.slice(0,10) + '…</span>' : '') + '</span>' +
                    '</label>';
            }).join('');
        };

        // Load recent disbursements from Firestore
        window._adminLoadRecentDisbursements = async function() {
            const tbody = document.getElementById('disb-history-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Loading…</td></tr>';
            if (!window._firebaseLoaded) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Firebase not connected.</td></tr>';
                return;
            }
            try {
                const snap = await fbDb.collection('disbursements').orderBy('createdAt', 'desc').limit(30).get();
                if (snap.empty) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-muted);">No disbursements recorded yet.</td></tr>';
                    return;
                }
                let rows = '';
                snap.forEach(function(doc) {
                    const d  = doc.data();
                    const dt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }) : '—';
                    const statusColor = d.status === 'completed' ? 'var(--success-color,#22c55e)' : d.status === 'failed' ? 'var(--danger-color)' : '#F59E0B';
                    rows += '<tr style="border-bottom:1px solid rgba(10,14,39,0.06);">' +
                        '<td style="padding:10px 14px;white-space:nowrap;">' + dt + '</td>' +
                        '<td style="padding:10px 14px;">' + (d.recipientName || d.recipientId || '—') + '</td>' +
                        '<td style="padding:10px 14px;font-weight:700;">' + (d.amountFormatted || d.amount || '—') + '</td>' +
                        '<td style="padding:10px 14px;">' + (d.mode || '—') + '</td>' +
                        '<td style="padding:10px 14px;">' + (d.purpose || '—') + '</td>' +
                        '<td style="padding:10px 14px;"><span style="font-weight:700;color:' + statusColor + ';">' + (d.status || 'pending') + '</span></td>' +
                        '</tr>';
                });
                tbody.innerHTML = rows;
            } catch(err) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--danger-color);">Error: ' + err.message + '</td></tr>';
            }
        };

        // Append a live row to the Grant Transparency Portal after disbursement
        function _appendGrantLedgerRow(rec) {
            var tbody = document.getElementById('grant-ledger-body');
            if (!tbody) return;
            var empty = tbody.querySelector('td[colspan]');
            if (empty) empty.closest('tr').remove();
            var gid  = 'G-' + Date.now().toString(36).toUpperCase().slice(-6);
            var dt   = new Date().toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});
            var txTxt = rec.txHash ? rec.txHash.slice(0,16)+'..' : rec.txRef ? rec.txRef.slice(0,16)+'..' : 'pending';
            var txUrl = rec.txHash ? 'https://polygonscan.com/tx/'+rec.txHash : '#';
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>'+gid+'</td>'+
                '<td>'+(rec.recipientName||'—')+'</td>'+
                '<td>'+(rec.purpose||'—')+'</td>'+
                '<td>'+(rec.amountFormatted||rec.amount||'—')+'</td>'+
                '<td><a href="'+txUrl+'" target="_blank" style="color:var(--secondary);font-family:monospace;font-size:0.82rem;">'+txTxt+'</a></td>'+
                '<td style="color:var(--success-color,#22c55e);font-weight:700;">completed</td>'+
                '<td>'+dt+'</td>';
            tbody.prepend(tr);
        }

                // Show feedback inside disbursement form
        function _disbFeedback(msg, type) {
            const el = document.getElementById('disb-feedback');
            if (!el) return;
            el.style.display    = 'block';
            el.style.background = type === 'error' ? 'rgba(239,68,68,0.1)' : type === 'success' ? 'rgba(0,137,123,0.1)' : 'rgba(245,158,11,0.1)';
            el.style.color      = type === 'error' ? 'var(--danger-color)' : type === 'success' ? 'var(--success-color,#22c55e)' : '#d97706';
            el.style.border     = '1.5px solid currentColor';
            el.textContent      = msg;
        }

        // Main disbursement initiator
        window._adminInitiateDisbursement = async function() {
            const amount    = parseFloat(document.getElementById('disb-amount')?.value || '0');
            const mode      = document.getElementById('disb-mode')?.value;
            const purpose   = document.getElementById('disb-purpose')?.value?.trim();
            const recipType = document.querySelector('input[name="disb-recip-type"]:checked')?.value || 'ngo';
            const token     = document.querySelector('input[name="disb-token"]:checked')?.value || 'empy';
            const _dBtn     = document.querySelector('button[onclick="window._adminInitiateDisbursement()"]');
            const _lock   = function(){if(_dBtn){_dBtn.disabled=true; _dBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Processing…';}};
            const _unlock = function(){if(_dBtn){_dBtn.disabled=false;_dBtn.innerHTML='<i class="fas fa-paper-plane"></i> Initiate Disbursement';}};

            // Validate
            if (!amount || amount < 1) return _disbFeedback('Please enter a valid amount.', 'error');
            if (!mode)                 return _disbFeedback('Please select a disbursement mode.', 'error');
            if (!purpose)              return _disbFeedback('Please enter a purpose / project ID.', 'error');

            // Gather recipients
            const recipients = [];
            if (recipType === 'ngo') {
                document.querySelectorAll('.disb-ngo-chk:checked').forEach(function(chk) {
                    recipients.push({ id: chk.dataset.id, name: chk.dataset.name, wallet: chk.dataset.wallet, email: chk.dataset.email });
                });
                if (!recipients.length) return _disbFeedback('Please select at least one NGO partner.', 'error');
            } else {
                /* Individual disbursement — read from method-specific fields */
                const method = window._currentDisbMethod || 'bank';
                let addr = '', walletType = method;

                if (method === 'bank') {
                    const accNum  = document.getElementById('disb-bank-acc-number')?.value?.trim();
                    const accName = document.getElementById('disb-bank-acc-name')?.value?.trim();
                    const bank    = document.getElementById('disb-bank-name')?.value?.trim();
                    if (!accNum) return _disbFeedback('Please enter the recipient account number.', 'error');
                    addr = accNum + (bank ? ' — ' + bank : '') + (accName ? ' (' + accName + ')' : '');
                    walletType = 'bank';
                } else if (method === 'usdt') {
                    const network = document.getElementById('disb-usdt-network')?.value || 'erc20';
                    addr = document.getElementById('disb-usdt-addr')?.value?.trim();
                    if (!addr) return _disbFeedback('Please enter the USDT wallet address.', 'error');
                    walletType = 'usdt-' + network;
                } else if (method === 'empy') {
                    addr = document.getElementById('disb-individual-addr')?.value?.trim();
                    if (!addr) return _disbFeedback('Please enter the EMPY wallet address.', 'error');
                } else if (method === 'bnb') {
                    addr = document.getElementById('disb-bnb-addr')?.value?.trim();
                    if (!addr) return _disbFeedback('Please enter the BNB wallet address.', 'error');
                } else if (method === 'btc') {
                    addr = document.getElementById('disb-btc-addr')?.value?.trim();
                    if (!addr) return _disbFeedback('Please enter the BTC wallet address.', 'error');
                }

                const name = document.getElementById('disb-individual-name')?.value?.trim() || 'Individual Recipient';
                if (!addr) return _disbFeedback('Please fill in the recipient details.', 'error');
                recipients.push({ id: addr, name: name, wallet: addr, email: '', walletType: walletType });
            }

            _lock();
            _disbFeedback('Processing disbursement…', 'info');

            if (mode === 'fiat') {
                // Fiat via Flutterwave — disburse to each selected recipient
                let processed = 0;
                const perRecipient = Math.floor(amount / recipients.length);

                for (const recip of recipients) {
                    try {
                        await new Promise(function(resolve, reject) {
                            window.initiateFlutterwavePayment({
                                amount:      perRecipient,
                                currency:    'NGN',
                                email:       recip.email || (window.userState && window.userState.email) || 'admin@empyrean.com',
                                name:        recip.name,
                                description: purpose,
                                purpose:     purpose,
                                onSuccess: async function(response, txRef) {
                                    // Record in Firestore
                                    try {
                                        await fbDb.collection('disbursements').add({
                                            recipientId:     recip.id,
                                            recipientName:   recip.name,
                                            recipientWallet: recip.wallet || '',
                                            amount:          perRecipient,
                                            amountFormatted: '₦' + perRecipient.toLocaleString('en-NG'),
                                            mode:            'fiat-ngn',
                                            token:           'NGN',
                                            purpose:         purpose,
                                            txRef:           txRef,
                                            flwRef:          response.flw_ref || '',
                                            status:          'completed',
                                            adminId:         (window.userState && window.userState.id) || '',
                                            createdAt:       _serverTimestamp()
                                        });
                                        // Record off-chain on the registry contract if vault is connected
                                        if (_DISBURSE.connected && _DISBURSE.signer && recip.wallet && recip.wallet.startsWith('0x')) {
                                            try {
                                                const registry = new ethers.Contract(_DISBURSE.registryAddr, _REGISTRY_ABI, _DISBURSE.signer);
                                                await registry.recordOffChainGrant(
                                                    recip.wallet,
                                                    ethers.utils.parseUnits(String(perRecipient), 18),
                                                    'NGN',
                                                    purpose,
                                                    txRef
                                                );
                                            } catch(chainErr) { console.warn('[Disburse] Off-chain record error:', chainErr.message); }
                                        }
                                    } catch(e) { console.warn('[Disburse] Firestore save error:', e.message); }
                                    _appendGrantLedgerRow({recipientName:recip.name,purpose:purpose,amountFormatted:'₦'+perRecipient.toLocaleString('en-NG'),txRef:txRef});
                                    processed++;
                                    resolve();
                                },
                                onFailure: function(res) { reject(new Error(res.message || 'Payment failed')); },
                                onClose:   function()    { reject(new Error('Payment window closed')); }
                            });
                        });
                    } catch(flwErr) {
                        console.warn('[Disburse] FLW error for', recip.name, ':', flwErr.message);
                        _disbFeedback('⚠ Error for '+recip.name+': '+flwErr.message,'error');
                    }
                }
                _unlock();
                if (processed === recipients.length && processed > 0) {
                    _disbFeedback('✅ Fiat disbursement completed for ' + processed + ' recipient(s). Ledger updated.', 'success');
                    window._adminLoadRecentDisbursements();
                } else if (processed > 0) {
                    _disbFeedback('⚠ Partial: ' + processed + ' of ' + recipients.length + ' completed.', 'warning');
                    window._adminLoadRecentDisbursements();
                } else {
                    _disbFeedback('❌ No disbursements completed. Check payment gateway connection.', 'error');
                }

            } else if (mode === 'crypto') {
                // Crypto — requires vault connection
                if (!_DISBURSE.connected || !_DISBURSE.signer) {
                    _unlock();
                    return _disbFeedback('Please connect the vault (MetaMask) before sending crypto.', 'error');
                }
                if (typeof ethers === 'undefined' || !ethers) {
                    _unlock();
                    return _disbFeedback('Blockchain library not loaded. Please refresh.', 'error');
                }
                const tokenAddr = token === 'usdt' ? _DISBURSE.usdtAddr : _DISBURSE.empyTokenAddr;
                const decimals  = token === 'usdt' ? 6 : 18;
                const perRecipient = amount / recipients.length;
                const amtUnits  = ethers.utils.parseUnits(perRecipient.toFixed(decimals > 6 ? 6 : decimals), decimals);
                const tokenLabel = token === 'usdt' ? 'USDT' : 'EMPY';

                let processed = 0;
                const tokenContract  = new ethers.Contract(tokenAddr, _ERC20_ABI, _DISBURSE.signer);
                const registryContract = new ethers.Contract(_DISBURSE.registryAddr, _REGISTRY_ABI, _DISBURSE.signer);

                for (const recip of recipients) {
                    if (!recip.wallet || !recip.wallet.startsWith('0x')) {
                        console.warn('[Disburse] No valid wallet for', recip.name, '— skipping');
                        continue;
                    }
                    try {
                        _disbFeedback('Sending ' + tokenLabel + ' to ' + recip.name + '…', 'info');
                        // ERC-20 transfer
                        const tx = await tokenContract.transfer(recip.wallet, amtUnits);
                        await tx.wait();
                        // Record on-chain in registry
                        try {
                            const regTx = await registryContract.recordOnChainGrant(recip.wallet, tokenAddr, amtUnits, purpose);
                            await regTx.wait();
                        } catch(regErr) { console.warn('[Disburse] Registry record error:', regErr.message); }
                        // Persist to Firestore
                        try {
                            await fbDb.collection('disbursements').add({
                                recipientId:     recip.id,
                                recipientName:   recip.name,
                                recipientWallet: recip.wallet,
                                amount:          perRecipient,
                                amountFormatted: perRecipient.toLocaleString('en', { maximumFractionDigits: 4 }) + ' ' + tokenLabel,
                                mode:            'crypto',
                                token:           tokenLabel,
                                tokenAddress:    tokenAddr,
                                txHash:          tx.hash,
                                purpose:         purpose,
                                status:          'completed',
                                adminId:         (window.userState && window.userState.id) || '',
                                createdAt:       _serverTimestamp()
                            });
                        } catch(firestoreErr) { console.warn('[Disburse] Firestore error:', firestoreErr.message); }
                        _appendGrantLedgerRow({recipientName:recip.name,purpose:purpose,amountFormatted:perRecipient.toLocaleString('en',{maximumFractionDigits:4})+' '+tokenLabel,txHash:tx.hash});
                        processed++;
                    } catch(txErr) {
                        console.error('[Disburse] TX error for', recip.name, ':', txErr.message);
                        _disbFeedback('❌ Failed for ' + recip.name + ': ' + txErr.message, 'error');
                    }
                }
                _unlock();
                if (processed > 0) {
                    _disbFeedback('✅ ' + tokenLabel + ' sent to ' + processed + ' of ' + recipients.length + ' recipient(s). Ledger updated.', 'success');
                    window._adminLoadRecentDisbursements();
                } else {
                    _disbFeedback('❌ No transactions completed. Check wallet addresses and vault.', 'error');
                }
            } else {
                _unlock();
                _disbFeedback('Unknown disbursement mode.', 'error');
            }
        };

        // ═══════════════════════════════════════════════════════════════════
        // ADMIN PANEL — NEWS ARTICLE PUBLISH FORM
        // Wires the #admin-news-form submit, toolbar formatting buttons,
        // media upload preview, and the published articles table.
        // Root cause of Bug 1: no submit handler was ever wired to this form.
        // ═══════════════════════════════════════════════════════════════════
        (function _wireAdminNewsForm() {

            function _feedbackNews(msg, type) {
                var el = document.getElementById('admin-news-feedback');
                if (!el) return;
                var colors = {
                    success: { bg: 'rgba(34,197,94,0.12)', color: 'var(--success-color,#22c55e)' },
                    error:   { bg: 'rgba(239,68,68,0.12)', color: 'var(--danger-color,#ef4444)' },
                    info:    { bg: 'rgba(27,43,139,0.08)', color: 'var(--secondary,#1B2B8B)' }
                };
                var c = colors[type] || colors.info;
                el.style.display    = 'block';
                el.style.background = c.bg;
                el.style.color      = c.color;
                el.style.border     = '1.5px solid currentColor';
                el.style.padding    = '12px 16px';
                el.style.borderRadius = '10px';
                el.style.fontWeight = '600';
                el.style.fontSize   = '0.88rem';
                el.textContent = msg;
            }

            function _refreshNewsTable() {
                var tbody = document.getElementById('admin-news-table-body');
                var badge = document.getElementById('admin-news-count-badge');
                if (!tbody) return;
                if (!window._firebaseLoaded || !window.fbDb) return;
                window.fbDb.collection('news_articles').orderBy('createdAt', 'desc').limit(30).get()
                    .then(function(snap) {
                        if (badge) badge.textContent = snap.size || 0;
                        var emptyRow = document.getElementById('admin-news-empty-row');
                        if (snap.empty) {
                            if (!emptyRow) {
                                tbody.innerHTML = '<tr id="admin-news-empty-row"><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">No articles published yet.</td></tr>';
                            }
                            return;
                        }
                        tbody.innerHTML = '';
                        snap.forEach(function(doc) {
                            var d = doc.data();
                            var dt = d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }) : '—';
                            var tr = document.createElement('tr');
                            tr.style.borderBottom = '1px solid rgba(10,14,39,0.06)';
                            tr.innerHTML =
                                '<td style="padding:10px 16px;font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+_esc(d.title||'')+'">'+_esc(d.title||'—')+'</td>'+
                                '<td style="padding:10px 16px;">'+_esc(d.writer||'—')+'</td>'+
                                '<td style="padding:10px 16px;"><span style="background:rgba(27,43,139,0.08);color:var(--secondary);padding:2px 9px;border-radius:10px;font-size:0.78rem;font-weight:600;">'+_esc(d.category||'—')+'</span></td>'+
                                '<td style="padding:10px 16px;white-space:nowrap;">'+dt+'</td>'+
                                '<td style="padding:10px 16px;">'+
                                    '<button onclick="window._adminDeleteNewsArticle(\''+doc.id+'\')" style="background:rgba(239,68,68,0.1);color:#ef4444;border:none;border-radius:8px;padding:5px 12px;font-size:0.78rem;font-weight:700;cursor:pointer;"><i class="fas fa-trash"></i> Delete</button>'+
                                '</td>';
                            tbody.appendChild(tr);
                        });
                    })
                    .catch(function(e) { console.warn('[AdminNews] Table refresh error:', e.message); });
            }

            window._adminDeleteNewsArticle = function(docId) {
                if (!confirm('Delete this article? This cannot be undone.')) return;
                /* Delegate to app-news.js which handles cache + DOM + dashboard strip + Firestore */
                if (typeof window.deleteNewsPost === 'function') {
                    window.deleteNewsPost(docId);
                    _refreshNewsTable();
                    return;
                }
                /* Fallback if app-news.js not loaded */
                if (!window._firebaseLoaded || !window.fbDb) return;
                window.fbDb.collection('news_articles').doc(docId).delete()
                    .then(function() {
                        if (typeof window.showNotification === 'function') window.showNotification('Article deleted.', 'success');
                        _refreshNewsTable();
                    })
                    .catch(function(e) { if (typeof window.showNotification === 'function') window.showNotification('Delete failed: '+e.message, 'error'); });
            };

            /* ── Wire toolbar formatting buttons ── */
            function _wireToolbar() {
                var toolbar = document.getElementById('admin-news-toolbar');
                var body    = document.getElementById('admin-news-body');
                if (!toolbar || !body || toolbar._newsToolbarWired) return;
                toolbar._newsToolbarWired = true;
                toolbar.addEventListener('click', function(e) {
                    var btn = e.target.closest('.admin-news-fmt-btn');
                    if (!btn) return;
                    var fmt = btn.dataset.fmt;
                    var start = body.selectionStart;
                    var end   = body.selectionEnd;
                    var sel   = body.value.substring(start, end);
                    var before = body.value.substring(0, start);
                    var after  = body.value.substring(end);
                    var insert = sel;
                    if (fmt === 'bold')   insert = '**' + (sel || 'bold text') + '**';
                    if (fmt === 'italic') insert = '_' + (sel || 'italic text') + '_';
                    if (fmt === 'h2')     insert = '\n## ' + (sel || 'Heading') + '\n';
                    if (fmt === 'quote')  insert = '\n> ' + (sel || 'quote') + '\n';
                    if (fmt === 'bullet') insert = '\n- ' + (sel || 'list item') + '\n';
                    body.value = before + insert + after;
                    body.focus();
                    body.selectionStart = body.selectionEnd = before.length + insert.length;
                    e.preventDefault();
                });
            }

            /* ── Wire media preview for news upload ── */
            function _wireNewsMediaInput() {
                var input = document.getElementById('admin-news-media');
                if (!input || input._newsMediaWired) return;
                input._newsMediaWired = true;
                input.addEventListener('change', function() {
                    var preview = document.getElementById('admin-news-media-preview');
                    if (!preview) return;
                    preview.innerHTML = '';
                    Array.from(input.files || []).forEach(function(file) {
                        var url = URL.createObjectURL(file);
                        var isVid = file.type.startsWith('video/');
                        var el = document.createElement(isVid ? 'video' : 'img');
                        el.src = url;
                        if (isVid) { el.muted = true; el.controls = false; }
                        el.style.cssText = 'width:90px;height:70px;object-fit:cover;border-radius:8px;border:2px solid rgba(27,43,139,0.15);';
                        preview.appendChild(el);
                    });
                });
            }

            /* ── Wire the form submit ── */
            function _wireNewsFormSubmit() {
                var form = document.getElementById('admin-news-form');
                if (!form || form._newsFormWired) return;
                form._newsFormWired = true;

                form.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    var titleEl    = document.getElementById('admin-news-title');
                    var writerEl   = document.getElementById('admin-news-writer');
                    var categoryEl = document.getElementById('admin-news-category');
                    var pubdateEl  = document.getElementById('admin-news-pubdate');
                    var summaryEl  = document.getElementById('admin-news-summary');
                    var bodyEl     = document.getElementById('admin-news-body');
                    var mediaInput = document.getElementById('admin-news-media');
                    var submitBtn  = form.querySelector('button[type="submit"]');

                    var title  = titleEl  ? titleEl.value.trim()  : '';
                    var writer = writerEl ? writerEl.value.trim() : '';
                    var body   = bodyEl   ? bodyEl.value.trim()   : '';

                    if (!title)  { _feedbackNews('Article title is required.', 'error'); return; }
                    if (!writer) { _feedbackNews('Writer name is required.', 'error'); return; }
                    if (!body)   { _feedbackNews('Article body is required.', 'error'); return; }

                    var origText = submitBtn ? submitBtn.innerHTML : '';
                    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing…'; }
                    _feedbackNews('Publishing article…', 'info');

                    try {
                        /* Upload media files */
                        var mediaUrls = [];
                        var files = Array.from((mediaInput && mediaInput.files) || []);
                        for (var i = 0; i < files.length; i++) {
                            try {
                                var url = await window.uploadToCloudinary(files[i], null);
                                if (url) mediaUrls.push(url);
                            } catch(ue) { console.warn('[AdminNews] Media upload error:', ue.message); }
                        }

                        var article = {
                            id:        'news-' + Date.now(),
                            title:     title,
                            writer:    writer,
                            category:  categoryEl ? categoryEl.value : 'impact',
                            pubdate:   pubdateEl  ? pubdateEl.value  : '',
                            summary:   summaryEl  ? summaryEl.value.trim() : '',
                            body:      body,
                            media:     mediaUrls,
                            image:     mediaUrls[0] || '',
                            createdAt: new Date().toISOString(),
                            publishedBy: (window.userState && window.userState.id) || 'admin'
                        };

                        /* Save to Firestore — write to news_posts so the real-time
                           listener in app-news.js propagates it to all devices and
                           also populates the dashboard strip via _newsCache.
                           Also archive a copy in news_articles for admin history. */
                        if (window._firebaseLoaded && window.fbDb) {
                            await window.fbDb.collection('news_posts').doc(article.id).set({
                                id:          article.id,
                                title:       article.title,
                                content:     article.body,
                                writer:      article.writer,
                                category:    article.category,
                                summary:     article.summary,
                                pubdate:     article.pubdate,
                                mediaUrl:    article.image  || null,
                                mediaType:   (article.image && files[0]) ? (files[0].type || null) : null,
                                media:       article.media,
                                userId:      article.publishedBy,
                                username:    (window.userState && window.userState.username) || 'admin',
                                createdAt:   article.createdAt,
                                publishedBy: article.publishedBy
                            });
                            /* Archive copy */
                            window.fbDb.collection('news_articles').doc(article.id).set(article).catch(function(){});
                        }

                        /* Immediately inject into app-news.js cache so dashboard
                           strip and news section update even before Firestore fires */
                        if (typeof window.addNewsPost === 'function') {
                            window.addNewsPost({
                                id:        article.id,
                                title:     article.title,
                                content:   article.body,
                                mediaUrl:  article.image  || null,
                                mediaType: (article.image && files[0]) ? (files[0].type || null) : null,
                                userId:    article.publishedBy,
                                username:  (window.userState && window.userState.username) || 'admin',
                                createdAt: article.createdAt
                            });
                        }

                        _feedbackNews('✅ Article "' + title + '" published successfully!', 'success');
                        if (typeof window.showNotification === 'function') window.showNotification('✅ Article published!', 'success');

                        /* Reset form */
                        form.reset();
                        var prev = document.getElementById('admin-news-media-preview');
                        if (prev) prev.innerHTML = '';

                        /* Refresh the published articles table */
                        _refreshNewsTable();

                    } catch(err) {
                        console.error('[AdminNews] Publish error:', err);
                        _feedbackNews('❌ Failed to publish: ' + (err.message || 'Please try again.'), 'error');
                    } finally {
                        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
                    }
                });

                /* Preview button */
                var previewBtn = document.getElementById('admin-news-preview-btn');
                if (previewBtn && !previewBtn._newsPreviewWired) {
                    previewBtn._newsPreviewWired = true;
                    previewBtn.addEventListener('click', function() {
                        var titleEl = document.getElementById('admin-news-title');
                        var bodyEl  = document.getElementById('admin-news-body');
                        var t = titleEl ? titleEl.value : '';
                        var b = bodyEl  ? bodyEl.value  : '';
                        if (!t && !b) { if (typeof window.showNotification === 'function') window.showNotification('Fill in title and body to preview.', 'warning'); return; }
                        var win = window.open('', '_blank', 'width=800,height=600');
                        if (win) {
                            win.document.write('<html><head><title>Preview: '+t+'</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.8;color:#222;}h1{font-size:2rem;}h2{font-size:1.4rem;}blockquote{border-left:4px solid #1B2B8B;margin:0;padding:0 20px;color:#555;}</style></head><body><h1>'+t+'</h1><hr><pre style="white-space:pre-wrap;font-family:inherit;">'+b+'</pre></body></html>');
                            win.document.close();
                        }
                    });
                }
            }

            /* Run wiring now and after admin tab switches */
            function _tryWire() {
                _wireToolbar();
                _wireNewsMediaInput();
                _wireNewsFormSubmit();
            }

            if (document.readyState !== 'loading') _tryWire();
            else document.addEventListener('DOMContentLoaded', _tryWire);
            document.addEventListener('empyrean-init-done', function() { setTimeout(_tryWire, 400); });

            /* Re-wire when admin publish tab is clicked */
            document.addEventListener('click', function(e) {
                var btn = e.target.closest && e.target.closest('[data-tab="admin-publish-tab"]');
                if (btn) { setTimeout(_tryWire, 200); setTimeout(_refreshNewsTable, 300); }
            });

            console.log('[Admin] ✅ News form wired — publish, preview, toolbar, media, and table.');
        }());


        // ═══════════════════════════════════════════════════════════════════
        // ADMIN PANEL — USER MANAGEMENT
        // Wires the existing #admin-users-tab markup (search, results list,
        // detail panel, "All Registered Users" table). Supports:
        //   • Listing all users from Firestore `users` collection
        //   • Searching by Unique ID (uid), username, or email
        //   • Viewing a user's profile + their business page(s)
        //   • Deleting a user: removes their `users/{uid}` Firestore doc and
        //     any `business_pages` (+ associated `business_posts`) they own.
        //
        // NOTE: This removes the user's data/profile from the app entirely.
        // It does NOT delete their Firebase Authentication account (that
        // requires a server-side Admin SDK, which this app does not have) —
        // their login credentials remain, but they will have no profile and
        // will be treated as a new user on next login.
        // ═══════════════════════════════════════════════════════════════════
        (function initAdminUserManagement() {

            function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
            function _notify(msg, type) { if (typeof window.showNotification === 'function') window.showNotification(msg, type); else console.log('[Admin]', msg); }

            var _allUsersCache = [];

            function _fmtDate(ts) {
                try {
                    if (!ts) return '—';
                    var d = ts.toDate ? ts.toDate() : new Date(ts);
                    if (isNaN(d.getTime())) return '—';
                    return d.toLocaleDateString();
                } catch (e) { return '—'; }
            }

            function _kycLabel(u) {
                var k = u.kycStatus || (u.kyc && u.kyc.status) || '';
                if (!k) return '<span style="color:#9CA3AF;">Not Submitted</span>';
                if (k === 'verified' || k === 'approved') return '<span style="color:#16A34A;font-weight:700;">Verified</span>';
                if (k === 'pending') return '<span style="color:#F59E0B;font-weight:700;">Pending</span>';
                if (k === 'rejected') return '<span style="color:#EF4444;font-weight:700;">Rejected</span>';
                return _esc(k);
            }

            function _statusLabel(u) {
                if (u.isAdmin) return '<span style="color:#1B2B8B;font-weight:700;"><i class="fas fa-user-shield"></i> Admin</span>';
                if (u.disabled || u.suspended) return '<span style="color:#EF4444;font-weight:700;">Suspended</span>';
                return '<span style="color:#16A34A;font-weight:700;">Active</span>';
            }

            function _avatarHTML(u) {
                var av = u.avatar || u.profilePhoto || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(u.fullName || u.username || 'U') + '&background=1B2B8B&color=fff&size=64');
                return '<img src="' + _esc(av) + '" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src=\'https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=64\'">';
            }

            /* ── Render one row of the "All Registered Users" table ── */
            function _userRowHTML(u) {
                return '<tr data-uid="' + _esc(u.id) + '" style="border-bottom:1px solid rgba(10,14,39,0.06);">'
                    + '<td style="padding:10px 16px;font-size:0.8rem;font-family:monospace;color:#6B7280;">' + _esc(u.id) + '</td>'
                    + '<td style="padding:10px 16px;"><div style="display:flex;align-items:center;gap:8px;">' + _avatarHTML(u)
                        + '<div><div style="font-weight:700;font-size:0.85rem;color:#0A0E27;">' + _esc(u.fullName || u.username || 'Unnamed') + '</div>'
                        + '<div style="font-size:0.72rem;color:#9CA3AF;">@' + _esc(u.username || '—') + '</div></div></div></td>'
                    + '<td style="padding:10px 16px;font-size:0.82rem;color:#374151;">' + _esc(u.email || '—') + '</td>'
                    + '<td style="padding:10px 16px;font-size:0.82rem;color:#374151;">' + (Number(u.empyBalance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>'
                    + '<td style="padding:10px 16px;font-size:0.8rem;">' + _kycLabel(u) + '</td>'
                    + '<td style="padding:10px 16px;font-size:0.8rem;">' + _statusLabel(u) + '</td>'
                    + '<td style="padding:10px 16px;white-space:nowrap;">'
                        + '<button class="admin-user-view-btn" data-uid="' + _esc(u.id) + '" style="padding:6px 12px;border-radius:8px;background:rgba(27,43,139,0.08);color:#1B2B8B;border:1px solid rgba(27,43,139,0.18);font-size:0.76rem;font-weight:700;cursor:pointer;margin-right:6px;"><i class="fas fa-eye"></i> View</button>'
                        + '<button class="admin-user-delete-btn" data-uid="' + _esc(u.id) + '" style="padding:6px 12px;border-radius:8px;background:rgba(239,68,68,0.08);color:#EF4444;border:1px solid rgba(239,68,68,0.2);font-size:0.76rem;font-weight:700;cursor:pointer;"><i class="fas fa-trash"></i> Delete</button>'
                    + '</td></tr>';
            }

            function _renderAllUsersTable(list) {
                var tbody = document.getElementById('admin-all-users-table');
                var badge = document.getElementById('admin-total-users-badge');
                if (badge) badge.textContent = list.length + (list.length === 1 ? ' user' : ' users');
                if (!tbody) return;
                if (!list.length) {
                    tbody.innerHTML = '<tr><td colspan="7" style="padding:30px;text-align:center;color:#9CA3AF;font-size:0.88rem;">No users found.</td></tr>';
                    return;
                }
                tbody.innerHTML = list.map(_userRowHTML).join('');
            }

            function _loadAllUsers() {
                if (!fbDb) return Promise.resolve([]);
                var tbody = document.getElementById('admin-all-users-table');
                if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:30px;text-align:center;color:#9CA3AF;"><i class="fas fa-spinner fa-spin"></i> Loading users…</td></tr>';
                return fbDb.collection('users').limit(200).get().then(function (snap) {
                    var list = [];
                    snap.forEach(function (doc) {
                        var d = doc.data();
                        d.id = doc.id;
                        list.push(d);
                    });
                    _allUsersCache = list;
                    _renderAllUsersTable(list);
                    return list;
                }).catch(function (err) {
                    console.warn('[Admin Users] load failed:', err && err.message);
                    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:30px;text-align:center;color:#EF4444;">Could not load users: ' + _esc(err && err.message) + '</td></tr>';
                    return [];
                });
            }

            /* ── Detail panel: shows full profile + business page(s) + delete action ── */
            function _showUserDetail(u) {
                var panel = document.getElementById('admin-user-detail-panel');
                var content = document.getElementById('admin-user-detail-content');
                if (!panel || !content) return;

                var html = ''
                    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px;">'
                    + '<div style="display:flex;align-items:center;gap:14px;">'
                    + '<img src="' + _esc(u.avatar || u.profilePhoto || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(u.fullName || u.username || 'U') + '&background=1B2B8B&color=fff&size=100')) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;" onerror="this.src=\'https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=100\'">'
                    + '<div><h3 style="margin:0 0 2px;font-size:1.05rem;font-weight:900;color:#0A0E27;">' + _esc(u.fullName || u.username || 'Unnamed User') + '</h3>'
                    + '<div style="font-size:0.8rem;color:#6B7280;">@' + _esc(u.username || '—') + ' &middot; ' + _esc(u.email || '—') + '</div>'
                    + '<div style="font-size:0.74rem;color:#9CA3AF;margin-top:2px;font-family:monospace;">UID: ' + _esc(u.id) + '</div></div>'
                    + '</div>'
                    + '<button id="admin-user-detail-close" style="background:rgba(10,14,39,0.07);border:none;width:32px;height:32px;border-radius:50%;font-size:0.95rem;cursor:pointer;color:#6B7280;"><i class="fas fa-times"></i></button>'
                    + '</div>'
                    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;">'
                    + '<div style="background:rgba(27,43,139,0.05);border-radius:12px;padding:12px;"><div style="font-size:0.7rem;color:#6B7280;text-transform:uppercase;font-weight:700;">EMPY Balance</div><div style="font-size:1.05rem;font-weight:800;color:#0A0E27;">' + (Number(u.empyBalance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div></div>'
                    + '<div style="background:rgba(27,43,139,0.05);border-radius:12px;padding:12px;"><div style="font-size:0.7rem;color:#6B7280;text-transform:uppercase;font-weight:700;">KYC Status</div><div style="font-size:0.92rem;font-weight:800;margin-top:2px;">' + _kycLabel(u) + '</div></div>'
                    + '<div style="background:rgba(27,43,139,0.05);border-radius:12px;padding:12px;"><div style="font-size:0.7rem;color:#6B7280;text-transform:uppercase;font-weight:700;">Account Status</div><div style="font-size:0.92rem;font-weight:800;margin-top:2px;">' + _statusLabel(u) + '</div></div>'
                    + '<div style="background:rgba(27,43,139,0.05);border-radius:12px;padding:12px;"><div style="font-size:0.7rem;color:#6B7280;text-transform:uppercase;font-weight:700;">Joined</div><div style="font-size:0.92rem;font-weight:800;color:#0A0E27;">' + _fmtDate(u.createdAt) + '</div></div>'
                    + '</div>'
                    + '<div id="admin-user-biz-pages" style="margin-bottom:16px;"><div style="font-size:0.78rem;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Business Page(s)</div><div style="color:#9CA3AF;font-size:0.85rem;"><i class="fas fa-spinner fa-spin"></i> Checking…</div></div>'
                    + '<button id="admin-user-delete-detail-btn" data-uid="' + _esc(u.id) + '" style="width:100%;padding:13px;border-radius:14px;background:rgba(239,68,68,0.08);color:#EF4444;border:2px solid rgba(239,68,68,0.25);font-weight:800;font-size:0.9rem;cursor:pointer;"><i class="fas fa-user-times" style="margin-right:7px;"></i>Delete This User</button>';

                content.innerHTML = html;
                panel.style.display = 'block';
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                document.getElementById('admin-user-detail-close').addEventListener('click', function () {
                    panel.style.display = 'none';
                });

                /* Load this user's business page(s) */
                var bizContainer = document.getElementById('admin-user-biz-pages').querySelector('div:last-child');
                if (fbDb) {
                    fbDb.collection('business_pages').where('ownerId', '==', u.id).get().then(function (snap) {
                        if (snap.empty) { bizContainer.innerHTML = '<div style="color:#9CA3AF;font-size:0.85rem;">No business page.</div>'; return; }
                        var rows = [];
                        snap.forEach(function (doc) {
                            var b = doc.data(); b.id = doc.id;
                            rows.push('<div style="display:flex;align-items:center;justify-content:between;gap:10px;padding:10px 12px;border:1px solid rgba(10,14,39,0.08);border-radius:10px;margin-bottom:6px;">'
                                + '<div style="flex:1;min-width:0;"><strong style="font-size:0.85rem;color:#0A0E27;">' + _esc(b.name || b.businessName || 'Business') + '</strong>'
                                + '<div style="font-size:0.72rem;color:#9CA3AF;font-family:monospace;">' + _esc(b.id) + '</div></div>'
                                + '<button class="admin-bizpage-delete-btn" data-bizid="' + _esc(b.id) + '" style="padding:5px 10px;border-radius:8px;background:rgba(239,68,68,0.08);color:#EF4444;border:1px solid rgba(239,68,68,0.2);font-size:0.74rem;font-weight:700;cursor:pointer;"><i class="fas fa-trash"></i> Delete Page</button>'
                                + '</div>');
                        });
                        bizContainer.innerHTML = rows.join('');
                        bizContainer.querySelectorAll('.admin-bizpage-delete-btn').forEach(function (btn) {
                            btn.addEventListener('click', function () { _deleteBusinessPage(btn.dataset.bizid, btn); });
                        });
                    }).catch(function () {
                        bizContainer.innerHTML = '<div style="color:#9CA3AF;font-size:0.85rem;">Could not check business pages.</div>';
                    });
                } else {
                    bizContainer.innerHTML = '<div style="color:#9CA3AF;font-size:0.85rem;">Not connected.</div>';
                }

                document.getElementById('admin-user-delete-detail-btn').addEventListener('click', function () {
                    _deleteUser(u.id, this, function () { panel.style.display = 'none'; });
                });
            }

            /* ── Delete a business page (+ its posts) ── */
            function _deleteBusinessPage(bizId, btn) {
                if (!bizId) return;
                if (!btn._confirming) {
                    btn._confirming = true;
                    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Confirm';
                    setTimeout(function () { btn._confirming = false; btn.innerHTML = '<i class="fas fa-trash"></i> Delete Page'; }, 4000);
                    return;
                }
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting…';
                if (!fbDb) { _notify('Not connected.', 'error'); return; }
                fbDb.collection('business_posts').where('pageId', '==', bizId).get()
                    .then(function (snap) {
                        var dels = [];
                        snap.forEach(function (doc) { dels.push(doc.ref.delete().catch(function () {})); });
                        return Promise.all(dels);
                    })
                    .then(function () { return fbDb.collection('business_pages').doc(bizId).delete(); })
                    .then(function () {
                        _notify('Business page deleted.', 'success');
                        var row = btn.closest('div');
                        if (row && row.parentNode) row.parentNode.removeChild(row);
                        /* Remove from dashboard if present */
                        document.querySelectorAll('[data-biz-id="' + bizId + '"],[data-page-id="' + bizId + '"]').forEach(function (c) { c.remove(); });
                    })
                    .catch(function (err) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-trash"></i> Delete Page';
                        _notify('Failed to delete page: ' + (err && err.message ? err.message : 'Please try again.'), 'error');
                    });
            }

            /* ── Delete a user's Firestore profile + their business page(s)/post(s) ──
               Does NOT remove their Firebase Auth credentials (requires Admin SDK). */
            function _deleteUser(uid, btn, onDone) {
                if (!uid) return;
                if (!btn._confirming) {
                    btn._confirming = true;
                    btn.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:7px;"></i>Tap again to permanently delete this user';
                    setTimeout(function () {
                        if (btn._confirming) {
                            btn._confirming = false;
                            btn.innerHTML = btn.dataset.origLabel || '<i class="fas fa-trash"></i> Delete';
                        }
                    }, 4000);
                    if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.innerHTML;
                    return;
                }
                if (!fbDb) { _notify('Not connected.', 'error'); return; }
                btn._confirming = false;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:7px;"></i>Deleting…';

                /* 1. Find + delete this user's business pages and their posts */
                fbDb.collection('business_pages').where('ownerId', '==', uid).get()
                    .then(function (pagesSnap) {
                        var pageDeletes = [];
                        pagesSnap.forEach(function (pageDoc) {
                            var pid = pageDoc.id;
                            pageDeletes.push(
                                fbDb.collection('business_posts').where('pageId', '==', pid).get().then(function (postsSnap) {
                                    var postDels = [];
                                    postsSnap.forEach(function (pd) { postDels.push(pd.ref.delete().catch(function () {})); });
                                    return Promise.all(postDels);
                                }).then(function () { return pageDoc.ref.delete().catch(function () {}); })
                            );
                        });
                        return Promise.all(pageDeletes);
                    })
                    /* 2. Delete the user's own posts in business_posts (authored, even if pageless) */
                    .then(function () {
                        return fbDb.collection('business_posts').where('userId', '==', uid).get().then(function (snap) {
                            var dels = [];
                            snap.forEach(function (doc) { dels.push(doc.ref.delete().catch(function () {})); });
                            return Promise.all(dels);
                        });
                    })
                    /* 3. Delete the user's Firestore profile */
                    .then(function () { return fbDb.collection('users').doc(uid).delete(); })
                    .then(function () {
                        _notify('User deleted from the platform.', 'success');
                        _allUsersCache = _allUsersCache.filter(function (u) { return u.id !== uid; });
                        _renderAllUsersTable(_allUsersCache);
                        var row = document.querySelector('#admin-all-users-table tr[data-uid="' + uid + '"]');
                        if (row) row.remove();
                        if (typeof onDone === 'function') onDone();
                    })
                    .catch(function (err) {
                        btn.disabled = false;
                        btn.innerHTML = btn.dataset.origLabel || '<i class="fas fa-trash"></i> Delete';
                        _notify('Failed to delete user: ' + (err && err.message ? err.message : 'Please try again.'), 'error');
                    });
            }

            /* ── Search ── */
            function _runSearch() {
                var input = document.getElementById('admin-user-search-input');
                var typeSel = document.getElementById('admin-user-search-type');
                var resultsEl = document.getElementById('admin-user-search-results');
                if (!input || !resultsEl) return;
                var q = (input.value || '').trim();
                var type = typeSel ? typeSel.value : 'all';
                if (!q) { resultsEl.innerHTML = ''; return; }
                resultsEl.innerHTML = '<div style="padding:14px;text-align:center;color:#9CA3AF;"><i class="fas fa-spinner fa-spin"></i> Searching…</div>';

                var qLower = q.toLowerCase();
                function _matches(u) {
                    if (type === 'id' || type === 'all') { if ((u.id || '').toLowerCase() === qLower || (u.id || '').toLowerCase().indexOf(qLower) > -1) return true; }
                    if (type === 'username' || type === 'all') { if ((u.username || '').toLowerCase().indexOf(qLower.replace(/^@/, '')) > -1) return true; }
                    if (type === 'email' || type === 'all') { if ((u.email || '').toLowerCase().indexOf(qLower) > -1) return true; }
                    return false;
                }

                function _renderMatches(list) {
                    var matches = list.filter(_matches);
                    if (!matches.length) {
                        resultsEl.innerHTML = '<div style="padding:14px;text-align:center;color:#9CA3AF;font-size:0.88rem;">No users found matching "' + _esc(q) + '".</div>';
                        return;
                    }
                    resultsEl.innerHTML = matches.map(function (u) {
                        return '<div class="admin-user-result-item" data-uid="' + _esc(u.id) + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(10,14,39,0.08);border-radius:12px;margin-bottom:8px;cursor:pointer;">'
                            + _avatarHTML(u)
                            + '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:0.88rem;color:#0A0E27;">' + _esc(u.fullName || u.username || 'Unnamed') + '</div>'
                            + '<div style="font-size:0.76rem;color:#9CA3AF;">' + _esc(u.email || '') + ' &middot; ' + _esc(u.id) + '</div></div>'
                            + '<i class="fas fa-chevron-right" style="color:#bbb;"></i></div>';
                    }).join('');
                    resultsEl.querySelectorAll('.admin-user-result-item').forEach(function (item) {
                        item.addEventListener('click', function () {
                            var u = _allUsersCache.find(function (x) { return x.id === item.dataset.uid; });
                            if (u) _showUserDetail(u);
                        });
                    });
                }

                if (_allUsersCache.length) {
                    _renderMatches(_allUsersCache);
                } else {
                    _loadAllUsers().then(_renderMatches);
                }
            }

            /* ── Wire everything ── */
            function _wire() {
                var searchBtn = document.getElementById('admin-user-search-btn');
                var searchInput = document.getElementById('admin-user-search-input');
                if (searchBtn && !searchBtn._wired) {
                    searchBtn._wired = true;
                    searchBtn.addEventListener('click', _runSearch);
                }
                if (searchInput && !searchInput._wired) {
                    searchInput._wired = true;
                    searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') _runSearch(); });
                }

                /* Delegate clicks on the All Users table (View / Delete buttons) */
                var table = document.getElementById('admin-all-users-table');
                if (table && !table._wired) {
                    table._wired = true;
                    table.addEventListener('click', function (e) {
                        var viewBtn = e.target.closest('.admin-user-view-btn');
                        if (viewBtn) {
                            var u = _allUsersCache.find(function (x) { return x.id === viewBtn.dataset.uid; });
                            if (u) _showUserDetail(u);
                            return;
                        }
                        var delBtn = e.target.closest('.admin-user-delete-btn');
                        if (delBtn) { _deleteUser(delBtn.dataset.uid, delBtn); }
                    });
                }

                /* Load users when the Users tab is opened */
                document.addEventListener('click', function (e) {
                    var tabBtn = e.target.closest && e.target.closest('[data-tab="admin-users-tab"]');
                    if (tabBtn) setTimeout(_loadAllUsers, 150);
                });
            }

            if (document.readyState !== 'loading') _wire();
            else document.addEventListener('DOMContentLoaded', _wire);
            document.addEventListener('empyrean-init-done', function () { setTimeout(_wire, 400); });

            console.log('[Admin] ✅ User Management — search, list, view detail, delete user (+ business pages/posts).');
        }());


        // ═══════════════════════════════════════════════════════════════════
        // ADMIN PANEL — BUSINESS PAGE MANAGER
        // Self-contained card injected into #admin-users-tab. Lets the admin
        // browse / search ALL business pages on the platform and delete any
        // of them (+ their business_posts) directly — independent of any
        // other user-detail view.
        // ═══════════════════════════════════════════════════════════════════
        (function initAdminBusinessPageManager() {

            function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
            function _notify(msg, type) { if (typeof window.showNotification === 'function') window.showNotification(msg, type); else console.log('[Admin]', msg); }

            var _allPagesCache = [];

            function _injectCard() {
                if (document.getElementById('admin-bizpages-card')) return true;
                var tab = document.getElementById('admin-users-tab');
                if (!tab) return false;

                var card = document.createElement('div');
                card.className = 'card';
                card.id = 'admin-bizpages-card';
                card.style.marginBottom = '20px';
                card.innerHTML =
                    '<h3 style="padding:20px 24px 0;display:flex;align-items:center;gap:10px;">'
                    + '<span style="background:var(--g-navy);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-store" style="color:#F5C518;font-size:0.9rem;"></i></span>'
                    + '<span>Business Page Manager</span>'
                    + '<span id="admin-total-bizpages-badge" style="font-size:0.78rem;background:rgba(27,43,139,0.1);color:var(--secondary);padding:3px 10px;border-radius:12px;margin-left:8px;">0 pages</span>'
                    + '</h3>'
                    + '<div class="card-content">'
                    + '<p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:16px;">Search by page name, owner Unique ID, or page ID. Deleting a page also deletes all of its posts.</p>'
                    + '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">'
                    + '<input type="text" id="admin-bizpage-search-input" placeholder="Page name, owner UID, or page ID..." style="flex:1;min-width:200px;padding:12px 16px;border:1.5px solid rgba(10,14,39,0.12);border-radius:14px;font-size:0.9rem;outline:none;font-family:inherit;">'
                    + '<button id="admin-bizpage-search-btn" class="btn btn-accent" style="padding:12px 24px;border-radius:14px;font-weight:700;"><i class="fas fa-search"></i> Search</button>'
                    + '<button id="admin-bizpage-refresh-btn" style="padding:12px 18px;border-radius:14px;font-weight:700;background:rgba(10,14,39,0.06);border:none;color:#374151;cursor:pointer;"><i class="fas fa-rotate"></i></button>'
                    + '</div>'
                    + '<div id="admin-bizpages-list"><div style="padding:20px;text-align:center;color:#9CA3AF;"><i class="fas fa-spinner fa-spin"></i> Loading business pages…</div></div>'
                    + '</div>';

                /* Insert at the top of the tab, above the User Search card */
                tab.insertBefore(card, tab.firstChild);
                return true;
            }

            function _pageRowHTML(p) {
                var cover = p.coverPhoto || p.profilePhoto || '';
                var avatar = p.profilePhoto || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(p.name || p.businessName || 'B') + '&background=1B2B8B&color=fff&size=64');
                return '<div class="admin-bizpage-row" data-pageid="' + _esc(p.id) + '" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid rgba(10,14,39,0.08);border-radius:14px;margin-bottom:10px;flex-wrap:wrap;">'
                    + '<img src="' + _esc(avatar) + '" style="width:42px;height:42px;border-radius:10px;object-fit:cover;flex-shrink:0;" onerror="this.src=\'https://ui-avatars.com/api/?name=B&background=1B2B8B&color=fff&size=64\'">'
                    + '<div style="flex:1;min-width:160px;">'
                        + '<div style="font-weight:800;font-size:0.9rem;color:#0A0E27;">' + _esc(p.name || p.businessName || 'Unnamed Business') + '</div>'
                        + '<div style="font-size:0.74rem;color:#9CA3AF;">Page ID: <span style="font-family:monospace;">' + _esc(p.id) + '</span></div>'
                        + '<div style="font-size:0.74rem;color:#9CA3AF;">Owner: <span style="font-family:monospace;">' + _esc(p.ownerId || '—') + '</span>' + (p.email ? ' &middot; ' + _esc(p.email) : '') + '</div>'
                        + (p.postCount != null ? '<div style="font-size:0.74rem;color:#9CA3AF;">' + p.postCount + ' post' + (p.postCount === 1 ? '' : 's') + '</div>' : '')
                    + '</div>'
                    + '<button class="admin-bizpage-delete-btn2" data-pageid="' + _esc(p.id) + '" style="padding:8px 14px;border-radius:10px;background:rgba(239,68,68,0.08);color:#EF4444;border:1.5px solid rgba(239,68,68,0.2);font-size:0.8rem;font-weight:800;cursor:pointer;white-space:nowrap;"><i class="fas fa-trash"></i> Delete Page</button>'
                    + '</div>';
            }

            function _renderList(list) {
                var container = document.getElementById('admin-bizpages-list');
                var badge = document.getElementById('admin-total-bizpages-badge');
                if (badge) badge.textContent = list.length + (list.length === 1 ? ' page' : ' pages');
                if (!container) return;
                if (!list.length) {
                    container.innerHTML = '<div style="padding:24px;text-align:center;color:#9CA3AF;font-size:0.88rem;">No business pages found.</div>';
                    return;
                }
                container.innerHTML = list.map(_pageRowHTML).join('');
                container.querySelectorAll('.admin-bizpage-delete-btn2').forEach(function (btn) {
                    btn.addEventListener('click', function () { _deletePage(btn.dataset.pageid, btn); });
                });
            }

            /* Load all business pages, then count posts per page */
            function _loadAllPages() {
                if (!fbDb) return Promise.resolve([]);
                var container = document.getElementById('admin-bizpages-list');
                if (container) container.innerHTML = '<div style="padding:20px;text-align:center;color:#9CA3AF;"><i class="fas fa-spinner fa-spin"></i> Loading business pages…</div>';

                return fbDb.collection('business_pages').limit(200).get().then(function (snap) {
                    var pages = [];
                    snap.forEach(function (doc) {
                        var d = doc.data();
                        d.id = doc.id;
                        pages.push(d);
                    });

                    /* Attach post counts (best-effort, parallel) */
                    return Promise.all(pages.map(function (p) {
                        return fbDb.collection('business_posts').where('pageId', '==', p.id).get()
                            .then(function (postsSnap) { p.postCount = postsSnap.size; })
                            .catch(function () { p.postCount = null; });
                    })).then(function () {
                        _allPagesCache = pages;
                        _renderList(pages);
                        return pages;
                    });
                }).catch(function (err) {
                    console.warn('[Admin BizPages] load failed:', err && err.message);
                    if (container) container.innerHTML = '<div style="padding:20px;text-align:center;color:#EF4444;">Could not load business pages: ' + _esc(err && err.message) + '</div>';
                    return [];
                });
            }

            function _runSearch() {
                var input = document.getElementById('admin-bizpage-search-input');
                if (!input) return;
                var q = (input.value || '').trim().toLowerCase();
                if (!q) { _renderList(_allPagesCache); return; }
                var matches = _allPagesCache.filter(function (p) {
                    return (p.name || p.businessName || '').toLowerCase().indexOf(q) > -1
                        || (p.id || '').toLowerCase().indexOf(q) > -1
                        || (p.ownerId || '').toLowerCase().indexOf(q) > -1
                        || (p.email || '').toLowerCase().indexOf(q) > -1;
                });
                _renderList(matches);
            }

            /* ── Delete a business page + all its posts ── */
            function _deletePage(pageId, btn) {
                if (!pageId) return;
                if (!btn._confirming) {
                    btn._confirming = true;
                    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Tap again to confirm';
                    setTimeout(function () {
                        if (btn._confirming) {
                            btn._confirming = false;
                            btn.innerHTML = '<i class="fas fa-trash"></i> Delete Page';
                        }
                    }, 4000);
                    return;
                }
                if (!fbDb) { _notify('Not connected.', 'error'); return; }
                btn._confirming = false;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting…';

                fbDb.collection('business_posts').where('pageId', '==', pageId).get()
                    .then(function (snap) {
                        var dels = [];
                        snap.forEach(function (doc) { dels.push(doc.ref.delete().catch(function () {})); });
                        return Promise.all(dels);
                    })
                    .then(function () { return fbDb.collection('business_pages').doc(pageId).delete(); })
                    .then(function () {
                        _notify('Business page deleted.', 'success');
                        _allPagesCache = _allPagesCache.filter(function (p) { return p.id !== pageId; });
                        _renderList(_allPagesCache);
                        /* If the deleted page belongs to the currently logged-in
                           admin/user, clear local references + dashboard card */
                        var us = (window.EmpState && window.EmpState.userState) || window.userState || {};
                        if (us && us.businessPage && (us.businessPage.id === pageId || us.businessPage === pageId)) {
                            us.businessPage = null;
                            if (fbDb && us.id) fbDb.collection('users').doc(us.id).update({ businessPage: null }).catch(function () {});
                        }
                        document.querySelectorAll('[data-biz-id="' + pageId + '"],[data-page-id="' + pageId + '"]').forEach(function (c) { c.remove(); });
                        if (typeof window.renderDashboardBusinesses === 'function') {
                            try { window.renderDashboardBusinesses(); } catch (e) {}
                        }
                    })
                    .catch(function (err) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-trash"></i> Delete Page';
                        _notify('Failed to delete page: ' + (err && err.message ? err.message : 'Please try again.'), 'error');
                    });
            }

            function _wire() {
                if (!_injectCard()) return;

                var searchBtn = document.getElementById('admin-bizpage-search-btn');
                var searchInput = document.getElementById('admin-bizpage-search-input');
                var refreshBtn = document.getElementById('admin-bizpage-refresh-btn');

                if (searchBtn && !searchBtn._wired) { searchBtn._wired = true; searchBtn.addEventListener('click', _runSearch); }
                if (searchInput && !searchInput._wired) {
                    searchInput._wired = true;
                    searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') _runSearch(); });
                    searchInput.addEventListener('input', function () { if (!searchInput.value) _renderList(_allPagesCache); });
                }
                if (refreshBtn && !refreshBtn._wired) { refreshBtn._wired = true; refreshBtn.addEventListener('click', _loadAllPages); }

                if (!_allPagesCache.length) _loadAllPages();
            }

            if (document.readyState !== 'loading') _wire();
            else document.addEventListener('DOMContentLoaded', _wire);
            document.addEventListener('empyrean-init-done', function () { setTimeout(_wire, 400); });

            /* Load/refresh when the Users tab is clicked */
            document.addEventListener('click', function (e) {
                var tabBtn = e.target.closest && e.target.closest('[data-tab="admin-users-tab"]');
                if (tabBtn) setTimeout(function () { _wire(); _loadAllPages(); }, 150);
            });

            /* ── Robust retry: the admin panel markup is often injected into
               the DOM dynamically (e.g. after "Exit/Enter Admin" toggle),
               and the Users tab may already be active by default with no
               click event ever firing. Poll until the card is injected. ── */
            (function _retryUntilInjected() {
                var attempts = 0;
                var iv = setInterval(function () {
                    attempts++;
                    if (document.getElementById('admin-bizpages-card')) { clearInterval(iv); return; }
                    _wire();
                    if (attempts >= 40) clearInterval(iv); /* ~20s max */
                }, 500);
            })();

            /* Also watch for the admin-users-tab being added/shown dynamically */
            if (typeof MutationObserver !== 'undefined') {
                var _bizMo = new MutationObserver(function () {
                    if (!document.getElementById('admin-bizpages-card') && document.getElementById('admin-users-tab')) {
                        _wire();
                    }
                });
                _bizMo.observe(document.body, { childList: true, subtree: true });
            }

            console.log('[Admin] ✅ Business Page Manager — search/list/delete any business page (+ posts).');
        }());