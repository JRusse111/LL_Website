import { createEducationHandler } from '../netlify/lib/education.mjs';
import { createModerationHandler } from '../netlify/lib/moderation.mjs';
import { createDashboardAccountsHandler } from '../netlify/lib/dashboard-accounts.mjs';
const clone = value => value == null ? null : structuredClone(value);
export function fakeDb(initial = {}) {
    const data = clone(initial), changes = []; let serial = 0;
    function ref(path = '', query = {}) {
        const keys = path.split('/').filter(Boolean);
        function value() { let v = data; for (const k of keys) v = v?.[k]; return clone(v); }
        function assign(next) {
            let target = data; for (const k of keys.slice(0, -1)) target = target[k] ||= {};
            if (next === null) delete target[keys.at(-1)]; else target[keys.at(-1)] = clone(next);
            changes.push(path);
        }
        return {
            key: keys.at(-1), child: key => ref(`${path}/${key}`),
            async get() {
                let val = value();
                if (val && Object.keys(query).length) {
                    let entries = Object.entries(val);
                    if (query.child) entries.sort((a, b) => (a[1]?.[query.child] ?? -Infinity) - (b[1]?.[query.child] ?? -Infinity));
                    else entries.sort(([a], [b]) => a.localeCompare(b));
                    if (Object.hasOwn(query, 'equal')) entries = entries.filter(([, v]) => v?.[query.child] === query.equal);
                    if (query.before) entries = entries.filter(([k]) => k < query.before);
                    if (query.last) entries = entries.slice(-query.last);
                    val = Object.fromEntries(entries);
                }
                return { val: () => clone(val) };
            },
            async set(next) { assign(next); },
            async update(next) { assign({ ...value(), ...next }); },
            async remove() { assign(null); },
            async transaction(fn) { const next = fn(value()); if (next === undefined) return { committed: false, snapshot: { val: value } }; assign(next); return { committed: true, snapshot: { val: value } }; },
            push() { return ref(`${path}/p${String(++serial).padStart(8, '0')}`); },
            orderByChild(child) { return ref(path, { ...query, child }); },
            orderByKey() { return ref(path, query); }, equalTo(equal) { return ref(path, { ...query, equal }); },
            endBefore(before) { return ref(path, { ...query, before }); }, limitToLast(last) { return ref(path, { ...query, last }); }
        };
    }
    return { data, changes, ref };
}
export const user = (uid, claims = {}, extras = {}) => ({ uid, email: `${uid}@ncst.edu.ph`, displayName: uid, emailVerified: true, disabled: false, customClaims: claims, ...extras });
export function setup(initial = {}) {
    const users = new Map([user('owner', { super_admin: true, admin: true }), user('teacher', { instructor: true }), user('other', { instructor: true }), user('admin', { admin: true }), user('player'), user('outsider')].map(u => [u.uid, u]));
    const db = fakeDb(initial), sent = [], revoked = []; let next = 0;
    const auth = {
        async verifyIdToken(token, check) { if (!users.has(token) || check && users.get(token).revoked) throw { code: 'auth/id-token-revoked' }; return { uid: token, super_admin: true }; },
        async getUser(uid) { if (!users.has(uid)) throw { code: 'auth/user-not-found' }; return clone(users.get(uid)); },
        async getUserByEmail(email) { const u = [...users.values()].find(u => u.email.toLowerCase() === email.toLowerCase()); if (!u) throw { code: 'auth/user-not-found' }; return clone(u); },
        async createUser(input) { if ([...users.values()].some(u => u.email === input.email)) throw { code: 'auth/email-already-exists' }; const u = user(`created${++next}`, {}, input); users.set(u.uid, u); return clone(u); },
        async updateUser(uid, values) { Object.assign(users.get(uid), values); return clone(users.get(uid)); },
        async setCustomUserClaims(uid, claims) { users.get(uid).customClaims = clone(claims); },
        async revokeRefreshTokens(uid) { revoked.push(uid); },
        async listUsers(limit, cursor) { const list = [...users.values()]; const start = Number(cursor || 0); return { users: clone(list.slice(start, start + limit)), pageToken: start + limit < list.length ? String(start + limit) : undefined }; },
        async generateEmailVerificationLink(email) { return `https://firebase.test/verify?email=${encodeURIComponent(email)}`; },
        async generatePasswordResetLink(email) { return `https://firebase.test/reset?email=${encodeURIComponent(email)}`; }
    };
    const sendInvitation = async payload => { sent.push(payload); };
    const deps = { getAuth: () => auth, getDb: () => db, sendInvitation, pointsField: 'points', logger: { error() {}, warn() {} }, now: () => 1800000000000 };
    const education = createEducationHandler(deps), moderation = createModerationHandler(deps), accounts = createDashboardAccountsHandler(deps);
    async function call(action, { method = 'GET', body, uid = 'owner', endpoint = 'education', params = {} } = {}) {
        const url = new URL(`https://site.test/.netlify/functions/${endpoint}`); if (action) url.searchParams.set('action', action); for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        const res = await ({ education, moderation, accounts })[endpoint](new Request(url, { method, headers: { ...(uid ? { Authorization: `Bearer ${uid}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }));
        return { status: res.status, data: await res.json() };
    }
    return { users, auth, db, sent, revoked, call, deps };
}
