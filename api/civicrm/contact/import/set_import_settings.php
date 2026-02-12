<?php
  require_once '../../../../../wp-load.php';
  require_once '../../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo json_encode(['error' => 'User not logged in']);
    exit;
  }
 
  try {
    $post = json_decode(file_get_contents("php://input"), true);

    if (!$post || !isset($post['settings'])) {
        throw new Exception('Invalid request data');
    }

    $settings = $post['settings'] ?? [];

    $importSettings = Civi\Api4\Setting::set(false)
        -> addValue('import_dedupe_rule', $settings['import_dedupe_rule'])
        -> addValue('import_contact_types', $settings['import_contact_types'])
        -> addValue('import_custom_fields', $settings['import_custom_fields'])
        -> execute();

    echo json_encode($importSettings);

  } catch (\Throwable $th) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
    error_log("This is a debug message from PHP");
  }
?>