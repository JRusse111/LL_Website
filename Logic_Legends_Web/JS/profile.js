import { normalizeAnyEmail } from './account-policy.mjs';
import { auth } from './firebase.js';
import { subscribeSession } from './session.js';

const $ = id => document.getElementById(id);
const roleLabel = role => ({ super_admin: 'Super admin', admin: 'Admin', instructor: 'Instructor', player: 'Player' }[role] || 'Player');
let session = null;
let accounts = [];
let nextCursor = null;
let busy = false;
let loaded = false;
let sessionKey = '';
let generation = 0;
let controller = new AbortController();

function feedback(message, error = false, target = $('adminFeedback')) {
    target.textContent = message;
    target.classList.toggle('is-error', error);
    target.hidden = !message;
}

function setBusy(value) {
    busy = value;
    $('administrators').setAttribute('aria-busy', String(value));
    $('administrators').querySelectorAll('button,input,select').forEach(control => { control.disabled = value; });
    if (!value) renderAccounts();
}

async function api(method = 'GET', body, cursor) {
    const version = generation;
    const user = auth.currentUser;
    if (!user || user.uid !== session?.user?.uid) throw new Error('Your session has ended. Please sign in again.');
    const token = await user.getIdToken();
    if (version !== generation) throw new DOMException('Session changed', 'AbortError');
    const url = new URL('/.netlify/functions/dashboard-accounts', location.origin);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        signal: controller.signal
    });
    if (version !== generation) throw new DOMException('Session changed', 'AbortError');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Account management is unavailable on this preview. Use the deployed website to manage administrators.');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Account management could not be completed.');
    return result;
}

function confirmChange(title, message, action) {
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    $('confirmAction').textContent = action;
    const dialog = $('accountConfirm');
    dialog.returnValue = 'cancel';
    return new Promise(resolve => {
        dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
        dialog.showModal();
    });
}

function renderAccounts() {
    const query = $('adminSearch').value.trim().toLowerCase();
    const sorted = [...accounts].sort((a, b) => Number(b.role === 'super_admin') - Number(a.role === 'super_admin') || (a.email || a.displayName).localeCompare(b.email || b.displayName));
    const filtered = sorted.filter(account => `${account.displayName} ${account.email}`.toLowerCase().includes(query));
    $('adminRows').replaceChildren();
    for (const account of filtered) {
        const row = document.createElement('tr');
        const identity = row.insertCell();
        const name = document.createElement('strong');
        name.textContent = account.displayName || account.email || 'Account';
        identity.append(name);
        if (account.email && account.displayName) {
            const email = document.createElement('small');
            email.textContent = account.email;
            identity.append(email);
        }
        const ownAccount = account.uid === session?.user?.uid;
        const roleCell = row.insertCell();
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Access level for ${account.email || account.displayName}`);
        for (const role of ['instructor', 'admin', 'super_admin']) {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = roleLabel(role);
            select.append(option);
        }
        select.value = account.role;
        select.disabled = ownAccount || busy;
        roleCell.append(select);
        const statusCell = row.insertCell();
        statusCell.className = 'admin-status';
        statusCell.textContent = account.disabled ? 'Disabled' : account.emailVerified ? 'Verified email' : 'Email unverified';
        const actions = document.createElement('div');
        actions.className = 'admin-row-actions';
        row.insertCell().append(actions);
        if (ownAccount) {
            const ownLabel = document.createElement('span');
            ownLabel.className = 'admin-self';
            ownLabel.textContent = 'Your account';
            actions.append(ownLabel);
        } else {
            const save = document.createElement('button');
            save.type = 'button';
            save.className = 'profile-button';
            save.textContent = 'Save role';
            save.setAttribute('aria-label', `Save role for ${account.email || account.displayName}`);
            save.disabled = true;
            select.addEventListener('change', () => { save.disabled = busy || select.value === account.role; });
            save.addEventListener('click', async () => {
                const newRole = select.value;
                if (!await confirmChange('Change access level?', `Change ${account.email || account.displayName} from ${roleLabel(account.role)} to ${roleLabel(newRole)}? Super admins can manage other administrators.`, 'Change role')) return;
                await mutate('PATCH', { uid: account.uid, role: newRole, expectedRole: account.role }, 'Access level updated.');
            });
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'profile-button profile-danger';
            remove.textContent = 'Remove access';
            remove.setAttribute('aria-label', `Remove dashboard access for ${account.email || account.displayName}`);
            remove.disabled = busy;
            remove.addEventListener('click', async () => {
                if (!await confirmChange('Remove dashboard access?', `Remove dashboard access for ${account.email || account.displayName}? Their account will stay.`, 'Remove access')) return;
                await mutate('DELETE', { uid: account.uid, expectedRole: account.role }, 'Dashboard access removed.');
            });
            const resend = document.createElement('button');resend.type='button';resend.className='profile-button';resend.textContent='Resend invitation';resend.hidden=account.emailVerified;resend.addEventListener('click',()=>mutate('POST',{email:account.email,role:account.role,resendInvitation:true},'Invitation request completed.'));actions.append(save, remove, resend);
        }
        $('adminRows').append(row);
    }
    $('adminCount').textContent = loaded ? `${filtered.length} of ${accounts.length} accounts shown${nextCursor ? ' · more available' : ''}` : '';
    $('adminEmpty').hidden = !loaded || filtered.length > 0;
    $('adminEmpty').textContent = query ? 'No administrators match your search.' : nextCursor ? 'No administrators on this page. Load more accounts to continue.' : 'No administrator accounts are listed.';
    $('loadMoreAdmins').hidden = !nextCursor;
}

async function loadAccounts(append = false) {
    if (busy || session?.role !== 'super_admin') return;
    const version = generation;
    setBusy(true);
    $('adminLoading').hidden = false;
    feedback('');
    try {
        const result = await api('GET', undefined, append ? nextCursor : undefined);
        if (version !== generation) return;
        const combined = append ? [...accounts, ...result.accounts] : result.accounts;
        accounts = [...new Map(combined.map(account => [account.uid, account])).values()];
        nextCursor = result.nextCursor;
        loaded = true;
    } catch (error) {
        if (error.name !== 'AbortError' && version === generation) feedback(error.message || 'The account list could not be loaded.', true);
    } finally {
        if (version === generation) { $('adminLoading').hidden = true; setBusy(false); }
    }
}

async function mutate(method, body, message) {
    if (busy || session?.role !== 'super_admin') return;
    const version = generation;
    setBusy(true);
    feedback('');
    try {
        const result = await api(method, body);
        if (version !== generation) return;
        accounts = accounts.filter(account => account.uid !== result.account.uid);
        if (!result.removed) accounts.push(result.account);
        loaded = true;
        feedback(message + (result.deliveryPending ? ' Invitation delivery is pending; configure mail and resend it.' : result.invitationSent ? ' Activation instructions were emailed.' : '') + (result.sessionRevocationPending ? ' The role is saved; existing sessions may take time to refresh.' : ''));
        if (method === 'POST') $('addAdminForm').reset();
    } catch (error) {
        if (error.name !== 'AbortError' && version === generation) feedback(error.message || 'This change could not be saved.', true);
    } finally {
        if (version === generation) setBusy(false);
    }
}

$('addAdminForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !$('addAdminForm').reportValidity()) return;
    let email; try { email = normalizeAnyEmail($('adminEmail').value); } catch (e) { feedback(e.message, true); return; }
    const role = $('adminRole').value;
    if (!await confirmChange('Add administrator?', `Give ${email} ${roleLabel(role)} access? ${role === 'super_admin' ? 'They will be able to add, change and remove administrator access.' : 'They will be able to view the instructor dashboard.'}`, 'Grant access')) return;
    await mutate('POST', { ...Object.fromEntries(new FormData($('addAdminForm'))), email, role }, 'Account access saved.');
});
$('refreshAdmins').addEventListener('click', () => loadAccounts());
$('loadMoreAdmins').addEventListener('click', () => loadAccounts(true));
$('adminSearch').addEventListener('input', renderAccounts);

subscribeSession(next => {
    session = next;
    if (next.status === 'loading') return;
    const key = next.user ? `${next.user.uid}:${next.role}` : '';
    if (key !== sessionKey) {
        generation++;
        controller.abort();
        controller = new AbortController();
        sessionKey = key;
        accounts = [];
        nextCursor = null;
        loaded = false;
        busy = false;
        $('accountConfirm').close('cancel');
        $('adminRows').replaceChildren();
        $('adminSearch').value = '';
        $('addAdminForm').reset();
        feedback('');
    }
    $('profileLoading').hidden = true;
    $('profileGuest').hidden = !!next.user;
    $('profileData').hidden = !next.user;
    $('administrators').hidden = !next.user?.emailVerified || next.role !== 'super_admin';
    if (!next.user) {
        feedback('', false, $('profileNotice'));
        // Clear private identity details as well as hiding the view when a session ends.
        for (const id of ['profileName','profileEmail','profileAvatar','profileRole','profileVerification','profileJoined']) $(id).textContent = '';
        if (next.status === 'error') {
            $('guestHeading').textContent = 'Please sign in again.';
            $('guestMessage').textContent = 'Your session could not be verified. Sign in again to open your profile.';
        }
        return;
    }
    const user = next.user;
    const name = user.displayName || user.email?.split('@')[0] || 'Adventurer';
    $('profileName').textContent = name;
    $('profileEmail').textContent = user.email || 'No email address';
    $('profileAvatar').textContent = name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase();
    $('profileRole').textContent = roleLabel(next.role);
    $('profileRole').dataset.role = next.role;
    $('profileVerification').textContent = user.emailVerified ? 'Verified' : 'Verification needed';
    const date = new Date(user.metadata?.creationTime || '');
    $('profileJoined').textContent = Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    feedback(user.emailVerified ? '' : 'Check your inbox and verify your email before accessing administrator tools.', false, $('profileNotice'));
    if (next.role === 'super_admin' && !loaded && !busy) loadAccounts();
});
