import axios from 'axios';
import { ImportContact, ImportResults, ValidationError } from './types';
import { config } from '../../../utils/config';

export default class ImportManager {
  private static route = `${config.DOMAIN}/${import.meta.env.VITE_SITENAME}/api/civicrm/contact/import`;

  static async processImport(contacts?: ImportContact[], batchNumber?: number, batchSize?: number) {

    const response = await axios.create({
      headers: { 'Content-Type': 'application/json' }
    }).post<{ newContacts: any[]; updatedContacts: any[]; contributions: any[]; numberOfErrors: number; errors: { contact: ImportContact; errors: ValidationError[] }[] }>(
      `${this.route}/import_new_logic.php`,
      { contacts, batchNumber, batchSize }
    );

    const data = response.data;
    console.log('data: ', data);
    const results: ImportResults = {
      totalRecords: contacts?.length ?? 0,
      newContacts: Array.isArray(data.newContacts) ? data.newContacts : [],
      updatedContacts: Array.isArray(data.updatedContacts) ? data.updatedContacts : [],
      contributions: Array.isArray(data.contributions) ? data.contributions : [] ,      
      numberOfErrors: data.numberOfErrors ?? 0,
      errors:  Array.isArray(data.errors) ? data.errors : []
    };
    
    return results;
  }

  static async getDuplicateTransactionIds(transactionIds: string[]) {
		const response = await axios.post<{ id: number; contact_id: number; receive_date: string; trxn_id: string; "Additional_Contribution_Details.Imported_Date": string }[]>(
			`${this.route}/get_duplicate_transaction_ids.php`,
			{ transactionIds }
		);
		return response.data;
	}

}