import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {resolveGdNetworkURL,gdNetworkRoutes,withGdNetwork,isGdReadRequest,fetchGdThroughRelay} from '../g8me-network.js';
import {withG8meSaves} from '../g8me-saves.js';
const identity={provider:'gn',id:868,name:'Geometry Dash'};
const html='<html><head></head><body><script>/* title */</script></body></html>';
const scripts=value=>[...value.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function network(fetch,relay=async()=>{throw Error('unexpected relay');},overrides={}) {
 const context={URL,Request,Response,ReadableStream,TextDecoder,AbortController,AbortSignal,DOMException,Uint8Array,setTimeout,clearTimeout,parent:{__gbGdNetworkFetch:relay},...overrides};
 context.window={fetch};vm.createContext(context);vm.runInContext(scripts(withGdNetwork(html,identity))[0],context);return context.window.fetch;
}
test('known level routes normalize without permitting unrelated hosts',()=>{
 const expected='https://www.boomlings.com/database/getGJLevels21.php';
 assert.equal(resolveGdNetworkURL('https://gd-proxy.webdashers.workers.dev/getGJLevels21.php'),expected);
 assert.equal(resolveGdNetworkURL(gdNetworkRoutes(expected)[0]),expected);
 for(const url of ['http://evil.com/database/x.php','https://evil.com/database/x.php','https://gd-proxy.webdashers.workers.dev/other','https://api.ixl.college/?b=https://evil.com/'])assert.equal(resolveGdNetworkURL(url),null);
});
test('uploaded levels preserve POST data and accept correctly formed data labelled text/html',async()=>{
 const calls=[];const fetch=network(async(url,init)=>{calls.push({url,method:init.method,body:new TextDecoder().decode(init.body)});return new Response('1:123:2:Uploaded level',{headers:{'content-type':'text/html'}});});
 assert.match(await (await fetch('https://gd-proxy.webdashers.workers.dev/getGJLevels21.php',{method:'POST',body:'type=6&secret=test'})).text(),/^1:123/);
 assert.equal(calls.length,1);assert.equal(calls[0].url,gdNetworkRoutes('https://www.boomlings.com/database/getGJLevels21.php')[0]);assert.equal(calls[0].method,'POST');assert.equal(calls[0].body,'type=6&secret=test');
});
test('official GD server is requested through the relay before HTTP bridges',async()=>{
 let calls=0,relayCalls=0;
 const fetch=network(async()=>{calls++;return calls===1?new Response('quota',{status:429}):new Response('<!doctype html>blocked');},async(url,options)=>{relayCalls++;assert.equal(options.method,'POST');return new Response('1:456:2:Another level');});
 assert.match(await (await fetch('https://www.boomlings.com/database/getGJLevels21.php',{method:'POST',body:'type=6'})).text(),/^1:456/);assert.equal(calls,0);assert.equal(relayCalls,1);
});
test('other titles and non-level requests are unchanged',async()=>{
 assert.equal(withGdNetwork(html,{provider:'gn',id:27}),html);assert.equal(withGdNetwork(html,{provider:'lumin',id:868}),html);
 let called;const fetch=network(async(...args)=>{called=args;return new Response('asset');});await fetch('https://example.org/asset.wasm');assert.deepEqual(called,['https://example.org/asset.wasm',undefined]);
});
test('updated wrapper reopens existing progress with stable storage and native database identity',()=>{
 const records=new Map([['gbG8meSave:gn:868:progress','existing coins'],['unrelated','leave alone']]);
 const nativeRecords=new Map([['/Resources/CCGameManager.dat',new Uint8Array([12,34,56])],['/Resources/CCLocalLevels.dat',new Uint8Array([78,90])]]);
 const opens=[];
 class Storage{get length(){return records.size;}key(i){return [...records.keys()][i]??null;}getItem(k){return records.get(k)??null;}setItem(k,v){records.set(k,String(v));}removeItem(k){records.delete(k);}}
 class IDBFactory{open(...args){opens.push(args);return {addEventListener(){},records:nativeRecords};}}
 const window={localStorage:new Storage(),IDBFactory,indexedDB:new IDBFactory(),fetch:async()=>new Response(''),savePath:name=>'/AppData/'+name};
 const context={window,Storage,IDBFactory,parent:{postMessage(){},__gbGdNetworkFetch(){}},document:{hidden:false},URL,Request,Response,AbortController,AbortSignal,Uint8Array,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0};vm.createContext(context);
 for(const code of scripts(withG8meSaves(withGdNetwork(html,identity),identity)).slice(0,2))vm.runInContext(code,context);
 assert.equal(window.localStorage.getItem('progress'),'existing coins');
 const db=window.indexedDB.open('gdwasm_saves',1);assert.deepEqual(opens,[['gdwasm_saves',1]]);assert.equal(db.records,nativeRecords);assert.deepEqual([...db.records.get('/Resources/CCGameManager.dat')],[12,34,56]);assert.deepEqual([...db.records.get('/Resources/CCLocalLevels.dat')],[78,90]);
 assert.equal(window.savePath('CCGameManager.dat'),'/Resources/CCGameManager.dat');assert.equal(records.get('unrelated'),'leave alone');
 window.localStorage.setItem('progress','existing coins plus one');assert.equal(records.get('gbG8meSave:gn:868:progress'),'existing coins plus one');
});

test('Geekfox transport forwards POST bytes and follows 307 without dropping the body',async()=>{
 const fs=await import('node:fs');const source=fs.readFileSync(new URL('../geekfox-engine.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('            async fetch(url,'),source.indexOf('            async resourceURL(url)'));
 const calls=[];const bytes=new Uint8Array([1,2,3]);
 const context={URL,Headers,Response,transport:{async request(...args){calls.push(args);return calls.length===1?{status:307,headers:{location:'/next'},body:null}:{status:200,headers:{},body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('levels'));c.close();}})};}}};
 vm.createContext(context);vm.runInContext('this.runtime={'+code+'}',context);
 const result=await context.runtime.fetch('https://example.org/levels',{method:'POST',body:bytes,headers:{'content-type':'application/x-www-form-urlencoded'}});
 assert.equal(await result.text(),'levels');assert.equal(calls.length,2);for(const call of calls){assert.equal(call[1],'POST');assert.equal(call[2],bytes);assert.equal(call[3][0][0],'content-type');}assert.equal(calls[1][0].href,'https://example.org/next');
});

test('official direct-source updates retain the previous p8y save origin',async()=>{
 const {g8meP8yURL}=await import('../gn-math.js');
 const game={provider:'gn',id:868,urls:['https://raw.githubusercontent.com/gn-math/html/main/868-F3.html'],p8yUrls:['https://cdn.jsdelivr.net/gh/freebuisness/html@main/868-F3.html','https://raw.githubusercontent.com/freebuisness/html/main/868-F3.html']};
 assert.equal(await g8meP8yURL(game),game.p8yUrls[0]);assert.equal(await g8meP8yURL(game,null,1),game.p8yUrls[1]);
});


test('the real WASM relative bridge URL works inside an about:srcdoc frame',async()=>{
 const relative='/__proxy?url='+encodeURIComponent('https://www.boomlings.com/database/getGJLevels21.php');
 assert.equal(resolveGdNetworkURL(relative),'https://www.boomlings.com/database/getGJLevels21.php');
 const fetch=network(async(url,options)=>{assert.match(url,/gd-proxy\.webdashers\.workers\.dev/);assert.equal(new TextDecoder().decode(options.body),'type=6');return new Response('1:123:2:Featured');});
 assert.equal(await (await fetch(relative,{method:'POST',body:'type=6'})).text(),'1:123:2:Featured');
});

test('large level downloads return headers and first bytes before the whole body finishes',async()=>{
 let finish;const fetch=network(async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('1:123:2:Level:4:'));finish=()=>{c.enqueue(new TextEncoder().encode('remaining-data'));c.close();};}})));
 const response=await fetch('/__proxy?url='+encodeURIComponent('https://www.boomlings.com/database/downloadGJLevel22.php'),{method:'POST',body:'levelID=123'});
 const reader=response.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/^1:123/);finish();assert.equal(new TextDecoder().decode((await reader.read()).value),'remaining-data');assert.equal((await reader.read()).done,true);
});

test('custom songs and SFX retain their upstream media routes',()=>{
 for(const [host,key] of [['audio.ngfiles.com','n'],['geometrydashfiles.b-cdn.net','c']]){
  const target='https://'+host+'/123/song.mp3';
  assert.equal(resolveGdNetworkURL('/__proxy?url='+encodeURIComponent(target)),target);
  assert.equal(resolveGdNetworkURL('https://fallbackgdproxy.webdashers.workers.dev/audio-proxy?url='+encodeURIComponent(target)),target);
  assert.equal(new URL(gdNetworkRoutes(target).find(route=>route.includes('api.ixl.college'))).searchParams.get(key),'123/song.mp3');
 }
});

test('failed relay/quota routes cool down and the successful backup is reused',async()=>{
 const calls=[],target='https://www.boomlings.com/database/getGJLevels21.php';
 const fetch=network(async url=>{calls.push(url);return url.includes('gd-proxy.webdashers')?new Response('quota',{status:429}):new Response('1:456:2:Online');},async url=>{calls.push(url);return new Response('denied',{status:403});});
 for(let i=0;i<2;i++)assert.match(await (await fetch(target,{method:'POST',body:'type=6'})).text(),/^1:456/);
 assert.deepEqual(calls,[target,...gdNetworkRoutes(target).slice(0,2),gdNetworkRoutes(target)[1]]);
});

test('host relay returns official response headers before a streamed level/song completes',async()=>{
 const target='https://www.boomlings.com/database/downloadGJLevel22.php';let finish,seen;
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('1:123:4:'));finish=()=>{c.enqueue(new TextEncoder().encode('tail'));c.close();};}});
 const response=await fetchGdThroughRelay({fetch:async(url,options)=>{seen={url,options};return new Response(stream);}},target,{method:'POST',body:new Uint8Array([1,2])});
 assert.equal(seen.url,target);assert.equal(seen.options.retryRead,true);const reader=response.body.getReader();assert.equal(new TextDecoder().decode((await reader.read()).value),'1:123:4:');finish();assert.equal(new TextDecoder().decode((await reader.read()).value),'tail');
});

test('uploads/comments never replay through a second GD route',async()=>{
 for(const path of ['uploadGJLevel21.php','uploadGJComment21.php','updateGJUserScore22.php']){
  const url='https://www.boomlings.com/database/'+path;assert.equal(isGdReadRequest(url,'POST'),false);
  let relay=0,direct=0;const fetch=network(async()=>{direct++;throw Error('must not retry');},async()=>{relay++;throw Error('lost acknowledgement');});
  await assert.rejects(()=>fetch(url,{method:'POST',body:'payload'}),/lost acknowledgement/);assert.equal(relay,1);assert.equal(direct,0);
 }
});

test('caller abort still cancels body downloads after response headers arrive',async()=>{
 let cancelled=false;
 const fetch=network(async()=>{throw Error('must not fall back');},async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('1:123:'));},cancel(){cancelled=true;}})));
 const caller=new AbortController(),response=await fetch('https://www.boomlings.com/database/downloadGJLevel22.php',{method:'POST',signal:caller.signal});
 const reader=response.body.getReader();await reader.read();const pending=reader.read();caller.abort();await assert.rejects(pending);assert.equal(cancelled,true);
});

test('a stalled SDK/bootstrap that ignores cancellation still has a connection deadline',async()=>{
 let relay=0;
 const fetch=network(async()=>new Response('1:789:2:Recovered'),async()=>{relay++;return new Promise(()=>{});},{setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?10:ms)});
 assert.match(await (await fetch('https://www.boomlings.com/database/getGJLevels21.php',{method:'POST'})).text(),/^1:789/);assert.equal(relay,1);
});

test('split whitespace/HTML error pages are cancelled before choosing another route',async()=>{
 let cancelled=false;
 const fetch=network(async()=>new Response('1:321:2:Recovered'),async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('  '));c.enqueue(new TextEncoder().encode('<'));},cancel(){cancelled=true;}})));
 assert.match(await (await fetch('https://www.boomlings.com/database/getGJLevels21.php',{method:'POST'})).text(),/^1:321/);assert.equal(cancelled,true);
});

test('cross-origin p8y frames can use their rewritten fetch without reading the parent',async()=>{
 const parent={};Object.defineProperty(parent,'__gbGdNetworkFetch',{get(){throw Error('cross-origin');}});let seen;
 const fetch=network(async url=>{seen=url;return new Response('1:654:2:Online');},undefined,{parent});
 await(await fetch('/__proxy?url='+encodeURIComponent('https://www.boomlings.com/database/getGJLevels21.php'),{method:'POST'})).text();assert.equal(seen,'https://www.boomlings.com/database/getGJLevels21.php');
});

test('all-down cooldown suppresses nested provider retries and recovers after expiry',async()=>{
 let clock=100000,calls=0,recovered=false;const target='https://www.boomlings.com/database/getGJLevels21.php';
 const fail=async()=>{calls++;return new Response(recovered?'1:123:2:Recovered':'limited',{status:recovered?200:429});};
 const fetch=network(fail,fail,{Date:class extends Date{static now(){return clock;}}});
 await assert.rejects(()=>fetch(target,{method:'POST'}));const first=calls;assert.equal(first,1+gdNetworkRoutes(target).length);
 await assert.rejects(()=>fetch('https://fallbackgdproxy.webdashers.workers.dev/getGJLevels21.php',{method:'POST'}),/30 seconds/);assert.equal(calls,first);
 clock+=30001;recovered=true;assert.match(await(await fetch(target,{method:'POST'})).text(),/^1:123/);assert.equal(calls,first+1);
});

test('published GD backup URLs preserve database queries and song destinations',()=>{
 const level='https://www.boomlings.com/database/getGJLevels21.php?test=1';
 assert.equal(gdNetworkRoutes(level)[0],'https://gd-proxy.webdashers.workers.dev/getGJLevels21.php?test=1');
 const song='https://audio.ngfiles.com/123/song.mp3?x=1';
 assert.equal(new URL(gdNetworkRoutes(song)[0]).searchParams.get('url'),song);
});

test('legacy native HTTP, scheme-less and nested bridge URLs resolve to HTTPS only',()=>{
 const target='https://www.boomlings.com/database/getGJLevels21.php';
 for(const value of ['http://www.boomlings.com/database/getGJLevels21.php','www.boomlings.com/database/getGJLevels21.php','gd-proxy.webdashers.workers.dev/getGJLevels21.php','/__proxy?url='+encodeURIComponent('http://www.boomlings.com/database/getGJLevels21.php'),'/__proxy?url='+encodeURIComponent('/__proxy?url='+encodeURIComponent(target))])assert.equal(resolveGdNetworkURL(value),target);
 for(const value of ['http://untrusted.example/database/getGJLevels21.php','https://user:password@www.boomlings.com/database/getGJLevels21.php','javascript:alert(1)'])assert.equal(resolveGdNetworkURL(value),null);
});

test('actual native relative bridge requests with HTTP targets reach the relay as HTTPS with their POST bytes intact',async()=>{
 let seen;const fetch=network(async()=>{throw Error('wrong route');},async(url,options)=>{seen={url,body:new TextDecoder().decode(options.body)};return new Response('1:123:2:Online');});
 const response=await fetch('/__proxy?url='+encodeURIComponent('http://www.boomlings.com/database/getGJLevels21.php'),{method:'POST',body:'type=6&secret=test'});
 assert.match(await response.text(),/^1:123/);assert.deepEqual(seen,{url:'https://www.boomlings.com/database/getGJLevels21.php',body:'type=6&secret=test'});
});
