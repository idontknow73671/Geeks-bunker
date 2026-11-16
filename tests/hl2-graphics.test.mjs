import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {gbHl2EnsureMonitorDepth,prepareHalfLife2Graphics} from '../hl2-startup.js';
function context({complete=false,width=256,height=256,defaultTarget=false}={}) {
 const target={},previous={},calls=[];let status=complete?36053:36057;
 const gl={DRAW_FRAMEBUFFER_BINDING:1,DRAW_FRAMEBUFFER:2,FRAMEBUFFER_INCOMPLETE_DIMENSIONS:36057,VIEWPORT:3,RENDERBUFFER_BINDING:4,RENDERBUFFER:5,DEPTH24_STENCIL8:6,DEPTH_STENCIL_ATTACHMENT:7,
 getParameter:p=>p===1?(defaultTarget?null:target):p===3?[0,0,width,height]:previous,
 checkFramebufferStatus:()=>status,createRenderbuffer:()=>{calls.push('create');return{};},
 bindRenderbuffer:(...a)=>calls.push(['bind',...a]),renderbufferStorage:(...a)=>calls.push(['storage',...a]),
 framebufferRenderbuffer:(...a)=>{calls.push(['attach',...a]);status=36053;},clear:()=>calls.push('clear')};
 const sandbox={GLctx:gl};vm.createContext(sandbox);vm.runInContext(gbHl2EnsureMonitorDepth.toString(),sandbox);
 return {sandbox,gl,calls,previous,reset:()=>{status=36057;}};
}
test('camera target receives a matching packed depth buffer and preserves the prior binding',()=>{
 const c=context();c.sandbox.gbHl2EnsureMonitorDepth();
 assert.deepEqual(c.calls[2],['storage',5,6,256,256]);assert.deepEqual(c.calls.at(-1),['bind',5,c.previous]);
 c.reset();c.sandbox.gbHl2EnsureMonitorDepth();assert.equal(c.calls.filter(x=>x==='create').length,1);
});
test('complete targets, the default framebuffer, and unrelated target sizes remain untouched',()=>{
 for(const options of [{complete:true},{defaultTarget:true},{width:1280,height:800},{width:512,height:512}]){const c=context(options);c.sandbox.gbHl2EnsureMonitorDepth();assert.deepEqual(c.calls,[]);}
});
test('repair runs before the engine clears its camera target, and adapts only once',()=>{
 const script='var _glClear = (x0) => GLctx.clear(x0);';const prepared=prepareHalfLife2Graphics(script),c=context();
 vm.runInContext(prepared+';_glClear(3);',c.sandbox);assert.equal(c.calls.at(-1),'clear');assert.ok(c.calls.some(x=>Array.isArray(x)&&x[0]==='attach'));
 assert.equal(prepareHalfLife2Graphics(prepared),prepared);assert.equal(prepareHalfLife2Graphics('future runtime'),'future runtime');
});
