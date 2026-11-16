import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {withG8meSaves,flushG8meFrame} from '../g8me-saves.js';

const identity={provider:'gn',id:868,name:'Geometry Dash'};
const scripts=html=>[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function boot({records=new Map(),files=new Map(),providerTimer=false,started=true,failWrites=false}={}) {
    class Storage {
        get length(){return records.size;}
        key(i){return [...records.keys()][i]??null;}
        getItem(key){return records.get(key)??null;}
        setItem(key,value){records.set(key,String(value));}
        removeItem(key){records.delete(key);}
    }
    class Request extends EventTarget {
        dispatchEvent(event){super.dispatchEvent(event);this['on'+event.type]?.(event);return true;}
    }
    class Database {
        transaction(name,mode){
            const tx=new EventTarget();tx.mode=mode;
            tx.objectStore=()=>({put(value,key){setTimeout(()=>{if(!failWrites)files.set(key,value);tx.dispatchEvent(new Event(failWrites?'abort':'complete'));},90);}});
            return tx;
        }
    }
    const opens=[];
    class Factory {
        open(...args){
            opens.push(args);const request=new Request();
            setTimeout(()=>{request.result=new Database();request.dispatchEvent(new Event('success'));},80);
            return request;
        }
    }
    const events=new EventTarget(),intervals=[],notices=[],autoChanges=[],factory=new Factory();let requested=0,nativeEnabled=1;
    const window={localStorage:new Storage(),IDBFactory:Factory,IDBDatabase:Database,
        __gdGameStarted:started,savePath:name=>'/AppData/'+name,Event,
        addEventListener:(...args)=>events.addEventListener(...args),
        dispatchEvent:event=>events.dispatchEvent(event)};
    window.Module={_gd_autosave_set(value){nativeEnabled=value;autoChanges.push(value);},_gd_request_save(){
        requested++;
        setTimeout(()=>{
            if(!nativeEnabled)return;
            const request=factory.open('gdwasm_saves',1);
            request.onsuccess=()=>request.result.transaction('files','readwrite').objectStore('files').put(new Uint8Array([12,34,57]),'CCGameManager.dat');
        },45);
    }};
    const context={window,Module:window.Module,Storage,IDBFactory:Factory,IDBDatabase:Database,
        document:{hidden:false},parent:{postMessage:event=>notices.push(event)},
        setTimeout,clearTimeout,setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length;},
        requestAnimationFrame:fn=>setTimeout(fn,16)};
    vm.createContext(context);
    const title=providerTimer?'<script>function requestSave(){Module._gd_request_save();} Module._gd_autosave_set(1);setInterval(requestSave,10000);</script>':'';
    for(const code of scripts(withG8meSaves('<html><head></head><body>'+title+'</body></html>',identity)))vm.runInContext(code,context);
    return {window,context,records,files,intervals,opens,notices,autoChanges,get requested(){return requested;},get nativeEnabled(){return nativeEnabled;}};
}

test('GD disables the native scheduler and removes the provider save timer',()=>{
    const h=boot({providerTimer:true});
    assert.deepEqual(h.intervals,[]);
    assert.equal(h.nativeEnabled,0);
    assert.ok(h.autoChanges.every(value=>value===0));
    h.window.Module._gd_request_save();
    assert.equal(h.requested,0);
    assert.deepEqual(boot().intervals,[]);
});

test('leaving GD still waits for queued native saves and delayed database writes',async()=>{
    const records=new Map([['gbG8meSave:gn:868:progress','existing progress'],['unrelated','keep']]);
    const files=new Map([['CCGameManager.dat',new Uint8Array([12,34,56])],['CCLocalLevels.dat',new Uint8Array([78,90])]]);
    const h=boot({records,files});
    assert.equal(await flushG8meFrame({contentWindow:h.window}),true);
    assert.equal(h.requested,1);
    assert.ok(h.autoChanges.includes(1));
    assert.equal(h.nativeEnabled,0);
    assert.deepEqual(h.opens,[['gdwasm_saves',1]]);
    assert.deepEqual([...files.get('CCGameManager.dat')],[12,34,57]);
    assert.deepEqual([...files.get('CCLocalLevels.dat')],[78,90]);
    assert.ok(h.notices.some(event=>event.state==='saved'));
    assert.equal(h.window.savePath('CCGameManager.dat'),'/Resources/CCGameManager.dat');
    const reopened=boot({records,files});
    assert.equal(reopened.window.localStorage.getItem('progress'),'existing progress');
    assert.equal(records.get('unrelated'),'keep');
    assert.deepEqual([...reopened.files.get('CCGameManager.dat')],[12,34,57]);
});

test('native startup cannot re-enable autosaving after exports become ready',()=>{
    const h=boot({started:false});
    h.window.__gdRuntimeReady=true;h.window.Module._gd_autosave_set(1);h.window.__gdGameStarted=true;
    assert.equal(h.nativeEnabled,0);h.window.Module._gd_request_save();assert.equal(h.requested,0);
});

test('site-exit events request a single save, while visibility/background requests cannot save',async()=>{
    const h=boot();h.window.Module._gd_request_save();assert.equal(h.requested,0);
    h.window.dispatchEvent(new Event('beforeunload'));h.window.dispatchEvent(new Event('pagehide'));
    assert.equal(await h.window.__gbG8meSave.flush(),true);assert.equal(h.requested,1);assert.equal(h.nativeEnabled,0);
    assert.deepEqual([...h.files.get('CCGameManager.dat')],[12,34,57]);
});

test('the obfuscated upstream timer form is removed only from GN Math GD',()=>{
    const html='<script>setInterval(requestSave,0x2710);setInterval(renderStats,1000);</script>';
    const gd=withG8meSaves(html,identity);assert.doesNotMatch(gd,/setInterval\(requestSave/);assert.match(gd,/setInterval\(renderStats,1000\)/);
    assert.match(withG8meSaves(html,{provider:'gn',id:27}),/setInterval\(requestSave,0x2710\)/);
});

test('required p8y save waits for a reply from its exact frame with the right nonce',async()=>{
    const owner=new EventTarget();let sent;
    const child={postMessage(data){sent=data;setTimeout(()=>{
        for(const [source,request]of [[{},data.request],[child,'wrong'],[child,data.request]]){
            const event=new Event('message');Object.assign(event,{source,data:{type:'gb-g8me-flushed',request,success:true}});owner.dispatchEvent(event);
        }
    },10);}};
    Object.defineProperty(child,'__gbG8meSave',{get(){throw Error('cross origin');}});
    assert.equal(await flushG8meFrame({contentWindow:child,ownerDocument:{defaultView:owner}},{required:true}),true);
    assert.equal(sent.type,'gb-g8me-flush');
});

test('required save does not silently succeed when the p8y frame never acknowledges',async()=>{
    const owner=new EventTarget(),child={postMessage(){}};
    Object.defineProperty(child,'__gbG8meSave',{get(){throw Error('cross origin');}});
    const context=vm.createContext({frame:{contentWindow:child,ownerDocument:{defaultView:owner}},setTimeout:fn=>setTimeout(fn,10),clearTimeout,Date,Math});
    assert.equal(await vm.runInContext('('+flushG8meFrame.toString()+')(frame,{required:true})',context),false);
});

test('an aborted native write keeps the library-close save unsuccessful and preserves the previous checkpoint',async()=>{
    const files=new Map([['CCGameManager.dat',new Uint8Array([9,8,7])]]),h=boot({files,failWrites:true});
    assert.equal(await flushG8meFrame({contentWindow:h.window}),false);
    assert.deepEqual([...files.get('CCGameManager.dat')],[9,8,7]);assert.equal(h.nativeEnabled,0);
    assert.ok(h.notices.some(event=>event.state==='unavailable'));
});
