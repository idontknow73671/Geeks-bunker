import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {unpackGeekfoxXpi,inspectGeekfoxXpi,geekfoxWebextPattern,geekfoxXpiCRC} from '../geekfox-webextensions.js';

// Small real ZIP archives, including malformed inputs, without network dependencies.
function archive(entries,{method=8,flags=0,corrupt=false,expanded=null}={}) {
    const local=[],central=[];let offset=0;
    for(const [name,text] of entries){
        const path=Buffer.from(name),bytes=Buffer.from(text),compressed=method===0?bytes:deflateRawSync(bytes),crc=geekfoxXpiCRC(bytes);
        const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(flags,6);header.writeUInt16LE(method,8);header.writeUInt32LE(crc+(corrupt?1:0),14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(expanded??bytes.length,22);header.writeUInt16LE(path.length,26);
        const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(flags,8);directory.writeUInt16LE(method,10);directory.writeUInt32LE(crc+(corrupt?1:0),16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(expanded??bytes.length,24);directory.writeUInt16LE(path.length,28);directory.writeUInt32LE(offset,42);
        local.push(header,path,compressed);central.push(directory,path);offset+=header.length+path.length+compressed.length;
    }
    const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
    return Buffer.concat([...local,directory,end]);
}
const manifest={manifest_version:3,name:'Fixture',version:'1.0',permissions:['storage'],content_scripts:[{matches:['https://*.example.com/*'],js:['main.js']}]};
const entries=[['manifest.json',JSON.stringify(manifest)],['main.js','document.body.dataset.extension="yes";']];
test('loads compressed and stored XPI packages',async()=>{
    for(const method of [0,8]){const files=await unpackGeekfoxXpi(archive(entries,{method}));assert.equal(inspectGeekfoxXpi(files).name,'Fixture');assert.equal(new TextDecoder().decode(files.get('main.js')),entries[1][1]);}
});
test('rejects damaged and truncated ZIP data',async()=>{
    await assert.rejects(()=>unpackGeekfoxXpi(archive(entries,{corrupt:true})),/integrity/);
    await assert.rejects(()=>unpackGeekfoxXpi(archive(entries).subarray(0,-1)),/complete/);
    await assert.rejects(()=>unpackGeekfoxXpi(new Uint8Array([1,2,3])),/complete/);
});
test('rejects unsafe paths, duplicate files and encryption',async()=>{
    await assert.rejects(()=>unpackGeekfoxXpi(archive([...entries,['../bad.js','x']])),/path/);
    await assert.rejects(()=>unpackGeekfoxXpi(archive([...entries,['main.js','x']])),/Duplicate/);
    await assert.rejects(()=>unpackGeekfoxXpi(archive(entries,{flags:1})),/Encrypted/);
});
test('enforces declared decompressed size before accepting files',async()=>{
    await assert.rejects(()=>unpackGeekfoxXpi(archive(entries,{expanded:1})),/declared size/);
    await assert.rejects(()=>unpackGeekfoxXpi(archive(entries,{expanded:9*1024*1024})),/size limit/);
});
test('requires a root manifest and rejects unavailable Firefox features',async()=>{
    await assert.rejects(()=>unpackGeekfoxXpi(archive([['folder/manifest.json','{}']])),/root/);
    for(const extra of [{background:{scripts:['main.js']}},{permissions:['proxy']},{action:{default_popup:'popup.html'}},{content_scripts:[{...manifest.content_scripts[0],run_at:'document_start'}]}]){
        const files=await unpackGeekfoxXpi(archive([['manifest.json',JSON.stringify({...manifest,...extra})],entries[1]]));assert.throws(()=>inspectGeekfoxXpi(files),/cannot provide/);
    }
});
test('missing content scripts do not silently install',async()=>{
    const files=await unpackGeekfoxXpi(archive([entries[0]]));assert.throws(()=>inspectGeekfoxXpi(files),/Missing content script/);
});
test('matches original sites with domain boundaries, paths and schemes',()=>{
    const match=geekfoxWebextPattern;
    assert(match('*://*.example.com/articles/*','https://example.com/articles/a?b=1#c'));
    assert(match('*://*.example.com/*','http://sub.example.com/'));
    assert(!match('*://*.example.com/*','https://example.com.evil.org/'));
    assert(!match('*://*.example.com/*','https://evil-example.com/'));
    assert(!match('https://example.com/*','http://example.com/'));
    assert(!match('https://example.com/articles/*','https://example.com/other'));
    assert(match('<all_urls>','https://example.com/'));
    assert(!match('<all_urls>','file:///private/data'));
    assert(!match('<all_urls>','javascript:alert(1)'));
});
