import axios from 'axios';
import { APIJobRequest, CreateJobRequest } from './types';

export default class BeneficiaryManager {
  private static route = `${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/civicrm/beneficiary`;

  /**
   * @param patient_view Whether to return every job request for the patient, caregiver by default
   */
  static async getRequests(patient_view?: boolean) {
    const response = await axios.get<APIJobRequest[]>(`${this.route}/get_job_requests.php?patient_view=${patient_view ?? false}`);
    return response.data;
  }

  static async createRequest(data: CreateJobRequest) {
    const response = await axios.post<number>(`${this.route}/create_job_request.php`, data);
    return Boolean(response.data);
  }

  static async cancelRequest(request_id: number) {
    const response = await axios.post<number>(`${this.route}/cancel_job_request.php?id=${request_id}`);
    return Boolean(response.data);
  }

  static async updateRequest(request_id: number, data: Partial<CreateJobRequest>) {
    const response = await axios.post(`${this.route}/update_job_request.php?id=${request_id}`, data);
    return response.data;
  }
}