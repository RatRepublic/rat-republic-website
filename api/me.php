<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once __DIR__ . '/db.php';

$token = getBearerToken();
$db    = getDB();
$user  = getUserFromToken($db, $token);

if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

try {
    // Wallets linked to this account
    $stmt = $db->prepare('SELECT wallet_address, linked_at FROM user_wallets WHERE user_id = ? ORDER BY linked_at ASC');
    $stmt->execute([$user['id']]);
    $wallets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $addresses = array_column($wallets, 'wallet_address');

    $stats          = ['total_sol' => 0, 'total_accounts' => 0, 'total_reclaims' => 0, 'wallets_used' => count($addresses)];
    $walletBreakdown = [];
    $history         = [];

    if (!empty($addresses)) {
        $ph = implode(',', array_fill(0, count($addresses), '?'));

        // Lifetime totals
        $stmt = $db->prepare("SELECT COALESCE(SUM(sol_amount),0) AS s, COALESCE(SUM(accounts_closed),0) AS a, COUNT(*) AS c FROM reclaim_history WHERE wallet_address IN ($ph)");
        $stmt->execute($addresses);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats = [
            'total_sol'      => round((float)$row['s'], 9),
            'total_accounts' => (int)$row['a'],
            'total_reclaims' => (int)$row['c'],
            'wallets_used'   => count($addresses)
        ];

        // Per-wallet breakdown
        $stmt = $db->prepare("SELECT wallet_address, COALESCE(SUM(sol_amount),0) AS sol, COALESCE(SUM(accounts_closed),0) AS accounts, COUNT(*) AS tx_count FROM reclaim_history WHERE wallet_address IN ($ph) GROUP BY wallet_address ORDER BY sol DESC");
        $stmt->execute($addresses);
        $walletBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Recent activity (last 50 transactions)
        $stmt = $db->prepare("SELECT wallet_address, sol_amount, accounts_closed, claimed_at, tx_signature FROM reclaim_history WHERE wallet_address IN ($ph) ORDER BY claimed_at DESC LIMIT 50");
        $stmt->execute($addresses);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Avatar URL
    $avatar = null;
    if (!empty($user['avatar'])) {
        $avatar = 'uploads/avatars/' . $user['avatar'];
    }

    // Referral info + payout wallet
    $refStmt = $db->prepare('SELECT referral_code, payout_wallet FROM users WHERE id = ?');
    $refStmt->execute([$user['id']]);
    $refRow      = $refStmt->fetch(PDO::FETCH_ASSOC);
    $refCode     = $refRow['referral_code'] ?? null;
    $payoutWallet = $refRow['payout_wallet'] ?? null;

    $refCountStmt = $db->prepare('SELECT COUNT(*) FROM users WHERE referred_by = ? AND verified = 1');
    $refCountStmt->execute([$user['id']]);
    $refCount = (int)$refCountStmt->fetchColumn();

    echo json_encode([
        'id'               => (int)$user['id'],
        'username'         => $user['username'],
        'email'            => $user['email'],
        'avatar'           => $avatar,
        'wallets'          => $wallets,
        'stats'            => $stats,
        'wallet_breakdown' => $walletBreakdown,
        'history'          => $history,
        'referral_code'    => $refCode,
        'referral_link'    => $refCode ? SITE_URL . '/register.html?ref=' . $refCode : null,
        'referral_count'   => $refCount,
        'payout_wallet'    => $payoutWallet,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
