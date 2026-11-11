import { subscribeSession } from './session.js';
import { api, $, element, percent, notice, perform, playerLink } from './api.js';
import { normalizeEmail } from './account-policy.mjs';
let selected = '', selectedOwner = '', version = 0, activeRole = null;
function managerView() { return activeRole === 'admin' || activeRole === 'super_admin'; }
function openInstructor(instructor) {
    selectedOwner = instructor.uid; selected = '';
    $('selectedInstructorName').textContent = instructor.displayName || instructor.email || 'Instructor';
    $('selectedInstructorEmail').textContent = instructor.email || '';
    $('instructorDirectory').hidden = true; $('selectedInstructorBar').hidden = false; $('instructorWorkspace').hidden = false;
    loadSections().catch(e => notice($('dashboardNotice'), e.message, true));
}
async function loadInstructors() {
    $('instructorDirectoryNotice').hidden = true;
    $('instructorDirectoryNotice').textContent = '';
    const { instructors } = await api('instructors');
    $('instructorCards').replaceChildren();
    $('instructorDirectoryEmpty').hidden = instructors.length > 0;
    for (const instructor of instructors) {
        const card = element('button', null, 'instructor-choice');
        card.type = 'button'; card.disabled = instructor.disabled;
        card.append(element('strong', instructor.displayName || instructor.email || 'Instructor'), element('span', instructor.email || 'No email address'), element('small', `${instructor.sectionCount} ${instructor.sectionCount === 1 ? 'section' : 'sections'}${instructor.disabled ? ' · Disabled' : ''}`));
        card.addEventListener('click', () => openInstructor(instructor));
        $('instructorCards').append(card);
    }
}
async function loadSections() {
    const current = ++version, result = await api('sections', { params: managerView() && selectedOwner ? { instructorUid: selectedOwner } : {} });
    if (current !== version) return;
    $('sectionSelect').replaceChildren(element('option', 'Select a section'));
    $('sectionSelect').firstChild.value = '';
    for (const s of result.sections) { const option = element('option', s.name); option.value = s.id; $('sectionSelect').append(option); }
    if (result.sections.some(s => s.id === selected)) $('sectionSelect').value = selected;
    else selected = result.sections[0]?.id || '';
    $('sectionSelect').value = selected;
    await loadRoster();
}
async function loadRoster() {
    const current = ++version;
    $('studentRows').replaceChildren(); $('learnerRows').replaceChildren();
    $('sectionContent').hidden = !selected; $('sectionEmpty').hidden = !!selected;
    if (!selected) return;
    notice($('dashboardNotice'), 'Loading section…');
    const result = await api('section', { params: { id: selected } });
    if (current !== version) return;
    const { overview, players } = result;
    $('studentCount').textContent = String(overview.total);
    $('averageAccuracy').textContent = percent(overview.accuracy);
    $('weakestTopic').textContent = overview.weakest ? `${overview.weakest.title} · ${percent(overview.weakest.accuracy)}` : 'No data yet';
    const orderedTopics = [...(overview.topics || [])].sort((a, b) => {
        if (a.accuracy == null && b.accuracy == null) return a.number - b.number;
        if (a.accuracy == null) return 1;
        if (b.accuracy == null) return -1;
        return b.accuracy - a.accuracy || a.number - b.number;
    });
    $('sectionTrialRows').replaceChildren();
    for (const topic of orderedTopics) {
        const row = element('tr');
        row.append(element('td', `Trial ${topic.number} / ${topic.title}`), element('td', topic.correct), element('td', topic.incorrect), element('td', percent(topic.accuracy)));
        $('sectionTrialRows').append(row);
    }
    $('rosterEmpty').hidden = players.length > 0;
    for (const player of players) {
        const row = element('tr'), name = element('td'); name.append(playerLink(player)); row.append(name);
        const actions = element('td'), remove = element('button', 'Remove Student', 'profile-button profile-danger');
        remove.type = 'button'; remove.addEventListener('click', () => perform(remove, $('dashboardNotice'), async () => {
            if (!confirm(`Remove ${player.name} from this section? Their account and game history will stay.`)) return;
            await api('enroll', { method: 'DELETE', body: { sectionId: selected, uid: player.uid } }); await loadRoster();
        })); actions.append(remove); row.append(actions); $('studentRows').append(row);
        const summary = element('tr'), summaryName = element('td'); summaryName.append(playerLink(player));
        summary.append(summaryName, element('td', `${player.completed} / 10`), element('td', percent(player.accuracy))); $('learnerRows').append(summary);
    }
    notice($('dashboardNotice'), '');
}
$('sectionSelect').addEventListener('change', async () => { selected = $('sectionSelect').value; try { await loadRoster(); } catch (e) { notice($('dashboardNotice'), e.message, true); } });
$('addSection').addEventListener('click', () => $('sectionDialog').showModal());
$('sectionForm').addEventListener('submit', event => {
    event.preventDefault(); const button = event.submitter;
    perform(button, $('sectionDialogNotice'), async () => {
        const result = await api('sections', { method: 'POST', body: { name: $('sectionName').value, ...(selectedOwner ? { ownerUid: selectedOwner } : {}) } });
        selected = result.section.id; $('sectionDialog').close(); $('sectionForm').reset();
        try { await loadSections(); }
        catch (error) {
            // Creation has already committed. Keep the new section usable if the
            // follow-up list refresh fails, instead of reporting creation as failed.
            if (![...$('sectionSelect').options].some(option => option.value === result.section.id)) {
                const option = element('option', result.section.name);
                option.value = result.section.id;
                $('sectionSelect').append(option);
            }
            $('sectionSelect').value = selected;
            $('sectionEmpty').hidden = true;
            try { await loadRoster(); }
            catch { $('sectionContent').hidden = true; }
            notice($('dashboardNotice'), `Section created. The section list could not refresh: ${error.message}`, true);
        }
    });
});
$('backToInstructors').addEventListener('click', () => {
    version++; selected = ''; selectedOwner = ''; $('sectionContent').hidden = true; $('sectionEmpty').hidden = true;
    $('selectedInstructorBar').hidden = true; $('instructorWorkspace').hidden = true; $('instructorDirectory').hidden = false;
});
$('showAddStudent').addEventListener('click', () => $('studentDialog').showModal());
$('studentForm').addEventListener('submit', event => {
    event.preventDefault();
    perform(event.submitter, $('studentDialogNotice'), async () => {
        const fields = { email: normalizeEmail(new FormData(event.target).get('email')), sectionId: selected };
        const result = await api('enroll', { method: 'POST', body: fields });
        $('studentDialog').close(); event.target.reset(); await loadRoster();
        notice($('dashboardNotice'), result.deliveryPending ? 'Student enrolled. No invitation email was sent; ask them to use Forgot Password with this email, set a password, then verify the address.' : result.created ? 'Student enrolled. Activation instructions were emailed; no separate registration is needed.' : 'Existing player linked. Saved progress is shown now.');
    });
});
$('refreshSection').addEventListener('click', event => perform(event.target, $('dashboardNotice'), loadRoster));
document.querySelectorAll('[data-close-dialog]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
subscribeSession(next => {
    if (next.status === 'loading') return;
    activeRole = next.user ? next.role : null;
    version++; selected = ''; selectedOwner = '';
    $('sectionContent').hidden = true; $('sectionEmpty').hidden = true; $('studentRows').replaceChildren(); $('learnerRows').replaceChildren();
    if (!next.user || !['super_admin', 'admin', 'instructor'].includes(next.role)) {
        $('instructorDirectory').hidden = true; $('instructorWorkspace').hidden = true; return;
    }
    $('dashboardNotice').hidden = true;
    if (managerView()) {
        $('instructorDirectory').hidden = false; $('instructorWorkspace').hidden = true; $('selectedInstructorBar').hidden = true;
        loadInstructors().catch(e => { $('instructorDirectoryNotice').textContent = e.message; $('instructorDirectoryNotice').hidden = false; });
    } else {
        $('instructorDirectory').hidden = true; $('selectedInstructorBar').hidden = true; $('instructorWorkspace').hidden = false;
        loadSections().catch(e => { selected = ''; $('sectionContent').hidden = true; $('studentRows').replaceChildren(); $('learnerRows').replaceChildren(); notice($('dashboardNotice'), e.message, true); });
    }
});
