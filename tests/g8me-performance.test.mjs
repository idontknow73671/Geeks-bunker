import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchGdFramePacing,withGdFramePacing,installGdGraphics} from '../g8me-performance.js';
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
    const scope={ArrayBuffer,Uint8Array,binary:bytes,navigator:{userAgent:'',hardwareConcurrency:8},HTMLCanvasElement:class {}};scope.window=scope;
    const context=vm.createContext(scope);
    const html=withGdFramePacing('<script>var Module={};</script>');
    const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
    vm.runInContext(code,context);
    // A later script's global var assignment must pass through the hook.
    vm.runInContext('var Module={};Module.wasmBinary=binary;',context);
    assert.equal(context.window.Module.__gbFramePacing,'browser-paced');
    assert.equal(WebAssembly.validate(context.window.Module.wasmBinary),true);
});

function graphicsHarness(low=true){
    const calls=[],scheduled=[];let bound=null,frames=0;
    const gl={FRAMEBUFFER_BINDING:1,VIEWPORT:2,SCISSOR_BOX:3,viewport(...v){calls.push(['viewport',...v]);},scissor(...v){calls.push(['scissor',...v]);},getParameter(p){return p===1?bound:null;}};
    class Canvas {constructor(){this.id='canvas';this.width=1920;this.height=1080;}getContext(type,attrs){this.attrs=attrs;return gl;}}
    const win={HTMLCanvasElement:Canvas,navigator:{userAgent:low?'CrOS':'Mac',hardwareConcurrency:8},__gdGameStarted:true,document:{hidden:false},Module:{_gd_frames_get:()=>frames},requestAnimationFrame:fn=>scheduled.push(fn)};
    installGdGraphics(win);const canvas=new Canvas();canvas.getContext('webgl2',{preserveDrawingBuffer:true});
    return {gl,canvas,calls,win,setBound:value=>bound=value,sample(time,count){frames=count;scheduled.shift()(time);}};
}
test('Chromebook rendering reduces pixel work while retaining logical coordinates and FBO sizes',()=>{
    const h=graphicsHarness();assert.equal(h.canvas.width,960);assert.equal(h.canvas.height,540);assert.equal(h.canvas.attrs.preserveDrawingBuffer,false);
    h.gl.viewport(0,0,1920,1080);assert.deepEqual(h.calls.at(-1),['viewport',0,0,960,540]);
    assert.deepEqual([...h.gl.getParameter(h.gl.VIEWPORT)],[0,0,1920,1080]);
    h.gl.scissor(100,200,300,400);assert.deepEqual(h.calls.at(-1),['scissor',50,100,150,200]);
    h.setBound({});h.gl.viewport(0,0,256,256);assert.deepEqual(h.calls.at(-1),['viewport',0,0,256,256]);
});
test('adaptive quality measures native frames, downshifts sustained slow gameplay and ignores hidden tabs',()=>{
    const h=graphicsHarness();h.sample(2000,120);h.sample(4000,140);h.sample(6000,160);assert.equal(h.canvas.height,480);
    h.sample(8000,180);h.sample(10000,200);assert.equal(h.canvas.height,360);
    h.sample(12000,220);h.sample(14000,240);assert.equal(h.canvas.height,360);
    const desktop=graphicsHarness(false);assert.equal(desktop.canvas.height,1080);
    desktop.win.document.hidden=true;desktop.sample(2000,120);desktop.sample(4000,140);desktop.sample(6000,160);assert.equal(desktop.canvas.height,1080);
});
