import { auth } from './firebase.js';
let generation = 0;
export function invalidateRequests() { generation++; }
export async function api(action, { method = 'GET', body, params = {}, endpoint = 'education' } = {}) {
    const user = auth.currentUser, version = generation;
    if (!user) throw new Error('Sign in first.');
    const token = await user.getIdToken();
    const url = new URL(`/.netlify/functions/${endpoint}`, location.origin);
    if (action) url.searchParams.set('action', action);
    for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, value);
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (version !== generation || auth.currentUser?.uid !== user.uid) throw new DOMException('Session changed', 'AbortError');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('This preview has no backend. Run the local test server or configure Netlify functions.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
}
export const $ = id => document.getElementById(id);
export function element(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
export const percent = value => value == null ? 'No data yet' : `${value.toFixed(1)}%`;
export function notice(target, text, error = false) { target.textContent = text; target.hidden = !text; target.classList.toggle('is-error', error); }
export async function perform(button, target, work) {
    if (button.disabled) return;
    button.disabled = true;
    try { notice(target, ''); await work(); }
    catch (error) { if (error.name !== 'AbortError') notice(target, error.message, true); }
    finally { button.disabled = false; }
}
export function playerLink(player) {
    const link = element('a', player.name);
    const destination = new URL('../Profile/profile.html', location.href);
    destination.searchParams.set('uid', player.uid);
    link.href = destination.href;
    return link;
}
