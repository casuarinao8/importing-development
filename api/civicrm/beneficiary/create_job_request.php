<?php
require_once '../../../../wp-load.php';
require_once '../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

date_default_timezone_set('Asia/Singapore');

include('../../now.php');

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
$body = json_decode(file_get_contents('php://input'), true);

$query = \Civi\Api4\Activity::create(false)
  -> addValue('status_id:name', 'Available')
  -> addValue('source_contact_id', $contact['id'])
  -> addValue('activity_type_id:name', 'Volunteer Job Request');
  
$prefix = 'Volunteer_Job_Request';
$allowedKeys = ['target_contact_id', 'subject', 'details', 'location', 'activity_date_time'];

foreach ($body as $key => $column) {
  if (isset($body[$key]) && strpos($key, $prefix) == 0 || in_array($key, $allowedKeys)) {
    $query->addValue($key, $body[$key]);
  }
}

$result = $query->execute();
echo json_encode($result);
