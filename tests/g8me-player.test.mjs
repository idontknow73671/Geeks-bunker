import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fitG8meViewport,isFluidG8meCanvas} from '../g8me-display.js';
import {fetchP8yG8meDocument} from '../gn-math.js';
const source=fs.readFileSync(process.env.G8ME_TEST_ENGINE || new URL('../geekfox-engine.js',import.meta.url),'utf8');
function network(behavior){
 const code=source.slice(source.indexOf('    const connections ='),source.indexOf('    const identities ='));
 class Transport {constructor(options){this.id=options._ind;}async init(){}request(url,method,body,headers,signal){return url.href.endsWith('generate_204')?Promise.resolve({status:204,body:null}):behavior(url,signal,this.id);}}
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
test('p8y document loading retries failed mirrors and preserves the selected asset base',async()=>{
 const seen=[],urls=['https://first.invalid/game.html','https://second.invalid/folder/game.html'];
 const runtime={async fetch(url){seen.push(url);return url===urls[0]?new Response('Unavailable',{status:503}):new Response('<html><head></head><body><canvas></canvas></body></html>');}};
 const result=await fetchP8yG8meDocument(runtime,urls,new AbortController().signal);assert.deepEqual(seen,urls);assert.equal(result.url,urls[1]);assert.match(result.documentHTML,/<base href="https:\/\/second.invalid\/folder\/">/);
});
test('p8y rejects non-HTML mirrors and does not continue after cancellation',async()=>{
 const urls=['https://first.invalid/a','https://second.invalid/b'];let count=0;
 const result=await fetchP8yG8meDocument({fetch:async()=>new Response(++count===1?'Not a g8me':'<html><body>ok</body></html>')},urls,new AbortController().signal);assert.equal(result.url,urls[1]);
 const caller=new AbortController();count=0;
 await assert.rejects(()=>fetchP8yG8meDocument({fetch:async()=>{count++;caller.abort();throw new Error('offline');}},urls,caller.signal));assert.equal(count,1);
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
test('only the preloaded GET document is served from the selected p8y mirror',async()=>{
 let hook;
 const start=source.indexOf('                plugin.tap(frame.hooks.fetch.request'),end=source.indexOf('                if(options.prepareDocumentURL',start);
 vm.runInNewContext(source.slice(start,end),{plugin:{tap:(_,callback)=>hook=callback},frame:{hooks:{fetch:{request:{}}}},options:{prepareDocumentURL:'https://example.org/title.html',documentHTML:'<html><canvas></canvas></html>'},Response,identity:()=>null,applyIdentityHeaders:()=>{}});
 const context={parsed:{url:new URL('https://example.org/title.html')}};
 const details={url:context.parsed.url,init:{method:'GET'}};hook(context,details);assert.equal(details.earlyResponse.headers.get('content-type'),'text/html; charset=utf-8');assert.match(await details.earlyResponse.text(),/<canvas>/);
 const other={url:new URL('https://example.org/title.data'),init:{method:'GET'}};hook({parsed:{url:other.url}},other);assert.equal(other.earlyResponse,undefined);
 const post={url:context.parsed.url,init:{method:'POST'}};hook(context,post);assert.equal(post.earlyResponse,undefined);
});

test('stretch uses independent axes while aspect fit keeps uniform scale',()=>{
 const stretched=fitG8meViewport(800,600,1920,1080,true);
 assert.equal(stretched.width,1920);assert.equal(stretched.height,1080);
 assert.equal(stretched.scaleX,2.4);assert.equal(stretched.scaleY,1.8);
 const fit=fitG8meViewport(800,600,1920,1080,false);
 assert.equal(fit.scaleX,fit.scaleY);assert.equal(fit.width,1440);assert.equal(fit.height,1080);
});
