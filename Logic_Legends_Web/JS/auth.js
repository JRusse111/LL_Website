// JS/auth.js

// 1. Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    GoogleAuthProvider, 
    signInWithPopup,
    sendEmailVerification,
    sendPasswordResetEmail,
    getIdTokenResult
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
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const resetFeedback = document.getElementById('resetFeedback');

// Both dashboard roles can enter the dashboard.
async function finishLogin(user) {
    if (!user.emailVerified) {
        await auth.signOut();
        alert('Please verify your email address. Check your inbox for the link.');
        return;
    }

    const token = await getIdTokenResult(user, true);
    window.location.replace(token.claims.admin === true || token.claims.super_admin === true
        ? '../InstructorDashboard/i_dashboard.html'
        : '../index.html');
}

// 5. Handle Email/Password Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            await finishLogin(credential.user);
        } catch (error) {
            console.error('Error signing in:', error);
            alert('Login failed: ' + error.message);
        }
    });
}

// Send a password reset link to the email entered on the login form.
if (resetPasswordBtn && emailInput && resetFeedback) {
    const showResetFeedback = (message, isError = false) => {
        resetFeedback.textContent = message;
        resetFeedback.classList.toggle('is-error', isError);
        resetFeedback.hidden = false;
    };

    resetPasswordBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();

        if (!email) {
            showResetFeedback('Enter your email address above first.', true);
            emailInput.focus();
            return;
        }

        if (!emailInput.checkValidity()) {
            showResetFeedback('Enter a valid email address.', true);
            emailInput.focus();
            return;
        }

        resetPasswordBtn.disabled = true;
        resetPasswordBtn.textContent = 'Sending...';
        resetFeedback.hidden = true;

        try {
            await sendPasswordResetEmail(auth, email);
            showResetFeedback('If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.');
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                showResetFeedback('If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.');
            } else {
                console.error('Password reset error:', error);
                showResetFeedback('Could not send a password reset link right now. Please try again.', true);
            }
        } finally {
            resetPasswordBtn.disabled = false;
            resetPasswordBtn.textContent = 'Forgot Password?';
        }
    });
}

// 6. Handle Google Login
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            await finishLogin(result.user);
        } catch (error) {
            console.error('Google login error:', error);
            alert('Google login failed: ' + error.message);
        }
    });
}

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
