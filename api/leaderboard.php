<?php
ob_start();
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

function jsonOut($data) {
    ob_clean();
    echo json_encode($data);
    exit;
}

try {
    $db = getDB();

    $stmt = $db->query(
        'SELECT
            u.id,
            u.username,
            u.avatar,
            SUM(rh.sol_amount)      AS weekly_sol,
            SUM(rh.accounts_closed) AS weekly_accounts,
            COUNT(rh.id)            AS weekly_txs
         FROM reclaim_history rh
         JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
         JOIN users u         ON u.id = uw.user_id
         WHERE YEARWEEK(rh.claimed_at, 1) = YEARWEEK(NOW(), 1)
           AND u.verified = 1
         GROUP BY u.id
         ORDER BY weekly_sol DESC
         LIMIT 20'
    );
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $siteUrl = defined('SITE_URL') ? rtrim(SITE_URL, '/') : '';
    $clean = [];
    foreach ($rows as $row) {
        $clean[] = [
            'id'              => (int)$row['id'],
            'username'        => $row['username'] ?: 'Anonymous',
            'avatar_url'      => $row['avatar'] ? $siteUrl . '/uploads/avatars/' . $row['avatar'] : null,
            'weekly_sol'      => round((float)$row['weekly_sol'], 9),
            'weekly_accounts' => (int)$row['weekly_accounts'],
            'weekly_txs'      => (int)$row['weekly_txs'],
        ];
    }

    // Monday of current ISO week (safe calculation)
    $now      = new DateTime('now', new DateTimeZone('UTC'));
    $dow      = (int)$now->format('N'); // 1=Mon … 7=Sun
    $monday   = clone $now;
    $monday->modify('-' . ($dow - 1) . ' days');
    $monday->setTime(0, 0, 0);

    $sunday   = clone $monday;
    $sunday->modify('+6 days');
    $sunday->setTime(23, 59, 59);

    $nextMonday = clone $monday;
    $nextMonday->modify('+7 days');
    $resetIn = max(0, $nextMonday->getTimestamp() - $now->getTimestamp());

    // Lazy archive: save last week's top 3 if not already stored
    try {
        $lastMonday = clone $monday;
        $lastMonday->modify('-7 days');
        $lastSunday = clone $lastMonday;
        $lastSunday->modify('+6 days');
        $lastMondayStr = $lastMonday->format('Y-m-d');

        $chk = $db->prepare('SELECT COUNT(*) FROM weekly_winners WHERE week_start = ?');
        $chk->execute([$lastMondayStr]);
        if ((int)$chk->fetchColumn() === 0) {
            $prev = $db->query(
                'SELECT u.id, u.username, u.avatar,
                        SUM(rh.sol_amount)      AS weekly_sol,
                        SUM(rh.accounts_closed) AS weekly_accounts,
                        COUNT(rh.id)            AS weekly_txs
                   FROM reclaim_history rh
                   JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
                   JOIN users u         ON u.id = uw.user_id
                  WHERE YEARWEEK(rh.claimed_at, 1) = YEARWEEK(DATE_SUB(NOW(), INTERVAL 7 DAY), 1)
                    AND u.verified = 1
                  GROUP BY u.id
                  ORDER BY weekly_sol DESC
                  LIMIT 3'
            );
            $prevRows = $prev->fetchAll(PDO::FETCH_ASSOC);
            $ins = $db->prepare(
                'INSERT IGNORE INTO weekly_winners
                 (week_start, week_end, rank, user_id, username, avatar, sol_amount, accounts_closed, tx_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($prevRows as $i => $r) {
                $ins->execute([
                    $lastMondayStr,
                    $lastSunday->format('Y-m-d'),
                    $i + 1,
                    (int)$r['id'],
                    $r['username'] ?: 'Anonymous',
                    $r['avatar'],
                    round((float)$r['weekly_sol'], 9),
                    (int)$r['weekly_accounts'],
                    (int)$r['weekly_txs'],
                ]);
            }
        }
    } catch (Exception $e) {
        // Archive failure must never break the live leaderboard response
    }

    jsonOut([
        'week_start' => $monday->format('Y-m-d'),
        'week_end'   => $sunday->format('Y-m-d'),
        'reset_in'   => $resetIn,
        'entries'    => $clean,
    ]);

} catch (Exception $e) {
    jsonOut(['error' => $e->getMessage(), 'entries' => [], 'week_start' => '', 'week_end' => '', 'reset_in' => 0]);
}
