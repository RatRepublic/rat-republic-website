<?php
ob_start();
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

function jsonOut($data) { ob_clean(); echo json_encode($data); exit; }

try {
    $db      = getDB();
    $siteUrl = defined('SITE_URL') ? rtrim(SITE_URL, '/') : '';

    $yesterday = (new DateTime('yesterday', new DateTimeZone('UTC')))->format('Y-m-d');

    $stmt = $db->prepare(
        'SELECT u.id, u.username, u.avatar,
                SUM(rh.sol_amount) AS sol_amount,
                SUM(rh.accounts_closed) AS accounts_closed,
                COUNT(rh.id) AS tx_count
           FROM reclaim_history rh
           JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
           JOIN users u ON u.id = uw.user_id
          WHERE DATE(rh.claimed_at) = ? AND u.verified = 1
          GROUP BY u.id
          ORDER BY sol_amount DESC, MIN(rh.claimed_at) ASC
          LIMIT 5'
    );
    $stmt->execute([$yesterday]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $entries = [];
    foreach ($rows as $i => $row) {
        $entries[] = [
            'rank'            => $i + 1,
            'user_id'         => (int)$row['id'],
            'username'        => $row['username'] ?: 'Anonymous',
            'avatar_url'      => $row['avatar'] ? $siteUrl . '/uploads/avatars/' . $row['avatar'] : null,
            'sol_amount'      => round((float)$row['sol_amount'], 9),
            'accounts_closed' => (int)$row['accounts_closed'],
            'tx_count'        => (int)$row['tx_count'],
        ];
    }

    jsonOut(['date' => $yesterday, 'entries' => $entries]);

} catch (Exception $e) {
    jsonOut(['error' => $e->getMessage(), 'date' => '', 'entries' => []]);
}
