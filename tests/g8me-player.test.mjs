import {g8meStartupFailure} from '../g8me-startup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fitG8meViewport,isFluidG8meCanvas} from '../g8me-display.js';
import {extraG8mes,g8meP8yURL} from '../gn-math.js';
const source=fs.readFileSync(process.env.G8ME_TEST_ENGINE || new URL('../geekfox-engine.js',import.meta.url),'utf8');
function network(behavior,health=()=>Promise.resolve({status:204,body:null})){
 const code=source.slice(source.indexOf('    const connections ='),source.indexOf('    const identities ='));
 class Transport {constructor(options){this.id=options._ind;}async init(){}request(url,method,body,headers,signal){return url.href.endsWith('generate_204')?health(url,signal,this.id):behavior(url,signal,this.id);}}
 const quickSignal={timeout:ms=>AbortSignal.timeout(ms===15000?15:ms),any:AbortSignal.any.bind(AbortSignal)};
 const context={URL,AbortController,AbortSignal:quickSignal,DOMException,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?15:ms),clearTimeout};
 vm.createContext(context);const helper=source.slice(source.indexOf('    const timeout ='),source.indexOf('    const codec ='));vm.runInContext(helper+code+'\nthis.create=createConnections;',context);return context.create(Transport,()=>{});
}
test('640×480 fills a widescreen player without stretching or cropping',()=>{
 const result=fitG8meViewport(640,480,1920,1080);assert.equal(result.width,1440);assert.equal(result.height,1080);assert.equal(result.scale,2.25);
 const portrait=fitG8meViewport(640,480,390,844);assert.equal(portrait.width,390);assert.equal(portrait.height,292.5);
 assert.equal(fitG8meViewport(640,480,0,480),null);
});
test('a streamed g8me body outlives the response-header deadline',async()=>{
 const net=network(async(url,signal)=>({status:200,body:new ReadableStream({start(controller){signal.addEventListener('abort',()=>controller.error(signal.reason),{once:true});setTimeout(()=>{if(!signal.aborted){controller.enqueue(new TextEncoder().encode('complete g8me data'));controller.close();}},45);}})}));
 await net.adapter.init();const response=await net.adapter.request(new URL('https://example.org/large.data'),'GET',null,[]);assert.equal(await new Response(response.body).text(),'complete g8me data');
});
test('caller cancellation still aborts an active body download',async()=>{
 const net=network(async(url,signal)=>({status:200,body:new ReadableStream({start(controller){signal.addEventListener('abort',()=>controller.error(signal.reason),{once:true});}})}));
 await net.adapter.init();const caller=new AbortController();const response=await net.adapter.request(new URL('https://example.org/large.data'),'GET',null,[],caller.signal);caller.abort();await assert.rejects(()=>new Response(response.body).text());
});
test('external titles retain original URLs, omit tracking and always launch through p8y',async()=>{
 const titles=extraG8mes();assert.deepEqual(titles.map(g=>g.name),['FivePlay','Half-Life 2']);
 assert.deepEqual(await Promise.all(titles.map(g=>g8meP8yURL(g))),['https://fiveplay.lol/?low=1&cores=2&res=910x570&fps=30','https://alexboops.github.io/half-life-2-port/']);
 assert.ok(titles.every(g=>g.viaP8y&&g.provider==='web'));
});
test('p8y URL selection needs no document fetch and keeps Lumin resolution separate',async()=>{
 assert.equal(await g8meP8yURL({provider:'gn',urls:['https://first.example/a.html','https://second.example/a.html']},null,1),'https://second.example/a.html');
 let resolved;assert.equal(await g8meP8yURL({provider:'lumin',id:42},async id=>{resolved=id;return 'https://example.org/signed-title';}),'https://example.org/signed-title');assert.equal(resolved,42);
 await assert.rejects(()=>g8meP8yURL({provider:'web',urls:['javascript:alert(1)']}));
 const code=fs.readFileSync(new URL('../gn-math.js',import.meta.url),'utf8'),p8y=code.slice(code.indexOf('        if(viaP8y) {'),code.indexOf("        if (game.provider === 'lumin')"));
 assert.doesNotMatch(p8y,/runtime\.fetch|fetchP8yG8meDocument|documentHTML|srcdoc/);assert.match(p8y,/runtime\.attach/);assert.match(p8y,/activeHandle\.go\(url\)/);
});

test('an oversized canvas is fitted instead of being mistaken for a fluid viewport',()=>{
 assert.equal(isFluidG8meCanvas({left:0,top:0,right:1280,bottom:960,width:1280,height:960},1280,662,4/3),false);
 assert.equal(isFluidG8meCanvas({left:0,top:0,right:1280,bottom:662,width:1280,height:662},1280,662,1280/662),true);
 assert.equal(isFluidG8meCanvas({left:0,top:0,right:1280,bottom:662,width:1280,height:662},1280,662,4/3),false);
});
test('a header timeout switches relays without replaying POST requests',async()=>{
 let calls=0;
 const net=network(async(url,signal,id)=>{calls++;if(id.includes('nightwisp'))return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));return {status:200,body:null};});
 await net.adapter.init();assert.equal((await net.adapter.request(new URL('https://example.org/headers'),'GET',null,[])).status,200);assert.equal(calls,2);
 calls=0;const forms=network(async()=>{calls++;throw new Error('POST failed');});await forms.adapter.init();await assert.rejects(()=>forms.adapter.request(new URL('https://example.org/form'),'POST','value',[]));assert.equal(calls,1);
});
test('p8y relays exclude the bandwidth-limited demo and include published alternatives',()=>{
 assert.doesNotMatch(source,/wisp\.mercurywork\.shop/);
 for(const host of ['api.garnier-audebourg.org','bikesense.org','api.whatastupididea.com','api.shredstreet.com','api.alcrb.ru'])assert.ok(source.includes(host));
});

test('stretch uses independent axes while aspect fit keeps uniform scale',()=>{
 const stretched=fitG8meViewport(800,600,1920,1080,true);
 assert.equal(stretched.width,1920);assert.equal(stretched.height,1080);
 assert.equal(stretched.scaleX,2.4);assert.equal(stretched.scaleY,1.8);
 const fit=fitG8meViewport(800,600,1920,1080,false);
 assert.equal(fit.scaleX,fit.scaleY);assert.equal(fit.width,1440);assert.equal(fit.height,1080);
});

test('a blocked connectivity host does not reject a relay that can fetch other pages',async()=>{let checks=0;const net=network(async url=>{assert.equal(url.href,'https://example.org/');checks++;return {status:200,body:null};},async()=>({status:403,body:null}));await net.adapter.init();assert.equal(checks,1);assert.ok(net.origin.includes('nightwisp'));});

test('FivePlay uses its published low-memory startup settings',async()=>{const url=new URL(await g8meP8yURL(extraG8mes()[0]));assert.equal(url.searchParams.get('low'),'1');assert.equal(url.searchParams.get('cores'),'2');assert.equal(url.searchParams.get('res'),'910x570');assert.equal(url.searchParams.get('fps'),'30');assert.equal(url.searchParams.has('log'),false);});
test('only a confirmed engine crash becomes a startup failure',()=>{assert.match(g8meStartupFailure('The game stopped (rejection): THREAD REJECTION: unreachable'),/unreachable/);for(const text of ['Mounting archives','Game data: 612 MB','No progress for 90 s: device may be out of memory','Low-memory device: close other tabs','Choose Story Mode or Sandbox Mode to continue'])assert.equal(g8meStartupFailure(text),null);});
