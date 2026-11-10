import { adminAuth, adminDb } from '../lib/firebase-admin.mjs';
import { createModerationHandler } from '../lib/moderation.mjs';
export default createModerationHandler({ getAuth: adminAuth, getDb: adminDb });
