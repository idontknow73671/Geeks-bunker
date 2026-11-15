import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {repairHalfLife2VertexBuffers,repairHalfLife2Client,repairHalfLife2FacialRendering,normalizeHalfLife2Model} from '../hl2-native.js';
import {prepareHalfLife2RuntimeResponse} from '../hl2-startup.js';
const repairs=[['libtogl.so',repairHalfLife2VertexBuffers,'2050fa8053a873f9765803896db0834ce76344c4272153c3ae565614746557c6'],['libclient.so',repairHalfLife2Client,'f0b3abb8b8d7b4415ea632367ce509dfe8b8d1e0613d41789740945bed9ee3f4'],['libstudiorender.so',repairHalfLife2FacialRendering,'ba10a413401d1bde3025fc6a8e0304f820511ba40aae8bb6aa1c2032568c6a16']];
const hash=b=>createHash('sha256').update(b).digest('hex');
function leb(b,p){let n=0,k=0,c;do{c=b[p++];n|=(c&127)<<k;k+=7;}while(c&128);return[n>>>0,p];}
function sections(b){const out=[];let p=8;while(p<b.length){const start=p,id=b[p++],[n,q]=leb(b,p);p=q+n;out.push({id,raw:b.slice(start,p),payload:b.slice(q,p)});}return out;}
function bodies(b){const code=sections(b).find(s=>s.id===10).payload;let[n,p]=leb(code,0);return Array.from({length:n},()=>{const[size,q]=leb(code,p);p=q+size;return code.slice(q,p);});}
test('unknown native builds and unrelated models stay byte-for-byte unchanged',async()=>{
 const bytes=new Uint8Array([0,97,115,109,1,0,0,0]);for(const[,repair]of repairs){const result=await repair(bytes);assert.equal(result.applied,false);assert.equal(result.bytes,bytes);}
 assert.equal(await normalizeHalfLife2Model('/hl2/models/other.mdl',bytes),bytes);
 const unknown=new Uint8Array(342440);assert.equal(await normalizeHalfLife2Model('/hl2/models/gman_high.mdl',unknown),unknown);
});
// Optional real-engine tests use an external cache, never vendor game binaries.
const root=process.env.HL2_ENGINE_FIXTURES;
for(const[name,repair,expected]of repairs)test('real '+name+' repair preserves every non-code section and remains valid/idempotent',{skip:!root},async()=>{
 const bytes=new Uint8Array(fs.readFileSync(root+'/cache/'+name)),before=hash(bytes),result=await repair(bytes);
 assert.equal(result.applied,true);assert.equal(hash(result.bytes),expected);assert.equal(hash(bytes),before);assert.ok(WebAssembly.validate(result.bytes));
 const originalSections=sections(bytes),modifiedSections=sections(result.bytes);assert.equal(originalSections.length,modifiedSections.length);
 originalSections.forEach((section,i)=>{assert.equal(section.id,modifiedSections[i].id);if(section.id!==10)assert.deepEqual(section.raw,modifiedSections[i].raw);});
 const originalBodies=bodies(bytes),modifiedBodies=bodies(result.bytes);assert.equal(originalBodies.length,modifiedBodies.length);
 assert.equal(originalBodies.filter((body,i)=>!Buffer.from(body).equals(Buffer.from(modifiedBodies[i]))).length,name==='libstudiorender.so'?1:2);
 const again=await repair(result.bytes);assert.equal(again.bytes,result.bytes);assert.equal(again.applied,true);
});
test('legacy G-Man adapter only changes its two eye material indices',{skip:!root},async()=>{
 const original=new Uint8Array(fs.readFileSync(root+'/assets/hl2/models/gman_high.mdl')),fixed=await normalizeHalfLife2Model('/hl2/models/gman_high.mdl',original);
 assert.deepEqual([...original.keys()].filter(i=>original[i]!==fixed[i]),[134792,134964]);assert.equal(fixed[134792],4);assert.equal(fixed[134964],2);assert.equal(original[134792],0);assert.equal(await normalizeHalfLife2Model('/hl2/models/gman_high.mdl',fixed),fixed);
});
test('the exact tested set is supplied at original resource URLs; mixed engine versions get no partial repair',{skip:!root},async()=>{
 const base='https://alexboops.github.io/half-life-2-port/',script=fs.readFileSync(root+'/cache/index.js','utf8');
 const runtime={fetch:async url=>new Response(url.endsWith('index.js')?script:fs.readFileSync(root+'/cache/'+url.slice(base.length)))};
 const resources=await prepareHalfLife2RuntimeResponse(runtime,base);assert.equal(resources.size,4);assert.match(await resources.get(base+'index.js').text(),/await gbHl2NormalizeModel\(path, blob\)/);
 for(const[name,,expected]of repairs)assert.equal(hash(new Uint8Array(await resources.get(base+name).arrayBuffer())),expected);
 const mixed=await prepareHalfLife2RuntimeResponse({fetch:async url=>url.endsWith('libclient.so')?new Response(new Uint8Array([0,97,115,109,1,0,0,0])):runtime.fetch(url)},base);
 assert.equal(mixed.size,1);assert.equal(await mixed.get(base+'index.js').text(),script);
});
function uleb(n){const b=[];do{const c=n&127;n>>>=7;b.push(c|(n?128:0));}while(n);return b;}
function nativeSnippet(params,instructions){
 const section=(id,data)=>[id,...uleb(data.length),...data];const name=[102];
 const type=[1,96,...uleb(params),...Array(params).fill(127),1,127];
 const body=[0,...instructions,11];
 return new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,...section(1,type),...section(3,[1,0]),...section(5,[1,0,1]),...section(7,[2,1,...name,0,0,1,109,2,0]),...section(10,[1,...uleb(body.length),...body])]))).exports;
}
test('actual patched native offset expression includes stream, declaration and base vertex',{skip:!root},async()=>{
 const {bytes}=await repairHalfLife2VertexBuffers(new Uint8Array(fs.readFileSync(root+'/cache/libtogl.so')));
 const body=bodies(bytes)[194],needle=Buffer.from('200b2802186a200320132802086c6a2108','hex'),offset=Buffer.from(body).indexOf(needle);assert.ok(offset>=0);
 const code=nativeSnippet(20,[32,19,40,2,4,...body.slice(offset,offset+needle.length),32,8]);const memory=new DataView(code.m.buffer);const args=Array(20).fill(0);args[11]=128;args[19]=256;memory.setUint32(128+24,40,true);memory.setUint32(256+4,128,true);memory.setUint32(256+8,48,true);
 for(const base of [0,1,130,27000]){args[3]=base;assert.equal(code.f(...args),128+40+base*48);}
});
test('actual renderer mask retains enabled facial animation and honors disabled input',{skip:!root},async()=>{
 const {bytes}=await repairHalfLife2FacialRendering(new Uint8Array(fs.readFileSync(root+'/cache/libstudiorender.so')));
 const needle=Buffer.from('2002200841ffff03713b0124','hex'),offset=Buffer.from(bytes).indexOf(needle);assert.ok(offset>=0);
 const code=nativeSnippet(9,[...bytes.slice(offset,offset+needle.length),32,2,47,1,36]),args=Array(9).fill(0);args[2]=128;
 for(const flags of [49,113,241,0]){args[8]=flags;assert.equal(code.f(...args),flags);}
});
