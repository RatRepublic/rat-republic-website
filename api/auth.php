<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$input  = json_decode(file_get_contents('php://input'), true) ?: [];

// ── REGISTER ──────────────────────────────────────────────────────────────
if ($action === 'register') {
    $email    = trim($input['email']    ?? '');
    $password = $input['password']      ?? '';
    $username = trim($input['username'] ?? '');
    $refCode  = trim($input['ref']      ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email address']);
        exit;
    }
    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters']);
        exit;
    }
    if ($username && strlen($username) > 20) {
        http_response_code(400);
        echo json_encode(['error' => 'Username too long (max 20 characters)']);
        exit;
    }

    try {
        $db = getDB();

        // Check if username is already taken
        if ($username) {
            $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
            $stmt->execute([$username]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Username already taken. Please choose another.']);
                exit;
            }
        }

        // Check if email already exists
        $stmt = $db->prepare('SELECT id, verified FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            if ($existing['verified']) {
                http_response_code(409);
                echo json_encode(['error' => 'Email already registered']);
                exit;
            }
            // Unverified account — resend the verification email
            $userId = $existing['id'];
            $db->prepare('DELETE FROM email_verifications WHERE user_id = ?')->execute([$userId]);
        } else {
            // Resolve referrer before insert
            $referrerId = null;
            if ($refCode) {
                $rs = $db->prepare('SELECT id FROM users WHERE referral_code = ? AND verified = 1');
                $rs->execute([$refCode]);
                $referrer = $rs->fetch(PDO::FETCH_ASSOC);
                if ($referrer) $referrerId = $referrer['id'];
            }

            // Generate unique referral code for this new user
            $newRefCode = generateReferralCode($db);

            $stmt = $db->prepare('INSERT INTO users (email, password_hash, username, verified, referral_code, referred_by) VALUES (?, ?, ?, 0, ?, ?)');
            $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $username ?: null, $newRefCode, $referrerId]);
            $userId = $db->lastInsertId();
        }

        // Create verification token (24-hour expiry)
        $vToken  = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+24 hours'));
        $stmt = $db->prepare('INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)');
        $stmt->execute([$userId, $vToken, $expires]);

        sendVerificationEmail($email, $username ?: $email, $vToken);

        echo json_encode(['pending' => true, 'message' => 'Check your email to verify your account.']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Registration failed']);
    }
    exit;
}

// ── VERIFY EMAIL ──────────────────────────────────────────────────────────
if ($action === 'verify') {
    $vToken = trim($input['token'] ?? '');

    if (!$vToken) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing token']);
        exit;
    }

    try {
        $db   = getDB();
        $stmt = $db->prepare(
            'SELECT ev.user_id, ev.expires_at FROM email_verifications ev WHERE ev.token = ?'
        );
        $stmt->execute([$vToken]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or already used verification link.']);
            exit;
        }
        if (strtotime($row['expires_at']) < time()) {
            $db->prepare('DELETE FROM email_verifications WHERE token = ?')->execute([$vToken]);
            http_response_code(400);
            echo json_encode(['error' => 'This link has expired. Please register again to get a new one.', 'expired' => true]);
            exit;
        }

        $userId = $row['user_id'];

        // Activate account
        $db->prepare('UPDATE users SET verified = 1 WHERE id = ?')->execute([$userId]);
        $db->prepare('DELETE FROM email_verifications WHERE user_id = ?')->execute([$userId]);

        // Fetch username for response
        $stmt = $db->prepare('SELECT username, email FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        $token = createSession($db, $userId);
        echo json_encode(['token' => $token, 'username' => $user['username'] ?: $user['email']]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Verification failed']);
    }
    exit;
}

// ── RESEND VERIFICATION ───────────────────────────────────────────────────
if ($action === 'resend-verify') {
    $email = trim($input['email'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email address']);
        exit;
    }

    try {
        $db   = getDB();
        $stmt = $db->prepare('SELECT id, username, verified FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // Always return the same message to avoid email enumeration
        if (!$user || $user['verified']) {
            echo json_encode(['ok' => true]);
            exit;
        }

        // Delete any old token and issue a fresh one
        $db->prepare('DELETE FROM email_verifications WHERE user_id = ?')->execute([$user['id']]);
        $vToken  = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+24 hours'));
        $stmt = $db->prepare('INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)');
        $stmt->execute([$user['id'], $vToken, $expires]);

        sendVerificationEmail($email, $user['username'] ?: $email, $vToken);

        echo json_encode(['ok' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not resend email']);
    }
    exit;
}

// ── LOGIN ─────────────────────────────────────────────────────────────────
if ($action === 'login') {
    $login    = trim($input['email']    ?? '');
    $password = $input['password']      ?? '';

    try {
        $db = getDB();

        // Accept either email or username
        if (filter_var($login, FILTER_VALIDATE_EMAIL)) {
            $stmt = $db->prepare('SELECT id, password_hash, username, verified FROM users WHERE email = ?');
        } else {
            $stmt = $db->prepare('SELECT id, password_hash, username, verified FROM users WHERE username = ?');
        }
        $stmt->execute([$login]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid email or password']);
            exit;
        }

        if (!$user['verified']) {
            http_response_code(403);
            echo json_encode(['error' => 'Please verify your email before logging in.', 'unverified' => true]);
            exit;
        }

        $token = createSession($db, $user['id']);
        echo json_encode(['token' => $token, 'username' => $user['username'] ?: $email]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Login failed']);
    }
    exit;
}

// ── UPDATE PROFILE ────────────────────────────────────────────────────────
if ($action === 'update-profile') {
    $token = getBearerToken();
    $db    = getDB();
    $user  = getUserFromToken($db, $token);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $newUsername = trim($input['username'] ?? '');

    if (!$newUsername) {
        http_response_code(400);
        echo json_encode(['error' => 'Username cannot be empty']);
        exit;
    }
    if (strlen($newUsername) > 20) {
        http_response_code(400);
        echo json_encode(['error' => 'Username too long (max 20 characters)']);
        exit;
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $newUsername)) {
        http_response_code(400);
        echo json_encode(['error' => 'Username can only contain letters, numbers, and underscores']);
        exit;
    }

    try {
        // Check if taken by another user
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ? AND id != ?');
        $stmt->execute([$newUsername, $user['id']]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Username already taken. Please choose another.']);
            exit;
        }

        $db->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$newUsername, $user['id']]);
        echo json_encode(['ok' => true, 'username' => $newUsername]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not update profile']);
    }
    exit;
}

// ── UPDATE PAYOUT WALLET ──────────────────────────────────────────────────
if ($action === 'update-payout-wallet') {
    $token = getBearerToken();
    $db    = getDB();
    $user  = getUserFromToken($db, $token);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $wallet = trim($input['payout_wallet'] ?? '');

    if ($wallet === '') {
        // Allow clearing the wallet
        $db->prepare('UPDATE users SET payout_wallet = NULL WHERE id = ?')->execute([$user['id']]);
        echo json_encode(['ok' => true, 'payout_wallet' => null]);
        exit;
    }

    // Basic Solana address validation: base58 chars, 32–44 chars
    if (!preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $wallet)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid Solana wallet address.']);
        exit;
    }

    try {
        $db->prepare('UPDATE users SET payout_wallet = ? WHERE id = ?')->execute([$wallet, $user['id']]);
        echo json_encode(['ok' => true, 'payout_wallet' => $wallet]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not save wallet address.']);
    }
    exit;
}

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────
if ($action === 'forgot-password') {
    $email = trim($input['email'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email address']);
        exit;
    }

    try {
        $db   = getDB();
        $stmt = $db->prepare('SELECT id, username, verified FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // Always return ok to prevent email enumeration
        if ($user && $user['verified']) {
            $db->prepare('DELETE FROM password_resets WHERE user_id = ?')->execute([$user['id']]);
            $rToken  = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));
            $stmt = $db->prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)');
            $stmt->execute([$user['id'], $rToken, $expires]);
            sendPasswordResetEmail($email, $user['username'] ?: $email, $rToken);
        }

        echo json_encode(['ok' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
    exit;
}

// ── RESET PASSWORD ────────────────────────────────────────────────────────
if ($action === 'reset-password') {
    $rToken   = trim($input['token']    ?? '');
    $password = $input['password']      ?? '';

    if (!$rToken) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing token']);
        exit;
    }
    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters']);
        exit;
    }

    try {
        $db   = getDB();
        $stmt = $db->prepare('SELECT user_id, expires_at FROM password_resets WHERE token = ?');
        $stmt->execute([$rToken]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or already used reset link.']);
            exit;
        }
        if (strtotime($row['expires_at']) < time()) {
            $db->prepare('DELETE FROM password_resets WHERE token = ?')->execute([$rToken]);
            http_response_code(400);
            echo json_encode(['error' => 'This link has expired. Please request a new one.', 'expired' => true]);
            exit;
        }

        $userId = $row['user_id'];

        // Update password and invalidate all existing sessions
        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
           ->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
        $db->prepare('DELETE FROM password_resets WHERE user_id = ?')->execute([$userId]);
        $db->prepare('DELETE FROM user_sessions WHERE user_id = ?')->execute([$userId]);

        echo json_encode(['ok' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
    exit;
}

// ── LOGOUT ────────────────────────────────────────────────────────────────
if ($action === 'logout') {
    $token = getBearerToken();
    if ($token) {
        try {
            $db   = getDB();
            $stmt = $db->prepare('DELETE FROM user_sessions WHERE token = ?');
            $stmt->execute([$token]);
        } catch (PDOException $e) {}
    }
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action']);

// ── Helpers ───────────────────────────────────────────────────────────────
function generateReferralCode($db) {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O,0,I,1 to avoid confusion
    do {
        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $stmt = $db->prepare('SELECT id FROM users WHERE referral_code = ?');
        $stmt->execute([$code]);
    } while ($stmt->fetch());
    return $code;
}

function createSession($db, $userId) {
    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
    $stmt    = $db->prepare('INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $token, $expires]);
    return $token;
}

function sendVerificationEmail($toEmail, $toName, $token) {
    $link    = SITE_URL . '/verify.html?token=' . $token;
    $subject = 'Verify your Rat Republic account';
    $from    = MAIL_FROM_NAME . ' <' . MAIL_FROM . '>';

    $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#1a1f0f;font-family:monospace,Courier New,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1f0f;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:rgba(20,28,12,0.98);border:2px solid #5A7A18;border-radius:14px;padding:36px 32px;max-width:480px;">
<tr><td align="center" style="padding-bottom:8px;">
  <span style="font-size:2rem;letter-spacing:4px;color:#ffffff;font-family:monospace;">RAT REPUBLIC</span>
</td></tr>
<tr><td align="center" style="padding-bottom:28px;">
  <span style="font-size:0.7rem;letter-spacing:3px;color:rgba(255,255,255,0.35);">VERIFY YOUR EMAIL</span>
</td></tr>
<tr><td style="color:rgba(255,255,255,0.7);font-size:0.88rem;line-height:1.7;padding-bottom:28px;">
  Hey ' . htmlspecialchars($toName) . ',<br><br>
  Thanks for joining Rat Republic. Click the button below to verify your email address and activate your account.<br><br>
  This link expires in <strong style="color:#C8E030;">24 hours</strong>.
</td></tr>
<tr><td align="center" style="padding-bottom:28px;">
  <a href="' . $link . '" style="display:inline-block;background:rgba(20,28,12,0.98);border:2px solid #5A7A18;color:#C8E030;text-decoration:none;font-weight:bold;font-family:monospace;font-size:0.95rem;padding:13px 32px;border-radius:10px;letter-spacing:1px;">
    Verify Email →
  </a>
</td></tr>
<tr><td style="color:rgba(255,255,255,0.3);font-size:0.7rem;line-height:1.6;border-top:1px solid #3d5510;padding-top:20px;">
  If you did not create an account, you can safely ignore this email.<br>
  Or copy this link into your browser:<br>
  <span style="color:#C8E030;word-break:break-all;">' . $link . '</span>
</td></tr>
</table>
</td></tr>
</table>
</body></html>';

    $plain = "Hey " . $toName . ",\n\nVerify your Rat Republic account by visiting this link:\n\n" . $link . "\n\nThis link expires in 24 hours.\n\nIf you did not create an account, ignore this email.";

    $boundary = md5(uniqid());
    $headers  = implode("\r\n", [
        'From: ' . $from,
        'Reply-To: ' . MAIL_FROM,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'X-Mailer: PHP/' . PHP_VERSION,
    ]);

    $body = "--{$boundary}\r\n"
          . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
          . $plain . "\r\n"
          . "--{$boundary}\r\n"
          . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
          . $html . "\r\n"
          . "--{$boundary}--";

    mail($toEmail, $subject, $body, $headers);
}

function sendPasswordResetEmail($toEmail, $toName, $token) {
    $link    = SITE_URL . '/reset-password.html?token=' . $token;
    $subject = 'Reset your Rat Republic password';
    $from    = MAIL_FROM_NAME . ' <' . MAIL_FROM . '>';

    $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#1a1f0f;font-family:monospace,Courier New,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1f0f;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:rgba(20,28,12,0.98);border:2px solid #5A7A18;border-radius:14px;padding:36px 32px;max-width:480px;">
<tr><td align="center" style="padding-bottom:8px;">
  <span style="font-size:2rem;letter-spacing:4px;color:#ffffff;font-family:monospace;">RAT REPUBLIC</span>
</td></tr>
<tr><td align="center" style="padding-bottom:28px;">
  <span style="font-size:0.7rem;letter-spacing:3px;color:rgba(255,255,255,0.35);">RESET YOUR PASSWORD</span>
</td></tr>
<tr><td style="color:rgba(255,255,255,0.7);font-size:0.88rem;line-height:1.7;padding-bottom:28px;">
  Hey ' . htmlspecialchars($toName) . ',<br><br>
  We received a request to reset your password. Click the button below to choose a new one.<br><br>
  This link expires in <strong style="color:#C8E030;">1 hour</strong>.
</td></tr>
<tr><td align="center" style="padding-bottom:28px;">
  <a href="' . $link . '" style="display:inline-block;background:rgba(20,28,12,0.98);border:2px solid #5A7A18;color:#C8E030;text-decoration:none;font-weight:bold;font-family:monospace;font-size:0.95rem;padding:13px 32px;border-radius:10px;letter-spacing:1px;">
    Reset Password →
  </a>
</td></tr>
<tr><td style="color:rgba(255,255,255,0.3);font-size:0.7rem;line-height:1.6;border-top:1px solid #3d5510;padding-top:20px;">
  If you did not request a password reset, you can safely ignore this email.<br>
  Or copy this link into your browser:<br>
  <span style="color:#C8E030;word-break:break-all;">' . $link . '</span>
</td></tr>
</table>
</td></tr>
</table>
</body></html>';

    $plain = "Hey " . $toName . ",\n\nReset your Rat Republic password by visiting this link:\n\n" . $link . "\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.";

    $boundary = md5(uniqid());
    $headers  = implode("\r\n", [
        'From: ' . $from,
        'Reply-To: ' . MAIL_FROM,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'X-Mailer: PHP/' . PHP_VERSION,
    ]);

    $body = "--{$boundary}\r\n"
          . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
          . $plain . "\r\n"
          . "--{$boundary}\r\n"
          . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
          . $html . "\r\n"
          . "--{$boundary}--";

    mail($toEmail, $subject, $body, $headers);
}
