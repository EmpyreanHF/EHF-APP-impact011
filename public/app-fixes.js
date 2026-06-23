document.addEventListener('DOMContentLoaded', function() {
            // ── GLOBAL HELPERS (available to ALL event listeners in page) ──
            window.empyreanClosest=function(el,selector){if(!el||!selector)return null;return el.closest?el.closest(selector):null;};
            window._fmtCount=function(n){n=parseInt(n)||0;if(n>=1000000)return(n/1000000).toFixed(1).replace(/\.0$/,'')+'M';if(n>=1000)return(n/1000).toFixed(1).replace(/\.0$/,'')+'K';return n.toString();};
            window._timeAgo=function(ts){var d=ts?new Date(ts):new Date();var sec=Math.floor((Date.now()-d.getTime())/1000);if(isNaN(sec)||sec<0)return'just now';if(sec<60)return sec+'s';if(sec<3600)return Math.floor(sec/60)+'m';if(sec<86400)return Math.floor(sec/3600)+'h';if(sec<604800)return Math.floor(sec/86400)+'d';return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});};
            // ── uploadMediaFilesToCloudinary POLYFILL ─────────────────────────
            // Defined here so ALL upload paths (posts, profile, marketplace,
            // admin news) share one reliable implementation.
            // If an external script already defined it, this is a no-op.
            if (typeof window.uploadMediaFilesToCloudinary !== 'function') {
                window.uploadMediaFilesToCloudinary = async function(files) {
                    if (!files || files.length === 0) return [];
                    // Wait until uploadToCloudinary is available (may be loaded async)
                    var _waited = 0;
                    while (typeof window.uploadToCloudinary !== 'function' && _waited < 8000) {
                        await new Promise(function(r){ setTimeout(r, 200); });
                        _waited += 200;
                    }
                    if (typeof window.uploadToCloudinary !== 'function') {
                        console.error('[uploadMediaFilesToCloudinary] uploadToCloudinary not available after 8s');
                        return files.map(function(f){ return f._cloudUrl || (f instanceof File ? '' : (typeof f === 'string' ? f : '')); });
                    }
                    var results = await Promise.all(
                        Array.from(files).map(function(file) {
                            // Already uploaded -- skip
                            if (file._cloudUrl && !file._cloudUrl.startsWith('blob:')) return Promise.resolve(file._cloudUrl);
                            // Not a File -- pass string through
                            if (!(file instanceof File)) return Promise.resolve(typeof file === 'string' ? file : '');
                            return window.uploadToCloudinary(file, null)
                                .then(function(url) {
                                    if (url && !url.startsWith('blob:')) { file._cloudUrl = url; return url; }
                                    return '';
                                })
                                .catch(function(err) {
                                    console.warn('[uploadMediaFilesToCloudinary] file upload failed:', err && err.message);
                                    return '';
                                });
                        })
                    );
                    return results;
                };
                console.log('[Empyrean] uploadMediaFilesToCloudinary polyfill installed');
            }
            // Global error handler -- prevents one bug from blanking the page
            window.onerror = function(msg, src, line, col, err) {
                console.error('[Empyrean Error]', msg, 'at', src, line + ':' + col);
                // ── BLANK-SITE GUARD ────────────────────────────────────
                // If a critical section is missing from the DOM after a JS error,
                // attempt to reload once (never loops -- flag in sessionStorage).
                try {
                    var mainEl = document.getElementById('main-content') || document.getElementById('app');
                    if (mainEl && mainEl.children.length === 0) {
                        var _blankKey = 'empyrean_blank_recovery';
                        if (!sessionStorage.getItem(_blankKey)) {
                            sessionStorage.setItem(_blankKey, '1');
                            console.warn('[Empyrean] Blank screen detected -- reloading once...');
                            location.reload();
                        } else {
                            sessionStorage.removeItem(_blankKey);
                        }
                    }
                } catch(re) {}
                return false; // don't rethrow
            };
            window.addEventListener('unhandledrejection', function(e) {
                console.warn('[Empyrean Promise]', e.reason && (e.reason.message || e.reason));
            });
            // --- SMART CONTRACT CONFIGURATION ---
            const contractAddresses = {
                EmpyreanToken: "0x624ca3Db53adb41944EbF2BcB015f68C7BAB0c02",
                EmpyDistribution: "0xf48ee3c90c9183fb4acd0d9e1ef8b49accfc470e",
                NgoAndGrantRegistry: "0xc861e3ae9a35336c9735692d788065c4a0e37ebb",
                EmpyreanStaking: "0xba368a7b31f61748aef714ef779dd8086d38a1fc"
            };

            const contractABIs = {
                EmpyreanToken: [], // ABI omitted for brevity, assuming standard ERC20 interface
                EmpyDistribution: [{"inputs":[{"internalType":"address","name":"_empyTokenAddress","type":"address"},{"internalType":"address","name":"_initialOwner","type":"address"},{"internalType":"uint256","name":"_minimumWithdrawal","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newMinimum","type":"uint256"}],"name":"MinimumWithdrawalUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"RewardsClaimed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"RewardsRecorded","type":"event"},{"inputs":[],"name":"claimRewards","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"empyToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getClaimableBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"minimumWithdrawal","outputs":[{"internalType":"uint256","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"recordRewards","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"rewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalClaimed","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"newMinimum","type":"uint56"}],"name":"updateMinimumWithdrawal","outputs":[],"stateMutability":"nonpayable","type":"function"}],
                NgoAndGrantRegistry: [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"ngoAddress","type":"address"},{"indexed":false,"internalType":"string","name":"name","type":"string"}],"name":"NgoAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"ngoAddress","type":"address"}],"name":"NgoDelisted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"ngoAddress","type":"address"}],"name":"NgoUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"grantId","type":"uint256"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"string","name":"currency","type":"string"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"string","name":"projectId","type":"string"},{"indexed":false,"internalType":"string","name":"transactionReference","type":"string"}],"name":"OffChainGrantDisbursed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"grantId","type":"uint256"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"address","name":"tokenAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"string","name":"projectId","type":"string"}],"name":"OnChainGrantDisbursed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[{"internalType":"address","name":"_ngoAddress","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_detailsUrl","type":"string"}],"name":"addNgo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_ngoAddress","type":"address"}],"name":"delistNgo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getOffChainGrantCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getOnChainGrantCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getVerifiedNgoCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_offset","type":"uint256"},{"internalType":"uint256","name":"_limit","type":"uint256"}],"name":"getVerifiedNgos","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint56","name":"","type":"uint56"}],"name":"ngoAddressList","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"ngos","outputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"detailsUrl","type":"string"},{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"uint256","name":"listIndex","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint56","name":"","type":"uint56"}],"name":"offChainGrants","outputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"string","name":"currency","type":"string"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"string","name":"projectId","type":"string"},{"internalType":"string","name":"transactionReference","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint56","name":"","type":"uint56"}],"name":"onChainGrants","outputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"string","name":"projectId","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"},{"internalType":"string","name":"_currency","type":"string"},{"internalType":"string","name":"_projectId","type":"string"},{"internalType":"string","name":"_transactionReference","type":"string"}],"name":"recordOffChainGrant","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"address","name":"_tokenAddress","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"},{"internalType":"string","name":"_projectId","type":"string"}],"name":"recordOnChainGrant","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_ngoAddress","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_detailsUrl","type":"string"}],"name":"updateNgoDetails","outputs":[],"stateMutability":"nonpayable","type":"function"}],
                EmpyreanStaking: [{"inputs":[{"internalType":"address","name":"_empyTokenAddress","type":"address"},{"internalType":"address","name":"_rewardsDistributionAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"reward","type":"uint256"}],"name":"RewardPaid","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newRate","type":"uint256"}],"name":"RewardRateUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Unstaked","type":"event"},{"inputs":[],"name":"claimReward","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_account","type":"address"}],"name":"earned","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_newRate","type":"uint256"}],"name":"setRewardRate","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint56"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint56"}],"name":"unstake","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"empyToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastUpdateTime","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardPerToken","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardPerTokenStored","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardRate","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"rewards","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardsDistributionContract","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userRewardPerTokenPaid","outputs":[{"internalType":"uint256","name":""}],"stateMutability":"view","type":"function"}]
            };
            
            // --- STATE & CONFIG ---
            let provider, signer, contracts = {};
            let isGuest = true;
            let isAdmin = false;
            let cart = [];
            const EMPY_RATE_USD = 0.10;
            const USD_TO_NGN_RATE = 1500;
            const CRYPTO_FEE_PERCENT = 1.5;
            let userState = {};
            let captchaCode = '';
            let postMediaFiles = [], sosMediaFiles = [], crisisMediaFiles = [], businessPostMediaFiles = [];
            let marketplaceMediaFiles = [];
            let newsMediaFile = null;
            let newAvatarFile = null;
            let newCoverFile = null;
            let newPageProfileFile = null, newPageCoverFile = null;
            
            // ENHANCED LIVE STREAM DATA
            let liveStreamData = {
                isLive: false, 
                isRecording: false,
                title: '',
                description: '',
                startTime: null,
                streamId: null,
                background: 'linear-gradient(160deg,#0A0E27 0%,#1B2B8B 50%,#0A0E27 100%)',
                customBackgroundFile: null, 
                rewardInterval: null,
                isMicMuted: false,
                isVideoMuted: false,
                isScreenSharing: false,
                hostUserId: null,
                guests: [], 
                joinRequests: [], 
                liveGoal: null, 
                fanClubActive: false,
                activeGame: null, 
                pinnedMessage: null, 
                hostInSmallScreen: false, // Functionality removed, but property kept
                sentMessages: [] 
            };
            let liveLikeCount = 0;
            
            let registeredUsers = {};

            // Staking and Impact Mining Simulation State
            let userStakedBalance = 0; 
            let userManualStakedBalance = 0; 
            let userLockedStakedBalance = 0; 
            let userLockedStakingEndTime = 0; 
            let userEarnedRewards = 0; 
            let userClaimedRewardsHistory = []; 
            const STAKING_APY_ESTIMATE = 0.157; 
            const STAKING_LOCK_DURATION = 6 * 30 * 24 * 60 * 60 * 1000; 

            const IMPACT_MINING_TOTAL_POOL = 37500000; 
            const RANKING_REWARDS_POOL = IMPACT_MINING_TOTAL_POOL * 0.10; 
            let impactMiningState = {
                dailyBudget: (IMPACT_MINING_TOTAL_POOL * 0.90) / (12 * 365.25), 
                dailySpent: 0,
                rankingPoolSpent: 0,
                lastReset: new Date().setHours(0,0,0,0) 
            };

            const empyGiftCatalog = [
                { name: 'Rose', symbol: '🌹', price: 1 }, { name: 'Like', symbol: '👍', price: 2 }, { name: 'Heart', symbol: '❤️', price: 3 }, { name: 'Coffee', symbol: '☕', price: 5 }, { name: 'Star', symbol: '⭐', price: 7 }, { name: 'Chocolate', symbol: '🍫', price: 10 }, { name: 'Ice Cream', symbol: '🍦', price: 12 }, { name: 'Balloon', symbol: '🎈', price: 15 }, { name: 'Cupcake', symbol: '🧁', price: 18 }, { name: 'Candy', symbol: '🍬', price: 20 },
                { name: 'Teddy Bear', symbol: '🧸', price: 25 }, { name: 'Pizza Slice', symbol: '🍕', price: 30 }, { name: 'Popcorn', symbol: '🍿', price: 35 }, { name: 'Music Note', symbol: '🎵', price: 40 }, { name: 'Flower Bouquet', symbol: '💐', price: 50 }, { name: 'Football', symbol: '⚽', price: 60 }, { name: 'Sunglasses', symbol: '😎', price: 70 }, { name: 'Perfume', symbol: '💄', price: 80 }, { name: 'Cat', symbol: '🐱', price: 90 }, { name: 'Dog', symbol: '🐶', price: 100 },
                { name: 'Diamond Ring', symbol: '💍', price: 120 }, { name: 'Camera', symbol: '📷', price: 150 }, { name: 'Champagne', symbol: '🍾', price: 180 }, { name: 'Guitar', symbol: '🎸', price: 200 }, { name: 'Laptop', symbol: '💻', price: 250 }, { name: 'Gold Medal', symbol: '🥇', price: 300 }, { name: 'Airplane', symbol: '✈️', price: 350 }, { name: 'Luxury Watch', symbol: '⌚', price: 400 }, { name: 'Car', symbol: '🚗', price: 450 }, { name: 'Yacht', symbol: '🛥️', price: 500 },
                { name: 'Mansion', symbol: '🏠', price: 1000 }, { name: 'Helicopter', symbol: '🚁', price: 2000 }, { name: 'Private Jet', symbol: '🛫', price: 3500 }, { name: 'Crown', symbol: '👑', price: 5000 }, { name: 'Island', symbol: '🏝️', price: 7500 }, { name: 'Diamond Trophy', symbol: '🏆💎', price: 10000 },
                { name: 'Heart Mills', symbol: '💖', price: 200 } // Added Heart Mills
            ];
            let selectedGift = null; 

            // Premium live stream background cards -- each has label, style, category
            const liveBackgrounds = [
                // === CLASSIC GRADIENTS ===
                { label: 'Deep Space', style: 'linear-gradient(160deg,#0A0E27 0%,#1B2B8B 50%,#0A0E27 100%)', category: 'classic' },
                { label: 'Gold Rush', style: 'linear-gradient(135deg,#F5C518 0%,#F59E0B 50%,#B45309 100%)', category: 'classic' },
                { label: 'Emerald', style: 'linear-gradient(135deg,#00D4AA 0%,#10B981 50%,#047857 100%)', category: 'classic' },
                { label: 'Royal Night', style: 'linear-gradient(160deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%)', category: 'classic' },
                // === PREMIUM GRADIENTS ===
                { label: 'Aurora', style: 'linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f64f59 100%)', category: 'premium' },
                { label: 'Sunset', style: 'linear-gradient(135deg,#f093fb 0%,#f5576c 50%,#fda085 100%)', category: 'premium' },
                { label: 'Ocean Depth', style: 'linear-gradient(160deg,#0093E9 0%,#80D0C7 100%)', category: 'premium' },
                { label: 'Mango', style: 'linear-gradient(135deg,#f6d365 0%,#fda085 100%)', category: 'premium' },
                { label: 'Nebula', style: 'linear-gradient(135deg,#8E2DE2 0%,#4A00E0 50%,#2c1654 100%)', category: 'premium' },
                { label: 'Rose Gold', style: 'linear-gradient(135deg,#f8b4c8 0%,#e8a0b0 30%,#c97a8b 70%,#a05070 100%)', category: 'premium' },
                // === STUDIO STYLES ===
                { label: 'Midnight Studio', style: 'radial-gradient(ellipse at top,#1a1a2e 0%,#16213e 50%,#0f3460 100%)', category: 'studio' },
                { label: 'Soft White', style: 'linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%)', category: 'studio' },
                { label: 'Carbon Dark', style: 'linear-gradient(135deg,#1c1c1c 0%,#2d2d2d 50%,#1c1c1c 100%)', category: 'studio' },
                { label: 'Warm Cream', style: 'linear-gradient(135deg,#ffecd2 0%,#fcb69f 100%)', category: 'studio' },
                // === NATURE PHOTOS ===
                { label: 'Studio Lights', style: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=450&q=80', category: 'photo' },
                { label: 'City Night', style: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=450&q=80', category: 'photo' },
                { label: 'Forest', style: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=450&q=80', category: 'photo' },
                { label: 'Galaxy', style: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=450&q=80', category: 'photo' },
                { label: 'Library', style: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=450&q=80', category: 'photo' },
                { label: 'Abstract Art', style: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=450&q=80', category: 'photo' },
            ];
            
            // --- MOCK DATA ---
            let mockUsers = {};  // Populated from Firestore on login
            let mockAdminWithdrawalQueue = [];  // Populated from Firestore
            let mockAdminSosQueue = [];  // SOS requests pending admin approval
            window.mockAdminSosQueue = mockAdminSosQueue;

            const mockGrantLedger = [];  // Loaded from Firestore

            const mockCommunityTasks  = [
                { id: 'task-1', text: 'Follow on X (Twitter)', icon: 'fab fa-x-twitter', url: 'https://x.com/EmpyToken?t=1dXjQMtmz4y2ZSm_v7S52w&s=09', reward: 5 },
                { id: 'task-2', text: 'Follow on Instagram', icon: 'fab fa-instagram', url: 'https://www.instagram.com/empyreantoken_empy?igsh=MXBpcWl3Y3Jkc3ljag==', reward: 5 },
                { id: 'task-3', text: 'Subscribe on YouTube', icon: 'fab fa-youtube', url: 'https://www.youtube.com/@EmpyreanHFNewsTV', reward: 10 },
                { id: 'task-4', text: 'Connect on LinkedIn', icon: 'fab fa-linkedin', url: 'https://www.linkedin.com/company/108660039/admin/', reward: 8 },
                { id: 'task-5', text: 'Join our Telegram', icon: 'fab fa-telegram-plane', url: 'https://t.me/EmpyreanToken', reward: 10 },
                { id: 'task-6', text: 'Join our WhatsApp Channel', icon: 'fab fa-whatsapp', url: 'https://whatsapp.com/channel/0029VbAyfxaAzNc45vhje92j', reward: 10 }
            ];
            
            const mockNgoPartners = {};  // Loaded from Firestore
            
            // --- DOM REFERENCES ---
            const sidebar = document.querySelector('.sidebar') || document.createElement('div');
            const feedContainer = document.getElementById('feed-container') || document.createElement('div');
            const authModal = document.getElementById('auth-modal-overlay') || document.createElement('div');
            const goLiveModal = document.getElementById('go-live-modal-overlay') || document.createElement('div');
            const contentOverlay = document.getElementById('content-overlay') || document.createElement('div');
            const liveStreamScreen = document.getElementById('live-stream-screen'); 

            // --- HELPER FUNCTIONS ---
            const formatNgnPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(price);
            const formatUsdPrice = (price) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(price);
            
            function showNotification(message, type = 'success') {
                window.showNotification = showNotification; // expose for inline handlers
                const el = document.getElementById('reward-notification');
                if (!el) return;
                el.textContent = message;
                const colorMap = {
                    success: '#10B981',
                    error: '#EF4444',
                    warning: '#F59E0B',
                    info: '#1B2B8B'
                };
                el.style.backgroundColor = colorMap[type] || colorMap.success;
                el.style.color = '#ffffff';
                el.style.border = `2px solid rgba(255,255,255,0.3)`;
                el.classList.add('show');
                setTimeout(() => el.classList.remove('show'), 3500);
            }

            // Global upload progress bar helper
            function showUploadProgress(containerId, pct) {
                let cont = document.getElementById(containerId + '-progress');
                if (!cont) {
                    const parentEl = document.getElementById(containerId);
                    if (!parentEl) return;
                    cont = document.createElement('div');
                    cont.id = containerId + '-progress';
                    cont.className = 'upload-progress-container';
                    cont.innerHTML = '<div class="upload-progress-bar" style="width:0%;"></div>';
                    parentEl.appendChild(cont);
                }
                const bar = cont.querySelector('.upload-progress-bar');
                if (bar) { bar.style.width = pct + '%'; }
                if (pct >= 100) setTimeout(() => { if(cont) cont.remove(); }, 800);
            }

            function rewardUserForAction(action, targetUserId = null) {
                if (isGuest) return;

                const now = new Date().setHours(0,0,0,0);
                if(now > impactMiningState.lastReset) {
                    impactMiningState.dailySpent = 0;
                    impactMiningState.lastReset = now;
                }
                
                if (impactMiningState.dailySpent >= impactMiningState.dailyBudget) {
                    return; 
                }

                const rewardsTable = {
                    VERIFIED_CRISIS_REPORT: 50, VERIFIED_SOS_REQUEST: 25,
                    SUCCESSFUL_ESCROW_SELLER: 15, SUCCESSFUL_ESCROW_BUYER: 5,
                    CREATE_REEL: 2.0, CREATE_POST: 1.0, PUBLISH_NEWS: 10,
                    LIVE_STREAM_INTERVAL: 2.0, 
                    RECEIVE_COMMENT: 0.2, RECEIVE_LIKE: 0.1,
                    ENGAGE_COMMENT: 0.05, ENGAGE_LIKE: 0.02,
                    SUCCESSFUL_REFERRAL: 20,
                    SHARE_POST: 0.5,
                    RETWEET_POST: 0.5,
                    GUEST_JOINED_LIVE: 5,
                    HOST_INVITED_GUEST: 2,
                    SEND_GIFT: 0.1 
                };

                const rewardAmount = rewardsTable[action] || 0;
                if (rewardAmount === 0 || (impactMiningState.dailySpent + rewardAmount > impactMiningState.dailyBudget)) {
                    return;
                }
                
                let recipient = userState;
                if (targetUserId && mockUsers[targetUserId]) {
                    recipient = mockUsers[targetUserId];
                }

                if (!recipient.empyBalance) recipient.empyBalance = 0;
                
                if (action.startsWith('VERIFIED_') || action === 'CREATE_REEL' || action === 'CREATE_POST' || action === 'PUBLISH_NEWS' || action === 'LIVE_STREAM_INTERVAL' || action === 'RECEIVE_COMMENT' || action === 'RECEIVE_LIKE' || action === 'SUCCESSFUL_REFERRAL' || action === 'GUEST_JOINED_LIVE' || action === 'HOST_INVITED_GUEST') {
                    const lockedPortion = rewardAmount * 0.40;
                    const withdrawablePortion = rewardAmount * 0.60;
                    
                    if (recipient.id === userState.id) {
                        userLockedStakedBalance += lockedPortion;
                        userLockedStakingEndTime = Date.now() + STAKING_LOCK_DURATION; 
                        userState.empyBalance += withdrawablePortion;
                        
                        userClaimedRewardsHistory.push({
                            type: 'Earned (60% claimable)',
                            amount: withdrawablePortion,
                            date: new Date().toLocaleDateString()
                        });
                        userClaimedRewardsHistory.push({
                            type: 'Earned (40% locked)',
                            amount: lockedPortion,
                            date: new Date().toLocaleDateString(),
                            lockExpiry: new Date(userLockedStakingEndTime).toLocaleDateString()
                        });

                        showNotification(`+${withdrawablePortion.toFixed(2)} EMPY (60% claimable), ${lockedPortion.toFixed(2)} EMPY locked for 6 months!`, 'success');
                    } else {
                        recipient.empyBalance += rewardAmount;
                        showNotification(`+${rewardAmount.toFixed(2)} EMPY for their contribution!`, 'success'); 
                    }


                } else {
                    // Other rewards go directly to withdrawable balance
                    recipient.empyBalance += rewardAmount;
                    showNotification(`+${rewardAmount.toFixed(2)} EMPY for your contribution!`, 'success');
                }

                impactMiningState.dailySpent += rewardAmount;
                updateWalletUI();
                // Persist updated balance to Firestore in background
                if (!isGuest && userState.id && window.fbDb) {
                    window.fbDb.collection('users').doc(userState.id)
                        .update({ empyBalance: userState.empyBalance })
                        .catch(function() {}); // silent -- don't block UI
                }
            }

            
            function showFormFeedback(formId, message, type = 'error') {
                const feedbackEl = document.getElementById(`${formId}-feedback`);
                if (!feedbackEl) return;
                feedbackEl.textContent = message;
                feedbackEl.className = `form-feedback ${type}`;
                feedbackEl.style.display = 'block';
            }

            function generateCaptcha() {
                const captchaCodeEl = document.getElementById('captcha-code');
                if (!captchaCodeEl) return;
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                captchaCode = Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
                captchaCodeEl.textContent = captchaCode;
                const loginCaptchaInput = document.getElementById('login-captcha-input');
                if(loginCaptchaInput) loginCaptchaInput.value = '';
            }

            function formatWhatsAppText(text) {
    // SURGICAL FIX: also highlight @mentions and #hashtags
    if (typeof text !== 'string') return '';
    // Apply standard formatting first, then highlight tags
                if (!text) return '';
                // Escape HTML first
                let t = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                // Auto-linkify URLs (YouTube, WhatsApp, social, https, www)
                t = t.replace(/(https?:\/\/[^\s<>"'&]+|www\.[^\s<>"'&]+\.[a-z]{2,}[^\s<>"'&]*)/gi, function(url) {
                    const href = url.startsWith('http') ? url : 'https://' + url;
                    let icon = '<i class="fas fa-link"></i>';
                    if (href.includes('youtube.com') || href.includes('youtu.be')) icon = '<i class="fab fa-youtube"></i>';
                    else if (href.includes('whatsapp.com') || href.includes('wa.me')) icon = '<i class="fab fa-whatsapp"></i>';
                    else if (href.includes('twitter.com') || href.includes('x.com')) icon = '<i class="fab fa-twitter"></i>';
                    else if (href.includes('instagram.com')) icon = '<i class="fab fa-instagram"></i>';
                    else if (href.includes('linkedin.com')) icon = '<i class="fab fa-linkedin"></i>';
                    else if (href.includes('facebook.com') || href.includes('fb.com')) icon = '<i class="fab fa-facebook"></i>';
                    const label = url.length > 45 ? url.substring(0,45) + '…' : url;
                    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" style="color:var(--secondary);text-decoration:underline;font-weight:500;">' + icon + ' ' + label + '</a>';
                });
                // WhatsApp-style formatting
                t = t
                    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                    .replace(/_(.*?)_/g, '<em>$1</em>')
                    .replace(/~(.*?)~/g, '<s>$1</s>')
                    .replace(/`(.*?)`/g, '<code style="background:rgba(10,14,39,0.08);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.88em;">$1</code>')
                    .replace(/\n/g, '<br>');
                // @mention highlighting -- clickable, navigates to user profile
                t = t.replace(/@([a-zA-Z0-9_\.]+)/g, function(match, username) {
                    return '<a href="#" class="mention-tag" data-username="' + username + '" '
                        + 'style="color:var(--secondary);font-weight:700;text-decoration:none;'
                        + 'background:rgba(27,43,139,0.09);border-radius:4px;padding:1px 4px;">'
                        + '@' + username + '</a>';
                });
                // #hashtag highlighting
                t = t.replace(/#([a-zA-Z0-9_]+)/g, function(match, tag) {
                    return '<a href="#" class="hashtag-tag" data-tag="' + tag + '" '
                        + 'style="color:var(--accent-color);font-weight:700;text-decoration:none;'
                        + 'background:rgba(245,197,24,0.12);border-radius:4px;padding:1px 4px;">'
                        + '#' + tag + '</a>';
                });
                return t;
            }

            // ── @MENTION & #HASHTAG AUTOCOMPLETE SYSTEM ─────────────────────────
            // Attaches to any textarea/contenteditable with class 'mention-aware'
            // or explicitly to the quick-post-text and post-form-text inputs.
            // ── GLOBAL BLANK-SCREEN RECOVERY (error + unhandledrejection) ──
            (function _blankScreenGuard() {
                function _checkAndRecover() {
                    try {
                        var sections = document.querySelectorAll('.content-section');
                        var anyVisible = Array.from(sections).some(function(s) {
                            return s.style.display !== 'none' && s.offsetParent !== null;
                        });
                        if (!anyVisible) {
                            var dash = document.getElementById('dashboard');
                            if (dash) { dash.style.display = 'block'; console.warn('[Empyrean] Blank screen recovered → dashboard'); }
                        }
                    } catch(_) {}
                }
                window.addEventListener('error', function() { setTimeout(_checkAndRecover, 1200); }, true);
                window.addEventListener('unhandledrejection', function() { setTimeout(_checkAndRecover, 1200); });
                // Periodic safety net: check every 5s for first 60s
                var _safetyCount = 0;
                var _safetyInt = setInterval(function() {
                    if (++_safetyCount > 12) { clearInterval(_safetyInt); return; }
                    if (document.body && document.body.children.length > 2) _checkAndRecover();
                }, 5000);
            })();

            // ── INJECT READ-MORE / ARTICLE COLLAPSE CSS ─────────────
            (function _injectArticleCollapseCSS() {
                if (document.getElementById('_article_collapse_css')) return;
                var s = document.createElement('style');
                s.id = '_article_collapse_css';
                s.textContent = [
                    '.story-content { position: relative; }',
                    '.news-item-content { position: relative; }',
                    '.post-text-rest { display: none; }',
                    '.post-read-more, .post-read-less {',
                    '  display: inline-block; margin-top: 6px;',
                    '  font-size: 0.83rem; font-weight: 700;',
                    '  color: var(--secondary, #1B2B8B);',
                    '  cursor: pointer; text-decoration: none;',
                    '  border: none; background: none; padding: 0;',
                    '  transition: opacity 0.15s;',
                    '}',
                    '.post-read-more:hover, .post-read-less:hover { opacity: 0.7; }',
                    '.post-text-overflow { color: inherit; display: inline; }',
                    /* Suggested-for-you card -- profile-header style */
                    '.suggested-user-card {',
                    '  background: white;',
                    '  border-radius: 14px;',
                    '  overflow: hidden;',
                    '  border: 1.5px solid rgba(10,14,39,0.08);',
                    '  box-shadow: 0 2px 12px rgba(10,14,39,0.07);',
                    '  display: flex;',
                    '  flex-direction: column;',
                    '  cursor: pointer;',
                    '  transition: box-shadow 0.18s, transform 0.18s;',
                    '  min-width: 240px;',
                    '  max-width: 280px;',
                    '  flex-shrink: 0;',
                    '}',
                    '.suggested-user-card:hover { box-shadow: 0 6px 24px rgba(27,43,139,0.14); transform: translateY(-2px); }',
                ].join('\n');
                document.head.appendChild(s);
            })();

            (function _initMentionSystem() {
                // Build/refresh user list from Firestore 'users' collection
                window._mentionUserList = window._mentionUserList || [];
                if (typeof fbDb !== 'undefined') {
                    fbDb.collection('users').orderBy('username').limit(200).get()
                        .then(function(snap) {
                            window._mentionUserList = snap.docs.map(function(d) {
                                return { username: d.data().username || '', fullName: d.data().fullName || '', avatar: d.data().avatar || '' };
                            }).filter(function(u) { return u.username; });
                        }).catch(function() {});
                }

                function _getDropdown() {
                    var el = document.getElementById('_mention_dropdown');
                    if (!el) {
                        el = document.createElement('div');
                        el.id = '_mention_dropdown';
                        el.style.cssText = [
                            'position:fixed','z-index:99999','background:white',
                            'border:1.5px solid rgba(27,43,139,0.18)','border-radius:12px',
                            'box-shadow:0 8px 32px rgba(10,14,39,0.18)','max-height:220px',
                            'overflow-y:auto','display:none','min-width:200px','padding:6px 0'
                        ].join(';');
                        document.body.appendChild(el);
                    }
                    return el;
                }

                function _hideDropdown() {
                    var d = document.getElementById('_mention_dropdown');
                    if (d) d.style.display = 'none';
                    window._mentionActiveInput = null;
                    window._mentionTriggerChar = null;
                }

                function _showSuggestions(input, query, triggerChar, rect) {
                    var dropdown = _getDropdown();
                    var list = triggerChar === '@' ? window._mentionUserList : [];
                    var filtered = [];
                    if (triggerChar === '@') {
                        filtered = list.filter(function(u) {
                            return u.username.toLowerCase().startsWith(query.toLowerCase()) ||
                                   u.fullName.toLowerCase().includes(query.toLowerCase());
                        }).slice(0, 8);
                    }
                    if (!filtered.length) { _hideDropdown(); return; }

                    dropdown.innerHTML = filtered.map(function(u) {
                        return '<div class="_mention_item" data-username="' + u.username + '" style="'
                            + 'display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;'
                            + 'border-radius:8px;transition:background 0.15s;"'
                            + ' onmouseover="this.style.background=\'rgba(27,43,139,0.07)\'"'
                            + ' onmouseout="this.style.background=\'\'">'
                            + '<img src="' + (u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.username) + '&background=1B2B8B&color=fff&size=40') + '"'
                            + ' style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src=\'https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=40\'">'
                            + '<div><div style="font-weight:700;font-size:0.88rem;color:var(--primary);">@' + u.username + '</div>'
                            + '<div style="font-size:0.76rem;color:#888;">' + u.fullName + '</div></div></div>';
                    }).join('');

                    // Position dropdown at computed location
                    dropdown.style.left = rect.left + 'px';
                    dropdown.style.top = rect.bottom + 'px';
                    dropdown.style.display = 'block';
                    window._mentionActiveInput = input;
                    window._mentionTriggerChar = triggerChar;
                    window._mentionQuery = query;

                    // Click handler for each item
                    dropdown.querySelectorAll('._mention_item').forEach(function(item) {
                        item.addEventListener('mousedown', function(e) {
                            e.preventDefault();
                            var chosen = item.dataset.username;
                            var val = input.value;
                            var pos = input.selectionStart;
                            // Find where the @query starts
                            var before = val.substring(0, pos);
                            var trigIdx = before.lastIndexOf(triggerChar);
                            var newVal = val.substring(0, trigIdx) + triggerChar + chosen + ' ' + val.substring(pos);
                            input.value = newVal;
                            input.selectionStart = input.selectionEnd = trigIdx + chosen.length + 2;
                            input.focus();
                            _hideDropdown();
                            // Dispatch input event so any listeners update
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        });
                    });
                }

                function _onInput(e) {
                    var input = e.target;
                    if (!input || input.tagName !== 'TEXTAREA') return;
                    var val = input.value;
                    var pos = input.selectionStart;
                    var before = val.substring(0, pos);
                    // Detect @word being typed -- allow at start or after any whitespace/newline
                    var atMatch = before.match(/(?:^|[\s\n])@([a-zA-Z0-9_\.]*)$/);
                    if (atMatch) {
                        var query = atMatch[1];
                        // Position dropdown just below the textarea
                        var coords = input.getBoundingClientRect();
                        var dropLeft = Math.min(coords.left + 16, window.innerWidth - 220);
                        var dropBottom = coords.bottom + 4;
                        // If there isn't room below, put it above
                        if (dropBottom + 220 > window.innerHeight) {
                            dropBottom = Math.max(coords.top - 224, 4);
                        }
                        _showSuggestions(input, query, '@', { left: dropLeft, bottom: dropBottom });
                    } else {
                        _hideDropdown();
                    }
                }

                function _onKeyDown(e) {
                    var dropdown = document.getElementById('_mention_dropdown');
                    if (!dropdown || dropdown.style.display === 'none') return;
                    if (e.key === 'Escape') { _hideDropdown(); }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        var items = Array.from(dropdown.querySelectorAll('._mention_item'));
                        var cur = items.findIndex(function(i) { return i.classList.contains('_active'); });
                        items.forEach(function(i) { i.classList.remove('_active'); i.style.background = ''; });
                        var next = e.key === 'ArrowDown' ? cur + 1 : cur - 1;
                        next = Math.max(0, Math.min(next, items.length - 1));
                        if (items[next]) { items[next].classList.add('_active'); items[next].style.background = 'rgba(27,43,139,0.07)'; }
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                        var activeItem = dropdown.querySelector('._mention_item._active') || dropdown.querySelector('._mention_item');
                        if (activeItem && window._mentionActiveInput) {
                            activeItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                            e.preventDefault();
                        }
                    }
                }

                // Attach to document -- works for all textareas including dynamically added ones
                document.addEventListener('input', _onInput, true);
                document.addEventListener('keydown', _onKeyDown, true);
                document.addEventListener('click', function(e) {
                    if (!e.target.closest('#_mention_dropdown') && !e.target.matches('textarea')) {
                        _hideDropdown();
                    }
                }, true);

                // ── READ MORE / SHOW LESS for long posts ─────────────
                document.addEventListener('click', function(e) {
                    var rmLink = e.target.closest('.post-read-more');
                    if (rmLink) {
                        e.preventDefault();
                        e.stopPropagation();
                        var sc = rmLink.closest('.story-content, .news-item-content');
                        if (!sc) return;
                        var overflow = sc.querySelector('.post-text-overflow');
                        var rest = sc.querySelector('.post-text-rest');
                        if (overflow) overflow.style.display = 'none';
                        if (rest) rest.style.display = 'inline';
                        rmLink.style.display = 'none';
                        var rl = sc.querySelector('.post-read-less');
                        if (rl) rl.style.display = 'inline-block';
                        return;
                    }
                    var rlLink = e.target.closest('.post-read-less');
                    if (rlLink) {
                        e.preventDefault();
                        e.stopPropagation();
                        var sc2 = rlLink.closest('.story-content, .news-item-content');
                        if (!sc2) return;
                        var overflow2 = sc2.querySelector('.post-text-overflow');
                        var rest2 = sc2.querySelector('.post-text-rest');
                        if (overflow2) overflow2.style.display = 'inline';
                        if (rest2) rest2.style.display = 'none';
                        rlLink.style.display = 'none';
                        var rm2 = sc2.querySelector('.post-read-more');
                        if (rm2) rm2.style.display = 'inline-block';
                        return;
                    }
                });

                // ── Apply read-more to news-list-item content (injected dynamically) ──
                var _newsReadMoreObserver = new MutationObserver(function(mutations) {
                    mutations.forEach(function(m) {
                        m.addedNodes.forEach(function(node) {
                            if (!node || node.nodeType !== 1) return;
                            var targets = [];
                            if (node.classList && node.classList.contains('news-list-item')) targets.push(node);
                            node.querySelectorAll && node.querySelectorAll('.news-list-item').forEach(function(n){ targets.push(n); });
                            targets.forEach(function(ni) {
                                var p = ni.querySelector('.news-item-content p');
                                if (!p || p.dataset.rmDone) return;
                                p.dataset.rmDone = '1';
                                var full = p.innerHTML;
                                var plain = p.textContent || '';
                                if (plain.length <= 280) return;
                                // Truncate at 280 visible chars
                                var _cutIdx = 0, _cnt = 0, _inTag = false;
                                for (var _ci = 0; _ci < full.length && _cnt < 280; _ci++) {
                                    if (full[_ci] === '<') _inTag = true;
                                    if (!_inTag) _cnt++;
                                    if (full[_ci] === '>') _inTag = false;
                                    _cutIdx = _ci;
                                }
                                var preview = full.substring(0, _cutIdx + 1);
                                var rest = full.substring(_cutIdx + 1);
                                p.innerHTML = preview
                                    + '<span class="post-text-overflow">…</span>'
                                    + '<span class="post-text-rest" style="display:none;">' + rest + '</span>'
                                    + '<br><a href="#" class="post-read-more" style="font-size:0.82rem;font-weight:700;color:var(--secondary);text-decoration:none;display:inline-block;margin-top:4px;">Read more ▼</a>'
                                    + '<a href="#" class="post-read-less" style="font-size:0.82rem;font-weight:700;color:var(--secondary);text-decoration:none;display:none;margin-top:4px;">Show less ▲</a>';
                            });
                        });
                    });
                });
                _newsReadMoreObserver.observe(document.body, { childList: true, subtree: true });

                // Handle click on @mention tags -- show real mini profile popup
                document.addEventListener('click', function(e) {
                    var mentionLink = e.target.closest('.mention-tag');
                    if (mentionLink) {
                        e.preventDefault();
                        var uname = mentionLink.dataset.username;
                        if (!uname) return;
                        // Remove any existing mention popup
                        var old = document.getElementById('_mention_profile_popup');
                        if (old) old.remove();
                        // Look up user from mentionUserList or mockUsers
                        var _u = null;
                        if (window._mentionUserList) {
                            _u = window._mentionUserList.find(function(u) { return u.username === uname; });
                        }
                        if (!_u && window.mockUsers) {
                            var _mu = Object.values(window.mockUsers).find(function(u) { return u.username === uname; });
                            if (_mu) _u = _mu;
                        }
                        var popup = document.createElement('div');
                        popup.id = '_mention_profile_popup';
                        popup.style.cssText = 'position:fixed;z-index:99999;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(10,14,39,0.2);padding:16px;min-width:240px;max-width:280px;border:1.5px solid rgba(10,14,39,0.08);';
                        var _av = (_u && (_u.avatar || _u.profilePhoto)) || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(uname) + '&background=1B2B8B&color=fff&size=60');
                        var _fn = (_u && (_u.fullName || _u.name)) || uname;
                        var _bio = (_u && _u.bio) || '';
                        var _followers = (_u && _u.followersCount) || 0;
                        popup.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
                            + '<img src="' + _av + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid var(--secondary);" onerror="this.src=this.dataset.fb" data-fb="https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=60">'
                            + '<div><div style="font-weight:700;font-size:0.92rem;color:var(--primary);">' + _fn + '</div>'
                            + '<div style="font-size:0.78rem;color:#888;">@' + uname + '</div></div></div>'
                            + (_bio ? '<div style="font-size:0.82rem;color:#555;margin-bottom:8px;">' + _bio + '</div>' : '')
                            + '<div style="font-size:0.78rem;color:#888;margin-bottom:10px;">' + _followers + ' followers</div>'
                            + '<div style="display:flex;gap:8px;">'
                            + '<button class="_mention_view_profile" data-uname="' + uname + '" style="flex:1;padding:8px;background:var(--primary);color:white;border:none;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;">View Profile</button>'
                            + '<button class="_mention_popup_close" style="padding:8px 12px;background:rgba(10,14,39,0.07);color:var(--primary);border:none;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;"><i class="fas fa-times"></i></button>'
                            + '</div>';
                        // Position near click
                        var rect = mentionLink.getBoundingClientRect();
                        var top = rect.bottom + 8;
                        var left = Math.min(rect.left, window.innerWidth - 300);
                        if (top + 180 > window.innerHeight) top = rect.top - 190;
                        popup.style.top = top + 'px';
                        popup.style.left = left + 'px';
                        document.body.appendChild(popup);
                        popup.querySelector('._mention_popup_close').addEventListener('click', function() { popup.remove(); });
                        popup.querySelector('._mention_view_profile').addEventListener('click', function() {
                            popup.remove();
                            // Find user id from mockUsers
                            var _uid = null;
                            if (window.mockUsers) {
                                var found = Object.entries(window.mockUsers).find(function(kv) { return kv[1].username === uname; });
                                if (found) _uid = found[0];
                            }
                            if (_uid && typeof renderUserProfile === 'function') {
                                renderUserProfile(_uid);
                                if (typeof navigateTo === 'function') navigateTo('profile');
                            } else {
                                if (typeof navigateTo === 'function') navigateTo('profile');
                                if (typeof showNotification === 'function') showNotification('@' + uname + ' profile', 'info');
                            }
                        });
                        // Close on outside click
                        setTimeout(function() {
                            document.addEventListener('click', function _closePopup(ev) {
                                if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener('click', _closePopup); }
                            });
                        }, 100);
                        return;
                    }
                    // Handle click on #hashtag tags -- boost trending + filter feed
                    var hashLink = e.target.closest('.hashtag-tag');
                    if (hashLink) {
                        e.preventDefault();
                        var tag = hashLink.dataset.tag;
                        if (!tag) return;
                        // Boost this tag's trending score on every click
                        if (typeof window._incrementTag === 'function') window._incrementTag(tag);
                        // Remove existing hashtag popup
                        var oldHp = document.getElementById('_hashtag_popup');
                        if (oldHp) oldHp.remove();
                        // Gather matching posts from feed
                        var _matchPosts = [];
                        document.querySelectorAll('.impact-story, .news-list-item').forEach(function(el) {
                            var txt = (el.querySelector('.story-content, .news-item-content')?.textContent || '').toLowerCase();
                            if (txt.includes('#' + tag.toLowerCase())) _matchPosts.push(el);
                        });
                        var hp = document.createElement('div');
                        hp.id = '_hashtag_popup';
                        hp.style.cssText = 'position:fixed;z-index:99999;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(10,14,39,0.2);padding:16px;min-width:240px;max-width:300px;border:1.5px solid rgba(10,14,39,0.08);max-height:320px;overflow-y:auto;';
                        var rect2 = hashLink.getBoundingClientRect();
                        var top2 = rect2.bottom + 8;
                        var left2 = Math.min(rect2.left, window.innerWidth - 320);
                        if (top2 + 200 > window.innerHeight) top2 = rect2.top - 210;
                        hp.style.top = top2 + 'px';
                        hp.style.left = left2 + 'px';
                        hp.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
                            + '<strong style="font-size:0.95rem;color:var(--primary);">#' + tag + '</strong>'
                            + '<button id="_ht_close" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:#888;">✕</button></div>'
                            + '<div style="font-size:0.82rem;color:#888;margin-bottom:10px;">' + _matchPosts.length + ' post' + (_matchPosts.length !== 1 ? 's' : '') + ' with this tag</div>'
                            + '<button id="_ht_filter" style="width:100%;padding:9px;background:var(--accent-color);color:var(--primary);border:none;border-radius:8px;font-size:0.84rem;font-weight:700;cursor:pointer;margin-bottom:4px;">'
                            + '<i class="fas fa-filter"></i> Filter feed by #' + tag + '</button>';
                        document.body.appendChild(hp);
                        document.getElementById('_ht_close').addEventListener('click', function() { hp.remove(); });
                        document.getElementById('_ht_filter').addEventListener('click', function() {
                            hp.remove();
                            // Highlight/scroll to first matching post
                            if (_matchPosts.length > 0) {
                                _matchPosts.forEach(function(p, i) {
                                    p.style.outline = i === 0 ? '2px solid var(--accent-color)' : '';
                                    p.style.borderRadius = '12px';
                                });
                                _matchPosts[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(function() { _matchPosts.forEach(function(p) { p.style.outline = ''; }); }, 3000);
                                if (typeof showNotification === 'function') showNotification('Showing ' + _matchPosts.length + ' post(s) tagged #' + tag, 'info');
                            } else {
                                if (typeof showNotification === 'function') showNotification('No posts found with #' + tag, 'info');
                            }
                        });
                        setTimeout(function() {
                            document.addEventListener('click', function _closeHp(ev) {
                                if (!hp.contains(ev.target)) { hp.remove(); document.removeEventListener('click', _closeHp); }
                            });
                        }, 100);
                    }
                });


                console.log('[Mentions] @mention & #hashtag system initialised');
            })();

            // ═══════════════════════════════════════════════════════════
            // TAG ENGINE: @mention notifications + #hashtag trending
            // ═══════════════════════════════════════════════════════════
            (function _initTagEngine() {
                // ── In-memory trending store (backed by Firestore when available) ──
                window._trendingTags = window._trendingTags || {};

                // Load existing trending from Firestore once
                function _loadTrending() {
                    if (typeof fbDb === 'undefined' || !fbDb) return;
                    fbDb.collection('trending_tags').orderBy('score', 'desc').limit(20)
                        .get().then(function(snap) {
                            snap.forEach(function(doc) {
                                window._trendingTags[doc.id] = doc.data().score || 0;
                            });
                            _renderTrendingWidget();
                        }).catch(function(){});
                }
                setTimeout(_loadTrending, 1200);

                // ── Increment trend score for a hashtag ──
                function _incrementTag(tag) {
                    if (!tag) return;
                    var t = tag.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    if (!t) return;
                    window._trendingTags[t] = (window._trendingTags[t] || 0) + 1;
                    // Persist to Firestore
                    try {
                        if (typeof fbDb !== 'undefined' && fbDb) {
                            fbDb.collection('trending_tags').doc(t).set({
                                tag: t, score: window._trendingTags[t], lastUsed: new Date().toISOString()
                            }, { merge: true }).catch(function(){});
                        }
                    } catch(e) {}
                    _renderTrendingWidget();
                }
                window._incrementTag = _incrementTag;

                // ── Send in-app notification to a mentioned user ──
                function _notifyMentionedUser(mentionedUsername, postText, posterName) {
                    if (typeof fbDb === 'undefined' || !fbDb) return;
                    // Find user doc by username
                    fbDb.collection('users').where('username', '==', mentionedUsername).limit(1)
                        .get().then(function(snap) {
                            if (snap.empty) return;
                            var targetDoc = snap.docs[0];
                            var notifRef = fbDb.collection('notifications').doc();
                            notifRef.set({
                                id: notifRef.id,
                                type: 'mention',
                                toUserId: targetDoc.id,
                                fromUserId: (typeof userState !== 'undefined' && userState) ? userState.id : 'unknown',
                                fromName: posterName || 'Someone',
                                message: (posterName || 'Someone') + ' mentioned you in a post',
                                preview: (postText || '').substring(0, 80),
                                read: false,
                                createdAt: new Date().toISOString()
                            }).catch(function(){});
                            // If target is current user → show immediate push notification
                            if (typeof userState !== 'undefined' && userState && targetDoc.id === userState.id) {
                                if (typeof window.pushNotification === 'function') {
                                    window.pushNotification('📣 You were mentioned by @' + (posterName || 'someone'), 'info');
                                }
                            }
                        }).catch(function(){});
                }
                window._notifyMentionedUser = _notifyMentionedUser;

                // ── Process tags from any post text ──
                // Called by post submit handlers after text is ready
                window._processPostTags = function(text, posterName) {
                    if (!text) return;
                    // Extract @mentions
                    var mentions = text.match(/(?:^|[\s\n])@([a-zA-Z0-9_\.]+)/g) || [];
                    mentions.forEach(function(m) {
                        var uname = m.trim().replace('@', '');
                        if (uname) _notifyMentionedUser(uname, text, posterName);
                    });
                    // Extract #hashtags and boost trending
                    var tags = text.match(/(?:^|[\s\n])#([a-zA-Z0-9_]+)/g) || [];
                    tags.forEach(function(t) {
                        var tag = t.trim().replace('#', '');
                        if (tag) _incrementTag(tag);
                    });
                };

                // ── Render the trending widget in the sidebar/dashboard ──
                function _renderTrendingWidget() {
                    var container = document.getElementById('_trending_widget_list');
                    if (!container) return;
                    var sorted = Object.entries(window._trendingTags)
                        .sort(function(a, b) { return b[1] - a[1]; })
                        .slice(0, 8);
                    if (sorted.length === 0) {
                        container.innerHTML = '<p style="font-size:0.8rem;color:#888;padding:8px 0;">No trending tags yet.</p>';
                        return;
                    }
                    container.innerHTML = sorted.map(function(entry, i) {
                        var tag = entry[0], score = entry[1];
                        return '<div class="_trend_item" data-tag="' + tag + '" style="'
                            + 'display:flex;align-items:center;justify-content:space-between;'
                            + 'padding:8px 0;border-bottom:1px solid rgba(10,14,39,0.06);cursor:pointer;">'
                            + '<div>'
                            + '<span style="font-size:0.72rem;color:#aaa;">' + (i+1) + ' · Trending</span><br>'
                            + '<strong style="font-size:0.9rem;color:var(--primary);">#' + tag + '</strong>'
                            + '</div>'
                            + '<span style="font-size:0.75rem;color:#888;background:rgba(27,43,139,0.08);padding:2px 8px;border-radius:20px;">'
                            + score + ' post' + (score !== 1 ? 's' : '') + '</span>'
                            + '</div>';
                    }).join('');
                    // Click a trending tag → filter feed
                    container.querySelectorAll('._trend_item').forEach(function(el) {
                        el.addEventListener('click', function() {
                            var tag = el.dataset.tag;
                            _incrementTag(tag); // each click boosts it slightly
                            // Simulate hashtag-tag click to filter the feed
                            document.querySelectorAll('.hashtag-tag').forEach(function(ht) {
                                if (ht.dataset.tag && ht.dataset.tag.toLowerCase() === tag) {
                                    ht.click(); return;
                                }
                            });
                            // Scroll to first matching post
                            var matched = Array.from(document.querySelectorAll('.story-content, .news-item-content'))
                                .filter(function(el) { return el.textContent.toLowerCase().includes('#' + tag); });
                            if (matched.length > 0) {
                                matched[0].closest('.impact-story, .news-list-item, article') ?
                                    matched[0].closest('.impact-story, .news-list-item, article').scrollIntoView({ behavior: 'smooth', block: 'center' }) :
                                    matched[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                if (typeof showNotification === 'function') showNotification('#' + tag + ' -- ' + matched.length + ' matching post(s)', 'info');
                            } else {
                                if (typeof showNotification === 'function') showNotification('#' + tag + ' -- No posts found yet', 'info');
                            }
                        });
                    });
                }
                window._renderTrendingWidget = _renderTrendingWidget;

                // ── Inject trending widget into the dashboard sidebar ──
                // Will auto-place itself in #right-sidebar or after the suggested-users section
                function _injectTrendingWidget() {
                    if (document.getElementById('_trending_widget')) return;
                    var widget = document.createElement('div');
                    widget.id = '_trending_widget';
                    widget.style.cssText = 'background:white;border-radius:20px;padding:16px;margin-bottom:16px;box-shadow:0 2px 16px rgba(10,14,39,0.07);border:1px solid rgba(10,14,39,0.07);';
                    widget.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">'
                        + '<i class="fas fa-fire" style="font-size:1.1rem;color:#EF4444;"></i>'
                        + '<strong style="font-size:0.92rem;color:var(--primary);">Trending</strong>'
                        + '</div>'
                        + '<div id="_trending_widget_list"></div>';
                    // Try to place in right sidebar first, then suggested users container
                    var sidebar = document.getElementById('right-sidebar')
                        || document.getElementById('suggested-users-container')?.parentElement
                        || document.querySelector('.sidebar-right, .right-col, [class*="right-sidebar"]');
                    if (sidebar) {
                        sidebar.insertBefore(widget, sidebar.firstChild);
                    } else {
                        // Append to dashboard as fallback
                        var dash = document.getElementById('dashboard');
                        if (dash) dash.appendChild(widget);
                    }
                    _renderTrendingWidget();
                }
                // Defer so DOM is ready
                setTimeout(_injectTrendingWidget, 800);
                // Re-inject on section change
                document.addEventListener('empyrean:sectionchange', function() {
                    setTimeout(function() { _injectTrendingWidget(); _renderTrendingWidget(); }, 300);
                });

                // ── Real-time trending listener from Firestore ──
                function _startTrendingListener() {
                    if (typeof fbDb === 'undefined' || !fbDb || window._trendingListener) return;
                    window._trendingListener = fbDb.collection('trending_tags')
                        .orderBy('score', 'desc').limit(20)
                        .onSnapshot(function(snap) {
                            snap.forEach(function(doc) {
                                window._trendingTags[doc.id] = doc.data().score || 0;
                            });
                            _renderTrendingWidget();
                        }, function(err) { console.warn('[Trending] listener error:', err); });
                }
                setTimeout(_startTrendingListener, 2000);

                console.log('[TagEngine] @mention notifications + #hashtag trending initialised');
            })();


                        function handleYoutubeEmbed(text) {
                const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu.be\/)([a-zA-Z0-9_-]{11})/;
                const match = text.match(youtubeRegex);
                if (match && match[1]) {
                    const videoId = match[1];
                    const embedHTML = `<div class="story-youtube-embed"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
                    return { html: text.replace(youtubeRegex, embedHTML), found: true };
                }
                return { html: `<p>${formatWhatsAppText(text)}</p>`, found: false };
            }

            function resizeAndCropImage(file, width, height, callback) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = width;
                        canvas.height = height;

                        let sourceX, sourceY, sourceWidth, sourceHeight;
                        const imgRatio = img.width / img.height;
                        const targetRatio = width / height;

                        if (imgRatio > targetRatio) {
                            sourceHeight = img.height;
                            sourceWidth = sourceHeight * targetRatio;
                            sourceX = (img.width - sourceWidth) / 2;
                            sourceY = 0;
                        } else {
                            sourceWidth = img.width;
                            sourceHeight = sourceWidth / targetRatio;
                            sourceY = (img.height - sourceHeight) / 2;
                            sourceX = 0;
                        }
                        
                        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
                        callback(canvas.toDataURL('image/jpeg'));
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }

            function handleAvatarUpload(file, previewId, isProfilePic = false) {
                const preview = document.getElementById(previewId);
                if (!preview) return;

                if (!file) { 
                    preview.src = '';
                    preview.classList.remove('active');
                    // Show upload icon if it exists
                    const uploadIcon = preview.nextElementSibling;
                    if (uploadIcon && uploadIcon.classList.contains('upload-icon')) {
                        uploadIcon.style.opacity = 1;
                    }
                    return;
                }

                const displayImage = (dataUrl) => {
                    preview.src = dataUrl;
                    if (!preview.classList.contains('active')) preview.classList.add('active');
                     // Hide upload icon
                    const uploadIcon = preview.nextElementSibling;
                    if (uploadIcon && uploadIcon.classList.contains('upload-icon')) {
                        uploadIcon.style.opacity = 0;
                    }
                };
                
                if (isProfilePic) {
                    resizeAndCropImage(file, 150, 150, (dataUrl) => {
                        if (previewId === 'avatar-preview') newAvatarFile = dataUrl; // For signup form
                        if (previewId === 'profile-pic-img') newAvatarFile = dataUrl; // For main profile
                        displayImage(dataUrl);
                    });
                } else {
                     const reader = new FileReader();
                    reader.onload = (e) => displayImage(e.target.result);
                    reader.readAsDataURL(file);
                }
            }
            
            function handleMediaPreview(files, previewContainerId) {
                const previewContainer = document.getElementById(previewContainerId);
                if (!previewContainer) return;
                previewContainer.innerHTML = '';

                const fileArr = Array.from(files);
                const count = fileArr.length;

                // Premium multi-image grid layout based on count
                previewContainer.style.display = 'grid';
                previewContainer.style.gap = '4px';
                previewContainer.style.borderRadius = '14px';
                previewContainer.style.overflow = 'hidden';
                if (count === 1)      previewContainer.style.gridTemplateColumns = '1fr';
                else if (count === 2) previewContainer.style.gridTemplateColumns = '1fr 1fr';
                else if (count === 3) previewContainer.style.gridTemplateColumns = '2fr 1fr';
                else if (count >= 4)  previewContainer.style.gridTemplateColumns = '1fr 1fr';
                else                  previewContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(90px, 1fr))';

                fileArr.forEach((file, idx) => {
                    const url = URL.createObjectURL(file);
                    const mediaWrapper = document.createElement('div');
                    mediaWrapper.style.cssText = 'position:relative;overflow:hidden;background:#f0f0f0;';
                    // Special layout for 3-image: first spans 2 rows
                    if (count === 3 && idx === 0) {
                        mediaWrapper.style.gridRow = '1 / 3';
                    }
                    mediaWrapper.style.height = count === 1 ? '240px' : '160px';

                    let mediaElement;
                    if (file.type.startsWith('image/')) {
                        mediaElement = document.createElement('img');
                        mediaElement.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                    } else if (file.type.startsWith('video/')) {
                        mediaElement = document.createElement('video');
                        mediaElement.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                        mediaElement.controls = true;
                        mediaElement.muted = true;
                        mediaElement.loop = true;
                        mediaElement.autoplay = true;
                    }

                    // File count badge if more than 4 files
                    if (count > 4 && idx === 3) {
                        const badge = document.createElement('div');
                        badge.style.cssText = 'position:absolute;inset:0;background:rgba(10,14,39,0.6);display:flex;align-items:center;justify-content:center;color:white;font-size:1.5rem;font-weight:800;font-family:Syne,sans-serif;';
                        badge.textContent = '+' + (count - 4);
                        mediaWrapper.appendChild(badge);
                    }

                    if (mediaElement) {
                        mediaElement.src = url;
                        mediaWrapper.appendChild(mediaElement);
                    }
                    // Remove button
                    const removeBtn = document.createElement('button');
                    removeBtn.style.cssText = 'position:absolute;top:5px;right:5px;background:rgba(239,68,68,0.85);border:none;color:white;border-radius:50%;width:22px;height:22px;font-size:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;z-index:3;';
                    removeBtn.innerHTML = '×';
                    removeBtn.type = 'button';
                    removeBtn.addEventListener('click', function() {
                        mediaWrapper.remove();
                    });
                    mediaWrapper.appendChild(removeBtn);

                    previewContainer.appendChild(mediaWrapper);
                    if (count > 4 && idx >= 4) mediaWrapper.style.display = 'none'; // hide extras
                });
            }
            
            function handleMarketplacePreview(filesArray, previewContainer) {
                if (!previewContainer) return;
                if (!filesArray || filesArray.length === 0) { previewContainer.innerHTML = ''; return; }
                previewContainer.innerHTML = '';
                previewContainer.classList.add('mkt-preview-grid');
                var count = filesArray.length;
                var shown = Math.min(count, 4);
                previewContainer.style.display = 'grid';
                previewContainer.style.gap = '6px';
                previewContainer.style.borderRadius = '14px';
                previewContainer.style.overflow = 'hidden';
                previewContainer.style.marginTop = '8px';
                if (shown === 1) previewContainer.style.gridTemplateColumns = '1fr';
                else if (shown === 2) previewContainer.style.gridTemplateColumns = '1fr 1fr';
                else if (shown === 3) previewContainer.style.gridTemplateColumns = '2fr 1fr';
                else previewContainer.style.gridTemplateColumns = '1fr 1fr';

                /* Build a stable list of object URLs for this batch so the
                   fullscreen gallery can be opened on any of them, not just
                   the visibly-rendered first 4. Re-used for each cell tap. */
                var galleryUrls = Array.from(filesArray).map(function (file) {
                    var url = (typeof file === 'string') ? file : URL.createObjectURL(file);
                    var type = (typeof file === 'string') ? (file.match(/\.(mp4|webm|mov)/i) ? 'video/mp4' : 'image/jpeg')
                                                            : (file.type || '');
                    return { url: url, type: type };
                });

                Array.from(filesArray).forEach(function (file, idx) {
                    if (idx >= 4) return;
                    var url  = galleryUrls[idx].url;
                    var type = galleryUrls[idx].type;
                    var isVid = type.startsWith('video') || /\.(mp4|webm|mov)/i.test(url);

                    var cell = document.createElement('div');
                    cell.className = 'mkt-preview-cell';
                    cell.dataset.index = idx;
                    var h = shown === 1 ? '240px' : '150px';
                    cell.style.cssText = 'height:' + h + ';' + (shown === 3 && idx === 0 ? 'grid-row:1/3;' : '');

                    cell.innerHTML = isVid
                        ? '<video src="' + url + '" class="mkt-preview-media" muted playsinline preload="metadata"></video>'
                            + '<div class="mkt-preview-playicon"><i class="fas fa-play"></i></div>'
                        : '<img src="' + url + '" class="mkt-preview-media" loading="lazy" alt="Upload preview">';

                    cell.innerHTML += '<div class="mkt-preview-zoomhint"><i class="fas fa-expand"></i></div>';

                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'remove-media-btn mkt-preview-remove';
                    removeBtn.dataset.index = idx;
                    removeBtn.setAttribute('aria-label', 'Remove this item');
                    removeBtn.innerHTML = '&times;';
                    cell.appendChild(removeBtn);

                    if (count > 4 && idx === 3) {
                        var badge = document.createElement('div');
                        badge.className = 'mkt-preview-overflow';
                        badge.textContent = '+' + (count - 3);
                        cell.appendChild(badge);
                    }

                    /* Tap anywhere on the cell (but not the remove button)
                       opens the existing fullscreen gallery lightbox at this
                       index, reusing showMarketplaceGallery so prev/next,
                       thumbnails, keyboard nav and swipe all work exactly
                       like the rest of the app. */
                    cell.addEventListener('click', function (e) {
                        if (e.target.closest('.mkt-preview-remove')) return;
                        if (typeof window.showMarketplaceGallery === 'function') {
                            window.showMarketplaceGallery(galleryUrls, idx);
                        }
                    });

                    previewContainer.appendChild(cell);
                });
            }

            function createMessageElement(text, isSent, isFile = false, fileUrl = '', fileType = '', messageId = `msg-${Date.now()}`) {
                const messageEl = document.createElement('div');
                messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
                messageEl.dataset.messageId = messageId; 
                
                let contentHTML = '';
                if (isFile) {
                    if (fileType.startsWith('image/')) {
                        contentHTML = `<p>${text}</p><img src="${fileUrl}" class="message-media" alt="Sent image">`;
                    } else if (fileType.startsWith('video/')) {
                        contentHTML = `<p>${text}</p><video src="${fileUrl}" class="message-media" controls></video>`;
                    } else if (fileType.startsWith('audio/')) { 
                        contentHTML = `<p>${text}</p><audio src="${fileUrl}" class="message-media" controls></audio>`;
                    } else {
                         contentHTML = `<p><i class="fas fa-file-alt"></i> Sent a file: <a href="${fileUrl}" target="_blank">${text}</a></p>`;
                    }
                } else {
                    contentHTML = formatWhatsAppText(text);
                }
                
                messageEl.innerHTML = contentHTML;
                return messageEl;
            }


            // Expose shareContent globally so business page inline onclick works
            window.shareContent = shareContent;


            // --- LIVE STREAM FUNCTIONS ---
            function populateBackgroundSelector() {
                const container = document.getElementById('live-bg-selector');
                if (!container) return;
                container.innerHTML = '';

                // Group by category
                const categories = { classic: 'Classic', premium: 'Premium', studio: 'Studio', photo: 'Photo' };
                const grouped = {};
                liveBackgrounds.forEach(bg => {
                    if (!grouped[bg.category]) grouped[bg.category] = [];
                    grouped[bg.category].push(bg);
                });

                Object.entries(categories).forEach(([cat, catLabel]) => {
                    if (!grouped[cat]) return;
                    const catHeader = document.createElement('div');
                    catHeader.style.cssText = 'width:100%;font-size:0.7rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted);padding:8px 2px 4px;flex-basis:100%;';
                    catHeader.textContent = catLabel;
                    container.appendChild(catHeader);

                    grouped[cat].forEach(bg => {
                        const isPhoto = bg && bg.style && typeof bg.style === 'string' && bg.style.startsWith('http');
                        const thumb = document.createElement('div');
                        thumb.className = `bg-thumb ${liveStreamData.background === bg.style ? 'active' : ''}`;
                        thumb.dataset.bg = bg.style;
                        thumb.title = bg.label;
                        if (isPhoto) {
                            thumb.style.backgroundImage = `url(${bg.style})`;
                            thumb.style.backgroundSize = 'cover';
                            thumb.style.backgroundPosition = 'center';
                        } else {
                            thumb.style.background = bg.style;
                        }
                        // Label overlay
                        const lbl = document.createElement('span');
                        lbl.style.cssText = 'position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:0.55rem;color:rgba(255,255,255,0.9);text-shadow:0 1px 3px rgba(0,0,0,0.7);font-weight:600;letter-spacing:0.3px;';
                        lbl.textContent = bg.label;
                        thumb.style.position = 'relative';
                        thumb.appendChild(lbl);
                        container.appendChild(thumb);
                    });
                });

                if (liveStreamData.customBackgroundFile) {
                    const customBgUrl = URL.createObjectURL(liveStreamData.customBackgroundFile);
                    const customThumb = document.createElement('div');
                    customThumb.className = `bg-thumb ${liveStreamData.background === customBgUrl ? 'active' : ''}`;
                    customThumb.dataset.bg = customBgUrl;
                    customThumb.style.backgroundImage = `url(${customBgUrl})`;
                    customThumb.style.backgroundSize = 'cover';
                    const lbl = document.createElement('span');
                    lbl.style.cssText = 'position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:0.55rem;color:white;font-weight:600;';
                    lbl.textContent = 'Custom';
                    customThumb.style.position = 'relative';
                    customThumb.appendChild(lbl);
                    container.prepend(customThumb);
                }
            }

            function populateGiftCatalog() {
                const container = document.getElementById('gift-grid-container');
                if (!container) return;
                container.innerHTML = '';
                empyGiftCatalog.forEach(gift => {
                    const giftEl = document.createElement('div');
                    giftEl.className = 'gift-item';
                    giftEl.dataset.name = gift.name;
                    giftEl.dataset.symbol = gift.symbol;
                    giftEl.dataset.price = gift.price;
                    giftEl.innerHTML = `<div class="symbol">${gift.symbol}</div><div class="name">${gift.name}</div><div class="price"><i class="fa-solid fa-coins"></i> ${gift.price}</div>`;
                    container.appendChild(giftEl);
                });
            }
            
            function showGiftAnimation(symbol) {
                const layer = document.getElementById('gift-animation-layer');
                if (!layer) return;

                if (symbol === '💖') { // Special animation for Heart Mills
                    showHeartMillsAnimation();
                } else {
                    const animationEl = document.createElement('div');
                    animationEl.className = 'gift-animation';
                    animationEl.textContent = symbol;
                    const minLeft = 20; // % from left
                    const maxLeft = 80; // % from left
                    animationEl.style.left = `${Math.random() * (maxLeft - minLeft) + minLeft}%`;
                    layer.appendChild(animationEl);
                    setTimeout(() => animationEl.remove(), 3000);
                }
            }
            
            function showHeartMillsAnimation() {
                const layer = document.getElementById('gift-animation-layer');
                if (!layer) return;

                for (let i = 0; i < 20; i++) { // Spawn 20 hearts
                    const heart = document.createElement('span');
                    heart.className = 'heart-mill-animation';
                    heart.innerHTML = '<i class="fas fa-heart"></i>';
                    const startX = Math.random() * 100; // Random x position
                    const delay = Math.random() * 2000; // Random delay for staggered effect
                    
                    heart.style.left = `${startX}vw`;
                    heart.style.animationDelay = `${delay}ms`;
                    layer.appendChild(heart);
                    setTimeout(() => heart.remove(), 4000 + delay); 
                }
            }

            function createLiveComment(username, text, messageId = `msg-${Date.now()}`) {
                const list = document.getElementById('live-comments-list');
                if (!list) return;

                // Remove existing pinned message from general comments if it was there and is being repinned/newly pinned.
                if (liveStreamData.pinnedMessage && liveStreamData.pinnedMessage.id === messageId) {
                    const existingPinnedCommentEl = list.querySelector(`.live-comment[data-message-id="${messageId}"]`);
                    if (existingPinnedCommentEl) existingPinnedCommentEl.remove(); // Remove to re-add it as a truly pinned item if needed.
                }

                const commentEl = document.createElement('div');
                commentEl.className = 'live-comment';
                commentEl.dataset.messageId = messageId; 
                commentEl.innerHTML = `<strong>${username}</strong><p>${formatWhatsAppText(text)}</p>`;
                
                // Add new comment
                list.prepend(commentEl); 
                list.scrollTop = list.scrollHeight; 

                // Check if this message should be visually pinned as well
                if (liveStreamData.pinnedMessage && liveStreamData.pinnedMessage.id === messageId) {
                    commentEl.classList.add('pinned-comment');
                }

                if (!isGuest && userState.id === liveStreamData.hostUserId) {
                    const existingMessageIndex = liveStreamData.sentMessages.findIndex(msg => msg.id === messageId);
                    if (existingMessageIndex === -1) { // Only add if it's a new unique message
                         liveStreamData.sentMessages.push({ id: messageId, username: username, content: text });
                    }
                }
            }

            function createDashboardLiveCard(streamId, title, hostName, avatarSrc, bg, hostId) {
                const slider = document.getElementById('dashboard-live-slider');
                if (!slider) return;

                // Remove existing card for this stream (avoid duplicates)
                const existing = slider.querySelector('[data-stream-id="' + streamId + '"]');
                if (existing) existing.remove();

                // Hide the "No live streams" placeholder
                const emptyEl = document.getElementById('live-slider-empty');
                if (emptyEl) emptyEl.style.display = 'none';

                // Channel name matches what Firestore stores and Agora uses
                const channelName = 'empyrean-' + streamId;

                const card = document.createElement('div');
                card.className = 'live-stream-preview-card join-live-btn';
                card.dataset.streamId    = streamId;
                card.dataset.hostId      = hostId;
                card.dataset.hostName    = hostName;
                card.dataset.hostAvatar  = avatarSrc || '';
                card.dataset.streamTitle = title;
                card.dataset.agoraChannel = channelName;  // viewers use this to join
                card.dataset.background  = bg || '';
                card.style.cssText = 'flex:0 0 180px;min-width:180px;height:220px;border-radius:18px;overflow:hidden;cursor:pointer;position:relative;flex-shrink:0;';

                const isImage = bg && (bg.startsWith('http') || bg.startsWith('blob:'));
                if (isImage) {
                    card.style.backgroundImage = 'url(' + bg + ')';
                    card.style.backgroundSize = 'cover';
                    card.style.backgroundPosition = 'center';
                } else {
                    card.style.background = bg || 'linear-gradient(160deg,#0A0E27,#1B2B8B)';
                }

                const avatar = avatarSrc ? '<img src="' + avatarSrc + '" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid white;flex-shrink:0;">' : '';
                card.innerHTML =
                    '<div style="position:absolute;inset:0;background:linear-gradient(transparent 35%,rgba(0,0,0,0.85));z-index:1;"></div>' +
                    '<div style="position:absolute;top:10px;left:10px;z-index:2;">' +
                        '<span style="background:rgba(239,68,68,0.92);color:white;padding:3px 10px;border-radius:50px;font-size:0.7rem;font-weight:700;display:inline-flex;align-items:center;gap:5px;">' +
                            '<i class="fas fa-circle" style="font-size:0.45rem;animation:fa-beat 1s infinite;"></i> LIVE' +
                        '</span>' +
                    '</div>' +
                    '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;background:rgba(239,68,68,0.8);color:white;padding:8px 18px;border-radius:50px;font-size:0.8rem;font-weight:700;white-space:nowrap;">▶ Join Live</div>' +
                    '<div style="position:absolute;bottom:0;left:0;right:0;padding:12px;z-index:2;display:flex;align-items:center;gap:8px;">' +
                        avatar +
                        '<div style="flex:1;min-width:0;">' +
                            '<strong style="display:block;color:white;font-size:0.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + hostName + '</strong>' +
                            '<span style="color:rgba(255,255,255,0.75);font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">' + title + '</span>' +
                        '</div>' +
                    '</div>';
                slider.prepend(card);
            }
            
            function addRecordedLiveStream(title, hostName, recordedBlobUrl) {
                const wrapper = document.getElementById('livestream-wrapper');
                if (!wrapper) return;

                // Remove existing card for same title to avoid duplicates when cloud URL arrives
                const existing = Array.from(wrapper.querySelectorAll('.livestream-card')).find(c => c.dataset.title === title);
                if (existing) existing.remove();

                const newCard = document.createElement('div');
                newCard.className = 'livestream-card';
                newCard.dataset.title = title;
                newCard.style.cssText = 'border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(10,14,39,0.1);background:white;margin-bottom:16px;';

                if (recordedBlobUrl) {
                    // Determine type from URL
                    const isCloudMp4 = recordedBlobUrl.includes('cloudinary') || recordedBlobUrl.endsWith('.mp4');
                    const videoEl = document.createElement('video');
                    videoEl.controls = true;
                    videoEl.preload = 'metadata';
                    videoEl.style.cssText = 'width:100%;display:block;max-height:320px;background:#000;';
                    videoEl.src = recordedBlobUrl;
                    if (isCloudMp4) videoEl.type = 'video/mp4';

                    // Download button
                    const dlBtn = document.createElement('a');
                    dlBtn.href = recordedBlobUrl;
                    dlBtn.download = (title || 'recording') + '.webm';
                    dlBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:var(--secondary);color:white;padding:7px 14px;border-radius:8px;font-size:0.78rem;font-weight:700;text-decoration:none;margin-top:8px;';
                    dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Recording';

                    const info = document.createElement('div');
                    info.style.cssText = 'padding:12px 14px;';
                    info.innerHTML = '<strong style="font-size:0.9rem;color:var(--primary);display:block;margin-bottom:4px;">' + (title||'Recorded Stream') + '</strong>' +
                        '<span style="font-size:0.78rem;color:var(--text-muted);">By: ' + hostName + '</span>' +
                        '<span style="display:block;font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + new Date().toLocaleString() + '</span>';
                    info.appendChild(dlBtn);

                    newCard.appendChild(videoEl);
                    newCard.appendChild(info);
                } else {
                    newCard.innerHTML = '<div style="height:160px;background:var(--g-navy);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;"><i class="fas fa-video" style="color:rgba(255,255,255,0.35);font-size:2rem;"></i><span style="color:rgba(255,255,255,0.5);font-size:0.8rem;">Recording unavailable</span></div><div style="padding:12px 14px;"><strong style="color:var(--primary);">' + (title||'Stream') + '</strong><br><span style="font-size:0.78rem;color:var(--text-muted);">By: ' + hostName + '</span></div>';
                }

                wrapper.prepend(newCard);

                // Make sure the recorded livestreams section is visible
                const recSection = document.querySelector('.recorded-livestreams, #recorded-livestreams-section');
                if (recSection) recSection.style.display = 'block';
                // Navigate to livestream section to show it
                const liveSection = document.getElementById('go-live');
                if (liveSection) {
                    const wrapperSection = liveSection.querySelector('#livestream-wrapper');
                    if (wrapperSection) wrapperSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }

            function updateLiveUI() {
                const isCurrentUserHost = !isGuest && userState.id === liveStreamData.hostUserId;
                const liveContainer = liveStreamScreen;
                const hostMainVideo = document.getElementById('host-main-video');
                const hostVideoFallbackAvatar = document.getElementById('host-video-fallback-avatar');
                const hostControlPanel = document.getElementById('host-control-panel');
                const hostControlToggleBtn = document.getElementById('host-control-toggle-btn');
                
                const currentBg = liveStreamData.customBackgroundFile ? URL.createObjectURL(liveStreamData.customBackgroundFile) : liveStreamData.background;
                const isImageBg = currentBg && (currentBg.startsWith('http') || currentBg.startsWith('blob:'));
                liveContainer.style[isImageBg ? 'backgroundImage' : 'background'] = isImageBg ? `url('${currentBg}')` : currentBg;
                liveContainer.style.backgroundSize = 'cover';
                liveContainer.style.backgroundPosition = 'center';

                if (hostControlPanel && hostControlToggleBtn) {
                    if (isCurrentUserHost) {
                        hostControlPanel.style.display = 'flex'; // Ensure panel is displayed for host
                        // hostControlPanel.classList.add('expanded'); // Start expanded - Let user toggle
                        hostControlToggleBtn.querySelector('i').className = hostControlPanel.classList.contains('expanded') ? 'fas fa-chevron-left' : 'fas fa-chevron-right'; // Update toggle icon
                    } else {
                        hostControlPanel.style.display = 'none';
                        hostControlPanel.classList.remove('expanded');
                    }
                }
                
                const liveRequestJoinBtn = document.getElementById('live-request-join-btn');
                if (liveRequestJoinBtn) {
                     liveRequestJoinBtn.style.display = (!isCurrentUserHost && !isGuest && liveStreamData.guests.length < 9) ? 'flex' : 'none';
                     if (!isGuest && !isCurrentUserHost && liveStreamData.joinRequests.some(req => req.userId === userState.id)) {
                        liveRequestJoinBtn.innerHTML = '<i class="fas fa-hourglass-start"></i>'; 
                        liveRequestJoinBtn.title = "Request Pending";
                        liveRequestJoinBtn.disabled = true;
                     } else {
                        liveRequestJoinBtn.innerHTML = '<i class="fas fa-video"></i>'; 
                        liveRequestJoinBtn.title = "Request to Join";
                        liveRequestJoinBtn.disabled = false;
                     }
                }

                const liveRecordBtn = document.getElementById('live-record-btn');
                if (liveRecordBtn) liveRecordBtn.classList.toggle('recording', liveStreamData.isRecording);
                const liveMicToggle = document.getElementById('live-mic-toggle');
                if (liveMicToggle) liveMicToggle.innerHTML = `<i class="fas fa-microphone${liveStreamData.isMicMuted ? '-slash' : ''}"></i>`;
                const liveVideoToggle = document.getElementById('live-video-toggle');
                if (liveVideoToggle) liveVideoToggle.innerHTML = `<i class="fas fa-video${liveStreamData.isVideoMuted ? '-slash' : ''}"></i>`;
                const liveShareScreenBtn = document.getElementById('live-share-screen-btn');
                if (liveShareScreenBtn) {
                    liveShareScreenBtn.innerHTML = `<i class="fas fa-desktop${liveStreamData.isScreenSharing ? '-slash' : ''}"></i>`;
                    liveShareScreenBtn.classList.toggle('recording', liveStreamData.isScreenSharing);
                }
                
                if (hostMainVideo && hostVideoFallbackAvatar) {
                    if (isCurrentUserHost) {
                        hostMainVideo.style.display = liveStreamData.isVideoMuted ? 'none' : 'block';
                        if (!liveStreamData.isVideoMuted) {
                            hostMainVideo.src = "https://www.w3schools.com/html/mov_bbb.mp4"; 
                            hostMainVideo.muted = liveStreamData.isMicMuted; 
                            hostMainVideo.play().catch(e => console.log("Host video autoplay prevented:", e));
                        } else {
                            hostMainVideo.pause();
                            hostMainVideo.removeAttribute('src'); 
                        }
                        hostVideoFallbackAvatar.style.display = liveStreamData.isVideoMuted ? 'block' : 'none';
                        hostVideoFallbackAvatar.src = document.getElementById('live-host-avatar').src;
                    } else { // For guests viewing
                        hostMainVideo.style.display = liveStreamData.isVideoMuted ? 'none' : 'block';
                        if (!liveStreamData.isVideoMuted) {
                             hostMainVideo.src = "https://www.w3schools.com/html/mov_bbb.mp4"; 
                             hostMainVideo.muted = false; 
                             hostMainVideo.play().catch(e => console.log("Guest view: Host video autoplay prevented:", e));
                        } else {
                             hostMainVideo.pause();
                             hostMainVideo.removeAttribute('src');
                        }
                        hostVideoFallbackAvatar.style.display = liveStreamData.isVideoMuted ? 'block' : 'none';
                        hostVideoFallbackAvatar.src = document.getElementById('live-host-avatar').src;
                    }
                }

                const guestSlotsContainer = document.getElementById('multi-guest-slots');
                if (guestSlotsContainer) {
                    guestSlotsContainer.innerHTML = '';
                    if (liveStreamData.guests.length > 0) {
                        liveStreamData.guests.forEach(guest => {
                            const slot = document.createElement('div');
                            slot.className = `guest-slot ${guest.isVideoMuted ? '' : 'active-video'}`;
                            slot.dataset.userId = guest.userId;
                            slot.innerHTML = `
                                <video src="${guest.videoStream}" autoplay playsinline ${guest.isVideoMuted ? 'style="display:none;"' : ''}></video>
                                <img src="${guest.avatar}" alt="${guest.username}" class="guest-avatar-placeholder" style="${guest.isVideoMuted ? 'display:block; opacity: 0.5;' : 'display:none;'}">
                                <span class="guest-username">@${guest.username}</span>
                                ${isCurrentUserHost ? `
                                    <div class="guest-controls">
                                        <button data-action="toggle-mic" data-guest-id="${guest.userId}" title="${guest.isMicMuted ? 'Unmute' : 'Mute'} Mic"><i class="fas fa-microphone${guest.isMicMuted ? '-slash' : ''}"></i></button>
                                        <button data-action="toggle-video" data-guest-id="${guest.userId}" title="${guest.isVideoMuted ? 'Show' : 'Hide'} Video"><i class="fas fa-video${guest.isVideoMuted ? '-slash' : ''}"></i></button>
                                        <button data-action="remove-guest" data-guest-id="${guest.userId}" title="Remove Guest"><i class="fas fa-times-circle"></i></button>
                                    </div>` : ''}
                            `;
                            guestSlotsContainer.appendChild(slot);
                        });
                    }
                    document.getElementById('multi-guest-container').style.display = liveStreamData.guests.length > 0 ? 'flex' : 'none';
                }


                const goalDisplay = document.getElementById('live-goals-display');
                if (goalDisplay) {
                    if (liveStreamData.liveGoal) {
                        goalDisplay.style.display = 'flex';
                        const currentAmount = liveStreamData.liveGoal.currentAmount || 0;
                        const targetAmount = liveStreamData.liveGoal.targetAmount;
                        document.getElementById('live-goal-text').textContent = `${liveStreamData.liveGoal.description} (${Math.floor(currentAmount)}/${targetAmount} EMPY)`;
                        const progress = (currentAmount / targetAmount) * 100;
                        document.getElementById('live-goal-progress').style.width = `${Math.min(progress, 100)}%`;
                    } else {
                        goalDisplay.style.display = 'none';
                    }
                }

                const fanClubDisplay = document.getElementById('live-fan-club-display');
                if (fanClubDisplay) fanClubDisplay.style.display = liveStreamData.fanClubActive ? 'flex' : 'none';

                const gamesDisplay = document.getElementById('live-games-display');
                if (gamesDisplay) {
                    if (liveStreamData.activeGame) {
                        gamesDisplay.style.display = 'flex';
                        document.getElementById('live-game-name').textContent = liveStreamData.activeGame.name || liveStreamData.activeGame.type.charAt(0).toUpperCase() + liveStreamData.activeGame.type.slice(1);
                    } else {
                        gamesDisplay.style.display = 'none';
                    }
                }

                // Pinned message visibility fix: Adjusted Z-index and ensures it's above host avatar.
                const pinnedMessageDisplay = document.getElementById('live-pinned-message-display');
                if (pinnedMessageDisplay) {
                    if (liveStreamData.pinnedMessage) {
                        pinnedMessageDisplay.style.display = 'flex';
                        const pinnedContentSpan = pinnedMessageDisplay.querySelector('.pinned-content');
                        if (pinnedContentSpan) {
                            pinnedContentSpan.textContent = liveStreamData.pinnedMessage.content;
                        }
                    } else {
                        pinnedMessageDisplay.style.display = 'none';
                    }
                }

                const closeButton = goLiveModal.querySelector('#live-close-btn');
                if (closeButton) {
                    closeButton.innerHTML = isCurrentUserHost ? 'End' : '&times;';
                    closeButton.title = isCurrentUserHost ? 'End Stream' : 'Leave Stream';
                }

                document.getElementById('live-viewer-count').textContent = (1 + liveStreamData.guests.length).toLocaleString();
                document.getElementById('modal-viewer-count').textContent = (1 + liveStreamData.guests.length).toLocaleString();
            }

            function renderGuestJoinRequests() {
                const requestList = document.getElementById('live-join-requests-list');
                const requestCount = document.getElementById('live-join-request-count');
                if (!requestList || !requestCount) return;

                requestList.innerHTML = '';
                requestCount.textContent = liveStreamData.joinRequests.length;

                if (liveStreamData.joinRequests.length === 0) {
                    requestList.innerHTML = '<p style="text-align:center; color:#ccc; padding:20px;">No pending requests.</p>';
                    return;
                }

                liveStreamData.joinRequests.forEach(req => {
                    const reqEl = document.createElement('div');
                    reqEl.className = 'viewer-item';
                    reqEl.innerHTML = `
                        <img src="${req.avatar}" alt="${req.username}">
                        <div class="viewer-item-info">
                            <strong>${req.fullName}</strong>
                            <span>@${req.username}</span>
                        </div>
                        <div class="viewer-actions">
                            <button class="btn btn-small btn-success accept-guest-btn" data-user-id="${req.userId}">Accept</button>
                            <button class="btn btn-small btn-danger reject-guest-btn" data-user-id="${req.userId}">Reject</button>
                        </div>
                    `;
                    requestList.appendChild(reqEl);
                });
            }

            function renderHostSentMessagesForPinning() {
                const messagesList = document.getElementById('live-host-sent-messages');
                if (!messagesList) return;

                messagesList.innerHTML = '';
                if (liveStreamData.sentMessages.length === 0) {
                    messagesList.innerHTML = '<p style="text-align:center; color:#ccc; padding:20px;">No messages sent yet during this stream.</p>';
                    return;
                }

                liveStreamData.sentMessages.forEach(msg => {
                    const msgEl = document.createElement('div');
                    msgEl.className = `pin-message-choice ${liveStreamData.pinnedMessage && liveStreamData.pinnedMessage.id === msg.id ? 'selected' : ''}`;
                    msgEl.dataset.messageId = msg.id;
                    msgEl.innerHTML = `
                        <strong>@${msg.username}</strong>
                        <p>${formatWhatsAppText(msg.content)}</p>
                    `;
                    messagesList.prepend(msgEl);
                });
            }


            // --- ADMIN & POSTING FUNCTIONS ---



            // --- MESSAGING FUNCTIONS ---
            // ── MESSAGES: inject mobile-first CSS so contacts fill screen ──
            (function _injectMessageStyles() {
                if (document.getElementById('_msg_style')) return;
                var s = document.createElement('style');
                s.id = '_msg_style';
                s.textContent = [
                    '#messages { padding: 0 !important; }',
                    '#messages-view {',
                    '  display: flex !important;',
                    '  height: calc(100vh - 60px) !important;',
                    '  overflow: hidden !important;',
                    '}',
                    /* Contact list: full width on mobile */
                    '.contact-list {',
                    '  flex: 0 0 100% !important;',
                    '  width: 100% !important;',
                    '  min-width: 100% !important;',
                    '  height: 100% !important;',
                    '  overflow-y: auto !important;',
                    '  background: white !important;',
                    '  transition: transform 0.28s cubic-bezier(0.4,0,0.2,1) !important;',
                    '}',
                    /* On desktop show side-by-side */
                    '@media (min-width: 700px) {',
                    '  .contact-list { flex: 0 0 340px !important; min-width: 340px !important; max-width: 340px !important; border-right: 1px solid rgba(10,14,39,0.08) !important; }',
                    '  #chat-view-container { display: flex !important; flex: 1 !important; }',
                    '  #chat-placeholder { display: flex !important; flex: 1 !important; }',
                    '}',
                    /* Contact row styles */
                    '.contact-row {',
                    '  display: flex !important;',
                    '  align-items: center !important;',
                    '  gap: 14px !important;',
                    '  padding: 13px 16px !important;',
                    '  cursor: pointer !important;',
                    '  border-bottom: 1px solid rgba(10,14,39,0.05) !important;',
                    '  transition: background 0.15s !important;',
                    '  width: 100% !important;',
                    '  box-sizing: border-box !important;',
                    '}',
                    '.contact-row:hover, .contact-row:active { background: rgba(27,43,139,0.04) !important; }',
                    '.contact-row-avatar {',
                    '  width: 52px !important; height: 52px !important;',
                    '  border-radius: 50% !important; object-fit: cover !important;',
                    '  flex-shrink: 0 !important;',
                    '}',
                    '.contact-row-info { flex: 1; min-width: 0; }',
                    '.contact-row-name { font-weight: 700; font-size: 0.95rem; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
                    '.contact-row-preview { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }',
                    '.contact-row-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }',
                    '.contact-row-time { font-size: 0.72rem; color: var(--text-muted); }',
                    '.contact-row-badge { background: var(--accent-color); color: var(--primary); font-size: 0.7rem; font-weight: 700; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }',
                    /* Online dot on avatar */
                    '.contact-avatar-wrap { position: relative; flex-shrink: 0; }',
                    '.contact-online-dot { position: absolute; bottom: 2px; right: 2px; width: 11px; height: 11px; border-radius: 50%; background: #22c55e; border: 2px solid white; }',
                    '.contact-ring { border: 2.5px solid #22d3ee; border-radius: 50%; padding: 1px; }',
                    /* Back button on mobile in chat view */
                    '#chat-back-btn { display: none; }',
                    '@media (max-width: 699px) {',
                    '  #chat-back-btn { display: flex !important; align-items: center; justify-content: center; width: 36px; height: 36px; border: none; background: none; cursor: pointer; color: var(--primary); font-size: 1.1rem; flex-shrink: 0; }',
                    '  #chat-view-container.mobile-active { position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 10 !important; display: flex !important; }',
                    '  #chat-placeholder { display: none !important; }',
                    '}',
                ].join('\n');
                document.head.appendChild(s);
            })();

            // Extra message section styles for mobile fix
            (function _injectMessageExtraStyles() {
                if (document.getElementById('_msg_extra_style')) return;
                var _s = document.createElement('style');
                _s.id = '_msg_extra_style';
                _s.textContent = [
                    '@media (max-width: 992px) {',
                    '  #messages-view { height: calc(100dvh - 132px) !important; overflow: hidden !important; }',
                    '  #messages { overflow: hidden !important; }',
                    '  .chat-view { display: flex !important; flex-direction: column !important; overflow: hidden !important; }',
                    '  #chat-messages-container { flex: 1 !important; overflow-y: auto !important; padding-bottom: 10px !important; }',
                    '  .chat-view > div:last-child { flex-shrink: 0 !important; position: sticky !important; bottom: 0 !important; background: white !important; z-index: 5 !important; }',
                    '}',
                    '@media (min-width: 993px) {',
                    '  #messages-view { height: calc(100vh - 80px) !important; overflow: hidden !important; }',
                    '  .chat-view { display: flex !important; flex-direction: column !important; overflow: hidden !important; }',
                    '  #chat-messages-container { flex: 1 !important; overflow-y: auto !important; }',
                    '}',
                ].join('\n');
                document.head.appendChild(_s);
            })();

            

            function populateDobSelectors() {
                const daySelect = document.querySelector('#individual-kyc-form .date-select-group select:nth-child(1)');
                const monthSelect = document.querySelector('#individual-kyc-form .date-select-group select:nth-child(2)');
                const yearSelect = document.querySelector('#individual-kyc-form .date-select-group select:nth-child(3)');
                
                if(!daySelect || !monthSelect || !yearSelect) return;

                daySelect.innerHTML = '<option value="">Day</option>';
                monthSelect.innerHTML = '<option value="">Month</option>';
                yearSelect.innerHTML = '<option value="">Year</option>';

                for(let i = 1; i <= 31; i++) { daySelect.innerHTML += `<option value="${i}">${i}</option>`; }
                const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                months.forEach((month, i) => { monthSelect.innerHTML += `<option value="${i+1}">${month}</option>`; });
                const currentYear = new Date().getFullYear();
                for(let i = currentYear - 18; i >= currentYear - 100; i--) { yearSelect.innerHTML += `<option value="${i}">${i}</option>`; }
            }
            





            function simulateRewardAccrual() {
                if (!isGuest && (userManualStakedBalance > 0 || userLockedStakedBalance > 0)) {
                    const totalStaked = userManualStakedBalance + userLockedStakedBalance;
                    const rewardsPerSecond = totalStaked * (STAKING_APY_ESTIMATE / 31536000); 
                    userEarnedRewards += rewardsPerSecond;
                    if(document.getElementById('my-wallet').classList.contains('active')) {
                        updateStakingUI();
                    }
                }

                if (!isGuest && userLockedStakedBalance > 0 && Date.now() >= userLockedStakingEndTime) {
                    if (userLockedStakedBalance > 0) {
                        userState.empyBalance += userLockedStakedBalance;
                        userClaimedRewardsHistory.push({
                            type: 'Locked Staking Released',
                            amount: userLockedStakedBalance,
                            date: new Date().toLocaleDateString()
                        });
                        userLockedStakedBalance = 0;
                        userLockedStakingEndTime = 0; 
                        showNotification("Your locked EMPY has been released to your wallet!", "info");
                        updateWalletUI();
                    }
                }
            }

            
            



            // --- CORE APP FUNCTIONS ---
            // ── Check localStorage session on startup (FIX 14) ─────────
            // If user was logged in and refreshes, restore their session
            // Firebase users are restored by onAuthStateChanged automatically.
            // localStorage users need this explicit check.
            (function restoreLocalSession() {
                try {
                    const sessionEmail = localStorage.getItem('empyrean_session_email');
                    if (!sessionEmail) return;
                    const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                    const storedUser = stored[sessionEmail];
                    if (!storedUser) return;
                    // Restore Set types
                    ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(k => {
                        storedUser[k] = new Set(Array.isArray(storedUser[k]) ? storedUser[k] : []);
                    });
                    if (!storedUser.statuses) storedUser.statuses = [];
                    // Only restore if Firebase hasn't already handled this user
                    // (onAuthStateChanged fires async, so check after a short delay)
                    setTimeout(function() {
                        if (!isGuest) return; // Firebase already logged them in
                        console.log('[Session] Restoring localStorage session for', sessionEmail);
                        window._listenerRetryCount = 0; // reset retry counter for fresh session
                        initializeApp(false, storedUser.email === 'admin@empyrean.com', storedUser);
                    }, 800);
                } catch(e) { /* ignore corrupted session */ }
            })();

            function initializeApp(guestMode, isAdminUser = false, customUserData = null) {
                // ── BLANK-SCREEN GUARD: ensure at least one section is visible ──
                setTimeout(function() {
                    var sections = document.querySelectorAll('.content-section');
                    var anyVisible = Array.from(sections).some(function(s) { return s.style.display !== 'none' && s.offsetParent !== null; });
                    var appEl = document.getElementById('app');
                    if (!anyVisible && appEl) {
                        // Fall back to dashboard
                        sections.forEach(function(s) { s.style.display = 'none'; });
                        var dash = document.getElementById('dashboard');
                        if (dash) dash.style.display = 'block';
                    }
                }, 2500);
                const _now=Date.now();
                // Allow re-entry if:
                // (a) more than 1500ms since last call, OR
                // (b) this call is for a real Firebase-confirmed user (guestMode=false, customUserData has uid)
                //     upgrading from a prior localStorage-only session
                // FIX #4 (Refresh Logout): A real Firebase-authenticated user must ALWAYS
                // be allowed to initialise, even if a guest init ran milliseconds before
                // (which happens on page refresh while onAuthStateChanged fires async).
                // Removing the _initAppLastGuestMode===false gate means: any call carrying
                // a real UID bypasses the debounce guard, so the real session replaces the
                // transient guest session instead of being silently dropped.
                var _upgrading = (!guestMode && customUserData && customUserData.id &&
                                  customUserData.id !== 'user-main');
                if (window._initAppRunning && ((_now-(window._initAppLastRun||0))<1500) && !_upgrading) {
                    console.warn('[Empyrean] initializeApp blocked');
                    return;
                }
                window._initAppRunning=true; window._initAppLastRun=_now; window._initAppLastGuestMode=guestMode;
                setTimeout(function(){window._initAppRunning=false;},1500);

                // Always hide the auth modal when app initialises (prevents raw-layout bug)
                var _am = document.getElementById('auth-modal-overlay');
                if (_am) { _am.classList.remove('show'); _am.style.display = 'none'; }
                var _sv = document.getElementById('signup-view');
                var _fv = document.getElementById('forgot-password-view');
                if (_sv) _sv.style.display = 'none';
                if (_fv) _fv.style.display = 'none';
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';

                isGuest = guestMode;
                isAdmin = isAdminUser;
                // Expose as window globals so secondary listeners can access them
                window.isGuest = guestMode;
                window.isAdmin = isAdminUser;
                window.userState = userState;
                cart = [];
                newAvatarFile = null;
                newCoverFile = null;
                newsMediaFile = null;
                newPageProfileFile = null;
                newPageCoverFile = null;
                
                const guestState = { id: null, fullName: 'Guest', username: 'guest', avatar: 'https://source.unsplash.com/random/150x150/?avatar', coverPhoto: 'https://source.unsplash.com/random/1200x400/?pattern', likedPostIds: new Set(), followedUserIds: new Set(), retweetedPostIds: new Set(), statuses: [], awardedRanks: new Set(), empyBalance: 0, isVerified: false, businessPage: null, completedTasks: new Set(), viewedStatusUserIds: new Set() };
                const defaultUserState = { 
                        id: 'user-main',
                        fullName: '', 
                        username: 'member',
                        email: '',
                        password: '',
                        avatar: 'https://ui-avatars.com/api/?name=EM&background=1B2B8B&color=fff&size=150',
                        coverPhoto: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80',
                        bio: '',
                        phone: '',
                        website: '',
                        profession: '',
                        education: '',
                        maritalStatus: '',
                        hobbies: '',
                        location: '',
                        likedPostIds: new Set(), 
                        followedUserIds: new Set(),
                        retweetedPostIds: new Set(),
                        statuses: [],
                        viewedStatusUserIds: new Set(),
                        empyBalance: 0,
                        isVerified: false,
                        followerCount: 0,
                        businessPage: null,
                        awardedRanks: new Set(), 
                        completedTasks: new Set() 
                    };
                const adminState = { ...defaultUserState, id: 'admin-user', fullName: 'Admin User', username: 'admin', email: 'admin@empyrean.com', password: 'adminpass' };
                
                if (isGuest) {
                    userState = guestState;
                } else if (customUserData) {
                    userState = { ...guestState, ...customUserData };
                    userState.likedPostIds = new Set(userState.likedPostIds || []);
                    userState.followedUserIds = new Set(userState.followedUserIds || []);
                    userState.retweetedPostIds = new Set(userState.retweetedPostIds || []);
                    userState.viewedStatusUserIds = new Set(userState.viewedStatusUserIds || []);
                    userState.awardedRanks = new Set(userState.awardedRanks || []);
                    userState.completedTasks = new Set(userState.completedTasks || []);

                    mockUsers[customUserData.id] = userState;
                } else {
                    userState = isAdminUser ? adminState : defaultUserState;
                window.userState = userState;
                }
                
                if (userState.id && !mockUsers[userState.id]) {
                    mockUsers[userState.id] = userState;
                }

                buildSidebar();
                buildHeader();
                updateWalletUI();
                updateCartUI();
                renderDynamicUI();
                renderMarketplaceCards();
                populateBackgroundSelector();
                populateGiftCatalog();
                renderGrantLedger();
                renderNgoGrid();
                renderDashboardNews();
                if(!isGuest) {
                    renderUserProfile(userState.id); 
                    renderCommunityTasks();
                    renderSuggestedUsers();
                    renderBusinessPage();
                    updateStakingUI();
                }
                if(isAdmin) {
                    // Load SOS queue and withdrawals from Firestore for admin
                    (async () => {
                        try {
                            const sosSnap = await fbDb.collection('sos_queue').where('status','==','pending_approval').get();
                            if (!sosSnap.empty) {
                                sosSnap.forEach(doc => {
                                    const data = doc.data();
                                    if (!mockAdminSosQueue.find(s => s.id === data.id)) {
                                        mockAdminSosQueue.push(data);
                                    }
                                });
                            }
                        } catch(e) { console.warn('Failed to load SOS from Firestore:', e.message); }
                        renderAdminQueues();
                    })();
                }
                if(!isGuest) renderContactList();
                // Restore last visited section on refresh (FIX 15)
                const lastSection = (() => {
                    try { return localStorage.getItem('empyrean_last_section'); } catch(e) { return null; }
                })();
                const sectionToOpen = (!guestMode && !isAdminUser && lastSection && document.getElementById(lastSection))
                    ? lastSection
                    : (!guestMode && !isAdminUser ? 'profile' : 'dashboard');
                navigateTo(sectionToOpen);
                // Rebuild mobile bottom nav to reflect auth state (guest vs logged-in)
                if (typeof window._buildMobileBottomNav === 'function') {
                    setTimeout(window._buildMobileBottomNav, 100);
                }
                // Post compose lives in the Profile Dashboard tab only

                // Dispatch init-done so notification system and other listeners fire
                setTimeout(function() {
                    document.dispatchEvent(new Event('empyrean-init-done'));
                    // Pre-fill settings if already on that tab
                    if (!isGuest) {
                        var fnEl = document.getElementById('profile-fullname');
                        var unEl = document.getElementById('profile-username');
                        var bioEl = document.getElementById('profile-bio');
                        if (fnEl) fnEl.value = userState.fullName || '';
                        if (unEl) unEl.value = userState.username || '';
                        if (bioEl) bioEl.value = userState.bio || '';
                        var emailEl = document.getElementById('profile-email');
                        if (emailEl) emailEl.value = userState.email || '';
                    }
                }, 300);
                // ══════════════════════════════════════════════════════
                // REAL-TIME FIRESTORE LISTENERS
                // Uses onSnapshot() -- fires on ALL devices instantly
                // whenever any device writes new data.
                // Starts only after real Firebase is confirmed ready.
                // ══════════════════════════════════════════════════════
                if (!guestMode) {
                    window._listenerRetryCount = 0;
                    function _scheduleListenerRetry() {
                        window._listenerRetryCount = (window._listenerRetryCount || 0) + 1;
                        if (window._listenerRetryCount > 15) {
                            console.warn('[Listeners] Max retries reached -- waiting for network. Will auto-resume when online.');
                            return;
                        }
                        if (!window._listenerRetryScheduled) {
                            window._listenerRetryScheduled = true;
                            var _delay = Math.min(1500 * window._listenerRetryCount, 12000); // backoff up to 12s
                            setTimeout(function() {
                                window._listenerRetryScheduled = false;
                                if (typeof window._startRealtimeListeners === 'function')
                                    window._startRealtimeListeners();
                            }, _delay);
                        }
                    }
                    // Auto-resume listeners when browser comes back online (fixes Lagos network drops)
                    if (!window._empyreanOnlineListenerAdded) {
                        window._empyreanOnlineListenerAdded = true;
                        window.addEventListener('online', function() {
                            console.log('[Listeners] Network restored -- restarting listeners');
                            window._listenerRetryCount = 0;
                            window._listenerRetryScheduled = false;
                            if (typeof window._startRealtimeListeners === 'function')
                                setTimeout(window._startRealtimeListeners, 1000);
                        });
                    }
                    window._startRealtimeListeners = function() {
                        var db = window.fbDb;
                        // Valid session = Firebase Auth user OR localStorage session with a real user ID
                        // fbAuth.currentUser is null for localStorage-only sessions -- that is OK,
                        // the Firestore SDK still works with the anonymous/unauthenticated rules.
                        var _uid    = (window.fbAuth && window.fbAuth.currentUser && window.fbAuth.currentUser.uid) || null;
                        var _lsUser = window.userState && window.userState.id && window.userState.id !== 'user-main' && !window.isGuest;
                        var hasValidSession = !!_uid || !!_lsUser;

                        if (!window._firebaseLoaded || !db) {
                            console.warn('[Listeners] Firebase not ready -- will retry');
                            _scheduleListenerRetry();
                            return;
                        }
                        if (!hasValidSession) {
                            // One final check: is there a session email in localStorage?
                            try {
                                var _se = localStorage.getItem('empyrean_session_email');
                                if (_se && window.userState && !window.isGuest) hasValidSession = true;
                            } catch(e) {}
                        }
                        if (!hasValidSession) {
                            console.warn('[Listeners] No authenticated user -- will retry (' + (window._listenerRetryCount||0) + ')');
                            _scheduleListenerRetry();
                            return;
                        }
                        var _uid = (window.fbAuth && window.fbAuth.currentUser)
                            ? window.fbAuth.currentUser.uid
                            : (window.userState && window.userState.id) || 'local';
                        console.log('[Listeners] Starting all real-time Firestore listeners for uid:', _uid);

                        // Helper: unsubscribe a listener handle safely
                        function _unsub(handle) { try { if (typeof handle === 'function') handle(); } catch(e) {} }

                        // ── CLEAR STUB LISTENERS ON FIRST REAL FIREBASE INIT ─────────────
                        // Pre-stubs fire onSnapshot immediately with empty data, setting
                        // window._postsListener etc. to a no-op (truthy), blocking real
                        // listeners. On first real Firebase init the html sets
                        // window._firstRealFirebaseInit = true -- we clear stubs here.
                        if (window._firstRealFirebaseInit) {
                            window._firstRealFirebaseInit = false;
                            ['_postsListener','_newsListener','_mktListener',
                             '_reelsListener','_sosListener','_crisisListener',
                             '_announcementsListener','_usersListener','_statusesListener'].forEach(function(k) {
                                var h = window[k];
                                if (h && typeof h === 'function') {
                                    try { h(); } catch(e) {}
                                    window[k] = null;
                                    console.log('[Listeners] Cleared stub listener:', k);
                                }
                            });
                            /* Reset app-news.js active flag so it restarts cleanly */
                            window._newsListenerActive = false;
                        }
                        // ── POSTS ──────────────────────────────────────────
                        if (!window._postsListener) {
                            // FIX #3 (New posts at top): Replace the brittle 10-second
                            // isNewPost heuristic with a proper initial-batch flag.
                            // Firestore delivers the initial snapshot in DESC order (newest first),
                            // so appendChild during initial load correctly places newest at the top.
                            // After the first snapshot batch completes we switch to prepend so
                            // every subsequent real-time addition -- including posts created while
                            // the user was offline and arriving > 10s old -- lands at the top
                            // instead of being buried at the bottom.
                            var _postsInitialBatch = true;
                            window._postsListener = db.collection('posts').orderBy('createdAt','desc').limit(40)
                                .onSnapshot(function(snap) {
                                    if (!snap) return;
                                    var fc = document.getElementById('feed-container');
                                    var es = document.getElementById('feed-empty-state');
                                    snap.docChanges().forEach(function(change) {
                                        var post = change.doc.data();
                                        if (!post || !post.id) return;
                                        if (change.type === 'added') {
                                            // DEDUP FIX: check feed-container first, but do NOT return early --
                                            // profile feeds still need to be populated even if the optimistic
                                            // post is already in the main feed.
                                            var _alreadyInMainFeed = !!(fc && fc.querySelector('[data-post-id="'+post.id+'"]'));
                                            var media = (post.media||[]).filter(function(u){return u&&!u.startsWith('blob:');})
                                                .map(function(u){return{_cloudUrl:u,url:u,type:(/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(u)||/\/video\/upload\//i.test(u))?'video/mp4':'image/jpeg'};});
                                            var av = post.avatar||('https://ui-avatars.com/api/?name='+encodeURIComponent(post.username||'U')+'&background=5B0EA6&color=fff&size=150');
                                            var el = createNewPostElement(post.text||'', media, {id:post.userId, fullName:post.username||'User', avatar:av});
                                            el.dataset.postId = post.id;
                                            el.dataset.userId = post.userId;
                                            var tsEl = el.querySelector('.story-user-info span');
                                            if (tsEl && post.createdAt) tsEl.textContent = new Date(post.createdAt).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
                                            // Restore persisted like count
                                            if (post.likes > 0) {
                                                var lc = el.querySelector('.like-count');
                                                if (lc) lc.textContent = new Intl.NumberFormat().format(post.likes);
                                            }
                                            // ── RETWEET BANNER ──────────────────────────────────────
                                            // Show "X retweeted" above the post card for other users
                                            if (post.isRetweet && post.retweeterName) {
                                                var _rtBanner = document.createElement('div');
                                                _rtBanner.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 16px 0;font-size:0.72rem;font-weight:700;color:var(--secondary,#1B2B8B);opacity:0.75;';
                                                _rtBanner.innerHTML = '<i class="fas fa-retweet" style="font-size:0.8rem;"></i><span>' + (post.retweeterName||'').replace(/</g,'&lt;') + ' retweeted</span>';
                                                el.insertBefore(_rtBanner, el.firstChild);
                                                el.style.borderLeft = '3px solid rgba(27,43,139,0.18)';
                                            }
                                            // ── QUOTE BLOCK ─────────────────────────────────────────
                                            // Embed the quoted post preview inside the card
                                            if (post.isQuote && post.quotedPostId) {
                                                var _isQVid = post.quotedMedia && (/\/video\/upload\//i.test(post.quotedMedia) || /\.(mp4|webm|mov)(\?|$)/i.test(post.quotedMedia));
                                                var _qBlock = document.createElement('div');
                                                _qBlock.style.cssText = 'border:1.5px solid rgba(10,14,39,0.11);border-radius:14px;padding:10px 14px;margin:8px 16px 4px;background:rgba(10,14,39,0.025);cursor:pointer;';
                                                _qBlock.dataset.quotedPostId = post.quotedPostId;
                                                _qBlock.innerHTML = (post.quotedAuthor ? '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;"><strong style="font-size:0.78rem;color:var(--secondary,#1B2B8B);">@' + (post.quotedAuthor||'').replace(/</g,'&lt;') + '</strong></div>' : '')
                                                    + (post.quotedText ? '<p style="font-size:0.8rem;color:var(--text-muted,#6b7080);margin:0 0 5px;line-height:1.4;">' + (post.quotedText||'').replace(/</g,'&lt;') + '</p>' : '')
                                                    + (post.quotedMedia ? '<div style="margin-top:5px;">' + (_isQVid
                                                        ? '<video src="' + post.quotedMedia + '" muted playsinline preload="metadata" style="width:100%;max-height:110px;object-fit:cover;border-radius:7px;" onclick="this.paused?this.play():this.pause()"></video>'
                                                        : '<img src="' + post.quotedMedia + '" style="width:100%;max-height:110px;object-fit:cover;border-radius:7px;" onerror="this.style.display=\'none\'">') + '</div>' : '');
                                                var _sc = el.querySelector('.story-content, .post-content');
                                                if (_sc) { _sc.insertAdjacentElement('afterend', _qBlock); } else { el.appendChild(_qBlock); }
                                            }
                                            // Initial batch: Firestore DESC order + appendChild = newest at top.
                                            // Real-time adds: always prepend so even older-timestamp posts
                                            // (created while offline) appear at top when user comes online.
                                            if (fc && !_alreadyInMainFeed) {
                                                if (_postsInitialBatch) { fc.appendChild(el); } else { fc.prepend(el); }
                                                if(es) es.style.display='none';
                                            }
                                            // Mirror ONLY own posts to profile dashboard feed
                                            if (post.userId === userState.id && !post.isRetweet) {
                                                var pd = document.getElementById('profile-dash-feed');
                                                if (pd && !pd.querySelector('[data-post-id="'+post.id+'"]')) {
                                                    var pdClone = el.cloneNode(true);
                                                    // Ensure the options menu (edit/delete) is always accessible on dash
                                                    var optMenu = pdClone.querySelector('.options-menu');
                                                    if (!optMenu) {
                                                        // Inject edit+delete strip directly below post header if no options-menu
                                                        var hdr = pdClone.querySelector('.story-header');
                                                        if (hdr) {
                                                            var strip = document.createElement('div');
                                                            strip.style.cssText = 'display:flex;gap:6px;padding:4px 14px 6px;justify-content:flex-end;';
                                                            strip.innerHTML = '<a href="#" class="edit-post-btn" data-post-id="'+post.id+'" style="font-size:0.72rem;color:var(--secondary);font-weight:600;text-decoration:none;padding:3px 10px;border:1px solid rgba(27,43,139,0.2);border-radius:50px;"><i class="fas fa-pencil-alt"></i> Edit</a>'
                                                                + '<a href="#" class="delete-post-btn" style="font-size:0.72rem;color:#e53935;font-weight:600;text-decoration:none;padding:3px 10px;border:1px solid rgba(229,57,53,0.2);border-radius:50px;"><i class="fas fa-trash"></i> Delete</a>';
                                                            hdr.insertAdjacentElement('afterend', strip);
                                                        }
                                                    }
                                                    if (!_postsInitialBatch) { pd.prepend(pdClone); } else { pd.appendChild(pdClone); }
                                                }
                                                var pp = document.getElementById('profile-posts-feed');
                                                if (pp && !pp.querySelector('[data-post-id="'+post.id+'"]')) {
                                                    if (!_postsInitialBatch) { pp.prepend(el.cloneNode(true)); } else { pp.appendChild(el.cloneNode(true)); }
                                                }
                                                // Gallery -- delegate to helper (grid CSS + video/upload detection + play overlay + dedup)
                                                if (post.media && post.media.length) {
                                                    _addUrlsToProfileGallery(
                                                        post.media.filter(function(u){return u&&!u.startsWith('blob:');})
                                                    );
                                                }
                                            } // end if (post.userId === userState.id && !post.isRetweet)
                                        } else if (change.type === 'removed') {
                                            ['feed-container','profile-dash-feed','profile-posts-feed'].forEach(function(fid){
                                                var f2=document.getElementById(fid);
                                                if(f2){var e2=f2.querySelector('[data-post-id="'+post.id+'"]');if(e2)e2.remove();}});
                                        }
                                    }
                                    );
                                    // After each snapshot batch, switch off initial-load mode so
                                    // subsequent real-time additions are always prepended to the top.
                                    _postsInitialBatch = false;
                                }, function(err){console.error('[Listener:posts]',err.code,err.message);window._postsListener=null;});
                            console.log('[Firestore] ✅ posts listener active');
                        }

                        // ── NEWS — owned by app-news.js ────────────────────
                        // app-news.js registers window._newsListener and uses
                        // window._newsCache so the dashboard strip never scrapes
                        // a hidden DOM section. Do not start a duplicate here.
                        if (typeof window._startNewsListener === 'function' && !window._newsListenerActive) {
                            window._startNewsListener();
                        }

                        // ── MARKETPLACE ────────────────────────────────────
                        if (!window._mktListener) {
                            window._mktListener = db.collection('marketplace_listings').orderBy('createdAt','desc').limit(40)
                                .onSnapshot(function(snap) {
                                    if (!snap) return;
                                    var grid = document.getElementById('property-grid-container');
                                    var mktSlider = document.getElementById('dashboard-market-slider');
                                    // fromCache=false and !hasPendingWrites means this is a live update (new item), not initial load
                                    var isLiveUpdate = !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
                                    snap.docChanges().forEach(function(change) {
                                        var item = change.doc.data();
                                        if (!item || !item.id) return;
                                        if (change.type === 'added') {
                                            var firstUrl = item.media&&item.media[0]?item.media[0]:'';
                                            // Check Cloudinary video path (/video/upload/) OR file extension OR stored mediaType
                                            var _mktMediaType = (item.mediaTypes && item.mediaTypes[0]) || '';
                                            var isVid = _mktMediaType.startsWith('video/') ||
                                                /\/video\/upload\//i.test(firstUrl) ||
                                                /\.(mp4|webm|mov|avi|mkv)(\?|$|&|#)/i.test(firstUrl);
                                            var syms = {NGN:'₦',USD:'$',EUR:'€',GBP:'£',GHS:'₵',EMPY:'EMPY ',USDT:'USDT '};
                                            var sym = syms[item.currency]||'$';
                                            var priceStr = sym+parseFloat(item.price||0).toLocaleString('en-US',{minimumFractionDigits:2});
                                            // Determine if this is a brand-new post (added within last 10s)
                                            var isNew = item.createdAt && (Date.now()-new Date(item.createdAt).getTime() < 30000);
                                            // Full grid card
                                            if (grid && !grid.querySelector('[data-id="'+item.id+'"]')) {
                                                var card = document.createElement('div');
                                                card.className='property-card';
                                                card.dataset.id=item.id; card.dataset.price=item.price; card.dataset.name=item.name||'';
                                                card.dataset.displayCurrency=item.currency; card.dataset.salesType=item.salesType||'';
                                                card.dataset.media=JSON.stringify(item.media||[]);
                                                card.dataset.sellerId=item.sellerId||'';
                                                // FIX: store direct-sales contact fields on dataset so expand button works on all devices
                                                if (item.salesType==='direct') {
                                                    card.dataset.contactName=item.contactName||item.sellerName||'';
                                                    card.dataset.contactPhone=item.contactPhone||'';
                                                    card.dataset.contactEmail=item.contactEmail||'';
                                                    card.dataset.contactAddress=item.contactAddress||'';
                                                }
                                                // FIX: build full multi-media grid (was showing only first image/video)
                                                var _mktAllUrls = item.media||[];
                                                var _mktMediaHTML = '';
                                                if (_mktAllUrls.length === 0) {
                                                    _mktMediaHTML = '<div style="width:100%;height:200px;background:linear-gradient(135deg,#1B2B8B,#0A0E27);display:flex;align-items:center;justify-content:center;"><i class=\'fas fa-image\' style=\'font-size:2rem;color:rgba(255,255,255,0.3);\'></i></div>';
                                                } else if (_mktAllUrls.length === 1) {
                                                    _mktMediaHTML = isVid
                                                        ? '<video src="'+firstUrl+'" autoplay loop muted playsinline controls style="width:100%;height:200px;object-fit:cover;display:block;"></video>'
                                                        : '<img src="'+firstUrl+'" alt="'+(item.name||'')+'" loading="lazy" style="width:100%;height:200px;object-fit:cover;display:block;" onerror="this.style.display=\'none\'">';
                                                } else {
                                                    var _mktGridCols = _mktAllUrls.length===2?'1fr 1fr':_mktAllUrls.length===3?'2fr 1fr':'1fr 1fr';
                                                    _mktMediaHTML = '<div style="display:grid;grid-template-columns:'+_mktGridCols+';gap:3px;height:200px;overflow:hidden;">';
                                                    _mktAllUrls.slice(0,4).forEach(function(_mu,_mi){
                                                        var _isV=/\.(mp4|webm|mov)(\?|$)/i.test(_mu)||/\/video\/upload\//i.test(_mu);
                                                        var _extra=_mktAllUrls.length===3&&_mi===0?'grid-row:1/3;':'';
                                                        if(_isV){_mktMediaHTML+='<video src="'+_mu+'" controls muted playsinline style="width:100%;height:100%;object-fit:cover;'+_extra+'"></video>';}
                                                        else{_mktMediaHTML+='<img src="'+_mu+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;'+_extra+'" onerror="this.style.display=\'none\'">';}
                                                    });
                                                    if(_mktAllUrls.length>4){_mktMediaHTML+='<div style="display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);color:white;font-size:1.2rem;font-weight:800;">+'+(_mktAllUrls.length-4)+'</div>';}
                                                    _mktMediaHTML += '</div>';
                                                }
                                                card.innerHTML=_mktMediaHTML+
                                                    '<div class="property-info"><h4>'+(item.name||'')+'</h4>'+
                                                    '<p><i class="fas fa-map-marker-alt"></i> '+(item.location||'')+'</p>'+
                                                    '<div style="font-weight:700;color:var(--accent-color);font-size:1rem;">'+priceStr+'</div></div>'+
                                                    '<div class="property-seller-info" style="padding:6px 12px;font-size:0.82rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;"><strong>@'+(item.sellerName||item.username||'Seller')+'</strong>'+
                                                    (item.salesType==='escrow'?'<i class="fas fa-check-circle verified-badge-small" title="Escrow Protected"></i>':'<i class="fas fa-exclamation-circle unverified-badge-small" title="Direct Sales"></i>')+
                                                    '<span style="font-size:0.72rem;color:var(--text-muted);"><i class="fas fa-clock"></i> '+(item.createdAt?new Date(item.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'Recently')+'</span></div>'+
                                                    (item.salesType==='direct'?'<div class="direct-trade-warning" style="display:block;"><p><strong><i class="fas fa-exclamation-triangle"></i> Direct Sales:</strong> Please conduct due diligence.</p></div>':'')+
                                                    '<div class="direct-contact-info" style="display:none;"></div>'+
                                                    '<div class="property-actions">'+
                                                    (item.salesType==='escrow'?'<button class="btn btn-accent add-to-cart-btn"><i class="fas fa-cart-plus"></i> Add to Cart</button>':'<button class="btn btn-danger contact-seller-btn"><i class="fas fa-phone"></i> Contact Seller</button>')+
                                                    '<button class="btn promote-post-btn"><i class="fas fa-rocket"></i> Promote</button>'+
                                                    ((item.sellerId===userState.id||isAdmin)?'<button class="btn edit-post-btn" style="background:rgba(27,43,139,0.08);color:var(--secondary);border:1px solid rgba(27,43,139,0.2);"><i class="fas fa-edit"></i> Edit</button><button class="btn delete-post-btn" style="background:rgba(229,57,53,0.08);color:#e53935;border:1px solid rgba(229,57,53,0.2);"><i class="fas fa-trash"></i> Delete</button>':'')+
                                                    '</div>';
                                                // prepend only truly new items; append for initial load batch (Firestore already returns desc order)
                                                if (isNew) { grid.prepend(card); } else { grid.appendChild(card); }
                                                // Dashboard strip
                                                var mktCont = document.getElementById('dashboard-market-container');
                                                if(mktCont) mktCont.style.display='block';
                                                if(mktSlider && !mktSlider.querySelector('[data-id="'+item.id+'"]')) {
                                                    var dc=document.createElement('div');dc.className='dashboard-market-card';dc.dataset.id=item.id;dc.dataset.navTarget='marketplace';
                                                    dc.innerHTML=(firstUrl?(isVid?'<video src="'+firstUrl+'" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video>':'<img src="'+firstUrl+'" alt="'+item.name+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;">'):'')+'<div class="dashboard-market-card-info"><h5>'+(item.name||'')+'</h5><p>'+priceStr+'</p></div>';
                                                    if (isNew) { mktSlider.prepend(dc); } else { mktSlider.appendChild(dc); }
                                                }
                                                if(isNew && window.pushNotification)
                                                    window.pushNotification('🛒 New listing: '+(item.name||'item')+' by @'+(item.sellerName||'seller'), 'new_listing');
                                            }
                                        } else if (change.type === 'removed') {
                                            var el2=grid&&grid.querySelector('[data-id="'+item.id+'"]'); if(el2)el2.remove();
                                        }
                                    });
                                }, function(err){console.error('[Listener:mkt]',err.code,err.message);window._mktListener=null;});
                            console.log('[Firestore] ✅ marketplace_listings listener active');
                        }

                        // ── REELS ──────────────────────────────────────────
                        if (!window._reelsListener) {
                            window._reelsListener = db.collection('reels').orderBy('createdAt','desc').limit(30)
                                .onSnapshot(function(snap) {
                                    if (!snap) return;
                                    snap.docChanges().forEach(function(change) {
                                        var reel = change.doc.data();
                                        if (!reel || !reel.id || !reel.videoUrl || reel.videoUrl.startsWith('blob:')) return;
                                        if (change.type === 'added') {
                                            // Declare isNewReel once at the top -- used by both slider and grid
                                            var isNewReel2 = reel.createdAt && (Date.now()-new Date(reel.createdAt).getTime() < 30000);
                                            // Dashboard slider
                                            var slider = document.getElementById('dashboard-reels-slider');
                                            var reelCont = document.getElementById('dashboard-reels-container');
                                            if (slider && !slider.querySelector('[data-reel-id="'+reel.id+'"]')) {
                                                if(reelCont) reelCont.style.display='block';
                                                var card=document.createElement('div');
                                                card.className='reel-preview-card';card.dataset.reelId=reel.id;
                                                card.dataset.videoUrl=reel.videoUrl;card.dataset.username=reel.username||'user';
                                                card.dataset.caption=reel.caption||'';card.style.cssText='flex-shrink:0;width:110px;height:160px;border-radius:14px;overflow:hidden;position:relative;cursor:pointer;background:#111;';
                                                card.innerHTML='<video src="'+reel.videoUrl+'" style="width:100%;height:100%;object-fit:cover;" muted playsinline preload="metadata"></video>'+
                                                    '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;"><i class="fas fa-play" style="color:white;font-size:0.85rem;margin-left:2px;"></i></div></div>'+
                                                    '<div style="position:absolute;bottom:0;left:0;right:0;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,0.8));color:white;font-size:0.7rem;font-weight:600;">@'+(reel.username||'user')+'</div>';
                                                (function(c2){
                                                    var vid=c2.querySelector('video');
                                                    c2.addEventListener('mouseenter',function(){if(vid)vid.play().catch(function(){});});
                                                    c2.addEventListener('mouseleave',function(){if(vid){vid.pause();vid.currentTime=0;}});
                                                    c2.addEventListener('click',function(){
                                                        var vUrl=c2.dataset.videoUrl;if(!vUrl)return;
                                                        var ov=document.getElementById('reel-viewer-modal-overlay');
                                                        var ct=document.getElementById('reel-viewer-container');
                                                        if(ov&&ct){ct.innerHTML='';
                                                            var vi=document.createElement('div');vi.className='reel-viewer-item';vi.style.cssText='position:relative;width:100%;height:100%;background:#000;flex-shrink:0;display:flex;align-items:center;justify-content:center;';
                                                            vi.innerHTML='<video src="'+vUrl+'" style="width:100%;height:100%;object-fit:contain;" controls autoplay playsinline></video>'+
                                                                '<div style="position:absolute;bottom:80px;left:16px;color:white;"><strong>@'+c2.dataset.username+'</strong><p style="font-size:0.82rem;margin:4px 0 0;">'+c2.dataset.caption+'</p></div>';
                                                            ct.appendChild(vi);ov.style.display='block';document.body.style.overflow='hidden';}
                                                    });
                                                })(card);
                                                slider.prepend(card);
                                            }
                                            // FIX: also update the dashboard-reels-slider
                                            // The local card was created with data-reel-id during upload.
                                            // If it exists, upgrade its src; otherwise create it fresh.
                                            var _dSlider = document.getElementById('dashboard-reels-slider');
                                            var _dCont   = document.getElementById('dashboard-reels-container');
                                            if (_dSlider) {
                                                if (_dCont) _dCont.style.display = 'block';
                                                var _dExist = _dSlider.querySelector('[data-reel-id="'+reel.id+'"]');
                                                if (_dExist) {
                                                    // Upgrade blob URL → Cloudinary URL
                                                    var _dv = _dExist.querySelector('video');
                                                    if (_dv) { _dv.src = reel.videoUrl; var _ds = _dv.querySelector('source'); if(_ds) _ds.src = reel.videoUrl; }
                                                    _dExist.dataset.reelId = reel.id;
                                                } else {
                                                    // Not yet in slider -- add it (cross-device arrival)
                                                    var _dc = document.createElement('div');
                                                    _dc.className = 'dashboard-reel-card';
                                                    _dc.dataset.navTarget = 'reels';
                                                    _dc.dataset.reelId = reel.id;
                                                    _dc.innerHTML = '<video src="'+reel.videoUrl+'" loop muted autoplay playsinline style="width:100%;height:100%;object-fit:cover;display:block;"><source src="'+reel.videoUrl+'" type="video/mp4"></video>'
                                                        + '<div class="reel-content"><div class="reel-user-info">'
                                                        + '<div class="avatar-placeholder square" style="width:35px;height:35px;"><img src="'+(reel.avatar||'')+'" alt="@'+(reel.username||'user')+'"></div>'
                                                        + '<span>@'+(reel.username||'user')+'</span></div>'
                                                        + '<p>'+(reel.caption||'')+'</p></div>';
                                                    if (isNewReel2) { _dSlider.prepend(_dc); } else { _dSlider.appendChild(_dc); }
                                                }
                                            }
                                            // Main reels grid
                                            var rg=document.getElementById('reels-grid-container');
                                            if(rg) {
                                                var existingCard=rg.querySelector('[data-post-id="'+reel.id+'"]');
                                                if(existingCard) {
                                                    // Already in DOM as a local preview -- just upgrade the video src
                                                    // to the final Cloudinary URL. Never add a duplicate.
                                                    var ev=existingCard.querySelector('video');
                                                    if(ev && reel.videoUrl) { ev.src=reel.videoUrl; }
                                                    existingCard.dataset.videoUrl=reel.videoUrl;
                                                } else {
                                                    var rc=document.createElement('div');rc.className='reel-card';
                                                    rc.dataset.postId=reel.id;rc.dataset.videoUrl=reel.videoUrl;rc.dataset.userId=reel.userId||'';
                                                    rc.innerHTML='<video src="'+reel.videoUrl+'" loop muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;display:block;"></video>'+
                                                        '<div class="reel-content" style="position:absolute;bottom:0;left:0;right:0;padding:12px;background:linear-gradient(transparent,rgba(0,0,0,0.8));color:white;">'+
                                                        '<div class="reel-user-info" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'+
                                                        '<div class="avatar-placeholder" style="width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;"><img src="'+(reel.avatar||'')+'"></div>'+
                                                        '<span style="font-weight:700;font-size:0.85rem;">@'+(reel.username||'user')+'</span></div>'+
                                                        '<p style="font-size:0.82rem;opacity:0.9;margin:0;">'+(reel.caption||'')+'</p></div>';
                                                    var rv=rc.querySelector('video');
                                                    if(rv){rc.addEventListener('mouseenter',function(){rv.play().catch(function(){});});rc.addEventListener('mouseleave',function(){rv.pause();rv.currentTime=0;});}
                                                    var reEmpty=document.getElementById('reels-empty-state');if(reEmpty)reEmpty.style.display='none';
                                                    if (reel.userId === userState.id || isAdmin) {
                                                        var _reelOpts = document.createElement('div');
                                                        _reelOpts.style.cssText = 'position:absolute;top:8px;right:8px;z-index:10;';
                                                        _reelOpts.innerHTML = '<button class="options-btn" style="background:rgba(0,0,0,0.55);border:none;color:white;border-radius:50%;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="fas fa-ellipsis-h" style="font-size:0.75rem;pointer-events:none;"></i></button>'
                                                            + '<div class="options-menu" style="position:absolute;top:34px;right:0;background:white;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.2);min-width:130px;z-index:100;overflow:hidden;">'
                                                            + '<a href="#" class="edit-post-btn" style="display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:0.82rem;color:var(--secondary);font-weight:600;text-decoration:none;"><i class="fas fa-edit"></i> Edit</a>'
                                                            + '<a href="#" class="delete-post-btn" style="display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:0.82rem;color:#e53935;font-weight:600;text-decoration:none;"><i class="fas fa-trash"></i> Delete</a>'
                                                            + '</div>';
                                                        rc.style.position = 'relative';
                                                        rc.dataset.userId = reel.userId || '';
                                                        rc.appendChild(_reelOpts);
                                                    }
                                                    // prepend only new reels; append for initial load
                                                    if (isNewReel2) { rg.prepend(rc); } else { rg.appendChild(rc); }
                                                }
                                            }
                                            if(isNewReel2 && window.pushNotification)
                                                window.pushNotification('🎬 New reel from @'+(reel.username||'someone')+'!','new_reel');
                                        }
                                    });
                                }, function(err){
                                    console.error('[Listener:reels]',err.code,err.message);
                                    window._reelsListener=null;
                                    // Auto-retry on Firestore listener error (network blip)
                                    if (err.code !== 'permission-denied') {
                                        setTimeout(function(){
                                            if(!window._reelsListener && typeof window._startRealtimeListeners === 'function')
                                                window._startRealtimeListeners();
                                        }, 5000);
                                    }
                                });
                            console.log('[Firestore] ✅ reels listener active');
                        }

                        // ── SOS APPROVED POSTS ─────────────────────────────
                        if (!window._sosListener) {
                            window._sosListener = db.collection('sos_queue').limit(30)
                                .onSnapshot(function(snap) {
                                    if (!snap) return;
                                    snap.docChanges().forEach(function(change) {
                                        var sos = change.doc.data();
                                        if (!sos || !sos.id) return;
                                        if (change.type === 'added' && sos.status === 'approved') {
                                            var fc=document.getElementById('feed-container');
                                            if (fc && !fc.querySelector('[data-post-id="'+sos.id+'"]')) {
                                                if (typeof createSosPostOnFeed === 'function') createSosPostOnFeed(sos);
                                            }
                                        }
                                        if(change.type==='removed'){var elS=document.querySelector('[data-post-id="'+sos.id+'"]');if(elS)elS.remove();}
                                    });
                                    // Repair: inject donate button on any SOS card missing it
                                    setTimeout(function(){
                                        document.querySelectorAll('.impact-story.sos-request').forEach(function(p){
                                            if(!p.querySelector('.help-now-btn')){
                                                var _un=p.dataset.username||'this cause';
                                                var _w=document.createElement('div');_w.style.cssText='padding:10px 16px 14px;';
                                                _w.innerHTML='<button class="gift-button sos-button help-now-btn donate-post-btn" data-sos-user-id="'+p.dataset.userId+'" data-sos-username="'+_un+'" style="width:100%;padding:12px;font-size:0.95rem;font-weight:700;border-radius:12px;background:linear-gradient(135deg,#EF4444,#B91C1C);color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;"><i class="fas fa-hand-holding-heart"></i> Donate Now — Help '+_un+'</button>';
                                                var _ac=p.querySelector('.story-actions');if(_ac)p.insertBefore(_w,_ac.nextSibling);else p.appendChild(_w);
                                            }
                                        });
                                    },400);
                                },function(err){console.error('[Listener:sos]',err.code,err.message);window._sosListener=null;});
                            console.log('[Firestore] ✅ sos_queue listener active');
                        }

                        // ── CRISIS / COMMUNITY REPORTS ─────────────────────
                        if (!window._crisisListener) {
                            window._crisisListener = db.collection('crisis_reports')
                                .orderBy('createdAt', 'desc')
                                .limit(20)
                                .onSnapshot(function(snap) {
                                    if (!snap) return;
                                    snap.docChanges().forEach(function(change) {
                                        var cr = change.doc.data();
                                        if (!cr || !cr.id) return;
                                        
                                        // Add doc ID as fallback if data.id missing
                                        cr.id = cr.id || change.doc.id;
                                        
                                        if (change.type === 'removed') {
                                            var _rmId = cr.id;
                                            var fc = document.getElementById('feed-container');
                                            if (fc) {
                                                var _rmEl = fc.querySelector('[data-post-id="'+_rmId+'"]');
                                                if (_rmEl) _rmEl.remove();
                                            }
                                            return;
                                        }
                                        
                                        if (change.type === 'added') {
                                            var fc = document.getElementById('feed-container');
                                            if (!fc) return;
                                            
                                            // Simple duplicate check - if already in DOM, skip
                                            if (fc.querySelector('[data-post-id="'+cr.id+'"]')) {
                                                return;
                                            }
                                            
                                            if (typeof createCrisisPostOnFeed === 'function') {
                                                createCrisisPostOnFeed(cr);
                                            }
                                        }
                                    });
                                }, function(err){console.error('[Listener:crisis]',err.code,err.message);window._crisisListener=null;});
                            console.log('[Firestore] ✅ crisis_reports listener active');
                        }

                        // ── ANNOUNCEMENTS ──────────────────────────────────
                        if (!window._announcementsListener) {
                            window._announcementsListener = db.collection('announcements').limit(10)
                                .onSnapshot(function(snap) {
                                    if (!snap) return;
                                    snap.docChanges().forEach(function(change) {
                                        var ann = change.doc.data();
                                        if (!ann || change.type !== 'added') return;
                                        var icons={announcement:'[Announcement]',appreciation:'[Appreciation]',update:'[Update]','sos-thanks':'[SOS Thanks]'};
                                        var icon = icons[ann.type]||'[Notice]';
                                        if(window.pushNotification) window.pushNotification(icon+' '+(ann.title||'Admin Announcement'),'announcement');
                                    });
                                }, function(err){console.error('[Listener:announcements]',err.code,err.message);window._announcementsListener=null;});
                            console.log('[Firestore] ✅ announcements listener active');
                        }

                        // ── USERS (for suggested/follow) ───────────────────
                        if (!window._usersListener) {
                            window._usersListener = db.collection('users').limit(50)
                                .onSnapshot(function(snap) {
                                    if (!snap) return;
                                    snap.docChanges().forEach(function(change) {
                                        var u = change.doc.data();
                                        if (!u || !u.id || u.id === userState.id) return;
                                        ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds']
                                            .forEach(function(k){u[k]=new Set(Array.isArray(u[k])?u[k]:[]); });
                                        if (change.type === 'added' || change.type === 'modified') {
                                            mockUsers[u.id] = u;
                                            if (u.email) registeredUsers[u.email] = u;
                                        } else if (change.type === 'removed') { delete mockUsers[u.id]; }
                                    });
                                    if (typeof renderSuggestedUsers === 'function') renderSuggestedUsers();
                                }, function(err){console.error('[Listener:users]',err.code,err.message);window._usersListener=null;});
                            console.log('[Firestore] ✅ users listener active');
                        }

                        // ── STATUSES (24-hour expiry, cross-device) ────────────
                        // NOTE: status data ownership lives exclusively in app-status.js
                        // (its own doc-per-user read/write/purge cycle — see app-status.js
                        // §11-§13). A live onSnapshot listener here previously raced with
                        // that module: every remote change rebuilt window.userStatuses from
                        // scratch and clobbered fields (docId, viewers, in-flight local
                        // edits) that app-status.js had just set, causing intermittent
                        // cross-device bugs. Replaced with a single one-time fetch so other
                        // users' statuses are populated on load/login without an ongoing
                        // process fighting app-status.js for control of the array.
                        if (!window._statusesListener) {
                            window._statusesListener = true; // sentinel: fetch-once already done for this session
                            var _24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                            db.collection('statuses')
                                .where('createdAt', '>=', _24hAgo)
                                .orderBy('createdAt', 'desc').limit(100)
                                .get()
                                .then(function(snap) {
                                    if (!snap) return;
                                    var _myId = (typeof userState !== 'undefined' && userState) ? userState.id : null;
                                    window.userStatuses = window.userStatuses || [];
                                    snap.forEach(function(doc) {
                                        var s = doc.data();
                                        if (!s || !s.userId) return;
                                        var _created = s.createdAt ? new Date(s.createdAt).getTime() : 0;
                                        if (Date.now() - _created > 24 * 60 * 60 * 1000) return; // expired
                                        if (s.userId === _myId) return; // never clobber own in-progress local status
                                        var existing = window.userStatuses.find(function(u) { return u.userId === s.userId; });
                                        var merged = Object.assign({ _ownerId: s.userId }, s, { docId: doc.id });
                                        if (existing) {
                                            var ei = window.userStatuses.indexOf(existing);
                                            window.userStatuses[ei] = merged;
                                        } else {
                                            window.userStatuses.push(merged);
                                        }
                                    });
                                    if (typeof window.renderStatusBar === 'function') window.renderStatusBar();
                                    console.log('[Firestore] ✅ statuses fetched once (cross-device, '+(snap.size||0)+' active)');
                                })
                                .catch(function(err) {
                                    console.error('[Statuses fetch]', err.code, err.message);
                                    window._statusesListener = null; // allow retry on next listener-start pass
                                });
                        }

                        // ── OWN STATUS — reload on fresh login (point #4 persistence fix) ──
                        // The cross-device fetch above deliberately SKIPS the logged-in
                        // user's own doc (line "never clobber own in-progress local
                        // status") to avoid a stale snapshot fighting an in-flight local
                        // edit mid-session. But nothing else ever loaded that doc back in
                        // either — so on a fresh login, with window.userStatuses starting
                        // empty, the user's own still-active status (uploaded in an
                        // earlier session, still well within the 24h window in Firestore)
                        // never reappeared. Guarded separately from the listener above so
                        // it only ever runs once per session, and only populates if this
                        // user has no local entry yet — it can never overwrite an
                        // in-progress local status, only restore one that's missing.
                        if (!window._ownStatusFetched) {
                            window._ownStatusFetched = true; // sentinel: one-time per session
                            var _myIdForOwn = (typeof userState !== 'undefined' && userState) ? userState.id : null;
                            if (_myIdForOwn) {
                                var _alreadyLocal = (window.userStatuses || []).some(function(u){ return u.userId === _myIdForOwn; });
                                if (!_alreadyLocal) {
                                    db.collection('statuses').doc('status-' + _myIdForOwn).get()
                                        .then(function(ownDoc) {
                                            if (!ownDoc || !ownDoc.exists) return;
                                            var s = ownDoc.data();
                                            if (!s || !s.userId) return;
                                            window.userStatuses = window.userStatuses || [];
                                            var stillLocal = window.userStatuses.some(function(u){ return u.userId === _myIdForOwn; });
                                            if (stillLocal) return; // a local edit arrived while this was in flight — don't race it
                                            var liveItems = (s.items || []).filter(function(it){
                                                return !it.createdAt || (Date.now() - new Date(it.createdAt).getTime() < 24 * 60 * 60 * 1000);
                                            });
                                            if (!liveItems.length) return; // fully expired — nothing to restore
                                            window.userStatuses.unshift(Object.assign({}, s, { items: liveItems, docId: ownDoc.id }));
                                            if (typeof window.renderStatusBar === 'function') window.renderStatusBar();
                                            console.log('[Firestore] ✅ own status restored after login ('+liveItems.length+' active item(s))');
                                        })
                                        .catch(function(err) {
                                            console.error('[Own status fetch]', err.code, err.message);
                                            window._ownStatusFetched = false; // allow retry
                                        });
                                }
                            }
                        }

                        console.log('[Firestore] ✅ ALL 8 real-time listeners active + 1 one-time statuses fetch -- full cross-device sync enabled');
                        // Refresh home bio card and suggested users after listeners are live
                        setTimeout(function() {
                            if (typeof window._populateHomeBioCard === 'function') window._populateHomeBioCard();
                            if (typeof renderSuggestedUsers === 'function') renderSuggestedUsers();
                        }, 500);
                    }

                    // Listeners are started by onAuthStateChanged (after auth confirmed).
                    // DO NOT start listeners here -- Firestore rejects reads before auth.
                    // _startRealtimeListeners() is called from onAuthStateChanged below.
                }
            }
            
            

            // ── HOME PAGE -- SUGGESTED FOR YOU wrapper card ──────────────────────────
            function _populateHomeBioCard() {
                var card = document.getElementById('home-user-bio-card');
                if (!card || !userState || isGuest) { if (card) card.style.display = 'none'; return; }
                // The card is shown/hidden by renderSuggestedUsers based on whether
                // there are users to suggest. Just trigger that render here.
                if (typeof renderSuggestedUsers === 'function') {
                    setTimeout(renderSuggestedUsers, 150);
                }
            }
            window._populateHomeBioCard = _populateHomeBioCard;

            
            

            

                    

            





             function updateCrossChainTransferPreview() {
                const amountInput = document.getElementById('cross-chain-amount');
                if(!amountInput) return;
                const amountEmpy = parseFloat(amountInput.value) || 0;
                const networkSelect = document.getElementById('cross-chain-network');
                if (!networkSelect) return; 
                const selectedOption = networkSelect.options[networkSelect.selectedIndex];
                const networkFee = parseFloat(selectedOption.dataset.fee) || 0;
                const previewEl = document.getElementById('cross-chain-transfer-preview');

                if (!amountEmpy || amountEmpy <= 0) {
                    previewEl.innerHTML = '<p>Enter an amount to see transaction details.</p>';
                    return;
                }
                
                const totalDeducted = amountEmpy + networkFee;

                let html = `<p>Amount to Send: <strong>${amountEmpy.toLocaleString()} EMPY</strong></p>`;
                html += `<p>Network Fee (${selectedOption.textContent.split('(')[0].trim()}): <strong>${networkFee.toLocaleString()} EMPY</strong></p>`;
                html += `<p>Total to be Deducted: <strong>${totalDeducted.toLocaleString()} EMPY</strong></p>`;
                
                previewEl.innerHTML = html;
            }



            // ── PROFILE GALLERY HELPER (definitive) ──────────────────────────────────
            // Single source of truth. Called by:
            //   1. _postsListener when own posts arrive from Firestore
            //   2. Quick post handler immediately after upload
            //   3. Profile post handler immediately after upload
            function _addUrlsToProfileGallery(urls) {
                if (!urls || !urls.length) return;
                var gal = document.getElementById('profile-gallery');
                if (!gal) return;
                // Remove empty-state placeholder
                var ep = gal.querySelector('p');
                if (ep) ep.remove();
                // Ensure grid layout
                gal.style.display = 'grid';
                gal.style.gridTemplateColumns = 'repeat(3,1fr)';
                gal.style.gap = '6px';
                urls.forEach(function(url) {
                    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;
                    if (gal.querySelector('[data-media-url="' + url + '"]')) return; // dedup
                    var isV = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url)
                           || /\/video\/upload\//i.test(url);
                    var gi = document.createElement('div');
                    gi.dataset.mediaUrl = url;
                    gi.style.cssText = [
                        'position:relative','aspect-ratio:1/1','border-radius:10px',
                        'overflow:hidden','background:#e8eaf0','cursor:pointer',
                        'box-shadow:0 2px 8px rgba(10,14,39,0.10)',
                        'border:1.5px solid rgba(10,14,39,0.07)',
                        'transition:transform 0.18s,box-shadow 0.18s'
                    ].join(';');
                    gi.onmouseenter = function(){ gi.style.transform='scale(1.035)'; gi.style.boxShadow='0 6px 18px rgba(10,14,39,0.18)'; };
                    gi.onmouseleave = function(){ gi.style.transform=''; gi.style.boxShadow='0 2px 8px rgba(10,14,39,0.10)'; };
                    if (isV) {
                        gi.innerHTML = '<video src="'+url+'" style="width:100%;height:100%;object-fit:cover;" muted playsinline preload="metadata"></video>'
                            +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.22);pointer-events:none;">'
                            +'<div style="width:34px;height:34px;background:rgba(255,255,255,0.92);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.25);">'
                            +'<i class="fas fa-play" style="color:#0A0E27;font-size:0.75rem;margin-left:3px;"></i></div></div>';
                    } else {
                        gi.innerHTML = '<img src="'+url+'" alt="Media" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display=\'none\'">';
                    }
                    gi.addEventListener('click', function() {
                        var allUrls = Array.from(gal.querySelectorAll('[data-media-url]'))
                            .map(function(el){ return el.dataset.mediaUrl; });
                        var startIdx = allUrls.indexOf(url);
                        var mediaList = allUrls.map(function(u){
                            var v = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(u) || /\/video\/upload\//i.test(u);
                            return { url: u, type: v ? 'video/mp4' : 'image/jpeg' };
                        });
                        if (typeof showMarketplaceGallery === 'function') {
                            showMarketplaceGallery(mediaList, Math.max(0, startIdx));
                        } else {
                            window.open(url, '_blank');
                        }
                    });
                    gal.prepend(gi);
                });
            }

            
            function addReelToDashboardSlider(reelData) {
                const container = document.getElementById('dashboard-reels-container');
                const slider = document.getElementById('dashboard-reels-slider');
                if (!container || !slider) return;
                container.style.display = 'block';
                // FIX: tag the card with reelId so the Firestore listener can find
                // and upgrade it (blob→cloudinary URL) instead of creating a duplicate.
                if (reelData.reelId && slider.querySelector('[data-reel-id="'+reelData.reelId+'"]')) return;
                const card = document.createElement('div');
                card.className = 'dashboard-reel-card';
                card.dataset.navTarget = 'reels';
                if (reelData.reelId) card.dataset.reelId = reelData.reelId;
                card.innerHTML = `<video poster="${reelData.poster||''}" loop muted autoplay playsinline style="width:100%;height:100%;object-fit:cover;display:block;"><source src="${reelData.url}" type="video/mp4"></video><div class="reel-content"><div class="reel-user-info"><div class="avatar-placeholder square" style="width:35px;height:35px;"><img src="${userState.avatar}" alt="User portrait"></div><span>@${userState.username}</span></div><p>${formatWhatsAppText(reelData.caption||'')}</p></div>`;
                slider.prepend(card);
                return card; // return so caller can hold reference
            }
            
            function addMarketItemToDashboardSlider(marketData) {
                const container = document.getElementById('dashboard-market-container');
                const slider = document.getElementById('dashboard-market-slider');
                if (!container || !slider) return;

                container.style.display = 'block';

                const card = document.createElement('div');
                card.className = 'dashboard-market-card';
                card.dataset.navTarget = 'marketplace';
                 if (marketData.videoSrc) {
                    card.innerHTML = `<video src="${marketData.videoSrc}" autoplay loop muted></video><div class="dashboard-market-card-info"><h5>${marketData.name}</h5><p>${formatUsdPrice(marketData.price)}</p></div>`;
                } else {
                    card.innerHTML = `<img src="${marketData.img}" alt="${marketData.name}"><div class="dashboard-market-card-info"><h5>${marketData.name}</h5><p>${formatUsdPrice(marketData.price)}</p></div>`;
                }
                slider.prepend(card);
            }
            



            async function shareContent(shareData) {
                let copied = false;
                if (navigator.clipboard) {
                    try {
                        await navigator.clipboard.writeText(shareData.url);
                        showNotification('Link copied to clipboard!');
                        copied = true;
                    } catch (err) { console.error('Failed to copy link: ', err); }
                }

                if (navigator.share) {
                    try { await navigator.share(shareData); } 
                    catch (err) { if (err.name !== 'AbortError') { console.error('Web Share API Error:', err); } }
                } else if (!copied) {
                    showNotification('Sharing not supported on this browser.', 'error');
                }
                 rewardUserForAction('SHARE_POST');
                            if (typeof updateLiveInteractionCount === 'function') updateLiveInteractionCount('like');
            }
            
            function setupReelViewerObserver() {
                const reelViewerContainer = document.getElementById('reel-viewer-container');
                if (!reelViewerContainer) return; 

                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const video = entry.target.querySelector('video');
                        if (video) { 
                            if (entry.isIntersecting) {
                                video.play().catch(e => console.log("Autoplay was prevented for reel video.", e));
                            } else {
                                video.pause();
                            }
                        }
                    });
                }, { threshold: 0.5 });

                reelViewerContainer.querySelectorAll('.reel-viewer-item').forEach(item => {
                    observer.observe(item);
                });
            }

            
            let marketplaceGalleryState = {
                media: [],
                currentIndex: 0
            };


            function _stopGalleryVideo() {
                const v = document.querySelector('.gallery-main-image-container video');
                if (v) { try { v.pause(); v.src = ''; } catch(e) {} }
            }


            

            // --- RANKING REWARDS LOGIC ---
            const ranks = [
                { id: 'rank-1', name: 'Rising Star', followers: 500, reward: 50 },
                { id: 'rank-2', name: 'Community Voice', followers: 1000, reward: 100 },
                { id: 'rank-3', name: 'Influencer', followers: 5000, reward: 250 },
                { id: 'rank-4', name: 'Advocate', followers: 10000, reward: 500 },
                { id: 'rank-5', name: 'Leader', followers: 50000, reward: 1000 },
                { id: 'rank-6', name: 'Beacon', followers: 100000, reward: 2500 },
                { id: 'rank-7', name: 'Champion', followers: 250000, reward: 5000 },
                { id: 'rank-8', name: 'Ambassador', followers: 500000, reward: 10000 },
                { id: 'rank-9', name: 'Legend', followers: 1000000, reward: 25000 }
            ];

            function checkAndAwardRank(user) {
                if (user.followerCount < 500) return; 

                ranks.forEach(rank => {
                    if (user.followerCount >= rank.followers && !user.awardedRanks.has(rank.id)) {
                        if (impactMiningState.rankingPoolSpent + rank.reward <= RANKING_REWARDS_POOL) {
                            user.empyBalance += rank.reward;
                            user.awardedRanks.add(rank.id);
                            impactMiningState.rankingPoolSpent += rank.reward; 
                            
                            if (user.id === userState.id) {
                                showNotification('🎉 Congratulations! You have reached the rank of ' + rank.name + ' and earned ' + rank.reward + ' EMPY!', 'success');
                                updateWalletUI();
                                // Persist rank + balance
                                if (window.fbDb && userState.id) {
                                    window.fbDb.collection('users').doc(userState.id).update({
                                        empyBalance: userState.empyBalance,
                                        awardedRanks: Array.from(userState.awardedRanks)
                                    }).catch(function() {});
                                }
                            }
                        }
                    }
                });
            }

            // ── FIX 10: Followers/Following modal ───────────────────────
            window.showFollowersModal = function(tab) {
                var followers = Array.from(userState.followedUserIds || []);
                var overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
                var box = document.createElement('div');
                box.style.cssText = 'background:white;border-radius:20px;width:min(400px,92vw);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;';
                // Tabs
                var tabs = document.createElement('div');
                tabs.style.cssText = 'display:flex;border-bottom:1px solid rgba(10,14,39,0.08);';
                var tabFollowers = document.createElement('button');
                tabFollowers.style.cssText = 'flex:1;padding:14px;border:none;background:none;font-weight:700;cursor:pointer;color:var(--primary);';
                tabFollowers.textContent = 'Followers (' + (userState.followerCount||0) + ')';
                var tabFollowing = document.createElement('button');
                tabFollowing.style.cssText = 'flex:1;padding:14px;border:none;background:none;font-weight:600;cursor:pointer;color:var(--text-muted);';
                tabFollowing.textContent = 'Following (' + followers.length + ')';
                var closeBtn = document.createElement('button');
                closeBtn.style.cssText = 'padding:14px;border:none;background:none;cursor:pointer;font-size:1.2rem;color:var(--text-muted);';
                closeBtn.innerHTML = '&times;';
                closeBtn.onclick = function() { overlay.remove(); };
                tabs.appendChild(tabFollowers);
                tabs.appendChild(tabFollowing);
                tabs.appendChild(closeBtn);
                // Panels
                var panFollowers = document.createElement('div');
                panFollowers.style.cssText = 'overflow-y:auto;flex:1;padding:12px;';
                panFollowers.innerHTML = userState.followerCount > 0
                    ? '<p style="text-align:center;padding:20px;color:var(--text-muted);">Follower list synced from backend.</p>'
                    : '<p style="text-align:center;padding:20px;color:var(--text-muted);">No followers yet.</p>';
                var panFollowing = document.createElement('div');
                panFollowing.style.cssText = 'overflow-y:auto;flex:1;padding:12px;display:none;';
                if (followers.length > 0) {
                    followers.forEach(function(uid) {
                        var u = mockUsers[uid] || {};
                        var row = document.createElement('div');
                        row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(10,14,39,0.05);cursor:pointer;';
                        var img = document.createElement('img');
                        img.src = u.avatar || 'https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=40';
                        img.style.cssText = 'width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;';
                        var info = document.createElement('div');
                        info.innerHTML = '<strong style="display:block;">' + (u.fullName||'User') + '</strong><span style="font-size:0.8rem;color:var(--text-muted);">@' + (u.username||'user') + '</span>';
                        row.appendChild(img);
                        row.appendChild(info);
                        row.onclick = function() {
                            overlay.remove();
                            if (typeof renderUserProfile === 'function') {
                                window._viewingOtherProfile = (uid !== (window.userState && window.userState.id));
                                renderUserProfile(uid);
                                setTimeout(function() { window._viewingOtherProfile = false; }, 500);
                            }
                            if (typeof navigateTo === 'function') navigateTo('profile', true);
                        };
                        panFollowing.appendChild(row);
                    });
                } else {
                    panFollowing.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">Not following anyone yet.</p>';
                }
                // Tab switching
                tabFollowers.onclick = function() {
                    panFollowers.style.display = 'block'; panFollowing.style.display = 'none';
                    tabFollowers.style.fontWeight = '700'; tabFollowers.style.color = 'var(--primary)';
                    tabFollowing.style.fontWeight = '600'; tabFollowing.style.color = 'var(--text-muted)';
                };
                tabFollowing.onclick = function() {
                    panFollowers.style.display = 'none'; panFollowing.style.display = 'block';
                    tabFollowing.style.fontWeight = '700'; tabFollowing.style.color = 'var(--primary)';
                    tabFollowers.style.fontWeight = '600'; tabFollowers.style.color = 'var(--text-muted)';
                };
                box.appendChild(tabs);
                box.appendChild(panFollowers);
                box.appendChild(panFollowing);
                overlay.appendChild(box);
                document.body.appendChild(overlay);
                overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
                // Open on correct tab
                if (tab === 'following') tabFollowing.onclick();
            };

            // ── FIX 12b: View count observer removed ────────────────────
            // Duplicate observer removed - the global _viewCountObserver below
            // handles view counting for all sections. Two observers caused the
            // constant "2" bug (each incremented once = 0→1→2).

            // ── FIX 9: Click user avatar/name → go to their profile ─────
            document.addEventListener('click', function(e) {
                // Avatar or name inside a post header
                var storyHeader = e.target.closest('.story-header');
                if (!storyHeader) return;
                var clickedAvatar = e.target.closest('.avatar-placeholder') || e.target.closest('img');
                var clickedName   = e.target.closest('.story-user-info strong');
                if (!clickedAvatar && !clickedName) return;
                var post = storyHeader.closest('.impact-story');
                if (!post) return;
                var userId = post.dataset.userId;
                if (!userId || userId === (window.userState && window.userState.id)) return;
                e.preventDefault();
                e.stopPropagation();
                if (typeof renderUserProfile === 'function') {
                    window._viewingOtherProfile = (userId !== (window.userState && window.userState.id));
                    renderUserProfile(userId);
                    if (typeof navigateTo === 'function') navigateTo('profile', true);
                    // Auto-clear flag after navigation so own profile nav works again
                    setTimeout(function() { window._viewingOtherProfile = false; }, 500);
                }
            });


            // ── GLOBAL: View count IntersectionObserver ─────────────────
            // Watches all .impact-story elements across ALL sections
            // FIX (live view counts): previously this only ever wrote to the
            // local DOM span, so views never reached Firestore — counts reset
            // on refresh and never synced across devices/users. Now mirrors
            // the same atomic-increment pattern already used by shareCount
            // (app-thread.js _empShare) and downloadCount (app-feed.js).
            (function() {
                if (window._viewCountObserver) return; // only one instance
                var seen = new Set();
                function _viewsFV() {
                    return (window.firebase && window.firebase.firestore &&
                            window.firebase.firestore.FieldValue) || null;
                }
                function _viewsInc(n) {
                    var fv = _viewsFV();
                    return (fv && typeof fv.increment === 'function') ? fv.increment(n) : n;
                }
                // FIX (views writing to wrong collection): this observer used to
                // hardcode .collection('posts') for every card, regardless of what
                // kind of card it actually was. crisis-report cards live in
                // 'crisis_reports', not 'posts' -- so every view-count tick on a
                // crisis card permission-denied (resource.data never exists in
                // 'posts' for those docs). This mirrors the exact same routing
                // logic as _col45() in app-fix-final.js (§45), which already
                // correctly routes likes/shares/etc. -- views now use the same
                // rule so both code paths agree on where a given post's
                // engagement fields actually live.
                function _viewsCol(el) {
                    if (el && el.dataset && el.dataset.collection) return el.dataset.collection;
                    if (el && el.classList && el.classList.contains('crisis-report')) return 'crisis_reports';
                    if (el && el.classList && el.classList.contains('sos-request'))  return 'posts';
                    if (el && el.classList && el.classList.contains('biz-post-card')) return 'business_posts';
                    return 'posts';
                }
                window._viewCountObserver = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (!entry.isIntersecting) return;
                        var el = entry.target;
                        var pid = el.dataset.postId;
                        if (!pid || seen.has(pid)) return;
                        seen.add(pid);
                        var vc = el.querySelector('.view-count');
                        if (vc) vc.textContent = (parseInt(vc.textContent)||0) + 1;
                        // Persist the view to Firestore so the count is real,
                        // survives refresh, and syncs live to every other
                        // viewer via the existing posts 'modified' listener.
                        try {
                            if (window._firebaseLoaded && window.fbDb) {
                                window.fbDb.collection(_viewsCol(el)).doc(pid).update({
                                    views: _viewsInc(1)
                                }).catch(function () {});
                            }
                        } catch (eViews) {}
                        // Add video duration badge
                        el.querySelectorAll('video:not([data-dur-done])').forEach(function(v) {
                            v.dataset.durDone = '1';
                            v.addEventListener('loadedmetadata', function() {
                                if (!isFinite(v.duration) || v.duration < 1) return;
                                var s = Math.round(v.duration);
                                var badge = document.createElement('div');
                                badge.style.cssText = 'position:absolute;bottom:6px;right:8px;background:rgba(0,0,0,0.72);color:white;font-size:0.68rem;font-weight:700;padding:2px 6px;border-radius:5px;pointer-events:none;z-index:4;';
                                badge.textContent = Math.floor(s/60)+':'+(s%60<10?'0':'')+s%60;
                                var wrap = v.parentElement;
                                if (wrap) { wrap.style.position='relative'; wrap.appendChild(badge); }
                            });
                        });
                    });
                }, { threshold: 0.55 });

                // Observe existing + future posts
                function _observeAll() {
                    document.querySelectorAll('.impact-story:not([data-obs])').forEach(function(p) {
                        p.dataset.obs = '1';
                        window._viewCountObserver.observe(p);
                    });
                }
                var _mutObs = new MutationObserver(_observeAll);
                _mutObs.observe(document.body, { childList: true, subtree: true });
                setTimeout(_observeAll, 1000);
            })();


            // ── RESTORE BOOKMARKED STATE ──────────────────────────────────
            // Reads the signed-in user's entire bookmarks list ONCE per
            // restore cycle (not once per card — much cheaper than a
            // per-post read, since bookmarks live in a separate per-user
            // subcollection rather than as a field on the post itself), then
            // marks any currently-rendered card whose id is in that set.
            (function() {
                var _bmCache = null;       // Set of bookmarked postIds, or null until first load
                var _bmLoading = false;

                function _fetchBookmarks() {
                    if (_bmLoading) return;
                    if (typeof userState === 'undefined' || !userState.id) return;
                    if (!window._firebaseLoaded || !window.fbDb) return;
                    _bmLoading = true;
                    window.fbDb.collection('users').doc(userState.id).collection('bookmarks').get()
                        .then(function(snap) {
                            _bmCache = new Set();
                            snap.forEach(function(d) { _bmCache.add(d.id); });
                            _applyBookmarkState();
                        })
                        .catch(function() { _bmLoading = false; })
                        .then(function() { _bmLoading = false; });
                }

                function _applyBookmarkState() {
                    if (!_bmCache) return;
                    document.querySelectorAll('.bookmark-btn[data-post-id], [data-post-id] .bookmark-btn').forEach(function(btn) {
                        if (btn._bmApplied) return;
                        var card = btn.closest('[data-post-id]');
                        var pid = card && card.dataset.postId;
                        if (!pid) return;
                        btn._bmApplied = true;
                        var isOn = _bmCache.has(pid);
                        if (!isOn) return; // default state is already "not bookmarked"
                        btn.classList.add('bookmarked');
                        var svg = btn.querySelector('svg');
                        if (svg) svg.style.fill = 'currentColor';
                        var icon = btn.querySelector('i');
                        if (icon) icon.className = 'fas fa-bookmark';
                    });
                }

                document.addEventListener('empyrean-init-done', function() { setTimeout(_fetchBookmarks, 1000); });
                document.addEventListener('empyrean-section-change', function() { setTimeout(_applyBookmarkState, 400); });

                var _bmFeedObs = new MutationObserver(function(muts) {
                    if (muts.some(function(m) { return m.addedNodes.length > 0; })) {
                        setTimeout(_applyBookmarkState, 250);
                    }
                });
                (function _watchForFeed() {
                    var fc = document.getElementById('feed-container');
                    if (!fc) { setTimeout(_watchForFeed, 1500); return; }
                    _bmFeedObs.observe(fc, { childList: true, subtree: false });
                    _fetchBookmarks();
                })();
            })();


            // ── FEATURE: SAVED POSTS SECTION ───────────────────────────────
            // Renders the user's bookmarked posts into #saved-posts-container.
            // Each bookmark doc only stores {postId, collection, bookmarkedAt} —
            // the actual post content is fetched fresh from its real collection
            // each time the section is opened, so edits/deletes/updated counts
            // on the original post are always reflected here too.
            //
            // Results are cached in _savedPostsCache so the filter dropdown
            // (All / Posts / Crisis Reports / Business Posts) can re-render
            // instantly without a fresh Firestore round-trip every time the
            // person just wants to narrow what they're looking at.
            var _savedPostsCache = null;

            function renderSavedPosts() {
                var container = document.getElementById('saved-posts-container');
                var emptyState = document.getElementById('saved-posts-empty-state');
                if (!container) return;

                if (typeof userState === 'undefined' || !userState.id) {
                    if (emptyState) emptyState.style.display = '';
                    return;
                }
                if (!window._firebaseLoaded || !window.fbDb) return;

                window.fbDb.collection('users').doc(userState.id).collection('bookmarks')
                    .orderBy('bookmarkedAt', 'desc').get()
                    .then(function(snap) {
                        if (snap.empty) {
                            _savedPostsCache = [];
                            _renderSavedPostsFiltered();
                            return;
                        }

                        var bookmarks = [];
                        snap.forEach(function(d) { bookmarks.push(d.data()); });

                        // Fetch every underlying post in parallel, then render in
                        // original bookmark order (not fetch-completion order).
                        Promise.all(bookmarks.map(function(bm) {
                            var col = bm.collection || 'posts';
                            return window.fbDb.collection(col).doc(bm.postId).get()
                                .then(function(doc) { return doc.exists ? { bm: bm, data: doc.data(), col: col } : null; })
                                .catch(function() { return null; });
                        })).then(function(results) {
                            _savedPostsCache = results.filter(function(r) { return !!r; }); // drop posts deleted since bookmarking
                            _renderSavedPostsFiltered();
                        });
                    })
                    .catch(function(err) {
                        console.warn('[SavedPosts] fetch failed:', err && err.message);
                    });
            }
            window.renderSavedPosts = renderSavedPosts;

            // Paints _savedPostsCache into the container, applying whatever
            // collection filter is currently selected. Safe to call any time
            // after the initial fetch (e.g. on filter change) with no network cost.
            function _renderSavedPostsFiltered() {
                var container = document.getElementById('saved-posts-container');
                var emptyState = document.getElementById('saved-posts-empty-state');
                if (!container || !_savedPostsCache) return;

                var filterEl = document.getElementById('saved-posts-filter');
                var filter = filterEl ? filterEl.value : 'all';
                var results = filter === 'all'
                    ? _savedPostsCache
                    : _savedPostsCache.filter(function(r) { return r.col === filter; });

                container.querySelectorAll('.saved-post-card').forEach(function(c) { c.remove(); });
                results.forEach(function(r) {
                    container.appendChild(_buildSavedPostCard(r.data, r.bm.postId, r.col));
                });

                if (emptyState) {
                    if (results.length > 0) {
                        emptyState.style.display = 'none';
                    } else {
                        emptyState.style.display = '';
                        // Distinguish "nothing saved at all" from "nothing saved that
                        // matches this filter" so the message stays accurate.
                        var h3 = emptyState.querySelector('h3');
                        var p  = emptyState.querySelector('p');
                        if (_savedPostsCache.length === 0) {
                            if (h3) h3.textContent = 'No Saved Posts Yet';
                            if (p)  p.textContent  = 'Tap the bookmark icon on any post to save it here for quick access later.';
                        } else {
                            if (h3) h3.textContent = 'No Matches in This Filter';
                            if (p)  p.textContent  = 'Try a different filter, or choose "All Saved" to see everything.';
                        }
                    }
                }
            }
            window._renderSavedPostsFiltered = _renderSavedPostsFiltered;

            // Filter dropdown — instant re-render from cache, no refetch.
            document.addEventListener('change', function(e) {
                if (e.target && e.target.id === 'saved-posts-filter') {
                    _renderSavedPostsFiltered();
                }
            });

            // Clear All — deletes every bookmark doc for this user in one batch,
            // then clears the cache/UI. Confirmed first since it's irreversible
            // (matches the confirm() pattern already used elsewhere in this file
            // for destructive actions, e.g. clearing a live goal).
            document.addEventListener('click', function(e) {
                var btn = e.target && e.target.closest && e.target.closest('#saved-posts-clear-all');
                if (!btn) return;
                if (!_savedPostsCache || _savedPostsCache.length === 0) {
                    showNotification('No saved posts to clear.', 'info');
                    return;
                }
                if (typeof userState === 'undefined' || !userState.id || !window.fbDb) return;
                if (!confirm('Remove all ' + _savedPostsCache.length + ' saved post(s)? This cannot be undone.')) return;

                var batch = window.fbDb.batch();
                var bmCol = window.fbDb.collection('users').doc(userState.id).collection('bookmarks');
                _savedPostsCache.forEach(function(r) { batch.delete(bmCol.doc(r.bm.postId)); });

                btn.disabled = true;
                batch.commit().then(function() {
                    // Keep every visible bookmark icon elsewhere (feed, thread) in sync.
                    document.querySelectorAll('.bookmark-btn.bookmarked, .vf-th-act-btn.bookmarked').forEach(function(b) {
                        b.classList.remove('bookmarked');
                        var svg = b.querySelector('svg'); if (svg) svg.style.fill = 'none';
                        var icon = b.querySelector('i');  if (icon) icon.className = 'far fa-bookmark';
                    });
                    _savedPostsCache = [];
                    _renderSavedPostsFiltered();
                    showNotification('All saved posts removed.', 'success');
                }).catch(function(err) {
                    showNotification('Failed to clear saved posts — please try again.', 'error');
                    console.warn('[SavedPosts] clear-all failed:', err && err.message);
                }).then(function() { btn.disabled = false; });
            });


            function _buildSavedPostCard(d, postId, col) {
                var card = document.createElement('div');
                card.className = 'saved-post-card impact-story';
                card.dataset.postId = postId;
                card.dataset.collection = col;

                var authorName = d.authorName || d.username || d.retweeterName || 'User';
                var authorAvatar = d.authorAvatar || d.avatar || d.retweeterAvatar ||
                    ('https://ui-avatars.com/api/?name=' + encodeURIComponent(authorName) + '&background=1B2B8B&color=fff&size=80');
                var text = d.text || d.story || d.description || '';

                // FIX (full content): previously this hard-truncated to 280
                // chars with no way to read the rest, and only showed the
                // FIRST media item even when a post had several. Saved posts
                // now get the same "Read more / Show less" treatment as the
                // main feed (app-feed.js _withReadMore) and render every
                // image/video in d.media, not just d.media[0].
                var escapedText = _escSaved(text);
                var textHTML;
                if (escapedText.length <= 280) {
                    textHTML = escapedText;
                } else {
                    var _preview = escapedText.slice(0, 280);
                    var _rest    = escapedText.slice(280);
                    textHTML = _preview
                        + '<span class="post-text-overflow">…</span>'
                        + '<span class="post-text-rest" style="display:none;">' + _rest + '</span>'
                        + '<br><a href="#" class="post-read-more" style="font-size:0.82rem;font-weight:700;'
                        + 'color:var(--secondary);text-decoration:none;display:inline-block;margin-top:4px;">Read more ▼</a>'
                        + '<a href="#" class="post-read-less" style="font-size:0.82rem;font-weight:700;'
                        + 'color:var(--secondary);text-decoration:none;display:none;margin-top:4px;">Show less ▲</a>';
                }

                // Gather every media item (images + videos), not just the first.
                // d.media entries can be plain URL strings or {url,type} objects,
                // matching the same shapes app-feed.js already handles.
                var mediaList = Array.isArray(d.media) ? d.media : (d.origImg ? [d.origImg] : []);
                var mediaHTML = '';
                if (mediaList.length > 0) {
                    var mc = mediaList.length;
                    var ml = mc === 1 ? 'solo' : mc === 2 ? 'duo' : mc === 3 ? 'trio' : 'grid';
                    mediaHTML = '<div class="story-media-container" data-count="' + mc + '" data-layout="' + ml + '">';
                    mediaList.forEach(function(item, mi) {
                        var url = (typeof item === 'string') ? item : (item && (item.url || item._cloudUrl)) || '';
                        if (!url || url.startsWith('blob:')) return;
                        var declaredType = (typeof item === 'object' && item && item.type) || '';
                        var isVid = declaredType.startsWith('video/')
                            || /\/video\/upload\//i.test(url)
                            || /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url);
                        mediaHTML += '<div class="story-media-item" data-index="' + mi + '">';
                        if (isVid) {
                            mediaHTML += '<video src="' + _escSaved(url) + '" class="story-video" controls preload="metadata"'
                                + ' loading="lazy" playsinline onerror="this.closest(\'.story-media-item\').style.display=\'none\'"></video>';
                        } else {
                            mediaHTML += '<img src="' + _escSaved(url) + '" class="story-main-image" alt="Post media"'
                                + ' loading="lazy" onerror="this.closest(\'.story-media-item\').style.display=\'none\'">';
                        }
                        mediaHTML += '</div>';
                    });
                    mediaHTML += '</div>';
                }

                card.innerHTML =
                    '<div class="story-header" style="display:flex;align-items:center;gap:10px;padding:12px 14px;">' +
                        '<div class="avatar-placeholder" style="width:40px;height:40px;min-width:40px;border-radius:50%;overflow:hidden;">' +
                            '<img src="' + authorAvatar + '" style="width:100%;height:100%;object-fit:cover;" alt="">' +
                        '</div>' +
                        '<div class="story-user-info" style="flex:1;"><strong>' + _escSaved(authorName) + '</strong></div>' +
                        '<button class="saved-remove-btn" title="Remove from Saved" ' +
                            'style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;padding:6px;">' +
                            '<i class="fas fa-bookmark" style="color:#1D9BF0;"></i>' +
                        '</button>' +
                    '</div>' +
                    '<div class="story-content" style="padding:0 14px 10px;"><p>' + textHTML + '</p></div>' +
                    mediaHTML;

                card.querySelector('.saved-remove-btn').addEventListener('click', function(e) {
                    e.stopPropagation();
                    window.fbDb.collection('users').doc(userState.id).collection('bookmarks').doc(postId).delete()
                        .then(function() {
                            card.remove();
                            showNotification('Removed from Bookmarks', 'success');
                            // Keep the cache in sync so the filter dropdown and Clear
                            // All button (which both read _savedPostsCache, not the
                            // DOM) don't act on a post that's already been removed.
                            if (_savedPostsCache) {
                                _savedPostsCache = _savedPostsCache.filter(function(r) { return r.bm.postId !== postId; });
                            }
                            var container = document.getElementById('saved-posts-container');
                            var emptyState = document.getElementById('saved-posts-empty-state');
                            if (container && emptyState && container.querySelectorAll('.saved-post-card').length === 0) {
                                emptyState.style.display = '';
                            }
                            // Keep the source card's bookmark icon in sync if it's
                            // still on screen elsewhere (feed, thread view).
                            document.querySelectorAll('[data-post-id="' + postId + '"] .bookmark-btn, [data-post-id="' + postId + '"] .vf-th-act-btn[data-action="bookmark"]').forEach(function(btn) {
                                btn.classList.remove('bookmarked');
                                var svg = btn.querySelector('svg');
                                if (svg) svg.style.fill = 'none';
                                var icon = btn.querySelector('i');
                                if (icon) icon.className = 'far fa-bookmark';
                            });
                        })
                        .catch(function(err) {
                            showNotification('Failed to remove bookmark — please try again.', 'error');
                            console.warn('[SavedPosts] remove failed:', err && err.message);
                        });
                });


                card.addEventListener('click', function(e) {
                    // Don't open the thread view when the tap was actually on
                    // Read more/Show less (handled by its own delegated
                    // listener) or directly on a video's native controls.
                    if (e.target.closest('.post-read-more, .post-read-less, video')) return;
                    if (typeof window._vfOpenThread === 'function') window._vfOpenThread(card);
                });

                return card;
            }

            function _escSaved(s) {
                return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            }

            document.addEventListener('empyrean-section-change', function(e) {
                if (e && e.detail && e.detail.section === 'saved-posts') {
                    setTimeout(renderSavedPosts, 50);
                }
            });


            // ── FEATURE: DOWNLOAD LOG SECTION ──────────────────────────────
            // Renders the user's downloaded-file history into
            // #download-log-container. The write side lives next to the
            // actual download logic above (one doc per file, under
            // users/{uid}/downloads/{id}); this is purely the read/render
            // side, built the same way as Saved Posts just above.
            var _downloadLogCache = null;

            function renderDownloadLog() {
                if (typeof userState === 'undefined' || !userState.id) return;
                if (!window._firebaseLoaded || !window.fbDb) return;

                // FIX (permissions): users/{uid}/downloads was rejected by the
                // live Firestore Rules ("Missing or insufficient permissions") —
                // that subcollection was never allowlisted server-side and this
                // client can't deploy rules. Root-level `downloads` + a userId
                // field mirrors the `notifications` collection, which is already
                // proven to read/write correctly in this app. Sorted client-side
                // so no composite index is required either.
                window.fbDb.collection('downloads')
                    .where('userId', '==', userState.id).get()
                    .then(function(snap) {
                        _downloadLogCache = [];
                        snap.forEach(function(d) { _downloadLogCache.push({ id: d.id, data: d.data() }); });
                        _downloadLogCache.sort(function(a, b) {
                            var at = (a.data.downloadedAt && a.data.downloadedAt.toDate) ? a.data.downloadedAt.toDate().getTime() : new Date(a.data.downloadedAt || 0).getTime();
                            var bt = (b.data.downloadedAt && b.data.downloadedAt.toDate) ? b.data.downloadedAt.toDate().getTime() : new Date(b.data.downloadedAt || 0).getTime();
                            return bt - at;
                        });
                        _renderDownloadLogFiltered();
                    })
                    .catch(function(err) {
                        console.warn('[DownloadLog] fetch failed:', err && err.message);
                        showNotification('Could not load download log — please retry.', 'error');
                    });
            }
            window.renderDownloadLog = renderDownloadLog;

            function _renderDownloadLogFiltered() {
                var container  = document.getElementById('download-log-container');
                var emptyState = document.getElementById('download-log-empty-state');
                if (!container || !_downloadLogCache) return;

                var filterEl = document.getElementById('download-log-filter');
                var filter = filterEl ? filterEl.value : 'all';
                var results = filter === 'all'
                    ? _downloadLogCache
                    : _downloadLogCache.filter(function(r) { return r.data.type === filter; });

                container.querySelectorAll('.download-log-item').forEach(function(c) { c.remove(); });
                results.forEach(function(r) {
                    container.appendChild(_buildDownloadLogItem(r.data, r.id));
                });

                if (emptyState) {
                    if (results.length > 0) {
                        emptyState.style.display = 'none';
                    } else {
                        emptyState.style.display = '';
                        var h3 = emptyState.querySelector('h3');
                        var p  = emptyState.querySelector('p');
                        if (_downloadLogCache.length === 0) {
                            if (h3) h3.textContent = 'No Downloads Yet';
                            if (p)  p.textContent  = 'Media you download from posts will be logged here for quick access later.';
                        } else {
                            if (h3) h3.textContent = 'No Matches in This Filter';
                            if (p)  p.textContent  = 'Try a different filter, or choose "All Downloads" to see everything.';
                        }
                    }
                }
            }
            window._renderDownloadLogFiltered = _renderDownloadLogFiltered;

            document.addEventListener('change', function(e) {
                if (e.target && e.target.id === 'download-log-filter') {
                    _renderDownloadLogFiltered();
                }
            });

            // Clear All — deletes every download-log doc for this user in one
            // batch. Confirmed first, same irreversible-action pattern used
            // by Saved Posts' Clear All just above.
            document.addEventListener('click', function(e) {
                var btn = e.target && e.target.closest && e.target.closest('#download-log-clear-all');
                if (!btn) return;
                if (!_downloadLogCache || _downloadLogCache.length === 0) {
                    showNotification('No downloads to clear.', 'info');
                    return;
                }
                if (typeof userState === 'undefined' || !userState.id || !window.fbDb) return;
                if (!confirm('Clear all ' + _downloadLogCache.length + ' download log entries? This only clears the log — it does not delete files already saved to your device.')) return;

                var batch = window.fbDb.batch();
                var dlCol = window.fbDb.collection('downloads');
                _downloadLogCache.forEach(function(r) { batch.delete(dlCol.doc(r.id)); });

                btn.disabled = true;
                batch.commit().then(function() {
                    _downloadLogCache = [];
                    _renderDownloadLogFiltered();
                    showNotification('Download log cleared.', 'success');
                }).catch(function(err) {
                    showNotification('Failed to clear download log — please try again.', 'error');
                    console.warn('[DownloadLog] clear-all failed:', err && err.message);
                }).then(function() { btn.disabled = false; });
            });

            function _buildDownloadLogItem(d, logId) {
                var item = document.createElement('div');
                item.className = 'download-log-item';
                item.dataset.logId = logId;
                item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(10,14,39,0.06);';

                var isVid = d.type === 'video';
                var thumbHTML = isVid
                    ? '<div style="width:52px;height:52px;border-radius:8px;background:#0A0E27;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-video" style="color:white;"></i></div>'
                    : '<img src="' + _escSaved(d.url) + '" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;" loading="lazy">';

                var whenText = '';
                try {
                    var dt = d.downloadedAt && d.downloadedAt.toDate ? d.downloadedAt.toDate() : new Date(d.downloadedAt);
                    if (!isNaN(dt.getTime())) whenText = dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                } catch (e) {}

                item.innerHTML =
                    thumbHTML +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-weight:600;font-size:0.9rem;color:var(--primary);">' +
                            (isVid ? 'Video' : 'Image') + ' download' +
                        '</div>' +
                        '<div style="font-size:0.78rem;color:#888;">' + _escSaved(whenText) + '</div>' +
                    '</div>' +
                    '<a href="' + _escSaved(d.url) + '" target="_blank" rel="noopener noreferrer" title="Open" ' +
                        'style="color:var(--secondary);padding:6px;"><i class="fas fa-external-link-alt"></i></a>' +
                    '<button class="download-log-remove-btn" title="Remove from log" ' +
                        'style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;padding:6px;">' +
                        '<i class="fas fa-times"></i>' +
                    '</button>';

                item.querySelector('.download-log-remove-btn').addEventListener('click', function() {
                    window.fbDb.collection('downloads').doc(logId).delete()
                        .then(function() {
                            item.remove();
                            if (_downloadLogCache) {
                                _downloadLogCache = _downloadLogCache.filter(function(r) { return r.id !== logId; });
                            }
                            var container = document.getElementById('download-log-container');
                            var emptyState = document.getElementById('download-log-empty-state');
                            if (container && emptyState && container.querySelectorAll('.download-log-item').length === 0) {
                                emptyState.style.display = '';
                            }
                        })
                        .catch(function(err) {
                            showNotification('Failed to remove entry — please try again.', 'error');
                            console.warn('[DownloadLog] remove failed:', err && err.message);
                        });
                });

                return item;
            }

            document.addEventListener('empyrean-section-change', function(e) {
                if (e && e.detail && e.detail.section === 'download-log') {
                    setTimeout(renderDownloadLog, 50);
                }
            });


            // ── LIVE STREAM INTERACTION COUNTER ──────────────────────────
            // Updates the live stream stats bar for any interaction type
            function updateLiveInteractionCount(type) {
                var liveModal = document.getElementById('go-live-modal-overlay');
                if (!liveModal || !liveModal.classList.contains('show')) return;
                var map = {
                    like:     document.getElementById('live-like-count'),
                    viewer:   document.getElementById('live-viewer-count'),
                    comment:  document.getElementById('live-like-count'), // reuse like area for comments
                };
                var el = map[type] || document.getElementById('live-like-count');
                if (el) {
                    var cur = parseInt(el.textContent.replace(/[^0-9]/g,'')) || 0;
                    el.textContent = (cur + 1).toLocaleString();
                    // Pulse animation
                    el.style.transform = 'scale(1.4)';
                    el.style.transition = 'transform 0.15s';
                    setTimeout(function() { el.style.transform = 'scale(1)'; }, 200);
                }
            }
            window.updateLiveInteractionCount = updateLiveInteractionCount;

            // --- MASTER EVENT LISTENERS ---

        // ── @ and # TAG HIGHLIGHTER (surgical, applied after formatWhatsAppText) ──
        function _highlightMentionsAndTags(html) {
            if (!html || typeof html !== 'string') return html;
            // Highlight @mentions (skip inside href/src attributes)
            html = html.replace(/(?<![=\w])@([a-zA-Z0-9_\.]{1,32})/g, function(m, name) {
                return '<span class="mention-tag" data-username="' + name + '" onclick="(function(){if(typeof renderUserProfile===\'function\'){window._viewingOtherProfile=true;renderUserProfile(\'@'+name+'\');if(typeof navigateTo===\'function\')navigateTo(\'profile\',true);}})()" style="color:var(--secondary);font-weight:600;cursor:pointer;">@' + name + '</span>';
            });
            // Highlight #hashtags
            html = html.replace(/(?<![=\w&#])#([a-zA-Z0-9_]{1,50})/g, function(m, tag) {
                return '<span class="hashtag-tag" data-tag="' + tag + '" onclick="(function(){if(typeof window._incrementTag===\'function\')window._incrementTag(\'\'+tag+\'\');})()" style="color:var(--secondary);font-weight:600;cursor:pointer;">#' + tag + '</span>';
            });
            return html;
        }
        window._highlightMentionsAndTags = _highlightMentionsAndTags;

            // ── DOWNLOAD PROGRESS HELPERS ───────────────────────────────────
            // Streams a URL via fetch + ReadableStream, reporting real
            // byte-progress (0-100) through onProgress as chunks arrive.
            // Falls back to a normal non-streamed fetch (no progress callback,
            // jumps straight to 100 on completion) if the response has no
            // Content-Length header (some CDNs omit it) or the browser lacks
            // ReadableStream support.
            function _fetchWithProgress(url, onProgress) {
                return fetch(url).then(function(res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const total = parseInt(res.headers.get('Content-Length') || '0', 10);
                    if (!total || !res.body || !res.body.getReader) {
                        return res.blob(); // no length / no streaming support — can't track progress
                    }
                    const reader = res.body.getReader();
                    let received = 0;
                    const chunks = [];
                    return new Promise(function(resolve, reject) {
                        function pump() {
                            reader.read().then(function(result) {
                                if (result.done) {
                                    resolve(new Blob(chunks));
                                    return;
                                }
                                chunks.push(result.value);
                                received += result.value.length;
                                if (onProgress) onProgress(Math.min(99, Math.round((received / total) * 100)));
                                pump();
                            }).catch(reject);
                        }
                        pump();
                    });
                });
            }

            // Builds and manages a small floating progress pill anchored next
            // to the download button. One row per file for multi-image posts.
            function _createDownloadTracker(btnEl, fileCount) {
                const wrap = document.createElement('div');
                wrap.className = 'dl-progress-tracker';
                wrap.style.cssText =
                    'position:absolute;z-index:50;background:rgba(10,14,39,0.92);color:#fff;' +
                    'border-radius:10px;padding:8px 12px;font-size:0.72rem;font-weight:600;' +
                    'min-width:140px;box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:none;';
                const rows = [];
                for (let i = 0; i < fileCount; i++) {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:3px 0;';
                    const label = document.createElement('span');
                    label.style.cssText = 'white-space:nowrap;min-width:32px;';
                    label.textContent = '0%';
                    const track = document.createElement('div');
                    track.style.cssText = 'flex:1;height:4px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden;';
                    const fill = document.createElement('div');
                    fill.style.cssText = 'height:100%;width:0%;background:#F5C518;border-radius:3px;transition:width 0.15s;';
                    track.appendChild(fill);
                    row.appendChild(track);
                    row.appendChild(label);
                    wrap.appendChild(row);
                    rows.push({ fill: fill, label: label });
                }

                // Anchor near the button — position:relative on a wrapping
                // span is unnecessary since we use position:fixed off the
                // button's own bounding rect, which stays correct on scroll
                // because we recompute it once at creation time (downloads
                // are short-lived; not worth a scroll listener).
                if (btnEl) {
                    const rect = btnEl.getBoundingClientRect();
                    wrap.style.position = 'fixed';
                    wrap.style.left = Math.max(8, rect.left - 70) + 'px';
                    wrap.style.top = (rect.top - (fileCount * 26) - 14) + 'px';
                }
                document.body.appendChild(wrap);

                return {
                    update: function(index, pct) {
                        const row = rows[index];
                        if (!row) return;
                        const clamped = Math.max(0, Math.min(100, pct));
                        row.fill.style.width = clamped + '%';
                        row.label.textContent = clamped + '%';
                    },
                    finish: function() {
                        wrap.style.transition = 'opacity 0.4s';
                        wrap.style.opacity = '0';
                        setTimeout(function() { wrap.remove(); }, 500);
                    }
                };
            }

            function setupMasterEventListeners() {
                document.body.addEventListener('click', async function(e) {
                    const target = e.target;
                    const closest = (selector) => target.closest(selector);

                    // --- SECTION CREATE PANEL TOGGLE (+/× button) ---
                    const sectionToggleBtn = closest('.section-create-toggle-btn');
                    if (sectionToggleBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        var panelId = sectionToggleBtn.dataset.panel;
                        var panel = document.getElementById(panelId);
                        var icon = sectionToggleBtn.querySelector('.section-create-icon');
                        if (panel) {
                            var isOpen = panel.style.display !== 'none';
                            panel.style.display = isOpen ? 'none' : 'block';
                            if (icon) {
                                icon.textContent = isOpen ? '+' : '×';
                                icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(45deg)';
                            }
                        }
                        return;
                    }

                    // --- LIVE STREAM CLICKS ---
                    const joinLiveBtn = closest('.join-live-btn');
                    if (joinLiveBtn) {
                        const hostName = joinLiveBtn.dataset.hostName;
                        const hostAvatar = joinLiveBtn.dataset.hostAvatar;
                        const background = joinLiveBtn.dataset.background;
                        const hostId = joinLiveBtn.dataset.hostId;
                        
                        liveStreamData = {
                            ...liveStreamData, 
                            isLive: true,
                            isRecording: false,
                            title: joinLiveBtn.dataset.streamTitle,
                            description: '', 
                            startTime: Date.now(),
                            streamId: joinLiveBtn.dataset.streamId,
                            background: background,
                            customBackgroundFile: null, 
                            isMicMuted: false, 
                            isVideoMuted: false,
                            isScreenSharing: false,
                            hostUserId: hostId,
                            guests: [],
                            joinRequests: [],
                            liveGoal: null, 
                            fanClubActive: false,
                            activeGame: null,
                            pinnedMessage: null, 
                            hostInSmallScreen: false, 
                            sentMessages: [], 
                            rewardInterval: null 
                        };

                        var lhn = document.getElementById('live-host-name');
                        var lhu = document.getElementById('live-host-username');
                        var lha = document.getElementById('live-host-avatar');
                        var lsha = document.getElementById('live-stream-host-avatar');
                        var hfa = document.getElementById('host-video-fallback-avatar');
                        if (lhn) lhn.textContent = hostName || 'Host';
                        if (lhu) lhu.textContent = hostName ? '@' + hostName.toLowerCase().replace(/\s+/g,'') : '';
                        if (lha)  { lha.src  = hostAvatar || ''; lha.style.display  = hostAvatar ? '' : 'none'; }
                        if (lsha) { lsha.src = hostAvatar || ''; lsha.style.display = 'none'; } // hidden -- Agora shows real video
                        if (hfa)  { hfa.src  = hostAvatar || ''; hfa.style.display  = 'none'; } // hidden by default
                        
                        goLiveModal.style.display = 'flex';
                        goLiveModal.classList.add('show');
                        document.body.classList.add('modal-open');

                        // Clear video src -- Agora will inject the real stream
                        const hostMainVideo = document.getElementById('host-main-video');
                        if (hostMainVideo) {
                            hostMainVideo.src = '';
                            hostMainVideo.style.display = 'none';
                        }

                        // Hide the static avatar container -- it obstructs the Agora video feed
                        const avatarContainer = document.getElementById('host-avatar-container');
                        if (avatarContainer) avatarContainer.style.display = 'none';

                        // Show connecting spinner
                        var liveBody = document.querySelector('.main-host-video');
                        if (liveBody && !document.getElementById('agora-connecting-msg')) {
                            var connectMsg = document.createElement('div');
                            connectMsg.id = 'agora-connecting-msg';
                            connectMsg.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);color:white;gap:14px;z-index:10;';
                            connectMsg.innerHTML =
                                '<div style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.25);border-top-color:white;border-radius:50%;animation:spin 1s linear infinite;"></div>' +
                                '<span style="font-size:0.9rem;opacity:0.85;">Connecting to live stream...</span>';
                            if (!document.getElementById('spin-style')) {
                                var ss = document.createElement('style');
                                ss.id = 'spin-style';
                                ss.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
                                document.head.appendChild(ss);
                            }
                            liveBody.style.position = 'relative';
                            liveBody.appendChild(connectMsg);
                            setTimeout(function() {
                                var m = document.getElementById('agora-connecting-msg');
                                if (m) m.remove();
                            }, 12000);
                        }

                        if (!isGuest && userState.id === liveStreamData.hostUserId) {
                            if (liveStreamData.rewardInterval) clearInterval(liveStreamData.rewardInterval); 
                            liveStreamData.rewardInterval = setInterval(() => {
                                rewardUserForAction('LIVE_STREAM_INTERVAL');
                            }, 300000); 
                        }
                        
                        // Show/hide viewer request button based on whether current user is host
                        const requestJoinBtn = document.getElementById('live-request-join-btn');
                        if (requestJoinBtn) {
                            const isHost = !isGuest && userState.id === liveStreamData.hostUserId;
                            requestJoinBtn.style.display = isHost ? 'none' : 'flex';
                        }

                        updateLiveUI(); 
                        return; 
                    }

                    if(closest('.options-btn')){
                        e.preventDefault();
                        const menu=closest('.options-btn').nextElementSibling;
                        if(menu){
                            document.querySelectorAll('.options-menu.show').forEach(m=>{if(m!==menu)m.classList.remove('show');});
                            const _op=!menu.classList.contains('show');menu.classList.toggle('show');
                            if(_op){const _pe=closest('.options-btn').closest('.impact-story,.reel-card,.news-list-item,[data-post-id]');const _pb=menu.querySelector('.promote-post-btn');if(_pb){const _oid=_pe?(_pe.dataset.userId||_pe.dataset.authorId||''):'';_pb.style.display=(!isGuest&&(!_oid||_oid===userState.id))?'':'none';}}
                        }
                        return;
                    }

                    if (!closest('.post-options')) {
                        document.querySelectorAll('.options-menu.show').forEach(menu => menu.classList.remove('show'));
                    }

                    const navLink = closest('.nav-link');
                    if (navLink) {
                        e.preventDefault();
                        navigateTo(navLink.dataset.target, true);
                        return;
                    }
                    
                    if (closest('.mobile-menu-toggle')) {
                         e.preventDefault();
                         e.stopPropagation();
                         sidebar.classList.toggle('open');
                         contentOverlay.classList.toggle('show');
                         document.body.classList.toggle('modal-open', sidebar.classList.contains('open'));
                         return;
                    }

                    if (closest('#content-overlay')) {
                        sidebar.classList.remove('open');
                        contentOverlay.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        return;
                    }
                    
                    const dashboardClickTarget = closest('.dashboard-market-card, .dashboard-reel-card, .dashboard-news-card');
                     if (dashboardClickTarget) {
                        const navTarget = dashboardClickTarget.dataset.navTarget;
                        if (navTarget) {
                             navigateTo(navTarget);
                        }
                        return;
                    }
                    
                    if (closest('.back-to-cart-btn')) {
                        document.getElementById('cart-view').style.display = 'block';
                        document.getElementById('checkout-view').style.display = 'none';
                        
                        // Re-enable required attributes for checkout when going back to cart
                        // First, disable required for ALL payment method contents
                        document.querySelectorAll('#checkout-form .payment-method-content input, #checkout-form .payment-method-content select, #checkout-form .payment-method-content textarea').forEach(input => {
                            input.required = false; // Disable all
                            input.style.borderColor = ''; // Clear validation highlight
                        });
                        // Re-enable required for shipping info
                        document.getElementById('checkout-name').required = true;
                        document.getElementById('checkout-address').required = true;

                        // Ensure that only the originally required fields for the active payment method are required when navigating back
                        const activePaymentTab = document.querySelector('#checkout-form .payment-tabs .payment-tab.active');
                        if (activePaymentTab) {
                            const targetContentId = activePaymentTab.dataset.target;
                            const targetContent = document.getElementById(targetContentId);
                            if (targetContent) {
                                targetContent.querySelectorAll('input[data-original-required="true"], select[data-original-required="true"], textarea[data-original-required="true"]').forEach(input => {
                                    input.required = true;
                                });
                            }
                        }

                        return;
                    }
                    if (closest('.finalize-purchase-btn')) {
                        // Form validity is checked in the submit listener
                        // This button will trigger the form submit, which will handle validation.
                        // If validation passes, the rest of the logic (showing notification, clearing cart etc.)
                        // is handled within the 'submit' event listener for 'checkout-form'.
                        return;
                    }

                    const modalAction = closest('#login-signup-btn, #show-signup, #show-login, #show-forgot-password, #back-to-login, .close-modal, #logout-btn, #buy-empy-btn, #buy-empy-wallet-btn, #send-gift-btn, .close-modal-btn, .reel-viewer-close, #live-close-btn, #promo-back-btn, .btn-google, #confirm-pin-message-btn, .close-pinned-msg, #live-host-profile-link');
                    if (modalAction) {
                        e.preventDefault();
                        const openModal = closest('.modal-overlay-container.show'); 
                        const openSubModal = closest('.live-sub-modal.show'); 

                        if (modalAction.classList.contains('btn-google')) {
                            // Real Firebase Google Sign-In
                            (async () => {
                                try {
                                    if (!window._firebaseLoaded || typeof firebase === 'undefined' || !firebase.auth) {
                                        throw new Error('Firebase not ready');
                                    }
                                    const provider = new firebase.auth.GoogleAuthProvider();
                                    provider.setCustomParameters({ prompt: 'select_account' });
                                    const result = await firebase.auth().signInWithPopup(provider);
                                    const user = result.user;
                                    if (!user) throw new Error('No user returned');
                                    // Load or create profile in Firestore
                                    let profile = null;
                                    try {
                                        const doc = await window.fbDb.collection('users').doc(user.uid).get();
                                        if (doc && doc.exists) { profile = doc.data(); }
                                    } catch(fsErr) {}
                                    if (!profile) {
                                        profile = {
                                            id: user.uid,
                                            fullName: user.displayName || 'Google User',
                                            username: (user.displayName||'user').toLowerCase().replace(/\s+/g,'') + Math.floor(Math.random()*999),
                                            email: user.email,
                                            avatar: user.photoURL || '',
                                            coverPhoto: '',
                                            bio: 'Joined via Google',
                                            empyBalance: 0,
                                            isVerified: false,
                                            followerCount: 0,
                                            businessPage: null
                                        };
                                        try { await window.fbDb.collection('users').doc(user.uid).set(profile, { merge: true }); } catch(e) {}
                                    }
                                    ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(k => {
                                        profile[k] = new Set(Array.isArray(profile[k]) ? profile[k] : []);
                                    });
                                    if (!profile.statuses) profile.statuses = [];
                                    registeredUsers[profile.email] = profile;
                                    mockUsers[profile.id] = profile;
                                    rewardUserForAction('SUCCESSFUL_REFERRAL');
                                    initializeApp(false, false, profile);
                                    authModal.classList.remove('show');
                                    showNotification('✅ Signed in with Google as ' + profile.fullName + '!', 'success');
                                } catch(gErr) {
                                    console.warn('[Google Auth]', gErr.message);
                                    // Fallback: create local Google session
                                    const fbUser = { id: 'user-google-'+Date.now(), fullName: 'Google User', username: 'googleuser'+Math.floor(Math.random()*9999), email: 'google.user.'+Date.now()+'@example.com', password: '', avatar: '', coverPhoto: '', bio: 'Google sign-in', likedPostIds: new Set(), followedUserIds: new Set(), retweetedPostIds: new Set(), statuses: [], viewedStatusUserIds: new Set(), empyBalance: 0, isVerified: false, followerCount: 0, awardedRanks: new Set(), businessPage: null, completedTasks: new Set() };
                                    registeredUsers[fbUser.email] = fbUser;
                                    mockUsers[fbUser.id] = fbUser;
                                    initializeApp(false, false, fbUser);
                                    authModal.classList.remove('show');
                                    showNotification('Signed in (offline mode).', 'info');
                                }
                            })();

                        } else if (modalAction.id === 'live-close-btn') {
                            const isCurrentUserHost = !isGuest && userState.id === liveStreamData.hostUserId;
                            // Stop all camera/mic streams safely
                            if (liveStreamData._localStream) {
                                try { liveStreamData._localStream.getTracks().forEach(t => { try { t.stop(); } catch(e) {} }); } catch(e) {}
                                liveStreamData._localStream = null;
                            }
                            // Stop any orphaned video srcObjects
                            document.querySelectorAll('video').forEach(function(v) {
                                try { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; } } catch(e) {}
                            });
                            if (isCurrentUserHost) {
                                if (liveStreamData.rewardInterval) { clearInterval(liveStreamData.rewardInterval); liveStreamData.rewardInterval = null; }
                                if (liveStreamData._viewerSimInterval) { clearInterval(liveStreamData._viewerSimInterval); liveStreamData._viewerSimInterval = null; }
                                const hostMainVideo = document.getElementById('host-main-video');
                                if (hostMainVideo) {
                                    try { if (hostMainVideo.srcObject) { hostMainVideo.srcObject.getTracks().forEach(t => t.stop()); hostMainVideo.srcObject = null; } } catch(e) {}
                                    hostMainVideo.pause(); hostMainVideo.src = '';
                                }
                                if (confirm("Do you want to save this stream as a recorded video?")) {
                                    if (liveStreamData._mediaRecorder && liveStreamData._mediaRecorder.state !== 'inactive') {
                                        liveStreamData._mediaRecorder.onstop = () => {
                                            const mimeType = liveStreamData._mediaRecorder.mimeType || 'video/webm';
                                            const blob = new Blob(liveStreamData._recordingChunks || [], { type: mimeType });
                                            const blobUrl = blob.size > 0 ? URL.createObjectURL(blob) : liveStreamData._lastRecordingBlob;
                                            addRecordedLiveStream(liveStreamData.title, userState.fullName, blobUrl);
                                            renderDashboardNews();
                                        };
                                        liveStreamData._mediaRecorder.stop();
                                    } else {
                                        addRecordedLiveStream(liveStreamData.title, userState.fullName, liveStreamData._lastRecordingBlob || null);
                                    }
                                }
                                const streamCard = document.querySelector(`.live-stream-preview-card[data-stream-id="${liveStreamData.streamId}"]`);
                                if (streamCard) streamCard.remove();
                                showNotification("Stream Ended.", "info");
                            } else {
                                const guestIndex = liveStreamData.guests.findIndex(g => g.userId === userState.id);
                                if (guestIndex !== -1) { liveStreamData.guests.splice(guestIndex, 1); updateLiveUI(); showNotification("You left the stream.", "info"); }
                            }
                            liveStreamData.isLive = false;
                            liveStreamData.streamId = null;
                            // FIX Bug 8: use BOTH style AND classList to guarantee modal closes
                            goLiveModal.classList.remove('show');
                            goLiveModal.style.display = 'none';
                            goLiveModal.style.visibility = 'hidden';
                            document.body.classList.remove('modal-open');
                            document.body.style.overflow = '';
                            document.querySelectorAll('.live-sub-modal.show').forEach(m => m.classList.remove('show'));
                            // Clean up leftover Agora elements
                            ['agora-local-video', 'agora-viewer-video', 'agora-connecting-msg'].forEach(function(id) {
                                var el = document.getElementById(id); if (el) el.remove();
                            });

                        } else if (openSubModal && closest('.close-modal')) {
                            openSubModal.classList.remove('show'); openSubModal.style.display='none';
                            _stopGalleryVideo();
                            setTimeout(function(){if(!document.querySelector('.modal-overlay-container.show')){document.body.classList.remove('modal-open');document.body.style.overflow='';}},50);
                        } else if (openModal && closest('.close-modal')) {
                            openModal.classList.remove('show'); openModal.style.display='none';
                            _stopGalleryVideo();
                            setTimeout(function(){if(!document.querySelector('.modal-overlay-container.show')){document.body.classList.remove('modal-open');document.body.style.overflow='';}},50);
                        }
                        if (closest('.reel-viewer-close')) {
                            document.getElementById('reel-viewer-modal-overlay').style.display = 'none';
                            document.querySelectorAll('#reel-viewer-modal-overlay video').forEach(v => v.pause());
                            document.body.style.overflow = '';
                        }
                        if (modalAction.id === 'promo-back-btn') {
                            document.getElementById('promotion-setup-view').style.display = 'block';
                            document.getElementById('promotion-payment-details').style.display = 'none';
                        }
                        if (modalAction.id === 'send-gift-btn') {
                            if (!selectedGift) {
                                showNotification("Please select a gift first.", "error");
                                return;
                            }
                            if (userState.empyBalance < selectedGift.price) {
                                showNotification("Insufficient EMPY balance to send this gift.", "error");
                                return;
                            }
                            userState.empyBalance -= selectedGift.price;
                            showGiftAnimation(selectedGift.symbol);
                            // Determine recipient - from participant popup or host
                            const giftCatalogModal = document.getElementById('live-gift-catalog-modal');
                            const recipientId = giftCatalogModal?.dataset.recipientId || liveStreamData.hostUserId;
                            const recipientName = giftCatalogModal?.dataset.recipientName || document.getElementById('live-host-name')?.textContent || 'host';
                            if (giftCatalogModal) { delete giftCatalogModal.dataset.recipientId; delete giftCatalogModal.dataset.recipientName; }
                            createLiveComment(userState.fullName, `Sent a ${selectedGift.name} to ${recipientName}! ${selectedGift.symbol}`);
                            showNotification(`🎁 You sent ${selectedGift.name} (${selectedGift.price} EMPY) to ${recipientName}!`, "success");
                            // Credit the recipient's wallet
                            const recipientUser = mockUsers[recipientId];
                            if (recipientUser && recipientId !== userState.id) {
                                recipientUser.empyBalance = (recipientUser.empyBalance||0) + selectedGift.price;
                                // Notify recipient
                                if (typeof window.pushNotification === 'function' && recipientId === userState.id) {
                                    window.pushNotification(userState.fullName + ' sent you a ' + selectedGift.name + '! +' + selectedGift.price + ' EMPY', 'success');
                                }
                            }
                            updateWalletUI(); 
                            rewardUserForAction('SEND_GIFT'); 
                            rewardUserForAction('RECEIVE_COMMENT', recipientId); 
                            if (liveStreamData.liveGoal) {
                                liveStreamData.liveGoal.currentAmount += selectedGift.price;
                                updateLiveUI();
                            }
                            selectedGift = null; 
                            document.querySelectorAll('.gift-item.selected').forEach(item => item.classList.remove('selected'));
                            document.getElementById('live-gift-catalog-modal').classList.remove('show');
                            return;
                        }

                        if(modalAction.id === 'confirm-pin-message-btn') {
                            const newPinMessageText = document.getElementById('new-pin-message-text').value.trim();
                            const selectedPinMessage = document.querySelector('#live-host-sent-messages .pin-message-choice.selected');

                            if (selectedPinMessage) {
                                const msgId = selectedPinMessage.dataset.messageId;
                                const originalMessage = liveStreamData.sentMessages.find(m => m.id === msgId);
                                if (originalMessage) {
                                    liveStreamData.pinnedMessage = {
                                        id: originalMessage.id,
                                        content: originalMessage.content,
                                        sender: originalMessage.username
                                    };
                                }
                            } else if (newPinMessageText) {
                                // Generate a unique ID for a new message to be pinned
                                const newMessageId = `msg-pin-${Date.now()}`;
                                liveStreamData.pinnedMessage = {
                                    id: newMessageId,
                                    content: newPinMessageText,
                                    sender: userState.username
                                };
                                // Also add this new message to sentMessages so it can be unpinned/re-selected
                                liveStreamData.sentMessages.push({ id: newMessageId, username: userState.username, content: newPinMessageText });
                            } else {
                                showNotification("Please select a message or type a new one to pin.", "error");
                                return;
                            }
                            showNotification("Message pinned!", "success");
                            document.getElementById('live-pin-message-modal').classList.remove('show');
                            document.getElementById('new-pin-message-text').value = '';
                            document.querySelectorAll('.pin-message-choice').forEach(item => item.classList.remove('selected'));
                            updateLiveUI();

                        } else if (modalAction.classList.contains('close-pinned-msg')) {
                            liveStreamData.pinnedMessage = null;
                            showNotification("Message unpinned.", "info");
                            updateLiveUI();
                        } else if (modalAction.id === 'live-host-profile-link') { 
                             e.stopPropagation(); 
                             const hostId = liveStreamData.hostUserId;
                             if(hostId) {
                                 goLiveModal.classList.remove('show'); 
                                 document.body.classList.remove('modal-open');
                                 window._viewingOtherProfile = (hostId !== userState.id);
                                 renderUserProfile(hostId);
                                 navigateTo('profile');
                                 setTimeout(function() { window._viewingOtherProfile = false; }, 500);
                                 showNotification(`Viewing ${mockUsers[hostId] ? mockUsers[hostId].fullName : 'host'}'s profile.`);
                             }
                             return;
                        }

                        ['login-view', 'signup-view', 'forgot-password-view'].forEach(v => { if(document.getElementById(v)) document.getElementById(v).style.display = 'none'});
                        switch (modalAction.id) {
                            case 'login-signup-btn': authModal.classList.add('show'); authModal.style.display='flex'; document.body.classList.add('modal-open'); var _lv2=document.getElementById('login-view'); if(_lv2)_lv2.style.display='block'; setTimeout(function(){if(typeof generateCaptcha==='function')generateCaptcha();},80); break;
                            case 'logout-btn': 
                                // Sign out from Firebase too
                                try { if (window._firebaseLoaded && window.fbAuth) window.fbAuth.signOut().catch(()=>{}); } catch(e) {}
                                // Clear persisted session
                                try { localStorage.removeItem('empyrean_session_email'); localStorage.removeItem('empyrean_session'); localStorage.removeItem('empyrean_last_section'); } catch(e) {}
                                initializeApp(true); 
                                showNotification('You have been signed out.'); 
                                break;
                            case 'show-signup': ['login-view','forgot-password-view'].forEach(function(v){var el=document.getElementById(v);if(el)el.style.display='none';}); document.getElementById('signup-view').style.display = 'block'; showFormFeedback('signup', '', 'info'); document.getElementById('signup-feedback').style.display='none'; break;
                            case 'show-login': case 'back-to-login': document.getElementById('login-view').style.display = 'block'; setTimeout(function(){ if(typeof generateCaptcha==='function') generateCaptcha(); }, 80); break;
                            case 'show-forgot-password': document.getElementById('forgot-password-view').style.display = 'block'; break;
                            case 'buy-empy-btn': 
                            case 'buy-empy-wallet-btn': 
                                document.getElementById('buy-empy-modal').classList.add('show'); 
                                document.body.classList.add('modal-open');
                                break;
                        }

                        return;
                    }
                    
                    if (liveStreamData.isLive) {
                        const isCurrentUserHost = !isGuest && userState.id === liveStreamData.hostUserId;

                        const isClickOnBackground = (
                            e.target === liveStreamScreen || 
                            e.target === document.getElementById('host-main-video') ||
                            e.target === document.getElementById('host-video-fallback-avatar')
                        ) && !e.target.closest('.live-header, .live-footer, #host-control-panel, #multi-guest-container, .live-overlay-box, .live-sub-modal');
                        
                        if (isClickOnBackground) { 
                            liveLikeCount++;
                            document.getElementById('live-like-count').textContent = liveLikeCount.toLocaleString();
                            const bubble = document.createElement('i');
                            bubble.className = 'fas fa-heart like-bubble';
                            liveStreamScreen.appendChild(bubble); 
                            setTimeout(() => bubble.remove(), 1500);
                        }

                        if (closest('.share-live-btn')) {
                            shareContent({
                                title: `Live Stream: ${liveStreamData.title}`,
                                text: `Join ${document.getElementById('live-host-name').textContent}'s live stream on Empyrean!`,
                                url: `${window.location.href.split('#')[0]}#live/${liveStreamData.streamId || '123'}`
                            });
                            return;
                        }
                        // ── PARTICIPANT CLICK -- open gift/interaction popup ──
                    const guestSlotClicked = closest('.guest-slot');
                    if (guestSlotClicked && !closest('.guest-controls button') && !closest('.guest-remove-btn')) {
                        e.preventDefault();
                        const targetUserId = guestSlotClicked.dataset.userId;
                        const targetUser = mockUsers[targetUserId] || { username: 'Guest', fullName: 'Guest', avatar: '' };
                        const isCurrentUserHost = !isGuest && userState.id === liveStreamData.hostUserId;

                        // Build popup
                        const existing = document.getElementById('participant-popup');
                        if (existing) existing.remove();

                        const popup = document.createElement('div');
                        popup.id = 'participant-popup';
                        popup.style.cssText = 'position:absolute;background:rgba(20,20,35,0.95);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:16px;z-index:100;min-width:200px;color:white;font-size:0.85rem;';

                        // Position near the clicked slot
                        const rect = guestSlotClicked.getBoundingClientRect();
                        const liveRect = liveStreamScreen.getBoundingClientRect();
                        popup.style.top = (rect.top - liveRect.top + 10) + 'px';
                        popup.style.left = Math.min(rect.right - liveRect.left + 8, liveRect.width - 220) + 'px';

                        popup.innerHTML = `
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);">
                                <img src="${targetUser.avatar||'https://ui-avatars.com/api/?name=G&background=1B2B8B&color=fff&size=36'}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
                                <div>
                                    <strong style="font-size:0.9rem;">${targetUser.fullName||targetUser.username}</strong>
                                    <p style="color:rgba(255,255,255,0.5);margin:0;font-size:0.75rem;">@${targetUser.username}</p>
                                </div>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:8px;">
                                <button class="participant-action-btn" data-action="gift" data-user-id="${targetUserId}" style="background:rgba(245,197,24,0.2);border:1px solid rgba(245,197,24,0.4);color:#F5C518;padding:8px 14px;border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;text-align:left;">
                                    <i class="fas fa-gift"></i> Send Gift
                                </button>
                                ${!isGuest ? `<button class="participant-action-btn" data-action="message" data-user-id="${targetUserId}" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:white;padding:8px 14px;border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;text-align:left;">
                                    <i class="fas fa-comment"></i> Message
                                </button>` : ''}
                                ${isCurrentUserHost ? `<button class="participant-action-btn" data-action="mute" data-user-id="${targetUserId}" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#FCA5A5;padding:8px 14px;border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;text-align:left;">
                                    <i class="fas fa-microphone-slash"></i> Mute
                                </button>
                                <button class="participant-action-btn" data-action="remove" data-user-id="${targetUserId}" style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#EF4444;padding:8px 14px;border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;text-align:left;">
                                    <i class="fas fa-times"></i> Remove
                                </button>` : ''}
                            </div>
                        `;
                        liveStreamScreen.style.position = 'relative';
                        liveStreamScreen.appendChild(popup);

                        // Handle popup actions
                        popup.querySelectorAll('.participant-action-btn').forEach(btn => {
                            btn.addEventListener('click', function(ev) {
                                ev.stopPropagation();
                                const action = this.dataset.action;
                                const uid = this.dataset.userId;
                                const guestObj = liveStreamData.guests.find(g => g.userId === uid);
                                if (action === 'gift') {
                                    popup.remove();
                                    // Pre-select recipient and open gift catalog
                                    const giftModal = document.getElementById('live-gift-catalog-modal');
                                    if (giftModal) {
                                        giftModal.classList.add('show');
                                        giftModal.dataset.recipientId = uid;
                                        giftModal.dataset.recipientName = targetUser.fullName || targetUser.username;
                                        const giftTitle = giftModal.querySelector('h3');
                                        if (giftTitle) giftTitle.innerHTML = '<i class="fas fa-gift"></i> Send Gift to ' + (targetUser.fullName || targetUser.username);
                                    }
                                } else if (action === 'message') {
                                    popup.remove();
                                    navigateTo('messages');
                                } else if (action === 'mute' && guestObj) {
                                    guestObj.isMicMuted = !guestObj.isMicMuted;
                                    showNotification((guestObj.isMicMuted ? 'Muted ' : 'Unmuted ') + (targetUser.username||'guest'), 'info');
                                    popup.remove();
                                    updateLiveUI();
                                } else if (action === 'remove' && guestObj) {
                                    liveStreamData.guests = liveStreamData.guests.filter(g => g.userId !== uid);
                                    showNotification((targetUser.username||'Guest') + ' removed from stream.', 'info');
                                    popup.remove();
                                    updateLiveUI();
                                }
                            });
                        });

                        // Close popup on outside click
                        setTimeout(() => {
                            document.addEventListener('click', function closePopup(ev) {
                                if (!ev.target.closest('#participant-popup')) {
                                    const p = document.getElementById('participant-popup');
                                    if (p) p.remove();
                                    document.removeEventListener('click', closePopup);
                                }
                            });
                        }, 100);
                        return;
                    }

                    if (closest('#live-record-btn')) {
                            return; // Recording removed
                        }
                        if (closest('#live-mic-toggle')) {
                            if (isCurrentUserHost) {
                                liveStreamData.isMicMuted = !liveStreamData.isMicMuted;
                                showNotification(`Your microphone is now ${liveStreamData.isMicMuted ? 'muted' : 'unmuted'}.`, 'info');
                                updateLiveUI();
                            }
                            return;
                        }
                        if (closest('#live-video-toggle')) {
                            if (isCurrentUserHost) {
                                liveStreamData.isVideoMuted = !liveStreamData.isVideoMuted;
                                showNotification(`Your camera is now ${liveStreamData.isVideoMuted ? 'off' : 'on'}.`, 'info');
                                updateLiveUI();
                            }
                            return;
                        }
                        if (closest('#live-share-screen-btn')) {
                            if (isCurrentUserHost) {
                                liveStreamData.isScreenSharing = !liveStreamData.isScreenSharing;
                                showNotification(`Screen sharing ${liveStreamData.isScreenSharing ? 'started' : 'stopped'}.`, 'info');
                                updateLiveUI();
                            }
                            return;
                        }

                        if (closest('#live-request-join-btn') && !isGuest && !isCurrentUserHost) {
                            if (liveStreamData.guests.length >= 4) {
                                showNotification("Guest slots are full. Cannot send request.", "warning");
                                return;
                            }
                            const hasRequested = liveStreamData.joinRequests.some(req => req.userId === userState.id);
                            if (hasRequested) {
                                showNotification("You have already sent a request to join.", "info");
                                return;
                            }

                            liveStreamData.joinRequests.push({
                                userId: userState.id,
                                username: userState.username,
                                fullName: userState.fullName,
                                avatar: userState.avatar
                            });
                            showNotification("Request to join sent to host!", "success");
                            updateLiveUI(); 
                            return;
                        }

                        if (closest('#live-add-guest-btn')) { 
                            if (isCurrentUserHost) {
                                document.getElementById('live-guest-requests-modal').classList.toggle('show');
                                renderGuestJoinRequests(); 
                            }
                            return;
                        }
                        if (closest('.accept-guest-btn')) {
                            if (isCurrentUserHost) {
                                const guestId = closest('.accept-guest-btn').dataset.userId;
                                const guestUser = mockUsers[guestId];
                                if (guestUser && liveStreamData.guests.length < 4) {
                                    liveStreamData.guests.push({
                                        userId: guestUser.id,
                                        username: guestUser.username,
                                        fullName: guestUser.fullName,
                                        avatar: guestUser.avatar,
                                        videoStream: "https://www.w3schools.com/html/mov_bbb.mp4", 
                                        isMicMuted: false,
                                        isVideoMuted: false
                                    });
                                    liveStreamData.joinRequests = liveStreamData.joinRequests.filter(req => req.userId !== guestId);
                                    showNotification(`${guestUser.fullName} joined your stream!`, "success");
                                    rewardUserForAction('HOST_INVITED_GUEST'); 
                                    rewardUserForAction('GUEST_JOINED_LIVE', guestId); 
                                    updateLiveUI();
                                    renderGuestJoinRequests(); 
                                } else {
                                    showNotification("All guest slots are full.", "warning");
                                }
                            }
                            return;
                        }
                        if (closest('.reject-guest-btn')) {
                            if (isCurrentUserHost) {
                                const guestId = closest('.reject-guest-btn').dataset.userId;
                                liveStreamData.joinRequests = liveStreamData.joinRequests.filter(req => req.userId !== guestId);
                                showNotification("Guest request rejected.", "info");
                                renderGuestJoinRequests(); 
                            }
                            return;
                        }
                        const guestControlActionButton = closest('.guest-controls button');
                        if (guestControlActionButton) {
                            if (isCurrentUserHost) {
                                const guestId = guestControlActionButton.dataset.guestId;
                                const action = guestControlActionButton.dataset.action;
                                const guest = liveStreamData.guests.find(g => g.userId === guestId);

                                if (guest) {
                                    if (action === 'toggle-mic') {
                                        guest.isMicMuted = !guest.isMicMuted;
                                        showNotification(`${guest.fullName}'s mic ${guest.isMicMuted ? 'muted' : 'unmuted'}.`, 'info');
                                    } else if (action === 'toggle-video') {
                                        guest.isVideoMuted = !guest.isVideoMuted;
                                        showNotification(`${guest.fullName}'s video ${guest.isVideoMuted ? 'off' : 'on'}.`, 'info');
                                    } else if (action === 'remove-guest') {
                                        liveStreamData.guests = liveStreamData.guests.filter(g => g.userId !== guestId);
                                        showNotification(`${guest.fullName} removed from stream.`, 'info');
                                    }
                                    updateLiveUI();
                                }
                            }
                            return;
                        }

                        if (closest('#live-goal-settings-btn')) {
                            if (isCurrentUserHost) {
                                document.getElementById('live-goal-settings-modal').classList.toggle('show');
                                if(liveStreamData.liveGoal) {
                                    document.getElementById('goal-description').value = liveStreamData.liveGoal.description;
                                    document.getElementById('goal-target-amount').value = liveStreamData.liveGoal.targetAmount;
                                } else {
                                     document.getElementById('live-goal-form').reset();
                                }
                            }
                            return;
                        }
                        if (closest('#clear-goal-btn')) {
                            if (isCurrentUserHost) {
                                if (confirm("Are you sure you want to clear the current live goal?")) {
                                    liveStreamData.liveGoal = null;
                                    showNotification("Live goal cleared.", "info");
                                    document.getElementById('live-goal-settings-modal').classList.remove('show');
                                    updateLiveUI();
                                }
                            }
                            return;
                        }
                        if (closest('#live-fan-club-btn')) {
                            if (isCurrentUserHost) {
                                document.getElementById('live-fan-club-modal').classList.toggle('show');
                                document.getElementById('fan-club-toggle').checked = liveStreamData.fanClubActive;
                            }
                            return;
                        }
                        if (closest('#save-fan-club-settings')) {
                            if (isCurrentUserHost) {
                                liveStreamData.fanClubActive = document.getElementById('fan-club-toggle').checked;
                                showNotification(`Fan Club is now ${liveStreamData.fanClubActive ? 'activated' : 'deactivated'}.`, "info");
                                document.getElementById('live-fan-club-modal').classList.remove('show');
                                updateLiveUI();
                            }
                            return;
                        }

                        if (closest('#live-games-btn')) {
                            if (isCurrentUserHost) {
                                document.getElementById('live-games-modal').classList.toggle('show');
                            }
                            return;
                        }
                        const liveGameBtn = closest('.live-game-btn');
                        if (liveGameBtn) {
                            if (isCurrentUserHost) {
                                const gameType = liveGameBtn.dataset.game;
                                liveStreamData.activeGame = { type: gameType, name: gameType.charAt(0).toUpperCase() + gameType.slice(1) }; 
                                showNotification(`Starting a ${gameType} game!`, "info");
                                updateLiveUI();
                                document.getElementById('live-games-modal').classList.remove('show');
                            }
                            return;
                        }
                        if (closest('#end-game-btn')) {
                            if (isCurrentUserHost) {
                                liveStreamData.activeGame = null;
                                showNotification("Game ended.", "info");
                                updateLiveUI();
                                document.getElementById('live-games-modal').classList.remove('show');
                            }
                            return;
                        }

                        if (closest('#live-gift-btn')) { 
                            document.getElementById('live-gift-catalog-modal').classList.toggle('show'); 
                            document.getElementById('live-viewers-modal').classList.remove('show'); 
                            updateWalletUI(); 
                            return; 
                        }
                        if (closest('.gift-item')) { 
                            document.querySelectorAll('.gift-item').forEach(item => item.classList.remove('selected'));
                            e.target.closest('.gift-item').classList.add('selected');
                            selectedGift = {
                                name: e.target.closest('.gift-item').dataset.name,
                                symbol: e.target.closest('.gift-item').dataset.symbol,
                                price: parseFloat(e.target.closest('.gift-item').dataset.price)
                            };
                            return;
                        }
                        if (closest('.live-viewers')) {
                            document.getElementById('live-viewers-modal').classList.toggle('show'); 
                            document.getElementById('live-gift-catalog-modal').classList.remove('show'); 
                            const viewerList = document.getElementById('viewer-list-container');
                            if (viewerList) {
                                viewerList.innerHTML = '';
                                if (liveStreamData.hostUserId) {
                                    const hostUser = mockUsers[liveStreamData.hostUserId];
                                    if (hostUser) {
                                        viewerList.innerHTML += `<div class="viewer-item"><img src="${hostUser.avatar}" alt="${hostUser.fullName}"> <div class="viewer-item-info"><strong>${hostUser.fullName}</strong><span>@${hostUser.username} (Host)</span></div></div>`;
                                    }
                                }
                                liveStreamData.guests.forEach(g => { 
                                    viewerList.innerHTML += `<div class="viewer-item"><img src="${g.avatar}" alt="${g.fullName}"> <div class="viewer-item-info"><strong>${g.fullName}</strong><span>@${g.username}</span></div></div>`;
                                });
                            }
                            return;
                        }
                        if (closest('#live-pin-message-btn')) {
                            if (isCurrentUserHost) {
                                document.getElementById('live-pin-message-modal').classList.toggle('show');
                                renderHostSentMessagesForPinning(); 
                                // document.getElementById('new-pin-message-text').value = ''; // Don't clear new message on open
                                // document.querySelectorAll('.pin-message-choice').forEach(item => item.classList.remove('selected'));
                            }
                            return;
                        }
                        const pinMessageChoice = closest('.pin-message-choice');
                        if (pinMessageChoice && isCurrentUserHost && closest('#live-pin-message-modal')) {
                            document.querySelectorAll('.pin-message-choice').forEach(item => item.classList.remove('selected'));
                            pinMessageChoice.classList.add('selected');
                            const messageContent = pinMessageChoice.querySelector('p')?.textContent;
                            if (messageContent) {
                                document.getElementById('new-pin-message-text').value = messageContent; 
                            }
                            return;
                        }
                    } 


                    const paymentTab = closest('.payment-tab');
                    if (paymentTab) {
                        const container = paymentTab.closest('.modal-card, #checkout-form');
                        const targetContentId = paymentTab.dataset.target;
                        if (container) { 
                            container.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active'));
                            paymentTab.classList.add('active');
                            container.querySelectorAll('.payment-method-content').forEach(c => {
                                c.style.display = 'none';
                                // Make inputs in inactive payment methods not required
                                c.querySelectorAll('input').forEach(input => input.required = false);
                            });
                            const targetContent = document.getElementById(targetContentId);
                            if (targetContent) {
                                targetContent.style.display = 'block';
                                // Make inputs in active payment method required
                                targetContent.querySelectorAll('input[data-original-required="true"]').forEach(input => input.required = true);
                                
                                // Clear any previous validation feedback when switching tabs
                                targetContent.querySelectorAll('input').forEach(input => {
                                     input.style.borderColor = '';
                                });
                            }
                        }
                        return;
                    }
                    
                    const settingsTab = closest('.settings-tab');
                    if (settingsTab) {
                        const container = closest('.card');
                        if (container) { 
                            container.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                            settingsTab.classList.add('active');
                            container.querySelectorAll('.settings-content').forEach(c => c.classList.remove('active'));
                            const targetContent = document.getElementById(settingsTab.dataset.target);
                            if (targetContent) {
                                targetContent.classList.add('active');
                            }
                        }
                        return;
                    }
                    const profileTab = closest('.profile-tab');
                    if (profileTab) {
                        const container = closest('.card, .business-page-header');
                        if (container) { 
                            container.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
                            profileTab.classList.add('active');
                            document.querySelectorAll('.profile-tab-content').forEach(c => {
                                c.classList.remove('active');
                                c.style.display = 'none';
                            });
                            const targetContent = document.getElementById(profileTab.dataset.target);
                            if (targetContent) {
                                targetContent.classList.add('active');
                                targetContent.style.cssText = 'display:block !important;';
                                // Re-init KYC upload bindings when KYC tab opens
                                if (profileTab.dataset.target === 'profile-kyc-tab') {
                                    setTimeout(function() {
                                        if (typeof initKycUploads === 'function') initKycUploads();
                                        // Also populate bio fields from userState
                                        var fnEl = document.getElementById('kyc-ind-fname');
                                        var lnEl = document.getElementById('kyc-ind-lname');
                                        var emEl = document.getElementById('kyc-ind-email');
                                        var phEl = document.getElementById('kyc-ind-phone');
                                        if (fnEl && !fnEl.value && window.userState) {
                                            var parts = (window.userState.fullName||'').split(' ');
                                            fnEl.value = parts[0] || '';
                                            if (lnEl) lnEl.value = parts.slice(1).join(' ') || '';
                                        }
                                        if (emEl && !emEl.value && window.userState) emEl.value = window.userState.email || '';
                                        if (phEl && !phEl.value && window.userState) phEl.value = window.userState.phone || '';
                                    }, 100);
                                }
                            }
                        }
                        return;
                    }
                    
                    const kycEntityBtn = closest('.kyc-entity-btn');
                    if(kycEntityBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        const formId = kycEntityBtn.dataset.form;
                        // Mark all entity buttons inactive, this one active
                        document.querySelectorAll('.kyc-entity-btn').forEach(btn => btn.classList.remove('active'));
                        kycEntityBtn.classList.add('active');
                        // Hide all kyc forms
                        document.querySelectorAll('.kyc-form').forEach(form => {
                            form.classList.remove('active');
                            form.style.display = 'none';
                            form.querySelectorAll('.file-upload-preview').forEach(span => span.innerHTML = '');
                            form.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
                            form.querySelectorAll('input, select, textarea, .upload-area, .live-capture-btn').forEach(el => {
                                el.style.borderColor = '';
                            });
                            const selfieBtn = form.querySelector('.live-capture-btn');
                            if (selfieBtn) selfieBtn.dataset.captured = 'false';
                        });
                        // Show selected form
                        const formToShow = document.getElementById(formId);
                        if (formToShow) {
                            formToShow.classList.add('active');
                            formToShow.style.cssText = 'display:block !important;';
                            // Auto-populate bio fields for Individual form
                            if (formId === 'individual-kyc-form' && window.userState) {
                                var parts = (window.userState.fullName || '').split(' ');
                                var fi = formToShow.querySelector('#kyc-ind-fname');
                                var li = formToShow.querySelector('#kyc-ind-lname');
                                var ei = formToShow.querySelector('#kyc-ind-email');
                                var pi = formToShow.querySelector('#kyc-ind-phone');
                                if (fi && !fi.value) fi.value = parts[0] || '';
                                if (li && !li.value) li.value = parts.slice(1).join(' ') || '';
                                if (ei && !ei.value) ei.value = window.userState.email || '';
                                if (pi && !pi.value) pi.value = window.userState.phone || '';
                            }
                            // Re-init upload bindings for newly shown form
                            setTimeout(function() {
                                if (typeof initKycUploads === 'function') initKycUploads();
                            }, 50);
                        }
                        populateDobSelectors(); 
                        
                        // Set required attributes based on form. (all initially required in HTML now handled by JS)
                        formToShow.querySelectorAll('input[required][data-original-required="true"], select[required][data-original-required="true"], textarea[required][data-original-required="true"]').forEach(input => {
                            input.required = true;
                        });
                        formToShow.querySelectorAll('.kyc-file-upload + input[type="file"]').forEach(input => {
                            const uploadArea = input.previousElementSibling;
                            if (uploadArea && uploadArea.querySelector('span')) {
                                uploadArea.querySelector('span').textContent = 'Click to upload';
                            }
                            input.required = input.hasAttribute('data-original-required') && input.dataset.originalRequired === 'true';
                        });
                        const liveCaptureBtn = formToShow.querySelector('.live-capture-btn');
                        if (liveCaptureBtn) {
                             liveCaptureBtn.required = liveCaptureBtn.hasAttribute('data-original-required') && liveCaptureBtn.dataset.originalRequired === 'true';
                             liveCaptureBtn.dataset.captured = 'false';
                        }
                        return;
                    }
                    
                    if (closest('#gallery-next-btn')) { navigateMarketplaceGallery(1); return; }
                    if (closest('#gallery-prev-btn')) { navigateMarketplaceGallery(-1); return; }
                    const galleryThumb = closest('.gallery-thumbnail');
                    if (galleryThumb) {
                        const index = parseInt(galleryThumb.dataset.index, 10);
                        if (!isNaN(index)) { 
                            showMarketplaceGallery(marketplaceGalleryState.media, index);
                        }
                        return;
                    }
                    const propertyCard = closest('.property-card');
                    if (propertyCard && !closest('.add-to-cart-btn') && !closest('.contact-seller-btn') && !closest('.promote-post-btn')) {
                        let media = [];
                        try { media = JSON.parse(propertyCard.dataset.media || '[]'); } catch(e) { media = []; }
                        // Normalise: media can be string URLs or {url, type} objects
                        media = media.map(function(m) { return typeof m === 'string' ? { url: m, type: (m.match(/\.(mp4|webm|mov|avi|mkv)/i)||/\/video\/upload\//i.test(m)) ? 'video/mp4' : 'image/jpeg' } : m; });
                        if (media.length > 0) showMarketplaceGallery(media);
                        return;
                    }
                    
                    const reelViewerActionBtn = closest('.reel-viewer-actions .action-btn');
                    if (reelViewerActionBtn) {
                        e.preventDefault();
                        const viewerItem = closest('.reel-viewer-item');
                        const video = viewerItem ? viewerItem.querySelector('video') : null;
                        if (!video) return; 

                        if (reelViewerActionBtn.classList.contains('reel-like-btn')) {
                            const icon = reelViewerActionBtn.querySelector('i');
                            if (icon) { 
                                icon.classList.toggle('far');
                                icon.classList.toggle('fas');
                                icon.classList.toggle('liked');
                            }
                        } else if (reelViewerActionBtn.classList.contains('reel-comment-toggle-btn')) {
                            const panel = viewerItem.querySelector('.reel-comments-panel');
                            if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                        } else if (reelViewerActionBtn.classList.contains('reel-share-btn')) {
                            const postId = viewerItem.dataset.postId;
                            shareContent({
                                title: "Empyrean Reel",
                                text: viewerItem.querySelector('.reel-viewer-info p')?.textContent || "Check out this Reel!",
                                url: `${window.location.href.split('#')[0]}#reel/${postId}`
                            });
                        } else if (reelViewerActionBtn.title === 'Toggle Mute') {
                            video.muted = !video.muted;
                            const icon = reelViewerActionBtn.querySelector('i');
                            if (icon) {
                                icon.className = `fas fa-volume-${video.muted ? 'mute' : 'up'}`;
                            }
                        }
                        return;
                    }
                    
                    // Reel comment form submit
                    const reelCommentForm = closest('.reel-comment-form');
                    if (reelCommentForm && target.closest('button[type="submit"]')) {
                        e.preventDefault();
                        const input = reelCommentForm.querySelector('input');
                        const text = input ? input.value.trim() : '';
                        if (!text) return;
                        const viewerItem = reelCommentForm.closest('.reel-viewer-item');
                        const commentsList = viewerItem ? viewerItem.querySelector('.reel-comments-list') : null;
                        if (commentsList) {
                            const placeholder = commentsList.querySelector('p');
                            if (placeholder) placeholder.remove();
                            const commentEl = document.createElement('div');
                            commentEl.style.cssText = 'display:flex;gap:8px;align-items:flex-start;';
                            commentEl.innerHTML = `<img src="${userState.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;"><div><strong style="color:white;font-size:0.8rem;">${userState.fullName || 'You'}</strong><p style="color:rgba(255,255,255,0.8);font-size:0.82rem;margin-top:2px;">${text}</p></div>`;
                            commentsList.appendChild(commentEl);
                            commentsList.scrollTop = commentsList.scrollHeight;
                            const countEl = viewerItem.querySelector('.reel-comment-count');
                            if (countEl) countEl.textContent = parseInt(countEl.textContent||'0') + 1;
                        }
                        if (input) input.value = '';
                        return;
                    }

                    const removeMediaBtn = closest('.remove-media-btn');
                    if(removeMediaBtn) {
                        const indexToRemove = parseInt(removeMediaBtn.dataset.index, 10);
                        
                        marketplaceMediaFiles = marketplaceMediaFiles.filter((_, index) => index !== indexToRemove);
                        
                        const dataTransfer = new DataTransfer();
                        marketplaceMediaFiles.forEach(file => dataTransfer.items.add(file));
                        const itemMediaInput = document.getElementById('item-media');
                        if (itemMediaInput) {
                            itemMediaInput.files = dataTransfer.files;
                        }
                        
                        handleMarketplacePreview(marketplaceMediaFiles, document.getElementById('marketplace-media-preview'));
                        if (marketplaceMediaFiles.length === 0) {
                            const marketplaceTextFields = document.getElementById('marketplace-text-fields');
                            if (marketplaceTextFields) marketplaceTextFields.style.display = 'none';
                        }
                        return;
                    }
                    
                    /* NOTE: .contact-seller-btn clicks are now handled exclusively
                       by app-marketplace.js (§9 EVENT DELEGATION), which opens the
                       floating in-marketplace chat overlay (_openMarketChatOverlay)
                       instead of this old static contact-info expand-panel. Removed
                       to stop both handlers firing on the same click. */                    if (closest('#message-attach-btn')) {
                        const messageFileInput = document.getElementById('message-file-input');
                        if (messageFileInput) messageFileInput.click();
                        return;
                    }
                    let voiceNoteMediaRecorder; 
                    let voiceNoteAudioChunks = [];
                    let voiceNoteRecordingStartTime;
                    
                    if (closest('#message-voice-note-btn')) {
                        const voiceNoteButton = document.getElementById('message-voice-note-btn');
                        if (!voiceNoteButton) return; 
                        let isRecording = voiceNoteButton.dataset.recording === 'true';
                        
                        if (!isRecording) {
                            navigator.mediaDevices.getUserMedia({ audio: true })
                                .then(stream => {
                                    voiceNoteMediaRecorder = new MediaRecorder(stream);
                                    voiceNoteButton.mediaRecorder = voiceNoteMediaRecorder; 
                                    voiceNoteButton.stream = stream; 

                                    voiceNoteMediaRecorder.ondataavailable = event => {
                                        voiceNoteAudioChunks.push(event.data);
                                    };

                                    voiceNoteMediaRecorder.onstop = () => {
                                        const audioBlob = new Blob(voiceNoteAudioChunks, { type: 'audio/webm' });
                                        const audioUrl = URL.createObjectURL(audioBlob);
                                        const recordingDuration = Math.floor((Date.now() - voiceNoteRecordingStartTime) / 1000);
                                        const messagesContainer = document.getElementById('chat-messages-container');
                                        if (messagesContainer) {
                                            const messageEl = createMessageElement(`Voice Note (${recordingDuration}s)`, true, true, audioUrl, 'audio/webm');
                                            messagesContainer.appendChild(messageEl);
                                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                            // Upload to Cloudinary in background
                                            const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                                            window.uploadToCloudinary(audioFile, null).then(async cloudUrl => {
                                                const audioEl = messageEl.querySelector('audio');
                                                if (audioEl) audioEl.src = cloudUrl;
                                                try {
                                                    await fbDb.collection('messages').add({
                                                        senderId: userState.id, mediaUrl: cloudUrl,
                                                        mediaType: 'audio/webm', isVoiceNote: true,
                                                        duration: recordingDuration,
                                                        createdAt: new Date().toISOString()
                                                    });
                                                } catch(e) {}
                                            }).catch(e => console.warn('Voice note upload failed:', e));
                                        }
                                        voiceNoteAudioChunks = [];
                                        if (voiceNoteButton.stream) {
                                            voiceNoteButton.stream.getTracks().forEach(track => track.stop());
                                        }
                                    };

                                    voiceNoteMediaRecorder.start();
                                    voiceNoteRecordingStartTime = Date.now();
                                    voiceNoteButton.dataset.recording = 'true';
                                    voiceNoteButton.innerHTML = '<i class="fas fa-stop-circle"></i> Rec';
                                    showNotification("Voice note recording started (max 1 hour)...", "info");

                                    voiceNoteButton.recordingTimeout = setTimeout(() => {
                                        if (voiceNoteButton.dataset.recording === 'true') {
                                            voiceNoteButton.click(); 
                                            showNotification("Voice note recording stopped (max duration reached).", "warning");
                                        }
                                    }, 3600000); 

                                })
                                .catch(err => {
                                    console.error("Error accessing microphone:", err);
                                    showNotification("Failed to access microphone. Please ensure permissions are granted.", "error");
                                });
                        } else {
                            voiceNoteButton.dataset.recording = 'false';
                            voiceNoteButton.innerHTML = '<i class="fas fa-microphone"></i>';
                            if (voiceNoteButton.mediaRecorder && voiceNoteButton.mediaRecorder.state === 'recording') {
                                voiceNoteButton.mediaRecorder.stop();
                            }
                            if (voiceNoteButton.stream) {
                                voiceNoteButton.stream.getTracks().forEach(track => track.stop());
                            }
                            if (voiceNoteButton.recordingTimeout) {
                                clearTimeout(voiceNoteButton.recordingTimeout); 
                            }
                            showNotification("Voice note recording stopped. Sending...", "success");
                        }
                        return;
                    }
                     if (closest('#message-location-btn')) {
                        showNotification("Simulating location sharing...", "info");
                        return;
                    }
                    if (closest('#message-voice-call-btn')) {
                        showNotification("Simulating voice call... (Requires WebRTC for real implementation)", "info");
                        return;
                    }
                     if (closest('#message-video-call-btn')) {
                        showNotification("Simulating video call... (Requires WebRTC for real implementation)", "info");
                        return;
                    }

                    if (closest('.chat-header')) {
                        // Do NOT navigate away; just show info
                        return;
                    }
                    
                    const communityTaskBtn = closest('.community-task-btn');
                    if (communityTaskBtn) {
                        const taskId = communityTaskBtn.dataset.taskId;
                        const reward = parseInt(communityTaskBtn.dataset.reward, 10);
                        // Prevent double-earning -- only reward once per task
                        if (userState.completedTasks && userState.completedTasks.has(taskId)) {
                            showNotification('Task already completed! Reward already earned.', 'info');
                            window.open(communityTaskBtn.dataset.url, '_blank');
                            return;
                        }
                        userState.empyBalance += reward;
                        if (!userState.completedTasks) userState.completedTasks = new Set();
                        userState.completedTasks.add(taskId);
                        updateWalletUI();
                        showNotification(`+${reward} EMPY! Task completed. Reward earned once.`, 'success');
                        // Save completed task to Firestore
                        try { await fbDb.collection('users').doc(userState.id).update({ completedTasks: [...userState.completedTasks] }); } catch(e) {}
                        window.open(communityTaskBtn.dataset.url, '_blank');
                        renderCommunityTasks();
                        return;
                    }

                    const ngoCard = closest('.ngo-card');
                    if(ngoCard) {
                        renderNgoProfile(ngoCard.dataset.ngoId);
                        return;
                    }

                    if(closest('#back-to-ngo-grid')) {
                        document.getElementById('ngo-grid-view').style.display = 'block';
                        document.getElementById('ngo-profile-view').style.display = 'none';
                        document.getElementById('back-to-ngo-grid').style.display = 'none';
                        return;
                    }
                    
                     const editIcon = closest('.business-page-content .edit-icon, .business-page-header .edit-icon');
                    if(editIcon) {
                        const field = editIcon.dataset.field;
                        let currentElement, currentValue, promptTitle;

                        if (field === 'name' || field === 'tagline') {
                            currentElement = document.getElementById(`business-page-${field}`);
                            currentValue = currentElement ? currentElement.textContent.trim() : '';
                            promptTitle = `Update Page ${field.charAt(0).toUpperCase() + field.slice(1)}`;
                        } else {
                            currentElement = document.getElementById(`business-page-${field}-span`);
                            currentValue = currentElement ? currentElement.textContent.trim() : '';
                             promptTitle = `Update ${field.charAt(0).toUpperCase() + field.slice(1)}`;
                        }
                        
                        const newValue = prompt(promptTitle, currentValue);

                        if (newValue && newValue.trim() !== '' && newValue.trim() !== currentValue) {
                            if (currentElement) currentElement.textContent = newValue;
                            if (userState.businessPage) {
                                userState.businessPage[field] = newValue;
                            }
                            showNotification("Page updated!", "success");
                        }
                        return;
                    }
                    
                    // ── BUSINESS PAGE BUTTONS (Share, Follow, Promote) ──
                    // ── DELETE ACCOUNT ──
                    if (closest('#delete-account-btn')) {
                        e.preventDefault();
                        if (isGuest) { showNotification('Please log in first.', 'error'); return; }
                        const confirmed = confirm('DELETE ACCOUNT\n\nThis will permanently delete your account, all posts, messages, and your EMPY balance.\n\nThis cannot be undone. Are you absolutely sure?');
                        if (!confirmed) return;
                        const doubleConfirm = confirm('Final confirmation: Delete account for ' + (userState.fullName || userState.email) + '?');
                        if (!doubleConfirm) return;
                        // Delete from Firebase
                        (async () => {
                            try {
                                if (window._firebaseLoaded && window.fbAuth && window.fbAuth.currentUser) {
                                    // Delete Firestore data
                                    try { await window.fbDb.collection('users').doc(userState.id).delete(); } catch(e) {}
                                    // Delete auth account
                                    await window.fbAuth.currentUser.delete();
                                }
                            } catch(e) { console.warn('Firebase delete error:', e.message); }
                            // Clear localStorage
                            try {
                                const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                                delete stored[userState.email];
                                localStorage.setItem('empyrean_users', JSON.stringify(stored));
                            } catch(e) {}
                            // Reset app to guest
                            showNotification('Your account has been deleted.', 'info');
                            setTimeout(() => initializeApp(true), 1500);
                        })();
                        return;
                    }

                    const bizShareBtn = closest('.business-page-share-btn');
                    if (bizShareBtn) {
                        e.preventDefault();
                        const pageName = userState.businessPage ? userState.businessPage.name : 'Business Page';
                        const pageTagline = userState.businessPage ? userState.businessPage.tagline : '';
                        shareContent({
                            title: pageName,
                            text: pageTagline,
                            url: window.location.href + '#business'
                        });
                        return;
                    }

                    const bizPromoteBtn = closest('.business-page-promote-btn');
                    if (bizPromoteBtn) {
                        e.preventDefault();
                        if (userState.businessPage) {

                        } else {
                            showNotification('Create a business page first.', 'warning');
                        }
                        return;
                    }

                    const suggestedUserCard = closest('.suggested-user-card');
                    if(suggestedUserCard && !closest('.follow-btn')) {
                        const userId = suggestedUserCard.dataset.userId;
                        if (userId) {
                            window._viewingOtherProfile = (userId !== userState.id);
                            renderUserProfile(userId);
                            navigateTo('profile', true);
                            setTimeout(function() { window._viewingOtherProfile = false; }, 500);
                        }
                        return;
                    }
                    
                    const uiToggle = closest('#refresh-captcha, .news-list-item h4, .contact-item, #toggle-bio-btn, #toggle-profile-info-btn, #profile-message-btn, .help-now-btn, .share-profile-btn, #pin-location-btn, #create-page-btn, #host-control-toggle-btn'); 
                     if (uiToggle) {
                        if (closest('#refresh-captcha')) generateCaptcha();
                        if (closest('.news-list-item h4')) {
                            const newsItem = closest('.news-list-item');
                            if (newsItem) newsItem.classList.toggle('expanded');
                        }
                        if (closest('#profile-message-btn')) {
                            e.preventDefault();
                            // Read target userId stored on the button at render time
                            const msgBtn = closest('#profile-message-btn');
                            const msgTargetId = (msgBtn && msgBtn.dataset.messageUserId)
                                || document.querySelector('.profile-header-info[data-user-id]')?.dataset?.userId;
                            navigateTo('messages');
                            if (msgTargetId) { setTimeout(function() { openChat(msgTargetId); }, 200); }
                        }
                        if (closest('.contact-item')) {
                            e.preventDefault();
                            const cItem = closest('.contact-item');
                            const cUserId = cItem.dataset.userId;
                            // Ensure messages view is active before opening chat portal
                            const mView = document.getElementById('messages-view');
                            if (!mView || mView.style.display === 'none' || mView.classList.contains('hidden')) {
                                navigateTo('messages');
                                setTimeout(function() { openChat(cUserId); }, 200);
                            } else {
                                openChat(cUserId);
                            }
                        }
                        if (closest('#toggle-bio-btn')) {
                            const bio = document.getElementById('profile-bio');
                            const btn = closest('#toggle-bio-btn');
                            if (bio && btn) { 
                                bio.classList.toggle('expanded');
                                btn.textContent = bio.classList.contains('expanded') ? 'Show Less' : 'Read More';
                            }
                        }
                        if (closest('#toggle-profile-info-btn')) {
                            const extendedInfo = document.getElementById('profile-extended-info');
                            const btn = closest('#toggle-profile-info-btn');
                            if (extendedInfo && btn) { 
                                const isHidden = extendedInfo.style.display === 'none' || extendedInfo.style.display === '';
                                extendedInfo.style.display = isHidden ? 'block' : 'none';
                                btn.textContent = isHidden ? 'View Less' : 'View More';
                            }
                        }
                        if (closest('.help-now-btn')) {
                            if(isGuest){showNotification('Please log in to donate.','info');var _amh=document.getElementById('auth-modal-overlay'),_lvh=document.getElementById('login-view');if(_amh){_amh.style.display='flex';_amh.classList.add('show');}if(_lvh)_lvh.style.display='block';document.body.classList.add('modal-open');setTimeout(function(){if(typeof generateCaptcha==='function')generateCaptcha();},150);return;}
                            var _sp=closest('.impact-story');
                            // Read applicant name from the button's own dataset first -- avoids picking up the post
                            // header title (e.g. "SOS: [title]") which is not the applicant's name
                            var _hnBtn = closest('.help-now-btn');
                            var _applicantUsername = (_hnBtn && _hnBtn.dataset.sosUsername)
                                ? _hnBtn.dataset.sosUsername
                                : (_sp ? (_sp.dataset.username || 'the cause') : 'the cause');
                            var _applicantUserId = (_hnBtn && _hnBtn.dataset.sosUserId)
                                ? _hnBtn.dataset.sosUserId
                                : (_sp ? (_sp.dataset.userId || '') : '');
                            window._sosDonationContext={
                                username: _applicantUsername,
                                userId:   _applicantUserId,
                                amount:   _sp ? (_sp.dataset.amount || '') : '',
                                postId:   _sp ? (_sp.dataset.postId || '') : ''
                            };
                            const _dmt=document.getElementById('donation-modal-title'),_dmd=document.getElementById('donation-modal-description');
                            if(_dmt)_dmt.textContent='Support '+_applicantUsername + "'s SOS Request";
                            if(_dmd)_dmd.textContent=window._sosDonationContext.amount?'They need '+window._sosDonationContext.amount+'. Every contribution counts.':'Funds held in escrow until verified.';
                            const _ni=document.getElementById('donate-name-card'),_ei=document.getElementById('donate-email-card');
                            if(_ni&&!_ni.value)_ni.value=userState.fullName||'';
                            if(_ei&&!_ei.value)_ei.value=userState.email||'';
                            const _sdm=document.getElementById('sos-donation-modal');
                            if(_sdm){_sdm.style.display='flex';_sdm.classList.add('show');document.body.classList.add('modal-open');document.body.style.overflow='hidden';}
                        }
                        if (closest('.share-profile-btn')) {
                            // Determine who we're viewing (own profile or another user's)
                            var _profileSection = document.getElementById('profile');
                            var _profileUserId = _profileSection && _profileSection.querySelector('[data-user-id]') 
                                ? _profileSection.querySelector('[data-user-id]').dataset.userId 
                                : userState.id;
                            var _viewedUser = (_profileUserId && mockUsers[_profileUserId]) ? mockUsers[_profileUserId] : userState;
                            shareContent({
                                title: `View ${_viewedUser.fullName}'s Profile on Empyrean`,
                                text: _viewedUser.bio || `Check out ${_viewedUser.fullName}'s profile on Empyrean.`,
                                url: `${window.location.href.split('#')[0]}#profile/${_viewedUser.username}`
                            });
                        }
                        if (closest('#pin-location-btn')) {
                            const lat = (Math.random() * (9.0 - 6.4) + 6.4).toFixed(6);
                            const lon = (Math.random() * (7.4 - 3.4) + 3.4).toFixed(6);
                            const crisisLocationCoords = document.getElementById('crisis-location-coords');
                            if (crisisLocationCoords) crisisLocationCoords.textContent = `Pinned at: ${lat}, ${lon}`;
                        }
                        if (closest('#create-page-btn')) {
                            const createBusinessPageModal = document.getElementById('create-business-page-modal');
                            if (createBusinessPageModal) createBusinessPageModal.classList.add('show');
                        }
                        if (closest('#host-control-toggle-btn')) {
                            const panel = document.getElementById('host-control-panel');
                            if (panel) {
                                panel.classList.toggle('expanded');
                                const icon = closest('#host-control-toggle-btn').querySelector('i');
                                if (icon) {
                                    icon.classList.toggle('fa-chevron-right', !panel.classList.contains('expanded'));
                                    icon.classList.toggle('fa-chevron-left', panel.classList.contains('expanded'));
                                }
                            }
                            return; 
                        }
                        return;
                    }

                    const adminAction = closest('.approve-withdrawal-btn, .reject-withdrawal-btn, .approve-sos-btn, .reject-sos-btn, .sos-hold-btn');
                    if(adminAction) {
                        e.preventDefault();
                        const itemEl = closest('.admin-queue-item');
                        if (!itemEl) return;

                        const id = itemEl.dataset.id;
                        const actionType = itemEl.parentElement ? itemEl.parentElement.id : '';

                        // ── Audit trail helper ──────────────────────────────────
                        function logAuditAction(action, targetUser, details) {
                            if (!window.empyreanAuditLog) window.empyreanAuditLog = [];
                            const entry = {
                                timestamp: new Date().toLocaleString(),
                                admin: userState.username || 'admin',
                                action, targetUser, details,
                                id: 'audit-' + Date.now()
                            };
                            window.empyreanAuditLog.unshift(entry);
                            const tbody = document.getElementById('admin-audit-log-body');
                            if (tbody) {
                                const emptyRow = tbody.querySelector('td[colspan]');
                                if (emptyRow) emptyRow.closest('tr').remove();
                                const row = document.createElement('tr');
                                row.style.borderBottom = '1px solid rgba(10,14,39,0.06)';
                                row.innerHTML = `
                                    <td style="padding:10px 16px;font-size:0.82rem;color:var(--text-muted);">${entry.timestamp}</td>
                                    <td style="padding:10px 16px;font-weight:600;color:var(--secondary);">@${entry.admin}</td>
                                    <td style="padding:10px 16px;"><span style="background:rgba(27,43,139,0.1);color:var(--secondary);padding:2px 10px;border-radius:50px;font-size:0.78rem;">${entry.action}</span></td>
                                    <td style="padding:10px 16px;color:var(--primary);">@${entry.targetUser}</td>
                                    <td style="padding:10px 16px;font-size:0.82rem;color:#555;">${entry.details}</td>
                                `;
                                tbody.prepend(row);
                            }
                        }

                        // ── Notify user helper ──────────────────────────────────
                        function notifyUser(userId, message, type) {
                            // In-app notification: add to notification feed if visible
                            if (!window.userNotifications) window.userNotifications = {};
                            if (!window.userNotifications[userId]) window.userNotifications[userId] = [];
                            window.userNotifications[userId].unshift({ message, type, time: new Date().toLocaleString(), read: false });
                            // Also show banner if current user is the target
                            if (userState.id === userId) {
                                showNotification(message, type);
                            }
                            // Save notification to Firestore
                            try {
                                fbDb.collection('notifications').add({
                                    userId, message, type,
                                    createdAt: new Date().toISOString(), read: false
                                });
                            } catch(e) {}
                        }

                        /* FIX (duplicate SOS approval handler — race condition root cause):
                           This block used to independently re-implement approve/hold/reject
                           for .approve-sos-btn / .sos-hold-btn / .reject-sos-btn, firing on
                           the SAME click as app-sos.js's _handleApproveSos/_handleHoldSos/
                           _handleRejectSos (both listeners are bound to document with no
                           stopPropagation/dedup guard between them). That meant every SOS
                           approval ran TWO competing, independent Firestore write sequences
                           against the same posts/{id} and sos_queue/{id} docs — this one
                           unawaited and rendering the feed card before its own write landed,
                           which is what caused the intermittent posts/crisis-* permission-
                           denied errors on `views` even after app-sos.js was fixed and
                           redeployed. app-sos.js is now the single source of truth for these
                           three actions (its handler awaits the Firestore write and seeds
                           engagement counters BEFORE rendering the card), so this duplicate
                           is now a no-op pass-through. .approve-withdrawal-btn /
                           .reject-withdrawal-btn / .delete-approved-sos-btn below are
                           untouched — they have no equivalent in app-sos.js. */
                        if (closest('.approve-sos-btn') || closest('.sos-hold-btn') || closest('.reject-sos-btn')) {
                            return; // handled exclusively by app-sos.js now
                        }

                        if (closest('.delete-approved-sos-btn')) {
                            const postId = e.target.closest('.delete-approved-sos-btn').dataset.postId;
                            if (postId && confirm('Permanently delete this approved SOS post from the dashboard?')) {
                                // Remove from feed
                                const feedPost = document.querySelector('[data-post-id="' + postId + '"]');
                                if (feedPost) feedPost.remove();
                                // Remove log entry
                                const logEntry = e.target.closest('div[style*="border-left"]');
                                if (logEntry) logEntry.remove();
                                // Delete from Firestore
                                try { fbDb.collection('posts').doc(postId).delete(); } catch(e) {}
                                showNotification('SOS post deleted from dashboard.', 'info');
                            }
                            return;
                        }

                        if (closest('.delete-sos-btn')) {
                            // Admin-only hard delete of SOS from queue AND from feed
                            const sosRequest = mockAdminSosQueue.find(i => i.id === id);
                            if (sosRequest) {
                                logAuditAction('SOS Deleted', sosRequest.username, `SOS "${sosRequest.title}" permanently deleted by admin.`);
                                mockAdminSosQueue = mockAdminSosQueue.filter(i => i.id !== id);
                                // Remove from feed if it was published
                                const feedPost = document.querySelector(`[data-post-id="${id}"]`);
                                if (feedPost) feedPost.remove();
                                // Delete from Firestore
                                try {
                                    fbDb.collection('sos_queue').doc(id).delete();
                                    fbDb.collection('posts').doc(id).delete();
                                } catch(e) {}
                                itemEl.style.opacity = '0';
                                setTimeout(() => { itemEl.remove(); renderAdminQueues(); }, 300);
                                showNotification('SOS request permanently deleted.', 'info');
                            }
                            return;
                        }

                        if (closest('.approve-withdrawal-btn')) {
                            if (actionType === 'admin-withdrawal-queue') {
                                const wd = mockAdminWithdrawalQueue.find(i => i.id === id);
                                if (wd) {
                                    logAuditAction('Withdrawal Approved', wd.username, `Amount: ${wd.amount}, Method: ${wd.method}`);
                                    notifyUser(wd.userId, `Your withdrawal of ${wd.amount} has been approved and is being processed.`, 'success');
                                }
                                mockAdminWithdrawalQueue = mockAdminWithdrawalQueue.filter(i => i.id !== id);
                            }
                            itemEl.style.opacity = '0';
                            setTimeout(() => { itemEl.remove(); renderAdminQueues(); }, 300);
                            showNotification('Withdrawal approved.');
                            return;
                        }

                        if (closest('.reject-withdrawal-btn')) {
                            if (actionType === 'admin-withdrawal-queue') {
                                const wd = mockAdminWithdrawalQueue.find(i => i.id === id);
                                if (wd) {
                                    logAuditAction('Withdrawal Rejected', wd.username, `Amount: ${wd.amount}, Method: ${wd.method}`);
                                    notifyUser(wd.userId, `Your withdrawal of ${wd.amount} was rejected. Please contact support.`, 'error');
                                }
                                mockAdminWithdrawalQueue = mockAdminWithdrawalQueue.filter(i => i.id !== id);
                            }
                            itemEl.style.opacity = '0';
                            setTimeout(() => { itemEl.remove(); renderAdminQueues(); }, 300);
                            showNotification('Withdrawal rejected.');
                            return;
                        }

                        return;
                    }

                    const reelCard = closest('#reels .reel-card');
                    if (reelCard && !closest('.options-btn')) {
                        e.preventDefault();
                        openReelViewer(reelCard);
                        return;
                    }
                    
                    const interactiveAction = closest('.add-to-cart-btn, .cart-icon-button, .checkout-btn, .like-btn, .follow-btn, .gift-button, .report-btn, .share-btn, .comment-btn, .edit-post-btn, .delete-post-btn, .promote-post-btn, .promote-item-btn, #post-format-toolbar button, .retweet-btn, .donate-post-btn, .bookmark-btn, .download-media-btn');
                    if(interactiveAction) {
                        e.preventDefault();
                        const postElement = closest('.impact-story, .reel-card, .property-card, .news-list-item');

                        if (isGuest && !closest('.share-btn') && !closest('.follow-btn')) {
                            showNotification("Please log in to perform this action.", 'error');
                            authModal.classList.add('show');
                            document.getElementById('login-view').style.display = 'block';
                            setTimeout(function(){ if(typeof generateCaptcha==='function') generateCaptcha(); }, 80);
                            return;
                        }

                        if (closest('.donate-post-btn')) {
                            // Donation is restricted to SOS request posts only -- guard against crisis cards
                            var _donCard = e.target.closest('.impact-story');
                            if (_donCard && _donCard.classList.contains('crisis-report')) {
                                // Crisis posts do not carry a donate button -- nothing to do
                                return;
                            }
                            if (isGuest) { showNotification('Please log in to donate.', 'info'); var _amh=document.getElementById('auth-modal-overlay');if(_amh){_amh.style.display='flex';_amh.classList.add('show');}document.body.classList.add('modal-open'); return; }
                            var _dmo = document.getElementById('sos-donation-modal');
                            var _dmt2 = document.getElementById('donation-modal-title');
                            var _dmd2 = document.getElementById('donation-modal-description');
                            // Read applicant name from dataset (set when the post was built), not from the post header title
                            var _donBtn2 = e.target.closest('.donate-post-btn');
                            var _applicantName = (_donBtn2 && _donBtn2.dataset.sosUsername) ? _donBtn2.dataset.sosUsername
                                : (_donCard ? (_donCard.dataset.username || 'this person') : 'this person');
                            var _applicantId   = (_donBtn2 && _donBtn2.dataset.sosUserId)   ? _donBtn2.dataset.sosUserId   : (_donCard ? (_donCard.dataset.userId   || '') : '');
                            var _applicantAmt  = _donCard ? (_donCard.dataset.amount || '') : '';
                            var _applicantPost = _donCard ? (_donCard.dataset.postId  || '') : '';
                            window._sosDonationContext = { username: _applicantName, userId: _applicantId, amount: _applicantAmt, postId: _applicantPost };
                            if (_dmt2) _dmt2.textContent = 'Support ' + _applicantName + "'s SOS Request";
                            if (_dmd2) _dmd2.textContent = _applicantAmt ? 'They need ' + _applicantAmt + '. Every contribution counts.' : 'Funds held in escrow until verified.';
                            var _ni2 = document.getElementById('donate-name-card'), _ei2 = document.getElementById('donate-email-card');
                            if (_ni2 && !_ni2.value) _ni2.value = (typeof userState !== 'undefined' && userState.fullName) || '';
                            if (_ei2 && !_ei2.value) _ei2.value = (typeof userState !== 'undefined' && userState.email)    || '';
                            if (_dmo) { _dmo.style.display = 'flex'; _dmo.classList.add('show'); document.body.classList.add('modal-open'); document.body.style.overflow = 'hidden'; }
                            return;
                        }
                        if(closest('.retweet-btn') && postElement) {
                            const originalPostId = postElement.dataset.postId;
                            const originalUserId = postElement.dataset.userId;
                            const retweetBtn = closest('.retweet-btn');
                            const retweetCountEl = retweetBtn ? retweetBtn.querySelector('.retweet-count') : null;

                            if (originalUserId === userState.id) {
                                showNotification('You cannot retweet your own post.', 'warning'); return;
                            }

                            // ── Show Retweet / Quote picker (X-style) ──
                            document.querySelectorAll('._rt_picker').forEach(p => p.remove());
                            const picker = document.createElement('div');
                            picker.className = '_rt_picker';
                            const btnRect = retweetBtn ? retweetBtn.getBoundingClientRect() : { top: 200, left: 100, height: 32 };
                            picker.style.cssText = 'position:fixed;z-index:99990;background:#fff;border:1.5px solid rgba(10,14,39,0.10);border-radius:16px;box-shadow:0 8px 32px rgba(10,14,39,0.18);padding:6px 0;min-width:180px;font-family:inherit;animation:fadeIn 0.15s ease;';
                            picker.style.top  = Math.min(btnRect.top + btnRect.height + 6, window.innerHeight - 120) + 'px';
                            picker.style.left = Math.max(8, Math.min(btnRect.left, window.innerWidth - 196)) + 'px';
                            const alreadyRt = userState.retweetedPostIds.has(originalPostId);
                            picker.innerHTML = `
                                <button class="_rt_do" style="display:flex;align-items:center;gap:10px;width:100%;border:none;background:none;padding:12px 18px;cursor:pointer;font-size:0.9rem;font-weight:600;color:var(--primary);">
                                    <i class="fas fa-retweet" style="width:18px;color:${alreadyRt?'#e53935':'var(--secondary)'}"></i>
                                    ${alreadyRt ? 'Undo Retweet' : 'Retweet'}
                                </button>
                                <button class="_rt_quote" style="display:flex;align-items:center;gap:10px;width:100%;border:none;background:none;padding:12px 18px;cursor:pointer;font-size:0.9rem;font-weight:600;color:var(--primary);border-top:1px solid rgba(10,14,39,0.06);">
                                    <i class="fas fa-quote-right" style="width:18px;color:var(--secondary)"></i> Quote
                                </button>`;
                            document.body.appendChild(picker);
                            const _closePicker = (ev) => { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', _closePicker, true); } };
                            setTimeout(() => document.addEventListener('click', _closePicker, true), 100);

                            picker.querySelector('._rt_do').onclick = function() {
                                picker.remove();
                                document.removeEventListener('click', _closePicker, true);
                                if (alreadyRt) {
                                    userState.retweetedPostIds.delete(originalPostId);
                                    if (retweetBtn) retweetBtn.style.color = '';
                                    if (retweetCountEl) retweetCountEl.textContent = Math.max(0, (parseInt(retweetCountEl.textContent)||1) - 1);
                                    // FIX (live retweet counts): persist the undo to Firestore —
                                    // previously this only ever changed the local DOM span, so the
                                    // original post's retweetCount in Firestore was never touched.
                                    try {
                                        if (window._firebaseLoaded && window.fbDb && originalPostId) {
                                            var _rtFv = (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) || null;
                                            // FIX (collection routing): postElement may be a crisis-report card,
                                            // whose engagement fields live in 'crisis_reports', not 'posts'.
                                            // Mirrors _col45() in app-fix-final.js.
                                            var _rtCol = (postElement && postElement.classList && postElement.classList.contains('crisis-report'))
                                                ? 'crisis_reports'
                                                : (postElement && postElement.classList && postElement.classList.contains('biz-post-card'))
                                                    ? 'business_posts' : 'posts';
                                            window.fbDb.collection(_rtCol).doc(originalPostId).update({
                                                retweetCount: (_rtFv && typeof _rtFv.increment === 'function') ? _rtFv.increment(-1) : -1
                                            }).catch(function(){});
                                        }
                                    } catch (eRtUndo) {}
                                    showNotification('Retweet removed.', 'info'); return;
                                }
                                const originalAuthor = mockUsers[originalUserId];
                                const originalText = postElement.querySelector('.story-content p')?.innerHTML || '';
                                const mediaFiles = Array.from((postElement.querySelector('.story-media-container,.story-media-item')||{querySelectorAll:()=>[]}).querySelectorAll('img[src],video[src]')).map(el=>{
                                    var _url = el.getAttribute('src')||el.dataset.src||el.dataset.cloudUrl||'';
                                    // Prefer cloudinary URL stored in data attributes over blob
                                    if (_url.startsWith('blob:') && el.dataset.cloudUrl) _url = el.dataset.cloudUrl;
                                    return {url:_url, type:el.tagName==='IMG'?'image/jpeg':'video/mp4'};
                                }).filter(m=>m.url);
                                const authorObj = originalAuthor || { id: originalUserId, fullName: postElement.querySelector('.story-user-info strong')?.textContent || 'User', avatar: postElement.querySelector('.story-header img')?.src || '' };

                                const retweet = createNewPostElement(originalText, mediaFiles, authorObj, false, { retweeterName: userState.fullName });
                                var _feedCont = feedContainer || document.getElementById('feed-container');
                                if (_feedCont) _feedCont.prepend(retweet);

                                // ── Mirror retweeted post into profile dashboard ──
                                const pd = document.getElementById('profile-dash-feed');
                                if (pd) {
                                    const rtClone = retweet.cloneNode(true);
                                    if (!pd.querySelector('[data-post-id="'+retweet.dataset.postId+'"]')) pd.prepend(rtClone);
                                }

                                userState.retweetedPostIds.add(originalPostId);
                                if (retweetBtn) retweetBtn.style.color = 'var(--secondary)';
                                if (retweetCountEl) retweetCountEl.textContent = (parseInt(retweetCountEl.textContent)||0) + 1;

                                // Also update count on the ORIGINAL post's retweet-count span
                                postElement.querySelectorAll('.retweet-count').forEach(function(rc) {
                                    rc.textContent = (parseInt(rc.textContent)||0) + 1;
                                });

                                rewardUserForAction && rewardUserForAction('RETWEET_POST');
                                if (typeof updateLiveInteractionCount === 'function') updateLiveInteractionCount('like');
                                try {
                                    fbDb.collection('posts').doc(retweet.dataset.postId).set({ id:retweet.dataset.postId, userId:userState.id, username:userState.fullName||userState.username, avatar:userState.avatar||'', text:originalText||'', media:mediaFiles.map(m=>m.url||m).filter(u=>u&&!u.startsWith('blob:')), isRetweet:true, retweetOf:originalPostId, retweeterName:userState.fullName, createdAt:new Date().toISOString() });
                                } catch(e) {}
                                // FIX (live retweet counts): persist retweetCount on the ORIGINAL
                                // post in Firestore — previously only the local DOM span was
                                // incremented, so the count never survived a refresh and never
                                // synced to other viewers. The existing posts 'modified' listener
                                // in app-feed.js already mirrors this field back to the DOM.
                                try {
                                    if (window._firebaseLoaded && window.fbDb && originalPostId) {
                                        var _rtFv2 = (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) || null;
                                        // FIX (collection routing): same as the undo-retweet site above —
                                        // crisis-report originals live in 'crisis_reports', not 'posts'.
                                        var _rtCol2 = (postElement && postElement.classList && postElement.classList.contains('crisis-report'))
                                            ? 'crisis_reports'
                                            : (postElement && postElement.classList && postElement.classList.contains('biz-post-card'))
                                                ? 'business_posts' : 'posts';
                                        window.fbDb.collection(_rtCol2).doc(originalPostId).update({
                                            retweetCount: (_rtFv2 && typeof _rtFv2.increment === 'function') ? _rtFv2.increment(1) : 1
                                        }).catch(function(){});
                                    }
                                } catch (eRtDo) {}
                                if (typeof window.pushNotification==='function' && originalUserId && originalUserId!==userState.id) window.pushNotification((userState.fullName||'Someone')+' retweeted your post! 🔁','info');
                                showNotification('🔁 Retweeted!', 'success');
                            };

                            picker.querySelector('._rt_quote').onclick = function() {
                                picker.remove();
                                document.removeEventListener('click', _closePicker, true);
                                const originalText = postElement.querySelector('.story-content p')?.textContent || '';
                                const originalAuthorEl = postElement.querySelector('.story-user-info strong');
                                const originalAuthorName = originalAuthorEl ? originalAuthorEl.textContent : 'Unknown';
                                const originalAvatar = postElement.querySelector('.story-header img')?.src || '';
                                const originalMedia = Array.from((postElement.querySelector('.story-media-container,.story-media-item')||{querySelectorAll:()=>[]}).querySelectorAll('img[src],video[src]')).map(el=>{
                                    var _u = el.getAttribute('src')||el.dataset.src||el.dataset.cloudUrl||'';
                                    if (_u.startsWith('blob:') && el.dataset.cloudUrl) _u = el.dataset.cloudUrl;
                                    return _u;
                                }).filter(u=>u&&!u.startsWith('blob:'));

                                // ── Inline floating quote-compose modal ──
                                document.querySelectorAll('#_quote_compose_modal').forEach(function(el){ el.remove(); });
                                const _qModal = document.createElement('div');
                                _qModal.id = '_quote_compose_modal';
                                _qModal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,14,39,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
                                _qModal.innerHTML = `
                                <div style="background:var(--card-bg,#fff);border-radius:18px;width:100%;max-width:520px;box-shadow:0 8px 40px rgba(0,0,0,0.22);overflow:hidden;">
                                    <div style="padding:14px 18px;border-bottom:1px solid rgba(10,14,39,0.08);display:flex;align-items:center;justify-content:space-between;">
                                        <strong style="font-size:1rem;color:var(--primary);">Quote Post</strong>
                                        <button id="_qm_close" style="background:none;border:none;cursor:pointer;font-size:1.3rem;color:var(--text-muted);line-height:1;">×</button>
                                    </div>
                                    <div style="padding:14px 18px;">
                                        <div style="display:flex;gap:10px;margin-bottom:12px;">
                                            <img src="${window.userState&&window.userState.avatar||''}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src='https://ui-avatars.com/api/?name=U&background=1B2B8B&color=fff&size=80'">
                                            <textarea id="_qm_text" placeholder="Add your thoughts…" style="flex:1;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;padding:10px 12px;font-size:0.92rem;resize:none;min-height:80px;font-family:inherit;color:var(--primary);background:var(--input-bg,#f8f9ff);outline:none;"></textarea>
                                        </div>
                                        <div style="border:1.5px solid rgba(10,14,39,0.1);border-radius:12px;padding:10px 14px;background:rgba(10,14,39,0.02);">
                                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                                                <img src="${originalAvatar}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
                                                <strong style="font-size:0.8rem;color:var(--secondary);">@${originalAuthorName}</strong>
                                            </div>
                                            <p style="font-size:0.82rem;color:var(--text-muted);margin:0;line-height:1.4;">${originalText.substring(0,200)}${originalText.length>200?'…':''}</p>
                                            ${originalMedia[0]?((/\.(mp4|webm|mov)(\?|$)/i.test(originalMedia[0])||/\/video\/upload\//i.test(originalMedia[0]))?'<video src="'+originalMedia[0]+'" muted playsinline preload="metadata" controls style="margin-top:8px;width:100%;max-height:120px;object-fit:cover;border-radius:8px;display:block;"></video>':'<img src="'+originalMedia[0]+'" style="margin-top:8px;width:100%;max-height:120px;object-fit:cover;border-radius:8px;">'):''}
                                        </div>
                                    </div>
                                    <div style="padding:10px 18px 16px;display:flex;justify-content:flex-end;gap:10px;">
                                        <button id="_qm_cancel" style="padding:9px 20px;border-radius:50px;border:1.5px solid rgba(10,14,39,0.15);background:none;cursor:pointer;font-weight:600;color:var(--text-muted);font-size:0.88rem;">Cancel</button>
                                        <button id="_qm_post" style="padding:9px 24px;border-radius:50px;border:none;background:var(--secondary,#1B2B8B);color:white;cursor:pointer;font-weight:700;font-size:0.88rem;">Post Quote</button>
                                    </div>
                                </div>`;
                                document.body.appendChild(_qModal);
                                setTimeout(function(){ var ta=document.getElementById('_qm_text'); if(ta) ta.focus(); }, 80);

                                function _closeQModal() { _qModal.remove(); }
                                document.getElementById('_qm_close').onclick = _closeQModal;
                                document.getElementById('_qm_cancel').onclick = _closeQModal;
                                _qModal.addEventListener('click', function(ev){ if(ev.target===_qModal) _closeQModal(); });

                                document.getElementById('_qm_post').onclick = async function() {
                                    const quoteText = (document.getElementById('_qm_text')?.value||'').trim();
                                    if (!quoteText) { showNotification('Please add your thoughts before posting.', 'warning'); return; }
                                    const _qBtn = document.getElementById('_qm_post');
                                    if (_qBtn) { _qBtn.disabled = true; _qBtn.textContent = 'Posting…'; }

                                    // Build quote post element
                                    const quoteEl = createNewPostElement(quoteText, [], {
                                        id: userState.id, fullName: userState.fullName||userState.username, avatar: userState.avatar||''
                                    });
                                    // Inject quoted-post preview block inside the new element
                                    const _qBlock = document.createElement('div');
                                    _qBlock.style.cssText = 'border:1.5px solid rgba(10,14,39,0.1);border-radius:12px;padding:10px 14px;margin:8px 16px 4px;background:rgba(10,14,39,0.02);';
                                    _qBlock.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">'
                                        + '<img src="'+originalAvatar+'" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'">'
                                        + '<strong style="font-size:0.78rem;color:var(--secondary);">@'+originalAuthorName+'</strong></div>'
                                        + '<p style="font-size:0.8rem;color:var(--text-muted);margin:0;line-height:1.4;">'+originalText.substring(0,200)+(originalText.length>200?'…':'')+'</p>'
                                        + (originalMedia[0]?((/\.(mp4|webm|mov)(\?|$)/i.test(originalMedia[0])||/\/video\/upload\//i.test(originalMedia[0]))?'<video src="'+originalMedia[0]+'" muted playsinline preload="metadata" controls style="margin-top:6px;width:100%;max-height:100px;object-fit:cover;border-radius:7px;display:block;"></video>':'<img src="'+originalMedia[0]+'" style="margin-top:6px;width:100%;max-height:100px;object-fit:cover;border-radius:7px;">'):'');
                                    const _storyContent = quoteEl.querySelector('.story-content');
                                    if (_storyContent) _storyContent.insertAdjacentElement('afterend', _qBlock);

                                    const _fc = document.getElementById('feed-container');
                                    if (_fc) _fc.prepend(quoteEl);
                                    const _pd = document.getElementById('profile-dash-feed');
                                    if (_pd) _pd.prepend(quoteEl.cloneNode(true));

                                    // Save to Firestore
                                    const _qId = quoteEl.dataset.postId || ('quote-'+Date.now());
                                    quoteEl.dataset.postId = _qId;
                                    try {
                                        await window.fbDb.collection('posts').doc(_qId).set({
                                            id: _qId, text: quoteText, media: [],
                                            userId: userState.id, username: userState.fullName||userState.username,
                                            avatar: userState.avatar||'',
                                            isQuote: true, quotedPostId: originalPostId,
                                            quotedAuthor: originalAuthorName, quotedText: originalText.substring(0,240),
                                            quotedMedia: originalMedia[0]||'',
                                            createdAt: new Date().toISOString()
                                        });
                                    } catch(e) { console.warn('[Quote] Firestore save failed:', e.message); }

                                    _closeQModal();
                                    showNotification('✅ Quote posted!', 'success');
                                    if (typeof rewardUserForAction === 'function') rewardUserForAction('CREATE_POST');
                                }; // end _qm_post.onclick
                            }; // end ._rt_quote.onclick

                        } else if(closest('.bookmark-btn')) {
                            // FIX (bookmark was purely cosmetic): previously this button had
                            // NO click handler anywhere in the codebase — tapping it did
                            // nothing at all, not even a CSS toggle. Persists to
                            // users/{uid}/bookmarks/{postId} (owner-only collection, see
                            // firestore.rules) so a bookmark survives refresh and syncs
                            // across the user's own devices/sessions.
                            const bmCard = postElement || closest('[data-post-id]');
                            const bmPostId = bmCard && bmCard.dataset.postId;
                            if (!bmPostId) {
                                showNotification('Could not bookmark this post.', 'error');
                            } else if (typeof userState === 'undefined' || !userState.id) {
                                if (typeof openAuthModal === 'function') openAuthModal();
                                else showNotification('Please sign in to bookmark posts.', 'info');
                            } else {
                                const bmBtn = closest('.bookmark-btn');
                                const bmSvg = bmBtn && bmBtn.querySelector('svg');
                                const bmIconEl = bmBtn && bmBtn.querySelector('i'); // Font Awesome variant, if any
                                const bmWasOn = bmBtn && bmBtn.classList.contains('bookmarked');
                                const bmIsOn = !bmWasOn;

                                // Optimistic UI flip — instant feedback, corrected below on failure.
                                // Two icon styles exist in this codebase: inline <svg> (feed cards,
                                // fill toggles directly) and Font Awesome <i> (thread view, swaps
                                // the far-/fas- class instead — fill has no effect on those).
                                if (bmBtn) bmBtn.classList.toggle('bookmarked', bmIsOn);
                                if (bmSvg) bmSvg.style.fill = bmIsOn ? 'currentColor' : 'none';
                                if (bmIconEl) bmIconEl.className = bmIsOn ? 'fas fa-bookmark' : 'far fa-bookmark';
                                showNotification(bmIsOn ? 'Added to Bookmarks' : 'Removed from Bookmarks', 'success');

                                if (window._firebaseLoaded && window.fbDb) {
                                    const bmRef = window.fbDb.collection('users').doc(userState.id)
                                        .collection('bookmarks').doc(bmPostId);
                                    const bmCol = bmCard.classList.contains('crisis-report') ? 'crisis_reports'
                                                : bmCard.classList.contains('biz-post-card')  ? 'business_posts'
                                                : 'posts';
                                    const bmPromise = bmIsOn
                                        ? bmRef.set({
                                              postId: bmPostId,
                                              // Collection routing mirrors _col45() so re-opening a bookmarked
                                              // crisis-report/business post later resolves correctly.
                                              collection: bmCol,
                                              bookmarkedAt: (window.firebase && window.firebase.firestore &&
                                                             window.firebase.firestore.FieldValue.serverTimestamp())
                                                             || new Date().toISOString()
                                          })
                                        : bmRef.delete();

                                    // FEATURE (bookmark notifications): notify the post's original
                                    // author when someone (else) bookmarks their post — only on add,
                                    // never on remove, matching how retweet/like notifications behave
                                    // elsewhere in this file. ownerId is read off the card's own
                                    // dataset, set by createSosPostOnFeed/createNewPostElement/etc.
                                    //
                                    // FIX: this previously called window.pushNotification() directly,
                                    // which only appends to the CURRENT browser's in-memory bell — so
                                    // it was actually showing the bookmarker their own name ("You
                                    // bookmarked your post! 🔖") instead of reaching the real owner,
                                    // and never persisted anywhere. A cross-user notification has to
                                    // be a Firestore write that the owner's own loadUserNotifications()
                                    // picks up on their next load (same poll-based pattern every other
                                    // notification in this codebase already uses — see app-notifications.js §8).
                                    if (bmIsOn) {
                                        const bmOwnerId = bmCard.dataset.userId || bmCard.dataset.ownerId;
                                        if (bmOwnerId && bmOwnerId !== userState.id) {
                                            window.fbDb.collection('notifications').add({
                                                userId:    bmOwnerId,
                                                message:   (userState.fullName || userState.username || 'Someone') + ' bookmarked your post! 🔖',
                                                type:      'bookmark',
                                                read:      false,
                                                createdAt: new Date().toISOString()
                                            }).catch(function(err) {
                                                console.warn('[bookmark] owner notification write failed:', err && err.message);
                                            });
                                        }

                                        // FEATURE (Saved section quick access): also drop a bell entry
                                        // in the BOOKMARKER's own notification channel (this one is
                                        // correctly local — it's about their own action, not someone
                                        // else's), tappable to jump straight to their Saved section.
                                        // The toast above already confirms the action instantly; this
                                        // gives them a persistent, clickable record of it too.
                                        if (typeof window.pushNotification === 'function') {
                                            window.pushNotification(
                                                'Saved to your bookmarks 🔖',
                                                'bookmark',
                                                null,
                                                { navTarget: 'saved-posts' }
                                            );
                                        }
                                    }

                                    bmPromise.catch(function(err) {
                                        // Revert optimistic UI on failure so the button never lies
                                        // about a state that isn't actually persisted.
                                        if (bmBtn) bmBtn.classList.toggle('bookmarked', bmWasOn);
                                        if (bmSvg) bmSvg.style.fill = bmWasOn ? 'currentColor' : 'none';
                                        if (bmIconEl) bmIconEl.className = bmWasOn ? 'fas fa-bookmark' : 'far fa-bookmark';
                                        showNotification('Bookmark failed to save — please try again.', 'error');
                                        console.warn('[bookmark] Firestore error:', err && err.message);
                                    });
                                }
                            }

                        } else if(closest('.download-media-btn')) {
                            // Universal watermarked download -- images get canvas watermark, videos download directly
                            const dlBtnEl = closest('.download-media-btn');
                            const container = postElement ||
                                closest('.reel-card') ||
                                closest('.news-list-item') ||
                                closest('.property-card') ||
                                e.target.closest('[data-media-url]');
                            const mediaEls = container
                                ? container.querySelectorAll('img[src], video[src]')
                                : [];
                            const urls = [];
                            mediaEls.forEach(function(el) {
                                const url = el.src || el.dataset.src;
                                if (url && !url.startsWith('data:') && !url.startsWith('blob:') && !urls.includes(url)) {
                                    urls.push({ url: url, type: el.tagName === 'VIDEO' ? 'video' : 'image' });
                                }
                            });
                            if (container && container.dataset.mediaUrl) {
                                const u = container.dataset.mediaUrl;
                                if (u && !u.startsWith('blob:')) urls.push({ url: u, type: /\.(mp4|webm|mov)/i.test(u) ? 'video' : 'image' });
                            }
                            if (urls.length === 0) {
                                showNotification('No downloadable media found in this post.', 'info');
                            } else {
                                // FEATURE (real-time download progress indicator): previously
                                // downloads were fire-and-forget — a generic "Preparing..."
                                // toast with no feedback on actual progress, especially
                                // noticeable on large videos over a slow connection. This
                                // injects a small pill next to the download button showing
                                // real streamed-byte percentage per file, using
                                // ReadableStream + Content-Length instead of a fake timer.
                                const _dlTracker = _createDownloadTracker(dlBtnEl, urls.length);

                                // FEATURE (download progress in notification channel): every
                                // per-file percentage tick also feeds a single bell notification
                                // with the overall (averaged) progress, throttled to 25%-step
                                // buckets so the panel updates meaningfully instead of re-rendering
                                // on every byte chunk. Wrapping tracker.update() here means every
                                // existing _dlTracker.update(i, pct) call site below automatically
                                // reports progress — no need to touch each one individually.
                                const _dlProgress  = new Array(urls.length).fill(0);
                                let _dlLastBucket  = -1;
                                const _dlFileWord  = urls.length > 1 ? 'files' : 'file';
                                const _dlNotif = (typeof window.pushNotification === 'function')
                                    ? window.pushNotification('⬇ Downloading ' + urls.length + ' ' + _dlFileWord + '... 0%', 'download')
                                    : null;
                                const _dlTrackerUpdate = _dlTracker.update.bind(_dlTracker);
                                _dlTracker.update = function(i, pct) {
                                    _dlTrackerUpdate(i, pct);
                                    _dlProgress[i] = pct;
                                    if (_dlNotif && typeof window.updateNotification === 'function') {
                                        const overall = Math.round(_dlProgress.reduce(function(a, b) { return a + b; }, 0) / _dlProgress.length);
                                        const bucket  = Math.floor(overall / 25);
                                        if (bucket !== _dlLastBucket || overall >= 100) {
                                            _dlLastBucket = bucket;
                                            window.updateNotification(_dlNotif.id, {
                                                message: overall >= 100
                                                    ? '⬇ Downloading ' + urls.length + ' ' + _dlFileWord + '... finishing up'
                                                    : '⬇ Downloading ' + urls.length + ' ' + _dlFileWord + '... ' + overall + '%'
                                            });
                                        }
                                    }
                                };

                                showNotification(`⬇ Preparing ${urls.length} file${urls.length > 1 ? 's' : ''} with Empyrean watermark...`, 'info');
                                const _dlPromises = urls.map(function(item, i) {
                                    const ts = Date.now();
                                    if (item.type === 'image') {
                                        // Canvas watermark for images
                                        return _fetchWithProgress(item.url, function(pct) { _dlTracker.update(i, pct); })
                                            .then(function(blob) {
                                                return new Promise(function(resolve) {
                                                    const img = new Image();
                                                    img.crossOrigin = 'anonymous';
                                                    const objUrl = URL.createObjectURL(blob);
                                                    img.onload = function() {
                                                        try {
                                                            const canvas = document.createElement('canvas');
                                                            canvas.width = img.naturalWidth;
                                                            canvas.height = img.naturalHeight;
                                                            const ctx = canvas.getContext('2d');
                                                            ctx.drawImage(img, 0, 0);
                                                            // Watermark bar at bottom
                                                            const barH = Math.max(36, canvas.height * 0.055);
                                                            ctx.fillStyle = 'rgba(10,14,39,0.72)';
                                                            ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
                                                            // Logo icon circle
                                                            const cx = 22, cy = canvas.height - barH / 2;
                                                            ctx.beginPath(); ctx.arc(cx, cy, barH * 0.38, 0, Math.PI * 2);
                                                            ctx.fillStyle = '#F5C518'; ctx.fill();
                                                            ctx.fillStyle = '#0A0E27'; ctx.font = `bold ${barH * 0.42}px Arial`;
                                                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                                                            ctx.fillText('E', cx, cy);
                                                            // Text
                                                            ctx.fillStyle = 'white';
                                                            ctx.font = `bold ${barH * 0.44}px Arial`;
                                                            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                                                            ctx.fillText('Empyrean', cx + barH * 0.52, cy);
                                                            ctx.fillStyle = 'rgba(255,255,255,0.5)';
                                                            ctx.font = `${barH * 0.32}px Arial`;
                                                            ctx.textAlign = 'right';
                                                            ctx.fillText('empyrean.app', canvas.width - 10, cy);
                                                            canvas.toBlob(function(wmBlob) {
                                                                URL.revokeObjectURL(objUrl);
                                                                if (!wmBlob) { resolve(); return; }
                                                                const a = document.createElement('a');
                                                                a.href = URL.createObjectURL(wmBlob);
                                                                a.download = 'empyrean-' + ts + '-' + (i + 1) + '.jpg';
                                                                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                                setTimeout(() => URL.revokeObjectURL(a.href), 10000);
                                                                _dlTracker.update(i, 100);
                                                                resolve();
                                                            }, 'image/jpeg', 0.92);
                                                        } catch(canvasErr) {
                                                            URL.revokeObjectURL(objUrl);
                                                            // CORS fallback — no progress tracking possible on this path
                                                            const a = document.createElement('a');
                                                            a.href = item.url; a.download = 'empyrean-' + ts + '-' + (i + 1) + '.jpg';
                                                            a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                            _dlTracker.update(i, 100);
                                                            resolve();
                                                        }
                                                    };
                                                    img.onerror = function() {
                                                        URL.revokeObjectURL(objUrl);
                                                        const a = document.createElement('a');
                                                        a.href = item.url; a.download = 'empyrean-' + ts + '-' + (i + 1) + '.jpg';
                                                        a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                        _dlTracker.update(i, 100);
                                                        resolve();
                                                    };
                                                    img.src = objUrl;
                                                });
                                            })
                                            .catch(function() {
                                                // Streamed fetch failed entirely (CORS, network) — direct-link fallback
                                                const a = document.createElement('a');
                                                a.href = item.url; a.download = 'empyrean-' + ts + '-' + (i + 1) + '.jpg';
                                                a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                _dlTracker.update(i, 100);
                                            });
                                    } else {
                                        // Video -- download directly (client-side video watermarking requires server)
                                        return _fetchWithProgress(item.url, function(pct) { _dlTracker.update(i, pct); })
                                            .then(function(blob) {
                                                const a = document.createElement('a');
                                                a.href = URL.createObjectURL(blob);
                                                a.download = 'empyrean-' + ts + '-' + (i + 1) + '.mp4';
                                                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                setTimeout(() => URL.revokeObjectURL(a.href), 30000);
                                                _dlTracker.update(i, 100);
                                            })
                                            .catch(function() {
                                                const a = document.createElement('a');
                                                a.href = item.url; a.download = 'empyrean-' + ts + '-' + (i + 1) + '.mp4';
                                                a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                _dlTracker.update(i, 100);
                                            });
                                    }
                                });
                                Promise.all(_dlPromises).then(function() {
                                    _dlTracker.finish();
                                    if (_dlNotif && typeof window.updateNotification === 'function') {
                                        window.updateNotification(_dlNotif.id, {
                                            message: '✅ Download complete — ' + urls.length + ' ' + _dlFileWord + ' saved',
                                            type:    'success',
                                            read:    false
                                        });
                                    }

                                    // FIX (Download Log was pure markup with no logic behind it,
                                    // then FIX (permissions): the first attempt used
                                    // users/{uid}/downloads, which the live Firestore Rules
                                    // reject ("Missing or insufficient permissions") since that
                                    // subcollection was never allowlisted server-side. Root-level
                                    // `downloads` + a userId field mirrors the already-working
                                    // `notifications` collection instead. downloadCount below only
                                    // updates a public per-post counter, not anything tied to the
                                    // downloading user, so this is still needed alongside it.
                                    if (typeof userState !== 'undefined' && userState.id && window._firebaseLoaded && window.fbDb) {
                                        const dlLogFv  = (window.firebase && window.firebase.firestore &&
                                                          window.firebase.firestore.FieldValue) || null;
                                        const dlLogTs  = dlLogFv && typeof dlLogFv.serverTimestamp === 'function'
                                            ? dlLogFv.serverTimestamp() : new Date().toISOString();
                                        const dlLogCol = window.fbDb.collection('downloads');
                                        const dlLogSourcePostId = container && container.dataset && container.dataset.postId;
                                        urls.forEach(function(item, i) {
                                            const dlLogId = 'dl-' + Date.now() + '-' + i;
                                            dlLogCol.doc(dlLogId).set({
                                                userId:     userState.id,
                                                url:        item.url,
                                                type:       item.type,
                                                postId:     dlLogSourcePostId || '',
                                                downloadedAt: dlLogTs
                                            }).then(function() {
                                                if (typeof window._renderDownloadLogFiltered === 'function' &&
                                                    document.getElementById('download-log-container')) {
                                                    if (typeof window.renderDownloadLog === 'function') window.renderDownloadLog();
                                                }
                                            }).catch(function(err) {
                                                console.warn('[download] download-log write failed:', err && err.message);
                                                showNotification('Saved to device, but could not add to your Download Log.', 'warning');
                                            });
                                        });
                                    }
                                }).catch(function() {
                                    // Safety net: every per-file branch above already swallows its
                                    // own errors with a direct-link fallback, so this should never
                                    // actually fire — but if something unforeseen throws, don't leave
                                    // the progress pill stuck on screen or the notification frozen
                                    // on "Downloading..." forever.
                                    _dlTracker.finish();
                                    if (_dlNotif && typeof window.updateNotification === 'function') {
                                        window.updateNotification(_dlNotif.id, {
                                            message: '⚠ Download finished with errors — some files may not have saved',
                                            type:    'warning',
                                            read:    false
                                        });
                                    }
                                });
                                rewardUserForAction && rewardUserForAction('DOWNLOAD_MEDIA');

                                // FIX (downloadCount was never actually written anywhere in this
                                // codebase): the count badge existed in markup and §45's debug
                                // panel showed writes succeeding, but those writes came from a
                                // file outside this patch set. This fires once per download
                                // action (not once per file, for multi-image posts) and only
                                // after the files have actually started saving above.
                                const dlPostId = container && container.dataset && container.dataset.postId;
                                if (dlPostId && window._firebaseLoaded && window.fbDb) {
                                    const dlFv = (window.firebase && window.firebase.firestore &&
                                                  window.firebase.firestore.FieldValue) || null;
                                    const dlCol = container.classList.contains('crisis-report') ? 'crisis_reports'
                                                : container.classList.contains('biz-post-card')  ? 'business_posts'
                                                : 'posts';
                                    window.fbDb.collection(dlCol).doc(dlPostId).update({
                                        downloadCount: dlFv && typeof dlFv.increment === 'function' ? dlFv.increment(1) : 1
                                    }).then(function() {
                                        const dlCountEl = closest('.download-media-btn').querySelector('.download-count, .x-count');
                                        if (dlCountEl) dlCountEl.textContent = String((parseInt(dlCountEl.textContent, 10) || 0) + 1);
                                    }).catch(function(err) {
                                        console.warn('[download] downloadCount write failed:', err && err.message);
                                    });
                                }
                            }

                        } else if(closest('#post-format-toolbar button')) {
                            const textarea = document.getElementById('post-text');
                            if (!textarea) return; 

                            const format = closest('#post-format-toolbar button').dataset.format;
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const selectedText = textarea.value.substring(start, end);
                            let before = '', after = '';
                            if (format === 'bold')        { before = '*';  after = '*'; }
                            else if (format === 'italic') { before = '_';  after = '_'; }
                            else if (format === 'strike') { before = '~';  after = '~'; }
                            else if (format === 'code')   { before = '`';  after = '`'; }
                            else if (format === 'underline') { before = '__'; after = '__'; }
                            else if (format === 'highlight') { before = '=='; after = '=='; }

                            const newText = textarea.value.substring(0, start) + before + selectedText + after + textarea.value.substring(end);
                            textarea.value = newText;
                            // Restore cursor inside the markers
                            textarea.selectionStart = start + before.length;
                            textarea.selectionEnd = end + before.length;
                            textarea.focus();

                        } else if(closest('.delete-post-btn') && postElement) {
                            // Resolve which Firestore collection this post belongs to
                            const _isMarketplace = postElement.classList.contains('property-card');
                            const _isReel        = postElement.classList.contains('reel-card');
                            const _isNews        = postElement.classList.contains('news-list-item');
                            const _isCrisis      = postElement.classList.contains('crisis-report');
                            let _collection = 'posts';
                            if (_isMarketplace) _collection = 'marketplace_listings';
                            else if (_isReel)   _collection = 'reels';
                            else if (_isNews)   _collection = 'news_posts';
                            else if (_isCrisis) _collection = 'crisis_reports';
                            const label = _isMarketplace ? 'listing' : _isReel ? 'reel' : _isNews ? 'news post' : _isCrisis ? 'crisis report' : 'post';

                            // Ownership check -- owner OR admin can delete
                            const _postOwner = postElement.dataset.userId || postElement.dataset.sellerId || '';
                            if (!isAdmin && _postOwner && _postOwner !== userState.id) {
                                showNotification('You can only delete your own content.', 'warning'); return;
                            }

                            if (confirm(`Delete this ${label}? This cannot be undone.`)) {
                                // 1. Animate out everywhere it appears in the DOM
                                const _docId = postElement.dataset.postId || postElement.dataset.id;
                                postElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                                postElement.style.opacity = '0';
                                postElement.style.transform = 'scale(0.95)';
                                setTimeout(() => {
                                    // Remove from every feed/container it may appear in
                                    document.querySelectorAll(
                                        '[data-post-id="'+_docId+'"], [data-id="'+_docId+'"], [data-reel-id="'+_docId+'"]'
                                    ).forEach(function(el) { el.remove(); });
                                    if (typeof populateProfileGallery === 'function') populateProfileGallery(userState.id);
                                }, 310);
                                // 2. Delete from Firestore
                                if (window.fbDb && _docId) {
                                    try {
                                        await window.fbDb.collection(_collection).doc(_docId).delete();
                                        showNotification(`✅ ${label.charAt(0).toUpperCase()+label.slice(1)} deleted permanently.`, 'success');
                                    } catch(err) {
                                        console.error('[Delete] Firestore delete failed:', err.message);
                                        showNotification('Removed from view. Cloud sync may be delayed.', 'info');
                                    }
                                } else {
                                    showNotification(`${label.charAt(0).toUpperCase()+label.slice(1)} removed.`, 'info');
                                }
                            }
                        } else if (closest('.promote-post-btn, .promote-item-btn') && postElement) {
                            promptForPromotion(postElement.dataset.postId || postElement.dataset.id);
                        } else if (closest('.edit-post-btn') && postElement) {
                            // Ownership check
                            const _editOwner = postElement.dataset.userId || postElement.dataset.sellerId || '';
                            if (!isAdmin && _editOwner && _editOwner !== userState.id) {
                                showNotification('You can only edit your own content.', 'warning'); return;
                            }
                            const postId = postElement.dataset.postId || postElement.dataset.id;
                            // Determine collection
                            let _editCollection = 'posts';
                            if (postElement.classList.contains('property-card'))  _editCollection = 'marketplace_listings';
                            else if (postElement.classList.contains('reel-card')) _editCollection = 'reels';
                            else if (postElement.classList.contains('news-list-item')) _editCollection = 'news_posts';
                            else if (postElement.classList.contains('crisis-report'))  _editCollection = 'crisis_reports';
                            // Get current text
                            const _curText = postElement.querySelector('.story-content p, .property-info h4, .news-item-content p, .news-item-summary')?.textContent || '';
                            const editPostIdInput = document.getElementById('edit-post-id');
                            const editPostTextInput = document.getElementById('edit-post-text');
                            const editPostModalOverlay = document.getElementById('edit-post-modal-overlay');
                            let editCollectionInput = document.getElementById('edit-post-collection');
                            if (!editCollectionInput && editPostIdInput) {
                                // Inject hidden field if not already in modal
                                editCollectionInput = document.createElement('input');
                                editCollectionInput.type = 'hidden';
                                editCollectionInput.id = 'edit-post-collection';
                                editPostIdInput.parentNode.appendChild(editCollectionInput);
                            }
                            if (editPostIdInput) editPostIdInput.value = postId;
                            if (editPostTextInput) editPostTextInput.value = _curText;
                            if (editCollectionInput) editCollectionInput.value = _editCollection;
                            if (editPostModalOverlay) { editPostModalOverlay.classList.add('show'); document.body.classList.add('modal-open'); }
                        } else if (closest('.share-btn') && postElement) {
                            const postId = postElement.dataset.postId;
                            shareContent({
                                title: "Check out this post on Empyrean!",
                                text: postElement.querySelector('.story-content p, .news-item-content p')?.textContent?.substring(0, 100) + '...' || 'Humanitarian impact story',
                                url: `${window.location.href.split('#')[0]}#post/${postId}`
                            });
                        } else if (closest('.report-btn') && postElement) {
                            const reportBtn = closest('.report-btn');
                            const reportedUserId = postElement.dataset.authorId || postElement.dataset.userId;
                            const reportedUsername = postElement.querySelector('.story-user-info strong, .news-item-author strong')?.textContent || 'this user';
                            if (!reportedUserId || reportedUserId === userState.id) {
                                showNotification('You cannot report your own post.', 'warning'); return;
                            }
                            const confirmReport = confirm(`Report post by @${reportedUsername} for abuse?

This will be reviewed by admins. Accounts with multiple reports may be suspended.`);
                            if (!confirmReport) return;
                            // Track reports in localStorage
                            try {
                                const reports = JSON.parse(localStorage.getItem('empyrean_reports') || '{}');
                                const key = reportedUserId;
                                if (!reports[key]) reports[key] = { count: 0, reporters: [], username: reportedUsername };
                                if (!reports[key].reporters.includes(userState.id)) {
                                    reports[key].count++;
                                    reports[key].reporters.push(userState.id);
                                }
                                localStorage.setItem('empyrean_reports', JSON.stringify(reports));
                                // Auto-block if 3+ unique reports
                                if (reports[key].count >= 3) {
                                    // Add to admin SOS queue as abuse report
                                    const abuseReport = {
                                        id: 'abuse-' + Date.now(),
                                        userId: reportedUserId,
                                        username: reportedUsername,
                                        title: 'Reported for Abuse',
                                        story: `Account @${reportedUsername} has received ${reports[key].count} abuse reports and has been flagged for review.`,
                                        status: 'pending_approval',
                                        createdAt: new Date().toISOString(),
                                        isAbuseReport: true
                                    };
                                    mockAdminSosQueue.push(abuseReport);
                                    showNotification(`⚠️ @${reportedUsername} has been flagged for admin review due to multiple reports.`, 'warning');
                                } else {
                                    showNotification(`✅ Report submitted. Our team will review this content.`, 'success');
                                }
                                // Save to Firestore
                                try { fbDb.collection('abuse_reports').add({ reportedUserId, reportedUsername, reporterId: userState.id, postId: postElement.dataset.postId, createdAt: new Date().toISOString() }); } catch(e) {}
                            } catch(e) { showNotification('Report submitted.', 'success'); }
                            reportBtn.style.opacity = '0.4';
                            reportBtn.style.pointerEvents = 'none';
                        } else if(closest('.like-btn') && postElement) {
                            const likeBtn = closest('.like-btn');
                            const postId = postElement.dataset.postId;
                            const likeIcon = likeBtn.querySelector('.fa-heart');
                            const likeCountEl = likeBtn.querySelector('.like-count');
                            let likeCount = parseInt(likeCountEl ? likeCountEl.textContent.replace(/,/g, '') : '0');
                            
                            rewardUserForAction('ENGAGE_LIKE');

                            if (userState.likedPostIds.has(postId)) {
                                userState.likedPostIds.delete(postId);
                                if (likeIcon) { likeIcon.classList.remove('liked', 'fas'); likeIcon.classList.add('far'); }
                                likeCount = Math.max(0, likeCount - 1);
                            } else {
                                userState.likedPostIds.add(postId);
                                // ── LIKE BUBBLE ANIMATION ──
                                try {
                                    var _lb = document.createElement('span');
                                    _lb.innerHTML = '<i class="fas fa-heart" style="color:#EF4444;"></i>';
                                    var _br = likeBtn.getBoundingClientRect();
                                    _lb.style.cssText = 'position:fixed;left:' + (_br.left + 4) + 'px;top:' + (_br.top - 5) + 'px;pointer-events:none;font-size:1.6rem;z-index:9999;animation:likeBubblePop 1.2s ease-out forwards;';
                                    document.body.appendChild(_lb);
                                    setTimeout(function(){ if(_lb.parentNode) _lb.remove(); }, 1400);
                                    // Notify the post owner in UI
                                    var _pid2 = postElement.dataset.userId;
                                    if (_pid2 && _pid2 === (userState && userState.id)) {
                                        var _ob = document.createElement('div');
                                        _ob.style.cssText = 'position:fixed;bottom:90px;right:16px;background:linear-gradient(135deg,#EF4444,#F87171);color:white;padding:10px 16px;border-radius:50px;font-size:0.82rem;font-weight:700;box-shadow:0 6px 20px rgba(239,68,68,0.35);z-index:9998;display:flex;align-items:center;gap:7px;';
                                        _ob.innerHTML = '<i class="fas fa-heart"></i> Someone liked your post!';
                                        document.body.appendChild(_ob);
                                        setTimeout(function(){ _ob.style.opacity='0'; _ob.style.transition='opacity 0.4s'; setTimeout(function(){ if(_ob.parentNode) _ob.remove(); }, 400); }, 3200);
                                    }
                                    // Firestore notification to post owner
                                    if (_pid2 && _pid2 !== (userState && userState.id) && window.fbDb) {
                                        try { window.fbDb.collection('user_notifications').add({ userId: _pid2, type: 'like', message: (userState.fullName||'Someone') + ' liked your post', fromUserId: userState.id, postId: postId, read: false, createdAt: new Date().toISOString() }).catch(function(){}); } catch(e) {}
                                    }
                                } catch(_be) {}
                                if (typeof window.pushNotification === 'function' && postElement.dataset.userId && postElement.dataset.userId !== userState.id) {
                                    window.pushNotification((userState.fullName||'Someone') + ' liked your post! ❤️', 'info');
                                }
                                if (typeof updateLiveInteractionCount === 'function') updateLiveInteractionCount('like');
                                if (likeIcon) { likeIcon.classList.add('liked', 'fas'); likeIcon.classList.remove('far'); }
                                likeCount++;
                                rewardUserForAction('RECEIVE_LIKE', postElement.dataset.userId);
                            }
                            const formatted = new Intl.NumberFormat().format(likeCount);
                            // Update ALL instances of this post across all feeds (profile + main feed)
                            document.querySelectorAll('[data-post-id="' + postId + '"]').forEach(function(pel) {
                                var lc = pel.querySelector('.like-count');
                                var li = pel.querySelector('.fa-heart');
                                if (lc) lc.textContent = formatted;
                                if (li) {
                                    if (userState.likedPostIds.has(postId)) {
                                        li.classList.add('liked','fas'); li.classList.remove('far');
                                    } else {
                                        li.classList.remove('liked','fas'); li.classList.add('far');
                                    }
                                }
                            });
                            // Persist like count to Firestore so profile page always shows real count.
                            // FIX (live like counts): switched from set({likes: likeCount}, merge)
                            // — which overwrites with a value computed from the local DOM text —
                            // to an atomic increment(). The old approach could undercount when two
                            // users liked the same post almost simultaneously (last write wins).
                            // Atomic increment is safe under concurrent writes and is the same
                            // pattern already used for shareCount, downloadCount, and retweetCount.
                            try {
                                if (window.fbDb && postId) {
                                    var _lkFv = (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) || null;
                                    var _lkDelta = userState.likedPostIds.has(postId) ? 1 : -1;
                                    window.fbDb.collection('posts').doc(postId).update({
                                        likes: (_lkFv && typeof _lkFv.increment === 'function') ? _lkFv.increment(_lkDelta) : likeCount
                                    }).catch(function(){});
                                }
                            } catch(e) {}
                        } else if (closest('.follow-btn')) {
                            const followBtn = closest('.follow-btn');
                            const userIdToFollow = followBtn.dataset.userId;
                            if (!userIdToFollow) return; 

                            // Check if this follow btn is inside any business page section
                            const isPageFollow = !!(closest('.business-page-header') || closest('#business-page'));
                            if (isPageFollow && userState.businessPage && (userState.businessPage.id === userIdToFollow || userIdToFollow.startsWith('biz-'))) {
                                if (userState.followedUserIds.has(userIdToFollow)) {
                                    userState.followedUserIds.delete(userIdToFollow);
                                    userState.businessPage.followerCount--;
                                    followBtn.innerHTML = '<i class="fas fa-plus"></i> Follow';
                                    followBtn.classList.remove('followed');
                                    showNotification('Unfollowed ' + userState.businessPage.name, 'info');
                                } else {
                                    userState.followedUserIds.add(userIdToFollow);
                                    userState.businessPage.followerCount++;
                                    followBtn.innerHTML = '<i class="fas fa-check"></i> Following';
                                    followBtn.classList.add('followed');
                                    showNotification('Now following ' + userState.businessPage.name + '!', 'success');
                                }
                                const businessPageFollowerCount = document.getElementById('business-page-follower-count');
                                if (businessPageFollowerCount) businessPageFollowerCount.textContent = userState.businessPage.followerCount.toLocaleString();
                            } else {
                                const userToFollow = mockUsers[userIdToFollow];
                                if (!userToFollow) return;
        
                                if (userState.followedUserIds.has(userIdToFollow)) {
                                    userState.followedUserIds.delete(userIdToFollow);
                                    userToFollow.followerCount = Math.max(0, (userToFollow.followerCount || 0) - 1);
                                    followBtn.textContent = 'Follow';
                                    followBtn.classList.remove('followed');
                                    showNotification('Unfollowed @' + userToFollow.username, 'info');
                                } else {
                                    userState.followedUserIds.add(userIdToFollow);
                                    userToFollow.followerCount = (userToFollow.followerCount || 0) + 1;
                                    followBtn.innerHTML = '<i class="fas fa-check"></i> Following';
                                    followBtn.classList.add('followed');
                                    checkAndAwardRank(userToFollow);
                                    showNotification('Now following @' + userToFollow.username + '!', 'success');
                                    if(typeof window.pushNotification==='function')window.pushNotification(userState.fullName+' started following you!','new_follower');
                                }
                                try{fbDb.collection('users').doc(userState.id).update({followedUserIds:Array.from(userState.followedUserIds)});}catch(e){}
                            }
                            renderDynamicUI();
                            renderSuggestedUsers();
                            if(typeof renderContactList==='function')setTimeout(function(){renderContactList();},100);
                        } else if (closest('.comment-btn') && postElement) {
                            const commentSection = postElement.querySelector('.comment-section');
                            if (commentSection) { 
                                const isVisible = window.getComputedStyle(commentSection).display === 'block';
                                commentSection.style.display = isVisible ? 'none' : 'block';
                                if (!isVisible) {
                                    // Focus the input when opening
                                    const inp = commentSection.querySelector('input[name="comment-text"]');
                                    if (inp) setTimeout(() => inp.focus(), 50);
                                }
                            }
                        } else if (closest('.add-to-cart-btn')) {
                            e.stopPropagation();
                            const card = closest('.property-card');
                            if (!card) return; 
                            const item = { id: card.dataset.id, name: card.dataset.name, price: card.dataset.price, currency: card.dataset.displayCurrency || card.dataset.currency || (document.getElementById('item-currency') ? document.getElementById('item-currency').value : 'NGN'), img: card.querySelector('img, video')?.src || '' }; 
                            if (cart.find(cartItem => cartItem.id === item.id)) {
                                showNotification("This item is already in your cart.", 'warning');
                            } else {
                                cart.push(item);
                                updateCartUI();
                                showNotification(`${item.name} added to cart!`);
                            }
                        } else if (closest('.cart-icon-button')) {
                            document.getElementById('cart-modal-overlay').classList.add('show');
                            document.body.classList.add('modal-open');
                            // Always reset to cart view when opening
                            const cartView2 = document.getElementById('cart-view');
                            const checkoutView2 = document.getElementById('checkout-view');
                            if(cartView2) cartView2.style.display = 'block';
                            if(checkoutView2) checkoutView2.style.display = 'none';
                            updateCartUI();
                        } else if (closest('.checkout-btn')) {
                            document.getElementById('cart-view').style.display = 'none';
                            document.getElementById('checkout-view').style.display = 'block';
                            // Ensure required attributes are set for the active payment method
                            const checkoutForm = document.getElementById('checkout-form');
                            const activePaymentTab = checkoutForm.querySelector('.payment-tab.active');
                            if (activePaymentTab) {
                                const targetContentId = activePaymentTab.dataset.target;
                                const targetContent = document.getElementById(targetContentId);
                                if (targetContent) {
                                    targetContent.querySelectorAll('input[data-original-required="true"]').forEach(input => input.required = true);
                                    // Make inputs in other methods NOT required
                                    document.querySelectorAll('#checkout-form .payment-method-content:not(.active) input').forEach(input => input.required = false);
                                }
                            }
                        }
                    }
                });

                document.body.addEventListener('change', async function(e){
                    const target = e.target;
                    const closest = (selector) => target.closest(selector);
                    const files = target.files ? Array.from(target.files) : [];

                    if (target.id === 'signup-avatar') {
                        if (files.length > 0) handleAvatarUpload(files[0], 'avatar-preview', true);
                    } else if (target.id === 'profile-pic-input-main') {
                        if (files.length > 0) handleAvatarUpload(files[0], 'profile-pic-img', true);
                    } else if (target.id === 'cover-photo-input') {
                        if (files.length > 0) {
                            newCoverFile = files[0];
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const profileCoverContainer = document.getElementById('profile-cover-container');
                                if (profileCoverContainer) profileCoverContainer.style.backgroundImage = `url('${event.target.result}')`;
                            };
                            reader.readAsDataURL(newCoverFile);
                            // Pre-upload to Cloudinary in background
                            window.uploadToCloudinary(newCoverFile, null)
                                .then(url => { newCoverFile._cloudUrl = url; newCoverFile._previewUrl = url; })
                                .catch(()=>{});
                        }
                    } else if (target.id === 'business-cover-photo-input' && files.length > 0) {
                        const newFile = files[0];
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            const localUrl = event.target.result;
                            const businessPageCoverPhoto = document.getElementById('business-page-cover-photo');
                            // Apply local preview IMMEDIATELY
                            if (businessPageCoverPhoto) {
                                businessPageCoverPhoto.style.backgroundImage = `url('${localUrl}')`;
                                businessPageCoverPhoto.style.backgroundSize = 'cover';
                                businessPageCoverPhoto.style.backgroundPosition = 'center';
                            }
                            if (userState.businessPage) userState.businessPage.coverPhoto = localUrl;
                            showNotification('Cover photo updating...', 'info');
                            // Upload to cloud (always resolves now)
                            try {
                                const cloudUrl = await window.uploadToCloudinary(newFile, null);
                                if (businessPageCoverPhoto && cloudUrl !== localUrl) {
                                    businessPageCoverPhoto.style.backgroundImage = `url('${cloudUrl}')`;
                                }
                                if (userState.businessPage) userState.businessPage.coverPhoto = cloudUrl;
                                try { await window.fbDb.collection('business_pages').doc(userState.businessPage.id).update({ coverPhoto: cloudUrl }); } catch(e) {}
                                showNotification('✅ Cover photo saved!', 'success');
                            } catch(e) {
                                showNotification('Cover photo saved locally.', 'info');
                            }
                        };
                        reader.readAsDataURL(newFile);
                    } else if (target.id === 'business-profile-photo-input' && files.length > 0) {
                        const newFile = files[0];
                        resizeAndCropImage(newFile, 150, 150, async (dataUrl) => {
                            const businessPageProfilePic = document.getElementById('business-page-profile-pic');
                            if (businessPageProfilePic) businessPageProfilePic.src = dataUrl;
                            // Upload to Cloudinary
                            try {
                                const res = await fetch(dataUrl);
                                const blob = await res.blob();
                                const f = new File([blob], 'biz-profile.jpg', { type: 'image/jpeg' });
                                const cloudUrl = await window.uploadToCloudinary(f, null);
                                if (businessPageProfilePic) businessPageProfilePic.src = cloudUrl;
                                if (userState.businessPage) {
                                    userState.businessPage.profilePhoto = cloudUrl;
                                    await fbDb.collection('business_pages').doc(userState.businessPage.id).update({ profilePhoto: cloudUrl });
                                }
                                showNotification('Profile photo updated and saved!', 'success');
                            } catch(e) {
                                if (userState.businessPage) userState.businessPage.profilePhoto = dataUrl;
                                showNotification('Profile photo updated locally.', 'info');
                            }
                        });
                    } else if (target.matches('[name="user-type"]')) {
                        const orgFields = document.getElementById('org-fields');
                        const individualFields = document.getElementById('individual-fields');
                        if (!orgFields || !individualFields) return;

                        const isOrg = target.value === 'organisation';
                        if(isOrg) {
                            orgFields.style.display = 'block';
                            individualFields.style.display = 'none';
                        } else {
                            orgFields.style.display = 'none';
                            individualFields.style.display = 'block';
                        }
                        
                        orgFields.querySelectorAll('input').forEach(input => input.required = isOrg);
                        individualFields.querySelectorAll('input').forEach(input => input.required = !isOrg);

                    } else if (target.id === 'post-media-input') {
                        postMediaFiles = files;
                        // Build premium grid preview above the textarea
                        const previewEl = document.getElementById('post-media-preview');
                        if (previewEl) {
                            previewEl.innerHTML = '';
                            var _count = postMediaFiles.length;
                            if (_count === 0) { previewEl.style.display = 'none'; }
                            else {
                                previewEl.style.cssText = 'display:grid;gap:3px;border-radius:12px;overflow:hidden;margin-bottom:8px;max-height:320px;';
                                previewEl.style.gridTemplateColumns = _count===1?'1fr':_count===2?'1fr 1fr':_count===3?'2fr 1fr':'1fr 1fr';
                                postMediaFiles.forEach(function(file, idx) {
                                    if (idx >= 4) return;
                                    var url = URL.createObjectURL(file);
                                    var cell = document.createElement('div');
                                    cell.style.cssText = 'overflow:hidden;height:'+(_count===1?'260':'160')+'px;background:#000;position:relative;'+(_count===3&&idx===0?'grid-row:1/3;':'');
                                    if (file.type.startsWith('video/')) {
                                        var _pv = document.createElement('video');
                                        _pv.src = url;
                                        _pv.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                                        _pv.setAttribute('muted', '');
                                        _pv.setAttribute('playsinline', '');
                                        _pv.setAttribute('controls', '');
                                        _pv.setAttribute('webkit-playsinline', '');
                                        _pv.muted = true;
                                        _pv.controls = true;
                                        _pv.playsInline = true;
                                        cell.appendChild(_pv);
                                        _pv.load();
                                        _pv.play().catch(function(){});
                                    } else {
                                        cell.innerHTML = '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;" loading="lazy">';
                                    }
                                    var rb = document.createElement('button');
                                    rb.type='button';
                                    rb.style.cssText='position:absolute;top:5px;right:5px;background:rgba(239,68,68,0.9);border:none;color:white;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:0.85rem;z-index:3;line-height:1;';
                                    rb.innerHTML='&times;';
                                    (function(i){ rb.onclick = function() { cell.remove(); postMediaFiles.splice(i,1); }; })(idx);
                                    cell.appendChild(rb);
                                    previewEl.appendChild(cell);
                                });
                                if (_count > 4) {
                                    var badge = document.createElement('div');
                                    badge.style.cssText = 'display:flex;align-items:center;justify-content:center;background:rgba(10,14,39,0.7);color:white;font-size:1.4rem;font-weight:800;height:160px;';
                                    badge.textContent = '+'+(_count-4);
                                    previewEl.appendChild(badge);
                                }
                            }
                        }
                    } else if (target.id === 'business-post-media-input') {
                        businessPostMediaFiles = files;
                        handleMediaPreview(businessPostMediaFiles, 'business-post-media-preview');
                    } else if (target.id === 'sos-media-input') {
                        sosMediaFiles = files;
                        window.sosMediaFiles = sosMediaFiles; // sync to window for fix blocks
                        handleMediaPreview(sosMediaFiles, 'sos-media-preview');
                    } else if (target.id === 'crisis-media-input') {
                        crisisMediaFiles = files;
                        window.crisisMediaFiles = crisisMediaFiles; // sync to window for fix blocks
                        handleMediaPreview(crisisMediaFiles, 'crisis-media-preview');
                    } else if (target.id === 'item-media') {
                        if (files.length > 0) {
                            // Convert FileList to Array before concat to avoid type mismatch
                            var newFiles = Array.from(files);
                            marketplaceMediaFiles = marketplaceMediaFiles.concat(newFiles).slice(0, 15);
                            // Reset the file input so it doesn't carry old state
                            target.value = '';
                            handleMarketplacePreview(marketplaceMediaFiles, document.getElementById('marketplace-media-preview'));
                            const marketplaceTextFields = document.getElementById('marketplace-text-fields');
                            if (marketplaceTextFields) {
                                marketplaceTextFields.style.display = marketplaceMediaFiles.length > 0 ? 'block' : 'none';
                            }
                        }
                    } else if (target.id === 'withdrawal-method') {
                        handleWithdrawalMethodChange();
                        updateWithdrawalPreview();
                    } else if (target.id === 'transfer-network') { 
                        updateTransferPreview();
                    } else if (target.id === 'cross-chain-network') {
                        const selectedOption = target.options[target.selectedIndex];
                        const crossChainAddressInput = document.getElementById('cross-chain-address');
                        if (crossChainAddressInput && selectedOption.dataset.placeholder) {
                            crossChainAddressInput.placeholder = selectedOption.dataset.placeholder;
                        }
                        updateCrossChainTransferPreview();
                    } else if (target.id === 'sales-type') {
                        const directFields = document.getElementById('direct-sales-fields');
                        const isDirect = target.value === 'direct';
                        if (directFields) {
                            directFields.style.display = isDirect ? 'block' : 'none';
                            directFields.querySelectorAll('input').forEach(input => input.required = isDirect);
                        }
                    } else if (target.id === 'message-file-input' && files.length > 0) {
                        const messagesContainer = document.getElementById('chat-messages-container');
                        if (!messagesContainer) return;
                        const file = files[0];
                        // Show immediately with blob URL, then upgrade to Cloudinary URL
                        const localUrl = URL.createObjectURL(file);
                        const messageEl = createMessageElement(file.name, true, true, localUrl, file.type);
                        messagesContainer.appendChild(messageEl);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        target.value = '';
                        // Upload to Cloudinary in background and update src
                        (async () => {
                            try {
                                const cloudUrl = await window.uploadToCloudinary(file, null);
                                // Update any img/video/audio in the message element
                                const mediaEl = messageEl.querySelector('img, video, audio, a');
                                if (mediaEl) {
                                    if (mediaEl.tagName === 'A') mediaEl.href = cloudUrl;
                                    else mediaEl.src = cloudUrl;
                                }
                                // Save to Firestore messages collection
                                const chatPartnerId = document.getElementById('chat-header-info')?.dataset?.userId;
                                if (chatPartnerId) {
                                    const msgId = `msg-${Date.now()}`;
                                    try {
                                        await fbDb.collection('messages').doc(msgId).set({
                                            id: msgId, senderId: userState.id,
                                            receiverId: chatPartnerId,
                                            mediaUrl: cloudUrl, mediaType: file.type,
                                            fileName: file.name,
                                            createdAt: new Date().toISOString()
                                        });
                                    } catch(e) {}
                                }
                            } catch(e) { console.warn('Message file upload failed:', e); }
                        })();
                    } else if (target.id === 'news-media-file' && files.length > 0) {
                        newsMediaFile = files[0];
                        const previewContainer = document.getElementById('news-media-preview');
                        if (!previewContainer) return;

                        previewContainer.innerHTML = '';
                        const url = URL.createObjectURL(newsMediaFile);
                        let mediaEl;
                        if(newsMediaFile.type.startsWith('image/')) {
                            mediaEl = document.createElement('img');
                        } else {
                            mediaEl = document.createElement('video');
                            mediaEl.controls = true;
                            mediaEl.muted = true;
                            mediaEl.loop = true;
                            mediaEl.autoplay = true;
                        }
                        mediaEl.src = url;
                        previewContainer.appendChild(mediaEl);
                    } else if (target.id === 'page-cover-photo-input' && files.length > 0) {
                        newPageCoverFile = files[0];
                        const pageCoverPhotoPreview = document.getElementById('page-cover-photo-preview');
                        if (pageCoverPhotoPreview) {
                            pageCoverPhotoPreview.style.backgroundImage = `url(${URL.createObjectURL(newPageCoverFile)})`;
                            pageCoverPhotoPreview.innerHTML = ''; 
                        }
                    } else if (target.id === 'page-profile-photo-input' && files.length > 0) {
                        newPageProfileFile = files[0];
                        const pageProfilePhotoPreview = document.getElementById('page-profile-photo-preview');
                        if (pageProfilePhotoPreview) {
                            pageProfilePhotoPreview.style.backgroundImage = `url(${URL.createObjectURL(newPageProfileFile)})`;
                        }
                    } else if (target.id === 'live-custom-bg-upload-input') { 
                        if (files.length > 0) {
                            const bgFile = files[0];
                            liveStreamData.customBackgroundFile = bgFile;
                            // Show local preview immediately
                            const localBgUrl = URL.createObjectURL(bgFile);
                            liveStreamData.background = localBgUrl;
                            showNotification('Custom background uploading to cloud...', 'info');
                            populateBackgroundSelector();
                            // Upload to Cloudinary
                            (async () => {
                                try {
                                    const cloudBgUrl = await window.uploadToCloudinary(bgFile, null);
                                    liveStreamData.background = cloudBgUrl;
                                    liveStreamData.customBackgroundFile = null; // no longer needed as file
                                    liveStreamData._customBgCloudUrl = cloudBgUrl;
                                    populateBackgroundSelector();
                                    showNotification('✅ Background saved to cloud!', 'success');
                                } catch(e) {
                                    console.warn('Background upload failed:', e);
                                    showNotification('Background uploaded locally.', 'warning');
                                }
                            })();
                        }
                    } else if (target.id === 'fan-club-toggle') { 
                        liveStreamData.fanClubActive = target.checked;
                        showNotification(`Fan Club is now ${liveStreamData.fanClubActive ? 'activated' : 'deactivated'}.`, "info");
                        updateLiveUI();
                    } else if (closest('.kyc-file-upload') && target.type === 'file') { 
                        const uploadArea = closest('.kyc-file-upload');
                        const inputId = uploadArea.dataset.inputId;
                        const fileInput = document.getElementById(inputId);
                        const previewElementId = `${inputId}-preview`;
                        const previewElement = document.getElementById(previewElementId);

                        if (previewElement && files.length > 0) {
                            previewElement.innerHTML = `<span>File selected: ${files[0].name}</span>`;
                        } else if (previewElement) {
                            previewElement.innerHTML = '';
                        }
                        uploadArea.style.borderColor = ''; // Clear border on file selection
                    }
                });

                document.body.addEventListener('submit', async function(e) {
                    const form = e.target;
                    // Reel comment form handler
                    if (form.classList.contains('reel-comment-form')) {
                        e.preventDefault();
                        const input = form.querySelector('input');
                        const text = input ? input.value.trim() : '';
                        if (!text) return;
                        const viewerItem = form.closest('.reel-viewer-item');
                        const commentsList = viewerItem ? viewerItem.querySelector('.reel-comments-list') : null;
                        if (commentsList) {
                            const placeholder = commentsList.querySelector('p');
                            if (placeholder) placeholder.remove();
                            const commentEl = document.createElement('div');
                            commentEl.style.cssText = 'display:flex;gap:8px;align-items:flex-start;';
                            commentEl.innerHTML = `<img src="${userState.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;"><div><strong style="color:white;font-size:0.8rem;">${userState.fullName || 'You'}</strong><p style="color:rgba(255,255,255,0.8);font-size:0.82rem;margin-top:2px;">${text}</p></div>`;
                            commentsList.appendChild(commentEl);
                            commentsList.scrollTop = commentsList.scrollHeight;
                            const countEl = viewerItem.querySelector('.reel-comment-count');
                            if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;
                        }
                        if (input) input.value = '';
                        rewardUserForAction('ENGAGE_COMMENT');
                        return;
                    }
                     if (form.classList.contains('comment-form')) {
                        e.preventDefault();
                        const input = form.querySelector('input[name="comment-text"]');
                        const text = input ? input.value.trim() : '';
                        const postElement = form.closest('.impact-story, .news-list-item');
                        const isReply = form.dataset.replyTo;  // sub-comment
                        if (text && postElement) {
                            rewardUserForAction('ENGAGE_COMMENT');
                            if (!isReply) rewardUserForAction('RECEIVE_COMMENT', postElement.dataset.userId);
                            const ts = new Date().toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
                            const avatarUrl = userState.avatar || ('https://ui-avatars.com/api/?name='+encodeURIComponent(userState.fullName||'U')+'&background=1B2B8B&color=fff&size=36');
                            const commentId = 'cmt-' + Date.now();

                            function buildCommentEl(cText, cTs, cAvatar, cName, cId, depth) {
                                const el = document.createElement('div');
                                el.className = 'comment';
                                el.dataset.commentId = cId;
                                el.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;align-items:flex-start;' + (depth > 0 ? 'margin-left:32px;' : '');
                                el.innerHTML =
                                    '<img src="'+cAvatar+'" style="width:'+(depth>0?'26':'32')+'px;height:'+(depth>0?'26':'32')+'px;border-radius:50%;object-fit:cover;flex-shrink:0;">' +
                                    '<div style="flex:1;">' +
                                        '<div style="background:rgba(10,14,39,0.04);border-radius:12px;padding:8px 12px;">' +
                                            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
                                                '<strong style="font-size:0.82rem;color:var(--primary);">'+cName+'</strong>' +
                                                '<span style="font-size:0.7rem;color:var(--text-muted);">'+cTs+'</span>' +
                                            '</div>' +
                                            '<p style="font-size:0.85rem;margin:0;line-height:1.4;">'+formatWhatsAppText(cText)+'</p>' +
                                        '</div>' +
                                        (depth < 2 ? '<button class="_reply_btn" data-parent-id="'+cId+'" style="background:none;border:none;color:var(--secondary);font-size:0.7rem;font-weight:700;cursor:pointer;padding:3px 6px;margin-top:2px;">↩ Reply</button>' : '') +
                                        '<div class="_reply_thread" style="margin-top:4px;"></div>' +
                                    '</div>';
                                // Wire reply button
                                const replyBtn = el.querySelector('._reply_btn');
                                if (replyBtn) {
                                    replyBtn.addEventListener('click', function() {
                                        const thread = el.querySelector('._reply_thread');
                                        let replyForm = thread.querySelector('._inline_reply_form');
                                        if (replyForm) { replyForm.remove(); return; }
                                        replyForm = document.createElement('form');
                                        replyForm.className = 'comment-form _inline_reply_form';
                                        replyForm.dataset.replyTo = cId;
                                        replyForm.style.cssText = 'display:flex;gap:6px;margin-top:6px;margin-left:8px;';
                                        replyForm.innerHTML =
                                            '<input type="text" name="comment-text" placeholder="Write a reply…" required style="flex:1;border:1px solid rgba(10,14,39,0.15);border-radius:50px;padding:6px 12px;font-size:0.8rem;outline:none;">' +
                                            '<button type="submit" style="background:var(--secondary);border:none;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;"><i class="fas fa-paper-plane" style="color:#0A0E27;font-size:0.65rem;"></i></button>';
                                        thread.appendChild(replyForm);
                                        replyForm.querySelector('input').focus();
                                    });
                                }
                                return el;
                            }

                            const newCommentEl = buildCommentEl(text, ts, avatarUrl, userState.fullName||'You', commentId, isReply ? 1 : 0);

                            if (isReply) {
                                // Sub-comment: append into the parent's _reply_thread
                                const parentComment = document.querySelector('[data-comment-id="'+isReply+'"]');
                                const thread = parentComment ? parentComment.querySelector('._reply_thread') : null;
                                if (thread) {
                                    thread.appendChild(newCommentEl);
                                    const replyForm = thread.querySelector('._inline_reply_form');
                                    if (replyForm) replyForm.remove();
                                }
                            } else {
                                const commentList = form.previousElementSibling;
                                if (commentList) { const empty = commentList.querySelector('p'); if (empty) empty.remove(); commentList.appendChild(newCommentEl); }
                                const countSpan = postElement.querySelector('.comment-count');
                                if (countSpan) countSpan.textContent = parseInt(countSpan.textContent||0) + 1;
                                if (typeof updateLiveInteractionCount === 'function') updateLiveInteractionCount('comment');
                                if (typeof window.pushNotification === 'function' && postElement.dataset.userId && postElement.dataset.userId !== userState.id) {
                                    window.pushNotification((userState.fullName||'Someone') + ' commented on your post.', 'info');
                                }
                            }

                            // Persist to Firestore
                            try {
                                fbDb.collection('comments').doc(commentId).set({
                                    id: commentId,
                                    postId: postElement.dataset.postId,
                                    parentId: isReply || null,
                                    userId: userState.id, username: userState.fullName, avatar: userState.avatar,
                                    text, depth: isReply ? 1 : 0, createdAt: new Date().toISOString()
                                });
                            } catch(e) {}
                            if (input) input.value = '';
                        }
                        return;
                    }

                    e.preventDefault();
                    
                    // KYC form submission -- relaxed validation (documents uploaded via custom UI)
                    if (form.id.includes('-kyc-form')) {
                        let kycFormIsValid = true;
                        // Only validate visible text/select inputs that are required
                        Array.from(form.querySelectorAll('input:not([type="file"]):not([type="hidden"]), select, textarea')).forEach(input => {
                            if (input.required && input.offsetParent !== null && input.value.trim() === '') {
                                input.style.borderColor = 'var(--danger-color)';
                                kycFormIsValid = false;
                            } else {
                                input.style.borderColor = '';
                            }
                        });
                        // Check upload areas -- they must have at least a file-name-display (uploaded via custom UI)
                        Array.from(form.querySelectorAll('.kyc-file-upload.upload-area')).forEach(area => {
                            const hasFile = area.classList.contains('has-file') || area.querySelector('.file-name-display');
                            const inputId = area.dataset.inputId;
                            const originalInput = inputId ? document.getElementById(inputId) : null;
                            const isRequired = area.dataset.required === 'true' || (originalInput && originalInput.required);
                            if (isRequired && !hasFile) {
                                area.style.borderColor = 'var(--danger-color)';
                                kycFormIsValid = false;
                            } else {
                                area.style.borderColor = '';
                            }
                        });
                        if (!kycFormIsValid) {
                            showNotification('Please fill all required fields and upload all required documents.', 'error');
                            return;
                        }
                        // All good -- submit KYC
                        const kycType = form.id.replace('-kyc-form', '');
                        const kycSubmitBtn = form.querySelector('button[type="submit"]');
                        if (kycSubmitBtn) kycSubmitBtn.disabled = true;
                        (async () => {
                            try {
                                const kycData = {
                                    id: `kyc-${Date.now()}`, userId: userState.id,
                                    username: userState.username, type: kycType,
                                    documents: window._kycSubmissions || {},
                                    submittedAt: new Date().toISOString(), status: 'pending'
                                };
                                try { await fbDb.collection('kyc_submissions').add(kycData); } catch(e) {}
                                showNotification(`✅ KYC (${kycType}) submitted successfully! Under review.`, 'success');
                                // Clear form
                                Array.from(form.querySelectorAll('input, select, textarea')).forEach(el => { el.style.borderColor = ''; });
                                form.querySelectorAll('.file-upload-preview').forEach(s => { s.innerHTML = ''; });
                                form.querySelectorAll('.kyc-file-upload.upload-area').forEach(a => {
                                    a.classList.remove('has-file');
                                    const nm = a.querySelector('.file-name-display');
                                    if (nm) nm.remove();
                                    a.style.borderColor = '';
                                });
                                const selfieBtn2 = form.querySelector('.live-capture-btn');
                                if (selfieBtn2) { selfieBtn2.dataset.captured = 'false'; selfieBtn2.style.background = ''; selfieBtn2.innerHTML = '<i class="fas fa-camera"></i> Capture Live Selfie'; }
                                window._kycSubmissions = {};
                                form.reset();
                            } catch(err) {
                                showNotification('KYC submission failed. Please try again.', 'error');
                            } finally {
                                if (kycSubmitBtn) kycSubmitBtn.disabled = false;
                            }
                        })();
                        return;
                    }

                    // login-form, signup-form, forgot-password-form handle their own validation in the switch
                    const selfValidatingForms = ['login-form','signup-form','forgot-password-form','promotion-finalize-form','checkout-form','reel-upload-form','help-form','crisis-form','go-live-form','complaint-form'];
                    if (!selfValidatingForms.includes(form.id) && !form.checkValidity()) {
                        e.stopPropagation();
                        showNotification('Please fill all required fields.', 'error');
                        
                        Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea, .live-capture-btn')).forEach(input => {
                            if (input.required && input.value.trim() === '') {
                                input.style.borderColor = 'var(--danger-color)';
                            } else {
                                input.style.borderColor = '';
                            }
                        });

                        return;
                    }
                    
                    switch (form.id) {
                        case 'login-form': {
                            // CAPTCHA REMOVED -- login works directly with email + password
                            const email = (document.getElementById('login-email').value || '').trim().toLowerCase();
                            const password = document.getElementById('login-password').value;
                            if (!email || !password) {
                                showNotification('Please enter your email and password.', 'error');
                                return;
                            }

                            // ── Admin shortcut ───────────────────────────────
                            if (email === 'admin@empyrean.com' && password === 'adminpass') {
                                initializeApp(false, true);
                                authModal.classList.remove('show');
                                document.body.classList.remove('modal-open');
                                showNotification('✅ Admin login successful!', 'success');
                                break;
                            }

                            showNotification('Signing in...', 'info');
                            const loginBtn = form.querySelector('button[type="submit"]');
                            if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Signing in...'; }

                            (async () => {
                                try {
                                    // ── Step 1: Check localStorage first (always works offline) ──
                                    let localUser = null;
                                    try {
                                        const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                                        const lsEntry = stored[email];
                                        if (lsEntry && lsEntry.password === password) {
                                            localUser = lsEntry;
                                            // Restore Set types
                                            ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(k => {
                                                localUser[k] = new Set(Array.isArray(localUser[k]) ? localUser[k] : []);
                                            });
                                        }
                                    } catch(lsErr) { /* ignore */ }

                                    // Also check in-memory registeredUsers
                                    if (!localUser) {
                                        localUser = Object.values(registeredUsers).find(u =>
                                            u && (u.email||'').toLowerCase() === email && u.password === password
                                        ) || null;
                                    }

                                    // ── Step 2: Try Firebase if loaded ──────────────────────────
                                    if (window._firebaseLoaded && window.fbAuth && typeof window.fbAuth.signInWithEmailAndPassword === 'function') {
                                        try {
                                            const cred = await window.fbAuth.signInWithEmailAndPassword(email, password);
                                            if (cred && cred.user) {
                                                const uid = cred.user.uid;
                                                let profile = null;
                                                // Load from Firestore
                                                try {
                                                    const doc = await window.fbDb.collection('users').doc(uid).get();
                                                    if (doc && doc.exists) {
                                                        profile = doc.data();
                                                        ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(k => {
                                                            profile[k] = new Set(Array.isArray(profile[k]) ? profile[k] : []);
                                                        });
                                                    }
                                                } catch(fsErr) { console.warn('[Login] Firestore read failed:', fsErr.message); }

                                                if (!profile) {
                                                    profile = localUser || {
                                                        id: uid, fullName: email.split('@')[0], email,
                                                        username: email.split('@')[0].replace(/[^a-z0-9]/gi,'').toLowerCase(),
                                                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&background=1B2B8B&color=fff&size=150`,
                                                        coverPhoto: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=80',
                                                        bio: '', empyBalance: 0, isVerified: false, followerCount: 0,
                                                        likedPostIds: new Set(), followedUserIds: new Set(),
                                                        retweetedPostIds: new Set(), awardedRanks: new Set(),
                                                        completedTasks: new Set(), viewedStatusUserIds: new Set(),
                                                        statuses: [], businessPage: null
                                                    };
                                                }
                                                profile.id = uid;
                                                registeredUsers[email] = profile;
                                                mockUsers[uid] = profile;
                                                // Save back to localStorage
                                                try {
                                                    const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                                                    const safe = Object.assign({}, profile);
                                                    ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(k => {
                                                        safe[k] = Array.from(profile[k] || []);
                                                    });
                                                    safe.statuses = []; // don't store blob URLs
                                                    stored[email] = safe;
                                                    localStorage.setItem('empyrean_users', JSON.stringify(stored));
                                                } catch(e) {}
                                                try{var _sl=Object.assign({},profile);['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(function(k){if(_sl[k] instanceof Set)_sl[k]=[..._sl[k]];});delete _sl.password;localStorage.setItem('empyrean_session',JSON.stringify(_sl));}catch(e){}
                                                initializeApp(false, false, profile);
                                                authModal.classList.remove('show'); authModal.style.display='none';
                                                document.body.classList.remove('modal-open'); document.body.style.overflow='';
                                                showNotification('✅ Welcome back, ' + (profile.fullName || email.split('@')[0]) + '!', 'success');
                                                // Start real-time listeners -- Firebase auth just confirmed this user
                                                // onAuthStateChanged will also fire but having both is safe (handles are checked)
                                                window._postsListener      = null;
                                                window._newsListener       = null;
                                                window._newsListenerActive = false; // allow app-news.js to restart
                                                window._mktListener        = null;
                                                window._reelsListener      = null;
                                                window._usersListener      = null;
                                                window._statusesListener   = null;
                                                window._ownStatusFetched   = false;
                                                setTimeout(function() {
                                                    if (typeof window._startRealtimeListeners === 'function') window._startRealtimeListeners();
                                                    if (typeof window.startLiveStreamListener   === 'function') window.startLiveStreamListener();
                                                    if (typeof window.loadUserNotifications     === 'function') window.loadUserNotifications();
                                                }, 600);
                                                return;
                                            }
                                        } catch(fbErr) {
                                            console.warn('[Login] Firebase auth error:', fbErr.code, fbErr.message);
                                            // Map Firebase errors to friendly messages
                                            const firebaseErrMap = {
                                                'auth/user-not-found': null, // fall through to local check
                                                'auth/wrong-password': null,
                                                'auth/invalid-credential': null,
                                                'auth/invalid-email': 'Invalid email address.',
                                                'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
                                                'auth/network-request-failed': null, // fall through to local
                                                'auth/user-disabled': 'This account has been disabled. Contact support.'
                                            };
                                            const mappedErr = firebaseErrMap[fbErr.code];
                                            if (mappedErr !== undefined && mappedErr !== null) {
                                                showNotification(mappedErr, 'error');
                                                return;
                                            }
                                            // For user-not-found, wrong-password, network errors -- fall through to local auth
                                        }
                                    }

                                    // ── Step 3: Local auth fallback ─────────────────────────────
                                    if (localUser) {
                                        registeredUsers[email] = localUser;
                                        mockUsers[localUser.id || ('local-' + Date.now())] = localUser;
                                        try { localStorage.setItem('empyrean_session_email', email); } catch(e) {}
                                        initializeApp(false, false, localUser);
                                        authModal.classList.remove('show');
                                        document.body.classList.remove('modal-open');
                                        showNotification('✅ Welcome back, ' + (localUser.fullName || email.split('@')[0]) + '!', 'success');
                                        return;
                                    }

                                    // ── Step 4: Nothing worked ──────────────────────────────────
                                    showNotification('No account found with that email and password. Please sign up first.', 'error');

                                } catch(unexpectedErr) {
                                    console.error('[Login] Unexpected error:', unexpectedErr);
                                    showNotification('Login failed. Please try again.', 'error');
                                } finally {
                                    if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Login'; }
                                }
                            })();
                            break;
                        }
                        case 'signup-form': { 
                            const passwordInput = document.getElementById('signup-password');
                            const confirmPasswordInput = document.getElementById('signup-confirm-password');
                            if (!passwordInput || !confirmPasswordInput) return; 

                            if (passwordInput.value !== confirmPasswordInput.value) {
                                showFormFeedback('signup', 'Passwords do not match.', 'error'); return;
                            }
                            
                            const emailInput = document.getElementById('signup-email');
                            if (!emailInput) return; 
                            const email = emailInput.value.trim().toLowerCase();
                            // Strict email validation
                            if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
                                showFormFeedback('signup', 'Please enter a valid email address (e.g. name@domain.com).', 'error'); return;
                            }
                            if (registeredUsers[email]) {
                                showFormFeedback('signup', 'An account with this email already exists. Please log in.', 'error'); return;
                            }
                            // Check Firebase for existing email
                            if (window._firebaseLoaded && window.fbAuth) {
                                try {
                                    const methods = await window.fbAuth.fetchSignInMethodsForEmail(email);
                                    if (methods && methods.length > 0) {
                                        showFormFeedback('signup', 'This email is already registered. Please log in instead.', 'error'); return;
                                    }
                                } catch(e) { /* offline -- skip check */ }
                            }
                            
                            const usernameInput = document.getElementById('signup-username');
                            if (!usernameInput) return; 
                            const username = usernameInput.value.trim();
                            // Strict username validation
                            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                                showFormFeedback('signup', 'Username: 3-20 characters, letters/numbers/underscore only.', 'error'); return;
                            }
                            // Phone validation if provided
                            const phoneInputEl = document.getElementById('signup-phone');
                            if (phoneInputEl && phoneInputEl.value.trim()) {
                                const phoneClean = phoneInputEl.value.replace(/[\s\-\(\)\+]/g,'');
                                if (!/^[0-9]{7,15}$/.test(phoneClean)) {
                                    showFormFeedback('signup', 'Please enter a valid phone number (7-15 digits).', 'error'); return;
                                }
                            }
                            // Case-insensitive username uniqueness check
                            if (Object.values(mockUsers).some(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
                                showFormFeedback('signup', 'This username is already taken. Please choose another.', 'error'); return;
                            }
                            // Password strength validation
                            const pwVal = passwordInput.value;
                            const pwStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\|,.<>\/?]).{8,}$/.test(pwVal);
                            if (!pwStrong) {
                                showFormFeedback('signup', 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character (e.g. !@#$%).', 'error'); return;
                            }

                            const userTypeRadio = document.querySelector('input[name="user-type"]:checked');
                            if (!userTypeRadio) return; 
                            const isOrg = userTypeRadio.value === 'organisation';
                            
                            let fullName = '';
                            if (isOrg) {
                                const orgNameInput = document.getElementById('signup-orgname');
                                if (orgNameInput) fullName = orgNameInput.value;
                            } else {
                                const fnameInput = document.getElementById('signup-fname');
                                const lnameInput = document.getElementById('signup-lname');
                                if (fnameInput && lnameInput) fullName = `${fnameInput.value} ${lnameInput.value}`;
                            }

                            showFormFeedback('signup', 'Creating your account...', 'info');

                            // Upload avatar to Cloudinary if a file was selected
                            let avatarUrl = isOrg 
                                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=5B0EA6&color=fff&size=150`
                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=8E24AA&color=fff&size=150`;

                            (async () => {
                                try {
                                    // Upload avatar to Cloudinary if file chosen
                                    if (newAvatarFile) {
                                        try {
                                            let fileToUpload = null;
                                            if (newAvatarFile instanceof File || newAvatarFile instanceof Blob) {
                                                fileToUpload = newAvatarFile;
                                            } else if (typeof newAvatarFile === 'string' && newAvatarFile.startsWith('data:')) {
                                                const res = await fetch(newAvatarFile);
                                                const blob = await res.blob();
                                                fileToUpload = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
                                            } else if (typeof newAvatarFile === 'string' && (newAvatarFile.startsWith('http') || newAvatarFile.startsWith('blob:'))) {
                                                avatarUrl = newAvatarFile;
                                            }
                                            if (fileToUpload) {
                                                avatarUrl = await window.uploadToCloudinary(fileToUpload, null);
                                            }
                                        } catch(uploadErr) { console.warn('Avatar upload failed:', uploadErr); }
                                    }

                                    // Generate unique serial ID
                                    const serialNum = String(Date.now()).slice(-6).padStart(6,'0');
                                    const uniqueUserId = `USR-${serialNum}`;
                                    const bioFromSignup = document.getElementById('signup-bio') ? document.getElementById('signup-bio').value.trim() : '';
                                    const newUser = {
                                        id: `user-${Date.now()}`,
                                        uniqueId: uniqueUserId,
                                        fullName, username: username.toLowerCase(), email,
                                        password: passwordInput.value,
                                        avatar: avatarUrl,
                                        createdAt: new Date().toISOString(),
                                        coverPhoto: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=80',
                                        bio: bioFromSignup || `Hi, I'm ${fullName}. Empyrean member since ${new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})}.`,
                                        likedPostIds: new Set(),
                                        followedUserIds: new Set(),
                                        retweetedPostIds: new Set(),
                                        statuses: [],
                                        viewedStatusUserIds: new Set(),
                                        empyBalance: 0,          // starts at zero -- earned through activity
                                        isVerified: false,
                                        followerCount: 0,
                                        awardedRanks: new Set(),
                                        businessPage: null,
                                        completedTasks: new Set(),
                                        empyBalance: 0,
                                        earningsStarted: false
                                    };
                                    registeredUsers[email] = newUser;
                                    mockUsers[newUser.id] = newUser;

                                    // Save to localStorage IMMEDIATELY -- works offline
                                    try {
                                        const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                                        stored[email] = Object.assign({}, newUser, {
                                            likedPostIds:[], followedUserIds:[], retweetedPostIds:[],
                                            awardedRanks:[], completedTasks:[], viewedStatusUserIds:[], statuses:[]
                                        });
                                        localStorage.setItem('empyrean_users', JSON.stringify(stored));
                                    } catch(lsErr) { console.warn('localStorage save failed:', lsErr); }

                                    // PRIMARY: Firebase Auth + Firestore (AWAITED -- production path)
                                    // Show spinner while creating account
                                    showFormFeedback('signup', 'Creating your account...', 'info');
                                    const doFirebaseSignup = async () => {
                                        if (!window._firebaseLoaded || !window.fbAuth) {
                                            // Firebase not ready -- wait up to 10s
                                            await new Promise(resolve => {
                                                let tries = 0;
                                                const t = setInterval(() => {
                                                    tries++;
                                                    if (window._firebaseLoaded || tries > 20) { clearInterval(t); resolve(); }
                                                }, 500);
                                            });
                                        }
                                        if (!window._firebaseLoaded || !window.fbAuth) {
                                            console.warn('[Signup] Firebase still not ready -- account saved locally only');
                                            return;
                                        }
                                        try {
                                            const fbCred = await window.fbAuth.createUserWithEmailAndPassword(email, passwordInput.value);
                                            if (fbCred && fbCred.user) {
                                                // Update user ID to real Firebase UID
                                                newUser.id = fbCred.user.uid;
                                                registeredUsers[email].id = fbCred.user.uid;
                                                mockUsers[fbCred.user.uid] = newUser;
                                                // Save full profile to Firestore
                                                await saveUserToFirestore(fbCred.user.uid, newUser);
                                                console.log('[Signup] ✅ User created in Firebase Auth + Firestore. UID:', fbCred.user.uid);
                                            showFormFeedback('signup', 'Account created! Logging you in...', 'success');
                                            setTimeout(() => {
                                                ['login-view','signup-view','forgot-password-view'].forEach(v => {
                                                    const el = document.getElementById(v);
                                                    if (el) el.style.display = 'none';
                                                });
                                                const lv = document.getElementById('login-view');
                                                if (lv) lv.style.display = 'block';
                                            }, 1200);
                                                // Update localStorage with real UID
                                                try {
                                                    const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                                                    if (stored[email]) {
                                                        stored[email].id = fbCred.user.uid;
                                                        localStorage.setItem('empyrean_users', JSON.stringify(stored));
                                                    }
                                                } catch(e) {}
                                            }
                                        } catch(fbErr) {
                                            if (fbErr.code === 'auth/email-already-in-use') {
                                                showNotification('That email already has an account. Please log in.', 'warning');
                                            } else {
                                                console.error('[Signup] Firebase error:', fbErr.code, fbErr.message);
                                            }
                                        }
                                    };
                                    // Run signup -- show success only after Firebase confirms
                                    doFirebaseSignup().then(function() {
                                        newAvatarFile = null;
                                        form.reset();
                                        if (typeof handleAvatarUpload === 'function') handleAvatarUpload(null, 'avatar-preview');
                                        rewardUserForAction('SUCCESSFUL_REFERRAL');
                                    });
                                } catch(err) {
                                    console.error('Signup error:', err);
                                    showFormFeedback('signup', 'Signup failed. Please try again.', 'error');
                                }
                            })();
                            break;
                        }
                        case 'profile-info-form': {
                            if(isGuest) return;
                            const profileFullnameInput = document.getElementById('profile-fullname');
                            const profileUsernameInput = document.getElementById('profile-username');
                            const profileBioTextarea = document.getElementById('profile-bio');

                            if (profileFullnameInput) userState.fullName = profileFullnameInput.value;
                            if (profileUsernameInput) userState.username = profileUsernameInput.value;
                            if (profileBioTextarea) userState.bio = profileBioTextarea.value;
                            // Extended bio fields
                            const _pPhone    = document.getElementById('profile-phone');
                            const _pWebsite  = document.getElementById('profile-website');
                            const _pProf     = document.getElementById('profile-profession');
                            const _pEdu      = document.getElementById('profile-education');
                            const _pMarital  = document.getElementById('profile-marital');
                            const _pHobby    = document.getElementById('profile-hobbies');
                            const _pLoc      = document.getElementById('profile-location');
                            if (_pPhone)   userState.phone         = _pPhone.value;
                            if (_pWebsite) userState.website       = _pWebsite.value;
                            if (_pProf)    userState.profession    = _pProf.value;
                            if (_pEdu)     userState.education     = _pEdu.value;
                            if (_pMarital) userState.maritalStatus = _pMarital.value;
                            if (_pHobby)   userState.hobbies       = _pHobby.value;
                            if (_pLoc)     userState.location      = _pLoc.value;
                            
                            showNotification('Saving profile...', 'info');
                            (async () => {
                                try {
                                    // Upload avatar to Cloudinary if changed
                                    if (newAvatarFile) {
                                        if (newAvatarFile.startsWith('data:')) {
                                            try {
                                                const res = await fetch(newAvatarFile);
                                                const blob = await res.blob();
                                                const f = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
                                                const cloudUrl = await window.uploadToCloudinary(f, null);
                                                userState.avatar = cloudUrl;
                                            } catch(e) { userState.avatar = newAvatarFile; }
                                        } else {
                                            userState.avatar = newAvatarFile;
                                        }
                                        newAvatarFile = null;
                                    }
                                    // Upload cover photo to Cloudinary if changed
                                    if (newCoverFile) {
                                        try {
                                            const cloudCoverUrl = await window.uploadToCloudinary(newCoverFile, null);
                                            userState.coverPhoto = cloudCoverUrl;
                                        } catch(e) {
                                            userState.coverPhoto = URL.createObjectURL(newCoverFile);
                                        }
                                        newCoverFile = null;
                                    }
                                    // Save to Firestore
                                    if (userState.id && !userState.id.startsWith('user-demo')) {
                                        await saveUserToFirestore(userState.id, userState);
                                    }
                                    // Also persist to localStorage as fallback
                                    try {
                                        const stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                                        const safe = { ...userState };
                                        ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(k => { if (safe[k] instanceof Set) safe[k] = [...safe[k]]; });
                                        delete safe.password;
                                        stored[userState.email] = safe;
                                        localStorage.setItem('empyrean_users', JSON.stringify(stored));
                                    } catch(lsErr) {}
                                    renderUserProfile(userState.id);
                                    showNotification('Profile updated and saved successfully!', 'success');
                                    navigateTo('profile');
                                } catch(err) {
                                    console.error('Profile save error:', err);
                                    renderUserProfile(userState.id);
                                    showNotification('Profile updated locally (cloud sync failed).', 'warning');
                                    navigateTo('profile');
                                }
                            })();
                            break;
                        }
                        case 'create-post-form': {
                            const postTextarea = document.getElementById('post-text');
                            if (!postTextarea) return;
                            const text = postTextarea.value;
                            // ── Read quote data attached by the picker ──
                            const quotePostId   = postTextarea.dataset.quotePostId   || '';
                            const quoteAuthor   = postTextarea.dataset.quoteAuthor   || '';
                            const quoteText     = postTextarea.dataset.quoteText     || '';
                            const quoteMedia    = postTextarea.dataset.quoteMedia    || '';
                            const isQuotePost   = !!quotePostId;

                            if (!text.trim() && postMediaFiles.length === 0 && !isQuotePost) {
                                showNotification('Post cannot be empty.', 'error'); return;
                            }
                            const _bannedTerms = /\b(porn|pornography|xxx|nude|nudity|obscene|explicit sexual|child abuse|cp|csam)\b/i;
                            if (_bannedTerms.test(text)) {
                                showNotification('🚫 Post blocked: violates community guidelines on explicit material.', 'error');
                                try { fbDb.collection('moderation_flags').add({ userId: userState.id, username: userState.username, reason: 'Explicit content', text: text.substring(0,100), flaggedAt: new Date().toISOString() }); } catch(e) {}
                                return;
                            }
                            const postSubmitBtn = form.querySelector('button[type="submit"]');
                            if (postSubmitBtn) postSubmitBtn.disabled = true;
                            if (postMediaFiles.length > 0) showNotification('Uploading media...', 'info');
                            (async () => {
                                try {
                                    const cloudUrls = await window.uploadMediaFilesToCloudinary(postMediaFiles);
                                    // FIX: map files to objects with explicit _cloudUrl + url so
                                    // createNewPostElement uses the Cloudinary URL on the posting device too.
                                    // Filter out any empty/blob results to keep Firestore + DOM clean.
                                    const _postMediaObjs = postMediaFiles.map(function(f, i) {
                                        var u = (cloudUrls[i] && !cloudUrls[i].startsWith('blob:')) ? cloudUrls[i] : '';
                                        if (u) f._cloudUrl = u;
                                        return u ? { _cloudUrl: u, url: u, type: f.type || 'image/jpeg' } : null;
                                    }).filter(Boolean);
                                    if (postMediaFiles.length > 0 && _postMediaObjs.length === 0) {
                                        showNotification('⚠ Media upload failed -- post saved as text only. Check your connection.', 'warning');
                                    }

                                    // Build quoted-post block HTML (embedded inside the new post)
                                    let quotedBlockHTML = '';
                                    if (isQuotePost) {
                                        quotedBlockHTML = `<div class="quoted-post-block" data-quote-id="${quotePostId}" style="border:1.5px solid rgba(10,14,39,0.12);border-radius:14px;padding:10px 14px;margin-top:10px;background:rgba(10,14,39,0.03);">
                                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
                                                <i class="fas fa-retweet" style="color:var(--secondary);font-size:0.75rem;"></i>
                                                <strong style="font-size:0.78rem;color:var(--primary);">@${quoteAuthor}</strong>
                                            </div>
                                            ${quoteMedia ? `<img src="${quoteMedia}" style="width:100%;max-height:140px;object-fit:cover;border-radius:10px;margin-bottom:6px;" loading="lazy">` : ''}
                                            <p style="font-size:0.82rem;color:var(--text-muted);margin:0;line-height:1.4;">${quoteText.substring(0,200)}${quoteText.length>200?'…':''}</p>
                                        </div>`;
                                    }

                                    const displayText = text + (quotedBlockHTML ? '\n' : '');
                                    // FIX: pass mapped objects (cloud URLs) not raw File objects
                                    const newPost = createNewPostElement(displayText, _postMediaObjs);
                                    // Inject quoted block into the post DOM element
                                    if (isQuotePost && quotedBlockHTML) {
                                        const storyContent = newPost.querySelector('.story-content');
                                        if (storyContent) {
                                            const qDiv = document.createElement('div');
                                            qDiv.innerHTML = quotedBlockHTML;
                                            storyContent.appendChild(qDiv.firstElementChild);
                                        }
                                    }

                                    if (feedContainer) { feedContainer.prepend(newPost); const es = document.getElementById('feed-empty-state'); if (es) es.style.display = 'none'; }

                                    // ── ALL profile feed rendering REMOVED ──────────────────────────
                                    // The posts listener (lines 2404-2426) already mirrors own posts
                                    // to BOTH profile-dash-feed AND profile-posts-feed with proper data.
                                    // Optimistic local injection here caused duplicate posts in profile:
                                    // one as "Guest" (optimistic, incomplete author data), one as the
                                    // real username (from Firestore listener). Let the listener be the
                                    // SINGLE source of truth for ALL profile feeds.

                                    populateProfileGallery(userState.id);

                                    if (!window._firebaseLoaded) {
                                        await new Promise(resolve => { let tries=0; const t=setInterval(()=>{tries++;if(window._firebaseLoaded||tries>20){clearInterval(t);resolve();}},500); });
                                    }
                                    try {
                                        const postDoc = {
                                            id: newPost.dataset.postId,
                                            userId: userState.id,
                                            username: userState.fullName || userState.username,
                                            avatar: userState.avatar || '',
                                            text: text,
                                            media: _postMediaObjs.map(function(o){ return o.url; }),
                                            createdAt: new Date().toISOString(),
                                            // ── Quote fields persisted to Firestore ──
                                            ...(isQuotePost ? { isQuote: true, quotePostId, quoteAuthor, quoteText, quoteMedia } : {})
                                        };
                                        await fbDb.collection('posts').doc(postDoc.id).set(postDoc);
                                        console.log('[Post] ✅ Saved to Firestore:', postDoc.id, isQuotePost ? '(Quote)' : '');
                                    } catch(e) {
                                        console.error('[Post] ❌ Firestore save failed:', e.message);
                                        const _retryMedia = _postMediaObjs.map(function(o){ return o.url; });
                                        setTimeout(async () => { try { await fbDb.collection('posts').doc(newPost.dataset.postId).set({ id: newPost.dataset.postId, userId: userState.id, username: userState.fullName || userState.username, avatar: userState.avatar || '', text, media: _retryMedia, createdAt: new Date().toISOString() }); } catch(e2) {} }, 3000);
                                    }
                                    // Clear quote state
                                    delete postTextarea.dataset.quotePostId;
                                    delete postTextarea.dataset.quoteAuthor;
                                    delete postTextarea.dataset.quoteText;
                                    delete postTextarea.dataset.quoteMedia;
                                    const qp = document.getElementById('_quote_preview_card');
                                    if (qp) qp.remove();

                                    form.reset();
                                    postMediaFiles = [];
                                    const postMediaPreview = document.getElementById('post-media-preview');
                                    if (postMediaPreview) postMediaPreview.innerHTML = '';
                                    rewardUserForAction('CREATE_POST');
                                } finally { 
                                    if (postSubmitBtn) postSubmitBtn.disabled = false;
                                    // Clear any modal-open state that might block navigation
                                    document.body.classList.remove('modal-open');
                                    document.body.style.overflow = '';
                                }
                            })();
                            break;
                        }
                         case 'create-business-post-form': {
                            const businessPostTextarea = form.querySelector('textarea');
                            if (!businessPostTextarea) return;
                            const text = businessPostTextarea.value;
                            if (!text.trim() && businessPostMediaFiles.length === 0) {
                                showNotification('Post cannot be empty.', 'error'); return;
                            }
                            const bpSubmitBtn = form.querySelector('button[type="submit"]');
                            if (bpSubmitBtn) bpSubmitBtn.disabled = true;
                            if (businessPostMediaFiles.length > 0) showNotification('Uploading media...', 'info');
                            (async () => {
                                try {
                                    const cloudUrls = await window.uploadMediaFilesToCloudinary(businessPostMediaFiles);
                                    businessPostMediaFiles.forEach((f, i) => { if (cloudUrls[i]) f._cloudUrl = cloudUrls[i]; });
                                    const newPost = createNewPostElement(text, businessPostMediaFiles, userState, true);
                                    const businessPageFeedContainer = document.getElementById('business-page-feed-container');
                                    if (businessPageFeedContainer) businessPageFeedContainer.prepend(newPost);
                                    try {
                                        await fbDb.collection('business_posts').doc(newPost.dataset.postId).set({
                                            id: newPost.dataset.postId, userId: userState.id,
                                            pageId: userState.businessPage?.id, text, media: cloudUrls,
                                            createdAt: new Date().toISOString()
                                        });
                                    } catch(e) {}
                                    form.reset();
                                    businessPostMediaFiles = [];
                                    const bpMediaPreview = form.querySelector('#business-post-media-preview');
                                    if (bpMediaPreview) bpMediaPreview.innerHTML = '';
                                    showNotification('✅ Posted to your profile and dashboard!', 'success');
                        // Mirror post to dashboard feed
                        try {
                            const dashFeed = document.getElementById('posts-feed');
                            if (dashFeed && typeof newPost !== 'undefined' && newPost) {
                                const clone = newPost.cloneNode(true);
                                dashFeed.prepend(clone);
                            }
                        } catch(e) {}
                                } finally { if (bpSubmitBtn) bpSubmitBtn.disabled = false; }
                            })();
                            break;
                        }
                        case 'go-live-form': {
                            if (isGuest) {
                                showNotification("Please log in to start a live stream.", 'error');
                                authModal.classList.add('show');
                                document.getElementById('login-view').style.display = 'block';
                                setTimeout(function(){ if(typeof generateCaptcha==='function') generateCaptcha(); }, 80);
                                return;
                            }
                            // Only block if the live modal is currently open (stream is actively running)
                            const liveModalNow = document.getElementById('go-live-modal-overlay');
                            const liveModalOpen = liveModalNow && (liveModalNow.classList.contains('show') || liveModalNow.style.display === 'flex');
                            if (liveStreamData.isLive && liveModalOpen) {
                                showNotification("You are already live!", "warning");
                                return;
                            }
                            // Reset stale live state so a fresh stream can begin
                            if (liveStreamData.isLive && !liveModalOpen) {
                                liveStreamData.isLive = false;
                                liveStreamData._localStream = null;
                                if (liveStreamData.rewardInterval) { clearInterval(liveStreamData.rewardInterval); liveStreamData.rewardInterval = null; }
                                if (liveStreamData._viewerSimInterval) { clearInterval(liveStreamData._viewerSimInterval); liveStreamData._viewerSimInterval = null; }
                            }
                            const liveTitleInput = document.getElementById('live-title');
                            const liveDescriptionTextarea = document.getElementById('live-description');
                            if (!liveTitleInput || !liveDescriptionTextarea) return; 

                            liveStreamData = {
                                ...liveStreamData, 
                                isLive: true,
                                title: liveTitleInput.value,
                                description: liveDescriptionTextarea.value,
                                streamId: `live-${Date.now()}`,
                                startTime: Date.now(),
                                hostUserId: userState.id,
                            };
                            const selectedBgThumb = form.querySelector('.bg-thumb.active');
                            if (selectedBgThumb && selectedBgThumb.dataset.bg !== "custom-upload") {
                                liveStreamData.background = selectedBgThumb.dataset.bg;
                                liveStreamData.customBackgroundFile = null;
                            } else if (liveStreamData.customBackgroundFile) {
                            } else {
                                liveStreamData.background = liveBackgrounds[0].style; 
                            }

                            createDashboardLiveCard(liveStreamData.streamId, liveStreamData.title, userState.fullName, userState.avatar, liveStreamData.background, userState.id);
                            // Notify followers that user is live
                            if (typeof window.notifyFriendsUserIsLive === 'function') {
                                window.notifyFriendsUserIsLive(userState.fullName, liveStreamData.streamId);
                            }
                            
                            // Open the go-live modal directly as host, bypassing join-live-btn guard
                            const goLiveModal = document.getElementById('go-live-modal-overlay');
                            if (goLiveModal) {
                                document.getElementById('live-host-name') && (document.getElementById('live-host-name').textContent = userState.fullName);
                                document.getElementById('live-host-avatar') && (document.getElementById('live-host-avatar').src = userState.avatar);
                                document.getElementById('live-stream-host-avatar') && (document.getElementById('live-stream-host-avatar').src = userState.avatar);
                                document.getElementById('host-video-fallback-avatar') && (document.getElementById('host-video-fallback-avatar').src = userState.avatar);
                                goLiveModal.style.display = 'flex';
                                goLiveModal.classList.add('show');
                                document.body.classList.add('modal-open');
                                const requestJoinBtn = document.getElementById('live-request-join-btn');
                                if (requestJoinBtn) requestJoinBtn.style.display = 'none';
                                updateLiveUI();
                                // Start reward interval for host
                                if (liveStreamData.rewardInterval) clearInterval(liveStreamData.rewardInterval);
                                liveStreamData.rewardInterval = setInterval(() => { rewardUserForAction('LIVE_STREAM_INTERVAL'); }, 300000);
                            }

                            // Helper to start camera with retry -- improved for Android/WebView
                            function startHostCamera(attempt) {
                                const hostVideo = document.getElementById('host-main-video');
                                const fallbackAvatar = document.getElementById('host-video-fallback-avatar');
                                if (!hostVideo) {
                                    if (attempt < 15) setTimeout(() => startHostCamera(attempt + 1), 200);
                                    return;
                                }
                                if (liveStreamData._localStream) {
                                    hostVideo.srcObject = liveStreamData._localStream;
                                    hostVideo.muted = true;
                                    hostVideo.play().catch(()=>{});
                                    if(fallbackAvatar) fallbackAvatar.style.display = 'none';
                                    showNotification('🔴 You are now LIVE!', 'success');
                                    return;
                                }
                                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                                    if(fallbackAvatar) { fallbackAvatar.style.display = 'block'; fallbackAvatar.src = userState.avatar; }
                                    showNotification('📡 Live with audio only -- camera not supported on this device.', 'info');
                                    // Try audio only fallback
                                    navigator.mediaDevices && navigator.mediaDevices.getUserMedia({ audio: true })
                                        .then(s => { liveStreamData._localStream = s; showNotification('🎤 Audio-only live stream active.', 'success'); })
                                        .catch(()=>{});
                                    return;
                                }
                                // Try progressively relaxed constraints for maximum Android compatibility
                                const constraintSets = [
                                    { video: { facingMode: 'user' }, audio: true },
                                    { video: { facingMode: 'environment' }, audio: true },
                                    { video: true, audio: true },
                                    { video: true, audio: false },
                                    { audio: true }
                                ];
                                let constraintIdx = attempt < constraintSets.length ? attempt : constraintSets.length - 1;
                                navigator.mediaDevices.getUserMedia(constraintSets[constraintIdx])
                                    .then(stream => {
                                        liveStreamData._localStream = stream;
                                        const hasVideo = stream.getVideoTracks().length > 0;
                                        if (hasVideo) {
                                            hostVideo.srcObject = stream;
                                            hostVideo.muted = true;
                                            hostVideo.play().catch(()=>{});
                                            if(fallbackAvatar) fallbackAvatar.style.display = 'none';
                                            showNotification('🔴 You are now LIVE! Camera active.', 'success');
                                        } else {
                                            if(fallbackAvatar) { fallbackAvatar.style.display = 'block'; fallbackAvatar.src = userState.avatar; }
                                            showNotification('🎤 Going LIVE with audio only -- camera unavailable.', 'info');
                                        }
                                    })
                                    .catch(err => {
                                        console.warn('Camera attempt ' + constraintIdx + ' failed:', err.name, err.message);
                                        if (constraintIdx < constraintSets.length - 1) {
                                            setTimeout(() => startHostCamera(constraintIdx + 1), 300);
                                        } else {
                                            if(fallbackAvatar) { fallbackAvatar.style.display = 'block'; fallbackAvatar.src = userState.avatar || ''; }
                                            showNotification('⚠️ Camera/mic access denied. Check your browser permissions in Settings → Site Settings → Camera & Microphone, then try again.', 'warning');
                                        }
                                    });
                            }
                            setTimeout(() => startHostCamera(0), 400); 
                            
                            form.reset();
                            liveStreamData.customBackgroundFile = null; 
                            populateBackgroundSelector(); 
                            navigateTo('dashboard'); 
                            
                            break;
                        }
                        case 'live-goal-form': { 
                            const goalDescriptionInput = document.getElementById('goal-description');
                            const goalTargetAmountInput = document.getElementById('goal-target-amount');
                            if (!goalDescriptionInput || !goalTargetAmountInput) return; 

                            const description = goalDescriptionInput.value;
                            const targetAmount = parseFloat(goalTargetAmountInput.value);

                            if (targetAmount > 0) {
                                liveStreamData.liveGoal = {
                                    description: description,
                                    targetAmount: targetAmount,
                                    currentAmount: 0 
                                };
                                showNotification("Live goal set!", "success");
                                const liveGoalSettingsModal = document.getElementById('live-goal-settings-modal');
                                if (liveGoalSettingsModal) liveGoalSettingsModal.classList.remove('show');
                                updateLiveUI();
                            } else {
                                showNotification("Target amount must be greater than 0.", "error");
                            }
                            break;
                        }
                        case 'stake-form': { 
                            const stakeAmountInput = document.getElementById('stake-amount');
                            if (!stakeAmountInput) return; 

                            const amountToStake = parseFloat(stakeAmountInput.value);
                            if (isNaN(amountToStake) || amountToStake <= 0) {
                                showNotification("Please enter a valid amount to stake.", "error");
                                return;
                            }
                            if (userState.empyBalance < amountToStake) {
                                showNotification("Insufficient EMPY balance for staking.", "error");
                                return;
                            }
                            userState.empyBalance -= amountToStake;
                            userManualStakedBalance += amountToStake;
                            userStakedBalance = userManualStakedBalance + userLockedStakedBalance;
                            showNotification(`${amountToStake.toLocaleString()} EMPY staked successfully!`, "success");
                            form.reset();
                            updateWalletUI();
                            break;
                        }
                        case 'unstake-form': { 
                            const unstakeAmountInput = document.getElementById('unstake-amount');
                            if (!unstakeAmountInput) return; 

                            const amountToUnstake = parseFloat(unstakeAmountInput.value);
                            if (isNaN(amountToUnstake) || amountToUnstake <= 0) {
                                showNotification("Please enter a valid amount to unstake.", "error");
                                return;
                            }
                            if (userManualStakedBalance < amountToUnstake) {
                                showNotification("You don't have enough manual staked EMPY to unstake.", "error");
                                return;
                            }
                            userState.empyBalance += amountToUnstake;
                            userManualStakedBalance -= amountToUnstake;
                            userStakedBalance = userManualStakedBalance + userLockedStakedBalance;
                            userClaimedRewardsHistory.push({ 
                                type: 'Manual Staking Unstaked',
                                amount: amountToUnstake,
                                date: new Date().toLocaleDateString()
                            });
                            showNotification(`${amountToUnstake.toLocaleString()} EMPY unstaked successfully!`, "success");
                            form.reset();
                            updateWalletUI();
                            break;
                        }

                        case 'live-comment-form': {
                            const input = form.querySelector('#live-comment-input');
                            if (!input) return; 

                            const text = input.value.trim();
                            if(text) createLiveComment(userState.fullName, text);
                            input.value = '';
                            break;
                        }
                        case 'p2p-transfer-form': { 
                            const transferAmountInput = document.getElementById('transfer-amount');
                            if (!transferAmountInput) return; 

                            const amountEmpy = parseFloat(transferAmountInput.value) || 0;
                            const networkFee = 1.0;
                            const totalDeducted = amountEmpy + networkFee;

                            if (userState.empyBalance < totalDeducted) {
                                showNotification("Insufficient balance for this transfer.", "error");
                                return;
                            }
                            
                            userState.empyBalance -= totalDeducted;
                            updateWalletUI();
                            showNotification(`${amountEmpy.toLocaleString()} EMPY sent successfully!`, 'success');
                            form.reset();
                            updateTransferPreview();
                            break;
                        }
                         case 'cross-chain-transfer-form': {
                            const crossChainAmountInput = form.querySelector('#cross-chain-amount');
                            const networkSelect = form.querySelector('#cross-chain-network');
                            if (!crossChainAmountInput || !networkSelect) return; 

                            const amountEmpy = parseFloat(crossChainAmountInput.value) || 0;
                            const selectedOption = networkSelect.options[networkSelect.selectedIndex];
                            const networkFee = parseFloat(selectedOption.dataset.fee) || 0;
                            const totalDeducted = amountEmpy + networkFee;

                            if (userState.empyBalance < totalDeducted) {
                                showNotification("Insufficient balance for this transfer.", "error");
                                return;
                            }
                            
                            userState.empyBalance -= totalDeducted;
                            updateWalletUI();
                            showNotification(`${amountEmpy.toLocaleString()} EMPY sent to external wallet!`, 'success');
                            form.reset();
                            updateCrossChainTransferPreview();
                            break;
                        }
                        case 'promotion-setup-form': {
                            const promoPaymentSelect = form.querySelector('#promo-payment');
                            const promoBudgetInput = form.querySelector('#promo-budget');
                            if (!promoPaymentSelect || !promoBudgetInput) return; 

                            const paymentMethod = promoPaymentSelect.value;
                            const budget = parseFloat(promoBudgetInput.value);
                            const budgetInUsd = budget / USD_TO_NGN_RATE;
                            const budgetInEmpy = budgetInUsd / EMPY_RATE_USD;

                            const promotionSetupView = document.getElementById('promotion-setup-view');
                            const promotionPaymentDetails = document.getElementById('promotion-payment-details');
                            if (promotionSetupView) promotionSetupView.style.display = 'none';
                            if (promotionPaymentDetails) promotionPaymentDetails.style.display = 'block';

                            const paymentTitle = document.getElementById('payment-details-title');
                            const walletView = document.getElementById('promo-wallet-payment-view');
                            const cardView = document.getElementById('promo-card-payment-view');

                            if (paymentTitle && walletView && cardView) { 
                                if (paymentMethod === 'wallet') {
                                    paymentTitle.textContent = "Confirm EMPY Payment";
                                    walletView.style.display = 'block';
                                    cardView.style.display = 'none';
                                    const promoEmpyCost = document.getElementById('promo-empy-cost');
                                    if (promoEmpyCost) promoEmpyCost.innerHTML = `<i class="fa-solid fa-coins"></i> ${budgetInEmpy.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
                                } else {
                                    paymentTitle.textContent = `Pay ${formatNgnPrice(budget)} with Card`;
                                    walletView.style.display = 'none';
                                    cardView.style.display = 'block';
                                }
                            }
                            break;
                        }
                        case 'promotion-finalize-form': {
                            const promoPaymentSelect = document.getElementById('promo-payment');
                            const promoBudgetInput = document.getElementById('promo-budget');
                            const promotePostIdInput = document.getElementById('promote-post-id');
                            if (!promoPaymentSelect || !promoBudgetInput || !promotePostIdInput) return; 

                            const paymentMethod = promoPaymentSelect.value;
                            const budget = parseFloat(promoBudgetInput.value);
                            const budgetInUsd = budget / USD_TO_NGN_RATE;
                            const budgetInEmpy = budgetInUsd / EMPY_RATE_USD;
                             const postId = promotePostIdInput.value;

                            if (paymentMethod === 'wallet') {
                                if (userState.empyBalance < budgetInEmpy) {
                                    showNotification('Insufficient EMPY balance for this promotion.', 'error');
                                    return;
                                }
                                userState.empyBalance -= budgetInEmpy;
                                updateWalletUI();
                            } else {
                                const cardForm = document.getElementById('promo-card-form');
                                if (!cardForm || !cardForm.checkValidity()) { 
                                    showNotification("Please fill in your card details.", 'error');
                                    return;
                                }
                            }
                            
                            const postElement = document.querySelector(`[data-post-id="${postId}"], [data-id="${postId}"]`);
                            if(postElement) {
                                const sponsoredBadge = postElement.querySelector('.sponsored-badge');
                                if(sponsoredBadge) sponsoredBadge.style.display = 'inline-flex';
                            }

                            const closestModal = form.closest('.modal-overlay-container');
                            if (closestModal) closestModal.classList.remove('show');
                            document.body.classList.remove('modal-open');
                            showNotification("Your promotion is now active!", "success");
                            break;
                        }
                        case 'edit-post-form': {
                            const editPostIdInput = form.querySelector('#edit-post-id');
                            const editPostTextInput = form.querySelector('#edit-post-text');
                            const editCollectionInput = form.querySelector('#edit-post-collection');
                            if (!editPostIdInput || !editPostTextInput) return;

                            const postId = editPostIdInput.value;
                            const newText = editPostTextInput.value.trim();
                            const collection = (editCollectionInput && editCollectionInput.value) || 'posts';
                            if (!newText) { showNotification('Post text cannot be empty.', 'warning'); return; }

                            // Update all DOM mirrors
                            document.querySelectorAll('[data-post-id="'+postId+'"]').forEach(function(postEl) {
                                var p = postEl.querySelector('.story-content p, .news-item-content p, .news-item-summary');
                                if (p) p.innerHTML = typeof formatWhatsAppText === 'function' ? formatWhatsAppText(newText) : newText;
                                // Also update marketplace name/title if applicable
                                var h4 = postEl.querySelector('.property-info h4');
                                if (h4) h4.textContent = newText;
                            });

                            // Save to Firestore
                            if (window.fbDb && postId) {
                                const updateField = (collection === 'marketplace_listings') ? 'name'
                                    : (collection === 'news_posts') ? 'content'
                                    : (collection === 'reels') ? 'caption'
                                    : (collection === 'crisis_reports') ? 'story'
                                    : 'text';
                                window.fbDb.collection(collection).doc(postId).update({
                                    [updateField]: newText,
                                    updatedAt: new Date().toISOString()
                                }).then(function() {
                                    showNotification('✅ Updated and saved.', 'success');
                                }).catch(function(err) {
                                    console.warn('[Edit] Firestore update failed:', err.message);
                                    showNotification('Updated locally. Cloud sync may be delayed.', 'info');
                                });
                            }

                            const closestModal = form.closest('.modal-overlay-container');
                            if (closestModal) closestModal.classList.remove('show');
                            document.body.classList.remove('modal-open');
                            showNotification('Post updated!', 'success');
                            break;
                        }
                        
                        case 'marketplace-form': {
                            e.preventDefault();
                            const nameInput    = form.querySelector('#item-name');
                            const priceInput   = form.querySelector('#item-price');
                            const categoryInput= form.querySelector('#item-category');
                            const locationInput= form.querySelector('#item-location');
                            const descInput    = form.querySelector('#item-description');
                            const salesTypeInput = form.querySelector('#sales-type');
                            // FIX: form fields are named item-seller-* (see index.html #marketplace-form)
                            // but this code was querying #contact-name/phone/email/address — IDs that
                            // don't exist anywhere in the form. querySelector returned null for all four,
                            // so contactName/Phone/Email/Address always saved as '' regardless of what
                            // the seller typed. Corrected to match the real field IDs.
                            const contactNameInput  = form.querySelector('#item-seller-name');
                            const contactPhoneInput = form.querySelector('#item-seller-phone');
                            const contactEmailInput = form.querySelector('#item-seller-email');
                            const contactAddrInput  = form.querySelector('#item-seller-address');
                            const currencyInput = form.querySelector('#item-currency') || form.querySelector('[name="item-currency"]');

                            if (!nameInput || !priceInput || !locationInput) return;
                            const itemName  = nameInput.value.trim();
                            const itemPrice = parseFloat(priceInput.value) || 0;
                            const itemLoc   = locationInput.value.trim();
                            if (!itemName || !itemPrice || !itemLoc) {
                                showNotification('Please fill in Name, Price and Location.', 'error');
                                return;
                            }

                            const submitBtn = form.querySelector('button[type="submit"]');
                            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading…'; }

                            (async () => {
                                try {
                                    // Upload media to Cloudinary
                                    let mediaUrls = [];
                                    if (typeof marketplaceMediaFiles !== 'undefined' && marketplaceMediaFiles.length > 0) {
                                        showNotification('Uploading marketplace media…', 'info');
                                        try {
                                            mediaUrls = await window.uploadMediaFilesToCloudinary(marketplaceMediaFiles);
                                            mediaUrls = mediaUrls.filter(Boolean);
                                        } catch(uploadErr) {
                                            console.error('[Marketplace] Upload failed:', uploadErr.message);
                                            showNotification('Media upload failed: ' + (uploadErr.message || 'Check your connection and try again.'), 'error');
                                            return;
                                        }
                                    }

                                    const itemId    = 'mkt-' + Date.now();
                                    const salesType = salesTypeInput ? salesTypeInput.value : 'escrow';
                                    const currency  = currencyInput ? currencyInput.value : 'NGN';

                                    const listingData = {
                                        id:          itemId,
                                        name:        itemName,
                                        price:       itemPrice,
                                        currency:    currency,
                                        category:    categoryInput ? categoryInput.value : '',
                                        location:    itemLoc,
                                        description: descInput ? descInput.value.trim() : '',
                                        salesType:   salesType,
                                        media:       mediaUrls,
                                        sellerId:    userState.id,
                                        sellerName:  userState.fullName || userState.username || 'Seller',
                                        sellerAvatar:userState.avatar || '',
                                        createdAt:   new Date().toISOString(),
                                        contactName: contactNameInput  ? contactNameInput.value.trim()  : '',
                                        contactPhone:contactPhoneInput ? contactPhoneInput.value.trim() : '',
                                        contactEmail:contactEmailInput ? contactEmailInput.value.trim() : '',
                                        contactAddress:contactAddrInput? contactAddrInput.value.trim()  : '',
                                    };

                                    // Save to Firestore
                                    if (window._firebaseLoaded && window.fbDb) {
                                        try {
                                            await window.fbDb.collection('marketplace_listings').doc(itemId).set(listingData);
                                        } catch(fsErr) {
                                            console.warn('[Marketplace] Firestore save failed:', fsErr.message);
                                        }
                                    }

                                    // Add to local mock data so home slider updates immediately
                                    if (typeof window.addMarketItemToDashboardSlider === 'function') {
                                        window.addMarketItemToDashboardSlider(listingData);
                                    }

                                    // Refresh marketplace cards
                                    if (typeof window.renderMarketplaceCards === 'function') {
                                        window.renderMarketplaceCards();
                                    }

                                    showNotification('✅ Listing posted to Marketplace!', 'success');
                                    rewardUserForAction && rewardUserForAction('CREATE_POST');

                                    // Reset form
                                    form.reset();
                                    marketplaceMediaFiles = [];
                                    const preview = document.getElementById('marketplace-media-preview');
                                    if (preview) preview.innerHTML = '';
                                    const textFields = document.getElementById('marketplace-text-fields');
                                    if (textFields) textFields.style.display = 'none';

                                    // Collapse the create form
                                    const createSection = form.closest('.section-create-panel, .create-listing-panel');
                                    if (createSection) createSection.style.display = 'none';

                                } catch(err) {
                                    console.error('[Marketplace submit]', err);
                                    showNotification('Upload failed: ' + (err.message || 'Try again'), 'error');
                                } finally {
                                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post Listing'; }
                                }
                            })();
                            break;
                        }


                        case 'reel-upload-form': {
                            e.preventDefault();
                            const videoInput   = form.querySelector('#reel-video-file');
                            const captionInput = form.querySelector('#reel-caption');
                            if (!videoInput || !videoInput.files[0]) {
                                showNotification('Please select a video file for your reel.', 'error');
                                return;
                            }
                            const videoFile = videoInput.files[0];
                            const caption   = captionInput ? captionInput.value.trim() : '';
                            const submitBtn = form.querySelector('button[type="submit"]');
                            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading reel…'; }

                            (async () => {
                                try {
                                    showNotification('Uploading reel video…', 'info');
                                    let cloudUrl = '';
                                    try {
                                        cloudUrl = await window.uploadToCloudinary(videoFile, null);
                                    } catch(uploadErr) {
                                        console.error('[Reel] Cloudinary upload failed:', uploadErr.message);
                                        showNotification('Video upload failed: ' + (uploadErr.message || 'Check your connection and try again.'), 'error');
                                        return;
                                    }
                                    if (!cloudUrl) throw new Error('Upload returned empty URL');

                                    const reelId = 'reel-' + Date.now();
                                    const reelData = {
                                        id:        reelId,
                                        videoUrl:  cloudUrl,
                                        url:       cloudUrl,
                                        caption:   caption,
                                        userId:    userState.id,
                                        username:  userState.username || userState.fullName || 'User',
                                        avatar:    userState.avatar || '',
                                        poster:    '',
                                        likes:     0,
                                        views:     0,
                                        createdAt: new Date().toISOString(),
                                    };

                                    // Save to Firestore
                                    if (window._firebaseLoaded && window.fbDb) {
                                        try {
                                            await window.fbDb.collection('reels').doc(reelId).set(reelData);
                                        } catch(fsErr) {
                                            console.warn('[Reel] Firestore save failed:', fsErr.message);
                                        }
                                    }

                                    // Inject into dashboard slider immediately
                                    if (typeof window.addReelToDashboardSlider === 'function') {
                                        window.addReelToDashboardSlider(reelData);
                                    }

                                    showNotification('✅ Reel uploaded!', 'success');
                                    rewardUserForAction && rewardUserForAction('CREATE_REEL');
                                    form.reset();

                                    // Close create panel
                                    const createPanel = form.closest('.section-create-panel');
                                    if (createPanel) createPanel.style.display = 'none';
                                } catch(err) {
                                    console.error('[Reel submit]', err);
                                    showNotification('Reel upload failed: ' + (err.message || 'Try again'), 'error');
                                } finally {
                                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Upload Reel'; }
                                }
                            })();
                            break;
                        }

                        case 'create-news-post-form': {
                            const newsTitleInput = form.querySelector('#news-title');
                            const newsContentTextarea = form.querySelector('#news-content');
                            if (!newsTitleInput || !newsContentTextarea) return;
                            const title = newsTitleInput.value.trim();
                            const content = newsContentTextarea.value.trim();
                            if (!title) { showNotification('Please enter a news title.', 'warning'); return; }
                            const newsSubmitBtn = form.querySelector('button[type="submit"]');
                            if (newsSubmitBtn) newsSubmitBtn.disabled = true;
                            (async () => {
                                try {
                                    let mediaUrl = null, mediaType = null;
                                    if (newsMediaFile) {
                                        try {
                                            showNotification('Uploading news media…', 'info');
                                            mediaUrl  = await window.uploadToCloudinary(newsMediaFile, null);
                                            mediaType = newsMediaFile.type;
                                        } catch(e) {
                                            console.warn('[News] Media upload failed:', e.message);
                                            showNotification('⚠ Media upload failed — article text will still be saved.', 'warning');
                                        }
                                    }
                                    const newsId = 'news-' + Date.now();
                                    const newsDoc = {
                                        id:        newsId,
                                        title:     title,
                                        content:   content,
                                        mediaUrl:  mediaUrl  || null,
                                        mediaType: mediaType || null,
                                        userId:    (window.userState && window.userState.id)       || 'unknown',
                                        username:  (window.userState && window.userState.username) || 'User',
                                        createdAt: new Date().toISOString()
                                    };
                                    /* Save to Firestore — app-news.js listener handles DOM + dashboard */
                                    try {
                                        await fbDb.collection('news_posts').doc(newsId).set(newsDoc);
                                        fbDb.collection('notifications').add({
                                            type: 'new_news', message: 'New article published: ' + (title || 'Latest News'),
                                            createdAt: new Date().toISOString(), read: false
                                        }).catch(function(){});
                                    } catch(e) {
                                        console.warn('[News] Firestore save failed:', e.message);
                                        showNotification('⚠ Article shown locally but cloud save failed.', 'warning');
                                        /* Inject locally so it appears immediately even without Firestore */
                                        if (typeof window.addNewsPost === 'function') window.addNewsPost(newsDoc);
                                    }
                                    if (typeof rewardUserForAction === 'function') rewardUserForAction('PUBLISH_NEWS');
                                    form.reset();
                                    const newsMediaPreview = document.getElementById('news-media-preview');
                                    if (newsMediaPreview) newsMediaPreview.innerHTML = '';
                                    newsMediaFile = null;
                                    showNotification('✅ News article published!', 'success');
                                } catch(err) {
                                    console.error('News post error:', err);
                                    showNotification('Failed to publish news article.', 'error');
                                } finally { if (newsSubmitBtn) newsSubmitBtn.disabled = false; }
                            })();
                            break;
                        }
                        case 'create-business-page-form': { 
                            const pageNameInput = form.querySelector('#page-name');
                            const pageTaglineInput = form.querySelector('#page-tagline');
                            const pageIndustrySelect = form.querySelector('#page-industry');
                            const pageEmailInput = form.querySelector('#page-email');
                            const pagePhoneInput = form.querySelector('#page-phone');
                            const pageAddressInput = form.querySelector('#page-address');
                            if (!pageNameInput || !pageTaglineInput || !pageIndustrySelect || !pageEmailInput) return;
                            const bizSubmitBtn = form.querySelector('button[type="submit"]');
                            if (bizSubmitBtn) bizSubmitBtn.disabled = true;
                            showNotification('Creating business page...', 'info');
                            (async () => {
                                try {
                                    let coverPhotoUrl = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80';
                                    let profilePhotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(pageNameInput.value)}&background=5B0EA6&color=fff&size=150`;
                                    if (newPageCoverFile) {
                                        try { coverPhotoUrl = await window.uploadToCloudinary(newPageCoverFile, null); } catch(e) {}
                                    }
                                    if (newPageProfileFile) {
                                        try { profilePhotoUrl = await window.uploadToCloudinary(newPageProfileFile, null); } catch(e) {}
                                    }
                                    const newPage = {
                                        id: `biz-${Date.now()}`,
                                        name: pageNameInput.value, tagline: pageTaglineInput.value,
                                        industry: pageIndustrySelect.value, email: pageEmailInput.value,
                                        phone: pagePhoneInput?.value || '', address: pageAddressInput?.value || '',
                                        coverPhoto: coverPhotoUrl, profilePhoto: profilePhotoUrl,
                                        followerCount: 0, ownerId: userState.id,
                                        createdAt: new Date().toISOString()
                                    };
                                    userState.businessPage = newPage;
                                    if (mockUsers[userState.id]) mockUsers[userState.id].businessPage = newPage;
                                    // Save to Firestore
                                    try {
                                        await fbDb.collection('business_pages').doc(newPage.id).set(newPage);
                                        await saveUserToFirestore(userState.id, userState);
                                    } catch(e) { console.warn('Business page Firestore save failed:', e.message); }
                                    // Close modal FIRST
                                    const modal = document.getElementById('create-business-page-modal');
                                    if (modal) modal.classList.remove('show');
                                    document.body.classList.remove('modal-open');
                                    // Reset form
                                    form.reset();
                                    const pageCoverPhotoPreview = document.getElementById('page-cover-photo-preview');
                                    if (pageCoverPhotoPreview) { pageCoverPhotoPreview.style.backgroundImage = ''; pageCoverPhotoPreview.innerHTML = '<i class="fas fa-camera"></i>&nbsp; Add Cover Image'; }
                                    const pageProfilePhotoPreview = document.getElementById('page-profile-photo-preview');
                                    if (pageProfilePhotoPreview) pageProfilePhotoPreview.style.backgroundImage = '';
                                    newPageCoverFile = null; newPageProfileFile = null;
                                    showNotification('✅ Business page created! Opening your page...', 'success');
                                    // Navigate and THEN render so the section is active before rendering
                                    navigateTo('business-page');
                                    setTimeout(function() {
                                        renderBusinessPage();
                                        // Scroll to top of business page section
                                        const bizSection = document.getElementById('business-page');
                                        if (bizSection) bizSection.scrollTop = 0;
                                        const mc = document.querySelector('.main-content');
                                        if (mc) mc.scrollTop = 0;
                                        // Trigger post-render setup (gallery upload, post media)
                                        const galleryInput = document.getElementById('business-gallery-upload');
                                        if (galleryInput && !galleryInput._bound) {
                                            galleryInput._bound = true;
                                            galleryInput.addEventListener('change', function() {
                                                const gallery = document.getElementById('business-media-gallery');
                                                Array.from(this.files).forEach(file => {
                                                    const url = URL.createObjectURL(file);
                                                    const div = document.createElement('div');
                                                    div.style.cssText = 'aspect-ratio:1;border-radius:14px;overflow:hidden;cursor:pointer;';
                                                    div.innerHTML = file.type.startsWith('video/')
                                                        ? `<video src="${url}" style="width:100%;height:100%;object-fit:cover;" muted playsinline loop></video>`
                                                        : `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`;
                                                    const uploadLabel = gallery ? gallery.querySelector('label') : null;
                                                    if (uploadLabel) gallery.insertBefore(div, uploadLabel);
                                                    else if (gallery) gallery.appendChild(div);
                                                });
                                            });
                                        }
                                    }, 150);
                                } catch(err) {
                                    console.error('Business page error:', err);
                                    showNotification('Failed to create business page.', 'error');
                                } finally { if (bizSubmitBtn) bizSubmitBtn.disabled = false; }
                            })();
                            break;
                        }
                        case 'withdrawal-form': {
                            const withdrawalAmountInput = document.getElementById('withdrawal-amount');
                            if (!withdrawalAmountInput) return; 

                            const amountEmpy = parseFloat(withdrawalAmountInput.value);
                             if (amountEmpy < 5) {
                                showNotification("Minimum withdrawal is 5 EMPY.", "error");
                                return;
                            }
                            if (userState.empyBalance < amountEmpy) {
                                showNotification("Insufficient EMPY balance for withdrawal.", "error");
                                return;
                            }
                            userState.empyBalance -= amountEmpy; 
                            showNotification("Withdrawal request submitted for approval.", "info");
                            form.reset();
                            handleWithdrawalMethodChange();
                            updateWithdrawalPreview();
                            updateWalletUI(); 
                        }
                            break;
                        case 'message-form':
                            const messageTextInput = form.querySelector('#message-text-input');
                            if (!messageTextInput) return; 

                            const text = messageTextInput.value.trim();
                            if (text) {
                                const messagesContainer = document.getElementById('chat-messages-container');
                                if (!messagesContainer) return; 

                                // Pass messageId to createMessageElement for potential pinning functionality
                                const messageId = `msg-${Date.now()}`;
                                const messageEl = createMessageElement(text, true, false, '', '', messageId);
                                messagesContainer.appendChild(messageEl);
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                messageTextInput.value = '';

                                if (!isGuest && userState.id === liveStreamData.hostUserId) {
                                    liveStreamData.sentMessages.push({ id: messageId, username: userState.username, content: text });
                                }
                            }
                            break;
                        case 'checkout-form': {
                            const currentPaymentMethod = document.querySelector('#checkout-form .payment-tabs .payment-tab.active')?.dataset.target;
                            const checkoutNameInput = document.getElementById('checkout-name');
                            const checkoutAddressInput = document.getElementById('checkout-address');
                            const checkoutBuyerEmail = document.getElementById('checkout-buyer-email');
                            const checkoutBuyerPhone = document.getElementById('checkout-buyer-phone');

                            if (!checkoutNameInput?.value || !checkoutAddressInput?.value) {
                                showNotification("Please fill in your shipping name and address.", "error");
                                if (checkoutNameInput && !checkoutNameInput.value) checkoutNameInput.style.borderColor = 'var(--danger-color)';
                                if (checkoutAddressInput && !checkoutAddressInput.value) checkoutAddressInput.style.borderColor = 'var(--danger-color)';
                                break;
                            }

                            if (currentPaymentMethod === 'escrow-payment') {
                                const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
                                const totalNgn = Math.round(total * USD_TO_NGN_RATE);
                                const buyerName = checkoutNameInput.value;
                                const buyerEmail = checkoutBuyerEmail?.value || userState.email || "buyer@empyrean.com";
                                const buyerPhone = checkoutBuyerPhone?.value || "";

                                FlutterwaveCheckout({
                                    public_key: (window._appConfig && window._appConfig.flutterwave && window._appConfig.flutterwave.publicKey) || "",
                                    tx_ref: `EMPY-ESCROW-${Date.now()}`,
                                    amount: totalNgn,
                                    currency: "NGN",
                                    payment_options: "card,banktransfer,ussd",
                                    customer: { email: buyerEmail, phone_number: buyerPhone, name: buyerName },
                                    customizations: {
                                        title: "Empyrean Marketplace - Escrow Payment",
                                        description: `Secure escrow for ${cart.length} item(s). Funds held until delivery confirmed.`,
                                        logo: "https://cdn-icons-png.flaticon.com/512/6001/6001527.png",
                                    },
                                    callback: function(data) {
                                        if (data.status === "successful") {
                                            showNotification("✅ Escrow payment received! Seller has been notified. You have 48hrs to confirm delivery.", "success");
                                            cart = [];
                                            updateCartUI();
                                            const cartModal = document.getElementById('cart-modal-overlay');
                                            if (cartModal) cartModal.classList.remove('show');
                                            document.body.classList.remove('modal-open');
                                            rewardUserForAction('SUCCESSFUL_ESCROW_BUYER');
                                        } else {
                                            showNotification("Payment not completed. Please try again.", "error");
                                        }
                                    },
                                    onclose: function() {}
                                });
                            } else {
                                showNotification("Direct purchase initiated! Please contact the seller to arrange payment.", "success");
                                cart = [];
                                updateCartUI();
                                const cartModal = document.getElementById('cart-modal-overlay');
                                if (cartModal) cartModal.classList.remove('show');
                                document.body.classList.remove('modal-open');
                            }
                            break;
                        }
                    }
                });

                document.body.addEventListener('input', function(e) {
                    if (e.target.closest('.form-group')) {
                        e.target.style.borderColor = '';
                        if (e.target.closest('.upload-area')) {
                            e.target.closest('.upload-area').style.borderColor = '';
                        }
                         if (e.target.classList.contains('live-capture-btn')) {
                            e.target.style.borderColor = '';
                        }
                    }

                    if (e.target.id === 'withdrawal-amount') {
                        updateWithdrawalPreview();
                    } else if (e.target.id === 'transfer-amount') { 
                        updateTransferPreview();
                    } else if (e.target.id === 'cross-chain-amount') {
                        updateCrossChainTransferPreview();
                    }
                    if (e.target.id === 'buy-empy-amount-usd') {
                        const amountNgn = parseFloat(e.target.value) || 0;
                        const previewEl = document.getElementById('empy-to-receive-preview');
                        if (previewEl) { 
                            if (amountNgn > 0) {
                                const empyAmt = (amountNgn / USD_TO_NGN_RATE) / EMPY_RATE_USD;
                                previewEl.textContent = `You will receive: ${Math.floor(empyAmt).toLocaleString()} EMPY`;
                            } else {
                                previewEl.textContent = '';
                            }
                        }
                    }
                    if (e.target.id === 'promo-budget') {
                        updatePromoReachPreview();
                    }
                    if (e.target.id === 'sidebar-search-input') {
                        const searchTerm = e.target.value.toLowerCase();
                        const activeSection = document.querySelector('.content-section.active');

                        if (!activeSection) return;

                        if (activeSection.id === 'dashboard') {
                            const feedItems = document.querySelectorAll('#feed-container .impact-story');
                            feedItems.forEach(item => {
                                const postText = item.querySelector('.story-content p')?.textContent.toLowerCase() || '';
                                const username = item.querySelector('.story-user-info strong')?.textContent.toLowerCase() || '';
                                if (postText.includes(searchTerm) || username.includes(searchTerm)) {
                                    item.style.display = 'block';
                                } else {
                                    item.style.display = 'none';
                                }
                            });
                        } else if (activeSection.id === 'marketplace') {
                            const propertyCards = document.querySelectorAll('#property-grid-container .property-card');
                            propertyCards.forEach(card => {
                                const itemName = card.dataset.name.toLowerCase();
                                const itemLocation = card.dataset.location.toLowerCase();
                                if (itemName.includes(searchTerm) || itemLocation.includes(searchTerm)) {
                                    card.style.display = 'block';
                                } else {
                                    card.style.display = 'none';
                                }
                            });
                        } else if (activeSection.id === 'news') {
                            const newsItems = document.querySelectorAll('#news-list-container .news-list-item');
                            newsItems.forEach(item => {
                                const title = item.querySelector('.news-item-content h4')?.textContent.toLowerCase() || '';
                                const content = item.querySelector('.news-item-content p')?.textContent.toLowerCase() || '';
                                if (title.includes(searchTerm) || content.includes(searchTerm)) {
                                    item.style.display = 'flex'; 
                                } else {
                                    item.style.display = 'none';
                                }
                            });
                        }
                    }
                });
                
                document.querySelectorAll('#reels .reel-card').forEach(card => {
                    const video = card.querySelector('video');
                    if (video) { 
                        card.addEventListener('mouseover', () => video.play().catch(e => {}));
                        card.addEventListener('mouseout', () => video.pause());
                    }
                });

                new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1 && node.matches('.dashboard-news-card, .dashboard-market-card')) {
                                const video = node.querySelector('video');
                                if (video) {
                                    node.addEventListener('mouseover', () => video.play().catch(e => {}));
                                    node.addEventListener('mouseout', () => video.pause());
                                }
                            }
                        });
                    });
                }).observe(document.getElementById('dashboard-news-slider'), { childList: true });
                 new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1 && node.matches('.dashboard-news-card, .dashboard-market-card')) {
                                const video = node.querySelector('video');
                                if (video) {
                                    node.addEventListener('mouseover', () => video.play().catch(e => {}));
                                    node.addEventListener('mouseout', () => video.pause());
                                }
                            }
                        });
                    });
                }).observe(document.getElementById('dashboard-market-slider'), { childList: true });

                document.querySelectorAll('.kyc-file-upload').forEach(uploadArea => {
                    uploadArea.addEventListener('click', function() {
                        const inputId = this.dataset.inputId;
                        const fileInput = document.getElementById(inputId);
                        if (fileInput) fileInput.click();
                    });
                });

                document.querySelectorAll('.live-capture-btn').forEach(btn => {
                    // Store original required state
                    if (!btn.hasAttribute('data-original-required')) {
                        btn.dataset.originalRequired = btn.hasAttribute('required');
                    }

                    btn.addEventListener('click', function(e) {
                        e.preventDefault(); // Prevent default form submission on required field clicks
                        const previewElementId = `${this.id.replace('-btn', '')}-preview`;
                        const previewElement = document.getElementById(previewElementId);
                        if (previewElement) {
                            previewElement.innerHTML = `
                                <img src="https://source.unsplash.com/random/100x100/?selfie" alt="Selfie Preview" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">
                                <p style="margin-top: 5px;">Selfie captured!</p>
                            `;
                        }
                        showNotification("Selfie captured successfully!", "success");
                        this.dataset.captured = 'true'; // Mark as captured for validation
                        this.style.borderColor = ''; // Clear any red border
                    });
                });
                document.getElementById('claim-reward-btn')?.addEventListener('click', function() {
                    if (userEarnedRewards > 0) {
                        userState.empyBalance += userEarnedRewards;
                        userClaimedRewardsHistory.push({
                            type: 'Claimed Rewards',
                            amount: userEarnedRewards,
                            date: new Date().toLocaleDateString()
                        });
                        userEarnedRewards = 0; 
                        showNotification("Rewards claimed successfully!", "success");
                        updateWalletUI();
                    } else {
                        showNotification("No rewards to claim.", "info");
                    }
                });
            } 
            
            // =====================================================
            // NOTIFICATION SYSTEM
            // Online presence + Live stream + SOS notifications
            // =====================================================

            // --- APP INITIALIZATION ---
            setupMasterEventListeners();

            // ── DELETE-POST FIX: capture-phase listener fires before all bubble handlers ──
            // Reason: .delete-post-btn is inside .post-options inside .story-header.
            // The story-header bubble listener can intercept and return early, masking the click.
            // Using capture=true ensures this runs FIRST, before any bubble phase handlers.
            document.addEventListener('click', function _deletePostCapture(e) {
                var btn = e.target.closest('.delete-post-btn');
                if (!btn) return;
                e.preventDefault();
                e.stopImmediatePropagation(); // prevent all other listeners on this event

                // Close any open options menu
                document.querySelectorAll('.options-menu.show').forEach(function(m){ m.classList.remove('show'); });

                // Covers posts, reels, marketplace, news AND crisis reports
                var postEl = btn.closest('.impact-story, .reel-card, .property-card, .news-list-item, .crisis-report');
                if (!postEl) { console.warn('[Delete] Could not find parent post element'); return; }

                // Resolve collection + label for every content type
                var _isMkt    = postEl.classList.contains('property-card');
                var _isReel   = postEl.classList.contains('reel-card');
                var _isNews   = postEl.classList.contains('news-list-item');
                var _isCrisis = postEl.classList.contains('crisis-report');
                var collection = _isMkt ? 'marketplace_listings' : _isReel ? 'reels' : _isNews ? 'news_posts' : _isCrisis ? 'crisis_reports' : 'posts';
                var label = _isMkt ? 'listing' : _isReel ? 'reel' : _isNews ? 'news post' : _isCrisis ? 'crisis report' : 'post';
                var docId = postEl.dataset.postId || postEl.dataset.id || postEl.dataset.reelId || '';

                // Custom in-page confirmation banner (avoids native confirm() mobile issues)
                var existing = document.getElementById('_empyrean_delete_confirm');
                if (existing) existing.remove();
                var banner = document.createElement('div');
                banner.id = '_empyrean_delete_confirm';
                banner.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:#0A0E27;color:white;border-radius:16px;padding:14px 20px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:280px;max-width:92vw;font-family:inherit;animation:slideUp 0.2s ease;';
                banner.innerHTML = '<span style="flex:1;font-size:0.88rem;font-weight:600;">Delete this '+label+'? This cannot be undone.</span>'
                    + '<button id="_del_cancel" style="background:rgba(255,255,255,0.12);border:none;color:white;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:0.82rem;">Cancel</button>'
                    + '<button id="_del_confirm" style="background:#e53935;border:none;color:white;padding:7px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.82rem;">Delete</button>';
                document.body.appendChild(banner);

                var timeout = setTimeout(function(){ banner.remove(); }, 7000);

                document.getElementById('_del_cancel').onclick = function() {
                    clearTimeout(timeout); banner.remove();
                };
                document.getElementById('_del_confirm').onclick = function() {
                    clearTimeout(timeout); banner.remove();

                    // Animate removal
                    postEl.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
                    postEl.style.opacity = '0';
                    postEl.style.transform = 'scale(0.96)';
                    setTimeout(function() {
                        // Remove from every DOM mirror simultaneously (feed, profile dash, reels grid, etc.)
                        document.querySelectorAll('[data-post-id="'+docId+'"], [data-id="'+docId+'"], [data-reel-id="'+docId+'"]').forEach(function(el){ el.remove(); });
                        if (typeof populateProfileGallery === 'function' && window.userState) {
                            populateProfileGallery(window.userState.id);
                        }
                    }, 290);

                    // Delete from Firestore
                    if (window.fbDb && docId) {
                        window.fbDb.collection(collection).doc(docId).delete()
                            .then(function(){ if (typeof showNotification==='function') showNotification('✅ '+label.charAt(0).toUpperCase()+label.slice(1)+' deleted permanently.', 'success'); })
                            .catch(function(err){ console.error('[Delete] Firestore error:', err.message); if(typeof showNotification==='function') showNotification('Removed from view. Cloud sync may be delayed.', 'info'); });
                    } else {
                        if (typeof showNotification==='function') showNotification(label.charAt(0).toUpperCase()+label.slice(1)+' removed.', 'info');
                    }
                };
            }, true); // <-- capture phase
            // ── END DELETE-POST FIX ──

            // ── FIX 9: Click any post image → fullscreen expand ──────────
            document.addEventListener('click', function _imgExpand(e) {
                var img = e.target;
                if (img.tagName !== 'IMG') return;
                // Only images inside post media containers, gallery cards, marketplace cards
                var inPost = img.closest('.story-media-container, .story-media-item, .property-card, #profile-gallery, .news-item-image, .reel-card');
                if (!inPost) return;
                var src = img.src || img.currentSrc;
                if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;

                // For marketplace cards -- use the full media array stored in data-media
                var propCard = img.closest('.property-card');
                var siblings;
                if (propCard && propCard.dataset.media) {
                    try {
                        var allMedia = JSON.parse(propCard.dataset.media);
                        siblings = allMedia
                            .filter(function(u){ return u && !u.startsWith('blob:'); })
                            .map(function(u){ return { url: u, type: (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(u)||/\/video\/upload\//i.test(u)) ? 'video/mp4' : 'image/jpeg' }; });
                    } catch(e) { siblings = null; }
                }
                // Fallback: collect visible sibling images
                if (!siblings || siblings.length === 0) {
                    siblings = Array.from(inPost.querySelectorAll('img[src]'))
                        .map(function(im){ return { url: im.src, type: 'image/jpeg' }; })
                        .filter(function(m){ return m.url && !m.url.startsWith('blob:'); });
                }
                if (siblings.length === 0) siblings = [{ url: src, type: 'image/jpeg' }];

                var startIdx = siblings.findIndex(function(m){ return m.url === src; });
                if (startIdx < 0) startIdx = 0;

                if (typeof showMarketplaceGallery === 'function') {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    showMarketplaceGallery(siblings, startIdx);
                }
            }, true);

            // ── FIX 9b: Swipe navigation inside marketplace gallery modal ──
            (function() {
                var _swipeStartX = 0;
                var _swipeStartY = 0;
                document.addEventListener('touchstart', function(e) {
                    var modal = e.target.closest('#marketplace-gallery-modal');
                    if (!modal) return;
                    _swipeStartX = e.touches[0].clientX;
                    _swipeStartY = e.touches[0].clientY;
                }, { passive: true });
                document.addEventListener('touchend', function(e) {
                    var modal = e.target.closest('#marketplace-gallery-modal');
                    if (!modal) return;
                    var dx = _swipeStartX - e.changedTouches[0].clientX;
                    var dy = _swipeStartY - e.changedTouches[0].clientY;
                    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return; // too short or vertical
                    if (typeof navigateMarketplaceGallery === 'function') {
                        navigateMarketplaceGallery(dx > 0 ? 1 : -1); // swipe left = next, right = prev
                    }
                }, { passive: true });

                // Keyboard arrow navigation when modal is open
                document.addEventListener('keydown', function(e) {
                    var modal = document.getElementById('marketplace-gallery-modal');
                    if (!modal || !modal.classList.contains('show')) return;
                    if (e.key === 'ArrowRight') { if (typeof navigateMarketplaceGallery === 'function') navigateMarketplaceGallery(1); }
                    if (e.key === 'ArrowLeft')  { if (typeof navigateMarketplaceGallery === 'function') navigateMarketplaceGallery(-1); }
                    if (e.key === 'Escape') {
                        modal.classList.remove('show');
                        document.body.classList.remove('modal-open');
                    }
                });
            })();

            // ── FIX 10: X/Twitter-style live view counter ────────────────
            // NOTE (live-count icon-quality fix): this block used to also
            // inject sizing rules for .action-btn / .view-count-display /
            // .like-count / .retweet-count / .comment-count. Those rules
            // were injected via JS *after* style.css and index.html's inline
            // <style> block had already parsed, and they were !important —
            // so they always won the cascade and silently overrode the real
            // X-style spec (18px icons, 13px tabular counts) that style.css
            // and index.html already implement correctly. Removed here;
            // only the non-conflicting animation/hover rules remain.
            (function() {
                var style = document.createElement('style');
                style.textContent = [
                    '@keyframes _vcPop{0%{transform:translateY(0)}30%{transform:translateY(-3px)}70%{transform:translateY(1px)}100%{transform:translateY(0)}}',
                    '@keyframes _vcFade{0%{opacity:0.4}100%{opacity:1}}',
                    '.view-count._bump{animation:_vcPop 0.3s ease,_vcFade 0.2s ease;}',
                    '._rt_picker button:hover{background:rgba(10,14,39,0.04)!important;}',
                ].join('');
                document.head.appendChild(style);

                // Animate view count each time it increments
                var _origObserverCb = window._viewCountObserver;
                var _seen = typeof window._viewCountSeen !== 'undefined' ? window._viewCountSeen : (window._viewCountSeen = new Set());
                if (window._viewCountObserver) {
                    // Patch existing observer to also add bump animation
                    var _origDisconnect = window._viewCountObserver.disconnect.bind(window._viewCountObserver);
                }
                // MutationObserver watches view-count text changes → adds bump animation
                var vcMutObs = new MutationObserver(function(mutations) {
                    mutations.forEach(function(m) {
                        if (m.type === 'characterData' || m.type === 'childList') {
                            var el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
                            if (el && el.classList && el.classList.contains('view-count')) {
                                el.classList.remove('_bump');
                                void el.offsetWidth; // force reflow
                                el.classList.add('_bump');
                                setTimeout(function(){ el.classList.remove('_bump'); }, 350);
                            }
                        }
                    });
                });
                // Observe all current + future view-count spans
                function _observeVcSpans() {
                    document.querySelectorAll('.view-count:not([data-vc-obs])').forEach(function(sp) {
                        sp.dataset.vcObs = '1';
                        vcMutObs.observe(sp, { characterData: true, childList: true, subtree: true });
                    });
                }
                var _vcDomObs = new MutationObserver(_observeVcSpans);
                _vcDomObs.observe(document.body, { childList: true, subtree: true });
                setTimeout(_observeVcSpans, 800);
            })();
            // ── END FIX 10 ──
            (function smartStartup(){
                var _done=false;
                function _enterApp(ud,isAdmin){
                    if(_done)return;_done=true;
                    var am=document.getElementById('auth-modal-overlay');
                    if(am){am.classList.remove('show');am.style.display='none';}
                    document.body.classList.remove('modal-open');document.body.style.overflow='';
                    try{initializeApp(false,!!isAdmin,ud);}catch(e){setTimeout(function(){try{initializeApp(false,!!isAdmin,ud);}catch(e2){}},500);}
                    if(typeof _hideLoading==='function')_hideLoading();
                    try{var s=Object.assign({},ud);['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(function(k){if(s[k] instanceof Set)s[k]=[...s[k]];});delete s.password;localStorage.setItem('empyrean_session',JSON.stringify(s));}catch(e){}
                }
                function _guestMode(){
                    if(_done)return;_done=true;
                    try{initializeApp(true);}catch(e){setTimeout(function(){try{initializeApp(true);}catch(e2){}},500);}
                    if(typeof _hideLoading==='function')_hideLoading();
                    var am=document.getElementById('auth-modal-overlay');
                    if(am){am.classList.remove('show');am.style.display='none';}
                    document.body.classList.remove('modal-open');document.body.style.overflow='';
                    setTimeout(function(){
                        if(document.getElementById('guest-login-banner'))return;
                        var b=document.createElement('div');b.id='guest-login-banner';
                        b.style.cssText='position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#0A0E27,#1B2B8B);color:white;padding:12px 18px;border-radius:16px;box-shadow:0 8px 30px rgba(10,14,39,0.45);z-index:9990;display:flex;align-items:center;gap:10px;max-width:360px;width:90%;font-size:0.87rem;';
                        b.innerHTML='<span style="flex:1;"><i class="fas fa-hand-sparkles" style="color:#F5C518;margin-right:6px;"></i><strong>Welcome!</strong> Log in to unlock all features.</span>'
                            +'<button id="gbl-login" style="background:#F5C518;color:#0A0E27;border:none;border-radius:10px;padding:8px 14px;font-size:0.82rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">Log In</button>'
                            +'<button id="gbl-close" style="background:rgba(255,255,255,0.15);color:white;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:1rem;flex-shrink:0;"><i class=\"fas fa-times\"></i></button>';
                        document.body.appendChild(b);
                        document.getElementById('gbl-login').onclick=function(){
                            b.remove();var m=document.getElementById('auth-modal-overlay'),lv=document.getElementById('login-view');
                            if(m){m.style.display='flex';m.classList.add('show');}
                            if(lv)lv.style.display='block';
                            document.body.classList.add('modal-open');
                            setTimeout(function(){if(typeof generateCaptcha==='function')generateCaptcha();},150);
                        };
                        document.getElementById('gbl-close').onclick=function(){b.remove();};
                        setTimeout(function(){if(b.parentNode)b.remove();},9000);
                    },900);
                }
                // ── REFRESH FIX: restore localStorage session immediately BEFORE Firebase fires ──
                // Firebase onAuthStateChanged can take 1-4 seconds on slow networks (Lagos).
                // Without this, the 3-second fallback races Firebase and sometimes calls
                // _guestMode() even when a valid stored session exists.
                // Solution: check localStorage NOW synchronously, enter app immediately if
                // a valid session exists, and let onAuthStateChanged silently upgrade to
                // a Firebase-confirmed user if/when it fires.
                (function _tryImmediateSessionRestore(){
                    try{
                        var _s=null;
                        try{var _r=localStorage.getItem('empyrean_session');if(_r)_s=JSON.parse(_r);}catch(e){}
                        if(!_s){try{var _em=localStorage.getItem('empyrean_user_email');var _lu=JSON.parse(localStorage.getItem('empyrean_users')||'{}');if(_em&&_lu[_em])_s=_lu[_em];}catch(e){}}
                        if(_s&&_s.id&&!_done){
                            console.log('[Session] Restoring stored session immediately for:',_s.email||_s.id);
                            _enterApp(_s,_s.email==='chiefadmin@empyreanhumanitarianfoundation.com');
                        }
                    }catch(e){}
                })();
                if(window._firebaseLoaded&&window.fbAuth&&typeof window.fbAuth.onAuthStateChanged==='function'){
                    window.fbAuth.onAuthStateChanged(function(fbUser){
                        if(fbUser&&fbUser.uid){
                            // Firebase confirmed user -- upgrade/refresh session (even if _done already)
                            (async function(){
                                try{var doc=await window.fbDb.collection('users').doc(fbUser.uid).get();var profile=doc&&doc.exists?doc.data():null;var ud=profile||{id:fbUser.uid,email:fbUser.email,fullName:fbUser.displayName||'',avatar:fbUser.photoURL||''};
                                if(!_done){_enterApp(ud,fbUser.email==='chiefadmin@empyreanhumanitarianfoundation.com');}
                                else{
                                    // Already entered via localStorage -- refresh userState data.
                                    // FIX: this previously only wrote to localStorage and never
                                    // touched the live in-memory userState, so a session that
                                    // entered with a stale/local id (e.g. "local-<timestamp>")
                                    // never got upgraded to the real Firebase UID in memory --
                                    // causing senderId/receiverId on Firestore writes to mismatch
                                    // request.auth.uid and get rejected by security rules
                                    // ("Missing or insufficient permissions").
                                    try{var _us=Object.assign({},ud);['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(function(k){if(_us[k] instanceof Set)_us[k]=[..._us[k]];});delete _us.password;localStorage.setItem('empyrean_session',JSON.stringify(_us));}catch(e){}
                                    try{
                                        var _liveState=(window.EmpState&&window.EmpState.userState)||window.userState;
                                        if(_liveState&&fbUser&&fbUser.uid&&_liveState.id!==fbUser.uid){
                                            Object.assign(_liveState,ud);
                                            _liveState.id=fbUser.uid;
                                            if(window.EmpState&&window.EmpState.userState!==_liveState)window.EmpState.userState=_liveState;
                                            window.userState=_liveState;
                                            console.log('[Session] In-memory userState.id upgraded to Firebase UID:',fbUser.uid);
                                        }
                                    }catch(e){}
                                }
                                }
                                catch(e){if(!_done)_enterApp({id:fbUser.uid,email:fbUser.email,fullName:fbUser.displayName||''},false);}
                            })();
                        } else if(!_done) {
                            // Firebase says no user -- only go guest if localStorage also has nothing
                            var stored=null;
                            try{var r=localStorage.getItem('empyrean_session');if(r)stored=JSON.parse(r);}catch(e){}
                            if(!stored){try{var em=localStorage.getItem('empyrean_user_email');var lu=JSON.parse(localStorage.getItem('empyrean_users')||'{}');if(em&&lu[em])stored=lu[em];}catch(e){}}
                            if(stored&&stored.id)_enterApp(stored,stored.email==='chiefadmin@empyreanhumanitarianfoundation.com');
                            else _guestMode();
                        }
                    });
                    // Extended safety-net: 6s (was 3s) to handle slow Firebase SDK on mobile networks
                    setTimeout(function(){if(_done)return;var stored=null;try{var r2=localStorage.getItem('empyrean_session');if(r2)stored=JSON.parse(r2);}catch(e){}if(stored&&stored.id)_enterApp(stored,stored.email==='chiefadmin@empyreanhumanitarianfoundation.com');else _guestMode();},6000);
                } else {
                    var s2=null;try{var r3=localStorage.getItem('empyrean_session');if(r3)s2=JSON.parse(r3);}catch(e){}
                    if(!s2){try{var em2=localStorage.getItem('empyrean_user_email');var lu2=JSON.parse(localStorage.getItem('empyrean_users')||'{}');if(em2&&lu2[em2])s2=lu2[em2];}catch(e){}}
                    if(s2&&s2.id)_enterApp(s2,s2.email==='chiefadmin@empyreanhumanitarianfoundation.com');
                    else setTimeout(function(){if(!_done)_guestMode();},2000);
                }
            })();
            setInterval(simulateRewardAccrual, 1000);



            // =====================================================
            // CLOUDINARY: Upload media before any form submission
            // =====================================================
            document.body.addEventListener('submit', async function(e) {
                const form = e.target;
                const mediaMap = {
                    'post-form': typeof postMediaFiles !== 'undefined' ? postMediaFiles : [],
                    'business-post-form': typeof businessPostMediaFiles !== 'undefined' ? businessPostMediaFiles : [],
                    'sos-form': typeof sosMediaFiles !== 'undefined' ? sosMediaFiles : [],
                    'report-crisis-form': typeof crisisMediaFiles !== 'undefined' ? crisisMediaFiles : []
                };
                if (mediaMap[form.id]) {
                    const toUpload = mediaMap[form.id].filter(f => f instanceof File && !f._cloudUrl);
                    if (toUpload.length > 0) {
                        showNotification('Uploading media to cloud...', 'info');
                        try {
                            await window.uploadMediaFilesToCloudinary(toUpload);
                        } catch(uploadErr) {
                            console.warn('[PreUpload] Media upload failed:', uploadErr.message);
                            showNotification('⚠ Media upload failed — submission will continue without media.', 'warning');
                        }
                    }
                }
            }, true);

            // Firebase auth observer -- upgrades session when user is logged in
            try {
                fbAuth.onAuthStateChanged(async (fbUser) => {
                    if (fbUser && !fbUser.isAnonymous) {
                        try {
                            let firestoreUser = await loadUserFromFirestore(fbUser.uid);
                            // If profile doesn't exist in Firestore yet (new signup),
                            // build a minimal profile from Firebase Auth data
                            if (!firestoreUser) {
                                firestoreUser = {
                                    id: fbUser.uid,
                                    email: fbUser.email || '',
                                    fullName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'User'),
                                    username: fbUser.email ? fbUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g,'') : 'user' + fbUser.uid.slice(-4),
                                    avatar: fbUser.photoURL || '',
                                    coverPhoto: '',
                                    bio: '',
                                    empyBalance: 0,
                                    isVerified: false,
                                    followerCount: 0,
                                    likedPostIds: new Set(),
                                    followedUserIds: new Set(),
                                    retweetedPostIds: new Set(),
                                    awardedRanks: new Set(),
                                    completedTasks: new Set(),
                                    viewedStatusUserIds: new Set(),
                                    statuses: [],
                                    businessPage: null,
                                    createdAt: new Date().toISOString()
                                };
                                // Save the minimal profile to Firestore so future logins find it
                                try { await saveUserToFirestore(fbUser.uid, firestoreUser); } catch(e) {}
                                console.log('[Auth] New user -- created minimal Firestore profile for:', fbUser.uid);
                            }
                            if (firestoreUser) {
                                firestoreUser.id = fbUser.uid;
                                if (firestoreUser.email) registeredUsers[firestoreUser.email] = firestoreUser;
                                const CHIEF_ADMIN = 'chiefadmin@empyreanhumanitarianfoundation.com';
                                const isAdminUser = firestoreUser.email === 'admin@empyrean.com'
                                    || firestoreUser.email === CHIEF_ADMIN;
                                initializeApp(false, isAdminUser, firestoreUser);

                                // START ALL REAL-TIME LISTENERS -- after auth confirmed
                                window._postsListener          = null;
                                window._newsListener           = null;
                                window._newsListenerActive     = false; // allow app-news.js to restart
                                window._mktListener            = null;
                                window._reelsListener          = null;
                                window._usersListener          = null;
                                window._sosListener            = null;
                                window._crisisListener         = null;
                                window._statusesListener       = null;
                                window._ownStatusFetched       = false;
                                window._announcementsListener  = null;
                                // Reset suggested-users fetch so they reload for new user
                                window._suggestedFetchDone        = false;
                                window._firestoreSuggestedUsers   = null;

                                // Short delay so initializeApp() DOM setup completes first
                                setTimeout(function() {
                                    console.log('[Auth] ✅ User confirmed (' + (firestoreUser.fullName||firestoreUser.email||'user') + ') -- starting authenticated real-time listeners');

                                    // Start Firestore real-time listeners (posts, news, marketplace, reels)
                                    if (typeof window._startRealtimeListeners === 'function') {
                                        window._startRealtimeListeners();
                                    }
                                    // Start live stream listener
                                    if (typeof window.startLiveStreamListener === 'function') {
                                        window.startLiveStreamListener();
                                    }
                                    // Load bell notifications (including SOS rejections from Firestore)
                                    if (typeof window.loadUserNotifications === 'function') {
                                        window.loadUserNotifications();
                                    }
                                    // Subscribe to user_notifications for real-time dashboard updates
                                    if (window.fbDb && window._firebaseLoaded && firestoreUser.id) {
                                        window.fbDb.collection('user_notifications')
                                            .where('userId', '==', firestoreUser.id)
                                            .where('read', '==', false)
                                            .orderBy('createdAt', 'desc').limit(20)
                                            .onSnapshot(function(snap) {
                                                if (!snap) return;
                                                snap.docChanges().forEach(function(change) {
                                                    if (change.type !== 'added') return;
                                                    var n = change.doc.data();
                                                    if (!n) return;
                                                    if (typeof showNotification === 'function')
                                                        showNotification(n.message, n.type === 'sos_rejected' ? 'error' : (n.type || 'info'));
                                                    var badge = document.getElementById('notif-badge') || document.querySelector('.notif-count');
                                                    if (badge) { badge.textContent = (parseInt(badge.textContent) || 0) + 1; badge.style.display = 'inline-flex'; }
                                                    try { change.doc.ref.update({ read: true }); } catch(e) {}
                                                });
                                            }, function(err) { console.warn('[Notifications] Listener error:', err.message); });
                                    }
                                }, 800);
                            }
                        } catch(e) { console.error('[Auth] State error:', e.message); }
                    } else {
                        // FIX Bug 7: No Firebase user -- check localStorage session before going guest
                        try {
                            var sessionEmail = localStorage.getItem('empyrean_session_email') || '';
                            if (sessionEmail) {
                                var stored = JSON.parse(localStorage.getItem('empyrean_users') || '{}');
                                var storedUser = stored[sessionEmail];
                                if (storedUser && !window._initAppRunning) {
                                    ['likedPostIds','followedUserIds','retweetedPostIds','awardedRanks','completedTasks','viewedStatusUserIds'].forEach(function(k) {
                                        storedUser[k] = new Set(Array.isArray(storedUser[k]) ? storedUser[k] : []);
                                    });
                                    if (!storedUser.statuses) storedUser.statuses = [];
                                    console.log('[Auth] Restoring localStorage session for:', sessionEmail);
                                    initializeApp(false, storedUser.email === 'admin@empyrean.com' || storedUser.email === 'chiefadmin@empyreanhumanitarianfoundation.com', storedUser);
                                    setTimeout(function() {
                                        if (typeof window._startRealtimeListeners === 'function') window._startRealtimeListeners();
                                        if (typeof window.startLiveStreamListener === 'function') window.startLiveStreamListener();
                                    }, 600);
                                    return;
                                }
                            }
                        } catch(e) {}
                        // Truly no session -- load as guest
                        if (!window._initAppRunning) {
                            console.log('[Auth] No user session -- initialising as guest');
                            initializeApp(true);
                        }
                    }
                });
            } catch(e) { console.warn('Firebase auth observer failed:', e.message); }

            // =====================================================
            // FIX: STOP VIDEO ON REEL/LIVE EXIT
            // =====================================================
            document.addEventListener('click', function(e) {
                // Stop reel viewer videos on close
                if (e.target.classList.contains('reel-viewer-close') || e.target.closest('.reel-viewer-close')) {
                    document.querySelectorAll('#reel-viewer-container video').forEach(v => { v.pause(); v.currentTime = 0; });
                }
            });

            // =====================================================
            // FIX: MARKETPLACE CURRENCY SELECTOR
            // =====================================================
            const itemCurrencySelect = document.getElementById('item-currency');
            const itemPriceInput = document.getElementById('item-price');
            if (itemCurrencySelect) {
                itemCurrencySelect.addEventListener('change', function() {
                    const currency = this.value;
                    const priceLabel = document.querySelector('label[for="item-price"]');
                    if (priceLabel) priceLabel.textContent = `Price (${currency})`;
                });
            }

            // =====================================================
            // FIX: PROFILE PICTURE PROPAGATION
            // Whenever userState.avatar changes, update all avatar elements in UI
            // =====================================================
            function propagateProfilePicture() {
                if (!userState || !userState.avatar) return;
                const avatarSrc = userState.avatar;
                // Update sidebar footer avatar immediately
                const sidebarFooterAvatar = document.getElementById('sidebar-user-avatar');
                if (sidebarFooterAvatar) sidebarFooterAvatar.src = avatarSrc;
                // Update all avatar placeholders that belong to current user
                document.querySelectorAll('.user-own-avatar').forEach(el => {
                    if (el.tagName === 'IMG') el.src = avatarSrc;
                    else el.style.backgroundImage = `url('${avatarSrc}')`;
                });
                // Update live stream host avatar if current user is hosting
                if (liveStreamData.hostUserId === userState.id) {
                    const liveHostAvatar = document.getElementById('live-host-avatar');
                    const liveStreamHostAvatar = document.getElementById('live-stream-host-avatar');
                    if (liveHostAvatar) liveHostAvatar.src = avatarSrc;
                    if (liveStreamHostAvatar) liveStreamHostAvatar.src = avatarSrc;
                }
                // Update sidebar user avatar if exists
                const sidebarAvatar = document.querySelector('.sidebar-user-avatar');
                if (sidebarAvatar) sidebarAvatar.src = avatarSrc;
            }

            // Patch profile-info-form submit to also propagate
            const origProfileForm = document.getElementById('profile-info-form');
            if (origProfileForm) {
                origProfileForm.addEventListener('submit', function() {
                    setTimeout(propagateProfilePicture, 100);
                });
            }

            // =====================================================
            // LIVE GIFT SIDE-TAB: Render quick gift items
            // =====================================================

            // Gift animation helper
            function triggerGiftAnimation(symbol) {
                const layer = document.getElementById('gift-animation-layer');
                if (!layer) return;
                const el = document.createElement('div');
                el.textContent = symbol;
                el.style.cssText = `
                    position:absolute; bottom:80px; left:${20 + Math.random()*60}%;
                    font-size:2.5rem; z-index:10; pointer-events:none;
                    animation: giftFloat 2s ease-out forwards;
                `;
                layer.appendChild(el);
                setTimeout(() => el.remove(), 2100);
            }

            // Add gift float keyframe
            if (!document.getElementById('gift-keyframe-style')) {
                const ks = document.createElement('style');
                ks.id = 'gift-keyframe-style';
                ks.textContent = `@keyframes giftFloat { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(-120px) scale(1.5); } }`;
                document.head.appendChild(ks);
            }

            // Show side-tab when live modal opens
            const goLiveModalObs = document.getElementById('go-live-modal-overlay');
            if (goLiveModalObs) {
                const observer = new MutationObserver(() => {
                    const sideTab = document.getElementById('live-gift-side-tab');
                    if (goLiveModalObs.classList.contains('show')) {
                        renderGiftSideTab();
                        if (sideTab) sideTab.style.display = 'flex';
                    } else {
                        if (sideTab) sideTab.style.display = 'none';
                    }
                });
                observer.observe(goLiveModalObs, { attributes: true, attributeFilter: ['class'] });
            }

            // "All Gifts" tab button → open full catalog
            document.getElementById('live-gift-all-btn')?.addEventListener('click', function() {
                const catalog = document.getElementById('live-gift-catalog-modal');
                if (catalog) catalog.classList.add('show');
            });

            // =====================================================
            // DISPUTE MANAGEMENT SYSTEM (Admin + Members)
            // =====================================================
            let mockDisputes = [
                {
                    id: 'DP-001', status: 'open',
                    item: '3 Bedroom Flat, Lekki', itemId: 'prop-3',
                    buyerUsername: 'samuel_okoro', buyerId: 'user-2',
                    sellerUsername: 'seller', sellerId: 'user-1',
                    amount: '$250,000', currency: 'USD',
                    reason: 'Property was not as described. Photos showed full furnishing but arrived unfurnished.',
                    evidence: ['https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=400', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400'],
                    chats: [
                        { role: 'member', sender: 'samuel_okoro', text: 'I raised this dispute because the property was misrepresented in the listing.', ts: '2025-08-01 10:22' },
                        { role: 'member', sender: 'seller', text: 'The furnishing was optional. I communicated this before the sale.', ts: '2025-08-01 11:05' }
                    ],
                    date: '2025-08-01'
                },
                {
                    id: 'DP-002', status: 'pending',
                    item: 'Toyota Camry 2018', itemId: 'prop-4',
                    buyerUsername: 'NairobiVibes', buyerId: 'user-3',
                    sellerUsername: 'CiromaCars', sellerId: 'user-ciroma',
                    amount: '$18,000', currency: 'USD',
                    reason: 'Car has hidden mechanical faults not disclosed by seller. Engine light came on within 2 days.',
                    evidence: [],
                    chats: [
                        { role: 'member', sender: 'NairobiVibes', text: 'The car was sold with undisclosed faults. Requesting full refund.', ts: '2025-08-03 09:15' }
                    ],
                    date: '2025-08-03'
                },
                {
                    id: 'DP-003', status: 'resolved',
                    item: 'MacBook Pro Listing', itemId: 'prop-mac',
                    buyerUsername: 'KanoConnect', buyerId: 'user-1',
                    sellerUsername: 'TechSeller_NG', sellerId: 'user-tech',
                    amount: '$1,200', currency: 'USD',
                    reason: 'Item never delivered within agreed timeframe.',
                    evidence: [],
                    chats: [
                        { role: 'member', sender: 'KanoConnect', text: 'I paid but the item was never shipped.', ts: '2025-07-28 14:00' },
                        { role: 'admin', sender: 'Admin', text: 'After review, we have refunded the buyer in full. Case closed.', ts: '2025-07-29 10:30' }
                    ],
                    date: '2025-07-28'
                }
            ];

            let mockComplaints = [
                {
                    id: 'CMP-001', status: 'unread',
                    userId: 'user-2', username: 'samuel_okoro',
                    category: 'payment', subject: 'Withdrawal stuck for 5 days',
                    detail: 'I submitted a withdrawal request 5 days ago for 1,500 EMPY but it still shows pending. Please resolve urgently.',
                    evidence: [], date: '2025-08-05 09:12',
                    replies: []
                },
                {
                    id: 'CMP-002', status: 'read',
                    userId: 'user-3', username: 'NairobiVibes',
                    category: 'account', subject: 'KYC verification stuck',
                    detail: 'My KYC documents were submitted 2 weeks ago but verification is still pending. I am unable to use escrow features.',
                    evidence: [], date: '2025-08-03 15:44',
                    replies: [
                        { role: 'admin', sender: 'Admin', text: 'We are reviewing your KYC documents. Please allow 2-3 more business days.', ts: '2025-08-04 09:00' }
                    ]
                }
            ];

            let activeDisputeId = null;
            let activeComplaintId = null;

            function renderAdminDisputeQueue() {
                const container = document.getElementById('admin-dispute-queue');
                if (!container) return;
                if (!mockDisputes.length) {
                    container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No active disputes.</p>';
                    return;
                }
                container.innerHTML = mockDisputes.map(d => `
                    <div class="dispute-card status-${d.status}" data-dispute-id="${d.id}">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                            <div>
                                <strong style="color:var(--primary-color); font-size:1rem;">${d.id} -- ${d.item}</strong>
                                <span class="dispute-status-badge ${d.status}" style="margin-left:10px;">${d.status.toUpperCase()}</span>
                            </div>
                            <span style="font-size:0.82rem; color:#888;">${d.date}</span>
                        </div>
                        <div class="dispute-meta">
                            <span><i class="fas fa-user"></i> Buyer: @${d.buyerUsername}</span>
                            <span><i class="fas fa-store"></i> Seller: @${d.sellerUsername}</span>
                            <span><i class="fas fa-dollar-sign"></i> ${d.amount}</span>
                            <span><i class="fas fa-comment-dots"></i> ${d.chats.length} message(s)</span>
                        </div>
                        <p style="font-size:0.9rem; color:#555; margin-bottom:10px;"><em>${d.reason.substring(0, 120)}${d.reason.length > 120 ? '…' : ''}</em></p>
                        <div class="dispute-actions">
                            <button class="btn btn-small review-dispute-btn" data-dispute-id="${d.id}"><i class="fas fa-search"></i> Review Case</button>
                            ${d.status !== 'resolved' ? `
                                <button class="btn btn-small btn-success resolve-refund-quick-btn" data-dispute-id="${d.id}"><i class="fas fa-undo"></i> Refund Buyer</button>
                                <button class="btn btn-small btn-accent resolve-release-quick-btn" data-dispute-id="${d.id}"><i class="fas fa-check"></i> Release Funds</button>
                            ` : `<span style="color:var(--success-color); font-size:0.85rem;"><i class="fas fa-check-circle"></i> Resolved</span>`}
                        </div>
                    </div>
                `).join('');

                // Bind review buttons
                container.querySelectorAll('.review-dispute-btn').forEach(btn => {
                    btn.addEventListener('click', function() { openDisputeModal(this.dataset.disputeId); });
                });
                container.querySelectorAll('.resolve-refund-quick-btn').forEach(btn => {
                    btn.addEventListener('click', function() { resolveDispute(this.dataset.disputeId, 'refund'); });
                });
                container.querySelectorAll('.resolve-release-quick-btn').forEach(btn => {
                    btn.addEventListener('click', function() { resolveDispute(this.dataset.disputeId, 'release'); });
                });
            }

            function openDisputeModal(disputeId) {
                const d = mockDisputes.find(x => x.id === disputeId);
                if (!d) return;
                activeDisputeId = disputeId;

                const modal = document.getElementById('dispute-detail-modal');
                const title = document.getElementById('dispute-modal-title');
                const body = document.getElementById('dispute-modal-body');
                const thread = document.getElementById('dispute-chat-thread');

                if (title) title.innerHTML = `<i class="fas fa-gavel"></i> Dispute ${d.id} -- <span class="dispute-status-badge ${d.status}">${d.status.toUpperCase()}</span>`;

                if (body) {
                    body.innerHTML = `
                        <div class="dispute-meta" style="font-size:0.9rem; margin-bottom:15px;">
                            <span><strong>Item:</strong> ${d.item}</span>
                            <span><strong>Amount:</strong> ${d.amount}</span>
                            <span><strong>Date:</strong> ${d.date}</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                            <div style="background:#fff8e1; padding:12px; border-radius:8px; border-left:3px solid var(--accent-color);">
                                <strong><i class="fas fa-user"></i> Buyer</strong><br>@${d.buyerUsername}
                            </div>
                            <div style="background:#f3e5f5; padding:12px; border-radius:8px; border-left:3px solid var(--secondary-color);">
                                <strong><i class="fas fa-store"></i> Seller</strong><br>@${d.sellerUsername}
                            </div>
                        </div>
                        <div style="background:#ffebee; padding:12px; border-radius:8px; margin-bottom:15px; border-left:3px solid var(--danger-color);">
                            <strong><i class="fas fa-exclamation-triangle"></i> Dispute Reason:</strong>
                            <p style="margin-top:8px;">${d.reason}</p>
                        </div>
                        ${d.evidence.length ? `
                            <div style="margin-bottom:15px;">
                                <strong><i class="fas fa-paperclip"></i> Uploaded Evidence:</strong>
                                <div class="dispute-evidence-grid" style="margin-top:10px;">
                                    ${d.evidence.map(src => `<img src="${src}" alt="Evidence" onclick="window.open('${src}','_blank')">`).join('')}
                                </div>
                            </div>` : '<p style="color:#888; font-size:0.85rem; margin-bottom:15px;"><i class="fas fa-image"></i> No evidence uploaded.</p>'}
                    `;
                }

                if (thread) {
                    thread.innerHTML = `<strong style="margin-bottom:10px; display:block;"><i class="fas fa-comments"></i> Dispute Chat Thread</strong>` +
                        (d.chats.length ? d.chats.map(c => `
                            <div class="dispute-chat-bubble ${c.role}" style="margin-bottom:10px;">
                                <div class="sender">@${c.sender}</div>
                                <div>${c.text}</div>
                                <div class="ts">${c.ts}</div>
                            </div>
                        `).join('') : '<p style="color:#888; text-align:center; padding:10px;">No messages yet.</p>');
                }

                // Show/hide admin reply section
                const replySection = document.getElementById('dispute-admin-reply-section');
                if (replySection) replySection.style.display = d.status === 'resolved' ? 'none' : 'block';

                modal.classList.add('show');
                document.body.classList.add('modal-open');
            }

            function resolveDispute(disputeId, resolution) {
                const d = mockDisputes.find(x => x.id === disputeId);
                if (!d || d.status === 'resolved') return;
                d.status = 'resolved';
                const resText = resolution === 'refund'
                    ? `After thorough review, we have refunded the buyer (${d.buyerUsername}) in full. The seller (${d.sellerUsername}) has been notified.`
                    : `After thorough review, escrow funds have been released to the seller (${d.sellerUsername}). Case closed.`;
                d.chats.push({ role: 'admin', sender: 'Admin', text: resText, ts: new Date().toLocaleString() });
                renderAdminDisputeQueue();
                updateAdminStats();
                showNotification(`Dispute ${disputeId} resolved: ${resolution === 'refund' ? 'Buyer refunded' : 'Funds released to seller'}.`, 'success');
                const modal = document.getElementById('dispute-detail-modal');
                if (modal) modal.classList.remove('show');
                document.body.classList.remove('modal-open');
            }

            // Admin Reply Buttons
            document.getElementById('dispute-resolve-refund-btn')?.addEventListener('click', function() {
                if (activeDisputeId) resolveDispute(activeDisputeId, 'refund');
            });
            document.getElementById('dispute-resolve-release-btn')?.addEventListener('click', function() {
                if (activeDisputeId) resolveDispute(activeDisputeId, 'release');
            });
            document.getElementById('dispute-send-reply-btn')?.addEventListener('click', function() {
                const replyText = document.getElementById('dispute-admin-reply-text')?.value?.trim();
                if (!replyText) { showNotification("Please type a reply message.", "warning"); return; }
                const d = mockDisputes.find(x => x.id === activeDisputeId);
                if (!d) return;
                d.chats.push({ role: 'admin', sender: 'Admin', text: replyText, ts: new Date().toLocaleString() });
                document.getElementById('dispute-admin-reply-text').value = '';
                openDisputeModal(activeDisputeId); // refresh modal
                showNotification("Reply sent to both parties.", "success");
            });

            // =====================================================
            // COMPLAINTS INBOX (Admin view)
            // =====================================================
            function renderComplaintsInbox() {
                const container = document.getElementById('admin-complaints-inbox');
                if (!container) return;
                if (!mockComplaints.length) {
                    container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No complaints yet.</p>';
                    return;
                }
                container.innerHTML = mockComplaints.map(c => `
                    <div class="complaint-card ${c.status}" style="padding:15px 20px; cursor:pointer;" data-complaint-id="${c.id}">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div class="complaint-subject">${c.subject}</div>
                            <span style="font-size:0.8rem; background:${c.status === 'unread' ? 'var(--danger-color)' : '#e0e0e0'}; color:${c.status === 'unread' ? 'white' : '#555'}; padding:2px 10px; border-radius:12px;">${c.status === 'unread' ? 'NEW' : 'READ'}</span>
                        </div>
                        <div class="complaint-meta"><i class="fas fa-tag"></i> ${c.category} &nbsp;|&nbsp; <i class="fas fa-user"></i> @${c.username} &nbsp;|&nbsp; <i class="fas fa-clock"></i> ${c.date}</div>
                        <div class="complaint-preview">${c.detail}</div>
                        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                            <button class="btn btn-small view-complaint-btn" data-complaint-id="${c.id}"><i class="fas fa-eye"></i> View & Reply</button>
                            ${c.replies.length ? `<span style="font-size:0.82rem; color:var(--success-color); align-self:center;"><i class="fas fa-check-circle"></i> ${c.replies.length} reply(s) sent</span>` : ''}
                        </div>
                    </div>
                `).join('');

                container.querySelectorAll('.view-complaint-btn').forEach(btn => {
                    btn.addEventListener('click', function() { openComplaintReplyModal(this.dataset.complaintId); });
                });
            }

            function openComplaintReplyModal(complaintId) {
                const c = mockComplaints.find(x => x.id === complaintId);
                if (!c) return;
                activeComplaintId = complaintId;
                c.status = 'read';
                renderComplaintsInbox();

                const modal = document.getElementById('dispute-detail-modal');
                const title = document.getElementById('dispute-modal-title');
                const body = document.getElementById('dispute-modal-body');
                const thread = document.getElementById('dispute-chat-thread');
                const replySection = document.getElementById('dispute-admin-reply-section');

                if (title) title.innerHTML = `<i class="fas fa-envelope-open-text"></i> Complaint ${c.id}`;
                if (body) {
                    body.innerHTML = `
                        <div class="dispute-meta" style="margin-bottom:15px;">
                            <span><strong>From:</strong> @${c.username}</span>
                            <span><strong>Category:</strong> ${c.category}</span>
                            <span><strong>Date:</strong> ${c.date}</span>
                        </div>
                        <div style="background:#fff8e1; padding:15px; border-radius:8px; border-left:3px solid var(--accent-color); margin-bottom:15px;">
                            <strong>${c.subject}</strong>
                            <p style="margin-top:8px;">${c.detail}</p>
                        </div>
                    `;
                }
                if (thread) {
                    thread.innerHTML = `<strong style="margin-bottom:10px; display:block;"><i class="fas fa-comments"></i> Conversation Thread</strong>` +
                        (c.replies.length ? c.replies.map(r => `
                            <div class="dispute-chat-bubble ${r.role}" style="margin-bottom:10px;">
                                <div class="sender">${r.sender}</div>
                                <div>${r.text}</div>
                                <div class="ts">${r.ts}</div>
                            </div>
                        `).join('') : '<p style="color:#888; text-align:center; padding:10px;">No replies yet.</p>');
                }
                // Override reply buttons to work with complaint
                if (replySection) {
                    replySection.style.display = 'block';
                    replySection.querySelector('h4').innerHTML = '<i class="fas fa-reply"></i> Reply to Member';
                    const resolveRefundBtn = document.getElementById('dispute-resolve-refund-btn');
                    const resolveReleaseBtn = document.getElementById('dispute-resolve-release-btn');
                    if (resolveRefundBtn) resolveRefundBtn.style.display = 'none';
                    if (resolveReleaseBtn) resolveReleaseBtn.style.display = 'none';
                }
                modal.classList.add('show');
                document.body.classList.add('modal-open');
            }

            // Override send-reply for complaints
            document.getElementById('dispute-send-reply-btn')?.addEventListener('click', function() {
                const replyText = document.getElementById('dispute-admin-reply-text')?.value?.trim();
                if (!replyText) { showNotification("Please type a reply.", "warning"); return; }

                // Check if it's a complaint or dispute
                const complaint = mockComplaints.find(x => x.id === activeComplaintId);
                if (complaint && activeComplaintId && !activeDisputeId) {
                    complaint.replies.push({ role: 'admin', sender: 'Admin', text: replyText, ts: new Date().toLocaleString() });
                    document.getElementById('dispute-admin-reply-text').value = '';
                    openComplaintReplyModal(activeComplaintId);
                    showNotification("Reply sent to member.", "success");
                }
            }, { capture: true });

            // =====================================================
            // MEMBER COMPLAINT FORM SUBMIT
            // =====================================================
            document.getElementById('complaint-form')?.addEventListener('submit', function(e) {
                e.preventDefault();
                if (isGuest) { showNotification("Please log in to submit a complaint.", "warning"); return; }
                const cat = document.getElementById('complaint-category')?.value;
                const subject = document.getElementById('complaint-subject')?.value?.trim();
                const detail = document.getElementById('complaint-detail')?.value?.trim();
                if (!cat || !subject || !detail) { showNotification("Please fill all required fields.", "error"); return; }

                const newComplaint = {
                    id: `CMP-${Date.now()}`,
                    status: 'unread',
                    userId: userState.id,
                    username: userState.username,
                    category: cat,
                    subject: subject,
                    detail: detail,
                    evidence: [],
                    date: new Date().toLocaleString(),
                    replies: []
                };
                mockComplaints.unshift(newComplaint);
                if (isAdmin) renderComplaintsInbox();

                const fb = document.getElementById('complaint-form-feedback');
                if (fb) { fb.className = 'form-feedback success'; fb.style.display = 'block'; fb.textContent = 'Your complaint has been submitted. Our team will respond within 24 hours.'; }
                this.reset();
                setTimeout(() => {
                    const modal = document.getElementById('submit-complaint-modal');
                    if (modal) modal.classList.remove('show');
                    document.body.classList.remove('modal-open');
                    if (fb) { fb.style.display = 'none'; }
                }, 2500);
            });

            // FAB complaint button visibility + click
            function updateComplaintFab() {
                const fab = document.getElementById('submit-complaint-fab');
                if (fab) fab.style.display = (!isGuest) ? 'flex' : 'none';
            }

            // Quick-post FAB: show on dashboard for ALL users, hide on other sections
            function updateQuickPostFab(targetId) {
                var qfab = document.getElementById('quick-post-fab');
                if (!qfab) return;
                var onDash = !targetId || targetId === 'dashboard';
                // Must use 'flex' (not 'block') to honour align-items/justify-content
                qfab.style.display = onDash ? 'flex' : 'none';
            }
            // Expose globally so navigateTo (defined earlier) can call it even after DOMContentLoaded
            window.updateQuickPostFab = updateQuickPostFab;

            document.getElementById('submit-complaint-fab')?.addEventListener('click', function() {
                const modal = document.getElementById('submit-complaint-modal');
                if (modal) { modal.classList.add('show'); document.body.classList.add('modal-open'); }
            });

            // Make the FAB draggable (touch + mouse) so it doesn't block content
            (function() {
                var fab = document.getElementById('submit-complaint-fab');
                if (!fab) return;
                var isDragging = false, startX, startY, startLeft, startTop, moved = false;

                function getPos(e) {
                    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                                     : { x: e.clientX, y: e.clientY };
                }
                function onStart(e) {
                    var p = getPos(e);
                    startX = p.x; startY = p.y;
                    var rect = fab.getBoundingClientRect();
                    startLeft = rect.left; startTop = rect.top;
                    isDragging = true; moved = false;
                    fab.style.transition = 'none';
                    fab.style.cursor = 'grabbing';
                    e.preventDefault();
                }
                function onMove(e) {
                    if (!isDragging) return;
                    var p = getPos(e);
                    var dx = p.x - startX, dy = p.y - startY;
                    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
                    var newLeft = Math.min(Math.max(0, startLeft + dx), window.innerWidth - 44);
                    var newTop = Math.min(Math.max(0, startTop + dy), window.innerHeight - 44);
                    fab.style.left = newLeft + 'px';
                    fab.style.top = newTop + 'px';
                    fab.style.right = 'auto';
                    fab.style.bottom = 'auto';
                    e.preventDefault();
                }
                function onEnd(e) {
                    if (!isDragging) return;
                    isDragging = false;
                    fab.style.cursor = 'grab';
                    fab.style.transition = 'box-shadow 0.2s, transform 0.2s';
                    // If barely moved, treat as a click → open modal
                    if (!moved) {
                        var modal = document.getElementById('submit-complaint-modal');
                        if (modal) { modal.classList.add('show'); document.body.classList.add('modal-open'); }
                    }
                }
                fab.addEventListener('mousedown', onStart, { passive: false });
                fab.addEventListener('touchstart', onStart, { passive: false });
                document.addEventListener('mousemove', onMove, { passive: false });
                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('mouseup', onEnd);
                document.addEventListener('touchend', onEnd);
                // Override the simple click handler added above (moved logic into onEnd)
                fab.onclick = function(e) { e.stopPropagation(); };
            })();

            // =====================================================
            // PATCH: renderAdminQueues -- extends original to include disputes + complaints
            // =====================================================
            (function() {
                var _origRAQ = renderAdminQueues;
                renderAdminQueues = function() {
                    _origRAQ();
                    try { renderAdminDisputeQueue(); } catch(e) {}
                    try { renderComplaintsInbox(); } catch(e) {}
                    try { updateAdminStats(); } catch(e) {}
                };
            })();

            function updateAdminStats() {
                const wdStat = document.getElementById('admin-stat-withdrawals');
                const dpStat = document.getElementById('admin-stat-disputes');
                const sosStat = document.getElementById('admin-stat-sos');
                if (wdStat) wdStat.textContent = mockAdminWithdrawalQueue.length;
                if (dpStat) dpStat.textContent = mockDisputes.filter(d => d.status !== 'resolved').length;
                if (sosStat) sosStat.textContent = mockAdminSosQueue.length;
            }

            // Run initial dispute/complaint render when admin logs in
            const _origInitApp = initializeApp;
            initializeApp = function patchedInitApp(isGuestMode, adminMode, userObj) {
                window.isAdmin = adminMode || false;
                window.isGuest = isGuestMode || false;
                _origInitApp(isGuestMode, adminMode, userObj);
                if (!isGuestMode) {
                    if (typeof updateComplaintFab === 'function') updateComplaintFab();
                    if (typeof updateQuickPostFab === 'function') updateQuickPostFab('dashboard');
                    if (adminMode) {
                        setTimeout(() => {
                            if (typeof renderAdminDisputeQueue === 'function') renderAdminDisputeQueue();
                            if (typeof renderComplaintsInbox === 'function') renderComplaintsInbox();
                            if (typeof updateAdminStats === 'function') updateAdminStats();
                        }, 500);
                    }
                    if (typeof propagateProfilePicture === 'function') propagateProfilePicture();
                }
            };

            // Close dispute modal when close button clicked
            document.getElementById('dispute-detail-modal')?.querySelector('.close-modal')?.addEventListener('click', function() {
                const modal = document.getElementById('dispute-detail-modal');
                if (modal) modal.classList.remove('show');
                document.body.classList.remove('modal-open');
                activeDisputeId = null;
                activeComplaintId = null;
                // Reset buttons
                const resolveRefundBtn = document.getElementById('dispute-resolve-refund-btn');
                const resolveReleaseBtn = document.getElementById('dispute-resolve-release-btn');
                if (resolveRefundBtn) resolveRefundBtn.style.display = '';
                if (resolveReleaseBtn) resolveReleaseBtn.style.display = '';
            });

            // Close submit-complaint modal
            document.getElementById('submit-complaint-modal')?.querySelector('.close-modal')?.addEventListener('click', function() {
                const modal = document.getElementById('submit-complaint-modal');
                if (modal) modal.classList.remove('show');
                document.body.classList.remove('modal-open');
            });

            // =====================================================
            // FIX: KYC FILE UPLOAD BUTTON (re-bind after DOM ready)
            // =====================================================
            function rebindKycUploads() {
                document.querySelectorAll('.kyc-file-upload').forEach(uploadArea => {
                    uploadArea.removeEventListener('click', uploadArea._kycHandler);
                    uploadArea._kycHandler = function() {
                        const inputId = this.dataset.inputId;
                        const fileInput = document.getElementById(inputId);
                        if (fileInput) {
                            fileInput.click();
                        } else {
                            // Create hidden file input dynamically if missing
                            const newInput = document.createElement('input');
                            newInput.type = 'file';
                            newInput.id = inputId;
                            newInput.accept = 'image/*';
                            newInput.style.display = 'none';
                            document.body.appendChild(newInput);
                            newInput.addEventListener('change', function() {
                                if (this.files[0]) {
                                    const url = URL.createObjectURL(this.files[0]);
                                    const preview = uploadArea.querySelector('img, .kyc-preview') || uploadArea;
                                    if (preview.tagName === 'IMG') preview.src = url;
                                    uploadArea.style.backgroundImage = `url('${url}')`;
                                    uploadArea.style.backgroundSize = 'cover';
                                    showNotification("Document uploaded successfully!", "success");
                                }
                            });
                            newInput.click();
                        }
                    };
                    uploadArea.addEventListener('click', uploadArea._kycHandler);
                });
            }
            rebindKycUploads();
            // Re-bind after any navigation
            document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => setTimeout(rebindKycUploads, 300)));

            // =====================================================
            // FIX: MARKETPLACE CURRENCY -- apply selected currency to price display
            // =====================================================
            const itemCurrencySel = document.getElementById('item-currency');
            if (itemCurrencySel) {
                itemCurrencySel.addEventListener('change', function() {
                    const currency = this.value;
                    // Update price label
                    const priceLabel = document.querySelector('label[for="item-price"]');
                    if (priceLabel) priceLabel.textContent = `Price (${currency})`;
                    // Update all currently listed prices if USD was selected by default
                    document.querySelectorAll('#property-grid-container .property-info div:last-child').forEach(el => {
                        const rawPrice = el.closest('.property-card')?.dataset?.price;
                        if (!rawPrice) return;
                        const p = parseFloat(rawPrice);
                        if (currency === 'NGN') el.textContent = `₦${(p * USD_TO_NGN_RATE).toLocaleString()}`;
                        else if (currency === 'USD') el.textContent = formatUsdPrice(p);
                        else if (currency === 'EMPY') el.textContent = `${(p / EMPY_RATE_USD).toLocaleString()} EMPY`;
                        else if (currency === 'GBP') el.textContent = `£${(p * 0.79).toLocaleString()}`;
                        else if (currency === 'EUR') el.textContent = `€${(p * 0.92).toLocaleString()}`;
                    });
                });
            }

            // Run on first admin panel render
            setTimeout(() => {
                if (isAdmin) {
                    renderAdminDisputeQueue();
                    renderComplaintsInbox();
                    updateAdminStats();
                }
                updateComplaintFab();
                if (typeof updateQuickPostFab === 'function') updateQuickPostFab('dashboard');
            }, 800);

            // =========================================================
            // ===  COMPREHENSIVE FIXES -- ALL 14 ITEMS  ================
            // =========================================================

            // ---------------------------------------------------------
            // FIX 11 (retry): Stop camera stream when leaving live
            // ---------------------------------------------------------
            (function() {
                const origLiveClose = document.getElementById('live-close-btn');
                // Patch via event delegation -- prepend camera stop to live close
                document.addEventListener('click', function(e) {
                    if (e.target.closest('#live-close-btn')) {
                        if (liveStreamData._localStream) {
                            liveStreamData._localStream.getTracks().forEach(t => t.stop());
                            liveStreamData._localStream = null;
                        }
                    }
                }, true); // capture phase so it runs before other handlers
            })();

            // ---------------------------------------------------------
            // ADMIN REGISTRATION MODAL
            // ---------------------------------------------------------
            function showAdminRegistrationModal() {
                var existing = document.getElementById('admin-reg-modal');
                if (existing) existing.remove();
                var modal = document.createElement('div');
                modal.id = 'admin-reg-modal';
                modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
                var verificationId = 'ADM-' + Math.random().toString(36).substr(2,5).toUpperCase() + '-' + Date.now().toString(36).toUpperCase().substr(-4);
                modal.innerHTML =
                    '<div style="background:white;border-radius:24px;padding:32px;width:min(440px,92vw);box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
                        '<div style="text-align:center;margin-bottom:24px;">' +
                            '<div style="background:linear-gradient(135deg,#5B0EA6,#1B2B8B);width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">' +
                                '<i class="fas fa-user-shield" style="color:white;font-size:1.5rem;"></i>' +
                            '</div>' +
                            '<h2 style="font-family:Syne,sans-serif;color:var(--primary);margin-bottom:6px;">Admin Registration</h2>' +
                            '<p style="font-size:0.85rem;color:var(--text-muted);">Complete your admin profile. Your unique Verification ID is shown below.</p>' +
                        '</div>' +
                        '<div style="background:rgba(91,14,166,0.08);border:2px solid rgba(91,14,166,0.2);border-radius:12px;padding:14px;text-align:center;margin-bottom:20px;">' +
                            '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">YOUR ADMIN VERIFICATION ID</div>' +
                            '<div id="admin-verif-id-display" style="font-size:1.4rem;font-weight:800;color:#5B0EA6;letter-spacing:2px;font-family:monospace;">' + verificationId + '</div>' +
                            '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">Save this ID -- you will need it to log in and for verification processes</div>' +
                        '</div>' +
                        '<div style="display:flex;flex-direction:column;gap:12px;">' +
                            '<input type="text" id="admin-reg-name" placeholder="Full Admin Name" style="width:100%;padding:11px 14px;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;font-size:0.9rem;outline:none;box-sizing:border-box;">' +
                            '<input type="email" id="admin-reg-email" placeholder="Admin Email Address" style="width:100%;padding:11px 14px;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;font-size:0.9rem;outline:none;box-sizing:border-box;">' +
                            '<input type="password" id="admin-reg-password" placeholder="Create Admin Password (min 8 chars)" style="width:100%;padding:11px 14px;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;font-size:0.9rem;outline:none;box-sizing:border-box;">' +
                        '</div>' +
                        '<div style="display:flex;gap:10px;margin-top:20px;">' +
                            '<button id="admin-reg-cancel" style="flex:1;padding:12px;border:1.5px solid rgba(10,14,39,0.12);background:white;border-radius:10px;cursor:pointer;font-weight:600;color:var(--text-muted);">Cancel</button>' +
                            '<button id="admin-reg-submit" style="flex:2;padding:12px;background:linear-gradient(135deg,#5B0EA6,#1B2B8B);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:0.92rem;">Complete Registration</button>' +
                        '</div>' +
                    '</div>';
                document.body.appendChild(modal);
                document.getElementById('admin-reg-cancel').onclick = function() {
                    modal.remove();
                    showNotification('Admin registration cancelled. No access granted.', 'info');
                };
                document.getElementById('admin-reg-submit').onclick = function() {
                    var name  = document.getElementById('admin-reg-name').value.trim();
                    var email = document.getElementById('admin-reg-email').value.trim();
                    var pass  = document.getElementById('admin-reg-password').value;
                    if (!name || !email || pass.length < 8) {
                        showNotification('Please fill all fields. Password must be at least 8 characters.', 'error');
                        return;
                    }
                    // Save admin registration
                    localStorage.setItem('empyrean_admin_verification_id', verificationId);
                    localStorage.setItem('empyrean_admin_name', name);
                    localStorage.setItem('empyrean_admin_email', email);
                    // Save to Firestore
                    try {
                        fbDb.collection('admin_registrations').doc(verificationId).set({
                            verificationId, name, email,
                            registeredAt: new Date().toISOString(),
                            role: 'admin'
                        });
                    } catch(e) {}
                    modal.remove();
                    initializeApp(false, true);
                    const authModal = document.getElementById('auth-modal-overlay');
                    if (authModal) authModal.classList.remove('show');
                    document.body.classList.remove('modal-open');
                    showNotification('✅ Admin registered! Your ID: ' + verificationId + ' -- keep it safe.', 'success');
                };
            }

            // ---------------------------------------------------------
            // FIX A: ADMIN LOGIN -- Email/password (replaces 4-digit PIN)
            // Chief admin: chiefadmin@empyreanhumanitarianfoundation.com
            // Trigger: 5 taps on sidebar footer  
            // ---------------------------------------------------------
            (function() {
                const CHIEF_ADMIN_EMAIL = 'chiefadmin@empyreanhumanitarianfoundation.com';
                let tapCount = 0, tapTimer = null;

                function showAdminLoginModal() {
                    var old = document.getElementById('admin-login-modal');
                    if (old) old.remove();
                    var modal = document.createElement('div');
                    modal.id = 'admin-login-modal';
                    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;';
                    modal.innerHTML =
                        '<div style="background:white;border-radius:24px;padding:32px;width:min(440px,92vw);box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
                            '<div style="text-align:center;margin-bottom:22px;">' +
                                '<div style="background:linear-gradient(135deg,#5B0EA6,#1B2B8B);width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">' +
                                    '<i class="fas fa-user-shield" style="color:white;font-size:1.4rem;"></i></div>' +
                                '<h2 style="font-family:Syne,sans-serif;color:#0A0E27;margin:0 0 4px;">Admin Access</h2>' +
                                '<p style="font-size:0.83rem;color:#6B7280;margin:0;">Sign in with your admin credentials</p>' +
                            '</div>' +
                            '<div style="display:flex;flex-direction:column;gap:10px;">' +
                                '<input type="email" id="adm-email" placeholder="Admin Email Address" autocomplete="email" ' +
                                    'style="width:100%;padding:11px 14px;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;font-size:0.9rem;outline:none;box-sizing:border-box;">' +
                                '<input type="password" id="adm-pass" placeholder="Admin Password" autocomplete="current-password" ' +
                                    'style="width:100%;padding:11px 14px;border:1.5px solid rgba(10,14,39,0.12);border-radius:10px;font-size:0.9rem;outline:none;box-sizing:border-box;">' +
                                '<div id="adm-err" style="color:#EF4444;font-size:0.82rem;min-height:16px;font-weight:600;"></div>' +
                            '</div>' +
                            '<div style="display:flex;gap:10px;margin-top:16px;">' +
                                '<button id="adm-cancel" style="flex:1;padding:11px;border:1.5px solid rgba(10,14,39,0.12);background:white;border-radius:10px;cursor:pointer;font-weight:600;color:#6B7280;">Cancel</button>' +
                                '<button id="adm-submit" style="flex:2;padding:11px;background:linear-gradient(135deg,#5B0EA6,#1B2B8B);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:0.92rem;">' +
                                    '<i class="fas fa-unlock"></i> Sign In as Admin</button>' +
                            '</div>' +
                            '<div style="text-align:center;margin-top:12px;">' +
                                '<a href="#" id="adm-reg-link" style="font-size:0.82rem;color:#5B0EA6;text-decoration:none;">New admin? Register here</a>' +
                            '</div>' +
                        '</div>';
                    document.body.appendChild(modal);

                    document.getElementById('adm-cancel').onclick = function() { modal.remove(); };
                    document.getElementById('adm-reg-link').onclick = function(ev) {
                        ev.preventDefault(); modal.remove();
                        if (typeof showAdminRegistrationModal === 'function') showAdminRegistrationModal();
                    };

                    document.getElementById('adm-submit').onclick = async function() {
                        var emailVal = (document.getElementById('adm-email').value || '').trim().toLowerCase();
                        var passVal  = document.getElementById('adm-pass').value || '';
                        var errEl    = document.getElementById('adm-err');
                        if (!emailVal || !passVal) { errEl.textContent = 'Please enter your email and password.'; return; }

                        this.disabled = true;
                        this.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verifying...';
                        errEl.textContent = '';
                        var granted = false;

                        if (emailVal === CHIEF_ADMIN_EMAIL) {
                            // Chief admin: first login sets the password
                            var stored = localStorage.getItem('empyrean_chief_admin_pass');
                            if (!stored) { localStorage.setItem('empyrean_chief_admin_pass', passVal); granted = true; }
                            else if (passVal === stored) { granted = true; }
                            else { errEl.textContent = 'Incorrect password for chief admin account.'; }
                        } else {
                            // Regular admins: verify via Firebase Auth + admin_registrations collection
                            try {
                                if (window._firebaseLoaded && window.fbAuth && typeof window.fbAuth.signInWithEmailAndPassword === 'function') {
                                    var result = await window.fbAuth.signInWithEmailAndPassword(emailVal, passVal);
                                    if (result && result.user) {
                                        var snap = await window.fbDb.collection('admin_registrations')
                                            .where('email', '==', emailVal).limit(1).get();
                                        if (!snap.empty) { granted = true; }
                                        else { errEl.textContent = 'This email is not registered as an admin.'; window.fbAuth.signOut().catch(function() {}); }
                                    }
                                } else {
                                    // Offline fallback: check locally stored admin credentials
                                    if (emailVal === localStorage.getItem('empyrean_admin_email') &&
                                        passVal  === localStorage.getItem('empyrean_admin_password')) {
                                        granted = true;
                                    } else { errEl.textContent = 'Cannot verify admin credentials offline.'; }
                                }
                            } catch(ae) {
                                if (ae.code === 'auth/wrong-password' || ae.code === 'auth/invalid-credential') errEl.textContent = 'Incorrect password.';
                                else if (ae.code === 'auth/user-not-found') errEl.textContent = 'No admin account found with this email.';
                                else errEl.textContent = 'Login error: ' + (ae.message || 'please try again.');
                            }
                        }

                        if (granted) {
                            modal.remove();
                            localStorage.setItem('empyrean_admin_email_session', emailVal);
                            initializeApp(false, true);
                            var authModal = document.getElementById('auth-modal-overlay');
                            if (authModal) authModal.classList.remove('show');
                            document.body.classList.remove('modal-open');
                            showNotification('🔐 Welcome! Admin access granted.', 'success');
                        } else {
                            this.disabled = false;
                            this.innerHTML = '<i class="fas fa-unlock"></i> Sign In as Admin';
                        }
                    };

                    // Enter key submits
                    ['adm-email', 'adm-pass'].forEach(function(id) {
                        var el = document.getElementById(id);
                        if (el) el.addEventListener('keydown', function(ev) {
                            if (ev.key === 'Enter') document.getElementById('adm-submit').click();
                        });
                    });
                    setTimeout(function() { var el = document.getElementById('adm-email'); if (el) el.focus(); }, 80);
                }

                window._showAdminLogin = showAdminLoginModal;

                function bindFooterTap() {
                    const footer = document.querySelector('.sidebar-footer');
                    if (!footer || footer._adminTapBound) return;
                    footer._adminTapBound = true;
                    footer.addEventListener('click', function(e) {
                        if (e.target.closest('a[href]') || e.target.closest('#login-signup-btn') || e.target.closest('#logout-btn')) return;
                        tapCount++;
                        clearTimeout(tapTimer);
                        tapTimer = setTimeout(function() { tapCount = 0; }, 2000);
                        if (tapCount >= 5) { tapCount = 0; showAdminLoginModal(); }
                    });
                }

                const _origBuildSidebar = buildSidebar;
                buildSidebar = function() {
                    _origBuildSidebar.apply(this, arguments);
                    setTimeout(bindFooterTap, 150);
                };
                setTimeout(bindFooterTap, 600);

                // Auto-detect chief admin on Firebase login
                document.addEventListener('empyrean-init-done', function() {
                    if (window.userState && window.userState.email &&
                        window.userState.email.toLowerCase() === CHIEF_ADMIN_EMAIL && !isAdmin) {
                        isAdmin = true;
                        window.isAdmin = true;
                        buildSidebar();
                        showNotification('🔐 Chief Admin access detected.', 'success');
                    }
                });
            })();

            // ---------------------------------------------------------
            // FIX B: KYC UPLOAD -- proper file input + live camera capture
            // ---------------------------------------------------------
            (function() {
                let _kycCameraBtn = null;
                let _kycCameraStream = null;


                function simulateSelfie(btn) {
                    if (!btn) return;
                    const previewId = btn.id.replace('-btn', '-preview');
                    const previewEl = document.getElementById(previewId);
                    const name = (typeof userState !== 'undefined' && userState.fullName) ? userState.fullName : 'User';
                    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4A148C&color=fff&size=100`;
                    if (previewEl) previewEl.innerHTML = `<img src="${avatarUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:2px solid var(--success-color);margin-top:6px;">`;
                    btn.dataset.captured = 'true';
                    btn.style.background = 'var(--success-color)';
                    btn.innerHTML = '<i class="fas fa-check"></i> Selfie Captured';
                    if (!window._kycSubmissions) window._kycSubmissions = {};
                    window._kycSubmissions[btn.id] = { selfie: avatarUrl };
                    renderAdminKycDocs();
                    showNotification('Camera unavailable -- placeholder selfie used.', 'warning');
                }

                // Camera snap button
                document.getElementById('kyc-capture-snap-btn')?.addEventListener('click', async function() {
                    const video = document.getElementById('kyc-camera-video');
                    const canvas = document.getElementById('kyc-camera-canvas');
                    if (!video || !canvas) return;
                    canvas.width = video.videoWidth || 480;
                    canvas.height = video.videoHeight || 360;
                    canvas.getContext('2d').drawImage(video, 0, 0);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                    if (_kycCameraStream) { _kycCameraStream.getTracks().forEach(t => t.stop()); _kycCameraStream = null; }
                    document.getElementById('kyc-camera-modal').classList.remove('show');
                    if (_kycCameraBtn) {
                        const previewId = _kycCameraBtn.id.replace('-btn', '-preview');
                        const previewEl = document.getElementById(previewId);
                        // Show captured image immediately
                        if (previewEl) previewEl.innerHTML = `<img src="${dataUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:2px solid var(--success-color);margin-top:6px;">`;
                        _kycCameraBtn.dataset.captured = 'true';
                        _kycCameraBtn.style.background = 'var(--success-color)';
                        _kycCameraBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Uploading...';
                        if (!window._kycSubmissions) window._kycSubmissions = {};
                        window._kycSubmissions[_kycCameraBtn.id] = { selfie: dataUrl, cloudUrl: null };
                        renderAdminKycDocs();
                        // Upload selfie to Cloudinary
                        try {
                            const res = await fetch(dataUrl);
                            const blob = await res.blob();
                            const selfieFile = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
                            const cloudUrl = await window.uploadToCloudinary(selfieFile, null);
                            // Update preview with Cloudinary URL
                            if (previewEl) previewEl.innerHTML = `<img src="${cloudUrl}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:2px solid var(--success-color);margin-top:6px;">`;
                            _kycCameraBtn.innerHTML = '<i class="fas fa-check-circle"></i> Selfie Captured';
                            window._kycSubmissions[_kycCameraBtn.id] = { selfie: cloudUrl, cloudUrl };
                            // Save selfie to Firestore
                            try {
                                await fbDb.collection('kyc_selfies').add({
                                    userId: userState.id, username: userState.username,
                                    selfieUrl: cloudUrl, capturedAt: new Date().toISOString(), status: 'pending'
                                });
                            } catch(e) {}
                            renderAdminKycDocs();
                            showNotification('✅ Selfie captured and saved to cloud!', 'success');
                        } catch(uploadErr) {
                            console.warn('Selfie upload failed:', uploadErr);
                            _kycCameraBtn.innerHTML = '<i class="fas fa-check"></i> Selfie Captured';
                            showNotification('Selfie captured (cloud upload failed).', 'warning');
                        }
                    }
                });

                document.getElementById('kyc-camera-close-btn')?.addEventListener('click', function() {
                    if (_kycCameraStream) { _kycCameraStream.getTracks().forEach(t => t.stop()); _kycCameraStream = null; }
                    document.getElementById('kyc-camera-modal').classList.remove('show');
                });

                // Re-init on navigation and KYC entity selection
                setTimeout(initKycUploads, 700);

                // ── STANDALONE KYC ENTITY BUTTON HANDLER ──────────────
                // Runs in CAPTURE phase so nothing can block it.
                // This is the definitive handler for showing/hiding KYC forms.
                document.addEventListener('click', function kycEntityHandler(e) {
                    var btn = e.target.closest('.kyc-entity-btn');
                    if (!btn) return;
                    e.stopPropagation(); // prevent master handler from also running
                    
                    var formId = btn.dataset.form;
                    if (!formId) return;

                    // Mark this button active
                    document.querySelectorAll('.kyc-entity-btn').forEach(function(b) {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');

                    // Hide all forms
                    document.querySelectorAll('.kyc-form').forEach(function(f) {
                        f.classList.remove('active');
                        f.style.cssText = 'display:none !important;';
                    });

                    // Show selected form
                    var target = document.getElementById(formId);
                    if (!target) {
                        // Form may have been rendered with duplicate IDs if profile re-rendered.
                        // Search inside profile-kyc-tab directly.
                        var kycTab = document.getElementById('profile-kyc-tab');
                        if (kycTab) target = kycTab.querySelector('#' + formId);
                    }
                    if (target) {
                        target.classList.add('active');
                        target.style.cssText = 'display:block !important;';

                        // Auto-fill Individual form with user data
                        if (formId === 'individual-kyc-form' && window.userState) {
                            var us = window.userState;
                            var nameParts = (us.fullName || '').trim().split(' ');
                            var fn = target.querySelector('#kyc-ind-fname, [id^="kyc-ind-fname"]');
                            var ln = target.querySelector('#kyc-ind-lname, [id^="kyc-ind-lname"]');
                            var em = target.querySelector('#kyc-ind-email, [id^="kyc-ind-email"]');
                            var ph = target.querySelector('#kyc-ind-phone, [id^="kyc-ind-phone"]');
                            if (fn && !fn.value) fn.value = nameParts[0] || '';
                            if (ln && !ln.value) ln.value = nameParts.slice(1).join(' ') || '';
                            if (em && !em.value) em.value = us.email || '';
                            if (ph && !ph.value) ph.value = us.phone || '';
                        }

                        // Re-init upload areas in newly shown form
                        setTimeout(function() {
                            if (typeof initKycUploads === 'function') initKycUploads();
                            if (typeof populateDobSelectors === 'function') populateDobSelectors();
                        }, 50);

                        // Scroll form into view smoothly
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, true); // true = capture phase -- fires before any bubbling handler

                // Re-init uploads after nav/entity selection
                document.addEventListener('click', function(e) {
                    if (e.target.closest('.nav-link'))
                        setTimeout(initKycUploads, 350);
                });

                // Intercept KYC form submit → add to admin queue
                document.addEventListener('submit', function(e) {
                    const form = e.target;
                    if (!form.classList.contains('kyc-form')) return;
                    if (!window._kycQueue) window._kycQueue = [];
                    const entityTypeMap = { 'individual-kyc-form': 'Individual', 'company-kyc-form': 'Company', 'ngo-kyc-form': 'NGO', 'cooperative-kyc-form': 'Cooperative' };
                    const selfieKeys = Object.keys(window._kycSubmissions || {}).filter(k => k.includes('selfie'));
                    const selfieUrl = selfieKeys.length ? (window._kycSubmissions[selfieKeys[0]].selfie || '') : '';
                    window._kycQueue.push({
                        id: 'kyc-' + Date.now(),
                        fullName: (typeof userState !== 'undefined' && userState.fullName) ? userState.fullName : 'Unknown User',
                        username: (typeof userState !== 'undefined' && userState.username) ? userState.username : 'unknown',
                        entityType: entityTypeMap[form.id] || form.id,
                        status: 'pending',
                        submittedAt: new Date().toLocaleDateString(),
                        selfie: selfieUrl
                    });
                    renderAdminKycDocs();
                    showNotification('KYC submitted for admin review.', 'info');
                });
            })();

            // ---------------------------------------------------------
            // FIX C: ADMIN KYC DOCS VIEWER + STATUS MANAGEMENT
            // ---------------------------------------------------------

            window.approveKyc = function(id) {
                const e = (window._kycQueue||[]).find(k => k.id === id);
                if (e) { e.status = 'approved'; renderAdminKycDocs(); showNotification('KYC approved for ' + e.fullName, 'success'); }
            };
            window.rejectKyc = function(id) {
                const e = (window._kycQueue||[]).find(k => k.id === id);
                if (e) { e.status = 'rejected'; renderAdminKycDocs(); showNotification('KYC rejected for ' + e.fullName, 'error'); }
            };

            // ---------------------------------------------------------
            // FIX D: LOGO UPLOAD -- admin uploads logo, appears everywhere
            // ---------------------------------------------------------
            (function() {
                function updateLogoEverywhere(src) {
                    window._empyreanLogoSrc = src;
                    // Update admin preview
                    const adminPreview = document.getElementById('admin-logo-preview-frame');
                    if (adminPreview) adminPreview.innerHTML = src
                        ? `<img src="${src}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                        : `<i class="fas fa-hands-holding-circle" style="font-size:2rem;color:var(--primary-color);"></i>`;
                    // Update sidebar logo avatar
                    const sidebarLogo = document.getElementById('app-logo-avatar');
                    if (sidebarLogo) sidebarLogo.innerHTML = src
                        ? `<img src="${src}" alt="Logo">`
                        : `<div class="logo-placeholder-icon"><i class="fas fa-hands-holding-circle"></i></div>`;
                }

                const logoInput = document.getElementById('admin-logo-upload-input');
                const logoClear = document.getElementById('admin-logo-clear-btn');
                if (logoInput) {
                    logoInput.addEventListener('change', function() {
                        if (this.files && this.files[0]) {
                            const r = new FileReader();
                            r.onload = ev => { updateLogoEverywhere(ev.target.result); showNotification('Logo updated!', 'success'); };
                            r.readAsDataURL(this.files[0]);
                        }
                    });
                }
                if (logoClear) {
                    logoClear.addEventListener('click', function() { updateLogoEverywhere(''); showNotification('Logo removed.', 'info'); });
                }
            })();

            // ---------------------------------------------------------
            // FIX E: RICH TEXT TOOLBAR -- Bold, Italic, Strike, Mono, Font,
            //         Select All, Copy, Cut, Paste for all text areas
            // ---------------------------------------------------------
            (function() {
                function buildRichToolbar(ta) {
                    if (!ta || ta.dataset.hasToolbar === '1') return;
                    ta.dataset.hasToolbar = '1';
                    ta.classList.add('has-toolbar');
                    const tb = document.createElement('div');
                    tb.className = 'rich-text-toolbar';
                    tb.innerHTML = `
                        <select class="rt-font-sel" title="Font">
                            <option value="">Font</option>
                            <option value="'Georgia',serif">Georgia</option>
                            <option value="'Courier New',monospace">Monospace</option>
                            <option value="'Arial',sans-serif">Arial</option>
                            <option value="'Trebuchet MS',sans-serif">Trebuchet</option>
                            <option value="'Impact',sans-serif">Impact</option>
                        </select>
                        <div class="separator"></div>
                        <button type="button" data-fmt="bold" title="Bold (*text*)"><b>B</b></button>
                        <button type="button" data-fmt="italic" title="Italic (_text_)"><i>I</i></button>
                        <button type="button" data-fmt="strike" title="Strikethrough (~text~)"><s>S</s></button>
                        <button type="button" data-fmt="mono" title="Monospace (\`text\`)"><code style="font-size:0.8rem;">M</code></button>
                        <div class="separator"></div>
                        <button type="button" data-fmt="selectall" title="Select All">⌨ All</button>
                        <button type="button" data-fmt="copy" title="Copy"><i class="fas fa-copy"></i></button>
                        <button type="button" data-fmt="cut" title="Cut"><i class="fas fa-cut"></i></button>
                        <button type="button" data-fmt="paste" title="Paste"><i class="fas fa-paste"></i></button>
                    `;
                    ta.parentNode.insertBefore(tb, ta);

                    tb.querySelector('.rt-font-sel').addEventListener('change', function() {
                        ta.style.fontFamily = this.value;
                    });

                    tb.querySelectorAll('button[data-fmt]').forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            const fmt = this.dataset.fmt;
                            const s = ta.selectionStart, en = ta.selectionEnd;
                            const sel = ta.value.substring(s, en);
                            const wrappers = { bold: ['*','*'], italic: ['_','_'], strike: ['~','~'], mono: ['`','`'] };
                            if (wrappers[fmt]) {
                                const [o, c] = wrappers[fmt];
                                ta.setRangeText(o + sel + c, s, en, 'end');
                            } else if (fmt === 'selectall') {
                                ta.select();
                            } else if (fmt === 'copy') {
                                const txt = sel || ta.value;
                                navigator.clipboard.writeText(txt).then(() => showNotification('Copied!', 'success')).catch(() => { ta.select(); document.execCommand('copy'); });
                            } else if (fmt === 'cut') {
                                if (sel) {
                                    navigator.clipboard.writeText(sel).then(() => { ta.setRangeText('', s, en, 'end'); showNotification('Cut!', 'success'); }).catch(() => { document.execCommand('cut'); });
                                }
                            } else if (fmt === 'paste') {
                                navigator.clipboard.readText().then(txt => {
                                    if (txt) { ta.setRangeText(txt, s, en, 'end'); showNotification('Pasted!', 'success'); }
                                }).catch(() => { ta.focus(); document.execCommand('paste'); });
                            }
                            ta.focus();
                        });
                    });
                }

                function applyAllToolbars() {
                    const ids = ['post-text','business-post-text','news-content','request-story',
                        'crisis-description','live-description','reel-caption','profile-bio',
                        'edit-post-text','live-comment-input'];
                    ids.forEach(id => {
                        const el = document.getElementById(id);
                        if (el && el.tagName === 'TEXTAREA') buildRichToolbar(el);
                    });
                }

                setTimeout(applyAllToolbars, 700);
                document.addEventListener('click', function(e) {
                    if (e.target.closest('.nav-link,.kyc-entity-btn,.profile-tab,.settings-tab'))
                        setTimeout(applyAllToolbars, 350);
                });
            })();

            // ---------------------------------------------------------
            // FIX F: SECTION SEARCH BARS -- bind inline search inputs
            // ---------------------------------------------------------
            (function() {
                function bindAll() {
                    // Dashboard
                    const ds = document.getElementById('dashboard-search-input');
                    if (ds && !ds._b) { ds._b = 1; ds.addEventListener('input', function() {
                        const t = this.value.toLowerCase();
                        document.querySelectorAll('#feed-container .impact-story').forEach(el => {
                            const txt = (el.querySelector('.story-content p')?.textContent||'').toLowerCase();
                            const usr = (el.querySelector('.story-user-info strong')?.textContent||'').toLowerCase();
                            el.style.display = (!t||txt.includes(t)||usr.includes(t)) ? 'block' : 'none';
                        });
                    }); }
                    // Marketplace
                    const ms = document.getElementById('marketplace-search-input');
                    if (ms && !ms._b) { ms._b = 1; ms.addEventListener('input', function() {
                        const t = this.value.toLowerCase();
                        document.querySelectorAll('#property-grid-container .property-card').forEach(el => {
                            const n=(el.dataset.name||'').toLowerCase(), l=(el.dataset.location||'').toLowerCase();
                            el.style.display = (!t||n.includes(t)||l.includes(t)) ? 'block' : 'none';
                        });
                    }); }
                    // Reels
                    const rs = document.getElementById('reels-search-input');
                    if (rs && !rs._b) { rs._b = 1; rs.addEventListener('input', function() {
                        const t = this.value.toLowerCase();
                        document.querySelectorAll('.reel-card').forEach(el => {
                            const p=(el.querySelector('.reel-content p')?.textContent||'').toLowerCase();
                            const u=(el.querySelector('.reel-user-info span')?.textContent||'').toLowerCase();
                            el.style.display = (!t||p.includes(t)||u.includes(t)) ? 'block' : 'none';
                        });
                    }); }
                    // News search — owned by app-news.js (_wireSearch)
                }
                setTimeout(bindAll, 800);
                document.addEventListener('click', function(e) {
                    if (e.target.closest('.nav-link')) setTimeout(bindAll, 300);
                });
            })();

            // ---------------------------------------------------------
            // FIX G: CAPTCHA -- ensure feedback text is always visible (dark)
            // ---------------------------------------------------------
            (function() {
                // Patch showFormFeedback to always enforce correct text colors
                const _origSFF = showFormFeedback;
                showFormFeedback = function(formId, message, type) {
                    _origSFF.apply(this, arguments);
                    const el = document.getElementById(formId + '-feedback');
                    if (el) {
                        const colors = { error: '#c62828', success: '#2e7d32', warning: '#e65100', info: '#1565c0' };
                        el.style.color = colors[type] || colors.error;
                        el.style.display = 'block';
                    }
                };
                // Also ensure captcha validation is case-insensitive and shows properly
                // (already handled in captcha check with .toUpperCase())
            })();

            // ---------------------------------------------------------
            // FIX H: GUEST JOIN REQUESTS -- viewer send request, host accept/decline/remove
            // ---------------------------------------------------------
            (function() {
                // Override renderGuestJoinRequests to show proper request cards with actions
                renderGuestJoinRequests = function() {
                    const container = document.getElementById('live-join-requests-list');
                    if (!container) return;
                    const reqs = liveStreamData.joinRequests || [];
                    const badge = document.getElementById('live-join-request-count');
                    if (badge) badge.textContent = reqs.length;
                    if (!reqs.length) {
                        container.innerHTML = '<p style="text-align:center;color:#aaa;padding:20px;">No pending requests.</p>';
                        return;
                    }
                    container.innerHTML = reqs.map((r, i) => `
                        <div style="display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #3a3a3e;">
                            <img src="${r.avatar}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;">
                            <div style="flex-grow:1;">
                                <strong style="color:white;font-size:0.95rem;">${r.fullName}</strong>
                                <p style="color:#aaa;font-size:0.8rem;margin:0;">@${r.username} • ${r.type || 'video'} request</p>
                            </div>
                            <button onclick="window._acceptJoinReq(${i})" style="background:var(--success-color);border:none;color:white;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:0.85rem;"><i class="fas fa-check"></i></button>
                            <button onclick="window._declineJoinReq(${i})" style="background:var(--danger-color);border:none;color:white;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:0.85rem;"><i class="fas fa-times"></i></button>
                        </div>`).join('');
                };

                window._acceptJoinReq = function(idx) {
                    const req = liveStreamData.joinRequests.splice(idx, 1)[0];
                    if (!req) return;
                    liveStreamData.guests.push({ ...req, videoActive: true });
                    showNotification(req.fullName + ' added to stream!', 'success');
                    renderGuestJoinRequests();
                    updateLiveUI();
                };
                window._declineJoinReq = function(idx) {
                    const req = liveStreamData.joinRequests.splice(idx, 1)[0];
                    if (!req) return;
                    showNotification(req.fullName + " request declined.", 'info');
                    renderGuestJoinRequests();
                };

                // Host: remove a guest already on screen (click on guest slot remove btn)
                document.addEventListener('click', function(e) {
                    const removeGuestBtn = e.target.closest('.guest-remove-btn');
                    if (removeGuestBtn) {
                        const guestId = removeGuestBtn.dataset.guestId;
                        const idx = liveStreamData.guests.findIndex(g => g.userId === guestId);
                        if (idx !== -1) {
                            const g = liveStreamData.guests.splice(idx, 1)[0];
                            showNotification(g.fullName + ' removed from stream.', 'info');
                            updateLiveUI();
                        }
                    }
                });
            })();

            // ---------------------------------------------------------
            // FIX I: MOCK DATA CLEANUP (non-recursive safe version)
            // ---------------------------------------------------------
            (function() {
                // Dispatch empyrean-init-done event after initializeApp runs
                // (wrapper removed to prevent chain -- event dispatched directly in initializeApp)
                document.addEventListener('empyrean-init-done', function() {
                    // placeholder -- init-done listeners can be added here
                });
            })();

            // ---------------------------------------------------------
            // FIX J: SIDEBAR LOGO -- ensure logo avatar updates on logo change
            // ---------------------------------------------------------
            (function() {
                const _origBuildSidebar2 = buildSidebar;
                buildSidebar = function() {
                    _origBuildSidebar2.apply(this, arguments);
                    setTimeout(function() {
                        const logoDiv = document.getElementById('app-logo-avatar');
                        if (logoDiv && window._empyreanLogoSrc) {
                            logoDiv.innerHTML = `<img src="${window._empyreanLogoSrc}" alt="Logo">`;
                        }
                    }, 100);
                };
            })();

            // ---------------------------------------------------------
            // FIX K: LIVE STREAM -- broadcast view (simulated)
            // When Go Live is triggered, show LIVE badge + viewer simulation
            // ---------------------------------------------------------
            (function() {
                const _origUpdateLiveUI = typeof updateLiveUI === 'function' ? updateLiveUI : null;
                if (_origUpdateLiveUI) {
                    updateLiveUI = function() {
                        _origUpdateLiveUI.apply(this, arguments);
                        // Ensure viewer count increments realistically when live
                        if (liveStreamData.isLive && !liveStreamData._viewerSimInterval) {
                            liveStreamData._viewerSimInterval = setInterval(() => {
                                if (!liveStreamData.isLive) {
                                    clearInterval(liveStreamData._viewerSimInterval);
                                    liveStreamData._viewerSimInterval = null;
                                    return;
                                }
                                const countEl = document.getElementById('live-viewer-count');
                                const modalCountEl = document.getElementById('modal-viewer-count');
                                if (countEl) {
                                    const curr = parseInt(countEl.textContent) || 1;
                                    const delta = Math.random() < 0.6 ? 1 : (Math.random() < 0.3 ? -1 : 0);
                                    const newVal = Math.max(1, curr + delta);
                                    countEl.textContent = newVal;
                                    if (modalCountEl) modalCountEl.textContent = newVal;
                                }
                            }, 4000);
                        }
                        // Add remove buttons to guest slots for the host
                        const isCurrentUserHost = !isGuest && userState.id === liveStreamData.hostUserId;
                        if (isCurrentUserHost) {
                            document.querySelectorAll('.guest-slot:not([data-remove-bound])').forEach(slot => {
                                slot.dataset.removeBound = '1';
                                const guestId = slot.dataset.guestId;
                                if (guestId && !slot.querySelector('.guest-remove-btn')) {
                                    const removeBtn = document.createElement('button');
                                    removeBtn.className = 'guest-remove-btn';
                                    removeBtn.dataset.guestId = guestId;
                                    removeBtn.style.cssText = 'position:absolute;top:5px;right:5px;background:rgba(244,67,54,0.8);border:none;color:white;border-radius:50%;width:22px;height:22px;font-size:0.7rem;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;';
                                    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                                    slot.style.position = 'relative';
                                    slot.appendChild(removeBtn);
                                }
                            });
                        }
                    };
                }
            })();

            // ---------------------------------------------------------
            // FIX L: CLOSE CART MODAL button (close-modal-btn inside cart)
            // ---------------------------------------------------------
            document.addEventListener('click', function(e) {
                if (e.target.closest('.close-modal-btn')) {
                    const cartOverlay = document.getElementById('cart-modal-overlay');
                    if (cartOverlay && cartOverlay.contains(e.target)) {
                        cartOverlay.classList.remove('show');
                        document.body.classList.remove('modal-open');
                    }
                }
                // Close all modals on overlay click
                const modalOverlay = e.target.closest('.modal-overlay-container,.modal-overlay');
                if (modalOverlay && e.target === modalOverlay) {
                    modalOverlay.classList.remove('show');
                    document.body.classList.remove('modal-open');
                }
            });

            // ---------------------------------------------------------
            // FIX M: MARKETPLACE CURRENCY -- show posted items in selected currency
            // ---------------------------------------------------------
            (function() {
                const currSel = document.getElementById('item-currency');
                if (currSel) {
                    currSel.addEventListener('change', function() {
                        const cur = this.value;
                        const lbl = document.querySelector('label[for="item-price"]');
                        if (lbl) lbl.textContent = 'Price (' + cur + ')';
                        // Update existing cards that have a data-display-currency
                        document.querySelectorAll('#property-grid-container .property-card[data-display-currency]').forEach(card => {
                            const rawPrice = parseFloat(card.dataset.price || 0);
                            if (!rawPrice) return;
                            const priceEl = card.querySelector('.property-info div:last-child');
                            if (!priceEl) return;
                            const fmts = {
                                'NGN': '₦' + rawPrice.toLocaleString(),
                                'USD': formatUsdPrice(rawPrice),
                                'EUR': '€' + rawPrice.toLocaleString(),
                                'GBP': '£' + rawPrice.toLocaleString(),
                                'EMPY': rawPrice.toLocaleString() + ' EMPY'
                            };
                            priceEl.textContent = fmts[cur] || formatUsdPrice(rawPrice);
                            card.dataset.displayCurrency = cur;
                        });
                    });
                }
            })();

            // FIX N: NAV -- duplicate rebindNavLinks removed.
            // buildSidebar() already binds click handlers directly on each link.
            // The master click handler also catches .nav-link clicks as fallback.
            // Adding a third layer caused double-navigation freeze.

            // ---------------------------------------------------------
            // INITIAL CALLS
            // ---------------------------------------------------------
            setTimeout(function() {
                renderAdminKycDocs();
                // Sidebar logo avatar removed per user request
            }, 1000);

            // ═══════════════════════════════════════════════════════════
            // FIX 1: MAIN FEED -- PROFESSIONAL GRID + MULTI-MEDIA
            // ═══════════════════════════════════════════════════════════
            (function() {
                // Inject premium feed grid CSS
                const feedStyle = document.createElement('style');
                feedStyle.textContent = `
                    #feed-container {
                        display: grid !important;
                        grid-template-columns: 1fr !important;
                        gap: 16px !important;
                        padding: 0 !important;
                    }
                    @media (min-width: 900px) {
                        #feed-container.grid-view {
                            grid-template-columns: repeat(2, 1fr) !important;
                        }
                    }
                    .feed-grid-toggle {
                        display: flex; gap: 6px; align-items: center;
                        margin-left: auto; margin-bottom: 8px;
                    }
                    .feed-grid-btn {
                        background: rgba(10,14,39,0.05); border: 1.5px solid rgba(10,14,39,0.1);
                        border-radius: 10px; padding: 6px 12px; cursor: pointer;
                        font-size: 0.82rem; font-weight: 600; color: var(--text-muted);
                        transition: all 0.2s;
                    }
                    .feed-grid-btn.active {
                        background: var(--g-navy); color: white;
                        border-color: transparent;
                    }
                    /* Multi-image grid */
                    .story-media-container[data-count="1"] .story-media-item { width:100%; }
                    .story-media-container[data-count="2"] { display:grid; grid-template-columns:1fr 1fr; gap:3px; }
                    .story-media-container[data-count="3"] { display:grid; grid-template-columns:2fr 1fr; grid-template-rows:1fr 1fr; gap:3px; }
                    .story-media-container[data-count="3"] .story-media-item:first-child { grid-row: 1 / 3; }
                    .story-media-container[data-count="4"] { display:grid; grid-template-columns:1fr 1fr; gap:3px; }
                    .story-media-container[data-count="5"],
                    .story-media-container[data-count="6"] { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; }
                    .story-media-item img, .story-media-item video { width:100%; height:220px; object-fit:cover; display:block; }
                    @media (max-width:600px) { .story-media-item img, .story-media-item video { height:150px; } }
                    /* Marketplace grid */
                    #property-listings-container {
                        display: grid !important;
                        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
                        gap: 16px !important;
                    }
                    /* Professional post card */
                    .impact-story {
                        border-radius: 20px !important;
                        overflow: hidden !important;
                    }
                    .story-header {
                        display: flex; align-items: center; gap: 12px;
                        padding: 16px 20px 10px !important;
                    }
                    .story-user-info strong { font-size: 0.95rem; font-weight: 700; }
                    .story-user-info span { font-size: 0.78rem; color: var(--text-muted); }
                `;
                document.head.appendChild(feedStyle);

                // Add grid toggle buttons above feed
                const feedHeader = document.querySelector('#dashboard h3:has(.fa-stream)') || document.querySelector('#dashboard .card h3');
                if (feedHeader) {
                    const toggleDiv = document.createElement('div');
                    toggleDiv.className = 'feed-grid-toggle';
                    toggleDiv.innerHTML = `
                        <button class="feed-grid-btn active" id="feed-list-btn" title="List view"><i class="fas fa-list"></i></button>
                        <button class="feed-grid-btn" id="feed-grid-btn" title="Grid view"><i class="fas fa-th-large"></i></button>
                    `;
                    feedHeader.appendChild(toggleDiv);
                    document.getElementById('feed-list-btn')?.addEventListener('click', function() {
                        document.getElementById('feed-container')?.classList.remove('grid-view');
                        this.classList.add('active');
                        document.getElementById('feed-grid-btn')?.classList.remove('active');
                    });
                    document.getElementById('feed-grid-btn')?.addEventListener('click', function() {
                        document.getElementById('feed-container')?.classList.add('grid-view');
                        this.classList.add('active');
                        document.getElementById('feed-list-btn')?.classList.remove('active');
                    });
                }
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 2: PASSWORD VISIBILITY TOGGLE
            // ═══════════════════════════════════════════════════════════
            document.addEventListener('click', function(e) {
                const btn = e.target.closest('.pwd-toggle-btn');
                if (!btn) return;
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (!input) return;
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
                }
            });

            // ═══════════════════════════════════════════════════════════
            // FIX 3: LIVE STREAM PREMIUM BACKGROUNDS (Change #7)
            // ═══════════════════════════════════════════════════════════
            (function() {
                // Override liveBackgrounds with premium card styles
                if (typeof liveBackgrounds !== 'undefined') {
                    liveBackgrounds.length = 0;
                    const premiumBgs = [
                        // Classic Dark
                        'linear-gradient(160deg,#0A0E27 0%,#1B2B8B 100%)',
                        // Royal Gold
                        'linear-gradient(135deg,#1A1A2E 0%,#16213E 40%,#0F3460 70%,#E94560 100%)',
                        // Emerald Night
                        'linear-gradient(135deg,#0d1b2a 0%,#1b4332 50%,#40916c 100%)',
                        // Sunset Premium
                        'linear-gradient(135deg,#FF6B6B 0%,#FFE66D 50%,#F7971E 100%)',
                        // Ocean Deep
                        'linear-gradient(160deg,#0093E9 0%,#80D0C7 100%)',
                        // Purple Haze
                        'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
                        // Midnight Rose
                        'linear-gradient(135deg,#1a1a2e 0%,#16213e 40%,#8B0000 100%)',
                        // Arctic Aurora
                        'linear-gradient(160deg,#355C7D 0%,#6C5B7B 50%,#C06C84 100%)',
                        // Golden Hour
                        'linear-gradient(135deg,#F5C518 0%,#F59E0B 40%,#D97706 100%)',
                        // Teal Abyss
                        'linear-gradient(135deg,#00D4AA 0%,#00897B 50%,#004D40 100%)',
                        // Crimson Empire
                        'linear-gradient(135deg,#FF416C 0%,#FF4B2B 100%)',
                        // Silver Lux
                        'linear-gradient(135deg,#E0E0E0 0%,#BDBDBD 40%,#9E9E9E 100%)',
                        // Night Sky
                        'radial-gradient(ellipse at bottom,#1B2735 0%,#090A0F 100%)',
                        // Forest Deep
                        'linear-gradient(135deg,#134E5E 0%,#71B280 100%)',
                        // Space Galaxy
                        'linear-gradient(135deg,#0F0C29 0%,#302B63 50%,#24243e 100%)',
                    ];
                    premiumBgs.forEach(bg => liveBackgrounds.push(bg));
                }

                // Add labels to bg thumbs
                const origPopulate = window.populateBackgroundSelector || null;

                // Re-style bg thumbs with labels
                const bgStyle = document.createElement('style');
                bgStyle.textContent = `
                    #live-bg-selector {
                        display: grid !important;
                        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)) !important;
                        gap: 8px !important;
                        margin-top: 10px !important;
                    }
                    #go-live-form .bg-thumb {
                        width: 100% !important;
                        height: 110px !important;
                        border-radius: 14px !important;
                        cursor: pointer !important;
                        border: 3px solid transparent !important;
                        transition: all 0.2s !important;
                        position: relative !important;
                        overflow: hidden !important;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                    }
                    #go-live-form .bg-thumb:hover {
                        border-color: var(--accent) !important;
                        transform: scale(1.05) !important;
                    }
                    #go-live-form .bg-thumb.active {
                        border-color: var(--accent) !important;
                        box-shadow: 0 0 0 3px rgba(245,197,24,0.4) !important;
                    }
                    #go-live-form .bg-thumb::after {
                        content: '✓';
                        position: absolute; top: 6px; right: 6px;
                        width: 20px; height: 20px; border-radius: 50%;
                        background: var(--accent); color: #111;
                        font-size: 0.7rem; font-weight: 900;
                        display: flex; align-items: center; justify-content: center;
                        opacity: 0; transition: opacity 0.2s;
                    }
                    #go-live-form .bg-thumb.active::after { opacity: 1; }
                `;
                document.head.appendChild(bgStyle);
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 4: LIVE RECORDING -- USE ACTUAL BLOB (Change #8)
            // ═══════════════════════════════════════════════════════════
            (function() {
                let _mediaRecorder = null;
                let _recordingChunks = [];
                let _recordingBlob = null;

                // Override the record button behavior to use MediaRecorder
                document.addEventListener('click', function(e) {
                    const recBtn = e.target.closest('#live-record-btn');
                    if (!recBtn) return;
                    const isCurrentUserHost = !isGuest && userState.id === liveStreamData.hostUserId;
                    if (!isCurrentUserHost) return;

                    if (!liveStreamData.isRecording) {
                        // Start recording the host video stream
                        const hostVideo = document.getElementById('host-main-video');
                        let stream = null;
                        if (hostVideo && hostVideo.srcObject) {
                            stream = hostVideo.srcObject;
                        } else if (hostVideo && hostVideo.captureStream) {
                            try { stream = hostVideo.captureStream(); } catch(e) {}
                        }
                        if (stream) {
                            _recordingChunks = [];
                            _mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
                            _mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) _recordingChunks.push(e.data); };
                            _mediaRecorder.onstop = () => {
                                _recordingBlob = new Blob(_recordingChunks, { type: 'video/webm' });
                                console.log('[Empyrean] Recording ready:', _recordingBlob.size, 'bytes');
                            };
                            _mediaRecorder.start(1000);
                            liveStreamData._mediaRecorder = _mediaRecorder;
                            showNotification('🔴 Recording started!', 'info');
                        } else {
                            // No live stream, simulate recording
                            liveStreamData._mediaRecorder = null;
                            showNotification('🔴 Recording started (simulation mode)', 'info');
                        }
                        liveStreamData.isRecording = true;
                        updateLiveUI();
                    } else {
                        // Stop recording
                        if (_mediaRecorder && _mediaRecorder.state === 'recording') {
                            _mediaRecorder.stop();
                        }
                        liveStreamData.isRecording = false;
                        showNotification('⏹ Recording stopped.', 'info');
                        updateLiveUI();
                    }
                });

                // Override addRecordedLiveStream to use actual blob
                const _origAddRecorded = addRecordedLiveStream;
                addRecordedLiveStream = function(title, hostName) {
                    const wrapper = document.getElementById('livestream-wrapper');
                    if (!wrapper) return;
                    const newCard = document.createElement('div');
                    newCard.className = 'livestream-card';
                    // Use actual blob URL if available, else show placeholder with message
                    const videoSrc = (_recordingBlob && _recordingBlob.size > 0)
                        ? URL.createObjectURL(_recordingBlob)
                        : '';
                    const hasRecording = videoSrc !== '';
                    newCard.innerHTML = `
                        <div class="livestream-video-container" style="position:relative;background:#111;">
                            ${hasRecording
                                ? `<video src="${videoSrc}" controls style="width:100%;height:150px;object-fit:cover;"></video>`
                                : `<div style="width:100%;height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#aaa;gap:8px;background:#1a1a2e;">
                                    <i class="fas fa-video" style="font-size:2rem;color:#F5C518;"></i>
                                    <span style="font-size:0.78rem;text-align:center;padding:0 10px;">Recording saved -- webcam/screen stream required for full playback</span>
                                   </div>`
                            }
                            <div style="position:absolute;top:8px;left:8px;background:var(--danger-color);color:white;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;">RECORDED</div>
                        </div>
                        <div class="livestream-info" style="padding:12px;">
                            <strong style="font-size:0.9rem;color:var(--primary);display:block;">${title}</strong>
                            <span style="font-size:0.78rem;color:var(--text-muted);">By: ${hostName} · Just now</span>
                            ${hasRecording ? `<a href="${videoSrc}" download="${title.replace(/\s+/g,'-')}.webm" style="display:inline-block;margin-top:8px;font-size:0.78rem;color:var(--secondary);"><i class="fas fa-download"></i> Download Recording</a>` : ''}
                        </div>
                    `;
                    wrapper.prepend(newCard);
                    // Reset blob after posting
                    _recordingBlob = null;
                    _recordingChunks = [];
                };
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 5: SOS → ADMIN PANEL FIX (Change #12)
            // ═══════════════════════════════════════════════════════════
            (function() {
                // Ensure renderAdminQueues is called after any SOS push
                const _origCreateSos = createSosPostOnFeed;
                // Patch the SOS submit to always show in admin queue
                const origHelpForm = document.getElementById('help-form');
                if (origHelpForm) {
                    origHelpForm.addEventListener('submit', function() {
                        // After short delay, refresh admin queue and badge
                        setTimeout(() => {
                            renderAdminQueues();
                            const sosStat = document.getElementById('admin-stat-sos');
                            if (sosStat) sosStat.textContent = mockAdminSosQueue.length;
                        }, 300);
                    }, true); // capture phase so it runs after main handler
                }

                // Also refresh admin queue badge whenever admin section is opened
                // Admin refresh on navigateTo('admin') -- now built into core navigateTo above
                // (removed duplicate wrapper to prevent freeze)
            })();

            // FIX 6: ADMIN NEWS PUBLISHER — owned by app-admin.js + app-news.js
            // Admin form wiring, media preview, publish, and delete delegation
            // are all handled in app-admin.js (_wireAdminNewsForm) and
            // app-news.js (window.deleteNewsPost). No duplicate logic here.

            // FIX 7: STATUS — removed.
            // All status logic (modal HTML, upload, preview, viewers panel,
            // retweet, bubble-like, profile nav, chat, renderStatusBar,
            // _openStatusViewer) lives exclusively in app-status.js.
            // This block was: rebuilding .create-status-card on every open
            // (destroying app-status.js listeners), injecting duplicate IDs
            // (status-retweet-btn vs status-retweet-btn-html), and overriding
            // window.renderStatusBar / window._openStatusViewer with simpler
            // versions that had no viewers panel or bubble-like support.

            // ═══════════════════════════════════════════════════════════
            // FIX 8: NGO PARTNERS -- VERIFIED-ONLY, INDIVIDUAL PAGES
            // ═══════════════════════════════════════════════════════════
            (function() {
                // Style the NGO section with proper verified-only grid
                const ngoStyle = document.createElement('style');
                ngoStyle.textContent = `
                    #ngo-grid-container {
                        display: grid !important;
                        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) !important;
                        gap: 20px !important;
                        flex-wrap: wrap !important;
                        width: 100% !important;
                    }
                    .ngo-card {
                        flex: none !important;
                        width: auto !important;
                        border-radius: 20px !important;
                        overflow: hidden !important;
                        transition: all 0.3s !important;
                        cursor: pointer !important;
                    }
                    .ngo-verified-badge {
                        display: inline-flex; align-items: center; gap: 4px;
                        background: rgba(16,185,129,0.12); color: var(--success-color);
                        font-size: 0.75rem; font-weight: 700; padding: 3px 10px;
                        border-radius: 50px; border: 1px solid rgba(16,185,129,0.3);
                    }
                    .ngo-card-header { height: 120px; position: relative; overflow: hidden; }
                    .ngo-card-body { padding: 16px; }
                    .ngo-avatar { width: 70px; height: 70px; border-radius: 14px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-top: -35px; position: relative; z-index:2; object-fit:cover; background: var(--g-navy); display:flex;align-items:center;justify-content:center; }
                    #ngo-individual-page { display:none; }
                    #ngo-individual-page.show { display:block; }
                    .ngo-profile-cover { height: 200px; border-radius: 20px 20px 0 0; overflow: hidden; position: relative; }
                    .ngo-profile-cover img { width:100%;height:100%;object-fit:cover; }
                `;
                document.head.appendChild(ngoStyle);

                // Override the horizontal slider container for NGOs
                const ngoContainer = document.getElementById('ngo-grid-container');
                const ngoWrapper = ngoContainer?.closest('.horizontal-slider-container');
                if (ngoWrapper) {
                    ngoWrapper.style.overflowX = 'visible';
                    ngoWrapper.style.overflow = 'visible';
                }

                // Individual NGO page in the DOM
                const ngoSection = document.getElementById('ngo-partners');
                if (ngoSection && !document.getElementById('ngo-individual-page')) {
                    const individualPage = document.createElement('div');
                    individualPage.id = 'ngo-individual-page';
                    ngoSection.appendChild(individualPage);
                }

                // Make NGO cards link to individual pages on click (delegated)
                document.addEventListener('click', function(e) {
                    const ngoCard = e.target.closest('#ngo-grid-container .ngo-card');
                    if (!ngoCard) return;
                    const ngoData = JSON.parse(ngoCard.dataset.ngoData || '{}');
                    const gridView = document.getElementById('ngo-grid-view');
                    const individualPage = document.getElementById('ngo-individual-page');
                    const backBtn = document.getElementById('back-to-ngo-grid');
                    if (!individualPage) return;
                    individualPage.innerHTML = `
                        <div class="card" style="overflow:hidden;border-radius:20px;">
                            <div class="ngo-profile-cover" style="background:${ngoData.cover || 'var(--g-navy)'};">
                                ${ngoData.coverImg ? `<img src="${ngoData.coverImg}" alt="Cover">` : ''}
                            </div>
                            <div style="padding:0 24px 24px;">
                                <div style="display:flex;align-items:flex-end;gap:16px;transform:translateY(-36px);margin-bottom:-20px;">
                                    <div style="width:80px;height:80px;border-radius:14px;border:4px solid white;background:var(--g-navy);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.2);flex-shrink:0;">
                                        ${ngoData.logo ? `<img src="${ngoData.logo}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fas fa-hands-helping" style="color:white;font-size:1.8rem;"></i>`}
                                    </div>
                                    <div>
                                        <h2 style="font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;color:var(--primary);">${ngoData.name || 'NGO Partner'}</h2>
                                        <span class="ngo-verified-badge"><i class="fas fa-check-circle"></i> Verified Partner</span>
                                    </div>
                                </div>
                                <p style="color:var(--text-muted);line-height:1.7;margin-bottom:20px;">${ngoData.description || 'This verified NGO partner is making a real impact in the community.'}</p>
                                <div class="grid-3" style="gap:12px;margin-bottom:20px;">
                                    <div class="stat-card"><h4>Projects</h4><div class="stat-value">${ngoData.projects || '0'}</div></div>
                                    <div class="stat-card"><h4>Beneficiaries</h4><div class="stat-value">${ngoData.beneficiaries || '0'}</div></div>
                                    <div class="stat-card"><h4>EMPY Grants</h4><div class="stat-value">${ngoData.grants || '0'}</div></div>
                                </div>
                                <div id="ngo-individual-feed" style="margin-top:20px;">
                                    <h3 style="font-family:'Syne',sans-serif;font-weight:700;margin-bottom:16px;">Posts &amp; Updates</h3>
                                    <p style="color:var(--text-muted);text-align:center;padding:30px;">No posts yet from this organization.</p>
                                </div>
                            </div>
                        </div>
                    `;
                    if (gridView) gridView.style.display = 'none';
                    individualPage.classList.add('show');
                    if (backBtn) backBtn.style.display = 'inline-flex';
                });

                // Back to NGO grid
                document.getElementById('back-to-ngo-grid')?.addEventListener('click', function() {
                    const gridView = document.getElementById('ngo-grid-view');
                    const individualPage = document.getElementById('ngo-individual-page');
                    if (gridView) gridView.style.display = 'block';
                    if (individualPage) individualPage.classList.remove('show');
                    this.style.display = 'none';
                });

                // Track org registrations for admin NGO table
                const origSignupForm = document.getElementById('signup-form');
                if (origSignupForm) {
                    origSignupForm.addEventListener('submit', function() {
                        const userType = document.querySelector('input[name="user-type"]:checked')?.value;
                        if (userType !== 'organisation') return;
                        const orgName = document.getElementById('signup-orgname')?.value?.trim();
                        const orgReg = document.getElementById('signup-org-reg')?.value?.trim();
                        const email = document.getElementById('signup-email')?.value?.trim();
                        if (!orgName) return;
                        setTimeout(() => {
                            const tableBody = document.getElementById('admin-ngo-table-body');
                            if (tableBody) {
                                const existingEmpty = tableBody.querySelector('td[colspan="6"]')?.closest('tr');
                                if (existingEmpty) existingEmpty.remove();
                                const row = document.createElement('tr');
                                row.style.borderBottom = '1px solid rgba(10,14,39,0.06)';
                                const now = new Date().toLocaleDateString('en-GB');
                                row.innerHTML = `
                                    <td style="padding:12px 16px;font-weight:600;color:var(--primary);">${orgName}</td>
                                    <td style="padding:12px 16px;color:var(--text-muted);font-size:0.85rem;">${orgReg || '--'}</td>
                                    <td style="padding:12px 16px;color:var(--text-muted);font-size:0.85rem;">${email || '--'}</td>
                                    <td style="padding:12px 16px;color:var(--text-muted);font-size:0.82rem;">${now}</td>
                                    <td style="padding:12px 16px;">
                                        <span class="kyc-status-badge pending" style="background:#fff8e1;color:#f57c00;padding:3px 10px;border-radius:50px;font-size:0.75rem;font-weight:600;">Pending</span>
                                    </td>
                                    <td style="padding:12px 16px;display:flex;gap:6px;">
                                        <button class="btn btn-small btn-success" onclick="this.closest('tr').querySelector('.kyc-status-badge').textContent='Verified';this.closest('tr').querySelector('.kyc-status-badge').className='kyc-status-badge approved';this.style.display='none';" style="font-size:0.75rem;padding:4px 10px;"><i class="fas fa-check"></i> Verify</button>
                                        <button class="btn btn-small btn-danger" onclick="this.closest('tr').remove();" style="font-size:0.75rem;padding:4px 10px;"><i class="fas fa-times"></i> Reject</button>
                                    </td>
                                `;
                                tableBody.prepend(row);
                                const countBadge = document.getElementById('admin-ngo-count-badge');
                                if (countBadge) countBadge.textContent = tableBody.querySelectorAll('tr').length + ' Partners';
                            }
                        }, 1000);
                    }, false);
                }
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 9: COMMUNITY TASKS -- ACTIVATE SECTION (Change #15)
            // ═══════════════════════════════════════════════════════════
            (function() {
                const taskList = document.getElementById('community-tasks-list');
                if (!taskList || typeof mockCommunityTasks === 'undefined') return;

                taskList.innerHTML = '';
                mockCommunityTasks.forEach(task => {
                    const isCompleted = userState.completedTasks instanceof Set
                        ? userState.completedTasks.has(task.id)
                        : false;
                    const li = document.createElement('li');
                    li.className = 'task-item';
                    li.dataset.taskId = task.id;
                    li.innerHTML = `
                        <div style="display:flex;align-items:center;gap:12px;flex:1;">
                            <div style="width:40px;height:40px;border-radius:12px;background:rgba(27,43,139,0.1);display:flex;align-items:center;justify-content:center;">
                                <i class="${task.icon}" style="color:var(--secondary);font-size:1.1rem;"></i>
                            </div>
                            <div>
                                <strong style="color:var(--primary);font-size:0.95rem;">${task.text}</strong>
                                <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Reward: <strong style="color:var(--accent2);">+${task.reward} EMPY</strong></p>
                            </div>
                        </div>
                        ${isCompleted
                            ? `<span style="background:rgba(16,185,129,0.12);color:var(--success-color);padding:6px 16px;border-radius:50px;font-size:0.82rem;font-weight:700;"><i class="fas fa-check-circle"></i> Done</span>`
                            : `<a href="${task.url}" target="_blank" rel="noopener" class="btn btn-small btn-accent task-complete-btn" data-task-id="${task.id}" data-reward="${task.reward}" style="padding:8px 18px;font-size:0.82rem;border-radius:50px;text-decoration:none;">
                                <i class="fas fa-external-link-alt"></i> Go &amp; Earn
                               </a>`
                        }
                    `;
                    taskList.appendChild(li);
                });

                // Task completion handler
                document.addEventListener('click', function(e) {
                    const taskBtn = e.target.closest('.task-complete-btn');
                    if (!taskBtn) return;
                    const taskId = taskBtn.dataset.taskId;
                    const reward = parseInt(taskBtn.dataset.reward) || 0;
                    // Mark completed after 3 seconds (simulate link visit)
                    setTimeout(() => {
                        if (userState.completedTasks instanceof Set && !userState.completedTasks.has(taskId)) {
                            userState.completedTasks.add(taskId);
                            userState.empyBalance = (userState.empyBalance || 0) + reward;
                            showNotification(`🎉 +${reward} EMPY earned for completing task!`, 'success');
                            // Re-render tasks
                            const btn = document.querySelector(`.task-complete-btn[data-task-id="${taskId}"]`);
                            if (btn) btn.outerHTML = `<span style="background:rgba(16,185,129,0.12);color:var(--success-color);padding:6px 16px;border-radius:50px;font-size:0.82rem;font-weight:700;"><i class="fas fa-check-circle"></i> Done</span>`;
                            updateWalletUI && updateWalletUI();
                        }
                    }, 3000);
                });
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 10: WALLET / STAKING OVERHAUL (Change #16)
            // ═══════════════════════════════════════════════════════════
            (function() {
                const walletStyle = document.createElement('style');
                walletStyle.textContent = `
                    .wallet-card {
                        background: var(--g-navy) !important;
                        color: white !important;
                        border-radius: 24px !important;
                        padding: 28px !important;
                        position: relative !important;
                        overflow: hidden !important;
                    }
                    .wallet-card::before {
                        content: '';
                        position: absolute; top: -40px; right: -40px;
                        width: 160px; height: 160px; border-radius: 50%;
                        background: rgba(245,197,24,0.12);
                        pointer-events: none;
                    }
                    .wallet-card p { color: rgba(255,255,255,0.7) !important; }
                    .wallet-card .empy-balance {
                        font-family: 'Syne', sans-serif !important;
                        font-size: 2.2rem !important;
                        font-weight: 800 !important;
                        color: #F5C518 !important;
                        margin: 8px 0 !important;
                    }
                    #wallet-empy-balance {
                        font-family: 'Syne', sans-serif !important;
                        font-size: 2.2rem !important;
                        font-weight: 800 !important;
                        color: #F5C518 !important;
                    }
                    .wallet-action-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                        margin-top: 20px;
                    }
                    .wallet-quick-btn {
                        display: flex; flex-direction: column; align-items: center; gap: 6px;
                        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
                        border-radius: 16px; padding: 14px; cursor: pointer; color: white;
                        font-size: 0.82rem; font-weight: 600; transition: all 0.2s;
                        text-decoration: none;
                    }
                    .wallet-quick-btn:hover { background: rgba(245,197,24,0.2); border-color: rgba(245,197,24,0.4); }
                    .wallet-quick-btn i { font-size: 1.4rem; color: #F5C518; }
                    .staking-tier-badge {
                        display: inline-flex; align-items: center; gap: 5px;
                        padding: 4px 12px; border-radius: 50px; font-size: 0.78rem; font-weight: 700;
                    }
                    .staking-tier-badge.bronze { background: rgba(205,127,50,0.15); color: #CD7F32; border: 1px solid rgba(205,127,50,0.3); }
                    .staking-tier-badge.silver { background: rgba(192,192,192,0.15); color: #9E9E9E; border: 1px solid rgba(192,192,192,0.3); }
                    .staking-tier-badge.gold { background: rgba(245,197,24,0.15); color: #F5C518; border: 1px solid rgba(245,197,24,0.3); }
                    .staking-tier-badge.platinum { background: rgba(0,212,170,0.15); color: var(--accent2); border: 1px solid rgba(0,212,170,0.3); }
                    .withdrawal-step {
                        display: flex; align-items: flex-start; gap: 12px;
                        padding: 14px; border-radius: 14px; margin-bottom: 10px;
                        background: rgba(10,14,39,0.03); border: 1px solid rgba(10,14,39,0.06);
                    }
                    .withdrawal-step-num {
                        width: 28px; height: 28px; border-radius: 50%;
                        background: var(--g-navy); color: white;
                        font-size: 0.82rem; font-weight: 700;
                        display: flex; align-items: center; justify-content: center;
                        flex-shrink: 0;
                    }
                `;
                document.head.appendChild(walletStyle);

                // Enhanced wallet overview card
                const walletCard = document.querySelector('.wallet-card');
                if (walletCard) {
                    const currentHTML = walletCard.innerHTML;
                    // Inject quick action buttons below existing content
                    if (!walletCard.querySelector('.wallet-action-row')) {
                        const actionRow = document.createElement('div');
                        actionRow.className = 'wallet-action-row';
                        actionRow.innerHTML = `
                            <a class="wallet-quick-btn" href="#" onclick="navigateTo('my-wallet');return false;">
                                <i class="fas fa-coins"></i> Stake EMPY
                            </a>
                            <a class="wallet-quick-btn" href="#" id="wallet-withdraw-quick">
                                <i class="fas fa-university"></i> Withdraw
                            </a>
                            <a class="wallet-quick-btn" href="#" id="wallet-transfer-quick">
                                <i class="fas fa-paper-plane"></i> Transfer
                            </a>
                            <a class="wallet-quick-btn" id="buy-empy-wallet-btn-2" href="#">
                                <i class="fas fa-shopping-cart"></i> Buy EMPY
                            </a>
                        `;
                        walletCard.appendChild(actionRow);

                        // Staking tier indicator
                        const tierDiv = document.createElement('div');
                        tierDiv.style.cssText = 'margin-top:16px;display:flex;align-items:center;gap:10px;';
                        tierDiv.innerHTML = `
                            <span style="font-size:0.82rem;color:rgba(255,255,255,0.6);">Staking Tier:</span>
                            <span class="staking-tier-badge gold" id="wallet-staking-tier"><i class="fas fa-medal"></i> Gold Member</span>
                        `;
                        walletCard.appendChild(tierDiv);
                    }
                }

                // Update staking tier based on staked balance
                function updateStakingTier() {
                    const badge = document.getElementById('wallet-staking-tier');
                    if (!badge) return;
                    const staked = (userManualStakedBalance || 0) + (userLockedStakedBalance || 0);
                    let tier, cls;
                    if (staked >= 50000) { tier = 'Platinum'; cls = 'platinum'; }
                    else if (staked >= 10000) { tier = 'Gold'; cls = 'gold'; }
                    else if (staked >= 1000) { tier = 'Silver'; cls = 'silver'; }
                    else { tier = 'Bronze'; cls = 'bronze'; }
                    badge.className = `staking-tier-badge ${cls}`;
                    badge.innerHTML = `<i class="fas fa-medal"></i> ${tier} Member`;
                }
                setInterval(updateStakingTier, 2000);

                // Withdrawal flow: add clear step-by-step UI hint
                const withdrawalForm = document.getElementById('withdrawal-form');
                if (withdrawalForm && !document.getElementById('withdrawal-steps-hint')) {
                    const hint = document.createElement('div');
                    hint.id = 'withdrawal-steps-hint';
                    hint.style.cssText = 'margin-bottom:20px;';
                    hint.innerHTML = `
                        <div class="withdrawal-step">
                            <div class="withdrawal-step-num">1</div>
                            <div><strong>Enter amount</strong><p style="margin:0;font-size:0.82rem;color:var(--text-muted);">Minimum 5 EMPY. Rate: 1 EMPY ≈ $0.10</p></div>
                        </div>
                        <div class="withdrawal-step">
                            <div class="withdrawal-step-num">2</div>
                            <div><strong>Select withdrawal method</strong><p style="margin:0;font-size:0.82rem;color:var(--text-muted);">Bank transfer, USDT, or Empyrean Card</p></div>
                        </div>
                        <div class="withdrawal-step">
                            <div class="withdrawal-step-num">3</div>
                            <div><strong>Admin approves within 24-48h</strong><p style="margin:0;font-size:0.82rem;color:var(--text-muted);">You'll receive a notification when processed</p></div>
                        </div>
                    `;
                    withdrawalForm.prepend(hint);
                }

                // Withdrawal form: validate against balance + add to admin queue
                if (withdrawalForm) {
                    withdrawalForm.addEventListener('submit', function(e2) {
                        const amountInput = document.getElementById('withdrawal-amount');
                        const amt = parseFloat(amountInput?.value || 0);
                        if (amt > (userState.empyBalance || 0)) {
                            e2.preventDefault();
                            e2.stopImmediatePropagation();
                            showNotification(`⚠️ Insufficient balance. You have ${(userState.empyBalance||0).toLocaleString()} EMPY.`, 'error');
                            return;
                        }
                        if (amt < 5) {
                            e2.preventDefault();
                            e2.stopImmediatePropagation();
                            showNotification('Minimum withdrawal is 5 EMPY.', 'error');
                            return;
                        }
                    }, true);
                }
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 11: GOOGLE AUTH -- handled by v5 fix block below
            // ═══════════════════════════════════════════════════════════
            (function() {
                // This block is intentionally left empty.
                // Google authentication is fully handled by the v5 comprehensive fix pack.
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 12: EMAIL VERIFICATION AFTER SIGNUP (Change #11)
            // ═══════════════════════════════════════════════════════════
            (function() {
                // Patch the signup form submit to send verification email
                const signupFeedback = document.getElementById('signup-feedback');
                const origSignupSubmit = document.getElementById('signup-form');
                if (!origSignupSubmit) return;

                origSignupSubmit.addEventListener('submit', function() {
                    // After a short delay (let main handler run first), check for unverified user
                    setTimeout(async () => {
                        const user = fbAuth.currentUser;
                        if (user && !user.emailVerified) {
                            try {
                                await user.sendEmailVerification();
                                // Show verification banner
                                const banner = document.createElement('div');
                                banner.style.cssText = `
                                    position:fixed;top:80px;left:50%;transform:translateX(-50%);
                                    background:white;border-radius:16px;padding:20px 28px;
                                    box-shadow:0 8px 40px rgba(0,0,0,0.2);z-index:99990;
                                    max-width:380px;width:90%;text-align:center;
                                    border-top:4px solid var(--accent);
                                `;
                                banner.innerHTML = `
                                    <i class="fas fa-envelope" style="font-size:2rem;color:var(--accent);margin-bottom:12px;display:block;"></i>
                                    <strong style="font-size:1.05rem;color:var(--primary);display:block;margin-bottom:8px;">Verify Your Email</strong>
                                    <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:16px;">A verification link has been sent to <strong>${user.email}</strong>. Please click the link to activate your account.</p>
                                    <button onclick="this.closest('[style]').remove();" style="background:var(--g-navy);color:white;border:none;border-radius:10px;padding:10px 24px;cursor:pointer;font-weight:600;">Got it</button>
                                `;
                                document.body.appendChild(banner);
                                // Auto-dismiss after 8 seconds with fade-out
                                setTimeout(function() {
                                    if (banner && banner.parentNode) {
                                        banner.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                                        banner.style.opacity = '0';
                                        banner.style.transform = 'translateX(-50%) translateY(-12px)';
                                        setTimeout(function() {
                                            if (banner && banner.parentNode) banner.remove();
                                        }, 620);
                                    }
                                }, 8000);
                            } catch(verErr) {
                                console.warn('Email verification send error:', verErr);
                            }
                        }
                    }, 2000);
                }, false);
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 13: SIGNUP BUTTON SPEED (Change #8 signup)
            // ═══════════════════════════════════════════════════════════
            (function() {
                // Remove any artificial delays on signup button
                const signupBtn = document.querySelector('#signup-form button[type="submit"]');
                if (signupBtn) {
                    // Ensure button responds immediately
                    signupBtn.style.transition = 'none';
                    signupBtn.addEventListener('mousedown', function() {
                        this.style.transform = 'scale(0.98)';
                    });
                    signupBtn.addEventListener('mouseup', function() {
                        this.style.transform = '';
                    });
                }
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 14: FONT FUNCTIONS -- ENSURE ALL ACTIVE (Change #5)
            // ═══════════════════════════════════════════════════════════
            (function() {
                const fontActivation = document.createElement('style');
                fontActivation.id = 'font-activation-override';
                fontActivation.textContent = `
                    /* Ensure Syne + Inter are active everywhere */
                    h1, h2, h3, .card > h3, .card-content h3,
                    .header h1, .sidebar-header h2,
                    .stat-card h4, .profile-header-info h1 {
                        font-family: 'Syne', sans-serif !important;
                        font-weight: 700 !important;
                    }
                    body, p, span, label, input, textarea, select, button, a,
                    .form-group label, .action-btn, .btn {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                    }
                    /* Bold / Italic / Strikethrough in post content */
                    .story-content strong, .comment-content strong { font-weight: 700 !important; }
                    .story-content em, .comment-content em { font-style: italic !important; }
                    .story-content s, .comment-content s { text-decoration: line-through !important; }
                    /* Format toolbar buttons */
                    #post-format-toolbar button[data-format="bold"] { font-weight: 900 !important; font-family: 'Inter', sans-serif !important; }
                    #post-format-toolbar button[data-format="italic"] { font-style: italic !important; font-family: 'Inter', sans-serif !important; }
                    /* Wallet balance */
                    #wallet-empy-balance, .empy-balance {
                        font-family: 'Syne', sans-serif !important;
                        font-weight: 800 !important;
                    }
                    /* Nav labels */
                    .sidebar-nav li a span:last-child {
                        font-family: 'Inter', sans-serif !important;
                        font-weight: 500 !important;
                    }
                    /* Post format toolbar active */
                    #post-format-toolbar { display: flex !important; gap: 4px; }
                    #post-format-toolbar button {
                        background: white !important;
                        border: 1.5px solid rgba(10,14,39,0.12) !important;
                        border-radius: 8px !important;
                        padding: 5px 12px !important;
                        cursor: pointer !important;
                        font-size: 0.88rem !important;
                        transition: all 0.15s !important;
                    }
                    #post-format-toolbar button:hover {
                        background: rgba(27,43,139,0.08) !important;
                        border-color: var(--secondary) !important;
                    }
                    #create-post-form #post-format-toolbar {
                        position: static !important;
                        transform: none !important;
                        margin-bottom: 8px !important;
                        background: rgba(10,14,39,0.03) !important;
                        padding: 8px 12px !important;
                        border-radius: 12px !important;
                    }
                `;
                document.head.appendChild(fontActivation);

                // Activate the post format toolbar properly
                const formatToolbar = document.getElementById('post-format-toolbar');
                const postTextarea = document.getElementById('post-text');
                if (formatToolbar && postTextarea) {
                    formatToolbar.querySelectorAll('button[data-format]').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const fmt = this.dataset.format;
                            const start = postTextarea.selectionStart;
                            const end = postTextarea.selectionEnd;
                            const selected = postTextarea.value.substring(start, end);
                            let wrapped = '';
                            if (fmt === 'bold') wrapped = `*${selected}*`;
                            else if (fmt === 'italic') wrapped = `_${selected}_`;
                            else if (fmt === 'strike') wrapped = `~${selected}~`;
                            postTextarea.value = postTextarea.value.substring(0, start) + wrapped + postTextarea.value.substring(end);
                            postTextarea.focus();
                            postTextarea.selectionStart = start + 1;
                            postTextarea.selectionEnd = end + 1;
                        });
                    });
                }
            })();

            // ═══════════════════════════════════════════════════════════
            // FIX 15: NAVIGATION BAR -- SEAMLESS ROUTING (Change #2)

            // ── ADMIN ANNOUNCEMENT HANDLER ─────────────────────────────
            (function() {
                document.addEventListener('submit', function(e) {
                    if (!e.target || e.target.id !== 'admin-announce-form') return;
                    e.preventDefault();
                    var type  = document.getElementById('announce-type')?.value || 'announcement';
                    var title = (document.getElementById('announce-title')?.value || '').trim();
                    var body  = (document.getElementById('announce-body')?.value || '').trim();
                    if (!title && !body) { if (typeof showNotification === 'function') showNotification('Add a title or message.', 'error'); return; }

                    var iconClass = { announcement:'fa-bullhorn', appreciation:'fa-award', update:'fa-bell', 'sos-thanks':'fa-heart' };
                    var icon = '<i class="fas ' + (iconClass[type] || 'fa-bullhorn') + '" style="color:var(--secondary);margin-right:4px;"></i>';
                    var iconText = { announcement:'[Announcement]', appreciation:'[Appreciation]', update:'[Update]', 'sos-thanks':'[SOS Thanks]' };
                    var iconPlain = iconText[type] || '[Notice]';

                    var list = document.getElementById('admin-announcements-list');
                    if (list) {
                        // Remove empty state
                        var ep = list.querySelector('p');
                        if (ep) ep.remove();
                        var item = document.createElement('div');
                        item.style.cssText = 'background:white;border-radius:14px;padding:16px;border:1px solid rgba(10,14,39,0.06);box-shadow:0 2px 8px rgba(0,0,0,0.05);';
                        item.innerHTML =
                            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                            '<strong style="font-size:0.95rem;color:var(--primary);">' + icon + (title || type) + '</strong>' +
                                '<div style="display:flex;gap:6px;align-items:center;">' +
                                    '<span style="font-size:0.75rem;color:var(--text-muted);">' + new Date().toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) + '</span>' +
                                    '<button onclick="this.parentElement.parentElement.remove();" style="background:rgba(239,68,68,0.12);border:none;color:#EF4444;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:0.75rem;"><i class=\"fas fa-trash\"></i></button>' +
                                '</div>' +
                            '</div>' +
                            (body ? '<p style="font-size:0.85rem;color:#555;margin:0;line-height:1.5;">' + body + '</p>' : '');
                        list.prepend(item);

                        // Also push to community feed as a post
                        var feedContainer = document.getElementById('feed-container');
                        if (feedContainer && typeof createNewPostElement === 'function') {
                            var announcePost = createNewPostElement(
                                iconPlain + ' **' + title + '**\n\n' + body,
                                [],
                                { id: 'admin-user', fullName: 'Empyrean Admin', avatar: 'https://ui-avatars.com/api/?name=EA&background=5B0EA6&color=fff&size=150' }
                            );
                            feedContainer.prepend(announcePost);
                            var emptyState = document.getElementById('feed-empty-state');
                            if (emptyState) emptyState.style.display = 'none';
                        }

                        // Save to Firestore
                        try {
                            if (window.fbDb) {
                                window.fbDb.collection('announcements').add({
                                    type, title, body,
                                    createdAt: new Date().toISOString(),
                                    adminId: window.userState && window.userState.id
                                }).catch(function(){});
                                // Push notification to all users
                                window.fbDb.collection('notifications').add({
                                    type: 'announcement',
                                    message: iconPlain + ' Admin Announcement: ' + title,
                                    createdAt: new Date().toISOString(), read: false
                                }).catch(function(){});
                                // Also push to bell for current session
                                if (typeof window.pushNotification === 'function') {
                                    window.pushNotification(iconPlain + ' ' + title, 'announcement');
                                }
                            }
                        } catch(e) {}
                    }

                    // Handle media upload -- upload to Cloudinary and embed in feed post
                    var mediaInput = document.getElementById('announce-media-input');
                    if (mediaInput && mediaInput.files.length > 0 && typeof window.uploadToCloudinary === 'function') {
                        var announceFiles = Array.from(mediaInput.files);
                        var uploadPromises = announceFiles.map(function(file) {
                            return window.uploadToCloudinary(file, null).catch(function() {
                                return URL.createObjectURL(file);
                            });
                        });
                        Promise.all(uploadPromises).then(function(cloudUrls) {
                            // Re-create the feed post with actual media
                            var feedContainer = document.getElementById('feed-container');
                            if (feedContainer && typeof createNewPostElement === 'function') {
                                var mediaFiles = announceFiles.map(function(f, i) {
                                    f._cloudUrl = cloudUrls[i];
                                    return f;
                                });
                                var mediaPost = createNewPostElement(
                                    icon + ' ' + title + '\n\n' + body,
                                    mediaFiles,
                                    { id: 'admin-user', fullName: 'Empyrean Admin', avatar: 'https://ui-avatars.com/api/?name=EA&background=5B0EA6&color=fff&size=150' }
                                );
                                // Replace the placeholder post (first child) with the media post
                                if (feedContainer.firstChild) feedContainer.replaceChild(mediaPost, feedContainer.firstChild);
                            }
                            // Save media URLs to Firestore
                            try {
                                if (window.fbDb) {
                                    window.fbDb.collection('announcements').add({
                                        type: type, title: title, body: body,
                                        media: cloudUrls,
                                        createdAt: new Date().toISOString(),
                                        adminId: window.userState && window.userState.id
                                    }).catch(function(){});
                                }
                            } catch(e) {}
                            if (typeof showNotification === 'function') showNotification('☁ Media uploaded and attached to announcement!', 'success');
                        });
                    }

                    e.target.reset();
                    document.getElementById('announce-media-preview').innerHTML = '';
                    if (typeof showNotification === 'function') showNotification('✅ Announcement published to community feed!', 'success');
                });

                // Preview media for announcement
                document.addEventListener('change', function(e) {
                    if (!e.target || e.target.id !== 'announce-media-input') return;
                    var preview = document.getElementById('announce-media-preview');
                    if (!preview) return;
                    preview.innerHTML = '';
                    Array.from(e.target.files).forEach(function(file) {
                        var url = URL.createObjectURL(file);
                        var div = document.createElement('div');
                        div.style.cssText = 'width:80px;height:80px;border-radius:8px;overflow:hidden;';
                        div.innerHTML = file.type.startsWith('video/')
                            ? '<video src="'+url+'" style="width:100%;height:100%;object-fit:cover;" muted></video>'
                            : '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;">';
                        preview.appendChild(div);
                    });
                });
            })();

            // ═══════════════════════════════════════════════════════════
            (function() {
                // ── Mobile bottom nav CSS (injected once) ──────────────────
                if (!document.getElementById('empyrean-mobile-nav-style')) {
                    const navStyle = document.createElement('style');
                    navStyle.id = 'empyrean-mobile-nav-style';
                    navStyle.textContent = `
                        /* Sidebar active indicator */
                        .sidebar-nav li { position: relative; }
                        .sidebar-nav li a.active { background: rgba(27,43,139,0.12) !important; }
                        .sidebar-nav li a.active::before {
                            content: ''; position: absolute; left: 0; top: 50%;
                            transform: translateY(-50%); width: 3px; height: 60%;
                            border-radius: 0 3px 3px 0; background: var(--accent);
                        }
                        /* Bottom nav -- BOTTOM of screen */
                        #mobile-bottom-nav {
                            display: none;
                            position: fixed;
                            bottom: 0; left: 0; right: 0; top: auto;
                            background: white;
                            border-top: 1px solid rgba(10,14,39,0.08);
                            border-bottom: none;
                            padding: 6px 0 calc(env(safe-area-inset-bottom) + 6px);
                            z-index: 600;
                            box-shadow: 0 -4px 20px rgba(10,14,39,0.08);
                        }
                        @media (max-width: 992px) {
                            #mobile-bottom-nav {
                                display: flex !important;
                                overflow-x: auto;
                                overflow-y: hidden;
                                -webkit-overflow-scrolling: touch;
                                scrollbar-width: none; /* Firefox */
                            }
                            #mobile-bottom-nav::-webkit-scrollbar {
                                display: none; /* Chrome/Safari/Edge */
                            }
                            .main-content {
                                padding-top: 0 !important;
                                padding-bottom: 72px !important;
                            }
                        }
                        .mobile-nav-item {
                            display: flex; flex-direction: column; align-items: center;
                            gap: 3px; padding: 4px 8px; border-radius: 10px;
                            cursor: pointer; font-size: 0.58rem; font-weight: 600;
                            color: var(--text-muted); transition: all 0.2s;
                            border: none; background: none;
                            flex: 0 0 auto; /* Don't shrink, maintain size */
                            min-width: 62px;
                            -webkit-tap-highlight-color: transparent;
                        }
                        .mobile-nav-item i { font-size: 1.15rem; transition: transform 0.15s; }
                        .mobile-nav-item.active { color: var(--secondary); }
                        .mobile-nav-item.active i {
                            color: var(--secondary);
                            transform: scale(1.15);
                        }
                        .mobile-nav-item span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
                        /* Section transition */
                        .content-section {
                            animation: fadeInSection 0.2s ease;
                        }
                        @keyframes fadeInSection {
                            from { opacity: 0; transform: translateY(6px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                        /* Breadcrumb */
                        #nav-breadcrumb {
                            font-size: 0.78rem; color: var(--text-muted);
                            padding: 7px 20px;
                            background: rgba(10,14,39,0.02);
                            border-bottom: 1px solid rgba(10,14,39,0.05);
                            display: flex; align-items: center; gap: 6px;
                        }
                        /* Quick post FAB -- base positioning applied via CSS so it's
                           correct even before the IIFE wires it up fully */
                        #quick-post-fab {
                            position: fixed !important;
                            bottom: 90px !important;
                            right: 20px !important;
                            width: 60px !important;
                            height: 60px !important;
                            border-radius: 50% !important;
                            background: linear-gradient(135deg, #5B0EA6, #1B2B8B) !important;
                            color: white !important;
                            border: none !important;
                            box-shadow: 0 6px 24px rgba(91,14,166,0.55) !important;
                            cursor: grab !important;
                            font-size: 22px !important;
                            z-index: 9999 !important;
                            transition: box-shadow 0.2s, transform 0.2s !important;
                            align-items: center !important;
                            justify-content: center !important;
                            animation: fadeInUp 0.4s ease;
                        }
                        .quick-post-close:hover {
                            background: rgba(10,14,39,0.08) !important;
                        }
                        .quick-media-btn:hover {
                            background: rgba(27,43,139,0.15) !important;
                            transform: translateY(-1px);
                        }
                        @keyframes fadeInUp {
                            from { opacity: 0; transform: translateY(20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @media (max-width: 768px) {
                            #quick-post-fab {
                                /* Stay bottom-right on mobile; lift further above bottom nav */
                                bottom: 80px !important;
                                right: 14px !important;
                                width: 54px !important;
                                height: 54px !important;
                                font-size: 20px !important;
                            }
                            .quick-post-container {
                                margin: 10px;
                                max-height: 95vh !important;
                            }
                        }
                    `;
                    document.head.appendChild(navStyle);
                }

                // ── 8 priority bottom nav items ─────────────────────────────
                // Build dynamically based on auth state

                // ── FLOATING QUICK POST BUTTON ──────────────────────────────
                (function() {
                    // Guard: skip only if already fully initialised (modal already in DOM).
                    // Do NOT bail just because the button element exists -- the HTML already
                    // has #quick-post-fab but with no click handler, modal, or drag logic.
                    if (document.getElementById('quick-post-modal')) return;

                    // Reuse the existing HTML element if present, otherwise create it.
                    var fab = document.getElementById('quick-post-fab');
                    if (!fab) {
                        fab = document.createElement('button');
                        fab.id = 'quick-post-fab';
                        document.body.appendChild(fab);
                    }

                    // Apply full styling (positions and sizes the button correctly).
                    // "display:none" on start -- updateQuickPostFab() shows it when on dashboard.
                    fab.innerHTML = '<i class="fas fa-edit"></i>';
                    fab.title = 'Create Post';
                    fab.style.cssText = `
                        position: fixed;
                        bottom: 90px;
                        right: 20px;
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #5B0EA6, #1B2B8B);
                        color: white;
                        border: none;
                        box-shadow: 0 6px 24px rgba(91,14,166,0.55);
                        cursor: pointer;
                        font-size: 22px;
                        z-index: 9999;
                        transition: box-shadow 0.2s, transform 0.2s;
                        display: none;
                        align-items: center;
                        justify-content: center;
                    `;

                    // ── Make the quick-post FAB clickable (NO dragging to avoid conflicts) ──
                    fab.addEventListener('click', function(e) {
                        e.stopPropagation();
                        // Populate avatar/name at open-time when userState IS available
                        var us = window.userState;
                        var avatarEl = document.getElementById('quick-post-avatar');
                        var nameEl   = document.getElementById('quick-post-username');
                        if (us && us.id) {
                            if (avatarEl) avatarEl.src = us.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(us.fullName || 'User') + '&background=5B0EA6&color=fff&size=150');
                            if (nameEl)   nameEl.textContent = us.fullName || us.username || 'You';
                        }
                        modal.style.display = 'flex';
                        document.body.style.overflow = 'hidden';
                        var textArea = document.getElementById('quick-post-text');
                        if (textArea) setTimeout(function() { textArea.focus(); }, 80);
                    });
                    
                    // Hover glow effect
                    fab.addEventListener('mouseenter', function() {
                        fab.style.boxShadow = '0 8px 32px rgba(91,14,166,0.75)';
                        fab.style.transform = 'scale(1.1)';
                    });
                    fab.addEventListener('mouseleave', function() {
                        fab.style.boxShadow = '0 6px 24px rgba(91,14,166,0.55)';
                        fab.style.transform = 'scale(1)';
                    });

                    // Create quick post modal
                    const modal = document.createElement('div');
                    modal.id = 'quick-post-modal';
                    modal.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.6);
                        backdrop-filter: blur(4px);
                        z-index: 10000;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    `;
                    
                    modal.innerHTML = `
                        <div class="quick-post-container" style="
                            background: white;
                            border-radius: 16px;
                            max-width: 600px;
                            width: 100%;
                            max-height: 90vh;
                            overflow-y: auto;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                            position: relative;
                        ">
                            <div class="quick-post-header" style="
                                padding: 16px 20px;
                                border-bottom: 1px solid rgba(10,14,39,0.1);
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                position: sticky;
                                top: 0;
                                background: white;
                                z-index: 10;
                                border-radius: 16px 16px 0 0;
                            ">
                                <h3 style="margin: 0; font-size: 1.1rem; color: var(--primary);">
                                    <i class="fas fa-edit"></i> Create Post
                                </h3>
                                <button class="quick-post-close" style="
                                    background: none;
                                    border: none;
                                    font-size: 24px;
                                    color: var(--text-muted);
                                    cursor: pointer;
                                    width: 32px;
                                    height: 32px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    border-radius: 50%;
                                    transition: all 0.2s;
                                ">×</button>
                            </div>
                            
                            <div class="quick-post-body" style="padding: 20px;">
                                <div class="quick-post-author" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 12px;
                                    margin-bottom: 16px;
                                ">
                                    <img id="quick-post-avatar" src="https://ui-avatars.com/api/?name=User&background=5B0EA6&color=fff&size=150"
                                        style="
                                            width: 48px;
                                            height: 48px;
                                            border-radius: 50%;
                                            object-fit: cover;
                                        ">
                                    <div>
                                        <strong id="quick-post-username" style="color: var(--primary); font-size: 0.95rem;">You</strong>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">Public post</div>
                                    </div>
                                </div>
                                
                                <form id="quick-post-form" novalidate>
                                    <textarea id="quick-post-text" 
                                        placeholder="What's on your mind?" 
                                        style="
                                            width: 100%;
                                            min-height: 130px;
                                            border: none;
                                            outline: none;
                                            resize: vertical;
                                            font-size: 1rem;
                                            font-family: inherit;
                                            color: var(--text);
                                            margin-bottom: 12px;
                                            padding-bottom: 16px;
                                        "
                                    ></textarea>
                                    <div style="height:18px;border-bottom:1px solid rgba(10,14,39,0.07);margin-bottom:14px;"></div>
                                    
                                    <div id="quick-post-media-preview" style="
                                        display: grid;
                                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                                        gap: 10px;
                                        margin-bottom: 16px;
                                    "></div>
                                    
                                    <div class="quick-post-actions" style="
                                        display: flex;
                                        align-items: center;
                                        justify-content: space-between;
                                        padding: 12px 0;
                                        border-top: 1px solid rgba(10,14,39,0.1);
                                    ">
                                        <div style="display: flex; gap: 8px;">
                                            <label class="quick-media-btn" style="
                                                cursor: pointer;
                                                padding: 8px 12px;
                                                border-radius: 8px;
                                                background: rgba(27,43,139,0.08);
                                                color: var(--secondary);
                                                display: flex;
                                                align-items: center;
                                                gap: 6px;
                                                font-size: 0.85rem;
                                                font-weight: 600;
                                                transition: all 0.2s;
                                            ">
                                                <i class="fas fa-image"></i> Photo
                                                <input type="file" id="quick-post-media" accept="image/*" multiple style="display: none;">
                                            </label>
                                            <label class="quick-media-btn" style="
                                                cursor: pointer;
                                                padding: 8px 12px;
                                                border-radius: 8px;
                                                background: rgba(27,43,139,0.08);
                                                color: var(--secondary);
                                                display: flex;
                                                align-items: center;
                                                gap: 6px;
                                                font-size: 0.85rem;
                                                font-weight: 600;
                                                transition: all 0.2s;
                                            ">
                                                <i class="fas fa-video"></i> Video
                                                <input type="file" id="quick-post-video" accept="video/*" multiple style="display: none;">
                                            </label>
                                        </div>
                                        
                                        <button type="submit" class="btn btn-primary" style="
                                            padding: 10px 24px;
                                            border-radius: 50px;
                                            font-weight: 700;
                                            font-size: 0.9rem;
                                        ">
                                            <i class="fas fa-paper-plane"></i> Post
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    `;
                    
                    document.body.appendChild(modal);
                    
                    // Close modal handlers
                    function closeQuickPostModal() {
                        modal.style.display = 'none';
                        document.body.style.overflow = '';
                        document.body.classList.remove('modal-open');
                    }
                    modal.querySelector('.quick-post-close').addEventListener('click', closeQuickPostModal);
                    modal.addEventListener('click', function(e) {
                        if (e.target === modal) closeQuickPostModal();
                    });
                    
                    // Media preview handling
                    let quickPostMediaFiles = [];
                    
                    // ── VIDEO / IMAGE FULL-SCREEN LIGHTBOX ──────────────────
                    function _openVideoLightbox(src, title) {
                        var ex = document.getElementById('_qp_video_lb');
                        if (ex) ex.remove();
                        var lb = document.createElement('div');
                        lb.id = '_qp_video_lb';
                        lb.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;';
                        var closeBtn = document.createElement('button');
                        closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.15);border:none;color:white;border-radius:50%;width:40px;height:40px;font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;';
                        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
                        var vid = document.createElement('video');
                        vid.src = src;
                        vid.controls = true;
                        vid.autoplay = true;
                        vid.setAttribute('playsinline', '');
                        vid.style.cssText = 'max-width:100%;max-height:calc(100vh - 60px);outline:none;border-radius:6px;';
                        lb.appendChild(closeBtn);
                        lb.appendChild(vid);
                        if (title) {
                            var cap = document.createElement('div');
                            cap.style.cssText = 'color:rgba(255,255,255,0.55);font-size:0.78rem;margin-top:10px;text-align:center;padding:0 16px;';
                            cap.textContent = title;
                            lb.appendChild(cap);
                        }
                        document.body.appendChild(lb);
                        closeBtn.onclick = function() { lb.remove(); };
                        lb.addEventListener('click', function(e) { if (e.target === lb) lb.remove(); });
                        document.addEventListener('keydown', function _lbKey(e) {
                            if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', _lbKey); }
                        });
                    }

                    function _openImageLightbox(src) {
                        var ex = document.getElementById('_qp_image_lb');
                        if (ex) ex.remove();
                        var lb = document.createElement('div');
                        lb.id = '_qp_image_lb';
                        lb.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;';
                        var closeBtn = document.createElement('button');
                        closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.15);border:none;color:white;border-radius:50%;width:40px;height:40px;font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;';
                        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
                        var img = document.createElement('img');
                        img.src = src;
                        img.style.cssText = 'max-width:98vw;max-height:92vh;object-fit:contain;border-radius:6px;';
                        lb.appendChild(closeBtn);
                        lb.appendChild(img);
                        document.body.appendChild(lb);
                        closeBtn.onclick = function() { lb.remove(); };
                        lb.addEventListener('click', function(e) { if (e.target === lb) lb.remove(); });
                        document.addEventListener('keydown', function _ilbKey(e) {
                            if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', _ilbKey); }
                        });
                    }

                    function updateQuickPostMediaPreview() {
                        const preview = document.getElementById('quick-post-media-preview');
                        if (!preview) return;
                        preview.innerHTML = '';
                        
                        quickPostMediaFiles.forEach(function(file, index) {
                            const wrapper = document.createElement('div');
                            wrapper.style.cssText = 'position: relative; border-radius: 8px; overflow: hidden; aspect-ratio: 1;';
                            
                            const isVideo = file.type.startsWith('video/');
                            const url = URL.createObjectURL(file);
                            
                            if (isVideo) {
                                var vid2 = document.createElement('video');
                                vid2.src = url;
                                vid2.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                                vid2.preload = 'metadata';
                                wrapper.appendChild(vid2);
                                var badge = document.createElement('div');
                                badge.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.7);color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;';
                                badge.innerHTML = '<i class="fas fa-video"></i>';
                                wrapper.appendChild(badge);
                                var playOverlay = document.createElement('div');
                                playOverlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(0,0,0,0.15);';
                                playOverlay.innerHTML = '<div style="width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;"><i class="fas fa-play" style="color:white;font-size:1rem;margin-left:3px;"></i></div>';
                                (function(u, fname) {
                                    playOverlay.addEventListener('click', function(e) { e.stopPropagation(); _openVideoLightbox(u, fname); });
                                })(url, file.name || 'Video');
                                wrapper.appendChild(playOverlay);
                            } else {
                                var img2 = document.createElement('img');
                                img2.src = url;
                                img2.style.cssText = 'width:100%;height:100%;object-fit:cover;cursor:pointer;';
                                img2.title = 'Click to expand';
                                (function(u) {
                                    img2.addEventListener('click', function(e) { e.stopPropagation(); _openImageLightbox(u); });
                                })(url);
                                wrapper.appendChild(img2);
                            }
                            
                            const removeBtn = document.createElement('button');
                            removeBtn.innerHTML = '×';
                            removeBtn.style.cssText = `
                                position: absolute;
                                top: 4px;
                                right: 4px;
                                width: 24px;
                                height: 24px;
                                border-radius: 50%;
                                background: rgba(0,0,0,0.7);
                                color: white;
                                border: none;
                                cursor: pointer;
                                font-size: 18px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            `;
                            removeBtn.addEventListener('click', function() {
                                quickPostMediaFiles.splice(index, 1);
                                updateQuickPostMediaPreview();
                            });
                            
                            wrapper.appendChild(removeBtn);
                            preview.appendChild(wrapper);
                        });
                    }
                    
                    document.getElementById('quick-post-media').addEventListener('change', function(e) {
                        Array.from(e.target.files).forEach(function(file) {
                            quickPostMediaFiles.push(file);
                        });
                        updateQuickPostMediaPreview();
                        e.target.value = '';
                    });
                    
                    document.getElementById('quick-post-video').addEventListener('change', function(e) {
                        Array.from(e.target.files).forEach(function(file) {
                            quickPostMediaFiles.push(file);
                        });
                        updateQuickPostMediaPreview();
                        e.target.value = '';
                    });
                    
                    // Form submission
                    document.getElementById('quick-post-form').addEventListener('submit', async function(e) {
                        e.preventDefault();

                        // Guest users must log in before posting
                        if (window.isGuest || !userState || !userState.id) {
                            var qModal = document.getElementById('quick-post-modal');
                            if (qModal) { qModal.style.display = 'none'; document.body.classList.remove('modal-open'); }
                            if (typeof showNotification === 'function') showNotification('Please log in to create a post.', 'info');
                            if (typeof navigateTo === 'function') navigateTo('login');
                            return;
                        }
                        
                        const text = document.getElementById('quick-post-text').value.trim();
                        
                        if (!text && quickPostMediaFiles.length === 0) {
                            if (typeof showNotification === 'function') showNotification('Post cannot be empty.', 'error');
                            return;
                        }
                        
                        const submitBtn = this.querySelector('button[type="submit"]');
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
                        
                        try {
                            // Wait for uploadToCloudinary to be available
                            let waitTime = 0;
                            while (typeof window.uploadToCloudinary !== 'function' && waitTime < 5000) {
                                await new Promise(r => setTimeout(r, 200));
                                waitTime += 200;
                            }
                            
                            if (quickPostMediaFiles.length > 0 && typeof showNotification === 'function') {
                                showNotification('Uploading media...', 'info');
                            }
                            
                            // Upload media files
                            const cloudUrls = [];
                            if (quickPostMediaFiles.length > 0) {
                                try {
                                    if (typeof window.uploadMediaFilesToCloudinary === 'function') {
                                        const urls = await window.uploadMediaFilesToCloudinary(quickPostMediaFiles);
                                        cloudUrls.push(...urls.filter(u => u && !u.startsWith('blob:')));
                                    } else if (typeof window.uploadToCloudinary === 'function') {
                                        for (const file of quickPostMediaFiles) {
                                            try {
                                                const url = await window.uploadToCloudinary(file);
                                                if (url && !url.startsWith('blob:')) cloudUrls.push(url);
                                            } catch(e) {
                                                console.warn('Upload failed for file:', e);
                                            }
                                        }
                                    }
                                    if (cloudUrls.length === 0 && text) {
                                        showNotification('Media upload failed — posting as text only.', 'warning');
                                    } else if (cloudUrls.length === 0) {
                                        showNotification('Media upload failed. Please try again.', 'error');
                                        return;
                                    }
                                } catch(uploadErr) {
                                    console.warn('[QuickPost] Media upload error:', uploadErr.message);
                                    if (!text) {
                                        showNotification('Media upload failed. Please try again.', 'error');
                                        return;
                                    }
                                    showNotification('Media upload failed — posting as text only.', 'warning');
                                }
                            }
                            
                            // Create post object
                            const postId = 'post-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                            const postDoc = {
                                id: postId,
                                userId: userState.id,
                                username: userState.fullName || userState.username,
                                avatar: userState.avatar || '',
                                text: text,
                                media: cloudUrls,
                                createdAt: new Date().toISOString(),
                                likes: 0
                            };
                            
                            // Save to Firestore
                            if (window._firebaseLoaded && window.fbDb) {
                                await window.fbDb.collection('posts').doc(postId).set(postDoc);
                                // Process @mention notifications + #hashtag trending
                                if (typeof window._processPostTags === 'function') {
                                    window._processPostTags(text, userState.fullName || userState.username);
                                }
                            }

                            // Also inject into profile feeds if they exist in the DOM right now
                            try {
                                var _qpEl = (typeof createNewPostElement === 'function') ? createNewPostElement(text,
                                    cloudUrls.map(function(u){ return { _cloudUrl:u, url:u, type:(/\.(mp4|webm|mov)(\?|$)/i.test(u)||/\/video\/upload\//i.test(u))?'video/mp4':'image/jpeg'}; }),
                                    { id: userState.id, fullName: userState.fullName || userState.username, avatar: userState.avatar || '' }
                                ) : null;
                                if (_qpEl) {
                                    _qpEl.dataset.postId = postId;
                                    _qpEl.dataset.userId = userState.id;
                                    var _ppf = document.getElementById('profile-posts-feed');
                                    var _pdf = document.getElementById('profile-dash-feed');
                                    if (_ppf && !_ppf.querySelector('[data-post-id="'+postId+'"]')) _ppf.prepend(_qpEl.cloneNode(true));
                                    if (_pdf && !_pdf.querySelector('[data-post-id="'+postId+'"]')) _pdf.prepend(_qpEl.cloneNode(true));
                                    var _pe = document.getElementById('profile-posts-empty');
                                    if (_pe) _pe.style.display = 'none';
                                }
                            } catch(_qpErr) { console.warn('[QuickPost] Profile feed inject:', _qpErr.message); }
                            
                            // Close modal and reset -- also restore body scroll so sidebar never freezes
                            modal.style.display = 'none';
                            document.body.style.overflow = '';
                            document.getElementById('quick-post-text').value = '';
                            quickPostMediaFiles = [];
                            updateQuickPostMediaPreview();
                            
                            if (typeof showNotification === 'function') {
                                showNotification('✅ Post published successfully!', 'success');
                            }

                            // Immediately add media to gallery using cloudUrls -- no DOM-scan race
                            if (cloudUrls.length > 0) {
                                _addUrlsToProfileGallery(
                                    cloudUrls.filter(function(u){return u&&!u.startsWith('blob:');})
                                );
                            }
                            
                            // Navigate to dashboard to see the post
                            if (typeof navigateTo === 'function') navigateTo('dashboard');
                            
                        } catch(err) {
                            console.error('Quick post error:', err);
                            if (typeof showNotification === 'function') {
                                showNotification('Failed to publish post. Please try again.', 'error');
                            }
                        } finally {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post';
                        }
                    });
                    
                    console.log('[QuickPost] ✅ Floating post button initialized');
                    // Show immediately if we are already on the dashboard
                    (function() {
                        var activeSection = document.querySelector('.content-section.active');
                        var currentId = activeSection ? activeSection.id : 'dashboard';
                        if (typeof updateQuickPostFab === 'function') updateQuickPostFab(currentId);
                        else if (typeof window.updateQuickPostFab === 'function') window.updateQuickPostFab(currentId);
                    })();
                })();

                // ── Breadcrumb ───────────────────────────────────────────────
                const mainContentEl = document.querySelector('.main-content');
                if (mainContentEl && !document.getElementById('nav-breadcrumb')) {
                    const breadcrumb = document.createElement('div');
                    breadcrumb.id = 'nav-breadcrumb';
                    breadcrumb.innerHTML = '<i class="fas fa-home" style="color:var(--secondary);"></i> <span id="breadcrumb-text">Dashboard</span>';
                    const statusBar = document.getElementById('status-bar-container');
                    if (statusBar) statusBar.before(breadcrumb);
                    else mainContentEl.prepend(breadcrumb);
                }

                // Patch navigateTo to update breadcrumb + mobile nav
                const sectionLabels = {
                    dashboard:'Dashboard', 'my-wallet':'My Wallet', messages:'Messages',
                    marketplace:'Marketplace', reels:'Reels', news:'News', profile:'Profile',
                    'go-live':'Go Live', 'request-help':'Request Help', 'report-crisis':'Report Crisis',
                    admin:'Admin Panel', settings:'Settings', 'grant-portal':'Grant Portal',
                    'community-tasks':'Community Tasks', 'ngo-partners':'NGO Partners',
                    'business-page':'Business Page'
                };
                // navigateTo breadcrumb/mobile nav -- now built into core navigateTo function above
                // (removed duplicate wrapper to prevent freeze from nested call chains)
            })();

            // ── story-header click → profile ─────────────────────────
            document.addEventListener('click',function(e){
                var sh=e.target.closest('.story-header');if(!sh)return;
                if(e.target.closest('.post-options,.options-btn,.options-menu'))return;
                var ca=e.target.closest('.avatar-placeholder')||(e.target.tagName==='IMG'&&e.target.closest('.story-header'));
                var cn=e.target.closest('.story-user-info strong')||e.target.closest('.story-user-info span');
                if(!ca&&!cn)return;
                var post=sh.closest('.impact-story,.news-list-item');if(!post)return;
                var uid=post.dataset.userId||post.dataset.authorId;if(!uid)return;
                e.preventDefault();e.stopPropagation();
                if(window.userState&&uid===window.userState.id){
                    window._viewingOtherProfile=false;
                    if(typeof navigateTo==='function')navigateTo('profile');
                    return;
                }
                window._viewingOtherProfile=true;
                if(typeof renderUserProfile==='function')renderUserProfile(uid);
                if(typeof navigateTo==='function')navigateTo('profile');
                setTimeout(function(){window._viewingOtherProfile=false;},500);
            });

            // ── Media lightbox ────────────────────────────────────────
            (function initMediaLightbox(){
                if(window._mlbReady)return;window._mlbReady=true;
                var lb=document.createElement('div');lb.id='media-lightbox';
                lb.style.cssText='display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.96);flex-direction:column;align-items:center;justify-content:center;touch-action:none;';
                lb.innerHTML='<div style="position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(to bottom,rgba(0,0,0,0.7),transparent);z-index:2;">'
                    +'<span id="lb-ctr" style="color:rgba(255,255,255,0.75);font-size:0.85rem;font-weight:600;"></span>'
                    +'<div style="display:flex;gap:10px;">'
                    +'<button id="lb-dl" style="background:rgba(255,255,255,0.15);border:none;color:white;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="fas fa-download"></i></button>'
                    +'<button id="lb-x" style="background:rgba(255,255,255,0.15);border:none;color:white;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;">&#10005;</button>'
                    +'</div></div>'
                    +'<button id="lb-p" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;color:white;width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:1.5rem;display:flex;align-items:center;justify-content:center;z-index:2;">&#8249;</button>'
                    +'<div id="lb-stage" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:60px 60px 48px;box-sizing:border-box;">'
                    +'<img id="lb-img" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;display:none;transition:opacity 0.2s;" alt="">'
                    +'<video id="lb-vid" style="max-width:100%;max-height:100%;border-radius:8px;display:none;" controls playsinline></video>'
                    +'</div>'
                    +'<button id="lb-n" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;color:white;width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:1.5rem;display:flex;align-items:center;justify-content:center;z-index:2;">&#8250;</button>'
                    +'<div id="lb-dots" style="position:absolute;bottom:14px;left:0;right:0;display:flex;justify-content:center;gap:6px;z-index:2;"></div>';
                document.body.appendChild(lb);
                var _img=lb.querySelector('#lb-img'),_vid=lb.querySelector('#lb-vid'),_ctr=lb.querySelector('#lb-ctr'),_dots=lb.querySelector('#lb-dots');
                var _its=[],_i=0;
                function _open(items,start){_its=items;_i=start||0;lb.style.display='flex';document.body.style.overflow='hidden';_render();lb.querySelector('#lb-p').style.display=_its.length>1?'flex':'none';lb.querySelector('#lb-n').style.display=_its.length>1?'flex':'none';}
                function _close(){lb.style.display='none';_vid.pause();_vid.src='';_img.src='';document.body.style.overflow='';}
                function _render(){var it=_its[_i];if(!it)return;_img.style.display='none';_vid.style.display='none';_vid.pause();if(it.type==='video'){_vid.src=it.src;_vid.style.display='block';}else{_img.style.opacity='0';_img.src=it.src;_img.style.display='block';_img.onload=function(){_img.style.opacity='1';};}
                    _ctr.textContent=_its.length>1?(_i+1)+' / '+_its.length:'';
                    _dots.innerHTML='';if(_its.length>1){_its.forEach(function(_,j){var d=document.createElement('div');d.style.cssText='width:'+(j===_i?'20px':'7px')+';height:7px;border-radius:4px;background:'+(j===_i?'white':'rgba(255,255,255,0.35)')+';transition:all 0.25s;cursor:pointer;flex-shrink:0;';(function(ji){d.onclick=function(){_i=ji;_render();};})(j);_dots.appendChild(d);});}
                    lb.querySelector('#lb-dl').onclick=function(){var a=document.createElement('a');a.href=it.src;a.download='empyrean-media-'+(_i+1);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();};}
                function _step(dir){_i=(_i+dir+_its.length)%_its.length;_render();}
                lb.querySelector('#lb-x').onclick=_close;lb.onclick=function(e){if(e.target===lb)_close();};lb.querySelector('#lb-p').onclick=function(e){e.stopPropagation();_step(-1);};lb.querySelector('#lb-n').onclick=function(e){e.stopPropagation();_step(1);};
                document.addEventListener('keydown',function(e){if(lb.style.display==='none')return;if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();_step(1);}else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();_step(-1);}else if(e.key==='Escape')_close();});
                var _tx=0,_ty=0;
                lb.addEventListener('touchstart',function(e){_tx=e.touches[0].clientX;_ty=e.touches[0].clientY;},{passive:true});
                lb.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-_tx,dy=e.changedTouches[0].clientY-_ty;if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>44){_step(dx<0?1:-1);}else if(Math.abs(dy)>Math.abs(dx)&&dy>80){_close();}},{passive:true});
                document.addEventListener('click',function(e){
                    var im=e.target.closest('.story-main-image')||(e.target.tagName==='IMG'&&e.target.closest('.story-media-item'));
                    if(im){e.preventDefault();e.stopPropagation();var c=im.closest('.story-media-container');var its=[],si=0;if(c){Array.from(c.querySelectorAll('img,video')).forEach(function(m,j){var src=m.src||m.currentSrc||'';its.push({src:src,type:m.tagName==='VIDEO'?'video':'image'});if(m===im||m===e.target)si=j;});}else{its=[{src:im.src||e.target.src,type:'image'}];}if(its.length)_open(its,si);return;}
                },true);
                document.addEventListener('dblclick',function(e){var v=e.target.closest('.story-media-item video,.story-video');if(!v)return;e.preventDefault();e.stopPropagation();var c=v.closest('.story-media-container');var its=[],si=0;if(c){Array.from(c.querySelectorAll('img,video')).forEach(function(m,j){its.push({src:m.src||m.currentSrc||'',type:m.tagName==='VIDEO'?'video':'image'});if(m===v)si=j;});}else{its=[{src:v.src||v.currentSrc,type:'video'}];}if(its.length)_open(its,si);},true);
                window.openMediaLightbox=_open;window.closeMediaLightbox=_close;
            })();

            // ── HORIZONTAL DRAG-SCROLL (mouse + touch auto-swipe) ──────────────
            // Enables click-drag scrolling on every .horizontal-slider-wrapper
            // Touch devices already work via CSS scroll-snap; this adds mouse drag
            // and auto-advances the strip every 4 s when idle.
            (function initSliderDragScroll() {

                function attachDragScroll(el) {
                    if (el._dragScrollAttached) return;
                    el._dragScrollAttached = true;

                    var startX = 0, scrollStart = 0, isDragging = false;

                    el.addEventListener('mousedown', function(e) {
                        if (e.button !== 0) return; // left button only
                        isDragging  = true;
                        startX      = e.pageX - el.offsetLeft;
                        scrollStart = el.scrollLeft;
                        el.style.cursor      = 'grabbing';
                        el.style.userSelect  = 'none';
                        el.style.scrollSnapType = 'none'; // disable snap while dragging
                    });

                    el.addEventListener('mouseleave', function() {
                        if (!isDragging) return;
                        isDragging = false;
                        el.style.cursor      = 'grab';
                        el.style.userSelect  = '';
                        el.style.scrollSnapType = 'x mandatory';
                    });

                    el.addEventListener('mouseup', function() {
                        isDragging = false;
                        el.style.cursor      = 'grab';
                        el.style.userSelect  = '';
                        el.style.scrollSnapType = 'x mandatory';
                    });

                    el.addEventListener('mousemove', function(e) {
                        if (!isDragging) return;
                        e.preventDefault();
                        var x    = e.pageX - el.offsetLeft;
                        var walk = (x - startX) * 1.2; // multiplier for feel
                        el.scrollLeft = scrollStart - walk;
                    });

                    // Passive touch events -- handled by CSS on mobile, but we
                    // still emit momentum on touchend for consistency
                    el.addEventListener('touchstart', function(e) {
                        startX      = e.touches[0].pageX;
                        scrollStart = el.scrollLeft;
                    }, { passive: true });

                    el.addEventListener('touchmove', function(e) {
                        var dx = startX - e.touches[0].pageX;
                        el.scrollLeft = scrollStart + dx;
                    }, { passive: true });

                    el.style.cursor = 'grab';
                }

                // Auto-advance ticker: nudge sliders gently when the user is idle
                function startAutoSwipe(el) {
                    if (el._autoSwipeTimer) return;
                    var direction = 1;
                    el._autoSwipeTimer = setInterval(function() {
                        if (isDraggingAny) return; // pause while user is dragging
                        var maxScroll = el.scrollWidth - el.clientWidth;
                        if (maxScroll <= 0) return; // nothing to scroll
                        var next = el.scrollLeft + el.clientWidth * 0.85 * direction;
                        if (next >= maxScroll) { direction = -1; next = maxScroll; }
                        if (next <= 0)         { direction =  1; next = 0; }
                        el.scrollTo({ left: next, behavior: 'smooth' });
                    }, 4000);
                    // Pause auto-swipe on hover / touch
                    el.addEventListener('mouseenter', function() { clearInterval(el._autoSwipeTimer); el._autoSwipeTimer = null; }, { once: false });
                    el.addEventListener('touchstart',  function() { clearInterval(el._autoSwipeTimer); el._autoSwipeTimer = null; }, { passive: true, once: false });
                }

                var isDraggingAny = false;
                document.addEventListener('mousedown', function() { isDraggingAny = true;  });
                document.addEventListener('mouseup',   function() { isDraggingAny = false; });

                // Target slider IDs used in the public dashboard
                var SLIDER_IDS = [
                    'marketplace-slider',
                    'reels-slider',
                    'news-slider',
                    'suggested-users-slider',
                    'profile-dash-live-slider'
                ];

                function initAll() {
                    // Attach to known IDs
                    SLIDER_IDS.forEach(function(id) {
                        var el = document.getElementById(id);
                        if (el) { attachDragScroll(el); startAutoSwipe(el); }
                    });
                    // Also catch any .horizontal-slider-wrapper not in the list
                    document.querySelectorAll('.horizontal-slider-wrapper').forEach(function(el) {
                        attachDragScroll(el);
                        startAutoSwipe(el);
                    });
                }

                // Run on load + observe for dynamically rendered sliders
                initAll();

                var sliderObserver = new MutationObserver(function() { initAll(); });
                sliderObserver.observe(document.body, { childList: true, subtree: true });

            })();


        // ── Message media expand: tap image/video to fullscreen ──────────
        (function _initMessageMediaLightbox() {
            if (document.getElementById('_msgMediaOverlay')) return;
            var overlay = document.createElement('div');
            overlay.id = '_msgMediaOverlay';
            overlay.style.cssText = [
                'display:none', 'position:fixed', 'inset:0',
                'background:rgba(0,0,0,0.93)', 'z-index:99999',
                'align-items:center', 'justify-content:center',
                'cursor:zoom-out', '-webkit-tap-highlight-color:transparent'
            ].join(';');

            var wrapper  = document.createElement('div');
            wrapper.style.cssText = 'max-width:96vw;max-height:96vh;position:relative;';

            var closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = [
                'position:absolute', 'top:-14px', 'right:-14px',
                'background:white', 'border:none', 'border-radius:50%',
                'width:30px', 'height:30px', 'font-size:1.2rem',
                'cursor:pointer', 'display:flex', 'align-items:center',
                'justify-content:center', 'box-shadow:0 2px 8px rgba(0,0,0,0.3)', 'z-index:2'
            ].join(';');

            var mediaImg = document.createElement('img');
            mediaImg.id = '_msgMediaImg';
            mediaImg.style.cssText = 'max-width:96vw;max-height:90vh;border-radius:10px;display:block;object-fit:contain;';

            var mediaVid = document.createElement('video');
            mediaVid.id = '_msgMediaVid';
            mediaVid.controls = true;
            mediaVid.style.cssText = 'max-width:96vw;max-height:90vh;border-radius:10px;display:none;';

            function _closeOverlay() {
                overlay.style.display = 'none';
                mediaVid.pause();
                mediaVid.src = '';
                mediaImg.src = '';
            }

            closeBtn.addEventListener('click', _closeOverlay);
            overlay.addEventListener('click', function(e) { if (e.target === overlay) _closeOverlay(); });

            wrapper.appendChild(closeBtn);
            wrapper.appendChild(mediaImg);
            wrapper.appendChild(mediaVid);
            overlay.appendChild(wrapper);
            document.body.appendChild(overlay);

            // Delegated listener -- works for all dynamically added message media
            document.addEventListener('click', function(e) {
                var el = e.target.closest('.message-media');
                if (!el) return;
                var ov = document.getElementById('_msgMediaOverlay');
                var im = document.getElementById('_msgMediaImg');
                var vi = document.getElementById('_msgMediaVid');
                if (!ov || !im || !vi) return;
                if (el.tagName === 'IMG') {
                    im.src = el.src || el.dataset.src || '';
                    im.style.display = 'block';
                    vi.pause(); vi.src = ''; vi.style.display = 'none';
                    ov.style.display = 'flex';
                    e.stopPropagation();
                } else if (el.tagName === 'VIDEO') {
                    im.src = ''; im.style.display = 'none';
                    vi.src = el.src || el.dataset.src || '';
                    vi.style.display = 'block';
                    ov.style.display = 'flex';
                    setTimeout(function(){ vi.play().catch(function(){}); }, 120);
                    e.stopPropagation();
                }
            }, true);

            // Visual affordance
            var s = document.createElement('style');
            s.textContent = '.message-media{cursor:zoom-in!important;transition:opacity 0.15s;} .message-media:active{opacity:0.75;}';
            document.head.appendChild(s);
        })();

        // ══════════════════════════════════════════════════════
        // SAFETY NET -- three root-cause fixes:
        //
        // 1. firebase-init.js stubs fbAuth with an onAuthStateChanged that calls
        //    cb(null) immediately. The real observer (~line 9671) runs on the stub,
        //    gets null, and app starts as guest. When real firebase.auth() loads,
        //    onAuthStateChanged is never re-registered → users invisible on new devices.
        //    FIX: on empyrean:firebase-ready, register a new observer on real fbAuth
        //    that ONLY nulls listener handles and calls _startRealtimeListeners (never
        //    calls initializeApp -- that would blank the page).
        //
        // 2. empyrean:auth-ready was listened for but never dispatched anywhere.
        //    FIX: dispatch it from the new real-auth observer below.
        //
        // 3. _scheduleListenerRetry caps at 8 attempts. If all 8 fire while auth is
        //    still pending, retries stop permanently.
        //    FIX: reset _listenerRetryCount before every safety-net-triggered start.
        // ══════════════════════════════════════════════════════
        (function() {
            var _ALL_LISTENERS = [
                '_postsListener', '_newsListener', '_mktListener',
                '_reelsListener', '_sosListener', '_crisisListener',
                '_announcementsListener', '_usersListener'
            ];

            function _allActive() {
                return _ALL_LISTENERS.every(function(k){ return !!window[k]; });
            }

            function _tryStart() {
                if (typeof window._startRealtimeListeners !== 'function') return;
                if (!window._firebaseLoaded || !window.fbDb) return;
                if (_allActive()) return;
                // Reset internal cap so previous failed retries don't block this attempt
                window._listenerRetryCount = 0;
                window._startRealtimeListeners();
            }

            // ROOT CAUSE 1+2 FIX -- runs once when real firebase.auth() is available.
            // Does NOT call initializeApp; only restarts listeners for the real user.
            function _attachRealAuthObserver() {
                if (window._realAuthObserverActive) return;
                if (!window._firebaseLoaded || !window.fbAuth ||
                        typeof window.fbAuth.onAuthStateChanged !== 'function') return;
                window._realAuthObserverActive = true;

                window.fbAuth.onAuthStateChanged(function(fbUser) {
                    if (!fbUser || fbUser.isAnonymous) return;
                    // FIX #2 (Duplicate Posts): Firestore onSnapshot returns an unsubscribe
                    // function stored in window[k].  Simply nulling without calling it leaves
                    // the old listener alive so _startRealtimeListeners creates a SECOND one.
                    // Both fire for every new post -> profile feeds receive every post twice.
                    // Call the unsubscribe function first, THEN null the handle.
                    _ALL_LISTENERS.forEach(function(k){
                        if (typeof window[k] === 'function') {
                            try { window[k](); } catch(e) { console.warn('[Listener] Unsub error:', e.message); }
                        }
                        window[k] = null;
                    });
                    window._newsListenerActive = false; // allow app-news.js to restart
                    window._listenerRetryCount = 0;
                    // Dispatch auth-ready so the listener below also fires (Root Cause 2)
                    try { window.dispatchEvent(new CustomEvent('empyrean:auth-ready')); } catch(e) {}
                    setTimeout(_tryStart, 800);
                });
            }

            // Try immediately if Firebase somehow already loaded
            if (window._firebaseLoaded) {
                _attachRealAuthObserver();
                setTimeout(_tryStart, 500);
            }

            // Primary: fires from firebase-init.js after real SDK initialises
            window.addEventListener('empyrean:firebase-ready', function() {
                _attachRealAuthObserver();
                setTimeout(_tryStart, 600);
            });

            // Secondary: fired by _attachRealAuthObserver above (Root Cause 2 fix)
            window.addEventListener('empyrean:auth-ready', function() {
                setTimeout(_tryStart, 400);
            });

            // Fallback: poll every 3 s for 60 s (20 attempts)
            var _safetyRetries = 0;
            var _safetyTimer = setInterval(function() {
                _safetyRetries++;
                if (_safetyRetries > 20 || _allActive()) {
                    clearInterval(_safetyTimer);
                    return;
                }
                if (!window._realAuthObserverActive && window._firebaseLoaded) {
                    _attachRealAuthObserver();
                }
                if (window._firebaseLoaded) { _tryStart(); }
            }, 3000);
        })();
        // ── AUTO-HIGHLIGHT @ and # in rendered posts (MutationObserver) ──
        (function _autoHighlightTags() {
            function _applyHighlights(el) {
                // Only process text nodes inside story-content, not already-processed ones
                if (!el) return;
                var paras = el.querySelectorAll('.story-content p, .news-item-content p, .story-content div');
                paras.forEach(function(p) {
                    if (p.dataset.hlDone) return;
                    p.dataset.hlDone = '1';
                    var html = p.innerHTML;
                    // Don't re-process already highlighted tags
                    if (html.indexOf('mention-tag') !== -1 || html.indexOf('hashtag-tag') !== -1) return;
                    // Highlight @mentions
                    html = html.replace(/(?<![=&#\w])@([a-zA-Z0-9_\.]{1,32})/g, '<span class="mention-tag" data-username="$1">@$1</span>');
                    // Highlight #hashtags
                    html = html.replace(/(?<![=&#\w&])#([a-zA-Z0-9_]{1,50})/g, '<span class="hashtag-tag" data-tag="$1">#$1</span>');
                    p.innerHTML = html;
                    // Click handlers
                    p.querySelectorAll('.mention-tag').forEach(function(mt) {
                        mt.style.cssText = 'color:var(--secondary);font-weight:700;cursor:pointer;';
                        mt.onclick = function(e) {
                            e.stopPropagation();
                            var uname = mt.dataset.username;
                            if (uname && typeof renderUserProfile === 'function') {
                                window._viewingOtherProfile = true;
                                renderUserProfile('@' + uname);
                                if (typeof navigateTo === 'function') navigateTo('profile', true);
                                setTimeout(function(){ window._viewingOtherProfile = false; }, 500);
                            }
                        };
                    });
                    p.querySelectorAll('.hashtag-tag').forEach(function(ht) {
                        ht.style.cssText = 'color:var(--secondary);font-weight:700;cursor:pointer;';
                        ht.onclick = function(e) {
                            e.stopPropagation();
                            var tag = ht.dataset.tag;
                            if (tag && typeof window._incrementTag === 'function') window._incrementTag(tag);
                        };
                    });
                });
            }
            // Run on existing DOM + watch for new posts
            var _hlObs = new MutationObserver(function(muts) {
                muts.forEach(function(m) {
                    m.addedNodes.forEach(function(n) {
                        if (n.nodeType === 1) {
                            _applyHighlights(n);
                            // Also check if this node itself is a story-content p
                            if (n.matches && n.matches('.story-content, .news-item-content')) {
                                _applyHighlights(n.parentElement || n);
                            }
                        }
                    });
                });
            });
            _hlObs.observe(document.body, { childList: true, subtree: true });
            // Initial pass
            setTimeout(function() {
                document.querySelectorAll('.impact-story, .news-list-item').forEach(_applyHighlights);
            }, 1000);
            setInterval(function() {
                document.querySelectorAll('.impact-story:not([data-hl-story])').forEach(function(el) {
                    el.dataset.hlStory = '1';
                    _applyHighlights(el);
                });
            }, 3000);
            console.log('[TagHighlighter] @mention and #hashtag highlighter active');

        // ── Navigation & UI functions are owned by their dedicated modules ──
        // app-nav.js        → window.navigateTo, window.buildSidebar, window.buildHeader,
        //                     window.renderDynamicUI, window._buildMobileBottomNav
        // app-marketplace.js→ window.renderMarketplaceCards, window.showMarketplaceGallery
        // app-feed.js       → window.createNewPostElement, window.createSosPostOnFeed
        // app-profile.js    → window.renderUserProfile
        // app-fixes.js intentionally defers to those modules and does NOT re-export them.

        })();

        // ═══════════════════════════════════════════════════════════════════
        // CRITICAL FIX: Expose local nav functions to window so other modules
        // (app-auth.js, app-feed.js, etc.) can call them via window.*
        // These were defined inside this DOMContentLoaded closure but never
        // exported — causing ALL navigation, sidebar, and section switching
        // to silently fail.
        // ═══════════════════════════════════════════════════════════════════

        // ── Auth modal opener ─────────────────────────────────────────────
        window._openAuthModal = function(view) {
            var am = document.getElementById('auth-modal-overlay');
            var lv = document.getElementById('login-view');
            var sv = document.getElementById('signup-view');
            if (!am) return;
            am.style.display = 'flex';
            am.classList.add('show');
            document.body.classList.add('modal-open');
            if (view === 'signup') {
                if (sv) sv.style.display = 'block';
                if (lv) lv.style.display = 'none';
            } else {
                if (lv) lv.style.display = 'block';
                if (sv) sv.style.display = 'none';
            }
            setTimeout(function() {
                if (typeof generateCaptcha === 'function') generateCaptcha();
            }, 80);
        };

        // ── STATUS MODULE DEFERRED TO app-status.js ─────────────────────────────
        // window.renderStatusBar and window._openStatusViewer are owned exclusively
        // by app-status.js (loads before app-fix-final.js). This block previously
        // overwrote those functions with inferior stubs. Removed to fix:
        //   1. Status bar/viewer not working
        //   2. WhatsApp-style peek preview broken
        //   3. Video status, bubble-like, retweet, viewers panel broken
        // The "Add my status" button and close button are also wired by app-status.js.
        // Only init the userStatuses array if not already done by app-status.js.
        if (!window.userStatuses) window.userStatuses = [];
        // Trigger status bar render AFTER app-status.js has had time to wire up.
        setTimeout(function() {
            if (typeof window.renderStatusBar === 'function') window.renderStatusBar();
        }, 800);

        // ── Expose navigateTo as global for inline onclick handlers ────────

        console.log('[Empyrean] ✅ app-fixes.js loaded — module functions deferred to app-nav, app-marketplace, app-feed, app-profile.');

        });