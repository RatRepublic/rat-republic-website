<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$file = __DIR__ . '/stats.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo file_get_contents($file);
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
    $stats['highest_sol']      = max(floatval($stats['highest_sol']), $sol);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($stats, JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
    fclose($fp);

    echo json_encode($stats);
    exit;
}
