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

    $period = in_array($_GET['period'] ?? '', ['daily', 'weekly', 'monthly']) ? $_GET['period'] : 'weekly';

    $whereClause = match($period) {
        'daily'   => "DATE(rh.claimed_at) = DATE(NOW())",
        'monthly' => "YEAR(rh.claimed_at) = YEAR(NOW()) AND MONTH(rh.claimed_at) = MONTH(NOW())",
        default   => "YEARWEEK(rh.claimed_at, 1) = YEARWEEK(NOW(), 1)",
    };

    $stmt = $db->query(
        "SELECT
            u.id,
            u.username,
            u.avatar,
            SUM(rh.sol_amount)      AS sol,
            SUM(rh.accounts_closed) AS accounts,
            COUNT(rh.id)            AS txs
         FROM reclaim_history rh
         JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
         JOIN users u         ON u.id = uw.user_id
         WHERE $whereClause
           AND u.verified = 1
         GROUP BY u.id
         ORDER BY sol DESC, MIN(rh.claimed_at) ASC
         LIMIT 20"
    );
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $siteUrl = defined('SITE_URL') ? rtrim(SITE_URL, '/') : '';
    $clean = [];
    foreach ($rows as $row) {
        $clean[] = [
            'id'        => (int)$row['id'],
            'username'  => $row['username'] ?: 'Anonymous',
            'avatar_url'=> $row['avatar'] ? $siteUrl . '/uploads/avatars/' . $row['avatar'] : null,
            'sol'       => round((float)$row['sol'], 9),
            'accounts'  => (int)$row['accounts'],
            'txs'       => (int)$row['txs'],
        ];
    }

    $now = new DateTime('now', new DateTimeZone('UTC'));

    if ($period === 'daily') {
        $tomorrow = clone $now;
        $tomorrow->modify('+1 day')->setTime(0, 0, 0);
        $resetIn = max(0, $tomorrow->getTimestamp() - $now->getTimestamp());
        $extra = [];
    } elseif ($period === 'monthly') {
        $nextMonth = new DateTime('first day of next month 00:00:00', new DateTimeZone('UTC'));
        $resetIn = max(0, $nextMonth->getTimestamp() - $now->getTimestamp());
        $extra = [];
    } else {
        $dow    = (int)$now->format('N');
        $monday = clone $now;
        $monday->modify('-' . ($dow - 1) . ' days')->setTime(0, 0, 0);
        $sunday = clone $monday;
        $sunday->modify('+6 days')->setTime(23, 59, 59);
        $nextMonday = clone $monday;
        $nextMonday->modify('+7 days');
        $resetIn = max(0, $nextMonday->getTimestamp() - $now->getTimestamp());
        $extra = [
            'week_start' => $monday->format('Y-m-d'),
            'week_end'   => $sunday->format('Y-m-d'),
        ];
    }

    jsonOut(array_merge([
        'period'   => $period,
        'reset_in' => $resetIn,
        'entries'  => $clean,
    ], $extra));

} catch (Exception $e) {
    jsonOut(['error' => $e->getMessage(), 'entries' => [], 'period' => 'weekly', 'reset_in' => 0]);
}
