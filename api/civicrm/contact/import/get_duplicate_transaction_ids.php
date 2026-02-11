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
    $transactionIds = [];
    
    // Handle POST request (JSON body)
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      $post = json_decode(file_get_contents("php://input"), true);
      if ($post && isset($post['transactionIds'])) {
        $transactionIds = $post['transactionIds'] ?? [];
      }
    } 
    // Handle GET request (query parameter)
    else if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['transactionIds'])) {
      $ids = $_GET['transactionIds'];
      // If it's a string (comma-separated or JSON), parse it
      if (is_string($ids)) {
        // Try to parse as JSON first
        $decoded = json_decode($ids, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
          $transactionIds = $decoded;
        } else {
          // Otherwise, treat as comma-separated
          $transactionIds = array_filter(array_map('trim', explode(',', $ids)));
        }
      } else if (is_array($ids)) {
        $transactionIds = $ids;
      }
    }
    
    // Filter out empty transaction IDs
    $transactionIds = array_filter($transactionIds, function($id) {
      return !empty(trim($id));
    });
    
    if (empty($transactionIds)) {
      echo json_encode([]);
      exit;
    }
    
    $existingTransactionIDs = \Civi\Api4\Contribution::get(TRUE)
      ->addSelect('id', 'contact_id', 'receive_date', 'trxn_id', 'Additional_Contribution_Details.Imported_Date')
      ->addWhere('trxn_id', 'IN', $transactionIds)
      ->execute();

    echo json_encode($existingTransactionIDs);
  } catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
  }
?>