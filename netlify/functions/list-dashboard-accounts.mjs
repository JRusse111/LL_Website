import { adminAuth } from '../lib/admin-auth.mjs';
import { canManageAccounts, grantedRole } from '../lib/role-permissions.mjs';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function listDashboardAccountsWithAuth(request, auth, bearer) {
  try {
    const caller = await auth.verifyIdToken(bearer, true);
    if (!canManageAccounts(caller)) return json({ error: 'Super admin access is required.' }, 403);

    const pageToken = new URL(request.url).searchParams.get('pageToken');
    if (pageToken && pageToken.length > 2048) return json({ error: 'Invalid page token.' }, 400);
    const result = await auth.listUsers(1000, pageToken || undefined);
    const accounts = result.users.flatMap(user => {
      const role = grantedRole(user.customClaims);
      return role && user.email ? [{ email: user.email, role }] : [];
    });
    return json({ accounts, nextPageToken: result.pageToken || null });
  } catch (error) {
    if (error.code?.startsWith('auth/id-token-') || error.code === 'auth/argument-error') {
      return json({ error: 'Your session has expired. Sign in again.' }, 401);
    }
    console.error('Unable to list dashboard accounts:', error);
    return json({ error: 'Dashboard accounts could not be loaded.' }, 500);
  }
}

export default async function listDashboardAccounts(request) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);

  const bearer = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return json({ error: 'Sign in as a super admin first.' }, 401);

  let auth;
  try {
    auth = adminAuth();
  } catch (error) {
    console.error('Admin SDK configuration failed:', error);
    return json({ error: 'Account management is not configured yet.' }, 503);
  }
  return listDashboardAccountsWithAuth(request, auth, bearer);
}
