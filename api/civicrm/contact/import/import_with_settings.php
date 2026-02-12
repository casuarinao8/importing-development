<?php
  require_once '../../../../../wp-load.php';
  require_once '../../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';
  require_once './get_import_settings.php';

  $user = wp_get_current_user();
  if (empty($user)) {
    http_response_code(403);
    echo json_encode(['error' => 'User not logged in']);
    exit;
  }

  $settings = get_import_settings();
  $settingsByName = array_column($settings, 'value', 'name');

  $dedupeRule = $settingsByName['import_dedupe_rule'] ?? null;
  $allowedContactTypes = $settingsByName['import_contact_types'] ?? [];
  $enabledCustomFields = $settingsByName['import_custom_fields'] ?? [];
  
  error_log("Import settings - Dedupe Rule: " . ($dedupeRule ?? 'null'));
  error_log("Import settings - Allowed Contact Types: " . json_encode($allowedContactTypes));
  error_log("Import settings - Enabled Custom Fields: " . json_encode($enabledCustomFields));

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
    $contributionRecords = [];
    $contactContributionMap = []; // Maps array index to contact data for later reference
    $contactSuccess = false;
    $validationErrors = [];

    // Batch fetch all existing contacts by Dedupe Rule
    $existingContactsMap = [];
    if ($dedupeRule) {
      $matchingFields = array_filter(array_column($contacts, $dedupeRule));
      
      // Normalize email/phone for matching
      if ($dedupeRule === 'email_primary') {
        $matchingFields = array_map(fn($e) => strtolower(trim($e)), $matchingFields);
      } elseif ($dedupeRule === 'phone_primary') {
        $matchingFields = array_map(fn($p) => trim($p), $matchingFields);
      }
      $matchingFields = array_unique($matchingFields);
      error_log("Matching fields: " . json_encode($matchingFields));

      if (!empty($matchingFields)) {
        // Handle email_primary and phone_primary via their entities for better performance
        if ($dedupeRule === 'email_primary') {
          $emailMatches = \Civi\Api4\Email::get(false)
            ->addSelect('contact_id', 'email')
            ->addWhere('email', 'IN', $matchingFields)
            ->execute();
          error_log("Email matches: " . json_encode($emailMatches));
          $contactIds = array_unique(array_column(iterator_to_array($emailMatches), 'contact_id'));
          $whereClause = ['id', 'IN', $contactIds];
        } elseif ($dedupeRule === 'phone_primary') {
          $phoneMatches = \Civi\Api4\Phone::get(false)
            ->addSelect('contact_id', 'phone')
            ->addWhere('phone', 'IN', $matchingFields)
            ->execute();
          error_log("Phone matches: " . json_encode($phoneMatches));
          $contactIds = array_unique(array_column(iterator_to_array($phoneMatches), 'contact_id'));
          $whereClause = ['id', 'IN', $contactIds];
        } else {
          $whereClause = [$dedupeRule, 'IN', $matchingFields];
        }
        
        $existingContactsResult = \Civi\Api4\Contact::get(false)
          ->addSelect('id', $dedupeRule === 'external_identifier' ? 'external_identifier' : 'id')
          ->addWhere(...$whereClause)
          ->addChain('emails', \Civi\Api4\Email::get(TRUE)->addWhere('contact_id', '=', '$id')->addSelect('email'))
          ->addChain('phones', \Civi\Api4\Phone::get(TRUE)->addWhere('contact_id', '=', '$id')->addSelect('phone'))
          ->execute();

        // Build a map for quick lookup
        foreach ($existingContactsResult as $existing) {
          if ($dedupeRule === 'email_primary') {
            foreach ($existing['emails'] as $email) {
              $key = strtolower($email['email']);
              if ($key && in_array($key, $matchingFields)) {
                $existingContactsMap[$key] = [
                  'id' => $existing['id'],
                  'emails' => array_map(fn($e) => strtolower($e['email']), $existing['emails']),
                  'phones' => array_map(fn($p) => $p['phone'], $existing['phones'])
                ];
                error_log("Existing contact map " . $key . ": " . json_encode($existingContactsMap[$key]));
              }
            }
          } elseif ($dedupeRule === 'phone_primary') {
            foreach ($existing['phones'] as $phone) {
              $key = trim($phone['phone']);
              if ($key && in_array($key, $matchingFields)) {
                $existingContactsMap[$key] = [
                  'id' => $existing['id'],
                  'emails' => array_map(fn($e) => strtolower($e['email']), $existing['emails']),
                  'phones' => array_map(fn($p) => $p['phone'], $existing['phones'])
                ];
                error_log("Existing contact map " . $key . ": " . json_encode($existingContactsMap[$key]));
              }
            }
          } else {
            $key = $existing[$dedupeRule] ?? '';
            if ($key) {
              $existingContactsMap[$key] = [
                'id' => $existing['id'],
                'emails' => array_map(fn($e) => strtolower($e['email']), $existing['emails']),
                'phones' => array_map(fn($p) => $p['phone'], $existing['phones'])
              ];
              error_log("Existing contact map " . $key . ": " . json_encode($existingContactsMap[$key]));
            }
          }
        }
      }
    }

    foreach ($contacts as $index => $contact) {
      $contribution = $contact['contribution'] ?? null;
      
      try {
        $existingContact = null;
        if ($dedupeRule && isset($contact[$dedupeRule])) {
          $lookupKey = $dedupeRule === 'email_primary' ? strtolower(trim($contact[$dedupeRule])) : 
                       ($dedupeRule === 'phone_primary' ? trim($contact[$dedupeRule]) : $contact[$dedupeRule]);
          $existingContact = $existingContactsMap[$lookupKey] ?? null;
        } 
        $contactId = null;
        $contactSuccess = false;

        // validate contact type
        if (!empty($allowedContactTypes) && !in_array($contact['contact_type'], $allowedContactTypes)) {
          $validationErrors[] = [
            'row' => $index + 1,
            'field' => 'contact_type',
            'message' => 'Contact type ' . $contact['contact_type'] . ' is not allowed'
          ];
          continue;
        }

        // Validate imported date custom field based on settings
        if ($contribution && !empty($enabledCustomFields) && in_array('Imported_Date', $enabledCustomFields)) {
          $importedDate = $contribution['Additional_Contribution_Details.Imported_Date'] ?? '';
          if (empty(trim($importedDate))) {
            $validationErrors[] = [
              'row' => $index + 1,
              'field' => 'Imported_Date',
              'message' => 'Imported_Date is required.'
            ];
            $contactSuccess = false;
            continue;
          }
        }

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
          
          // name
          $name = $contact['name'];
          if ($contact['contact_type'] === 'Organization') {
            $query->addValue('organization_name', $name);
          } else {
            $query->addValue('first_name', $name);
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
            array_push($existingContactsMap[$contact[$dedupeRule]]['emails'], strtolower($contact['email_primary']));
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
            array_push($existingContactsMap[$contact[$dedupeRule]]['phones'], strtolower($contact['phone_primary']));
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
          
          $updatedContacts[] = buildContactResponse($contactId, $contact, $index);
          $contactSuccess = true;

        } else {
          // CREATE NEW CONTACT
          $query = \Civi\Api4\Contact::create(false)
            ->addValue('contact_type', $contact['contact_type']);

          // name prefix if present
          if (!empty($contact['prefix_id'])) {
            $query->addValue('prefix_id', $contact['prefix_id']);
          }
          
          $name = $contact['name'];
          if ($contact['contact_type'] === 'Organization') {
            $query->addValue('organization_name', $name);
          } else {
            $query->addValue('first_name', $name);
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
          
          $newContacts[] = buildContactResponse($contactId, $contact, $index);
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
          //only include custom fields that are enabled in settings
          $contributionRecord = [
            'contact_id' => $contactId,
            'total_amount' => $contribution['total_amount'],
            'financial_type_id' => $contribution['financial_type_id'],
            'payment_instrument_id' => $contribution['payment_instrument_id'],
            'receive_date' => $contribution['receive_date'],
            'contribution_status_id' => $contribution['contribution_status_id'],
            'trxn_id' => $contribution['trxn_id'],
            'source' => $contribution['source'] ?? null
          ];
          // Only include custom fields that are enabled in settings
          if (!empty($enabledCustomFields)) {
            foreach ($enabledCustomFields as $field) {
              $fieldKey = 'Additional_Contribution_Details.' . $field;
              if (isset($contribution[$fieldKey])) {
                $contributionRecord[$fieldKey] = $contribution[$fieldKey];
              }
            }
          }
          $contributionRecords[] = $contributionRecord;
          
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
    
    if (!empty($contributionRecords)) {
      try {
        // bulk save
        $contributionResults = \Civi\Api4\Contribution::save(false)
          ->setRecords($contributionRecords)
          ->execute();
        
        // if bulk save is successful - map all contribution IDs and track contributions
        foreach ($contributionResults as $idx => $contributionResult) {
          $contactId = $contactContributionMap[$idx]['contact_id'];
          $contributionId = $contributionResult['id'];
          
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
        $minRow = $batchNumber ? (($batchNumber - 1) * $batchSize) + 1 : null;
        $maxRow = $batchNumber ? $batchNumber * $batchSize : null;
        
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
  function buildContactResponse($contactId, $contact, $index) {
    return [
      'prefix_id' => $contact['prefix_id'] ?? null,
      'contact_id' => $contactId,
      'contact_type' => $contact['contact_type'],
      'name' => $contact['name'],
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