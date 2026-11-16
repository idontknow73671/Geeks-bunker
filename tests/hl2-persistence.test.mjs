import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {prepareHalfLife2Persistence,prepareHalfLife2Document} from '../hl2-startup.js';
test('launcher preserves the actual persistence function rather than a fake success callback',()=>{
 const input=`            if (typeof FS !== 'undefined') {
              FS.syncfs = (p, cb) => {
                const fn = (typeof p === 'function') ? p : cb;
                if (fn) setTimeout(() => fn(null), 0);
              };
            }`;
 let calls=0;const real=(populate,cb)=>{calls++;cb(null);},context={FS:{syncfs:real}};vm.createContext(context);vm.runInContext(prepareHalfLife2Persistence(input),context);assert.equal(context.FS.syncfs,real);context.FS.syncfs(false,()=>{});assert.equal(calls,1);
});
test('actual adapted launcher contains no syncfs override',{skip:!process.env.HL2_ENGINE_FIXTURES},()=>{
 const html=fs.readFileSync(process.env.HL2_ENGINE_FIXTURES+'/cache/index.html','utf8');assert.match(html,/FS\.syncfs =/);const out=prepareHalfLife2Document(html);assert.doesNotMatch(out,/FS\.syncfs =/);assert.match(out,/Preserve the real FS.syncfs/);
});
