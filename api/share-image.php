<?php
$font       = __DIR__ . '/../fonts/NftOpenseaRegular-jEJvR.ttf';
$fontImpact = __DIR__ . '/../fonts/impact.ttf';
$type = $_GET['type'] ?? '';

// ── Lifetime stats share card ────────────────────────────────────────────────
if ($type === 'stats') {
    $sol      = preg_replace('/[^0-9.]/',    '', $_GET['sol']      ?? '0');
    $accounts = preg_replace('/[^0-9]/',     '', $_GET['accounts'] ?? '0');
    $txs      = preg_replace('/[^0-9]/',     '', $_GET['txs']      ?? '0');
    $username = preg_replace('/[^A-Za-z0-9_\-]/', '', $_GET['username'] ?? '');
    if (!$sol)      $sol      = '0';
    if (!$accounts) $accounts = '0';
    if (!$txs)      $txs      = '0';

    $activeFont = file_exists($fontImpact) ? $fontImpact : $font;

    $templatePath = __DIR__ . '/../images/share-card-template.png';

    if (file_exists($templatePath)) {
        $img = imagecreatefrompng($templatePath);
        imagealphablending($img, true);
        $w = imagesx($img);
        $h = imagesy($img);

        $green = imagecolorallocate($img, 0x58, 0xBF, 0x0D);
        $white = imagecolorallocate($img, 0xFF, 0xFF, 0xFF);

        $right = $w - 22; // right margin

        // SOL amount — right-aligned
        $solText = $sol . ' SOL';
        $bb = imagettfbbox(68, 0, $activeFont, $solText);
        imagettftext($img, 68, 0, $right - ($bb[2] - $bb[0]), 230, $green, $activeFont, $solText);

        // CLAIMED — right-aligned
        $bb = imagettfbbox(42, 0, $activeFont, 'CLAIMED');
        imagettftext($img, 42, 0, $right - ($bb[2] - $bb[0]), 290, $white, $activeFont, 'CLAIMED');

        // @username — right-aligned, extra gap above
        if ($username) {
            $uText = '@' . $username;
            $bb = imagettfbbox(34, 0, $activeFont, $uText);
            imagettftext($img, 34, 0, $right - ($bb[2] - $bb[0]), 360, $white, $activeFont, $uText);
        }
    } else {
        // Generated fallback (900×450) — used until template is designed
        $w = 900; $h = 450;
        $img = imagecreatetruecolor($w, $h);

        $bg       = imagecolorallocate($img, 0x1a, 0x1f, 0x0f);
        $green    = imagecolorallocate($img, 0x5A, 0x7A, 0x18);
        $lime     = imagecolorallocate($img, 0xC8, 0xE0, 0x30);
        $white    = imagecolorallocate($img, 0xFF, 0xFF, 0xFF);

        imagefill($img, 0, 0, $bg);

        $b = 14;
        imagerectangle($img, $b, $b, $w - $b, $h - $b, $green);
        imagerectangle($img, $b + 1, $b + 1, $w - $b - 1, $h - $b - 1, $green);

        // Logo
        $logoPath = __DIR__ . '/../images/favicon.png';
        if (file_exists($logoPath)) {
            $logo = imagecreatefrompng($logoPath);
            if ($logo) {
                $ls  = 64;
                $dst = imagecreatetruecolor($ls, $ls);
                imagealphablending($dst, false);
                imagesavealpha($dst, true);
                imagecopyresampled($dst, $logo, 0, 0, 0, 0, $ls, $ls, imagesx($logo), imagesy($logo));
                imagecopy($img, $dst, 44, 36, 0, 0, $ls, $ls);
                imagedestroy($logo);
                imagedestroy($dst);
            }
        }

        imagettftext($img, 28, 0, 120, 88, $white, $font, 'RAT REPUBLIC');
        imageline($img, $b + 2, 118, $w - $b - 2, 118, $green);

        imagettftext($img, 22, 0, 50, 178, $lime,  $font, 'LIFETIME STATS');
        imagettftext($img, 68, 0, 50, 278, $white, $font, $sol . ' SOL');
        imagettftext($img, 22, 0, 50, 322, $lime,  $font, $accounts . ' accounts closed');
        imagettftext($img, 22, 0, 50, 360, $lime,  $font, $txs . ' transactions');

        imageline($img, $b + 2, $h - 64, $w - $b - 2, $h - 64, $green);
        imageline($img, $b + 2, $h - 63, $w - $b - 2, $h - 63, $green);
        imagettftext($img, 22, 0, 50, $h - 28, $lime, $font, 'ratrepublic.art');
    }

    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=3600');
    imagepng($img, null, 7);
    imagedestroy($img);
    exit;
}

// ── Default: reclaim share image ─────────────────────────────────────────────
$sol      = preg_replace('/[^0-9.]/', '', $_GET['sol']      ?? '0');
$accounts = preg_replace('/[^0-9]/',  '', $_GET['accounts'] ?? '0');
if (!$sol)      $sol      = '0';
if (!$accounts) $accounts = '0';

$w = 1200;
$h = 630;

$img = imagecreatetruecolor($w, $h);

$bg       = imagecolorallocate($img, 0x1a, 0x1f, 0x0f);
$green    = imagecolorallocate($img, 0x5A, 0x7A, 0x18);
$lime     = imagecolorallocate($img, 0xC8, 0xE0, 0x30);
$white    = imagecolorallocate($img, 0xFF, 0xFF, 0xFF);
$dimwhite = imagecolorallocate($img, 0xCC, 0xCC, 0xCC);

imagefill($img, 0, 0, $bg);

$border = 14;
imagerectangle($img, $border, $border, $w - $border, $h - $border, $green);
imagerectangle($img, $border + 1, $border + 1, $w - $border - 1, $h - $border - 1, $green);

$logoPath = __DIR__ . '/../images/favicon.png';
if (file_exists($logoPath)) {
    $logo = imagecreatefrompng($logoPath);
    if ($logo) {
        $logoSize = 80;
        $logoDst  = imagecreatetruecolor($logoSize, $logoSize);
        imagealphablending($logoDst, false);
        imagesavealpha($logoDst, true);
        imagecopyresampled($logoDst, $logo, 0, 0, 0, 0, $logoSize, $logoSize, imagesx($logo), imagesy($logo));
        imagecopy($img, $logoDst, 44, 44, 0, 0, $logoSize, $logoSize);
        imagedestroy($logo);
        imagedestroy($logoDst);
    }
}

imagettftext($img, 36, 0, 144, 100, $white, $font, 'RAT REPUBLIC');
imageline($img, $border + 2, 148, $w - $border - 2, 148, $green);

imagettftext($img, 30, 0, 60, 230, $lime,  $font, 'I just reclaimed');
imagettftext($img, 88, 0, 60, 360, $white, $font, $sol . ' SOL');

$acctLabel = 'by closing ' . $accounts . ' account' . ($accounts === '1' ? '' : 's') . '!';
imagettftext($img, 30, 0, 60, 420, $lime, $font, $acctLabel);

imageline($img, $border + 2, $h - 80, $w - $border - 2, $h - 80, $green);
imageline($img, $border + 2, $h - 79, $w - $border - 2, $h - 79, $green);

imagettftext($img, 28, 0, 60, $h - 36, $lime, $font, 'ratrepublic.art');

header('Content-Type: image/png');
header('Cache-Control: public, max-age=3600');
imagepng($img);
imagedestroy($img);
