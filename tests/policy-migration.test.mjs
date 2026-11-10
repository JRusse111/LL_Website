import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
test('deployed Auth policy uses the same domain rules as website/backend', async () => {
    assert.equal(await readFile(new URL('../firebase/account-policy.mjs',import.meta.url),'utf8'),await readFile(new URL('../Logic_Legends_Web/JS/account-policy.mjs',import.meta.url),'utf8'));
});
test('database rule migration preserves existing wallet validation, indexes and input file', async () => {
    const temp = await mkdtemp(join(tmpdir(),'ll-website-rules-'));
    try {
        const original={rules:{'.read':false,'.write':false,commerceOrders:{'.indexOn':['expiryCheckAt']},users:{'.indexOn':'username','$uid':{'.read':'auth != null && auth.uid === $uid',coins:{'.write':'auth != null && auth.uid === $uid','.validate':'newData.isNumber() && newData.val() >= 0'}}}}};
        const input=join(temp,'before.json'),output=join(temp,'after.json');await writeFile(input,JSON.stringify(original));
        const script=fileURLToPath(new URL('../firebase/patch-database-rules.mjs',import.meta.url));
        const result=spawnSync(process.execPath,[script,input,output,'totalPoints'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
        const migrated=JSON.parse(await readFile(output,'utf8'));
        assert.deepEqual(JSON.parse(await readFile(input,'utf8')),original);
        assert.deepEqual(migrated.rules.commerceOrders,original.rules.commerceOrders);
        assert.equal(migrated.rules.users.$uid.coins['.validate'],original.rules.users.$uid.coins['.validate']);
        assert.match(migrated.rules.users.$uid.coins['.write'],/sessionsRevokedAt/);assert.match(migrated.rules.users.$uid['.read'],/ban\/active/);
        assert.deepEqual(migrated.rules.users['.indexOn'],['username','totalPoints']);assert.equal(migrated.rules.website['.write'],false);
    } finally { if (resolve(temp).startsWith(resolve(tmpdir())+sep)) await rm(temp,{recursive:true,force:true}); }
});
