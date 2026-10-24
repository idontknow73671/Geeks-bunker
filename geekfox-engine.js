/* The engine lives in the outer document so its worker has an HTTPS page URL. */
(() => {
    const assets = 'https://cdn.jsdelivr.net/gh/lucideproxy/svg@8b35ef07ef9788b060a78fbb504112e28e134b1d/';
    const connections = [
        ['krem','Krem','https://api.spf50krem.com'],
        ['planta','Planta','https://api.tuplantaforma.com'],
        ['foto','Foto','https://api.fotograflar.com'],
        ['shor','Shor','https://api.shor.ch'],
        ['tenspot','Tenspot','https://api.tenspot.net'],
        ['rym','RYM','https://api.rymconstrucciones.cl'],
        ['bsfa','BSFA','https://api.bsfa.info'],
        ['jure','Jure','https://api.jurematoz.com']
    ].map(([id,label,origin]) => ({id,label,origin}));
    let boot = null;
    // The SVG origin may deny storage; browsing still works for this visit.
    const savedConnection = () => { try { const id=localStorage.getItem('gbGeekfoxConnection'); return connections.some(item => item.id === id) ? id : 'auto'; } catch { return 'auto'; } };
    function createConnections(Transport, onStatus, fixedOrigin = null) {
        const candidates = fixedOrigin ? [{id:'media',label:'Media',origin:fixedOrigin}] : connections;
        let preferred = savedConnection(), current = null, switching = null;
        const sessions = new Map(), failed = new Map(), listeners = new Set();
        const notify = text => { onStatus(text); for (const listener of listeners) listener({text,id:current?.id || '',label:current?.label || '',preferred}); };
        async function session(candidate) {
            if (!sessions.has(candidate.id)) sessions.set(candidate.id, (async () => {
                const value = new Transport({_ind:candidate.origin.replace(/^http/,'ws') + '/wisp/'});
                await timeout(value.init(),10000,'Connection timed out.');
                return value;
            })().catch(error => { sessions.delete(candidate.id); throw error; }));
            return sessions.get(candidate.id);
        }
        const order = () => [...candidates].sort((a,b) => (b.id === preferred) - (a.id === preferred));
        async function select(excluded = new Set()) {
            if (switching) { await switching; if (current && !excluded.has(current.id)) return current; }
            switching = (async () => {
                const ordered = order().filter(item => !excluded.has(item.id));
                // Give recently failed connections a short cooldown, but never permanently disable one.
                const available = ordered.filter(item => Date.now() - (failed.get(item.id) || 0) > 30000);
                for (const candidate of available.length ? available : ordered) {
                    notify('Checking ' + candidate.label + ' connection…');
                    try {
                        const transport = await session(candidate);
                        const response = await transport.request(new URL('https://www.gstatic.com/generate_204'),'GET',null,[],AbortSignal.timeout(10000));
                        await response.body?.cancel();
                        if (response.status < 200 || response.status >= 400) throw new Error('Connection check failed.');
                        current = candidate;
                        adapter.activeTransport = transport;
                        notify('Connected · ' + candidate.label + (preferred === 'auto' ? ' · Automatic fallback' : ' · Fallback enabled'));
                        return candidate;
                    } catch { failed.set(candidate.id,Date.now()); sessions.delete(candidate.id); }
                }
                current = null;
                notify('No p8y connection is responding. Try Reconnect in a moment.');
                throw new Error('No p8y connection is responding. Try Reconnect in a moment.');
            })();
            try { return await switching; } finally { switching = null; }
        }
        const adapter = {
            ready:false,
            async init() { await select(); adapter.ready = true; },
            async request(url,method,body,headers,signal) {
                const safe = ['GET','HEAD'].includes(method.toUpperCase());
                const attempted = new Set();
                while (attempted.size < candidates.length) {
                    if (signal?.aborted) throw signal.reason;
                    const selected = current && !attempted.has(current.id) ? current : await select(attempted);
                    attempted.add(selected.id);
                    try {
                        const transport = await session(selected);
                        const deadline = safe ? AbortSignal.timeout(15000) : null;
                        const requestSignal = signal && deadline ? AbortSignal.any([signal,deadline]) : signal || deadline;
                        // HTTP errors belong to the destination. Only transport failures trigger a retry.
                        return await transport.request(url,method,body,headers,requestSignal);
                    } catch (error) {
                        if (signal?.aborted) throw error;
                        failed.set(selected.id,Date.now()); sessions.delete(selected.id);
                        if (current?.id === selected.id) current = null;
                        if (!safe || fixedOrigin) throw error; // Never send a form submission twice.
                        notify(selected.label + ' disconnected. Trying another connection…');
                    }
                }
                notify('All p8y connections failed for this website. Try another address or Reconnect.');
                throw new Error('All p8y connections failed for this website. Try another address or Reconnect.');
            },
            connect(...args) {
                if (!current) throw new Error('Reconnect before opening a live connection.');
                // init always resolves the cached session before a page can request a socket.
                return adapter.activeTransport.connect(...args);
            },
            activeTransport:null
        };
        return {
            adapter,
            get origin() { return current?.origin || ''; },
            subscribe(listener) { listeners.add(listener); listener({text:current ? 'Connected · ' + current.label : 'Choose a connection or use Automatic.',id:current?.id || '',label:current?.label || '',preferred}); return () => listeners.delete(listener); },
            async change(id = preferred) {
                preferred = connections.some(item => item.id === id) ? id : 'auto';
                if (!fixedOrigin) try { localStorage.setItem('gbGeekfoxConnection',preferred); } catch {}
                if (switching) await switching.catch(() => {});
                current = null; failed.clear(); sessions.clear();
                await select(); adapter.ready = true;
            }
        };
    }
    const identities = {
        gecko: {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',platform:'Win32',vendor:''},
        chromium: {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',platform:'Win32',vendor:'Google Inc.'}
    };
    function applyIdentityHeaders(init, identity) {
        if (!identity) return;
        const headers = new Headers(init.headers);
        for (const name of [...headers.keys()]) if (name.toLowerCase().startsWith('sec-ch-ua')) headers.delete(name);
        headers.set('User-Agent',identity.userAgent);
        init.headers = [...headers.entries()];
    }
    const timeout = (promise, ms, message) => {
        let timer;
        return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]).finally(() => clearTimeout(timer));
    };
    const codec = {
        encode: value => {
            const bytes = new TextEncoder().encode(value);
            return btoa(Array.from(bytes, n => String.fromCharCode(n)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        },
        decode: value => {
            const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
            return new TextDecoder().decode(Uint8Array.from(raw, n => n.charCodeAt(0)));
        }
    };
    const scripts = new Map();
    function loadScript(path) {
        if (scripts.has(path)) return scripts.get(path);
        const loading = new Promise((resolve, reject) => {
            const script = document.createElementNS('http://www.w3.org/1999/xhtml', 'script');
            script.src = assets + path;
            script.onload = resolve;
            script.onerror = () => { script.remove(); reject(new Error('Could not load the Geekfox engine.')); };
            (document.head || document.documentElement).appendChild(script);
        }).catch(error => { scripts.delete(path); throw error; });
        scripts.set(path,loading);
        return loading;
    }
    async function initialize(onStatus, mediaOrigin = null) {
        if (!isSecureContext || !navigator.serviceWorker) throw new Error('Geekfox needs HTTPS or localhost.');
        onStatus('Starting the browsing engine…');
        const base = new URL('.', location.href);
        const registration = await navigator.serviceWorker.register(new URL('geekfox-worker.js', base), {scope:base.pathname});
        const worker = await timeout(new Promise((resolve, reject) => {
            const candidate = registration.installing || registration.waiting || registration.active;
            if (!candidate) return reject(new Error('The Geekfox worker could not start.'));
            const check = () => {
                if (candidate.state === 'activated') resolve(candidate);
                if (candidate.state === 'redundant') reject(new Error('The Geekfox worker could not be installed.'));
            };
            candidate.addEventListener('statechange', check); check();
        }), 15000, 'The Geekfox worker did not activate. Publish geekfox-worker.js beside index.svg.');
        await loadScript('2izar/ypk98g.js');
        await loadScript('dfkw6/jusz03.js');
        // Separate module instances keep media and browser connection settings independent.
        const transportModule = await import(assets + 'assets/' + 'p' + 'roxy-runtime-hRo6K69j-04a19445.js?geekfox=' + encodeURIComponent(mediaOrigin || 'browsing'));
        const network = createConnections(transportModule.L,onStatus,mediaOrigin);
        const transport = network.adapter;
        await transport.init();
        const controller = new window._zm9ikyq.Controller({
            serviceworker:worker,
            transport,
            config:{
                prefix:base.pathname + 'geekfox-content/',
                codec,
                _qst476vPath:assets + '2izar/ypk98g.js',
                wasmPath:assets + '2izar/cr703b.wasm',
                injectPath:assets + 'dfkw6/b4s18g.js'
            },
            _qst476vConfig:{flags:{sourcemaps:false, debugTrampolines:false, debugSourceURL:false, rewriterLogs:false}}
        });
        await timeout(controller.wait(), 20000, 'The browsing engine could not connect.');
        let reconnecting = null, confirmConnection = null;
        const ready = controller.methods.ready;
        controller.methods.ready = async (...args) => { await ready(...args); confirmConnection?.(); confirmConnection=null; };
        function reconnect() {
            if (!reconnecting) reconnecting = timeout(new Promise(resolve => {
                confirmConnection=resolve;
                // A worker may have been replaced or suspended since the last page.
                controller.serviceWorkerController=registration.active || worker;
                controller.setupMessagePort();
            }),10000,'The Geekfox worker could not reconnect. Reload the dashboard.').finally(()=>{reconnecting=null;});
            return reconnecting;
        }
        return {
            attach(element, callbacks, options = {}) {
                const frame = controller.createFrame(element);
                const plugin = new window._hp75rnc.Plugin('geekfox-' + frame.id);
                const identity = () => identities[options.getProfile?.()] || null;
                plugin.tap(frame.hooks.fetch.request, (_,details) => applyIdentityHeaders(details.init,identity()));
                plugin.tap(frame.hooks.init.post, context => {
                    const selectedIdentity = identity();
                    if (selectedIdentity) {
                        // Identification compatibility only; the host renderer is unchanged.
                        for (const [name,value] of Object.entries({userAgent:selectedIdentity.userAgent,appVersion:selectedIdentity.userAgent.slice(8),platform:selectedIdentity.platform,vendor:selectedIdentity.vendor,userAgentData:undefined})) {
                            context.client.Trap('Navigator.prototype.' + name,{get:() => value});
                        }
                    }
                    if (!context.isTopLevel) return;
                    lastURL=context.client.url.href;
                    callbacks.url(lastURL);
                    plugin.tap(context.client.hooks.lifecycle.navigate, (_, details) => { lastURL=new URL(details.url, context.client.url.href).href; callbacks.url(lastURL); });
                });
                // Hooks are attached above; keep the plugin alive until this tab closes.
                let disposed=false, navigation=0, lastURL='';
                return {
                    go(url) {
                        lastURL=url;
                        const request=++navigation;
                        reconnect().then(()=>{if(!disposed && request===navigation)frame.go(url);}).catch(error=>{if(!disposed)callbacks.error?.(error);});
                    },
                    back() { frame.back(); },
                    forward() { frame.forward(); },
                    reload() { if (lastURL) this.go(lastURL); },
                    dispose() { disposed=true; const index = controller.frames.indexOf(frame); if (index >= 0) controller.frames.splice(index, 1); }
                };
            },
            get origin() { return network.origin; },
            subscribe:network.subscribe,
            changeConnection:network.change
        };
    }
    const mediaBoots=new Map();
    window.GeekfoxEngine = {
        get preference() { return savedConnection(); },
        connections:connections.map(({id,label}) => ({id,label})),
        startMedia(origin,onStatus=()=>{}) {
            if (!['https://api.spf50krem.com','https://api.tuplantaforma.com','https://api.fotograflar.com'].includes(origin)) return Promise.reject(new Error('Unsupported media connection.'));
            if(!mediaBoots.has(origin))mediaBoots.set(origin,initialize(onStatus,origin).catch(error=>{mediaBoots.delete(origin);throw error;}));
            return mediaBoots.get(origin);
        },
        start(onStatus = () => {}) {
            if (!boot) boot = initialize(onStatus).catch(error => { boot = null; throw error; });
            return boot;
        }
    };
})();
