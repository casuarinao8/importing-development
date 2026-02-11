export interface APICharity {
  id: number;
  organization_name: string | null;
  'email_primary.email': string | null;
  'phone_primary.phone_numeric': string | null;
  'address_primary.street_address': string | null;
  'address_primary.postal_code': string | null;

  'donation_details': APIGenericDonationDetails | null;
}

export interface APIGenericDonationDetails {
  "Generic_Donation_Details.TDR_Minimum_Requirement": number | null;
  "Generic_Donation_Details.Minimum_Donation_Amount": number | null;
  "Generic_Donation_Details.Donation_Amounts": string[];
  "Generic_Donation_Details.Recurring_Amounts": string[];
  "thumbnail.url": string | null;
  "details": string | null;
}