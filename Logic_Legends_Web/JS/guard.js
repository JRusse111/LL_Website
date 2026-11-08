import { onAuthStateChanged, getIdTokenResult } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { auth } from './firebase.js';

onAuthStateChanged(auth, async (user) => {
    if (!user || !user.emailVerified) {
        window.location.replace('../InstructorDashboard/error_page.html');
        return;
    }

    try {
        const token = await getIdTokenResult(user, true);
        if (token.claims.admin !== true && token.claims.super_admin !== true) {
            window.location.replace('../InstructorDashboard/error_page.html');
            return;
        }

        document.querySelectorAll('[data-super-admin-only]').forEach(section => {
            section.hidden = token.claims.super_admin !== true;
        });
        document.body.style.visibility = 'visible';
    } catch (error) {
        console.error('Dashboard access check failed:', error);
        window.location.replace('../InstructorDashboard/error_page.html');
    }
});
