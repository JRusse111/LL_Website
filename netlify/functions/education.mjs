import { adminAuth, adminDb } from '../lib/firebase-admin.mjs';
import { sendInvitation } from '../lib/mail.mjs';
import { createEducationHandler } from '../lib/education.mjs';
export default createEducationHandler({ getAuth: adminAuth, getDb: adminDb, sendInvitation });
