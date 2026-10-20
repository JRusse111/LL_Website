import test from 'node:test';
import assert from 'node:assert/strict';
import { listDashboardAccountsWithAuth } from '../netlify/functions/list-dashboard-accounts.mjs';

const request = new Request('http://localhost/.netlify/functions/list-dashboard-accounts');

test('view-only admins cannot list account email addresses', async () => {
  let listed = false;
  const auth = {
    verifyIdToken: async () => ({ admin: true, email_verified: true }),
    listUsers: async () => { listed = true; return { users: [] }; }
  };
  const response = await listDashboardAccountsWithAuth(request, auth, 'test-token');
  assert.equal(response.status, 403);
  assert.equal(listed, false);
});

test('super admins receive only dashboard account emails and roles', async () => {
  const auth = {
    verifyIdToken: async () => ({ super_admin: true, email_verified: true }),
    listUsers: async () => ({
      users: [
        { email: 'owner@example.com', customClaims: { super_admin: true } },
        { email: 'viewer@example.com', customClaims: { admin: true } },
        { email: 'visitor@example.com', customClaims: {} }
      ]
    })
  };
  const response = await listDashboardAccountsWithAuth(request, auth, 'test-token');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).accounts, [
    { email: 'owner@example.com', role: 'super_admin' },
    { email: 'viewer@example.com', role: 'admin' }
  ]);
});
