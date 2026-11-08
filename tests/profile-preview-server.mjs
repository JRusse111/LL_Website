// Isolated UI test server. Serves the real application with fake Auth records.
// This file is outside Netlify's publish directory and never contacts Firebase.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDashboardAccountsHandler } from '../netlify/lib/dashboard-accounts.mjs';

const root = fileURLToPath(new URL('../Logic_Legends_Web/', import.meta.url));
const users = new Map([
    { uid: 'owner', displayName: 'Avery Morgan', email: 'avery@example.test', customClaims: { admin: true, super_admin: true } },
    { uid: 'staff', displayName: 'Mika Santos', email: 'mika@example.test', customClaims: { admin: true } },
    { uid: 'coowner', displayName: 'Jordan Lee', email: 'jordan@example.test', customClaims: { admin: true, super_admin: true } },
    { uid: 'player', displayName: 'Rowan Blake', email: 'rowan@example.test', customClaims: {} }
].map(user => [user.uid, { ...user, emailVerified: true, disabled: false }]));
const service = {
    async verifyIdToken(token) {
        const uid = token.replace('preview-', '');
        if (!users.has(uid)) throw { code: 'auth/id-token-revoked' };
        return { uid };
    },
    async getUser(uid) {
        if (!users.has(uid)) throw { code: 'auth/user-not-found' };
        return structuredClone(users.get(uid));
    },
    async getUserByEmail(email) {
        const user = [...users.values()].find(user => user.email === email);
        if (!user) throw { code: 'auth/user-not-found' };
        return structuredClone(user);
    },
    async listUsers() { return { users: [...users.values()] }; },
    async setCustomUserClaims(uid, claims) { users.get(uid).customClaims = claims; },
    async revokeRefreshTokens() {}
};
const api = createDashboardAccountsHandler({ getAuth: () => service });
const firebaseStub = `
const role = new URL(location.href).searchParams.get('role') || sessionStorage.getItem('previewRole') || 'player';
sessionStorage.setItem('previewRole', role);
const uid = role === 'super_admin' ? 'owner' : role === 'admin' ? 'staff' : 'player';
const names = {owner:['Avery Morgan','avery@example.test'],staff:['Mika Santos','mika@example.test'],player:['Rowan Blake','rowan@example.test']};
export const listeners = new Set();
export const auth = {currentUser:sessionStorage.getItem('previewGuest') ? null : {uid,displayName:names[uid][0],email:names[uid][1],emailVerified:true,metadata:{creationTime:'2026-10-01T08:00:00Z'},getIdToken:async()=> 'preview-' + uid}};
export const appUrl = path => new URL('../' + path, import.meta.url).href;
export const claims = role === 'super_admin' ? {admin:true,super_admin:true} : role === 'admin' ? {admin:true} : {};
`;
const authStub = `
import {auth,listeners,claims} from '/JS/firebase.js';
export const onIdTokenChanged = (unused,listener) => {listeners.add(listener);queueMicrotask(()=>listener(auth.currentUser));return ()=>listeners.delete(listener);};
export const onAuthStateChanged = onIdTokenChanged;
export const getIdTokenResult = async () => ({claims});
export async function signOut(){auth.currentUser=null;sessionStorage.setItem('previewGuest','true');listeners.forEach(fn=>fn(null));}
export class GoogleAuthProvider {}
export const signInWithEmailAndPassword = async()=>{throw new Error('Sign-in is disabled in the sample preview.');};
export const createUserWithEmailAndPassword=signInWithEmailAndPassword,signInWithPopup=signInWithEmailAndPassword,sendEmailVerification=signInWithEmailAndPassword,sendPasswordResetEmail=signInWithEmailAndPassword;
`;

const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1:4318');
    response.setHeader('Cache-Control', 'no-store');
    try {
        if (url.pathname === '/.netlify/functions/dashboard-accounts') {
            let body = '';
            for await (const chunk of request) body += chunk;
            const result = await api(new Request(url, { method: request.method, headers: request.headers, ...(['GET','HEAD'].includes(request.method) ? {} : { body }) }));
            response.writeHead(result.status, Object.fromEntries(result.headers));
            response.end(await result.text());
            return;
        }
        if (url.pathname === '/JS/firebase.js' || url.pathname === '/__test/firebase-auth.js') {
            response.writeHead(200, { 'Content-Type': 'text/javascript' });
            response.end(url.pathname === '/JS/firebase.js' ? firebaseStub : authStub);
            return;
        }
        const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403); response.end(); return; }
        const extension = extname(path);
        let data = await readFile(path);
        const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp'};
        if (extension === '.js') data = data.toString().replaceAll('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js', '/__test/firebase-auth.js');
        if (extension === '.html') data = data.toString().replace('</body>', '<div style="position:fixed;bottom:10px;left:10px;z-index:2000;padding:6px 10px;border:1px solid #b58b49;background:#081e27;color:#ffe3ae;border-radius:6px;font:12px sans-serif">Test preview · Sample accounts · No Firebase changes</div></body>');
        response.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream' });
        response.end(data);
    } catch (error) {
        response.writeHead(404);
        response.end('Not found');
    }
});
server.listen(4318, '127.0.0.1', () => console.log('Sample account preview: http://127.0.0.1:4318/Profile/profile.html?role=super_admin'));
process.on('SIGINT', () => server.close(() => process.exit(0)));
