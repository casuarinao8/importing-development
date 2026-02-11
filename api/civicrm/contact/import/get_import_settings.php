<?php
  require_once '../../../../../wp-load.php';
  require_once '../../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  function get_import_settings() {
    $importSettings = Civi\Api4\Setting::get(false)
      ->addSelect('import_dedupe_rule', 'import_contact_types', 'import_custom_fields')
      ->execute();
    
    // Convert Result object to array
    $settingsArray = [];
    foreach ($importSettings as $setting) {
      $settingsArray[] = $setting;
    }
    
    return $settingsArray;
  }

  // If called directly (not included), return JSON response
  if (basename($_SERVER['PHP_SELF']) == basename(__FILE__)) {
    $user = wp_get_current_user();
    if (empty($user)) {
      http_response_code(403);
      echo json_encode(['error' => 'User not logged in']);
      exit;
    }
 
    $importSettings = get_import_settings();
    echo json_encode($importSettings);
  }
?>