import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {withG8meSaves,flushG8meFrame} from '../g8me-saves.js';

const identity={provider:'gn',id:868,name:'Geometry Dash'};
const scripts=html=>[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function boot({records=new Map(),files=new Map(),providerTimer=false}={}) {
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
            tx.objectStore=()=>({put(value,key){setTimeout(()=>{files.set(key,value);tx.dispatchEvent(new Event('complete'));},90);}});
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
    const events=new EventTarget(),intervals=[],notices=[],factory=new Factory();let requested=0;
    const window={localStorage:new Storage(),IDBFactory:Factory,IDBDatabase:Database,
        __gdGameStarted:true,savePath:name=>'/AppData/'+name,Event,
        dispatchEvent:event=>events.dispatchEvent(event)};
    window.Module={_gd_request_save(){
        requested++;
        setTimeout(()=>{
            const request=factory.open('gdwasm_saves',1);
            request.onsuccess=()=>request.result.transaction('files','readwrite').objectStore('files').put(new Uint8Array([12,34,57]),'CCGameManager.dat');
        },45);
    }};
    const context={window,Module:window.Module,Storage,IDBFactory:Factory,IDBDatabase:Database,
        document:{hidden:false},parent:{postMessage:event=>notices.push(event)},
        setTimeout,clearTimeout,setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length;},
        requestAnimationFrame:fn=>setTimeout(fn,16)};
    vm.createContext(context);
    const title=providerTimer?'<script>setInterval(()=>Module._gd_request_save(),10000);</script>':'';
    for(const code of scripts(withG8meSaves('<html><head></head><body>'+title+'</body></html>',identity)))vm.runInContext(code,context);
    return {window,records,files,intervals,opens,notices,get requested(){return requested;}};
}

test('GD wrapper adds no periodic native-save work and retains the provider save timer',()=>{
    const h=boot({providerTimer:true});
    assert.deepEqual(h.intervals.map(timer=>timer.ms),[10000]);
    assert.equal(h.requested,0);
    assert.deepEqual(boot().intervals,[]);
});

test('leaving GD still waits for queued native saves and delayed database writes',async()=>{
    const records=new Map([['gbG8meSave:gn:868:progress','existing progress'],['unrelated','keep']]);
    const files=new Map([['CCGameManager.dat',new Uint8Array([12,34,56])],['CCLocalLevels.dat',new Uint8Array([78,90])]]);
    const h=boot({records,files});
    assert.equal(await flushG8meFrame({contentWindow:h.window}),true);
    assert.equal(h.requested,1);
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
