<?php
ob_start();
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$file = __DIR__ . '/stats.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stats = json_decode(file_get_contents($file), true);
    // Live query: highest all-time SOL total by a single wallet
    try {
        require_once __DIR__ . '/api/db.php';
        $db   = getDB();
        $stmt = $db->query(
            'SELECT COALESCE(MAX(t.total),0) AS top FROM (
                SELECT SUM(rh.sol_amount) AS total
                FROM reclaim_history rh
                JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
                JOIN users u ON u.id = uw.user_id
                WHERE u.verified = 1
                GROUP BY u.id
             ) t'
        );
        $stats['top_user_sol'] = round((float)$stmt->fetchColumn(), 4);
    } catch (Exception $e) {
        $stats['top_user_sol'] = 0;
    }
    ob_clean();
    echo json_encode($stats);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) { http_response_code(400); echo '{"error":"bad input"}'; exit; }

    $closed = intval($input['accounts_closed'] ?? 0);
    $sol    = floatval($input['sol_recovered'] ?? 0);

    // Sanity caps to prevent abuse
    if ($closed < 1 || $closed > 2500 || $sol <= 0 || $sol > 5.1) {
        http_response_code(400);
        echo '{"error":"invalid values"}';
        exit;
    }

    $fp = fopen($file, 'c+');
    if (!$fp) { http_response_code(500); echo '{"error":"cannot open file"}'; exit; }

    flock($fp, LOCK_EX);
    $stats = json_decode(stream_get_contents($fp), true);

    $stats['users_served']    += 1;
    $stats['accounts_closed'] += $closed;
    $stats['sol_recovered']    = round($stats['sol_recovered'] + $sol, 9);
    // top_user_sol is calculated live from DB on GET — no update needed here

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($stats, JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
    fclose($fp);

    echo json_encode($stats);
    exit;
}
