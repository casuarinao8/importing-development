<?php
set_time_limit(300); // 5 minutes - CiviCRM hooks (CiviRules, emails, contridivide) are slow per contribution

require_once '../../../../../wp-load.php';
require_once '../../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';
require_once './error_reports_table.php';

$user = wp_get_current_user();
if (empty($user)) {
  http_response_code(403);
  echo json_encode(['error' => 'User not logged in']);
  exit;
}

$contacts = [];
$batchNumber = null;
$batchSize = null;
$importRunId = null;

try {
  $post = json_decode(file_get_contents("php://input"), true);

  if (!$post || !isset($post['contacts'])) {
    throw new Exception('Invalid request data');
  }

  $contacts = $post['contacts'] ?? [];
  $batchNumber = $post['batchNumber'] ?? null;
  $batchSize = $post['batchSize'] ?? null;
  $importRunId = !empty($post['importRunId']) ? sanitize_text_field($post['importRunId']) : wp_generate_uuid4();

  $taxDeductibleFinancialTypeId = 5;
  $orgSubtype = resolveContactSubtype('Organization', ['Organisation_Donor', 'Organisation_donor']);

  error_log("[IMPORTING] Processing " . count($contacts) . " contacts");
  $newContacts = [];
  $updatedContacts = [];
  $errors = [];

  // Collect identifiers based on matching rules
  $externalIds = [];
  $emails = [];
  $phones = [];

  foreach ($contacts as $contact) {
    $contribution = $contact['contribution'] ?? null;
    //tax deductible if financial type id matches the configured value
    $isTaxDeductible = ($contribution && isset($contribution['financial_type_id']) && $contribution['financial_type_id'] == $taxDeductibleFinancialTypeId);

    // Tax-deductible: always use external_id
    if ($isTaxDeductible && !empty($contact['external_identifier'])) {
      $externalIds[] = $contact['external_identifier'];
    }
    // Non-tax-deductible Individual: use email and phone
    elseif (!$isTaxDeductible && $contact['contact_type'] === 'Individual') {
      if (!empty($contact['email_primary'])) {
        $emails[] = strtolower($contact['email_primary']);
      }
      if (!empty($contact['phone_primary'])) {
        $phones[] = $contact['phone_primary'];
      }
    }
    // Non-tax-deductible Organization: no checking needed (will create new)
  }

  // Remove duplicates
  $externalIds = array_unique($externalIds);
  $emails = array_unique($emails);
  $phones = array_unique($phones);

  error_log("[IMPORTING] Identifiers to look up - External IDs: " . count($externalIds) . ", Emails: " . count($emails) . ", Phones: " . count($phones));

  // Fetch existing contacts based on collected identifiers
  // Single query combining external_id, email, and phone matching
  $existingContactsMap = [];

  if (!empty($externalIds) || !empty($emails) || !empty($phones)) {
    $query = \Civi\Api4\Contact::get(TRUE)
      ->addSelect('id', 'contact_type', 'external_identifier')
      ->addChain('emails', \Civi\Api4\Email::get(TRUE)
        ->addWhere('contact_id', '=', '$id')
        ->addSelect('email'))
      ->addChain('phones', \Civi\Api4\Phone::get(TRUE)
        ->addWhere('contact_id', '=', '$id')
        ->addSelect('phone'));

    // Build OR conditions for matching
    $orConditions = [];

    // Add external_id condition
    if (!empty($externalIds)) {
      $orConditions[] = ['external_identifier', 'IN', $externalIds];
    }

    // Add email condition with join
    if (!empty($emails)) {
      $query->addJoin('Email AS email_match', 'LEFT', ['id', '=', 'email_match.contact_id']);
      $orConditions[] = ['email_match.email', 'IN', $emails];
    }

    // Add phone condition with join
    if (!empty($phones)) {
      $query->addJoin('Phone AS phone_match', 'LEFT', ['id', '=', 'phone_match.contact_id']);
      $orConditions[] = ['phone_match.phone', 'IN', $phones];
    }

    // Apply OR clause if we have any conditions
    if (!empty($orConditions)) {
      if (count($orConditions) === 1) {
        // Single condition, no need for OR clause
        $query->addWhere($orConditions[0][0], $orConditions[0][1], $orConditions[0][2]);
      } else {
        // Multiple conditions, use OR clause
        $query->addClause('OR', ...$orConditions);
      }

      $existingContactsResult = $query->execute();

      // Build maps for quick lookup
      foreach ($existingContactsResult as $existing) {
        $contactData = [
          'id' => $existing['id'],
          'contact_type' => $existing['contact_type'],
          'emails' => array_map(fn($e) => strtolower($e['email']), $existing['emails']),
          'phones' => array_map(fn($p) => $p['phone'], $existing['phones'])
        ];

        // Index by external_identifier
        if (!empty($existing['external_identifier'])) {
          $existingContactsMap['ext_' . $existing['external_identifier']] = $contactData;
        }

        // Index by emails
        foreach ($contactData['emails'] as $email) {
          if (!isset($existingContactsMap['email_' . $email])) {
            $existingContactsMap['email_' . $email] = $contactData;
          }
        }

        // Index by phones
        foreach ($contactData['phones'] as $phone) {
          if (!isset($existingContactsMap['phone_' . $phone])) {
            $existingContactsMap['phone_' . $phone] = $contactData;
          }
        }
      }
    }
  }

  error_log("[IMPORTING] Found " . count($existingContactsMap) . " existing contact entries in DB (indexed by ext/email/phone)");

  // Function to find existing contact based on matching rules
  function findExistingContact($contact, $contribution, $existingContactsMap, $taxDeductibleFinancialTypeId)
  {
    $isTaxDeductible = ($contribution && isset($contribution['financial_type_id']) && $contribution['financial_type_id'] == $taxDeductibleFinancialTypeId);

    // Tax-deductible: match by external_id
    if ($isTaxDeductible && !empty($contact['external_identifier'])) {
      $key = 'ext_' . $contact['external_identifier'];
      return $existingContactsMap[$key] ?? null;
    }

    // Non-tax-deductible Individual: match by email first, then phone
    if (!$isTaxDeductible && $contact['contact_type'] === 'Individual') {
      // Try email first
      if (!empty($contact['email_primary'])) {
        $key = 'email_' . strtolower($contact['email_primary']);
        if (isset($existingContactsMap[$key])) {
          return $existingContactsMap[$key];
        }
      }

      // Try phone if email not found
      if (!empty($contact['phone_primary'])) {
        $key = 'phone_' . $contact['phone_primary'];
        if (isset($existingContactsMap[$key])) {
          return $existingContactsMap[$key];
        }
      }
    }

    // Non-tax-deductible Organization: no matching, always create new
    return null;
  }

  // Create/Update contacts and collect id for bulk contribution creation
  $contributionRecords = [];
  $contactContributionMap = [];

  foreach ($contacts as $index => $contact) {
    $contribution = $contact['contribution'] ?? null;
    $contactSuccess = false;

    try {
      $existingContact = findExistingContact($contact, $contribution, $existingContactsMap, $taxDeductibleFinancialTypeId);
      $contactId = null;

      if ($existingContact) {
        // UPDATE EXISTING CONTACT
        $contactId = $existingContact['id'];
        error_log("[IMPORTING] Row " . ($index + 1) . ": Updating existing contact ID " . $contactId . " - " . $contact['name'] . " (ext_id: " . ($contact['external_identifier'] ?? 'none') . ")");

        $query = \Civi\Api4\Contact::update(false)
          ->addWhere('id', '=', $contactId)
          ->addValue('contact_type', $contact['contact_type']);

        // name & contact subtype
        $name = $contact['name'];
        if ($contact['contact_type'] === 'Organization') {
          $query->addValue('organization_name', $name)
            ->addValue('contact_sub_type', [$orgSubtype,]);
        } else {
          $query->addValue('first_name', $name)
            ->addValue('contact_sub_type', ['Individual_Donor',]);
          // preferred name if present
          if (!empty($contact['preferred_name'])) {
            $query->addValue('last_name', $contact['preferred_name']);
          }
          // name prefix if present
          if (!empty($contact['prefix_id'])) {
            $query->addValue('prefix_id', $contact['prefix_id']);
          }
        }

        // Add email if new
        if (
          !empty($contact['email_primary']) &&
          !in_array(strtolower($contact['email_primary']), $existingContact['emails'])
        ) {
          $query->addChain('email', \Civi\Api4\Email::create(TRUE)
            ->setValues([
              'contact_id' => '$id',
              'email' => $contact['email_primary'],
              'is_primary' => TRUE,
              'location_type_id' => 3 // main
            ]));
          // Update local cache
          $existingContact['emails'][] = strtolower($contact['email_primary']);
        }

        // Add phone if new
        if (
          !empty($contact['phone_primary']) &&
          !in_array($contact['phone_primary'], $existingContact['phones'])
        ) {
          $query->addChain('phone', \Civi\Api4\Phone::create(TRUE)
            ->setValues([
              'contact_id' => '$id',
              'phone' => $contact['phone_primary'],
              'is_primary' => TRUE,
              'location_type_id' => 3, // main
              'phone_type_id' => 2 // mobile
            ]));
          // Update local cache
          $existingContact['phones'][] = $contact['phone_primary'];
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
        error_log("[IMPORTING] Row " . ($index + 1) . ": Creating new contact - " . $contact['name'] . " (type: " . $contact['contact_type'] . ", ext_id: " . ($contact['external_identifier'] ?? 'none') . ", email: " . ($contact['email_primary'] ?? 'none') . ")");
        $query = \Civi\Api4\Contact::create(false)
          ->addValue('contact_type', $contact['contact_type']);

        // name & contact subtype
        $name = $contact['name'];
        if ($contact['contact_type'] === 'Organization') {
          $query->addValue('organization_name', $name)
            ->addValue('contact_sub_type', [$orgSubtype,]);
        } else {
          $query->addValue('first_name', $name)
            ->addValue('contact_sub_type', ['Individual_Donor',]);
          // preferred name if present
          if (!empty($contact['preferred_name'])) {
            $query->addValue('last_name', $contact['preferred_name']);
          }
          // name prefix if present
          if (!empty($contact['prefix_id'])) {
            $query->addValue('prefix_id', $contact['prefix_id']);
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
        error_log("[IMPORTING] Row " . ($index + 1) . ": New contact created with ID " . $contactId);

        $newContacts[] = buildContactResponse($contactId, $contact, $index, 'New');
        $contactSuccess = true;

        // Add to cache to prevent duplicates in same import
        $newContactData = [
          'id' => $contactId,
          'contact_type' => $contact['contact_type'],
          'emails' => !empty($contact['email_primary']) ? [strtolower($contact['email_primary'])] : [],
          'phones' => !empty($contact['phone_primary']) ? [$contact['phone_primary']] : []
        ];

        if (!empty($contact['external_identifier'])) {
          $existingContactsMap['ext_' . $contact['external_identifier']] = $newContactData;
        }
        if (!empty($contact['email_primary'])) {
          $existingContactsMap['email_' . strtolower($contact['email_primary'])] = $newContactData;
        }
        if (!empty($contact['phone_primary'])) {
          $existingContactsMap['phone_' . $contact['phone_primary']] = $newContactData;
        }
      }

      // Collect contribution data for bulk save ONLY if contact was successfully created/updated
      if ($contactSuccess && $contribution && $contactId) {
        error_log("[IMPORTING] Row " . ($index + 1) . ": Queuing contribution - Amount: " . $contribution['total_amount'] . ", trxn_id: " . ($contribution['trxn_id'] ?? 'none') . ", date: " . $contribution['receive_date']);
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
          'Additional_Contribution_Details.Received_Date' => $contribution['Additional_Contribution_Details.Received_Date'],
          'Additional_Contribution_Details.Payment_Platform' => $contribution['Additional_Contribution_Details.Payment_Platform'],
          'Additional_Contribution_Details.Recurring_Donation' => $contribution['Additional_Contribution_Details.Recurring_Donation'],
          'Additional_Contribution_Details.Remarks' => $contribution['Additional_Contribution_Details.Remarks'],
          'Donation_In_Kind_Additional_Details.Items_donated' => $contribution['Donation_In_Kind_Additional_Details.Items_donated'] ?? '',
          'Donation_In_Kind_Additional_Details.Quantity' => $contribution['Donation_In_Kind_Additional_Details.Quantity'] ?? null
        ];

        // Store reference for mapping contribution IDs back later
        $contactContributionMap[] = [
          'contact_id' => $contactId,
          'row' => $index + 1,
          'name' => $contact['name'],
          'financial_type' => $contribution['financial_type'],
          'total_amount' => $contribution['total_amount'],
          'receive_date' => $contribution['receive_date'],
          'source' => $contribution['source'],
          'trxn_id' => $contribution['trxn_id'],
          'campaign_name' => $contribution['Additional_Contribution_Details.Campaign'],
          'platform' => $contribution['Additional_Contribution_Details.Payment_Platform'],
          'frequency' => $contribution['Additional_Contribution_Details.Recurring_Donation'],
          'remarks' => $contribution['Additional_Contribution_Details.Remarks'],
          'imported_date' => $contribution['Additional_Contribution_Details.Imported_Date'],
          'received_date' => $contribution['Additional_Contribution_Details.Received_Date']
        ];
      }

    } catch (\Throwable $e) {
      error_log("[IMPORTING] Row " . ($index + 1) . ": Contact failed (" . get_class($e) . "): " . $e->getMessage());
      // Build full contact response
      $contactResponse = buildContactResponse(null, $contact, $index, 'Error');

      // Build contribution response if contribution exists
      $contributionResponse = null;
      if ($contribution) {
        $contributionResponse = [
          'total_amount' => $contribution['total_amount'] ?? "",
          'financial_type_id' => $contribution['financial_type_id'] ?? "",
          'financial_type' => $contribution['financial_type'] ?? "",
          'payment_instrument_id' => $contribution['payment_instrument_id'] ?? "",
          'receive_date' => $contribution['receive_date'] ?? "",
          'contribution_status_id' => $contribution['contribution_status_id'] ?? "",
          'trxn_id' => $contribution['trxn_id'] ?? "",
          'check_number' => $contribution['check_number'] ?? "",
          'source' => $contribution['source'] ?? "",
          'Additional_Contribution_Details.NRIC_FIN_UEN' => $contribution['Additional_Contribution_Details.NRIC_FIN_UEN'] ?? "",
          'Additional_Contribution_Details.Campaign' => $contribution['Additional_Contribution_Details.Campaign'] ?? "",
          'Additional_Contribution_Details.Imported_Date' => $contribution['Additional_Contribution_Details.Imported_Date'] ?? "",
          'Additional_Contribution_Details.Received_Date' => $contribution['Additional_Contribution_Details.Received_Date'] ?? "",
          'Additional_Contribution_Details.Payment_Platform' => $contribution['Additional_Contribution_Details.Payment_Platform'] ?? "",
          'Additional_Contribution_Details.Recurring_Donation' => $contribution['Additional_Contribution_Details.Recurring_Donation'] ?? "",
          'Additional_Contribution_Details.Remarks' => $contribution['Additional_Contribution_Details.Remarks'] ?? "",
          'Donation_In_Kind_Additional_Details.Items_donated' => $contribution['Donation_In_Kind_Additional_Details.Items_donated'] ?? "",
          'Donation_In_Kind_Additional_Details.Quantity' => $contribution['Donation_In_Kind_Additional_Details.Quantity'] ?? ""
        ];
      }

      // Add contribution to contact response
      $contactResponse['contribution'] = $contributionResponse;

      $errors[] = [
        'contact' => $contactResponse,
        'field' => 'general',
        'message' => 'Contact Import failed at row ' . ($index + 2) . ': ' . $e->getMessage() . '. Contribution is not imported for this contact.'
      ];
      error_log("[IMPORTING] Contact Import failed at row " . ($index + 2) . ": " . $e->getMessage() . ". Contribution is not imported for this contact.");
      $contactSuccess = false;
      continue;
    }
  }

  // Create contributions
  $importedContributions = [];

  if (!empty($contributionRecords)) {
    try {
      error_log("[IMPORTING] Bulk saving " . count($contributionRecords) . " contributions");
      $contributionResults = \Civi\Api4\Contribution::save(false)
        ->setRecords($contributionRecords)
        ->execute();

      foreach ($contributionResults as $idx => $contributionResult) {
        $contactId = $contactContributionMap[$idx]['contact_id'];
        $contributionId = $contributionResult['id'];
        error_log("[IMPORTING] Row " . $contactContributionMap[$idx]['row'] . ": Contribution ID " . $contributionId . " saved for contact ID " . $contactId . " (trxn_id: " . ($contactContributionMap[$idx]['trxn_id'] ?? 'none') . ", amount: " . $contributionResult['total_amount'] . ")");

        $importedContributions[] = [
          'contribution_id' => $contributionId,
          'contact_id' => $contactId,
          'name' => $contactContributionMap[$idx]['name'],
          'row' => $contactContributionMap[$idx]['row'],
          'financial_type' => $contactContributionMap[$idx]['financial_type'],
          'total_amount' => $contributionResult['total_amount'],
          'receive_date' => $contactContributionMap[$idx]['receive_date'],
          'source' => $contactContributionMap[$idx]['source'],
          'trxn_id' => $contactContributionMap[$idx]['trxn_id'],
          'campaign_name' => $contactContributionMap[$idx]['campaign_name'],
          'platform' => $contactContributionMap[$idx]['platform'],
          'frequency' => $contactContributionMap[$idx]['frequency'],
          'remarks' => $contactContributionMap[$idx]['remarks'],
          'imported_date' => $contactContributionMap[$idx]['imported_date'],
          'received_date' => $contactContributionMap[$idx]['received_date']
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

    } catch (\Throwable $e) {
      $errorMessage = $e->getMessage();
      error_log("[IMPORTING] Bulk contribution save failed (" . get_class($e) . "): " . $errorMessage);

      $actualBatchSize = count($contacts);
      $minRow = $batchNumber ? (($batchNumber - 1) * $batchSize) + 1 : null;
      $maxRow = $batchNumber ? $minRow + $actualBatchSize - 1 : null;

      if ($minRow !== null && $maxRow !== null) {
        $rowRange = ($minRow == $maxRow) ? "row $minRow" : "rows $minRow to $maxRow";
      } else {
        $rowRange = "unknown rows";
        $minRow = null;
        $maxRow = null;
      }

      $errors[] = [
        'row' => $minRow,
        'row_end' => $maxRow,
        'field' => 'contribution',
        'message' => "Contribution import failed for $rowRange. Error: $errorMessage"
      ];
    }
  }

  error_log("[IMPORTING] Import completed - New: " . count($newContacts) . ", Updated: " . count($updatedContacts) . ", Contributions: " . count($importedContributions) . ", Errors: " . count($errors));

  if (!empty($errors)) {
    saveImportErrorReport(
      $importRunId,
      $errors,
      $batchNumber,
      $batchSize,
      count($contacts),
      count($newContacts),
      count($updatedContacts),
      count($importedContributions),
      $user
    );
  }

  $response = [
    'importRunId' => $importRunId,
    'newContacts' => $newContacts,
    'updatedContacts' => $updatedContacts,
    'contributions' => $importedContributions,
    'numberOfErrors' => count($errors),
    'errors' => $errors
  ];

  echo json_encode($response);

} catch (\Throwable $e) {
  if (!empty($contacts)) {
    try {
      saveImportErrorReport(
        $importRunId ?: wp_generate_uuid4(),
        [[
          'field' => 'general',
          'message' => 'Fatal import error: ' . $e->getMessage()
        ]],
        $batchNumber,
        $batchSize,
        count($contacts),
        0,
        0,
        0,
        $user
      );
    } catch (\Throwable $storageError) {
      error_log("[IMPORTING] Failed to persist fatal error report: " . $storageError->getMessage());
    }
  }

  http_response_code(400);
  echo json_encode(['error' => $e->getMessage()]);
  error_log("[IMPORTING] Fatal error (" . get_class($e) . "): " . $e->getMessage());
}


function saveImportErrorReport($importRunId, array $errors, $batchNumber, $batchSize, $contactsInBatch, $newContactsCount, $updatedContactsCount, $contributionsCount, $user)
{
  if (empty($errors)) {
    return;
  }

  $normalizedErrors = array_map('normalizeImportErrorEntry', $errors);
  importing_error_reports_upsert_rows(
    $importRunId,
    $normalizedErrors,
    [
      'source' => 'import_runtime',
      'batch_number' => $batchNumber !== null ? (int) $batchNumber : null,
      'batch_size' => $batchSize !== null ? (int) $batchSize : null,
      'contacts_in_batch' => (int) $contactsInBatch,
      'new_contacts_count' => (int) $newContactsCount,
      'updated_contacts_count' => (int) $updatedContactsCount,
      'contributions_count' => (int) $contributionsCount,
      'total_records' => null,
      'valid_records' => null,
      'review_records' => null,
      'file_name' => null,
      'file_size' => null,
    ],
    $user
  );
}


function normalizeImportErrorEntry($error)
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
    'message' => isset($error['message']) ? (string) $error['message'] : 'Unknown import error',
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
        'imported_date' => $contribution['Additional_Contribution_Details.Imported_Date'] ?? ($contribution['imported_date'] ?? null),
        'received_date' => $contribution['Additional_Contribution_Details.Received_Date'] ?? ($contribution['received_date'] ?? null),
      ];
    }
  }

  return $normalized;
}


function resolveContactSubtype($contactType, array $candidates)
{
  try {
    $subTypes = CRM_Core_PseudoConstant::contactSubTypes($contactType);
  } catch (\Throwable $e) {
    return $candidates[0];
  }
  if (empty($subTypes)) {
    return $candidates[0];
  }
  $lookup = [];
  foreach (array_keys($subTypes) as $name) {
    $lower = strtolower($name);
    if (!isset($lookup[$lower])) {
      $lookup[$lower] = $name;
    }
  }
  foreach ($candidates as $candidate) {
    $lower = strtolower($candidate);
    if (isset($lookup[$lower])) {
      return $lookup[$lower];
    }
  }
  return $candidates[0];
}
function buildContactResponse($contactId, $contact, $index, $label)
{
  return [
    'contact_id' => $contactId,
    'label' => $label,
    'contact_type' => $contact['contact_type'],
    'prefix_id' => $contact['prefix_id'] ?? "",
    'name' => $contact['name'],
    'preferred_name' => $contact['preferred_name'] ?? "",
    'external_identifier' => $contact['external_identifier'] ?? "",
    'email_primary' => $contact['email_primary'] ?? "",
    'phone_primary' => $contact['phone_primary'] ?? "",
    'street_address' => $contact['street_address'] ?? "",
    'unit_floor_number' => $contact['unit_floor_number'] ?? "",
    'postal_code' => $contact['postal_code'] ?? "",
    'row' => $index + 1
  ];
}
?>