import axios from 'axios';
import { APICustomField, APIOptionValue } from './types';

export class CustomFieldsManager {
  private static route = `${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/civicrm/custom-field`;

  /** Return an array of fields belonging to a field set */
  static async getFieldsBySetName(name: string) {
    const response = await axios.get<APICustomField[]>(`${this.route}/get_fields_by_set_name.php?name=${name}`);
    return response.data;
  }

  /** Return an array of options belonging to a specific group */
  static async getOptionValuesByGroupName(name: string) {
    const response = await axios.get<APIOptionValue[]>(`${this.route}/get_option_values_by_group_name.php?name=${name}`);
    return response.data;
  }
}