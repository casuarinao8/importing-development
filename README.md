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

## Building and Uploading

Note that the name of the folder will be how you access your page each time you compile.
For example, if your project is located in **xampp/htdocs/wordpress/portal/**, it would be in http://localhost/wordpress/portal.

1. Create an .env file in `/frontend`. Refer to https://docs.google.com/document/d/1LJtUhRuNbzV346x-D1-tgd2wqFoD2TY54MZzO4F41dQ/edit?usp=sharing

2. Optionally, if you're familiar with typings, go to `/frontend/src/vite-env.d.ts` to create any new environment variables that you may need for the project.

3. Compile the project at the `/frontend` directory

```bash
npm run build
```

4. Copy and paste all folders (except the `frontend` directory) into your file manager.

## Possible Questions

1. **Why is the `public` folder nested with another `public` folder?**

When you compile, we made it so that the build is actually created in the root folder, making it easy to test on localhost before pushing to a live site. Without the nested folder, all contents in `public` would be individually separated, which would make it slightly irritating to copy each one.

2. **Why can't I use `npm run dev` to test?**

This is because the project uses WordPress and CiviCRM API endpoints, both of which likely have CORS (Cross-Origin Resource Sharing) restrictions enabled. CORS is a security feature that prevents web pages from making requests to domains other than their own. Since your React app is served on a different port or domain during development (via npm run dev), it can't make API calls to CiviCRM or WordPress due to CORS issues.

To work around this, you can compile your React app inside the wordpress folder. This makes the app appear as if it's part of the WordPress installation, avoiding the CORS issue. This way, you can directly access CiviCRM API endpoints as if they are part of the same domain.
