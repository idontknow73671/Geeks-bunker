// GN Math integration using the same catalog mirror and fetch-to-iframe approach
// as the supplied Opium reference. Keep this module alongside index.svg.
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
        // Consume the body before clearing the timeout, including large games.
        return await response.text();
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
    }
}

function gameDocument(html, url) {
    // Some catalog games use a Google Module / CDATA wrapper.
    const wrapped = html.match(/<Content[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/Content>/i);
    if (wrapped) html = wrapped[1];
    else if (/^\s*<Module\b/i.test(html)) {
        const start = html.search(/<!doctype html|<html\b/i);
        if (start >= 0) html = html.slice(start);
    }
    if (!/<(?:html|head|body|script|div|canvas|!doctype)\b/i.test(html)) {
        throw new Error('The game source did not contain an HTML document.');
    }
    if (/<base\b/i.test(html)) return html;
    const base = new URL('.', url).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const element = `<base href="${base}">`;
    if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, head => head + element);
    if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, root => root + `<head>${element}</head>`);
    return element + html;
}

export function initializeGnMath({ rebuildButtons, onOpen, onClose }) {
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
    const clickAudio = document.getElementById('clickSound');
    if (!grid || !player) return;

    let games = [];
    let matches = [];
    let shown = 0;
    let activeGame = null;
    let activeRequest = null;
    let generation = 0;
    let returnFocus = null;
    const sound = () => {
        if (!clickAudio) return;
        clickAudio.currentTime = 0;
        clickAudio.play().catch(() => {});
    };
    const exitFullscreenOnEscape = event => {
        if (event.key === 'Escape' && document.fullscreenElement === player) {
            event.preventDefault();
            document.exitFullscreen().catch(() => {});
        }
    };
    document.addEventListener('keydown', exitFullscreenOnEscape, true);

    function updateCount() {
        const query = search.value.trim();
        catalogStatus.textContent = `${matches.length.toLocaleString()}${query ? ' matching' : ''} GN Math games · ${shown.toLocaleString()} shown`;
        more.classList.toggle('hidden', shown >= matches.length);
        more.querySelector('.button-text').textContent = `Load More G8mes (${Math.max(0, matches.length - shown).toLocaleString()} remaining)`;
    }

    function appendGames() {
        const end = Math.min(shown + PAGE_SIZE, matches.length);
        const fragment = document.createDocumentFragment();
        for (const game of matches.slice(shown, end)) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'gn-game-card';
            card.setAttribute('aria-label', `Play ${game.name}`);
            const art = document.createElement('span');
            art.className = 'gn-game-art';
            art.textContent = 'GN';
            art.setAttribute('aria-hidden', 'true');
            const image = document.createElement('img');
            image.src = game.cover;
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
            let triedFallback = false;
            image.addEventListener('error', () => {
                if (!triedFallback && game.fallbackCover !== game.cover) {
                    triedFallback = true;
                    image.src = game.fallbackCover;
                } else image.remove();
            });
            art.append(image);
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

    function filterGames() {
        const query = search.value.trim().toLocaleLowerCase();
        matches = games.filter(game => game.name.toLocaleLowerCase().includes(query));
        shown = 0;
        grid.replaceChildren();
        grid.scrollTop = 0;
        appendGames();
        if (games.length && !matches.length) {
            const empty = document.createElement('p');
            empty.className = 'gn-empty';
            empty.textContent = 'No g8mes found.';
            grid.append(empty);
        }
    }

    async function loadCatalog() {
        catalogRetry.classList.add('hidden');
        grid.setAttribute('aria-busy', 'true');
        catalogStatus.textContent = 'Loading GN Math games...';
        for (const source of SOURCES) {
            try {
                const data = JSON.parse(await fetchWithTimeout(source.catalog));
                if (!Array.isArray(data)) throw new Error('Invalid catalog');
                const playable = data.filter(game => Number(game.id) >= 0 &&
                    typeof game.name === 'string' && !game.name.startsWith('[!]') && typeof game.url === 'string' &&
                    game.url.startsWith('{HTML_URL}/'));
                if (!playable.length) throw new Error('Empty catalog');
                games = playable.map(game => {
                    const path = game.url.slice('{HTML_URL}/'.length);
                    const coverPath = typeof game.cover === 'string' && game.cover.startsWith('{COVER_URL}/')
                        ? game.cover.slice('{COVER_URL}/'.length) : `${game.id}.png`;
                    return {
                        id: game.id, name: game.name,
                        urls: [...new Set([new URL(path, source.html).href,
                            `https://raw.githubusercontent.com/freebuisness/html/main/${path}`,
                            `https://raw.githubusercontent.com/gn-math/html/main/${path}`])],
                        cover: new URL(coverPath, source.covers).href,
                        fallbackCover: `https://raw.githubusercontent.com/gn-math/covers/main/${coverPath}`
                    };
                }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
                grid.setAttribute('aria-busy', 'false');
                filterGames();
                return;
            } catch (error) {
                console.warn('GN Math catalog source unavailable:', source.catalog, error.message);
            }
        }
        grid.setAttribute('aria-busy', 'false');
        catalogStatus.textContent = 'Could not load GN Math. Check your connection and try again.';
        catalogRetry.classList.remove('hidden');
        requestAnimationFrame(rebuildButtons);
    }

    async function openGame(game, trigger = null) {
        sound();
        const wasClosed = player.classList.contains('hidden');
        if (trigger) returnFocus = trigger;
        activeRequest?.abort();
        const request = new AbortController();
        activeRequest = request;
        const current = ++generation;
        activeGame = game;
        host.replaceChildren();
        title.textContent = game.name;
        player.classList.remove('hidden');
        message.classList.remove('hidden');
        retry.classList.add('hidden');
        status.textContent = `Loading ${game.name}...`;
        if (wasClosed) onOpen();
        close.focus();
        requestAnimationFrame(rebuildButtons);
        for (const url of game.urls) {
            try {
                const html = gameDocument(await fetchWithTimeout(url, { signal: request.signal }), url);
                if (current !== generation || request.signal.aborted) return;
                const frame = document.createElement('iframe');
                frame.id = 'gn-game-frame';
                frame.title = game.name;
                frame.allow = 'autoplay; fullscreen; gamepad; clipboard-write';
                frame.allowFullscreen = true;
                frame.addEventListener('load', () => {
                    if (current !== generation) return;
                    message.classList.add('hidden');
                    frame.contentDocument?.addEventListener('keydown', exitFullscreenOnEscape, true);
                    frame.contentWindow?.focus();
                }, { once: true });
                // Fetch the text and run it as HTML; navigating to the CDN's .html
                // URL directly would show plain text instead of starting the game.
                frame.srcdoc = html;
                host.replaceChildren(frame);
                return;
            } catch (error) {
                if (current !== generation || request.signal.aborted) return;
                console.warn('GN Math game source unavailable:', url, error.message);
            }
        }
        if (current !== generation) return;
        status.textContent = `Could not load ${game.name}. Try again or choose another game.`;
        retry.classList.remove('hidden');
        requestAnimationFrame(rebuildButtons);
    }

    async function closeGame() {
        sound();
        ++generation;
        activeRequest?.abort();
        activeGame = null;
        // Removing the iframe stops its scripts, audio, timers, and network activity.
        host.replaceChildren();
        if (document.fullscreenElement === player) await document.exitFullscreen().catch(() => {});
        player.classList.add('hidden');
        onClose();
        returnFocus?.focus({ preventScroll: true });
    }

    search.addEventListener('input', filterGames);
    more.addEventListener('click', () => { sound(); appendGames(); });
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
}
