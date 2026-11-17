import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchGdFramePacing,withGdFramePacing} from '../g8me-performance.js';
import {withG8meSaves} from '../g8me-saves.js';

test('unrecognized or truncated engines are left byte-for-byte untouched',()=>{
    for(const input of [new Uint8Array([0,97,115,109,1,0,0,0,10,255]),new Uint8Array(300),null]){
        const original=input?.slice();assert.equal(patchGdFramePacing(input),false);
        if(input)assert.deepEqual(input,original);
    }
});

test('frame pacing is injected before GD starts and is absent from other titles',()=>{
    const html='<html><head></head><script>var Module={};</script></html>';
    const gd=withG8meSaves(html,{provider:'gn',id:868,name:'Geometry Dash'});
    assert.ok(gd.indexOf('installGdFramePacing')<gd.indexOf('var Module={}'));
    for(const identity of [{provider:'gn',id:114},{provider:'lumin',id:868}])assert.doesNotMatch(withG8meSaves(html,identity),/installGdFramePacing/);
});

const fixture=process.env.GD_ENGINE_FIXTURE;
test('real pinned GD engine loses only the busy-wait branch and remains valid WASM',{skip:!fixture},()=>{
    const original=new Uint8Array(fs.readFileSync(fixture));
    const bytes=original.slice();assert.equal(patchGdFramePacing(bytes),true);
    const changes=[];for(let i=0;i<bytes.length;i++)if(bytes[i]!==original[i])changes.push([original[i],bytes[i]]);
    assert.deepEqual(changes,[[0x0d,0x1a],[0x0e,0x01]]);
    assert.equal(WebAssembly.validate(bytes),true);
    const patched=bytes.slice();assert.equal(patchGdFramePacing(bytes),true);assert.deepEqual(bytes,patched);
    // A changed function must not be patched even if the branch still matches.
    const unknown=original.slice();unknown[3484648+100]^=1;
    const before=unknown.slice();assert.equal(patchGdFramePacing(unknown),false);assert.deepEqual(unknown,before);
});

test('production bootstrap patches downloaded bytes before the engine can compile them',{skip:!fixture},()=>{
    const bytes=new Uint8Array(fs.readFileSync(fixture));
    const scope={ArrayBuffer,Uint8Array,binary:bytes};scope.window=scope;
    const context=vm.createContext(scope);
    const html=withGdFramePacing('<script>var Module={};</script>');
    const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
    vm.runInContext(code,context);
    // A later script's global var assignment must pass through the hook.
    vm.runInContext('var Module={};Module.wasmBinary=binary;',context);
    assert.equal(context.window.Module.__gbFramePacing,'browser-paced');
    assert.equal(WebAssembly.validate(context.window.Module.wasmBinary),true);
});
