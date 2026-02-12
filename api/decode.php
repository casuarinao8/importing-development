<?php
require_once '../../wp-load.php';

$user = wp_get_current_user();

if (empty($user)) {
  http_response_code(403);
  echo 'Contact not logged in';
  exit;
} else if (!current_user_can('administrator')) {
  http_response_code(401);
  echo 'Wordpress User not administrator';
  exit;
}

$query = array();
if (strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {
  $query = json_decode(file_get_contents("php://input"), true);
} else {
  $query = $_POST;
}

$key = "N6mPgeHcFfXzvlrVIeSY7Z56f9B4a7NFE32FejfmmKw=";
$data = $query['data'];
$data = str_replace(['-', '_'], ['+', '/'], $data);

list($iv, $encrypted) = explode('::', base64_decode($data), 2);

$decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $key, 0, $iv);
echo $decrypted;