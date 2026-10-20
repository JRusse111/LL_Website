import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = 'logic-legends-ac66c';

export function adminAuth() {
  if (!getApps().length) {
    const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawCredential) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing');
    const serviceAccount = JSON.parse(rawCredential);
    if (serviceAccount.project_id !== PROJECT_ID) throw new Error('Firebase service account has the wrong project ID');
    initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  }
  return getAuth();
}
