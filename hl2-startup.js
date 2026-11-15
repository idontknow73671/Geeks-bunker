// This upstream build incorrectly compares the unused legacy eyeball.texture field
// with mesh.material in two places. Native v44 models leave it zero. Keep the
// bounds/material-variable checks, but let those models reach eye setup.
export async function repairHalfLife2Renderer(bytes) {
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash==='9558d23d37b380ec6a5433c75248a84afcef53703e92aeb09410086f50c5f5bb')return {bytes,applied:true};
    if(hash!=='450c04059dba15523ee1fd4e9ece2d913cc7faa806ad603e3f6592f806584c0d')return {bytes,applied:false};
    const repaired=bytes.slice();
    for(const offset of [106577,107371]) {
        if(repaired[offset]!==0x0d||repaired[offset+1]!==0)throw Error('HL2 renderer patch does not match its expected instructions');
        // br_if 0 -> drop; nop. Preserve code sizes, linking metadata and ABI.
        repaired[offset]=0x1a;repaired[offset+1]=0x01;
    }
    return {bytes:repaired,applied:true};
}
// Restore C_BaseFlex::SetupWeights and its this-adjusting thunk. The upstream
// stubs only zero the output; the existing controller, scene and viseme routines
// remain intact. Source for these two replacement bodies: engine-patches/hl2-flex.wat.
export async function repairHalfLife2Client(bytes) {
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash==='f0b3abb8b8d7b4415ea632367ce509dfe8b8d1e0613d41789740945bed9ee3f4')return {bytes,applied:true};
    if(hash!=='69f7b3d2722e3c3941f7a2baa72b3f663cf86d67d40467ae6a872fd531787798')return {bytes,applied:false};
    const fromHex=hex=>Uint8Array.from(hex.match(/../g),v=>parseInt(v,16));
    const setup=fromHex('01047f024020002d00c0100d0020002802c810210520054504402000108b0920002802c81021050b2005450d0020052802002106200628028c0241004a044020062006280290026a280208417f46044041002107034020062006280290026a200741146c6a21082008200820082802046a10b20f360208200741016a2207200628028c02480d000b0b0b2000200120022003200410cc0f04402000200120022003200410cd0f0b0b0b');
    const thunk=fromHex('002000417c6a200120022003200410c80f0b');
    // Only two code bodies and the code-section length change. All other bytes,
    // including linking metadata, function indices and storage behavior, survive.
    const replacement=new Uint8Array(2+setup.length+1+thunk.length);
    replacement.set([0xa9,0x01]);replacement.set(setup,2);
    replacement[2+setup.length]=thunk.length;replacement.set(thunk,3+setup.length);
    const start=3315762,end=3315880,delta=replacement.length-(end-start);
    const repaired=new Uint8Array(bytes.length+delta);
    repaired.set(bytes.subarray(0,start));repaired.set(replacement,start);repaired.set(bytes.subarray(end),start+replacement.length);
    let length=7314595+delta;
    for(let offset=56687;offset<56691;offset++){repaired[offset]=(length&127)|(offset<56690?128:0);length>>>=7;}
    return {bytes:repaired,applied:true};
}
export async function prepareHalfLife2RuntimeResponse(runtime,base,signal) {
    const scriptURL=new URL('index.js',base).href;let lastError;
    for(let attempt=0;attempt<3;attempt++) {
        try {
            const response=await runtime.fetch(scriptURL,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)});
            if(!response.ok)throw Error('HL2 runtime returned HTTP '+response.status);
            const script=await response.text();
            if(!script.includes('class DataLoader')||!script.includes('var Module'))throw Error('HL2 runtime response was not its engine loader');
            const rendererURL=new URL('libstudiorender.so',base).href;
            const renderer=await runtime.fetch(rendererURL,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)});
            if(!renderer.ok)throw Error('HL2 renderer returned HTTP '+renderer.status);
            const bytes=new Uint8Array(await renderer.arrayBuffer());
            if(bytes.length<8||bytes[0]!==0||bytes[1]!==97||bytes[2]!==115||bytes[3]!==109)throw Error('HL2 renderer response was not WebAssembly');
            const repaired=await repairHalfLife2Renderer(bytes);
            console.info('[HL2 renderer] '+(repaired.applied?'Legacy eye-mesh compatibility repair ready':'Different engine build; preserving its renderer unchanged'));
            const clientURL=new URL('libclient.so',base).href;
            const client=await runtime.fetch(clientURL,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)});
            if(!client.ok)throw Error('HL2 client returned HTTP '+client.status);
            const clientBytes=new Uint8Array(await client.arrayBuffer());
            if(clientBytes.length<8||clientBytes[0]!==0||clientBytes[1]!==97||clientBytes[2]!==115||clientBytes[3]!==109)throw Error('HL2 client response was not WebAssembly');
            const facial=await repairHalfLife2Client(clientBytes);
            console.info('[HL2 facial animation] '+(facial.applied?'Native scene and speech updates restored':'Different engine build; preserving its client unchanged'));
            return new Map([[scriptURL,new Response(script,{headers:{'Content-Type':'application/javascript'}})],[rendererURL,new Response(repaired.bytes,{headers:{'Content-Type':'application/wasm'}})],[clientURL,new Response(facial.bytes,{headers:{'Content-Type':'application/wasm'}})]]);
        }catch(error){lastError=error;if(signal?.aborted)throw error;}
    }
    throw lastError||Error('HL2 runtime could not be prepared');
}
export function halfLife2AssetURL(path,base='https://alexboops.github.io/half-life-2-port/') {
    const target=new URL(path,base),origin=new URL(base);
    if(target.origin!==origin.origin||!target.pathname.startsWith(origin.pathname)||!/\.(?:wasm|so|data)(?:\.part[0-9]+)?$/.test(target.pathname))throw Error('Unsupported HL2 asset');
    return target.href;
}
export async function fetchHalfLife2Asset(runtime,path,base,signal) {
    const response=await runtime.fetch(halfLife2AssetURL(path,base),{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)});
    const bytes=new Uint8Array(await response.arrayBuffer());
    const expected=Number(response.headers.get('content-length'));
    if(!response.headers.get('content-encoding')&&expected>0&&bytes.byteLength!==expected)throw Error('HL2 asset transfer was incomplete');
    const headers=new Headers(response.headers);headers.delete('content-encoding');headers.set('content-length',String(bytes.byteLength));
    return {bytes,status:response.status,statusText:response.statusText,headers:[...headers]};
}
export function prepareHalfLife2Document(html) {
    if(html.includes('gbHl2ChunkRetry'))return html;
    const start=html.indexOf('      async function fetchPart('),end=html.indexOf('      const g_chunkAssembly',start);
    const assembled='return combined.buffer;';
    const bootstrap=/const wasmRes = await origFetch\('index\.wasm'\);\s*if \(!wasmRes\.ok\) throw new Error\('Missing index\.wasm'\);\s*const wasmBytes = await wasmRes\.arrayBuffer\(\);/;
    const swallowed="return new Response(new ArrayBuffer(0), { status: 200, statusText: 'OK' });";
    if(!bootstrap.test(html)||start<0||end<start||!html.includes(assembled)||!html.includes(swallowed)||!html.includes('g_chunkAssembly[baseName] = (async () => {')||!/return combined\.buffer;\s*\}\)\(\);/.test(html))throw Error('Half-Life 2 changed its launcher; its compatibility adapter needs an update.');
    const code=`      // gbHl2ChunkRetry: keep original URLs/storage; retry incomplete network transfers.
      const gbHl2ActiveTransfers=new Set();
      function gbHl2Transfer(text) {
        let hud=document.getElementById('gb-hl2-transfer');
        if(!hud){hud=document.createElement('div');hud.id='gb-hl2-transfer';hud.setAttribute('role','status');hud.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;z-index:9999;padding:10px 14px;background:rgba(12,16,20,.88);color:#fff;font:13px system-ui;pointer-events:none;border:1px solid #555;border-radius:8px';document.body.append(hud);}
        hud.textContent=text;hud.hidden=!text;
      }
      async function gbHl2BootstrapBytes() {
        let lastError;
        for(let attempt=0;attempt<3;attempt++) {
          updateUI(attempt?'RETRYING':'STARTING','Downloading WebAssembly engine'+(attempt?' · retry '+attempt:''));
          try {
            let bytes;
            if(typeof window.__gbHl2Bootstrap==='function')bytes=await window.__gbHl2Bootstrap();
            else {const response=await origFetch('index.wasm');if(!response.ok)throw Error('Engine returned HTTP '+response.status);bytes=new Uint8Array(await response.arrayBuffer());}
            if(bytes.byteLength<8||bytes[0]!==0||bytes[1]!==97||bytes[2]!==115||bytes[3]!==109)throw Error('Engine download is incomplete or not WebAssembly');
            return bytes;
          }catch(error){lastError=error;console.warn('[HL2 engine]',error.message);}
          if(attempt<2)await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
        }
        throw Error('Could not download the HL2 engine: '+lastError.message);
      }
      async function fetchPart(baseName, partIdx) {
        const pad4=String(partIdx).padStart(4,'0');
        const paths=[\x60chunks/\x24{baseName}.part\x24{pad4}\x60,\x60\x24{baseName}.part\x24{pad4}\x60];
        let lastError;
        for(let attempt=0;attempt<3;attempt++) {
          gbHl2Transfer('Loading '+baseName+' · part '+partIdx+(attempt?' · retry '+attempt:'/ '+SPLIT_FILES[baseName]));
          for(const path of paths) {
            const controller=new AbortController();
            const deadline=setTimeout(()=>controller.abort(new Error('Chunk transfer timed out')),90000);
            try {
              const response=await origFetch(path,{cache:attempt?'reload':'default',signal:controller.signal});
              if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
              const buffer=await response.arrayBuffer();
              const expected=Number(response.headers.get('content-length'));
              if(!buffer.byteLength || (!response.headers.get('content-encoding')&&expected>0&&buffer.byteLength!==expected))throw Error('Incomplete chunk');
              if(/^\\s*(?:<!doctype|<html)/i.test(new TextDecoder().decode(new Uint8Array(buffer,0,Math.min(buffer.byteLength,128)))))throw Error('Chunk returned an HTML error page');
              updateUI(undefined,baseName+' (.part'+pad4+')',buffer.byteLength);
              return buffer;
            } catch(error){lastError=error;console.warn('[HL2 transfer]',baseName,pad4,'attempt',attempt+1,error.message);}finally{clearTimeout(deadline);}
          }
          if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
        }
        const message='Could not download '+baseName+'.part'+pad4+': '+lastError.message;
        gbHl2Transfer(message);throw Error(message);
      }

`;
    html=html.slice(0,start)+code+html.slice(end);
    html=html.replace('g_chunkAssembly[baseName] = (async () => {','g_chunkAssembly[baseName] = (async () => {\n          gbHl2ActiveTransfers.add(baseName);');
    html=html.replace(/return combined\.buffer;\s*\}\)\(\);/,`return combined.buffer;
        })().catch(error=>{delete g_chunkAssembly[baseName];throw error;}).finally(()=>{gbHl2ActiveTransfers.delete(baseName);if(!gbHl2ActiveTransfers.size)gbHl2Transfer('');});`);
    html=html.replace(bootstrap, 'const wasmBytes = await gbHl2BootstrapBytes();');
    html=html.replace('const origFetch = window.fetch.bind(window);',`const gbHl2NativeFetch = window.fetch.bind(window);
      const origFetch = async function(input,init) {
        const path=typeof input==='string'?input:input.url;
        if(typeof window.__gbHl2Asset==='function' && /\\.data(?:\\.part[0-9]+)?(?:[?#]|$)/.test(path) && (!init?.method||init.method.toUpperCase()==='GET')) {
          const asset=await window.__gbHl2Asset(path);
          if(asset.status<200||asset.status>=300)throw Error('HL2 map transfer returned HTTP '+asset.status+' for '+path);
          if(!asset.bytes.byteLength)throw Error('HL2 map transfer was empty: '+path);
          if(/^\\s*(?:<!doctype|<html)/i.test(new TextDecoder().decode(asset.bytes.subarray(0,128))))throw Error('HL2 map transfer returned an HTML error page: '+path);
          return new Response(asset.bytes,{status:asset.status,statusText:asset.statusText,headers:asset.headers});
        }
        return gbHl2NativeFetch(input,init);
      };`);
    html=html.replace("(err && err.stack) ? err.stack", "(err && err.stack) ? (err.message && !String(err.stack).includes(err.message) ? err.message + String.fromCharCode(10) + err.stack : err.stack)");
    html=html.replace(swallowed,"showCrash(e); return new Response(String(e.message||e), {status:502,statusText:'Map transfer failed'});");
    return html;
}
