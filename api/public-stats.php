<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=300');

$statsFile = dirname(__DIR__) . '/stats.json';
$cacheTtl  = 300; // 5 minutes

// Serve cache if fresh
if (file_exists($statsFile) && (time() - filemtime($statsFile)) < $cacheTtl) {
    $cached = json_decode(file_get_contents($statsFile), true);
    if (!empty($cached) && ($cached['users_served'] ?? 0) > 0) {
        echo json_encode([
            'users_served'    => (int)$cached['users_served'],
            'accounts_closed' => (int)$cached['accounts_closed'],
            'sol_recovered'   => round((float)$cached['sol_recovered'], 2),
            'top_user_sol'    => isset($cached['top_user_sol']) ? round((float)$cached['top_user_sol'], 4) : null,
        ]);
        exit;
    }
}

// Rebuild from DB
try {
    require_once __DIR__ . '/db.php';
    $db = getDB();

    $row = $db->query(
        'SELECT COUNT(DISTINCT wallet_address) AS users_served,
                COALESCE(SUM(accounts_closed), 0) AS accounts_closed,
                COALESCE(SUM(sol_amount), 0)      AS sol_recovered,
                COALESCE(MAX(sol_amount), 0)      AS top_user_sol
         FROM reclaim_history'
    )->fetch(PDO::FETCH_ASSOC);

    $stats = [
        'users_served'    => (int)$row['users_served'],
        'accounts_closed' => (int)$row['accounts_closed'],
        'sol_recovered'   => round((float)$row['sol_recovered'], 9),
        'top_user_sol'    => round((float)$row['top_user_sol'], 4),
    ];

    // Write cache
    file_put_contents($statsFile, json_encode($stats), LOCK_EX);

    echo json_encode([
        'users_served'    => $stats['users_served'],
        'accounts_closed' => $stats['accounts_closed'],
        'sol_recovered'   => round($stats['sol_recovered'], 2),
        'top_user_sol'    => $stats['top_user_sol'],
    ]);
} catch (Exception $e) {
    // Fall back to whatever is on disk
    $fallback = file_exists($statsFile) ? json_decode(file_get_contents($statsFile), true) : [];
    echo json_encode([
        'users_served'    => (int)($fallback['users_served']    ?? 0),
        'accounts_closed' => (int)($fallback['accounts_closed'] ?? 0),
        'sol_recovered'   => round((float)($fallback['sol_recovered'] ?? 0), 2),
    ]);
}
