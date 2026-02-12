export interface APIJobRequest {
  id: number;
  subject: string | null;
  activity_date_time: string;
  created_date: string;
  details: string | null;
  location: string | null;
  target_contact_id: number | null;
  source_contact_id: number;
  'status_id:name': string;
  'patient.id': number | null;
  'patient.first_name': string | null;
  'patient.last_name': string | null;
  'patient.email_primary.email': string | null;
  'volunteer.id': number | null;
  'volunteer.first_name': string | null;
  'volunteer.last_name': string | null;
  'volunteer.email_primary.email': string | null;
  'Volunteer_Job_Request.Request_Type': number;
  'Volunteer_Job_Request.Request_Type:label': string;
  'self.id': number;
  'self.email_primary.email': string | null;
  'self.first_name': string | null;
  'self.last_name': string | null;
}

export interface CreateJobRequest {
  'Volunteer_Job_Request.Request_Type': string | number;
  subject: string;
  activity_date_time: string;
  target_contact_id?: number;
  details?: string;
  location?: string;
}