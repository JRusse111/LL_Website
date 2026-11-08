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

export const auth = getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
export const appUrl = path => new URL(`../${path}`, import.meta.url).href;
