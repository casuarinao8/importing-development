<?php
  require_once '../../../../wp-load.php';
  require_once '../civicrm/contact/import/error_reports_table.php';

  importing_error_reports_run_request_cleanup();

  $permission = $_GET['permission'];
  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo 'Contact not logged in';
    exit;
  }

  return current_user_can($permission);
?>