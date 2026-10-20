import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = 'logic-legends-ac66c';

function adminAuth() {
  if (!getApps().length) {
    const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawCredential) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing');
    const serviceAccount = JSON.parse(rawCredential);
    if (serviceAccount.project_id !== PROJECT_ID) throw new Error('Firebase service account has the wrong project ID');
    initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  }
  return getAuth();
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default async function grantDashboardAccess(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const bearer = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return json({ error: 'Sign in as an admin first.' }, 401);

  let auth;
  try {
    auth = adminAuth();
  } catch (error) {
    console.error('Admin SDK configuration failed:', error);
    return json({ error: 'Account management is not configured yet.' }, 503);
  }

  try {
    const caller = await auth.verifyIdToken(bearer, true);
    if (caller.admin !== true || caller.email_verified !== true) {
      return json({ error: 'Admin access is required.' }, 403);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Enter a valid email address.' }, 400);
    }
    const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json({ error: 'Enter a valid email address.' }, 400);
    }

    let target;
    try {
      target = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return json({ error: 'No account uses that email. Ask them to sign up and verify their email first.' }, 404);
      }
      throw error;
    }
    if (target.disabled) return json({ error: 'This account is disabled.' }, 400);
    if (!target.emailVerified) return json({ error: 'This account must verify its email first.' }, 400);
    if (target.customClaims?.admin === true) return json({ alreadyAdmin: true });

    await auth.setCustomUserClaims(target.uid, { ...target.customClaims, admin: true });
    console.info('Dashboard access granted', { by: caller.uid, to: target.uid });
    return json({ alreadyAdmin: false });
  } catch (error) {
    if (error.code?.startsWith('auth/id-token-') || error.code === 'auth/argument-error') {
      return json({ error: 'Your session has expired. Sign in again.' }, 401);
    }
    console.error('Unable to grant dashboard access:', error);
    return json({ error: 'Access could not be granted. Try again later.' }, 500);
  }
}
