(function () {
    const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=a26fbdc4-571b-4340-87f0-5a2bbbc2cb47';
    const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
    const TREASURY = 'ratU71Bedbf7196sexgCyBoRxM2Zjb7vBxJ5MJeBYGb';
    const RENT_PER_ACCOUNT = 0.00203928;
    const RENT_LAMPORTS    = 2039280; // RENT_PER_ACCOUNT * 1e9, exact integer
    const MAX_PER_TX = 22; // reduced from 25 to leave room for fee transfer instructions

    let wallet = null;
    let walletPublicKey = null;
    let closableAccounts = [];
    let feeInfo = null;
    let userRefLink = 'https://ratrepublic.art/register.html';

    const connectBtn      = document.getElementById('connect-btn');
    const walletModal     = document.getElementById('wallet-modal');
    const modalCloseBtn   = document.getElementById('modal-close-btn');
    const optPhantom      = document.getElementById('opt-phantom');
    const optSolflare     = document.getElementById('opt-solflare');
    const optBackpack     = document.getElementById('opt-backpack');
    const badgePhantom    = document.getElementById('badge-phantom');
    const badgeSolflare   = document.getElementById('badge-solflare');
    const badgeBackpack   = document.getElementById('badge-backpack');
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

    function showSuccess(solAmount) {
        solDisplayWrap.classList.add('hidden');
        toolImageWrap.classList.add('hidden');
        scanSection.classList.add('hidden');
        clearStatus();
        resultsSection.classList.add('hidden');
        successAmount.textContent = solAmount + ' SOL';
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
    };

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
        fetch('stats.php')
            .then(function (r) { return r.json(); })
            .then(function (s) {
                document.getElementById('stat-users').textContent    = Number(s.users_served).toLocaleString();
                document.getElementById('stat-accounts').textContent = Number(s.accounts_closed).toLocaleString();
                document.getElementById('stat-sol').textContent      = Number(s.sol_recovered).toFixed(2);
                document.getElementById('stat-highest').textContent  = Number(s.highest_sol).toFixed(4);
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
        if (name === 'solflare') return window.solflare        || null;
        if (name === 'backpack') return window.backpack        || null;
        return null;
    }

    var WALLET_ICONS = {
        phantom:  '<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="9" fill="#9945FF"/><path d="M18 8C12.477 8 8 12.477 8 18v10l3-2 3 2 3-2 2 2 2-2 3 2 3-2V18C27 12.477 22.523 8 18 8z" fill="white"/><circle cx="14.5" cy="19" r="2" fill="#9945FF"/><circle cx="21.5" cy="19" r="2" fill="#9945FF"/></svg>',
        solflare: '<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="9" fill="#FC7C00"/><path d="M22 13.5C22 13.5 21 11 18 11 15 11 13 13 13 15c0 2 1.5 3 4 3.5 2.5.5 4.5 1.5 4.5 4 0 2.5-2 3.5-4 3.5-2.5 0-4-2-4-2" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>',
        backpack: '<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="9" fill="#E33D43"/><rect x="11" y="16" width="14" height="13" rx="2.5" fill="white"/><path d="M15 16v-2.5a3 3 0 016 0V16" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="14.5" y="20" width="7" height="4" rx="1.5" fill="#E33D43"/></svg>'
    };

    function initModal() {
        var map = [
            { name: 'phantom',  opt: optPhantom,  badge: badgePhantom,  iconEl: document.getElementById('icon-phantom')  },
            { name: 'solflare', opt: optSolflare, badge: badgeSolflare, iconEl: document.getElementById('icon-solflare') },
            { name: 'backpack', opt: optBackpack,  badge: badgeBackpack,  iconEl: document.getElementById('icon-backpack')  }
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
        var names = ['phantom', 'solflare', 'backpack'];
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
            const resp = await provider.connect();
            wallet = provider;
            walletPublicKey = (resp && resp.publicKey ? resp.publicKey : provider.publicKey).toString();
            walletDisplay.textContent = trunc(walletPublicKey);
            connectSection.classList.add('hidden');
            scanSection.classList.remove('hidden');
            fetchFeeInfo();
            triggerScan();
        } catch (e) {
            setStatus('Connection rejected.', 'error');
        }
    }

    optPhantom.addEventListener('click',  function () { connectWith('phantom'); });
    optSolflare.addEventListener('click', function () { connectWith('solflare'); });
    optBackpack.addEventListener('click',  function () { connectWith('backpack'); });

    // --- Disconnect ---
    disconnectBtn.addEventListener('click', async function () {
        try { await wallet?.disconnect(); } catch (e) { /* ignore */ }
        wallet = null;
        walletPublicKey = null;
        closableAccounts = [];
        feeInfo = null;
        scanSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
        connectSection.classList.remove('hidden');
        setUnclaimedDisplay(null);
        clearStatus();
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
        const treasuryPubkey  = new solanaWeb3.PublicKey(fi.treasury);
        const referrerPubkey  = fi.referrer_wallet ? new solanaWeb3.PublicKey(fi.referrer_wallet) : null;

        let totalNetLamports = 0;
        let totalAccounts    = 0;
        const signatures     = [];

        try {
            for (let ci = 0; ci < chunks.length; ci++) {
                setStatus('Sending transaction ' + (ci + 1) + ' of ' + chunks.length + '...', 'loading');

                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
                const tx = new solanaWeb3.Transaction();
                tx.recentBlockhash = blockhash;
                tx.feePayer = walletPubkey;

                // Explicit compute budget — prevents Phantom from running its own pre-simulation
                // which fails when a SOL transfer follows token closes in the same transaction
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

                // Fee transfers at end of same transaction
                const grossLamports    = chunks[ci].length * RENT_LAMPORTS;
                const treasuryLamports = Math.round(grossLamports * fi.treasury_bps / 10000);
                const referrerLamports = referrerPubkey ? Math.round(grossLamports * fi.referrer_bps / 10000) : 0;
                const netLamports      = grossLamports - treasuryLamports - referrerLamports;

                tx.add(makeSolTransfer(walletPubkey, treasuryPubkey, treasuryLamports));
                if (referrerPubkey && referrerLamports > 0) {
                    tx.add(makeSolTransfer(walletPubkey, referrerPubkey, referrerLamports));
                }

                const result = await wallet.signAndSendTransaction(tx);
                const sig = result.signature;
                signatures.push(sig);

                setStatus('Confirming transaction ' + (ci + 1) + '...', 'loading');
                await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

                totalNetLamports += netLamports;
                totalAccounts    += chunks[ci].length;

                const chunkNetSol    = (netLamports / 1e9).toFixed(4);
                const chunkRefSol   = referrerLamports > 0 ? referrerLamports / 1e9 : null;
                recordReclaim(walletPublicKey, chunks[ci].length, chunkNetSol, sig, fi.referrer_wallet, chunkRefSol);
            }

            const totalNetSol = (totalNetLamports / 1e9).toFixed(4);
            const closedSet = new Set(selected.map(function (a) { return a.pubkey; }));
            closableAccounts = closableAccounts.filter(function (a) { return !closedSet.has(a.pubkey); });
            showSuccess(totalNetSol);

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
})();
