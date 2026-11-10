// Real UI and handlers, in-memory Auth/RTDB. No production credentials or network writes.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup } from './fixtures.mjs';
import { createEducationHandler } from '../netlify/lib/education.mjs';
import { createModerationHandler } from '../netlify/lib/moderation.mjs';
import { createDashboardAccountsHandler } from '../netlify/lib/dashboard-accounts.mjs';
const root = fileURLToPath(new URL('../Logic_Legends_Web/', import.meta.url));
const fixture = setup({ users: { player: { username: 'Student', points: 45, coins: 300, profile: { surname: 'Santos', firstName: 'Ana', middleName: 'Marie' }, trialRuns: { 1: { attempts: { a: { status: 'completed', correctAnswers: 3, incorrectAnswers: 1, retries: 1 } } } } }, outsider: { points: 20, username: 'Another student' } } });
const handlers = { education: createEducationHandler(fixture.deps), moderation: createModerationHandler(fixture.deps), 'dashboard-accounts': createDashboardAccountsHandler(fixture.deps), 'grant-dashboard-access': createDashboardAccountsHandler(fixture.deps) };
const authStub = `
import {auth,listeners} from '/JS/firebase.js';
export const onIdTokenChanged=(unused,fn)=>{listeners.add(fn);queueMicrotask(()=>fn(auth.currentUser));return()=>listeners.delete(fn)};
export const onAuthStateChanged=onIdTokenChanged;
export const getIdTokenResult=async()=>({claims:{}});
export async function signOut(){auth.currentUser=null;sessionStorage.setItem('qaGuest','yes');listeners.forEach(fn=>fn(null))}
export class GoogleAuthProvider {setCustomParameters(){}}
export const signInWithEmailAndPassword=async()=>{throw new Error('Live sign-in is disabled in the isolated preview')};
export const createUserWithEmailAndPassword=signInWithEmailAndPassword, signInWithPopup=signInWithEmailAndPassword, sendEmailVerification=signInWithEmailAndPassword, sendPasswordResetEmail=signInWithEmailAndPassword, updateProfile=signInWithEmailAndPassword;
`;
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:4320'); res.setHeader('Cache-Control', 'no-store');
    try {
        if (url.pathname.startsWith('/.netlify/functions/')) {
            const handler = handlers[url.pathname.split('/').at(-1)]; if (!handler) throw new Error('Unknown handler');
            let body=''; for await (const part of req) { body += part; if (body.length > 20000) throw new Error('Large request'); }
            const result = await handler(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body})}));
            res.writeHead(result.status,Object.fromEntries(result.headers)); res.end(await result.text()); return;
        }
        if (url.pathname === '/JS/firebase.js') {
            res.writeHead(200,{'Content-Type':'text/javascript'});
            res.end(`export const listeners=new Set();const role=new URL(location.href).searchParams.get('role')||sessionStorage.getItem('qaRole')||'player';sessionStorage.setItem('qaRole',role);const uid=({super_admin:'owner',instructor:'teacher',admin:'admin',player:'player',player2:'outsider'})[role]||'player';export const auth={currentUser:sessionStorage.getItem('qaGuest')?null:{uid,displayName:uid,email:uid+'@ncst.edu.ph',emailVerified:true,metadata:{creationTime:'2026-10-01'},getIdToken:async()=>uid}};export const appUrl=p=>new URL('../'+p,import.meta.url).href;`); return;
        }
        if (url.pathname === '/__qa/auth.js') { res.writeHead(200,{'Content-Type':'text/javascript'}); res.end(authStub); return; }
        const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(root.endsWith(sep)?root:root+sep)) {res.writeHead(403);res.end();return;}
        let data=await readFile(file);const extension=extname(file);
        if(extension==='.js'||extension==='.mjs') data=data.toString().replaceAll('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js','/__qa/auth.js');
        res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'})[extension]||'application/octet-stream'});res.end(data);
    } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(4320,'127.0.0.1',()=>console.log('Isolated preview: http://127.0.0.1:4320/InstructorDashboard/i_dashboard.html?role=instructor'));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
