import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export function adminAuth() {
  if (!getApps().length) {
    const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawCredential) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing');
    const serviceAccount = JSON.parse(rawCredential);
    if (serviceAccount.project_id !== 'logic-legends-ac66c') throw new Error('Wrong Firebase project');
    initializeApp({ credential: cert(serviceAccount), projectId: 'logic-legends-ac66c' });
  }
  return getAuth();
}
