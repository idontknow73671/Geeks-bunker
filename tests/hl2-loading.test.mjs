import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {installHalfLife2Loading,prepareHalfLife2Loading} from '../hl2-loading.js';
import {prepareHalfLife2Document} from '../hl2-startup.js';
import {hl2LoadingAssets} from '../hl2-loading-assets.js';
function harness(blocked=false){
 const elements=Array.from({length:2},()=>({classList:{add(){},remove(){}}}));
 const sound={addEventListener:(name,fn)=>sound.click=fn,setAttribute(){}},classes=new Set(),root={querySelectorAll:()=>elements,querySelector:()=>sound,classList:{add:n=>classes.add(n)},style:{}},events={},timers=[],frames=[];let slide,now=0,plays=0,music;
 class Audio {constructor(){music=this;this.volume=.4;this.paused=true;}play(){plays++;this.paused=false;return blocked?Promise.reject(Error('autoplay')):Promise.resolve();}pause(){this.paused=true;}removeAttribute(){this.released=true;}load(){}}
 const context={document:{getElementById:id=>id==='launcher-ui'?root:{focus(){}}},window:{addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]},Audio,Image:class{},Promise,setInterval:(fn,ms)=>{assert.equal(ms,3000);slide=fn;return 1;},clearInterval:()=>slide=null,setTimeout:(fn,ms)=>{timers.push({fn,ms});},performance:{now:()=>now},requestAnimationFrame:fn=>{frames.push(fn);return 1;},cancelAnimationFrame(){}};
 vm.createContext(context);const controller=vm.runInContext('('+installHalfLife2Loading.toString()+')',context)({images:['valve1','valve2','hl1','hl2','hl3'],music:'music'});
 return {elements,sound,classes,events,timers,frames,controller,context,root,get plays(){return plays;},get music(){return music;},next:()=>slide?.(),fade:time=>{now=time;frames.shift()(time);}};
}
test('Valve pictures lead; the artwork rotates every three seconds without waiting to start loading',()=>{
 const h=harness();assert.equal(h.elements[0].src,'valve1');h.next();assert.equal(h.elements[1].src,'valve2');h.next();assert.equal(h.elements[0].src,'hl1');h.next();assert.equal(h.elements[1].src,'hl2');h.next();assert.equal(h.elements[0].src,'hl3');h.next();assert.equal(h.elements[1].src,'hl1');assert.equal(h.plays,1);
});
test('ready fades visuals and audio together and releases timers and sound exactly once',async()=>{
 const h=harness();h.controller.finish();h.controller.finish();assert.ok(h.classes.has('hl2-loading-finished'));assert.equal(h.timers.length,1);assert.equal(h.timers[0].ms,3000);assert.equal(h.events.pointerdown,undefined);h.fade(1500);assert.equal(h.music.volume,.2);h.fade(3000);assert.equal(h.music.volume,0);h.timers[0].fn();assert.equal(h.music.paused,true);assert.equal(h.music.released,true);assert.equal(h.root.style.display,'none');const last=h.elements.map(e=>e.src);h.next();assert.deepEqual(h.elements.map(e=>e.src),last);await Promise.resolve();assert.equal(h.plays,1);
});
test('blocked autoplay offers a sound button and never blocks loading; its pointer event does not double-toggle',async()=>{
 const h=harness(true);await Promise.resolve();await Promise.resolve();assert.equal(h.sound.textContent,'Enable loading music');h.events.pointerdown({target:{closest:()=>true}});assert.equal(h.plays,1);h.sound.click();assert.equal(h.plays,2);h.controller.finish();
});
test('release launcher automatically starts with the replacement UI and retains errors and engine adapters',{skip:!process.env.HL2_ENGINE_FIXTURES},()=>{
 const input=fs.readFileSync(process.env.HL2_ENGINE_FIXTURES+'/cache/index.html','utf8'),output=prepareHalfLife2Document(input);
 assert.ok(!output.includes('CITY 17 SECTOR-4 TERMINAL'));assert.ok(!output.includes('START ENGINE'));
 assert.match(output,/window.gbHl2Loading=\(/);assert.match(output,/startApp\(\);\s*<\/script>/);assert.match(output,/gbHl2Loading\?\.finish/);assert.match(output,/gbHl2BootstrapBytes/);assert.match(output,/HL2 audio/);
 assert.equal(prepareHalfLife2Document(output),output);
 const script=output.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];new vm.Script(script);
 assert.equal(hl2LoadingAssets.images.length,5);assert.ok(hl2LoadingAssets.images.every(s=>s.startsWith('data:image/jpeg;base64,')));assert.ok(hl2LoadingAssets.music.startsWith('data:audio/ogg;base64,'));
});
