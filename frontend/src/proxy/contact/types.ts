export interface APIContact {
  id: number;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  image_URL: string | null;

  'gender_id': number | null;
	'contact_sub_type:label': string[] | null;
  'email_primary.email': string | null;
  'phone_primary.phone_numeric': string | null;
  'address_primary.street_address': string | null;
  'address_primary.postal_code': string | null;
  'external_identifier': string | null;

  'Volunteer_Details.Skills_Interests': string[] | null;
}

export type UpdateContactOptions = Partial<Omit<APIContact, 'id' | 'email_primary.email'>> & Record<string, any>;

export interface APIRelationship {
  id: number;
  created_date: string;
  'relationship_type_id:label': string;
  'contact_id_a': number;
  'contact_id_a.gender_id:label': string;
  'contact_id_a.address_primary.street_address': string | null;
  'contact_id_a.address_primary.postal_code': string | null;
  'contact_id_a.email_primary.email': string | null;
  'contact_id_a.first_name': string | null;
  'contact_id_a.last_name': string | null;
  'contact_id_a.phone_primary.phone': string | null;
}

export interface APIContactType {
  id: number;
  name: string;
  label: string;
}