import { onIdTokenChanged, getIdTokenResult, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { auth, appUrl } from './firebase.js';

const listeners = new Set();
let state = { status: 'loading', user: null, role: null };
let version = 0;

function publish(next) {
    state = next;
    listeners.forEach(listener => listener(state));
}

onIdTokenChanged(auth, async user => {
    const current = ++version;
    if (!user) { publish({ status: 'ready', user: null, role: null }); return; }
    try {
        const { claims } = await getIdTokenResult(user);
        if (current !== version) return;
        const role = user.emailVerified && claims.super_admin === true ? 'super_admin'
            : user.emailVerified && claims.admin === true ? 'admin' : 'player';
        publish({ status: 'ready', user, role });
    } catch (error) {
        if (current === version) publish({ status: 'error', user: null, role: null });
        console.error('Unable to verify account session:', error.code);
    }
});

export function subscribeSession(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
}

export async function logout() {
    await signOut(auth);
    window.location.assign(appUrl('LoginPage/login_page.html'));
}
