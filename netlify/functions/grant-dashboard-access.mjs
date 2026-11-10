import manage from './dashboard-accounts.mjs';
export default async function grantDashboardAccess(request) {
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
    const response = await manage(request);
    if (!response.ok) return response;
    const result = await response.json();
    return Response.json({ ...result, role: result.account.role, alreadyGranted: result.unchanged === true }, { headers: { 'Cache-Control': 'no-store' } });
}
