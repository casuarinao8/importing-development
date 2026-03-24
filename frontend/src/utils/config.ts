interface AppConfig {
  DOMAIN: string;
  IMPORT_TITLE: string;
  TEMPLATE_URL: string;
  LATEST_DONATIONS_URL: string;
}

declare global {
  interface Window {
    __APP_CONFIG__: AppConfig;
  }
}

export const config: AppConfig = window.__APP_CONFIG__;
