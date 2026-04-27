<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once __DIR__ . '/db.php';

define('AVATAR_MAX_BYTES', 500 * 1024); // 500 KB
define('AVATAR_MAX_PX',    500);        // 500 × 500 px

$token = getBearerToken();
$db    = getDB();
$user  = getUserFromToken($db, $token);

if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$file = $_FILES['avatar'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded']);
    exit;
}

// File size check
if ($file['size'] > AVATAR_MAX_BYTES) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large — max 500 KB']);
    exit;
}

// MIME type check (reads actual file bytes, not just extension)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$extMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
if (!isset($extMap[$mime])) {
    http_response_code(400);
    echo json_encode(['error' => 'Only JPG, PNG, GIF, or WEBP allowed']);
    exit;
}

// Pixel dimension check
$imageInfo = @getimagesize($file['tmp_name']);
if (!$imageInfo) {
    http_response_code(400);
    echo json_encode(['error' => 'Could not read image dimensions']);
    exit;
}
if ($imageInfo[0] > AVATAR_MAX_PX || $imageInfo[1] > AVATAR_MAX_PX) {
    http_response_code(400);
    echo json_encode(['error' => 'Image too large — max ' . AVATAR_MAX_PX . '×' . AVATAR_MAX_PX . ' px']);
    exit;
}

$ext       = $extMap[$mime];
$filename  = 'avatar_' . $user['id'] . '.' . $ext;
$uploadDir = dirname(__DIR__) . '/uploads/avatars/';

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Remove old avatar files with other extensions
foreach (array_values($extMap) as $e) {
    $old = $uploadDir . 'avatar_' . $user['id'] . '.' . $e;
    if (file_exists($old) && $e !== $ext) @unlink($old);
}

if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
    http_response_code(500);
    echo json_encode(['error' => 'Upload failed']);
    exit;
}

try {
    $stmt = $db->prepare('UPDATE users SET avatar = ? WHERE id = ?');
    $stmt->execute([$filename, $user['id']]);
    echo json_encode(['url' => 'uploads/avatars/' . $filename . '?t=' . time()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
