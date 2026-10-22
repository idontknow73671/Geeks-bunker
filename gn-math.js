import { loadLuminCatalog, loadLuminCover, resolveLuminGame } from "./lumin.js";
import { withG8meSaves, flushG8meFrame } from "./g8me-saves.js";
// GN Math integration using the same catalog mirror and fetch-to-iframe approach
// as the supplied Opium reference. Lumin remains a separate selectable provider.
const SOURCES = [
    {
        catalog: 'https://cdn.jsdelivr.net/gh/freebuisness/assets@main/zones.json',
        html: 'https://cdn.jsdelivr.net/gh/freebuisness/html@main/',
        covers: 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main/'
    },
    {
        catalog: 'https://raw.githubusercontent.com/gn-math/assets/main/zones.json',
        html: 'https://raw.githubusercontent.com/gn-math/html/main/',
        covers: 'https://raw.githubusercontent.com/gn-math/covers/main/'
    }
];
const PAGE_SIZE = 60;

async function fetchWithTimeout(url, options = {}) {
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 20000);
    try {
        const response = await fetch(url, { signal: timeout.signal });
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
    let closing = false;
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
        saveStatus.textContent = data.state === 'saved' ? 'Progress saved on this browser' : data.state === 'ready' ?
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
            art.textContent = game.provider === 'lumin' ? 'L' : 'GN';
            art.setAttribute('aria-hidden', 'true');
            const image = document.createElement('img');
            if (game.provider !== 'lumin') image.src = game.cover;
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
            if (game.provider !== 'lumin' || game.imageToken) art.append(image);
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
                        urls: [...new Set([new URL(path, endpoint.html).href,
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
        catalogStatus.textContent = `Loading ${source === 'lumin' ? 'Lumin' : 'GN Math'}...`;
        try {
            const catalog = catalogs.get(requestedSource) || await (requestedSource === 'lumin' ? loadLuminCatalog() : fetchGnCatalog());
            // Normalize names in catalog data before caching, searching, or saving recents.
            for (const g8me of catalog) g8me.name = g8me.name.replace(/\bg[a]mes\b/gi, word => word[0] === 'G' ? 'G8mes' : 'g8mes');
            catalogs.set(requestedSource, catalog);
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

    async function openGame(game, trigger = null) {
        if (closing) return;
        const displayName = game.name;
        sound();
        const wasClosed = player.classList.contains('hidden');
        if (trigger) returnFocus = trigger;
        activeRequest?.abort();
        const request = new AbortController();
        activeRequest = request;
        const current = ++generation;
        await flushG8meFrame(host.querySelector('iframe'));
        if (current !== generation || request.signal.aborted) return;
        activeGame = game;
        host.replaceChildren();
        saveStatus.textContent = game.provider === 'lumin' ? 'Provider-managed saves' : 'Preparing autosave…';
        title.textContent = displayName;
        player.classList.remove('hidden');
        document.querySelectorAll('.topbar, main, .dashboard-footer').forEach(element => { element.inert = true; });
        message.classList.remove('hidden');
        retry.classList.add('hidden');
        status.textContent = `Loading ${displayName}...`;
        if (wasClosed) onOpen();
        close.focus();
        requestAnimationFrame(rebuildButtons);
        const mountFrame = (value, isDocument) => {
            if (current !== generation || request.signal.aborted) return;
            const frame = document.createElement('iframe');
            frame.id = 'gn-game-frame'; frame.title = displayName;
            frame.allow = 'autoplay; fullscreen; gamepad; clipboard-write'; frame.allowFullscreen = true;
            frame.addEventListener('load', () => {
                if (current !== generation) return;
                message.classList.add('hidden');
                try { frame.contentDocument?.addEventListener('keydown', exitFullscreenOnEscape, true); } catch {}
                frame.contentWindow?.focus();
                document.dispatchEvent(new CustomEvent('gameplayed', {detail:game}));
            }, {once:true});
            if (isDocument) frame.srcdoc = value; else frame.src = value;
            host.replaceChildren(frame);
        };
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
                const html = withG8meSaves(gameDocument(await fetchWithTimeout(url, {signal:request.signal}),url),game);
                mountFrame(html,true); return;
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
        await flushG8meFrame(host.querySelector('iframe'));
        activeGame = null;
        // Removing the iframe stops its scripts, audio, timers, and network activity.
        host.replaceChildren();
        if (document.fullscreenElement === player) await document.exitFullscreen().catch(() => {});
        player.classList.add('hidden');
        document.querySelectorAll('.topbar, main, .dashboard-footer').forEach(element => { element.inert = false; });
        onClose();
        closing = false;
        close.disabled = false;
        returnFocus?.focus({ preventScroll: true });
    }

    search.addEventListener('input', filterG8mes);
    more.addEventListener('click', () => { sound(); appendG8mes(); });
    catalogRetry.addEventListener('click', loadCatalog);
    retry.addEventListener('click', () => { if (activeGame) openGame(activeGame); });
    document.getElementById('gn-reload-btn').addEventListener('click', () => { if (activeGame) openGame(activeGame); });
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
    return { launch: openGame, setSource, getG8mes: () => g8mes };
}
