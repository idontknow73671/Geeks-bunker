export function initializeGeekfox({reveal, toast, read, write, onCustomize}) {
    const $ = id => document.getElementById(id);
    const tabs = [];
    let selected = null, nextId = 1, engine = null, pending = null;
    const profileLabels = {native:'Automatic',gecko:'Firefox / Gecko',chromium:'Chrome / Chromium'};
    let browserProfile = read('gbGeekfoxProfile','native');
    if (!Object.hasOwn(profileLabels,browserProfile)) browserProfile = 'native';
    $('geekfox-profile').value = browserProfile;
    $('geekfox-profile').addEventListener('change', event => {
        browserProfile = Object.hasOwn(profileLabels,event.target.value) ? event.target.value : 'native';
        write('gbGeekfoxProfile',browserProfile);
        for (const tab of tabs) if (tab.handle) tab.handle.reload();
        status(profileLabels[browserProfile] + ' identification profile applied. Rendering still uses your current browser.');
    });
    const shortcuts = [['Wikipedia','https://www.wikipedia.org/'],['Duck.ai','https://duck.ai/'],['DuckDuckGo','https://duckduckgo.com/'],['GitHub','https://github.com/'],['MDN','https://developer.mozilla.org/']];
    const active = () => tabs.find(tab => tab.id === selected);
    function address(value) {
        const text = value.trim();
        if (!text) return null;
        const hostWithPort = /^(?:localhost|(?:[\w-]+\.)+[\w-]+):\d+(?:[/?#]|$)/i.test(text);
        if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:/i.test(text) && !hostWithPort) throw new Error('Use an HTTP or HTTPS address.');
        const candidate = /^https?:\/\//i.test(text) ? text : /^[^\s/]+\.[^\s]+/.test(text) || /^localhost(?::\d+)?(?:\/|$)/i.test(text) ? 'https://' + text : 'https://duckduckgo.com/?q=' + encodeURIComponent(text);
        const url = new URL(candidate);
        if (!['http:','https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS address.');
        return url.href;
    }
    function status(text) { $('geekfox-status').textContent = text; }
    function controls() {
        const tab = active();
        if (document.activeElement !== $('geekfox-address')) $('geekfox-address').value = tab?.url || '';
        $('geekfox-back').disabled = !tab || tab.index <= 0;
        $('geekfox-forward').disabled = !tab || tab.index >= tab.history.length - 1;
        $('geekfox-reload').disabled = !tab?.url;
        $('geekfox-bookmark').disabled = !tab?.url;
        const saved = read('gbGeekfoxBookmarks', []);
        $('geekfox-bookmark').setAttribute('aria-pressed', String(saved.some(item => item.url === tab?.url)));
        $('geekfox-bookmark').textContent = saved.some(item => item.url === tab?.url) ? '★' : '☆';
    }
    function renderTabs() {
        $('geekfox-tabs').replaceChildren(...tabs.map(tab => {
            const wrapper = document.createElement('div'); wrapper.className = 'geekfox-tab-wrap';
            const button = document.createElement('button'); button.type = 'button'; button.role = 'tab';
            button.id = 'geekfox-tab-' + tab.id; button.className = 'geekfox-tab';
            button.textContent = tab.title; button.title = tab.title;
            button.setAttribute('aria-controls','geekfox-page-' + tab.id);
            button.setAttribute('aria-selected', String(tab.id === selected));
            button.tabIndex = tab.id === selected ? 0 : -1;
            button.addEventListener('click', () => select(tab));
            button.addEventListener('keydown', event => {
                if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
                event.preventDefault();
                const index = tabs.indexOf(tab);
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                select(tabs[next]); $('geekfox-tab-' + selected).focus();
            });
            const close = document.createElement('button'); close.className = 'geekfox-tab-close'; close.textContent = '×';
            close.setAttribute('aria-label', 'Close ' + tab.title);
            close.addEventListener('click', () => closeTab(tab));
            wrapper.append(button, close); return wrapper;
        }));
        controls();
    }
    function select(tab) {
        selected = tab.id;
        tabs.forEach(item => item.panel.hidden = item !== tab);
        renderTabs();
        status(tab.error || (tab.url ? 'Browsing with Geekfox · shared free relay' : 'New tab · search or enter a website address'));
    }
    function newTab() {
        if (tabs.length >= 12) return toast('Close a tab before opening another.');
        const panel = document.createElement('section'); panel.className = 'geekfox-tab-page';
        const tab = {id:nextId++, title:'New tab', url:'', history:[], index:-1, panel, handle:null, observer:null, busy:0, error:''};
        panel.id = 'geekfox-page-' + tab.id; panel.role = 'tabpanel'; panel.setAttribute('aria-labelledby','geekfox-tab-' + tab.id);
        tabs.push(tab); $('geekfox-pages').append(panel); welcome(tab); select(tab);
        $('geekfox-address').focus(); reveal(panel);
        return tab;
    }
    function closeTab(tab) {
        const index = tabs.indexOf(tab), wasSelected = selected === tab.id;
        tab.busy++; tab.handle?.dispose(); tab.observer?.disconnect(); tab.panel.remove(); tabs.splice(index, 1);
        if (!tabs.length) return newTab();
        if (wasSelected) { select(tabs[Math.min(index, tabs.length - 1)]); $('geekfox-tab-' + selected).focus(); }
        else renderTabs();
    }
    function welcome(tab) {
        tab.panel.replaceChildren();
        const home = document.createElement('div'); home.className = 'geekfox-newtab';
        const mark = document.createElement('img'); mark.className = 'geekfox-mark'; mark.src = 'images/geekfox.png'; mark.alt = 'Geekfox';
        const heading = document.createElement('h2'); heading.textContent = 'Geekfox';
        const note = document.createElement('p'); note.textContent = 'A little more room to explore.';
        const grid = document.createElement('div'); grid.className = 'geekfox-shortcuts';
        const saved = read('gbGeekfoxBookmarks', []);
        for (const [label,url] of [...shortcuts, ...saved.slice(0,8).map(item => [item.title,item.url])]) {
            const button = document.createElement('button'); button.className = 'geekfox-site';
            const letter = document.createElement('span'); letter.textContent = label.slice(0,1).toUpperCase();
            const caption = document.createElement('span'); caption.textContent = label;
            button.append(letter,caption); button.addEventListener('click', () => navigate(tab,url)); grid.append(button);
        }
        const customize = document.createElement('button'); customize.className = 'button geekfox-customize'; customize.textContent = 'Customize background';
        customize.addEventListener('click', onCustomize);
        home.append(mark,heading,note,grid,customize); tab.panel.append(home);
    }
    async function getEngine() {
        if (engine) return engine;
        if (!pending) {
            const host = window.parent.GeekfoxEngine || window.GeekfoxEngine;
            if (!host) throw new Error('The Geekfox engine was not bundled. Rebuild index.svg.');
            pending = host.start(status).then(value => engine = value).finally(() => { pending = null; });
        }
        return pending;
    }
    function track(tab,url) {
        if (!tabs.includes(tab)) return;
        try { url = new URL(url).href; } catch { return; }
        if (!/^https?:/.test(url)) return;
        tab.url = url;
        if (tab.history[tab.index] !== url) { tab.history.splice(tab.index + 1); tab.history.push(url); tab.index = tab.history.length - 1; }
        tab.title = new URL(url).hostname;
        tab.error = '';
        renderTabs();
    }
    function failure(tab,message) {
        tab.error = message; tab.panel.replaceChildren();
        tab.handle?.dispose(); tab.handle = null; tab.observer?.disconnect();
        const box = document.createElement('div'); box.className = 'geekfox-error';
        const heading = document.createElement('h2'); heading.textContent = 'Couldn’t open this page';
        const note = document.createElement('p'); note.textContent = message;
        const retry = document.createElement('button'); retry.className = 'button'; retry.textContent = 'Try again'; retry.addEventListener('click', () => navigate(tab,tab.url));
        box.append(heading,note,retry); tab.panel.append(box); status(message);
    }
    async function navigate(tab,input) {
        let url;
        try { url = address(input); } catch(error) { return toast(error.message); }
        if (!url) return;
        const request = ++tab.busy; track(tab,url); controls(); status('Connecting…');
        try {
            const runtime = await getEngine();
            if (!tabs.includes(tab) || request !== tab.busy) return;
            if (!tab.handle) {
                const frame = document.createElement('iframe'); frame.className = 'geekfox-content'; frame.title = tab.title;
                frame.allow = 'fullscreen; autoplay; clipboard-write'; frame.allowFullscreen = true; frame.referrerPolicy = 'no-referrer';
                tab.panel.replaceChildren(frame);
                tab.handle = runtime.attach(frame, {url:value => track(tab,value)}, {getProfile:() => browserProfile});
                frame.addEventListener('load', () => {
                    tab.observer?.disconnect();
                    try {
                        const doc = frame.contentDocument;
                        const update = () => {
                            if (doc.title && doc.title !== tab.title) { tab.title = doc.title; frame.title = doc.title; renderTabs(); }
                        };
                        update();
                        if (doc.head) { tab.observer = new MutationObserver(update); tab.observer.observe(doc.head,{subtree:true,childList:true,characterData:true}); }
                        if (selected === tab.id) status('Geekfox · ' + new URL(tab.url).hostname);
                    } catch {}
                });
            }
            tab.handle.go(url);
        } catch(error) {
            if (tabs.includes(tab) && request === tab.busy) failure(tab,error.message || 'The shared relay could not connect.');
        }
    }
    $('geekfox-address-form').addEventListener('submit', event => { event.preventDefault(); navigate(active(), $('geekfox-address').value); });
    $('geekfox-address').addEventListener('focus', event => event.target.select());
    $('geekfox-add-tab').addEventListener('click', newTab);
    $('geekfox-home').addEventListener('click', () => {
        const tab = active(); tab.busy++; tab.handle?.dispose(); tab.observer?.disconnect(); tab.handle = null;
        tab.url = ''; tab.title = 'New tab'; welcome(tab); select(tab);
    });
    for (const [id,step] of [['geekfox-back',-1],['geekfox-forward',1]]) $(id).addEventListener('click', () => {
        const tab = active(), index = tab.index + step;
        if (index < 0 || index >= tab.history.length) return;
        tab.index = index; navigate(tab,tab.history[index]);
    });
    $('geekfox-reload').addEventListener('click', () => {
        const tab = active(); if (!tab?.url) return;
        if (tab.handle) { status('Reloading…'); tab.handle.reload(); } else navigate(tab,tab.url);
    });
    $('geekfox-bookmark').addEventListener('click', () => {
        const tab = active(); if (!tab?.url) return;
        let saved = read('gbGeekfoxBookmarks', []);
        if (saved.some(item => item.url === tab.url)) saved = saved.filter(item => item.url !== tab.url);
        else saved.push({url:tab.url,title:tab.title});
        write('gbGeekfoxBookmarks',saved); controls();
        tabs.filter(item => !item.url).forEach(welcome);
    });
    $('geekfox-clear').addEventListener('click', () => {
        for (const tab of tabs) { tab.busy++; tab.handle?.dispose(); tab.observer?.disconnect(); tab.panel.remove(); }
        tabs.length = 0; newTab(); status('Tabs closed. Saved bookmarks are kept.');
    });
    function exitFullscreen() {
        $('geekfox-browser').classList.remove('geekfox-expanded');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    $('geekfox-fullscreen').addEventListener('click', async () => {
        $('geekfox-browser').classList.add('geekfox-expanded');
        try { await document.documentElement.requestFullscreen(); } catch {}
    });
    $('geekfox-exit-fullscreen').addEventListener('click',exitFullscreen);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) $('geekfox-browser').classList.remove('geekfox-expanded'); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') exitFullscreen();
        if (document.getElementById('view-p8y').classList.contains('hidden')) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); $('geekfox-address').focus(); }
    });
    return {open() { if (!tabs.length) newTab(); }};
}
