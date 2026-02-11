import { Proxy } from "../../../proxy";
import { ImportContact, ValidationError, ValidationResult, ImportSummary } from "../../../proxy/contact/import/types";

export class ContactValidator {
  static validateContact(contact: ImportContact, rowIndex: number, existingTransactionIds: { id: number; contact_id: number; receive_date: string; trxn_id: string; "Additional_Contribution_Details.Imported_Date": string }[]): ValidationResult {
    const errors: ValidationError[] = [];
    const contribution = contact.contribution;

    // Required field validations (contact type only)
    if (!contact.contact_type?.trim()) {
      errors.push({
        row: rowIndex,
        field: 'contact_type',
        message: 'Contact type is required'
      });
    } else {
      const validTypes = ['Individual', 'Organization'];
      if (!validTypes.includes(contact.contact_type.trim())) {
        errors.push({
          row: rowIndex,
          field: 'contact_type',
          message: `Invalid contact type`
        });
      }
    }

    if (contact.email_primary && !this.isValidEmail(contact.email_primary.trim())) {
      errors.push({
        row: rowIndex,
        field: 'email',
        message: 'Invalid email format'
      });
    }

    // Contribution Required field validations
    // Amount
    if(!contribution.total_amount) {
      errors.push({
        row: rowIndex,
        field: 'total_amount',
        message: 'Amount is required'
      });
    } else if(isNaN(contribution.total_amount)) {
      errors.push({
        row: rowIndex,
        field: 'total_amount',
        message: 'Amount is not a number'
      });
    }

    // Financial Type
    if (isNaN(Number(contribution.financial_type_id))) {
      errors.push({
        row: rowIndex,
        field: 'financial_type',
        message: 'Financial type id is not a number'
      });
    } else if (!contribution.financial_type_id || contribution.financial_type_id === 0) {
      errors.push({
        row: rowIndex,
        field: 'financial_type',
        message: 'Financial type code is required' 
      });         
    }

    // Contribution Date
    if (!contribution.receive_date) {
      errors.push({
        row: rowIndex,
        field: 'receive_date',
        message: 'Contribution date is required' 
      });         
    } else {
      let dateValue = this.convertToISO(contribution.receive_date);
      if (dateValue === '') {
        errors.push({
          row: rowIndex,
          field: 'receive_date',
          message: 'Contribution date format is invalid' 
        }); 
      } else contribution.receive_date = dateValue;
    }

    // Contribution Status
    if (!contribution.contribution_status_id) {
      errors.push({
        row: rowIndex,
        field: 'contribution_status',
        message: 'Contribution status is required' 
      });         
    }

    // Payment Method
    if (isNaN(Number(contribution.payment_instrument_id))) {
      errors.push({
        row: rowIndex,
        field: 'payment_instrument',
        message: 'Payment method code is not a number' 
      });         
    } else if (!contribution.payment_instrument_id || contribution.payment_instrument_id === 0) {
      errors.push({
        row: rowIndex,
        field: 'payment_instrument',
        message: 'Payment method code is required' 
      });         
    }

    // Check for duplicate transaction ID
    if (contribution.trxn_id) {
      const duplicateTransactionId = existingTransactionIds.find(item => item.trxn_id === contribution.trxn_id);
        if (duplicateTransactionId) {
          errors.push({
            row: rowIndex,
            field: 'trxn_id',
            message: 'Row ' + (rowIndex + 1) + ': Transaction ID already exists at Donation ID: ' + duplicateTransactionId.id
        });         
      }
    }

    // Platform
    const platform = contribution["Additional_Contribution_Details.Payment_Platform"];
    if (platform !== null && platform !== undefined) {
      if (isNaN(Number(platform))) {
        errors.push({
          row: rowIndex,
          field: 'platform',
          message: 'Platform code is not a number' 
        });         
      }
    }

    // Frequency
    const frequency = contribution["Additional_Contribution_Details.Recurring_Donation"];
    if (frequency !== null && frequency !== undefined) {
      if (isNaN(Number(frequency))) {
        errors.push({
          row: rowIndex,
          field: 'frequency',
          message: 'Frequency code is not a number' 
        });         
      }
    }

    // Change Imported Date format
    let imported_date = contribution["Additional_Contribution_Details.Imported_Date"];
    if (!imported_date) {
      errors.push({
        row: rowIndex,
        field: 'imported_date',
        message: 'Imported date is required' 
      });         
    } else {
      let dateValue = this.convertToISO(imported_date);
      if (dateValue === '') {
        errors.push({
          row: rowIndex,
          field: 'imported_date',
          message: 'Imported date format is invalid' 
        }); 
      } else contribution["Additional_Contribution_Details.Imported_Date"] = dateValue;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static async validateCSVData(data: ImportContact[]): Promise<{
    validContacts: ImportContact[];
    invalidContacts: Array<{ contact: ImportContact; errors: ValidationError[] }>;
    summary: ImportSummary;
  }> {
    const validContacts: ImportContact[] = [];
    const invalidContacts: Array<{ contact: ImportContact; errors: ValidationError[] }> = [];
    const existingTransactionIds = await Proxy.Contact.Import.getDuplicateTransactionIds(data.map(contact => contact.contribution.trxn_id));

    data.forEach((contact, index) => {
      const validation = this.validateContact(contact, index + 1, existingTransactionIds);
      if (validation.isValid) {
        validContacts.push(contact);
      } else {
        invalidContacts.push({
          contact,
          errors: validation.errors
        });
        console.log("validation.errors: ", validation.errors);
      }
    });

    const summary: ImportSummary = {
      totalRecords: data.length,
      validRecords: validContacts.length,
      reviewRecords: invalidContacts.length,
      fileName: '',
      fileSize: ''
    };

    return {
      validContacts,
      invalidContacts,
      summary
    };
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return email !== '' ? emailRegex.test(email) : true;
  }

  private static convertToISO(dateStr: string): string {
    // dd/mm/yyyy with optional time (HH:MM AM/PM)
    const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{1,2}:\d{2}\s+(?:AM|PM))?$/i.exec(dateStr.trim());
    if (!match) return ''; // invalid format
  
    const [_, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  private static safeToNumber(value: string): number | string {
    if (!value || value.trim() === '') return '';
    const num = Number(value);
    return isNaN(num) ? value : num;
  }

  private static safeToNumberOrNull(value: string): number | string | null {
    if (!value || value.trim() === '') return null;
    const num = Number(value);
    return isNaN(num) ? value : num;
  }

  static parseCSV(csvText: string): ImportContact[] {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const contacts: ImportContact[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const contact: ImportContact = {
        contact_type: '',
        prefix_id: null,
        name: '',
        preferred_name: '',
        external_identifier: '',
        email_primary: '',
        phone_primary: '',
        street_address: '',
        unit_floor_number: '',
        postal_code: '',
        contribution: {
          financial_type: '',
          financial_type_id: 0 as unknown as number,
          contribution_status_id: 0 as unknown as number,
          total_amount: 0,
          source: '',
          "Additional_Contribution_Details.Campaign": '',
          receive_date: '',
          payment_instrument_id: null,
          trxn_id: '',
          check_number: '',
          "Additional_Contribution_Details.NRIC_FIN_UEN": null,
          "Additional_Contribution_Details.Payment_Platform": null,
          "Additional_Contribution_Details.Recurring_Donation": null,
          "Additional_Contribution_Details.Remarks": '',
          "Additional_Contribution_Details.Imported_Date": ''
        }
      };

      headers.forEach((header, index) => {
        const value = values[index]?.trim() || '';
        switch (header) {
          case 'salutation code':
          case 'individual prefix':
            if (value) {
              const converted = this.safeToNumberOrNull(value);
              contact.prefix_id = (typeof converted === 'number' ? converted : null) as number | null;
            } else {
              contact.prefix_id = null;
            }
            break;
          case 'name':
          case 'full name as in nric':
            contact.name = value;
            break;
          case 'preferred name':
          case 'preferred_name':
            contact.preferred_name = value;
            break;
          case 'contact type':
          case 'contact_type':
            contact.contact_type = value;
            break;
          case 'external id':
          case 'external_id':
          case 'external_identifier':
            contact.external_identifier = value;
            contact.contribution["Additional_Contribution_Details.NRIC_FIN_UEN"] = value;
            break;
          case 'email':
            contact.email_primary = value;
            break;
          case 'phone':
          case 'mobile number':
            contact.phone_primary = value;
            break;
          case 'street address':
          case 'street_address':
          case 'address':
            contact.street_address = value;
            break;
          case 'unit floor number':
          case 'unit_floor_number':
          case 'floor & unit number':
            contact.unit_floor_number = value;
            break;
          case 'postal code':
          case 'postal_code':
            contact.postal_code = value;
            break;
          case 'total amount* in sgd':
          case 'total amount':
          case 'total_amount':
            const totalAmount = this.safeToNumber(value);
            contact.contribution.total_amount = (typeof totalAmount === 'number' ? totalAmount : (totalAmount as any)) as number;
            break;
          case 'financial type':
          case 'financial_type':
          case 'donation type':
            contact.contribution.financial_type = value;
            break;
          case 'donation type code':
          case 'financial type code':
          case 'financial_type_code':
            const financialTypeId = this.safeToNumber(value);
            (contact.contribution as any).financial_type_id = financialTypeId;
            break;
          case 'donation status code':
          case 'donation_status_code':
            const contributionStatusId = this.safeToNumber(value);
            (contact.contribution as any).contribution_status_id = contributionStatusId;
            break;
          case 'contribution source':
          case 'contribution_source':
            contact.contribution.source = value;
            break;
          case 'date received*':
          case 'date received':
          case 'date_received':
          case 'donation date':
            contact.contribution.receive_date = value;
            break;
          case 'payment method code':
          case 'payment_method_code':
            if (value) {
              const converted = this.safeToNumberOrNull(value);
              (contact.contribution as any).payment_instrument_id = converted;
            } else {
              contact.contribution.payment_instrument_id = null;
            }
            break;
          case 'transaction id*':
          case 'transaction id':
          case 'transaction_id':
            contact.contribution.trxn_id = value;
            break;
          case 'check number':
          case 'cheque number':
          case 'cheque_number':
          case 'check_number':
            contact.contribution.check_number = value;
            break;
          case 'campaign code':
          case 'campaign_code':
              contact.contribution["Additional_Contribution_Details.Campaign"] = value;
            break;
          case 'donation platform code':
          case 'donation_platform_code':
            if (value) {
              const converted = this.safeToNumberOrNull(value);
              (contact.contribution as any)["Additional_Contribution_Details.Payment_Platform"] = converted;
            } else {
              contact.contribution["Additional_Contribution_Details.Payment_Platform"] = null;
            }
            break;            
          case 'imported date':
          case 'imported_date':
            contact.contribution["Additional_Contribution_Details.Imported_Date"] = value;
            break;  
          case 'frequency code':
          case 'recurring donation':
            if (value) {
              const converted = this.safeToNumberOrNull(value);
              (contact.contribution as any)["Additional_Contribution_Details.Recurring_Donation"] = converted;
            } else {
              contact.contribution["Additional_Contribution_Details.Recurring_Donation"] = null;
            }
            break; 
          case 'remarks':
            contact.contribution["Additional_Contribution_Details.Remarks"] = value;
            break; 
        }
      });

      contacts.push(contact);
    }

    return contacts;
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
}
