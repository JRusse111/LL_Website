import { subscribeSession } from './session.js';
import { api, $, element, percent, notice, perform } from './api.js';
let version = 0;
function render(player) {
    $('progressName').textContent = player.name;
    $('progressSummary').textContent = `${player.completed} / 10 trials completed · ${percent(player.accuracy)} overall accuracy`;
    $('trialRows').replaceChildren();
    for (const trial of player.trials) {
        const row = element('tr'); row.append(element('td', `Trial ${trial.number} / ${trial.title}`));
        row.append(element('td', trial.completed ? 'Completed' : 'Not Completed', trial.completed ? 'status-complete' : 'status-incomplete'));
        row.append(element('td', trial.correct), element('td', trial.incorrect), element('td', percent(trial.accuracy)), element('td', trial.retries)); $('trialRows').append(row);
    }
}
subscribeSession(async next => {
    const current = ++version;
    if (next.status === 'loading') return;
    $('gameProgress').hidden = !next.user; $('trialRows').replaceChildren();
    if (!next.user) return;
    try {
        const requested = new URL(location.href).searchParams.get('uid');
        const result = await api('profile', { params: requested ? { uid: requested } : {} });
        if (current !== version) return;
        render(result.player);
        const own = result.player.uid === next.user.uid;
        document.querySelector('.profile-overview').hidden = !own;
        $('editPlayerName').hidden = !own;
        if (own) for (const field of ['surname', 'firstName', 'middleName']) $('nameForm').elements[field].value = result.player.profile[field] || '';
    } catch (error) { if (current === version && error.name !== 'AbortError') notice($('progressNotice'), error.message, true); }
});
$('nameForm').addEventListener('submit', event => {
    event.preventDefault(); perform(event.submitter, $('progressNotice'), async () => {
        const result = await api('profile', { method: 'PATCH', body: Object.fromEntries(new FormData(event.target)) }); render(result.player); notice($('progressNotice'), 'Name saved.');
    });
});
