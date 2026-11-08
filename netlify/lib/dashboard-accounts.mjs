import { canManageAccounts, claimsForRole, claimsWithoutDashboardAccess, grantedRole } from './role-permissions.mjs';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Allow': 'GET, POST, PATCH, DELETE' } });
}

function accountView(user) {
  return { uid: user.uid, email: user.email || '', displayName: user.displayName || '', role: grantedRole(user.customClaims), emailVerified: user.emailVerified === true, disabled: user.disabled === true };
}

// Exercise the real handler with an injected Auth service in tests, without touching live accounts.
export function createDashboardAccountsHandler({ getAuth, logger = console }) {
  return async function dashboardAccounts(request) {
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
    const bearer = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!bearer) return json({ error: 'Sign in as a super admin first.' }, 401);

    let auth;
    try { auth = getAuth(); }
    catch (error) {
      logger.error('Admin SDK configuration failed:', error);
      return json({ error: 'Account management is not configured yet.' }, 503);
    }
    let caller;
    try {
      const token = await auth.verifyIdToken(bearer, true);
      // Read the current record so removed access cannot survive in an older token.
      caller = await auth.getUser(token.uid);
    } catch (error) {
      logger.warn('Account management session rejected:', error.code);
      return json({ error: 'Your session has expired. Sign in again.' }, 401);
    }
    if (caller.disabled || !canManageAccounts({ ...caller.customClaims, email_verified: caller.emailVerified })) return json({ error: 'Super admin access is required.' }, 403);

    try {
      if (request.method === 'GET') {
        const cursor = new URL(request.url).searchParams.get('cursor') || undefined;
        if (cursor && cursor.length > 2048) return json({ error: 'Invalid account list cursor.' }, 400);
        const page = await auth.listUsers(1000, cursor);
        return json({ accounts: page.users.filter(user => grantedRole(user.customClaims)).map(accountView), nextCursor: page.pageToken || null });
      }
      let payload;
      try { payload = await request.json(); }
      catch { return json({ error: 'Enter valid account details.' }, 400); }
      const removing = request.method === 'DELETE';
      const role = payload?.role;
      if (!removing && role !== 'admin' && role !== 'super_admin') return json({ error: 'Choose a valid dashboard role.' }, 400);

      let target;
      if (request.method === 'POST') {
        const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
        target = await auth.getUserByEmail(email);
        if (grantedRole(target.customClaims)) return json({ error: 'This account already has dashboard access. Edit its role in the list below.' }, 409);
      } else {
        const uid = payload?.uid;
        if (typeof uid !== 'string' || !uid.trim() || uid.length > 128) return json({ error: 'Choose a valid account.' }, 400);
        if (uid === caller.uid) return json({ error: 'You cannot change or remove your own super admin access.' }, 409);
        target = await auth.getUser(uid);
        if (!grantedRole(target.customClaims)) return json({ error: 'This account no longer has dashboard access. Refresh the list.' }, 409);
        if (payload.expectedRole !== undefined && payload.expectedRole !== grantedRole(target.customClaims)) return json({ error: 'This role has changed since you loaded the list. Refresh before editing it.' }, 409);
      }
      if (!removing && (target.disabled || !target.emailVerified)) return json({ error: 'The account must be enabled and its email verified before receiving a role.' }, 400);
      if (!removing && grantedRole(target.customClaims) === role) return json({ account: accountView(target), unchanged: true });

      const claims = removing ? claimsWithoutDashboardAccess(target.customClaims) : claimsForRole(target.customClaims, role);
      await auth.setCustomUserClaims(target.uid, claims);
      let sessionRevocationPending = false;
      try { await auth.revokeRefreshTokens(target.uid); }
      catch (error) {
        sessionRevocationPending = true;
        logger.error('Role saved but session revocation failed:', { uid: target.uid, code: error.code });
      }
      logger.info('Dashboard role changed', { by: caller.uid, to: target.uid, role: removing ? 'player' : role });
      return json({ account: accountView({ ...target, customClaims: claims }), removed: removing, sessionRevocationPending });
    } catch (error) {
      if (error.code === 'auth/user-not-found') return json({ error: 'Account not found. Ask them to sign up and verify their email first.' }, 404);
      if (error.code === 'auth/invalid-page-token') return json({ error: 'The account list has changed. Refresh and try again.' }, 400);
      logger.error('Account management failed:', error);
      return json({ error: 'Account management could not be completed. Try again later.' }, 500);
    }
  };
}
