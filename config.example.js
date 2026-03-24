// Runtime configuration for the import app.
// Copy this file to config.js and update the values for each client deployment.
// This file is loaded before the app bundle, so all values are available immediately.

window.__APP_CONFIG__ = {
  // The domain the site is hosted on (no trailing slash)
  DOMAIN: "https://example.socialservicesconnect.com",

  // The page title shown on the import page
  IMPORT_TITLE: "Client Data Import",

  // Google Sheets URL for the CSV import template
  TEMPLATE_URL: "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit",

  // URL to the latest imported donations report in CiviCRM
  LATEST_DONATIONS_URL: "https://example.socialservicesconnect.com/wp-admin/admin.php?page=CiviCRM&q=civicrm%2Fimported-date",
};
