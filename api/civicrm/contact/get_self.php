<?php
  require_once '../../../../wp-load.php';
  require_once '../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo 'Contact not logged in';
    exit;
  }
 
  $contacts = Civi\Api4\Contact::get(false)
  -> addSelect('*', 'email_primary.*', 'phone_primary.*', 'address_primary.*', 'contact_sub_type:label')
  -> addSelect('Account_Information.*', 'Stripe.*')
  -> addSelect('Volunteer_Details.*', 'Donor_Details.*')
  -> addWhere('email_primary.email', '=', $user -> user_email)
  -> setLimit(1)
  -> execute();

  echo json_encode(!empty($contacts) && isset($contacts[0]) ? $contacts[0] : null);
?>