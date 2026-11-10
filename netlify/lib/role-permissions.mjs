export function canManageAccounts(claims) { return claims?.super_admin === true && claims?.email_verified === true; }
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
    if (!['admin', 'super_admin', 'instructor'].includes(role)) throw new Error('Invalid dashboard role');
    return { ...claimsWithoutDashboardAccess(currentClaims), ...(role === 'instructor' ? { instructor: true } : { admin: true }), ...(role === 'super_admin' ? { super_admin: true } : {}) };
}
