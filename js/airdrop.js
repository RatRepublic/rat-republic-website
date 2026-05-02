/* Mass Send — Rat Republic */

const RPC_URL  = window.location.origin + '/api/rpc.php';
const TREASURY = new solanaWeb3.PublicKey('ratU71Bedbf7196sexgCyBoRxM2Zjb7vBxJ5MJeBYGb');
const FEE_LAM  = 8_000_000; // 0.008 SOL per batch
const SOL_BATCH = 20;
const TOK_BATCH = 8; // smaller due to createATA + transfer per recipient

const TOKEN_PROG_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_ID = new solanaWeb3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ASSOC_TOK_ID  = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYS_PROG_ID   = solanaWeb3.SystemProgram.programId;

// Known program/protocol addresses that should never receive airdrops
const PROGRAM_BLOCKLIST = new Set([
    'strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m', // Streamflow Finance (vesting)
    'FGjLaVo5zLGdzCxMo9gu9tXr3kFNGFNiCqKPNDhUNRgU', // Streamflow v2
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM v4
    'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium CLMM
    'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', // Raydium CPMM
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',  // Orca Whirlpools
    '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Orca Token Swap v2
    'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB', // Meteora Dynamic AMM
    'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',  // Meteora DLMM
    '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',  // Pump.fun
    'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',  // Pump.fun AMM
]);

function getExcludeSet(pfx) {
    const el = document.getElementById(pfx + '-exclude');
    const manual = el ? el.value.split(/[\n,\s]+/).map(a => a.trim()).filter(Boolean) : [];
    return new Set([...PROGRAM_BLOCKLIST, ...manual]);
}

let walletPubkey  = null;
let walletProvider = null;
let csolHolders      = [];
let ctokHolders      = [];
let csolTotalSupply  = 0;
let ctokTotalSupply  = 0;
let csolMode     = 'even';
let ctokMode     = 'even';
let solMode  = 'custom';
let stokMode = 'custom';
let solDistPlan  = [];
let csolDistPlan = [];
let ctokDistPlan = [];
let stokDistPlan = [];
let senderTokens = []; // [{ mint, ata, amount, decimals, programId }]

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('panel-' + tab).classList.add('active');
}

function switchSubTab(sub) {
    document.querySelectorAll('#panel-community .sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#panel-community .sub-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('sub-tab-' + sub).classList.add('active');
    document.getElementById('sub-panel-' + sub).classList.add('active');
}

function switchSolSubTab(sub) {
    document.querySelectorAll('#panel-solana .sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#panel-solana .sub-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('sol-sub-tab-' + sub).classList.add('active');
    document.getElementById('sol-sub-panel-' + sub).classList.add('active');
}

// ── Wallet connection ─────────────────────────────────────────────────────────

const WALLET_ICONS = {
    phantom:  '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTA4IiBoZWlnaHQ9IjEwOCIgdmlld0JveD0iMCAwIDEwOCAxMDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00Ni41MjY3IDY5LjkyMjlDNDIuMDA1NCA3Ni44NTA5IDM0LjQyOTIgODUuNjE4MiAyNC4zNDggODUuNjE4MkMxOS41ODI0IDg1LjYxODIgMTUgODMuNjU2MyAxNSA3NS4xMzQyQzE1IDUzLjQzMDUgNDQuNjMyNiAxOS44MzI3IDcyLjEyNjggMTkuODMyN0M4Ny43NjggMTkuODMyNyA5NCAzMC42ODQ2IDk0IDQzLjAwNzlDOTQgNTguODI1OCA4My43MzU1IDc2LjkxMjIgNzMuNTMyMSA3Ni45MTIyQzcwLjI5MzkgNzYuOTEyMiA2OC43MDUzIDc1LjEzNDIgNjguNzA1MyA3Mi4zMTRDNjguNzA1MyA3MS41NzgzIDY4LjgyNzUgNzAuNzgxMiA2OS4wNzE5IDY5LjkyMjlDNjUuNTg5MyA3NS44Njk5IDU4Ljg2ODUgODEuMzg3OCA1Mi41NzU0IDgxLjM4NzhDNDcuOTkzIDgxLjM4NzggNDUuNjcxMyA3OC41MDYzIDQ1LjY3MTMgNzQuNDU5OEM0NS42NzEzIDcyLjk4ODQgNDUuOTc2OCA3MS40NTU2IDQ2LjUyNjcgNjkuOTIyOVpNODMuNjc2MSA0Mi41Nzk0QzgzLjY3NjEgNDYuMTcwNCA4MS41NTc1IDQ3Ljk2NTggNzkuMTg3NSA0Ny45NjU4Qzc2Ljc4MTYgNDcuOTY1OCA3NC42OTg5IDQ2LjE3MDQgNzQuNjk4OSA0Mi41Nzk0Qzc0LjY5ODkgMzguOTg4NSA3Ni43ODE2IDM3LjE5MzEgNzkuMTg3NSAzNy4xOTMxQzgxLjU1NzUgMzcuMTkzMSA4My42NzYxIDM4Ljk4ODUgODMuNjc2MSA0Mi41Nzk0Wk03MC4yMTAzIDQyLjU3OTVDNzAuMjEwMyA0Ni4xNzA0IDY4LjA5MTYgNDcuOTY1OCA2NS43MjE2IDQ3Ljk2NThDNjMuMzE1NyA0Ny45NjU4IDYxLjIzMyA0Ni4xNzA0IDYxLjIzMyA0Mi41Nzk1QzYxLjIzMyAzOC45ODg1IDYzLjMxNTcgMzcuMTkzMSA2NS43MjE2IDM3LjE5MzFDNjguMDkxNiAzNy4xOTMxIDcwLjIxMDMgMzguOTg4NSA3MC4yMTAzIDQyLjU3OTVaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPgo=" style="width:100%;height:100%;border-radius:10px;object-fit:cover;">',
    solflare: '<img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJTIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCA1MCI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiMwMjA1MGE7c3Ryb2tlOiNmZmVmNDY7c3Ryb2tlLW1pdGVybGltaXQ6MTA7c3Ryb2tlLXdpZHRoOi41cHg7fS5jbHMtMntmaWxsOiNmZmVmNDY7fTwvc3R5bGU+PC9kZWZzPjxyZWN0IGNsYXNzPSJjbHMtMiIgeD0iMCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiByeD0iMTIiIHJ5PSIxMiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTI0LjIzLDI2LjQybDIuNDYtMi4zOCw0LjU5LDEuNWMzLjAxLDEsNC41MSwyLjg0LDQuNTEsNS40MywwLDEuOTYtLjc1LDMuMjYtMi4yNSw0LjkzbC0uNDYuNS4xNy0xLjE3Yy42Ny00LjI2LS41OC02LjA5LTQuNzItNy40M2wtNC4zLTEuMzhoMFpNMTguMDUsMTEuODVsMTIuNTIsNC4xNy0yLjcxLDIuNTktNi41MS0yLjE3Yy0yLjI1LS43NS0zLjAxLTEuOTYtMy4zLTQuNTF2LS4wOGgwWk0xNy4zLDMzLjA2bDIuODQtMi43MSw1LjM0LDEuNzVjMi44LjkyLDMuNzYsMi4xMywzLjQ2LDUuMThsLTExLjY1LTQuMjJoMFpNMTMuNzEsMjAuOTVjMC0uNzkuNDItMS41NCwxLjEzLTIuMTcuNzUsMS4wOSwyLjA1LDIuMDUsNC4wOSwyLjcxbDQuNDIsMS40Ni0yLjQ2LDIuMzgtNC4zNC0xLjQyYy0yLS42Ny0yLjg0LTEuNjctMi44NC0yLjk2TTI2LjgyLDQyLjg3YzkuMTgtNi4wOSwxNC4xMS0xMC4yMywxNC4xMS0xNS4zMiwwLTMuMzgtMi01LjI2LTYuNDMtNi43MmwtMy4zNC0xLjEzLDkuMTQtOC43Ny0xLjg0LTEuOTYtMi43MSwyLjM4LTEyLjgxLTQuMjJjLTMuOTcsMS4yOS04Ljk3LDUuMDktOC45Nyw4Ljg5LDAsLjQyLjA0LjgzLjE3LDEuMjktMy4zLDEuODgtNC42MywzLjYzLTQuNjMsNS44LDAsMi4wNSwxLjA5LDQuMDksNC41NSw1LjIybDIuNzUuOTItOS41Miw5LjE0LDEuODQsMS45NiwyLjk2LTIuNzEsMTQuNzMsNS4yMmgwWiIvPjwvc3ZnPg==" style="width:100%;height:100%;border-radius:10px;object-fit:cover;">',
};

function getWalletProvider(name) {
    if (name === 'phantom')  return window.phantom?.solana || window.solana || null;
    if (name === 'solflare') return window.solflare || null;
    return null;
}

function initWalletModal() {
    [['phantom', 'opt-phantom', 'badge-phantom', 'icon-phantom'],
     ['solflare', 'opt-solflare', 'badge-solflare', 'icon-solflare']].forEach(([name, optId, badgeId, iconId]) => {
        const p      = getWalletProvider(name);
        const iconEl = document.getElementById(iconId);
        const badge  = document.getElementById(badgeId);
        const opt    = document.getElementById(optId);
        iconEl.style.background = 'none';
        iconEl.innerHTML = (p && p.icon)
            ? '<img src="' + p.icon + '" style="width:100%;height:100%;border-radius:10px;object-fit:cover;">'
            : WALLET_ICONS[name];
        if (p) { badge.classList.remove('hidden'); opt.classList.remove('wallet-disabled'); }
        else   { badge.classList.add('hidden');    opt.classList.add('wallet-disabled'); }
    });
}

function connectWallet(ctx) {
    initWalletModal();
    const overlay = document.getElementById('wallet-picker');
    overlay.dataset.ctx = ctx;
    overlay.classList.remove('hidden');
    document.getElementById('opt-phantom').onclick  = () => pickWallet('phantom');
    document.getElementById('opt-solflare').onclick = () => pickWallet('solflare');
}

function closeWalletPicker() {
    document.getElementById('wallet-picker').classList.add('hidden');
}

async function pickWallet(providerKey) {
    const overlay = document.getElementById('wallet-picker');
    const ctx = overlay.dataset.ctx;
    overlay.classList.add('hidden');

    const provider = getWalletProvider(providerKey);
    if (!provider) {
        const name = providerKey === 'phantom' ? 'Phantom' : 'Solflare';
        alert(name + ' not detected. Please install ' + name + ' and refresh the page.');
        return;
    }
    try {
        await provider.connect();
        walletProvider = provider;
        walletPubkey   = provider.publicKey.toString();
        const short = walletPubkey.slice(0, 4) + '…' + walletPubkey.slice(-4);
        ['sol', 'csol', 'ctok', 'stok'].forEach(c => {
            const btn  = document.getElementById(c + '-connect-btn');
            const addr = document.getElementById(c + '-connected-addr');
            if (btn) { btn.textContent = 'Disconnect'; btn.className = 'btn-disconnect'; btn.onclick = disconnectWallet; }
            if (addr) addr.textContent = 'Connected: ' + short;
        });
        if (document.getElementById('sol-preview-box').classList.contains('visible'))
            document.getElementById('sol-send-btn').disabled = false;
        if (document.getElementById('csol-preview-box').classList.contains('visible'))
            document.getElementById('csol-send-btn').disabled = false;
        if (document.getElementById('ctok-preview-box').classList.contains('visible'))
            document.getElementById('ctok-send-btn').disabled = false;
        if (document.getElementById('stok-preview-box').classList.contains('visible'))
            document.getElementById('stok-send-btn').disabled = false;
        setStatus(ctx + '-status', 'Wallet connected.', 'ok');
        if (ctx === 'ctok' || ctx === 'stok') await loadTokenDropdown(ctx);
    } catch (e) {
        setStatus(ctx + '-status', 'Connection cancelled.', 'err');
    }
}

function disconnectWallet() {
    try { if (walletProvider) walletProvider.disconnect(); } catch {}
    walletProvider = null;
    walletPubkey   = null;
    senderTokens   = [];
    solDistPlan = []; stokDistPlan = [];
    ['sol', 'csol', 'ctok', 'stok'].forEach(c => {
        const btn  = document.getElementById(c + '-connect-btn');
        const addr = document.getElementById(c + '-connected-addr');
        if (btn) { btn.textContent = 'Connect Wallet'; btn.className = 'btn-connect'; btn.onclick = () => connectWallet(c); }
        if (addr) addr.textContent = '';
        const sendBtn = document.getElementById(c + '-send-btn');
        if (sendBtn) sendBtn.disabled = true;
    });
    for (const id of ['ctok-token-select', 'stok-token-select']) {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = '<option value="">— Connect wallet to load tokens —</option>';
    }
}

// ── RPC via fetch (no Connection object) ──────────────────────────────────────

async function rpcCall(method, params) {
    const resp = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('RPC unreachable — upload files to the live server and test there (PHP does not run in Live Preview).'); }
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.result;
}

async function getLatestBlockhash() {
    const result = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
    return { blockhash: result.value.blockhash, lastValidBlockHeight: result.value.lastValidBlockHeight };
}

async function confirmTx(sig) {
    for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const result = await rpcCall('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]);
        const status = result?.value?.[0];
        if (status?.err) throw new Error('Transaction failed on-chain');
        if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) return;
    }
    // Timed out — transaction is likely already on-chain
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function setStatus(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = msg;
    el.className = 'status-line' + (type ? ' ' + type : '');
}

function u64LE(n) {
    const buf = new Uint8Array(8);
    let val = BigInt(Math.floor(n));
    for (let i = 0; i < 8; i++) { buf[i] = Number(val & 0xffn); val >>= 8n; }
    return buf;
}

function getAta(ownerPk, mintPk, tokenProgramId) {
    const [ata] = solanaWeb3.PublicKey.findProgramAddressSync(
        [ownerPk.toBytes(), tokenProgramId.toBytes(), mintPk.toBytes()],
        ASSOC_TOK_ID
    );
    return ata;
}

async function fetchHoldersMint(mint, decimals, minBal, maxBal, statusId) {
    const divisor = Math.pow(10, decimals);
    const holders = [];
    let totalSupply = 0;
    let page = 1;
    setStatus(statusId, 'Fetching holders…', '');
    while (true) {
        const data = await rpcCall('getTokenAccounts', { mint, limit: 1000, page });
        const accounts = data?.token_accounts ?? [];
        for (const acct of accounts) {
            const amt = parseInt(acct.amount ?? 0) / divisor;
            totalSupply += amt;
            if (amt >= minBal && (maxBal === null || amt <= maxBal)) {
                holders.push({ owner: acct.owner, amount: amt });
            }
        }
        if (accounts.length < 1000) break;
        page++;
        setStatus(statusId, 'Fetching holders… page ' + page, '');
    }
    const seen = new Set();
    const unique = [];
    for (const h of holders) {
        if (!seen.has(h.owner)) { seen.add(h.owner); unique.push(h); }
    }
    unique.sort((a, b) => b.amount - a.amount);
    return { holders: unique, totalSupply };
}

async function sendBatches(batches, makeTxFn, totalCount, pfxId) {
    document.getElementById(pfxId + '-progress-wrap').style.display = 'block';
    document.getElementById(pfxId + '-progress-fill').style.width = '0%';
    const sender = new solanaWeb3.PublicKey(walletPubkey);
    let done = 0;
    const sigs = [];

    for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        setStatus(pfxId + '-status', 'Batch ' + (b + 1) + ' of ' + batches.length + ' — approve in Phantom…', '');
        try {
            const { blockhash } = await getLatestBlockhash();
            const tx = new solanaWeb3.Transaction({ recentBlockhash: blockhash, feePayer: sender });
            await makeTxFn(tx, batch, sender);
            tx.add(solanaWeb3.SystemProgram.transfer({ fromPubkey: sender, toPubkey: TREASURY, lamports: FEE_LAM }));

            const { signature: sig } = await walletProvider.signAndSendTransaction(tx);
            sigs.push(sig);
            done += batch.length;
            document.getElementById(pfxId + '-progress-fill').style.width =
                Math.round(done / totalCount * 100) + '%';

            const link = '<a href="https://solscan.io/tx/' + sig + '" target="_blank" style="color:#C8E030">Solscan ↗</a>';
            setStatus(pfxId + '-status',
                'Batch ' + (b+1) + '/' + batches.length + ' submitted — ' + done + '/' + totalCount + ' wallets · ' + link, 'ok');

            try {
                await confirmTx(sig);
            } catch (ce) {
                if ((ce.message || '').includes('failed on-chain')) {
                    setStatus(pfxId + '-status', 'Batch ' + (b+1) + ' failed on-chain. ' + link, 'err');
                    return false;
                }
            }
        } catch (e) {
            setStatus(pfxId + '-status', 'Batch ' + (b + 1) + ' failed: ' + (e.message || e), 'err');
            return false;
        }
    }

    const txLinks = sigs.map((s, i) =>
        '<a href="https://solscan.io/tx/' + s + '" target="_blank" style="color:#C8E030">Tx ' + (i + 1) + ' ↗</a>'
    ).join(' &nbsp;');
    setStatus(pfxId + '-status', '✓ Done! ' + totalCount + ' wallets · ' + txLinks, 'ok');
    return true;
}

// ── Instruction builders ──────────────────────────────────────────────────────

function makeCreateAtaIdempotentIx(payer, ata, owner, mint, tokenProgramId) {
    return new solanaWeb3.TransactionInstruction({
        programId: ASSOC_TOK_ID,
        keys: [
            { pubkey: payer,          isSigner: true,  isWritable: true  },
            { pubkey: ata,            isSigner: false, isWritable: true  },
            { pubkey: owner,          isSigner: false, isWritable: false },
            { pubkey: mint,           isSigner: false, isWritable: false },
            { pubkey: SYS_PROG_ID,    isSigner: false, isWritable: false },
            { pubkey: tokenProgramId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([1]), // CreateIdempotent
    });
}

function makeSplTransferCheckedIx(sourceAta, destAta, owner, mint, amount, decimals, tokenProgramId) {
    const data = new Uint8Array(10);
    data[0] = 12; // TransferChecked — correct for Token 2022, includes mint + decimals
    data.set(u64LE(amount), 1);
    data[9] = decimals;
    return new solanaWeb3.TransactionInstruction({
        programId: tokenProgramId,
        keys: [
            { pubkey: sourceAta, isSigner: false, isWritable: true  },
            { pubkey: mint,      isSigner: false, isWritable: false },
            { pubkey: destAta,   isSigner: false, isWritable: true  },
            { pubkey: owner,     isSigner: true,  isWritable: false },
        ],
        data,
    });
}

// ── SOLANA tab ────────────────────────────────────────────────────────────────

function setSolMode(mode) {
    solMode = mode;
    ['even', 'custom'].forEach(m =>
        document.getElementById('sol-mode-' + m).classList.toggle('active', m === mode));
    document.getElementById('sol-amount-label').textContent =
        mode === 'even' ? 'Total SOL:' : 'Amount per wallet:';
}

function setStokMode(mode) {
    stokMode = mode;
    ['even', 'custom'].forEach(m =>
        document.getElementById('stok-mode-' + m).classList.toggle('active', m === mode));
    document.getElementById('stok-amount-label').textContent =
        mode === 'even' ? 'Total tokens:' : 'Amount per wallet:';
}

function parseAddresses() {
    return document.getElementById('sol-addresses').value
        .split('\n').map(l => l.trim()).filter(Boolean)
        .filter(l => { try { new solanaWeb3.PublicKey(l); return true; } catch { return false; } });
}

function previewSolana() {
    const addrs   = parseAddresses();
    const inputSol = parseFloat(document.getElementById('sol-amount').value);
    if (!addrs.length)              { alert('No valid wallet addresses found.'); return; }
    if (!inputSol || inputSol <= 0) { alert('Enter a valid SOL amount.'); return; }

    let perLam, totalSol;
    if (solMode === 'even') {
        const totalLam = Math.floor(inputSol * 1e9);
        perLam   = Math.floor(totalLam / addrs.length);
        totalSol = inputSol;
    } else {
        perLam   = Math.floor(inputSol * 1e9);
        totalSol = inputSol * addrs.length;
    }
    solDistPlan = addrs.map(owner => ({ owner, lamports: perLam }));

    const txs = Math.ceil(addrs.length / SOL_BATCH);
    const fee = ((FEE_LAM * txs) / 1e9).toFixed(4);

    document.getElementById('sol-prev-count').textContent  = addrs.length.toLocaleString();
    document.getElementById('sol-prev-per').textContent    = (perLam / 1e9).toFixed(6) + ' SOL each';
    document.getElementById('sol-prev-total').textContent  = totalSol.toFixed(6) + ' SOL';
    document.getElementById('sol-prev-txs').textContent    = txs;
    document.getElementById('sol-prev-fee').textContent    = fee + ' SOL';
    document.getElementById('sol-prev-warning').textContent = txs > 1
        ? '⚠ You will need to approve ' + txs + ' Phantom transactions back to back.' : '';
    document.getElementById('sol-preview-box').classList.add('visible');
    document.getElementById('sol-send-btn').disabled = !walletPubkey;
}

async function sendSolana() {
    if (!walletPubkey || !solDistPlan.length) return;
    const btn = document.getElementById('sol-send-btn');
    btn.disabled = true;
    const batches = [];
    for (let i = 0; i < solDistPlan.length; i += SOL_BATCH) batches.push(solDistPlan.slice(i, i + SOL_BATCH));
    await sendBatches(batches, async (tx, batch, sender) => {
        for (const e of batch) {
            tx.add(solanaWeb3.SystemProgram.transfer({
                fromPubkey: sender,
                toPubkey:   new solanaWeb3.PublicKey(e.owner),
                lamports:   e.lamports,
            }));
        }
    }, solDistPlan.length, 'sol');
    btn.disabled = false;
}

// ── COMMUNITY > SOL ───────────────────────────────────────────────────────────

const MODE_DESC_SOL = {
    even:         'Every qualifying wallet receives the same amount. <b>Total SOL ÷ number of wallets.</b>',
    proportional: 'Each wallet receives SOL weighted by their token holdings. <b>Wallet receives = (wallet holdings ÷ total qualifying holdings) × total SOL.</b> Bigger holders get more.',
    custom:       'You set a fixed SOL amount per wallet. <b>Total sent = SOL per wallet × number of wallets.</b>',
};

function setCsolMode(mode) {
    csolMode = mode;
    ['even', 'proportional', 'custom'].forEach(m =>
        document.getElementById('csol-mode-' + m).classList.toggle('active', m === mode));
    document.getElementById('csol-amount-label').textContent =
        mode === 'custom' ? 'SOL per wallet:' : 'Total SOL:';
    document.getElementById('csol-mode-desc').innerHTML = MODE_DESC_SOL[mode];
}

async function fetchHoldersCsol() {
    const mint = document.getElementById('csol-mint').value.trim();
    if (!mint) { alert('Enter a token mint address.'); return; }
    const decimals = parseInt(document.getElementById('csol-decimals').value) || 6;
    const minRaw   = document.getElementById('csol-min').value.replace(/,/g, '');
    const maxRaw   = document.getElementById('csol-max').value.replace(/,/g, '');

    document.getElementById('csol-fetch-btn').disabled = true;
    try {
        ({ holders: csolHolders, totalSupply: csolTotalSupply } = await fetchHoldersMint(mint, decimals,
            minRaw ? parseFloat(minRaw) : 0,
            maxRaw ? parseFloat(maxRaw) : null,
            'csol-status'));
        document.getElementById('csol-count').textContent = csolHolders.length.toLocaleString();
        document.getElementById('csol-badge').style.display = 'inline-block';
        renderHoldersTable('csol', csolHolders, csolTotalSupply);
        setStatus('csol-status', csolHolders.length.toLocaleString() + ' holders loaded.', 'ok');
    } catch (e) {
        setStatus('csol-status', 'Fetch failed: ' + (e.message || e), 'err');
    }
    document.getElementById('csol-fetch-btn').disabled = false;
}

function previewCsol() {
    if (!csolHolders.length) { alert('Fetch holders first.'); return; }
    const inputSol = parseFloat(document.getElementById('csol-amount').value);
    if (!inputSol || inputSol <= 0) { alert('Enter a valid SOL amount.'); return; }

    const excludeSet = getExcludeSet('csol');
    const filtered = csolHolders.filter(h => h.owner !== walletPubkey && !excludeSet.has(h.owner));
    if (!filtered.length) { alert('No eligible recipients after applying exclusions.'); return; }
    const n = filtered.length;
    let perLabel, totalLabel;

    if (csolMode === 'even') {
        const totalLam = Math.floor(inputSol * 1e9);
        const per      = Math.floor(totalLam / n);
        csolDistPlan   = filtered.map(h => ({ owner: h.owner, lamports: per }));
        perLabel   = (per / 1e9).toFixed(6) + ' SOL each';
        totalLabel = inputSol + ' SOL';
    } else if (csolMode === 'proportional') {
        const totalLam = Math.floor(inputSol * 1e9);
        const supply   = filtered.reduce((s, h) => s + h.amount, 0);
        csolDistPlan   = filtered.map(h => ({ owner: h.owner, lamports: Math.floor(totalLam * (h.amount / supply)) }));
        const minS = Math.min(...csolDistPlan.map(d => d.lamports)) / 1e9;
        const maxS = Math.max(...csolDistPlan.map(d => d.lamports)) / 1e9;
        perLabel   = minS.toFixed(6) + ' – ' + maxS.toFixed(6) + ' SOL';
        totalLabel = inputSol + ' SOL';
    } else { // custom — inputSol is per wallet
        const perLam = Math.floor(inputSol * 1e9);
        csolDistPlan = filtered.map(h => ({ owner: h.owner, lamports: perLam }));
        perLabel   = inputSol + ' SOL each';
        totalLabel = ((perLam / 1e9) * n).toFixed(4) + ' SOL total';
    }

    const txs = Math.ceil(n / SOL_BATCH);
    const fee = ((FEE_LAM * txs) / 1e9).toFixed(4);

    document.getElementById('csol-prev-count').textContent  = n.toLocaleString();
    document.getElementById('csol-prev-per').textContent    = perLabel;
    document.getElementById('csol-prev-total').textContent  = totalLabel;
    document.getElementById('csol-prev-txs').textContent    = txs;
    document.getElementById('csol-prev-fee').textContent    = fee + ' SOL';
    document.getElementById('csol-prev-warning').textContent = txs > 1
        ? '⚠ You will need to approve ' + txs + ' Phantom transactions.' : '';
    document.getElementById('csol-preview-box').classList.add('visible');
    document.getElementById('csol-send-btn').disabled = !walletPubkey;
}

async function sendCsol() {
    if (!walletPubkey || !csolDistPlan.length) return;
    const btn     = document.getElementById('csol-send-btn');
    btn.disabled  = true;
    const batches = [];
    for (let i = 0; i < csolDistPlan.length; i += SOL_BATCH) batches.push(csolDistPlan.slice(i, i + SOL_BATCH));

    await sendBatches(batches, async (tx, batch, sender) => {
        for (const e of batch) {
            tx.add(solanaWeb3.SystemProgram.transfer({
                fromPubkey: sender,
                toPubkey:   new solanaWeb3.PublicKey(e.owner),
                lamports:   e.lamports,
            }));
        }
    }, csolDistPlan.length, 'csol');
    btn.disabled = false;
}

// ── COMMUNITY > TOKENS ────────────────────────────────────────────────────────

const MODE_DESC_TOK = {
    even:         'Every qualifying wallet receives the same amount of tokens. <b>Total tokens ÷ number of wallets.</b>',
    proportional: 'Each wallet receives tokens weighted by their holdings. <b>Wallet receives = (wallet holdings ÷ total qualifying holdings) × total tokens.</b> Bigger holders get more.',
    custom:       'You set a fixed token amount per wallet. <b>Total sent = tokens per wallet × number of wallets.</b>',
};

function setCtokMode(mode) {
    ctokMode = mode;
    ['even', 'proportional', 'custom'].forEach(m =>
        document.getElementById('ctok-mode-' + m).classList.toggle('active', m === mode));
    document.getElementById('ctok-amount-label').textContent =
        mode === 'custom' ? 'Tokens per wallet:' : 'Total tokens:';
    document.getElementById('ctok-mode-desc').innerHTML = MODE_DESC_TOK[mode];
}

async function loadTokenDropdown(ctx) {
    setStatus(ctx + '-status', 'Loading your tokens…', '');
    senderTokens = [];
    try {
        const [r1, r2] = await Promise.all([
            rpcCall('getTokenAccountsByOwner', [walletPubkey, { programId: TOKEN_PROG_ID.toString() }, { encoding: 'jsonParsed' }]),
            rpcCall('getTokenAccountsByOwner', [walletPubkey, { programId: TOKEN_2022_ID.toString() }, { encoding: 'jsonParsed' }]),
        ]);
        for (const item of [...(r1?.value ?? []), ...(r2?.value ?? [])]) {
            const info = item.account.data.parsed.info;
            if (parseInt(info.tokenAmount.amount) === 0) continue;
            senderTokens.push({
                mint:      info.mint,
                ata:       item.pubkey,
                amount:    parseInt(info.tokenAmount.amount),
                decimals:  info.tokenAmount.decimals,
                programId: item.account.owner,
            });
        }
        for (const selectId of ['ctok-token-select', 'stok-token-select']) {
            const select = document.getElementById(selectId);
            if (!select) continue;
            select.innerHTML = '';
            if (!senderTokens.length) {
                select.innerHTML = '<option value="">— No tokens with balance found —</option>';
            } else {
                for (const t of senderTokens) {
                    const bal = (t.amount / Math.pow(10, t.decimals)).toLocaleString();
                    const opt = document.createElement('option');
                    opt.value       = t.mint;
                    opt.textContent = t.mint.slice(0, 6) + '…' + t.mint.slice(-6) + '  (' + bal + ')';
                    select.appendChild(opt);
                }
            }
        }
        if (!senderTokens.length) {
            setStatus(ctx + '-status', 'No token accounts with balance found.', 'err');
            return;
        }
        setStatus(ctx + '-status', senderTokens.length + ' token(s) loaded. Select one above.', 'ok');
    } catch (e) {
        setStatus(ctx + '-status', 'Failed to load tokens: ' + (e.message || e), 'err');
    }
}

async function fetchHoldersCtok() {
    const mint = document.getElementById('ctok-mint').value.trim();
    if (!mint) { alert('Enter a holder mint address.'); return; }
    const decimals = parseInt(document.getElementById('ctok-decimals').value) || 6;
    const minRaw   = document.getElementById('ctok-min').value.replace(/,/g, '');
    const maxRaw   = document.getElementById('ctok-max').value.replace(/,/g, '');

    document.getElementById('ctok-fetch-btn').disabled = true;
    try {
        ({ holders: ctokHolders, totalSupply: ctokTotalSupply } = await fetchHoldersMint(mint, decimals,
            minRaw ? parseFloat(minRaw) : 0,
            maxRaw ? parseFloat(maxRaw) : null,
            'ctok-status'));
        document.getElementById('ctok-count').textContent = ctokHolders.length.toLocaleString();
        document.getElementById('ctok-badge').style.display = 'inline-block';
        renderHoldersTable('ctok', ctokHolders, ctokTotalSupply);
        setStatus('ctok-status', ctokHolders.length.toLocaleString() + ' holders loaded.', 'ok');
    } catch (e) {
        setStatus('ctok-status', 'Fetch failed: ' + (e.message || e), 'err');
    }
    document.getElementById('ctok-fetch-btn').disabled = false;
}

function setAllTokens() {
    const mintStr   = document.getElementById('ctok-token-select').value;
    if (!mintStr) { alert('Select a token first.'); return; }
    const tokenInfo = senderTokens.find(t => t.mint === mintStr);
    if (!tokenInfo) return;
    const humanAmt  = Math.floor(tokenInfo.amount / Math.pow(10, tokenInfo.decimals));
    document.getElementById('ctok-amount').value = humanAmt.toLocaleString('en-US');
}

function previewCtok() {
    if (!ctokHolders.length)  { alert('Fetch holders first.'); return; }
    if (!walletPubkey)        { alert('Connect your wallet first.'); return; }
    const mintStr   = document.getElementById('ctok-token-select').value;
    if (!mintStr)             { alert('Select a token to send.'); return; }
    const tokenInfo = senderTokens.find(t => t.mint === mintStr);
    if (!tokenInfo)           { alert('Token info not found. Reconnect wallet.'); return; }
    const inputAmt = parseFloat(document.getElementById('ctok-amount').value.replace(/,/g, ''));
    if (!inputAmt || inputAmt <= 0) { alert('Enter a valid token amount.'); return; }

    const pow = Math.pow(10, tokenInfo.decimals);
    const excludeSet = getExcludeSet('ctok');
    const filtered = ctokHolders.filter(h => h.owner !== walletPubkey && !excludeSet.has(h.owner));
    if (!filtered.length) { alert('No eligible recipients after applying exclusions.'); return; }
    const n   = filtered.length;
    let perLabel, totalLabel;

    if (ctokMode === 'even') {
        const totalRaw = Math.floor(inputAmt * pow);
        const perRaw   = Math.floor(totalRaw / n);
        ctokDistPlan   = filtered.map(h => ({ owner: h.owner, amount: perRaw }));
        perLabel   = (perRaw / pow).toLocaleString() + ' each';
        totalLabel = (totalRaw / pow).toLocaleString();
    } else if (ctokMode === 'proportional') {
        const totalRaw = Math.floor(inputAmt * pow);
        const supply   = filtered.reduce((s, h) => s + h.amount, 0);
        ctokDistPlan   = filtered.map(h => ({ owner: h.owner, amount: Math.floor(totalRaw * (h.amount / supply)) }));
        const minA = Math.min(...ctokDistPlan.map(d => d.amount)) / pow;
        const maxA = Math.max(...ctokDistPlan.map(d => d.amount)) / pow;
        perLabel   = minA.toLocaleString() + ' – ' + maxA.toLocaleString();
        totalLabel = inputAmt.toLocaleString();
    } else { // custom — inputAmt is per wallet
        const perRaw = Math.floor(inputAmt * pow);
        ctokDistPlan = filtered.map(h => ({ owner: h.owner, amount: perRaw }));
        perLabel   = inputAmt.toLocaleString() + ' each';
        totalLabel = ((perRaw / pow) * n).toLocaleString() + ' total';
    }

    const txs = Math.ceil(n / TOK_BATCH);
    const fee = ((FEE_LAM * txs) / 1e9).toFixed(4);

    document.getElementById('ctok-prev-count').textContent  = n.toLocaleString();
    document.getElementById('ctok-prev-per').textContent    = perLabel;
    document.getElementById('ctok-prev-total').textContent  = totalLabel;
    document.getElementById('ctok-prev-txs').textContent    = txs;
    document.getElementById('ctok-prev-fee').textContent    = fee + ' SOL';
    document.getElementById('ctok-prev-warning').textContent =
        '⚠ Recipients without a token account will have one created (~0.00204 SOL rent each, charged to you).' +
        (txs > 1 ? ' Approve ' + txs + ' Phantom transactions.' : '');
    document.getElementById('ctok-preview-box').classList.add('visible');
    document.getElementById('ctok-send-btn').disabled = false;
}

async function sendCtok() {
    if (!walletPubkey || !ctokDistPlan.length) return;
    const btn       = document.getElementById('ctok-send-btn');
    btn.disabled    = true;
    const mintStr   = document.getElementById('ctok-token-select').value;
    const tokenInfo = senderTokens.find(t => t.mint === mintStr);
    if (!tokenInfo) {
        setStatus('ctok-status', 'Token info lost. Reconnect wallet.', 'err');
        btn.disabled = false;
        return;
    }
    const mintPk      = new solanaWeb3.PublicKey(mintStr);
    const tokenProgId = new solanaWeb3.PublicKey(tokenInfo.programId);
    const senderAta   = new solanaWeb3.PublicKey(tokenInfo.ata);
    const batches     = [];
    for (let i = 0; i < ctokDistPlan.length; i += TOK_BATCH) batches.push(ctokDistPlan.slice(i, i + TOK_BATCH));

    await sendBatches(batches, async (tx, batch, sender) => {
        // Compute all destination ATAs for this batch
        const destAtas = batch.map(e => getAta(new solanaWeb3.PublicKey(e.owner), mintPk, tokenProgId));

        // Check which ATAs already exist (one RPC call per batch)
        const accountsInfo = await rpcCall('getMultipleAccounts', [
            destAtas.map(a => a.toString()),
            { commitment: 'confirmed', encoding: 'base64' },
        ]);
        const exists = (accountsInfo?.value ?? []).map(v => v !== null);

        for (let j = 0; j < batch.length; j++) {
            const recipientPk = new solanaWeb3.PublicKey(batch[j].owner);
            const destAta     = destAtas[j];
            if (!exists[j]) {
                tx.add(makeCreateAtaIdempotentIx(sender, destAta, recipientPk, mintPk, tokenProgId));
            }
            tx.add(makeSplTransferCheckedIx(senderAta, destAta, sender, mintPk, batch[j].amount, tokenInfo.decimals, tokenProgId));
        }
    }, ctokDistPlan.length, 'ctok');
    btn.disabled = false;
}

// ── SOLANA > TOKENS tab ───────────────────────────────────────────────────────

function setAllStok() {
    const mintStr = document.getElementById('stok-token-select').value;
    if (!mintStr) { alert('Select a token first.'); return; }
    const tokenInfo = senderTokens.find(t => t.mint === mintStr);
    if (!tokenInfo) return;
    const humanAmt = Math.floor(tokenInfo.amount / Math.pow(10, tokenInfo.decimals));
    document.getElementById('stok-amount').value = humanAmt.toLocaleString('en-US');
}

function previewSolTok() {
    if (!walletPubkey) { alert('Connect your wallet first.'); return; }
    const mintStr = document.getElementById('stok-token-select').value;
    if (!mintStr) { alert('Select a token to send.'); return; }
    const tokenInfo = senderTokens.find(t => t.mint === mintStr);
    if (!tokenInfo) { alert('Token info not found. Reconnect wallet.'); return; }
    const addrs = document.getElementById('stok-addresses').value
        .split('\n').map(l => l.trim()).filter(Boolean)
        .filter(l => { try { new solanaWeb3.PublicKey(l); return true; } catch { return false; } });
    if (!addrs.length) { alert('Enter at least one valid wallet address.'); return; }
    const inputAmt = parseFloat(document.getElementById('stok-amount').value.replace(/,/g, ''));
    if (!inputAmt || inputAmt <= 0) { alert('Enter a valid token amount.'); return; }
    const pow = Math.pow(10, tokenInfo.decimals);
    let perRaw, totalAmt;
    if (stokMode === 'even') {
        const totalRaw = Math.floor(inputAmt * pow);
        perRaw   = Math.floor(totalRaw / addrs.length);
        totalAmt = inputAmt;
    } else {
        perRaw   = Math.floor(inputAmt * pow);
        totalAmt = inputAmt * addrs.length;
    }
    stokDistPlan = addrs.map(a => ({ owner: a, amount: perRaw }));
    const txs = Math.ceil(addrs.length / TOK_BATCH);
    const fee = ((FEE_LAM * txs) / 1e9).toFixed(4);
    document.getElementById('stok-prev-count').textContent  = addrs.length.toLocaleString();
    document.getElementById('stok-prev-per').textContent    = (perRaw / pow).toLocaleString() + ' each';
    document.getElementById('stok-prev-total').textContent  = totalAmt.toLocaleString();
    document.getElementById('stok-prev-txs').textContent    = txs;
    document.getElementById('stok-prev-fee').textContent    = fee + ' SOL';
    document.getElementById('stok-prev-warning').textContent =
        '⚠ Recipients without a token account will have one created (~0.00204 SOL rent each, charged to you).' +
        (txs > 1 ? ' Approve ' + txs + ' Phantom transactions.' : '');
    document.getElementById('stok-preview-box').classList.add('visible');
    document.getElementById('stok-send-btn').disabled = false;
}

async function sendSolTok() {
    if (!walletPubkey || !stokDistPlan.length) return;
    const btn    = document.getElementById('stok-send-btn');
    btn.disabled = true;
    const mintStr   = document.getElementById('stok-token-select').value;
    const tokenInfo = senderTokens.find(t => t.mint === mintStr);
    if (!tokenInfo) {
        setStatus('stok-status', 'Token info lost. Reconnect wallet.', 'err');
        btn.disabled = false;
        return;
    }
    const mintPk      = new solanaWeb3.PublicKey(mintStr);
    const tokenProgId = new solanaWeb3.PublicKey(tokenInfo.programId);
    const senderAta   = new solanaWeb3.PublicKey(tokenInfo.ata);
    const batches     = [];
    for (let i = 0; i < stokDistPlan.length; i += TOK_BATCH) batches.push(stokDistPlan.slice(i, i + TOK_BATCH));
    await sendBatches(batches, async (tx, batch, sender) => {
        const destAtas = batch.map(e => getAta(new solanaWeb3.PublicKey(e.owner), mintPk, tokenProgId));
        const accountsInfo = await rpcCall('getMultipleAccounts', [
            destAtas.map(a => a.toString()),
            { commitment: 'confirmed', encoding: 'base64' },
        ]);
        const exists = (accountsInfo?.value ?? []).map(v => v !== null);
        for (let j = 0; j < batch.length; j++) {
            const recipientPk = new solanaWeb3.PublicKey(batch[j].owner);
            const destAta     = destAtas[j];
            if (!exists[j]) {
                tx.add(makeCreateAtaIdempotentIx(sender, destAta, recipientPk, mintPk, tokenProgId));
            }
            tx.add(makeSplTransferCheckedIx(senderAta, destAta, sender, mintPk, batch[j].amount, tokenInfo.decimals, tokenProgId));
        }
    }, stokDistPlan.length, 'stok');
    btn.disabled = false;
}

// ── Holders table ─────────────────────────────────────────────────────────────

function copyAddr(btn, addr) {
    navigator.clipboard.writeText(addr).then(() => {
        btn.textContent = '✓';
        setTimeout(() => { btn.innerHTML = '&#x2398;'; }, 1500);
    });
}

function renderHoldersTable(pfx, holders, totalSupply) {
    const container = document.getElementById(pfx + '-holders-table');
    if (!holders.length) { container.innerHTML = ''; return; }
    let html = '<div class="holders-table-wrap"><table class="holders-table"><thead><tr>'
        + '<th>#</th><th>WALLET</th><th style="text-align:right">BALANCE</th><th style="text-align:right">% SUPPLY</th>'
        + '</tr></thead><tbody>';
    holders.forEach((h, i) => {
        const pct = totalSupply > 0 ? (h.amount / totalSupply * 100).toFixed(4) : '0.0000';
        html += '<tr>'
            + '<td class="td-rank">' + (i + 1) + '</td>'
            + '<td class="td-wallet">'
            + '<a href="https://solscan.io/account/' + h.owner + '" target="_blank" rel="noopener">' + h.owner + '</a>'
            + '<button class="copy-addr-btn" onclick="copyAddr(this,\'' + h.owner + '\')" title="Copy address">&#x2398;</button>'
            + '</td>'
            + '<td class="td-bal">' + h.amount.toLocaleString() + '</td>'
            + '<td class="td-pct">' + pct + '%</td>'
            + '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ── Init defaults ─────────────────────────────────────────────────────────────

document.getElementById('csol-mode-desc').innerHTML = MODE_DESC_SOL['even'];
document.getElementById('ctok-mode-desc').innerHTML = MODE_DESC_TOK['even'];

// ── Comma-formatted inputs ────────────────────────────────────────────────────

document.querySelectorAll('.num-format').forEach(el => {
    el.addEventListener('input', function () {
        const raw = this.value.replace(/[^0-9]/g, '');
        this.value = raw ? parseInt(raw, 10).toLocaleString('en-US') : '';
    });
});
