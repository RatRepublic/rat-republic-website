<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once __DIR__ . '/db.php';

function jsonOut($data) {
    echo json_encode($data);
    exit;
}

function base58_decode(string $input): string {
    $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    $out = array_fill(0, 32, 0);
    for ($i = 0; $i < strlen($input); $i++) {
        $carry = strpos($alphabet, $input[$i]);
        if ($carry === false) return str_repeat("\x00", 32);
        for ($j = 31; $j >= 0; $j--) {
            $carry += 58 * $out[$j];
            $out[$j] = $carry % 256;
            $carry = (int)($carry / 256);
        }
    }
    return implode('', array_map('chr', $out));
}

function lockPeriodPriority(string $period): int {
    return match($period) {
        'STAKING_LOCK_PERIOD_ONE_HUNDRED_EIGHTY_DAYS' => 6,
        'STAKING_LOCK_PERIOD_NINETY_DAYS'             => 5,
        'STAKING_LOCK_PERIOD_SIXTY_DAYS'              => 4,
        'STAKING_LOCK_PERIOD_THIRTY_DAYS'             => 3,
        'STAKING_LOCK_PERIOD_FOURTEEN_DAYS'           => 2,
        'STAKING_LOCK_PERIOD_SEVEN_DAYS'              => 1,
        default                                        => 0,
    };
}

function getStakingMinAmount(string $period): int {
    return match($period) {
        'STAKING_LOCK_PERIOD_SEVEN_DAYS'              => 500000,
        'STAKING_LOCK_PERIOD_SIXTY_DAYS'              => 4000000,
        'STAKING_LOCK_PERIOD_NINETY_DAYS'             => 3000000,
        'STAKING_LOCK_PERIOD_ONE_HUNDRED_EIGHTY_DAYS' => 2000000,
        default                                        => 5000000,
    };
}

function lockPeriodLabel(string $period): string {
    return match($period) {
        'STAKING_LOCK_PERIOD_SEVEN_DAYS'              => '7 days',
        'STAKING_LOCK_PERIOD_FOURTEEN_DAYS'           => '14 days',
        'STAKING_LOCK_PERIOD_THIRTY_DAYS'             => '30 days',
        'STAKING_LOCK_PERIOD_SIXTY_DAYS'              => '60 days',
        'STAKING_LOCK_PERIOD_NINETY_DAYS'             => '90 days',
        'STAKING_LOCK_PERIOD_ONE_HUNDRED_EIGHTY_DAYS' => '180 days',
        default                                        => $period,
    };
}

function findBestPosition(array $positions): ?array {
    $now = date('Y-m-d H:i:s');
    $best = null;
    $bestPriority = -1;

    foreach ($positions as $pos) {
        if (!empty($pos['was_closed'])) continue;
        $unlocks = date('Y-m-d H:i:s', strtotime($pos['unlocks_at'] ?? '1970-01-01'));
        if ($unlocks <= $now) continue;

        $lockPeriod = $pos['lock_period'] ?? '';
        $amount = (int) floatval($pos['staked']['display'] ?? '0');

        if ($amount < getStakingMinAmount($lockPeriod)) continue;

        $priority = lockPeriodPriority($lockPeriod);
        if ($priority > $bestPriority) {
            $bestPriority = $priority;
            $best = [
                'lock_period' => $lockPeriod,
                'amount'      => $amount,
                'unlocks_at'  => $unlocks,
            ];
        }
    }

    return $best;
}

function saveStaking($db, int $userId, ?array $best): void {
    if ($best) {
        $db->prepare(
            'UPDATE users SET staking_lock_period=?, staking_amount=?, staking_unlocks_at=?, staking_checked_at=NOW() WHERE id=?'
        )->execute([$best['lock_period'], $best['amount'], $best['unlocks_at'], $userId]);
    } else {
        $db->prepare(
            'UPDATE users SET staking_lock_period=NULL, staking_amount=NULL, staking_unlocks_at=NULL, staking_checked_at=NOW() WHERE id=?'
        )->execute([$userId]);
    }
}

function buildStatus(?string $lockPeriod, ?string $unlocksAt, ?int $amount): array {
    if (!$lockPeriod || !$unlocksAt) {
        return ['active' => false, 'label' => null, 'unlocks_at' => null, 'amount' => null];
    }
    $expired = $unlocksAt <= date('Y-m-d H:i:s');
    return [
        'active'     => !$expired,
        'label'      => lockPeriodLabel($lockPeriod),
        'unlocks_at' => $unlocksAt,
        'amount'     => $amount,
    ];
}

$token = getBearerToken();
$db    = getDB();
$user  = getUserFromToken($db, $token);

if (!$user) {
    http_response_code(401);
    jsonOut(['error' => 'Unauthorized']);
}

$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

// Verify Phantom signature and save wallet as verified
if ($action === 'link') {
    $wallet    = preg_replace('/[^A-Za-z0-9]/', '', $body['wallet']    ?? '');
    $message   = $body['message']   ?? '';
    $signature = $body['signature'] ?? '';

    if (!$wallet || !$message || !$signature) {
        jsonOut(['error' => 'Missing fields']);
    }
    if (strlen($wallet) < 32 || strlen($wallet) > 44) {
        jsonOut(['error' => 'Invalid wallet address']);
    }
    if (!function_exists('sodium_crypto_sign_verify_detached')) {
        jsonOut(['error' => 'Server missing sodium extension']);
    }

    $sigBytes    = base64_decode($signature);
    $pubkeyBytes = base58_decode($wallet);

    if (strlen($sigBytes) !== 64) {
        jsonOut(['error' => 'Invalid signature format']);
    }

    $valid = @sodium_crypto_sign_verify_detached($sigBytes, $message, $pubkeyBytes);
    if (!$valid) {
        jsonOut(['error' => 'Signature verification failed']);
    }

    $db->prepare('UPDATE users SET staking_wallet=?, staking_wallet_verified=1 WHERE id=?')
       ->execute([$wallet, $user['id']]);

    jsonOut(['ok' => true]);
}

// Accept positions from browser (Printr is called client-side to bypass Cloudflare)
if ($action === 'save-positions') {
    $stmt = $db->prepare('SELECT staking_wallet FROM users WHERE id=? AND staking_wallet_verified=1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || !$row['staking_wallet']) {
        jsonOut(['error' => 'No verified wallet']);
    }

    $positions = $body['positions'] ?? [];
    if (!is_array($positions)) {
        jsonOut(['error' => 'Invalid positions data']);
    }

    $best = findBestPosition($positions);
    saveStaking($db, $user['id'], $best);
    $status = $best
        ? buildStatus($best['lock_period'], $best['unlocks_at'], $best['amount'])
        : buildStatus(null, null, null);

    jsonOut(['ok' => true, 'staking_status' => $status]);
}

jsonOut(['error' => 'Unknown action']);
