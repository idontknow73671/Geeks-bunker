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
// Resolve the two legacy v44 eye texture indices from their mesh materials.
// Scope the adapter to this exact supplied model, preserving all animation data.
export async function normalizeHalfLife2Model(path,blob){
 if(path!=='/hl2/models/gman_high.mdl'||blob.byteLength!==342440)return blob;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',blob)),v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!=='e999b8db779f3bdfd117e58ec0fc1b601b93c0508d77ec5c739a687ff18b2256')return blob;
 const output=blob.slice();output[134792]=4;output[134964]=2;return output;
}
