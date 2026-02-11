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
    
    if (!$post || !isset($post['contacts'])) {
      throw new Exception('Invalid request data');
    }

    $contacts = $post['contacts'] ??  [];
    $batchNumber = $post['batchNumber'] ?? null;
    $batchSize = $post['batchSize'] ?? null;
    
    error_log("Processing " . count($contacts) . " contacts");
    $newContacts = [];
    $updatedContacts = [];
    $errors = [];

    // Batch fetch all existing contacts by external_identifier
    $externalIds = array_filter(array_column($contacts, 'external_identifier'));
    
    $existingContactsMap = [];
    if (!empty($externalIds)) {
      $existingContactsResult = \Civi\Api4\Contact::get(false)
        ->addSelect('id', 'external_identifier')
        ->addWhere('external_identifier', 'IN', $externalIds)
        ->addChain('emails', \Civi\Api4\Email::get(TRUE)
          ->addWhere('contact_id', '=', '$id')
          ->addSelect('email'))
        ->addChain('phones', \Civi\Api4\Phone::get(TRUE)
          ->addWhere('contact_id', '=', '$id')
          ->addSelect('phone'))
        ->execute();

      // Build a map for quick lookup
      foreach ($existingContactsResult as $existing) {
        $existingContactsMap[$existing['external_identifier']] = [
          'id' => $existing['id'],
          'emails' => array_map(fn($e) => strtolower($e['email']), $existing['emails']),
          'phones' => array_map(fn($p) => $p['phone'], $existing['phones'])
        ];
      }
    }

    // Create/Update contacts and collect id for bulk contribution creation
    $contributionRecords = [];
    $contactContributionMap = []; // Maps array index to contact data for later reference
    $contactSuccess = false;

    foreach ($contacts as $index => $contact) {
      $contribution = $contact['contribution'] ?? null;
      
      try {
        $existingContact = $existingContactsMap[$contact['external_identifier']] ?? null; 
        $contactId = null;
        
        if ($existingContact) { 
          // UPDATE EXISTING CONTACT
          $contactId = $existingContact['id'];
          
          $query = \Civi\Api4\Contact::update(false)
            ->addWhere('id', '=', $contactId)
            ->addValue('contact_type', $contact['contact_type']);
          
          // name prefix if present
          if (!empty($contact['prefix_id'])) {
            $query->addValue('prefix_id', $contact['prefix_id']);
          }
          
          // name & contact subtype
          $name = $contact['name'];
          if ($contact['contact_type'] === 'Organization') {
            $query->addValue('organization_name', $name)
                  ->addValue('contact_sub_type', ['Organization_Donor',]);
          } else {
            $query->addValue('first_name', $name)
                  ->addValue('contact_sub_type', ['Individual_Donor',]);
            // preferred name if present
            if (!empty($contact['preferred_name'])) {
              $query->addValue('preferred_name', $contact['last_name']);
            }
          }

          // Add email if new
          if (!empty($contact['email_primary']) && 
              !in_array(strtolower($contact['email_primary']), $existingContact['emails'])) {
            $query->addChain('email', \Civi\Api4\Email::create(TRUE)
              ->setValues([
                'contact_id' => '$id',
                'email' => $contact['email_primary'],
                'is_primary' => TRUE,
                'location_type_id' => 3 // main
              ]));
            // add new email to existing emails array to prevent duplicates in same import
            // $existingContact['emails'][] = strtolower(string: $contact['email']);
            array_push($existingContactsMap[$contact['external_identifier']]['emails'], strtolower($contact['email']));
          }

          // Add phone if new
          if (!empty($contact['phone_primary']) && 
              !in_array($contact['phone_primary'], $existingContact['phones'])) {
            $query->addChain('phone', \Civi\Api4\Phone::create(TRUE)
              ->setValues([
                'contact_id' => '$id',
                'phone' => $contact['phone_primary'],
                'is_primary' => TRUE,
                'location_type_id' => 3, // main
                'phone_type_id' => 2 // mobile
              ]));
            // add new phone to existing phone to prevent duplicates in same import
            // $existingContact['phones'][] = strtolower(string: $contact['phone']);
            array_push($existingContactsMap[$contact['external_identifier']]['phones'], strtolower($contact['phone']));
          }

          // Add address
          if (!empty($contact['street_address']) || !empty($contact['postal_code'])) {
            if (!empty($contact['street_address'])) {
              $query->addValue('address_primary.street_address', $contact['street_address']);
              if (!empty($contact['unit_floor_number'])) {
                $query->addValue('address_primary.supplemental_address_1', $contact['unit_floor_number']);
              }
            }
            if (!empty($contact['postal_code'])) {
              $query->addValue('address_primary.postal_code', $contact['postal_code']);
            }
          }

          $result = $query->execute();
          
          $updatedContacts[] = buildContactResponse($contactId, $contact, $index, 'Updated');
          $contactSuccess = true;

        } else {
          // CREATE NEW CONTACT
          $query = \Civi\Api4\Contact::create(false)
            ->addValue('contact_type', $contact['contact_type']);

          // name prefix if present
          if (!empty($contact['prefix_id'])) {
            $query->addValue('prefix_id', $contact['prefix_id']);
          }
          
          // name & contact subtype
          $name = $contact['name'];
          if ($contact['contact_type'] === 'Organization') {
            $query->addValue('organization_name', $name)
                  ->addValue('contact_sub_type', ['Organization_Donor',]);
          } else {
            $query->addValue('first_name', $name)
                  ->addValue('contact_sub_type', ['Individual_Donor',]);
            // preferred name if present
            if (!empty($contact['preferred_name'])) {
              $query->addValue('preferred_name', $contact['last_name']);
            }
          }

          if (!empty($contact['email_primary'])) {
            $query->addValue('email_primary.email', $contact['email_primary'])
                  ->addValue('email_primary.location_type_id', 3);
          }

          if (!empty($contact['phone_primary'])) {
            $query->addValue('phone_primary.phone', $contact['phone_primary'])
                  ->addValue('phone_primary.location_type_id', 3)
                  ->addValue('phone_primary.phone_type_id', 2);
          }

          if (!empty($contact['external_identifier'])) {
            $query->addValue('external_identifier', $contact['external_identifier']);
          }

          if (!empty($contact['street_address']) || !empty($contact['postal_code'])) {
            if (!empty($contact['street_address'])) {
              $query->addValue('address_primary.street_address', $contact['street_address']);
              if (!empty($contact['unit_floor_number'])) {
                $query->addValue('address_primary.supplemental_address_1', $contact['unit_floor_number']);
              }
            }
            if (!empty($contact['postal_code'])) {
              $query->addValue('address_primary.postal_code', $contact['postal_code']);
            }
          }

          $result = $query->execute();
          $contactId = $result[0]['id'];
          
          $newContacts[] = buildContactResponse($contactId, $contact, $index, 'New');
          $contactSuccess = true;

          // add to existing contacts map to prevent duplicates in same import
          if (!empty($contact['external_identifier'])) {
            $existingContactsMap[$contact['external_identifier']] = [
              'id' => $contactId,
              'emails' => !empty($contact['email_primary']) ? [strtolower($contact['email_primary'])] : [],
              'phones' => !empty($contact['phone_primary']) ? [$contact['phone_primary']] : []
            ];
          }
        }

        // Collect contribution data for bulk save ONLY if contact was successfully created/updated
        if ($contactSuccess && $contribution && $contactId) {
          $contributionRecords[] = [
            'contact_id' => $contactId,
            'total_amount' => $contribution['total_amount'],
            'financial_type_id' => $contribution['financial_type_id'],
            'payment_instrument_id' => $contribution['payment_instrument_id'],
            'receive_date' => $contribution['receive_date'],
            'contribution_status_id' => $contribution['contribution_status_id'],
            'trxn_id' => $contribution['trxn_id'],
            'check_number' => $contribution['check_number'],
            'source' => $contribution['source'],
            'Additional_Contribution_Details.NRIC_FIN_UEN' => $contribution['Additional_Contribution_Details.NRIC_FIN_UEN'],
            'Additional_Contribution_Details.Campaign' => $contribution['Additional_Contribution_Details.Campaign'],
            'Additional_Contribution_Details.Imported_Date' => $contribution['Additional_Contribution_Details.Imported_Date'],
            'Additional_Contribution_Details.Payment_Platform' => $contribution['Additional_Contribution_Details.Payment_Platform'],
            'Additional_Contribution_Details.Recurring_Donation' => $contribution['Additional_Contribution_Details.Recurring_Donation'],
            'Additional_Contribution_Details.Remarks' => $contribution['Additional_Contribution_Details.Remarks']      
          ];
          
          // Store reference for mapping contribution IDs back later
          $contactContributionMap[] = [
            'contact_id' => $contactId,
            'row' => $index + 1,
            'financial_type' => $contribution['financial_type'],
            'total_amount' => $contribution['total_amount'],
            'receive_date' => $contribution['receive_date'],
            'trxn_id' => $contribution['trxn_id']
          ];
        }

      } catch (Exception $e) {
        $errors[] = [
          'contact_id' => $contact['contact_id'] ?? null,
          'row' => $index + 1,
          'field' => 'general',
          'message' => 'Contact Import failed: ' . $e->getMessage()
        ];
        error_log("Contact Import failed: " . $e->getMessage());
        $contactSuccess = false;
        // Don't collect contribution data if contact failed
        continue;
      }
    }

    // Step 3: Create contributions
    $importedContributions = [];
    
    if ($contactSuccess && !empty($contributionRecords)) {
      try {
        // bulk save
        $contributionResults = \Civi\Api4\Contribution::save(false)
          ->setRecords($contributionRecords)
          ->execute();
        
        // if bulk save is successful - map all contribution IDs and track contributions
        foreach ($contributionResults as $idx => $contributionResult) {
          $contactId = $contactContributionMap[$idx]['contact_id'];
          $contributionId = $contributionResult['id'];
          error_log('contributionResult: ' . $contributionResult);
          
          // Track imported contribution
          $importedContributions[] = [
            'contribution_id' => $contributionId,
            'contact_id' => $contactId,
            'row' => $contactContributionMap[$idx]['row'],
            'financial_type' => $contactContributionMap[$idx]['financial_type'],
            'total_amount' => $contributionResult['total_amount'],
            'receive_date' => $contactContributionMap[$idx]['receive_date'],
            'trxn_id' => $contactContributionMap[$idx]['trxn_id']
          ];
          
          // Link contribution to contact records
          foreach ($newContacts as &$nc) {
            if ($nc['contact_id'] == $contactId) {
              $nc['contribution_id'] = $contributionId;
              break;
            }
          }
          unset($nc);
          
          foreach ($updatedContacts as &$uc) {
            if ($uc['contact_id'] == $contactId) {
              $uc['contribution_id'] = $contributionId;
              break;
            }
          }
          unset($uc);
        }
        
      } catch (Exception $e) {
        // Bulk save failed - determine row range and report error
        $errorMessage = $e->getMessage();
        error_log("Bulk contribution save failed: " . $errorMessage);
        
        // Get row range from the batch
        $actualBatchSize = count($contacts);
        $minRow = $batchNumber ? (($batchNumber - 1) * $batchSize) + 1 : null;
        $maxRow = $batchNumber ? $minRow + $actualBatchSize - 1 : null;
        
        // Report error with row range
        if ($minRow !== null && $maxRow !== null) {
          if ($minRow == $maxRow) {
            $rowRange = "row $minRow";
          } else {
            $rowRange = "rows $minRow to $maxRow";
          }
        } else {
          $rowRange = "unknown rows";
          $minRow = null;
          $maxRow = null;
        }
        
        $errors[] = [
          'contact_id' => null,
          'row' => $minRow, // First row in the failed batch
          'row_end' => $maxRow, // Last row in the failed batch (for range display)
          'field' => 'contribution',
          'message' => "Contribution import failed for $rowRange. Error: $errorMessage"
        ];
        error_log("Contribution failed for $rowRange: " . $e->getMessage());
      }
    }

    error_log("Import completed - New: " . count($newContacts) . ", Updated: " . count($updatedContacts) . ", Contributions: " . count($importedContributions) . ", Errors: " . count($errors));

    // Restructure response for UI display
    $response = [
      'newContacts' => $newContacts,
      'updatedContacts' => $updatedContacts,
      'contributions' => $importedContributions,
      'numberOfErrors' => count($errors),
      'errors' => $errors
    ];

    echo json_encode($response);

  } catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
    error_log("This is a debug message from PHP");
  }

  // Helper function to reduce duplication
  function buildContactResponse($contactId, $contact, $index, $label) {
    return [
      'contact_id' => $contactId,
      'label' => $label,
      'contact_type' => $contact['contact_type'],
      'prefix_id' => $contact['prefix_id'] ?? null,
      'name' => $contact['name'],
      'preferred_name' => $contact['preferred_name'] ?? null,
      'external_identifier' => $contact['external_identifier'] ?? null,
      'email_primary' => $contact['email_primary'] ?? null,
      'phone_primary' => $contact['phone_primary'] ?? null,
      'street_address' => $contact['street_address'] ?? null,
      'unit_floor_number' => $contact['unit_floor_number'] ?? null,
      'postal_code' => $contact['postal_code'] ?? null,
      'row' => $index + 1
    ];
  }
?>