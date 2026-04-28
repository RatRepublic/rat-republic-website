<?php
ob_start();
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { ob_clean(); exit; }

require_once __DIR__ . '/db.php';

function jsonOut($data) {
    ob_clean();
    echo json_encode($data);
    exit;
}

const TREASURY = 'ratU71Bedbf7196sexgCyBoRxM2Zjb7vBxJ5MJeBYGb';

$treasuryBps    = 200; // 2%
$referrerWallet = null;
$referrerBps    = 0;

try {
    $token = getBearerToken();
    if ($token) {
        $db   = getDB();
        $user = getUserFromToken($db, $token);

        if ($user) {
            // Check if user was referred
            $stmt = $db->prepare(
                'SELECT u2.payout_wallet
                   FROM users u1
                   JOIN users u2 ON u2.id = u1.referred_by
                  WHERE u1.id = ?
                    AND u1.verified = 1
                    AND u2.verified = 1'
            );
            $stmt->execute([$user['id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                // Referred user always gets 10% discount (1.8% total)
                $treasuryBps = 180;
                $referrerBps = 0;

                // If referrer has a payout wallet, split off their 0.5%
                if (!empty($row['payout_wallet'])) {
                    $treasuryBps    = 130;
                    $referrerWallet = $row['payout_wallet'];
                    $referrerBps    = 50;
                }
            }
        }
    }
} catch (Exception $e) {
    $treasuryBps    = 200;
    $referrerWallet = null;
    $referrerBps    = 0;
}

jsonOut([
    'treasury'        => TREASURY,
    'treasury_bps'    => $treasuryBps,
    'referrer_wallet' => $referrerWallet,
    'referrer_bps'    => $referrerBps,
    'total_bps'       => $treasuryBps + $referrerBps,
]);
