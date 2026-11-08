import { adminAuth } from '../lib/firebase-admin.mjs';
import { createDashboardAccountsHandler } from '../lib/dashboard-accounts.mjs';

export default createDashboardAccountsHandler({ getAuth: adminAuth });
