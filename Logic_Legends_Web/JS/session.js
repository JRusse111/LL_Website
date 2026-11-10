import { onIdTokenChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { auth, appUrl } from './firebase.js';
import { api, invalidateRequests } from './api.js';
const listeners = new Set();
let state = { status: 'loading', user: null, role: null }, version = 0;
function publish(next) { state = next; for (const fn of listeners) fn(state); }
async function refresh(user) {
    const current = ++version;
    invalidateRequests();
    if (!user) { publish({ status: 'ready', user: null, role: null }); return; }
    try {
        // Fresh server account/claims, disabled state and moderation; not UI-entered roles.
        const result = await api('session');
        if (current === version) publish({ status: 'ready', user, role: result.role });
    } catch (error) {
        if (current === version) publish({ status: 'error', user: null, role: null, message: error.message });
    }
}
onIdTokenChanged(auth, refresh);
// Recheck once when returning to a tab. There are no live progress/leaderboard subscriptions.
document.addEventListener('visibilitychange', () => { if (!document.hidden && auth.currentUser) refresh(auth.currentUser); });
export function subscribeSession(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); }
export async function logout() { await signOut(auth); location.assign(appUrl('LoginPage/login_page.html')); }
