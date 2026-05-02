<?php
require_once __DIR__ . '/api/config.php';

error_reporting(0);
ini_set('display_errors', 0);

if (($_GET['key'] ?? '') !== ADMIN_KEY) {
    http_response_code(403);
    exit('403 Forbidden');
}

define('HELIUS_URL', 'https://mainnet.helius-rpc.com/?api-key=' . HELIUS_KEY);
$MINT        = $_GET['mint'] ?? 'H529YYypTX6D6WiwcseQayw792tGNFaU6p6mCrJspump';
$DECIMALS    = (int)($_GET['decimals'] ?? 6);
$DIVISOR     = pow(10, $DECIMALS);
$MIN_BALANCE = (int)($_GET['min'] ?? 100000);
$MAX_BALANCE = isset($_GET['max']) && $_GET['max'] !== '' ? (int)$_GET['max'] : PHP_INT_MAX;

function heliusPost(array $body): array {
    $ch = curl_init(HELIUS_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 30,
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    return json_decode($res, true) ?? [];
}

// Fetch all pages
$holders     = [];
$page        = 1;
$totalSupply = 0;

do {
    $res = heliusPost([
        'jsonrpc' => '2.0',
        'id'      => 'holders-' . $page,
        'method'  => 'getTokenAccounts',
        'params'  => ['mint' => $MINT, 'limit' => 1000, 'page' => $page],
    ]);
    $accounts = $res['result']['token_accounts'] ?? [];
    foreach ($accounts as $acct) {
        $raw = (int)($acct['amount'] ?? 0);
        $amt = $raw / $DIVISOR;
        $totalSupply += $amt;
        if ($amt >= $MIN_BALANCE && $amt <= $MAX_BALANCE) {
            $holders[] = ['owner' => $acct['owner'], 'amount' => $amt];
        }
    }
    $page++;
} while (count($accounts) === 1000);

usort($holders, fn($a, $b) => $b['amount'] - $a['amount']);

$fetchedAt  = date('Y-m-d H:i:s') . ' UTC';
$holdersJson = json_encode($holders);
$adminKey    = htmlspecialchars($_GET['key']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RR Admin — Holders</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #1a1f0f; color: #fff; font-family: monospace, 'Courier New', sans-serif; padding: 40px 24px; min-height: 100vh; }
        h1 { color: #C8E030; font-size: 1.5rem; letter-spacing: 2px; margin-bottom: 6px; text-shadow: 0 0 12px rgba(200,224,48,0.4); }
        .subtitle { color: rgba(255,255,255,0.4); font-size: 0.78rem; margin-bottom: 28px; }

        .meta-bar { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px; }
        .meta-box { background: rgba(20,28,12,0.9); border: 1.5px solid #5A7A18; border-radius: 10px; padding: 12px 20px; }
        .meta-label { color: rgba(255,255,255,0.35); font-size: 0.7rem; letter-spacing: 1px; margin-bottom: 4px; }
        .meta-val { color: #C8E030; font-size: 1.05rem; letter-spacing: 1px; }

        .filter-row { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
        .filter-row label { color: rgba(255,255,255,0.45); font-size: 0.78rem; }
        .filter-row input { background: rgba(20,28,12,0.9); border: 1.5px solid #5A7A18; color: #fff; font-family: monospace; font-size: 0.82rem; padding: 7px 12px; border-radius: 8px; outline: none; width: 220px; }
        .filter-row input:focus { border-color: #C8E030; }
        .btn-filter { background: rgba(90,122,24,0.3); border: 1.5px solid #C8E030; color: #C8E030; font-family: monospace; font-size: 0.8rem; padding: 7px 18px; border-radius: 8px; cursor: pointer; letter-spacing: 1px; }
        .btn-filter:hover { background: rgba(90,122,24,0.6); }

        table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        thead th { color: rgba(255,255,255,0.35); font-size: 0.7rem; letter-spacing: 1.5px; text-align: left; padding: 8px 12px; border-bottom: 1px solid #5A7A18; }
        tbody tr { border-bottom: 1px solid rgba(90,122,24,0.2); transition: background 0.15s; }
        tbody tr:hover { background: rgba(90,122,24,0.1); }
        tbody td { padding: 10px 12px; color: rgba(255,255,255,0.8); vertical-align: middle; }
        .rank-cell { color: rgba(255,255,255,0.3); width: 40px; }
        .wallet-cell { font-size: 0.78rem; color: rgba(255,255,255,0.55); }
        .wallet-cell a { color: rgba(255,255,255,0.55); text-decoration: none; }
        .wallet-cell a:hover { color: #C8E030; }
        .amount-cell { color: #C8E030; font-weight: bold; text-align: right; }
        .pct-cell { color: rgba(255,255,255,0.4); text-align: right; font-size: 0.75rem; }
        .bar-cell { width: 120px; }
        .bar-bg { background: rgba(90,122,24,0.2); border-radius: 4px; height: 6px; }
        .bar-fill { background: #C8E030; border-radius: 4px; height: 6px; }
        .empty { color: rgba(255,255,255,0.3); text-align: center; padding: 40px; font-size: 0.85rem; }

        /* Distribute panel */
        .dist-panel {
            margin-top: 48px;
            background: rgba(20,28,12,0.9);
            border: 1.5px solid #5A7A18;
            border-radius: 14px;
            padding: 28px 28px 24px;
        }
        .dist-panel h2 { color: #C8E030; font-size: 1rem; letter-spacing: 2px; margin-bottom: 6px; }
        .dist-panel .dist-sub { color: rgba(255,255,255,0.35); font-size: 0.75rem; margin-bottom: 22px; }
        .dist-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
        .dist-row label { color: rgba(255,255,255,0.45); font-size: 0.78rem; white-space: nowrap; }
        .dist-input {
            background: rgba(10,16,6,0.9);
            border: 1.5px solid #5A7A18;
            color: #fff;
            font-family: monospace;
            font-size: 0.85rem;
            padding: 8px 12px;
            border-radius: 8px;
            outline: none;
            width: 160px;
        }
        .dist-input:focus { border-color: #C8E030; }
        .btn-preview {
            background: rgba(90,122,24,0.2);
            border: 1.5px solid #5A7A18;
            color: rgba(255,255,255,0.6);
            font-family: monospace;
            font-size: 0.8rem;
            padding: 8px 20px;
            border-radius: 8px;
            cursor: pointer;
            letter-spacing: 1px;
        }
        .btn-preview:hover { border-color: #C8E030; color: #C8E030; }
        .dist-preview {
            background: rgba(10,16,6,0.7);
            border: 1px solid rgba(90,122,24,0.4);
            border-radius: 10px;
            padding: 16px 20px;
            margin-bottom: 18px;
            display: none;
        }
        .dist-preview.visible { display: block; }
        .dist-preview-row { display: flex; gap: 32px; flex-wrap: wrap; }
        .dist-stat { }
        .dist-stat-label { color: rgba(255,255,255,0.35); font-size: 0.68rem; letter-spacing: 1px; margin-bottom: 3px; }
        .dist-stat-val { color: #C8E030; font-size: 1rem; }
        .dist-warning { color: #FF8C00; font-size: 0.75rem; margin-top: 10px; }
        .btn-connect {
            background: rgba(90,122,24,0.3);
            border: 1.5px solid #C8E030;
            color: #C8E030;
            font-family: monospace;
            font-size: 0.85rem;
            padding: 10px 24px;
            border-radius: 8px;
            cursor: pointer;
            letter-spacing: 1px;
            margin-right: 10px;
        }
        .btn-connect:hover { background: rgba(90,122,24,0.6); }
        .btn-send {
            background: rgba(200,224,48,0.15);
            border: 1.5px solid #C8E030;
            color: #C8E030;
            font-family: monospace;
            font-size: 0.85rem;
            padding: 10px 28px;
            border-radius: 8px;
            cursor: pointer;
            letter-spacing: 1px;
        }
        .btn-send:disabled { opacity: 0.35; cursor: not-allowed; }
        .btn-send:not(:disabled):hover { background: rgba(200,224,48,0.3); }
        .dist-status { margin-top: 16px; font-size: 0.8rem; color: rgba(255,255,255,0.5); min-height: 20px; }
        .dist-status.ok { color: #C8E030; }
        .dist-status.err { color: #FF8C00; }
        .progress-bar-wrap { margin-top: 12px; background: rgba(90,122,24,0.15); border-radius: 6px; height: 8px; display: none; }
        .progress-bar-fill { background: #C8E030; border-radius: 6px; height: 8px; width: 0%; transition: width 0.3s; }
        .connected-addr { color: rgba(255,255,255,0.4); font-size: 0.75rem; margin-top: 6px; }
        .mode-toggle-btn { background: rgba(20,28,12,0.9); border: 1.5px solid #5A7A18; color: rgba(255,255,255,0.45); font-family: monospace; font-size: 0.78rem; padding: 7px 18px; border-radius: 20px; cursor: pointer; letter-spacing: 1px; transition: all 0.2s; }
        .mode-toggle-btn.active { border-color: #C8E030; color: #C8E030; box-shadow: 0 0 8px rgba(200,224,48,0.2); }
    </style>
</head>
<body>
    <h1>TOKEN HOLDERS</h1>
    <div class="subtitle">Fetched at <?= htmlspecialchars($fetchedAt) ?> &nbsp;·&nbsp; Mint: <?= htmlspecialchars($MINT) ?></div>

    <div class="meta-bar">
        <div class="meta-box">
            <div class="meta-label">QUALIFYING HOLDERS</div>
            <div class="meta-val"><?= number_format(count($holders)) ?></div>
        </div>
        <div class="meta-box">
            <div class="meta-label">MIN BALANCE FILTER</div>
            <div class="meta-val"><?= number_format($MIN_BALANCE) ?></div>
        </div>
        <div class="meta-box">
            <div class="meta-label">TOTAL SUPPLY (CIRCULATING)</div>
            <div class="meta-val"><?= number_format($totalSupply) ?></div>
        </div>
    </div>

    <form class="filter-row" method="get">
        <input type="hidden" name="key" value="<?= $adminKey ?>">
        <label>Mint:</label>
        <input type="text" name="mint" value="<?= htmlspecialchars($MINT) ?>" placeholder="Token mint address">
        <label>Decimals:</label>
        <input type="number" name="decimals" value="<?= $DECIMALS ?>" style="width:70px">
        <label>Min balance:</label>
        <input type="text" id="input-min" class="num-format" style="width:150px" value="<?= number_format($MIN_BALANCE) ?>">
        <input type="hidden" name="min" id="hidden-min">
        <label>Max balance:</label>
        <input type="text" id="input-max" class="num-format" style="width:150px" value="<?= $MAX_BALANCE === PHP_INT_MAX ? '' : number_format($MAX_BALANCE) ?>" placeholder="no limit">
        <input type="hidden" name="max" id="hidden-max">
        <button type="submit" class="btn-filter" id="filter-submit">Refresh</button>
    </form>

    <?php if (empty($holders)): ?>
        <div class="empty">No holders found with balance ≥ <?= number_format($MIN_BALANCE) ?></div>
    <?php else: ?>
    <?php $topAmount = $holders[0]['amount']; ?>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>WALLET</th>
                <th style="text-align:right">BALANCE</th>
                <th style="text-align:right">% SUPPLY</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($holders as $i => $h):
            $pct  = $totalSupply > 0 ? ($h['amount'] / $totalSupply * 100) : 0;
            $barW = $topAmount > 0 ? round($h['amount'] / $topAmount * 100) : 0;
        ?>
            <tr>
                <td class="rank-cell"><?= $i + 1 ?></td>
                <td class="wallet-cell">
                    <a href="https://solscan.io/account/<?= htmlspecialchars($h['owner']) ?>" target="_blank" rel="noopener">
                        <?= htmlspecialchars(substr($h['owner'], 0, 6) . '...' . substr($h['owner'], -6)) ?>
                    </a>
                </td>
                <td class="amount-cell"><?= number_format($h['amount']) ?></td>
                <td class="pct-cell"><?= number_format($pct, 2) ?>%</td>
                <td class="bar-cell">
                    <div class="bar-bg"><div class="bar-fill" style="width:<?= $barW ?>%"></div></div>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>

    <!-- Distribute SOL Panel -->
    <div class="dist-panel">
        <h2>DISTRIBUTE SOL</h2>
        <div class="dist-sub">Split SOL evenly across holders within a token balance range. Requires Phantom.</div>

        <div class="dist-row">
            <label>Min tokens:</label>
            <input type="number" class="dist-input" id="dist-min" placeholder="e.g. 100000" value="<?= $MIN_BALANCE ?>">
            <label>Max tokens:</label>
            <input type="number" class="dist-input" id="dist-max" placeholder="e.g. 1000000 (blank = no max)">
            <label>Total SOL:</label>
            <input type="number" class="dist-input" id="dist-sol" placeholder="e.g. 1" step="0.001" min="0.001">
        </div>
        <div class="dist-row">
            <label>Mode:</label>
            <button class="mode-toggle-btn active" id="mode-even" onclick="setMode('even')">Even Split</button>
            <button class="mode-toggle-btn" id="mode-prop" onclick="setMode('proportional')">Proportional</button>
            <button class="btn-preview" onclick="previewDist()">Preview</button>
        </div>

        <div class="dist-preview" id="dist-preview">
            <div class="dist-preview-row">
                <div class="dist-stat">
                    <div class="dist-stat-label">QUALIFYING WALLETS</div>
                    <div class="dist-stat-val" id="prev-count">—</div>
                </div>
                <div class="dist-stat">
                    <div class="dist-stat-label">SOL PER WALLET</div>
                    <div class="dist-stat-val" id="prev-per">—</div>
                </div>
                <div class="dist-stat">
                    <div class="dist-stat-label">TOTAL SOL</div>
                    <div class="dist-stat-val" id="prev-total">—</div>
                </div>
                <div class="dist-stat">
                    <div class="dist-stat-label">TRANSACTIONS NEEDED</div>
                    <div class="dist-stat-val" id="prev-txs">—</div>
                </div>
            </div>
            <div class="dist-warning" id="prev-warning"></div>
        </div>

        <div>
            <button class="btn-connect" id="btn-connect" onclick="connectWallet()">Connect Phantom</button>
            <button class="btn-send" id="btn-send" disabled onclick="sendDistribution()">Send Distribution</button>
        </div>
        <div class="connected-addr" id="connected-addr"></div>
        <div class="dist-status" id="dist-status"></div>
        <div class="progress-bar-wrap" id="progress-wrap">
            <div class="progress-bar-fill" id="progress-fill"></div>
        </div>
    </div>

    <?php endif; ?>

    <script>
    (function(){if(typeof window.Buffer!=='undefined')return;
    function Buffer(a,e){var r;
        if(a instanceof Uint8Array||Array.isArray(a))r=new Uint8Array(a);
        else if(typeof a==='number')r=new Uint8Array(a);
        else if(typeof a==='string'){
            if(e==='hex'){r=new Uint8Array(a.length/2);for(var i=0;i<r.length;i++)r[i]=parseInt(a.substr(i*2,2),16);}
            else if(e==='base64'){var b=atob(a.replace(/-/g,'+').replace(/_/g,'/'));r=new Uint8Array(b.length);for(var i=0;i<b.length;i++)r[i]=b.charCodeAt(i);}
            else r=new TextEncoder().encode(a);
        }else r=new Uint8Array(0);
        Object.setPrototypeOf(r,Buffer.prototype);return r;
    }
    Buffer.prototype=Object.create(Uint8Array.prototype);Buffer.prototype.constructor=Buffer;
    Buffer.from=function(d,e){return new Buffer(d,e);};
    Buffer.alloc=function(n,f){var b=new Buffer(n);if(f!==undefined)b.fill(f);return b;};
    Buffer.allocUnsafe=Buffer.allocUnsafeSlow=function(n){return new Buffer(n);};
    Buffer.isBuffer=function(o){return o instanceof Buffer||o instanceof Uint8Array;};
    Buffer.concat=function(l,n){if(!n)n=l.reduce(function(s,b){return s+b.length;},0);var r=new Buffer(n),o=0;l.forEach(function(b){r.set(b,o);o+=b.length;});return r;};
    Buffer.byteLength=function(s,e){if(e==='base64')return Math.ceil(s.replace(/=/g,'').length*3/4);return new TextEncoder().encode(s).length;};
    Buffer.isEncoding=function(){return false;};
    var p=Buffer.prototype;
    p.readUInt8=function(o){return this[o];};
    p.readUInt16LE=function(o){return this[o]|(this[o+1]<<8);};
    p.readUInt32LE=function(o){return((this[o])|(this[o+1]<<8)|(this[o+2]<<16))+(this[o+3]*0x1000000);};
    p.readInt8=function(o){var v=this[o];return v>=128?v-256:v;};
    p.readInt16LE=function(o){var v=this.readUInt16LE(o);return v>=32768?v-65536:v;};
    p.readInt32LE=function(o){return(this[o])|(this[o+1]<<8)|(this[o+2]<<16)|(this[o+3]<<24);};
    p.writeUInt8=function(v,o){this[o]=v&255;return o+1;};
    p.writeUInt16LE=function(v,o){this[o]=v&255;this[o+1]=(v>>8)&255;return o+2;};
    p.writeUInt32LE=function(v,o){this[o]=v&255;this[o+1]=(v>>8)&255;this[o+2]=(v>>16)&255;this[o+3]=(v>>>24)&255;return o+4;};
    p.writeInt32LE=p.writeUInt32LE;
    p.readBigUInt64LE=function(o){var lo=((this[o])|(this[o+1]<<8)|(this[o+2]<<16)|(this[o+3]<<24))>>>0,hi=((this[o+4])|(this[o+5]<<8)|(this[o+6]<<16)|(this[o+7]<<24))>>>0;return BigInt(lo)+(BigInt(hi)<<BigInt(32));};
    p.writeBigUInt64LE=function(v,o){var lo=Number(v&BigInt(0xffffffff)),hi=Number(v>>BigInt(32)&BigInt(0xffffffff));this[o]=lo;this[o+1]=lo>>8;this[o+2]=lo>>16;this[o+3]=lo>>24;this[o+4]=hi;this[o+5]=hi>>8;this[o+6]=hi>>16;this[o+7]=hi>>24;return o+8;};
    p.toString=function(e,s,end){var d=(s!==undefined)?this.subarray(s,end):this;if(e==='hex'){var h='';for(var i=0;i<d.length;i++)h+=('0'+d[i].toString(16)).slice(-2);return h;}if(e==='base64'){var b='';for(var i=0;i<d.length;i++)b+=String.fromCharCode(d[i]);return btoa(b);}return new TextDecoder().decode(d);};
    p.write=function(s,o,l){var enc=new TextEncoder().encode(s);var n=Math.min(l||enc.length,enc.length);this.set(enc.subarray(0,n),o||0);return n;};
    p.slice=p.subarray=function(s,e){var r=Uint8Array.prototype.subarray.call(this,s,e);Object.setPrototypeOf(r,Buffer.prototype);return r;};
    p.copy=function(t,ts,ss,se){ts=ts||0;ss=ss||0;se=se||this.length;for(var i=ss;i<se;i++)t[ts++]=this[i];};
    p.equals=function(o){if(this.length!==o.length)return false;for(var i=0;i<this.length;i++)if(this[i]!==o[i])return false;return true;};
    p.fill=function(v,s,e){Uint8Array.prototype.fill.call(this,v,s,e);return this;};
    p.toJSON=function(){return{type:'Buffer',data:Array.from(this)};};
    p.indexOf=function(v,o){return Uint8Array.prototype.indexOf.call(this,v,o);};
    p.includes=function(v){return Uint8Array.prototype.includes.call(this,v);};
    p.compare=function(o){for(var i=0;i<Math.min(this.length,o.length);i++){if(this[i]<o[i])return -1;if(this[i]>o[i])return 1;}return this.length-o.length;};
    window.Buffer=Buffer;
    })();
    </script>
    <script src="https://unpkg.com/@solana/web3.js@1.77.3/lib/index.iife.min.js"></script>
    <script>
        const ALL_HOLDERS = <?= $holdersJson ?>;
        const RPC_URL     = window.location.origin + '/api/rpc.php';
        let walletPubkey  = null;
        let distPlan      = []; // [{ owner, lamports }]
        let distMode      = 'even';

        function setMode(mode) {
            distMode = mode;
            document.getElementById('mode-even').classList.toggle('active', mode === 'even');
            document.getElementById('mode-prop').classList.toggle('active', mode === 'proportional');
        }

        function previewDist() {
            const minTok   = parseFloat(document.getElementById('dist-min').value) || 0;
            const maxTok   = parseFloat(document.getElementById('dist-max').value) || Infinity;
            const totalSol = parseFloat(document.getElementById('dist-sol').value);

            if (!totalSol || totalSol <= 0) { alert('Enter a valid SOL amount.'); return; }

            const filtered = ALL_HOLDERS.filter(h => h.amount >= minTok && h.amount <= maxTok);
            const unique   = [];
            const seen     = new Set();
            for (const h of filtered) {
                if (!seen.has(h.owner)) { seen.add(h.owner); unique.push(h); }
            }

            if (unique.length === 0) {
                document.getElementById('dist-preview').classList.remove('visible');
                alert('No wallets match that range.');
                return;
            }

            const totalLamports = Math.floor(totalSol * 1e9);

            if (distMode === 'even') {
                const perLamports = Math.floor(totalLamports / unique.length);
                distPlan = unique.map(h => ({ owner: h.owner, lamports: perLamports }));
                document.getElementById('prev-per').textContent = (perLamports / 1e9).toFixed(6) + ' SOL (each)';
            } else {
                const filteredSupply = unique.reduce((s, h) => s + h.amount, 0);
                distPlan = unique.map(h => ({
                    owner:    h.owner,
                    lamports: Math.floor(totalLamports * (h.amount / filteredSupply)),
                }));
                const minSOL = Math.min(...distPlan.map(d => d.lamports)) / 1e9;
                const maxSOL = Math.max(...distPlan.map(d => d.lamports)) / 1e9;
                document.getElementById('prev-per').textContent =
                    minSOL.toFixed(6) + ' – ' + maxSOL.toFixed(6) + ' SOL (by holdings)';
            }

            const txsNeeded = Math.ceil(distPlan.length / 20);
            document.getElementById('prev-count').textContent  = distPlan.length.toLocaleString();
            document.getElementById('prev-total').textContent  = totalSol + ' SOL';
            document.getElementById('prev-txs').textContent    = txsNeeded;
            document.getElementById('prev-warning').textContent = txsNeeded > 1
                ? '⚠ You will need to approve ' + txsNeeded + ' Phantom transactions back to back.'
                : '';
            document.getElementById('dist-preview').classList.add('visible');
            document.getElementById('btn-send').disabled = !walletPubkey || distPlan.length === 0;
        }

        async function connectWallet() {
            if (!window.solana) { alert('Phantom not detected. Install Phantom first.'); return; }
            try {
                const resp = await window.solana.connect();
                walletPubkey = resp.publicKey.toString();
                document.getElementById('connected-addr').textContent = 'Connected: ' + walletPubkey;
                document.getElementById('btn-connect').textContent = 'Reconnect';
                document.getElementById('btn-send').disabled = distPlan.length === 0;
                setStatus('Wallet connected.', 'ok');
            } catch (e) {
                setStatus('Connection cancelled.', 'err');
            }
        }

        async function sendDistribution() {
            if (!walletPubkey || distPlan.length === 0) return;

            const btn = document.getElementById('btn-send');
            btn.disabled = true;
            setStatus('Starting distribution…', '');

            const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');
            const sender     = new solanaWeb3.PublicKey(walletPubkey);
            const batches    = [];
            for (let i = 0; i < distPlan.length; i += 20) {
                batches.push(distPlan.slice(i, i + 20));
            }

            document.getElementById('progress-wrap').style.display = 'block';
            let done = 0;

            for (let b = 0; b < batches.length; b++) {
                const batch = batches[b];
                setStatus('Batch ' + (b + 1) + ' of ' + batches.length + ' — approve in Phantom…', '');

                try {
                    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
                    const tx = new solanaWeb3.Transaction({ recentBlockhash: blockhash, feePayer: sender });

                    for (const entry of batch) {
                        tx.add(solanaWeb3.SystemProgram.transfer({
                            fromPubkey: sender,
                            toPubkey:   new solanaWeb3.PublicKey(entry.owner),
                            lamports:   entry.lamports,
                        }));
                    }

                    const { signature: sig } = await window.solana.signAndSendTransaction(tx);
                    done += batch.length;
                    document.getElementById('progress-fill').style.width = Math.round(done / distPlan.length * 100) + '%';
                    setStatus('Batch ' + (b+1) + '/' + batches.length + ' submitted — ' + done + '/' + distPlan.length + ' wallets · <a href="https://solscan.io/tx/' + sig + '" target="_blank" style="color:#C8E030">View on Solscan ↗</a>', 'ok');

                    try {
                        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
                        setStatus('Batch ' + (b+1) + '/' + batches.length + ' confirmed ✓ — ' + done + '/' + distPlan.length + ' wallets · <a href="https://solscan.io/tx/' + sig + '" target="_blank" style="color:#C8E030">View on Solscan ↗</a>', 'ok');
                    } catch (confirmErr) {
                        if (!(confirmErr.message || '').toLowerCase().includes('block height exceeded')) {
                            throw confirmErr;
                        }
                    }

                } catch (e) {
                    setStatus('Batch ' + (b + 1) + ' failed: ' + (e.message || e), 'err');
                    btn.disabled = false;
                    return;
                }
            }

            setStatus('Done! ' + distPlan.length + ' wallets received SOL.', 'ok');
            btn.disabled = false;
        }

        function setStatus(msg, type) {
            const el = document.getElementById('dist-status');
            el.innerHTML = msg;
            el.className = 'dist-status' + (type ? ' ' + type : '');
        }

        // Comma-formatted number inputs
        document.querySelectorAll('.num-format').forEach(function(el) {
            el.addEventListener('input', function() {
                var raw = this.value.replace(/[^0-9]/g, '');
                this.value = raw ? parseInt(raw, 10).toLocaleString('en-US') : '';
            });
        });
        document.getElementById('filter-submit').closest('form').addEventListener('submit', function() {
            var minRaw = document.getElementById('input-min').value.replace(/,/g, '');
            var maxRaw = document.getElementById('input-max').value.replace(/,/g, '');
            document.getElementById('hidden-min').value = minRaw;
            document.getElementById('hidden-max').value = maxRaw;
        });
    </script>
</body>
</html>
