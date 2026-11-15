// Compatibility repairs for the exact upstream WASM builds below. Unknown
// builds pass through unchanged. No game content or storage is replaced.
const hl2Hex=hex=>Uint8Array.from(hex.match(/../g),v=>parseInt(v,16));
async function hl2Hash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
function hl2LEB(value){const out=[];do{let b=value&127;value>>>=7;out.push(b|(value?128:0));}while(value);return out;}
function hl2ReadLEB(bytes,offset){let value=0,shift=0,b;do{b=bytes[offset++];value|=(b&127)<<shift;shift+=7;}while(b&128);return [value>>>0,offset];}
function hl2Join(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;}
function hl2ReplaceOnce(bytes,from,to){const matches=[];for(let i=0;i<=bytes.length-from.length;i++)if(from.every((v,j)=>bytes[i+j]===v))matches.push(i);if(matches.length!==1)throw Error('HL2 native instruction signature changed');const i=matches[0];return hl2Join([bytes.subarray(0,i),to,bytes.subarray(i+from.length)]);}
export async function repairHalfLife2VertexBuffers(bytes){
 const hash=await hl2Hash(bytes);
 if(hash==='2050fa8053a873f9765803896db0834ce76344c4272153c3ae565614746557c6')return {bytes,applied:true};
 if(hash!=='77e1c265ed9d9b27a90dbb73dea0d0f185c038b669f43d9d04364021399415b1')return {bytes,applied:false};
 let offset=8;
 while(offset<bytes.length){const start=offset,id=bytes[offset++];const [length,payload]=hl2ReadLEB(bytes,offset);offset=payload+length;if(id!==10)continue;
  let [count,cursor]=hl2ReadLEB(bytes,payload);const bodies=[];
  for(let i=0;i<count;i++){const [size,p]=hl2ReadLEB(bytes,cursor);let body=bytes.subarray(p,p+size);cursor=p+size;
   // DrawIndexedPrimitive passes BaseVertexIndex to FlushDrawStates.
   if(i===193)body=hl2ReplaceOnce(body,hl2Hex('2204417f6a4100108582808000'),hl2Hex('2204417f6a2002108582808000'));
   if(i===194){
    // The fast cache did not include BaseVertexIndex. Recheck attributes;
    // each attribute still has its own cache, including its computed offset.
    body=hl2ReplaceOnce(body,hl2Hex('413c109680808000450d03'),hl2Hex('413c109680808000451a01'));
    // offset = declaration + stream + BaseVertexIndex * stream stride.
    body=hl2ReplaceOnce(body,hl2Hex('200b2802186a2108'),hl2Hex('200b2802186a200320132802086c6a2108'));
   }
   bodies.push(hl2LEB(body.length),body);
  }
  const code=hl2Join([hl2LEB(count),...bodies]);return {bytes:hl2Join([bytes.subarray(0,start),[10],hl2LEB(code.length),code,bytes.subarray(offset)]),applied:true};
 }
 throw Error('HL2 translation library has no code section');
}
// Restore C_BaseFlex::SetupWeights and its this-adjusting thunk. The upstream
// stubs only zero the output; the existing controller, scene and viseme routines
// remain intact. Source for these two replacement bodies: engine-patches/hl2-flex.wat.
export async function repairHalfLife2Client(bytes) {
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash==='f0b3abb8b8d7b4415ea632367ce509dfe8b8d1e0613d41789740945bed9ee3f4')return {bytes,applied:true};
    if(hash!=='69f7b3d2722e3c3941f7a2baa72b3f663cf86d67d40467ae6a872fd531787798')return {bytes,applied:false};
    const fromHex=hex=>Uint8Array.from(hex.match(/../g),v=>parseInt(v,16));
    const setup=fromHex('01047f024020002d00c0100d0020002802c810210520054504402000108b0920002802c81021050b2005450d0020052802002106200628028c0241004a044020062006280290026a280208417f46044041002107034020062006280290026a200741146c6a21082008200820082802046a10b20f360208200741016a2207200628028c02480d000b0b0b2000200120022003200410cc0f04402000200120022003200410cd0f0b0b0b');
    const thunk=fromHex('002000417c6a200120022003200410c80f0b');
    // Only two code bodies and the code-section length change. All other bytes,
    // including linking metadata, function indices and storage behavior, survive.
    const replacement=new Uint8Array(2+setup.length+1+thunk.length);
    replacement.set([0xa9,0x01]);replacement.set(setup,2);
    replacement[2+setup.length]=thunk.length;replacement.set(thunk,3+setup.length);
    const start=3315762,end=3315880,delta=replacement.length-(end-start);
    const repaired=new Uint8Array(bytes.length+delta);
    repaired.set(bytes.subarray(0,start));repaired.set(replacement,start);repaired.set(bytes.subarray(end),start+replacement.length);
    let length=7314595+delta;
    for(let offset=56687;offset<56691;offset++){repaired[offset]=(length&127)|(offset<56690?128:0);length>>>=7;}
    return {bytes:repaired,applied:true};
}
// DrawModel already honors STUDIORENDER_DRAW_NO_FLEXES above this point.
// The port then clears bFlex again unconditionally; remove only that override.
export async function repairHalfLife2FacialRendering(bytes){
 const hash=await hl2Hash(bytes);
 if(hash==='ba10a413401d1bde3025fc6a8e0304f820511ba40aae8bb6aa1c2032568c6a16')return {bytes,applied:true};
 if(hash!=='450c04059dba15523ee1fd4e9ece2d913cc7faa806ad603e3f6592f806584c0d')return {bytes,applied:false};
 return {bytes:hl2ReplaceOnce(bytes,hl2Hex('2002200841bfff03713b0124'),hl2Hex('2002200841ffff03713b0124')),applied:true};
}
// CModelRender::ComputeLOD applies a web-only forced NPC LOD after its normal
// distance/r_lod/root-LOD calculation. LOD 3 omits eyes and facial flex groups.
// Skip only that final override; retain the complete normal selection above it.
export async function repairHalfLife2CharacterLOD(bytes){
 const hash=await hl2Hash(bytes);
 if(hash==='ce66700c251b099d6612c94c155d8db0545517bff7ab2c89f64d6e943387dc67')return {bytes,applied:true};
 if(hash!=='fc0c18859a1bc0de4968c91953bccfad70112137e34ed2c2664d6d5c6e2b902b')return {bytes,applied:false};
 const from=hl2Hex('238180808000419081b280006a28021c280230'),to=new Uint8Array(from.length).fill(0x01);
 // i32.const -1 followed by no-ops, preserving all lengths and relocations.
 to.set([0x41,0x7f]);
 return {bytes:hl2ReplaceOnce(bytes,from,to),applied:true};
}
// Legacy models can leave eyeball.texture zero although their eye mesh uses
// another material. Resolve it per body/model; retain explicit indices and data.
export async function normalizeHalfLife2Model(path,blob){
 if(!/\/models\/.*\.mdl$/i.test(path)||blob.byteLength<244)return blob;
 const view=new DataView(blob.buffer,blob.byteOffset,blob.byteLength),changes=new Map();
 const fits=(offset,length)=>Number.isSafeInteger(offset)&&Number.isSafeInteger(length)&&offset>=0&&length>=0&&offset<=blob.byteLength-length;
 const int=offset=>view.getInt32(offset,true);
 if(int(0)!==0x54534449||int(4)<44||int(4)>49||int(76)!==blob.byteLength)return blob;
 const textures=int(204),skinRefs=int(220),materialSlots=skinRefs||textures,bodyCount=int(232),bodyOffset=int(236);
 if(textures<1||textures>4096||skinRefs<0||skinRefs>4096||bodyCount<1||bodyCount>128||!fits(bodyOffset,bodyCount*16))return blob;
 for(let body=0;body<bodyCount;body++) {
  const bp=bodyOffset+body*16,modelCount=int(bp+4),models=bp+int(bp+12);
  if(modelCount<0||modelCount>256||!fits(models,modelCount*148))return blob;
  for(let model=0;model<modelCount;model++) {
   const base=models+model*148,meshCount=int(base+72),meshes=base+int(base+76),eyeCount=int(base+100),eyes=base+int(base+104);
   if(meshCount<0||meshCount>256||eyeCount<0||eyeCount>32||!fits(meshes,meshCount*116)||!fits(eyes,eyeCount*172))return blob;
   const materials=new Map();
   for(let mesh=0;mesh<meshCount;mesh++) {
    const p=meshes+mesh*116;if(int(p+24)!==1)continue;
    const eye=int(p+28),material=int(p);
    if(eye<0||eye>=eyeCount||material<0||material>=materialSlots)return blob;
    if(!materials.has(eye))materials.set(eye,material);
    else if(materials.get(eye)!==material)materials.set(eye,null);
   }
   for(const [eye,material] of materials) {
    const field=eyes+eye*172+52;
    if(material!==null&&material!==0&&int(field)===0)changes.set(field,material);
   }
  }
 }
 if(!changes.size)return blob;
 const output=blob.slice(),target=new DataView(output.buffer,output.byteOffset,output.byteLength);
 for(const [offset,material] of changes)target.setInt32(offset,material,true);
 return output;
}
