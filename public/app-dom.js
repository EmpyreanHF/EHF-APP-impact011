// =====================================================
        // FIREBASE — use globals set by head initialization
        // =====================================================
        // Re-attempt init in case SDK loaded after head script ran
        if (!window._firebaseLoaded && typeof firebase !== 'undefined') {
            window._initFirebase();
        }
        // Local aliases that always point to working implementations
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
        // CLOUDINARY CONFIG (Primary media storage)
        // ─────────────────────────────────────────────────────
        // These are PUBLIC frontend credentials — the cloud name
        // and unsigned upload preset are safe to hardcode here.
        // DO NOT make this depend on /api/config: if that request
        // is slow or missing, uploads fail for every user.
        // FIX: read from window._appConfig.cloudinary (pre-seeded
        // synchronously in index.html, so it's available immediately —
        // no async wait required) with the current live credentials
        // as the hardcoded fallback. The old hardcoded values here
        // (dxcthrgsp / Empyrean_preset) pointed at a disabled/renamed
        // Cloudinary account and broke every upload path in the app.
        // =====================================================
        const _cldCfg           = (window._appConfig && window._appConfig.cloudinary) || {};
        const CLOUDINARY_CLOUD  = _cldCfg.cloud  || 'dxwmts9vw';
        const CLOUDINARY_PRESET = _cldCfg.preset || 'ehfapp_preset';  // must match Cloudinary dashboard exactly
        const CLOUDINARY_URL    = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/auto/upload';

        // ── PRESET SANITY CHECK (runs once on page load) ──────
        // Verifies the Cloudinary endpoint is reachable without consuming upload quota.
        (function _verifyCloudinaryPreset() {
            fetch(CLOUDINARY_URL, { method: 'OPTIONS' })
                .then(function(r) {
                    if (r.ok || r.status === 204 || r.status === 405) {
                        console.info('[Cloudinary] ✅ Endpoint reachable — uploads enabled.');
                    }
                })
                .catch(function() {
                    console.warn('[Cloudinary] Preset check skipped — network unavailable (upload will retry when user posts).');
                });
        })();

        // Compress images before upload — reduces upload size by 60-80%
        // Videos and non-image files are passed through unchanged.
        async function _compressImage(file, maxW, maxH, quality) {
            if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
            maxW = maxW || 1920; maxH = maxH || 1920; quality = quality || 0.95;
            return new Promise(function(resolve) {
                var img = new Image();
                var url = URL.createObjectURL(file);
                img.onload = function() {
                    URL.revokeObjectURL(url);
                    var w = img.width, h = img.height;
                    if (w <= maxW && h <= maxH) { resolve(file); return; }
                    var scale = Math.min(maxW / w, maxH / h);
                    var canvas = document.createElement('canvas');
                    canvas.width  = Math.round(w * scale);
                    canvas.height = Math.round(h * scale);
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(function(blob) {
                        if (!blob || blob.size >= file.size) { resolve(file); return; }
                        var compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                        console.info('[Cloudinary] 🗜 Compressed image: ' + Math.round(file.size/1024) + 'KB → ' + Math.round(compressed.size/1024) + 'KB');
                        resolve(compressed);
                    }, 'image/jpeg', quality);
                };
                img.onerror = function() { URL.revokeObjectURL(url); resolve(file); };
                img.src = url;
            });
        }

        // Expose uploadToCloudinary globally so secondary scripts can call it.
        // CRITICAL RULE: This function MUST either resolve with a real
        // https://res.cloudinary.com/... URL or reject.  It must NEVER
        // resolve with a blob:// URL — those are tab-local and invisible
        // to every other device/user when stored in Firestore.
        window.uploadToCloudinary = async function uploadToCloudinary(file, onProgress) {
            // If already a URL string (e.g. existing post being re-saved), pass through unchanged
            if (!file || !(file instanceof File)) {
                if (typeof file === 'string') return file;
                return Promise.reject(new Error('uploadToCloudinary: invalid argument — expected a File'));
            }

            // Compress images before upload (videos/gifs pass through unchanged)
            file = await _compressImage(file);

            return new Promise((resolve, reject) => {
                // No timeout — let the upload complete regardless of file size or connection speed
                const UPLOAD_TIMEOUT_MS = 0;

                const fd = new FormData();
                fd.append('file', file);
                fd.append('upload_preset', CLOUDINARY_PRESET);
                fd.append('tags', 'empyrean_app');

                const xhr = new XMLHttpRequest();
                xhr.open('POST', CLOUDINARY_URL, true);
                xhr.timeout = UPLOAD_TIMEOUT_MS;

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        if (onProgress) onProgress(pct);
                        document.querySelectorAll('.upload-progress-bar').forEach(bar => {
                            bar.style.width = pct + '%';
                            bar.style.background = 'linear-gradient(90deg,#00897B,#4CAF50)';
                        });
                    }
                };

                xhr.onload = () => {
                    if (xhr.status === 200) {
                        let res;
                        try { res = JSON.parse(xhr.responseText); }
                        catch (e) {
                            console.error('[Cloudinary] ❌ Could not parse response JSON:', e);
                            return reject(new Error('Cloudinary response was not valid JSON'));
                        }
                        if (!res.secure_url) {
                            // Cloudinary returned 200 but no URL — very unusual; log the full response
                            console.error('[Cloudinary] ❌ Response missing secure_url. Full response:', res);
                            return reject(new Error('Cloudinary returned 200 but no secure_url'));
                        }
                        console.info('[Cloudinary] ✅ Upload successful:', {
                            public_id: res.public_id,
                            format: res.format,
                            size_kb: Math.round((res.bytes || 0) / 1024),
                            url: res.secure_url.substring(0, 80) + '...'
                        });
                        window._cloudinaryUploads = (window._cloudinaryUploads || 0) + 1;
                        resolve(res.secure_url);
                    } else {
                        // Log the full error body so the root cause is visible in the console
                        let errMsg = 'HTTP ' + xhr.status;
                        try {
                            const errBody = JSON.parse(xhr.responseText);
                            errMsg += ' — ' + (errBody.error && errBody.error.message || xhr.responseText);
                            // Common actionable errors:
                            if (xhr.status === 400 && errMsg.includes('preset')) {
                                console.error('[Cloudinary] ❌ Upload preset error. Go to Cloudinary Dashboard → Settings → Upload → Upload Presets and verify "' + CLOUDINARY_PRESET + '" exists and is UNSIGNED.');
                            } else if (xhr.status === 401) {
                                console.error('[Cloudinary] ❌ Unauthorized. The preset "' + CLOUDINARY_PRESET + '" may be set to SIGNED mode. Switch it to UNSIGNED in your Cloudinary dashboard.');
                            }
                        } catch(e) { /* non-JSON error body, use status only */ }
                        console.error('[Cloudinary] ❌ Upload failed:', errMsg);
                        if (typeof showNotification === 'function') showNotification('Media upload failed: ' + errMsg, 'error');
                        reject(new Error('Cloudinary upload failed: ' + errMsg));
                    }
                };

                xhr.onerror = () => {
                    console.error('[Cloudinary] ❌ Network error — XHR onerror fired. Check if Cloudinary is reachable.');
                    reject(new Error('Network error — could not reach Cloudinary'));
                };
                xhr.ontimeout = () => {
                    reject(new Error('XHR timed out during upload'));
                };

                xhr.send(fd);
            });
        };
        const uploadToCloudinary = window.uploadToCloudinary;

        async function uploadMediaFilesToCloudinary(files, onProgress) {
            if (!files || files.length === 0) return [];
            const uploads = Array.from(files).map(async (file, idx) => {
                // Already a URL string (e.g. existing media being re-saved)
                if (typeof file === 'string') {
                    if (file.startsWith('blob:')) {
                        // Blob URLs stored from a previous bug — reject so the post is blocked
                        console.error('[uploadMedia] ❌ Refusing to re-save a blob:// URL — this file was never actually uploaded to Cloudinary.');
                        throw new Error('Media was not properly uploaded. Please re-attach the file and try again.');
                    }
                    return file;
                }
                // Non-File object with a cached cloud URL
                if (!(file instanceof File)) {
                    const cached = file._cloudUrl || file.url || '';
                    if (cached.startsWith('blob:')) {
                        throw new Error('Cached media URL is a blob — re-attach the file and try again.');
                    }
                    return cached;
                }
                // Validate file size (max 100 MB)
                if (file.size > 100 * 1024 * 1024) {
                    const msg = '"' + file.name + '" is too large (max 100 MB).';
                    if (typeof showNotification === 'function') showNotification(msg, 'error');
                    throw new Error(msg);
                }
                try {
                    const url = await uploadToCloudinary(file, (pct) => {
                        if (onProgress) onProgress(idx, pct);
                    });
                    // url is guaranteed to be https://res.cloudinary.com/... at this point
                    file._cloudUrl = url;
                    return url;
                } catch(err) {
                    console.error('[uploadMedia] ❌ Upload failed for "' + file.name + '":', err.message);
                    if (typeof showNotification === 'function')
                        showNotification('Upload failed for "' + file.name + '": ' + err.message, 'error');
                    return ''; // return empty string so the rest of the post can still proceed
                }
            });
            return Promise.all(uploads);
        }
        window.uploadMediaFilesToCloudinary = uploadMediaFilesToCloudinary;

        // =====================================================
        // FLUTTERWAVE PAYMENT GATEWAY — keys from /api/config
        // =====================================================
        const _flw = window._appConfig && window._appConfig.flutterwave;
        const FLW_PUBLIC_KEY = (_flw && _flw.publicKey) || '';
        // FLW_SECRET_KEY and FLW_ENCRYPTION_KEY live only on the server.
        // Transaction verification is proxied through /api/flw/verify.
        function initiateFlutterwavePayment(opts) {
            const txRef = 'EMPY-' + Date.now() + '-' + Math.floor(Math.random()*10000);
            if (typeof FlutterwaveCheckout === 'undefined') {
                console.warn('Flutterwave not loaded — retrying...');
                // Dynamically load if missed on page load
                const s = document.createElement('script');
                s.src = 'https://checkout.flutterwave.com/v3.js';
                s.onload = function() { initiateFlutterwavePayment(opts); };
                s.onerror = function() { if (opts.onFailure) opts.onFailure({ status: 'error', message: 'Payment gateway unavailable' }); };
                document.body.appendChild(s);
                return;
            }
            FlutterwaveCheckout({
                public_key: FLW_PUBLIC_KEY,
                tx_ref: txRef,
                amount: opts.amount,
                currency: opts.currency || 'NGN',
                payment_options: 'card,ussd,banktransfer,mobilemoney',
                customer: {
                    email: opts.email || (window.userState && window.userState.email) || 'user@empyrean.com',
                    phone_number: opts.phone || (window.userState && window.userState.phone) || '',
                    name: opts.name || (window.userState && window.userState.fullName) || 'Empyrean User'
                },
                customizations: {
                    title: 'Empyrean Humanitarian Platform',
                    description: opts.description || 'Payment',
                    logo: window._empyreanLogoSrc || ''
                },
                meta: { verified_server_side: true },   // verification via /api/flw/verify
                callback: function(response) {
                    if (response.status === 'successful') {
                        fbDb.collection('flw_transactions').doc(txRef).set({
                            txRef, amount: opts.amount, currency: opts.currency || 'NGN',
                            purpose: opts.purpose || 'general', status: 'held',
                            createdAt: _serverTimestamp()
                        }).catch(e => console.error('FLW tx save error:', e));
                        if (opts.onSuccess) opts.onSuccess(response, txRef);
                    } else {
                        if (opts.onFailure) opts.onFailure(response);
                    }
                },
                onclose: function() { if (opts.onClose) opts.onClose(); }
            });
        }

        // Firebase user helpers
        async function saveUserToFirestore(uid, userData) {
            // Wait up to 6 s for the real Firebase SDK to be ready
            if (!window._firebaseLoaded || !fbDb || !fbDb.collection) {
                await new Promise(function(resolve) {
                    var waited = 0;
                    var t = setInterval(function() {
                        waited += 300;
                        if ((window._firebaseLoaded && fbDb && fbDb.collection) || waited >= 6000) {
                            clearInterval(t); resolve();
                        }
                    }, 300);
                });
            }
            if (!fbDb || !fbDb.collection) {
                console.error('[saveUser] Firebase unavailable — cannot save uid:', uid);
                return;
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
            // Wait up to 6 s for the real Firebase SDK to be ready
            if (!window._firebaseLoaded || !fbDb || !fbDb.collection) {
                await new Promise(function(resolve) {
                    var waited = 0;
                    var t = setInterval(function() {
                        waited += 300;
                        if ((window._firebaseLoaded && fbDb && fbDb.collection) || waited >= 6000) {
                            clearInterval(t); resolve();
                        }
                    }, 300);
                });
            }
            if (!fbDb || !fbDb.collection) {
                console.error('[loadUser] Firebase unavailable — cannot load uid:', uid);
                return null;
            }
            const doc = await fbDb.collection('users').doc(uid).get();
            if (!doc.exists) return null;
            const data = doc.data();
            ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds']
                .forEach(k => { data[k] = new Set(data[k] || []); });
            return data;
        }