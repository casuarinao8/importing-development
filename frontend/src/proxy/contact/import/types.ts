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
  "Additional_Contribution_Details.Campaign": string | null;
  "Additional_Contribution_Details.Payment_Platform": number | null;
  "Additional_Contribution_Details.Recurring_Donation": number | null;
  "Additional_Contribution_Details.Remarks": string;
  "Additional_Contribution_Details.Imported_Date": string;
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

export interface APISettings {
  domain_id: number;
  name: string;
  value: string | any[];
}

export interface APIImportSettings {
  import_dedupe_rule: string;
  import_contact_types: string[];
  import_custom_fields: string[];
}