/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOGO: string;
  readonly VITE_PROJECT: string;
  readonly VITE_SITENAME: string;
  readonly VITE_DOMAIN: string;

  readonly VITE_SITENAME_PUBLIC: string;
  readonly VITE_SITENAME_PRIVATE: string;

  readonly VITE_STRIPE_PUBLIC_KEY: string;

  readonly VITE_VOLUNTEER_SUBTYPES: string;
  readonly VITE_DONOR_SUBTYPES: string;
  readonly VITE_CAREGIVER_SUBTYPES: string;
  readonly VITE_PATIENT_SUBTYPES: string;

  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_SECRET_KEY: string;
  readonly VITE_STRIPE_CONNECT_ACCOUNT_ID: string;
  readonly VITE_STRIPE_PRODUCT_ID: string;
}