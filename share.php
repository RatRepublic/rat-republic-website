<?php
$type = $_GET['type'] ?? '';

if ($type === 'stats') {
    $sol      = preg_replace('/[^0-9.]/', '', $_GET['sol']      ?? '0');
    $accounts = preg_replace('/[^0-9]/',  '', $_GET['accounts'] ?? '0');
    $txs      = preg_replace('/[^0-9]/',  '', $_GET['txs']      ?? '0');
    if (!$sol)      $sol      = '0';
    if (!$accounts) $accounts = '0';
    if (!$txs)      $txs      = '0';

    $siteUrl  = 'https://ratrepublic.art';
    $imageUrl = $siteUrl . '/api/share-image.php?type=stats'
              . '&sol='      . urlencode($sol)
              . '&accounts=' . urlencode($accounts)
              . '&txs='      . urlencode($txs);
    $shareUrl = $siteUrl . '/share.php?type=stats'
              . '&sol='      . urlencode($sol)
              . '&accounts=' . urlencode($accounts)
              . '&txs='      . urlencode($txs);
    $title    = 'I claimed ' . $sol . ' SOL total on Rat Republic';
    $desc     = 'Join Rat Republic — reclaim SOL locked as rent on empty token accounts';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Open Graph -->
    <meta property="og:type"         content="website">
    <meta property="og:url"          content="<?= htmlspecialchars($shareUrl) ?>">
    <meta property="og:title"        content="<?= htmlspecialchars($title) ?>">
    <meta property="og:description"  content="<?= htmlspecialchars($desc) ?>">
    <meta property="og:image"        content="<?= htmlspecialchars($imageUrl) ?>">
    <meta property="og:image:width"  content="900">
    <meta property="og:image:height" content="450">

    <!-- Twitter Card -->
    <meta name="twitter:card"        content="summary_large_image">
    <meta name="twitter:site"        content="@rat_republicsol">
    <meta name="twitter:title"       content="<?= htmlspecialchars($title) ?>">
    <meta name="twitter:description" content="<?= htmlspecialchars($desc) ?>">
    <meta name="twitter:image"       content="<?= htmlspecialchars($imageUrl) ?>">

    <title><?= htmlspecialchars($title) ?></title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #1a1f0f;
            color: #fff;
            font-family: monospace, 'Courier New', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 40px 20px;
        }
        .card {
            border: 2px solid #5A7A18;
            border-radius: 12px;
            padding: 32px 40px;
            text-align: center;
            max-width: 480px;
            width: 100%;
        }
        .label   { color: rgba(200,224,48,0.6); font-size: 0.75rem; letter-spacing: 2px; margin-bottom: 10px; }
        .amount  { color: #fff; font-size: 2.4rem; font-weight: 800; margin-bottom: 6px; }
        .details { color: #C8E030; font-size: 0.9rem; margin-bottom: 24px; }
        .btn {
            display: inline-block;
            background: rgba(20,28,12,0.92);
            border: 2px solid #5A7A18;
            color: #C8E030;
            text-decoration: none;
            font-family: monospace;
            font-weight: bold;
            font-size: 0.88rem;
            padding: 10px 28px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .btn:hover { border-color: #C8E030; box-shadow: 0 0 10px rgba(200,224,48,0.3); }
        .site { color: rgba(255,255,255,0.25); font-size: 0.72rem; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="label">LIFETIME SOL RECOVERED</div>
        <div class="amount"><?= htmlspecialchars($sol) ?> SOL</div>
        <div class="details">
            <?= htmlspecialchars($accounts) ?> account<?= $accounts === '1' ? '' : 's' ?> closed
            &nbsp;·&nbsp;
            <?= htmlspecialchars($txs) ?> transaction<?= $txs === '1' ? '' : 's' ?>
        </div>
        <a href="<?= htmlspecialchars($siteUrl) ?>/cleanup.html" class="btn">Claim yours →</a>
    </div>
    <div class="site">ratrepublic.art</div>
</body>
</html>
<?php
    exit;
}

// ── Default: reclaim share ──────────────────────────────────────────────────

$sol      = preg_replace('/[^0-9.]/', '', $_GET['sol']      ?? '0');
$accounts = preg_replace('/[^0-9]/',  '', $_GET['accounts'] ?? '0');

if (!$sol)      $sol      = '0';
if (!$accounts) $accounts = '0';

$siteUrl   = 'https://ratrepublic.art';
$imageUrl  = $siteUrl . '/api/share-image.php?sol=' . urlencode($sol) . '&accounts=' . urlencode($accounts);
$shareUrl  = $siteUrl . '/share.php?sol='           . urlencode($sol) . '&accounts=' . urlencode($accounts);
$title     = 'I just reclaimed ' . $sol . ' SOL on Rat Republic';
$desc      = 'Reclaim SOL locked as rent on empty token accounts — ratrepublic.art';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Open Graph -->
    <meta property="og:type"         content="website">
    <meta property="og:url"          content="<?= htmlspecialchars($shareUrl) ?>">
    <meta property="og:title"        content="<?= htmlspecialchars($title) ?>">
    <meta property="og:description"  content="<?= htmlspecialchars($desc) ?>">
    <meta property="og:image"        content="<?= htmlspecialchars($imageUrl) ?>">
    <meta property="og:image:width"  content="1200">
    <meta property="og:image:height" content="630">

    <!-- Twitter Card -->
    <meta name="twitter:card"        content="summary_large_image">
    <meta name="twitter:site"        content="@rat_republicsol">
    <meta name="twitter:title"       content="<?= htmlspecialchars($title) ?>">
    <meta name="twitter:description" content="<?= htmlspecialchars($desc) ?>">
    <meta name="twitter:image"       content="<?= htmlspecialchars($imageUrl) ?>">

    <title><?= htmlspecialchars($title) ?></title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #1a1f0f;
            color: #fff;
            font-family: monospace, 'Courier New', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 40px 20px;
        }
        .card {
            border: 2px solid #5A7A18;
            border-radius: 12px;
            padding: 32px 40px;
            text-align: center;
            max-width: 480px;
            width: 100%;
        }
        .label    { color: rgba(200,224,48,0.6); font-size: 0.75rem; letter-spacing: 2px; margin-bottom: 10px; }
        .amount   { color: #fff; font-size: 2.4rem; font-weight: 800; margin-bottom: 6px; }
        .accounts { color: #C8E030; font-size: 0.9rem; margin-bottom: 24px; }
        .btn {
            display: inline-block;
            background: rgba(20,28,12,0.92);
            border: 2px solid #5A7A18;
            color: #C8E030;
            text-decoration: none;
            font-family: monospace;
            font-weight: bold;
            font-size: 0.88rem;
            padding: 10px 28px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .btn:hover { border-color: #C8E030; box-shadow: 0 0 10px rgba(200,224,48,0.3); }
        .site { color: rgba(255,255,255,0.25); font-size: 0.72rem; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="label">I JUST RECLAIMED</div>
        <div class="amount"><?= htmlspecialchars($sol) ?> SOL</div>
        <div class="accounts">by closing <?= htmlspecialchars($accounts) ?> account<?= $accounts === '1' ? '' : 's' ?>!</div>
        <a href="<?= htmlspecialchars($siteUrl) ?>/cleanup.html" class="btn">Reclaim yours →</a>
    </div>
    <div class="site">ratrepublic.art</div>
</body>
</html>
