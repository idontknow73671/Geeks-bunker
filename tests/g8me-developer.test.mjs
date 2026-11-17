import test from 'node:test';
import assert from 'node:assert/strict';
import {installG8meConsole,withG8meDeveloper,g8meCaptureEnabled,g8meCaptureKey,createG8meDeveloper} from '../g8me-developer.js';
function fixture(){const messages=[],native=[],events={};let now=0;const win={Error,URL,document:{baseURI:'https://example.org/'},performance:{now:()=>++now},parent:{postMessage:value=>messages.push(value)},console:Object.fromEntries(['log','info','debug','warn','error'].map(level=>[level,(...args)=>native.push([level,args])])),addEventListener:(type,handler)=>events[type]=handler,fetch:async()=>new Response('data',{status:404})};installG8meConsole(win);return {win,messages,native,events};}
test('capture preserves console calls and handles circular values without throwing',()=>{const {win,messages,native}=fixture();const value={};value.self=value;win.console.log('hello',value,1n);assert.equal(native.length,1);assert.match(messages.at(-1).text,/hello.*Circular.*1/);installG8meConsole(win);win.console.warn('once');assert.equal(native.length,2);assert.equal(messages.filter(m=>m.text==='once').length,1);});
test('errors and unhandled rejections are visible; noisy output is rate limited',()=>{const {win,messages,events}=fixture();events.error({message:'broken'});events.unhandledrejection({reason:new Error('rejected')});assert.match(messages.at(-1).text,/rejected/);assert.equal(messages.at(-2).level,'error');for(let i=0;i<200;i++)win.console.log(i);assert.ok(messages.length<=80);});
test('network capture preserves the response and omits URL queries, bodies and headers',async()=>{const {win,messages}=fixture();const response=await win.fetch('https://example.org/levels?token=private#secret',{method:'POST',body:'private-body',headers:{authorization:'private'}});assert.equal(response.status,404);assert.equal(await response.text(),'data');assert.match(messages.at(-1).text,/POST https:\/\/example.org\/levels → 404/);assert.doesNotMatch(messages.at(-1).text,/token|private|secret/);});
test('disabled documents stay byte-identical; enabled capture runs before title scripts',()=>{const html='<html><script>title()</script></html>';assert.equal(withG8meDeveloper(html,false),html);const output=withG8meDeveloper(html,true);assert.ok(output.indexOf('installG8meConsole')<output.indexOf('title()'));});
test('the host bridge reconnects existing capture without wrapping console twice',()=>{const {win,native}=fixture(),received=[];installG8meConsole(win,value=>received.push(value));win.console.error('p8y bridge test');assert.equal(received.at(-1).text,'p8y bridge test');assert.equal(native.length,1);});
test('large console objects are truncated before formatting the entire value',()=>{const {win,messages}=fixture();win.console.log(Array.from({length:10000},(_,i)=>({i})));assert.ok(messages.at(-1).text.length<6000);assert.doesNotMatch(messages.at(-1).text,/9999/);});
test('startup messages are replayed when a p8y frame connects to the host bridge',()=>{const {win}=fixture(),received=[];win.console.error('Early startup failure');installG8meConsole(win,entry=>received.push(entry));assert.ok(received.some(entry=>entry.text==='Early startup failure'));assert.equal(new Set(received.map(entry=>entry.id)).size,received.length);});

test('HL2 legacy diagnostics do not enable GD capture, and explicit per-title choices win',()=>{
 const data=new Map([['gbG8meDeveloper','on']]),storage={getItem:key=>data.get(key)??null};
 const gd={provider:'gn',id:868},hl2={provider:'web',id:'half-life-2'};
 assert.equal(g8meCaptureEnabled(gd,storage),false);assert.equal(g8meCaptureEnabled(hl2,storage),true);
 data.set(g8meCaptureKey(gd),'on');data.set(g8meCaptureKey(hl2),'off');
 assert.equal(g8meCaptureEnabled(gd,storage),true);assert.equal(g8meCaptureEnabled(hl2,storage),false);
});

test('hidden console floods schedule no rendering; reopening shows the bounded latest log',()=>{
 const names=['window','localStorage','requestAnimationFrame','innerWidth','innerHeight'],previous=names.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
 class Node extends EventTarget {constructor(){super();this.value='';this.checked=false;this.textContent='';this.scrollHeight=0;this.scrollTop=0;this.clientHeight=0;}setAttribute(){}}
 const elements=new Map();for(const key of ['enabled','pause','level','search','clear','export','reload','download','status','output'])elements.set(key,new Node());elements.get('level').value='all';
 let hidden=true;const panel=new Node();panel.querySelector=selector=>elements.get(selector.match(/"([^"]+)"/)[1]);panel.classList={contains:()=>hidden,toggle:()=>hidden=!hidden};
 const button=new Node(),frames=[],data=new Map([['gbG8meDeveloper','on']]);
 try{
 Object.assign(globalThis,{window:new EventTarget(),localStorage:{getItem:key=>data.get(key)??null,setItem:(k,v)=>data.set(k,v)},requestAnimationFrame:fn=>frames.push(fn),innerWidth:1280,innerHeight:720});
 const tool=createG8meDeveloper({button,panel,reload(){}});tool.reset({provider:'gn',id:868,name:'Geometry Dash'},'direct');assert.equal(tool.enabled,false);
 for(let i=0;i<3000;i++)tool.record('log','entry '+i);
 assert.equal(frames.length,0);assert.equal(elements.get('output').textContent,'');
 button.dispatchEvent(new Event('click'));const output=elements.get('output').textContent;
 assert.equal(output.split('\n').length,300);assert.ok(output.includes('entry 2999'));assert.ok(!output.includes('entry 2699'));
 elements.get('enabled').checked=true;elements.get('enabled').dispatchEvent(new Event('change'));
 assert.equal(data.get('gbG8meDeveloper:gn:868'),'on');
 tool.reset({provider:'gn',id:114,name:'2048'},'direct');assert.equal(tool.enabled,false);
 }finally{names.forEach((key,i)=>previous[i]?Object.defineProperty(globalThis,key,previous[i]):delete globalThis[key]);}
});
