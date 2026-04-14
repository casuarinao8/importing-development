# CiviCRM CSV Import Module - AI Agent Guide

WordPress-integrated React+TypeScript CSV import tool for CiviCRM API4. Must be served through WordPress due to CORS restrictions.

## Quick Start

```bash
# Install dependencies
cd frontend && npm install && cd .. && composer install

# Build (required every time - no dev server)
cd frontend && npm run build

# Deploy: Copy all folders EXCEPT frontend/ to xampp/htdocs/wordpress/portal/
```

**Critical:** `npm run dev` does NOT work due to CiviCRM/WordPress CORS restrictions. Always build and copy to WordPress directory.

## Environment Setup

Create `frontend/.env` with these required variables:
- `VITE_DOMAIN`, `VITE_SITENAME`, `VITE_SITENAME_PUBLIC`, `VITE_SITENAME_PRIVATE`
- `VITE_PROJECT`, `VITE_BATCH_SIZE` (default: 50)
- `VITE_TEMPLATE_URL`, `VITE_IMPORT_TITLE`

Add new env vars to [frontend/src/vite-env.d.ts](frontend/src/vite-env.d.ts) for TypeScript support.

## Architecture Patterns

### Frontend Structure ([frontend/src/](frontend/src/))

**Entry Point:** [main.tsx](frontend/src/main.tsx) sets up:
- React Router with `HashRouter`
- MUI theme (Tailwind config colors)
- `SubtypesProvider` context for current user
- LocalizationProvider with dayjs

**Import Workflow** ([pages/import/](frontend/src/pages/import/)):
1. [upload-csv/](frontend/src/pages/import/upload-csv/) - PapaParse CSV upload (10MB limit)
2. [preview/](frontend/src/pages/import/preview/) - Client-side validation (436-line [validation-utils.ts](frontend/src/pages/import/preview/components/validation-utils.ts))
3. [settings/](frontend/src/pages/import/settings/) - Import configuration
4. [results/](frontend/src/pages/import/results/) - Summary with downloadable CSV of errors

**API Communication** ([proxy/](frontend/src/proxy/)):
- Manager classes with **static methods only** (e.g., `ContactManager.getSelf()`)
- Base route pattern: `${VITE_DOMAIN}/${VITE_SITENAME}/api/module/endpoint.php`
- Each module has `types.ts` for TypeScript interfaces
- Flow: `Component → Manager → Axios → PHP`

**Example Manager Pattern:**
```typescript
// proxy/contact/index.ts
export default class ContactManager {
  private static route = `${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/civicrm/contact`;

  static async getSelf() {
    const response = await axios.get<APIContact>(`${this.route}/get_self.php`);
    return response.data;
  }
}
```

**React Conventions:**
- Functional components with hooks (`useState`, `useEffect`, `useContext`)
- Props interfaces defined inline or in component file
- MUI components + Tailwind utility classes
- Custom Satoshi font loaded via [main.css](frontend/src/main.css)

### Backend Structure ([api/](api/))

**Core Import Logic:** [api/civicrm/contact/import/import_new_logic.php](api/civicrm/contact/import/import_new_logic.php)
- 5-minute PHP timeout: `set_time_limit(300)`
- Batch processing with contact matching rules:
  - **Tax-deductible** (`financial_type_id == 5`): Match by `external_identifier`
  - **Non-tax-deductible Individuals**: Match by email, fallback to phone
  - **Non-tax-deductible Organizations**: Always create new
- Updates existing contacts (name, email, phone, address) or creates new
- Bulk-inserts contributions after contacts processed
- Deduplication via `Additional_Contribution_Details.Imported_Date`
- Error logging: `error_log("[IMPORTING] message")`

**CiviCRM API4 Pattern:**
```php
$result = \Civi\Api4\Contact::get(TRUE)
  ->addSelect('id', 'contact_type')
  ->addWhere('email', '=', $email)
  ->execute();
```

**Authentication:**
- [wordpress/has_permission.php](api/wordpress/has_permission.php) - WordPress capability checks
- [encode.php](api/encode.php) / [decode.php](api/decode.php) - AES-256-CBC encryption

## Build Configuration

[vite.config.ts](frontend/vite.config.ts):
```typescript
build: {
  assetsInlineLimit: 0,
  outDir: '../',        // Outputs to project root
  assetsDir: "dist"      // Assets go to /dist
}
```

**Why nested `public/public/`?** Build outputs everything to root, so nested structure keeps public assets grouped for easy deployment.

## Custom CiviCRM Fields

Key custom field sets (reference via API4):
- Campaign, Payment_Platform, Recurring_Donation, Remarks
- Skills_Interests, Account_Information, Volunteer_Details, Donor_Details
- Contact subtypes: `Individual_Donor`, `Organisation_donor`

Access in code via [custom-fields proxy](frontend/src/proxy/custom-fields/).

## Common Workflows

### Adding a New API Endpoint

1. Create PHP file in [api/](api/) following existing structure
2. Add Manager method in [proxy/](frontend/src/proxy/)
3. Add TypeScript interface in module's `types.ts`
4. Use CiviCRM API4 documentation at `yoursite/civicrm/api4`

### Modifying Import Logic

Primary file: [import_new_logic.php](api/civicrm/contact/import/import_new_logic.php)
- Contact matching rules at lines ~35-55
- Validation logic in [validation-utils.ts](frontend/src/pages/import/preview/components/validation-utils.ts)
- Setting lookup endpoint: [get_setting_by_name.php](api/civicrm/contact/import/get_setting_by_name.php) (legacy import settings endpoints were removed)

### Adding Validation Rules

Edit [validation-utils.ts](frontend/src/pages/import/preview/components/validation-utils.ts):
- Returns array of error objects: `{ row, field, message, value }`
- Runs client-side before upload
- Invalid records excluded from import, downloadable in results step

## Debugging

**Frontend:**
- Browser DevTools console
- Network tab for API calls

**Backend:**
- Check `error_log()` output (look for `[IMPORTING]` prefix)
- PHP time limit issues: Reduce `VITE_BATCH_SIZE` or increase timeout
- CiviCRM API4 explorer: `/civicrm/api4` on your WordPress site

## File Naming & Imports

- PHP: snake_case (e.g., `get_self.php`)
- TypeScript: kebab-case for files, PascalCase for components/classes
- Imports: Relative paths from component location
- Utils exported as namespace: `Utils.hasPermission()`

## Deployment Checklist

1. Update `.env` if needed
2. Run `npm run build` from `frontend/`
3. Copy all root-level folders **except** `frontend/` to WordPress directory
4. Access via `http://localhost/wordpress/your-folder-name`
5. Test import with sample CSV ([DMS Data - 25022026-0544PM.csv](DMS Data - 25022026-0544PM.csv))

## References

- **CiviCRM API4 Docs:** WordPress `/civicrm/api4` (Support/Developer/Api4)
- **Project README:** [README.md](README.md)
- **Detailed Architecture:** [CLAUDE.md](CLAUDE.md)
