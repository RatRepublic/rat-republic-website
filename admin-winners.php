<?php
require_once __DIR__ . '/api/config.php';

error_reporting(0);
ini_set('display_errors', 0);

if (($_GET['key'] ?? '') !== ADMIN_KEY) {
    http_response_code(403);
    exit('403 Forbidden');
}

require_once __DIR__ . '/api/db.php';

try {
    $db = getDB();
    $data = [];

    // ── Daily ─────────────────────────────────────────────────────────────────
    $stmt = $db->query(
        'SELECT DATE(rh.claimed_at) AS period_key,
                u.id, u.username, u.email, u.payout_wallet,
                SUM(rh.sol_amount) AS sol_amount,
                SUM(rh.accounts_closed) AS accounts_closed,
                COUNT(rh.id) AS txs
           FROM reclaim_history rh
           JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
           JOIN users u ON u.id = uw.user_id
          WHERE u.verified = 1
          GROUP BY DATE(rh.claimed_at), u.id
          ORDER BY period_key DESC, sol_amount DESC, MIN(rh.claimed_at) ASC'
    );
    $grouped = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $k = $row['period_key'];
        if (!isset($grouped[$k])) $grouped[$k] = ['week_start' => $k, 'week_end' => $k, 'entries' => []];
        $row['rank'] = count($grouped[$k]['entries']) + 1;
        $grouped[$k]['entries'][] = $row;
    }
    $data['daily'] = $grouped;

    // ── Weekly ────────────────────────────────────────────────────────────────
    $stmt = $db->query(
        'SELECT YEARWEEK(rh.claimed_at, 1) AS period_key,
                MIN(DATE_SUB(DATE(rh.claimed_at), INTERVAL WEEKDAY(rh.claimed_at) DAY)) AS week_start,
                MAX(DATE_ADD(DATE_SUB(DATE(rh.claimed_at), INTERVAL WEEKDAY(rh.claimed_at) DAY), INTERVAL 6 DAY)) AS week_end,
                u.id, u.username, u.email, u.payout_wallet,
                SUM(rh.sol_amount) AS sol_amount,
                SUM(rh.accounts_closed) AS accounts_closed,
                COUNT(rh.id) AS txs
           FROM reclaim_history rh
           JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
           JOIN users u ON u.id = uw.user_id
          WHERE u.verified = 1
          GROUP BY YEARWEEK(rh.claimed_at, 1), u.id
          ORDER BY period_key DESC, sol_amount DESC, MIN(rh.claimed_at) ASC'
    );
    $grouped = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $k = $row['week_start'];
        if (!isset($grouped[$k])) $grouped[$k] = ['week_start' => $k, 'week_end' => $row['week_end'], 'entries' => []];
        $row['rank'] = count($grouped[$k]['entries']) + 1;
        $grouped[$k]['entries'][] = $row;
    }
    $data['weekly'] = $grouped;

    // ── Monthly ───────────────────────────────────────────────────────────────
    $stmt = $db->query(
        'SELECT DATE_FORMAT(rh.claimed_at, \'%Y-%m\') AS period_key,
                DATE_FORMAT(MIN(rh.claimed_at), \'%Y-%m-01\') AS week_start,
                LAST_DAY(MIN(rh.claimed_at)) AS week_end,
                u.id, u.username, u.email, u.payout_wallet,
                SUM(rh.sol_amount) AS sol_amount,
                SUM(rh.accounts_closed) AS accounts_closed,
                COUNT(rh.id) AS txs
           FROM reclaim_history rh
           JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
           JOIN users u ON u.id = uw.user_id
          WHERE u.verified = 1
          GROUP BY DATE_FORMAT(rh.claimed_at, \'%Y-%m\'), u.id
          ORDER BY period_key DESC, sol_amount DESC, MIN(rh.claimed_at) ASC'
    );
    $grouped = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $k = $row['period_key'];
        if (!isset($grouped[$k])) $grouped[$k] = ['week_start' => $row['week_start'], 'week_end' => $row['week_end'], 'entries' => []];
        $row['rank'] = count($grouped[$k]['entries']) + 1;
        $grouped[$k]['entries'][] = $row;
    }
    $data['monthly'] = $grouped;

} catch (Exception $e) {
    $data = ['daily' => [], 'weekly' => [], 'monthly' => []];
    $dbError = $e->getMessage();
}

function fmtPeriodLabel($period, $start, $end) {
    $months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    $s = new DateTime($start);
    if ($period === 'daily') {
        return $months[(int)$s->format('n')-1] . ' ' . (int)$s->format('j') . ', ' . $s->format('Y');
    }
    if ($period === 'monthly') {
        return $months[(int)$s->format('n')-1] . ' ' . $s->format('Y');
    }
    $e = new DateTime($end);
    return 'Week of ' . $months[(int)$s->format('n')-1] . ' ' . (int)$s->format('j')
         . ' – ' . $months[(int)$e->format('n')-1] . ' ' . (int)$e->format('j')
         . ', ' . $s->format('Y');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RR Admin — Winners</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #1a1f0f;
            color: #fff;
            font-family: monospace, 'Courier New', sans-serif;
            padding: 40px 24px;
            min-height: 100vh;
        }
        h1 {
            color: #C8E030;
            font-size: 1.5rem;
            letter-spacing: 2px;
            margin-bottom: 6px;
            text-shadow: 0 0 12px rgba(200,224,48,0.4);
        }
        .subtitle {
            color: rgba(255,255,255,0.4);
            font-size: 0.78rem;
            margin-bottom: 28px;
        }

        /* Tabs */
        .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 28px;
        }
        .tab-btn {
            background: rgba(20,28,12,0.9);
            border: 1.5px solid #5A7A18;
            color: rgba(255,255,255,0.45);
            font-family: monospace;
            font-size: 0.8rem;
            padding: 7px 22px;
            border-radius: 8px;
            cursor: pointer;
            letter-spacing: 1px;
            transition: all 0.2s;
        }
        .tab-btn:hover { border-color: #C8E030; color: #C8E030; }
        .tab-btn.active { border-color: #C8E030; color: #C8E030; box-shadow: 0 0 8px rgba(200,224,48,0.2); }

        .tab-panel { display: none; }
        .tab-panel.active { display: block; }

        .period-block { margin-bottom: 36px; }
        .period-label {
            color: #C8E030;
            font-size: 0.85rem;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 1px solid #3a4d12;
        }
        table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        th {
            text-align: left;
            color: rgba(200,224,48,0.6);
            padding: 6px 12px;
            border-bottom: 1px solid #2d3d0f;
            font-weight: normal;
            letter-spacing: 1px;
            font-size: 0.72rem;
            text-transform: uppercase;
        }
        td { padding: 10px 12px; border-bottom: 1px solid #1f2810; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        .rank { color: #C8E030; font-weight: bold; width: 40px; }
        .rank-1 { color: #FFD700; }
        .rank-2 { color: #C0C0C0; }
        .rank-3 { color: #CD7F32; }
        .username { color: #fff; font-weight: bold; }
        .email { color: rgba(255,255,255,0.35); font-size: 0.75rem; }
        .sol { color: #C8E030; }
        .wallet-cell { display: flex; align-items: center; gap: 8px; }
        .wallet-addr { font-size: 0.78rem; color: rgba(255,255,255,0.7); word-break: break-all; }
        .no-wallet { color: #ff6b6b; font-size: 0.78rem; }
        .copy-btn {
            background: rgba(90,122,24,0.3);
            border: 1px solid #5A7A18;
            color: #C8E030;
            font-size: 0.7rem;
            padding: 3px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-family: monospace;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .copy-btn:hover { background: rgba(90,122,24,0.6); }
        .copy-btn.copied { color: #fff; border-color: #7dbc2a; }
        .tag-missing {
            background: rgba(255,107,107,0.12);
            border: 1px solid rgba(255,107,107,0.3);
            color: #ff6b6b;
            font-size: 0.65rem;
            padding: 2px 7px;
            border-radius: 10px;
        }
        .empty { color: rgba(255,255,255,0.4); font-size: 0.85rem; padding: 20px 0; }
        .error { color: #ff6b6b; padding: 20px 0; font-size: 0.85rem; }
    </style>
</head>
<body>
    <h1>RAT REPUBLIC — PAST WINNERS</h1>
    <div class="subtitle">Admin view · payout wallets included · bookmark with your key</div>

    <?php if (isset($dbError)): ?>
        <div class="error">DB error: <?= htmlspecialchars($dbError) ?></div>
    <?php else: ?>

    <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('daily', this)">Daily</button>
        <button class="tab-btn" onclick="switchTab('weekly', this)">Weekly</button>
        <button class="tab-btn" onclick="switchTab('monthly', this)">Monthly</button>
    </div>

    <?php foreach (['daily', 'weekly', 'monthly'] as $p): ?>
    <div class="tab-panel <?= $p === 'daily' ? 'active' : '' ?>" id="panel-<?= $p ?>">
        <?php if (empty($data[$p])): ?>
            <div class="empty">No <?= $p ?> winners archived yet.</div>
        <?php else: ?>
            <?php foreach ($data[$p] as $ws => $group): ?>
            <div class="period-block">
                <div class="period-label"><?= htmlspecialchars(fmtPeriodLabel($p, $group['week_start'], $group['week_end'])) ?></div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Username</th>
                            <th>SOL</th>
                            <th>Accounts</th>
                            <th>Payout Wallet</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($group['entries'] as $e): ?>
                        <tr>
                            <td class="rank rank-<?= $e['rank'] ?>"><?php
                                echo match((int)$e['rank']) { 1 => '🥇', 2 => '🥈', 3 => '🥉', default => '#' . $e['rank'] };
                            ?></td>
                            <td>
                                <div class="username"><?= htmlspecialchars($e['username'] ?: 'Anonymous') ?></div>
                                <div class="email"><?= htmlspecialchars($e['email']) ?></div>
                            </td>
                            <td class="sol"><?= number_format((float)$e['sol_amount'], 4) ?> SOL</td>
                            <td><?= (int)$e['accounts_closed'] ?></td>
                            <td>
                                <?php if (!empty($e['payout_wallet'])): ?>
                                    <div class="wallet-cell">
                                        <span class="wallet-addr"><?= htmlspecialchars($e['payout_wallet']) ?></span>
                                        <button class="copy-btn" onclick="copyWallet(this, '<?= htmlspecialchars($e['payout_wallet']) ?>')">Copy</button>
                                    </div>
                                <?php else: ?>
                                    <span class="no-wallet">⚠ No payout wallet</span>
                                    <span class="tag-missing">needs wallet</span>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    <?php endforeach; ?>

    <?php endif; ?>

    <script>
        function switchTab(period, btn) {
            document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            document.getElementById('panel-' + period).classList.add('active');
            btn.classList.add('active');
        }
        function copyWallet(btn, addr) {
            navigator.clipboard.writeText(addr).then(function() {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(function() { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
            });
        }
    </script>
</body>
</html>
