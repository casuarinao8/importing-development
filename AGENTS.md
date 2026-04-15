# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` holds the React + TypeScript + Vite app. Key areas include `frontend/src/pages/import/` (multi-step CSV import flow), `frontend/src/proxy/` (API manager classes), `frontend/src/contexts/`, and `frontend/src/utils/`.
- `api/` contains PHP endpoints that call CiviCRM API4 and WordPress helpers.
- `dist/` and top-level `index.html` are build outputs. Assets live under `frontend/src/assets/`.
- `vendor/` is Composer output; `composer.json` defines PHP dependencies.

## Build, Test, and Development Commands
- `cd frontend && npm install` installs frontend dependencies.
- `cd frontend && npm run build` cleans `dist/`, runs TypeScript, and builds to the project root. This is the primary workflow.
- `cd frontend && npm run dev` exists but is not used in this repo because the app must be served from WordPress/CiviCRM to avoid CORS issues.
- `cd frontend && npm run preview` serves the built assets for a quick static preview.
- `composer install` installs backend PHP dependencies.

## Coding Style & Naming Conventions
- TypeScript React with functional components and hooks.
- Formatting follows 2-space indentation, single quotes, and semicolons as shown in `frontend/src/*.tsx`.
- Component and page files are kebab-case (example: `frontend/src/components/welcome-header.tsx`).
- API manager modules use a `types.ts` file alongside manager classes in `frontend/src/proxy/*`.
- PHP endpoint filenames use snake_case (example: `api/civicrm/contact/import/get_duplicate_transaction_ids.php`).

## Testing Guidelines
- No automated test suite is checked in. Validate changes manually by building and running inside a WordPress + CiviCRM environment, then walking through the CSV import flow.
- If you add tests, document the framework and the command in this file.

## Commit & Pull Request Guidelines
- Commit messages are short, verb-led, and in sentence case (example: “Refactor proxy and utility files for improved code consistency and readability”).
- PRs should include a summary, manual test steps, and screenshots for UI changes. Link related issues and note any WordPress/CiviCRM configuration assumptions or CSV sample data used.

## Configuration & Environment
- Create `frontend/.env` with required `VITE_*` values. Add new variables to `frontend/src/vite-env.d.ts`.
- The app must be deployed under the WordPress install (for example `xampp/htdocs/wordpress/portal/`) so it can call WordPress/CiviCRM APIs without CORS issues.
