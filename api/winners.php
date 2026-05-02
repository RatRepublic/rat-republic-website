<?php
ob_start();
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { ob_clean(); exit; }

require_once __DIR__ . '/db.php';

function jsonOut($data) {
    ob_clean();
    echo json_encode($data);
    exit;
}

try {
    $db      = getDB();
    $siteUrl = defined('SITE_URL') ? rtrim(SITE_URL, '/') : '';

    // Get only the most recent week_start for period=weekly
    $latestStmt = $db->query(
        "SELECT week_start FROM weekly_winners WHERE period = 'weekly' ORDER BY week_start DESC LIMIT 1"
    );
    $latestWeek = $latestStmt->fetchColumn();

    if (!$latestWeek) {
        jsonOut(['weeks' => []]);
    }

    $stmt = $db->prepare(
        'SELECT ww.week_start, ww.week_end, ww.rank, ww.user_id, ww.username,
                COALESCE(u.avatar, ww.avatar) AS avatar,
                ww.sol_amount, ww.accounts_closed, ww.tx_count
           FROM weekly_winners ww
           LEFT JOIN users u ON u.id = ww.user_id
          WHERE ww.week_start = ? AND ww.period = ? AND ww.rank <= 5
          ORDER BY ww.rank ASC'
    );
    $stmt->execute([$latestWeek, 'weekly']);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by week_start
    $grouped = [];
    foreach ($rows as $row) {
        $ws = $row['week_start'];
        if (!isset($grouped[$ws])) {
            $grouped[$ws] = [
                'week_start' => $ws,
                'week_end'   => $row['week_end'],
                'label'      => formatWeekLabel($ws, $row['week_end']),
                'entries'    => [],
            ];
        }
        $grouped[$ws]['entries'][] = [
            'rank'            => (int)$row['rank'],
            'user_id'         => (int)$row['user_id'],
            'username'        => $row['username'],
            'avatar_url'      => $row['avatar'] ? $siteUrl . '/uploads/avatars/' . $row['avatar'] : null,
            'sol_amount'      => round((float)$row['sol_amount'], 9),
            'accounts_closed' => (int)$row['accounts_closed'],
            'tx_count'        => (int)$row['tx_count'],
        ];
    }

    jsonOut(['weeks' => array_values($grouped)]);

} catch (Exception $e) {
    jsonOut(['error' => $e->getMessage(), 'weeks' => []]);
}

function formatWeekLabel($start, $end) {
    $s = new DateTime($start . ' 00:00:00', new DateTimeZone('UTC'));
    $e = new DateTime($end   . ' 00:00:00', new DateTimeZone('UTC'));
    $months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    $sm = $months[(int)$s->format('n') - 1];
    $em = $months[(int)$e->format('n') - 1];
    $sy = $s->format('Y');
    $ey = $e->format('Y');
    $sd = (int)$s->format('j');
    $ed = (int)$e->format('j');
    if ($sy === $ey) {
        return 'Week of ' . $sm . ' ' . $sd . ' – ' . $em . ' ' . $ed . ', ' . $ey;
    }
    return 'Week of ' . $sm . ' ' . $sd . ', ' . $sy . ' – ' . $em . ' ' . $ed . ', ' . $ey;
}
