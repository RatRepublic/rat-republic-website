<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=300'); // cache 5 min

require_once __DIR__ . '/db.php';

try {
    $db = getDB();

    $row = $db->query(
        "SELECT
            COALESCE(SUM(sol_amount), 0)                                                        AS total_sol,
            COALESCE(SUM(CASE WHEN claimed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)  THEN sol_amount END), 0) AS week_sol,
            COALESCE(SUM(CASE WHEN claimed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN sol_amount END), 0) AS month_sol,
            COALESCE(SUM(accounts_closed), 0)                                                   AS total_accounts
         FROM reclaim_history"
    )->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'total_sol'      => round((float)$row['total_sol'],  2),
        'week_sol'       => round((float)$row['week_sol'],   2),
        'month_sol'      => round((float)$row['month_sol'],  2),
        'total_accounts' => (int)$row['total_accounts'],
    ]);
} catch (Exception $e) {
    echo json_encode(['error' => 'unavailable']);
}
