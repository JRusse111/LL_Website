import { randomBytes } from 'node:crypto';
import { normalizeEmail, nameParts } from '../../Logic_Legends_Web/JS/account-policy.mjs';
import { fail } from './access.mjs';
export async function ensureIdentity(auth, email, names, sendInvitation) {
    email = normalizeEmail(email);
    let user, created = false;
    try { user = await auth.getUserByEmail(email); }
    catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        sendInvitation?.assertReady?.();
        const n = nameParts(names);
        if (!n.surname || !n.firstName) throw fail('Enter the new user’s surname and first name.');
        try {
            user = await auth.createUser({ email, emailVerified: false, password: randomBytes(36).toString('base64url'),
                displayName: `${n.surname}, ${n.firstName}${n.middleName ? ` ${n.middleName}` : ''}` });
            created = true;
        } catch (e) {
            if (e.code !== 'auth/email-already-exists') throw e;
            user = await auth.getUserByEmail(email); // Concurrent provisioning reuses the winning UID.
        }
    }
    if (user.disabled) throw fail('This account is disabled. Resolve moderation first.', 409);
    return { user, created };
}
export async function invite(auth, user, sendInvitation) {
    if (user.emailVerified) return { activationRequired: false, invitationSent: false };
    try {
        if (!sendInvitation) throw new Error('Mail is not configured');
        const verification = await auth.generateEmailVerificationLink(user.email);
        const passwordSetup = await auth.generatePasswordResetLink(user.email);
        await sendInvitation({ email: user.email, name: user.displayName, verification, passwordSetup });
        return { activationRequired: true, invitationSent: true };
    } catch {
        // Never delete a created identity on uncertain delivery or expose action links to the caller.
        return { activationRequired: true, invitationSent: false, deliveryPending: true };
    }
}
