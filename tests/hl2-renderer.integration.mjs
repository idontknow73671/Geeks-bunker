// Explicit network integration check; no third-party engine files are bundled.
// Run: node --test tests/hl2-renderer.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {repairHalfLife2Renderer,repairHalfLife2Client} from '../hl2-startup.js';

test('the real upstream renderer retains its ABI and only loses the two legacy texture checks',async()=>{
    const response=await fetch('https://raw.githubusercontent.com/AlexBoops/half-life-2-port/b86cc306c1d310ff7c4ce56524afa79d3ad2ef97/libstudiorender.so',{signal:AbortSignal.timeout(90000)});
    assert.equal(response.ok,true);
    const original=new Uint8Array(await response.arrayBuffer());
    const repaired=await repairHalfLife2Renderer(original);
    assert.equal(repaired.applied,true);
    assert.equal(repaired.bytes.length,original.length);
    assert.deepEqual([...original.keys()].filter(i=>original[i]!==repaired.bytes[i]),[106577,106578,107371,107372]);
    const before=new WebAssembly.Module(original),after=new WebAssembly.Module(repaired.bytes);
    assert.deepEqual(WebAssembly.Module.imports(after),WebAssembly.Module.imports(before));
    assert.deepEqual(WebAssembly.Module.exports(after),WebAssembly.Module.exports(before));
    assert.deepEqual((await repairHalfLife2Renderer(repaired.bytes)).bytes,repaired.bytes);
});

test('other engine builds pass through unchanged',async()=>{
    const other=new Uint8Array([0,97,115,109,1,0,0,0]);
    const result=await repairHalfLife2Renderer(other);
    assert.equal(result.applied,false);
    assert.equal(result.bytes,other);
});

function sections(bytes) {
    let offset=8;
    const read=()=>{let value=0,shift=0,byte;do{byte=bytes[offset++];value|=(byte&127)<<shift;shift+=7;}while(byte&128);return value;};
    const result=[];
    while(offset<bytes.length){const type=bytes[offset++],length=read(),start=offset;offset+=length;result.push({type,bytes:bytes.slice(start,offset)});}
    return result;
}
function codeBodies(bytes) {
    let offset=0;
    const read=()=>{let value=0,shift=0,byte;do{byte=bytes[offset++];value|=(byte&127)<<shift;shift+=7;}while(byte&128);return value;};
    const count=read(),result=[];
    for(let i=0;i<count;i++){const length=read();result.push(bytes.slice(offset,offset+length));offset+=length;}
    assert.equal(offset,bytes.length);return result;
}
test('real client restores only the two facial-update stubs and preserves every other section/body',async()=>{
    const response=await fetch('https://raw.githubusercontent.com/AlexBoops/half-life-2-port/b86cc306c1d310ff7c4ce56524afa79d3ad2ef97/libclient.so',{signal:AbortSignal.timeout(90000)});
    assert.equal(response.ok,true);
    const original=new Uint8Array(await response.arrayBuffer()),repaired=await repairHalfLife2Client(original);
    assert.equal(repaired.applied,true);
    const before=new WebAssembly.Module(original),after=new WebAssembly.Module(repaired.bytes);
    assert.deepEqual(WebAssembly.Module.imports(after),WebAssembly.Module.imports(before));
    assert.deepEqual(WebAssembly.Module.exports(after),WebAssembly.Module.exports(before));
    const oldSections=sections(original),newSections=sections(repaired.bytes);
    assert.deepEqual(newSections.map(s=>s.type),oldSections.map(s=>s.type));
    for(let i=0;i<oldSections.length;i++){
        if(oldSections[i].type!==10){assert.deepEqual(newSections[i].bytes,oldSections[i].bytes);continue;}
        const oldBodies=codeBodies(oldSections[i].bytes),newBodies=codeBodies(newSections[i].bytes);
        assert.equal(oldBodies.length,newBodies.length);
        assert.deepEqual(oldBodies.map((b,i)=>Buffer.compare(b,newBodies[i])===0?null:i+183).filter(i=>i!==null),[1992,1993]);
    }
    assert.deepEqual((await repairHalfLife2Client(repaired.bytes)).bytes,repaired.bytes);
    const other=new Uint8Array([0,97,115,109,1,0,0,0]);
    assert.deepEqual(await repairHalfLife2Client(other),{bytes:other,applied:false});
});
