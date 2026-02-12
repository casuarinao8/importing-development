<?php
  require_once '../../../../../wp-load.php';
  require_once '../../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo json_encode(['error' => 'User not logged in']);
    exit;
  }
 
  $contactTypes = Civi\Api4\ContactType::get(false)
    -> addSelect('id', 'name', 'label')
    ->addWhere('parent_id', 'IS NULL')
    -> execute();

  echo json_encode($contactTypes);
?>