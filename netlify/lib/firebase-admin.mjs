import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
function app() {
    if (!getApps().length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing');
        const serviceAccount = JSON.parse(raw);
        if (serviceAccount.project_id !== 'logic-legends-ac66c') throw new Error('Wrong Firebase project');
        initializeApp({ credential: cert(serviceAccount), projectId: 'logic-legends-ac66c', databaseURL: 'https://logic-legends-ac66c-default-rtdb.asia-southeast1.firebasedatabase.app' });
    }
    return getApps()[0];
}
export const adminAuth = () => getAuth(app());
export const adminDb = () => getDatabase(app());
