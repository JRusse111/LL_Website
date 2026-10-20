import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged, getIdTokenResult } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyDF_VO9YeLPCRQ1D0OJDXSgYc3i9CxYcIc",
  authDomain: "logic-legends-ac66c.firebaseapp.com",
  databaseURL: "https://logic-legends-ac66c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "logic-legends-ac66c",
  storageBucket: "logic-legends-ac66c.firebasestorage.app",
  messagingSenderId: "251023689335",
  appId: "1:251023689335:web:78a7dca5859d3f48ec2872"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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
        const roleStatus = document.getElementById('dashboardRoleStatus');
        const roleName = document.getElementById('dashboardRoleName');
        if (roleStatus && roleName) {
            roleName.textContent = token.claims.super_admin === true ? 'Super admin' : 'Admin (view only)';
            roleStatus.hidden = false;
        }
        document.body.style.visibility = 'visible';
    } catch (error) {
        console.error('Dashboard access check failed:', error);
        window.location.replace('../InstructorDashboard/error_page.html');
    }
});
