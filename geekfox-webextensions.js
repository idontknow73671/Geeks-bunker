// Firefox package compatibility, not a native Firefox extension process.
const XPI_LIMITS = {archive:10*1024*1024,expanded:30*1024*1024,file:8*1024*1024,count:1500};
const xpiText = bytes => new TextDecoder('utf-8',{fatal:true}).decode(bytes);
export function geekfoxXpiPath(path) {
    if(typeof path!=='string' || !path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some(part=>part==='..') || /^[a-z][a-z0-9+.-]*:/i.test(path)) throw new Error('Invalid package file path: '+String(path).slice(0,100));
    return path.replace(/^\.\//,'');
}
export function geekfoxXpiCRC(bytes) {
    let crc=0xffffffff;
    for(const byte of bytes) { crc^=byte; for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    return (crc^0xffffffff)>>>0;
}
export async function unpackGeekfoxXpi(input) {
    const bytes=new Uint8Array(input); if(bytes.length>XPI_LIMITS.archive)throw new Error('XPI packages must be smaller than 10 MiB.');
    const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(data.getUint32(i,true)===0x06054b50 && i+22+data.getUint16(i+20,true)===bytes.length){end=i;break;}
    if(end<0)throw new Error('This is not a complete XPI/ZIP package.');
    if(data.getUint16(end+4,true)||data.getUint16(end+6,true)||data.getUint16(end+8,true)!==data.getUint16(end+10,true))throw new Error('Multi-volume packages are not supported.');
    const count=data.getUint16(end+10,true),size=data.getUint32(end+12,true),offset=data.getUint32(end+16,true);
    if(count===65535||size===0xffffffff||offset===0xffffffff)throw new Error('ZIP64 packages are not supported.');
    if(count>XPI_LIMITS.count || offset+size!==end)throw new Error('Invalid or oversized package directory.');
    const files=new Map();let cursor=offset,total=0;
    for(let n=0;n<count;n++) {
        if(cursor+46>end||data.getUint32(cursor,true)!==0x02014b50)throw new Error('Damaged package directory.');
        const flags=data.getUint16(cursor+8,true),method=data.getUint16(cursor+10,true),crc=data.getUint32(cursor+16,true),compressed=data.getUint32(cursor+20,true),expanded=data.getUint32(cursor+24,true),nameLength=data.getUint16(cursor+28,true),extraLength=data.getUint16(cursor+30,true),commentLength=data.getUint16(cursor+32,true),local=data.getUint32(cursor+42,true);
        const next=cursor+46+nameLength+extraLength+commentLength;
        if(next>end||flags&1||![0,8].includes(method))throw new Error('Encrypted or unsupported ZIP compression.');
        const path=geekfoxXpiPath(xpiText(bytes.subarray(cursor+46,cursor+46+nameLength)));
        cursor=next;if(path.endsWith('/'))continue;
        if(files.has(path))throw new Error('Duplicate package file: '+path);
        total+=expanded;if(total>XPI_LIMITS.expanded||expanded>XPI_LIMITS.file)throw new Error('Package expands beyond the size limit.');
        if(local+30>offset||data.getUint32(local,true)!==0x04034b50)throw new Error('Damaged package file header.');
        if(data.getUint16(local+6,true)!==flags||data.getUint16(local+8,true)!==method)throw new Error('Mismatched package file header.');
        const start=local+30+data.getUint16(local+26,true)+data.getUint16(local+28,true);
        if(start+compressed>offset||xpiText(bytes.subarray(local+30,local+30+data.getUint16(local+26,true)))!==path)throw new Error('Invalid package file range.');
        let content;
        if(method===0)content=bytes.slice(start,start+compressed);
        else {
            let stream;try{stream=new DecompressionStream('deflate-raw');}catch{throw new Error('This browser needs a newer version to decompress XPI packages.');}
            const reader=new Blob([bytes.subarray(start,start+compressed)]).stream().pipeThrough(stream).getReader(),chunks=[];let length=0;
            try { while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>expanded)throw new Error('Package decompression exceeded its declared size.');chunks.push(value);} }
            catch(error){await reader.cancel().catch(()=>{});throw error;}
            content=new Uint8Array(length);let index=0;for(const chunk of chunks){content.set(chunk,index);index+=chunk.length;}
        }
        if(content.length!==expanded||geekfoxXpiCRC(content)!==crc)throw new Error('Package integrity check failed: '+path);
        files.set(path,content);
    }
    if(cursor!==end||!files.has('manifest.json'))throw new Error('The package needs manifest.json at its root.');
    return files;
}
export function geekfoxWebextPattern(pattern, input) {
    let url;try{url=new URL(input);}catch{return false;}
    if(!['http:','https:'].includes(url.protocol))return false;
    if(pattern==='<all_urls>')return true;
    const match=/^(\*|https?):\/\/(\*|(?:\*\.)?[a-z0-9.-]+)(\/[^#]*)$/i.exec(pattern);
    if(!match)return false;
    const [,scheme,rawHost,path]=match,host=rawHost.toLowerCase();
    if(scheme!=='*'&&scheme.toLowerCase()+':'!==url.protocol)return false;
    if(host!=='*'&&host!==url.hostname&&!(host.startsWith('*.')&&(url.hostname===host.slice(2)||url.hostname.endsWith(host.slice(1)))))return false;
    return new RegExp('^'+path.split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(url.pathname+url.search);
}
function validPattern(pattern) {return typeof pattern==='string'&&(pattern==='<all_urls>'||/^(\*|https?):\/\/(\*|(?:\*\.)?[a-z0-9.-]+)\/[^#]*$/i.test(pattern));}
export function inspectGeekfoxXpi(files) {
    let manifest;try{manifest=JSON.parse(xpiText(files.get('manifest.json')));}catch{throw new Error('manifest.json is not valid UTF-8 JSON.');}
    if(![2,3].includes(manifest.manifest_version))throw new Error('Only WebExtension manifest versions 2 and 3 are supported. Legacy Firefox add-ons need Firefox.');
    if(typeof manifest.name!=='string'||typeof manifest.version!=='string'||!manifest.name.trim()||manifest.name.length>200)throw new Error('The manifest needs a name and version.');
    for(const key of ['permissions','host_permissions','optional_permissions','optional_host_permissions'])if(manifest[key]&&!Array.isArray(manifest[key]))throw new Error('Invalid manifest '+key+' list.');
    const unsupported=[];
    for(const key of ['background','browser_action','action','page_action','sidebar_action','options_ui','options_page','devtools_page','chrome_url_overrides','declarative_net_request','theme','user_scripts','content_security_policy','externally_connectable','commands','omnibox','protocol_handlers']) if(manifest[key])unsupported.push(key);
    for(const permission of [...(manifest.permissions||[]),...(manifest.host_permissions||[])])if(permission!=='storage'&&!validPattern(permission))unsupported.push('permission '+permission);
    const scripts=manifest.content_scripts;
    if(!Array.isArray(scripts)||!scripts.length)unsupported.push('no declarative content scripts');
    for(const entry of Array.isArray(scripts)?scripts:[]) {
        if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Invalid content script entry.');
        if(!Array.isArray(entry.matches)||!entry.matches.length||!entry.matches.every(validPattern))unsupported.push('unsupported URL match pattern');
        if(entry.exclude_matches && (!Array.isArray(entry.exclude_matches)||!entry.exclude_matches.every(validPattern)))unsupported.push('unsupported exclusion pattern');
        if(entry.run_at && entry.run_at!=='document_idle')unsupported.push('run_at '+entry.run_at+' (only document_idle is available)');
        if(entry.all_frames||entry.match_about_blank||entry.match_origin_as_fallback)unsupported.push('subframe/origin-fallback injection');
        if(entry.world && entry.world!=='MAIN')unsupported.push('explicit isolated execution world');
        if(entry.include_globs||entry.exclude_globs)unsupported.push('glob filters');
        if(!entry.js?.length&&!entry.css?.length)unsupported.push('empty content script');
        for(const type of ['js','css']) {
            if(entry[type]&&!Array.isArray(entry[type]))throw new Error('Invalid '+type+' content script list.');
            for(const path of entry[type]||[]) {geekfoxXpiPath(path);if(!files.has(path))throw new Error('Missing content script: '+path);if(type==='js')xpiText(files.get(path));}
        }
    }
    if(unsupported.length)throw new Error('This package needs features Geekfox cannot provide: '+[...new Set(unsupported)].join(', ')+'. Use it in Firefox.');
    let messages={};
    if(manifest.default_locale) {
        const path='_locales/'+geekfoxXpiPath(manifest.default_locale)+'/messages.json';
        if(files.has(path))try{messages=JSON.parse(xpiText(files.get(path)));}catch{throw new Error('Invalid extension locale messages.');}
    }
    const name=manifest.name.replace(/__MSG_(\w+)__/g,(_,key)=>messages[key]?.message||key).slice(0,100);
    return {manifest,name,messages,hosts:[...new Set(scripts.flatMap(entry=>entry.matches))],hasScripts:scripts.some(entry=>entry.js?.length)};
}
function xpiDB() {
    return new Promise((resolve,reject)=>{const req=indexedDB.open('gbGeekfoxWebExtensions',1);req.onupgradeneeded=()=>{req.result.createObjectStore('packages',{keyPath:'id'});req.result.createObjectStore('storage');};req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);});
}
async function xpiStore(store,operation) {
    const db=await xpiDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),req=operation(tx.objectStore(store));let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage transaction cancelled.'));});}finally{db.close();}
}
function xpiMIME(path) {const ext=path.split('.').pop().toLowerCase();return {js:'text/javascript',json:'application/json',css:'text/css',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',woff:'font/woff',woff2:'font/woff2',html:'text/html'}[ext]||'application/octet-stream';}
export function initializeGeekfoxWebExtensions({frames,reload}) {
    const $=id=>document.getElementById(id);let packages=[],candidate=null,busy=false;
    const contexts=new Map(),storageQueues=new Map(),storageEvents=new Map();
    function note(message){$('geekfox-xpi-status').textContent=message;}
    function release(context){for(const url of context.urls)URL.revokeObjectURL(url);for(const clean of context.cleanups)clean();}
    function cleanup(){for(const [frame,state] of contexts)if(!frames().some(tab=>tab.frame===frame)||frame.contentDocument!==state.doc){state.extensions.forEach(release);contexts.delete(frame);}}
    function render(){
        $('geekfox-xpi-list').replaceChildren(...packages.map(pkg=>{
            const row=document.createElement('div');row.className='geekfox-addon-row';
            const label=document.createElement('label'),toggle=document.createElement('input'),caption=document.createElement('span'),name=document.createElement('strong'),info=document.createElement('small');
            toggle.type='checkbox';toggle.checked=pkg.enabled;toggle.disabled=busy;name.textContent=pkg.name+' '+pkg.manifest.version;
            info.textContent=(pkg.error?'Error: '+pkg.error:'Firefox package · '+(pkg.enabled?'Enabled':'Disabled'))+' · Sites: '+pkg.hosts.join(', ');
            caption.append(name,info);label.append(toggle,caption);row.append(label);
            toggle.onchange=async()=>{toggle.disabled=true;try{await xpiStore('packages',store=>store.put({id:pkg.id,archive:pkg.archive,enabled:toggle.checked}));pkg.enabled=toggle.checked;pkg.error='';reload();note('Extension changed. Open Geekfox pages are reloading to reset scripts.');}catch(error){note('Could not save extension: '+error.message);}finally{render();}};
            const remove=document.createElement('button');remove.className='button quiet';remove.textContent='Remove';remove.disabled=busy;remove.setAttribute('aria-label','Remove '+pkg.name);
            remove.onclick=async()=>{remove.disabled=true;try{await xpiStore('packages',store=>store.delete(pkg.id));packages=packages.filter(item=>item!==pkg);reload();note('Package removed. Saved extension data is kept until you clear site data.');render();}catch(error){note(error.message);remove.disabled=false;}};
            row.append(remove);return row;
        }));
    }
    const ready=(async()=>{
        try{for(const record of await xpiStore('packages',store=>store.getAll())){
            try{const files=await unpackGeekfoxXpi(record.archive),info=inspectGeekfoxXpi(files);packages.push({...record,...info,files});}catch(error){note('A saved extension could not load: '+error.message);}
        }render();}catch(error){note('Extension storage unavailable: '+error.message);}
    })();
    async function prepare(file){
        if(busy)return;busy=true;candidate=null;$('geekfox-xpi-review').hidden=true;note('Reading package…');
        try{
            await ready;if(packages.length>=10)throw new Error('Remove a package before adding another (limit 10).');
            if(file.size>XPI_LIMITS.archive)throw new Error('XPI packages must be smaller than 10 MiB.');
            const archive=await file.arrayBuffer(),files=await unpackGeekfoxXpi(archive),info=inspectGeekfoxXpi(files);
            const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',archive)),byte=>byte.toString(16).padStart(2,'0')).join('');
            const id=info.manifest.browser_specific_settings?.gecko?.id||info.manifest.applications?.gecko?.id||'geekfox-'+digest;
            if(typeof id!=='string'||id.length>200)throw new Error('Invalid extension ID.');
            if(packages.some(pkg=>pkg.id===id))throw new Error('This extension is already installed. Remove it before installing a different version.');
            candidate={id,archive,files,...info,enabled:false};
            $('geekfox-xpi-review-name').textContent=info.name+' '+info.manifest.version;
            $('geekfox-xpi-review-sites').textContent=info.hosts.join(', ');
            $('geekfox-xpi-review-access').textContent=info.hasScripts?'Runs JavaScript that can read and change matching Geekfox pages. Scripts share the page context and may access other Geeks Bunker site data. Firefox’s security isolation is unavailable. Install only code you trust.':'Changes styles on matching Geekfox pages.';
            $('geekfox-xpi-review-storage').textContent=info.manifest.permissions?.includes('storage')?'Can store its own settings in this browser.':'Does not request extension storage.';
            $('geekfox-xpi-trust').checked=false;$('geekfox-xpi-install').disabled=true;$('geekfox-xpi-review').hidden=false;
            note('Package checked. Review its access before installing. Package signatures are not verified.');
        }catch(error){note(error.message);}finally{busy=false;render();}
    }
    $('geekfox-xpi-import').onclick=()=>$('geekfox-xpi-file').click();
    $('geekfox-xpi-file').onchange=event=>{const file=event.target.files[0];event.target.value='';if(file)prepare(file);};
    $('geekfox-xpi-trust').onchange=event=>{$('geekfox-xpi-install').disabled=!event.target.checked;};
    $('geekfox-xpi-cancel').onclick=()=>{candidate=null;$('geekfox-xpi-review').hidden=true;note('Installation cancelled.');};
    $('geekfox-xpi-install').onclick=async()=>{
        if(!candidate||!$('geekfox-xpi-trust').checked||busy)return;
        busy=true;$('geekfox-xpi-install').disabled=true;$('geekfox-xpi-cancel').disabled=true;
        try{const pkg=candidate;await xpiStore('packages',store=>store.put({id:pkg.id,archive:pkg.archive,enabled:true}));pkg.enabled=true;packages.push(pkg);candidate=null;$('geekfox-xpi-review').hidden=true;reload();note('Installed '+pkg.name+'. Matching open pages are reloading.');}
        catch(error){note('Installation failed: '+error.message);}finally{busy=false;$('geekfox-xpi-install').disabled=false;$('geekfox-xpi-cancel').disabled=false;render();}
    };
    function eventAPI(listeners,cleanups){return {addListener(listener){if(typeof listener==='function'){listeners.add(listener);cleanups.push(()=>listeners.delete(listener));}},removeListener(listener){listeners.delete(listener);},hasListener(listener){return listeners.has(listener);},hasListeners(){return !!listeners.size;}};}
    function apiFor(pkg,context){
        const clone=value=>structuredClone(value);
        const resource=path=>{
            path=geekfoxXpiPath(path.replace(/^\//,''));if(context.resources.has(path))return context.resources.get(path);
            if(!pkg.files.has(path))throw new Error('Missing extension resource: '+path);
            // Data URLs remain inside the page rewriter; outer-origin blob URLs are rejected.
            const bytes=pkg.files.get(path);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
            const url='data:'+xpiMIME(path)+';base64,'+btoa(binary);context.resources.set(path,url);return url;
        };
        const listeners=storageEvents.get(pkg.id)||new Set();storageEvents.set(pkg.id,listeners);
        const changes=eventAPI(listeners,context.cleanups);
        const storage=operation=>{
            const previous=storageQueues.get(pkg.id)||Promise.resolve();
            const task=previous.catch(()=>{}).then(async()=>{
                if(!pkg.enabled||!packages.includes(pkg))throw new Error('Extension is no longer enabled.');
                const old=await xpiStore('storage',store=>store.get(pkg.id))||{},result=operation(clone(old));
                if(result.data){if(new Blob([JSON.stringify(result.data)]).size>2*1024*1024)throw new Error('Extension storage limit is 2 MiB.');await xpiStore('storage',store=>store.put(result.data,pkg.id));
                    const delta={};for(const key of new Set([...Object.keys(old),...Object.keys(result.data)]))if(JSON.stringify(old[key])!==JSON.stringify(result.data[key]))delta[key]={...(Object.hasOwn(old,key)?{oldValue:old[key]}:{}),...(Object.hasOwn(result.data,key)?{newValue:result.data[key]}:{})};
                    if(Object.keys(delta).length)for(const listener of listeners)try{listener(clone(delta),'local');}catch{}
                }return clone(result.value);
            });storageQueues.set(pkg.id,task);return task;
        };
        const withCallback=fn=>(...args)=>{const callback=typeof args.at(-1)==='function'?args.pop():null,promise=Promise.resolve().then(()=>fn(...args));if(callback){promise.then(value=>callback(value),error=>{api.runtime.lastError={message:error.message};try{callback();}finally{delete api.runtime.lastError;}});return;}return promise;};
        const select=(data,keys)=>keys==null?data:typeof keys==='string'?Object.fromEntries(Object.hasOwn(data,keys)?[[keys,data[keys]]]:[]):Array.isArray(keys)?Object.fromEntries(keys.filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]])):Object.fromEntries(Object.entries(keys).map(([key,value])=>[key,Object.hasOwn(data,key)?data[key]:value]));
        const local={
            get:withCallback(keys=>storage(data=>({value:select(data,keys)}))),
            set:withCallback(values=>storage(data=>{if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('storage.local.set expects an object.');return {data:Object.assign(Object.create(null),data,clone(values))};})),
            remove:withCallback(keys=>storage(data=>{for(const key of typeof keys==='string'?[keys]:keys)delete data[key];return {data};})),
            clear:withCallback(()=>storage(()=>({data:{}}))),
            getKeys:withCallback(()=>storage(data=>({value:Object.keys(data)}))),
            getBytesInUse:withCallback(keys=>storage(data=>({value:new Blob([JSON.stringify(select(data,keys))]).size}))),
            onChanged:changes
        };
        const api={runtime:{id:pkg.id,getManifest:()=>clone(pkg.manifest),getURL:resource,getBrowserInfo:async()=>({name:'Geekfox',vendor:'3L Enterprises',version:'1',buildID:'web'}),sendMessage:withCallback(()=>{throw new Error('Background messaging is not available in Geekfox.');})},extension:{getURL:resource,inIncognitoContext:false},i18n:{
            getUILanguage:()=>navigator.language,
            getAcceptLanguages:withCallback(()=>[...navigator.languages]),
            getMessage:(key,substitutions=[])=>{if(key==='@@extension_id')return pkg.id;if(key==='@@ui_locale')return navigator.language;const entry=pkg.messages[key];if(!entry)return '';const args=Array.isArray(substitutions)?substitutions:[substitutions];return entry.message.replace(/\$([\w]+)\$/g,(_,name)=>entry.placeholders?.[name.toLowerCase()]?.content||'').replace(/\$(\d+)/g,(_,number)=>args[Number(number)-1]??'').replace(/\$\$/g,'$');}
        }};
        if(pkg.manifest.permissions?.includes('storage'))api.storage={local,onChanged:changes};
        return {api,resource};
    }
    function cssFor(pkg,path,resource){
        const source=xpiText(pkg.files.get(path));if(/@import/i.test(source))throw new Error('CSS @import is not supported: '+path);
        return source.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(whole,quote,value)=>{
            if(/^(data:|#)/i.test(value))return whole;
            if(/^[a-z]+:|^\/\//i.test(value))throw new Error('External CSS resources are not supported: '+path);
            const base=new URL(path,'https://extension.invalid/'),resolved=new URL(value,base);
            return 'url("'+resource(resolved.pathname.slice(1))+'")';
        });
    }
    async function apply(frame){
        await ready;cleanup();const tab=frames().find(item=>item.frame===frame);if(!tab)return;
        let doc;try{doc=frame.contentDocument;if(!doc?.body||doc.readyState!=='complete'||doc.URL.startsWith('about:'))return;}catch{return;}
        let state=contexts.get(frame);if(!state){state={doc,extensions:new Map()};contexts.set(frame,state);}
        const url=tab.handle?.currentURL?.()||tab.url;
        for(const pkg of packages.filter(item=>item.enabled)){
            if(state.extensions.has(pkg.id))continue;
            const scripts=pkg.manifest.content_scripts.filter(entry=>entry.matches.some(pattern=>geekfoxWebextPattern(pattern,url))&&!(entry.exclude_matches||[]).some(pattern=>geekfoxWebextPattern(pattern,url)));
            if(!scripts.length)continue;
            const context={urls:[],cleanups:[],resources:new Map()};state.extensions.set(pkg.id,context);
            try{
                const {api,resource}=apiFor(pkg,context);
                const source='geekfox-extension/'+encodeURIComponent(pkg.id);
                const report=event=>{const error=event.error||event.reason;if((event.filename||'').includes(source)||(error?.stack||'').includes(source)){pkg.error=error?.message||event.message||'Extension script failed.';note(pkg.name+': '+pkg.error);render();}};
                for(const type of ['error','unhandledrejection']){frame.contentWindow.addEventListener(type,report);context.cleanups.push(()=>frame.contentWindow.removeEventListener(type,report));}

                const code=[];
                for(const entry of scripts){
                    for(const path of entry.css||[]){const style=doc.createElement('style');style.textContent=cssFor(pkg,path,resource);doc.head.append(style);context.cleanups.push(()=>style.remove());}
                    for(const path of entry.js||[])code.push(xpiText(pkg.files.get(path))+'\n;');
                }
                if(code.length){
                    // One lexical scope preserves ordered content-script globals across files.
                    // This does not claim Firefox's isolated worlds or privileged browser APIs.
                    const run=frame.contentWindow.Function('browser','chrome',code.join('\n')+'\n//# sourceURL=geekfox-extension/'+encodeURIComponent(pkg.id));
                    run.call(frame.contentWindow,api,api);
                }
                pkg.error='';
            }catch(error){pkg.error=error.message;note(pkg.name+': '+error.message);render();}
        }
    }
    return {apply,refresh(){cleanup();frames().forEach(tab=>apply(tab.frame));},ready};
}
