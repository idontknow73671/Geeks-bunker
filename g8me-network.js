// Online levels use POST requests. Keep them in the existing g8me frame so
// adding a route never changes its origin, localStorage prefix or native IDB.
export function resolveGdNetworkURL(value) {
    const official = new Set(['www.boomlings.com','boomlings.com','www.robtopgames.org','robtopgames.org','audio.ngfiles.com','geometrydashfiles.b-cdn.net']);
    const bridges = new Set(['gd-proxy.webdashers.workers.dev','webdashers.webdashersdevelopement.workers.dev','fallbackgdproxy.webdashers.workers.dev','fallback2.webdashers.workers.dev']);
    const apis = new Set(['api.ixl.college','api.sngdu.com']);
    const parse = input => /^\/__proxy\?/.test(input) ? new URL(input,'https://geeks-bunker.invalid') : new URL(/^[a-z][a-z0-9+.-]*:/i.test(input)?input:'https://'+input);
    let url;
    try {
        url = parse(String(value));
        // The WASM runtime emits relative bridge URLs. In a srcdoc frame,
        // location.href is about:srcdoc, so the port's own URL parser fails.
        for(let step=0;step<5&&url.pathname==='/__proxy'&&url.searchParams.has('url');step++)url=parse(url.searchParams.get('url'));
    } catch { return null; }
    if(url.username||url.password)return null;
    // Older native clients emit HTTP or scheme-less GD addresses. Upgrade
    // recognized destinations locally; never send game traffic in plaintext.
    if(url.protocol==='http:'&&(official.has(url.hostname)||bridges.has(url.hostname)||apis.has(url.hostname)))url.protocol='https:';
    if (url.protocol !== 'https:') return null;
    if (official.has(url.hostname)) return url.href;
    if (bridges.has(url.hostname) && url.pathname==='/audio-proxy' && url.searchParams.has('url')) {
        try { const audio=new URL(url.searchParams.get('url'));if(audio.protocol==='https:' && ['audio.ngfiles.com','geometrydashfiles.b-cdn.net'].includes(audio.hostname))return audio.href; } catch {}
    }
    if (bridges.has(url.hostname) && /^\/(?:database\/)?[\w-]+\.php$/.test(url.pathname)) {
        return 'https://www.boomlings.com/database/' + url.pathname.replace(/^\/(?:database\/)?/, '') + url.search;
    }
    if (apis.has(url.hostname)) {
        for (const [host, key] of [['www.boomlings.com','b'],['www.robtopgames.org','r'],['audio.ngfiles.com','n'],['geometrydashfiles.b-cdn.net','c']]) {
            const path=url.searchParams.get(key);
            if (path && !/^(?:https?:)?\/\//i.test(path)) return 'https://' + host + '/' + path.replace(/^\//,'');
        }
    }
    return null;
}

export function gdNetworkRoutes(target) {
    const url = new URL(target);
    const key = url.hostname==='audio.ngfiles.com' ? 'n' : url.hostname==='geometrydashfiles.b-cdn.net' ? 'c' : /robtopgames\.org$/.test(url.hostname) ? 'r' : 'b';
    const query = '?' + key + '=' + encodeURIComponent(url.pathname.replace(/^\//,'') + url.search);
    const published=['https://gd-proxy.webdashers.workers.dev','https://webdashers.webdashersdevelopement.workers.dev','https://fallbackgdproxy.webdashers.workers.dev','https://fallback2.webdashers.workers.dev'];
    const backups=[];
    if(key==='b'&&url.pathname.startsWith('/database/'))for(const origin of published)backups.push(origin+url.pathname.slice(9)+url.search);
    if(key==='n'||key==='c')for(const origin of published)backups.push(origin+'/audio-proxy?url='+encodeURIComponent(url.href));
    return [...backups,'https://api.ixl.college/' + query, 'https://api.sngdu.com/' + query];
}

export function isGdReadRequest(target,method='POST') {
    if (['GET','HEAD'].includes(String(method).toUpperCase())) return true;
    const url=new URL(target);
    return String(method).toUpperCase()==='POST' &&
        ['www.boomlings.com','boomlings.com','www.robtopgames.org','robtopgames.org'].includes(url.hostname) &&
        /^\/database\/(?:getGJ(?:Levels21|DailyLevel|Gauntlets21|MapPacks21|Scores20|LevelScores211|LevelScoresPlat|Users20|UserInfo20|Comments21|AccountComments20|SongInfo)|downloadGJLevel(?:21|22))\.php$/.test(url.pathname);
}

export async function fetchGdThroughRelay(runtime,url,options={}) {
    const target=resolveGdNetworkURL(url);
    if(!target)throw new Error('Unsupported level service.');
    // Stream the official destination through the relay. Reading a cloned body
    // here used to buffer whole levels/songs before the game saw their headers.
    // Preserve a recognized backup endpoint instead of normalizing it back to
    // the official server. Both destinations travel through the same p8y relay.
    const destination=gdNetworkRoutes(target).includes(String(url))?String(url):target;
    return runtime.fetch(destination,{...options,retryRead:isGdReadRequest(target,options.method||'GET')});
}

function installGdNetwork(resolve, routes, isRead) {
    const original=window.fetch.bind(window),preferred=new Map(),failed=new Map();
    const waitFor=(promise,signal)=>{
        signal.throwIfAborted();
        let abort;
        return Promise.race([promise,new Promise((_,reject)=>{
            abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
        })]).finally(()=>signal.removeEventListener('abort',abort));
    };
    window.fetch=async function(input,init) {
        const value=typeof input==='string'||input instanceof URL?String(input):input.url;
        const target=resolve(value);
        if(!target)return original(input,init);
        const request=new Request(typeof input==='string'||input instanceof URL?target:input,init);
        const readOnly=isRead(target,request.method);
        let relayFetch;
        try { if(typeof parent.__gbGdNetworkFetch==='function')relayFetch=parent.__gbGdNetworkFetch.bind(parent); } catch {}
        // Let the port handle mutations when no host relay is available. A lost
        // acknowledgement must never cause an upload/comment to be sent twice.
        if(!readOnly&&!relayFetch)return original(input,init);
        const controller=new AbortController(),host=new URL(target).hostname;
        const abort=()=>controller.abort(request.signal.reason);
        request.signal.addEventListener('abort',abort,{once:true});
        if(request.signal.aborted)abort();
        let timer;
        const cleanup=()=>{clearTimeout(timer);request.signal.removeEventListener('abort',abort);};
        try {
            const body=/^(GET|HEAD)$/.test(request.method)?null:new Uint8Array(await request.clone().arrayBuffer());
            const headers={};
            for(const key of ['content-type','accept'])if(request.headers.has(key))headers[key]=request.headers.get(key);
            const options={method:request.method,body,headers};
            const choices=[];
            if(relayFetch)choices.push({key:'relay',run:signal=>relayFetch(target,{...options,signal})});
            else choices.push({key:'direct',run:signal=>original(target,{...options,signal})});
            if(readOnly)for(const route of routes(target))choices.push({key:new URL(route).origin,run:signal=>relayFetch?relayFetch(route,{...options,signal}):original(route,{...options,signal})});
            const key=choice=>host+'|'+choice.key;
            const healthy=choices.filter(choice=>(failed.get(key(choice))||0)<=Date.now());
            // Keep a successful route and briefly cool down failures, rather
            // than waiting on the same broken services for every button press.
            if(!healthy.length)throw new Error('GD servers are temporarily unavailable. Please retry in 30 seconds.');
            const ordered=healthy.sort((a,b)=>(b.key===preferred.get(host))-(a.key===preferred.get(host)));
            const attempt=async choice=>{
                const deadline=new AbortController(),signal=AbortSignal.any([controller.signal,deadline.signal]);
                const connectionTimer=setTimeout(()=>deadline.abort(new DOMException('Level connection timed out','TimeoutError')),15000);
                let reader;
                try {
                    const response=await waitFor(Promise.resolve().then(()=>choice.run(signal)),signal);
                    if(!response.ok){await response.body?.cancel();throw new Error('Level service returned HTTP '+response.status);}
                    if(!response.body)return response;
                    reader=response.body.getReader();
                    const chunks=[];let first,inspected=0;
                    do {
                        first=await waitFor(reader.read(),signal);
                        if(first.done)break;
                        if(!first.value?.byteLength)continue;
                        chunks.push(first.value);inspected+=first.value.byteLength;
                        const text=new TextDecoder().decode(first.value.subarray(0,512)).replace(/^\uFEFF/,'').trimStart();
                        if(text.startsWith('<')||/^(?:error code:\s*\d+|too many requests|quota.*exceeded|rate limit)/i.test(text))throw new Error('Level service returned an error page');
                        if(text)break;
                    }while(inspected<512);
                    let index=0,ended=first.done;
                    const stream=new ReadableStream({
                        async pull(output){
                            try {
                                if(index<chunks.length){output.enqueue(chunks[index++]);return;}
                                const chunk=ended?{done:true}:await waitFor(reader.read(),controller.signal);
                                if(chunk.done){cleanup();output.close();}else output.enqueue(chunk.value);
                            }catch(error){failed.set(key(choice),Date.now()+30000);cleanup();reader.cancel(error).catch(()=>{});output.error(error);}
                        },
                        cancel(reason){cleanup();return reader.cancel(reason);}
                    });
                    return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
                }catch(error){if(reader)reader.cancel(error).catch(()=>{});throw error;}
                finally{clearTimeout(connectionTimer);}
            };
            timer=setTimeout(()=>controller.abort(new DOMException('Level connection timed out','TimeoutError')),45000);
            let lastError;
            for(const choice of ordered){
                controller.signal.throwIfAborted();
                try {
                    const response=await attempt(choice);
                    preferred.set(host,choice.key);failed.delete(key(choice));clearTimeout(timer);
                    if(!response.body)cleanup();
                    return response;
                }catch(error){lastError=error;if(controller.signal.aborted)throw error;failed.set(key(choice),Date.now()+30000);}
            }
            throw lastError||new Error('Level servers are unavailable. Please try again shortly.');
        }catch(error){cleanup();throw error;}
    };
}

export function withGdNetwork(html, identity) {
    if ((identity.provider || 'gn') !== 'gn' || String(identity.id) !== '868') return html;
    const script = '<script>(' + installGdNetwork.toString() + ')(' + resolveGdNetworkURL.toString() + ',' + gdNetworkRoutes.toString() + ',' + isGdReadRequest.toString() + ');</script>';
    const first = html.search(/<script\b/i);
    return first < 0 ? script + html : html.slice(0,first) + script + html.slice(first);
}
