import { beforeUserCreated, beforeUserSignedIn } from 'firebase-functions/v2/identity';
import { HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { normalizeEmail } from './account-policy.mjs';
const app = getApps()[0] || initializeApp({ databaseURL: 'https://logic-legends-ac66c-default-rtdb.asia-southeast1.firebasedatabase.app' });
function requireNcst(user) {
    try { normalizeEmail(user?.email); }
    catch { throw new HttpsError('permission-denied', 'Use your @ncst.edu.ph account.'); }
}
// Requires Firebase Authentication with Identity Platform. Not deployed automatically.
export const ncstBeforeCreate = beforeUserCreated(event => { requireNcst(event.data); });
export const ncstBeforeSignIn = beforeUserSignedIn(async event => {
    requireNcst(event.data);
    const ban = (await getDatabase(app).ref(`website/moderation/${event.data.uid}/ban/active`).get()).val();
    if (ban === true) throw new HttpsError('permission-denied', 'This account is banned. Contact the administrator.');
});
