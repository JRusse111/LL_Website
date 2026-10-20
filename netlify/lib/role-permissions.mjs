export function canManageAccounts(claims) {
  return claims?.super_admin === true && claims?.email_verified === true;
}

export function grantedRole(claims) {
  if (claims?.super_admin === true) return 'super_admin';
  if (claims?.admin === true) return 'admin';
  return null;
}

export function claimsForRole(currentClaims, role) {
  if (role !== 'admin' && role !== 'super_admin') {
    throw new Error('Invalid dashboard role');
  }
  return {
    ...currentClaims,
    admin: true,
    ...(role === 'super_admin' ? { super_admin: true } : {})
  };
}
