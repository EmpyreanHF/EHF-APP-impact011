/* =============================================================================
   EMPYREAN INTERNATIONAL — USER PROFILE SYSTEM
   app-profile.js  |  Step 0.9  |  Refactor Roadmap v1.0
   =============================================================================

   PURPOSE
   ───────
   Complete profile system extracted from app-fixes.js.  Covers:

     • renderUserProfile(userId)   — full profile page builder
     • renderMonetizationTab()     — earnings / withdrawal eligibility
     • renderBusinessPage()        — business page (create + view)
     • populateProfileGallery()    — 3-col gallery from DOM feed posts
     • _populateHomeBioCard()      — home card trigger (delegates to renderSuggestedUsers)
     • showFollowersModal(tab)     — followers / following modal
     • showFollowingModal()        — alias
     • Story-header click → navigate to user profile (delegated)
     • Profile tab switching
     • Profile post submit (inside dashboard tab)

   LOAD ORDER
   ──────────
   Must come AFTER: firebase-init, app-state, app-helpers, app-contracts,
   app-notifications, app-tags, app-dom (when extracted), app-auth, app-feed.

   DEPENDS ON
   ──────────
   • window.EmpState / window.userState / window.isGuest / window.isAdmin
   • window.mockUsers / window.registeredUsers
   • window.fbDb / window._firebaseLoaded
   • window.formatUsdPrice          (app-helpers.js)
   • window.showNotification        (app-helpers.js)
   • window.uploadMediaFilesToCloudinary (app-helpers.js)
   • window.createNewPostElement    (app-feed.js)
   • window.navigateTo              (app-dom.js)
   • window.showMarketplaceGallery  (app-marketplace.js — optional)
   • window.populateDobSelectors    (app-helpers.js)

   PUBLIC API
   ──────────
   window.renderUserProfile(userId)
   window.renderMonetizationTab()
   window.renderBusinessPage()
   window.populateProfileGallery(userId)
   window._populateHomeBioCard()
   window.showFollowersModal(tab?)
   window.showFollowingModal()

   SECTION MAP
   ───────────
   §1  renderUserProfile — full profile page builder
   §2  renderMonetizationTab
   §3  renderBusinessPage
   §4  populateProfileGallery
   §5  _populateHomeBioCard
   §6  showFollowersModal / showFollowingModal
   §7  Profile tab switching (MutationObserver delegated)
   §8  Story-header click → user profile navigation

   ============================================================================= */

(function empyreanProfileModule() {
    'use strict';

    if (window._empyreanProfileLoaded) {
        console.warn('[EmpProfile] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanProfileLoaded = true;

    /* Shorthand helpers */
    function _S()       { return window.EmpState || {}; }
    function _us()      { return _S().userState || window.userState || {}; }
    function _mu()      { return (_S().mockUsers) || window.mockUsers || {}; }
    function _isGuest() { var s = _S(); return s.isGuest != null ? s.isGuest : window.isGuest; }
    function _isAdmin() { var s = _S(); return s.isAdmin != null ? s.isAdmin : window.isAdmin; }

    /* Ranking tiers referenced by renderMonetizationTab */
    var RANKS = [
        { name: 'Bronze',   followers: 100,    reward: 50    },
        { name: 'Silver',   followers: 500,    reward: 250   },
        { name: 'Gold',     followers: 1000,   reward: 750   },
        { name: 'Platinum', followers: 5000,   reward: 2500  },
        { name: 'Diamond',  followers: 10000,  reward: 10000 },
        { name: 'Elite',    followers: 50000,  reward: 50000 }
    ];

    function _attr(s) { return String(s || '').replace(/"/g, '&quot;'); }
    function _esc(s)  {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* =========================================================================
       §1  renderUserProfile
       Builds the entire #profile section HTML for the given user ID.
       ========================================================================= */

    function renderUserProfile(userId) {
        var mu   = _mu();
        var user = mu[userId];
        if (!user) {
            console.error('[Profile] User not found:', userId);
            return;
        }
        var us   = _us();
        var profileSection = document.getElementById('profile');
        if (!profileSection) return;

        var isMyProfile = !_isGuest() && user.id === us.id;

        /* ── KYC form HTML (rendered only on own profile) ── */
        function _kycField(label, id, type, required) {
            return '<div class="form-group"><label for="' + _attr(id) + '">' + label + '</label>'
                + '<input type="' + (type || 'text') + '" id="' + _attr(id) + '"'
                + (required ? ' required' : '') + '></div>';
        }
        function _kycUpload(label, inputId, iconClass) {
            return '<div class="form-group"><label>' + label + '</label>'
                + '<div class="upload-area kyc-file-upload" data-input-id="' + _attr(inputId) + '">'
                + '<i class="fas ' + iconClass + '"></i><span>Click to upload</span></div>'
                + '<input type="file" id="' + _attr(inputId) + '" accept="image/*,.pdf" style="display:none;" required>'
                + '<span class="file-upload-preview" id="' + _attr(inputId) + '-preview"></span></div>';
        }
        function _kycSelfie(btnId) {
            return '<div class="form-group"><label>Selfie Verification</label>'
                + '<button type="button" class="btn btn-small live-capture-btn" id="' + _attr(btnId) + '" data-captured="false">'
                + '<i class="fas fa-camera"></i> Capture Live Selfie</button>'
                + '<span class="file-upload-preview" id="' + _attr(btnId) + '-preview"></span></div>';
        }

        var kycFormHTML =
            '<div class="card"><div class="card-content">'
            + '<h3><i class="fas fa-shield-alt"></i> Account Verification (KYC)</h3>'
            + '<p>Complete verification to access all platform features, including withdrawals.</p>'
            + '<hr style="border:1px solid #eee;margin:20px 0;">'
            + '<div id="kyc-entity-selector-container"><h4>Step 1: Select Entity Type</h4>'
            + '<div id="kyc-entity-selector" style="margin-top:20px;">'
            + '<div class="kyc-entity-btn" data-form="individual-kyc-form"><i class="fas fa-user"></i><span>Individual</span></div>'
            + '<div class="kyc-entity-btn" data-form="ngo-kyc-form"><i class="fas fa-sitemap"></i><span>NGO</span></div>'
            + '<div class="kyc-entity-btn" data-form="company-kyc-form"><i class="fas fa-building"></i><span>Company</span></div>'
            + '<div class="kyc-entity-btn" data-form="cooperative-kyc-form"><i class="fas fa-users"></i><span>Cooperative</span></div>'
            + '</div></div>'
            + '<div id="kyc-forms-container" style="margin-top:30px;">'
            /* Individual */
            + '<form id="individual-kyc-form" class="kyc-form" novalidate>'
            + '<h4>Step 2: Individual Verification</h4>'
            + '<div class="grid-2">'
            + _kycField('First Name', 'kyc-ind-fname', 'text', true)
            + _kycField('Last Name', 'kyc-ind-lname', 'text', true) + '</div>'
            + '<div class="form-group"><label>Date of Birth</label><div class="date-select-group">'
            + '<select required><option value="">Day</option></select>'
            + '<select required><option value="">Month</option></select>'
            + '<select required><option value="">Year</option></select></div></div>'
            + '<div class="form-group"><label for="kyc-ind-gender">Gender</label>'
            + '<select id="kyc-ind-gender" required><option value="">--Select--</option><option>Male</option><option>Female</option></select></div>'
            + _kycField('Phone', 'kyc-ind-phone', 'tel', true)
            + _kycField('Email', 'kyc-ind-email', 'email', true)
            + _kycField('Residential Address', 'kyc-ind-address', 'text', true)
            + '<div class="form-group"><label for="kyc-ind-id-type">ID Type</label>'
            + '<select id="kyc-ind-id-type" required><option value="">--Select--</option>'
            + '<option>Passport</option><option>National ID</option><option>Driver\'s License</option><option>Voter\'s Card</option></select></div>'
            + _kycField('ID Number', 'kyc-ind-id-number', 'text', true)
            + _kycUpload('Upload ID (Front & Back)', 'kyc-ind-id-upload', 'fa-id-card')
            + _kycSelfie('kyc-ind-selfie-btn')
            + '<button type="submit" class="btn btn-accent">Submit Verification</button>'
            + '</form>'
            /* Company */
            + '<form id="company-kyc-form" class="kyc-form" novalidate>'
            + '<h4>Step 2: Company Verification</h4>'
            + _kycField('Organisation Name', 'kyc-com-name', 'text', true)
            + _kycField('CAC Registration Number', 'kyc-com-cac', 'text', true)
            + _kycField('SCUML Certificate Number', 'kyc-com-scuml', 'text', true)
            + _kycField('CEO/Representative Name', 'kyc-com-rep-name', 'text', true)
            + _kycField('Official Phone', 'kyc-com-phone', 'tel', true)
            + _kycField('Official Email', 'kyc-com-email', 'email', true)
            + _kycField('Office Address', 'kyc-com-address', 'text', true)
            + _kycUpload('Upload CAC Certificate', 'kyc-com-cac-upload', 'fa-file-alt')
            + _kycUpload('Upload SCUML Certificate', 'kyc-com-scuml-upload', 'fa-file-alt')
            + _kycUpload("Representative's ID", 'kyc-com-rep-id-upload', 'fa-id-card')
            + _kycSelfie('kyc-com-selfie-btn')
            + '<button type="submit" class="btn btn-accent">Submit Verification</button>'
            + '</form>'
            /* NGO */
            + '<form id="ngo-kyc-form" class="kyc-form" novalidate>'
            + '<h4>Step 2: NGO Verification</h4>'
            + _kycField('Organisation Name', 'kyc-ngo-name', 'text', true)
            + _kycField('CAC Registration Number', 'kyc-ngo-cac', 'text', true)
            + _kycField('SCUML Certificate Number', 'kyc-ngo-scuml', 'text', true)
            + _kycField('President/Representative Name', 'kyc-ngo-rep-name', 'text', true)
            + _kycField('Official Phone', 'kyc-ngo-phone', 'tel', true)
            + _kycField('Official Email', 'kyc-ngo-email', 'email', true)
            + _kycField('Office Address', 'kyc-ngo-address', 'text', true)
            + _kycUpload('Upload CAC Certificate', 'kyc-ngo-cac-upload', 'fa-file-alt')
            + _kycUpload('Upload SCUML Certificate', 'kyc-ngo-scuml-upload', 'fa-file-alt')
            + _kycUpload("Representative's ID", 'kyc-ngo-rep-id-upload', 'fa-id-card')
            + _kycSelfie('kyc-ngo-selfie-btn')
            + '<button type="submit" class="btn btn-accent">Submit Verification</button>'
            + '</form>'
            /* Cooperative */
            + '<form id="cooperative-kyc-form" class="kyc-form" novalidate>'
            + '<h4>Step 2: Cooperative Society Verification</h4>'
            + _kycField('Organisation Name', 'kyc-coop-name', 'text', true)
            + _kycField('Certificate Number', 'kyc-coop-cert', 'text', true)
            + _kycField('TIN Number', 'kyc-coop-tin', 'text', true)
            + _kycField('President/Representative Name', 'kyc-coop-rep-name', 'text', true)
            + _kycField('Official Phone', 'kyc-coop-phone', 'tel', true)
            + _kycField('Official Email', 'kyc-coop-email', 'email', true)
            + _kycField('Office Address', 'kyc-coop-address', 'text', true)
            + _kycUpload('Upload Registration Certificate', 'kyc-coop-cert-upload', 'fa-file-alt')
            + _kycUpload('Upload TIN Document', 'kyc-coop-tin-upload', 'fa-file-alt')
            + _kycUpload("Representative's ID", 'kyc-coop-rep-id-upload', 'fa-id-card')
            + _kycSelfie('kyc-coop-selfie-btn')
            + '<button type="submit" class="btn btn-accent">Submit Verification</button>'
            + '</form>'
            + '</div></div></div>';

        /* ── Bio chips row ── */
        function _buildBioChips() {
            var rows = [
                { icon: 'fa-align-left',      label: 'Bio',            val: user.bio },
                { icon: 'fa-briefcase',        label: 'Profession',     val: user.profession },
                { icon: 'fa-graduation-cap',   label: 'Education',      val: user.education },
                { icon: 'fa-heart',            label: 'Marital Status', val: user.maritalStatus },
                { icon: 'fa-gamepad',          label: 'Hobbies',        val: user.hobbies },
                { icon: 'fa-map-marker-alt',   label: 'Location',       val: user.location },
                { icon: 'fa-globe',            label: 'Website',        val: user.website },
                { icon: 'fa-envelope',         label: 'Email',          val: isMyProfile ? user.email : null },
                { icon: 'fa-phone',            label: 'Phone',          val: isMyProfile ? user.phone : null }
            ].filter(function (r) { return r.val && String(r.val).trim(); });

            if (!rows.length) return '';

            var chips = rows.map(function (r) {
                var v = String(r.val).trim();
                var lo = '', lc = '';
                if (r.label === 'Website') {
                    lo = '<a href="' + (v.startsWith('http') ? v : 'https://' + v) + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">';
                    lc = '</a>';
                } else if (r.label === 'Email') {
                    lo = '<a href="mailto:' + _attr(v) + '" style="text-decoration:none;color:inherit;">'; lc = '</a>';
                } else if (r.label === 'Phone') {
                    lo = '<a href="tel:' + _attr(v) + '" style="text-decoration:none;color:inherit;">'; lc = '</a>';
                }
                return lo
                    + '<div style="flex-shrink:0;background:#fff;border:1.5px solid rgba(10,14,39,0.09);border-radius:50px;'
                    + 'padding:7px 14px;display:flex;align-items:center;gap:7px;box-shadow:0 1px 4px rgba(10,14,39,0.06);">'
                    + '<div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#0A0E27,#1B2B8B);'
                    + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
                    + '<i class="fas ' + r.icon + '" style="color:#F5C518;font-size:0.5rem;"></i></div>'
                    + '<div style="min-width:0;">'
                    + '<div style="font-size:0.58rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;">' + r.label + '</div>'
                    + '<div style="font-size:0.78rem;color:var(--text-primary);font-weight:600;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;">' + _esc(v) + '</div>'
                    + '</div></div>' + lc;
            }).join('');

            var editBtn = isMyProfile
                ? '<a href="#" class="nav-link" data-target="settings" style="flex-shrink:0;font-size:0.65rem;color:var(--secondary);font-weight:700;text-decoration:none;display:flex;align-items:center;gap:3px;padding:0 6px;"><i class="fas fa-pencil-alt"></i> Edit</a>'
                : '';

            return '<div id="profile-biodata-card" style="margin:12px 0 0;overflow:hidden;">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px 6px;">'
                + '<span style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;">'
                + '<i class="fas fa-id-card" style="color:var(--secondary);margin-right:4px;"></i>About '
                + (isMyProfile ? 'Me' : _esc(user.fullName.split(' ')[0])) + '</span>' + editBtn + '</div>'
                + '<div style="display:flex;gap:8px;padding:0 16px 14px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;scroll-snap-type:x mandatory;">'
                + chips + '</div></div>';
        }

        /* ── About tab rows ── */
        function _buildAboutRows() {
            var rows = [
                { icon: 'fa-briefcase',       label: 'Profession',     val: user.profession },
                { icon: 'fa-graduation-cap',  label: 'Education',      val: user.education },
                { icon: 'fa-heart',           label: 'Marital Status', val: user.maritalStatus },
                { icon: 'fa-gamepad',         label: 'Hobbies',        val: user.hobbies },
                { icon: 'fa-map-marker-alt',  label: 'Location',       val: user.location },
                { icon: 'fa-envelope',        label: 'Email',          val: isMyProfile ? user.email : null },
                { icon: 'fa-phone',           label: 'Phone',          val: isMyProfile ? user.phone : null },
                { icon: 'fa-globe',           label: 'Website',        val: user.website }
            ].filter(function (r) { return r.val && String(r.val).trim(); });

            return rows.map(function (r, idx) {
                var v   = String(r.val).trim();
                var isLast = idx === rows.length - 1;
                var valHTML = r.label === 'Website'
                    ? '<a href="' + (v.startsWith('http') ? v : 'https://' + v) + '" target="_blank" rel="noopener" style="color:var(--secondary);text-decoration:none;">' + _esc(v) + '</a>'
                    : r.label === 'Email'
                    ? '<a href="mailto:' + _attr(v) + '" style="color:var(--secondary);text-decoration:none;">' + _esc(v) + '</a>'
                    : r.label === 'Phone'
                    ? '<a href="tel:' + _attr(v) + '" style="color:var(--secondary);text-decoration:none;">' + _esc(v) + '</a>'
                    : _esc(v);
                return '<div style="display:flex;align-items:center;gap:14px;padding:13px 16px;background:white;' + (!isLast ? 'border-bottom:1px solid rgba(10,14,39,0.06);' : '') + '">'
                    + '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0A0E27,#1B2B8B);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
                    + '<i class="fas ' + r.icon + '" style="color:white;font-size:0.8rem;"></i></div>'
                    + '<div style="flex:1;min-width:0;">'
                    + '<div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">' + r.label + '</div>'
                    + '<div style="font-size:0.92rem;color:var(--text-primary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + valHTML + '</div>'
                    + '</div></div>';
            }).join('');
        }

        var flwCount  = (user.followerCount  || 0).toLocaleString();
        var flwing    = (user.followingCount || 0).toLocaleString();
        var isVerified = user.isVerified;

        /* ── Build profile HTML ── */
        profileSection.innerHTML =
            '<div class="header">'
            + (!isMyProfile
                ? '<button onclick="window._viewingOtherProfile=false;if(typeof window.renderUserProfile===\'function\'){window.renderUserProfile(window.userState.id);}else{if(typeof window.navigateTo===\'function\')window.navigateTo(\'profile\',true);}" '
                + 'style="background:none;border:none;cursor:pointer;color:var(--secondary);font-size:0.88rem;font-weight:600;padding:4px 0;display:flex;align-items:center;gap:5px;margin-bottom:6px;">'
                + '<i class="fas fa-arrow-left"></i> My Profile</button>'
                : '')
            + '<h1>' + (isMyProfile ? 'My Profile' : _esc(user.fullName) + "'s Profile") + '</h1>'
            + '</div>'

            + '<div class="card">'
            + '<div class="profile-header-container">'
            + '<div class="cover-photo-container" id="profile-cover-container" style="background-image:url(\'' + _attr(user.coverPhoto || '') + '\');">'
            + (isMyProfile
                ? '<label for="cover-photo-input" class="upload-overlay"><i class="fas fa-camera"></i> Change Cover</label>'
                + '<input type="file" id="cover-photo-input" accept="image/*" style="display:none;">'
                : '')
            + '</div>'
            + '<div class="profile-header">'
            + '<div class="profile-pic-container">'
            + '<label for="profile-pic-input-main" class="avatar-placeholder"'
            + ' style="width:150px;height:150px;border-radius:50%;' + (!isMyProfile ? 'cursor:default;' : '') + '">'
            + (isMyProfile ? '<div class="upload-overlay"><i class="fas fa-camera fa-2x"></i></div>' : '')
            + '<img src="' + _attr(user.avatar || '') + '" id="profile-pic-img" class="profile-pic active" alt="Profile picture"></label>'
            + (isMyProfile ? '<input type="file" id="profile-pic-input-main" class="avatar-input" accept="image/*" style="display:none;">' : '')
            + '</div>'
            + '<div class="profile-header-info" data-user-id="' + _attr(user.id) + '">'
            + '<h2 id="profile-display-name">' + _esc(user.fullName)
            + ' <span class="badge" style="display:' + (isVerified ? 'inline-flex' : 'none') + ';"><i class="fas fa-check"></i> Verified</span></h2>'
            + '<p id="profile-display-username">@' + _esc(user.username) + '</p>'
            + '<div class="profile-stats-row" style="display:flex;gap:20px;margin:6px 0;font-size:0.88rem;">'
            + '<span><strong id="profile-follower-count">' + flwCount + '</strong> <span style="color:var(--text-muted);">Followers</span></span>'
            + '<span><strong id="profile-following-count">' + flwing + '</strong> <span style="color:var(--text-muted);">Following</span></span>'
            + '</div>'
            + '<div class="profile-header-actions">'
            + (isMyProfile
                ? '<button class="btn btn-small nav-link" data-target="settings"><i class="fas fa-edit"></i> Edit Profile</button>'
                : '<button class="btn btn-small" id="profile-message-btn" data-message-user-id="' + _attr(user.id) + '"><i class="fas fa-envelope"></i> Message</button>')
            + '<button class="btn btn-small share-profile-btn"><i class="fas fa-share"></i> Share</button>'
            + (!isMyProfile ? '<button class="btn btn-small follow-btn" data-user-id="' + _attr(user.id) + '">Follow</button>' : '')
            + '</div></div></div>'

            /* KYC nudge banner */
            + (isMyProfile && !us.isVerified
                ? '<div style="background:linear-gradient(135deg,rgba(91,14,166,0.08),rgba(245,197,24,0.08));'
                + 'border:1.5px solid rgba(91,14,166,0.18);border-radius:14px;padding:10px 14px;'
                + 'margin:10px 16px 0;display:flex;align-items:center;gap:10px;cursor:pointer;" '
                + 'onclick="var el=document.querySelector(\'[data-target=\\"profile-kyc-tab\\"]\');if(el)el.click();">'
                + '<i class="fas fa-shield-alt" style="color:#5B0EA6;font-size:1.2rem;flex-shrink:0;"></i>'
                + '<div style="flex:1;"><strong style="color:#5B0EA6;font-size:0.82rem;">Complete KYC Verification</strong>'
                + '<br><span style="font-size:0.72rem;color:var(--text-muted);">To complete KYC, switch to desktop mode and click the button.</span></div>'
                + '<i class="fas fa-chevron-right" style="color:#5B0EA6;"></i></div>'
                : '')

            /* Bio chips */
            + _buildBioChips()

            /* Profile tabs */
            + '<div class="profile-tabs" style="display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;'
            + 'scrollbar-width:none;white-space:nowrap;padding-bottom:2px;gap:0;margin-top:14px;">'
            + (isMyProfile ? '<div class="profile-tab active" data-target="profile-dashboard-tab" style="flex-shrink:0;"><i class="fas fa-tachometer-alt" style="margin-right:4px;"></i>Dashboard</div>' : '')
            + '<div class="profile-tab ' + (isMyProfile ? '' : 'active') + '" data-target="profile-posts-tab" style="flex-shrink:0;">Posts</div>'
            + '<div class="profile-tab" data-target="profile-main-content" style="flex-shrink:0;">Gallery</div>'
            + '<div class="profile-tab" data-target="profile-about-tab" style="flex-shrink:0;"><i class="fas fa-id-card" style="margin-right:4px;"></i>About</div>'
            + (isMyProfile ? '<div class="profile-tab" data-target="profile-monetization" style="flex-shrink:0;">Monetization</div>' : '')
            + (isMyProfile ? '<div class="profile-tab" data-target="profile-kyc-tab" style="flex-shrink:0;color:#5B0EA6;font-weight:700;"><i class="fas fa-shield-alt" style="margin-right:4px;"></i>KYC</div>' : '')
            + '</div>'

            /* Tab contents */
            + '<div class="card-content">'

            /* Dashboard tab (own profile only) */
            + (isMyProfile
                ? '<div id="profile-dashboard-tab" class="profile-tab-content active">'
                + '<div style="position:relative;margin-bottom:20px;">'
                + '<button id="profile-create-toggle-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;'
                + 'background:linear-gradient(135deg,#0A0E27,#1B2B8B);border:none;border-radius:16px;color:white;font-size:1rem;font-weight:700;cursor:pointer;transition:all 0.2s;">'
                + '<span id="profile-create-icon" style="width:34px;height:34px;border-radius:50%;background:rgba(245,197,24,0.25);border:2px solid #F5C518;display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:#F5C518;transition:transform 0.3s;">+</span>'
                + '<span>Share a Moment</span></button>'
                + '<div id="profile-create-panel" style="display:none;background:linear-gradient(135deg,#0A0E27,#1B2B8B);border-radius:0 0 18px 18px;padding:18px 20px 20px;color:white;margin-top:-4px;">'
                + '<p style="font-size:0.82rem;opacity:0.75;margin-bottom:14px;">Photos &amp; videos appear instantly on your profile and dashboard feed</p>'
                + '<input type="text" id="profile-post-title" placeholder="✏️ Title / Heading (optional)" style="width:100%;background:rgba(255,255,255,0.1);border:1.5px solid rgba(255,255,255,0.25);border-radius:12px;padding:10px 14px;color:white;font-size:0.9rem;font-weight:600;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:10px;">'
                + '<div id="profile-post-media-preview" style="margin-bottom:10px;border-radius:12px;overflow:hidden;"></div>'
                + '<textarea id="profile-post-text" rows="3" placeholder="What\'s on your mind?" style="width:100%;background:rgba(255,255,255,0.1);border:1.5px solid rgba(255,255,255,0.2);border-radius:14px;padding:12px;color:white;font-size:0.95rem;resize:none;outline:none;font-family:inherit;margin-bottom:10px;box-sizing:border-box;"></textarea>'
                + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
                + '<label for="profile-post-media-input" style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.25);color:white;padding:9px 18px;border-radius:50px;cursor:pointer;font-size:0.85rem;font-weight:600;display:flex;align-items:center;gap:6px;"><i class="fas fa-images"></i> Add Media</label>'
                + '<input type="file" id="profile-post-media-input" accept="image/*,video/*" multiple style="display:none;">'
                + '<button id="profile-post-submit-btn" style="background:#F5C518;color:#0A0E27;border:none;padding:9px 22px;border-radius:50px;font-weight:700;cursor:pointer;font-size:0.9rem;margin-left:auto;">'
                + '<i class="fas fa-paper-plane"></i> Post</button></div></div></div>'
                /* Mini stats */
                + '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">'
                + '<div style="background:white;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid rgba(10,14,39,0.06);">'
                + '<div style="font-size:1.6rem;font-weight:800;color:var(--secondary);cursor:pointer;" id="profile-dash-followers" onclick="window.showFollowersModal()">'
                + (us.followerCount || 0).toLocaleString() + '</div>'
                + '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;cursor:pointer;" onclick="window.showFollowersModal()">Followers ▾</div></div>'
                + '<div style="background:white;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid rgba(10,14,39,0.06);">'
                + '<div style="font-size:1.6rem;font-weight:800;color:#F5C518;" id="profile-dash-empy">'
                + (us.empyBalance || 0).toLocaleString() + '</div>'
                + '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">EMPY Balance</div></div>'
                + '</div>'
                + '<div style="margin-bottom:20px;">'
                + '<h4 style="font-weight:700;color:var(--primary);margin-bottom:12px;"><i class="fas fa-broadcast-tower" style="color:var(--danger-color);margin-right:6px;"></i>Live Streams</h4>'
                + '<div class="horizontal-slider-container"><div class="horizontal-slider-wrapper" id="profile-dash-live-slider"></div></div></div>'
                + '<h4 style="font-weight:700;color:var(--primary);margin-bottom:12px;"><i class="fas fa-stream" style="color:var(--secondary);margin-right:6px;"></i>Your Feed</h4>'
                + '<div id="profile-dash-feed"></div></div>'
                : '')

            /* Posts tab */
            + '<div id="profile-posts-tab" class="profile-tab-content ' + (isMyProfile ? '' : 'active') + '">'
            + '<div id="profile-posts-feed" style="display:flex;flex-direction:column;gap:12px;"></div>'
            + '<div id="profile-posts-empty" style="text-align:center;padding:40px;color:var(--text-muted);">'
            + '<i class="fas fa-stream" style="font-size:2rem;display:block;margin-bottom:12px;"></i>'
            + '<p>No posts yet' + (isMyProfile ? ' — share a moment above!' : ' from this user.') + '</p></div></div>'

            /* Gallery tab */
            + '<div id="profile-main-content" class="profile-tab-content">'
            + '<h3 style="margin-bottom:16px;"><i class="fas fa-images" style="color:var(--secondary);margin-right:8px;"></i>Gallery (Photos &amp; Videos)</h3>'
            + '<div id="profile-gallery"><p>No media posts yet.</p></div></div>'

            /* About tab */
            + '<div id="profile-about-tab" class="profile-tab-content">'
            + '<h3 style="margin-bottom:18px;"><i class="fas fa-id-card" style="color:var(--secondary);margin-right:8px;"></i>About '
            + (isMyProfile ? 'Me' : _esc(user.fullName)) + '</h3>'
            + (user.bio ? '<div style="background:linear-gradient(135deg,rgba(10,14,39,0.04),rgba(27,43,139,0.06));border-radius:14px;padding:14px 16px;margin-bottom:16px;border-left:3px solid var(--secondary);">'
                + '<p style="color:var(--text-muted);font-size:0.82rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Bio</p>'
                + '<p style="color:var(--text-primary);line-height:1.6;">' + _esc(user.bio) + '</p></div>' : '')
            + '<div style="display:flex;flex-direction:column;gap:0;border:1.5px solid rgba(10,14,39,0.08);border-radius:16px;overflow:hidden;">'
            + _buildAboutRows() + '</div>'
            + (isMyProfile ? '<div style="margin-top:16px;text-align:center;"><button class="btn btn-small nav-link" data-target="settings" style="font-size:0.82rem;opacity:0.75;"><i class="fas fa-edit"></i> Edit your info in Settings</button></div>' : '')
            + '</div>'

            /* Monetization tab placeholder (filled by renderMonetizationTab) */
            + (isMyProfile ? '<div id="profile-monetization" class="profile-tab-content"></div>' : '')
            + '</div></div>'

            /* KYC tab (outside card-content, own profile only) */
            + (isMyProfile ? '<div id="profile-kyc-tab" class="profile-tab-content" style="display:none;">' + kycFormHTML + '</div>' : '');

        /* ── Post-render wiring ── */
        if (isMyProfile) {
            renderMonetizationTab();
            if (typeof window.populateDobSelectors === 'function') window.populateDobSelectors();

            setTimeout(function () {
                /* Create-panel toggle */
                var toggleBtn = document.getElementById('profile-create-toggle-btn');
                var panel     = document.getElementById('profile-create-panel');
                var iconEl    = document.getElementById('profile-create-icon');
                if (toggleBtn && panel && iconEl) {
                    toggleBtn.addEventListener('click', function () {
                        var open = panel.style.display !== 'none';
                        panel.style.display    = open ? 'none' : 'block';
                        iconEl.style.transform = open ? 'rotate(0deg)' : 'rotate(45deg)';
                        iconEl.textContent     = open ? '+' : '×';
                    });
                }

                /* Profile post media preview */
                var profileMediaFiles = [];
                var pMediaInput  = document.getElementById('profile-post-media-input');
                var pPreview     = document.getElementById('profile-post-media-preview');
                if (pMediaInput) {
                    pMediaInput.addEventListener('change', function () {
                        profileMediaFiles = profileMediaFiles.concat(Array.from(this.files)).slice(0, 10);
                        if (!pPreview) return;
                        pPreview.innerHTML = '';
                        profileMediaFiles.forEach(function (f, idx) {
                            var url   = URL.createObjectURL(f);
                            var isVid = f.type.startsWith('video/');
                            var wrap  = document.createElement('div');
                            wrap.style.cssText = 'position:relative;display:inline-block;margin:4px;';
                            wrap.innerHTML = isVid
                                ? '<video src="' + url + '" muted playsinline style="width:80px;height:80px;object-fit:cover;border-radius:8px;"></video>'
                                : '<img src="' + url + '" style="width:80px;height:80px;object-fit:cover;border-radius:8px;">';
                            var rmBtn = document.createElement('button');
                            rmBtn.type = 'button'; rmBtn.textContent = '×';
                            rmBtn.style.cssText = 'position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;';
                            rmBtn.onclick = function () {
                                profileMediaFiles.splice(idx, 1);
                                pMediaInput.dispatchEvent(new Event('change'));
                            };
                            wrap.appendChild(rmBtn);
                            pPreview.appendChild(wrap);
                        });
                    });
                }

                /* Profile post submit — clone-replace to prevent double-binding */
                var submitBtn = document.getElementById('profile-post-submit-btn');
                if (submitBtn) {
                    var fresh = submitBtn.cloneNode(true);
                    submitBtn.parentNode.replaceChild(fresh, submitBtn);
                    fresh.addEventListener('click', async function () {
                        var textEl  = document.getElementById('profile-post-text');
                        var titleEl = document.getElementById('profile-post-title');
                        var text    = textEl  ? textEl.value.trim()  : '';
                        var title   = titleEl ? titleEl.value.trim() : '';
                        if (!text && profileMediaFiles.length === 0) {
                            if (typeof window.showNotification === 'function') window.showNotification('Please add text or media before posting.', 'error');
                            return;
                        }
                        fresh.disabled = true;
                        if (profileMediaFiles.length > 0 && typeof window.showNotification === 'function') {
                            window.showNotification('Uploading media to cloud…', 'info');
                        }
                        try {
                            var cloudUrls = await window.uploadMediaFilesToCloudinary(profileMediaFiles);
                            var fullText  = title ? (title + (text ? '\n' + text : '')) : text;
                            var mediaObjs = cloudUrls.filter(Boolean).map(function (u, i) {
                                var f = profileMediaFiles[i];
                                return { _cloudUrl: u, url: u, type: f ? f.type : 'image/jpeg' };
                            });

                            if (typeof window.createNewPostElement === 'function') {
                                var postEl = window.createNewPostElement(fullText, mediaObjs, { id: us.id, fullName: us.fullName, avatar: us.avatar });

                                /* Persist to Firestore */
                                var postData = {
                                    id:        postEl.dataset.postId,
                                    text:      fullText,
                                    media:     cloudUrls.filter(Boolean),
                                    userId:    us.id,
                                    username:  us.fullName || us.username || 'User',
                                    avatar:    us.avatar   || '',
                                    likes:     0, comments: 0, views: 0,
                                    createdAt: new Date().toISOString()
                                };
                                if (window.fbDb && window._firebaseLoaded) {
                                    window.fbDb.collection('posts').doc(postData.id).set(postData).catch(function () {});
                                }

                                /* Process tags */
                                if (typeof window._processPostTags === 'function') {
                                    window._processPostTags(fullText, us.fullName || 'User');
                                }

                                /* Reward */
                                if (typeof window.rewardUserForAction === 'function') {
                                    window.rewardUserForAction(profileMediaFiles.length > 0 ? 'CREATE_REEL' : 'CREATE_POST');
                                }

                                if (typeof window.showNotification === 'function') {
                                    window.showNotification('✅ Post published!', 'success');
                                }
                            }

                            /* Reset form */
                            if (textEl)  textEl.value  = '';
                            if (titleEl) titleEl.value = '';
                            profileMediaFiles = [];
                            if (pPreview) pPreview.innerHTML = '';
                            if (panel) panel.style.display = 'none';
                            if (iconEl) { iconEl.style.transform = 'rotate(0deg)'; iconEl.textContent = '+'; }
                        } catch (e) {
                            if (typeof window.showNotification === 'function') window.showNotification('Post failed. Please try again.', 'error');
                        }
                        fresh.disabled = false;
                    });
                }
            }, 200);
        }

        /* Populate gallery from existing DOM posts */
        setTimeout(function () { populateProfileGallery(userId); }, 300);
    }
    window.renderUserProfile = renderUserProfile;


    /* =========================================================================
       §2  renderMonetizationTab
       ========================================================================= */

    function renderMonetizationTab() {
        var container = document.getElementById('profile-monetization');
        if (!container) return;
        var us         = _us();
        var isEligible = us.isVerified && (us.followerCount || 0) >= 500;
        var empyBal    = (us.empyBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        var empyRate   = (_S().EMPY_RATE_USD) || window.EMPY_RATE_USD || 0.10;

        if (isEligible) {
            container.innerHTML =
                '<h3><i class="fas fa-dollar-sign"></i> Your Monetization</h3>'
                + '<div class="wallet-card">'
                + '<p>Available for Withdrawal</p>'
                + '<h3 class="empy-balance"><i class="fa-solid fa-coins"></i> ' + empyBal + '</h3>'
                + '<p>~ ' + (typeof window.formatUsdPrice === 'function' ? window.formatUsdPrice((us.empyBalance || 0) * empyRate) : '') + '</p>'
                + '<button class="btn btn-accent nav-link" data-target="my-wallet"><i class="fas fa-exchange-alt"></i> Go to Wallet</button>'
                + '</div>';
        } else {
            var nextRank = RANKS.find(function (r) { return r.followers > (us.followerCount || 0); });
            var nextInfo = nextRank
                ? '<p>Next Rank: <strong>' + nextRank.name + '</strong> (' + (us.followerCount || 0).toLocaleString() + ' / ' + nextRank.followers.toLocaleString() + ' followers) for a <strong>' + nextRank.reward + ' EMPY</strong> reward.</p>'
                : '';
            var reasons = '<ul>';
            reasons += !us.isVerified
                ? '<li><i class="fas fa-times-circle" style="color:var(--danger-color)"></i> Complete KYC verification. <a href="#" class="nav-link" data-target="profile">Verify Now</a></li>'
                : '<li><i class="fas fa-check-circle" style="color:var(--success-color)"></i> KYC Verified</li>';
            reasons += (us.followerCount || 0) < 500
                ? '<li><i class="fas fa-times-circle" style="color:var(--danger-color)"></i> Reach 500 followers (Current: ' + (us.followerCount || 0) + ')</li>'
                : '<li><i class="fas fa-check-circle" style="color:var(--success-color)"></i> 500+ Followers</li>';
            reasons += '</ul>';

            container.innerHTML =
                '<h3><i class="fas fa-lock"></i> Monetization Locked</h3>'
                + '<div class="form-feedback info" style="display:block;text-align:left;">'
                + '<p>To unlock monetization features like withdrawals and direct payments, please meet the following criteria:</p>'
                + reasons + nextInfo + '</div>';
        }
    }
    window.renderMonetizationTab = renderMonetizationTab;


    /* =========================================================================
       §3  renderBusinessPage
       ========================================================================= */

    function renderBusinessPage() {
        var container = document.getElementById('business-page');
        if (!container) return;
        var us = _us();

        if (us.businessPage) {
            var page = us.businessPage;
            var coverGradient = page.coverPhoto && page.coverPhoto.startsWith('http')
                ? "url('" + page.coverPhoto + "')"
                : 'linear-gradient(135deg,#0A0E27 0%,#1B2B8B 100%)';

            container.innerHTML =
                '<div class="card business-page-header" style="overflow:hidden;border-radius:24px;margin-bottom:16px;padding:0;">'
                + '<div id="business-page-cover-photo" style="height:220px;background:' + coverGradient + ';background-size:cover;background-position:center;position:relative;">'
                + '<label for="business-cover-photo-input" style="position:absolute;bottom:12px;right:12px;background:rgba(255,255,255,0.2);backdrop-filter:blur(8px);border:1.5px solid rgba(255,255,255,0.4);color:white;padding:8px 16px;border-radius:50px;cursor:pointer;font-size:0.82rem;font-weight:600;display:flex;align-items:center;gap:6px;"><i class="fas fa-camera"></i> Edit Cover</label>'
                + '<input type="file" id="business-cover-photo-input" accept="image/*" style="display:none;"></div>'
                /* Identity row */
                + '<div style="display:flex;align-items:flex-end;gap:18px;padding:0 24px;transform:translateY(-40px);margin-bottom:-30px;">'
                + '<div style="position:relative;flex-shrink:0;">'
                + '<div style="width:90px;height:90px;border-radius:18px;border:4px solid white;background:var(--g-navy);overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;">'
                + (page.profilePhoto && page.profilePhoto.startsWith('http')
                    ? '<img src="' + _attr(page.profilePhoto) + '" id="business-page-profile-pic" style="width:100%;height:100%;object-fit:cover;">'
                    : '<i class="fas fa-briefcase" style="font-size:2rem;color:#F5C518;"></i>')
                + '</div>'
                + '<label for="business-profile-photo-input" style="position:absolute;bottom:-4px;right:-4px;width:28px;height:28px;border-radius:50%;background:var(--accent);border:2px solid white;display:flex;align-items:center;justify-content:center;cursor:pointer;"><i class="fas fa-camera" style="font-size:0.6rem;color:#111;"></i></label>'
                + '<input type="file" id="business-profile-photo-input" accept="image/*" style="display:none;"></div>'
                + '<div style="flex:1;padding-bottom:6px;">'
                + '<h2 id="business-page-name" style="font-family:\'Syne\',sans-serif;font-size:1.3rem;font-weight:800;color:var(--primary);margin:0 0 2px;">'
                + _esc(page.name) + ' <i class="fas fa-pen edit-icon" data-field="name" style="font-size:0.75rem;color:var(--text-muted);cursor:pointer;margin-left:8px;"></i></h2>'
                + '<p id="business-page-tagline" style="color:var(--text-muted);font-size:0.88rem;margin:0;">'
                + _esc(page.tagline) + ' <i class="fas fa-pen edit-icon" data-field="tagline" style="font-size:0.7rem;cursor:pointer;margin-left:6px;"></i></p></div>'
                + '<div style="display:flex;gap:8px;padding-bottom:8px;flex-wrap:wrap;">'
                + '<button class="btn btn-small follow-btn" data-user-id="' + _attr(page.id || 'biz-1') + '" style="border-radius:50px;padding:8px 18px;font-size:0.82rem;"><i class="fas fa-plus"></i> Follow</button>'
                + '<button class="btn btn-small btn-accent business-page-promote-btn" style="border-radius:50px;padding:8px 18px;font-size:0.82rem;"><i class="fas fa-rocket"></i> Promote</button>'
                + '<button class="btn btn-small business-page-share-btn" style="border-radius:50px;padding:8px 18px;font-size:0.82rem;background:rgba(10,14,39,0.05);"><i class="fas fa-share"></i> Share</button>'
                + '</div></div>'
                /* Stats */
                + '<div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(10,14,39,0.06);margin:0 24px;">'
                + '<div style="padding:14px;text-align:center;border-right:1px solid rgba(10,14,39,0.06);"><strong style="font-size:1.2rem;font-family:\'Syne\',sans-serif;color:var(--primary);" id="business-page-follower-count">' + (page.followerCount || 0).toLocaleString() + '</strong><p style="font-size:0.72rem;color:var(--text-muted);margin:0;">Followers</p></div>'
                + '<div style="padding:14px;text-align:center;border-right:1px solid rgba(10,14,39,0.06);"><strong style="font-size:1.2rem;font-family:\'Syne\',sans-serif;color:var(--primary);" id="biz-post-count">0</strong><p style="font-size:0.72rem;color:var(--text-muted);margin:0;">Posts</p></div>'
                + '<div style="padding:14px;text-align:center;border-right:1px solid rgba(10,14,39,0.06);"><strong style="font-size:1.2rem;font-family:\'Syne\',sans-serif;color:var(--secondary);">8.2%</strong><p style="font-size:0.72rem;color:var(--text-muted);margin:0;">Engagement</p></div>'
                + '<div style="padding:14px;text-align:center;"><strong style="font-size:1.2rem;font-family:\'Syne\',sans-serif;color:var(--accent2);">56.4K</strong><p style="font-size:0.72rem;color:var(--text-muted);margin:0;">Reach (30d)</p></div>'
                + '</div>'
                /* Tabs */
                + '<div class="profile-tabs" id="business-page-tabs" style="padding:0 24px;margin-top:0;">'
                + '<div class="profile-tab active" data-target="business-page-feed-tab">Feed</div>'
                + '<div class="profile-tab" data-target="business-page-about-tab">About</div>'
                + '<div class="profile-tab" data-target="business-page-media-tab">Media</div>'
                + '<div class="profile-tab" data-target="business-page-promotion-tab">Campaigns</div>'
                + '<div class="profile-tab" data-target="business-page-analytics-tab">Analytics</div>'
                + '</div></div>'
                /* Feed tab */
                + '<div id="business-page-feed-tab" class="profile-tab-content active">'
                + '<div class="card" style="margin-bottom:16px;"><div class="card-content">'
                + '<h3 style="margin-bottom:16px;"><i class="fas fa-pen" style="color:var(--secondary);margin-right:8px;"></i>Create Business Post</h3>'
                + '<form id="create-business-post-form">'
                + '<div class="form-group"><textarea id="business-post-text" rows="3" placeholder="Share updates, products, services, or announcements..." style="resize:vertical;min-height:80px;"></textarea></div>'
                + '<div id="business-post-media-preview" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;margin-bottom:12px;"></div>'
                + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
                + '<label for="business-post-media-input" class="btn btn-media-upload" style="cursor:pointer;padding:8px 16px;font-size:0.82rem;"><i class="fas fa-photo-video"></i> Media</label>'
                + '<input type="file" id="business-post-media-input" accept="image/*,video/*" multiple style="display:none;">'
                + '<button type="submit" class="btn btn-accent" style="padding:10px 24px;font-size:0.88rem;border-radius:50px;"><i class="fas fa-paper-plane"></i> Post</button>'
                + '</div></form></div></div>'
                + '<div id="business-page-feed-container"><div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-stream" style="font-size:2rem;display:block;margin-bottom:12px;"></i><p>No business posts yet. Start sharing!</p></div></div></div>';

        } else {
            /* Create page prompt */
            container.innerHTML =
                '<div class="card"><div class="card-content" id="create-page-prompt" style="text-align:center;padding:60px 30px;">'
                + '<i class="fas fa-building" style="font-size:3rem;color:var(--secondary);display:block;margin-bottom:20px;"></i>'
                + '<h2>Create Your Business Page</h2>'
                + '<p style="color:var(--text-muted);margin:12px 0 28px;">Reach more customers, build your brand, and connect with your community on Empyrean.</p>'
                + '<button id="create-business-page-btn" class="btn btn-accent" style="font-size:1rem;padding:14px 32px;border-radius:50px;">'
                + '<i class="fas fa-plus"></i> Create Business Page</button>'
                + '</div></div>';
        }
    }
    window.renderBusinessPage = renderBusinessPage;


    /* =========================================================================
       §4  populateProfileGallery
       ========================================================================= */

    /**
     * Populate #profile-gallery from .impact-story posts belonging to userId.
     * @param {string} userId
     */
    function populateProfileGallery(userId) {
        var gallery = document.getElementById('profile-gallery');
        if (!gallery) return;

        var allPosts   = Array.from(document.querySelectorAll('.impact-story[data-user-id="' + userId + '"]'));
        var mediaPosts = allPosts.filter(function (p) { return p.querySelector('.story-media-container'); });

        if (mediaPosts.length === 0) {
            gallery.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:32px 0;font-size:0.9rem;">No media posts yet.</p>';
            return;
        }

        gallery.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;';
        gallery.innerHTML = '';

        mediaPosts.forEach(function (post) {
            var mc       = post.querySelector('.story-media-container');
            if (!mc) return;
            var firstImg = mc.querySelector('img');
            var firstVid = mc.querySelector('video');
            var isVid    = !!firstVid && !firstImg;
            var src      = isVid
                ? (firstVid.src || (firstVid.querySelector('source') ? firstVid.querySelector('source').src : ''))
                : (firstImg ? firstImg.src : '');
            if (!src || src.startsWith('blob:')) return;

            var totalMedia = mc.querySelectorAll('img, video').length;

            var card = document.createElement('div');
            card.style.cssText = [
                'position:relative', 'aspect-ratio:1/1', 'border-radius:10px', 'overflow:hidden',
                'background:#e8eaf0', 'cursor:pointer', 'box-shadow:0 2px 8px rgba(10,14,39,0.10)',
                'border:1.5px solid rgba(10,14,39,0.07)', 'transition:transform 0.18s,box-shadow 0.18s'
            ].join(';');
            card.onmouseenter = function () { card.style.transform = 'scale(1.035)'; card.style.boxShadow = '0 6px 18px rgba(10,14,39,0.18)'; };
            card.onmouseleave = function () { card.style.transform = ''; card.style.boxShadow = '0 2px 8px rgba(10,14,39,0.10)'; };

            if (isVid) {
                card.innerHTML = '<video src="' + src + '" style="width:100%;height:100%;object-fit:cover;" muted playsinline preload="metadata"></video>'
                    + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.22);pointer-events:none;">'
                    + '<div style="width:34px;height:34px;background:rgba(255,255,255,0.92);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.25);">'
                    + '<i class="fas fa-play" style="color:#0A0E27;font-size:0.75rem;margin-left:3px;"></i></div></div>';
            } else {
                card.innerHTML = '<img src="' + _attr(src) + '" alt="Media" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display=\'none\'">';
            }

            /* Multi-count badge */
            if (totalMedia > 1) {
                var badge = document.createElement('div');
                badge.style.cssText = 'position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.55);color:white;border-radius:50px;padding:2px 7px;font-size:0.7rem;font-weight:700;';
                badge.innerHTML = '<i class="fas fa-images" style="font-size:0.65rem;margin-right:2px;"></i>' + totalMedia;
                card.appendChild(badge);
            }

            card.addEventListener('click', function () {
                var allUrls = Array.from(mc.querySelectorAll('img, video')).map(function (el) {
                    return { url: el.src || '', type: el.tagName === 'VIDEO' ? 'video/mp4' : 'image/jpeg' };
                }).filter(function (m) { return m.url && !m.url.startsWith('blob:'); });

                if (typeof window.showMarketplaceGallery === 'function') {
                    window.showMarketplaceGallery(allUrls, 0);
                } else {
                    window.open(src, '_blank');
                }
            });

            gallery.appendChild(card);
        });
    }
    window.populateProfileGallery = populateProfileGallery;


    /* =========================================================================
       §5  _populateHomeBioCard
       ========================================================================= */

    function _populateHomeBioCard() {
        var card = document.getElementById('home-user-bio-card');
        if (!card || _isGuest()) { if (card) card.style.display = 'none'; return; }
        if (typeof window.renderSuggestedUsers === 'function') {
            setTimeout(window.renderSuggestedUsers, 150);
        }
    }
    window._populateHomeBioCard = _populateHomeBioCard;


    /* =========================================================================
       §6  showFollowersModal / showFollowingModal
       ========================================================================= */

    window.showFollowersModal = function (tab) {
        var us      = _us();
        var mu      = _mu();
        var followed = Array.from(us.followedUserIds || []);

        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:var(--z-critical,99999);display:flex;align-items:center;justify-content:center;';

        var box = document.createElement('div');
        box.style.cssText = 'background:white;border-radius:20px;width:min(400px,92vw);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;';

        /* Tab bar */
        var tabs    = document.createElement('div');
        tabs.style.cssText = 'display:flex;border-bottom:1px solid rgba(10,14,39,0.08);';
        var tabFlw  = document.createElement('button');
        tabFlw.style.cssText  = 'flex:1;padding:14px;border:none;background:none;font-weight:700;cursor:pointer;color:var(--primary);';
        tabFlw.textContent    = 'Followers (' + (us.followerCount || 0) + ')';
        var tabFlwing = document.createElement('button');
        tabFlwing.style.cssText = 'flex:1;padding:14px;border:none;background:none;font-weight:600;cursor:pointer;color:var(--text-muted);';
        tabFlwing.textContent = 'Following (' + followed.length + ')';
        var closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'padding:14px;border:none;background:none;cursor:pointer;font-size:1.2rem;color:var(--text-muted);';
        closeBtn.innerHTML     = '&times;';
        closeBtn.onclick = function () { overlay.remove(); };
        tabs.appendChild(tabFlw);
        tabs.appendChild(tabFlwing);
        tabs.appendChild(closeBtn);

        /* Panels */
        var panFlw = document.createElement('div');
        panFlw.style.cssText = 'overflow-y:auto;flex:1;padding:12px;';
        panFlw.innerHTML = (us.followerCount || 0) > 0
            ? '<p style="text-align:center;padding:20px;color:var(--text-muted);">Follower list synced from backend.</p>'
            : '<p style="text-align:center;padding:20px;color:var(--text-muted);">No followers yet.</p>';

        var panFlwing = document.createElement('div');
        panFlwing.style.cssText = 'overflow-y:auto;flex:1;padding:12px;display:none;';

        if (followed.length > 0) {
            followed.forEach(function (uid) {
                var u   = mu[uid] || {};
                var row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(10,14,39,0.05);cursor:pointer;';
                var img = document.createElement('img');
                img.src           = u.avatar || 'https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=40';
                img.style.cssText = 'width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;';
                var info = document.createElement('div');
                info.innerHTML    = '<strong style="display:block;">' + _esc(u.fullName || 'User') + '</strong><span style="font-size:0.8rem;color:var(--text-muted);">@' + _esc(u.username || 'user') + '</span>';
                row.appendChild(img);
                row.appendChild(info);
                row.onclick = function () {
                    overlay.remove();
                    window._viewingOtherProfile = (uid !== us.id);
                    if (typeof window.renderUserProfile === 'function') window.renderUserProfile(uid);
                    if (typeof window.navigateTo       === 'function') window.navigateTo('profile', true);
                    setTimeout(function () { window._viewingOtherProfile = false; }, 500);
                };
                panFlwing.appendChild(row);
            });
        } else {
            panFlwing.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">Not following anyone yet.</p>';
        }

        /* Tab switching */
        tabFlw.onclick = function () {
            panFlw.style.display = 'block'; panFlwing.style.display = 'none';
            tabFlw.style.fontWeight = '700'; tabFlw.style.color = 'var(--primary)';
            tabFlwing.style.fontWeight = '600'; tabFlwing.style.color = 'var(--text-muted)';
        };
        tabFlwing.onclick = function () {
            panFlw.style.display = 'none'; panFlwing.style.display = 'block';
            tabFlwing.style.fontWeight = '700'; tabFlwing.style.color = 'var(--primary)';
            tabFlw.style.fontWeight = '600'; tabFlw.style.color = 'var(--text-muted)';
        };

        box.appendChild(tabs);
        box.appendChild(panFlw);
        box.appendChild(panFlwing);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        if (tab === 'following') tabFlwing.onclick();
    };

    window.showFollowingModal = function () { window.showFollowersModal('following'); };


    /* =========================================================================
       §7  PROFILE TAB SWITCHING (delegated)
       ========================================================================= */

    document.addEventListener('click', function (e) {
        var tab = e.target.closest('.profile-tab');
        if (!tab) return;
        var target = tab.dataset.target;
        if (!target) return;

        /* Deactivate siblings */
        var tabBar = tab.closest('.profile-tabs');
        if (tabBar) {
            tabBar.querySelectorAll('.profile-tab').forEach(function (t) { t.classList.remove('active'); });
        }
        tab.classList.add('active');

        /* Hide all sibling tab contents */
        var card = tab.closest('.card, .card-content, #profile') || document;
        card.querySelectorAll('.profile-tab-content').forEach(function (c) { c.style.display = 'none'; c.classList.remove('active'); });

        /* Show target */
        var panel = document.getElementById(target);
        if (panel) { panel.style.display = 'block'; panel.classList.add('active'); }

        /* Lazy-populate gallery on first open */
        if (target === 'profile-main-content') {
            var gal = document.getElementById('profile-gallery');
            if (gal && !gal.querySelector('.gallery-item, [data-media-url]')) {
                var uid = (window.EmpState ? window.EmpState.userState : window.userState || {}).id;
                if (uid) populateProfileGallery(uid);
            }
        }
    });


    /* =========================================================================
       §8  STORY-HEADER CLICK → USER PROFILE NAVIGATION
       ========================================================================= */

    document.addEventListener('click', function (e) {
        var storyHeader = e.target.closest('.story-header');
        if (!storyHeader) return;
        var clickedAvatar = e.target.closest('.avatar-placeholder') || (e.target.tagName === 'IMG' ? e.target : null);
        var clickedName   = e.target.closest('.story-user-info strong');
        if (!clickedAvatar && !clickedName) return;
        var post   = storyHeader.closest('.impact-story');
        if (!post) return;
        var userId = post.dataset.userId;
        var us     = _us();
        if (!userId || userId === us.id) return;
        e.preventDefault();
        e.stopPropagation();
        var mu = _mu();
        if (!mu[userId]) return;
        window._viewingOtherProfile = true;
        renderUserProfile(userId);
        if (typeof window.navigateTo === 'function') window.navigateTo('profile', true);
        setTimeout(function () { window._viewingOtherProfile = false; }, 500);
    });


    console.log('[EmpProfile] ✅ Profile system ready.');

})();