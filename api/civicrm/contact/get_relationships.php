<?php
  require_once '../../../../wp-load.php';
  require_once '../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  $type = isset($_GET['type']) ? $_GET['type'] : 0;

  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo 'Contact not logged in';
    exit;
  }

  $relationships = \Civi\Api4\Relationship::get(false)
    -> addSelect('created_date', 'relationship_type_id:label')
    -> addSelect('contact_id_a', 'contact_id_a.first_name', 'contact_id_a.last_name', 'contact_id_a.phone_primary.phone', 'contact_id_a.address_primary.street_address', 'contact_id_a.address_primary.postal_code', 'contact.id_a.gender_id:label', 'contact_id_a.email_primary.email')
    -> addWhere('contact_id_b.email_primary.email', '=', $user -> user_email);

  if (!empty($type)) $relationships -> addWhere('relationship_type_id:name', '=', $type);

  $relationships = $relationships -> execute();
  echo json_encode($relationships);
?>