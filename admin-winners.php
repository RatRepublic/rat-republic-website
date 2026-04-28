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

    $stmt = $db->query(
        'SELECT ww.week_start, ww.week_end, ww.rank, ww.username,
                ww.sol_amount, ww.accounts_closed,
                u.payout_wallet, u.email
           FROM weekly_winners ww
           JOIN users u ON u.id = ww.user_id
          ORDER BY ww.week_start DESC, ww.rank ASC'
    );
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by week
    $weeks = [];
    foreach ($rows as $row) {
        $ws = $row['week_start'];
        if (!isset($weeks[$ws])) {
            $weeks[$ws] = ['week_start' => $ws, 'week_end' => $row['week_end'], 'entries' => []];
        }
        $weeks[$ws]['entries'][] = $row;
    }

} catch (Exception $e) {
    $weeks = [];
    $dbError = $e->getMessage();
}

function fmtWeek($start, $end) {
    $months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    $s = new DateTime($start); $e = new DateTime($end);
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
    <title>RR Admin — Past Winners</title>
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
            margin-bottom: 36px;
        }
        .week-block {
            margin-bottom: 36px;
        }
        .week-label {
            color: #C8E030;
            font-size: 0.85rem;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 1px solid #3a4d12;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.82rem;
        }
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
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #1f2810;
            vertical-align: middle;
        }
        tr:last-child td { border-bottom: none; }
        .rank {
            color: #C8E030;
            font-weight: bold;
            width: 40px;
        }
        .rank-1 { color: #FFD700; }
        .rank-2 { color: #C0C0C0; }
        .rank-3 { color: #CD7F32; }
        .username { color: #fff; font-weight: bold; }
        .email { color: rgba(255,255,255,0.35); font-size: 0.75rem; }
        .sol { color: #C8E030; }
        .wallet-cell {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .wallet-addr {
            font-size: 0.78rem;
            color: rgba(255,255,255,0.7);
            font-family: monospace;
            word-break: break-all;
        }
        .no-wallet {
            color: #ff6b6b;
            font-size: 0.78rem;
        }
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
        .empty {
            color: rgba(255,255,255,0.4);
            font-size: 0.85rem;
            padding: 20px 0;
        }
        .error { color: #ff6b6b; padding: 20px 0; font-size: 0.85rem; }
        .tag-missing {
            background: rgba(255,107,107,0.12);
            border: 1px solid rgba(255,107,107,0.3);
            color: #ff6b6b;
            font-size: 0.65rem;
            padding: 2px 7px;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <h1>RAT REPUBLIC — PAST WINNERS</h1>
    <div class="subtitle">Admin view · payout wallet included · bookmark with your key</div>

    <?php if (isset($dbError)): ?>
        <div class="error">DB error: <?= htmlspecialchars($dbError) ?></div>
    <?php elseif (empty($weeks)): ?>
        <div class="empty">No past winners recorded yet.</div>
    <?php else: ?>
        <?php foreach ($weeks as $ws => $week): ?>
            <div class="week-block">
                <div class="week-label"><?= htmlspecialchars(fmtWeek($week['week_start'], $week['week_end'])) ?></div>
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
                        <?php foreach ($week['entries'] as $e): ?>
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
                                        <span class="no-wallet">⚠ No payout wallet set</span>
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

    <script>
        function copyWallet(btn, addr) {
            navigator.clipboard.writeText(addr).then(() => {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
            });
        }
    </script>
</body>
</html>
