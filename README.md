# Important Note

This project assumes that you already have XAMPP, Wordpress and CiviCRM installed. Due to the nature of it, it is unfortunately not entirely possible to use `npm run dev` since it directly requires Wordpress/CiviCRM. Instead, you will be required to build your file with `npm run build` every time in your localhost to view changes.

Refer to your CiviCRM's **Support/Developer/Api4** for more documentation. Syntax should be very similar to Javascript examples.

## Installation

1. Navigate to the `frontend` directory:

```bash
cd frontend
```

2. Install the required Node packages:

```bash
npm install
```

3. Navigate back to the project's root directory:

```bash
cd ..
```

4. Install the required Composer packages:

```bash
composer install
```

## Building

The frontend only needs to be built **once**. The same build works across all client deployments.

1. Ensure `/frontend/.env` exists with the build-time settings:

```env
VITE_SITENAME=portal
VITE_BATCH_SIZE=50
```

2. Compile the project from the `/frontend` directory:

```bash
npm run build
```

## Deploying to a Client

No rebuild is needed per client. Only `config.js` changes.

1. Copy all folders (except the `frontend` directory) into the client's WordPress file manager (e.g., `xampp/htdocs/wordpress/portal/`). The folder name determines the URL path (e.g., `http://localhost/wordpress/portal`).

2. Copy `config.example.js` to `config.js` in the deployed folder and update the values for the client:

```js
window.__APP_CONFIG__ = {
  DOMAIN: "https://clientname.socialservicesconnect.com",
  IMPORT_TITLE: "Client Data Import",
  TEMPLATE_URL: "https://docs.google.com/spreadsheets/d/SHEET_ID/edit",
  LATEST_DONATIONS_URL: "https://clientname.socialservicesconnect.com/wp-admin/admin.php?page=CiviCRM&q=civicrm%2Fimported-date",
};
```

| Property | Description |
|---|---|
| `DOMAIN` | The client's site URL (no trailing slash) |
| `IMPORT_TITLE` | Page title shown on the import screen |
| `TEMPLATE_URL` | Google Sheets link for the CSV import template |
| `LATEST_DONATIONS_URL` | CiviCRM report URL for latest imported donations |

## Possible Questions

1. **Why is the `public` folder nested with another `public` folder?**

When you compile, we made it so that the build is actually created in the root folder, making it easy to test on localhost before pushing to a live site. Without the nested folder, all contents in `public` would be individually separated, which would make it slightly irritating to copy each one.

2. **Why can't I use `npm run dev` to test?**

This is because the project uses WordPress and CiviCRM API endpoints, both of which likely have CORS (Cross-Origin Resource Sharing) restrictions enabled. CORS is a security feature that prevents web pages from making requests to domains other than their own. Since your React app is served on a different port or domain during development (via npm run dev), it can't make API calls to CiviCRM or WordPress due to CORS issues.

To work around this, you can compile your React app inside the wordpress folder. This makes the app appear as if it's part of the WordPress installation, avoiding the CORS issue. This way, you can directly access CiviCRM API endpoints as if they are part of the same domain.

3. **How do I deploy to a new client without rebuilding?**

Just copy the already-built files to the client's WordPress directory and create a `config.js` with their specific values (see "Deploying to a Client" above). The JS/CSS bundle is identical across all clients.
