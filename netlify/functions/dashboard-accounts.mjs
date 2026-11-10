import { adminAuth, adminDb } from '../lib/firebase-admin.mjs';
import { sendInvitation } from '../lib/mail.mjs';
import { createDashboardAccountsHandler } from '../lib/dashboard-accounts.mjs';
export default createDashboardAccountsHandler({ getAuth: adminAuth, getDb: adminDb, sendInvitation });
