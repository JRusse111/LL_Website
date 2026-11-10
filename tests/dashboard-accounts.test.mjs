import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardAccountsHandler } from '../netlify/lib/dashboard-accounts.mjs';

const logger = { info() {}, warn() {}, error() {} };
const record = (uid, claims = {}, extra = {}) => ({ uid, email: `${uid}@ncst.edu.ph`, emailVerified: true, disabled: false, customClaims: claims, ...extra });

function setup({ caller = 'owner', overrides = {}, listPage, verifyFailure = false, revokeFailure = false } = {}) {
    const users = new Map([
        record('owner', { admin: true, super_admin: true }),
        record('staff', { admin: true, game_level: 4 }),
        record('coowner', { admin: true, super_admin: true, game_level: 8 }),
        record('player', { game_level: 3 }),
        record('pending', {}, { emailVerified: false }),
        record('disabled', {}, { disabled: true })
    ].map(user => [user.uid, user]));
    for (const [uid, value] of Object.entries(overrides)) users.set(uid, { ...users.get(uid), ...value });
    const writes = [], revocations = [], verifications = [];
    const auth = {
        async verifyIdToken(token, revoked) {
            verifications.push({ token, revoked });
            if (verifyFailure) throw { code: 'auth/id-token-revoked' };
            // Intentionally return an old super-admin token even for demoted callers.
            return { uid: caller, super_admin: true, email_verified: true };
        },
        async getUser(uid) {
            if (!users.has(uid)) throw { code: 'auth/user-not-found' };
            return structuredClone(users.get(uid));
        },
        async getUserByEmail(email) {
            const user = [...users.values()].find(user => user.email.toLowerCase() === email.toLowerCase());
            if (!user) throw { code: 'auth/user-not-found' };
            return structuredClone(user);
        },
        async listUsers(limit, cursor) {
            assert.equal(limit, 1000);
            return listPage ? listPage(cursor) : { users: [...users.values()] };
        },
        async setCustomUserClaims(uid, claims) {
            writes.push({ uid, claims });
            users.get(uid).customClaims = claims;
        },
        async revokeRefreshTokens(uid) {
            revocations.push(uid);
            if (revokeFailure) throw { code: 'auth/internal-error' };
        }
    };
    const handler = createDashboardAccountsHandler({ getAuth: () => auth, logger });
    async function call(method = 'GET', body, { token = 'test-token', cursor } = {}) {
        const url = new URL('https://example.test/.netlify/functions/dashboard-accounts');
        if (cursor) url.searchParams.set('cursor', cursor);
        const response = await handler(new Request(url, {
            method,
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {})
        }));
        return { status: response.status, data: await response.json(), headers: response.headers };
    }
    return { call, handler, users, writes, revocations, verifications };
}

test('unauthenticated requests never disclose the account list', async () => {
    const { call, writes } = setup();
    const result = await call('GET', undefined, { token: null });
    assert.equal(result.status, 401);
    assert.equal(result.data.accounts, undefined);
    assert.deepEqual(writes, []);
});

test('every operation rejects players, admins and stale super-admin tokens', async () => {
    for (const caller of ['player', 'staff']) {
        for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
            const { call, writes } = setup({ caller });
            const response = await call(method, method === 'GET' ? undefined : { email: 'player@ncst.edu.ph', uid: 'staff', role: 'super_admin' });
            assert.equal(response.status, 403, `${caller} ${method}`);
            assert.equal(response.data.accounts, undefined);
            assert.deepEqual(writes, []);
        }
    }
});

test('unverified or disabled super admins cannot manage accounts', async () => {
    for (const override of [{ emailVerified: false }, { disabled: true }]) {
        const { call } = setup({ overrides: { owner: override } });
        assert.equal((await call()).status, 403);
    }
});

test('revoked tokens are rejected, and revocation checking is enabled', async () => {
    const { call, verifications } = setup({ verifyFailure: true });
    assert.equal((await call()).status, 401);
    assert.deepEqual(verifications, [{ token: 'test-token', revoked: true }]);
});

test('lists only administrators and exposes only the required account fields', async () => {
    const { call } = setup({ overrides: { owner: { passwordHash: 'secret', customClaims: { admin: true, super_admin: true, private_value: 'hidden' } } } });
    const response = await call();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(response.data.accounts.map(account => account.uid).sort(), ['coowner','owner','staff']);
    assert.equal(response.data.nextCursor, null);
    assert.ok(!JSON.stringify(response.data).includes('private_value'));
    assert.ok(!JSON.stringify(response.data).includes('passwordHash'));
});

test('preserves pagination even when a page has no administrators', async () => {
    const { call } = setup({ listPage(cursor) {
        return cursor ? { users: [record('lastadmin', { admin: true })] } : { users: [record('ordinary')], pageToken: 'next-page' };
    } });
    const first = await call();
    assert.deepEqual(first.data.accounts, []);
    assert.equal(first.data.nextCursor, 'next-page');
    const second = await call('GET', undefined, { cursor: first.data.nextCursor });
    assert.equal(second.data.accounts[0].uid, 'lastadmin');
});

test('adds an existing verified player without discarding game claims', async () => {
    const { call, writes, revocations } = setup();
    const response = await call('POST', { email: ' player@ncst.edu.ph ', role: 'admin' });
    assert.equal(response.status, 200);
    assert.equal(response.data.account.role, 'admin');
    assert.deepEqual(writes, [{ uid: 'player', claims: { game_level: 3, admin: true } }]);
    assert.deepEqual(revocations, ['player']);
});

test('can promote an administrator to super admin', async () => {
    const { call, users } = setup();
    assert.equal((await call('PATCH', { uid: 'staff', role: 'super_admin', expectedRole: 'admin' })).status, 200);
    assert.deepEqual(users.get('staff').customClaims, { game_level: 4, admin: true, super_admin: true });
});

test('demotion removes the old super-admin claim', async () => {
    const { call, users } = setup();
    const response = await call('PATCH', { uid: 'coowner', role: 'admin', expectedRole: 'super_admin' });
    assert.equal(response.status, 200);
    assert.equal(response.data.account.role, 'admin');
    assert.deepEqual(users.get('coowner').customClaims, { game_level: 8, admin: true });
});

test('remove access preserves the player account and unrelated claims', async () => {
    const { call, users, revocations } = setup();
    const response = await call('DELETE', { uid: 'coowner', expectedRole: 'super_admin' });
    assert.equal(response.status, 200);
    assert.equal(response.data.removed, true);
    assert.equal(response.data.account.role, null);
    assert.deepEqual(users.get('coowner').customClaims, { game_level: 8 });
    assert.equal(users.has('coowner'), true);
    assert.deepEqual(revocations, ['coowner']);
});

test('a super admin cannot demote or remove their own access', async () => {
    const { call, writes } = setup();
    for (const method of ['PATCH','DELETE']) assert.equal((await call(method, { uid: 'owner', role: 'admin' })).status, 409);
    assert.deepEqual(writes, []);
});

test('stale edits and duplicate grants are rejected instead of overwriting current roles', async () => {
    const { call, writes } = setup();
    assert.equal((await call('PATCH', { uid: 'staff', role: 'super_admin', expectedRole: 'super_admin' })).status, 409);
    assert.equal((await call('POST', { email: 'coowner@ncst.edu.ph', role: 'admin' })).status, 409);
    assert.deepEqual(writes, []);
});

test('validates accounts, roles and payloads before writing claims', async () => {
    const { call, writes } = setup();
    for (const [body, expected] of [

        [{ email: 'disabled@ncst.edu.ph', role: 'admin' }, 409],
        [{ email: 'missing@ncst.edu.ph', role: 'admin' }, 400],
        [{ email: 'player@ncst.edu.ph', role: 'owner' }, 400],
        [{ email: 'bad email', role: 'admin' }, 400]
    ]) assert.equal((await call('POST', body)).status, expected);
    assert.equal((await call('PATCH', { uid: '', role: 'admin' })).status, 400);
    assert.equal((await call('DELETE', { uid: 'player' })).status, 409);
    assert.deepEqual(writes, []);
});

test('a role saved before a revocation failure is reported as saved', async () => {
    const { call, users } = setup({ revokeFailure: true });
    const response = await call('DELETE', { uid: 'staff' });
    assert.equal(response.status, 200);
    assert.equal(response.data.sessionRevocationPending, true);
    assert.deepEqual(users.get('staff').customClaims, { game_level: 4 });
});

test('missing backend credentials produce an explicit unavailable response', async () => {
    const handler = createDashboardAccountsHandler({ getAuth() { throw new Error('missing'); }, logger });
    const response = await handler(new Request('https://example.test', { headers: { Authorization: 'Bearer test-token' } }));
    assert.equal(response.status, 503);
});
