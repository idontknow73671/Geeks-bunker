// Online levels use POST requests. Keep them in the existing g8me frame so
// adding a route never changes its origin, localStorage prefix or native IDB.
export function resolveGdNetworkURL(value) {
    let url;
    try {
        const input=String(value);
        url = /^\/__proxy\?/.test(input) ? new URL(input,'https://geeks-bunker.invalid') : new URL(input);
        // The WASM runtime emits relative bridge URLs. In a srcdoc frame,
        // location.href is about:srcdoc, so the port's own URL parser fails.
        if(url.pathname==='/__proxy' && url.searchParams.has('url')) url=new URL(url.searchParams.get('url'));
    } catch { return null; }
    if (url.protocol !== 'https:') return null;
    const official = new Set(['www.boomlings.com','boomlings.com','www.robtopgames.org','robtopgames.org','audio.ngfiles.com','geometrydashfiles.b-cdn.net']);
    if (official.has(url.hostname)) return url.href;
    const bridges = new Set(['gd-proxy.webdashers.workers.dev','webdashers.webdashersdevelopement.workers.dev','fallbackgdproxy.webdashers.workers.dev','fallback2.webdashers.workers.dev']);
    if (bridges.has(url.hostname) && url.pathname==='/audio-proxy' && url.searchParams.has('url')) {
        try { const audio=new URL(url.searchParams.get('url'));if(audio.protocol==='https:' && ['audio.ngfiles.com','geometrydashfiles.b-cdn.net'].includes(audio.hostname))return audio.href; } catch {}
    }
    if (bridges.has(url.hostname) && /^\/(?:database\/)?[\w-]+\.php$/.test(url.pathname)) {
        return 'https://www.boomlings.com/database/' + url.pathname.replace(/^\/(?:database\/)?/, '') + url.search;
    }
    if (['api.ixl.college','api.sngdu.com'].includes(url.hostname)) {
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
    return ['https://api.ixl.college/' + query, 'https://api.sngdu.com/' + query];
}

function installGdNetwork(resolve, routes) {
    const original = window.fetch.bind(window);
    window.fetch = async function(input, init) {
        const value = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
        const target = resolve(value);
        if (!target) return original(input, init);
        const request = new Request(typeof input === 'string' || input instanceof URL ? target : input, init);
        const controller = new AbortController();
        const abort = () => controller.abort(request.signal.reason);
        request.signal.addEventListener('abort', abort, {once:true});
        if (request.signal.aborted) abort();
        let timer;
        try {
            const body = /^(GET|HEAD)$/.test(request.method) ? null : new Uint8Array(await request.clone().arrayBuffer());
            const headers = {};
            for (const key of ['content-type','accept']) if (request.headers.has(key)) headers[key]=request.headers.get(key);
            const options={method:request.method,body,headers,signal:controller.signal};
            const attempt = async operation => {
                controller.signal.throwIfAborted();
                const deadline=new AbortController();
                const connectionTimer=setTimeout(()=>deadline.abort(),15000);
                try {
                const response=await operation(AbortSignal.any([controller.signal,deadline.signal]));
                if (!response.ok) { await response.body?.cancel(); throw new Error('Level service unavailable'); }
                // The working upstream bridges label valid level data text/html.
                if(!response.body) return response;
                const reader=response.body.getReader();
                const first=await reader.read();
                const text=first.value ? new TextDecoder().decode(first.value.subarray(0,512)) : '';
                if (/^\s*(?:<!doctype|<html|<head|<body)/i.test(text)) {await reader.cancel();throw new Error('Level service returned an error page');}
                // Return headers and stream promptly: the native port has a short
                // inactivity deadline and must see progress during big downloads.
                let initial=true;
                const stream=new ReadableStream({
                    async pull(output) {
                        try {
                            const chunk=initial ? first : await reader.read();initial=false;
                            if(chunk.done)output.close();else output.enqueue(chunk.value);
                        } catch(error) {output.error(error);}
                    },
                    cancel(reason){return reader.cancel(reason);}
                });
                return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
                } finally {clearTimeout(connectionTimer);}
            };
            const connect = async () => {
                for (const url of routes(target)) {
                    try { return await attempt(signal => original(url, {...options,signal})); } catch(error) {if(controller.signal.aborted)throw error;}
                }
                // P8y frames already tunnel fetch; their parent may be cross-origin.
                if (typeof parent.__gbGdNetworkFetch === 'function') return attempt(signal => parent.__gbGdNetworkFetch(target,{...options,signal}));
                throw new Error('Level routes unavailable');
            };
            const response=await Promise.race([
                connect(),
                new Promise((_,reject) => { timer=setTimeout(() => {controller.abort();reject(new Error('Level connection timed out'));},45000); })
            ]);
            return new Response(response.body, {status:response.status,statusText:response.statusText,headers:response.headers});
        } catch (error) {
            if (request.signal.aborted) throw error;
            return original(input, init);
        } finally {
            clearTimeout(timer);
            request.signal.removeEventListener('abort', abort);
        }
    };

}

export function withGdNetwork(html, identity) {
    if ((identity.provider || 'gn') !== 'gn' || String(identity.id) !== '868') return html;
    const script = '<script>(' + installGdNetwork.toString() + ')(' + resolveGdNetworkURL.toString() + ',' + gdNetworkRoutes.toString() + ');</script>';
    const first = html.search(/<script\b/i);
    return first < 0 ? script + html : html.slice(0,first) + script + html.slice(first);
}
