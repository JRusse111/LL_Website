# Logic Legends website

## Dashboard roles

The public site is in `Logic_Legends_Web/`. Verified Firebase accounts can receive either role:

- `admin: true`: view the dashboard. The Dashboard accounts form is hidden, and the server rejects account grants from this role.
- `super_admin: true` (also receives `admin: true`): view the dashboard and grant either role to other verified accounts through Dashboard accounts.

These Firebase roles control the website dashboard. They do **not** grant GitHub repository access, Netlify access, or the ability to edit and deploy website code. Give team members separate GitHub repository permissions if they should edit the site.

## First super admin

1. In Firebase Authentication for project `logic-legends-ac66c`, sign up and verify the first super admin account. A verified Google sign-in also works.
2. In Firebase Console > Project settings > Service accounts, generate a service account private key. Keep it outside this repository. Never put the JSON in public HTML, JavaScript, or `netlify.toml`.
3. From the repository root, run `npm ci`, set `FIREBASE_SERVICE_ACCOUNT_JSON` to the **entire JSON** in your local shell, and run `node scripts/grant-first-admin.mjs you@example.com` with the verified account's email. The script grants both `super_admin` and `admin`. Sign out and back in to refresh the Firebase token.
4. In the Netlify project's Project configuration > Environment variables, add `FIREBASE_SERVICE_ACCOUNT_JSON` with the entire JSON as its value. Mark it secret if the option is offered, and select the Functions scope if available. Create a new deploy after saving it. Without this setting, the account form reports “Account management is not configured yet.”
5. In Dashboard accounts, enter another verified account's email and choose **Admin** for dashboard viewing or **Super admin** for account management. A person promoted from admin to super admin must sign in again. The form does not downgrade an existing super admin.

To inspect the roles stored in Firebase from the backend, set `FIREBASE_SERVICE_ACCOUNT_JSON` locally and run `node scripts/show-dashboard-roles.mjs you@example.com` for one account, or omit the email to list all accounts with dashboard roles. The script reads Firebase Authentication user records; it is not part of the public website.

Netlify publishes `Logic_Legends_Web/` and deploys `netlify/functions/` through the Git-connected repository's `main` branch. A local commit must be pushed to `main` before the live website updates.

The dashboard currently contains sample data directly in its static HTML. If real private student data is added later, serve it through a protected server endpoint or Firebase Security Rules; hiding HTML with client-side JavaScript alone does not make static data private.
