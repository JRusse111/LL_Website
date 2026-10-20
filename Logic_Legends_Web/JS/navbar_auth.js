// JS/navbar_auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Your exact Firebase config
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

// Find all elements with the 'login-btn' class (Desktop & Mobile)
const loginBtns = document.querySelectorAll('.login-btn');
const adminNavItems = document.querySelectorAll('[data-admin-nav]');

onAuthStateChanged(auth, async (user) => {
    let isAdmin = false;
    if (user && user.emailVerified) {
        try {
            const token = await getIdTokenResult(user, true);
            isAdmin = token.claims.admin === true || token.claims.super_admin === true;
        } catch (error) {
            console.error('Unable to check account role:', error);
        }
    }

    adminNavItems.forEach(item => { item.hidden = !isAdmin; });

    if (!user || !user.emailVerified) return;

    loginBtns.forEach(btn => {
        btn.textContent = 'LOGOUT';
        btn.href = '#';
        if (btn.dataset.logoutBound) return;
        btn.dataset.logoutBound = 'true';
        btn.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await signOut(auth);
                window.location.href = '/LoginPage/login_page.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    });
});
