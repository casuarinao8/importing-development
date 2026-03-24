import axios from 'axios';
import { APICharity } from './types';
import { config } from '../../utils/config';

export default class CharityManager {
  private static route = `${config.DOMAIN}/${import.meta.env.VITE_SITENAME}/api/civicrm/donor/charity`;

  /** Retrieve the charity organisation */
  static async getSelf() {
    const response = await axios.get<APICharity>(`${this.route}/get_self.php`);
    return response.data;
  }
}