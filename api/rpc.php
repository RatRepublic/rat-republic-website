<?php
ob_start();
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = ['https://ratrepublic.art', 'http://localhost', 'http://127.0.0.1'];
$isAllowed = !$origin || in_array(preg_replace('/:\d+$/', '', $origin), $allowedOrigins);

header('Access-Control-Allow-Origin: ' . ($isAllowed ? $origin ?: 'https://ratrepublic.art' : 'https://ratrepublic.art'));
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, solana-client');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { ob_clean(); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_clean();
    http_response_code(405);
    exit('{"error":"Method not allowed"}');
}

// Basic origin check — rejects requests from outside the site
if (!$isAllowed) {
    ob_clean();
    http_response_code(403);
    exit('{"error":"Forbidden"}');
}

require_once __DIR__ . '/config.php';
define('HELIUS_URL', 'https://mainnet.helius-rpc.com/?api-key=' . HELIUS_KEY);

$body = file_get_contents('php://input');
if (!$body) {
    ob_clean();
    http_response_code(400);
    exit('{"error":"Empty request"}');
}

$ch = curl_init(HELIUS_URL);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Origin: https://ratrepublic.art',
        'Referer: https://ratrepublic.art/',
    ],
    CURLOPT_TIMEOUT        => 60,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

ob_clean();
http_response_code($httpCode ?: 502);
echo $response ?: '{"error":"No response from RPC"}';
