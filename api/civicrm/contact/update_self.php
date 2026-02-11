<?php
  require_once '../../../../wp-load.php';
  require_once '../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  $user = wp_get_current_user();
  if (empty($user)) exit;

  $post = json_decode(file_get_contents("php://input"), true);
 
  $query = Civi\Api4\Contact::update(false)
    -> addWhere('email_primary.email', '=', $user -> user_email);

  foreach ($post['values'] as $key => $value) {
    if ($key != 'id' && substr($key, 0, strlen('email')) != 'email') {
      if (is_array($value) && empty($value)) {
        $query -> addValue($key, '');
      }
      else $query -> addValue($key, $value);
    }
    else continue;
  }

  $query -> execute();
  echo true;
?>