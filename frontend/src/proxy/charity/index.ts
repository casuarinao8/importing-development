import axios from 'axios';
import { APICharity } from './types';

export default class CharityManager {
  private static route = `${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/civicrm/donor/charity`;

  /** Retrieve the charity organisation */
  static async getSelf() {
    const response = await axios.get<APICharity>(`${this.route}/get_self.php`);
    return response.data;
  }
}