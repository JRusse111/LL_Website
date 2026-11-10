import { TRIALS, formatName, nameParts } from '../../Logic_Legends_Web/JS/account-policy.mjs';
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export const accuracy = (correct, incorrect) => correct + incorrect ? correct * 100 / (correct + incorrect) : null;
export function playerProgress(uid, account = {}, identity = {}) {
    const trials = TRIALS.map(trial => {
        let correct = 0, incorrect = 0, retries = 0, completed = false;
        for (const run of Object.values(account.trialRuns?.[trial.number]?.attempts || {})) {
            if (!run || run.adminUsed === true) continue;
            // Read the same receipts as commerce/trials.js. Never count summary + events twice.
            const all = Object.values(run.quizAnswers || {});
            const answers = trial.number === 2 ? all.filter(a => a.kind === 'table') : all;
            if (all.length) {
                for (const answer of answers) {
                    if (answer.correct === true) correct++;
                    else if (answer.correct === false) incorrect++;
                }
            } else { correct += count(run.correctAnswers); incorrect += count(run.incorrectAnswers); }
            retries += count(run.retries); // Explicit Game Over/Try Again receipts, not wrong answers.
            completed ||= run.status === 'completed';
        }
        return { ...trial, completed, correct, incorrect, retries, accuracy: accuracy(correct, incorrect) };
    });
    const correct = trials.reduce((sum, t) => sum + t.correct, 0), incorrect = trials.reduce((sum, t) => sum + t.incorrect, 0);
    const profile = nameParts(account.profile);
    return { uid, email: identity.email || '', name: formatName(profile, identity.displayName || account.username), profile,
        trials, completed: trials.filter(t => t.completed).length, correct, incorrect, accuracy: accuracy(correct, incorrect) };
}
export function sectionOverview(players) {
    const topics = TRIALS.map(t => {
        const answers = players.map(p => p.trials[t.number - 1]);
        const correct = answers.reduce((s, a) => s + a.correct, 0), incorrect = answers.reduce((s, a) => s + a.incorrect, 0);
        return { ...t, correct, incorrect, accuracy: accuracy(correct, incorrect) };
    });
    const correct = players.reduce((s, p) => s + p.correct, 0), incorrect = players.reduce((s, p) => s + p.incorrect, 0);
    return { total: players.length, correct, incorrect, accuracy: accuracy(correct, incorrect),
        weakest: topics.filter(t => t.accuracy !== null).sort((a, b) => a.accuracy - b.accuracy || a.number - b.number)[0] || null, topics };
}
