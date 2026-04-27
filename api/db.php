<?php
require_once __DIR__ . '/config.php';

// ── Site + email config ───────────────────────────────────────────────────
// SITE_URL: no trailing slash — used to build the verify link in emails
define('SITE_URL',       'https://ratrepublic.art');
// MAIL_FROM: must be an email address on YOUR domain (set up in hPanel → Email)
define('MAIL_FROM',      'noreply@ratrepublic.art');
define('MAIL_FROM_NAME', 'Rat Republic');
// ─────────────────────────────────────────────────────────────────────────

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    }
    return $pdo;
}

function getBearerToken() {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', trim($auth), $m)) {
        return $m[1];
    }
    return null;
}

function getUserFromToken($db, $token) {
    if (!$token) return null;
    $stmt = $db->prepare(
        'SELECT u.id, u.email, u.username, u.avatar FROM users u
         JOIN user_sessions s ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}
