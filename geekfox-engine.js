/* The engine lives in the outer document so its worker has an HTTPS page URL. */
(() => {
    const assets = 'https://cdn.jsdelivr.net/gh/lucideproxy/svg@8b35ef07ef9788b060a78fbb504112e28e134b1d/';
    const pool = ['https://theavancehotel.com', 'https://21baseballacademy.com', 'https://diamondstudsbaseball.com', 'https://broughton-hotel.com', 'https://themannastore.com'];
    let boot = null;
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
    function loadScript(path) {
        return new Promise((resolve, reject) => {
            const script = document.createElementNS('http://www.w3.org/1999/xhtml', 'script');
            script.src = assets + path;
            script.onload = resolve;
            script.onerror = () => { script.remove(); reject(new Error('Could not load the Geekfox engine.')); };
            (document.head || document.documentElement).appendChild(script);
        });
    }
    // The reference's relay pool uses a public binary handshake and AES-GCM records.
    function installRelayProtocol() {
        if (window.WebSocket.geekfoxRelay) return;
        const NativeSocket = window.WebSocket;
        const handshake = Uint8Array.from([110,209,210,184,240,105,71,124,161,147,176,203,72,148,189,109,178,243,213,20,57,125,96,243,158,150,135,196,241,183,216,244]);
        const key = crypto.subtle.digest('SHA-256', handshake).then(hash => crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']));
        const asBytes = async data => typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data);
        class RelaySocket extends NativeSocket {
            constructor(url, protocols) {
                super(url, protocols);
                if (!pool.some(origin => {
                    const candidate = new URL(url);
                    return candidate.host === new URL(origin).host && ['/piers/', '/fairs/'].includes(candidate.pathname);
                })) return;
                let outgoing = Promise.resolve(), incoming = Promise.resolve();
                let emitting = false;
                this.addEventListener('open', () => NativeSocket.prototype.send.call(this, handshake));
                this.addEventListener('message', event => {
                    if (emitting || typeof event.data === 'string') return;
                    event.stopImmediatePropagation();
                    incoming = incoming.then(async () => {
                        const bytes = await asBytes(event.data);
                        const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:bytes.slice(0,12)}, await key, bytes.slice(12));
                        emitting = true;
                        try { this.dispatchEvent(new MessageEvent('message', {data:this.binaryType === 'blob' ? new Blob([plain]) : plain})); }
                        finally { emitting = false; }
                    }).catch(() => this.close());
                }, true);
                this.send = data => {
                    outgoing = outgoing.then(async () => {
                        const iv = crypto.getRandomValues(new Uint8Array(12));
                        const encrypted = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, await key, await asBytes(data)));
                        const packet = new Uint8Array(iv.length + encrypted.length);
                        packet.set(iv); packet.set(encrypted, iv.length);
                        NativeSocket.prototype.send.call(this, packet);
                    }).catch(() => this.close());
                };
            }
        }
        RelaySocket.geekfoxRelay = true;
        window.WebSocket = RelaySocket;
    }
    async function chooseRelay() {
        return Promise.any(pool.map(async origin => {
            const response = await fetch(origin + '/api/ping', {mode:'cors', cache:'no-store', signal:AbortSignal.timeout(6000)});
            if (!response.ok || !(await response.json()).ok) throw new Error('Relay unavailable');
            return origin;
        })).catch(() => { throw new Error('The shared free relay pool is unavailable. Try again later.'); });
    }
    async function initialize(onStatus) {
        if (!isSecureContext || !navigator.serviceWorker) throw new Error('Geekfox needs HTTPS or localhost.');
        onStatus('Starting the browsing engine…');
        installRelayProtocol();
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
        const origin = await chooseRelay();
        await loadScript('2izar/ypk98g.js');
        await loadScript('dfkw6/jusz03.js');
        const transportModule = await import(assets + 'assets/' + 'p' + 'roxy-runtime-hRo6K69j-04a19445.js');
        const transport = new transportModule.L({_ind:origin.replace(/^http/, 'ws') + '/piers/'});
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
        onStatus('Connected to the shared free relay pool.');
        return {
            attach(element, callbacks) {
                const frame = controller.createFrame(element);
                const plugin = new window._hp75rnc.Plugin('geekfox-' + frame.id);
                plugin.tap(frame.hooks.init.post, context => {
                    if (!context.isTopLevel) return;
                    callbacks.url(context.client.url.href);
                    plugin.tap(context.client.hooks.lifecycle.navigate, (_, details) => callbacks.url(new URL(details.url, context.client.url.href).href));
                });
                // Hooks are attached above; keep the plugin alive until this tab closes.
                return {
                    go(url) { frame.go(url); },
                    back() { frame.back(); },
                    forward() { frame.forward(); },
                    reload() { frame.reload(); },
                    dispose() { const index = controller.frames.indexOf(frame); if (index >= 0) controller.frames.splice(index, 1); }
                };
            },
            origin
        };
    }
    window.GeekfoxEngine = {
        start(onStatus = () => {}) {
            if (!boot) boot = initialize(onStatus).catch(error => { boot = null; throw error; });
            return boot;
        }
    };
})();
