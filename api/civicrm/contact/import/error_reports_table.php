<?php

if (!defined('IMPORTING_ERROR_REPORTS_TABLE_NAME')) {
  define('IMPORTING_ERROR_REPORTS_TABLE_NAME', 'importing_error_reports');
}

if (!defined('IMPORTING_ERROR_REPORTS_MAX_ERRORS_PER_RUN')) {
  define('IMPORTING_ERROR_REPORTS_MAX_ERRORS_PER_RUN', 2000);
}

if (!defined('IMPORTING_ERROR_REPORTS_RETENTION_DAYS')) {
  define('IMPORTING_ERROR_REPORTS_RETENTION_DAYS', 30);
}

if (!defined('IMPORTING_ERROR_REPORTS_SINGAPORE_TIMEZONE')) {
  define('IMPORTING_ERROR_REPORTS_SINGAPORE_TIMEZONE', 'Asia/Singapore');
}

if (!defined('IMPORTING_ERROR_REPORTS_DAILY_CLEANUP_HOOK')) {
  define('IMPORTING_ERROR_REPORTS_DAILY_CLEANUP_HOOK', 'importing_error_reports_daily_cleanup');
}

if (!defined('IMPORTING_ERROR_REPORTS_REQUIRED_CAPABILITY')) {
  define('IMPORTING_ERROR_REPORTS_REQUIRED_CAPABILITY', 'read');
}


function importing_error_reports_table_name()
{
  return IMPORTING_ERROR_REPORTS_TABLE_NAME;
}


function importing_error_reports_ensure_table()
{
  static $ensured = false;

  if ($ensured) {
    return;
  }
  $ensured = true;

  global $wpdb;

  $table = importing_error_reports_table_name();
  $charsetCollate = $wpdb->get_charset_collate();

  $sql = "CREATE TABLE IF NOT EXISTS `{$table}` (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    import_run_id VARCHAR(100) NOT NULL,
    linked_run_id VARCHAR(100) NULL,
    source VARCHAR(64) NULL,
    total_records INT NULL,
    valid_records INT NULL,
    review_records INT NULL,
    file_name VARCHAR(255) NULL,
    file_size VARCHAR(64) NULL,
    contacts_processed INT NOT NULL DEFAULT 0,
    new_contacts_count INT NOT NULL DEFAULT 0,
    updated_contacts_count INT NOT NULL DEFAULT 0,
    contributions_count INT NOT NULL DEFAULT 0,
    errors_count INT NOT NULL DEFAULT 0,
    batches_json LONGTEXT NULL,
    errors_json LONGTEXT NULL,
    errors_truncated TINYINT(1) NOT NULL DEFAULT 0,
    saved_by_user_id BIGINT NULL,
    saved_by_user_login VARCHAR(191) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_import_run (import_run_id),
    KEY idx_linked_run (linked_run_id),
    KEY idx_updated_at (updated_at)
  ) {$charsetCollate}";

  $wpdb->query($sql);

  $columns = $wpdb->get_col("SHOW COLUMNS FROM `{$table}`", 0);
  if (!is_array($columns)) {
    return;
  }

  $requiredColumns = [
    'linked_run_id' => "ALTER TABLE `{$table}` ADD COLUMN linked_run_id VARCHAR(100) NULL AFTER import_run_id",
    'source' => "ALTER TABLE `{$table}` ADD COLUMN source VARCHAR(64) NULL AFTER linked_run_id",
    'total_records' => "ALTER TABLE `{$table}` ADD COLUMN total_records INT NULL AFTER source",
    'valid_records' => "ALTER TABLE `{$table}` ADD COLUMN valid_records INT NULL AFTER total_records",
    'review_records' => "ALTER TABLE `{$table}` ADD COLUMN review_records INT NULL AFTER valid_records",
    'file_name' => "ALTER TABLE `{$table}` ADD COLUMN file_name VARCHAR(255) NULL AFTER review_records",
    'file_size' => "ALTER TABLE `{$table}` ADD COLUMN file_size VARCHAR(64) NULL AFTER file_name",
    'contacts_processed' => "ALTER TABLE `{$table}` ADD COLUMN contacts_processed INT NOT NULL DEFAULT 0 AFTER file_size",
    'new_contacts_count' => "ALTER TABLE `{$table}` ADD COLUMN new_contacts_count INT NOT NULL DEFAULT 0 AFTER contacts_processed",
    'updated_contacts_count' => "ALTER TABLE `{$table}` ADD COLUMN updated_contacts_count INT NOT NULL DEFAULT 0 AFTER new_contacts_count",
    'contributions_count' => "ALTER TABLE `{$table}` ADD COLUMN contributions_count INT NOT NULL DEFAULT 0 AFTER updated_contacts_count",
    'errors_count' => "ALTER TABLE `{$table}` ADD COLUMN errors_count INT NOT NULL DEFAULT 0 AFTER contributions_count",
    'batches_json' => "ALTER TABLE `{$table}` ADD COLUMN batches_json LONGTEXT NULL AFTER errors_count",
    'errors_json' => "ALTER TABLE `{$table}` ADD COLUMN errors_json LONGTEXT NULL AFTER batches_json",
    'errors_truncated' => "ALTER TABLE `{$table}` ADD COLUMN errors_truncated TINYINT(1) NOT NULL DEFAULT 0 AFTER errors_json",
    'saved_by_user_id' => "ALTER TABLE `{$table}` ADD COLUMN saved_by_user_id BIGINT NULL AFTER errors_truncated",
    'saved_by_user_login' => "ALTER TABLE `{$table}` ADD COLUMN saved_by_user_login VARCHAR(191) NULL AFTER saved_by_user_id",
    'created_at' => "ALTER TABLE `{$table}` ADD COLUMN created_at DATETIME NULL AFTER saved_by_user_login",
    'updated_at' => "ALTER TABLE `{$table}` ADD COLUMN updated_at DATETIME NULL AFTER created_at",
  ];

  foreach ($requiredColumns as $column => $alterSql) {
    if (!in_array($column, $columns, true)) {
      $wpdb->query($alterSql);
    }
  }

  $indexes = $wpdb->get_results("SHOW INDEX FROM `{$table}`", ARRAY_A);
  $hasImportRunIndex = false;
  $hasUniqueImportRunIndex = false;
  $hasLinkedRunIndex = false;
  $hasUpdatedAtIndex = false;

  if (is_array($indexes)) {
    foreach ($indexes as $index) {
      if (($index['Key_name'] ?? '') === 'idx_import_run') {
        $hasImportRunIndex = true;
      }
      if (($index['Column_name'] ?? '') === 'import_run_id' && (int) ($index['Non_unique'] ?? 1) === 0) {
        $hasUniqueImportRunIndex = true;
      }
      if (($index['Key_name'] ?? '') === 'idx_linked_run') {
        $hasLinkedRunIndex = true;
      }
      if (($index['Key_name'] ?? '') === 'idx_updated_at') {
        $hasUpdatedAtIndex = true;
      }
    }
  }

  if (!$hasImportRunIndex) {
    $wpdb->query("ALTER TABLE `{$table}` ADD INDEX idx_import_run (import_run_id)");
  }
  if (!$hasLinkedRunIndex) {
    $wpdb->query("ALTER TABLE `{$table}` ADD INDEX idx_linked_run (linked_run_id)");
  }
  if (!$hasUpdatedAtIndex) {
    $wpdb->query("ALTER TABLE `{$table}` ADD INDEX idx_updated_at (updated_at)");
  }

  importing_error_reports_compact_duplicate_runs($table);

  if (!$hasUniqueImportRunIndex) {
    $duplicates = (int) $wpdb->get_var(
      "SELECT COUNT(*) FROM (
        SELECT import_run_id
        FROM `{$table}`
        GROUP BY import_run_id
        HAVING COUNT(*) > 1
      ) duplicate_runs"
    );

    if ($duplicates === 0) {
      $wpdb->query("ALTER TABLE `{$table}` ADD UNIQUE KEY uniq_import_run_id (import_run_id)");
    }
  }
}


function importing_error_reports_compact_duplicate_runs($table)
{
  global $wpdb;

  for ($pass = 0; $pass < 100; $pass++) {
    $duplicateRunIds = $wpdb->get_col(
      "SELECT import_run_id
      FROM `{$table}`
      GROUP BY import_run_id
      HAVING COUNT(*) > 1
      LIMIT 50"
    );

    if (empty($duplicateRunIds)) {
      return;
    }

    foreach ($duplicateRunIds as $runId) {
      $runId = sanitize_text_field((string) $runId);
      if ($runId === '') {
        continue;
      }

      $rows = importing_error_reports_load_rows_by_run_id($runId);
      if (count($rows) <= 1) {
        continue;
      }

      $report = importing_error_reports_rows_to_report($rows);
      if ($report === null) {
        continue;
      }

      $primaryId = (int) ($rows[0]['id'] ?? 0);
      if ($primaryId <= 0) {
        continue;
      }

      $createdAtDb = importing_error_reports_pick_created_at_db($rows);
      $nowDb = gmdate('Y-m-d H:i:s');

      $data = [
        'import_run_id' => $runId,
        'linked_run_id' => importing_error_reports_nullable_string($report['linked_run_id'] ?? null, 100),
        'source' => importing_error_reports_nullable_string($report['source'] ?? null, 64),
        'total_records' => importing_error_reports_nullable_int($report['summary']['total_records'] ?? null),
        'valid_records' => importing_error_reports_nullable_int($report['summary']['valid_records'] ?? null),
        'review_records' => importing_error_reports_nullable_int($report['summary']['review_records'] ?? null),
        'file_name' => importing_error_reports_nullable_string($report['summary']['file_name'] ?? null, 255),
        'file_size' => importing_error_reports_nullable_string($report['summary']['file_size'] ?? null, 64),
        'contacts_processed' => (int) ($report['totals']['contacts_processed'] ?? 0),
        'new_contacts_count' => (int) ($report['totals']['new_contacts'] ?? 0),
        'updated_contacts_count' => (int) ($report['totals']['updated_contacts'] ?? 0),
        'contributions_count' => (int) ($report['totals']['contributions'] ?? 0),
        'errors_count' => (int) count($report['errors'] ?? []),
        'batches_json' => wp_json_encode($report['batches'] ?? []),
        'errors_json' => wp_json_encode($report['errors'] ?? []),
        'errors_truncated' => !empty($report['errors_truncated']) ? 1 : 0,
        'saved_by_user_id' => importing_error_reports_nullable_int($report['saved_by']['user_id'] ?? null),
        'saved_by_user_login' => importing_error_reports_nullable_string($report['saved_by']['user_login'] ?? null, 191),
        'created_at' => $createdAtDb,
        'updated_at' => $nowDb,
      ];

      $wpdb->update($table, $data, ['id' => $primaryId]);
      $wpdb->query(
        $wpdb->prepare(
          "DELETE FROM `{$table}` WHERE import_run_id = %s AND id <> %d",
          $runId,
          $primaryId
        )
      );
    }
  }
}


function importing_error_reports_upsert_rows($importRunId, array $errors, array $context, $user)
{
  if (empty($errors)) {
    return 0;
  }

  importing_error_reports_ensure_table();

  global $wpdb;

  $table = importing_error_reports_table_name();
  $importRunId = sanitize_text_field((string) $importRunId);
  if ($importRunId === '') {
    return 0;
  }

  $rows = importing_error_reports_load_rows_by_run_id($importRunId);
  $report = !empty($rows)
    ? importing_error_reports_rows_to_report($rows)
    : importing_error_reports_empty_report($importRunId);

  $source = isset($context['source']) ? sanitize_key((string) $context['source']) : null;
  if (empty($source)) {
    $source = !empty($report['source']) ? (string) $report['source'] : 'import_runtime';
  }

  $linkedRunId = importing_error_reports_nullable_string($context['linked_run_id'] ?? null, 100);
  if ($linkedRunId === null) {
    $existingLinkedRunId = importing_error_reports_nullable_string($report['linked_run_id'] ?? null, 100);
    $linkedRunId = $existingLinkedRunId !== null ? $existingLinkedRunId : $importRunId;
  }

  $seen = [];
  foreach ($report['errors'] as $existingError) {
    $key = importing_error_reports_build_fingerprint(
      $importRunId,
      $existingError['row'] ?? null,
      $existingError['row_end'] ?? null,
      $existingError['field'] ?? 'general',
      $existingError['message'] ?? '',
      $existingError['contact'] ?? null
    );
    $seen[$key] = true;
  }

  $addedErrors = 0;
  foreach ($errors as $error) {
    $normalizedError = importing_error_reports_normalize_error($error);
    if (empty($normalizedError['message'])) {
      continue;
    }

    $key = importing_error_reports_build_fingerprint(
      $importRunId,
      $normalizedError['row'],
      $normalizedError['row_end'],
      $normalizedError['field'],
      $normalizedError['message'],
      $normalizedError['contact'] ?? null
    );

    if (isset($seen[$key])) {
      continue;
    }

    $seen[$key] = true;
    $report['errors'][] = $normalizedError;
    $addedErrors++;
  }

  $isTruncated = !empty($report['errors_truncated']);
  if (count($report['errors']) > IMPORTING_ERROR_REPORTS_MAX_ERRORS_PER_RUN) {
    $report['errors'] = array_slice($report['errors'], 0, IMPORTING_ERROR_REPORTS_MAX_ERRORS_PER_RUN);
    $isTruncated = true;
  }
  $report['errors_truncated'] = $isTruncated;

  if (!isset($report['batches']) || !is_array($report['batches'])) {
    $report['batches'] = [];
  }

  $report['batches'][] = [
    'batch_number' => importing_error_reports_nullable_int($context['batch_number'] ?? null),
    'batch_size' => importing_error_reports_nullable_int($context['batch_size'] ?? null),
    'contacts_in_batch' => (int) ($context['contacts_in_batch'] ?? 0),
    'errors_in_batch' => $addedErrors,
    'saved_at' => gmdate('c'),
  ];

  $report['summary'] = importing_error_reports_merge_summary($report['summary'], $context);
  $report['totals'] = importing_error_reports_merge_totals($report['totals'], $context, count($report['errors']));

  $report['source'] = $source;
  $report['linked_run_id'] = $linkedRunId;
  $report['saved_by'] = [
    'user_id' => (int) ($user->ID ?? 0),
    'user_login' => (string) ($user->user_login ?? ''),
  ];

  $nowDb = gmdate('Y-m-d H:i:s');
  $createdAtDb = !empty($rows) ? importing_error_reports_pick_created_at_db($rows) : $nowDb;

  $data = [
    'import_run_id' => $importRunId,
    'linked_run_id' => importing_error_reports_nullable_string($report['linked_run_id'] ?? null, 100),
    'source' => $report['source'],
    'total_records' => importing_error_reports_nullable_int($report['summary']['total_records'] ?? null),
    'valid_records' => importing_error_reports_nullable_int($report['summary']['valid_records'] ?? null),
    'review_records' => importing_error_reports_nullable_int($report['summary']['review_records'] ?? null),
    'file_name' => importing_error_reports_nullable_string($report['summary']['file_name'] ?? null, 255),
    'file_size' => importing_error_reports_nullable_string($report['summary']['file_size'] ?? null, 64),
    'contacts_processed' => (int) ($report['totals']['contacts_processed'] ?? 0),
    'new_contacts_count' => (int) ($report['totals']['new_contacts'] ?? 0),
    'updated_contacts_count' => (int) ($report['totals']['updated_contacts'] ?? 0),
    'contributions_count' => (int) ($report['totals']['contributions'] ?? 0),
    'errors_count' => (int) count($report['errors']),
    'batches_json' => wp_json_encode($report['batches']),
    'errors_json' => wp_json_encode($report['errors']),
    'errors_truncated' => !empty($report['errors_truncated']) ? 1 : 0,
    'saved_by_user_id' => importing_error_reports_nullable_int($report['saved_by']['user_id'] ?? null),
    'saved_by_user_login' => importing_error_reports_nullable_string($report['saved_by']['user_login'] ?? null, 191),
    'created_at' => $createdAtDb,
    'updated_at' => $nowDb,
  ];

  $rowId = 0;
  if (!empty($rows)) {
    $rowId = (int) $rows[0]['id'];
    $wpdb->update($table, $data, ['id' => $rowId]);
  } else {
    $wpdb->insert($table, $data);
    $rowId = (int) $wpdb->insert_id;
  }

  if ($rowId > 0) {
    $wpdb->query(
      $wpdb->prepare(
        "DELETE FROM `{$table}` WHERE import_run_id = %s AND id <> %d",
        $importRunId,
        $rowId
      )
    );
  }

  return $addedErrors;
}


function importing_error_reports_fetch_reports($limit = 50)
{
  importing_error_reports_ensure_table();

  global $wpdb;

  $table = importing_error_reports_table_name();
  $limit = max(1, min(100, (int) $limit));
  $cutoffDb = importing_error_reports_cutoff_db_datetime();

  $rows = $wpdb->get_results(
    $wpdb->prepare(
      "SELECT import_run_id, linked_run_id, source, errors_count, updated_at
      FROM `{$table}`
      WHERE created_at >= %s
      ORDER BY updated_at DESC, id DESC
      LIMIT %d",
      $cutoffDb,
      $limit
    ),
    ARRAY_A
  );

  if (empty($rows)) {
    return [];
  }

  $reports = [];
  $seenRunIds = [];
  foreach ($rows as $row) {
    $runId = isset($row['import_run_id']) ? (string) $row['import_run_id'] : '';
    if ($runId === '' || isset($seenRunIds[$runId])) {
      continue;
    }

    $linkedRunId = importing_error_reports_nullable_string($row['linked_run_id'] ?? null, 100);
    if ($linkedRunId === null) {
      $linkedRunId = $runId;
    }

    $seenRunIds[$runId] = true;
    $reports[] = [
      'import_run_id' => $runId,
      'linked_run_id' => $linkedRunId,
      'updated_at' => importing_error_reports_db_to_iso($row['updated_at'] ?? null),
      'source' => !empty($row['source']) ? (string) $row['source'] : 'import_runtime',
      'totals' => [
        'errors' => max(0, (int) ($row['errors_count'] ?? 0)),
      ],
    ];
  }

  return $reports;
}


function importing_error_reports_required_capability()
{
  $capability = IMPORTING_ERROR_REPORTS_REQUIRED_CAPABILITY;

  if (function_exists('apply_filters')) {
    $capability = apply_filters('importing_error_reports_required_capability', $capability);
  }

  return is_string($capability) ? $capability : '';
}


function importing_error_reports_user_can_access()
{
  $requiredCapability = importing_error_reports_required_capability();

  if ($requiredCapability === '') {
    return true;
  }

  return current_user_can($requiredCapability);
}


function importing_error_reports_fetch_report_by_run_id($runId)
{
  importing_error_reports_ensure_table();

  $runId = sanitize_text_field((string) $runId);
  if ($runId === '') {
    return null;
  }

  $rows = importing_error_reports_load_rows_by_run_id($runId, true);
  if (empty($rows)) {
    return null;
  }

  return importing_error_reports_rows_to_report($rows);
}


function importing_error_reports_load_rows_by_run_id($runId, $recentOnly = false)
{
  global $wpdb;

  $table = importing_error_reports_table_name();

  if ($recentOnly) {
    $cutoffDb = importing_error_reports_cutoff_db_datetime();

    return $wpdb->get_results(
      $wpdb->prepare(
        "SELECT *
        FROM `{$table}`
        WHERE import_run_id = %s
        AND created_at >= %s
        ORDER BY updated_at DESC, id DESC",
        $runId,
        $cutoffDb
      ),
      ARRAY_A
    );
  }

  return $wpdb->get_results(
    $wpdb->prepare(
      "SELECT * FROM `{$table}` WHERE import_run_id = %s ORDER BY updated_at DESC, id DESC",
      $runId
    ),
    ARRAY_A
  );
}


function importing_error_reports_rows_to_report(array $rows)
{
  if (empty($rows)) {
    return null;
  }

  $runId = (string) ($rows[0]['import_run_id'] ?? '');
  $report = importing_error_reports_empty_report($runId);

  $minCreated = null;
  $maxUpdated = null;

  $errorSeen = [];
  $batchSeen = [];

  foreach ($rows as $row) {
    $createdAt = isset($row['created_at']) ? (string) $row['created_at'] : '';
    $updatedAt = isset($row['updated_at']) ? (string) $row['updated_at'] : '';

    if ($minCreated === null || ($createdAt !== '' && $createdAt < $minCreated)) {
      $minCreated = $createdAt;
    }
    if ($maxUpdated === null || ($updatedAt !== '' && $updatedAt > $maxUpdated)) {
      $maxUpdated = $updatedAt;
      $report['source'] = !empty($row['source']) ? (string) $row['source'] : $report['source'];
      $rowLinkedRunId = importing_error_reports_nullable_string($row['linked_run_id'] ?? null, 100);
      $report['linked_run_id'] = $rowLinkedRunId !== null ? $rowLinkedRunId : $runId;
      $report['saved_by'] = [
        'user_id' => (int) ($row['saved_by_user_id'] ?? 0),
        'user_login' => (string) ($row['saved_by_user_login'] ?? ''),
      ];
    }

    $report['summary'] = importing_error_reports_merge_summary_from_row($report['summary'], $row);

    $rowErrors = importing_error_reports_row_to_errors($row);
    foreach ($rowErrors as $rowError) {
      $fingerprint = importing_error_reports_build_fingerprint(
        $runId,
        $rowError['row'],
        $rowError['row_end'],
        $rowError['field'],
        $rowError['message'],
        $rowError['contact'] ?? null
      );

      if (isset($errorSeen[$fingerprint])) {
        continue;
      }

      $errorSeen[$fingerprint] = true;
      $report['errors'][] = $rowError;
    }

    $rowBatches = importing_error_reports_row_to_batches($row, count($rowErrors));
    foreach ($rowBatches as $rowBatch) {
      $batchKey = md5(wp_json_encode($rowBatch));
      if (isset($batchSeen[$batchKey])) {
        continue;
      }
      $batchSeen[$batchKey] = true;
      $report['batches'][] = $rowBatch;
    }

    if (!empty($row['errors_truncated'])) {
      $report['errors_truncated'] = true;
    }

    $report['totals']['contacts_processed'] = max(
      (int) $report['totals']['contacts_processed'],
      (int) ($row['contacts_processed'] ?? 0),
      (int) ($row['contacts_in_batch'] ?? 0),
      (int) ($row['total_records'] ?? 0)
    );

    $report['totals']['new_contacts'] = max(
      (int) $report['totals']['new_contacts'],
      (int) ($row['new_contacts_count'] ?? 0)
    );

    $report['totals']['updated_contacts'] = max(
      (int) $report['totals']['updated_contacts'],
      (int) ($row['updated_contacts_count'] ?? 0)
    );

    $report['totals']['contributions'] = max(
      (int) $report['totals']['contributions'],
      (int) ($row['contributions_count'] ?? 0)
    );
  }

  if (count($report['errors']) > IMPORTING_ERROR_REPORTS_MAX_ERRORS_PER_RUN) {
    $report['errors'] = array_slice($report['errors'], 0, IMPORTING_ERROR_REPORTS_MAX_ERRORS_PER_RUN);
    $report['errors_truncated'] = true;
  }

  $report['totals']['errors'] = count($report['errors']);

  usort($report['batches'], static function ($a, $b) {
    return strcmp((string) ($b['saved_at'] ?? ''), (string) ($a['saved_at'] ?? ''));
  });

  $report['created_at'] = importing_error_reports_db_to_iso($minCreated);
  $report['updated_at'] = importing_error_reports_db_to_iso($maxUpdated);

  return $report;
}


function importing_error_reports_empty_report($importRunId)
{
  return [
    'import_run_id' => (string) $importRunId,
    'linked_run_id' => (string) $importRunId,
    'created_at' => '',
    'updated_at' => '',
    'source' => 'import_runtime',
    'summary' => [
      'total_records' => null,
      'valid_records' => null,
      'review_records' => null,
      'file_name' => null,
      'file_size' => null,
    ],
    'saved_by' => [
      'user_id' => 0,
      'user_login' => '',
    ],
    'totals' => [
      'contacts_processed' => 0,
      'new_contacts' => 0,
      'updated_contacts' => 0,
      'contributions' => 0,
      'errors' => 0,
    ],
    'batches' => [],
    'errors' => [],
    'errors_truncated' => false,
  ];
}


function importing_error_reports_row_to_errors($row)
{
  $errors = [];

  if (!empty($row['errors_json'])) {
    $decodedErrors = json_decode((string) $row['errors_json'], true);
    if (is_array($decodedErrors)) {
      foreach ($decodedErrors as $decodedError) {
        $normalized = importing_error_reports_normalize_error($decodedError);
        if (!empty($normalized['message'])) {
          $errors[] = $normalized;
        }
      }
      return $errors;
    }
  }

  $legacyMessage = isset($row['message']) ? trim((string) $row['message']) : '';
  if ($legacyMessage !== '') {
    $legacyError = [
      'row' => importing_error_reports_nullable_int($row['row_start'] ?? null),
      'row_end' => importing_error_reports_nullable_int($row['row_end'] ?? null),
      'field' => isset($row['field_name']) ? (string) $row['field_name'] : 'general',
      'message' => $legacyMessage,
    ];

    if (!empty($row['contact_json'])) {
      $decodedContact = json_decode((string) $row['contact_json'], true);
      if (is_array($decodedContact)) {
        $legacyError['contact'] = $decodedContact;
      }
    }

    $errors[] = importing_error_reports_normalize_error($legacyError);
  }

  return $errors;
}


function importing_error_reports_row_to_batches($row, $fallbackErrorCount)
{
  if (!empty($row['batches_json'])) {
    $decodedBatches = json_decode((string) $row['batches_json'], true);
    if (is_array($decodedBatches)) {
      $batches = [];
      foreach ($decodedBatches as $batch) {
        if (!is_array($batch)) {
          continue;
        }
        $batches[] = [
          'batch_number' => importing_error_reports_nullable_int($batch['batch_number'] ?? null),
          'batch_size' => importing_error_reports_nullable_int($batch['batch_size'] ?? null),
          'contacts_in_batch' => (int) ($batch['contacts_in_batch'] ?? 0),
          'errors_in_batch' => (int) ($batch['errors_in_batch'] ?? 0),
          'saved_at' => isset($batch['saved_at']) ? (string) $batch['saved_at'] : '',
        ];
      }

      if (!empty($batches)) {
        return $batches;
      }
    }
  }

  return [[
    'batch_number' => importing_error_reports_nullable_int($row['batch_number'] ?? null),
    'batch_size' => importing_error_reports_nullable_int($row['batch_size'] ?? null),
    'contacts_in_batch' => (int) ($row['contacts_in_batch'] ?? 0),
    'errors_in_batch' => (int) $fallbackErrorCount,
    'saved_at' => importing_error_reports_db_to_iso($row['updated_at'] ?? null),
  ]];
}


function importing_error_reports_merge_summary(array $currentSummary, array $context)
{
  $nextSummary = $currentSummary;

  if (array_key_exists('total_records', $context) && $context['total_records'] !== null) {
    $nextSummary['total_records'] = (int) $context['total_records'];
  }
  if (array_key_exists('valid_records', $context) && $context['valid_records'] !== null) {
    $nextSummary['valid_records'] = (int) $context['valid_records'];
  }
  if (array_key_exists('review_records', $context) && $context['review_records'] !== null) {
    $nextSummary['review_records'] = (int) $context['review_records'];
  }
  if (array_key_exists('file_name', $context) && importing_error_reports_nullable_string($context['file_name'], 255) !== null) {
    $nextSummary['file_name'] = importing_error_reports_nullable_string($context['file_name'], 255);
  }
  if (array_key_exists('file_size', $context) && importing_error_reports_nullable_string($context['file_size'], 64) !== null) {
    $nextSummary['file_size'] = importing_error_reports_nullable_string($context['file_size'], 64);
  }

  return $nextSummary;
}


function importing_error_reports_merge_summary_from_row(array $currentSummary, $row)
{
  $nextSummary = $currentSummary;

  if ($nextSummary['total_records'] === null && isset($row['total_records']) && $row['total_records'] !== null && $row['total_records'] !== '') {
    $nextSummary['total_records'] = (int) $row['total_records'];
  }
  if ($nextSummary['valid_records'] === null && isset($row['valid_records']) && $row['valid_records'] !== null && $row['valid_records'] !== '') {
    $nextSummary['valid_records'] = (int) $row['valid_records'];
  }
  if ($nextSummary['review_records'] === null && isset($row['review_records']) && $row['review_records'] !== null && $row['review_records'] !== '') {
    $nextSummary['review_records'] = (int) $row['review_records'];
  }
  if ($nextSummary['file_name'] === null && importing_error_reports_nullable_string($row['file_name'] ?? null, 255) !== null) {
    $nextSummary['file_name'] = importing_error_reports_nullable_string($row['file_name'] ?? null, 255);
  }
  if ($nextSummary['file_size'] === null && importing_error_reports_nullable_string($row['file_size'] ?? null, 64) !== null) {
    $nextSummary['file_size'] = importing_error_reports_nullable_string($row['file_size'] ?? null, 64);
  }

  return $nextSummary;
}


function importing_error_reports_merge_totals(array $currentTotals, array $context, $errorCount)
{
  $nextTotals = $currentTotals;

  if (array_key_exists('total_records', $context) && $context['total_records'] !== null) {
    $nextTotals['contacts_processed'] = max((int) $nextTotals['contacts_processed'], (int) $context['total_records']);
  } else {
    $nextTotals['contacts_processed'] = (int) $nextTotals['contacts_processed'] + (int) ($context['contacts_in_batch'] ?? 0);
  }

  $nextTotals['new_contacts'] = (int) $nextTotals['new_contacts'] + (int) ($context['new_contacts_count'] ?? 0);
  $nextTotals['updated_contacts'] = (int) $nextTotals['updated_contacts'] + (int) ($context['updated_contacts_count'] ?? 0);
  $nextTotals['contributions'] = (int) $nextTotals['contributions'] + (int) ($context['contributions_count'] ?? 0);
  $nextTotals['errors'] = (int) $errorCount;

  return $nextTotals;
}


function importing_error_reports_normalize_error($error)
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
    'row' => importing_error_reports_nullable_int($error['row'] ?? null),
    'row_end' => importing_error_reports_nullable_int($error['row_end'] ?? null),
    'field' => isset($error['field']) ? sanitize_text_field((string) $error['field']) : 'general',
    'message' => isset($error['message']) ? trim((string) $error['message']) : '',
  ];

  if (isset($error['contact']) && is_array($error['contact'])) {
    $normalized['contact'] = $error['contact'];
  }

  return $normalized;
}


function importing_error_reports_build_fingerprint($importRunId, $rowStart, $rowEnd, $field, $message, $contact)
{
  $contribution = is_array($contact) && isset($contact['contribution']) && is_array($contact['contribution'])
    ? $contact['contribution']
    : [];

  $payload = [
    'import_run_id' => (string) $importRunId,
    'row' => importing_error_reports_nullable_int($rowStart),
    'row_end' => importing_error_reports_nullable_int($rowEnd),
    'field' => (string) $field,
    'message' => (string) $message,
    'contact_id' => is_array($contact) ? ($contact['contact_id'] ?? null) : null,
    'contact_row' => is_array($contact) ? ($contact['row'] ?? null) : null,
    'external_identifier' => is_array($contact) ? ($contact['external_identifier'] ?? null) : null,
    'trxn_id' => $contribution['trxn_id'] ?? null,
  ];

  return md5(wp_json_encode($payload));
}


function importing_error_reports_db_to_iso($datetime)
{
  if ($datetime === null || $datetime === '') {
    return '';
  }

  $timestamp = strtotime((string) $datetime);
  if ($timestamp === false) {
    return (string) $datetime;
  }

  return gmdate('c', $timestamp);
}


function importing_error_reports_run_request_cleanup()
{
  static $didRun = false;

  if ($didRun) {
    return;
  }
  $didRun = true;

  importing_error_reports_unschedule_legacy_daily_cleanup();

  global $wpdb;
  if (!isset($wpdb)) {
    return;
  }

  $table = importing_error_reports_table_name();
  $tableExists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
  if ($tableExists !== $table) {
    return;
  }

  importing_error_reports_delete_expired_rows();
}


function importing_error_reports_unschedule_legacy_daily_cleanup()
{
  if (!function_exists('wp_next_scheduled') || !function_exists('wp_unschedule_event')) {
    return;
  }

  $hook = IMPORTING_ERROR_REPORTS_DAILY_CLEANUP_HOOK;
  for ($attempt = 0; $attempt < 5; $attempt++) {
    $nextScheduled = wp_next_scheduled($hook);
    if ($nextScheduled === false) {
      break;
    }

    wp_unschedule_event((int) $nextScheduled, $hook);
  }
}


function importing_error_reports_cutoff_db_datetime()
{
  $retentionDays = max(1, (int) IMPORTING_ERROR_REPORTS_RETENTION_DAYS);

  $sgTimezone = new DateTimeZone(IMPORTING_ERROR_REPORTS_SINGAPORE_TIMEZONE);
  $utcTimezone = new DateTimeZone('UTC');

  $nowSg = new DateTimeImmutable('now', $sgTimezone);
  $cutoffSg = $nowSg->modify("-{$retentionDays} days");

  return $cutoffSg->setTimezone($utcTimezone)->format('Y-m-d H:i:s');
}


function importing_error_reports_delete_expired_rows()
{
  global $wpdb;

  $table = importing_error_reports_table_name();
  $cutoffDb = importing_error_reports_cutoff_db_datetime();

  $wpdb->query(
    $wpdb->prepare(
      "DELETE FROM `{$table}`
      WHERE created_at IS NOT NULL
      AND created_at < %s",
      $cutoffDb
    )
  );
}


function importing_error_reports_pick_created_at_db(array $rows)
{
  $earliest = null;

  foreach ($rows as $row) {
    $createdAt = isset($row['created_at']) ? trim((string) $row['created_at']) : '';
    if ($createdAt === '') {
      continue;
    }

    if ($earliest === null || $createdAt < $earliest) {
      $earliest = $createdAt;
    }
  }

  if ($earliest === null) {
    return gmdate('Y-m-d H:i:s');
  }

  return $earliest;
}


function importing_error_reports_nullable_int($value)
{
  if ($value === null || $value === '' || $value === false) {
    return null;
  }

  return (int) $value;
}


function importing_error_reports_nullable_string($value, $maxLen)
{
  if ($value === null) {
    return null;
  }

  $string = trim((string) $value);
  if ($string === '') {
    return null;
  }

  if (strlen($string) > $maxLen) {
    return substr($string, 0, $maxLen);
  }

  return $string;
}
