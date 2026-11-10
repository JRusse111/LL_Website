import { fail } from './access.mjs';
// Configured server-side only. Action links never return to a dashboard or appear in logs.
export async function sendInvitation({ email, name, verification, passwordSetup }) {
    sendInvitation.assertReady();
    const result = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.ACCOUNT_MAIL_FROM, to: [email], subject: 'Activate your Logic Legends account',
            text: `Hello ${name || 'student'},\nYour Logic Legends account is ready. You do not need to register again.\n1. Verify your email: ${verification}\n2. Set your password: ${passwordSetup}\nThen sign in using your NCST email. If you did not expect this invitation, contact your instructor.` }),
        signal: AbortSignal.timeout(15000)
    });
    if (!result.ok) throw new Error('Invitation delivery failed');
}
sendInvitation.assertReady = () => {
    if (!process.env.RESEND_API_KEY || !process.env.ACCOUNT_MAIL_FROM) throw fail('Account invitation delivery is not configured. Ask the site administrator to configure it.', 503);
};
