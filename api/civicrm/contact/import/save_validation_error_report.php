<?php
require_once '../../../../../wp-load.php';
require_once '../../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';
require_once './error_reports_table.php';

$user = wp_get_current_user();
if (empty($user)) {
  http_response_code(403);
  echo json_encode(['error' => 'User not logged in']);
  exit;
}

if (!importing_error_reports_user_can_access()) {
  http_response_code(403);
  echo json_encode(['error' => 'User does not have permission to save error reports']);
  exit;
}

try {
  $post = json_decode(file_get_contents('php://input'), true);

  if (!$post || !isset($post['errors']) || !is_array($post['errors'])) {
    throw new Exception('Invalid request data');
  }

  $importRunId = !empty($post['importRunId']) ? sanitize_text_field($post['importRunId']) : wp_generate_uuid4();
  $linkedRunId = !empty($post['linkedRunId']) ? sanitize_text_field($post['linkedRunId']) : $importRunId;
  $summary = isset($post['summary']) && is_array($post['summary']) ? $post['summary'] : [];
  $errors = array_map('normalizeValidationErrorEntry', $post['errors']);
  $errors = array_values(array_filter($errors, function ($error) {
    return !empty($error['message']);
  }));

  $savedErrors = importing_error_reports_upsert_rows(
    $importRunId,
    $errors,
    [
      'source' => 'pre_import_validation',
      'linked_run_id' => $linkedRunId,
      'batch_number' => null,
      'batch_size' => null,
      'contacts_in_batch' => isset($summary['totalRecords']) ? (int) $summary['totalRecords'] : 0,
      'new_contacts_count' => 0,
      'updated_contacts_count' => 0,
      'contributions_count' => 0,
      'total_records' => isset($summary['totalRecords']) ? (int) $summary['totalRecords'] : null,
      'valid_records' => isset($summary['validRecords']) ? (int) $summary['validRecords'] : null,
      'review_records' => isset($summary['reviewRecords']) ? (int) $summary['reviewRecords'] : null,
      'file_name' => isset($summary['fileName']) ? (string) $summary['fileName'] : null,
      'file_size' => isset($summary['fileSize']) ? (string) $summary['fileSize'] : null,
    ],
    $user
  );

  echo json_encode([
    'importRunId' => $importRunId,
    'linkedRunId' => $linkedRunId,
    'savedErrors' => $savedErrors,
  ]);
} catch (\Throwable $e) {
  http_response_code(400);
  echo json_encode(['error' => $e->getMessage()]);
  error_log('[IMPORTING] Failed to save validation error report: ' . $e->getMessage());
}


function normalizeValidationErrorEntry($error)
{
  if (!is_array($error)) {
    return [
      'row' => null,
      'row_end' => null,
      'field' => 'general',
      'message' => (string) $error,
    ];
  }

  $normalized = [
    'row' => isset($error['row']) ? (int) $error['row'] : null,
    'row_end' => isset($error['row_end']) ? (int) $error['row_end'] : null,
    'field' => isset($error['field']) ? (string) $error['field'] : 'general',
    'message' => isset($error['message']) ? (string) $error['message'] : 'Validation error',
  ];

  if (isset($error['contact']) && is_array($error['contact'])) {
    $contact = $error['contact'];
    $normalized['contact'] = [
      'contact_id' => $contact['contact_id'] ?? null,
      'row' => isset($contact['row']) ? (int) $contact['row'] : null,
      'label' => $contact['label'] ?? null,
      'name' => $contact['name'] ?? null,
      'contact_type' => $contact['contact_type'] ?? null,
      'external_identifier' => $contact['external_identifier'] ?? null,
      'email_primary' => $contact['email_primary'] ?? null,
      'phone_primary' => $contact['phone_primary'] ?? null,
    ];

    if (isset($contact['contribution']) && is_array($contact['contribution'])) {
      $contribution = $contact['contribution'];
      $normalized['contact']['contribution'] = [
        'trxn_id' => $contribution['trxn_id'] ?? null,
        'total_amount' => $contribution['total_amount'] ?? null,
        'receive_date' => $contribution['receive_date'] ?? null,
        'financial_type' => $contribution['financial_type'] ?? null,
        'imported_date' => $contribution['imported_date'] ?? ($contribution['Additional_Contribution_Details.Imported_Date'] ?? null),
        'received_date' => $contribution['received_date'] ?? ($contribution['Additional_Contribution_Details.Received_Date'] ?? null),
      ];
    }
  }

  return $normalized;
}
