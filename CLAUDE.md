# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web-based CSV import module for a WordPress CiviCRM Volunteer Portal (v3). Users upload CSV files containing contact and donation/contribution data, validate the data client-side, and batch-import it into CiviCRM via its API4. The app must be served through WordPress (not standalone) due to CORS restrictions.

## Build & Development

**Prerequisites:** XAMPP, WordPress, and CiviCRM must be installed. Refer to CiviCRM's **Support/Developer/Api4** for API documentation.

```bash
# Frontend (from frontend/ directory)
cd frontend
npm install
npm run build    # Cleans ../dist, runs tsc, then vite build → outputs to project root

# Backend PHP dependencies (from project root)
composer install
```

- **`npm run dev` does NOT work** — the React app must be served from within the WordPress directory to avoid CORS issues with CiviCRM/WordPress API endpoints
- After building, copy all folders (except `frontend/`) into your WordPress file manager location (e.g., `xampp/htdocs/wordpress/portal/`)
- The folder name determines the URL path (e.g., `http://localhost/wordpress/portal`)

**Environment:** Create a `.env` file in `frontend/`. Key variables: `VITE_DOMAIN`, `VITE_SITENAME`, `VITE_SITENAME_PUBLIC`, `VITE_SITENAME_PRIVATE`, `VITE_PROJECT`, `VITE_BATCH_SIZE` (default 50), `VITE_TEMPLATE_URL`, `VITE_IMPORT_TITLE`. Add new env vars to `frontend/src/vite-env.d.ts`.

## Architecture

### Frontend (`frontend/src/`)

React 18 + TypeScript + Vite. Styling via Tailwind CSS 3.4 + Material-UI 6.4. Custom Satoshi font.

- **`main.tsx`** — Entry point with React Router and MUI theme setup
- **`pages/import/`** — The 4-step import workflow:
  1. `upload-csv/` — Drag-drop CSV upload (10MB limit), parsed with PapaParse
  2. `preview/` — Data preview with client-side validation (`components/validation-utils.ts` — 436 lines of validation logic)
  3. `settings/` — Import settings configuration
  4. `results/` — Success/error summary with downloadable review CSV of invalid records
- **`proxy/`** — API client layer using Manager classes with static methods (`ContactManager`, `ImportManager`, `BeneficiaryManager`, `CharityManager`). Each module has its own `types.ts`. Flow: `Component → Manager class → Axios → PHP endpoint`
- **`contexts/Contact.tsx`** — React Context (`SubtypesProvider`) for current user contact data
- **`utils/`** — Auth, permissions, AES-256-CBC encryption helpers, CSV download

### Backend (`api/`)

PHP endpoints consumed by the frontend via Axios. All CiviCRM interactions use API4.

- **`api/civicrm/contact/import/import_new_logic.php`** — Core import engine. Processes records in batches with a 5-minute PHP time limit. Logs with `[IMPORTING]` prefix.
  - **Contact matching rules:**
    - Tax-deductible contributions (`financial_type_id == 5`): match by `external_identifier`
    - Non-tax-deductible Individuals: match by email, then phone
    - Non-tax-deductible Organizations: always create new
  - Updates existing contacts (name, email, phone, address) or creates new ones
  - Bulk-inserts contributions after all contacts are processed
  - Deduplicates via `Additional_Contribution_Details.Imported_Date`
- **`api/civicrm/contact/import/get_import_settings.php` / `set_import_settings.php`** — Persist settings to CiviCRM's Setting entity
- **`api/encode.php` / `decode.php`** — AES-256-CBC encryption for sensitive data
- **`api/wordpress/has_permission.php`** — WordPress permission checks

### Key CiviCRM Custom Fields

Campaign, Payment_Platform, Recurring_Donation, Remarks, Skills_Interests, Account_Information, Volunteer_Details, Donor_Details. Contact subtypes: `Individual_Donor`, `Organisation_donor`.

## Conventions

- TypeScript interfaces for all API data, with separate `types.ts` per proxy module
- Manager classes use static methods and centralized route definitions
- Functional React components with hooks throughout
- Server-side error logging uses `error_log()` with `[IMPORTING]` prefix for traceability
- Build output goes to project root (`outDir: '../'`) with assets in `/dist`
- The nested `public/public/` structure is intentional — keeps built public assets grouped for easy deployment
