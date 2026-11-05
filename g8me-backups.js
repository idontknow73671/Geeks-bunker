// Progress files contain data only, never g8me HTML, scripts or site-wide storage.
export async function encodeG8meValue(value) {
    if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Unsupported numeric save value.');return value;}
    if(value===undefined)return {t:'undefined'};
    if(Object.prototype.toString.call(value)==='[object Date]')return {t:'date',v:value.toISOString()};
    if(value instanceof ArrayBuffer||ArrayBuffer.isView(value)||Object.prototype.toString.call(value)==='[object ArrayBuffer]'){
        const bytes=ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):new Uint8Array(value);
        let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
        return {t:'bytes',kind:ArrayBuffer.isView(value)?value.constructor.name:'ArrayBuffer',v:btoa(text)};
    }
    if(Object.prototype.toString.call(value)==='[object Blob]')return {t:'blob',mime:value.type,v:await encodeG8meValue(await value.arrayBuffer())};
    if(Array.isArray(value))return {t:'array',v:await Promise.all(value.map(encodeG8meValue))};
    if(Object.prototype.toString.call(value)==='[object Object]')return {t:'object',v:await Promise.all(Object.entries(value).map(async([k,v])=>[k,await encodeG8meValue(v)]))};
    throw Error('This g8me uses an unsupported save-data type.');
}
export function decodeG8meValue(value,depth=0) {
    if(depth>100)throw Error('Save data is nested too deeply.');
    if(value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value))return value;
    if(!value||typeof value!=='object')throw Error('Invalid save data.');
    const next=v=>decodeG8meValue(v,depth+1);
    if(value.t==='undefined')return undefined;
    if(value.t==='date'){const d=new Date(value.v);if(!Number.isFinite(+d))throw Error('Invalid date.');return d;}
    if(value.t==='array'&&Array.isArray(value.v))return value.v.map(next);
    if(value.t==='object'&&Array.isArray(value.v)){const result={};for(const pair of value.v){if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string')throw Error('Invalid object record.');Object.defineProperty(result,pair[0],{value:next(pair[1]),enumerable:true,writable:true,configurable:true});}return result;}
    if(value.t==='bytes'&&typeof value.v==='string'){
        const bytes=Uint8Array.from(atob(value.v),c=>c.charCodeAt(0));
        const types={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,DataView};
        if(value.kind==='ArrayBuffer')return bytes.buffer;
        const Type=Object.hasOwn(types,value.kind)?types[value.kind]:null;if(!Type)throw Error('Unsupported binary format.');return new Type(bytes.buffer);
    }
    if(value.t==='blob'&&typeof value.mime==='string')return new Blob([next(value.v)],{type:value.mime});
    throw Error('Invalid save record.');
}
export function validateG8meBackup(data,identity,allowedDatabases=[]) {
    if(data?.format!=='geeks-bunker-progress'||data.version!==1)throw Error('Choose a Geeks Bunker progress JSON file.');
    if(data.g8me?.provider!==identity.provider||String(data.g8me?.id)!==String(identity.id))throw Error('This progress file belongs to a different g8me or provider.');
    if(!Array.isArray(data.storage)||!Array.isArray(data.databases)||data.storage.length>10000||data.databases.length>100)throw Error('Invalid progress file.');
    const keys=new Set();for(const entry of data.storage){if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||typeof entry[1]!=='string'||entry[0]==='__databases__'||keys.has(entry[0]))throw Error('Invalid storage entry.');keys.add(entry[0]);}
    const names=new Set();for(const db of data.databases){if(typeof db.name!=='string'||!allowedDatabases.includes(db.name)||names.has(db.name)||!Array.isArray(db.stores))throw Error('This file includes a database not opened by this g8me. Play until it creates a save, then retry.');names.add(db.name);const stores=new Set();for(const store of db.stores){if(typeof store.name!=='string'||stores.has(store.name)||!Array.isArray(store.records))throw Error('Invalid save database.');stores.add(store.name);for(const record of store.records){decodeG8meValue(record.key);decodeG8meValue(record.value);}}}
    return data;
}
function requestResult(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function openSaveDatabase(name){const request=indexedDB.open(name);request.onupgradeneeded=()=>request.transaction.abort();request.onblocked=()=>{};return requestResult(request);}
async function readSaveDatabase(name){
    const db=await openSaveDatabase(name);
    try{
        const stores=[];
        for(const name of db.objectStoreNames){const records=await new Promise((resolve,reject)=>{const tx=db.transaction(name),store=tx.objectStore(name),rows=[];const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){rows.push({key:cursor.primaryKey,value:cursor.value});cursor.continue();}};tx.oncomplete=()=>resolve(rows);tx.onabort=tx.onerror=()=>reject(tx.error||Error('Could not read progress.'));});const tx=db.transaction(name),store=tx.objectStore(name);stores.push({name,keyPath:store.keyPath,autoIncrement:store.autoIncrement,records:await Promise.all(records.map(async record=>({key:await encodeG8meValue(record.key),value:await encodeG8meValue(record.value)})))});}
        return {name,stores};
    }finally{db.close();}
}
async function writeSaveDatabase(snapshot){
    const db=await openSaveDatabase(snapshot.name);
    try{
        const names=snapshot.stores.map(s=>s.name);if(!names.length)return;
        for(const store of snapshot.stores){if(!db.objectStoreNames.contains(store.name))throw Error('Save schema differs from this g8me version.');const live=db.transaction(store.name).objectStore(store.name);if(JSON.stringify(live.keyPath)!==JSON.stringify(store.keyPath)||live.autoIncrement!==store.autoIncrement)throw Error('Save schema differs from this g8me version.');}
        await new Promise((resolve,reject)=>{const tx=db.transaction(names,'readwrite');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Could not restore progress.'));try{for(const store of snapshot.stores){const live=tx.objectStore(store.name);live.clear();for(const row of store.records){const value=decodeG8meValue(row.value),key=decodeG8meValue(row.key);if(live.keyPath===null)live.put(value,key);else live.put(value);}}}catch(error){tx.abort();reject(error);}});
    }finally{db.close();}
}
export async function captureG8meBackup(frame,identity,allowEmpty=false){
    let child,api;try{child=frame?.contentWindow;api=child?.__gbG8meSave;}catch{}
    if(!api?.ready)throw Error('Progress files currently require a GN Math g8me in direct launch mode. Use its own save export for other providers.');
    // Cookie Clicker otherwise waits for its next autosave interval.
    if(typeof child.Game?.WriteSave==='function'&&typeof child.Game?.ClickCookie==='function')child.Game.WriteSave();
    if(await api.flush()===false)throw Error('Saving is still pending. Please try again.');
    const prefix='gbG8meSave:'+identity.provider+':'+identity.id+':',storage=[];
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix)&&key.slice(prefix.length)!=='__databases__')storage.push([key.slice(prefix.length),localStorage.getItem(key)]);}
    const databases=await Promise.all(api.databaseNames().map(readSaveDatabase));
    if(!allowEmpty&&!storage.length&&!databases.some(db=>db.stores.some(s=>s.records.length)))throw Error('No saved progress found yet. Save in the g8me first.');
    return {format:'geeks-bunker-progress',version:1,g8me:{provider:identity.provider,id:String(identity.id),name:identity.name},exportedAt:new Date().toISOString(),storage,databases};
}
export async function restoreG8meBackup(data,identity,rollback){
    validateG8meBackup(data,identity,rollback.databases.map(db=>db.name));
    const prefix='gbG8meSave:'+identity.provider+':'+identity.id+':';
    const replaceStorage=entries=>{const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix)&&key.slice(prefix.length)!=='__databases__')keys.push(key);}for(const key of keys)localStorage.removeItem(key);localStorage.setItem(prefix+'__cleared__','1');for(const [key,value]of entries)localStorage.setItem(prefix+key,value);};
    try{for(const db of data.databases)await writeSaveDatabase(db);replaceStorage(data.storage);}
    catch(error){try{for(const db of rollback.databases)await writeSaveDatabase(db);replaceStorage(rollback.storage);}catch{throw Error('Restore and rollback failed. Keep your exported backup and check browser storage space.');}throw error;}
}
