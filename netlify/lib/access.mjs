import { normalizeEmail } from '../../Logic_Legends_Web/JS/account-policy.mjs';
export const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export function roleOf(claims = {}) {
    return claims.super_admin === true ? 'super_admin' : claims.admin === true ? 'admin' : claims.instructor === true ? 'instructor' : 'player';
}
export const isStaff = user => ['super_admin', 'admin', 'instructor'].includes(roleOf(user.customClaims));
export const isSuper = user => roleOf(user.customClaims) === 'super_admin';
export async function bodyOf(request) {
    const raw = await request.text();
    if (raw.length > 16000) throw fail('Request is too large.', 413);
    try { return JSON.parse(raw); } catch { throw fail('Enter valid details.'); }
}
export function key(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw fail('Invalid record.');
    return value;
}
export async function session(request, auth, db, capability, now = Date.now(), allowUnverified = false) {
    const bearer = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!bearer) throw fail('Sign in first.', 401);
    let user;
    try { const token = await auth.verifyIdToken(bearer, true); user = await auth.getUser(token.uid); }
    catch { throw fail('Your session has expired. Sign in again.', 401); }
    if (user.disabled || !allowUnverified && !user.emailVerified) throw fail('Verify your email and sign in with an enabled account.', 403);
    try { normalizeEmail(user.email); }
    catch {
        if (!isStaff(user)) throw fail('Use an @ncst.edu.ph account unless a super admin has granted you staff access.', 403);
    }
    const moderation = db ? (await db.ref(`website/moderation/${user.uid}`).get()).val() || {} : {};
    if (moderation.ban?.active) throw fail('This account is banned. Contact the administrator.', 403);
    const restriction = moderation.restriction;
    if (capability && restriction?.active && (!restriction.expiresAt || restriction.expiresAt > now) && restriction.capabilities?.includes(capability)) {
        throw fail(`Your ${capability} access is restricted. Contact the administrator.`, 403);
    }
    return user;
}
export async function ownedSection(db, caller, id) {
    const section = (await db.ref(`website/sections/${key(id)}`).get()).val();
    if (!section || !isStaff(caller) || !isSuper(caller) && section.ownerUid !== caller.uid) throw fail('Section access is not permitted.', 403);
    return section;
}
export async function authorizeProfile(db, caller, uid) {
    key(uid);
    if (caller.uid === uid || isSuper(caller)) return;
    if (!isStaff(caller)) throw fail('Profile access is not permitted.', 403);
    const sections = (await db.ref('website/sections').orderByChild('ownerUid').equalTo(caller.uid).get()).val() || {};
    if (!Object.values(sections).some(s => s.students?.[uid])) throw fail('This player is not enrolled in your sections.', 403);
}
