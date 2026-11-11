import { fail, json, bodyOf, session, isSuper, isPlatformAdmin, roleOf, key } from './access.mjs';
const CAPABILITIES = ['game'];
export function createModerationHandler({ getAuth, getDb, now = Date.now, logger = console }) {
    return async request => {
        try {
            const auth = getAuth(), db = getDb(), caller = await session(request, auth, db);
            if (!isPlatformAdmin(caller)) throw fail('Admin access is required.', 403);
            if (request.method === 'GET') {
                const url = new URL(request.url), search = (url.searchParams.get('search') || '').trim().toLowerCase();
                const cursor = url.searchParams.get('cursor') || undefined;
                if (cursor && cursor.length > 2048) throw fail('Invalid search cursor.');
                const exact = url.searchParams.get('uid');
                if (exact != null) {
                    let user;
                    const uid = key(exact);
                    try { user = await auth.getUser(uid); }
                    catch (error) { if (error.code === 'auth/user-not-found') throw fail('Player not found.', 404); throw error; }
                    return json({ managementRole: roleOf(caller.customClaims), managementUid: caller.uid, players: [{ uid, email: user.email || '', name: user.displayName || '', disabled: user.disabled,
                        role: roleOf(user.customClaims), moderation: (await db.ref(`website/moderation/${uid}`).get()).val() || {} }] });
                }
                const page = await auth.listUsers(100, cursor);
                const users = page.users.filter(u => !search || `${u.email || ''} ${u.displayName || ''} ${u.uid}`.toLowerCase().includes(search));
                const players = await Promise.all(users.map(async user => ({ uid: user.uid, email: user.email || '', name: user.displayName || '', disabled: user.disabled,
                    role: roleOf(user.customClaims), moderation: (await db.ref(`website/moderation/${user.uid}`).get()).val() || {} })));
                return json({ players, nextCursor: page.pageToken || null, capabilities: CAPABILITIES, managementRole: roleOf(caller.customClaims), managementUid: caller.uid });
            }
            if (request.method !== 'POST') throw fail('Method not allowed.', 405);
            const data = await bodyOf(request), uid = key(data.uid), action = data.action;
            if (!['ban', 'unban', 'restrict', 'unrestrict'].includes(action)) throw fail('Choose a valid moderation action.');
            const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
            if (reason.length < 5 || reason.length > 500 || data.confirm !== true) throw fail('Enter a reason (5–500 characters) and confirm the action.');
            const target = await auth.getUser(uid);
            if (uid === caller.uid || isSuper(target)) throw fail('You cannot moderate your own account or another super admin.', 409);
            if (!isSuper(caller) && roleOf(target.customClaims) !== 'player') {
                throw fail('Admins can only moderate player and student accounts. Super Admin access is required to moderate staff accounts.', 403);
            }
            const ref = db.ref(`website/moderation/${uid}`), current = (await ref.get()).val() || {};
            let capabilities = [], expiresAt = null;
            if (action === 'restrict') {
                capabilities = [...new Set(Array.isArray(data.capabilities) ? data.capabilities : [])];
                if (!capabilities.length || capabilities.some(c => !CAPABILITIES.includes(c))) throw fail('Choose supported website capabilities.');
                if (data.expiresAt != null) {
                    if (!Number.isSafeInteger(data.expiresAt) || data.expiresAt <= now() || data.expiresAt > now() + 366 * 86400000) throw fail('Choose an expiration within the next year.');
                    expiresAt = data.expiresAt;
                }
            }
            const audit = db.ref('website/moderationAudit').push();
            await audit.set({ actor: caller.uid, target: uid, action, reason, timestamp: now(), expiresAt, capabilities, status: 'pending' });
            try {
                if (action === 'ban') {
                    // Persist the web gate first; failed Auth calls cannot reopen website access.
                    await ref.child('ban').set({ active: true, by: caller.uid, reason, at: now(), expiresAt: null, originallyDisabled: current.ban?.active ? !!current.ban.originallyDisabled : !!target.disabled });
                    await auth.updateUser(uid, { disabled: true });
                    await auth.revokeRefreshTokens(uid);
                    const revoked = await auth.getUser(uid);
                    const revokedAt = Date.parse(revoked.tokensValidAfterTime || '');
                    if (Number.isFinite(revokedAt)) await ref.child('sessionsRevokedAt').set(Math.floor(revokedAt / 1000));
                } else if (action === 'unban') {
                    if (current.ban?.active && !current.ban.originallyDisabled) await auth.updateUser(uid, { disabled: false });
                    await ref.child('ban').update({ active: false, by: caller.uid, reason, at: now() });
                    // Deliberately retain the separate restriction.
                } else if (action === 'restrict') {
                    await ref.child('restriction').set({ active: true, by: caller.uid, reason, at: now(), expiresAt, capabilities, gameBlocked: capabilities.includes('game') });
                } else await ref.child('restriction').update({ active: false, by: caller.uid, reason, at: now() });
                await audit.update({ status: 'completed' });
            } catch (error) {
                await audit.update({ status: 'enforcement-pending' }).catch(() => {});
                logger.error('Moderation requires reconciliation:', { action, uid, code: error.code });
                throw fail('The action is recorded but enforcement needs administrator review. Refresh its status before retrying.', 503);
            }
            return json({ uid, moderation: (await ref.get()).val() || {}, disabled: (await auth.getUser(uid)).disabled });
        } catch (error) {
            if (!error.status) logger.error('Moderation request failed:', { code: error.code });
            return json({ error: error.status ? error.message : 'Moderation is unavailable.' }, error.status || 503);
        }
    };
}
