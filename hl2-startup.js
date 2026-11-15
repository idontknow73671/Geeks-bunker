// The upstream resume handler only knows OpenAL. SDL playback can remain
// suspended after startup or an OS/tab interruption; recover existing contexts
// on interaction without replacing devices, buffers, or engine code.
export function prepareHalfLife2Audio(html) {
    const original=`function resumeAudioStack() {
        if (typeof AL !== 'undefined' && AL.currentCtx && AL.currentCtx.audioCtx) {
          if (AL.currentCtx.audioCtx.state === 'suspended') {
            AL.currentCtx.audioCtx.resume().catch(() => {});
          }
        }
      }`;
    if(!html.includes(original))return html;
    return html.replace(original,`const gbHl2AudioPending=new WeakSet();
      function resumeAudioStack() {
        if(document.visibilityState==='hidden')return;
        const contexts=new Set();
        if(typeof Module!=='undefined')contexts.add(Module.SDL2?.audioContext);
        if(typeof AL!=='undefined')contexts.add(AL.currentCtx?.audioCtx);
        for(const context of contexts) {
          if(!context||!['suspended','interrupted'].includes(context.state)||gbHl2AudioPending.has(context))continue;
          gbHl2AudioPending.add(context);
          try {
            Promise.resolve(context.resume()).catch(error=>console.warn('[HL2 audio] Resume failed:',error.message)).finally(()=>gbHl2AudioPending.delete(context));
          }catch(error){gbHl2AudioPending.delete(context);console.warn('[HL2 audio] Resume failed:',error.message);}
        }
      }
      window.addEventListener('pointerdown',resumeAudioStack,true);
      window.addEventListener('keydown',resumeAudioStack,true);
      window.addEventListener('focus',resumeAudioStack);
      document.addEventListener('visibilitychange',resumeAudioStack);`);
}
export async function prepareHalfLife2RuntimeResponse(runtime,base,signal) {
    const scriptURL=new URL('index.js',base).href;let lastError;
    for(let attempt=0;attempt<3;attempt++) {
        try {
            const response=await runtime.fetch(scriptURL,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)});
            if(!response.ok)throw Error('HL2 runtime returned HTTP '+response.status);
            const script=await response.text();
            if(!script.includes('class DataLoader')||!script.includes('var Module'))throw Error('HL2 runtime response was not its engine loader');
            return new Map([[scriptURL,new Response(script,{headers:{'Content-Type':'application/javascript'}})]]);
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
    html=prepareHalfLife2Audio(html);
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
