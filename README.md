# Logic Legends website

## Dashboard roles

The public site is in `Logic_Legends_Web/`. Verified Firebase accounts can receive either role:

- `admin: true`: view the dashboard and their own profile. Administrator management is unavailable to this role.
- `super_admin: true` (also receives `admin: true`): view the dashboard and list, add, change or remove administrator access through **Profile → Administrator accounts**.

These Firebase roles control the website dashboard. They do **not** grant GitHub repository access, Netlify access, or the ability to edit and deploy website code. Give team members separate GitHub repository permissions if they should edit the site.

## Account profiles and navigation

The header shows only **LOGIN** to guests. After sign-in, the desktop profile icon and account name open a menu on hover or click, with Profile, an optional Instructor dashboard link, and Logout at the bottom. On mobile, account identity, Profile, dashboard access and Logout appear directly inside the hamburger navigation. Logout is also available at the bottom of the profile page.

`Logic_Legends_Web/Profile/profile.html` shows the current user's name, email, verification status, role and join date. Players have a starter profile area for future game details. Super admins additionally get a searchable administrator list, an add-by-email form, role editing and access removal. Additions and changes have a confirmation dialog. Removing access keeps the Firebase player account and unrelated custom claims. Users cannot remove or demote their own super-admin access.

Administrator operations use `/.netlify/functions/dashboard-accounts` (GET list, POST add, PATCH role, DELETE access). Every request verifies the Firebase ID token with revocation checking and reads the caller's current account record before authorizing the operation. Role changes request session revocation; the UI asks affected users to sign in again. Claim propagation and token behavior follow the [Firebase custom claims documentation](https://firebase.google.com/docs/auth/admin/custom-claims).

The static Apache/VS Code preview can display profiles after Firebase sign-in, but cannot execute Netlify Functions. Real administrator operations require the deployed Netlify site or a Netlify local environment with `FIREBASE_SERVICE_ACCOUNT_JSON` configured. Without a backend, the page displays an unavailable message rather than a fake administrator list.

For isolated interface checks, `node tests/profile-preview-server.mjs` runs the real profile UI and API handler against in-memory sample accounts on `127.0.0.1:4318`. Its pages are visibly marked as samples, never contact Firebase, and are outside the published website directory. Stop the server when testing is finished. Run backend checks with `node --test tests/role-permissions.test.mjs tests/dashboard-accounts.test.mjs`.

## First super admin

1. In Firebase Authentication for project `logic-legends-ac66c`, sign up and verify the first super admin account. A verified Google sign-in also works.
2. In Firebase Console > Project settings > Service accounts, generate a service account private key. Keep it outside this repository. Never put the JSON in public HTML, JavaScript, or `netlify.toml`.
3. From the repository root, run `npm ci`, set `FIREBASE_SERVICE_ACCOUNT_JSON` to the **entire JSON** in your local shell, and run `node scripts/grant-first-admin.mjs you@example.com` with the verified account's email. The script grants both `super_admin` and `admin`. Sign out and back in to refresh the Firebase token.
4. In the Netlify project's Project configuration > Environment variables, add `FIREBASE_SERVICE_ACCOUNT_JSON` with the entire JSON as its value. Mark it secret if the option is offered, and select the Functions scope if available. Create a new deploy after saving it. Without this setting, the account form reports “Account management is not configured yet.”
5. Open **Profile → Administrator accounts**, enter another verified account's email and choose **Admin** for dashboard viewing or **Super admin** for account management. Existing administrators can be promoted, demoted or have dashboard access removed from their row. Affected users should sign in again.

For an optional backend diagnostic, set `FIREBASE_SERVICE_ACCOUNT_JSON` locally and run `node scripts/show-dashboard-roles.mjs you@example.com` for one account, or omit the email to list all accounts with dashboard roles. Normal administrator management is available through the profile interface.

Netlify publishes `Logic_Legends_Web/` and deploys `netlify/functions/` through the Git-connected repository's `main` branch. A local commit must be pushed to `main` before the live website updates.

The instructor dashboard is a static presentation based on the four game chapters and ten solo trials. Its five fictional learner records, summary values, chapter progress and review-topic figures are labeled as examples. There are no live analytics, class filters or administrator-management controls on the dashboard. Sign-in protection and shared account navigation remain active. Administrator management stays on the super-admin profile page.

If real private student data is added later, serve it through a protected server endpoint or Firebase Security Rules; hiding HTML with client-side JavaScript alone does not make static data private.
