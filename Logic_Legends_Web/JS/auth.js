import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
    sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { auth, appUrl } from './firebase.js';
import { normalizeEmail, normalizeAnyEmail } from './account-policy.mjs';
import { api } from './api.js';
const provider = new GoogleAuthProvider();
async function finishLogin(user) {
    if (!user.emailVerified) {
        try { await sendEmailVerification(user); } finally { await signOut(auth); }
        throw new Error('Verify your email using the link in your inbox, then sign in.');
    }
    try {
        const email = normalizeAnyEmail(user.email);
        try { normalizeEmail(email); }
        catch {
            const { role } = await api('session');
            if (!['super_admin', 'admin', 'instructor'].includes(role)) throw new Error('New accounts must use an @ncst.edu.ph email. Other email domains are only allowed for staff accounts added by a super admin.');
        }
    } catch (error) {
        await signOut(auth);
        throw error;
    }
    location.replace(appUrl('Profile/profile.html'));
}
function attach(id, work) {
    const form = document.getElementById(id); if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault(); const button = event.submitter; if (button.disabled) return; button.disabled = true;
        try { await work(form); }
        catch (e) { alert(e.code === 'auth/email-already-in-use' ? 'This account already exists. Use your invitation or Forgot Password; do not register again.' : e.message); }
        finally { button.disabled = false; }
    });
}
attach('loginForm', async () => {
    const email = normalizeAnyEmail(document.getElementById('emailInput').value);
    const result = await signInWithEmailAndPassword(auth, email, document.getElementById('passwordInput').value); await finishLogin(result.user);
});
attach('signupForm', async form => {
    const email = normalizeEmail(document.getElementById('signupEmailInput').value);
    const result = await createUserWithEmailAndPassword(auth, email, document.getElementById('signupPasswordInput').value);
    const surname = form.elements.surname.value.trim(), firstName = form.elements.firstName.value.trim(), middle = form.elements.middleName.value.trim();
    try {
        await updateProfile(result.user, { displayName: `${surname}, ${firstName}${middle ? ` ${middle}` : ''}` });
        await api('profile-setup', { method: 'PATCH', body: { surname, firstName, middleName: middle } });
        await sendEmailVerification(result.user);
        alert('Account created. Verify your NCST email using the link in your inbox, then sign in.');
        location.assign(appUrl('LoginPage/login_page.html'));
    } finally { await signOut(auth); }
});
for (const id of ['googleLoginBtn', 'googleSignupBtn']) document.getElementById(id)?.addEventListener('click', async event => {
    const button = event.currentTarget; if (button.disabled) return; button.disabled = true;
    try { const result = await signInWithPopup(auth, provider); await finishLogin(result.user); }
    catch (e) { alert(e.message); } finally { button.disabled = false; }
});
document.getElementById('resetPasswordBtn')?.addEventListener('click', async event => {
    const button = event.currentTarget, status = document.getElementById('resetFeedback'); if (button.disabled) return;
    button.disabled = true;
    try { await sendPasswordResetEmail(auth, normalizeAnyEmail(document.getElementById('emailInput').value)); status.textContent = 'If the account exists, a password-setup link has been sent. Check your inbox.'; status.classList.remove('is-error'); }
    catch (e) { status.textContent = e.code === 'auth/user-not-found' ? 'If the account exists, a password-setup link has been sent.' : e.message; status.classList.add('is-error'); }
    finally { status.hidden = false; button.disabled = false; }
});
