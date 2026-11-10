import { createHash } from 'node:crypto';
import { normalizeEmail, nameParts, formatName } from '../../Logic_Legends_Web/JS/account-policy.mjs';
import { fail, json, bodyOf, session, isStaff, isSuper, isPlatformAdmin, isInstructor, ownedSection, authorizeProfile, key } from './access.mjs';
import { ensureIdentity, invite } from './provision.mjs';
import { playerProgress, sectionOverview } from './progress.mjs';

const trim = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
async function profile(db, auth, uid) {
    const [data, user] = await Promise.all([db.ref(`users/${key(uid)}`).get(), auth.getUser(uid)]);
    return playerProgress(uid, data.val() || {}, user);
}
async function saveNames(db, uid, names) {
    const n = nameParts(names);
    if (!n.surname || !n.firstName) return;
    // Only profile fields; never replace users/UID (wallet, trials, inventory live there).
    await db.ref(`users/${uid}/profile`).transaction(current => current?.surname && current?.firstName ? current : { ...current, ...n });
}
export function createEducationHandler({ getAuth, getDb, sendInvitation, pointsField = process.env.LEADERBOARD_POINTS_FIELD, now = Date.now, logger = console }) {
    return async request => {
        if (!['GET', 'POST', 'DELETE', 'PATCH'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
        try {
            const auth = getAuth(), db = getDb(), url = new URL(request.url);
            const action = url.searchParams.get('action') || 'session';
            const capability = ['instructors', 'sections', 'section', 'enroll'].includes(action) ? 'dashboard' : action === 'feedback' && request.method === 'POST' ? 'feedback' : undefined;
            const caller = await session(request, auth, db, capability, now(), action === 'profile-setup' && request.method === 'PATCH');
            const data = request.method === 'GET' ? {} : await bodyOf(request);
            if (action === 'profile-setup' && request.method === 'PATCH') {
                if (isInstructor(caller)) throw fail('Instructor accounts use the dashboard only.', 403);
                const names = nameParts(data);
                if (!names.surname || !names.firstName) throw fail('Enter your surname and first name.');
                await saveNames(db, caller.uid, names);
                return json({ saved: true });
            }
            if (action === 'session' && request.method === 'GET') return json({ uid: caller.uid, role: isSuper(caller) ? 'super_admin' : caller.customClaims?.admin ? 'admin' : caller.customClaims?.instructor ? 'instructor' : 'player' });
            if (action === 'profile' && request.method === 'GET') {
                const uid = url.searchParams.get('uid') || caller.uid;
                if (isInstructor(caller) && (!url.searchParams.has('uid') || uid === caller.uid)) throw fail('Open an enrolled learner from your Instructor Dashboard.', 403);
                await authorizeProfile(db, caller, uid);
                if (uid !== caller.uid && !isPlatformAdmin(caller)) await session(request, auth, db, 'dashboard', now());
                return json({ player: await profile(db, auth, uid) });
            }
            if (action === 'profile' && request.method === 'PATCH') {
                if (isInstructor(caller)) throw fail('Instructor accounts use the dashboard only.', 403);
                const names = nameParts(data);
                if (!names.surname || !names.firstName) throw fail('Enter your surname and first name.');
                await db.ref(`users/${caller.uid}/profile`).update(names);
                return json({ player: await profile(db, auth, caller.uid) });
            }
            if (action === 'instructors' && request.method === 'GET') {
                if (!isPlatformAdmin(caller)) throw fail('Admin access is required to browse instructor accounts.', 403);
                const sections = (await db.ref('website/sections').get()).val() || {};
                const sectionCounts = new Map();
                for (const section of Object.values(sections)) sectionCounts.set(section.ownerUid, (sectionCounts.get(section.ownerUid) || 0) + 1);
                const instructors = [];
                let pageToken;
                do {
                    const page = await auth.listUsers(1000, pageToken);
                    for (const user of page.users) {
                        if (user.customClaims?.instructor !== true) continue;
                        instructors.push({ uid: user.uid, email: user.email || '', displayName: user.displayName || '', disabled: user.disabled === true, emailVerified: user.emailVerified === true, sectionCount: sectionCounts.get(user.uid) || 0 });
                    }
                    pageToken = page.pageToken;
                } while (pageToken);
                instructors.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
                return json({ instructors });
            }
            if (action === 'sections') {
                if (!isStaff(caller)) throw fail('Instructor access is required.', 403);
                if (request.method === 'GET') {
                    let ref = db.ref('website/sections');
                    if (isPlatformAdmin(caller)) {
                        const instructorUid = url.searchParams.get('instructorUid');
                        if (instructorUid) {
                            const instructor = await auth.getUser(key(instructorUid));
                            if (instructor.customClaims?.instructor !== true) throw fail('Choose an Instructor account.', 400);
                            ref = ref.orderByChild('ownerUid').equalTo(instructor.uid);
                        } else if (!caller.customClaims?.instructor) {
                            throw fail('Select an Instructor to view their sections.', 400);
                        } else ref = ref.orderByChild('ownerUid').equalTo(caller.uid);
                    } else ref = ref.orderByChild('ownerUid').equalTo(caller.uid);
                    const sections = (await ref.get()).val() || {};
                    return json({ sections: Object.entries(sections).map(([id, s]) => ({ id, name: s.name, ownerUid: s.ownerUid, count: Object.keys(s.students || {}).length })).sort((a, b) => a.name.localeCompare(b.name)) });
                }
                if (request.method === 'POST') {
                    const name = trim(data.name, 40).toUpperCase();
                    if (!/^[A-Z0-9][A-Z0-9 -]{1,39}$/.test(name)) throw fail('Use a section code such as BSCS-22A1.');
                    let ownerUid = caller.uid;
                    if (isPlatformAdmin(caller) && data.ownerUid) {
                        const instructor = await auth.getUser(key(data.ownerUid));
                        if (instructor.customClaims?.instructor !== true) throw fail('Choose an Instructor account to own this section.', 400);
                        ownerUid = instructor.uid;
                    } else if (isPlatformAdmin(caller) && caller.customClaims?.instructor !== true) throw fail('Choose an Instructor account first.', 400);
                    else if (!isPlatformAdmin(caller) && data.ownerUid && data.ownerUid !== caller.uid) throw fail('You can only create sections for your own account.', 403);
                    const id = createHash('sha256').update(`${ownerUid}|${name}`).digest('hex');
                    const result = await db.ref(`website/sections/${id}`).transaction(current => current ? undefined : { name, ownerUid, createdAt: now() });
                    if (!result.committed) throw fail('This section already exists.', 409);
                    return json({ section: { id, name, ownerUid, count: 0 } }, 201);
                }
            }
            if (action === 'section' && request.method === 'GET') {
                const id = url.searchParams.get('id'), section = await ownedSection(db, caller, id);
                const ids = Object.keys(section.students || {}), players = [];
                // Bound parallel Auth/RTDB calls instead of loading the entire users collection.
                for (let i = 0; i < ids.length; i += 10) {
                    players.push(...await Promise.all(ids.slice(i, i + 10).map(async uid => {
                        try { return await profile(db, auth, uid); }
                        catch (e) { if (e.code === 'auth/user-not-found') return { ...playerProgress(uid), name: 'Account unavailable' }; throw e; }
                    })));
                }
                players.sort((a, b) => (a.profile.surname || a.name).localeCompare(b.profile.surname || b.name) || (a.profile.firstName || '').localeCompare(b.profile.firstName || '') || a.uid.localeCompare(b.uid));
                return json({ section: { id, name: section.name }, players, overview: sectionOverview(players) });
            }
            if (action === 'enroll') {
                const id = key(data.sectionId);
                await ownedSection(db, caller, id);
                if (request.method === 'POST') {
                    const { user, created } = await ensureIdentity(auth, normalizeEmail(data.email), data, sendInvitation);
                    await saveNames(db, user.uid, data);
                    const enrolled = await db.ref(`website/sections/${id}/students/${user.uid}`).transaction(current => current ? undefined : { by: caller.uid, enrolledAt: now() });
                    // A duplicate does not generate another invitation or another student identity.
                    if (!enrolled.committed && !data.resendInvitation) throw fail('This student is already enrolled.', 409);
                    const activation = !user.emailVerified ? await invite(auth, user, sendInvitation) : { activationRequired: false };
                    return json({ player: await profile(db, auth, user.uid), created, alreadyEnrolled: !enrolled.committed, ...activation }, created ? 201 : 200);
                }
                if (request.method === 'DELETE') {
                    const uid = key(data.uid);
                    await db.ref(`website/sections/${id}/students/${uid}`).remove();
                    return json({ removed: true }); // Never remove Auth users, progress or another section's membership.
                }
            }
            if (action === 'feedback') {
                if (request.method === 'POST') {
                    if (isInstructor(caller)) throw fail('Instructor accounts use the dashboard only.', 403);
                    const text = trim(data.text, 2000);
                    if (text.length < 5) throw fail('Enter between 5 and 2,000 characters.');
                    const gate = await db.ref(`website/feedbackRate/${caller.uid}`).transaction(last => last && now() - last < 30000 ? undefined : now());
                    if (!gate.committed) throw fail('Please wait a moment before sending more feedback.', 429);
                    const ref = db.ref('website/feedback').push();
                    await ref.set({ uid: caller.uid, author: caller.displayName || caller.email, text, submittedAt: now(), source: 'website', version: 1 });
                    return json({ submitted: true }, 201);
                }
                if (request.method === 'GET') {
                    if (!isPlatformAdmin(caller)) throw fail('Admin access is required.', 403);
                    let ref = db.ref('website/feedback').orderByKey();
                    const before = url.searchParams.get('before');
                    if (before) ref = ref.endBefore(key(before));
                    const records = (await ref.limitToLast(100).get()).val() || {};
                    return json({ feedback: Object.entries(records).reverse().map(([id, entry]) => ({ id, ...entry })), nextCursor: Object.keys(records).length === 100 ? Object.keys(records)[0] : null });
                }
            }
            if (action === 'leaderboard' && request.method === 'GET') {
                if (isInstructor(caller)) throw fail('Instructor accounts use the dashboard only.', 403);
                // One read-only snapshot. No coins/rewards as substitutes for points and no subscriptions.
                if (!pointsField) return json({ entries: [], capturedAt: now(), configurationRequired: true });
                if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(pointsField)) throw fail('The leaderboard source is not configured correctly.', 503);
                const records = (await db.ref('users').orderByChild(pointsField).limitToLast(100).get()).val() || {};
                const entries = Object.entries(records).filter(([, p]) => Number.isFinite(p[pointsField]) && p[pointsField] >= 0)
                    .map(([uid, p]) => ({ uid, name: formatName(p.profile, p.username || 'Player'), points: p[pointsField] }))
                    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
                return json({ entries, capturedAt: now() });
            }
            throw fail('Unknown operation or method.', 405);
        } catch (error) {
            if (!error.status) logger.error('Education request failed:', { code: error.code || 'unavailable' });
            const configurationMessage = error.message === 'FIREBASE_SERVICE_ACCOUNT_JSON is missing'
                ? 'The dashboard backend is not connected. Configure FIREBASE_SERVICE_ACCOUNT_JSON in Netlify and redeploy.'
                : error.message === 'Wrong Firebase project'
                    ? 'The dashboard backend is connected to the wrong Firebase project. Check the Netlify service account.'
                    : error.code === 'PERMISSION_DENIED'
                        ? 'The dashboard backend cannot read the Firebase database. Check its service account access and database URL.'
                        : 'The service is unavailable. Check the Netlify function logs and try again.';
            return json({ error: error.status ? error.message : configurationMessage }, error.status || 503);
        }
    };
}
