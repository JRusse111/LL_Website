import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './fixtures.mjs';
import { normalizeEmail, formatName } from '../Logic_Legends_Web/JS/account-policy.mjs';
import { playerProgress, sectionOverview } from '../netlify/lib/progress.mjs';
import { createDashboardAccountsHandler } from '../netlify/lib/dashboard-accounts.mjs';
const names = { surname: 'Santos', firstName: 'Ana', middleName: 'Marie' };
test('exact NCST domain; capitalization and outer whitespace normalize to one identity', () => {
    assert.equal(normalizeEmail('  ANA@NCST.EDU.PH  '), 'ana@ncst.edu.ph');
    for (const v of ['ana@sub.ncst.edu.ph', 'ana@ncst.edu.ph.evil.com', 'ana@gmail.com', 'ana @ncst.edu.ph', '', null]) assert.throws(() => normalizeEmail(v));
    assert.equal(formatName(names), 'Santos, Ana M.'); assert.equal(formatName({ ...names, middleName: '' }), 'Santos, Ana');
});
test('statistics use receipts once, ignore admin runs and ordinary wrong answers as retries', () => {
    const account = { trialRuns: { 1: { attempts: { a: { status: 'completed', retries: 2, correctAnswers: 999, quizAnswers: { one: { correct: true }, two: { correct: false } } }, admin: { status: 'completed', adminUsed: true, correctAnswers: 99 } } }, 2: { attempts: { b: { quizAnswers: { q: { kind: 'quiz', correct: true }, t: { kind: 'table', correct: false } } } } } } };
    const p = playerProgress('p', account); assert.equal(p.completed, 1); assert.equal(p.correct, 1); assert.equal(p.incorrect, 2); assert.equal(p.trials[0].retries, 2); assert.equal(p.trials[1].correct, 0); assert.equal(p.trials[3].accuracy, null);
    const other = playerProgress('x', { trialRuns: { 1: { attempts: { a: { correctAnswers: 9, incorrectAnswers: 0 } } } } });
    const overview = sectionOverview([p, other]); assert.equal(overview.accuracy, 1000 / 12); assert.equal(overview.weakest.number, 2); assert.equal(sectionOverview([]).weakest, null);
});
test('every API requires a current enabled verified NCST identity, not stale token roles', async () => {
    const s = setup(); assert.equal((await s.call('sections', { uid: null })).status, 401);
    assert.equal((await s.call('sections', { uid: 'player' })).status, 403);
    s.users.get('teacher').email = 'teacher@gmail.com'; assert.equal((await s.call('sections', { uid: 'teacher' })).status, 403);
    s.users.get('owner').customClaims = {}; assert.equal((await s.call(null, { endpoint: 'accounts' })).status, 403);
});
test('new instructor can be provisioned without prior signup and unrelated claims survive role edits', async () => {
    const s = setup();
    const add = await s.call(null, { endpoint: 'accounts', method: 'POST', body: { email: ' NEW@ncst.edu.ph ', role: 'instructor', ...names } });
    assert.equal(add.status, 200); assert.equal(add.data.created, true); assert.equal(add.data.invitationSent, true); assert.equal(s.sent.length, 1); assert.equal(add.data.account.emailVerified, false);
    assert.equal(JSON.stringify(add.data).includes('firebase.test'), false);
    const uid = add.data.account.uid; s.users.get(uid).customClaims.game_level = 8;
    const edit = await s.call(null, { endpoint: 'accounts', method: 'PATCH', body: { uid, role: 'admin', expectedRole: 'instructor' } });
    assert.equal(edit.status, 200); assert.equal(s.users.get(uid).customClaims.game_level, 8);
    assert.equal((await s.call(null, { endpoint: 'accounts', uid: 'teacher', method: 'POST', body: { email: 'x@ncst.edu.ph', role: 'admin', ...names } })).status, 403);
    assert.equal((await s.call(null, { endpoint: 'accounts', method: 'POST', body: { email: 'owner@ncst.edu.ph', role: 'admin', resendInvitation: true } })).status, 409);
});
test('create section, link existing player immediately, prevent duplicates and remove only membership', async () => {
    const s = setup({ users: { player: { coins: 150, inventory: { epic: true }, profile: names, trialRuns: { 1: { attempts: { run: { status: 'completed', correctAnswers: 3, incorrectAnswers: 1, retries: 1 } } } } } } });
    const section = await s.call('sections', { uid: 'teacher', method: 'POST', body: { name: 'bscs-22a1' } }); assert.equal(section.status, 201); const id = section.data.section.id;
    assert.equal((await s.call('section', { uid: 'teacher', params: { id } })).data.overview.total, 0);
    assert.equal((await s.call('sections', { uid: 'teacher', method: 'POST', body: { name: 'BSCS-22A1' } })).status, 409);
    const enrolled = await s.call('enroll', { uid: 'teacher', method: 'POST', body: { sectionId: id, email: ' PLAYER@NCST.EDU.PH ' } });
    assert.equal(enrolled.status, 200); assert.equal(enrolled.data.created, false); assert.equal(enrolled.data.player.completed, 1); assert.equal(enrolled.data.player.accuracy, 75); assert.equal(s.sent.length, 0);
    assert.equal((await s.call('enroll', { uid: 'teacher', method: 'POST', body: { sectionId: id, email: 'player@ncst.edu.ph' } })).status, 409);
    assert.equal((await s.call('section', { uid: 'other', params: { id } })).status, 403);
    assert.equal((await s.call('profile', { uid: 'teacher', params: { uid: 'player' } })).status, 200);
    assert.equal((await s.call('profile', { uid: 'other', params: { uid: 'player' } })).status, 403);
    assert.equal((await s.call('enroll', { uid: 'teacher', method: 'DELETE', body: { sectionId: id, uid: 'player' } })).status, 200);
    assert.equal((await s.call('profile', { uid: 'teacher', params: { uid: 'player' } })).status, 403);
    assert.equal(s.db.data.users.player.coins, 150); assert.equal(s.db.data.users.player.inventory.epic, true); assert.equal(s.db.data.users.player.trialRuns[1].attempts.run.correctAnswers, 3); assert.ok(s.users.has('player'));
});
test('new student provisioning invites once and roster is sorted by surname then first name', async () => {
    const s = setup(); const { section } = (await s.call('sections', { uid: 'teacher', method: 'POST', body: { name: 'BSIT-22A1' } })).data;
    for (const [email, surname, firstName] of [['b@ncst.edu.ph', 'Zulu', 'Ana'], ['a@ncst.edu.ph', 'Adams', 'Zoe'], ['c@ncst.edu.ph', 'Adams', 'Amy']]) {
        assert.equal((await s.call('enroll', { uid: 'teacher', method: 'POST', body: { sectionId: section.id, email, surname, firstName } })).status, 201);
    }
    const roster = await s.call('section', { uid: 'teacher', params: { id: section.id } });
    assert.deepEqual(roster.data.players.map(p => p.name), ['Adams, Amy', 'Adams, Zoe', 'Zulu, Ana']); assert.equal(s.sent.length, 3);
    assert.equal((await s.call('enroll', { uid: 'teacher', method: 'POST', body: { sectionId: section.id, email: 'bad@gmail.com', ...names } })).status, 400);
});
test('profile data is private and self name edits never modify progress', async () => {
    const s = setup({ users: { player: { coins: 50 } } });
    assert.equal((await s.call('profile', { uid: 'player', params: { uid: 'outsider' } })).status, 403);
    const edit = await s.call('profile', { uid: 'player', method: 'PATCH', body: { ...names, role: 'super_admin', coins: 9999 } });
    assert.equal(edit.data.player.name, 'Santos, Ana M.'); assert.equal(s.db.data.users.player.coins, 50); assert.deepEqual(s.users.get('player').customClaims, {});
});
test('feedback is attributed by server and only super admin can list it', async () => {
    const s = setup(); const result = await s.call('feedback', { uid: 'player', method: 'POST', body: { uid: 'owner', submittedAt: 1, text: 'The board text is clear.' } }); assert.equal(result.status, 201);
    assert.equal((await s.call('feedback', { uid: 'teacher' })).status, 403);
    const list = await s.call('feedback'); assert.equal(list.data.feedback[0].uid, 'player'); assert.equal(list.data.feedback[0].submittedAt, 1800000000000);
    assert.equal((await s.call('feedback', { uid: 'player', method: 'POST', body: { text: 'Another message.' } })).status, 429);
});
test('leaderboard uses points only and makes no database writes', async () => {
    const s = setup({ users: { a: { username: 'First', points: 12, coins: 1 }, b: { username: 'Second', points: 2, coins: 9999 }, c: { coins: 99999 } } });
    const result = await s.call('leaderboard', { uid: 'player' }); assert.deepEqual(result.data.entries.map(p => p.name), ['First', 'Second']); assert.deepEqual(s.db.changes, []);
});
test('restrictions are capability-specific and expiration is enforced without banning', async () => {
    const s = setup(); const result = await s.call(null, { endpoint: 'moderation', method: 'POST', body: { uid: 'player', action: 'restrict', capabilities: ['feedback'], reason: 'Repeated abusive messages.', confirm: true } });
    assert.equal(result.status, 200); assert.equal(s.users.get('player').disabled, false);
    assert.equal((await s.call('feedback', { uid: 'player', method: 'POST', body: { text: 'Hello world' } })).status, 403);
    assert.equal((await s.call('profile', { uid: 'player' })).status, 200);
    s.db.data.website.moderation.player.restriction.expiresAt = 1;
    assert.equal((await s.call('feedback', { uid: 'player', method: 'POST', body: { text: 'Hello world' } })).status, 201);
});
test('ban revokes sessions, unban preserves restrictions and never deletes progress', async () => {
    const s = setup({ users: { player: { coins: 40 } } });
    for (const body of [{ action: 'restrict', capabilities: ['feedback'] }, { action: 'ban' }, { action: 'unban' }]) {
        assert.equal((await s.call(null, { endpoint: 'moderation', method: 'POST', body: { uid: 'player', reason: 'Administrator review.', confirm: true, ...body } })).status, 200);
        if (body.action === 'ban') assert.equal((await s.call('profile', { uid: 'player' })).status, 403);
    }
    assert.equal(s.users.get('player').disabled, false); assert.ok(s.revoked.includes('player')); assert.equal(s.db.data.website.moderation.player.restriction.active, true); assert.equal(s.db.data.users.player.coins, 40);
    assert.equal(Object.values(s.db.data.website.moderationAudit).length, 3);
});
test('moderation requires super admin, a reason, confirmation and supported capabilities', async () => {
    const s = setup();
    for (const uid of ['teacher', 'admin', 'player']) assert.equal((await s.call(null, { endpoint: 'moderation', uid })).status, 403);
    for (const body of [{ uid: 'player', action: 'ban', reason: 'Valid reason' }, { uid: 'player', action: 'ban', confirm: true, reason: '' }, { uid: 'player', action: 'restrict', capabilities: ['gameplay'], confirm: true, reason: 'Valid reason' }]) assert.equal((await s.call(null, { endpoint: 'moderation', method: 'POST', body })).status, 400);
    assert.equal((await s.call(null, { endpoint: 'moderation', method: 'POST', body: { uid: 'owner', action: 'ban', reason: 'Valid reason', confirm: true } })).status, 409);
});
test('concurrent provisioning reuses one Firebase identity and cannot duplicate membership', async () => {
    const s = setup(); const section = (await s.call('sections', { uid: 'teacher', method: 'POST', body: { name: 'BSCS-RACE' } })).data.section;
    const responses = await Promise.all([1,2].map(() => s.call('enroll', { uid: 'teacher', method: 'POST', body: { sectionId: section.id, email: 'same@ncst.edu.ph', ...names } })));
    assert.equal(responses.filter(r => r.status === 201 || r.status === 200).length, 1);
    assert.equal([...s.users.values()].filter(u => u.email === 'same@ncst.edu.ph').length, 1);
    assert.equal(Object.keys(s.db.data.website.sections[section.id].students).length, 1); assert.equal(s.sent.length, 1);
});
test('failed invitation delivery retains the UID and can be retried without another account', async () => {
    const s = setup(); let failMail = true;
    const handler = createDashboardAccountsHandler({ ...s.deps, sendInvitation: async () => { if (failMail) throw new Error('Mail unavailable'); } });
    async function grant(resendInvitation) {
        const r = await handler(new Request('https://site.test', {method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({email:'pending@ncst.edu.ph',role:'instructor',...names,resendInvitation})}));
        return r.json();
    }
    const first = await grant(false); assert.equal(first.deliveryPending, true); const total = s.users.size;
    failMail = false; const second = await grant(true); assert.equal(second.invitationSent, true); assert.equal(first.account.uid, second.account.uid); assert.equal(s.users.size, total);
});
test('missing invitation configuration fails before new Auth identity creation', async () => {
    const s = setup(), total = s.users.size;
    const sender = async () => {}; sender.assertReady = () => { throw Object.assign(new Error('Mail not configured'), {status:503}); };
    const handler = createDashboardAccountsHandler({ ...s.deps, sendInvitation: sender });
    const response = await handler(new Request('https://site.test', {method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({email:'new@ncst.edu.ph',role:'instructor',...names})}));
    assert.equal(response.status,503); assert.equal(s.users.size,total);
});
test('unverified signup can save only own names and cannot open protected progress', async () => {
    const s = setup(); s.users.get('player').emailVerified = false;
    assert.equal((await s.call('profile-setup',{uid:'player',method:'PATCH',body:{...names,uid:'owner',role:'super_admin'}})).status,200);
    assert.equal(s.db.data.users.player.profile.surname,'Santos'); assert.equal(s.db.data.users.owner,undefined);
    assert.equal((await s.call('profile',{uid:'player'})).status,403); assert.deepEqual(s.users.get('player').customClaims,{});
});
test('revoked sessions and dashboard restrictions cannot read student records', async () => {
    const s = setup({website:{sections:{one:{name:'Class',ownerUid:'teacher',students:{player:true}}},moderation:{teacher:{restriction:{active:true,capabilities:['dashboard']}}}}});
    assert.equal((await s.call('section',{uid:'teacher',params:{id:'one'}})).status,403);
    assert.equal((await s.call('profile',{uid:'teacher',params:{uid:'player'}})).status,403);
    assert.equal((await s.call('profile',{uid:'teacher'})).status,200);
    s.users.get('player').revoked=true; assert.equal((await s.call('profile',{uid:'player'})).status,401);
});
test('editing an existing legacy role cannot grant access to a non-NCST email', async () => {
    const s=setup(); s.users.get('admin').email='old@gmail.com';
    const response=await s.call(null,{endpoint:'accounts',method:'PATCH',body:{uid:'admin',role:'super_admin',expectedRole:'admin'}});
    assert.equal(response.status,400); assert.equal(s.users.get('admin').customClaims.super_admin,undefined);
    assert.equal((await s.call(null,{endpoint:'accounts',method:'DELETE',body:{uid:'admin'}})).status,200);
});
