(function () {
    // Phantom Connect SDK — identifies this app to Phantom for review/approval
    let phantomSDK = null;
    try {
        if (window.PhantomBrowserSDK) {
            phantomSDK = new window.PhantomBrowserSDK.BrowserSDK({
                providers: ['injected'],
                appId: 'e4174ab1-e8a1-4791-b14e-7b2850580960'
            });
        }
    } catch (e) {}

    const RPC_URL = 'https://ratrepublic.art/api/rpc.php';
    const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
    const TREASURY = 'ratU71Bedbf7196sexgCyBoRxM2Zjb7vBxJ5MJeBYGb';
    const RENT_PER_ACCOUNT = 0.00203928;
    const RENT_LAMPORTS    = 2039280; // RENT_PER_ACCOUNT * 1e9, exact integer
    const MAX_PER_TX = 22; // reduced from 25 to leave room for fee transfer instructions
    const METADATA_PROG_ID = new solanaWeb3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const BURN_MAX_PER_TX  = 10; // burn + close = 2 instructions per token

    let wallet = null;
    let walletPublicKey = null;
    let closableAccounts = [];
    let burnableTokens = [];
    let nftItems = [];
    let feeInfo = null;
    let userRefLink = 'https://ratrepublic.art/register';

    const connectBtn      = document.getElementById('connect-btn');
    const walletModal     = document.getElementById('wallet-modal');
    const modalCloseBtn   = document.getElementById('modal-close-btn');
    const optPhantom      = document.getElementById('opt-phantom');
    const optSolflare     = document.getElementById('opt-solflare');
    const badgePhantom    = document.getElementById('badge-phantom');
    const badgeSolflare   = document.getElementById('badge-solflare');
    const connectSection  = document.getElementById('connect-section');
    const scanSection     = document.getElementById('scan-section');
    const walletDisplay   = document.getElementById('wallet-display');
    const disconnectBtn   = document.getElementById('disconnect-btn');
    const scanBtn         = document.getElementById('scan-btn');
    const statusArea      = document.getElementById('status-area');
    const resultsSection  = document.getElementById('results-section');
    const tokenList       = document.getElementById('token-list');
    const selectAll       = document.getElementById('select-all');
    const summaryText     = document.getElementById('summary-text');
    const reclaimBtn      = document.getElementById('reclaim-btn');
    const unclaimedDisplay = document.getElementById('unclaimed-sol-display');
    const solDisplayWrap  = document.getElementById('sol-display');
    const toolImageWrap   = document.getElementById('tool-image-wrap');
    const successSection  = document.getElementById('success-section');
    const successAmount   = document.getElementById('success-amount-display');
    const goBackBtn       = document.getElementById('go-back-btn');
    const seeTxBtn        = document.getElementById('see-tx-btn');
    const tweetBtn        = document.getElementById('tweet-btn');

    function trunc(addr) { return addr.slice(0, 4) + '...' + addr.slice(-4); }

    function setStatus(msg, type) {
        statusArea.className = 'status-area ' + (type || '');
        if (type === 'success' || type === 'info') {
            statusArea.innerHTML = msg;
        } else {
            statusArea.textContent = msg;
        }
    }

    function clearStatus() {
        statusArea.className = 'status-area';
        statusArea.textContent = '';
    }

    function setUnclaimedDisplay(count) {
        if (count === null) {
            unclaimedDisplay.textContent = '??? SOL';
        } else if (count === 0) {
            unclaimedDisplay.textContent = '0 SOL';
        } else {
            const fi = getActiveFeeInfo();
            const net = (count * RENT_PER_ACCOUNT) * (1 - fi.total_bps / 10000);
            unclaimedDisplay.textContent = net.toFixed(4) + ' SOL';
        }
    }

    function showSuccess(solAmount, txSig) {
        solDisplayWrap.classList.add('hidden');
        toolImageWrap.classList.add('hidden');
        scanSection.classList.add('hidden');
        clearStatus();
        resultsSection.classList.add('hidden');
        successAmount.textContent = solAmount + ' SOL';
        if (txSig) {
            seeTxBtn.href = 'https://solscan.io/tx/' + txSig;
            seeTxBtn.style.display = '';
        } else {
            seeTxBtn.style.display = 'none';
        }
        successSection.classList.remove('hidden');
    }

    goBackBtn.addEventListener('click', function () {
        successSection.classList.add('hidden');
        solDisplayWrap.classList.remove('hidden');
        toolImageWrap.classList.remove('hidden');
        scanSection.classList.remove('hidden');
        setUnclaimedDisplay(closableAccounts.length);
    });

    tweetBtn.addEventListener('click', function () {
        const amount = successAmount.textContent.replace(' SOL', '');
        const text = 'I just claimed ' + amount + ' $SOL in rent on @solana using @rat_republicsol.\n\nJoin Rat Republic to claim your 10% Discount - Forever!\n' + userRefLink;
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank');
    });

    window.switchTab = function (tab) {
        document.querySelectorAll('.tab-btn').forEach(function (btn) { btn.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
        document.getElementById('tab-' + tab + '-btn').classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
        if (tab === 'nft') updateNftWalletState();
        if (tab === 'tokens') updateBurnWalletState();
    };

    window.switchMode = function (mode) {
        var card = document.querySelector('.main-card');
        document.getElementById('mode-noob-btn').classList.toggle('active', mode === 'noob');
        document.getElementById('mode-expert-btn').classList.toggle('active', mode === 'expert');
        if (mode === 'expert') {
            card.classList.add('expert-mode');
        } else {
            card.classList.remove('expert-mode');
            // If an expert-only tab is active, switch back to claim
            var activeTab = document.querySelector('.tab-btn.active');
            if (activeTab && activeTab.classList.contains('expert-only')) {
                switchTab('claim');
            }
        }
        localStorage.setItem('rr_mode', mode);
    };

    // Restore saved mode
    if (localStorage.getItem('rr_mode') === 'expert') {
        switchMode('expert');
    }

    // --- Auth ---
    function initAuthIndicator() {
        var token    = localStorage.getItem('rr_token');
        var username = localStorage.getItem('rr_username');
        var indicator = document.getElementById('auth-indicator');
        if (!indicator) return;
        if (token && username) {
            document.getElementById('auth-username').textContent = username;
            indicator.style.display = 'block';
            var logoutLink = document.getElementById('auth-logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', function (e) {
                    e.preventDefault();
                    fetch('api/auth.php?action=logout', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + token }
                    }).catch(function () {});
                    localStorage.removeItem('rr_token');
                    localStorage.removeItem('rr_username');
                    indicator.style.display = 'none';
                });
            }
        }
    }

    // --- Fee info ---
    async function fetchFeeInfo() {
        try {
            var token = localStorage.getItem('rr_token');
            var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
            var r = await fetch('api/fee-info.php', { headers: headers });
            var data = await r.json();
            if (data.treasury && typeof data.treasury_bps === 'number') {
                feeInfo = data;
                updateSummary();
            }
            if (token) {
                fetch('api/me.php', { headers: { 'Authorization': 'Bearer ' + token } })
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .then(function (d) { if (d && d.referral_link) userRefLink = d.referral_link; })
                    .catch(function () {});
            }
        } catch (e) {}
    }

    function getActiveFeeInfo() {
        return feeInfo || {
            treasury:       TREASURY,
            treasury_bps:   200,
            referrer_wallet: null,
            referrer_bps:   0,
            total_bps:      200
        };
    }

    // --- SOL transfer instruction ---
    function makeSolTransfer(fromPubkey, toPubkey, lamports) {
        return solanaWeb3.SystemProgram.transfer({
            fromPubkey: fromPubkey,
            toPubkey:   toPubkey,
            lamports:   lamports
        });
    }

    // --- Stats ---
    function loadStats() {
        fetch('api/public-stats.php')
            .then(function (r) { return r.json(); })
            .then(function (s) {
                document.getElementById('stat-users').textContent    = Number(s.users_served).toLocaleString();
                document.getElementById('stat-accounts').textContent = Number(s.accounts_closed).toLocaleString();
                document.getElementById('stat-sol').textContent      = Number(s.sol_recovered).toFixed(2);
                document.getElementById('stat-highest').textContent  = Number(s.top_user_sol).toFixed(4);
            })
            .catch(function () {});
    }

    function recordReclaim(walletAddr, accountsClosed, solAmount, txSignature, referrerWallet, referrerSol) {
        var token = localStorage.getItem('rr_token');
        fetch('api/record-reclaim.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address:  walletAddr,
                accounts_closed: accountsClosed,
                sol_recovered:   parseFloat(solAmount),
                tx_signature:    txSignature || null,
                token:           token || null,
                referrer_wallet: referrerWallet || null,
                referrer_sol:    referrerSol || null
            })
        })
        .then(function () { loadStats(); })
        .catch(function () {});
    }

    // --- Wallet detection ---
    function getProvider(name) {
        if (name === 'phantom')  return window.phantom?.solana || null;
        if (name === 'solflare') return window.solflare || null;
        return null;
    }

    var WALLET_ICONS = {
        phantom:  '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTA4IiBoZWlnaHQ9IjEwOCIgdmlld0JveD0iMCAwIDEwOCAxMDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00Ni41MjY3IDY5LjkyMjlDNDIuMDA1NCA3Ni44NTA5IDM0LjQyOTIgODUuNjE4MiAyNC4zNDggODUuNjE4MkMxOS41ODI0IDg1LjYxODIgMTUgODMuNjU2MyAxNSA3NS4xMzQyQzE1IDUzLjQzMDUgNDQuNjMyNiAxOS44MzI3IDcyLjEyNjggMTkuODMyN0M4Ny43NjggMTkuODMyNyA5NCAzMC42ODQ2IDk0IDQzLjAwNzlDOTQgNTguODI1OCA4My43MzU1IDc2LjkxMjIgNzMuNTMyMSA3Ni45MTIyQzcwLjI5MzkgNzYuOTEyMiA2OC43MDUzIDc1LjEzNDIgNjguNzA1MyA3Mi4zMTRDNjguNzA1MyA3MS41NzgzIDY4LjgyNzUgNzAuNzgxMiA2OS4wNzE5IDY5LjkyMjlDNjUuNTg5MyA3NS44Njk5IDU4Ljg2ODUgODEuMzg3OCA1Mi41NzU0IDgxLjM4NzhDNDcuOTkzIDgxLjM4NzggNDUuNjcxMyA3OC41MDYzIDQ1LjY3MTMgNzQuNDU5OEM0NS42NzEzIDcyLjk4ODQgNDUuOTc2OCA3MS40NTU2IDQ2LjUyNjcgNjkuOTIyOVpNODMuNjc2MSA0Mi41Nzk0QzgzLjY3NjEgNDYuMTcwNCA4MS41NTc1IDQ3Ljk2NTggNzkuMTg3NSA0Ny45NjU4Qzc2Ljc4MTYgNDcuOTY1OCA3NC42OTg5IDQ2LjE3MDQgNzQuNjk4OSA0Mi41Nzk0Qzc0LjY5ODkgMzguOTg4NSA3Ni43ODE2IDM3LjE5MzEgNzkuMTg3NSAzNy4xOTMxQzgxLjU1NzUgMzcuMTkzMSA4My42NzYxIDM4Ljk4ODUgODMuNjc2MSA0Mi41Nzk0Wk03MC4yMTAzIDQyLjU3OTVDNzAuMjEwMyA0Ni4xNzA0IDY4LjA5MTYgNDcuOTY1OCA2NS43MjE2IDQ3Ljk2NThDNjMuMzE1NyA0Ny45NjU4IDYxLjIzMyA0Ni4xNzA0IDYxLjIzMyA0Mi41Nzk1QzYxLjIzMyAzOC45ODg1IDYzLjMxNTcgMzcuMTkzMSA2NS43MjE2IDM3LjE5MzFDNjguMDkxNiAzNy4xOTMxIDcwLjIxMDMgMzguOTg4NSA3MC4yMTAzIDQyLjU3OTVaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPgo=" style="width:100%;height:100%;border-radius:10px;object-fit:cover;">',
        solflare: '<img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJTIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCA1MCI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiMwMjA1MGE7c3Ryb2tlOiNmZmVmNDY7c3Ryb2tlLW1pdGVybGltaXQ6MTA7c3Ryb2tlLXdpZHRoOi41cHg7fS5jbHMtMntmaWxsOiNmZmVmNDY7fTwvc3R5bGU+PC9kZWZzPjxyZWN0IGNsYXNzPSJjbHMtMiIgeD0iMCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiByeD0iMTIiIHJ5PSIxMiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTI0LjIzLDI2LjQybDIuNDYtMi4zOCw0LjU5LDEuNWMzLjAxLDEsNC41MSwyLjg0LDQuNTEsNS40MywwLDEuOTYtLjc1LDMuMjYtMi4yNSw0LjkzbC0uNDYuNS4xNy0xLjE3Yy42Ny00LjI2LS41OC02LjA5LTQuNzItNy40M2wtNC4zLTEuMzhoMFpNMTguMDUsMTEuODVsMTIuNTIsNC4xNy0yLjcxLDIuNTktNi41MS0yLjE3Yy0yLjI1LS43NS0zLjAxLTEuOTYtMy4zLTQuNTF2LS4wOGgwWk0xNy4zLDMzLjA2bDIuODQtMi43MSw1LjM0LDEuNzVjMi44LjkyLDMuNzYsMi4xMywzLjQ2LDUuMThsLTExLjY1LTQuMjJoMFpNMTMuNzEsMjAuOTVjMC0uNzkuNDItMS41NCwxLjEzLTIuMTcuNzUsMS4wOSwyLjA1LDIuMDUsNC4wOSwyLjcxbDQuNDIsMS40Ni0yLjQ2LDIuMzgtNC4zNC0xLjQyYy0yLS42Ny0yLjg0LTEuNjctMi44NC0yLjk2TTI2LjgyLDQyLjg3YzkuMTgtNi4wOSwxNC4xMS0xMC4yMywxNC4xMS0xNS4zMiwwLTMuMzgtMi01LjI2LTYuNDMtNi43MmwtMy4zNC0xLjEzLDkuMTQtOC43Ny0xLjg0LTEuOTYtMi43MSwyLjM4LTEyLjgxLTQuMjJjLTMuOTcsMS4yOS04Ljk3LDUuMDktOC45Nyw4Ljg5LDAsLjQyLjA0LjgzLjE3LDEuMjktMy4zLDEuODgtNC42MywzLjYzLTQuNjMsNS44LDAsMi4wNSwxLjA5LDQuMDksNC41NSw1LjIybDIuNzUuOTItOS41Miw5LjE0LDEuODQsMS45NiwyLjk2LTIuNzEsMTQuNzMsNS4yMmgwWiIvPjwvc3ZnPg==" style="width:100%;height:100%;border-radius:10px;object-fit:cover;">',
    };

    function initModal() {
        var map = [
            { name: 'phantom',  opt: optPhantom,  badge: badgePhantom,  iconEl: document.getElementById('icon-phantom')  },
            { name: 'solflare', opt: optSolflare, badge: badgeSolflare, iconEl: document.getElementById('icon-solflare') },
        ];
        map.forEach(function (item) {
            var p = getProvider(item.name);
            var icon = (p && p.icon)
                ? '<img src="' + p.icon + '" style="width:100%;height:100%;border-radius:10px;object-fit:cover;">'
                : WALLET_ICONS[item.name];
            item.iconEl.style.background = 'none';
            item.iconEl.innerHTML = icon;
            if (p) {
                item.badge.classList.remove('hidden');
                item.opt.classList.remove('wallet-disabled');
            } else {
                item.badge.classList.add('hidden');
                item.opt.classList.add('wallet-disabled');
            }
        });
    }

    function openModal()  { walletModal.classList.remove('hidden'); }
    function closeModal() { walletModal.classList.add('hidden'); }

    connectBtn.addEventListener('click', openModal);
    modalCloseBtn.addEventListener('click', closeModal);

    walletModal.addEventListener('click', function (e) {
        if (e.target === walletModal) closeModal();
    });

    function tryAutoConnect() {
        var names = ['phantom', 'solflare'];
        for (var i = 0; i < names.length; i++) {
            var p = getProvider(names[i]);
            if (p && p.isConnected && p.publicKey) {
                wallet = p;
                walletPublicKey = p.publicKey.toString();
                walletDisplay.textContent = trunc(walletPublicKey);
                connectSection.classList.add('hidden');
                scanSection.classList.remove('hidden');
                fetchFeeInfo();
                triggerScan();
                updateBurnWalletState();
                updateNftWalletState();
                return true;
            }
        }
        return false;
    }

    // --- Auto-connect ---
    window.addEventListener('load', function () {
        loadStats();
        initAuthIndicator();
        fetchFeeInfo();
        initModal();
        if (!tryAutoConnect()) {
            setTimeout(function () {
                initModal();
                tryAutoConnect();
            }, 800);
        }
    });

    // --- Connect ---
    async function connectWith(name) {
        const provider = getProvider(name);
        if (!provider) return;
        closeModal();
        try {
            await provider.connect();
            wallet = provider;
            walletPublicKey = wallet.publicKey.toString();
            walletDisplay.textContent = trunc(walletPublicKey);
            connectSection.classList.add('hidden');
            scanSection.classList.remove('hidden');
            fetchFeeInfo();
            triggerScan();
            updateBurnWalletState();
            updateNftWalletState();
        } catch (e) {
            setStatus('Connection rejected.', 'error');
        }
    }

    optPhantom.addEventListener('click',  function () { connectWith('phantom'); });
    optSolflare.addEventListener('click', function () { connectWith('solflare'); });

    // --- Disconnect ---
    disconnectBtn.addEventListener('click', async function () {
        try { await wallet?.disconnect(); } catch (e) { /* ignore */ }
        wallet = null;
        walletPublicKey = null;
        closableAccounts = [];
        burnableTokens = [];
        nftItems = [];
        feeInfo = null;
        scanSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
        connectSection.classList.remove('hidden');
        document.getElementById('burn-results').classList.add('hidden');
        document.getElementById('burn-token-list').innerHTML = '';
        document.getElementById('nft-results').classList.add('hidden');
        document.getElementById('nft-token-list').innerHTML = '';
        clearBurnStatus();
        clearNftStatus();
        setUnclaimedDisplay(null);
        clearStatus();
        updateBurnWalletState();
        updateNftWalletState();
    });

    // --- Scan ---
    async function triggerScan() {
        clearStatus();
        resultsSection.classList.add('hidden');
        tokenList.innerHTML = '';
        closableAccounts = [];
        setStatus('Scanning wallet...', 'loading');

        try {
            const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');
            const owner = new solanaWeb3.PublicKey(walletPublicKey);

            const [splResult, t22Result] = await Promise.all([
                connection.getParsedTokenAccountsByOwner(owner, {
                    programId: new solanaWeb3.PublicKey(TOKEN_PROGRAM_ID)
                }),
                connection.getParsedTokenAccountsByOwner(owner, {
                    programId: new solanaWeb3.PublicKey(TOKEN_2022_PROGRAM_ID)
                })
            ]);

            const all = [
                ...(splResult.value || []).map(function (a) { return Object.assign({}, a, { programId: TOKEN_PROGRAM_ID }); }),
                ...(t22Result.value || []).map(function (a) { return Object.assign({}, a, { programId: TOKEN_2022_PROGRAM_ID }); })
            ];

            closableAccounts = all.filter(function (a) {
                const info = a.account.data.parsed && a.account.data.parsed.info;
                return info && info.tokenAmount && info.tokenAmount.amount === '0';
            }).map(function (a) {
                return {
                    pubkey: a.pubkey.toString(),
                    mint: a.account.data.parsed.info.mint,
                    programId: a.programId
                };
            });

            clearStatus();
            setUnclaimedDisplay(closableAccounts.length);

            if (closableAccounts.length === 0) {
                setStatus(
                    'Scanned ' + all.length + ' token accounts — none are empty. ' +
                    'If you expected results, tokens may still have a dust balance.',
                    'info'
                );
                return;
            }

            renderResults();
        } catch (e) {
            setStatus('Scan failed: ' + (e.message || String(e)), 'error');
        }
    }

    scanBtn.addEventListener('click', triggerScan);

    // --- Render ---
    function renderResults() {
        tokenList.innerHTML = '';
        closableAccounts.forEach(function (acc, i) {
            const row = document.createElement('div');
            row.className = 'token-row';
            row.innerHTML =
                '<input type="checkbox" class="token-cb" data-idx="' + i + '" checked>' +
                '<span class="token-mint">' + trunc(acc.mint) + '</span>' +
                '<span class="token-sol">~' + RENT_PER_ACCOUNT.toFixed(6) + ' SOL</span>';
            tokenList.appendChild(row);
        });
        resultsSection.classList.remove('hidden');
        selectAll.checked = true;
        updateSummary();
    }

    function getSelected() {
        return Array.from(document.querySelectorAll('.token-cb:checked')).map(function (cb) {
            return closableAccounts[parseInt(cb.dataset.idx)];
        });
    }

    function updateSummary() {
        const count = document.querySelectorAll('.token-cb:checked').length;
        const fi = getActiveFeeInfo();
        const grossSol = count * RENT_PER_ACCOUNT;
        const netSol   = grossSol * (1 - fi.total_bps / 10000);
        summaryText.textContent = count + ' selected';
        reclaimBtn.disabled = count === 0;
    }

    selectAll.addEventListener('change', function () {
        document.querySelectorAll('.token-cb').forEach(function (cb) { cb.checked = selectAll.checked; });
        updateSummary();
    });

    tokenList.addEventListener('change', updateSummary);

    // --- Reclaim ---
    reclaimBtn.addEventListener('click', async function () {
        const selected = getSelected();
        if (selected.length === 0) return;

        reclaimBtn.disabled = true;
        scanBtn.disabled = true;

        const connection   = new solanaWeb3.Connection(RPC_URL, 'confirmed');
        const walletPubkey = new solanaWeb3.PublicKey(walletPublicKey);
        const tokenProgPk  = new solanaWeb3.PublicKey(TOKEN_PROGRAM_ID);
        const t22ProgPk    = new solanaWeb3.PublicKey(TOKEN_2022_PROGRAM_ID);

        const chunks = [];
        for (let i = 0; i < selected.length; i += MAX_PER_TX) {
            chunks.push(selected.slice(i, i + MAX_PER_TX));
        }

        const fi = getActiveFeeInfo();
        const treasuryPubkey = new solanaWeb3.PublicKey(fi.treasury);
        const RENT_EXEMPT_MIN = 890880; // lamports — minimum for a 0-data system account

        // Pre-check referrer wallet balance — if empty and our transfer won't bring it above
        // rent-exempt minimum, skip the referrer split to avoid simulation failure
        let referrerPubkey = fi.referrer_wallet ? new solanaWeb3.PublicKey(fi.referrer_wallet) : null;
        if (referrerPubkey) {
            try {
                const grossFirst = Math.ceil(selected.length / MAX_PER_TX > 0 ? MAX_PER_TX : selected.length) * RENT_LAMPORTS;
                const refLamportsFirst = Math.round(grossFirst * fi.referrer_bps / 10000);
                const refBalance = await connection.getBalance(referrerPubkey);
                if (refBalance + refLamportsFirst < RENT_EXEMPT_MIN) {
                    referrerPubkey = null; // route to treasury instead
                }
            } catch (e) { /* ignore — proceed with referrer */ }
        }

        let totalNetLamports = 0;
        let totalAccounts    = 0;
        const signatures     = [];

        // Sign with wallet, send through our own connection so we control skipPreflight
        async function sendTx(txToSend) {
            const signed = await wallet.signTransaction(txToSend);
            try {
                return await connection.sendRawTransaction(signed.serialize(), {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed'
                });
            } catch (sendErr) {
                const sendMsg = sendErr.message || String(sendErr);
                if (sendMsg.toLowerCase().includes('simulation') || sendMsg.toLowerCase().includes('preflight')) {
                    return await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
                }
                throw sendErr;
            }
        }

        try {
            for (let ci = 0; ci < chunks.length; ci++) {
                setStatus('Sending transaction ' + (ci + 1) + ' of ' + chunks.length + '...', 'loading');

                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
                const tx = new solanaWeb3.Transaction();
                tx.recentBlockhash = blockhash;
                tx.feePayer = walletPubkey;

                tx.add(solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));
                tx.add(solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

                // Close instructions first — rent lands in wallet before fee transfers execute
                chunks[ci].forEach(function (acc) {
                    const progPk = acc.programId === TOKEN_2022_PROGRAM_ID ? t22ProgPk : tokenProgPk;
                    tx.add(new solanaWeb3.TransactionInstruction({
                        keys: [
                            { pubkey: new solanaWeb3.PublicKey(acc.pubkey), isSigner: false, isWritable: true },
                            { pubkey: walletPubkey, isSigner: false, isWritable: true },
                            { pubkey: walletPubkey, isSigner: true,  isWritable: false }
                        ],
                        programId: progPk,
                        data: new Uint8Array([9])
                    }));
                });

                // Fee transfers
                const grossLamports    = chunks[ci].length * RENT_LAMPORTS;
                const referrerLamports = referrerPubkey ? Math.round(grossLamports * fi.referrer_bps / 10000) : 0;
                const treasuryLamports = grossLamports - Math.round(grossLamports * (10000 - fi.treasury_bps - (referrerPubkey ? fi.referrer_bps : 0)) / 10000) - referrerLamports;
                const netLamports      = grossLamports - treasuryLamports - referrerLamports;

                tx.add(makeSolTransfer(walletPubkey, treasuryPubkey, treasuryLamports));
                if (referrerPubkey && referrerLamports > 0) {
                    tx.add(makeSolTransfer(walletPubkey, referrerPubkey, referrerLamports));
                }

                const sig = await sendTx(tx);
                signatures.push(sig);

                // Transaction sent — record and count immediately, confirm in background
                totalNetLamports += netLamports;
                totalAccounts    += chunks[ci].length;

                const chunkNetSol = (netLamports / 1e9).toFixed(4);
                const chunkRefSol = referrerLamports > 0 ? referrerLamports / 1e9 : null;
                recordReclaim(walletPublicKey, chunks[ci].length, chunkNetSol, sig, fi.referrer_wallet, chunkRefSol);

                // Confirm in background — don't block the UI
                connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
                    .catch(function () {
                        connection.getSignatureStatus(sig, { searchTransactionHistory: true }).catch(function () {});
                    });
            }

            const totalNetSol = (totalNetLamports / 1e9).toFixed(4);
            const closedSet = new Set(selected.map(function (a) { return a.pubkey; }));
            closableAccounts = closableAccounts.filter(function (a) { return !closedSet.has(a.pubkey); });
            showSuccess(totalNetSol, signatures[signatures.length - 1]);

        } catch (e) {
            const msg = e.message || String(e);
            if (msg.includes('rejected') || msg.includes('cancelled') || e.code === 4001) {
                setStatus('Transaction cancelled.', 'error');
            } else {
                setStatus('Error: ' + msg, 'error');
            }
            reclaimBtn.disabled = false;
        }

        scanBtn.disabled = false;
    });

    // ── Scanner Tab ───────────────────────────────────────────────────────────
    document.getElementById('scanner-scan-btn').addEventListener('click', async function () {
        var addr     = document.getElementById('scanner-address-input').value.trim();
        var statusEl = document.getElementById('scanner-status');
        var resultEl = document.getElementById('scanner-result');

        resultEl.classList.add('hidden');
        statusEl.textContent = '';

        if (!addr || addr.length < 32) { statusEl.textContent = 'Enter a valid Solana wallet address.'; return; }

        var owner;
        try { owner = new solanaWeb3.PublicKey(addr); }
        catch (e) { statusEl.textContent = 'Invalid wallet address.'; return; }

        statusEl.textContent = 'Scanning…';
        try {
            var connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');
            var [splResult, t22Result] = await Promise.all([
                connection.getParsedTokenAccountsByOwner(owner, { programId: new solanaWeb3.PublicKey(TOKEN_PROGRAM_ID) }),
                connection.getParsedTokenAccountsByOwner(owner, { programId: new solanaWeb3.PublicKey(TOKEN_2022_PROGRAM_ID) })
            ]);
            var empty = [...splResult.value, ...t22Result.value].filter(function (a) {
                return a.account.data.parsed.info.tokenAmount.amount === '0';
            });
            statusEl.textContent = '';
            if (empty.length === 0) { statusEl.textContent = 'No empty accounts found for this wallet.'; return; }
            var solEst = (empty.length * RENT_PER_ACCOUNT * (1 - 200 / 10000)).toFixed(4);
            document.getElementById('scanner-count').textContent = empty.length;
            document.getElementById('scanner-sol').textContent   = solEst;
            resultEl.classList.remove('hidden');
        } catch (e) {
            statusEl.textContent = 'Scan failed. Check the address and try again.';
        }
    });

    document.getElementById('scanner-connect-btn').addEventListener('click', function () {
        switchTab('claim');
        if (!walletPublicKey) document.getElementById('connect-btn').click();
    });

    // ── Token Burn Tab ─────────────────────────────────────────────────────────

    function updateBurnWalletState() {
        var noWalletEl  = document.getElementById('burn-no-wallet');
        var walletEl    = document.getElementById('burn-wallet-section');
        var addrEl      = document.getElementById('burn-wallet-addr');
        if (!noWalletEl || !walletEl) return;
        if (walletPublicKey) {
            if (addrEl) addrEl.textContent = trunc(walletPublicKey);
            noWalletEl.classList.add('hidden');
            walletEl.classList.remove('hidden');
        } else {
            noWalletEl.classList.remove('hidden');
            walletEl.classList.add('hidden');
        }
    }

    function setBurnStatus(msg, type) {
        var el = document.getElementById('burn-status');
        if (!el) return;
        el.className = 'status-area ' + (type || '');
        if (type === 'success' || type === 'info') el.innerHTML = msg;
        else el.textContent = msg;
    }

    function clearBurnStatus() {
        var el = document.getElementById('burn-status');
        if (el) { el.className = 'status-area'; el.textContent = ''; }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function findMetadataPDA(mintPubkey) {
        return solanaWeb3.PublicKey.findProgramAddressSync(
            [
                new TextEncoder().encode('metadata'),
                METADATA_PROG_ID.toBytes(),
                mintPubkey.toBytes()
            ],
            METADATA_PROG_ID
        )[0];
    }

    function decodeMetadata(data) {
        try {
            var offset = 1 + 32 + 32; // key + update_authority + mint
            if (offset + 4 > data.length) return null;
            // name
            var nameLen = data[offset] | (data[offset+1]<<8) | (data[offset+2]<<16) | (data[offset+3]<<24);
            offset += 4;
            if (nameLen < 0 || nameLen > 200 || offset + nameLen > data.length) return null;
            var name = new TextDecoder().decode(data.slice(offset, offset + nameLen)).replace(/\0/g, '').trim();
            offset += nameLen;
            // symbol
            if (offset + 4 > data.length) return { name: name, symbol: '', uri: '', tokenStandard: null };
            var symLen = data[offset] | (data[offset+1]<<8) | (data[offset+2]<<16) | (data[offset+3]<<24);
            offset += 4;
            if (symLen < 0 || symLen > 50 || offset + symLen > data.length) return { name: name, symbol: '', uri: '', tokenStandard: null };
            var symbol = new TextDecoder().decode(data.slice(offset, offset + symLen)).replace(/\0/g, '').trim();
            offset += symLen;
            // uri
            if (offset + 4 > data.length) return { name: name, symbol: symbol, uri: '', tokenStandard: null };
            var uriLen = data[offset] | (data[offset+1]<<8) | (data[offset+2]<<16) | (data[offset+3]<<24);
            offset += 4;
            if (uriLen < 0 || uriLen > 500 || offset + uriLen > data.length) return { name: name, symbol: symbol, uri: '', tokenStandard: null };
            var uri = new TextDecoder().decode(data.slice(offset, offset + uriLen)).replace(/\0/g, '').trim();
            offset += uriLen;
            // seller_fee_basis_points: u16
            offset += 2;
            // creators: Option<Vec<Creator>> — each creator = 32+1+1 bytes
            if (offset >= data.length) return { name: name, symbol: symbol, uri: uri, tokenStandard: null };
            var hasCreators = data[offset++];
            if (hasCreators) {
                if (offset + 4 > data.length) return { name: name, symbol: symbol, uri: uri, tokenStandard: null };
                var numCreators = data[offset] | (data[offset+1]<<8) | (data[offset+2]<<16) | (data[offset+3]<<24);
                offset += 4 + numCreators * 34;
            }
            // primary_sale_happened (1) + is_mutable (1)
            offset += 2;
            // edition_nonce: Option<u8>
            if (offset >= data.length) return { name: name, symbol: symbol, uri: uri, tokenStandard: null };
            var hasNonce = data[offset++];
            if (hasNonce) offset += 1;
            // token_standard: Option<TokenStandard> — 4 = ProgrammableNonFungible (pNFT)
            if (offset >= data.length) return { name: name, symbol: symbol, uri: uri, tokenStandard: null };
            var hasStd = data[offset++];
            var tokenStandard = null;
            if (hasStd && offset < data.length) tokenStandard = data[offset++];
            return { name: name, symbol: symbol, uri: uri, tokenStandard: tokenStandard };
        } catch(e) { return null; }
    }

    function updateBurnSummary() {
        var checked = document.querySelectorAll('.burn-cb:checked').length;
        var fi = getActiveFeeInfo();
        var netSol = (checked * RENT_PER_ACCOUNT) * (1 - fi.total_bps / 10000);
        var el = document.getElementById('burn-summary');
        if (el) el.textContent = checked + ' selected · ~' + netSol.toFixed(4) + ' SOL rent back';
        var burnBtn = document.getElementById('burn-btn');
        if (burnBtn) burnBtn.disabled = (checked === 0);
    }

    function getBurnSelected() {
        return Array.from(document.querySelectorAll('.burn-cb:checked')).map(function(cb) {
            return burnableTokens[parseInt(cb.dataset.idx)];
        });
    }

    function renderBurnResults() {
        var list = document.getElementById('burn-token-list');
        var selectAll = document.getElementById('burn-select-all');
        if (!list) return;
        list.innerHTML = '';

        burnableTokens.forEach(function(t, i) {
            var displayName = t.name ? (t.symbol ? t.name + ' (' + t.symbol + ')' : t.name) : trunc(t.mint);
            var row = document.createElement('div');
            row.className = 'token-row';
            row.innerHTML =
                '<input type="checkbox" class="burn-cb" data-idx="' + i + '" checked>' +
                '<div style="width:32px;height:32px;border-radius:6px;overflow:hidden;background:var(--surface-2);flex-shrink:0;">' +
                    '<img class="burn-img" data-idx="' + i + '" src="" onerror="this.style.display=\'none\'" alt="" style="width:32px;height:32px;object-fit:cover;">' +
                '</div>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:0.8rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(displayName) + '</div>' +
                    '<div style="font-size:0.68rem;color:var(--text-dim);font-family:monospace;">' + trunc(t.mint) + '</div>' +
                '</div>' +
                '<div style="font-size:0.74rem;color:var(--text-muted);white-space:nowrap;margin-right:6px;">' + escapeHtml(String(t.uiAmount)) + '</div>' +
                '<span class="token-sol">~' + RENT_PER_ACCOUNT.toFixed(6) + ' SOL</span>';
            list.appendChild(row);
        });

        if (selectAll) selectAll.checked = true;
        updateBurnSummary();
        document.getElementById('burn-results').classList.remove('hidden');
    }

    async function scanBurnableTokens() {
        if (!walletPublicKey) return;
        var scanBtn = document.getElementById('burn-scan-btn');
        if (scanBtn) scanBtn.disabled = true;
        document.getElementById('burn-results').classList.add('hidden');
        document.getElementById('burn-token-list').innerHTML = '';
        burnableTokens = [];
        setBurnStatus('Scanning wallet for tokens...', 'loading');

        try {
            var connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');
            var owner = new solanaWeb3.PublicKey(walletPublicKey);

            var results = await Promise.all([
                connection.getParsedTokenAccountsByOwner(owner, { programId: new solanaWeb3.PublicKey(TOKEN_PROGRAM_ID) }),
                connection.getParsedTokenAccountsByOwner(owner, { programId: new solanaWeb3.PublicKey(TOKEN_2022_PROGRAM_ID) })
            ]);

            var all = [
                ...(results[0].value || []).map(function(a) { return Object.assign({}, a, { programId: TOKEN_PROGRAM_ID }); }),
                ...(results[1].value || []).map(function(a) { return Object.assign({}, a, { programId: TOKEN_2022_PROGRAM_ID }); })
            ];

            var withBalance = all.filter(function(a) {
                var info = a.account.data.parsed && a.account.data.parsed.info;
                return info && info.tokenAmount && BigInt(info.tokenAmount.amount) > BigInt(0);
            });

            if (withBalance.length === 0) {
                clearBurnStatus();
                setBurnStatus('No tokens with balance found in this wallet.', 'info');
                if (scanBtn) scanBtn.disabled = false;
                return;
            }

            setBurnStatus('Found ' + withBalance.length + ' token(s). Fetching metadata...', 'loading');

            burnableTokens = withBalance.map(function(a) {
                var info = a.account.data.parsed.info;
                return {
                    pubkey:    a.pubkey.toString(),
                    mint:      info.mint,
                    amount:    info.tokenAmount.amount,
                    uiAmount:  info.tokenAmount.uiAmountString || String(info.tokenAmount.uiAmount || '?'),
                    decimals:  info.tokenAmount.decimals,
                    programId: a.programId,
                    name: '',
                    symbol: '',
                    uri: ''
                };
            });

            // Batch-fetch Metaplex metadata PDAs
            try {
                var pdas = burnableTokens.map(function(t) {
                    return findMetadataPDA(new solanaWeb3.PublicKey(t.mint));
                });
                var metaAccounts = await connection.getMultipleAccountsInfo(pdas);
                metaAccounts.forEach(function(acct, i) {
                    if (!acct || !acct.data) return;
                    var decoded = decodeMetadata(new Uint8Array(acct.data));
                    if (decoded) {
                        burnableTokens[i].name   = decoded.name;
                        burnableTokens[i].symbol = decoded.symbol;
                        burnableTokens[i].uri    = decoded.uri;
                    }
                });
            } catch(e) { /* metadata fetch failed — show truncated mints */ }

            clearBurnStatus();
            renderBurnResults();

            // Lazy-load token images from URI JSON
            burnableTokens.forEach(function(t, i) {
                if (!t.uri) return;
                fetch(t.uri)
                    .then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(meta) {
                        if (!meta || !meta.image) return;
                        var imgEl = document.querySelector('.burn-img[data-idx="' + i + '"]');
                        if (imgEl) { imgEl.style.display = ''; imgEl.src = meta.image; }
                    })
                    .catch(function() {});
            });

        } catch(e) {
            setBurnStatus('Scan failed: ' + (e.message || String(e)), 'error');
        }

        if (scanBtn) scanBtn.disabled = false;
    }

    async function executeBurn(selected) {
        if (!selected || selected.length === 0) return;
        var burnBtn  = document.getElementById('burn-btn');
        var scanBtn  = document.getElementById('burn-scan-btn');
        if (burnBtn) burnBtn.disabled = true;
        if (scanBtn) scanBtn.disabled = true;

        var connection   = new solanaWeb3.Connection(RPC_URL, 'confirmed');
        var walletPubkey = new solanaWeb3.PublicKey(walletPublicKey);
        var tokenProgPk  = new solanaWeb3.PublicKey(TOKEN_PROGRAM_ID);
        var t22ProgPk    = new solanaWeb3.PublicKey(TOKEN_2022_PROGRAM_ID);

        var chunks = [];
        for (var i = 0; i < selected.length; i += BURN_MAX_PER_TX) {
            chunks.push(selected.slice(i, i + BURN_MAX_PER_TX));
        }

        var fi = getActiveFeeInfo();
        var treasuryPubkey = new solanaWeb3.PublicKey(fi.treasury);
        var RENT_EXEMPT_MIN = 890880;

        var referrerPubkey = fi.referrer_wallet ? new solanaWeb3.PublicKey(fi.referrer_wallet) : null;
        if (referrerPubkey) {
            try {
                var refBal = await connection.getBalance(referrerPubkey);
                var refFirst = Math.round(chunks[0].length * RENT_LAMPORTS * fi.referrer_bps / 10000);
                if (refBal + refFirst < RENT_EXEMPT_MIN) referrerPubkey = null;
            } catch(e) {}
        }

        var totalNetLamports = 0;
        var signatures = [];

        try {
            for (var ci = 0; ci < chunks.length; ci++) {
                setBurnStatus('Sending transaction ' + (ci + 1) + ' of ' + chunks.length + '...', 'loading');

                var latestBlockhash = await connection.getLatestBlockhash('finalized');
                var tx = new solanaWeb3.Transaction();
                tx.recentBlockhash = latestBlockhash.blockhash;
                tx.feePayer = walletPubkey;

                tx.add(solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));
                tx.add(solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

                chunks[ci].forEach(function(t) {
                    var progPk      = t.programId === TOKEN_2022_PROGRAM_ID ? t22ProgPk : tokenProgPk;
                    var tokenAccPk  = new solanaWeb3.PublicKey(t.pubkey);
                    var mintPk      = new solanaWeb3.PublicKey(t.mint);
                    var bigAmt      = BigInt(t.amount);

                    // Burn instruction (index 8): [8, u64LE(amount)]
                    var burnData = new Uint8Array(9);
                    burnData[0] = 8;
                    var rem = bigAmt;
                    for (var bi = 0; bi < 8; bi++) {
                        burnData[1 + bi] = Number(rem & BigInt(0xff));
                        rem >>= BigInt(8);
                    }
                    tx.add(new solanaWeb3.TransactionInstruction({
                        keys: [
                            { pubkey: tokenAccPk, isSigner: false, isWritable: true },
                            { pubkey: mintPk,     isSigner: false, isWritable: true },
                            { pubkey: walletPubkey, isSigner: true, isWritable: false }
                        ],
                        programId: progPk,
                        data: burnData
                    }));

                    // CloseAccount instruction (index 9)
                    tx.add(new solanaWeb3.TransactionInstruction({
                        keys: [
                            { pubkey: tokenAccPk,  isSigner: false, isWritable: true },
                            { pubkey: walletPubkey, isSigner: false, isWritable: true },
                            { pubkey: walletPubkey, isSigner: true,  isWritable: false }
                        ],
                        programId: progPk,
                        data: new Uint8Array([9])
                    }));
                });

                // Fee transfers (same as reclaim)
                var grossLamports    = chunks[ci].length * RENT_LAMPORTS;
                var referrerLamports = referrerPubkey ? Math.round(grossLamports * fi.referrer_bps / 10000) : 0;
                var netBps           = 10000 - fi.treasury_bps - (referrerPubkey ? fi.referrer_bps : 0);
                var treasuryLamports = grossLamports - Math.round(grossLamports * netBps / 10000) - referrerLamports;
                var netLamports      = grossLamports - treasuryLamports - referrerLamports;

                tx.add(makeSolTransfer(walletPubkey, treasuryPubkey, treasuryLamports));
                if (referrerPubkey && referrerLamports > 0) {
                    tx.add(makeSolTransfer(walletPubkey, referrerPubkey, referrerLamports));
                }

                var signed = await wallet.signTransaction(tx);
                var sig;
                try {
                    sig = await connection.sendRawTransaction(signed.serialize(), {
                        skipPreflight: false,
                        preflightCommitment: 'confirmed'
                    });
                } catch(sendErr) {
                    var sendMsg = sendErr.message || String(sendErr);
                    if (sendMsg.toLowerCase().includes('simulation') || sendMsg.toLowerCase().includes('preflight')) {
                        sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
                    } else { throw sendErr; }
                }

                signatures.push(sig);
                totalNetLamports += netLamports;

                connection.confirmTransaction({
                    signature: sig,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                }, 'confirmed').catch(function(){});
            }

            var totalNetSol = (totalNetLamports / 1e9).toFixed(4);
            var burnedSet = new Set(selected.map(function(t) { return t.pubkey; }));
            burnableTokens = burnableTokens.filter(function(t) { return !burnedSet.has(t.pubkey); });

            var lastSig = signatures[signatures.length - 1];
            clearBurnStatus();
            setBurnStatus(
                selected.length + ' token(s) burned · ' + totalNetSol + ' SOL reclaimed · ' +
                '<a href="https://solscan.io/tx/' + lastSig + '" target="_blank" rel="noopener">View TX ↗</a>',
                'success'
            );

            if (burnableTokens.length > 0) {
                renderBurnResults();
            } else {
                document.getElementById('burn-results').classList.add('hidden');
            }

        } catch(e) {
            var msg = e.message || String(e);
            if (msg.includes('rejected') || msg.includes('cancelled') || e.code === 4001) {
                setBurnStatus('Transaction cancelled.', 'error');
            } else {
                setBurnStatus('Error: ' + msg, 'error');
            }
            if (burnBtn) burnBtn.disabled = false;
        }

        if (scanBtn) scanBtn.disabled = false;
    }

    // Burn tab event listeners
    document.getElementById('burn-scan-btn').addEventListener('click', scanBurnableTokens);

    document.getElementById('burn-select-all').addEventListener('change', function() {
        var checked = this.checked;
        document.querySelectorAll('.burn-cb').forEach(function(cb) { cb.checked = checked; });
        updateBurnSummary();
    });

    document.getElementById('burn-token-list').addEventListener('change', function(e) {
        if (e.target.classList.contains('burn-cb')) updateBurnSummary();
    });

    document.getElementById('burn-btn').addEventListener('click', function() {
        var selected = getBurnSelected();
        if (selected.length === 0) return;
        document.getElementById('burn-warn-count').textContent = selected.length;
        document.getElementById('burn-warning-overlay').classList.remove('hidden');
    });

    document.getElementById('burn-confirm-btn').addEventListener('click', function() {
        document.getElementById('burn-warning-overlay').classList.add('hidden');
        executeBurn(getBurnSelected());
    });

    document.getElementById('burn-warning-overlay').addEventListener('click', function(e) {
        if (e.target === this) this.classList.add('hidden');
    });

    // ── NFT Burn Tab ───────────────────────────────────────────────────────────

    const NFT_BATCH_SIZE = 5; // BurnNft uses 6 accounts per NFT

    function updateNftWalletState() {
        var noWalletEl = document.getElementById('nft-no-wallet');
        var walletEl   = document.getElementById('nft-wallet-section');
        var addrEl     = document.getElementById('nft-wallet-addr');
        if (!noWalletEl || !walletEl) return;
        if (walletPublicKey) {
            if (addrEl) addrEl.textContent = trunc(walletPublicKey);
            noWalletEl.classList.add('hidden');
            walletEl.classList.remove('hidden');
        } else {
            noWalletEl.classList.remove('hidden');
            walletEl.classList.add('hidden');
        }
    }

    function setNftStatus(msg, type) {
        var el = document.getElementById('nft-status');
        if (!el) return;
        el.className = 'status-area ' + (type || '');
        if (type === 'success' || type === 'info') el.innerHTML = msg;
        else el.textContent = msg;
    }

    function clearNftStatus() {
        var el = document.getElementById('nft-status');
        if (el) { el.className = 'status-area'; el.textContent = ''; }
    }

    function findMasterEditionPDA(mintPubkey) {
        return solanaWeb3.PublicKey.findProgramAddressSync(
            [
                new TextEncoder().encode('metadata'),
                METADATA_PROG_ID.toBytes(),
                mintPubkey.toBytes(),
                new TextEncoder().encode('edition')
            ],
            METADATA_PROG_ID
        )[0];
    }

    function updateNftSummary() {
        var checked = 0;
        var totalLamports = 0;
        document.querySelectorAll('.nft-cb:checked').forEach(function(cb) {
            var idx = parseInt(cb.dataset.idx);
            if (nftItems[idx] && !nftItems[idx].isPNFT) {
                checked++;
                totalLamports += nftItems[idx].grossLamports;
            }
        });
        var fi = getActiveFeeInfo();
        var netSol = (totalLamports / 1e9) * (1 - fi.total_bps / 10000);
        var el = document.getElementById('nft-summary');
        if (el) el.textContent = checked + ' selected · ~' + netSol.toFixed(4) + ' SOL rent back';
        var burnBtn = document.getElementById('nft-burn-btn');
        if (burnBtn) burnBtn.disabled = (checked === 0);
    }

    function getNftSelected() {
        return Array.from(document.querySelectorAll('.nft-cb:checked'))
            .map(function(cb) { return nftItems[parseInt(cb.dataset.idx)]; })
            .filter(function(nft) { return nft && !nft.isPNFT; });
    }

    function renderNftResults() {
        var list = document.getElementById('nft-token-list');
        var selectAll = document.getElementById('nft-select-all');
        if (!list) return;
        list.innerHTML = '';

        nftItems.forEach(function(nft, i) {
            var displayName = nft.name || trunc(nft.mint);
            var rentEst = nft.hasEdition
                ? (nft.grossLamports / 1e9).toFixed(4) + ' SOL'
                : '~' + RENT_PER_ACCOUNT.toFixed(6) + ' SOL';
            var row = document.createElement('div');
            row.className = 'token-row';
            if (nft.isPNFT) row.style.opacity = '0.55';
            var pNFTBadge = nft.isPNFT
                ? '<span title="Programmable NFTs require a dedicated marketplace to burn" style="font-size:0.6rem;background:rgba(255,140,0,0.15);color:#FF8C00;border:1px solid rgba(255,140,0,0.3);border-radius:4px;padding:1px 5px;margin-left:5px;vertical-align:middle;">pNFT</span>'
                : '';
            row.innerHTML =
                '<input type="checkbox" class="nft-cb" data-idx="' + i + '"' + (nft.isPNFT ? ' disabled' : ' checked') + '>' +
                '<div style="width:40px;height:40px;border-radius:8px;overflow:hidden;background:var(--surface-2);flex-shrink:0;">' +
                    '<img class="nft-img" data-idx="' + i + '" src="" onerror="this.style.display=\'none\'" alt="" style="width:40px;height:40px;object-fit:cover;">' +
                '</div>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:0.8rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(displayName) + pNFTBadge + '</div>' +
                    '<div style="font-size:0.68rem;color:var(--text-dim);font-family:monospace;">' + trunc(nft.mint) + '</div>' +
                '</div>' +
                '<span class="token-sol">' + (nft.isPNFT ? '—' : rentEst) + '</span>';
            list.appendChild(row);
        });

        if (selectAll) selectAll.checked = true;
        updateNftSummary();
        document.getElementById('nft-results').classList.remove('hidden');
    }

    async function batchGetAccounts(connection, pubkeys) {
        var results = [];
        var CHUNK = 100;
        for (var i = 0; i < pubkeys.length; i += CHUNK) {
            var batch = await connection.getMultipleAccountsInfo(pubkeys.slice(i, i + CHUNK));
            results = results.concat(batch);
        }
        return results;
    }

    async function scanNftItems() {
        if (!walletPublicKey) return;
        var scanBtn = document.getElementById('nft-scan-btn');
        if (scanBtn) scanBtn.disabled = true;
        document.getElementById('nft-results').classList.add('hidden');
        document.getElementById('nft-token-list').innerHTML = '';
        nftItems = [];
        setNftStatus('Scanning wallet for NFTs...', 'loading');

        try {
            var connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');
            var owner = new solanaWeb3.PublicKey(walletPublicKey);

            var results = await Promise.all([
                connection.getParsedTokenAccountsByOwner(owner, { programId: new solanaWeb3.PublicKey(TOKEN_PROGRAM_ID) }),
                connection.getParsedTokenAccountsByOwner(owner, { programId: new solanaWeb3.PublicKey(TOKEN_2022_PROGRAM_ID) })
            ]);

            var all = [
                ...(results[0].value || []).map(function(a) { return Object.assign({}, a, { programId: TOKEN_PROGRAM_ID }); }),
                ...(results[1].value || []).map(function(a) { return Object.assign({}, a, { programId: TOKEN_2022_PROGRAM_ID }); })
            ];

            // NFTs: decimals = 0, amount = 1
            var nftAccounts = all.filter(function(a) {
                var info = a.account.data.parsed && a.account.data.parsed.info;
                return info && info.tokenAmount &&
                    info.tokenAmount.decimals === 0 &&
                    info.tokenAmount.amount === '1';
            });

            if (nftAccounts.length === 0) {
                clearNftStatus();
                setNftStatus('No NFTs found in this wallet.', 'info');
                if (scanBtn) scanBtn.disabled = false;
                return;
            }

            setNftStatus('Found ' + nftAccounts.length + ' NFT(s). Fetching metadata...', 'loading');

            // Build initial nftItems
            var mints = nftAccounts.map(function(a) {
                return new solanaWeb3.PublicKey(a.account.data.parsed.info.mint);
            });

            var metadataPDAs   = mints.map(findMetadataPDA);
            var editionPDAs    = mints.map(findMasterEditionPDA);

            // Batch-fetch metadata and edition accounts
            var metaAccounts    = await batchGetAccounts(connection, metadataPDAs);
            var editionAccounts = await batchGetAccounts(connection, editionPDAs);

            nftAccounts.forEach(function(a, i) {
                var info = a.account.data.parsed.info;
                var hasMetadata = !!(metaAccounts[i] && metaAccounts[i].data);
                var hasEdition  = !!(editionAccounts[i] && editionAccounts[i].lamports > 0);
                var metaLam     = hasMetadata ? (metaAccounts[i].lamports || 0) : 0;
                var editionLam  = hasEdition  ? (editionAccounts[i].lamports || 0) : 0;
                var grossLam    = RENT_LAMPORTS + metaLam + editionLam;

                var decoded = hasMetadata ? decodeMetadata(new Uint8Array(metaAccounts[i].data)) : null;

                nftItems.push({
                    pubkey:          a.pubkey.toString(),
                    mint:            info.mint,
                    programId:       a.programId,
                    metadataPDA:     metadataPDAs[i],
                    editionPDA:      editionPDAs[i],
                    hasMetadata:     hasMetadata,
                    hasEdition:      hasEdition,
                    isPNFT:          !!(decoded && decoded.tokenStandard === 4),
                    metadataLamports: metaLam,
                    editionLamports:  editionLam,
                    grossLamports:   grossLam,
                    name:    decoded ? decoded.name   : '',
                    symbol:  decoded ? decoded.symbol : '',
                    uri:     decoded ? decoded.uri    : ''
                });
            });

            clearNftStatus();
            renderNftResults();

            // Lazy-load images
            nftItems.forEach(function(nft, i) {
                if (!nft.uri) return;
                fetch(nft.uri)
                    .then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(meta) {
                        if (!meta || !meta.image) return;
                        var imgEl = document.querySelector('.nft-img[data-idx="' + i + '"]');
                        if (imgEl) { imgEl.style.display = ''; imgEl.src = meta.image; }
                    })
                    .catch(function() {});
            });

        } catch(e) {
            setNftStatus('Scan failed: ' + (e.message || String(e)), 'error');
        }

        if (scanBtn) scanBtn.disabled = false;
    }

    async function executeNftBurn(selected) {
        if (!selected || selected.length === 0) return;
        var burnBtn = document.getElementById('nft-burn-btn');
        var scanBtn = document.getElementById('nft-scan-btn');
        if (burnBtn) burnBtn.disabled = true;
        if (scanBtn) scanBtn.disabled = true;

        var connection   = new solanaWeb3.Connection(RPC_URL, 'confirmed');
        var walletPubkey = new solanaWeb3.PublicKey(walletPublicKey);
        var tokenProgPk  = new solanaWeb3.PublicKey(TOKEN_PROGRAM_ID);
        var t22ProgPk    = new solanaWeb3.PublicKey(TOKEN_2022_PROGRAM_ID);

        var chunks = [];
        for (var i = 0; i < selected.length; i += NFT_BATCH_SIZE) {
            chunks.push(selected.slice(i, i + NFT_BATCH_SIZE));
        }

        var fi = getActiveFeeInfo();
        var treasuryPubkey = new solanaWeb3.PublicKey(fi.treasury);
        var RENT_EXEMPT_MIN = 890880;

        var referrerPubkey = fi.referrer_wallet ? new solanaWeb3.PublicKey(fi.referrer_wallet) : null;
        if (referrerPubkey) {
            try {
                var refBal = await connection.getBalance(referrerPubkey);
                var refFirst = Math.round(chunks[0].reduce(function(s, n) { return s + n.grossLamports; }, 0) * fi.referrer_bps / 10000);
                if (refBal + refFirst < RENT_EXEMPT_MIN) referrerPubkey = null;
            } catch(e) {}
        }

        var totalNetLamports = 0;
        var signatures = [];

        try {
            for (var ci = 0; ci < chunks.length; ci++) {
                setNftStatus('Sending transaction ' + (ci + 1) + ' of ' + chunks.length + '...', 'loading');

                var latestBlockhash = await connection.getLatestBlockhash('finalized');
                var tx = new solanaWeb3.Transaction();
                tx.recentBlockhash = latestBlockhash.blockhash;
                tx.feePayer = walletPubkey;

                tx.add(solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));
                tx.add(solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

                chunks[ci].forEach(function(nft) {
                    var tokenAccPk = new solanaWeb3.PublicKey(nft.pubkey);
                    var mintPk     = new solanaWeb3.PublicKey(nft.mint);
                    var progPk     = nft.programId === TOKEN_2022_PROGRAM_ID ? t22ProgPk : tokenProgPk;

                    if (nft.hasEdition && nft.programId === TOKEN_PROGRAM_ID) {
                        // Metaplex BurnNft (index 29) — burns metadata + edition + token account
                        tx.add(new solanaWeb3.TransactionInstruction({
                            programId: METADATA_PROG_ID,
                            keys: [
                                { pubkey: nft.metadataPDA,     isSigner: false, isWritable: true  },
                                { pubkey: walletPubkey,         isSigner: true,  isWritable: true  },
                                { pubkey: mintPk,               isSigner: false, isWritable: true  },
                                { pubkey: tokenAccPk,           isSigner: false, isWritable: true  },
                                { pubkey: nft.editionPDA,       isSigner: false, isWritable: true  },
                                { pubkey: tokenProgPk,          isSigner: false, isWritable: false }
                            ],
                            data: new Uint8Array([29])
                        }));
                    } else {
                        // Fallback: SPL burn + close (non-Metaplex or Token 2022)
                        var burnData = new Uint8Array(9);
                        burnData[0] = 8;
                        var rem = BigInt(1);
                        for (var bi = 0; bi < 8; bi++) {
                            burnData[1 + bi] = Number(rem & BigInt(0xff));
                            rem >>= BigInt(8);
                        }
                        tx.add(new solanaWeb3.TransactionInstruction({
                            keys: [
                                { pubkey: tokenAccPk,   isSigner: false, isWritable: true  },
                                { pubkey: mintPk,        isSigner: false, isWritable: true  },
                                { pubkey: walletPubkey,  isSigner: true,  isWritable: false }
                            ],
                            programId: progPk,
                            data: burnData
                        }));
                        tx.add(new solanaWeb3.TransactionInstruction({
                            keys: [
                                { pubkey: tokenAccPk,   isSigner: false, isWritable: true },
                                { pubkey: walletPubkey,  isSigner: false, isWritable: true },
                                { pubkey: walletPubkey,  isSigner: true,  isWritable: false }
                            ],
                            programId: progPk,
                            data: new Uint8Array([9])
                        }));
                    }
                });

                // Fee based on total gross lamports for this chunk
                var grossLamports    = chunks[ci].reduce(function(s, n) { return s + n.grossLamports; }, 0);
                var referrerLamports = referrerPubkey ? Math.round(grossLamports * fi.referrer_bps / 10000) : 0;
                var netBps           = 10000 - fi.treasury_bps - (referrerPubkey ? fi.referrer_bps : 0);
                var treasuryLamports = grossLamports - Math.round(grossLamports * netBps / 10000) - referrerLamports;
                var netLamports      = grossLamports - treasuryLamports - referrerLamports;

                tx.add(makeSolTransfer(walletPubkey, treasuryPubkey, treasuryLamports));
                if (referrerPubkey && referrerLamports > 0) {
                    tx.add(makeSolTransfer(walletPubkey, referrerPubkey, referrerLamports));
                }

                var signed = await wallet.signTransaction(tx);
                var sig;
                try {
                    sig = await connection.sendRawTransaction(signed.serialize(), {
                        skipPreflight: false,
                        preflightCommitment: 'confirmed'
                    });
                } catch(sendErr) {
                    var sendMsg = sendErr.message || String(sendErr);
                    if (sendMsg.toLowerCase().includes('simulation') || sendMsg.toLowerCase().includes('preflight')) {
                        sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
                    } else { throw sendErr; }
                }

                signatures.push(sig);
                totalNetLamports += netLamports;

                connection.confirmTransaction({
                    signature: sig,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                }, 'confirmed').catch(function(){});
            }

            var totalNetSol = (totalNetLamports / 1e9).toFixed(4);
            var burnedSet = new Set(selected.map(function(n) { return n.pubkey; }));
            nftItems = nftItems.filter(function(n) { return !burnedSet.has(n.pubkey); });

            var lastSig = signatures[signatures.length - 1];
            clearNftStatus();
            setNftStatus(
                selected.length + ' NFT(s) burned · ' + totalNetSol + ' SOL reclaimed · ' +
                '<a href="https://solscan.io/tx/' + lastSig + '" target="_blank" rel="noopener">View TX ↗</a>',
                'success'
            );

            if (nftItems.length > 0) {
                renderNftResults();
            } else {
                document.getElementById('nft-results').classList.add('hidden');
            }

        } catch(e) {
            var msg = e.message || String(e);
            if (msg.includes('rejected') || msg.includes('cancelled') || e.code === 4001) {
                setNftStatus('Transaction cancelled.', 'error');
            } else {
                setNftStatus('Error: ' + msg, 'error');
            }
            if (burnBtn) burnBtn.disabled = false;
        }

        if (scanBtn) scanBtn.disabled = false;
    }

    // NFT tab event listeners
    document.getElementById('nft-scan-btn').addEventListener('click', scanNftItems);

    document.getElementById('nft-select-all').addEventListener('change', function() {
        var checked = this.checked;
        document.querySelectorAll('.nft-cb').forEach(function(cb) { cb.checked = checked; });
        updateNftSummary();
    });

    document.getElementById('nft-token-list').addEventListener('change', function(e) {
        if (e.target.classList.contains('nft-cb')) updateNftSummary();
    });

    document.getElementById('nft-burn-btn').addEventListener('click', function() {
        var selected = getNftSelected();
        if (selected.length === 0) return;
        document.getElementById('nft-warn-count').textContent = selected.length;
        document.getElementById('nft-warning-overlay').classList.remove('hidden');
    });

    document.getElementById('nft-confirm-btn').addEventListener('click', function() {
        document.getElementById('nft-warning-overlay').classList.add('hidden');
        executeNftBurn(getNftSelected());
    });

    document.getElementById('nft-warning-overlay').addEventListener('click', function(e) {
        if (e.target === this) this.classList.add('hidden');
    });

})();
