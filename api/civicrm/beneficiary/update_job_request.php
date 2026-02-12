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
    ->addSelect('id')
    ->addWhere('email_primary.email', '=', $user->user_email)
    ->setLimit(1)
    ->execute();
  
  if (empty($contacts) || !isset($contacts[0])) {
    http_response_code(404);
    echo 'Contact not found';
    exit;
  }
  
  $contact = $contacts[0];
  $request_id = $_GET['id'];
  $body = json_decode(file_get_contents('php://input'), true);
  
  $query = \Civi\Api4\Activity::update(false)
    -> addWhere('id', '=', $request_id)
    -> addClause('OR', ['source_contact_id', '=', $contact['id']], ['target_contact_id', '=', $contact['id']])
    -> addWhere('activity_type_id:name', '=', 'Volunteer Job Request')
    -> addWhere('status_id:name', 'NOT IN', ['Completed', 'Cancelled'])
    -> addWhere('assignee_contact_id', 'IS NULL');

  $prefix = 'Volunteer_Job_Request';
  $allowedKeys = ['target_contact_id', 'subject', 'details', 'location', 'activity_date_time'];
  
  foreach ($body as $key => $column) {
    if (isset($body[$key]) && strpos($key, $prefix) == 0 || in_array($key, $allowedKeys)) {
      $query->addValue($key, $body[$key]);
    }
  }

  $request = $query->execute();

  if (empty($request)) echo false;
  else echo true;
?>
