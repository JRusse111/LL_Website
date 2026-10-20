import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = 'logic-legends-ac66c';
const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const email = process.argv[2]?.trim();

if (!rawCredential) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT_JSON to the service account JSON before running this script.');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(rawCredential);
  if (serviceAccount.project_id !== projectId) throw new Error('Wrong Firebase project');
  initializeApp({ credential: cert(serviceAccount), projectId });
  const auth = getAuth();

  function roleOf(user) {
    if (user.customClaims?.super_admin === true) return 'super_admin';
    if (user.customClaims?.admin === true) return 'admin';
    return 'none';
  }

  console.log('Email\tRole');
  if (email) {
    const user = await auth.getUserByEmail(email);
    console.log(`${user.email}\t${roleOf(user)}`);
  } else {
    let pageToken;
    do {
      const page = await auth.listUsers(1000, pageToken);
      for (const user of page.users) {
        const role = roleOf(user);
        if (role !== 'none') console.log(`${user.email || user.uid}\t${role}`);
      }
      pageToken = page.pageToken;
    } while (pageToken);
  }
} catch (error) {
  console.error('Could not read dashboard roles:', error.message);
  process.exitCode = 1;
}
