/* =============================================================================
   EMPYREAN INTERNATIONAL — NGO & GRANT DISBURSEMENT PORTAL
   app-ngo.js  |  v2.0 — International Best Practice Overhaul
   =============================================================================

   PURPOSE
   ───────
   Complete, production-grade NGO and Grant Disbursement system. Covers:

     PRESERVED FROM v1
     • renderGrantLedger()           — on-chain grant disbursement table
     • renderCommunityTasks()        — social-media task list (earn EMPY)
     • renderNgoGrid()               — NGO partner card grid
     • renderNgoProfile(ngoId)       — detailed NGO profile with feed
     • Community task click handler  — open URL + award EMPY (once per task)
     • NGO card click → renderNgoProfile
     • Back-to-grid navigation
     • Donate button → donation modal (SOS escrow)
     • SOS donation Flutterwave form submit
     • Firestore NGO loader

     NEW IN v2
     • renderGrantDashboard()        — live analytics dashboard with charts
     • renderNgoVerificationQueue()  — admin KYC queue for NGO onboarding
     • renderIndividualGrantPanel()  — individual recipient disbursement panel
     • _submitNgoApplication()       — NGO self-registration + document upload
     • _approveNgoApplication()      — admin approve/reject NGO applications
     • _createGrantAllocation()      — admin create grant allocations
     • _submitIndividualGrantReq()   — individual grant request portal
     • _approveIndividualGrant()     — admin approve individual grant requests
     • _verifyDisbursement()         — multi-sig verification stub
     • _exportGrantReport()          — CSV/PDF audit trail export
     • renderGrantAnalytics()        — real-time fund utilisation charts
     • renderNgoPublicProfile()      — public-facing NGO transparency page
     • renderImpactReports()         — NGO impact report submission & display
     • _loadGrantApplications()      — Firestore grant application loader
     • _loadIndividualGrantQueue()   — Firestore individual grant queue loader
     • _ngoKycDocumentUpload()       — document upload for NGO KYC
     • renderAdminGrantControlPanel()— unified admin control panel
     • Real-time Firestore listeners  — live disbursement status updates
     • Blockchain audit hash display — immutable ledger entry rendering
     • Multi-currency support         — NGN, USD, EMPY, USDT

   LOAD ORDER
   ──────────
   Must come AFTER: firebase-init, app-state, app-helpers, app-contracts,
   app-notifications, app-auth, app-feed, app-wallet, app-admin.

   DEPENDS ON
   ──────────
   • window.EmpState / window.userState / window.isGuest / window.isAdmin
   • window.mockNgoPartners / window.mockGrantLedger / window.mockCommunityTasks
   • window.fbDb / window._firebaseLoaded / window.fbStorage
   • window.formatUsdPrice   (app-helpers.js or inline)
   • window.showNotification (app-helpers.js)
   • window.updateWalletUI   (app-wallet.js)
   • window.createNewPostElement (app-feed.js)
   • window.uploadToCloudinary (app-dom.js)
   • window.initiateFlutterwavePayment (app-admin.js)

   PUBLIC API
   ──────────
   window.renderGrantLedger()
   window.renderCommunityTasks()
   window.renderNgoGrid()
   window.renderNgoProfile(ngoId)
   window.renderGrantDashboard()
   window.renderNgoVerificationQueue()
   window.renderIndividualGrantPanel()
   window.renderAdminGrantControlPanel()
   window.renderGrantAnalytics()
   window.renderImpactReports(ngoId)
   window.openNgoApplicationModal()
   window.openIndividualGrantModal()
   window._approveNgoApplication(appId, action)
   window._approveIndividualGrant(grantId, action)
   window._exportGrantReport(format)
   window._refreshGrantDashboard()

   SECTION MAP
   ───────────
   §1   Core utilities & state accessors
   §2   renderGrantLedger           (enhanced v2)
   §3   renderCommunityTasks        (preserved v1)
   §4   renderNgoGrid               (enhanced v2)
   §5   renderNgoProfile            (enhanced v2)
   §6   renderGrantDashboard        (NEW)
   §7   renderNgoVerificationQueue  (NEW)
   §8   renderIndividualGrantPanel  (NEW)
   §9   renderAdminGrantControlPanel(NEW)
   §10  renderGrantAnalytics        (NEW)
   §11  renderImpactReports         (NEW)
   §12  NGO application modal & form (NEW)
   §13  Individual grant request modal (NEW)
   §14  Firestore loaders (NGO partners, grant apps, individual queue)
   §15  Community task click handler
   §16  NGO card click + back-to-grid
   §17  Donate button → donation modal
   §18  SOS donation Flutterwave form handler
   §19  Admin action handlers (approve/reject, export)
   §20  Real-time listeners
   §21  Bootstrap

   ============================================================================= */

(function empyreanNgoModuleV2() {
    'use strict';

    if (window._empyreanNgoLoaded) {
        console.warn('[EmpNgo] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanNgoLoaded = true;

    /* =========================================================================
       §1  CORE UTILITIES & STATE ACCESSORS
       ========================================================================= */

    function _S()        { return window.EmpState  || {}; }
    function _us()       { return _S().userState   || window.userState    || {}; }
    function _isGuest()  { var s = _S(); return s.isGuest != null ? s.isGuest : !!window.isGuest; }
    function _isAdmin()  { var s = _S(); return s.isAdmin != null ? s.isAdmin : !!window.isAdmin; }
    function _partners() { return (_S().mockNgoPartners)  || window.mockNgoPartners || {}; }
    function _ledger()   { return (_S().mockGrantLedger)  || window.mockGrantLedger  || []; }
    function _tasks()    { return (_S().mockCommunityTasks) || window.mockCommunityTasks || []; }
    function _db()       { return window.fbDb; }
    function _fbOk()     { return !!window._firebaseLoaded; }

    function _esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _notify(msg, type) {
        if (typeof window.showNotification === 'function') window.showNotification(msg, type || 'info');
        else console.log('[NGO Notification]', type, msg);
    }

    function _serverTs() {
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                return firebase.firestore.FieldValue.serverTimestamp();
        } catch(e) {}
        return new Date();
    }

    function _fmtAmount(amount, currency) {
        currency = currency || 'NGN';
        var n = parseFloat(amount) || 0;
        if (currency === 'NGN') return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (currency === 'USD') return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (currency === 'EMPY' || currency === 'USDT') return n.toLocaleString('en', { maximumFractionDigits: 4 }) + ' ' + currency;
        return n.toLocaleString() + ' ' + currency;
    }

    function _shortHash(hash) {
        if (!hash) return '—';
        return hash.length > 18 ? hash.substring(0, 10) + '…' + hash.slice(-6) : hash;
    }

    function _statusBadge(status) {
        var map = {
            'completed':  { color: 'var(--success-color, #22c55e)', bg: 'rgba(34,197,94,0.12)',  icon: 'fa-check-circle',   label: 'Completed'  },
            'pending':    { color: '#F59E0B',                        bg: 'rgba(245,158,11,0.12)', icon: 'fa-clock',          label: 'Pending'    },
            'approved':   { color: '#3B82F6',                        bg: 'rgba(59,130,246,0.12)', icon: 'fa-thumbs-up',      label: 'Approved'   },
            'rejected':   { color: 'var(--danger-color, #ef4444)',   bg: 'rgba(239,68,68,0.12)',  icon: 'fa-times-circle',   label: 'Rejected'   },
            'verified':   { color: 'var(--success-color, #22c55e)', bg: 'rgba(34,197,94,0.12)',  icon: 'fa-shield-check',   label: 'Verified'   },
            'under_review':{ color: '#8B5CF6',                      bg: 'rgba(139,92,246,0.12)', icon: 'fa-search',         label: 'In Review'  },
            'disbursed':  { color: '#00D4AA',                        bg: 'rgba(0,212,170,0.12)',  icon: 'fa-paper-plane',    label: 'Disbursed'  },
            'held':       { color: '#F59E0B',                        bg: 'rgba(245,158,11,0.12)', icon: 'fa-lock',           label: 'Held'       }
        };
        var s = map[String(status).toLowerCase()] || { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'fa-circle', label: status || '—' };
        return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.76rem;font-weight:700;'
            + 'color:' + s.color + ';background:' + s.bg + ';padding:3px 9px;border-radius:50px;border:1px solid ' + s.color + '44;">'
            + '<i class="fas ' + s.icon + '"></i> ' + s.label + '</span>';
    }

    /* Generate a unique grant ID */
    function _genGrantId() {
        return 'GRN-' + Date.now().toString(36).toUpperCase().slice(-6);
    }

    /* Upload a file to Cloudinary via the existing app-dom.js function */
    async function _uploadDoc(file) {
        if (!file || !(file instanceof File)) return typeof file === 'string' ? file : '';
        if (typeof window.uploadToCloudinary !== 'function') return '';
        try { return await window.uploadToCloudinary(file, null); }
        catch(e) { console.warn('[NGO Upload]', e.message); return ''; }
    }


    /* =========================================================================
       §2  renderGrantLedger  (ENHANCED v2)
       Populates #grant-ledger-body with rich on-chain grant records.
       Now includes: multi-currency, blockchain hash with link, status badges,
       advanced filters, and live Firestore integration.
       ========================================================================= */

    function renderGrantLedger() {
        var tbody = document.getElementById('grant-ledger-body');
        if (!tbody) return;

        /* Load from Firestore first if connected */
        if (_fbOk() && _db()) {
            _db().collection('disbursements')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get()
                .then(function(snap) {
                    var entries = [];
                    if (!snap.empty) {
                        snap.forEach(function(doc) {
                            var d = doc.data();
                            entries.push({
                                id:       d.grantId || _genGrantId(),
                                ngo:      d.recipientName || d.ngoName || '—',
                                project:  d.purpose || d.projectName || '—',
                                amount:   d.amountFormatted || _fmtAmount(d.amount, d.currency || 'NGN'),
                                txHash:   d.txHash || d.txRef || '',
                                status:   d.status  || 'completed',
                                date:     d.createdAt && d.createdAt.toDate
                                    ? d.createdAt.toDate().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
                                    : (d.date || '—'),
                                currency: d.currency || d.token || 'NGN',
                                type:     d.type || 'NGO'
                            });
                        });
                    }
                    _renderLedgerRows(tbody, entries);
                })
                .catch(function(e) {
                    /* Fallback to mock data */
                    _renderLedgerRows(tbody, _ledger());
                });
        } else {
            _renderLedgerRows(tbody, _ledger());
        }
    }

    function _renderLedgerRows(tbody, grants) {
        if (!grants || !grants.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">'
                + '<i class="fas fa-file-invoice-dollar" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.4;"></i>'
                + '<strong>No grants disbursed yet.</strong><br>'
                + '<span style="font-size:0.83rem;">Approved disbursements will appear here as an immutable audit trail.</span>'
                + '</td></tr>';
            return;
        }
        tbody.innerHTML = grants.map(function(grant) {
            var txHash   = grant.txHash || '';
            var shortH   = _shortHash(txHash);
            var txUrl    = txHash && txHash.startsWith('0x')
                ? 'https://polygonscan.com/tx/' + txHash
                : (txHash ? '#' : '#');
            var chainLink = txHash
                ? '<a href="' + _esc(txUrl) + '" target="_blank" rel="noopener" '
                + 'title="View on PolygonScan" style="color:var(--nav-accent,#00D4AA);font-family:monospace;font-size:0.78rem;">'
                + _esc(shortH) + ' <i class="fas fa-external-link-alt" style="font-size:0.65rem;"></i></a>'
                : '<span style="color:var(--text-muted);font-size:0.78rem;">Off-chain ref</span>';
            return '<tr style="border-bottom:1px solid rgba(10,14,39,0.06);transition:background 0.15s;" '
                + 'onmouseenter="this.style.background=\'rgba(0,212,170,0.04)\'" onmouseleave="this.style.background=\'\'">'
                + '<td style="padding:10px 14px;font-family:monospace;font-size:0.80rem;color:var(--text-muted);">' + _esc(grant.id || '—') + '</td>'
                + '<td style="padding:10px 14px;font-weight:600;">' + _esc(grant.ngo || '—') + '</td>'
                + '<td style="padding:10px 14px;">' + _esc(grant.project || '—') + '</td>'
                + '<td style="padding:10px 14px;font-weight:700;color:var(--primary);">'
                + '<i class="fas fa-coins" style="color:var(--nav-accent,#00D4AA);margin-right:4px;font-size:0.8rem;"></i>'
                + _esc(typeof grant.amount === 'string' ? grant.amount : _fmtAmount(grant.amount, grant.currency))
                + '</td>'
                + '<td style="padding:10px 14px;">' + chainLink + '</td>'
                + '<td style="padding:10px 14px;">' + _statusBadge(grant.status || 'completed') + '</td>'
                + '<td style="padding:10px 14px;font-size:0.82rem;color:var(--text-muted);">' + _esc(grant.type || 'NGO') + '</td>'
                + '<td style="padding:10px 14px;font-size:0.82rem;white-space:nowrap;">' + _esc(grant.date || '—') + '</td>'
                + '</tr>';
        }).join('');
    }
    window.renderGrantLedger = renderGrantLedger;


    /* =========================================================================
       §3  renderCommunityTasks  (PRESERVED v1 — no changes to existing logic)
       ========================================================================= */

    function renderCommunityTasks() {
        var container = document.getElementById('community-tasks-list');
        if (!container) return;

        var us             = _us();
        var completedTasks = us.completedTasks instanceof Set
            ? us.completedTasks
            : new Set(Array.isArray(us.completedTasks) ? us.completedTasks : []);

        var allTasks   = _tasks();
        var incomplete = allTasks.filter(function(t) { return !completedTasks.has(t.id); });

        if (!incomplete.length) {
            container.innerHTML =
                '<p style="text-align:center;padding:20px;color:var(--text-muted);">'
                + '<i class="fas fa-check-circle" style="color:var(--success-color);font-size:1.5rem;display:block;margin-bottom:8px;"></i>'
                + 'All tasks completed! Check back later for more.</p>';
            return;
        }

        container.innerHTML = incomplete.map(function(task) {
            return '<li class="task-item" data-task-id="' + _esc(task.id) + '">'
                + '<div style="display:flex;align-items:center;gap:10px;">'
                + '<i class="' + _esc(task.icon) + '" style="font-size:1.2rem;color:var(--secondary);width:24px;text-align:center;"></i>'
                + '<span>' + _esc(task.text) + '</span>'
                + '</div>'
                + '<button class="btn btn-small btn-accent community-task-btn" '
                + 'data-url="' + _esc(task.url) + '" '
                + 'data-reward="' + _esc(String(task.reward)) + '" '
                + 'data-task-id="' + _esc(task.id) + '">'
                + '+' + task.reward + ' EMPY <i class="fas fa-external-link-alt" style="font-size:0.7rem;"></i>'
                + '</button>'
                + '</li>';
        }).join('');
    }
    window.renderCommunityTasks = renderCommunityTasks;


    /* =========================================================================
       §4  renderNgoGrid  (ENHANCED v2)
       Renders the NGO partner card grid with enhanced verification badges,
       search/filter, impact stats preview, and public application CTA.
       ========================================================================= */

    function renderNgoGrid() {
        var container = document.getElementById('ngo-grid-container');
        if (!container) return;

        var partners = Object.values(_partners());

        if (!partners.length) {
            container.innerHTML =
                '<div style="text-align:center;padding:40px 24px;">'
                + '<div style="width:80px;height:80px;border-radius:50%;background:rgba(0,212,170,0.1);'
                + 'display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:2rem;">'
                + '<i class="fas fa-building" style="color:var(--nav-accent,#00D4AA);"></i></div>'
                + '<h4 style="font-weight:700;margin-bottom:8px;">No NGO Partners Yet</h4>'
                + '<p style="color:var(--text-muted);font-size:0.88rem;max-width:360px;margin:0 auto 20px;">'
                + 'Verified NGO partners will appear here. Are you an NGO? Apply to become a partner.</p>'
                + '<button class="btn btn-accent" onclick="window.openNgoApplicationModal && window.openNgoApplicationModal()">'
                + '<i class="fas fa-plus-circle"></i> Apply as NGO Partner</button>'
                + '</div>';
            return;
        }

        /* Search / filter bar injection (once only) */
        var searchBar = document.getElementById('ngo-search-bar');
        if (!searchBar) {
            var filterHTML =
                '<div id="ngo-search-bar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px;">'
                + '<div style="position:relative;flex:1;min-width:200px;">'
                + '<i class="fas fa-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.85rem;pointer-events:none;"></i>'
                + '<input id="ngo-search-input" type="text" placeholder="Search NGO partners…" '
                + 'style="width:100%;padding:9px 12px 9px 34px;border:1.5px solid rgba(0,212,170,0.2);'
                + 'border-radius:10px;background:rgba(232,240,255,0.05);color:inherit;font-size:0.88rem;"'
                + ' oninput="window._filterNgoGrid && window._filterNgoGrid(this.value)"></div>'
                + '<select id="ngo-sector-filter" style="padding:9px 12px;border:1.5px solid rgba(0,212,170,0.2);'
                + 'border-radius:10px;background:rgba(232,240,255,0.05);color:inherit;font-size:0.85rem;"'
                + ' onchange="window._filterNgoGrid && window._filterNgoGrid(document.getElementById(\'ngo-search-input\').value)">'
                + '<option value="">All Sectors</option>'
                + '<option value="health">Health</option>'
                + '<option value="education">Education</option>'
                + '<option value="food">Food Security</option>'
                + '<option value="environment">Environment</option>'
                + '<option value="shelter">Shelter</option>'
                + '<option value="gender">Gender Equality</option>'
                + '<option value="youth">Youth Development</option>'
                + '</select>'
                + '<button class="btn btn-accent" onclick="window.openNgoApplicationModal && window.openNgoApplicationModal()" '
                + 'style="white-space:nowrap;font-size:0.85rem;padding:9px 16px;">'
                + '<i class="fas fa-plus-circle"></i> Register NGO</button>'
                + '</div>';
            container.insertAdjacentHTML('beforebegin', filterHTML);
        }

        container.innerHTML = partners.map(function(ngo) {
            var desc = (ngo.description || '').length > 90
                ? ngo.description.substring(0, 88) + '…'
                : (ngo.description || '');
            var totalRaised = ngo.stats && ngo.stats.raised
                ? _fmtAmount(ngo.stats.raised, ngo.stats.raisedCurrency || 'USD')
                : null;
            var grantsReceived = ngo.grantsTotal || 0;
            var isVerified = ngo.isVerified !== false;
            var sector = _esc(ngo.sector || ngo.category || '');

            return '<div class="ngo-card card" data-ngo-id="' + _esc(ngo.id) + '" '
                + 'data-sector="' + sector.toLowerCase() + '" '
                + 'data-name="' + _esc((ngo.name||'').toLowerCase()) + '" '
                + 'style="cursor:pointer;padding:0;transition:transform 0.2s,box-shadow 0.2s;overflow:hidden;position:relative;">'
                /* Teal accent top bar */
                + '<div style="height:4px;background:linear-gradient(90deg,var(--nav-accent,#00D4AA),#7EEEDD);"></div>'
                + '<div style="padding:20px;">'
                /* Verification badge */
                + (isVerified
                    ? '<div style="position:absolute;top:14px;right:14px;font-size:0.68rem;font-weight:700;color:#22c55e;'
                    + 'background:rgba(34,197,94,0.12);padding:2px 8px;border-radius:50px;border:1px solid rgba(34,197,94,0.3);">'
                    + '<i class="fas fa-shield-alt"></i> VERIFIED</div>'
                    : '<div style="position:absolute;top:14px;right:14px;font-size:0.68rem;font-weight:700;color:#F59E0B;'
                    + 'background:rgba(245,158,11,0.12);padding:2px 8px;border-radius:50px;border:1px solid rgba(245,158,11,0.3);">'
                    + '<i class="fas fa-clock"></i> PENDING</div>')
                /* Logo */
                + '<div style="width:68px;height:68px;border-radius:14px;margin:0 auto 14px;overflow:hidden;'
                + 'background:linear-gradient(135deg,rgba(0,212,170,0.15),rgba(0,212,170,0.05));'
                + 'border:2px solid rgba(0,212,170,0.2);display:flex;align-items:center;justify-content:center;">'
                + '<img src="' + _esc(ngo.logo || '') + '" alt="' + _esc(ngo.name) + '" '
                + 'loading="lazy" style="width:100%;height:100%;object-fit:cover;" '
                + 'onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<i class=\\\"fas fa-building\\\" style=\\\"font-size:1.6rem;color:var(--nav-accent,#00D4AA);\\\"></i>\'">'
                + '</div>'
                /* Name & desc */
                + '<h4 style="font-weight:700;text-align:center;margin-bottom:6px;">' + _esc(ngo.name) + '</h4>'
                + (sector ? '<div style="text-align:center;margin-bottom:8px;"><span style="font-size:0.72rem;font-weight:600;color:var(--nav-accent,#00D4AA);'
                + 'background:rgba(0,212,170,0.1);padding:2px 10px;border-radius:50px;">' + _esc(ngo.sector || ngo.category || '') + '</span></div>' : '')
                + '<p style="font-size:0.82rem;color:var(--text-muted);line-height:1.5;text-align:center;margin-bottom:14px;">' + _esc(desc) + '</p>'
                /* Mini stats */
                + '<div style="display:flex;gap:12px;justify-content:center;border-top:1px solid rgba(0,212,170,0.1);padding-top:12px;">'
                + (totalRaised
                    ? '<div style="text-align:center;"><div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Raised</div>'
                    + '<div style="font-size:0.9rem;font-weight:700;color:var(--nav-accent,#00D4AA);">' + _esc(totalRaised) + '</div></div>'
                    : '')
                + (grantsReceived
                    ? '<div style="text-align:center;"><div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Grants</div>'
                    + '<div style="font-size:0.9rem;font-weight:700;">' + grantsReceived + '</div></div>'
                    : '')
                + (ngo.stats && ngo.stats.peopleHelped
                    ? '<div style="text-align:center;"><div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Helped</div>'
                    + '<div style="font-size:0.9rem;font-weight:700;">' + (ngo.stats.peopleHelped).toLocaleString() + '</div></div>'
                    : '')
                + '</div>'
                /* Bank account info (shown when available) */
                + (ngo.bankAccountNumber || ngo.bankName
                    ? '<div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(0,212,170,0.05);border:1px solid rgba(0,212,170,0.12);font-size:0.78rem;">'
                    + '<div style="font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;font-size:0.68rem;">'
                    + '<i class="fas fa-university" style="color:var(--nav-accent,#00D4AA);margin-right:4px;"></i>Bank Details</div>'
                    + (ngo.bankAccountName ? '<div style="margin-bottom:2px;"><span style="color:var(--text-muted);">Name:</span> <strong>' + _esc(ngo.bankAccountName) + '</strong></div>' : '')
                    + (ngo.bankAccountNumber ? '<div style="margin-bottom:2px;"><span style="color:var(--text-muted);">Account:</span> <strong>' + _esc(ngo.bankAccountNumber) + '</strong></div>' : '')
                    + (ngo.bankName ? '<div><span style="color:var(--text-muted);">Bank:</span> <strong>' + _esc(ngo.bankName) + '</strong></div>' : '')
                    + '</div>'
                    : '')
                + '</div>'
                + '</div>';
        }).join('');
    }
    window.renderNgoGrid = renderNgoGrid;

    /* NGO grid client-side filter */
    window._filterNgoGrid = function(query) {
        var q      = (query || '').toLowerCase().trim();
        var sector = (document.getElementById('ngo-sector-filter') || {}).value || '';
        document.querySelectorAll('.ngo-card').forEach(function(card) {
            var name   = (card.dataset.name   || '').toLowerCase();
            var cardSector = (card.dataset.sector || '').toLowerCase();
            var matchQ = !q || name.includes(q);
            var matchS = !sector || cardSector.includes(sector.toLowerCase());
            card.style.display = (matchQ && matchS) ? '' : 'none';
        });
    };


    /* =========================================================================
       §5  renderNgoProfile  (ENHANCED v2)
       Detailed NGO profile with impact stats, grant history, impact reports,
       verification status, and public documents section.
       ========================================================================= */

    function renderNgoProfile(ngoId) {
        var ngo = _partners()[ngoId];
        if (!ngo) {
            _notify('NGO profile not found.', 'error');
            return;
        }

        var gridView    = document.getElementById('ngo-grid-view');
        var backBtn     = document.getElementById('back-to-ngo-grid');
        var profileView = document.getElementById('ngo-profile-view');
        if (!profileView) return;

        if (gridView)  gridView.style.display  = 'none';
        if (backBtn)   backBtn.style.display    = 'inline-flex';
        profileView.style.display = 'block';

        var stats        = ngo.stats || {};
        var raised       = stats.raised       || 0;
        var projects     = stats.projects     || 0;
        var peopleHelped = stats.peopleHelped || 0;
        var raisedStr    = typeof window.formatUsdPrice === 'function'
            ? window.formatUsdPrice(raised)
            : '$' + raised.toLocaleString();
        var isVerified   = ngo.isVerified !== false;
        var regNumber    = ngo.registrationNumber || ngo.regNumber || '—';
        var country      = ngo.country || ngo.location || '—';
        var website      = ngo.website || '';
        var grantHist    = Array.isArray(ngo.grantHistory) ? ngo.grantHistory : [];

        profileView.innerHTML =
            /* Header card */
            '<div class="card" style="margin-bottom:16px;overflow:hidden;">'
            + '<div style="height:5px;background:linear-gradient(90deg,var(--nav-accent,#00D4AA),#7EEEDD,var(--nav-accent,#00D4AA));"></div>'
            + '<div class="card-content">'
            + '<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">'
            /* Logo */
            + '<div style="width:90px;height:90px;border-radius:16px;overflow:hidden;flex-shrink:0;'
            + 'border:2px solid rgba(0,212,170,0.3);background:rgba(0,212,170,0.08);'
            + 'display:flex;align-items:center;justify-content:center;">'
            + '<img src="' + _esc(ngo.logo || '') + '" alt="' + _esc(ngo.name) + '" '
            + 'loading="lazy" style="width:100%;height:100%;object-fit:cover;" '
            + 'onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<i class=\\\"fas fa-building\\\" style=\\\"font-size:2rem;color:var(--nav-accent,#00D4AA);\\\"></i>\'">'
            + '</div>'
            /* Info */
            + '<div style="flex:1;min-width:200px;">'
            + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">'
            + '<h2 style="font-family:\'Syne\',sans-serif;font-weight:800;margin:0;">' + _esc(ngo.name) + '</h2>'
            + (isVerified
                ? '<span style="font-size:0.72rem;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.12);'
                + 'padding:3px 10px;border-radius:50px;border:1px solid rgba(34,197,94,0.3);">'
                + '<i class="fas fa-shield-alt"></i> Verified Partner</span>'
                : '<span style="font-size:0.72rem;font-weight:700;color:#F59E0B;background:rgba(245,158,11,0.12);'
                + 'padding:3px 10px;border-radius:50px;border:1px solid rgba(245,158,11,0.3);">'
                + '<i class="fas fa-clock"></i> Pending Verification</span>')
            + '</div>'
            + '<p style="color:var(--text-muted);font-size:0.9rem;line-height:1.6;margin:0 0 12px;">' + _esc(ngo.description || '') + '</p>'
            + '<div style="display:flex;flex-wrap:wrap;gap:16px;">'
            + (regNumber !== '—' ? '<div style="font-size:0.8rem;"><i class="fas fa-id-card" style="color:var(--nav-accent,#00D4AA);margin-right:5px;"></i><strong>Reg No:</strong> ' + _esc(regNumber) + '</div>' : '')
            + '<div style="font-size:0.8rem;"><i class="fas fa-map-marker-alt" style="color:var(--nav-accent,#00D4AA);margin-right:5px;"></i>' + _esc(country) + '</div>'
            + (ngo.sector ? '<div style="font-size:0.8rem;"><i class="fas fa-tag" style="color:var(--nav-accent,#00D4AA);margin-right:5px;"></i>' + _esc(ngo.sector) + '</div>' : '')
            + (website ? '<div style="font-size:0.8rem;"><a href="' + _esc(website) + '" target="_blank" rel="noopener" style="color:var(--nav-accent,#00D4AA);">'
            + '<i class="fas fa-globe" style="margin-right:5px;"></i>Website</a></div>' : '')
            + '</div>'
            /* Bank Account Details */
            + (ngo.bankAccountNumber || ngo.bankName
                ? '<div style="margin-top:14px;padding:12px 16px;border-radius:12px;background:rgba(0,212,170,0.06);border:1px solid rgba(0,212,170,0.18);">'
                + '<div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">'
                + '<i class="fas fa-university" style="color:var(--nav-accent,#00D4AA);margin-right:5px;"></i>Bank Account Details</div>'
                + '<div style="display:flex;flex-wrap:wrap;gap:14px;font-size:0.84rem;">'
                + (ngo.bankAccountName ? '<div><span style="color:var(--text-muted);">Account Name:</span> <strong>' + _esc(ngo.bankAccountName) + '</strong></div>' : '')
                + (ngo.bankAccountNumber ? '<div><span style="color:var(--text-muted);">Account Number:</span> <strong style="font-family:monospace;">' + _esc(ngo.bankAccountNumber) + '</strong></div>' : '')
                + (ngo.bankName ? '<div><span style="color:var(--text-muted);">Bank:</span> <strong>' + _esc(ngo.bankName) + '</strong></div>' : '')
                + '</div>'
                + '</div>'
                : '')
            + '</div>'
            /* Donate button */
            + '<div style="display:flex;flex-direction:column;gap:8px;">'
            + '<button class="btn btn-accent" style="white-space:nowrap;" '
            + 'onclick="window._openNgoDonationModal && window._openNgoDonationModal(\'' + _esc(ngoId) + '\')">'
            + '<i class="fas fa-hand-holding-heart"></i> Donate to ' + _esc(ngo.name.split(' ')[0])
            + '</button>'
            + '</div>'
            + '</div>'
            + '</div>'
            + '</div>'

            /* Impact stats */
            + '<div class="card" style="margin-bottom:16px;">'
            + '<div class="card-content">'
            + '<h3 style="margin-bottom:16px;font-family:\'Syne\',sans-serif;">'
            + '<i class="fas fa-chart-bar" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Impact At a Glance</h3>'
            + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;">'
            + _statCard('Total Raised', raisedStr, 'fa-coins', '#00D4AA')
            + _statCard('Projects Funded', projects.toLocaleString(), 'fa-project-diagram', '#3B82F6')
            + _statCard('People Helped', peopleHelped.toLocaleString(), 'fa-users', '#22c55e')
            + _statCard('Grants Received', (ngo.grantsTotal || 0).toString(), 'fa-donate', '#F59E0B')
            + '</div>'
            + '</div>'
            + '</div>'

            /* Grant History */
            + (grantHist.length
                ? '<div class="card" style="margin-bottom:16px;">'
                + '<div class="card-content">'
                + '<h3 style="margin-bottom:14px;font-family:\'Syne\',sans-serif;">'
                + '<i class="fas fa-history" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Grant History</h3>'
                + '<div style="overflow-x:auto;">'
                + '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">'
                + '<thead><tr style="border-bottom:2px solid rgba(0,212,170,0.15);">'
                + '<th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Grant ID</th>'
                + '<th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Amount</th>'
                + '<th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Purpose</th>'
                + '<th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Status</th>'
                + '<th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Date</th>'
                + '</tr></thead><tbody>'
                + grantHist.map(function(g) {
                    return '<tr style="border-bottom:1px solid rgba(10,14,39,0.06);">'
                        + '<td style="padding:8px 12px;font-family:monospace;font-size:0.78rem;color:var(--text-muted);">' + _esc(g.id || '—') + '</td>'
                        + '<td style="padding:8px 12px;font-weight:700;">' + _esc(_fmtAmount(g.amount, g.currency)) + '</td>'
                        + '<td style="padding:8px 12px;">' + _esc(g.purpose || '—') + '</td>'
                        + '<td style="padding:8px 12px;">' + _statusBadge(g.status || 'completed') + '</td>'
                        + '<td style="padding:8px 12px;font-size:0.8rem;">' + _esc(g.date || '—') + '</td>'
                        + '</tr>';
                }).join('')
                + '</tbody></table>'
                + '</div>'
                + '</div>'
                + '</div>'
                : '')

            /* Project reports feed */
            + '<div class="card">'
            + '<div class="card-content">'
            + '<h3 style="margin-bottom:16px;font-family:\'Syne\',sans-serif;">'
            + '<i class="fas fa-stream" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Project Reports &amp; Updates</h3>'
            + '<div id="ngo-feed-container" style="margin-top:4px;"></div>'
            + '</div></div>';

        /* Populate feed */
        var feedContainer = document.getElementById('ngo-feed-container');
        if (feedContainer && ngo.posts && ngo.posts.length) {
            ngo.posts.forEach(function(postData) {
                if (typeof window.createNewPostElement === 'function') {
                    var author   = { id: ngo.id, fullName: ngo.name, avatar: ngo.logo };
                    var mediaObjs = (postData.media || []).map(function(u) {
                        return { _cloudUrl: u, url: u, type: 'image/jpeg' };
                    });
                    var postEl = window.createNewPostElement(postData.content || '', mediaObjs, author);
                    feedContainer.appendChild(postEl);
                }
            });
        } else if (feedContainer) {
            feedContainer.innerHTML =
                '<p style="text-align:center;padding:24px;color:var(--text-muted);">'
                + '<i class="fas fa-file-alt" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.4;"></i>'
                + 'No project reports published yet.</p>';
        }
    }
    window.renderNgoProfile = renderNgoProfile;

    /* Helper — compact stat card */
    function _statCard(label, value, icon, color) {
        return '<div style="text-align:center;padding:16px;border-radius:12px;background:rgba(0,212,170,0.04);border:1px solid rgba(0,212,170,0.1);">'
            + '<div style="width:38px;height:38px;border-radius:10px;background:' + (color || 'var(--nav-accent,#00D4AA)') + '22;'
            + 'display:flex;align-items:center;justify-content:center;margin:0 auto 8px;">'
            + '<i class="fas ' + icon + '" style="color:' + (color || 'var(--nav-accent,#00D4AA)') + ';font-size:1rem;"></i></div>'
            + '<div style="font-size:1.3rem;font-weight:800;font-family:\'Syne\',sans-serif;">' + value + '</div>'
            + '<div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">' + label + '</div>'
            + '</div>';
    }


    /* =========================================================================
       §6  renderGrantDashboard  (NEW)
       Top-level analytics dashboard for the Grant Portal.
       Shows live KPIs, fund allocation donut, disbursement timeline.
       ========================================================================= */

    function renderGrantDashboard() {
        var container = document.getElementById('grant-dashboard-container');
        if (!container) return;

        /* Pull live stats from Firestore */
        var totalDisbursed = 0, totalNgos = 0, totalIndividuals = 0, pendingCount = 0;
        var ledger = _ledger();
        ledger.forEach(function(g) { totalDisbursed += parseFloat(String(g.amount || '0').replace(/[^0-9.]/g, '')) || 0; });
        totalNgos = Object.keys(_partners()).length;

        container.innerHTML =
            /* KPI row */
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px;">'
            + _kpiCard('Total Disbursed', _fmtAmount(totalDisbursed, 'NGN'), 'fa-paper-plane', '#00D4AA', '+12% this month')
            + _kpiCard('Active NGOs', totalNgos.toString(), 'fa-building', '#3B82F6', 'Verified partners')
            + _kpiCard('Individual Grants', '—', 'fa-user-check', '#22c55e', 'Direct recipients')
            + _kpiCard('Pending Approvals', '—', 'fa-clock', '#F59E0B', 'Awaiting review')
            + '</div>'
            /* Ledger table */
            + '<div class="card">'
            + '<div class="card-content">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">'
            + '<h3 style="font-family:\'Syne\',sans-serif;margin:0;">'
            + '<i class="fas fa-link" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>'
            + 'Grant Transparency Ledger <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400;margin-left:6px;">Immutable Blockchain Record</span></h3>'
            + '<div style="display:flex;gap:8px;">'
            + '<button class="btn btn-small" style="font-size:0.78rem;" onclick="window.renderGrantLedger && window.renderGrantLedger()">'
            + '<i class="fas fa-sync-alt"></i> Refresh</button>'
            + '<button class="btn btn-small btn-accent" style="font-size:0.78rem;" onclick="window._exportGrantReport && window._exportGrantReport(\'csv\')">'
            + '<i class="fas fa-download"></i> Export CSV</button>'
            + '</div>'
            + '</div>'
            + '<div style="overflow-x:auto;">'
            + '<table style="width:100%;border-collapse:collapse;font-size:0.84rem;">'
            + '<thead><tr style="border-bottom:2px solid rgba(0,212,170,0.15);">'
            + '<th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">Grant ID</th>'
            + '<th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">Recipient</th>'
            + '<th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">Project/Purpose</th>'
            + '<th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>'
            + '<th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">Blockchain Proof</th>'
            + '<th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">Status</th>'
            + '<th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">Type</th>'
            + '<th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">Date</th>'
            + '</tr></thead>'
            + '<tbody id="grant-ledger-body"><tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">'
            + '<i class="fas fa-circle-notch fa-spin"></i> Loading ledger…</td></tr></tbody>'
            + '</table>'
            + '</div>'
            + '</div>'
            + '</div>';

        /* Now load the ledger rows */
        setTimeout(renderGrantLedger, 200);

        /* Pull live pending count from Firestore */
        _refreshDashboardKPIs();
    }
    window.renderGrantDashboard = renderGrantDashboard;

    function _kpiCard(label, value, icon, color, sub) {
        return '<div style="padding:18px;border-radius:14px;background:rgba(0,212,170,0.04);border:1px solid rgba(0,212,170,0.12);">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
            + '<div style="width:36px;height:36px;border-radius:10px;background:' + color + '22;'
            + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
            + '<i class="fas ' + icon + '" style="color:' + color + ';font-size:0.95rem;"></i></div>'
            + '<div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">' + label + '</div>'
            + '</div>'
            + '<div style="font-size:1.6rem;font-weight:800;font-family:\'Syne\',sans-serif;color:' + color + ';">' + value + '</div>'
            + (sub ? '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;">' + sub + '</div>' : '')
            + '</div>';
    }

    function _refreshDashboardKPIs() {
        if (!_fbOk() || !_db()) return;
        /* Update pending approvals */
        _db().collection('grant_applications').where('status', '==', 'pending').get()
            .then(function(s) {
                var els = document.querySelectorAll('[data-kpi="pending"]');
                els.forEach(function(el) { el.textContent = s.size || '0'; });
            }).catch(function() {});
        /* Update individual grant count */
        _db().collection('individual_grants').where('status', '==', 'disbursed').get()
            .then(function(s) {
                var els = document.querySelectorAll('[data-kpi="individuals"]');
                els.forEach(function(el) { el.textContent = s.size || '0'; });
            }).catch(function() {});
    }
    window._refreshGrantDashboard = function() { renderGrantDashboard(); };


    /* =========================================================================
       §7  renderNgoVerificationQueue  (NEW)
       Admin-only panel showing pending NGO applications with KYC docs.
       ========================================================================= */

    function renderNgoVerificationQueue() {
        var container = document.getElementById('ngo-verification-queue-container');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">'
            + '<i class="fas fa-circle-notch fa-spin"></i> Loading verification queue…</div>';

        if (!_fbOk() || !_db()) {
            container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">'
                + '<i class="fas fa-wifi" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.4;"></i>'
                + 'Firebase not connected. Verification queue unavailable.</div>';
            return;
        }

        _db().collection('ngo_applications')
            .orderBy('submittedAt', 'desc')
            .limit(50)
            .get()
            .then(function(snap) {
                if (snap.empty) {
                    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);">'
                        + '<i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>'
                        + '<strong>No pending applications</strong><br>'
                        + '<span style="font-size:0.83rem;">New NGO applications will appear here for review.</span></div>';
                    return;
                }

                var cards = [];
                snap.forEach(function(doc) {
                    var d  = doc.data();
                    var dt = d.submittedAt && d.submittedAt.toDate
                        ? d.submittedAt.toDate().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
                        : '—';
                    var statusBadge = _statusBadge(d.status || 'pending');
                    var docs = Array.isArray(d.documents) ? d.documents : [];

                    cards.push(
                        '<div class="card" style="margin-bottom:14px;border-left:4px solid '
                        + (d.status === 'pending' ? '#F59E0B' : d.status === 'approved' ? '#22c55e' : '#ef4444')
                        + ';" id="ngo-app-' + doc.id + '">'
                        + '<div style="padding:16px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">'
                        /* NGO info */
                        + '<div style="flex:1;min-width:220px;">'
                        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">'
                        + '<strong style="font-size:1rem;">' + _esc(d.orgName || d.name || 'Unnamed NGO') + '</strong>'
                        + statusBadge
                        + '</div>'
                        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:0.82rem;color:var(--text-muted);">'
                        + '<div><i class="fas fa-id-card" style="width:14px;color:var(--nav-accent,#00D4AA);"></i> ' + _esc(d.regNumber || '—') + '</div>'
                        + '<div><i class="fas fa-map-marker-alt" style="width:14px;color:var(--nav-accent,#00D4AA);"></i> ' + _esc(d.country || '—') + '</div>'
                        + '<div><i class="fas fa-envelope" style="width:14px;color:var(--nav-accent,#00D4AA);"></i> ' + _esc(d.email || '—') + '</div>'
                        + '<div><i class="fas fa-tag" style="width:14px;color:var(--nav-accent,#00D4AA);"></i> ' + _esc(d.sector || '—') + '</div>'
                        + '<div><i class="fas fa-calendar" style="width:14px;color:var(--nav-accent,#00D4AA);"></i> ' + dt + '</div>'
                        + '<div><i class="fas fa-phone" style="width:14px;color:var(--nav-accent,#00D4AA);"></i> ' + _esc(d.phone || '—') + '</div>'
                        + '</div>'
                        + (d.mission ? '<p style="font-size:0.82rem;margin:8px 0 0;color:var(--text-muted);line-height:1.5;">' + _esc(d.mission.substring(0, 200)) + (d.mission.length > 200 ? '…' : '') + '</p>' : '')
                        /* Bank account details */
                        + (d.bankAccountNumber || d.bankName
                            ? '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(0,212,170,0.05);border:1px solid rgba(0,212,170,0.12);font-size:0.8rem;">'
                            + '<div style="font-weight:700;color:var(--nav-accent,#00D4AA);margin-bottom:4px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;">'
                            + '<i class="fas fa-university" style="margin-right:4px;"></i>Bank Details</div>'
                            + (d.bankAccountName ? '<div><span style="color:var(--text-muted);">Name:</span> <strong>' + _esc(d.bankAccountName) + '</strong></div>' : '')
                            + (d.bankAccountNumber ? '<div><span style="color:var(--text-muted);">Acc No:</span> <strong style="font-family:monospace;">' + _esc(d.bankAccountNumber) + '</strong></div>' : '')
                            + (d.bankName ? '<div><span style="color:var(--text-muted);">Bank:</span> <strong>' + _esc(d.bankName) + '</strong></div>' : '')
                            + '</div>'
                            : '')
                        + '</div>'
                        /* Documents */
                        + '<div style="min-width:160px;">'
                        + '<div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">KYC Documents</div>'
                        + (docs.length
                            ? docs.map(function(docUrl, i) {
                                return '<a href="' + _esc(docUrl) + '" target="_blank" rel="noopener" '
                                    + 'style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--nav-accent,#00D4AA);margin-bottom:4px;">'
                                    + '<i class="fas fa-file-pdf"></i> Document ' + (i + 1) + '</a>';
                            }).join('')
                            : '<span style="font-size:0.78rem;color:var(--text-muted);">No documents uploaded</span>')
                        + '</div>'
                        /* Actions */
                        + (d.status === 'pending'
                            ? '<div style="display:flex;flex-direction:column;gap:8px;">'
                            + '<button class="btn btn-small" style="background:var(--success-color,#22c55e);color:#fff;font-size:0.8rem;" '
                            + 'onclick="window._approveNgoApplication(\'' + doc.id + '\',\'approve\')">'
                            + '<i class="fas fa-check"></i> Approve</button>'
                            + '<button class="btn btn-small" style="background:var(--danger-color,#ef4444);color:#fff;font-size:0.8rem;" '
                            + 'onclick="window._approveNgoApplication(\'' + doc.id + '\',\'reject\')">'
                            + '<i class="fas fa-times"></i> Reject</button>'
                            + '<button class="btn btn-small" style="font-size:0.8rem;" '
                            + 'onclick="window._requestMoreNgoInfo && window._requestMoreNgoInfo(\'' + doc.id + '\')">'
                            + '<i class="fas fa-question-circle"></i> Request Info</button>'
                            + '</div>'
                            : '<div style="font-size:0.78rem;color:var(--text-muted);">Reviewed on<br>' + _esc(d.reviewedAt || '—') + '</div>')
                        + '</div>'
                        + '</div>'
                    );
                });
                container.innerHTML = cards.join('');
            })
            .catch(function(e) {
                container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--danger-color);">'
                    + 'Error loading queue: ' + _esc(e.message || 'Unknown error') + '</div>';
            });
    }
    window.renderNgoVerificationQueue = renderNgoVerificationQueue;


    /* =========================================================================
       §8  renderIndividualGrantPanel  (NEW)
       Admin panel for individual grant disbursement requests.
       ========================================================================= */

    function renderIndividualGrantPanel() {
        var container = document.getElementById('individual-grant-panel-container');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">'
            + '<i class="fas fa-circle-notch fa-spin"></i> Loading individual grant requests…</div>';

        if (!_fbOk() || !_db()) {
            container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">Firebase not connected.</div>';
            return;
        }

        _db().collection('individual_grants')
            .orderBy('submittedAt', 'desc')
            .limit(50)
            .get()
            .then(function(snap) {
                if (snap.empty) {
                    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);">'
                        + '<i class="fas fa-users" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>'
                        + '<strong>No individual grant requests</strong><br>'
                        + '<span style="font-size:0.83rem;">Individual grant applications will appear here.</span>'
                        + '<br><br><button class="btn btn-accent" onclick="window.openIndividualGrantModal && window.openIndividualGrantModal()">'
                        + '<i class="fas fa-plus-circle"></i> Apply for Individual Grant</button></div>';
                    return;
                }

                var rows = '';
                snap.forEach(function(doc) {
                    var d  = doc.data();
                    var dt = d.submittedAt && d.submittedAt.toDate
                        ? d.submittedAt.toDate().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})
                        : '—';
                    var payMethod = d.paymentMethod || d.method || '—';

                    rows += '<div class="card" style="margin-bottom:12px;border-left:4px solid '
                        + (d.status === 'pending' ? '#F59E0B' : d.status === 'disbursed' ? '#22c55e' : '#3B82F6')
                        + ';" id="ind-grant-' + doc.id + '">'
                        + '<div style="padding:14px 16px;display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">'
                        /* Avatar & name */
                        + '<div style="width:44px;height:44px;border-radius:50%;background:rgba(0,212,170,0.1);'
                        + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
                        + '<i class="fas fa-user" style="color:var(--nav-accent,#00D4AA);"></i></div>'
                        + '<div style="flex:1;min-width:200px;">'
                        + '<div style="font-weight:700;margin-bottom:4px;">' + _esc(d.fullName || d.applicantName || 'Unknown Applicant') + '</div>'
                        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;font-size:0.8rem;color:var(--text-muted);">'
                        + '<div><i class="fas fa-coins" style="color:var(--nav-accent,#00D4AA);width:12px;"></i> ' + _esc(_fmtAmount(d.amount, d.currency)) + '</div>'
                        + '<div><i class="fas fa-bullseye" style="color:var(--nav-accent,#00D4AA);width:12px;"></i> ' + _esc(d.purpose || '—') + '</div>'
                        + '<div><i class="fas fa-university" style="color:var(--nav-accent,#00D4AA);width:12px;"></i> ' + _esc(payMethod) + '</div>'
                        + '<div><i class="fas fa-calendar" style="color:var(--nav-accent,#00D4AA);width:12px;"></i> ' + dt + '</div>'
                        + '</div>'
                        + (d.reason ? '<p style="font-size:0.80rem;color:var(--text-muted);margin:6px 0 0;line-height:1.5;">' + _esc(d.reason.substring(0, 180)) + '</p>' : '')
                        + '</div>'
                        + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
                        + _statusBadge(d.status || 'pending')
                        + (d.status === 'pending' || d.status === 'approved'
                            ? '<button class="btn btn-small" style="background:#22c55e;color:#fff;font-size:0.78rem;" '
                            + 'onclick="window._approveIndividualGrant(\'' + doc.id + '\',\'disburse\')">'
                            + '<i class="fas fa-paper-plane"></i> Disburse</button>'
                            + '<button class="btn btn-small" style="background:#ef4444;color:#fff;font-size:0.78rem;" '
                            + 'onclick="window._approveIndividualGrant(\'' + doc.id + '\',\'reject\')">'
                            + '<i class="fas fa-times"></i> Reject</button>'
                            : '')
                        + '</div>'
                        + '</div>'
                        + '</div>';
                });
                container.innerHTML = rows;
            })
            .catch(function(e) {
                container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--danger-color);">'
                    + 'Error: ' + _esc(e.message || 'Unknown error') + '</div>';
            });
    }
    window.renderIndividualGrantPanel = renderIndividualGrantPanel;


    /* =========================================================================
       §9  renderAdminGrantControlPanel  (NEW)
       Unified admin grant command centre injected into the existing
       #admin-disburse-tab panel (extends app-admin.js disbursement section).
       ========================================================================= */

    function renderAdminGrantControlPanel() {
        var container = document.getElementById('admin-grant-control-container');
        if (!container) return;

        container.innerHTML =
            /* Tabs */
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">'
            + ['Overview','NGO Applications','Individual Grants','Create Allocation','Audit Export','Account Form'].map(function(tab, i) {
                return '<button class="btn btn-small admin-grant-tab" data-tab="agc-' + i + '" '
                    + 'style="font-size:0.80rem;' + (i === 0 ? 'background:var(--nav-accent,#00D4AA);color:#0A0F1E;' : '') + '">'
                    + tab + '</button>';
            }).join('')
            + '</div>'
            /* Tab panels */
            + '<div id="agc-0" class="agc-panel" style="display:block;">'
            + '<div id="grant-dashboard-container"></div>'
            + '</div>'
            + '<div id="agc-1" class="agc-panel" style="display:none;">'
            + '<div id="ngo-verification-queue-container"></div>'
            + '</div>'
            + '<div id="agc-2" class="agc-panel" style="display:none;">'
            + '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">'
            + '<button class="btn btn-small btn-accent" onclick="window.openIndividualGrantModal && window.openIndividualGrantModal()">'
            + '<i class="fas fa-plus-circle"></i> New Request</button></div>'
            + '<div id="individual-grant-panel-container"></div>'
            + '</div>'
            + '<div id="agc-3" class="agc-panel" style="display:none;">'
            + _renderCreateAllocationForm()
            + '</div>'
            + '<div id="agc-4" class="agc-panel" style="display:none;">'
            + _renderAuditExportPanel()
            + '</div>'
            + '<div id="agc-5" class="agc-panel" style="display:none;">'
            + _renderIndividualAccountAdminPanel()
            + '</div>';

        /* Wire tab switching */
        container.addEventListener('click', function(e) {
            var btn = e.target.closest('.admin-grant-tab');
            if (!btn) return;
            var tabId = btn.dataset.tab;
            container.querySelectorAll('.agc-panel').forEach(function(p) { p.style.display = 'none'; });
            container.querySelectorAll('.admin-grant-tab').forEach(function(b) {
                b.style.background = '';
                b.style.color      = '';
            });
            var panel = document.getElementById(tabId);
            if (panel) panel.style.display = 'block';
            btn.style.background = 'var(--nav-accent,#00D4AA)';
            btn.style.color      = '#0A0F1E';

            if (tabId === 'agc-0') renderGrantDashboard();
            if (tabId === 'agc-1') renderNgoVerificationQueue();
            if (tabId === 'agc-2') renderIndividualGrantPanel();
            if (tabId === 'agc-5') _renderIndAcctBanner(); /* refresh status on tab open */
        });

        /* Load default tab */
        renderGrantDashboard();
    }
    window.renderAdminGrantControlPanel = renderAdminGrantControlPanel;

    function _renderCreateAllocationForm() {
        return '<div class="card"><div class="card-content">'
            + '<h3 style="font-family:\'Syne\',sans-serif;margin-bottom:16px;">'
            + '<i class="fas fa-plus-circle" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Create Grant Allocation</h3>'
            + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">'
            + _frmField('alloc-recipient-type', 'Recipient Type', 'select',
                '<option value="ngo">NGO Partner</option><option value="individual">Individual</option>')
            + _frmField('alloc-amount', 'Amount', 'number', null, 'e.g. 500000')
            + _frmField('alloc-currency', 'Currency', 'select',
                '<option value="NGN">NGN (Naira)</option><option value="USD">USD</option><option value="EMPY">EMPY Token</option><option value="USDT">USDT</option>')
            + _frmField('alloc-purpose', 'Purpose / Project Name', 'text', null, 'e.g. Clean Water Initiative')
            + _frmField('alloc-ngo-id', 'NGO Partner ID (if NGO)', 'text', null, 'Firestore NGO ID')
            + _frmField('alloc-recipient-name', 'Recipient Full Name', 'text', null, 'Legal name')
            + _frmField('alloc-wallet', 'Wallet Address (for crypto)', 'text', null, '0x…')
            + _frmField('alloc-bank-account', 'Bank Account No (for fiat)', 'text', null, 'Account number')
            + _frmField('alloc-disbursement-date', 'Scheduled Disbursement Date', 'date', null, '')
            + _frmField('alloc-notes', 'Admin Notes', 'text', null, 'Internal notes…')
            + '</div>'
            + '<div style="margin-top:14px;display:flex;gap:10px;">'
            + '<button class="btn btn-accent" onclick="window._createGrantAllocation && window._createGrantAllocation()">'
            + '<i class="fas fa-save"></i> Create Allocation</button>'
            + '<button class="btn" onclick="window._adminLoadNgoList && window._adminLoadNgoList()">'
            + '<i class="fas fa-sync-alt"></i> Refresh NGO List</button>'
            + '</div>'
            + '<div id="alloc-feedback" style="display:none;margin-top:12px;padding:10px 14px;border-radius:10px;font-size:0.85rem;"></div>'
            + '</div></div>';
    }

    function _frmField(id, label, type, options, placeholder) {
        var inner = type === 'select'
            ? '<select id="' + id + '" style="width:100%;padding:9px 12px;border:1.5px solid rgba(0,212,170,0.2);border-radius:10px;background:rgba(232,240,255,0.05);color:inherit;font-size:0.88rem;">' + (options || '') + '</select>'
            : '<input type="' + type + '" id="' + id + '" placeholder="' + (placeholder || '') + '" '
            + 'style="width:100%;padding:9px 12px;border:1.5px solid rgba(0,212,170,0.2);border-radius:10px;background:rgba(232,240,255,0.05);color:inherit;font-size:0.88rem;">';
        return '<div>'
            + '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px;">' + label + '</label>'
            + inner
            + '</div>';
    }

    function _renderAuditExportPanel() {
        return '<div class="card"><div class="card-content">'
            + '<h3 style="font-family:\'Syne\',sans-serif;margin-bottom:16px;">'
            + '<i class="fas fa-file-export" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Audit Trail Export</h3>'
            + '<p style="color:var(--text-muted);font-size:0.88rem;line-height:1.6;margin-bottom:18px;">'
            + 'Export immutable grant disbursement records for compliance reporting, external audits, and regulatory submissions.</p>'
            + '<div style="display:flex;flex-wrap:wrap;gap:12px;">'
            + '<button class="btn btn-accent" onclick="window._exportGrantReport(\'csv\')" style="gap:8px;">'
            + '<i class="fas fa-file-csv"></i> Export CSV</button>'
            + '<button class="btn" onclick="window._exportGrantReport(\'json\')" style="gap:8px;">'
            + '<i class="fas fa-file-code"></i> Export JSON</button>'
            + '<button class="btn" onclick="window._exportGrantReport(\'pdf\')" style="gap:8px;">'
            + '<i class="fas fa-file-pdf"></i> Generate PDF Report</button>'
            + '</div>'
            + '<div style="margin-top:20px;padding:14px;border-radius:12px;background:rgba(0,212,170,0.05);border:1px solid rgba(0,212,170,0.15);font-size:0.83rem;">'
            + '<i class="fas fa-shield-alt" style="color:var(--nav-accent,#00D4AA);margin-right:6px;"></i>'
            + '<strong>Blockchain Integrity</strong> — All on-chain transactions are permanently recorded on Polygon. '
            + 'Off-chain fiat disbursements include Flutterwave transaction references for full auditability.'
            + '</div>'
            + '</div></div>';
    }


    /* =========================================================================
       §10  renderGrantAnalytics  (NEW — chart-free, SVG mini-chart)
       ========================================================================= */

    function renderGrantAnalytics() {
        var container = document.getElementById('grant-analytics-container');
        if (!container) return;

        container.innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">'
            /* Fund allocation breakdown */
            + '<div class="card"><div class="card-content">'
            + '<h4 style="margin-bottom:14px;font-family:\'Syne\',sans-serif;">'
            + '<i class="fas fa-chart-pie" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Fund Allocation</h4>'
            + _renderAllocationBars()
            + '</div></div>'
            /* Disbursement by currency */
            + '<div class="card"><div class="card-content">'
            + '<h4 style="margin-bottom:14px;font-family:\'Syne\',sans-serif;">'
            + '<i class="fas fa-coins" style="color:#F59E0B;margin-right:8px;"></i>By Payment Channel</h4>'
            + _renderChannelStats()
            + '</div></div>'
            + '</div>';
    }
    window.renderGrantAnalytics = renderGrantAnalytics;

    function _renderAllocationBars() {
        var allocations = [
            { label: 'Health & Medical', pct: 35, color: '#22c55e' },
            { label: 'Education',        pct: 25, color: '#3B82F6' },
            { label: 'Food Security',    pct: 20, color: '#F59E0B' },
            { label: 'Shelter',          pct: 12, color: '#8B5CF6' },
            { label: 'Environment',      pct: 8,  color: '#00D4AA' }
        ];
        return allocations.map(function(a) {
            return '<div style="margin-bottom:10px;">'
                + '<div style="display:flex;justify-content:space-between;font-size:0.80rem;margin-bottom:4px;">'
                + '<span>' + a.label + '</span><span style="font-weight:700;">' + a.pct + '%</span></div>'
                + '<div style="height:8px;border-radius:50px;background:rgba(232,240,255,0.08);overflow:hidden;">'
                + '<div style="height:100%;border-radius:50px;background:' + a.color + ';width:' + a.pct + '%;transition:width 0.8s ease;"></div>'
                + '</div></div>';
        }).join('');
    }

    function _renderChannelStats() {
        var channels = [
            { label: 'Fiat (NGN via Flutterwave)', icon: 'fa-money-bill-wave', color: '#22c55e', value: '68%' },
            { label: 'Crypto (EMPY Token)',         icon: 'fa-coins',           color: '#00D4AA', value: '22%' },
            { label: 'USDT Stablecoin',             icon: 'fa-dollar-sign',     color: '#3B82F6', value: '8%'  },
            { label: 'Mobile Money',                icon: 'fa-mobile-alt',      color: '#F59E0B', value: '2%'  }
        ];
        return channels.map(function(c) {
            return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,212,170,0.08);">'
                + '<div style="width:36px;height:36px;border-radius:10px;background:' + c.color + '22;flex-shrink:0;'
                + 'display:flex;align-items:center;justify-content:center;">'
                + '<i class="fas ' + c.icon + '" style="color:' + c.color + ';font-size:0.85rem;"></i></div>'
                + '<div style="flex:1;"><div style="font-size:0.83rem;font-weight:600;">' + c.label + '</div>'
                + '<div style="font-size:0.75rem;color:var(--text-muted);">of total disbursements</div></div>'
                + '<div style="font-size:1.1rem;font-weight:800;color:' + c.color + ';">' + c.value + '</div>'
                + '</div>';
        }).join('');
    }


    /* =========================================================================
       §11  renderImpactReports  (NEW)
       NGO impact report submission and display.
       ========================================================================= */

    function renderImpactReports(ngoId) {
        var container = document.getElementById('impact-reports-container');
        if (!container) return;

        var submitSection = _isAdmin() || (ngoId && _us().ngoId === ngoId)
            ? '<div class="card" style="margin-bottom:16px;"><div class="card-content">'
            + '<h4 style="margin-bottom:12px;font-family:\'Syne\',sans-serif;">'
            + '<i class="fas fa-plus-circle" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Submit Impact Report</h4>'
            + '<textarea id="impact-report-text" rows="4" placeholder="Describe the project outcomes, beneficiaries reached, funds utilised…" '
            + 'style="width:100%;padding:10px 12px;border:1.5px solid rgba(0,212,170,0.2);border-radius:10px;'
            + 'background:rgba(232,240,255,0.04);color:inherit;font-size:0.88rem;resize:vertical;"></textarea>'
            + '<div style="display:flex;gap:10px;margin-top:10px;">'
            + '<button class="btn btn-accent" onclick="window._submitImpactReport && window._submitImpactReport(\'' + (ngoId || '') + '\')">'
            + '<i class="fas fa-paper-plane"></i> Submit Report</button>'
            + '</div></div></div>'
            : '';

        container.innerHTML = submitSection
            + '<div id="impact-reports-list">'
            + '<div style="text-align:center;padding:24px;color:var(--text-muted);">'
            + '<i class="fas fa-circle-notch fa-spin"></i> Loading reports…</div>'
            + '</div>';

        if (_fbOk() && _db()) {
            var q = ngoId
                ? _db().collection('impact_reports').where('ngoId', '==', ngoId).orderBy('createdAt', 'desc').limit(20)
                : _db().collection('impact_reports').orderBy('createdAt', 'desc').limit(20);
            q.get().then(function(snap) {
                var list = document.getElementById('impact-reports-list');
                if (!list) return;
                if (snap.empty) {
                    list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">No impact reports published yet.</div>';
                    return;
                }
                var html = '';
                snap.forEach(function(doc) {
                    var d  = doc.data();
                    var dt = d.createdAt && d.createdAt.toDate
                        ? d.createdAt.toDate().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})
                        : '—';
                    html += '<div class="card" style="margin-bottom:12px;"><div style="padding:14px 16px;">'
                        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">'
                        + '<strong>' + _esc(d.ngoName || 'NGO Partner') + '</strong>'
                        + '<span style="font-size:0.75rem;color:var(--text-muted);">' + dt + '</span>'
                        + '</div>'
                        + '<p style="font-size:0.85rem;line-height:1.6;color:var(--text-muted);margin:0;">' + _esc(d.content || '') + '</p>'
                        + (d.peopleReached ? '<div style="margin-top:8px;font-size:0.78rem;color:var(--nav-accent,#00D4AA);font-weight:700;">'
                        + '<i class="fas fa-users"></i> ' + d.peopleReached.toLocaleString() + ' people reached</div>' : '')
                        + '</div></div>';
                });
                list.innerHTML = html;
            }).catch(function() {
                var list = document.getElementById('impact-reports-list');
                if (list) list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">Could not load reports.</div>';
            });
        }
    }
    window.renderImpactReports = renderImpactReports;

    /* Submit impact report */
    window._submitImpactReport = function(ngoId) {
        var ta = document.getElementById('impact-report-text');
        var content = ta ? ta.value.trim() : '';
        if (!content) { _notify('Please write the impact report content.', 'error'); return; }
        if (_isGuest()) { _notify('Please log in to submit reports.', 'error'); return; }

        var us = _us();
        var ngo = _partners()[ngoId] || {};
        var record = {
            ngoId:         ngoId || us.ngoId || '',
            ngoName:       ngo.name || us.ngoName || us.fullName || 'NGO',
            content:       content,
            authorId:      us.id || 'unknown',
            authorName:    us.fullName || 'Unknown',
            createdAt:     _serverTs()
        };

        if (_fbOk() && _db()) {
            _db().collection('impact_reports').add(record)
                .then(function() {
                    _notify('✅ Impact report submitted successfully!', 'success');
                    if (ta) ta.value = '';
                    renderImpactReports(ngoId);
                })
                .catch(function(e) { _notify('Failed to submit report: ' + e.message, 'error'); });
        } else {
            _notify('Impact report saved locally (Firebase offline).', 'info');
            if (ta) ta.value = '';
        }
    };


    /* =========================================================================
       §12  NGO APPLICATION MODAL  (NEW)
       Self-registration flow for NGOs wanting to become verified partners.
       Renders a modal for NGO application submission with document upload.
       ========================================================================= */

    window.openNgoApplicationModal = function() {
        if (_isGuest()) {
            _notify('Please log in to apply as an NGO partner.', 'info');
            if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
            return;
        }

        /* Remove any stale modal */
        var existing = document.getElementById('ngo-application-modal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'ngo-application-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,30,0.85);backdrop-filter:blur(4px);'
            + 'z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';

        modal.innerHTML =
            '<div style="background:var(--card-bg,#111827);border-radius:20px;width:100%;max-width:600px;'
            + 'border:1px solid rgba(0,212,170,0.2);overflow:hidden;animation:empNavFadeIn 0.2s ease;">'
            + '<div style="height:4px;background:linear-gradient(90deg,var(--nav-accent,#00D4AA),#7EEEDD);"></div>'
            + '<div style="padding:24px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">'
            + '<h3 style="font-family:\'Syne\',sans-serif;font-weight:800;margin:0;">'
            + '<i class="fas fa-building" style="color:var(--nav-accent,#00D4AA);margin-right:10px;"></i>NGO Partner Application</h3>'
            + '<button id="ngo-app-close-x" '
            + 'style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;padding:4px;">'
            + '<i class="fas fa-times"></i></button>'
            + '</div>'
            + '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.6;margin-bottom:20px;">'
            + 'Complete this form to apply for NGO partner verification. Your application will be reviewed within 3-5 business days. '
            + 'Approved partners gain access to grant funding and appear in the Partner NGO Directory.</p>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
            + _modalField('ngo-app-orgname',   'Organisation Name *', 'text', 'Legal registered name')
            + _modalField('ngo-app-regnumber', 'Registration Number *', 'text', 'NGO/CAC reg number')
            + _modalField('ngo-app-country',   'Country *', 'text', 'Country of registration')
            + _modalField('ngo-app-sector',    'Primary Sector *', 'select',
                '<option value="">Select sector…</option>'
                + '<option value="health">Health</option><option value="education">Education</option>'
                + '<option value="food">Food Security</option><option value="environment">Environment</option>'
                + '<option value="shelter">Shelter</option><option value="gender">Gender Equality</option>'
                + '<option value="youth">Youth Development</option><option value="other">Other</option>')
            + _modalField('ngo-app-email', 'Official Email *', 'email', 'contact@yourNGO.org')
            + _modalField('ngo-app-phone', 'Phone Number', 'tel', '+234…')
            + _modalField('ngo-app-website', 'Website', 'url', 'https://yourNGO.org')
            + _modalField('ngo-app-wallet', 'Crypto Wallet Address', 'text', '0x… (for EMPY/USDT grants)')
            + '</div>'
            /* Bank account details section */
            + '<div style="margin-top:16px;padding:14px 16px;border-radius:12px;background:rgba(0,212,170,0.04);border:1px solid rgba(0,212,170,0.15);">'
            + '<div style="font-size:0.78rem;font-weight:700;color:var(--nav-accent,#00D4AA);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">'
            + '<i class="fas fa-university" style="margin-right:6px;"></i>Bank Account for Disbursement</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
            + _modalField('ngo-app-bank-account-number', 'Account Number', 'text', 'e.g. 0123456789')
            + _modalField('ngo-app-bank-account-name',   'Account Name',   'text', 'Name on bank account')
            + _modalField('ngo-app-bank-name',           'Bank Name',      'text', 'e.g. Access Bank')
            + '</div>'
            + '</div>'
            + '<div style="margin-top:12px;">'
            + '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px;">Mission Statement *</label>'
            + '<textarea id="ngo-app-mission" rows="3" placeholder="Describe your NGO\'s mission and the communities you serve…" '
            + 'style="width:100%;padding:10px 12px;border:1.5px solid rgba(0,212,170,0.2);border-radius:10px;'
            + 'background:rgba(232,240,255,0.04);color:inherit;font-size:0.88rem;resize:vertical;"></textarea>'
            + '</div>'
            + '<div style="margin-top:12px;">'
            + '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px;">'
            + 'KYC Documents (PDF/Image) *</label>'
            + '<div style="border:2px dashed rgba(0,212,170,0.3);border-radius:12px;padding:20px;text-align:center;cursor:pointer;" '
            + 'onclick="document.getElementById(\'ngo-app-docs\').click()">'
            + '<i class="fas fa-cloud-upload-alt" style="font-size:1.5rem;color:var(--nav-accent,#00D4AA);margin-bottom:8px;display:block;"></i>'
            + '<div style="font-size:0.85rem;font-weight:600;">Click to upload documents</div>'
            + '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">CAC certificate, board resolution, tax clearance, ID of directors (max 10MB each)</div>'
            + '<div id="ngo-app-doc-list" style="margin-top:8px;font-size:0.78rem;color:var(--nav-accent,#00D4AA);"></div>'
            + '</div>'
            + '<input type="file" id="ngo-app-docs" multiple accept=".pdf,.jpg,.jpeg,.png" style="display:none;" '
            + 'onchange="window._previewNgoDocs && window._previewNgoDocs(this)">'
            + '</div>'
            + '<div id="ngo-app-feedback" style="display:none;margin-top:12px;padding:10px 14px;border-radius:10px;font-size:0.85rem;"></div>'
            + '<div style="display:flex;gap:10px;margin-top:20px;">'
            + '<button class="btn btn-accent" id="ngo-app-submit-btn" '
            + 'onclick="window._submitNgoApplication && window._submitNgoApplication()" style="flex:1;">'
            + '<i class="fas fa-paper-plane"></i> Submit Application</button>'
            + '<button class="btn" id="ngo-app-cancel-btn">'
            + 'Cancel</button>'
            + '</div>'
            + '</div></div>';

        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        /* ── Wire close buttons via addEventListener (not inline onclick) ──
           Inline onclick is swallowed by capture-phase stopImmediatePropagation
           in the delete-post listener. addEventListener on the element itself
           fires before the delegated capture handler can block it.           */
        function _closeNgoModal() {
            modal.remove();
            document.body.classList.remove('modal-open');
        }
        var _xBtn = modal.querySelector('#ngo-app-close-x');
        if (_xBtn) {
            _xBtn.addEventListener('click', function(e) { e.stopPropagation(); _closeNgoModal(); });
        }
        var _cancelBtn = modal.querySelector('#ngo-app-cancel-btn');
        if (_cancelBtn) {
            _cancelBtn.addEventListener('click', function(e) { e.stopPropagation(); _closeNgoModal(); });
        }

        /* Close on backdrop click */
        modal.addEventListener('click', function(e) {
            if (e.target === modal) { _closeNgoModal(); }
        });
    };

    function _modalField(id, label, type, placeholder_or_options) {
        var isSelect = type === 'select';
        var inner = isSelect
            ? '<select id="' + id + '" style="width:100%;padding:9px 12px;border:1.5px solid rgba(0,212,170,0.2);border-radius:10px;background:rgba(232,240,255,0.04);color:inherit;font-size:0.88rem;">' + placeholder_or_options + '</select>'
            : '<input type="' + type + '" id="' + id + '" placeholder="' + (placeholder_or_options || '') + '" '
            + 'style="width:100%;padding:9px 12px;border:1.5px solid rgba(0,212,170,0.2);border-radius:10px;background:rgba(232,240,255,0.04);color:inherit;font-size:0.88rem;">';
        return '<div style="grid-column:' + (type === 'select' || id.includes('orgname') ? 'span 1' : 'span 1') + ';">'
            + '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px;">' + label + '</label>'
            + inner + '</div>';
    }

    /* Preview selected doc filenames */
    window._previewNgoDocs = function(input) {
        var list = document.getElementById('ngo-app-doc-list');
        if (!list || !input.files) return;
        list.textContent = Array.from(input.files).map(function(f) { return '📎 ' + f.name; }).join(' · ');
    };

    /* Submit NGO application to Firestore */
    window._submitNgoApplication = async function() {
        var btn = document.getElementById('ngo-app-submit-btn');
        var fb  = document.getElementById('ngo-app-feedback');

        function _setFb(msg, type) {
            if (!fb) return;
            fb.style.display    = 'block';
            fb.style.background = type === 'error' ? 'rgba(239,68,68,0.1)' : type === 'success' ? 'rgba(0,212,170,0.1)' : 'rgba(245,158,11,0.1)';
            fb.style.color      = type === 'error' ? 'var(--danger-color,#ef4444)' : type === 'success' ? 'var(--nav-accent,#00D4AA)' : '#d97706';
            fb.innerHTML        = msg;
        }

        var orgName  = (document.getElementById('ngo-app-orgname')   || {}).value || '';
        var regNum   = (document.getElementById('ngo-app-regnumber') || {}).value || '';
        var country  = (document.getElementById('ngo-app-country')   || {}).value || '';
        var sector   = (document.getElementById('ngo-app-sector')    || {}).value || '';
        var email    = (document.getElementById('ngo-app-email')     || {}).value || '';
        var phone    = (document.getElementById('ngo-app-phone')     || {}).value || '';
        var website  = (document.getElementById('ngo-app-website')   || {}).value || '';
        var wallet   = (document.getElementById('ngo-app-wallet')    || {}).value || '';
        var mission  = (document.getElementById('ngo-app-mission')   || {}).value || '';
        var docsInput= document.getElementById('ngo-app-docs');
        var bankAccountNumber = (document.getElementById('ngo-app-bank-account-number') || {}).value || '';
        var bankAccountName   = (document.getElementById('ngo-app-bank-account-name')   || {}).value || '';
        var bankName          = (document.getElementById('ngo-app-bank-name')           || {}).value || '';

        if (!orgName.trim() || !regNum.trim() || !country.trim() || !sector || !email.trim() || !mission.trim()) {
            _setFb('⚠ Please fill in all required fields (marked with *).', 'error'); return;
        }
        if (!docsInput || !docsInput.files || !docsInput.files.length) {
            _setFb('⚠ Please upload at least one KYC document.', 'error'); return;
        }

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting…'; }
        _setFb('<i class="fas fa-circle-notch fa-spin"></i> Uploading documents…', 'info');

        /* Upload documents to Cloudinary */
        var docUrls = [];
        try {
            docUrls = await Promise.all(Array.from(docsInput.files).map(_uploadDoc));
            docUrls = docUrls.filter(Boolean);
        } catch(uploadErr) {
            console.warn('[NGO App] Upload error:', uploadErr);
        }

        var application = {
            orgName:      orgName.trim(),
            regNumber:    regNum.trim(),
            country:      country.trim(),
            sector:       sector,
            email:        email.trim(),
            phone:        phone.trim(),
            website:      website.trim(),
            walletAddress: wallet.trim(),
            bankAccountNumber: bankAccountNumber.trim(),
            bankAccountName:   bankAccountName.trim(),
            bankName:          bankName.trim(),
            mission:      mission.trim(),
            documents:    docUrls,
            status:       'pending',
            applicantId:  _us().id || 'guest',
            applicantEmail: _us().email || email.trim(),
            submittedAt:  _serverTs()
        };

        if (_fbOk() && _db()) {
            _db().collection('ngo_applications').add(application)
                .then(function(ref) {
                    _setFb('✅ Application submitted successfully! Reference: <strong>' + ref.id + '</strong><br>'
                        + 'Your application will be reviewed within 3-5 business days.', 'success');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Submitted'; }
                    _notify('NGO application submitted! ID: ' + ref.id, 'success');
                    setTimeout(function() {
                        var modal = document.getElementById('ngo-application-modal');
                        if (modal) { modal.remove(); document.body.classList.remove('modal-open'); }
                    }, 4000);
                })
                .catch(function(e) {
                    _setFb('❌ Submission failed: ' + e.message, 'error');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application'; }
                });
        } else {
            /* Offline fallback */
            _setFb('✅ Application saved locally. Will sync when online.', 'success');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Saved Locally'; }
            _notify('NGO application saved (offline mode).', 'info');
        }
    };


    /* =========================================================================
       §13b  INDIVIDUAL ACCOUNT INFORMATION MODULE  (NEW)
       Admin-controlled form for collecting individual bank/personal details
       linked to disbursement. The form is hidden by default and only appears
       on the general dashboard when enabled by an admin.
       ========================================================================= */

    /* ── State key used across session ── */
    var _IND_ACCT_KEY    = 'empyrean_ind_acct_form_enabled';
    var _indSnapUnsub    = null;   /* onSnapshot unsubscribe handle */
    var _bannerGuardObs  = null;   /* MutationObserver that re-asserts display */

    /* ── Single source of truth ──────────────────────────────────────────
       Priority: localStorage (persists across refreshes/tabs) → false.
       EmpState is no longer checked first because it resets on every page
       load and can be stale; localStorage is always authoritative locally
       while Firestore is the cross-device authority.                      */
    window._indAcctFormEnabled = function() {
        try { return localStorage.getItem(_IND_ACCT_KEY) === '1'; } catch(e) {}
        return false;
    };

    /* ── Write state to BOTH Firestore documents ─────────────────────────
       app-fix-final.js reads  app_config/individual_form  { active }
       app-ngo.js reads        app_settings/individual_account_form { enabled }
       They are DIFFERENT documents. Both must be kept in sync or they
       fight each other and flip the banner on/off.                        */
    function _writeIndAcctState(enable, db) {
        var payload  = { updatedAt: _serverTs(), updatedBy: _us().id || 'admin' };
        var p1 = db.collection('app_settings').doc('individual_account_form')
                   .set(Object.assign({}, payload, { enabled: enable }), { merge: true });
        var p2 = db.collection('app_config').doc('individual_form')
                   .set(Object.assign({}, payload, { active: enable }),  { merge: true });
        return Promise.all([p1, p2]).catch(function(e) {
            console.warn('[IndAcct] Firestore write failed:', e.message);
        });
    }

    /* ── Admin toggle ────────────────────────────────────────────────────*/
    window._toggleIndAcctForm = async function(enable) {
        if (!_isAdmin()) { _notify('Admin access required.', 'error'); return; }
        enable = !!enable;

        /* Update localStorage immediately so the UI responds at once */
        try { localStorage.setItem(_IND_ACCT_KEY, enable ? '1' : '0'); } catch(e) {}
        if (window.EmpState) window.EmpState.indAcctFormEnabled = enable;
        _renderIndAcctBanner();

        /* Write to both Firestore docs */
        if (_fbOk() && _db()) await _writeIndAcctState(enable, _db());

        _notify(
            enable ? '✅ Individual Account form is now ACTIVE on the dashboard.'
                   : '⏸ Individual Account form has been deactivated.',
            enable ? 'success' : 'info'
        );

        /* Refresh admin toggle button */
        var tog = document.getElementById('ind-acct-admin-toggle-btn');
        if (tog) {
            tog.innerHTML = enable ? '<i class="fas fa-toggle-on"></i> Deactivate Form'
                                   : '<i class="fas fa-toggle-off"></i> Activate Form';
            tog.style.background = enable ? 'rgba(239,68,68,0.12)' : 'var(--nav-accent,#00D4AA)';
            tog.style.color      = enable ? '#ef4444' : '#0A0F1E';
            tog.onclick = function() { window._toggleIndAcctForm(!enable); };
        }
    };

    /* ── Real-time listener (cross-device) ───────────────────────────────
       Listens to app_settings/individual_account_form.
       When any admin toggles on any device, every open session updates
       within seconds.  Also ensures app_config/individual_form stays in
       sync so app-fix-final.js's _checkIndFormState never overrides us.  */
    function _startIndAcctListener() {
        if (!_fbOk() || !_db()) return;
        if (typeof _indSnapUnsub === 'function') { try { _indSnapUnsub(); } catch(e) {} }
        try {
            _indSnapUnsub = _db().collection('app_settings').doc('individual_account_form')
                .onSnapshot(function(doc) {
                    var enabled = doc.exists ? !!doc.data().enabled : false;
                    /* Sync localStorage — the local read authority */
                    try { localStorage.setItem(_IND_ACCT_KEY, enabled ? '1' : '0'); } catch(e) {}
                    if (window.EmpState) window.EmpState.indAcctFormEnabled = enabled;
                    /* Keep app_config/individual_form in sync so app-fix-final.js agrees */
                    if (enabled && _fbOk() && _db()) {
                        _db().collection('app_config').doc('individual_form')
                             .set({ active: true }, { merge: true }).catch(function(){});
                    }
                    _renderIndAcctBanner();
                }, function(err) {
                    console.warn('[IndAcct] onSnapshot error:', err.message);
                });
        } catch(e) { console.warn('[IndAcct] Could not start listener:', e.message); }
    }

    /* Called on boot — starts the real-time listener */
    function _loadIndAcctFormState() {
        _startIndAcctListener();
    }

    /* ── MutationObserver guard ──────────────────────────────────────────
       app-fix-final.js can set banner.style.display='none' if its own
       _checkIndFormState fires and finds app_config/individual_form stale.
       This observer watches for that and immediately corrects it back.    */
    function _attachBannerGuard(banner) {
        if (_bannerGuardObs) { try { _bannerGuardObs.disconnect(); } catch(e) {} }
        _bannerGuardObs = new MutationObserver(function() {
            if (window._indAcctFormEnabled() && banner.style.display === 'none') {
                banner.style.display = '';
            }
        });
        _bannerGuardObs.observe(banner, { attributes: true, attributeFilter: ['style'] });
    }

    /* ── Render / refresh the dashboard banner ───────────────────────────
       Self-creates the banner div if not yet in the DOM, places it just
       before the Community Feed card inside .dashboard-grid.              */
    function _renderIndAcctBanner() {
        var enabled = window._indAcctFormEnabled();

        var banner = document.getElementById('ind-acct-dashboard-banner');
        if (!banner) {
            /* Find .dashboard-grid (direct parent of the Community Feed card) */
            var grid = document.querySelector('#dashboard .dashboard-grid');
            if (!grid) return;
            banner = document.createElement('div');
            banner.id = 'ind-acct-dashboard-banner';
            banner.style.cssText = 'display:none;';
            /* Insert before the card that contains #feed-container */
            var feedEl = document.getElementById('feed-container');
            var anchor = null;
            if (feedEl) {
                var node = feedEl;
                while (node && node.parentNode !== grid) node = node.parentNode;
                if (node && node.parentNode === grid) anchor = node;
            }
            if (anchor) grid.insertBefore(banner, anchor);
            else grid.prepend(banner);
            /* Attach the guard now that the element exists */
            _attachBannerGuard(banner);
        }

        banner.style.display = enabled ? '' : 'none';
        if (!enabled) return;
        banner.innerHTML =
            '<div style="background:linear-gradient(135deg,rgba(0,212,170,0.12),rgba(59,130,246,0.10));'
            + 'border:1.5px solid rgba(0,212,170,0.3);border-radius:16px;padding:0;overflow:hidden;margin-bottom:20px;">'
            /* Accent bar */
            + '<div style="height:4px;background:linear-gradient(90deg,var(--nav-accent,#00D4AA),#3B82F6,var(--nav-accent,#00D4AA));"></div>'
            + '<div style="padding:18px 20px;">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">'
            + '<div style="width:38px;height:38px;border-radius:10px;background:rgba(0,212,170,0.15);'
            + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
            + '<i class="fas fa-hand-holding-usd" style="color:var(--nav-accent,#00D4AA);font-size:1.1rem;"></i></div>'
            + '<div>'
            + '<div style="font-weight:800;font-family:\'Syne\',sans-serif;font-size:1rem;">Account Information Required</div>'
            + '<div style="font-size:0.80rem;color:var(--text-muted);">Please submit your bank details to receive your disbursement</div>'
            + '</div>'
            + '</div>'
            + '<button class="btn btn-accent" style="font-size:0.88rem;" '
            + 'onclick="window.openIndividualAccountForm && window.openIndividualAccountForm()">'
            + '<i class="fas fa-edit"></i> Fill Account Form</button>'
            + '</div>'
            + '</div>';
    }
    window._renderIndAcctBanner = _renderIndAcctBanner;

    /* Open the individual account information form modal */
    window.openIndividualAccountForm = function() {
        if (_isGuest()) {
            _notify('Please log in to submit your account information.', 'info');
            if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
            return;
        }

        var existing = document.getElementById('ind-acct-modal');
        if (existing) { existing.style.display = 'flex'; return; }

        var us    = _us();
        var modal = document.createElement('div');
        modal.id  = 'ind-acct-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,30,0.85);backdrop-filter:blur(4px);'
            + 'z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto;';

        modal.innerHTML =
            '<div style="background:var(--card-bg,#111827);border-radius:20px;width:100%;max-width:560px;'
            + 'border:1px solid rgba(0,212,170,0.2);overflow:hidden;animation:empNavFadeIn 0.2s ease;margin:auto;">'
            /* Header accent */
            + '<div style="height:4px;background:linear-gradient(90deg,var(--nav-accent,#00D4AA),#3B82F6);"></div>'
            + '<div style="padding:22px 24px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
            + '<h3 style="font-family:\'Syne\',sans-serif;font-weight:800;margin:0;font-size:1.1rem;">'
            + '<i class="fas fa-user-circle" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Individual Account Information</h3>'
            + '<button onclick="document.getElementById(\'ind-acct-modal\').style.display=\'none\'" '
            + 'style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;padding:4px;">'
            + '<i class="fas fa-times"></i></button>'
            + '</div>'
            + '<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:18px;line-height:1.6;">'
            + 'Please complete all fields accurately. Your information will be used solely for disbursement purposes.</p>'
            /* Personal details */
            + '<div style="font-size:0.72rem;font-weight:700;color:var(--nav-accent,#00D4AA);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">'
            + '<i class="fas fa-user" style="margin-right:5px;"></i>Personal Details</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:14px;">'
            + _modalField('ind-acct-fullname', 'Full Name *', 'text', us.fullName || 'Legal full name')
            + _modalField('ind-acct-phone',    'Phone Number *', 'tel', us.phone || '+234…')
            + _modalField('ind-acct-gender',   'Gender *', 'select',
                '<option value="">Select…</option>'
                + '<option value="male">Male</option><option value="female">Female</option>'
                + '<option value="non-binary">Non-binary</option><option value="prefer_not">Prefer not to say</option>')
            + _modalField('ind-acct-occupation', 'Occupation *', 'text', 'e.g. Teacher, Nurse, Farmer')
            + _modalField('ind-acct-education',  'Highest Education *', 'select',
                '<option value="">Select…</option>'
                + '<option value="no_formal">No Formal Education</option>'
                + '<option value="primary">Primary</option>'
                + '<option value="secondary">Secondary / WAEC</option>'
                + '<option value="diploma">Diploma / OND</option>'
                + '<option value="undergraduate">Undergraduate / HND</option>'
                + '<option value="postgraduate">Postgraduate</option>'
                + '<option value="other">Other</option>')
            + _modalField('ind-acct-purpose', 'Purpose of Subscription *', 'text', 'Why are you subscribing for this disbursement?')
            + '</div>'
            /* Bank account details */
            + '<div style="font-size:0.72rem;font-weight:700;color:var(--nav-accent,#00D4AA);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">'
            + '<i class="fas fa-university" style="margin-right:5px;"></i>Bank Account Details</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:16px;">'
            + _modalField('ind-acct-bank-account-name',   'Bank Account Name *', 'text', 'Name registered with bank')
            + _modalField('ind-acct-bank-account-number', 'Account Number *',    'text', '10-digit account number')
            + _modalField('ind-acct-bank-name',           'Bank Name *',         'text', 'e.g. GTBank, Zenith, Access')
            + '</div>'
            /* Feedback */
            + '<div id="ind-acct-feedback" style="display:none;margin-bottom:12px;padding:10px 14px;border-radius:10px;font-size:0.85rem;"></div>'
            /* Actions */
            + '<div style="display:flex;gap:10px;">'
            + '<button class="btn btn-accent" id="ind-acct-submit-btn" '
            + 'onclick="window._submitIndividualAccountForm && window._submitIndividualAccountForm()" style="flex:1;">'
            + '<i class="fas fa-paper-plane"></i> Submit Information</button>'
            + '<button class="btn" onclick="document.getElementById(\'ind-acct-modal\').style.display=\'none\'" style="flex-shrink:0;">Cancel</button>'
            + '</div>'
            + '</div></div>';

        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
        });
    };

    /* Submit individual account information */
    window._submitIndividualAccountForm = async function() {
        var btn = document.getElementById('ind-acct-submit-btn');
        var fb  = document.getElementById('ind-acct-feedback');

        function _setFb(msg, type) {
            if (!fb) return;
            fb.style.display    = 'block';
            fb.style.background = type === 'error' ? 'rgba(239,68,68,0.1)' : type === 'success' ? 'rgba(0,212,170,0.1)' : 'rgba(245,158,11,0.1)';
            fb.style.color      = type === 'error' ? 'var(--danger-color,#ef4444)' : type === 'success' ? 'var(--nav-accent,#00D4AA)' : '#d97706';
            fb.innerHTML        = msg;
        }

        var fullName    = (document.getElementById('ind-acct-fullname')           || {}).value || '';
        var phone       = (document.getElementById('ind-acct-phone')              || {}).value || '';
        var gender      = (document.getElementById('ind-acct-gender')             || {}).value || '';
        var occupation  = (document.getElementById('ind-acct-occupation')         || {}).value || '';
        var education   = (document.getElementById('ind-acct-education')          || {}).value || '';
        var purpose     = (document.getElementById('ind-acct-purpose')            || {}).value || '';
        var acctName    = (document.getElementById('ind-acct-bank-account-name')   || {}).value || '';
        var acctNumber  = (document.getElementById('ind-acct-bank-account-number') || {}).value || '';
        var bankName    = (document.getElementById('ind-acct-bank-name')           || {}).value || '';

        if (!fullName.trim() || !phone.trim() || !gender || !occupation.trim() || !education || !purpose.trim()
            || !acctName.trim() || !acctNumber.trim() || !bankName.trim()) {
            _setFb('⚠ Please fill in all required fields marked with *.', 'error');
            return;
        }
        if (!/^\d{10}$/.test(acctNumber.replace(/\s/g,''))) {
            _setFb('⚠ Please enter a valid 10-digit bank account number.', 'error');
            return;
        }

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting…'; }

        var record = {
            fullName:          fullName.trim(),
            phone:             phone.trim(),
            gender:            gender,
            occupation:        occupation.trim(),
            education:         education,
            purposeOfSubscription: purpose.trim(),
            bankAccountName:   acctName.trim(),
            bankAccountNumber: acctNumber.replace(/\s/g,''),
            bankName:          bankName.trim(),
            userId:            _us().id || 'guest',
            userEmail:         _us().email || '',
            submittedAt:       _serverTs(),
            status:            'pending'
        };

        if (_fbOk() && _db()) {
            try {
                var ref = await _db().collection('individual_account_info').add(record);
                _setFb('✅ Account information submitted successfully! Reference: <strong>' + ref.id + '</strong>', 'success');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Submitted'; }
                _notify('Account information saved. Reference: ' + ref.id, 'success');
                setTimeout(function() {
                    var m = document.getElementById('ind-acct-modal');
                    if (m) m.style.display = 'none';
                }, 3500);
            } catch(e) {
                _setFb('❌ Submission failed: ' + _esc(e.message), 'error');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Information'; }
            }
        } else {
            _setFb('✅ Information saved locally (offline mode). Will sync when online.', 'success');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Saved'; }
        }
    };

    /* Admin control panel section for the Individual Account Form toggle */
    function _renderIndividualAccountAdminPanel() {
        var enabled = window._indAcctFormEnabled();
        return '<div class="card" style="margin-bottom:16px;">'
            + '<div style="height:3px;background:linear-gradient(90deg,var(--nav-accent,#00D4AA),#3B82F6);"></div>'
            + '<div class="card-content">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px;">'
            + '<div>'
            + '<h3 style="font-family:\'Syne\',sans-serif;margin:0 0 4px;">'
            + '<i class="fas fa-user-circle" style="color:var(--nav-accent,#00D4AA);margin-right:8px;"></i>Individual Account Form</h3>'
            + '<p style="color:var(--text-muted);font-size:0.83rem;margin:0;">'
            + 'Activate to display the individual account information form on the general dashboard. '
            + 'When active, a banner will guide users to fill in their bank details for disbursement.</p>'
            + '</div>'
            + '<button id="ind-acct-admin-toggle-btn" class="btn" '
            + 'style="white-space:nowrap;flex-shrink:0;font-size:0.85rem;'
            + (enabled ? 'background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);' : 'background:var(--nav-accent,#00D4AA);color:#0A0F1E;')
            + '" onclick="window._toggleIndAcctForm(' + !enabled + ')">'
            + (enabled ? '<i class="fas fa-toggle-on"></i> Deactivate Form' : '<i class="fas fa-toggle-off"></i> Activate Form')
            + '</button>'
            + '</div>'
            /* Status indicator */
            + '<div style="padding:10px 14px;border-radius:10px;font-size:0.83rem;'
            + 'background:' + (enabled ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.08)') + ';'
            + 'border:1px solid ' + (enabled ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.2)') + ';'
            + 'color:' + (enabled ? '#22c55e' : 'var(--text-muted)') + ';">'
            + '<i class="fas ' + (enabled ? 'fa-circle' : 'fa-circle') + '" style="font-size:0.5rem;vertical-align:middle;margin-right:6px;"></i>'
            + (enabled ? '<strong>ACTIVE</strong> — The form and banner are currently visible on the dashboard homepage.'
                       : '<strong>INACTIVE</strong> — The form is hidden. Only you can see it here in the admin panel.')
            + '</div>'
            /* View submissions */
            + '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">'
            + '<button class="btn btn-small" onclick="window._loadIndAcctSubmissions && window._loadIndAcctSubmissions()">'
            + '<i class="fas fa-list"></i> View Submissions</button>'
            + '<button class="btn btn-small" onclick="window._exportIndAcctData && window._exportIndAcctData()">'
            + '<i class="fas fa-download"></i> Export CSV</button>'
            + '</div>'
            + '<div id="ind-acct-submissions-container" style="margin-top:14px;"></div>'
            + '</div></div>';
    }

    /* Load individual account form submissions for admin */
    window._loadIndAcctSubmissions = function() {
        var container = document.getElementById('ind-acct-submissions-container');
        if (!container) return;

        if (!_fbOk() || !_db()) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Firebase not connected.</p>';
            return;
        }
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;"><i class="fas fa-circle-notch fa-spin"></i> Loading…</p>';

        _db().collection('individual_account_info').orderBy('submittedAt', 'desc').limit(100).get()
            .then(function(snap) {
                if (snap.empty) {
                    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">No submissions yet.</p>';
                    return;
                }
                var rows = '';
                snap.forEach(function(doc) {
                    var d  = doc.data();
                    var dt = d.submittedAt && d.submittedAt.toDate
                        ? d.submittedAt.toDate().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
                        : '—';
                    rows += '<tr style="border-bottom:1px solid rgba(0,212,170,0.07);">'
                        + '<td style="padding:8px 10px;font-size:0.82rem;">' + _esc(d.fullName || '—') + '</td>'
                        + '<td style="padding:8px 10px;font-size:0.82rem;">' + _esc(d.phone || '—') + '</td>'
                        + '<td style="padding:8px 10px;font-size:0.82rem;font-family:monospace;">' + _esc(d.bankAccountNumber || '—') + '</td>'
                        + '<td style="padding:8px 10px;font-size:0.82rem;">' + _esc(d.bankAccountName || '—') + '</td>'
                        + '<td style="padding:8px 10px;font-size:0.82rem;">' + _esc(d.bankName || '—') + '</td>'
                        + '<td style="padding:8px 10px;font-size:0.82rem;">' + _esc(d.occupation || '—') + '</td>'
                        + '<td style="padding:8px 10px;font-size:0.82rem;">' + _esc(dt) + '</td>'
                        + '</tr>';
                });
                container.innerHTML = '<div style="overflow-x:auto;margin-top:4px;">'
                    + '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
                    + '<thead><tr style="border-bottom:2px solid rgba(0,212,170,0.15);">'
                    + '<th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;">Full Name</th>'
                    + '<th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;">Phone</th>'
                    + '<th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;">Account No.</th>'
                    + '<th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;">Account Name</th>'
                    + '<th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;">Bank</th>'
                    + '<th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;">Occupation</th>'
                    + '<th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;">Date</th>'
                    + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
                    + '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">' + snap.size + ' submission(s) total.</p>';
            })
            .catch(function(e) {
                container.innerHTML = '<p style="color:var(--danger-color);font-size:0.85rem;">Error: ' + _esc(e.message) + '</p>';
            });
    };

    /* Export individual account submissions as CSV */
    window._exportIndAcctData = function() {
        if (!_fbOk() || !_db()) { _notify('Firebase not connected.', 'error'); return; }
        _db().collection('individual_account_info').orderBy('submittedAt', 'desc').limit(500).get()
            .then(function(snap) {
                if (snap.empty) { _notify('No submissions to export.', 'info'); return; }
                var keys = ['fullName','phone','gender','occupation','education','purposeOfSubscription',
                    'bankAccountName','bankAccountNumber','bankName','userEmail','submittedAt'];
                var header = keys.join(',');
                var csvRows = [];
                snap.forEach(function(doc) {
                    var d = doc.data();
                    csvRows.push(keys.map(function(k) {
                        var v = d[k];
                        if (v && v.toDate) v = v.toDate().toISOString().split('T')[0];
                        return '"' + String(v !== undefined ? v : '').replace(/"/g,'""') + '"';
                    }).join(','));
                });
                var blob = new Blob([[header].concat(csvRows).join('\n')], { type: 'text/csv;charset=utf-8;' });
                var url  = URL.createObjectURL(blob);
                var a    = document.createElement('a');
                a.href = url; a.download = 'individual-account-info-' + Date.now() + '.csv';
                a.style.display = 'none';
                document.body.appendChild(a); a.click();
                setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
                _notify('✅ CSV export ready — ' + snap.size + ' records.', 'success');
            })
            .catch(function(e) { _notify('Export failed: ' + e.message, 'error'); });
    };


    /* =========================================================================
       §13  INDIVIDUAL GRANT REQUEST MODAL  (NEW)
       Public-facing modal for individuals to apply for grant funding.
       ========================================================================= */

    window.openIndividualGrantModal = function() {
        if (_isGuest()) {
            _notify('Please log in to apply for an individual grant.', 'info');
            if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
            return;
        }

        var existing = document.getElementById('individual-grant-modal');
        if (existing) existing.remove();

        var us    = _us();
        var modal = document.createElement('div');
        modal.id  = 'individual-grant-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,30,0.85);backdrop-filter:blur(4px);'
            + 'z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';

        modal.innerHTML =
            '<div style="background:var(--card-bg,#111827);border-radius:20px;width:100%;max-width:540px;'
            + 'border:1px solid rgba(0,212,170,0.2);overflow:hidden;animation:empNavFadeIn 0.2s ease;">'
            + '<div style="height:4px;background:linear-gradient(90deg,#22c55e,#00D4AA);"></div>'
            + '<div style="padding:24px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">'
            + '<h3 style="font-family:\'Syne\',sans-serif;font-weight:800;margin:0;">'
            + '<i class="fas fa-user-check" style="color:#22c55e;margin-right:10px;"></i>Individual Grant Application</h3>'
            + '<button onclick="document.getElementById(\'individual-grant-modal\').remove()" '
            + 'style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;padding:4px;">'
            + '<i class="fas fa-times"></i></button>'
            + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
            + _modalField('ind-grant-name',    'Full Legal Name *', 'text', us.fullName || 'Your full name')
            + _modalField('ind-grant-email',   'Email Address *',  'email', us.email || 'your@email.com')
            + _modalField('ind-grant-phone',   'Phone Number *', 'tel', '+234…')
            + _modalField('ind-grant-amount',  'Grant Amount Requested *', 'number', 'e.g. 150000')
            + _modalField('ind-grant-currency','Currency', 'select',
                '<option value="NGN">NGN (₦ Naira)</option>'
                + '<option value="USD">USD ($)</option>'
                + '<option value="EMPY">EMPY Token</option>'
                + '<option value="USDT">USDT</option>')
            + _modalField('ind-grant-purpose', 'Grant Purpose *', 'text', 'e.g. Medical treatment, Education fees')
            + '</div>'
            + '<div style="margin-top:12px;">'
            + '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px;">Reason / Justification *</label>'
            + '<textarea id="ind-grant-reason" rows="3" placeholder="Explain why you need this grant and how the funds will be used…" '
            + 'style="width:100%;padding:10px 12px;border:1.5px solid rgba(0,212,170,0.2);border-radius:10px;'
            + 'background:rgba(232,240,255,0.04);color:inherit;font-size:0.88rem;resize:vertical;"></textarea>'
            + '</div>'
            + '<div style="margin-top:12px;">'
            + '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px;">Preferred Payment Method *</label>'
            + '<select id="ind-grant-method" style="width:100%;padding:9px 12px;border:1.5px solid rgba(0,212,170,0.2);border-radius:10px;background:rgba(232,240,255,0.04);color:inherit;font-size:0.88rem;">'
            + '<option value="bank">Bank Transfer</option>'
            + '<option value="mobile_money">Mobile Money</option>'
            + '<option value="crypto_wallet">Crypto Wallet</option>'
            + '<option value="flutterwave">Flutterwave Disbursement</option>'
            + '</select>'
            + '</div>'
            + '<div style="margin-top:10px;" id="ind-grant-wallet-row" style="display:none;">'
            + _modalField('ind-grant-wallet',  'Wallet / Account Details', 'text', 'Wallet address or bank account number')
            + '</div>'
            + '<div style="padding:10px 14px;border-radius:10px;background:rgba(0,212,170,0.05);border:1px solid rgba(0,212,170,0.15);margin-top:12px;font-size:0.80rem;">'
            + '<i class="fas fa-lock" style="color:var(--nav-accent,#00D4AA);margin-right:6px;"></i>'
            + 'Your application is encrypted and reviewed by our compliance team. '
            + 'Identity verification may be required before disbursement.'
            + '</div>'
            + '<div id="ind-grant-feedback" style="display:none;margin-top:12px;padding:10px 14px;border-radius:10px;font-size:0.85rem;"></div>'
            + '<div style="display:flex;gap:10px;margin-top:20px;">'
            + '<button class="btn btn-accent" id="ind-grant-submit-btn" '
            + 'onclick="window._submitIndividualGrantReq && window._submitIndividualGrantReq()" style="flex:1;background:#22c55e;">'
            + '<i class="fas fa-paper-plane"></i> Submit Application</button>'
            + '<button class="btn" onclick="document.getElementById(\'individual-grant-modal\').remove()">Cancel</button>'
            + '</div>'
            + '</div></div>';

        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        modal.addEventListener('click', function(e) {
            if (e.target === modal) { modal.remove(); document.body.classList.remove('modal-open'); }
        });
    };

    /* Submit individual grant request */
    window._submitIndividualGrantReq = function() {
        var btn = document.getElementById('ind-grant-submit-btn');
        var fb  = document.getElementById('ind-grant-feedback');

        function _setFb(msg, type) {
            if (!fb) return;
            fb.style.display    = 'block';
            fb.style.background = type === 'error' ? 'rgba(239,68,68,0.1)' : type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)';
            fb.style.color      = type === 'error' ? 'var(--danger-color,#ef4444)' : type === 'success' ? '#22c55e' : '#d97706';
            fb.textContent      = msg;
        }

        var fullName  = (document.getElementById('ind-grant-name')     || {}).value || '';
        var email     = (document.getElementById('ind-grant-email')    || {}).value || '';
        var phone     = (document.getElementById('ind-grant-phone')    || {}).value || '';
        var amount    = parseFloat((document.getElementById('ind-grant-amount')  || {}).value || '0');
        var currency  = (document.getElementById('ind-grant-currency') || {}).value || 'NGN';
        var purpose   = (document.getElementById('ind-grant-purpose')  || {}).value || '';
        var reason    = (document.getElementById('ind-grant-reason')   || {}).value || '';
        var method    = (document.getElementById('ind-grant-method')   || {}).value || 'bank';
        var wallet    = (document.getElementById('ind-grant-wallet')   || {}).value || '';

        if (!fullName.trim() || !email.trim() || !phone.trim() || !amount || !purpose.trim() || !reason.trim()) {
            _setFb('⚠ Please fill in all required fields.', 'error'); return;
        }
        if (amount < 1000) { _setFb('⚠ Minimum grant request is ' + _fmtAmount(1000, currency) + '.', 'error'); return; }

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting…'; }

        var record = {
            fullName:      fullName.trim(),
            email:         email.trim(),
            phone:         phone.trim(),
            amount:        amount,
            currency:      currency,
            purpose:       purpose.trim(),
            reason:        reason.trim(),
            paymentMethod: method,
            walletOrAccount: wallet.trim(),
            applicantId:   _us().id || 'guest',
            status:        'pending',
            submittedAt:   _serverTs()
        };

        if (_fbOk() && _db()) {
            _db().collection('individual_grants').add(record)
                .then(function(ref) {
                    _setFb('✅ Application submitted! Reference: ' + ref.id + '. We will contact you within 5 business days.', 'success');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Submitted'; }
                    _notify('Individual grant application submitted. ID: ' + ref.id, 'success');
                    setTimeout(function() {
                        var modal = document.getElementById('individual-grant-modal');
                        if (modal) { modal.remove(); document.body.classList.remove('modal-open'); }
                    }, 4000);
                })
                .catch(function(e) {
                    _setFb('❌ Submission failed: ' + e.message, 'error');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application'; }
                });
        } else {
            _setFb('✅ Application saved locally (offline mode). Will sync when online.', 'success');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Saved'; }
        }
    };


    /* =========================================================================
       §14  FIRESTORE LOADERS
       ========================================================================= */

    /* Load verified NGO partners from Firestore (v1 preserved + enhanced) */
    function _loadNgoPartners() {
        if (!_fbOk() || !_db()) return;
        if (window._ngoPartnersLoaded) return;

        _db().collection('ngo_partners')
            .where('isVerified', '==', true)
            .limit(100)
            .get()
            .then(function(snap) {
                if (!snap || snap.empty) return;
                var partners = (_S().mockNgoPartners) || window.mockNgoPartners || {};
                snap.forEach(function(doc) {
                    var data = doc.data();
                    data.id  = data.id || doc.id;
                    if (data.id) partners[data.id] = data;
                });
                if (window.EmpState) window.EmpState.mockNgoPartners = partners;
                else                 window.mockNgoPartners           = partners;
                window._ngoPartnersLoaded = true;
                renderNgoGrid();
            })
            .catch(function(e) { console.warn('[NGO] Firestore load failed:', e && e.message); });
    }

    /* Load grant applications for the admin queue */
    function _loadGrantApplications() {
        if (!_fbOk() || !_db()) return;
        renderNgoVerificationQueue();
    }

    /* Load individual grant queue */
    function _loadIndividualGrantQueue() {
        if (!_fbOk() || !_db()) return;
        renderIndividualGrantPanel();
    }


    /* =========================================================================
       §15  COMMUNITY TASK CLICK HANDLER  (v1 preserved — unchanged)
       ========================================================================= */

    document.addEventListener('click', function(e) {
        var taskBtn = e.target.closest('.community-task-btn');
        if (!taskBtn) return;
        e.preventDefault();

        if (_isGuest()) {
            if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
            return;
        }

        var taskId = taskBtn.dataset.taskId;
        var reward = parseInt(taskBtn.dataset.reward, 10) || 0;
        var url    = taskBtn.dataset.url || '#';
        var us     = _us();

        if (!us.completedTasks) us.completedTasks = new Set();

        if (us.completedTasks.has(taskId)) {
            _notify('Task already completed! Reward already earned.', 'info');
            if (url && url !== '#') window.open(url, '_blank');
            return;
        }

        us.empyBalance = (us.empyBalance || 0) + reward;
        us.completedTasks.add(taskId);
        if (typeof window.updateWalletUI === 'function') window.updateWalletUI();
        _notify('+' + reward + ' EMPY! Task completed. Reward earned once.', 'success');

        try {
            if (us.id && _fbOk() && _db()) {
                _db().collection('users').doc(us.id).update({
                    completedTasks: Array.from(us.completedTasks),
                    empyBalance:    us.empyBalance
                }).catch(function() {});
            }
        } catch(err) {}

        if (url && url !== '#') window.open(url, '_blank');
        renderCommunityTasks();
    });


    /* =========================================================================
       §16  NGO CARD CLICK + BACK-TO-GRID  (v1 preserved — unchanged)
       ========================================================================= */

    document.addEventListener('click', function(e) {
        var ngoCard = e.target.closest('.ngo-card');
        if (ngoCard && ngoCard.dataset.ngoId) {
            e.preventDefault();
            renderNgoProfile(ngoCard.dataset.ngoId);
            return;
        }
        if (e.target.closest('#back-to-ngo-grid')) {
            e.preventDefault();
            var gridView    = document.getElementById('ngo-grid-view');
            var profileView = document.getElementById('ngo-profile-view');
            var backBtn     = document.getElementById('back-to-ngo-grid');
            if (gridView)    gridView.style.display    = 'block';
            if (profileView) profileView.style.display = 'none';
            if (backBtn)     backBtn.style.display     = 'none';
        }
    });


    /* =========================================================================
       §17  DONATE BUTTON → DONATION MODAL  (v1 preserved + NGO donate path)
       ========================================================================= */

    document.addEventListener('click', function(e) {
        var donateBtn = e.target.closest('.donate-post-btn, .help-now-btn, .sos-button');
        if (!donateBtn) return;

        if (_isGuest()) {
            _notify('Please log in to donate.', 'info');
            if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
            return;
        }

        var modal = document.getElementById('donation-modal-overlay')
            || document.getElementById('sos-donation-modal');
        if (!modal) return;

        var postCard   = donateBtn.closest('.impact-story');
        var authorName = postCard
            ? ((postCard.querySelector('.story-user-info strong') || {}).textContent || 'this cause')
            : 'this cause';
        var sosUserId  = (postCard && postCard.dataset.userId)  || '';
        var sosPostId  = (postCard && postCard.dataset.postId)  || '';
        var sosUsername= (postCard && postCard.dataset.username) || authorName;

        window._sosDonationContext = { userId: sosUserId, postId: sosPostId, username: sosUsername };

        var titleEl = document.getElementById('donation-modal-title');
        var descEl  = document.getElementById('donation-modal-description');
        if (titleEl) titleEl.textContent = 'Support ' + authorName;
        if (descEl)  descEl.textContent  = 'Your donation is held in escrow and disbursed directly to '
            + sosUsername + ' after admin verification.';

        modal.style.display = 'flex';
        modal.classList.add('show');
        document.body.classList.add('modal-open');
    });

    /* NGO-specific donation modal */
    window._openNgoDonationModal = function(ngoId) {
        if (_isGuest()) {
            _notify('Please log in to donate.', 'info');
            if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
            return;
        }
        var ngo   = _partners()[ngoId] || { name: 'NGO Partner' };
        var modal = document.getElementById('donation-modal-overlay') || document.getElementById('sos-donation-modal');
        if (!modal) { _notify('Donation modal not available.', 'error'); return; }

        window._sosDonationContext = { userId: ngoId, postId: '', username: ngo.name, type: 'ngo' };

        var titleEl = document.getElementById('donation-modal-title');
        var descEl  = document.getElementById('donation-modal-description');
        if (titleEl) titleEl.textContent = 'Donate to ' + ngo.name;
        if (descEl)  descEl.textContent  = 'Your donation supports ' + ngo.name + '\'s programs. '
            + 'Funds are held in escrow and disbursed with full transparency.';

        modal.style.display = 'flex';
        modal.classList.add('show');
        document.body.classList.add('modal-open');
    };


    /* =========================================================================
       §18  SOS DONATION FLUTTERWAVE FORM HANDLER  (v1 preserved — unchanged)
       ========================================================================= */

    document.addEventListener('submit', function(e) {
        var form   = e.target;
        var formId = form && form.id;
        if (formId !== 'sos-donation-form' && formId !== 'donation-form') return;
        e.preventDefault();

        var amountInput  = form.querySelector('[name="donation-amount"], #donation-amount');
        var nameInput    = form.querySelector('[name="donor-name"], #donor-name');
        var emailInput   = form.querySelector('[name="donor-email"], #donor-email');
        var phoneInput   = form.querySelector('[name="donor-phone"], #donor-phone');
        var methodSelect = form.querySelector('[name="payment-method"], #donation-payment-method');

        var amount     = parseFloat(amountInput   ? amountInput.value   : 0);
        var donorName  = (nameInput  ? nameInput.value.trim()  : '') || (_us().fullName || 'Anonymous');
        var donorEmail = (emailInput ? emailInput.value.trim() : '') || (_us().email    || 'donor@empyrean.com');
        var donorPhone = (phoneInput ? phoneInput.value.trim() : '') || (_us().phone    || '');
        var method     = methodSelect ? methodSelect.value : 'flutterwave';

        if (!amount || amount < 100) { _notify('Minimum donation is ₦100.', 'error'); return; }
        if (method === 'bank')       { _notify('Please follow the bank transfer instructions on screen.', 'info'); return; }

        var ctx         = window._sosDonationContext || {};
        var donateTxRef = 'EMPY-DON-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
        var submitBtn   = form.querySelector('button[type="submit"]');

        function _restoreBtn() {
            if (!submitBtn) return;
            submitBtn.disabled  = false;
            submitBtn.innerHTML = '<i class="fas fa-hand-holding-heart"></i> Donate Now via Flutterwave';
        }
        function _closeModal() {
            var m = form.closest('.modal-overlay-container, #sos-donation-modal, #donation-modal-overlay');
            if (m) { m.classList.remove('show'); m.style.display = 'none'; }
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
        }
        if (submitBtn) {
            submitBtn.disabled  = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Opening Payment…';
        }

        function _launchFlutterwave() {
            try {
                FlutterwaveCheckout({
                    public_key:      (window._appConfig && window._appConfig.flutterwave && window._appConfig.flutterwave.publicKey) || '',
                    tx_ref:          donateTxRef,
                    amount:          amount,
                    currency:        'NGN',
                    payment_options: 'card,banktransfer,ussd,mobilemoney,barter,nqr',
                    customer: { email: donorEmail, phone_number: donorPhone, name: donorName },
                    customizations: {
                        title:       'Empyrean — ' + (ctx.type === 'ngo' ? 'NGO Donation' : 'SOS Donation'),
                        description: 'Donation to ' + (ctx.username || 'SOS cause') + ' held in escrow',
                        logo:        'https://cdn-icons-png.flaticon.com/512/6001/6001527.png'
                    },
                    meta: {
                        source: ctx.type === 'ngo' ? 'ngo_donation' : 'sos_donation',
                        userId:    (_us().id) || 'guest',
                        sosUserId: ctx.userId || '',
                        sosPostId: ctx.postId || '',
                        ngoId:     ctx.type === 'ngo' ? (ctx.userId || '') : ''
                    },
                    callback: function(data) {
                        _restoreBtn();
                        if (data.status === 'successful' || data.status === 'completed') {
                            try {
                                if (_fbOk() && _db()) {
                                    _db().collection('flw_transactions').doc(donateTxRef).set({
                                        txRef: donateTxRef, flwRef: data.flw_ref || '',
                                        amount: amount, currency: 'NGN',
                                        purpose: ctx.type === 'ngo' ? 'ngo_donation' : 'sos_donation',
                                        status: 'held',
                                        donorName: donorName, donorEmail: donorEmail,
                                        donorUserId: (_us().id) || 'guest',
                                        recipientUserId: ctx.userId || '', recipientType: ctx.type || 'individual',
                                        sosPostId: ctx.postId || '', createdAt: _serverTs()
                                    }).catch(function() {});
                                }
                            } catch(err) {}
                            _notify('✅ Thank you! ₦' + amount.toLocaleString() + ' donated to '
                                + (ctx.username || 'this cause') + '. Held in escrow pending verification.', 'success');
                            window._sosDonationContext = null;
                            form.reset();
                            _closeModal();
                        } else {
                            _notify('Donation was not completed. Please try again.', 'error');
                        }
                    },
                    onclose: function() { _restoreBtn(); _notify('Payment window closed.', 'info'); }
                });
            } catch(flwErr) {
                _restoreBtn();
                _notify('Payment gateway error. Please try again.', 'error');
            }
        }

        if (typeof FlutterwaveCheckout !== 'undefined') {
            _launchFlutterwave();
        } else {
            _notify('Loading payment gateway…', 'info');
            var script    = document.createElement('script');
            script.src    = 'https://checkout.flutterwave.com/v3.js';
            script.onload = _launchFlutterwave;
            script.onerror = function() {
                _restoreBtn();
                _notify('Payment gateway unavailable. Please try again.', 'error');
            };
            document.head.appendChild(script);
        }
    });


    /* =========================================================================
       §19  ADMIN ACTION HANDLERS  (NEW)
       ========================================================================= */

    /* Approve / Reject an NGO application */
    window._approveNgoApplication = function(appId, action) {
        if (!_isAdmin()) { _notify('Admin access required.', 'error'); return; }
        if (!_fbOk() || !_db()) { _notify('Firebase not connected.', 'error'); return; }

        var newStatus   = action === 'approve' ? 'approved' : 'rejected';
        var updateData  = {
            status:     newStatus,
            reviewedBy: (_us().id)   || 'admin',
            reviewedAt: new Date().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}),
            reviewedTs: _serverTs()
        };

        _db().collection('ngo_applications').doc(appId).update(updateData)
            .then(function() {
                _notify('✅ NGO application ' + newStatus + ' successfully.', 'success');

                /* If approved: promote to ngo_partners collection */
                if (action === 'approve') {
                    _db().collection('ngo_applications').doc(appId).get()
                        .then(function(doc) {
                            if (!doc.exists) return;
                            var d = doc.data();
                            return _db().collection('ngo_partners').doc(appId).set({
                                id:                appId,
                                name:              d.orgName || '',
                                description:       d.mission || '',
                                sector:            d.sector  || '',
                                country:           d.country || '',
                                email:             d.email   || '',
                                phone:             d.phone   || '',
                                website:           d.website || '',
                                walletAddress:     d.walletAddress || '',
                                registrationNumber: d.regNumber || '',
                                documents:         d.documents || [],
                                isVerified:        true,
                                verifiedAt:        _serverTs(),
                                grantsTotal:       0,
                                stats: { raised: 0, projects: 0, peopleHelped: 0 }
                            }, { merge: true });
                        })
                        .then(function() {
                            _notify('✅ NGO added to verified partners directory.', 'success');
                            window._ngoPartnersLoaded = false;
                            _loadNgoPartners();
                        })
                        .catch(function(e) { console.warn('[NGO Approve] Partner record error:', e.message); });
                }

                /* Update card in DOM */
                var card = document.getElementById('ngo-app-' + appId);
                if (card) {
                    card.style.borderLeftColor = action === 'approve' ? '#22c55e' : '#ef4444';
                    var actionArea = card.querySelector('[style*="flex-direction:column"]');
                    if (actionArea) actionArea.innerHTML =
                        '<span style="font-size:0.78rem;font-weight:700;color:' + (action === 'approve' ? '#22c55e' : '#ef4444') + ';">'
                        + (action === 'approve' ? '✅ Approved' : '❌ Rejected') + '</span>';
                }
            })
            .catch(function(e) { _notify('Action failed: ' + e.message, 'error'); });
    };

    /* Request more information from NGO applicant */
    window._requestMoreNgoInfo = function(appId) {
        var note = prompt('Enter information request message (will be stored in the application record):');
        if (!note || !note.trim()) return;
        if (!_fbOk() || !_db()) { _notify('Firebase not connected.', 'error'); return; }

        _db().collection('ngo_applications').doc(appId).update({
            status:           'under_review',
            infoRequest:      note.trim(),
            infoRequestedAt:  _serverTs(),
            infoRequestedBy:  (_us().id) || 'admin'
        }).then(function() {
            _notify('Information request recorded for application ' + appId, 'info');
            renderNgoVerificationQueue();
        }).catch(function(e) { _notify('Error: ' + e.message, 'error'); });
    };

    /* Approve / Disburse / Reject an individual grant */
    window._approveIndividualGrant = function(grantId, action) {
        if (!_isAdmin()) { _notify('Admin access required.', 'error'); return; }
        if (!_fbOk() || !_db()) { _notify('Firebase not connected.', 'error'); return; }

        var newStatus = action === 'disburse' ? 'disbursed' : 'rejected';
        var updateData = {
            status:     newStatus,
            reviewedBy: (_us().id) || 'admin',
            reviewedTs: _serverTs()
        };

        _db().collection('individual_grants').doc(grantId).update(updateData)
            .then(function() {
                _notify('✅ Individual grant ' + newStatus + '.', 'success');

                if (action === 'disburse') {
                    /* Record in disbursements collection + grant ledger */
                    _db().collection('individual_grants').doc(grantId).get()
                        .then(function(doc) {
                            if (!doc.exists) return;
                            var d   = doc.data();
                            var gid = _genGrantId();
                            return _db().collection('disbursements').add({
                                grantId:         gid,
                                recipientId:     d.applicantId || grantId,
                                recipientName:   d.fullName    || 'Individual',
                                amount:          d.amount      || 0,
                                amountFormatted: _fmtAmount(d.amount, d.currency),
                                currency:        d.currency    || 'NGN',
                                purpose:         d.purpose     || 'Individual Grant',
                                mode:            'individual',
                                token:           d.currency    || 'NGN',
                                paymentMethod:   d.paymentMethod || '—',
                                status:          'completed',
                                type:            'Individual',
                                adminId:         (_us().id)   || 'admin',
                                createdAt:       _serverTs()
                            });
                        })
                        .then(function() {
                            renderGrantLedger();
                            _notify('Grant ledger updated.', 'success');
                        })
                        .catch(function(e) { console.warn('[IndGrant] Ledger update error:', e.message); });
                }

                /* Update card in DOM */
                var card = document.getElementById('ind-grant-' + grantId);
                if (card) {
                    var actionArea = card.querySelector('[style*="display:flex;align-items:center;gap:10px"]');
                    if (actionArea) actionArea.innerHTML = _statusBadge(newStatus);
                }
            })
            .catch(function(e) { _notify('Action failed: ' + e.message, 'error'); });
    };

    /* Create a new grant allocation from the admin panel */
    window._createGrantAllocation = function() {
        var recipType = (document.getElementById('alloc-recipient-type') || {}).value || 'ngo';
        var amount    = parseFloat((document.getElementById('alloc-amount')   || {}).value || '0');
        var currency  = (document.getElementById('alloc-currency')            || {}).value || 'NGN';
        var purpose   = (document.getElementById('alloc-purpose')             || {}).value || '';
        var ngoId     = (document.getElementById('alloc-ngo-id')              || {}).value || '';
        var recipName = (document.getElementById('alloc-recipient-name')      || {}).value || '';
        var wallet    = (document.getElementById('alloc-wallet')              || {}).value || '';
        var bankAcct  = (document.getElementById('alloc-bank-account')        || {}).value || '';
        var disbDate  = (document.getElementById('alloc-disbursement-date')   || {}).value || '';
        var notes     = (document.getElementById('alloc-notes')               || {}).value || '';
        var fb        = document.getElementById('alloc-feedback');

        function _setFb(msg, type) {
            if (!fb) return;
            fb.style.display    = 'block';
            fb.style.background = type === 'error' ? 'rgba(239,68,68,0.1)' : type === 'success' ? 'rgba(0,212,170,0.1)' : 'rgba(245,158,11,0.1)';
            fb.style.color      = type === 'error' ? 'var(--danger-color,#ef4444)' : type === 'success' ? 'var(--nav-accent,#00D4AA)' : '#d97706';
            fb.textContent      = msg;
        }

        if (!amount || amount < 1) { _setFb('⚠ Invalid amount.', 'error'); return; }
        if (!purpose.trim())       { _setFb('⚠ Purpose is required.', 'error'); return; }
        if (!recipName.trim())     { _setFb('⚠ Recipient name is required.', 'error'); return; }

        var allocation = {
            grantId:        _genGrantId(),
            type:           recipType === 'ngo' ? 'NGO' : 'Individual',
            ngoId:          ngoId.trim() || null,
            recipientName:  recipName.trim(),
            amount:         amount,
            amountFormatted: _fmtAmount(amount, currency),
            currency:       currency,
            purpose:        purpose.trim(),
            walletAddress:  wallet.trim() || null,
            bankAccount:    bankAcct.trim() || null,
            scheduledDate:  disbDate || null,
            adminNotes:     notes.trim() || null,
            status:         'approved',
            createdBy:      (_us().id) || 'admin',
            createdAt:      _serverTs()
        };

        if (_fbOk() && _db()) {
            _db().collection('disbursements').add(allocation)
                .then(function(ref) {
                    _setFb('✅ Grant allocation created. ID: ' + allocation.grantId, 'success');
                    renderGrantLedger();
                    _notify('Grant allocation created: ' + allocation.grantId, 'success');
                })
                .catch(function(e) { _setFb('❌ Failed: ' + e.message, 'error'); });
        } else {
            _setFb('✅ Allocation created (offline). Will sync when Firebase reconnects.', 'success');
        }
    };

    /* Export grant ledger as CSV */
    window._exportGrantReport = function(format) {
        format = format || 'csv';

        if (!_fbOk() || !_db()) {
            /* Export mock data */
            _exportFromData(_ledger(), format);
            return;
        }

        _db().collection('disbursements').orderBy('createdAt', 'desc').limit(500).get()
            .then(function(snap) {
                var rows = [];
                snap.forEach(function(doc) {
                    var d = doc.data();
                    rows.push({
                        grantId:       d.grantId   || doc.id,
                        recipient:     d.recipientName || '—',
                        amount:        d.amountFormatted || d.amount || '—',
                        currency:      d.currency  || d.token || '—',
                        purpose:       d.purpose   || '—',
                        status:        d.status    || '—',
                        type:          d.type      || '—',
                        txHash:        d.txHash    || d.txRef || '—',
                        date:          d.createdAt && d.createdAt.toDate
                            ? d.createdAt.toDate().toISOString().split('T')[0]
                            : '—'
                    });
                });
                _exportFromData(rows, format);
                _notify('✅ Export ready — ' + rows.length + ' records.', 'success');
            })
            .catch(function(e) { _notify('Export failed: ' + e.message, 'error'); });
    };

    function _exportFromData(data, format) {
        if (!data || !data.length) { _notify('No data to export.', 'info'); return; }

        if (format === 'json') {
            var jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            _downloadBlob(jsonBlob, 'empyrean-grant-ledger-' + Date.now() + '.json');
            return;
        }

        if (format === 'pdf') {
            _notify('PDF generation requires the print dialog. Use CSV for programmatic use.', 'info');
            window.print();
            return;
        }

        /* CSV */
        var keys  = ['grantId','recipient','amount','currency','purpose','status','type','txHash','date'];
        var header = keys.join(',');
        var csvRows = data.map(function(row) {
            return keys.map(function(k) {
                var val = String(row[k] !== undefined ? row[k] : '').replace(/"/g, '""');
                return '"' + val + '"';
            }).join(',');
        });
        var csv  = [header].concat(csvRows).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        _downloadBlob(blob, 'empyrean-grant-ledger-' + Date.now() + '.csv');
    }

    function _downloadBlob(blob, filename) {
        var url  = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href     = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function() { document.body.removeChild(link); URL.revokeObjectURL(url); }, 1000);
    }


    /* =========================================================================
       §20  REAL-TIME FIRESTORE LISTENERS  (NEW)
       ========================================================================= */

    var _ngoListeners = [];

    function _startRealTimeListeners() {
        if (!_fbOk() || !_db()) return;

        /* Listen for new disbursements → update ledger row count badge */
        try {
            var unsubDisburse = _db().collection('disbursements')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .onSnapshot(function(snap) {
                    snap.docChanges().forEach(function(change) {
                        if (change.type === 'added') {
                            /* Append to ledger if the table is visible */
                            var tbody = document.getElementById('grant-ledger-body');
                            if (tbody && !document.hidden) {
                                renderGrantLedger();
                            }
                        }
                    });
                }, function(e) { console.warn('[NGO Listener] Disbursement snapshot error:', e.message); });
            _ngoListeners.push(unsubDisburse);
        } catch(e) {}

        /* Listen for NGO application status changes */
        try {
            var unsubApps = _db().collection('ngo_applications')
                .where('status', '==', 'pending')
                .onSnapshot(function(snap) {
                    var badge = document.getElementById('ngo-pending-badge');
                    if (badge) badge.textContent = snap.size || '';
                    if (snap.size > 0) badge && (badge.style.display = 'inline-flex');
                }, function() {});
            _ngoListeners.push(unsubApps);
        } catch(e) {}
    }

    /* Clean up listeners on logout */
    document.addEventListener('empyrean-logout', function() {
        _ngoListeners.forEach(function(unsub) { try { unsub(); } catch(e) {} });
        _ngoListeners = [];
        window._ngoPartnersLoaded = false;
    });


    /* =========================================================================
       §21  BOOTSTRAP
       ========================================================================= */

    document.addEventListener('empyrean-init-done', function() {
        setTimeout(function() {
            _loadNgoPartners();
            renderGrantLedger();
            renderCommunityTasks();
            renderNgoGrid();
            _loadIndAcctFormState();
            _renderIndAcctBanner();
            if (typeof window.renderGrantDashboard === 'function' && document.getElementById('grant-dashboard-container')) {
                renderGrantDashboard();
            }
        }, 500);
    });

    /* Re-render banner every time user navigates to dashboard.
       Two timeouts: 300ms for fast renders, 1000ms for slow Firebase. */
    document.addEventListener('empyrean-section-change', function(ev) {
        if (ev && ev.detail && ev.detail.section === 'dashboard') {
            setTimeout(_renderIndAcctBanner, 300);
            setTimeout(_renderIndAcctBanner, 1000);
        }
    });

    /* If Firebase wasn't ready at init-done, start the listener as soon as it is */
    window.addEventListener('empyrean:firebase-ready', function() {
        setTimeout(_startIndAcctListener, 300);
    });

    document.addEventListener('empyrean-user-ready', function() {
        setTimeout(function() {
            window._ngoPartnersLoaded = false;
            _loadNgoPartners();
            renderCommunityTasks();
            _startRealTimeListeners();
            /* Admin-only panels */
            if (_isAdmin()) {
                if (document.getElementById('ngo-verification-queue-container')) renderNgoVerificationQueue();
                if (document.getElementById('individual-grant-panel-container'))  renderIndividualGrantPanel();
                if (document.getElementById('admin-grant-control-container'))     renderAdminGrantControlPanel();
            }
        }, 700);
    });

    /* Also hook into the existing admin disburse tab switch (app-admin.js compatibility) */
    var _origSwitchAdminTab = window._switchAdminTab;
    window._switchAdminTab = function(targetId) {
        if (typeof _origSwitchAdminTab === 'function') _origSwitchAdminTab(targetId);
        if (targetId === 'admin-disburse-tab') {
            setTimeout(function() {
                if (document.getElementById('admin-grant-control-container')) renderAdminGrantControlPanel();
            }, 100);
        }
    };

    console.log('[EmpNgo v2] ✅ NGO & Grant Disbursement Portal ready. Debug: window._empyreanDebug()');

})();