import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {repairHalfLife2VertexBuffers,repairHalfLife2Client,repairHalfLife2FacialRendering,repairHalfLife2CharacterLOD,normalizeHalfLife2Model} from '../hl2-native.js';
import {prepareHalfLife2RuntimeResponse} from '../hl2-startup.js';
const repairs=[['libtogl.so',repairHalfLife2VertexBuffers,'2050fa8053a873f9765803896db0834ce76344c4272153c3ae565614746557c6'],['libclient.so',repairHalfLife2Client,'a544af5433d44fd61b4729bb3c5235fbe44dcb163949a5b22cd56a551025b593'],['libstudiorender.so',repairHalfLife2FacialRendering,'ba10a413401d1bde3025fc6a8e0304f820511ba40aae8bb6aa1c2032568c6a16'],['libengine.so',repairHalfLife2CharacterLOD,'ce66700c251b099d6612c94c155d8db0545517bff7ab2c89f64d6e943387dc67']];
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
 assert.equal(originalBodies.filter((body,i)=>!Buffer.from(body).equals(Buffer.from(modifiedBodies[i]))).length,name==='libclient.so'?3:['libstudiorender.so','libengine.so'].includes(name)?1:2);
 const again=await repair(result.bytes);assert.equal(again.bytes,result.bytes);assert.equal(again.applied,true);
});
test('legacy G-Man adapter only changes its two eye material indices',{skip:!root},async()=>{
 const original=new Uint8Array(fs.readFileSync(root+'/assets/hl2/models/gman_high.mdl')),fixed=await normalizeHalfLife2Model('/hl2/models/gman_high.mdl',original);
 assert.deepEqual([...original.keys()].filter(i=>original[i]!==fixed[i]),[134792,134964]);assert.equal(fixed[134792],4);assert.equal(fixed[134964],2);assert.equal(original[134792],0);assert.equal(await normalizeHalfLife2Model('/hl2/models/gman_high.mdl',fixed),fixed);
});
test('the exact tested set is supplied at original resource URLs; mixed engine versions get no partial repair',{skip:!root},async()=>{
 const base='https://alexboops.github.io/half-life-2-port/',script=fs.readFileSync(root+'/cache/index.js','utf8');
 const runtime={fetch:async url=>new Response(url.endsWith('index.js')?script:fs.readFileSync(root+'/cache/'+url.slice(base.length)))};
 const resources=await prepareHalfLife2RuntimeResponse(runtime,base);assert.equal(resources.size,5);assert.match(await resources.get(base+'index.js').text(),/await gbHl2NormalizeModel\(path, blob\)/);
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
test('the actual NPC LOD override is disabled without changing normal LOD selection',{skip:!root},async()=>{
 const input=new Uint8Array(fs.readFileSync(root+'/cache/libengine.so')),{bytes}=await repairHalfLife2CharacterLOD(input);
 const original=Buffer.from('238180808000419081b280006a28021c280230','hex'),offset=Buffer.from(input).indexOf(original);
 assert.ok(offset>=0);assert.equal(bytes.length,input.length);
 assert.deepEqual(bytes.subarray(0,offset),input.subarray(0,offset));assert.deepEqual(bytes.subarray(offset+19),input.subarray(offset+19));
 // Execute the actual replacement followed by the engine's signed test:
 // override < 0 branches past the web-only model-name override.
 const code=nativeSnippet(0,[...bytes.slice(offset,offset+19),0x41,0,0x48]);assert.equal(code.f(),1);
});
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
function legacyModel({materials=[3,1],versions=44,explicit=[0,0]}={}){
 const b=new Uint8Array(1400),v=new DataView(b.buffer),put=(p,n)=>v.setInt32(p,n,true);
 put(0,0x54534449);put(4,versions);put(76,b.length);put(204,400);put(232,1);put(236,244);
 put(248,1);put(256,16);const model=260;put(model+72,2);put(model+76,148);put(model+100,2);put(model+104,380);
 for(let i=0;i<2;i++){const mesh=408+i*116;put(mesh,materials[i]);put(mesh+24,1);put(mesh+28,i);put(640+i*172+52,explicit[i]);}
 return b;
}
test('eye mapping follows each model rather than G-Man offsets, and writes full material indices',async()=>{
 for(const version of [44,46,48,49]){const b=legacyModel({materials:[300,0],versions:version});const out=await normalizeHalfLife2Model('/hl2/models/custom/npc.mdl',b);assert.equal(new DataView(out.buffer).getInt32(692,true),300);assert.equal(new DataView(out.buffer).getInt32(864,true),0);assert.equal(b[692],0);assert.equal(await normalizeHalfLife2Model('/hl2/models/custom/npc.mdl',out),out);}
 const b=legacyModel({explicit:[2,1]});assert.equal(await normalizeHalfLife2Model('/hl2/models/barney.mdl',b),b);
});
test('invalid model layouts fail atomically without changing earlier valid eye records',async()=>{
 for(const mutate of [v=>v.setInt32(4,50,true),v=>v.setInt32(76,1000,true),v=>v.setInt32(248,10000,true),v=>v.setInt32(260+104,1399,true),v=>v.setInt32(408+116+28,99,true),v=>v.setInt32(408+116,500,true)]){const b=legacyModel();mutate(new DataView(b.buffer));const before=b.slice();assert.equal(await normalizeHalfLife2Model('/hl2/models/npc.mdl',b),b);assert.deepEqual(b,before);}
});
test('ambiguous eye materials are retained while independent unambiguous eyes can be repaired',async()=>{
 const b=legacyModel(),v=new DataView(b.buffer);v.setInt32(408+116+28,0,true);assert.equal(await normalizeHalfLife2Model('/hl2/models/npc.mdl',b),b);
});
test('all 19 cached character models get their own eye materials without other changes',{skip:!root},async()=>{
 const expected={
  'humans/group01/male_01.mdl':[4,2],'humans/group01/male_02.mdl':[3,4],'humans/group01/male_03.mdl':[2,1],'humans/group01/male_04.mdl':[3,1],'humans/group01/male_05.mdl':[2,3],'humans/group01/male_06.mdl':[3,1],'humans/group01/male_07.mdl':[3,1],'humans/group01/male_08.mdl':[3,2],'humans/group01/male_09.mdl':[1,3],
  'humans/group01/female_01.mdl':[3,1],'humans/group01/female_02.mdl':[4,0],'humans/group01/female_03.mdl':[4,2],'humans/group01/female_04.mdl':[3,2],'humans/group01/female_06.mdl':[1,2],'humans/group01/female_07.mdl':[1,3],
  'breen_monitor.mdl':[2,3],'gman_high.mdl':[4,2],'barney.mdl':[3,1],'vortigaunt_slave.mdl':[2,3,4,0]
 };
 for(const [file,materials]of Object.entries(expected)){
  const path='/hl2/models/'+file,b=new Uint8Array(fs.readFileSync(root+'/npc-assets'+path)),out=await normalizeHalfLife2Model(path,b),view=new DataView(b.buffer),get=p=>view.getInt32(p,true),bp=get(236),model=bp+get(bp+12),eyes=model+get(model+104),fixed=new DataView(out.buffer),allowed=new Set();
  materials.forEach((material,i)=>{const p=eyes+i*172+52;assert.equal(fixed.getInt32(p,true),material,file+' eye '+i);for(let j=0;j<4;j++)allowed.add(p+j);});
  for(let i=0;i<b.length;i++)if(b[i]!==out[i])assert.ok(allowed.has(i),file+' changed non-eye byte '+i);
  assert.equal(await normalizeHalfLife2Model(path,out),out);
 }
});
test('packed-archive subarrays retain their offsets and leave surrounding data untouched',async()=>{
 const model=legacyModel(),archive=new Uint8Array(model.length+128).fill(0xab);archive.set(model,64);const original=archive.slice(),view=archive.subarray(64,64+model.length),out=await normalizeHalfLife2Model('/hl2/models/packed.mdl',view);
 assert.equal(new DataView(out.buffer,out.byteOffset,out.byteLength).getInt32(692,true),3);assert.deepEqual(archive,original);assert.equal(out.length,model.length);
});
test('eye zero is resolved independently in separate body parts',async()=>{
 const b=new Uint8Array(4000),v=new DataView(b.buffer),put=(p,n)=>v.setInt32(p,n,true);put(0,0x54534449);put(4,44);put(76,b.length);put(204,8);put(232,2);put(236,244);
 for(let body=0;body<2;body++){
  const bp=244+body*16,model=288+body*1000;put(bp+4,1);put(bp+12,model-bp);put(model+72,2);put(model+76,148);put(model+100,2);put(model+104,380);
  for(let eye=0;eye<2;eye++){const mesh=model+148+eye*116;put(mesh,body?4-eye:eye+1);put(mesh+24,1);put(mesh+28,eye);}
 }
 const out=await normalizeHalfLife2Model('/hl2/models/bodygroups.mdl',b),fixed=new DataView(out.buffer);assert.deepEqual([720,892,1720,1892].map(p=>fixed.getInt32(p,true)),[1,2,4,3]);
});
test('mesh material references can address skin slots beyond the distinct texture count',async()=>{
 const b=legacyModel({materials:[3,1]}),v=new DataView(b.buffer);v.setInt32(204,2,true);v.setInt32(220,4,true);const out=await normalizeHalfLife2Model('/hl2/models/skins.mdl',b);assert.equal(new DataView(out.buffer).getInt32(692,true),3);
});
test('monitor views skip absent players and inactive cameras using real native predicates',{skip:!root},async()=>{
 const {bytes}=await repairHalfLife2Client(new Uint8Array(fs.readFileSync(root+'/cache/libclient.so'))),body=bodies(bytes)[8779];
 assert.ok(Buffer.from(body).includes(Buffer.from('21062006450d0041002107','hex')));
 assert.ok(Buffer.from(body).includes(Buffer.from('0340024020022d009c0a450d00024020022002','hex')));
 // Execute the real new IsActive load/test; a cleared camera must be skipped.
 const p=Buffer.from(body).indexOf(Buffer.from('20022d009c0a45','hex')),code=nativeSnippet(3,[...body.slice(p,p+7)]),args=[0,0,128],memory=new Uint8Array(code.m.buffer);
 for(const active of [0,1]){memory[128+1308]=active;assert.equal(code.f(...args),active?0:1);}
});
