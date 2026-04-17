export interface ImportContact {
  id?: number;
  label?: string;
  contact_type: string;
  prefix_id?: number | null;
  name: string;
  preferred_name?: string;
  external_identifier: string;
  email_primary: string;
  phone_primary: string;
  street_address: string;
  unit_floor_number: string;
  postal_code: string;
  contribution: Contribution;
  errors?: ValidationError[];
  import_error?: ValidationError
}

export interface Contribution {
  contribution_id?: number | null;
  contact_id?: number | null;
  name?: string;
  financial_type: string;
  financial_type_id: number | null;
  contribution_status_id: number;
  total_amount: number;
  source?: string;
  receive_date: string;
  payment_instrument_id: number | null;
  trxn_id: string;
  check_number?: string;
  "Additional_Contribution_Details.NRIC_FIN_UEN": string | null;
  "Additional_Contribution_Details.Campaign": number | null;
  "Additional_Contribution_Details.Payment_Platform": number | null;
  "Additional_Contribution_Details.Recurring_Donation": number | null;
  "Additional_Contribution_Details.Remarks": string;
  "Additional_Contribution_Details.Imported_Date": string;
  "Additional_Contribution_Details.Received_Date": string;
  "Donation_In_Kind_Additional_Details.Items_donated": string;
  "Donation_In_Kind_Additional_Details.Quantity": number | null;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  // contact?: ImportContact;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ImportSummary {
  totalRecords: number;
  validRecords: number;
  reviewRecords: number;
  fileName: string;
  fileSize: string;
}

export interface ImportResults {
  totalRecords: number;
  newContacts: any[];
  updatedContacts: any[];
  contributions: any[];
  numberOfErrors: number;
  errors: any[];
}

export interface APIImportErrorReportUser {
  user_id: number;
  user_login: string;
}

export interface APIImportErrorReportTotals {
  contacts_processed: number;
  new_contacts: number;
  updated_contacts: number;
  contributions: number;
  errors: number;
}

export interface APIImportErrorReportListItem {
  import_run_id: string;
  linked_run_id: string;
  updated_at: string;
  source: string;
  totals: {
    errors: number;
  };
}

export interface APIImportErrorReportSummary {
  total_records: number | null;
  valid_records: number | null;
  review_records: number | null;
  file_name: string | null;
  file_size: string | null;
}

export interface APIImportErrorReportBatch {
  batch_number: number | null;
  batch_size: number | null;
  contacts_in_batch: number;
  errors_in_batch: number;
  saved_at: string;
}

export interface APIImportErrorReportContactContribution {
  trxn_id?: string | null;
  total_amount?: number | string | null;
  receive_date?: string | null;
  financial_type?: string | null;
  imported_date?: string | null;
  received_date?: string | null;
}

export interface APIImportErrorReportContact {
  contact_id?: number | null;
  row?: number | null;
  label?: string | null;
  name?: string | null;
  contact_type?: string | null;
  external_identifier?: string | null;
  email_primary?: string | null;
  phone_primary?: string | null;
  contribution?: APIImportErrorReportContactContribution;
}

export interface APIImportErrorReportError {
  row: number | null;
  row_end: number | null;
  field: string;
  message: string;
  contact?: APIImportErrorReportContact;
}

export interface APIImportErrorReport {
  import_run_id: string;
  linked_run_id: string;
  created_at: string;
  updated_at: string;
  source: string;
  summary: APIImportErrorReportSummary;
  saved_by: APIImportErrorReportUser;
  totals: APIImportErrorReportTotals;
  batches: APIImportErrorReportBatch[];
  errors: APIImportErrorReportError[];
  errors_truncated: boolean;
}

export interface APISaveValidationErrorReportPayload {
  importRunId: string;
  linkedRunId?: string;
  summary: {
    totalRecords: number;
    validRecords: number;
    reviewRecords: number;
    fileName: string;
    fileSize: string;
  };
  errors: APIImportErrorReportError[];
}
