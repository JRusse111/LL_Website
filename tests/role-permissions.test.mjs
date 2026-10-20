import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageAccounts, claimsForRole, grantedRole } from '../netlify/lib/role-permissions.mjs';

test('only a verified super admin can manage dashboard accounts', () => {
  assert.equal(canManageAccounts({ admin: true, email_verified: true }), false);
  assert.equal(canManageAccounts({ super_admin: true, email_verified: false }), false);
  assert.equal(canManageAccounts({ super_admin: true, email_verified: true }), true);
});

test('granting admin preserves other claims without adding super admin', () => {
  const claims = claimsForRole({ department: 'science' }, 'admin');
  assert.deepEqual(claims, { department: 'science', admin: true });
  assert.equal(grantedRole(claims), 'admin');
});

test('granting super admin includes dashboard access', () => {
  const claims = claimsForRole({ admin: true }, 'super_admin');
  assert.deepEqual(claims, { admin: true, super_admin: true });
  assert.equal(grantedRole(claims), 'super_admin');
});

test('unknown roles are rejected', () => {
  assert.throws(() => claimsForRole({}, 'owner'), /Invalid dashboard role/);
});
