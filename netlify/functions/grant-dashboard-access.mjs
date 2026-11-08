import { adminAuth } from '../lib/firebase-admin.mjs';
import { createDashboardAccountsHandler } from '../lib/dashboard-accounts.mjs';
const manage = createDashboardAccountsHandler({ getAuth: adminAuth });

// Retain the old grant-only route with the same fresh permission checks.
export default async function grantDashboardAccess(request) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  const response = await manage(request);
  if (!response.ok) return response;
  const result = await response.json();
  return Response.json({ ...result, role: result.account.role, alreadyGranted: result.unchanged === true }, { headers: { 'Cache-Control': 'no-store' } });
}
