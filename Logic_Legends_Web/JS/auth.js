// JS/auth.js

// 1. Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    GoogleAuthProvider, 
    signInWithPopup,
    onAuthStateChanged,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 2. Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDF_VO9YeLPCRQ1D0OJDXSgYc3i9CxYcIc",
  authDomain: "logic-legends-ac66c.firebaseapp.com",
  databaseURL: "https://logic-legends-ac66c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "logic-legends-ac66c",
  storageBucket: "logic-legends-ac66c.firebasestorage.app",
  messagingSenderId: "251023689335",
  appId: "1:251023689335:web:78a7dca5859d3f48ec2872"
};

// 3. Initialize Firebase and Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// 4. DOM Elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const googleLoginBtn = document.getElementById('googleLoginBtn');

// 5. Handle Email/Password Login
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        
        const email = emailInput.value;
        const password = passwordInput.value;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Check if the email is verified
                if (userCredential.user.emailVerified) {
                    console.log("Logged in as:", userCredential.user.email);
                    window.location.href = "../index.html";
                } else {
                    // Kick them out if not verified
                    auth.signOut();
                    alert("Please verify your email address. Check your inbox for the link.");
                }
            })
            .catch((error) => {
                console.error("Error signing in:", error);
                alert("Login failed: " + error.message);
            });
    });
}

// 6. Handle Google Login
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        signInWithPopup(auth, googleProvider)
            .then((result) => {
                console.log("Google login successful:", result.user.displayName);
                window.location.href = "../index.html";
            })
            .catch((error) => {
                console.error("Google login error:", error);
                alert("Google login failed: " + error.message);
            });
    });
}

// 7. Check if already logged in and auto-redirect
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Only auto-redirect if they have verified their email
        // (Note: Google accounts are automatically marked as verified)
        if (user.emailVerified) {
            // Make sure we aren't already on the dashboard to prevent reloading
            if (!window.location.href.includes("i_dashboard.html")) {
                window.location.replace("../InstructorDashboard/i_dashboard.html");
            }
        } else {
            // If they are logged in but NOT verified, sign them out 
            // so they don't get stuck in an infinite loop!
            auth.signOut();
        }
    }
});


// --- SIGN UP LOGIC ---
const signupForm = document.getElementById('signupForm');
const signupEmailInput = document.getElementById('signupEmailInput');
const signupPasswordInput = document.getElementById('signupPasswordInput');
const googleSignupBtn = document.getElementById('googleSignupBtn');

// Handle Email/Password Sign Up
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        
        const email = signupEmailInput.value;
        const password = signupPasswordInput.value;

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Account created! Now send the verification email
                sendEmailVerification(userCredential.user)
                    .then(() => {
                        // Force sign out so they can't access the app yet
                        auth.signOut();
                        alert("Account created! Please check your email and click the verification link before logging in.");
                        window.location.href = "login_page.html";
                    });
            })
            .catch((error) => {
                console.error("Error signing up:", error);
                alert("Sign up failed: " + error.message);
            });
    });
}

// Handle Google Sign Up
if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', () => {
        // Firebase uses the exact same function for Google Login and Google Sign Up!
        signInWithPopup(auth, googleProvider)
            .then((result) => {
                console.log("Google signup/login successful:", result.user.displayName);
                window.location.href = "../index.html";
            })
            .catch((error) => {
                console.error("Google signup error:", error);
                alert("Google sign up failed: " + error.message);
            });
    });
}