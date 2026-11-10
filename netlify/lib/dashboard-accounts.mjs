import { canManageAccounts, claimsForRole, claimsWithoutDashboardAccess, grantedRole } from './role-permissions.mjs';
import { session, bodyOf, json, fail, key } from './access.mjs';
import { ensureIdentity, invite } from './provision.mjs';
import { normalizeAnyEmail, nameParts } from '../../Logic_Legends_Web/JS/account-policy.mjs';
function view(user) { return { uid: user.uid, email: user.email || '', displayName: user.displayName || '', role: grantedRole(user.customClaims), emailVerified: user.emailVerified === true, disabled: user.disabled === true }; }
export function createDashboardAccountsHandler({ getAuth, getDb, sendInvitation, logger = console }) {
    return async request => {
        if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
        try {
            const auth = getAuth(), db = getDb?.(), caller = await session(request, auth, db);
            if (!canManageAccounts({ ...caller.customClaims, email_verified: caller.emailVerified })) throw fail('Super admin access is required.', 403);
            if (request.method === 'GET') {
                const cursor = new URL(request.url).searchParams.get('cursor') || undefined;
                if (cursor && cursor.length > 2048) throw fail('Invalid account list cursor.');
                const page = await auth.listUsers(1000, cursor);
                return json({ accounts: page.users.filter(u => grantedRole(u.customClaims)).map(view), nextCursor: page.pageToken || null });
            }
            const data = await bodyOf(request), removing = request.method === 'DELETE', role = data.role;
            if (!removing && !['admin', 'super_admin', 'instructor'].includes(role)) throw fail('Choose a valid dashboard role.');
            let target, created = false;
            if (request.method === 'POST') {
                const provisioned = await ensureIdentity(auth, normalizeAnyEmail(data.email), data, sendInvitation, { allowNonNcst: true });
                target = provisioned.user; created = provisioned.created;
                if (target.uid === caller.uid) throw fail('You cannot change your own super admin access.', 409);
                if (grantedRole(target.customClaims) && !data.resendInvitation) throw fail('This account already has dashboard access. Edit its role in the list.', 409);
                if (grantedRole(target.customClaims) && grantedRole(target.customClaims) !== role) throw fail('Use Save role to change an existing role.', 409);
                if (db) {
                    const names = nameParts(data);
                    if (names.surname && names.firstName) await db.ref(`users/${target.uid}/profile`).transaction(old => old?.surname && old?.firstName ? old : { ...old, ...names });
                }
            } else {
                const uid = key(data.uid);
                if (uid === caller.uid) throw fail('You cannot change or remove your own super admin access.', 409);
                target = await auth.getUser(uid);
                if (!grantedRole(target.customClaims)) throw fail('This account no longer has dashboard access.', 409);
                if (data.expectedRole !== undefined && data.expectedRole !== grantedRole(target.customClaims)) throw fail('This role has changed. Refresh before editing it.', 409);
            }
            if (!removing) normalizeAnyEmail(target.email);
            if (!removing && target.disabled) throw fail('Resolve this account’s disabled status first.', 409);
            // Provisioned users can receive claims now, but no access until email ownership is verified.
            const claims = removing ? claimsWithoutDashboardAccess(target.customClaims) : claimsForRole(target.customClaims, role);
            const audit = db?.ref('website/roleAudit').push();
            if (audit) await audit.set({ by: caller.uid, uid: target.uid, from: grantedRole(target.customClaims), role: removing ? 'player' : role, at: Date.now(), status: 'pending' });
            await auth.setCustomUserClaims(target.uid, claims);
            let sessionRevocationPending = false;
            try { await auth.revokeRefreshTokens(target.uid); } catch { sessionRevocationPending = true; }
            if (audit) await audit.update({ status: 'completed', sessionRevocationPending });
            const activation = !removing && request.method === 'POST' && !target.emailVerified ? await invite(auth, target, sendInvitation) : { activationRequired: !target.emailVerified };
            return json({ account: view({ ...target, customClaims: claims }), created, removed: removing, sessionRevocationPending, ...activation });
        } catch (error) {
            if (error.code === 'auth/user-not-found') return json({ error: 'Account not found.' }, 404);
            if (error.code === 'auth/invalid-page-token') return json({ error: 'Refresh the account list.' }, 400);
            if (!error.status) logger.error('Account management failed:', { code: error.code });
            return json({ error: error.status ? error.message : 'Account management is not configured or is unavailable.' }, error.status || 503);
        }
    };
}
