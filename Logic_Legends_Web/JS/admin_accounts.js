import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDF_VO9YeLPCRQ1D0OJDXSgYc3i9CxYcIc',
  authDomain: 'logic-legends-ac66c.firebaseapp.com',
  databaseURL: 'https://logic-legends-ac66c-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'logic-legends-ac66c',
  storageBucket: 'logic-legends-ac66c.firebasestorage.app',
  messagingSenderId: '251023689335',
  appId: '1:251023689335:web:78a7dca5859d3f48ec2872'
};

const auth = getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
const form = document.getElementById('grantDashboardAccessForm');
const emailInput = document.getElementById('adminAccountEmail');
const roleInput = document.getElementById('adminAccountRole');
const feedback = document.getElementById('grantAccessFeedback');
const submitButton = form?.querySelector('button[type="submit"]');

function showFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle('is-error', isError);
  feedback.hidden = false;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const email = emailInput.value.trim();
  const role = roleInput.value;
  const user = auth.currentUser;
  if (!user) {
    showFeedback('Your session has ended. Sign in again.', true);
    return;
  }

  submitButton.disabled = true;
  feedback.hidden = true;
  try {
    const idToken = await user.getIdToken(true);
    const response = await fetch('/.netlify/functions/grant-dashboard-access', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, role })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Access could not be granted.');

    const roleLabel = result.role === 'super_admin' ? 'super admin' : 'admin';
    showFeedback(result.alreadyGranted
      ? `This account already has ${roleLabel} access.`
      : `${roleLabel === 'super admin' ? 'Super admin' : 'Admin'} access granted. Ask this person to sign in again.`);
    form.reset();
  } catch (error) {
    showFeedback(error.message || 'Access could not be granted.', true);
  } finally {
    submitButton.disabled = false;
  }
});
