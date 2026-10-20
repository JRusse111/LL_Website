import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2]?.trim();
const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!email || !rawCredential) {
  console.error('Usage: set FIREBASE_SERVICE_ACCOUNT_JSON, then run node scripts/grant-first-admin.mjs admin@example.com');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(rawCredential);
  if (serviceAccount.project_id !== 'logic-legends-ac66c') throw new Error('Wrong Firebase project');
  initializeApp({ credential: cert(serviceAccount), projectId: 'logic-legends-ac66c' });
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  if (!user.emailVerified || user.disabled) throw new Error('Account must be enabled and email-verified first');
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
  console.log(`Admin access granted to ${user.email}. Sign out and sign in again.`);
} catch (error) {
  console.error('Could not grant first admin:', error.message);
  process.exitCode = 1;
}
