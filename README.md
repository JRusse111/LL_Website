# Logic Legends website

## Admin dashboard setup

The public site is in `Logic_Legends_Web/`. Dashboard navigation appears only for a verified Firebase account with the `admin: true` custom claim. The dashboard checks that claim before showing its content. The account grant endpoint checks the same claim on the server.

1. In Firebase Authentication for project `logic-legends-ac66c`, sign up the first admin with an email/password account and complete email verification. Google sign-in also works if that account's email is verified.
2. In Firebase Console > Project settings > Service accounts, generate a service account private key. Keep it outside this repository. Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the **entire JSON** in your local shell and in Netlify's environment variables for Functions. Do not place it in HTML, JavaScript, or `netlify.toml`.
3. Run `npm install` from the repository root, then `node scripts/grant-first-admin.mjs admin@example.com`, replacing the email with the first admin's existing verified account. Sign out and sign back in so Firebase refreshes the role.
4. Deploy from this repository root through Netlify's Git integration or Netlify CLI. Netlify uses `netlify.toml` to publish `Logic_Legends_Web/` and deploy `netlify/functions/`. Uploading only the public website folder will **not** deploy the account grant function.
5. The first admin can open Dashboard > Dashboard accounts, enter another existing verified account's email, and grant access. That person then signs in again. New people should sign up and verify their email first.

No service account key is included in the site. The static dashboard currently contains sample data in its HTML, so client-side visibility is suitable for navigation and presentation only. Move any real private dashboard data behind a server endpoint or Firebase Security Rules that also require the admin claim.
