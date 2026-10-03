// JS/navbar_auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

onAuthStateChanged(auth, (user) => {
    // Check if user is logged in AND verified
    if (user && user.emailVerified) {
        
        loginBtns.forEach(btn => {
            // Change the appearance
            btn.textContent = 'LOGOUT';
            btn.href = '#'; 
            
            // Attach the Firebase Sign Out function
            btn.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent it from jumping to top of page
                
                signOut(auth).then(() => {
                    console.log("User signed out.");
                    
                    // SMART REDIRECT: Check if we are inside a subfolder or on the main page
                    if (window.location.pathname.includes('/InstructorDashboard/') || window.location.pathname.includes('/LoginPage/')) {
                        window.location.href = "../LoginPage/login_page.html"; // Step out of subfolder
                    } else {
                        window.location.href = "LoginPage/login_page.html"; // From root index.html
                    }
                }).catch((error) => {
                    console.error("Logout error:", error);
                });
            });
        });
    }
});