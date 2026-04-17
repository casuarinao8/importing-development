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
  echo json_encode(['error' => 'User does not have permission to view error reports']);
  exit;
}

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
$limit = max(1, min(100, $limit));

$runId = isset($_GET['run_id']) ? sanitize_text_field($_GET['run_id']) : '';

if (!empty($runId)) {
  $report = importing_error_reports_fetch_report_by_run_id($runId);

  if ($report !== null) {
    echo json_encode($report);
    exit;
  }

  http_response_code(404);
  echo json_encode(['error' => 'Error report not found']);
  exit;
}

echo json_encode(importing_error_reports_fetch_reports($limit));
