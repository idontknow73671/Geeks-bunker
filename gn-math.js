import { prepareHalfLife2Document, fetchHalfLife2Asset, prepareHalfLife2RuntimeResponse } from "./hl2-startup.js";
import { createG8meDeveloper, withG8meDeveloper } from "./g8me-developer.js";
import { resolveGdNetworkURL, gdNetworkRoutes, withGdNetwork } from "./g8me-network.js";
import { watchG8meStartup, isFivePlayLoader, prepareFivePlayLoader } from "./g8me-startup.js";
import { createG8meGuard, g8meFrameSandbox } from "./g8me-guard.js";
import { captureG8meBackup, validateG8meBackup, restoreG8meBackup } from "./g8me-backups.js";
import { initializeG8meAutoClicker } from "./g8me-autoclicker.js";
import { attachG8meDisplay } from "./g8me-display.js";
import { loadLuminCatalog, loadLuminCover, resolveLuminGame } from "./lumin.js";
import { withG8meSaves, flushG8meFrame } from "./g8me-saves.js";
// Prefer the publisher; keep CDN mirrors as fallbacks without changing save IDs.
const SOURCES = [
    {
        catalog: 'https://raw.githubusercontent.com/gn-math/assets/main/zones.json',
        html: 'https://raw.githubusercontent.com/gn-math/html/main/',
        covers: 'https://raw.githubusercontent.com/gn-math/covers/main/'
    },
    {
        catalog: 'https://cdn.jsdelivr.net/gh/freebuisness/assets@main/zones.json',
        html: 'https://cdn.jsdelivr.net/gh/freebuisness/html@main/',
        covers: 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main/'
    }
];
const PAGE_SIZE = 60;

async function fetchWithTimeout(url, options = {}) {
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, options.timeout || 20000);
    try {
        const response = await fetch(url, { signal: timeout.signal, cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // Consume the body before clearing the timeout, including large g8mes.
        return await response.text();
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
    }
}

function gameDocument(html, url) {
    // Some catalog g8mes use a Google Module / CDATA wrapper.
    const wrapped = html.match(/<Content[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/Content>/i);
    if (wrapped) html = wrapped[1];
    else if (/^\s*<Module\b/i.test(html)) {
        const start = html.search(/<!doctype html|<html\b/i);
        if (start >= 0) html = html.slice(start);
    }
    if (!/<(?:html|head|body|script|div|canvas|!doctype)\b/i.test(html)) {
        throw new Error('The g8me source did not contain an HTML document.');
    }
    if (/<base\b/i.test(html)) return html;
    const base = new URL('.', url).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const element = `<base href="${base}">`;
    if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, head => head + element);
    if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, root => root + `<head>${element}</head>`);
    return element + html;
}

export function extraG8mes() {
    return [
        {id:'fiveplay',name:'FivePlay',provider:'web',art:'5',viaP8y:true,threaded:true,urls:['https://fiveplay.lol/?low=1&cores=2&res=910x570&fps=30']},
        {id:'half-life-2',name:'Half-Life 2',provider:'web',art:'λ²',viaP8y:true,threaded:true,urls:['https://alexboops.github.io/half-life-2-port/']}
    ];
}
export async function g8meP8yURL(game,resolveLumin=resolveLuminGame,mirror=0) {
    const urls=game.p8yUrls || game.urls;
    const url=game.provider==='lumin'?await resolveLumin(game.id):urls?.[mirror%urls.length];
    const target=new URL(url);if(target.protocol!=='https:')throw Error('This g8me needs a valid HTTPS address.');return target.href;
}

export function initializeGnMath({ rebuildButtons, onOpen, onClose, playSound = () => {} }) {
    const grid = document.getElementById('g8mes-grid');
    const search = document.getElementById('g8me-search-input');
    const catalogStatus = document.getElementById('g8me-catalog-status');
    const catalogRetry = document.getElementById('g8me-retry-btn');
    const more = document.getElementById('g8me-load-more-btn');
    const player = document.getElementById('gn-game-player');
    const title = document.getElementById('gn-player-title');
    const host = document.getElementById('gn-frame-host');
    const message = document.getElementById('gn-player-message');
    const status = document.getElementById('gn-player-status');
    const retry = document.getElementById('gn-retry-btn');
    const close = document.getElementById('gn-close-btn');
    const fullscreen = document.getElementById('gn-fullscreen-btn');
    const saveStatus = document.getElementById('gn-save-status');
    if (!grid || !player) return;
    window.__gbGdNetworkFetch = async (url, options) => {
        const target = resolveGdNetworkURL(url);
        if (!target) throw new Error('Unsupported level service.');
        const engine = window.parent.GeekfoxEngine || window.GeekfoxEngine;
        if (!engine) throw new Error('Geekfox is unavailable.');
        const runtime = await engine.startG8mes();
        for (const route of [...gdNetworkRoutes(target),target]) {
            options.signal?.throwIfAborted();
            try {
                const response=await runtime.fetch(route,options);
                if(response.ok && !/^\s*(?:<!doctype|<html|<head|<body)/i.test(await response.clone().text())) return response;
                await response.body?.cancel();
            } catch(error) { if(options.signal?.aborted) throw error; }
        }
        throw new Error('The level services are unavailable.');
    };

    const developer=createG8meDeveloper({button:document.getElementById('gn-developer-btn'),panel:document.getElementById('gn-developer-panel'),reload:()=>{if(activeGame)openGame(activeGame,null,activeP8y,activeMirror);}});
    const displayPanel=document.getElementById('gn-display-controls'),displayButton=document.getElementById('gn-display-btn');
    const resolution=document.getElementById('gn-resolution'),displayWidth=document.getElementById('gn-display-width'),displayHeight=document.getElementById('gn-display-height'),displayStretch=document.getElementById('gn-display-stretch');
    let displaySettings={};
    try{const saved=JSON.parse(localStorage.getItem('gb-g8me-display')||'{}');if(saved.width>=320&&saved.width<=7680&&saved.height>=240&&saved.height<=4320)displaySettings={width:Math.round(saved.width),height:Math.round(saved.height)};displaySettings.stretch=saved.stretch===true;}catch{}
    resolution.value=displaySettings.width?([...resolution.options].some(o=>o.value===displaySettings.width+'x'+displaySettings.height)?displaySettings.width+'x'+displaySettings.height:'custom'):'auto';
    displayWidth.value=displaySettings.width||1280;displayHeight.value=displaySettings.height||720;displayStretch.checked=!!displaySettings.stretch;
    function updateResolution(){const automatic=resolution.value==='auto';displayWidth.disabled=automatic;displayHeight.disabled=automatic;if(!automatic&&resolution.value!=='custom'){const [w,h]=resolution.value.split('x');displayWidth.value=w;displayHeight.value=h;}}
    updateResolution();resolution.addEventListener('change',updateResolution);
    for(const input of [displayWidth,displayHeight])input.addEventListener('input',()=>{resolution.value='custom';});
    displayButton.addEventListener('click',()=>{displayPanel.classList.toggle('hidden');displayButton.setAttribute('aria-expanded',String(!displayPanel.classList.contains('hidden')));});
    displayPanel.addEventListener('submit',event=>{event.preventDefault();if(!displayPanel.reportValidity())return;displaySettings={stretch:displayStretch.checked};if(resolution.value!=='auto')Object.assign(displaySettings,{width:Math.round(Number(displayWidth.value)),height:Math.round(Number(displayHeight.value))});try{localStorage.setItem('gb-g8me-display',JSON.stringify(displaySettings));}catch{}host.dispatchEvent(new Event('g8me-display-change'));});
    const autoClicker=initializeG8meAutoClicker({host,player});
    const g8meGuard=createG8meGuard({button:document.getElementById('gn-adblock-btn'),status:document.getElementById('gn-adblock-status'),reload:()=>{if(activeGame)openGame(activeGame,null,activeP8y);}});
    let source = 'gn';
    let catalogGeneration = 0;
    const catalogs = new Map();
    let g8mes = [];
    let matches = [];
    let shown = 0;
    let activeGame = null;
    let activeRequest = null;
    let generation = 0;
    let returnFocus = null;
    let closing = false, activeHandle=null, activeP8y=false, launchTimer=null,g8meRuntime=null,g8mePreference=null,activeMirror=0,stopRuntimeStatus=null,stopDisplay=null,stopClicker=null,stopStartupMonitor=null;
    const p8yLaunch=document.getElementById('gn-p8y-btn');
    const sound = playSound;
    const exitFullscreenOnEscape = event => {
        if (event.key === 'Escape' && document.fullscreenElement === player) {
            event.preventDefault();
            document.exitFullscreen().catch(() => {});
        }
    };
    document.addEventListener('keydown', exitFullscreenOnEscape, true);
    window.addEventListener('message', event => {
        const frame = host.querySelector('iframe'), data = event.data;
        if (!activeGame || event.source !== frame?.contentWindow || data?.type !== 'gb-g8me-save' ||
            data.id !== String(activeGame.id) || data.provider !== activeGame.provider) return;
        saveStatus.textContent = data.state === 'saving' ? 'Saving progress…' : data.state === 'saved' ? 'Progress saved on this browser' : data.state === 'ready' ?
            'Autosave ready' : data.detail || 'Browser storage unavailable';
    });

    function updateCount() {
        const query = search.value.trim();
        catalogStatus.textContent = `${matches.length.toLocaleString()}${query ? ' matching' : ''} ${source === 'lumin' ? 'Lumin' : 'GN Math'} g8mes · ${shown.toLocaleString()} shown`;
        more.classList.toggle('hidden', shown >= matches.length);
        more.querySelector('.button-text').textContent = `Load more g8mes (${Math.max(0, matches.length - shown).toLocaleString()} remaining)`;
    }

    function appendG8mes() {
        const end = Math.min(shown + PAGE_SIZE, matches.length);
        const fragment = document.createDocumentFragment();
        for (const game of matches.slice(shown, end)) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'gn-game-card';
            card.setAttribute('aria-label', `Play ${game.name}`);
            const art = document.createElement('span');
            art.className = 'gn-game-art';
            art.textContent = game.art || (game.provider === 'lumin' ? 'L' : 'GN');
            art.setAttribute('aria-hidden', 'true');
            const image = document.createElement('img');
            if (game.cover) image.src = game.cover;
            else if (game.imageToken) {
                const coverObserver = new IntersectionObserver(entries => {
                    if (!entries.some(entry => entry.isIntersecting)) return;
                    coverObserver.disconnect();
                    loadLuminCover(game.imageToken).then(url => { if (url && image.isConnected) image.src = url; }).catch(() => image.remove());
                }, { rootMargin: '180px' });
                coverObserver.observe(image);
            } else image.remove();
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
            let triedFallback = false;
            image.addEventListener('error', () => {
                if (!triedFallback && game.fallbackCover && game.fallbackCover !== game.cover) {
                    triedFallback = true;
                    image.src = game.fallbackCover;
                } else image.remove();
            });
            if (game.cover || game.imageToken) art.append(image);
            const label = document.createElement('span');
            label.className = 'gn-game-name';
            label.textContent = game.name;
            card.append(art, label);
            card.addEventListener('click', () => openGame(game, card));
            fragment.append(card);
        }
        shown = end;
        grid.append(fragment);
        updateCount();
        requestAnimationFrame(rebuildButtons);
    }

    function filterG8mes() {
        const query = search.value.trim().toLocaleLowerCase();
        matches = g8mes.filter(game => game.name.toLocaleLowerCase().includes(query));
        shown = 0;
        grid.replaceChildren();
        grid.scrollTop = 0;
        appendG8mes();
        if (g8mes.length && !matches.length) {
            const empty = document.createElement('p');
            empty.className = 'gn-empty';
            empty.textContent = 'No g8mes found.';
            grid.append(empty);
        }
    }

    async function fetchGnCatalog() {
        for (const endpoint of SOURCES) {
            try {
                const data = JSON.parse(await fetchWithTimeout(endpoint.catalog));
                if (!Array.isArray(data)) throw new Error('Invalid catalog');
                const playable = data.filter(game => Number(game.id) >= 0 && typeof game.name === 'string' &&
                    !game.name.startsWith('[!]') && typeof game.url === 'string' && game.url.startsWith('{HTML_URL}/'));
                if (!playable.length) throw new Error('Empty catalog');
                return playable.map(game => {
                    const path = game.url.slice('{HTML_URL}/'.length);
                    const coverPath = typeof game.cover === 'string' && game.cover.startsWith('{COVER_URL}/') ? game.cover.slice('{COVER_URL}/'.length) : `${game.id}.png`;
                    return {
                        id: game.id, name: game.name, provider: 'gn',
                        // P8y saves belong to the virtual origin. Retain its old
                        // source order even when direct mode prefers official HTML.
                        p8yUrls: [`https://cdn.jsdelivr.net/gh/freebuisness/html@main/${path}`,
                            `https://raw.githubusercontent.com/freebuisness/html/main/${path}`,
                            `https://raw.githubusercontent.com/gn-math/html/main/${path}`],
                        urls: [...new Set([new URL(path, endpoint.html).href, ...SOURCES.map(source => new URL(path, source.html).href),
                            `https://raw.githubusercontent.com/freebuisness/html/main/${path}`,
                            `https://raw.githubusercontent.com/gn-math/html/main/${path}`])],
                        cover: new URL(coverPath, endpoint.covers).href,
                        fallbackCover: `https://raw.githubusercontent.com/gn-math/covers/main/${coverPath}`
                    };
                });
            } catch (error) { console.warn('GN Math source unavailable:', error.message); }
        }
        throw new Error('Could not reach GN Math. Check your connection and try again.');
    }
    async function loadCatalog() {
        const version = ++catalogGeneration;
        const requestedSource = source;
        catalogRetry.classList.add('hidden'); more.classList.add('hidden');
        grid.setAttribute('aria-busy', 'true'); grid.replaceChildren();
        g8mes = []; matches = [];
        if(requestedSource==='gn'){g8mes=extraG8mes();filterG8mes();document.dispatchEvent(new CustomEvent('catalogready',{detail:{source:'gn',g8mes}}));}
        catalogStatus.textContent = `Loading ${source === 'lumin' ? 'Lumin' : 'GN Math'}...`;
        try {
            let catalog = catalogs.get(requestedSource);
            if(!catalog){
                if(requestedSource==='lumin')catalog=await loadLuminCatalog();
                else {let remote=[];try{remote=await fetchGnCatalog();}catch(error){catalogRetry.classList.remove('hidden');console.warn(error.message);}catalog=[...remote,...extraG8mes()];}
            }
            // Normalize names in catalog data before caching, searching, or saving recents.
            for (const g8me of catalog) g8me.name = g8me.name.replace(/\bg[a]mes\b/gi, word => word[0] === 'G' ? 'G8mes' : 'g8mes');
            if(requestedSource==='lumin'||catalog.some(game=>game.provider==='gn'))catalogs.set(requestedSource,catalog);
            document.dispatchEvent(new CustomEvent('catalogready', { detail: { source: requestedSource, g8mes: catalog } }));
            if (version !== catalogGeneration) return;
            g8mes = [...catalog].sort((a,b) => a.name.localeCompare(b.name, undefined, {sensitivity:'base',numeric:true}));
            grid.setAttribute('aria-busy','false'); filterG8mes();
        } catch (error) {
            if (version !== catalogGeneration) return;
            grid.setAttribute('aria-busy','false');
            catalogStatus.textContent = source === 'lumin' ? `Lumin is unavailable: ${error.message} GN Math is still available.` : error.message;
            catalogRetry.classList.remove('hidden');
        }
    }
    async function setSource(next) {
        source = next === 'lumin' ? 'lumin' : 'gn';
        search.value = '';
        document.querySelectorAll('[data-source]').forEach(button => { const selected = button.dataset.source === source; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
        await loadCatalog();
    }

    async function openGame(game, trigger = null, viaP8y = false,mirror=0) {
        viaP8y=viaP8y||!!game.viaP8y;
        if (closing) return;
        const displayName = game.name;
        sound();
        const wasClosed = player.classList.contains('hidden');
        if (trigger) returnFocus = trigger;
        activeRequest?.abort();
        const request = new AbortController();
        activeRequest = request;
        const current = ++generation;
        if (await flushG8meFrame(host.querySelector('iframe')) === false) return;
        if (current !== generation || request.signal.aborted) return;
        activeGame = game;
        developer.reset(game,viaP8y?'p8y':'direct');
        if(progressDownloadURL){URL.revokeObjectURL(progressDownloadURL);progressDownloadURL=null;}progressDownload.classList.add('hidden');progressDownload.removeAttribute('href');progressStatus.textContent='';
        activeHandle?.dispose();activeHandle=null;stopDisplay?.();stopDisplay=null;stopClicker?.();stopClicker=null;stopStartupMonitor?.();stopStartupMonitor=null;clearTimeout(launchTimer);activeP8y=viaP8y;activeMirror=mirror;stopRuntimeStatus?.();stopRuntimeStatus=null;
        p8yLaunch.textContent=game.viaP8y?'Reconnect p8y':viaP8y?'Use direct launch':'Launch through p8y';
        host.replaceChildren();
        saveStatus.textContent = viaP8y ? (game.threaded&&window.parent.crossOriginIsolated?'P8y · Threaded mode ready · Separate save storage':'P8y mode · Separate browser save storage') : game.provider === 'lumin' ? 'Provider-managed saves' : 'Preparing autosave…';
        title.textContent = displayName;
        player.classList.remove('hidden');
        document.querySelectorAll('.topbar, main, .dashboard-footer').forEach(element => { element.inert = true; });
        message.classList.remove('hidden');
        retry.classList.add('hidden');
        status.textContent = `Loading ${displayName}...`;
        if (wasClosed) onOpen();
        close.focus();
        requestAnimationFrame(rebuildButtons);
        await g8meGuard.prepare(viaP8y||game.provider==='gn');
        if(current!==generation||request.signal.aborted)return;
        let frameFailed=false;
        const mountFrame = (value, isDocument) => {
            if (current !== generation || request.signal.aborted) return;
            const frame = document.createElement('iframe');
            developer.attach(frame);
            frame.id = 'gn-game-frame'; frame.title = displayName;
            frame.setAttribute('sandbox',g8meFrameSandbox(g8meGuard.enabled));
            frame.allow = 'autoplay; fullscreen; gamepad; clipboard-write; cross-origin-isolated';frame.tabIndex=0; frame.allowFullscreen = true;
            if(['fiveplay','half-life-2'].includes(game.id))stopStartupMonitor=watchG8meStartup(frame,failure=>{if(current!==generation)return;frameFailed=true;clearTimeout(launchTimer);status.textContent=game.name+' could not finish starting. '+failure;retry.classList.remove('hidden');message.classList.remove('hidden');},game.id);
            stopClicker=autoClicker.attach(frame);
            stopDisplay=attachG8meDisplay(frame,host,()=>displaySettings);
            frame.addEventListener('load', () => {
                if (current !== generation||frameFailed) return;
                try { if(frame.contentDocument?.URL === 'about:blank')return; } catch {}
                clearTimeout(launchTimer);
                try {
                    if(game.id==='half-life-2' && g8meRuntime) {
                        // Keep the iframe's origin and saves; only bootstrap bytes
                        // bypass the rewritten fetch layer that can reject WASM.
                        frame.contentWindow.__gbHl2Asset=path=>fetchHalfLife2Asset(g8meRuntime,path,value,request.signal);
                        frame.contentWindow.__gbHl2Bootstrap=async()=>{
                            const asset=await fetchHalfLife2Asset(g8meRuntime,'index.wasm',value,request.signal);
                            if(asset.status!==200)throw Error('HL2 engine returned HTTP '+asset.status);
                            return asset.bytes;
                        };
                    }
                    const doc=frame.contentDocument;
                    if(doc && (/^Error response$|^Error processing your request$/.test(doc.title)||/^Internal Service Worker Error:|^Geekfox connection expired/.test(doc.body?.innerText?.trim()||''))) {
                        status.textContent='This connection could not load the g8me. Retry or switch launch mode.';retry.classList.remove('hidden');message.classList.remove('hidden');return;
                    }
                    doc?.addEventListener('keydown',exitFullscreenOnEscape,true);
                    doc?.addEventListener('pointerdown',()=>frame.contentWindow?.focus(),true);
                } catch {}
                message.classList.add('hidden');
                frame.contentWindow?.focus();
                document.dispatchEvent(new CustomEvent('gameplayed', {detail:game}));
            });
            if (isDocument) frame.srcdoc = value; else if(!viaP8y)frame.src = value;
            host.replaceChildren(frame);
            launchTimer=setTimeout(()=>{if(current===generation){status.textContent='This g8me is taking longer than expected. Retry, or switch launch mode.';retry.classList.remove('hidden');message.classList.remove('hidden');}},60000);
            if(viaP8y)return frame;
        };
        if(viaP8y) {
            try {
                const engine=window.parent.GeekfoxEngine||window.GeekfoxEngine;
                status.textContent='Connecting to a p8y relay…';
                if(!engine)throw new Error('The browsing engine is missing. Rebuild index.svg.');
                const report=text=>{if(current===generation){status.textContent=text;if(developer.enabled)developer.record('system',text);}};
                if(g8meRuntime){if(g8mePreference!==engine.preference)await g8meRuntime.changeConnection(engine.preference);}
                else g8meRuntime=await engine.startG8mes(report);
                g8mePreference=engine.preference;
                const runtime=g8meRuntime;
                if(game.threaded&&!window.parent.crossOriginIsolated){
                    const key='gbThreadedG8meReload';
                    if(new URL(window.parent.location.href).searchParams.get('gb-threaded')==='1'&&sessionStorage.getItem(key)===String(game.id))throw Error('This browser could not enable cross-origin isolation for this threaded g8me. Its page can load, but its engine needs that capability.');
                    sessionStorage.setItem(key,String(game.id));sessionStorage.setItem('gbResumeP8yG8me',String(game.id));
                    status.textContent='Enabling threaded g8me support. Reloading once…';await runtime.reloadIsolated();return;
                }
                const url=await g8meP8yURL(game,resolveLuminGame,mirror);
                if(current!==generation||request.signal.aborted)return;
                stopRuntimeStatus=runtime.subscribe?.(state=>{if(current===generation&&!message.classList.contains('hidden'))status.textContent=state.text;});
                if(game.id==='half-life-2')status.textContent='Preparing the HL2 runtime…';
                const resourceResponses=game.id==='half-life-2'?await prepareHalfLife2RuntimeResponse(runtime,url,request.signal):null;
                if(current!==generation||request.signal.aborted)return;
                const frame=mountFrame(url,false);
                activeHandle=runtime.attach(frame,{url:()=>{},error:error=>{if(current===generation){frameFailed=true;clearTimeout(launchTimer);status.textContent=error.message;retry.classList.remove('hidden');message.classList.remove('hidden');}}},{resourceResponses,filterRequest:g8meGuard.filterRequest,transformScript:game.id==='fiveplay'?{matches:isFivePlayLoader,prepare:prepareFivePlayLoader}:null,mainDocumentURL:url,prepareDocumentURL:developer.enabled||game.provider==='gn'||game.id==='half-life-2'?url:null,prepareDocument:html=>withG8meDeveloper(game.provider==='gn'?withGdNetwork(gameDocument(html,url),game):game.id==='half-life-2'?prepareHalfLife2Document(html):html,developer.enabled)});
                activeHandle.go(url);return;
            } catch(error) {if(current===generation){status.textContent='P8y launch failed: '+error.message;retry.classList.remove('hidden');message.classList.remove('hidden');}return;}
        }
        if (game.provider === 'lumin') {
            try { const url = await resolveLuminGame(game.id); mountFrame(url,false); return; }
            catch (error) {
                if (current !== generation) return;
                status.textContent = `Could not start ${displayName}: ${error.message}`;
                retry.classList.remove('hidden'); return;
            }
        }
        for (const url of game.urls) {
            try {
                const html = withG8meSaves(withGdNetwork(gameDocument(await fetchWithTimeout(url, {signal:request.signal,timeout:60000}),url),game),game);
                mountFrame(withG8meDeveloper(g8meGuard.protectHTML(html,url),developer.enabled),true); return;
            } catch (error) {
                if (current !== generation || request.signal.aborted) return;
                console.warn('Game source unavailable:',url,error.message);
            }
        }
        if (current !== generation) return;
        status.textContent = `Could not load ${displayName}. Try again or choose another g8me.`;
        retry.classList.remove('hidden');
        requestAnimationFrame(rebuildButtons);
    }

    async function closeGame() {
        if (closing) return;
        closing = true;
        close.disabled = true;
        sound();
        ++generation;
        activeRequest?.abort();
        if (await flushG8meFrame(host.querySelector('iframe')) === false) { closing = false; close.disabled = false; return; }
        activeGame = null;activeHandle?.dispose();activeHandle=null;stopDisplay?.();stopDisplay=null;stopClicker?.();stopClicker=null;stopStartupMonitor?.();stopStartupMonitor=null;stopRuntimeStatus?.();stopRuntimeStatus=null;clearTimeout(launchTimer);
        // Removing the iframe stops its scripts, audio, timers, and network activity.
        host.replaceChildren();
        if (document.fullscreenElement === player) await document.exitFullscreen().catch(() => {});
        player.classList.add('hidden');
        document.querySelectorAll('.topbar, main, .dashboard-footer').forEach(element => { element.inert = false; });
        onClose();
        closing = false;
        close.disabled = false;
        returnFocus?.focus({ preventScroll: true });
        try{sessionStorage.removeItem('gbResumeP8yG8me');sessionStorage.removeItem('gbThreadedG8meReload');}catch{}
        (window.parent.GeekfoxEngine||window.GeekfoxEngine)?.leaveG8meIsolation?.();
    }

    search.addEventListener('input', filterG8mes);
    more.addEventListener('click', () => { sound(); appendG8mes(); });
    catalogRetry.addEventListener('click', () => { catalogs.delete(source); loadCatalog(); });
    retry.addEventListener('click', () => { if (activeGame) openGame(activeGame,null,activeP8y,activeP8y?activeMirror+1:0); });
    const exportProgress=document.getElementById('gn-export-progress'),importProgress=document.getElementById('gn-import-progress'),progressFile=document.getElementById('gn-progress-file'),progressStatus=document.getElementById('gn-progress-status'),progressDownload=document.getElementById('gn-progress-download');
    let progressDownloadURL=null;
    function progressBusy(value){for(const control of player.querySelectorAll('button'))control.disabled=value;fullscreen.disabled=value||!player.requestFullscreen;}
    exportProgress.addEventListener('click',async()=>{
        if(!activeGame)return;progressBusy(true);autoClicker.stop();
        try{const backup=await captureG8meBackup(host.querySelector('iframe'),activeGame);const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});if(blob.size>50*1024*1024)throw Error('This save is larger than the 50 MB progress-file limit. Use the g8me’s native export.');const url=URL.createObjectURL(blob);if(progressDownloadURL)URL.revokeObjectURL(progressDownloadURL);progressDownloadURL=url;const link=progressDownload;link.href=url;link.download=(activeGame.name.replace(/[^a-z0-9_-]+/gi,'-').slice(0,60)||'g8me')+'-progress.json';link.classList.remove('hidden');link.click();progressStatus.textContent='Progress file ready · Use Save progress file if the download did not start.';}
        catch(error){progressStatus.textContent=error.message;}finally{progressBusy(false);}
    });
    importProgress.addEventListener('click',()=>{progressFile.value='';progressFile.click();});
    progressFile.addEventListener('change',async()=>{
        const file=progressFile.files[0];if(!file||!activeGame)return;
        if(file.size>50*1024*1024){progressStatus.textContent='Progress files must be smaller than 50 MB.';return;}
        progressBusy(true);autoClicker.stop();const game=activeGame,mode=activeP8y;let removed=false;
        try{
            const data=JSON.parse(await file.text());const rollback=await captureG8meBackup(host.querySelector('iframe'),game,true);
            validateG8meBackup(data,game,rollback.databases.map(db=>db.name));
            if(!window.confirm('Replace saved progress for '+game.name+' with this file? The g8me will restart. Export your current progress first if you want to keep it.'))return;
            activeRequest?.abort();++generation;activeHandle?.dispose();activeHandle=null;stopDisplay?.();stopDisplay=null;stopClicker?.();stopClicker=null;stopStartupMonitor?.();stopStartupMonitor=null;clearTimeout(launchTimer);host.replaceChildren();removed=true;
            await restoreG8meBackup(data,game,rollback);await openGame(game,null,mode);progressStatus.textContent='Progress imported · G8me restarted.';
        }catch(error){if(removed)await openGame(game,null,mode);progressStatus.textContent='Import failed: '+error.message;}finally{progressBusy(false);}
    });
    document.getElementById('gn-reload-btn').addEventListener('click', () => { if (activeGame) openGame(activeGame,null,activeP8y); });
    p8yLaunch.addEventListener('click',async()=>{if(!activeGame)return;if(activeGame.viaP8y&&g8meRuntime){try{await g8meRuntime.changeConnection(g8mePreference);}catch(error){status.textContent=error.message;return;}}openGame(activeGame,null,!activeP8y);});
    close.addEventListener('click', closeGame);
    fullscreen.disabled = !player.requestFullscreen;
    fullscreen.addEventListener('click', async () => {
        sound();
        try {
            if (document.fullscreenElement === player) await document.exitFullscreen();
            else await player.requestFullscreen();
        } catch (error) { console.warn('Fullscreen unavailable:', error.message); }
    });
    document.addEventListener('fullscreenchange', () => {
        fullscreen.querySelector('.button-text').textContent = document.fullscreenElement === player ? 'Exit Fullscreen' : 'Fullscreen';
    });
    loadCatalog();
    {
        try{const pending=sessionStorage.getItem('gbResumeP8yG8me');if(pending){sessionStorage.removeItem('gbResumeP8yG8me');const game=extraG8mes().find(game=>String(game.id)===pending);if(game&&new URL(window.parent.location.href).searchParams.get('gb-threaded')==='1')openGame(game,null,true);}}catch{}
    }
    return { launch: openGame, setSource, getG8mes: () => g8mes };
}
