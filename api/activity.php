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

$offset    = max(0, (int)($_GET['offset'] ?? 0));
$limit     = 25;
$dateFrom  = trim($_GET['date_from'] ?? '');
$dateTo    = trim($_GET['date_to']   ?? '');

$stmt = $db->prepare('SELECT wallet_address FROM user_wallets WHERE user_id = ?');
$stmt->execute([$user['id']]);
$addresses = $stmt->fetchAll(PDO::FETCH_COLUMN);

if (empty($addresses)) {
    echo json_encode(['rows' => [], 'has_more' => false]);
    exit;
}

$ph     = implode(',', array_fill(0, count($addresses), '?'));
$params = $addresses;
$where  = "wallet_address IN ($ph)";

if ($dateFrom !== '') {
    $where   .= ' AND claimed_at >= ?';
    $params[] = $dateFrom . ' 00:00:00';
}
if ($dateTo !== '') {
    $where   .= ' AND claimed_at <= ?';
    $params[] = $dateTo . ' 23:59:59';
}

// LIMIT/OFFSET inlined as integers — PDO binds them as strings which MySQL rejects
$fetchLimit = $limit + 1;
$stmt = $db->prepare(
    "SELECT wallet_address, sol_amount, accounts_closed, claimed_at, tx_signature
       FROM reclaim_history
      WHERE $where
      ORDER BY claimed_at DESC
      LIMIT $fetchLimit OFFSET $offset"
);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$hasMore = count($rows) > $limit;
if ($hasMore) array_pop($rows);

echo json_encode(['rows' => $rows, 'has_more' => $hasMore]);
