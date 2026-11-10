import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Local additive migration. Always start from an actual export; never replace shared rules blindly.
const [input, output, pointsField = 'points'] = process.argv.slice(2);
if (!input || !output || resolve(input) === resolve(output)) throw new Error('Usage: node firebase/patch-database-rules.mjs exported.rules.json new.rules.json (different files)');
const data = JSON.parse(await readFile(input, 'utf8'));
if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(pointsField)) throw new Error('Invalid points field');
const guard = "auth != null && root.child('website/moderation').child(auth.uid).child('ban/active').val() !== true && (!root.child('website/moderation').child(auth.uid).child('sessionsRevokedAt').exists() || auth.token.auth_time > root.child('website/moderation').child(auth.uid).child('sessionsRevokedAt').val())";
function patch(node) {
    for (const [key, value] of Object.entries(node)) {
        if ((key === '.read' || key === '.write') && typeof value === 'string' && value.includes('auth') && !value.includes('sessionsRevokedAt')) node[key] = `(${guard}) && (${value})`;
        else if (!key.startsWith('.') && value && typeof value === 'object') patch(value);
    }
}
patch(data.rules);
const website = data.rules.website ||= {};
if (['.read','.write'].some(k => website[k] != null && website[k] !== false)) throw new Error('Existing website permissions need manual review before this migration.');
website['.read'] = false; website['.write'] = false;
const indexes = (existing, extra) => [...new Set([...(Array.isArray(existing) ? existing : typeof existing === 'string' ? [existing] : []), extra])];
website.sections ||= {}; website.sections['.indexOn'] = indexes(website.sections['.indexOn'], 'ownerUid');
website.feedback ||= {}; website.feedback['.indexOn'] = indexes(website.feedback['.indexOn'], 'submittedAt');
data.rules.users ||= {};
data.rules.users['.indexOn'] = indexes(data.rules.users['.indexOn'], pointsField);
await writeFile(output, JSON.stringify(data, null, 2) + '\n');
console.log('Wrote a local candidate. Review and test it with the shared backend rules before deployment.');
