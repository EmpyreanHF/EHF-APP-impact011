/* =============================================================================
   EMPYREAN INTERNATIONAL — WALLET & STAKING
   app-wallet.js  |  Step 0.11  |  Refactor Roadmap v1.0
   =============================================================================

   PURPOSE
   ───────
   Complete EMPY wallet and staking system extracted from app-fixes.js.  Covers:

     • updateWalletUI()              — EMPY balance, USD equivalent, live chip
     • updateStakingUI()             — staking panel: APY, balances, lock status
     • renderClaimedRewardsHistory() — reward/claim history list
     • simulateRewardAccrual()       — per-second APY simulation (setInterval)
     • handleWithdrawalMethodChange()— show/hide withdrawal method fields
     • updateWithdrawalPreview()     — fee calculation + receive amount display
     • updateTransferPreview()       — P2P EMPY transfer preview
     • updateCrossChainTransferPreview() — cross-chain bridge preview
     • checkAndAwardRank(user)       — milestone rank rewards from ranking pool
     • Buy EMPY modal flow (Flutterwave)
     • Form submit handlers: stake, unstake, withdrawal, buy-empy
     • Claim reward button handler
     • Wallet tab payment-tab switching
     • Copy wallet address to clipboard
     • Reward accrual interval bootstrap

   LOAD ORDER
   ──────────
   Must come AFTER: firebase-init, app-state, app-helpers, app-contracts,
   app-notifications, app-tags, app-auth, app-feed, app-marketplace.

   DEPENDS ON
   ──────────
   • window.EmpState / window.userState / window.isGuest
   • window.userManualStakedBalance / userLockedStakedBalance / userEarnedRewards
   • window.userStakedBalance / userLockedStakingEndTime / userClaimedRewardsHistory
   • window.impactMiningState / window.RANKING_REWARDS_POOL
   • window.EMPY_RATE_USD / window.USD_TO_NGN_RATE / window.CRYPTO_FEE_PERCENT
   • window.STAKING_APY_ESTIMATE
   • window.formatUsdPrice / window.formatNgnPrice (app-helpers.js)
   • window.showNotification          (app-helpers.js)
   • window.renderMonetizationTab     (app-profile.js)
   • window.fbDb / window._firebaseLoaded

   PUBLIC API
   ──────────
   window.updateWalletUI()
   window.updateStakingUI()
   window.renderClaimedRewardsHistory()
   window.simulateRewardAccrual()
   window.handleWithdrawalMethodChange()
   window.updateWithdrawalPreview()
   window.updateTransferPreview()
   window.updateCrossChainTransferPreview()
   window.checkAndAwardRank(user)

   SECTION MAP
   ───────────
   §1  State accessors
   §2  updateWalletUI
   §3  updateStakingUI + renderClaimedRewardsHistory
   §4  simulateRewardAccrual + reward accrual interval
   §5  Withdrawal helpers — method change, preview, transfer, cross-chain
   §6  checkAndAwardRank
   §7  Buy EMPY preview + Flutterwave handler
   §8  Form submit handlers — stake, unstake, withdrawal, buy-empy
   §9  Claim reward button
   §10 Wallet payment-tab switching
   §11 Copy wallet address
   §12 Bootstrap

   ============================================================================= */

(function empyreanWalletModule() {
    'use strict';

    if (window._empyreanWalletLoaded) {
        console.warn('[EmpWallet] Already loaded — skipping duplicate.');
        return;
    }
    window._empyreanWalletLoaded = true;


    /* =========================================================================
       §1  STATE ACCESSORS
       All reads go through these helpers so the module works both with EmpState
       (new) and the flat window.* globals (legacy fallback).
       ========================================================================= */

    function _S()    { return window.EmpState || {}; }
    function _us()   { return _S().userState  || window.userState  || {}; }
    function _guest(){ var s = _S(); return s.isGuest != null ? s.isGuest : !!window.isGuest; }

    function _get(key) {
        var s = _S();
        return (s[key] != null) ? s[key] : window[key];
    }
    function _set(key, val) {
        if (window.EmpState && window.EmpState[key] != null) window.EmpState[key] = val;
        else window[key] = val;
    }

    function _rate()       { return _get('EMPY_RATE_USD')        || 0.10;        }
    function _ngn()        { return _get('USD_TO_NGN_RATE')       || 1500;        }
    function _fee()        { return _get('CRYPTO_FEE_PERCENT')    || 1.5;         }
    function _apy()        { return _get('STAKING_APY_ESTIMATE')  || 0.157;       }
    function _pool()       { return _get('RANKING_REWARDS_POOL')  || 3_750_000;   }
    function _manualStk()  { return _get('userManualStakedBalance') || 0;         }
    function _lockedStk()  { return _get('userLockedStakedBalance') || 0;         }
    function _lockEnd()    { return _get('userLockedStakingEndTime') || 0;        }
    function _earned()     { return _get('userEarnedRewards')       || 0;         }
    function _history()    { return _get('userClaimedRewardsHistory') || [];      }
    function _mining()     { return _get('impactMiningState')         || {};      }

    /* Ranking tiers (mirrors app-profile.js RANKS) */
    var RANKS = [
        { id: 'rank-1', name: 'Rising Star',      followers: 500,    reward: 50    },
        { id: 'rank-2', name: 'Community Voice',   followers: 1000,   reward: 100   },
        { id: 'rank-3', name: 'Influencer',        followers: 5000,   reward: 250   },
        { id: 'rank-4', name: 'Advocate',          followers: 10000,  reward: 500   },
        { id: 'rank-5', name: 'Leader',            followers: 50000,  reward: 1000  }
    ];


    /* =========================================================================
       §2  updateWalletUI
       Refreshes the wallet balance chip, USD equivalent, and the live-stream
       EMPY balance display.  Also triggers monetization tab and staking panel.
       ========================================================================= */

    function updateWalletUI() {
        if (_guest()) return;

        var us          = _us();
        var empyBalance = us.empyBalance || 0;

        var balEl  = document.getElementById('wallet-empy-balance');
        var usdEl  = document.getElementById('wallet-usd-equivalent');
        var liveEl = document.getElementById('live-user-empy-balance');

        if (balEl) {
            balEl.innerHTML = '<i class="fa-solid fa-coins"></i> '
                + empyBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (usdEl) {
            usdEl.textContent = '~ ' + (typeof window.formatUsdPrice === 'function'
                ? window.formatUsdPrice(empyBalance * _rate())
                : '$' + (empyBalance * _rate()).toFixed(2));
        }
        if (liveEl) {
            liveEl.innerHTML = '(Your Balance: ' + Math.floor(empyBalance).toLocaleString()
                + ' <i class="fa-solid fa-coins" style="font-size:0.8rem;"></i>)';
        }

        /* Sidebar EMPY chip */
        var sideChip = document.getElementById('sidebar-empy-balance');
        if (sideChip) {
            sideChip.textContent = Math.floor(empyBalance).toLocaleString() + ' EMPY';
        }

        /* Dashboard stat card (profile tab) */
        var dashEmpy = document.getElementById('profile-dash-empy');
        if (dashEmpy) dashEmpy.textContent = empyBalance.toLocaleString();

        /* Monetization tab and staking panel */
        if (typeof window.renderMonetizationTab === 'function') window.renderMonetizationTab();
        updateStakingUI();
    }
    window.updateWalletUI = updateWalletUI;


    /* =========================================================================
       §3  updateStakingUI + renderClaimedRewardsHistory
       ========================================================================= */

    function updateStakingUI() {
        if (_guest()) return;
        if (!document.getElementById('staking-apy')) return;

        var us      = _us();
        var manual  = _manualStk();
        var locked  = _lockedStk();
        var lockEnd = _lockEnd();
        var earned  = _earned();

        /* APY label */
        var apyEl = document.getElementById('staking-apy');
        if (apyEl) apyEl.textContent = '~' + (_apy() * 100).toFixed(1) + '%';

        /* Balance displays */
        _setText('user-manual-staked-balance', manual);
        _setText('user-locked-staked-balance', locked);
        _setText('user-earned-rewards',        earned);
        _setText('stake-available-balance',    us.empyBalance || 0);
        _setText('unstake-available-manual-balance', manual);

        /* Claim button */
        var claimBtn = document.getElementById('claim-reward-btn');
        if (claimBtn) claimBtn.disabled = earned <= 0;

        /* Manual staking status */
        var manualStatus = document.getElementById('manual-staking-status');
        if (manualStatus) {
            if (manual > 0) {
                manualStatus.textContent = 'Active (Manual)';
                manualStatus.className   = 'staking-status active';
            } else {
                manualStatus.textContent = 'Inactive';
                manualStatus.className   = 'staking-status inactive';
            }
        }

        /* Locked staking status */
        var lockedStatus = document.getElementById('locked-staking-status');
        if (lockedStatus) {
            if (locked > 0) {
                var now = Date.now();
                if (now < lockEnd) {
                    var daysLeft = Math.ceil((lockEnd - now) / 86_400_000);
                    lockedStatus.textContent = 'Locked (' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' left)';
                    lockedStatus.className   = 'staking-status locked';
                } else {
                    lockedStatus.textContent = 'Unlocked';
                    lockedStatus.className   = 'staking-status unlocked';
                }
            } else {
                lockedStatus.textContent = 'Inactive';
                lockedStatus.className   = 'staking-status inactive';
            }
        }

        /* Unstake button */
        var unstakeBtn = document.querySelector('#unstake-form button[type="submit"]');
        if (unstakeBtn) unstakeBtn.disabled = manual <= 0;

        renderClaimedRewardsHistory();
    }
    window.updateStakingUI = updateStakingUI;

    /**
     * Render the reward/claim history list inside #claimed-rewards-history.
     */
    function renderClaimedRewardsHistory() {
        var historyList = document.getElementById('claimed-rewards-history');
        if (!historyList) return;

        var history = _history();
        if (!history.length) {
            historyList.innerHTML =
                '<p style="text-align:center;color:var(--text-muted);padding:16px;">No claimed rewards yet.</p>';
            return;
        }

        historyList.innerHTML = '<ul class="claimed-history-list">'
            + history.slice().reverse().map(function (item) {
                var statusText = '';
                if (item.lockExpiry) {
                    var lockDate = new Date(item.lockExpiry);
                    if (new Date() < lockDate) {
                        var days = Math.ceil((lockDate.getTime() - Date.now()) / 86_400_000);
                        statusText = ' (Locked, ' + days + ' day' + (days !== 1 ? 's' : '') + ' left)';
                    } else {
                        statusText = ' (Unlocked)';
                    }
                }
                var amt = (item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return '<li class="claimed-history-item">'
                    + '<span>' + _esc(item.type || '') + '</span>'
                    + '<span class="amount">' + amt + ' EMPY</span>'
                    + '<span class="date">' + _esc(item.date || '') + statusText + '</span>'
                    + '</li>';
            }).join('')
            + '</ul>';
    }
    window.renderClaimedRewardsHistory = renderClaimedRewardsHistory;

    /* Helper: set element text as a formatted EMPY number */
    function _setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = parseFloat(val || 0)
            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }


    /* =========================================================================
       §4  simulateRewardAccrual + interval
       Per-second APY tick — only runs when user has a staked balance.
       Also handles auto-release of unlocked locked-staking balance.
       ========================================================================= */

    function simulateRewardAccrual() {
        if (_guest()) return;

        var manual = _manualStk();
        var locked = _lockedStk();

        if (manual > 0 || locked > 0) {
            var totalStaked    = manual + locked;
            var rewardPerSec   = totalStaked * (_apy() / 31_536_000);
            var newEarned      = _earned() + rewardPerSec;
            _set('userEarnedRewards', newEarned);

            /* Only update DOM if wallet section is visible */
            var walletSection = document.getElementById('my-wallet');
            if (walletSection && walletSection.classList.contains('active')) {
                updateStakingUI();
            }
        }

        /* Auto-release locked balance when lock period expires */
        if (locked > 0 && Date.now() >= _lockEnd() && _lockEnd() > 0) {
            var us = _us();
            us.empyBalance = (us.empyBalance || 0) + locked;
            _set('userLockedStakedBalance',  0);
            _set('userLockedStakingEndTime', 0);
            var hist = _history();
            hist.push({
                type: 'Locked Staking Released',
                amount: locked,
                date: new Date().toLocaleDateString()
            });
            _set('userClaimedRewardsHistory', hist);
            if (typeof window.showNotification === 'function') {
                window.showNotification('Your locked EMPY has been released to your wallet!', 'info');
            }
            updateWalletUI();
        }
    }
    window.simulateRewardAccrual = simulateRewardAccrual;

    /* Start 1 s interval — only one instance across the whole page */
    if (!window._rewardAccrualInterval) {
        window._rewardAccrualInterval = setInterval(simulateRewardAccrual, 1000);
    }


    /* =========================================================================
       §5  WITHDRAWAL HELPERS
       ========================================================================= */

    /**
     * Show/hide withdrawal method-specific fields and reset required attributes.
     */
    function handleWithdrawalMethodChange() {
        var methodSelect = document.getElementById('withdrawal-method');
        if (!methodSelect) return;
        var method          = methodSelect.value;
        var fieldsContainer = document.getElementById('withdrawal-method-fields');
        if (!fieldsContainer) return;

        Array.from(fieldsContainer.children).forEach(function (child) {
            child.style.display = 'none';
        });
        fieldsContainer.querySelectorAll('input').forEach(function (inp) {
            inp.required = false;
        });

        if (method) {
            var toShow = document.getElementById(method + '-fields');
            if (toShow) {
                toShow.style.display = 'block';
                toShow.querySelectorAll('input').forEach(function (inp) {
                    inp.required = true;
                });
            }
        }
        updateWithdrawalPreview();
    }
    window.handleWithdrawalMethodChange = handleWithdrawalMethodChange;

    /**
     * Calculate and display withdrawal amounts including fee.
     */
    function updateWithdrawalPreview() {
        var amountInput = document.getElementById('withdrawal-amount');
        var methodEl    = document.getElementById('withdrawal-method');
        var previewEl   = document.getElementById('withdrawal-preview');
        if (!amountInput || !methodEl || !previewEl) return;

        var amountEmpy = parseFloat(amountInput.value);
        var method     = methodEl.value;

        if (!amountEmpy || amountEmpy < 5 || !method) {
            previewEl.innerHTML = '<p>Enter an amount (min 5 EMPY) and select a method.</p>';
            return;
        }

        var amountUsd       = amountEmpy * _rate();
        var feeInEmpy       = amountEmpy * (_fee() / 100);
        var totalDeducted   = amountEmpy + feeInEmpy;
        var finalReceive    = method === 'bank' ? amountUsd * _ngn() : amountUsd;

        var fmtUsd = typeof window.formatUsdPrice  === 'function' ? window.formatUsdPrice  : function (v) { return '$' + v.toFixed(2); };
        var fmtNgn = typeof window.formatNgnPrice  === 'function' ? window.formatNgnPrice  : function (v) { return '₦' + v.toFixed(2); };

        var html = '<p>Withdrawal Amount: <strong>' + amountEmpy.toLocaleString() + ' EMPY</strong> (' + fmtUsd(amountUsd) + ')</p>';
        html += '<p>Fee (' + _fee() + '%): <strong>' + feeInEmpy.toLocaleString() + ' EMPY</strong></p>';
        html += '<p>Total Deduction: <strong>' + totalDeducted.toLocaleString() + ' EMPY</strong></p>';
        if (method === 'bank')      html += '<p>You will receive ~<strong>' + fmtNgn(finalReceive) + '</strong></p>';
        else if (method === 'usdt') html += '<p>You will receive: <strong>' + fmtUsd(finalReceive) + ' (USDT)</strong></p>';
        else                        html += '<p>You will receive: <strong>' + fmtUsd(finalReceive) + '</strong> on your card</p>';

        previewEl.innerHTML = html;
    }
    window.updateWithdrawalPreview = updateWithdrawalPreview;

    /**
     * P2P EMPY transfer preview (Polygon, 1 EMPY network fee).
     */
    function updateTransferPreview() {
        var amountInput = document.getElementById('transfer-amount');
        var previewEl   = document.getElementById('transfer-preview');
        if (!amountInput || !previewEl) return;

        var amountEmpy = parseFloat(amountInput.value) || 0;
        var networkFee = 1.0;

        if (!amountEmpy || amountEmpy <= 0) {
            previewEl.innerHTML = '<p>Enter an amount to see transaction details.</p>';
            return;
        }
        previewEl.innerHTML =
            '<p>Amount to Send: <strong>' + amountEmpy.toLocaleString() + ' EMPY</strong></p>'
            + '<p>Network Fee (Polygon): <strong>' + networkFee.toLocaleString() + ' EMPY</strong></p>'
            + '<p>Total to be Deducted: <strong>' + (amountEmpy + networkFee).toLocaleString() + ' EMPY</strong></p>';
    }
    window.updateTransferPreview = updateTransferPreview;

    /**
     * Cross-chain bridge transfer preview.
     * Fee is read from the selected <option data-fee=""> attribute.
     */
    function updateCrossChainTransferPreview() {
        var amountInput   = document.getElementById('cross-chain-amount');
        var networkSelect = document.getElementById('cross-chain-network');
        var previewEl     = document.getElementById('cross-chain-transfer-preview');
        if (!amountInput || !networkSelect || !previewEl) return;

        var amountEmpy  = parseFloat(amountInput.value) || 0;
        var selectedOpt = networkSelect.options[networkSelect.selectedIndex];
        var networkFee  = parseFloat(selectedOpt ? selectedOpt.dataset.fee : 0) || 0;
        var networkName = selectedOpt
            ? selectedOpt.textContent.split('(')[0].trim()
            : 'Selected network';

        if (!amountEmpy || amountEmpy <= 0) {
            previewEl.innerHTML = '<p>Enter an amount to see transaction details.</p>';
            return;
        }
        previewEl.innerHTML =
            '<p>Amount to Send: <strong>' + amountEmpy.toLocaleString() + ' EMPY</strong></p>'
            + '<p>Network Fee (' + _esc(networkName) + '): <strong>' + networkFee.toLocaleString() + ' EMPY</strong></p>'
            + '<p>Total to be Deducted: <strong>' + (amountEmpy + networkFee).toLocaleString() + ' EMPY</strong></p>';
    }
    window.updateCrossChainTransferPreview = updateCrossChainTransferPreview;


    /* =========================================================================
       §6  checkAndAwardRank
       ========================================================================= */

    /**
     * Check whether user has crossed any ranking milestone and award EMPY
     * from the ranking pool.  Idempotent — uses user.awardedRanks Set.
     * @param {Object} user — userState or any mockUsers entry
     */
    function checkAndAwardRank(user) {
        if (!user || (user.followerCount || 0) < 500) return;

        var mining = _mining();
        var pool   = _pool();

        RANKS.forEach(function (rank) {
            if ((user.followerCount || 0) >= rank.followers
                && !user.awardedRanks.has(rank.id)) {
                if ((mining.rankingPoolSpent || 0) + rank.reward <= pool) {
                    user.empyBalance = (user.empyBalance || 0) + rank.reward;
                    user.awardedRanks.add(rank.id);
                    mining.rankingPoolSpent = (mining.rankingPoolSpent || 0) + rank.reward;
                    _set('impactMiningState', mining);

                    if (user.id === (_us().id)) {
                        if (typeof window.showNotification === 'function') {
                            window.showNotification(
                                '🎉 Congratulations! You have reached the rank of '
                                + rank.name + ' and earned ' + rank.reward + ' EMPY!',
                                'success'
                            );
                        }
                        updateWalletUI();
                        /* Persist to Firestore */
                        var uid = user.id;
                        if (uid && window.fbDb && window._firebaseLoaded) {
                            window.fbDb.collection('users').doc(uid).update({
                                empyBalance: user.empyBalance,
                                awardedRanks: Array.from(user.awardedRanks)
                            }).catch(function () {});
                        }
                    }
                }
            }
        });
    }
    window.checkAndAwardRank = checkAndAwardRank;


    /* =========================================================================
       §7  BUY EMPY PREVIEW (live input feedback)
       ========================================================================= */

    /**
     * Show live "You will receive X EMPY" preview while the user types
     * in the buy-empy amount field.
     */
    function _updateBuyEmpyPreview() {
        var amountInput = document.getElementById('buy-empy-amount-usd');
        var previewEl   = document.getElementById('empy-to-receive-preview');
        if (!amountInput || !previewEl) return;
        var amountNgn = parseFloat(amountInput.value) || 0;
        if (amountNgn > 0) {
            var empyAmt = (amountNgn / _ngn()) / _rate();
            previewEl.textContent = 'You will receive: ' + Math.floor(empyAmt).toLocaleString() + ' EMPY';
        } else {
            previewEl.textContent = '';
        }
    }


    /* =========================================================================
       §8  FORM SUBMIT HANDLERS
       ========================================================================= */

    /**
     * Handle stake-form, unstake-form, withdrawal-form, buy-empy-form.
     * Delegated through a submit listener on document.
     */
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form) return;
        var formId = form.id;

        /* ── Stake ── */
        if (formId === 'stake-form') {
            e.preventDefault();
            if (_guest()) { _openAuth(); return; }
            var stakeInput = document.getElementById('stake-amount');
            if (!stakeInput) return;
            var amt = parseFloat(stakeInput.value);
            var us  = _us();
            if (!amt || amt <= 0) {
                _notify('Please enter a valid amount to stake.', 'error'); return;
            }
            if ((us.empyBalance || 0) < amt) {
                _notify('Insufficient EMPY balance for staking.', 'error'); return;
            }
            us.empyBalance -= amt;
            _set('userManualStakedBalance', _manualStk() + amt);
            _set('userStakedBalance', _manualStk() + _lockedStk());
            _notify(amt.toLocaleString() + ' EMPY staked successfully!', 'success');
            form.reset();
            updateWalletUI();
            return;
        }

        /* ── Unstake ── */
        if (formId === 'unstake-form') {
            e.preventDefault();
            if (_guest()) { _openAuth(); return; }
            var unstakeInput = document.getElementById('unstake-amount');
            if (!unstakeInput) return;
            var uAmt = parseFloat(unstakeInput.value);
            var us   = _us();
            if (!uAmt || uAmt <= 0) {
                _notify('Please enter a valid amount to unstake.', 'error'); return;
            }
            if (_manualStk() < uAmt) {
                _notify("You don't have enough manual staked EMPY to unstake.", 'error'); return;
            }
            us.empyBalance = (us.empyBalance || 0) + uAmt;
            _set('userManualStakedBalance', _manualStk() - uAmt);
            _set('userStakedBalance', _manualStk() + _lockedStk());
            var hist = _history();
            hist.push({ type: 'Manual Staking Unstaked', amount: uAmt, date: new Date().toLocaleDateString() });
            _set('userClaimedRewardsHistory', hist);
            _notify(uAmt.toLocaleString() + ' EMPY unstaked successfully!', 'success');
            form.reset();
            updateWalletUI();
            return;
        }

        /* ── Withdrawal ── */
        if (formId === 'withdrawal-form') {
            e.preventDefault();
            if (_guest()) { _openAuth(); return; }
            var wInput = document.getElementById('withdrawal-amount');
            if (!wInput) return;
            var wAmt = parseFloat(wInput.value);
            var us   = _us();
            if (!wAmt || wAmt < 5) {
                _notify('Minimum withdrawal is 5 EMPY.', 'error'); return;
            }
            if ((us.empyBalance || 0) < wAmt) {
                _notify('Insufficient EMPY balance for withdrawal.', 'error'); return;
            }
            us.empyBalance -= wAmt;

            /* Write to Firestore withdrawal_queue */
            if (window.fbDb && window._firebaseLoaded) {
                var method = (document.getElementById('withdrawal-method') || {}).value || '';
                window.fbDb.collection('withdrawal_queue').add({
                    userId:    us.id,
                    username:  us.username  || us.fullName || '',
                    email:     us.email     || '',
                    amountEmpy: wAmt,
                    method:    method,
                    status:    'pending',
                    createdAt: new Date().toISOString()
                }).catch(function () {});
            }

            _notify('Withdrawal request submitted for approval.', 'info');
            form.reset();
            handleWithdrawalMethodChange();
            updateWithdrawalPreview();
            updateWalletUI();
            return;
        }

        /* ── Buy EMPY (Flutterwave) ── */
        if (formId === 'buy-empy-form') {
            e.preventDefault();
            if (_guest()) { _openAuth(); return; }
            var buyInput = document.getElementById('buy-empy-amount-usd');
            if (!buyInput) return;
            var amountNgn = parseFloat(buyInput.value);
            if (isNaN(amountNgn) || amountNgn < 500) {
                _notify('Minimum purchase is ₦500.', 'error'); return;
            }
            var empyReceived = (amountNgn / _ngn()) / _rate();
            var us = _us();

            if (typeof FlutterwaveCheckout !== 'undefined') {
                FlutterwaveCheckout({
                    public_key: (window._appConfig && window._appConfig.flutterwave && window._appConfig.flutterwave.publicKey) || '',
                    tx_ref:     'EMPY-BUY-' + Date.now(),
                    amount:     amountNgn,
                    currency:   'NGN',
                    payment_options: 'card,banktransfer,ussd',
                    customer: {
                        email:        us.email     || 'user@empyrean.com',
                        phone_number: us.phone     || '',
                        name:         us.fullName  || 'Empyrean Member'
                    },
                    customizations: {
                        title:       'Buy EMPY Tokens',
                        description: 'Purchase ' + Math.floor(empyReceived).toLocaleString() + ' EMPY Tokens',
                        logo:        'https://cdn-icons-png.flaticon.com/512/6001/6001527.png'
                    },
                    callback: function (data) {
                        if (data.status === 'successful') {
                            us.empyBalance = (us.empyBalance || 0) + empyReceived;
                            updateWalletUI();
                            form.reset();
                            var modal = document.getElementById('buy-empy-modal');
                            if (modal) modal.classList.remove('show');
                            _notify('✅ ' + Math.floor(empyReceived).toLocaleString() + ' EMPY purchased successfully!', 'success');

                            /* Persist */
                            if (us.id && window.fbDb && window._firebaseLoaded) {
                                window.fbDb.collection('users').doc(us.id)
                                    .update({ empyBalance: us.empyBalance }).catch(function () {});
                            }
                        } else {
                            _notify('Payment was not completed. Please try again.', 'error');
                        }
                    },
                    onclose: function () {}
                });
            } else {
                _notify('Payment system not available. Please try again shortly.', 'error');
            }
            return;
        }
    });


    /* =========================================================================
       §9  CLAIM REWARD BUTTON
       ========================================================================= */

    /**
     * Wire the claim-reward-btn.  Uses event delegation + a one-time
     * addEventListener so it works even when the wallet section is rendered
     * after page load.
     */
    document.addEventListener('click', function (e) {
        var t = e.target;

        /* ── Claim rewards ── */
        if (t.id === 'claim-reward-btn' || t.closest('#claim-reward-btn')) {
            e.preventDefault();
            var earned = _earned();
            if (earned > 0) {
                var us = _us();
                us.empyBalance = (us.empyBalance || 0) + earned;
                var hist = _history();
                hist.push({ type: 'Claimed Rewards', amount: earned, date: new Date().toLocaleDateString() });
                _set('userClaimedRewardsHistory', hist);
                _set('userEarnedRewards', 0);
                _notify('Rewards claimed successfully!', 'success');
                updateWalletUI();

                /* Persist */
                if (us.id && window.fbDb && window._firebaseLoaded) {
                    window.fbDb.collection('users').doc(us.id)
                        .update({ empyBalance: us.empyBalance }).catch(function () {});
                }
            } else {
                _notify('No rewards to claim.', 'info');
            }
        }

        /* ── Open buy-empy modal ── */
        if (t.id === 'buy-empy-btn' || t.closest('#buy-empy-btn, #buy-empy-wallet-btn')) {
            var modal = document.getElementById('buy-empy-modal');
            if (modal) {
                modal.classList.add('show');
                document.body.classList.add('modal-open');
            }
        }
    });


    /* =========================================================================
       §10  WALLET PAYMENT-TAB SWITCHING
       ========================================================================= */

    document.addEventListener('click', function (e) {
        var tab = e.target.closest('.payment-tab');
        if (!tab) return;
        var targetId = tab.dataset.target;
        if (!targetId) return;

        var container = tab.closest('.payment-tabs');
        if (!container) return;

        container.querySelectorAll('.payment-tab').forEach(function (t) {
            t.classList.remove('active');
        });
        tab.classList.add('active');

        /* Show matching .payment-method-content panel */
        var form = tab.closest('form, .modal-card, .card-content');
        if (form) {
            form.querySelectorAll('.payment-method-content').forEach(function (p) {
                p.classList.remove('active');
                p.style.display = 'none';
            });
            var target = form.querySelector('#' + targetId);
            if (target) {
                target.classList.add('active');
                target.style.display = 'block';
            }
        }
    });


    /* =========================================================================
       §11  COPY WALLET ADDRESS
       ========================================================================= */

    document.addEventListener('click', function (e) {
        var copyBtn = e.target.closest('.copy-wallet-address-btn, #copy-wallet-address-btn');
        if (!copyBtn) return;
        e.preventDefault();
        var addrEl  = document.getElementById('user-wallet-address')
            || document.querySelector('.wallet-address-text');
        var address = (addrEl ? addrEl.textContent : '') || (copyBtn.dataset.address || '');
        if (!address.trim()) {
            _notify('No wallet address found.', 'warning'); return;
        }
        if (navigator.clipboard) {
            navigator.clipboard.writeText(address.trim()).then(function () {
                _notify('Wallet address copied!', 'success');
            }).catch(function () {
                _legacyCopy(address.trim());
            });
        } else {
            _legacyCopy(address.trim());
        }
    });

    function _legacyCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); _notify('Address copied!', 'success'); } catch (e) {}
        document.body.removeChild(ta);
    }


    /* =========================================================================
       §12  BOOTSTRAP — live input listeners + init-done hook
       ========================================================================= */

    /* Wire live preview inputs */
    document.addEventListener('input', function (e) {
        var id = e.target && e.target.id;
        if (!id) return;
        if (id === 'withdrawal-amount' || id === 'withdrawal-method') updateWithdrawalPreview();
        if (id === 'transfer-amount')                                  updateTransferPreview();
        if (id === 'cross-chain-amount' || id === 'cross-chain-network') updateCrossChainTransferPreview();
        if (id === 'buy-empy-amount-usd')                              _updateBuyEmpyPreview();
    });

    document.addEventListener('change', function (e) {
        if (e.target && e.target.id === 'withdrawal-method') handleWithdrawalMethodChange();
        if (e.target && e.target.id === 'cross-chain-network') updateCrossChainTransferPreview();
    });

    document.addEventListener('empyrean-init-done', function () {
        setTimeout(function () {
            updateWalletUI();
            updateStakingUI();
        }, 300);
    });


    /* ── Private utilities ── */
    function _notify(msg, type) {
        if (typeof window.showNotification === 'function') window.showNotification(msg, type);
    }
    function _openAuth() {
        if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
    }
    function _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }


    console.log('[EmpWallet] ✅ Wallet & staking module ready.');

})();