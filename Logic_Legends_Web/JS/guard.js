import { subscribeSession } from './session.js';
subscribeSession(({ status, user, role }) => {
    if (status === 'loading') return;
    if (!user || !['admin', 'instructor', 'super_admin'].includes(role)) {
        location.replace('../InstructorDashboard/error_page.html'); return;
    }
    document.querySelectorAll('[data-super-admin-only]').forEach(node => { node.hidden = role !== 'super_admin'; });
    document.body.style.visibility = 'visible';
});
