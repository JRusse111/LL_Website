import { subscribeSession } from './session.js';
import { api, element, percent, notice, perform } from './api.js';
let version = 0;
document.querySelectorAll('[data-feedback-form]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault(); const status = form.querySelector('[data-feedback-status]');
    perform(event.submitter, status, async () => { await api('feedback', { method: 'POST', body: { text: form.elements.text.value } }); form.reset(); notice(status, 'Thank you. Your feedback has been sent.'); });
}));
subscribeSession(async next => {
    const current = ++version;
    if (next.status === 'loading') return;
    document.querySelectorAll('[data-feedback-form]').forEach(form => { form.hidden = !next.user; });
    document.querySelectorAll('[data-community-signin]').forEach(n => { n.hidden = !!next.user; });
    const body = document.querySelector('[data-leaderboard-rows]'), status = document.querySelector('[data-leaderboard-status]');
    if (!body) return;
    body.replaceChildren();
    if (!next.user) { notice(status, 'Sign in to view the leaderboard snapshot.'); return; }
    try {
        const result = await api('leaderboard'); if (current !== version) return;
        for (const [i, player] of result.entries.entries()) { const row = element('tr'); row.append(element('td', i + 1), element('td', player.name), element('td', player.points)); body.append(row); }
        notice(status, result.configurationRequired ? 'The leaderboard points source has not been configured yet.' : result.entries.length ? `Snapshot: ${new Date(result.capturedAt).toLocaleString()}. No live updates.` : 'No points data yet.');
    } catch (e) { if (current === version) notice(status, e.message, true); }
});
