<?php
$query = array();
if (strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {
    $query = json_decode(file_get_contents("php://input"), true);
} else {
    $query = $_POST;
}

$key = "N6mPgeHcFfXzvlrVIeSY7Z56f9B4a7NFE32FejfmmKw=";
$data = $query['data'];

$iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
$encrypted = openssl_encrypt($data, 'aes-256-cbc', $key, 0, $iv);
$encoded = base64_encode($iv . '::' . $encrypted);

$urlSafeEncoded = str_replace(['+', '/'], ['-', '_'], $encoded);
echo $urlSafeEncoded;