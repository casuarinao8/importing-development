<?php
  require_once '../../../../wp-load.php';

  $permission = $_GET['permission'];
  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo 'Contact not logged in';
    exit;
  }

  return current_user_can($permission);
?>