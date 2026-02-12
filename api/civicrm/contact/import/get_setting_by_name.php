<?php
  require_once '../../../../../wp-load.php';
  require_once '../../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo json_encode(['error' => 'User not logged in']);
    exit;
  }
  $name = $_GET['name'];
 
  $settingByName = Civi\Api4\Setting::get(TRUE)
    ->addSelect($name)
    ->execute();

  echo json_encode($settingByName[0]);
?>