import { initializeGeekfoxAddons } from "./geekfox-addons.js";
export function initializeGeekfox({reveal, toast, read, write, onCustomize}) {
    const $ = id => document.getElementById(id);
    const tabs = [];
    const addons = initializeGeekfoxAddons({read,write,fetchThroughGeekfox:async(url,options)=>(await getEngine()).fetch(url,options),frames:()=>tabs.filter(tab=>tab.frame && tab.handle),reload:()=>{for(const tab of tabs)if(tab.handle)tab.handle.reload();}});
    let selected = null, nextId = 1, engine = null, pending = null;
    const engineHost = window.parent.GeekfoxEngine || window.GeekfoxEngine;
    for (const connection of engineHost?.connections || []) {
        const option = document.createElement('option'); option.value=connection.id; option.textContent=connection.label;
        $('geekfox-connection').append(option);
    }
    $('geekfox-connection').value=engineHost?.preference || 'auto';
    async function changeConnection() {
        const button=$('geekfox-reconnect'), picker=$('geekfox-connection'), requested=picker.value;
        button.disabled=true; picker.disabled=true;
        try {
            const runtime=await getEngine();
            await runtime.changeConnection(requested);
            for (const tab of tabs) if (tab.url) navigate(tab,tab.url);
        } catch(error) { status(error.message); $('geekfox-connection-state').textContent=error.message; }
        finally { button.disabled=false; picker.disabled=false; }
    }
    $('geekfox-connection').addEventListener('change',changeConnection);
    $('geekfox-reconnect').addEventListener('click',changeConnection);
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
    const prefs=Object.assign({search:'duckduckgo',accent:'#80bfff',density:'comfortable',motion:true,shortcuts:true,zoom:100},read('gbGeekfoxSettings',{}));
    const settings=document.createElement('div');settings.className='gf-settings';settings.setAttribute('aria-label','Geekfox settings');
    settings.innerHTML=`<aside><h2>Geekfox</h2><p>Settings</p><nav aria-label="Settings categories"></nav><button type="button" data-close>Back to browsing</button></aside><main><input type="search" aria-label="Search settings" placeholder="Find a setting"><div data-sections></div></main>`;
    settings.hidden=true;
    const sections=settings.querySelector('[data-sections]');
    function section(name,html){const el=document.createElement('section');el.innerHTML='<h2>'+name+'</h2>'+html;sections.append(el);const b=document.createElement('button');b.textContent=name;b.onclick=()=>{settings.querySelector('input[type=search]').value='';for(const e of sections.children)e.hidden=e!==el;};settings.querySelector('nav').append(b);return el;}
    section('General',`<label>Address bar search<select data-pref="search"><option value="duckduckgo">DuckDuckGo</option><option value="google">Google</option><option value="bing">Bing</option><option value="brave">Brave</option></select></label><p>Searches and websites open through Geekfox.</p>`);
    section('Appearance',`<label>Accent color<input type="color" data-pref="accent"></label><label>Toolbar spacing<select data-pref="density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label>Interface animations<input type="checkbox" data-pref="motion"></label><label>Show new-tab shortcuts<input type="checkbox" data-pref="shortcuts"></label><label>Page zoom<select data-pref="zoom">${[75,90,100,110,125,150,175,200].map(n=>'<option value="'+n+'">'+n+'%</option>').join('')}</select></label><p>Zoom affects web pages inside Geekfox.</p><button type="button" data-wallpaper>Choose a background</button>`);
    const connectionSection=section('Connection','<p>Choose a relay and browser identification profile. These profiles do not change your actual rendering engine.</p>');
    connectionSection.append($('geekfox-connection').closest('.geekfox-connection-row'),$('geekfox-profile').closest('.geekfox-profile-row'));
    const privacy=section('Privacy & add-ons','<p>Manage the request blocker, dislike counts, installed Firefox packages, and page styles.</p><button type="button" data-addons>Manage blockers and add-ons</button>');
    section('Bookmarks','<p>Manage your saved website shortcuts.</p><button type="button" data-export>Export bookmarks</button><label>Import bookmarks (Geekfox JSON)<input type="file" data-import accept="application/json,.json"></label><p role="status" data-import-status></p>');
    settings.querySelector('[data-close]').onclick=()=>{const tab=tabs.find(t=>t.internal==='settings');if(tab)closeTab(tab);};
    settings.querySelector('[data-wallpaper]').onclick=()=>{onCustomize?.();};
    privacy.querySelector('[data-addons]').onclick=()=>{$('geekfox-addons').click();};
    settings.querySelector('input[type=search]').oninput=e=>{const q=e.target.value.toLowerCase();for(const el of sections.children)el.hidden=!el.textContent.toLowerCase().includes(q);};
    const apply=()=>{const shell=$('geekfox-pages');shell.style.setProperty('--gf-accent',prefs.accent);document.documentElement.style.setProperty('--gf-accent',prefs.accent);document.body.classList.toggle('gf-compact',prefs.density==='compact');document.body.classList.toggle('gf-still',!prefs.motion);document.body.classList.toggle('gf-hide-shortcuts',!prefs.shortcuts);for(const tab of tabs)if(tab.frame)tab.frame.style.zoom=String(prefs.zoom/100);};
    for(const input of settings.querySelectorAll('[data-pref]')){const key=input.dataset.pref;if(input.type==='checkbox')input.checked=!!prefs[key];else input.value=prefs[key];input.onchange=()=>{prefs[key]=input.type==='checkbox'?input.checked:key==='zoom'?Number(input.value):input.value;write('gbGeekfoxSettings',prefs);apply();};}
    settings.querySelector('[data-export]').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(read('gbGeekfoxBookmarks',[]),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='geekfox-bookmarks.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    settings.querySelector('[data-import]').onchange=async e=>{try{const items=JSON.parse(await e.target.files[0].text());if(!Array.isArray(items)||items.length>1000)throw Error('Choose a Geekfox bookmark file.');const saved=read('gbGeekfoxBookmarks',[]);for(const item of items){const u=new URL(item.url);if(!['https:','http:'].includes(u.protocol))throw Error('Bookmarks must use HTTP or HTTPS.');}for(const item of items)if(!saved.some(x=>x.url===item.url))saved.push({url:item.url,title:String(item.title||item.url).slice(0,200)});write('gbGeekfoxBookmarks',saved);settings.querySelector('[data-import-status]').textContent='Bookmarks imported. New tabs show the updated list.';}catch(error){settings.querySelector('[data-import-status]').textContent=error.message;}e.target.value='';};
    const settingsButton=document.createElement('button');
    settingsButton.id='geekfox-settings';settingsButton.type='button';
    settingsButton.className='geekfox-icon';settingsButton.textContent='☰';
    settingsButton.title='Geekfox settings';settingsButton.setAttribute('aria-label','Geekfox settings');
    settingsButton.onclick=()=>openSettings();
    $('geekfox-bookmark').after(settingsButton);
    $('geekfox-personalize').remove();
    apply();
    const shortcuts = [['Wikipedia','https://www.wikipedia.org/'],['Duck.ai','https://duck.ai/'],['DuckDuckGo','https://duckduckgo.com/'],['GitHub','https://github.com/'],['MDN','https://developer.mozilla.org/']];
    const active = () => tabs.find(tab => tab.id === selected);
    function address(value) {
        const text = value.trim();
        if(['geekfox://settings','about:preferences','chrome://settings'].includes(text))return 'geekfox://settings';
        if (!text) return null;
        const hostWithPort = /^(?:localhost|(?:[\w-]+\.)+[\w-]+):\d+(?:[/?#]|$)/i.test(text);
        if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:/i.test(text) && !hostWithPort) throw new Error('Use an HTTP or HTTPS address.');
        const candidate = /^https?:\/\//i.test(text) ? text : /^[^\s/]+\.[^\s]+/.test(text) || /^localhost(?::\d+)?(?:\/|$)/i.test(text) ? 'https://' + text : ({duckduckgo:'https://duckduckgo.com/?q=',google:'https://www.google.com/search?q=',bing:'https://www.bing.com/search?q=',brave:'https://search.brave.com/search?q='}[prefs.search]||'https://duckduckgo.com/?q=') + encodeURIComponent(text);
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
        $('geekfox-bookmark').disabled = !tab?.url || !!tab.internal;
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
        status(tab.error || (tab.url ? 'Browsing with Geekfox · fallback enabled' : 'New tab · search or enter a website address'));
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
    function openSettings(tab=null) {
        const existing=tabs.find(item=>item.internal==='settings');
        if(existing)tab=existing;
        if(!tab)tab=newTab();
        if(!tab)return;
        tab.busy++;tab.handle?.dispose();tab.handle=null;tab.frame=null;tab.observer?.disconnect();
        tab.internal='settings';tab.url='geekfox://settings';tab.title='Settings';
        tab.panel.replaceChildren(settings);settings.hidden=false;select(tab);
        settings.querySelector('input[type=search]').focus();
    }
    function closeTab(tab) {
        const index = tabs.indexOf(tab), wasSelected = selected === tab.id;
        tab.busy++; tab.handle?.dispose(); tab.observer?.disconnect(); tab.panel.remove(); tabs.splice(index, 1);
        addons.refresh();
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
            pending = host.start(status).then(value => {
                engine=value;
                value.subscribe(state => {
                    $('geekfox-connection').value=state.preferred;
                    $('geekfox-connection-state').textContent=state.text;
                    status(state.text);
                });
                return value;
            }).finally(() => { pending = null; });
        }
        return pending;
    }
    function track(tab,url) {
        if (!tabs.includes(tab)) return;
        try { url = new URL(url).href; } catch { return; }
        if (!/^https?:/.test(url)) return;
        tab.url = url;
        queueMicrotask(()=>addons.refresh());
        if (tab.history[tab.index] !== url) { tab.history.splice(tab.index + 1); tab.history.push(url); tab.index = tab.history.length - 1; }
        tab.title = new URL(url).hostname;
        tab.error = '';
        renderTabs();
    }
    function failure(tab,message) {
        tab.error = message; tab.panel.replaceChildren();
        tab.handle?.dispose(); tab.handle = null; tab.frame = null; addons.refresh(); tab.observer?.disconnect();
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
        if(url==='geekfox://settings')return openSettings(tab);
        tab.internal=null;
        const request = ++tab.busy; track(tab,url); controls(); status('Connecting…');
        try {
            const runtime = await getEngine();
            await addons.prepare();
            if (!tabs.includes(tab) || request !== tab.busy) return;
            if (!tab.handle) {
                const frame = document.createElement('iframe'); frame.style.zoom=String(prefs.zoom/100); frame.className = 'geekfox-content'; frame.title = tab.title;
                frame.allow = 'fullscreen; autoplay; clipboard-write'; frame.allowFullscreen = true; frame.referrerPolicy = 'no-referrer';
                tab.frame = frame;
                tab.panel.replaceChildren(frame);
                tab.handle = runtime.attach(frame, {url:value => track(tab,value),error:error => { if(tabs.includes(tab)) failure(tab,error.message); }}, {getProfile:() => browserProfile,filterRequest:addons.filterRequest});
                frame.addEventListener('load', () => {
                    tab.observer?.disconnect();
                    try {
                        const doc = frame.contentDocument;
                        if (/^Internal Service Worker Error:/.test(doc.body?.textContent?.trim() || '')) {
                            failure(tab,'This website could not load through the available connections. Try Reconnect or another address.'); return;
                        }
                        const update = () => {
                            if (doc.title && doc.title !== tab.title) { tab.title = doc.title; frame.title = doc.title; renderTabs(); }
                        };
                        update();
                        addons.apply(frame);
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
        const tab = active(); tab.busy++; tab.handle?.dispose(); tab.observer?.disconnect(); tab.handle = null; tab.frame = null; addons.refresh();
        tab.internal=null;tab.url = ''; tab.title = 'New tab'; welcome(tab); select(tab);
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
        tabs.length = 0; addons.refresh(); newTab(); status('Tabs closed. Saved bookmarks are kept.');
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
