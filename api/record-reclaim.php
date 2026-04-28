<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];

$walletAddress  = trim($input['wallet_address'] ?? '');
$closed         = intval($input['accounts_closed'] ?? 0);
$sol            = floatval($input['sol_recovered']  ?? 0);
$token          = $input['token'] ?? null;
$txSig          = trim($input['tx_signature'] ?? '');
$txSig          = (strlen($txSig) >= 44 && strlen($txSig) <= 128) ? $txSig : null;
$referrerWallet = trim($input['referrer_wallet'] ?? '') ?: null;
$referrerSol    = ($input['referrer_sol'] ?? 0) > 0 ? floatval($input['referrer_sol']) : null;

if (!$walletAddress || $closed < 1 || $closed > 2500 || $sol <= 0 || $sol > 5.1) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid values']);
    exit;
}

try {
    $db = getDB();

    // Save to reclaim history
    $stmt = $db->prepare('INSERT INTO reclaim_history (wallet_address, accounts_closed, sol_amount, tx_signature, referrer_wallet, referrer_sol) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$walletAddress, $closed, $sol, $txSig, $referrerWallet, $referrerSol]);

    // If user is logged in, auto-link wallet to their account
    if ($token) {
        $user = getUserFromToken($db, $token);
        if ($user) {
            $stmt = $db->prepare('INSERT IGNORE INTO user_wallets (user_id, wallet_address) VALUES (?, ?)');
            $stmt->execute([$user['id'], $walletAddress]);
        }
    }

    // Update global stats.json
    $statsFile = dirname(__DIR__) . '/stats.json';
    $fp = fopen($statsFile, 'c+');
    if ($fp) {
        flock($fp, LOCK_EX);
        $stats = json_decode(stream_get_contents($fp), true) ?: ['users_served'=>0,'accounts_closed'=>0,'sol_recovered'=>0,'highest_sol'=>0];
        $stats['users_served']    += 1;
        $stats['accounts_closed'] += $closed;
        $stats['sol_recovered']    = round($stats['sol_recovered'] + $sol, 9);
        $stats['highest_sol']      = max((float)$stats['highest_sol'], $sol);
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($stats, JSON_PRETTY_PRINT));
        flock($fp, LOCK_UN);
        fclose($fp);
    }

    echo json_encode(['ok' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
