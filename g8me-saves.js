/* Runs before the title's scripts so storage keys stay isolated and stable. */
function installG8meStorage(identity) {
    const prefix = 'gbG8meSave:' + identity.provider + ':' + identity.id + ':';
    let backing, ready = false;
    let flushTimer;
    const pendingWrites = new Set();
    const visible = key => key !== '__check__' && key !== '__cleared__' && !key.startsWith('__removed__:');
    const notify = (state, detail = '') => {
        parent.postMessage({type:'gb-g8me-save', id:String(identity.id), provider:identity.provider, state, detail}, '*');
    };
    try {
        backing = window.localStorage;
        const probe = prefix + '__check__';
        backing.setItem(probe, '1'); backing.removeItem(probe); ready = true;
    } catch { notify('unavailable', 'Browser storage is unavailable.'); }
    function checkpoint() {
        clearTimeout(flushTimer);
        try {
            const records = JSON.parse(backing.getItem('gbG8meSaveIndex') || '{}');
            records[identity.provider + ':' + identity.id] = {name:identity.name, updatedAt:Date.now()};
            backing.setItem('gbG8meSaveIndex', JSON.stringify(records));
        } catch {}
        notify('saved');
    }
    function changed() {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(checkpoint, 200);
    }
    const keys = () => {
        const result = [];
        for (let i = 0; i < backing.length; i++) {
            const key = backing.key(i);
            if (key?.startsWith(prefix)) result.push(key.slice(prefix.length));
        }
        return result;
    };
    if (ready) {
        const methods = {
            getItem(key) {
                key = String(key);
                const stored = backing.getItem(prefix + key);
                if (stored !== null) return stored;
                // Earlier versions shared native storage. Import requested legacy
                // keys on first read without clearing the original data.
                if (backing.getItem(prefix + '__cleared__') || key.startsWith('gb')) return null;
                const legacy = backing.getItem(key);
                if (legacy !== null) { try { backing.setItem(prefix + key, legacy); } catch {} }
                return legacy;
            },
            setItem(key, value) {
                try { backing.setItem(prefix + String(key), String(value)); changed(); }
                catch(error) { notify('unavailable','Browser storage is full or disabled.'); throw error; }
            },
            removeItem(key) {
                backing.removeItem(prefix + String(key));
                // A deletion must not revive data from the legacy shared area.
                backing.setItem(prefix + '__removed__:' + String(key), '1');
                changed();
            },
            clear() {
                keys().forEach(key => backing.removeItem(prefix + key));
                backing.setItem(prefix + '__cleared__', '1'); changed();
            },
            key(index) { index = Number(index); return index < 0 ? null : keys().filter(visible)[index] ?? null; }
        };
        const readItem = methods.getItem;
        methods.getItem = key => backing.getItem(prefix + '__removed__:' + String(key)) ? null : readItem(key);
        const writeItem = methods.setItem;
        methods.setItem = (key,value) => { backing.removeItem(prefix + '__removed__:' + String(key)); writeItem(key,value); };
        const facade = new Proxy(Object.create(Storage.prototype), {
            get(_, key) {
                if (key === 'length') return keys().filter(visible).length;
                if (Object.prototype.hasOwnProperty.call(methods,key)) return methods[key];
                if (key === Symbol.toStringTag) return 'Storage';
                if (typeof key === 'symbol') return undefined;
                if (key in Object.prototype) return typeof Object.prototype[key] === 'function' ? Object.prototype[key].bind(facade) : Object.prototype[key];
                return methods.getItem(key) ?? undefined;
            },
            set(_, key,value) { methods.setItem(key,value); return true; },
            deleteProperty(_, key) { methods.removeItem(key); return true; },
            ownKeys() { return keys().filter(visible); },
            has(_, key) { return key === 'length' || Object.prototype.hasOwnProperty.call(methods,key) || methods.getItem(key) !== null; },
            getOwnPropertyDescriptor(_, key) {
                const value = methods.getItem(key);
                return value === null ? undefined : {configurable:true,enumerable:true,writable:true,value};
            }
        });
        try {
            Object.defineProperty(window,'localStorage',{configurable:true,get:() => facade});
            for (const name of Object.keys(methods)) {
                const native = Storage.prototype[name];
                if (typeof native !== 'function') continue;
                Storage.prototype[name] = function(...args) {
                    return this === facade ? methods[name](...args) : native.apply(this,args);
                };
            }
        }
        catch { ready = false; notify('unavailable','This browser could not isolate title storage.'); }
    }
    // IndexedDB stays native, preserving existing Unity/IDBFS databases.
    // Report completed write transactions instead of claiming unsaved RAM is saved.
    if (window.IDBDatabase) {
        const transaction = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function(...args) {
            const result = transaction.apply(this,args);
            if (result.mode === 'readwrite') {
                let finish;
                const done = new Promise(resolve => { finish = resolve; });
                pendingWrites.add(done);
                result.addEventListener('complete',() => { pendingWrites.delete(done); checkpoint(); finish(); },{once:true});
                result.addEventListener('abort',() => { pendingWrites.delete(done); finish(); },{once:true});
            }
            return result;
        };
    }
    async function flush() {
        const fs = window.FS || window.Module?.FS || window.unityInstance?.Module?.FS;
        if (fs?.syncfs) await new Promise(resolve => {
            const timer = setTimeout(resolve,1200);
            try { fs.syncfs(false, error => { clearTimeout(timer); if (error) notify('unavailable','Filesystem save failed.'); resolve(); }); }
            catch { clearTimeout(timer); resolve(); }
        });
        if (pendingWrites.size) await new Promise(resolve => {
            const timer = setTimeout(resolve,1200);
            Promise.all([...pendingWrites]).then(() => { clearTimeout(timer); resolve(); });
        });
        if (ready && flushTimer) checkpoint();
    }
    window.__gbG8meSave = {flush, ready};
    if (ready) notify('ready');
}

function install2048Resume() {
    const Manager = window.GameManager;
    if (!Manager || !window.Grid || !window.Tile || !window.AI) return;
    const key = '__gb2048ResumeV1';
    let saved = null, initial = true, restoring = true;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
    const setup = Manager.prototype.setup;
    const actuate = Manager.prototype.actuate;
    Manager.prototype.actuate = function(...args) {
        const result = actuate.apply(this,args);
        if (!restoring && this.grid?.cells) {
            try {
                localStorage.setItem(key,JSON.stringify({
                    size:this.size, cells:this.grid.cells.map(column => column.map(tile => tile?.value || null)),
                    score:this.score, over:this.over, won:this.won, playerTurn:this.grid.playerTurn
                }));
            } catch {}
        }
        return result;
    };
    Manager.prototype.setup = function(...args) {
        const restore = initial; initial = false; restoring = restore;
        setup.apply(this,args);
        if (restore && saved?.size === this.size && Array.isArray(saved.cells) &&
            saved.cells.length === this.size && saved.cells.every(column => Array.isArray(column) &&
                column.length === this.size && column.every(value => value === null || Number.isFinite(value) && value >= 2))) {
            this.grid = new window.Grid(this.size);
            saved.cells.forEach((column,x) => column.forEach((value,y) => { if (value) this.grid.insertTile(new window.Tile({x,y},value)); }));
            this.grid.playerTurn = saved.playerTurn !== false;
            this.ai = new window.AI(this.grid);
            this.score = Number(saved.score) || 0; this.over = !!saved.over; this.won = !!saved.won; this.running = false;
        }
        restoring = false;
        this.actuate();
    };
}

export function withG8meSaves(html, identity) {
    const data = JSON.stringify({provider:identity.provider || 'gn',id:String(identity.id),name:identity.name})
        .replace(/</g,'\\u003c').replace(/>/g,'\\u003e');
    const script = '<script>(' + installG8meStorage.toString() + ')(' + data + ');</script>';
    // This catalog entry has no native save feature. Install its board adapter
    // after its constructors load and before the application creates a board.
    if ((identity.provider || 'gn') === 'gn' && String(identity.id) === '114') {
        const adapter = '<script>(' + install2048Resume.toString() + ')();</script>';
        html = html.replace(/<script\b[^>]*src=["'][^"']*js\/application\.js[^"']*["'][^>]*>/i, tag => adapter + tag);
    }
    // Some titles execute scripts before their explicit head.
    const head = /<head\b[^>]*>/i.exec(html);
    const firstScript = html.search(/<script\b/i);
    if (head && (firstScript < 0 || head.index < firstScript)) return html.replace(/<head\b[^>]*>/i, value => value + script);
    if (firstScript >= 0) return html.slice(0,firstScript) + script + html.slice(firstScript);
    if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, root => root + '<head>' + script + '</head>');
    return script + html;
}

export async function flushG8meFrame(frame) {
    try {
        const child = frame?.contentWindow;
        if (!child?.__gbG8meSave) return;
        // Let titles that save on leave commit their current state first.
        child.dispatchEvent(new child.Event('pagehide'));
        child.dispatchEvent(new child.Event('beforeunload'));
        await child.__gbG8meSave.flush();
    } catch {}
}
