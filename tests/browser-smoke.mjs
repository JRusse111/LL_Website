import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER_PATH ? { executablePath: process.env.QA_BROWSER_PATH } : {}) });
const base = 'http://127.0.0.1:4320', results = [], errors = [];
await mkdir('output/verification/screenshots', { recursive: true });
async function visit(context, path) {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(`${path}: ${error.message}`));
    await page.goto(base + path, { waitUntil: 'domcontentloaded' }); return page;
}
async function request(page, action, body, endpoint='education') {
    return page.evaluate(async ({ action, body, endpoint }) => {
        const { auth } = await import('/JS/firebase.js');
        const r = await fetch(`/.netlify/functions/${endpoint}${action ? '?action='+action : ''}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+await auth.currentUser.getIdToken(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}); return { status:r.status,data:await r.json() };
    }, {action,body,endpoint});
}
try {
    for (const width of [1440,390]) {
        const instructorContext = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion:'reduce' });
        const page = await visit(instructorContext, '/InstructorDashboard/i_dashboard.html?role=instructor');
        await page.locator('#addSection').waitFor({state:'visible'});
        await page.locator('#addSection').click(); await page.locator('#sectionName').fill(`BSCS-${width}A1`); await page.locator('#sectionForm button[type=submit]').click();
        await page.locator('#sectionDialog').waitFor({state:'hidden'}); await page.locator('#rosterEmpty').waitFor({state:'visible'});
        assert.match(await page.locator('#rosterEmpty').textContent(),/No students yet/);
        await page.locator('#showAddStudent').click(); await page.locator('#studentForm [name=email]').fill('PLAYER@ncst.edu.ph'); await page.locator('#studentForm button[type=submit]').click();
        await page.locator('#studentDialog').waitFor({state:'hidden'}); await page.waitForFunction(()=>document.querySelector('#learnerRows').textContent.includes('75.0%'));
        assert.match(await page.locator('#studentRows').textContent(), /Santos, Ana M\./);
        assert.equal(await page.locator('#studentCount').textContent(),'1');
        await page.locator('#showAddStudent').click(); await page.locator('#studentForm [name=email]').fill(`new${width}@ncst.edu.ph`); await page.locator('#studentForm [name=surname]').fill('Adams'); await page.locator('#studentForm [name=firstName]').fill('Zoe'); await page.locator('#studentForm button[type=submit]').click();
        await page.locator('#studentDialog').waitFor({state:'hidden'}); await page.waitForFunction(()=>document.querySelector('#studentCount').textContent==='2');
        assert.match(await page.locator('#studentRows tr').first().textContent(),/Adams, Zoe/);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Dashboard page overflow');
        await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:`output/verification/screenshots/dashboard-${width}.png`,fullPage:true});
        const link = page.locator('#learnerRows a').filter({hasText:'Santos'}); await link.click();
        await page.locator('#trialRows tr').first().waitFor(); assert.equal(await page.locator('#trialRows tr').count(),10); assert.match(await page.locator('#progressSummary').textContent(),/1 \/ 10/);
        assert.equal(await page.locator('#editPlayerName').isVisible(),false);
        await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:`output/verification/screenshots/profile-${width}.png`,fullPage:true});
        const adminContext=await browser.newContext({viewport:{width,height:900}}), admin=await visit(adminContext,'/Profile/profile.html?role=super_admin');
        await admin.locator('#administrators').waitFor({state:'visible'});
        await admin.locator('#adminEmail').fill(`staff${width}@ncst.edu.ph`); await admin.locator('#addAdminForm [name=surname]').fill('Reyes'); await admin.locator('#addAdminForm [name=firstName]').fill('Mika'); await admin.locator('#adminRole').selectOption('instructor'); await admin.locator('#addAdminForm button[type=submit]').click();
        await admin.locator('#accountConfirm').waitFor({state:'visible'}); await admin.locator('#confirmAction').click();
        await admin.waitForFunction(email=>document.querySelector('#adminRows').textContent.includes(email),`staff${width}@ncst.edu.ph`);
        const playerEmail=width===1440?'player@ncst.edu.ph':'outsider@ncst.edu.ph';
        await admin.locator('#playerSearch').fill(playerEmail); await admin.locator('#playerSearchForm button').click();
        const row=admin.locator('#moderationRows tr').filter({hasText:playerEmail}); await row.waitFor(); await row.getByRole('button',{name:'Restrict',exact:true}).click();
        await admin.locator('#moderationReason').fill('Review repeated feedback submissions.'); await admin.locator('#restrictionOptions [value=feedback]').check(); await admin.locator('#confirmModeration').check(); await admin.locator('#moderationForm button[type=submit]').click(); await admin.locator('#moderationActionDialog').waitFor({state:'hidden'});
        await admin.evaluate(()=>scrollTo(0,0)); await admin.screenshot({path:`output/verification/screenshots/admin-${width}.png`,fullPage:true});
        const playerContext=await browser.newContext({viewport:{width,height:900}}), player=await visit(playerContext,`/index.html?role=${width===1440?'player':'player2'}`);
        await player.locator('[data-feedback-form]').waitFor({state:'visible'}); await player.locator('[data-feedback-form] textarea').fill('The board is clear and readable.'); await player.locator('[data-feedback-form] button').click();
        await player.waitForFunction(()=>document.querySelector('[data-feedback-status]').textContent.includes('restricted'));
        assert.equal((await request(player,'profile')).status,200);
        await row.getByRole('button',{name:'Remove restriction',exact:true}).click(); await admin.locator('#moderationReason').fill('Review complete, restore feedback.'); await admin.locator('#confirmModeration').check(); await admin.locator('#moderationForm button[type=submit]').click(); await admin.locator('#moderationActionDialog').waitFor({state:'hidden'});
        await player.locator('[data-feedback-form] button').click(); await player.waitForFunction(()=>document.querySelector('[data-feedback-status]').textContent.includes('Thank you'));
        await admin.locator('#refreshFeedback').click(); await admin.waitForFunction(()=>document.querySelector('#feedbackItems').textContent.includes('The board is clear'));
        await player.waitForFunction(()=>document.querySelector('[data-leaderboard-rows]').textContent.includes('45'));
        assert.equal(await player.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Home page overflow');
        results.push(`PASS ${width}px: empty section, existing-player linkage/75% progress, new student, surname sorting, 10-trial profile, new instructor account, restriction enforcement/removal, player feedback, super-admin feedback list, points snapshot, responsive layout.`);
        await instructorContext.close(); await adminContext.close(); await playerContext.close();
    }
    assert.deepEqual(errors,[],'Browser JavaScript exceptions');
    results.push('PASS: no browser JavaScript exceptions. Isolated in-memory Auth/RTDB only; no live accounts or deployment.');
} catch(error) {results.push(`FAIL ${error.stack}`); process.exitCode=1;}
finally {await writeFile('output/verification/browser-results.txt',results.join('\n')+'\n'); console.log(results.join('\n')); await browser.close();}
