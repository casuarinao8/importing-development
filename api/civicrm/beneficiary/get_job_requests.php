<?php
  require_once '../../../../wp-load.php';
  require_once '../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  // Whether to get the patient's view or the caregiver view
  $patient_view = filter_var($_GET['patient_view'] ?? false, FILTER_VALIDATE_BOOLEAN);
  
  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo 'Contact not logged in';
    exit;
  }

  $query = \Civi\Api4\Activity::get(false)
    -> addSelect('subject', 'details', 'status_id:name', 'activity_date_time', 'location', 'created_date', 'source_contact_id', 'target_contact_id')
    -> addSelect('Volunteer_Job_Request.Request_Type', 'Volunteer_Job_Request.Request_Type:label')
    -> addSelect('patient.id', 'patient.first_name', 'patient.last_name', 'patient.email_primary.email')
    -> addSelect('volunteer.id', 'volunteer.first_name', 'volunteer.last_name', 'volunteer.email_primary.email')
    -> addSelect('self.id', 'self.email_primary.email', 'self.first_name', 'self.last_name')
    -> addJoin('Contact AS self', 'LEFT', ['source_contact_id', '=', 'self.id'])
    -> addJoin('Contact AS patient', 'LEFT', ['target_contact_id', '=', 'patient.id'])
    -> addJoin('Contact AS volunteer', 'LEFT', ['assignee_contact_id', '=', 'volunteer.id'])
    -> addWhere('activity_type_id:name', '=', 'Volunteer Job Request');
  
  // If it's patient view, return job requests created by the use  and/or the patient is themselves 
  if ($patient_view) {
    $query -> addClause('OR', 
    ['patient.email_primary.email', '=', $user -> user_email], 
    ['AND', [['self.email_primary.email', '=', $user -> user_email], ['patient.email_primary.email', '=', $user -> user_email]]]);
  }
  // If it's caregiver view, only return job requests created by the user and the patient is not themselves
  else {
    $query 
      -> addWhere('self.email_primary.email', '=', $user -> user_email)
      -> addWhere('patient.email_primary.email', '!=', $user -> user_email);
  }
  
  $requests = $query -> execute();
  echo json_encode($requests);
?>