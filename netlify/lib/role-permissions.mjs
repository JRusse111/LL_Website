export function canManageAccounts(claims) { return claims?.super_admin === true && claims?.email_verified === true; }
export function canManageStaff(claims) { return (claims?.super_admin === true || claims?.admin === true) && claims?.email_verified === true; }
export function grantedRole(claims) {
    if (claims?.super_admin === true) return 'super_admin';
    if (claims?.admin === true) return 'admin';
    if (claims?.instructor === true) return 'instructor';
    return null;
}
export function claimsWithoutDashboardAccess(currentClaims) {
    const { admin, super_admin, instructor, ...other } = currentClaims || {};
    return other;
}
export function claimsForRole(currentClaims, role) {
    if (!['admin', 'instructor'].includes(role)) throw new Error('Super Admin access can only be granted through the secure bootstrap process');
    return { ...claimsWithoutDashboardAccess(currentClaims), [role]: true };
}
