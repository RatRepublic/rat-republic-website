<?php
// Called by cron job daily at midnight UTC.
// Archives daily, weekly, and monthly winners into weekly_winners table.

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/db.php';

$db  = getDB();
$now = new DateTime('now', new DateTimeZone('UTC'));

$ins = $db->prepare(
    'INSERT IGNORE INTO weekly_winners
     (week_start, week_end, rank, user_id, username, avatar, sol_amount, accounts_closed, tx_count, period)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

// ── Daily — archive yesterday ─────────────────────────────────────────────
$yesterday = clone $now;
$yesterday->modify('-1 day');
$dayStr = $yesterday->format('Y-m-d');

$chk = $db->prepare('SELECT COUNT(*) FROM weekly_winners WHERE week_start = ? AND period = ?');
$chk->execute([$dayStr, 'daily']);
if ((int)$chk->fetchColumn() === 0) {
    $stmt = $db->prepare(
        "SELECT u.id, u.username, u.avatar,
                SUM(rh.sol_amount) AS sol, SUM(rh.accounts_closed) AS accounts, COUNT(rh.id) AS txs
           FROM reclaim_history rh
           JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
           JOIN users u ON u.id = uw.user_id
          WHERE DATE(rh.claimed_at) = ? AND u.verified = 1
          GROUP BY u.id ORDER BY sol DESC LIMIT 20"
    );
    $stmt->execute([$dayStr]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $i => $r) {
        $ins->execute([$dayStr, $dayStr, $i + 1, (int)$r['id'], $r['username'] ?: 'Anonymous', $r['avatar'], round((float)$r['sol'], 9), (int)$r['accounts'], (int)$r['txs'], 'daily']);
    }
}

// ── Weekly — archive last week (runs every day, INSERT IGNORE prevents dupes) ──
$dow        = (int)$now->format('N');
$monday     = clone $now;
$monday->modify('-' . ($dow - 1) . ' days')->setTime(0, 0, 0);
$lastMonday = clone $monday;
$lastMonday->modify('-7 days');
$lastSunday = clone $lastMonday;
$lastSunday->modify('+6 days');
$lastMondayStr = $lastMonday->format('Y-m-d');

$chk->execute([$lastMondayStr, 'weekly']);
if ((int)$chk->fetchColumn() === 0) {
    $stmt = $db->prepare(
        'SELECT u.id, u.username, u.avatar,
                SUM(rh.sol_amount) AS sol, SUM(rh.accounts_closed) AS accounts, COUNT(rh.id) AS txs
           FROM reclaim_history rh
           JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
           JOIN users u ON u.id = uw.user_id
          WHERE YEARWEEK(rh.claimed_at, 1) = YEARWEEK(?, 1) AND u.verified = 1
          GROUP BY u.id ORDER BY sol DESC LIMIT 20'
    );
    $stmt->execute([$lastMondayStr]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $i => $r) {
        $ins->execute([$lastMondayStr, $lastSunday->format('Y-m-d'), $i + 1, (int)$r['id'], $r['username'] ?: 'Anonymous', $r['avatar'], round((float)$r['sol'], 9), (int)$r['accounts'], (int)$r['txs'], 'weekly']);
    }
}

// ── Monthly — archive last month ──────────────────────────────────────────
$monthStart = new DateTime('first day of last month 00:00:00', new DateTimeZone('UTC'));
$monthEnd   = new DateTime('last day of last month 23:59:59', new DateTimeZone('UTC'));
$monthStr   = $monthStart->format('Y-m-d');

$chk->execute([$monthStr, 'monthly']);
if ((int)$chk->fetchColumn() === 0) {
    $stmt = $db->prepare(
        "SELECT u.id, u.username, u.avatar,
                SUM(rh.sol_amount) AS sol, SUM(rh.accounts_closed) AS accounts, COUNT(rh.id) AS txs
           FROM reclaim_history rh
           JOIN user_wallets uw ON uw.wallet_address = rh.wallet_address
           JOIN users u ON u.id = uw.user_id
          WHERE YEAR(rh.claimed_at) = ? AND MONTH(rh.claimed_at) = ? AND u.verified = 1
          GROUP BY u.id ORDER BY sol DESC LIMIT 20"
    );
    $stmt->execute([$monthStart->format('Y'), $monthStart->format('n')]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $i => $r) {
        $ins->execute([$monthStr, $monthEnd->format('Y-m-d'), $i + 1, (int)$r['id'], $r['username'] ?: 'Anonymous', $r['avatar'], round((float)$r['sol'], 9), (int)$r['accounts'], (int)$r['txs'], 'monthly']);
    }
}
