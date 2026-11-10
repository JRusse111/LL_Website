import { subscribeSession } from './session.js';
import { api, $, element, notice, perform, playerLink } from './api.js';
let cursor = null, feedbackCursor = null, players = [], selected = null, generation = 0;
const viewingLearnerRecord = new URL(location.href).searchParams.has('uid');
function stateText(m) {
    const r = m.restriction, active = r?.active && (!r.expiresAt || r.expiresAt > Date.now());
    return [m.ban?.active ? `Banned until unbanned: ${m.ban.reason}` : 'Not banned', active ? `Restricted: ${r.capabilities.join(', ')} · ${r.reason} · ${r.expiresAt ? new Date(r.expiresAt).toLocaleString() : 'No expiration'}` : 'No active restrictions'].join('\n');
}
function openAction(player, action) {
    selected = { uid: player.uid, action };
    $('moderationForm').reset(); $('moderationActionTitle').textContent = `${action[0].toUpperCase() + action.slice(1)} ${player.name || player.email}?`;
    $('restrictionOptions').hidden = action !== 'restrict'; $('moderationActionDialog').showModal();
}
function renderPlayers() {
    $('moderationRows').replaceChildren();
    for (const player of players) {
        const row = element('tr'), identity = element('td'); identity.append(playerLink({uid:player.uid,name:player.name || player.uid}), element('small', player.email));
        row.append(identity, element('td', `${stateText(player.moderation)}${player.disabled && !player.moderation.ban?.active ? '\nAuth disabled for another reason' : ''}`, 'preserve-lines'));
        const actions = element('td');
        for (const action of ['ban', 'unban', 'restrict', 'unrestrict']) {
            const button = element('button', ({ ban: 'Ban', unban: 'Unban', restrict: 'Restrict', unrestrict: 'Remove restriction' })[action], 'profile-button');
            button.type = 'button'; button.addEventListener('click', () => openAction(player, action)); actions.append(button);
        }
        row.append(actions); $('moderationRows').append(row);
    }
    $('morePlayers').hidden = !cursor;
    $('moderationEmpty').hidden = players.length > 0;
}
async function loadPlayers(append = false) {
    const current = generation;
    const result = await api(null, { endpoint: 'moderation', params: { search: $('playerSearch').value.trim(), cursor: append ? cursor : null } });
    if (current !== generation) return;
    players = append ? [...new Map([...players, ...result.players].map(p => [p.uid, p])).values()] : result.players;
    cursor = result.nextCursor; renderPlayers();
}
async function loadFeedback(append = false) {
    const current = generation, result = await api('feedback', { params: append ? { before: feedbackCursor } : {} });
    if (current !== generation) return;
    if (!append) $('feedbackItems').replaceChildren();
    for (const entry of result.feedback) {
        const article = element('article', null, 'feedback-entry');
        article.append(element('strong', entry.author), element('small', new Date(entry.submittedAt).toLocaleString()), element('p', entry.text)); $('feedbackItems').append(article);
    }
    feedbackCursor = result.nextCursor; $('moreFeedback').hidden = !feedbackCursor;
    if (!$('feedbackItems').children.length) $('feedbackItems').append(element('p', 'No feedback yet.'));
}
$('playerSearchForm').addEventListener('submit', event => { event.preventDefault(); perform(event.submitter, $('moderationNotice'), () => loadPlayers()); });
$('morePlayers').addEventListener('click', event => perform(event.currentTarget, $('moderationNotice'), () => loadPlayers(true)));
$('moderationForm').addEventListener('submit', event => {
    event.preventDefault(); perform(event.submitter, $('moderationDialogNotice'), async () => {
        const reason = $('moderationReason').value, capabilities = [...$('restrictionOptions').querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
        const expiresAt = $('restrictionExpiry').value ? new Date($('restrictionExpiry').value).getTime() : null;
        await api(null, { endpoint: 'moderation', method: 'POST', body: { ...selected, reason, capabilities, expiresAt, confirm: $('confirmModeration').checked } });
        $('moderationActionDialog').close(); await loadPlayers(); notice($('moderationNotice'), 'Moderation status updated.');
    });
});
$('refreshFeedback').addEventListener('click', event => perform(event.currentTarget, $('feedbackManagementNotice'), () => loadFeedback()));
$('moreFeedback').addEventListener('click', event => perform(event.currentTarget, $('feedbackManagementNotice'), () => loadFeedback(true)));
document.querySelectorAll('[data-close-dialog]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
subscribeSession(next => {
    generation++;
    const allowed = !viewingLearnerRecord && next.user && ['super_admin', 'admin'].includes(next.role);
    $('playerModeration').hidden = !allowed; $('feedbackManagement').hidden = !allowed;
    players = []; cursor = null; feedbackCursor = null; $('moderationRows').replaceChildren(); $('feedbackItems').replaceChildren(); $('moderationActionDialog').close();
    if (allowed) { loadPlayers().catch(e => notice($('moderationNotice'), e.message, true)); loadFeedback().catch(e => notice($('feedbackManagementNotice'), e.message, true)); }
});
