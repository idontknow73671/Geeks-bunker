function yourGeekChatLink(value) {
    try {
        const url=new URL(value), id=url.searchParams.get('chatID');
        if(!['duck.ai','duckduckgo.com'].includes(url.hostname)||!/^https:$/.test(url.protocol)||!id||!/^[a-zA-Z0-9_-]{8,100}$/.test(id))return null;
        return {id,url:'https://duck.ai/?chatID='+encodeURIComponent(id)};
    } catch { return null; }
}
// Duck.ai runs through the existing Geekfox engine, with its own model picker.
// This keeps provider model availability, terms, and free usage limits intact.
export function initializeYourGeek({reveal}) {
    const $ = id => document.getElementById(id);
    const home = 'https://duck.ai/';
    let frame = null, handle = null, starting = null, timer = null, generation = 0;
    let themeObserver = null, captureTimer=null;
    let history=[];
    try { const saved=JSON.parse(localStorage.getItem('gbYourGeekHistoryV1')||'[]');if(Array.isArray(saved))history=saved.filter(item=>item&&yourGeekChatLink(item.url)?.id===item.id&&typeof item.title==='string'&&Number.isFinite(item.updatedAt)&&item.updatedAt>=0&&item.updatedAt<=Date.now()+86400000).slice(0,100); } catch {}
    const historyDialog=$('ai-history-dialog');
    function saveHistory() {
        try { localStorage.setItem('gbYourGeekHistoryV1',JSON.stringify(history));$('ai-history-note').textContent='Saved on this browser. Conversations reopen in Duck.ai; clearing site data removes local chats.'; }
        catch { $('ai-history-note').textContent='History could not be saved. Browser storage may be full or disabled.'; }
    }
    function renderHistory() {
        const query=$('ai-history-search').value.trim().toLowerCase(), list=$('ai-history-list');list.replaceChildren();
        for(const item of history.filter(item=>item.title.toLowerCase().includes(query))) {
            const row=document.createElement('div');row.className='yourgeek-history-row';
            const open=document.createElement('button');open.type='button';open.className='yourgeek-history-open';
            const title=document.createElement('strong');title.textContent=item.title;
            const time=document.createElement('time');time.dateTime=new Date(item.updatedAt).toISOString();time.textContent=new Date(item.updatedAt).toLocaleString();
            open.append(title,time);open.addEventListener('click',()=>{historyDialog.close();connect(true,item.url);});
            const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='Remove shortcut';remove.setAttribute('aria-label','Remove shortcut for '+item.title);
            remove.addEventListener('click',()=>{history=history.filter(entry=>entry.id!==item.id);saveHistory();renderHistory();});
            row.append(open,remove);list.append(row);
        }
        if(!list.children.length){const empty=document.createElement('p');empty.className='muted';empty.textContent=query?'No matching chats.':'Your conversations will appear here as you use YourGeek. Existing chats are also available in Duck.ai history.';list.append(empty);}
    }
    function captureChat() {
        clearTimeout(captureTimer);
        try {
            const doc=frame?.contentDocument, link=yourGeekChatLink(handle?.currentURL?.());
            if(!doc||!link)return;
            const title=doc.title.trim();if(!title||/^Duck\.ai(?: by|$)|^All chats are private/i.test(title))return;
            const old=history.find(item=>item.id===link.id);
            if(old?.title===title&&history[0]?.id===link.id)return;
            history=[{...link,title:title.slice(0,180),updatedAt:Date.now()},...history.filter(item=>item.id!==link.id)].slice(0,100);
            saveHistory();if(historyDialog.open)renderHistory();
        } catch {}
    }
    $('ai-history').addEventListener('click',()=>{captureChat();renderHistory();historyDialog.showModal();$('ai-history-search').focus();});
    $('ai-history-close').addEventListener('click',()=>historyDialog.close());
    $('ai-history-search').addEventListener('input',renderHistory);
    $('ai-provider-history').addEventListener('click',async()=>{
        historyDialog.close();await connect();
        const doc=frame?.contentDocument;
        const toggle=doc&&[...doc.querySelectorAll('button')].find(button=>/^Show sidebar/i.test(button.getAttribute('aria-label')||''));
        if(toggle)toggle.click();
        else status('Open the menu inside Duck.ai to see its saved chats.');
    });
    const status = message => { $('ai-status').textContent = message; };
    function failure(message) {
        clearTimeout(timer);
        $('ai-loading').classList.remove('hidden');
        $('ai-loading-title').textContent = 'YourGeek couldn’t connect';
        $('ai-loading-description').textContent = message;
        $('ai-retry').classList.remove('hidden');
        status('Connection unavailable · Retry or open Duck.ai directly.');
    }
    function themeProvider(doc) {
        themeObserver?.disconnect();
        if (!doc.getElementById('yourgeek-provider-style')) {
            const style = doc.createElement('style'); style.id = 'yourgeek-provider-style';
            style.textContent = `
                html,body,#app,#app>div,#app>div>div,[data-yourgeek-surface] { background:transparent!important; }
                [data-yourgeek-welcome-art] { display:none!important; }
                body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important; }
                #app main { background:rgba(10,14,21,.24)!important; }
                #app textarea { background:transparent!important;font-family:inherit!important;font-size:15px!important;line-height:1.65!important; }
                #app div:has(>div>textarea) { background:rgba(255,255,255,.055)!important;border:1px solid #ffffff26!important;border-radius:12px!important;box-shadow:inset 0 1px 0 #ffffff12!important; }
                #app [role="menu"],#app [role="dialog"] { border-radius:12px!important; }
                #app h1[data-yourgeek-home] { font-size:13px!important;font-weight:400!important;opacity:.72;letter-spacing:0!important; }
                .yourgeek-welcome { display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;margin:0 auto 18px;gap:11px;color:#f4f5f8; }
                .yourgeek-welcome .yg-symbol { width:54px;height:54px;display:grid;place-items:center;font:400 27px -apple-system,sans-serif;border:1px solid #ffffff38;border-radius:13px;background:#ffffff08; }
                .yourgeek-welcome h2 { margin:0!important;font:500 32px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:-1.1px; }
                .yourgeek-welcome p { margin:0!important;font:400 12px/1.6 -apple-system,sans-serif;color:#b4bcc9; }
                @media(max-width:600px) { .yourgeek-welcome { margin-bottom:10px;gap:8px; }.yourgeek-welcome h2 { font-size:27px!important; }.yourgeek-welcome .yg-symbol { width:45px;height:45px; } }
            `;
            (doc.head || doc.documentElement).append(style);
        }
        let scheduled = false;
        const decorate = () => {
            scheduled = false;
            clearTimeout(captureTimer);captureTimer=setTimeout(captureChat,600);
            const pageHeading = doc.querySelector('main h1') || doc.querySelector('h1');
            for (let node = pageHeading?.parentElement; node && node !== doc.body; node = node.parentElement) node.dataset.yourgeekSurface = '';
            const heading = [...doc.querySelectorAll('h1')].find(node => /^(?:Duck\.ai(?:, by DuckDuckGo)?|All chats are private)$/.test(node.textContent.trim()));
            const existing = doc.getElementById('yourgeek-welcome');
            if (!heading) { existing?.remove(); return; }
            heading.dataset.yourgeekHome = '';
            for (const artwork of heading.parentElement.parentElement.querySelectorAll('svg,img')) {
                if (!artwork.closest('button,a,[role="button"]') && (artwork.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)) artwork.dataset.yourgeekWelcomeArt = '';
            }
            if (existing) return;
            const welcome = doc.createElement('div'); welcome.id = 'yourgeek-welcome'; welcome.className = 'yourgeek-welcome';
            const mark = doc.createElement('span'); mark.className = 'yg-symbol'; mark.textContent = 'Y'; mark.setAttribute('aria-hidden','true');
            const title = doc.createElement('h2'); title.textContent = 'YourGeek';
            const note = doc.createElement('p'); note.textContent = 'A fresh perspective starts here. Powered by Duck.ai.';
            welcome.append(mark,title,note); heading.before(welcome);
        };
        themeObserver = new MutationObserver(() => {
            if (scheduled) return; scheduled = true; requestAnimationFrame(decorate);
        });
        themeObserver.observe(doc.body, {subtree:true,childList:true,characterData:true});if(doc.head)themeObserver.observe(doc.head,{subtree:true,childList:true,characterData:true}); decorate();
    }
    function loaded() {
        if (!frame || !handle) return;
        try {
            const doc = frame.contentDocument;
            // Ignore an initial about:blank load before the rewritten page arrives.
            if (!doc?.body?.children.length) return;
            clearTimeout(timer);
            themeProvider(doc);captureChat();
            const text = doc.body.innerText || '';
            if (/sorry, you have been blocked|access denied/i.test(text)) {
                failure('Duck.ai is blocking this relay. You can open Duck.ai directly instead.'); return;
            }
            $('ai-loading').classList.add('hidden');
            status('Powered by Duck.ai · Connected through Geekfox');
        } catch {
            // Some provider navigations restrict document access; leave their UI visible.
            clearTimeout(timer); $('ai-loading').classList.add('hidden');
            status('Powered by Duck.ai · Connected');
        }
    }
    async function connect(restart = false, destination = home) {
        if (starting) { await starting; return restart ? connect(true,destination) : undefined; }
        if (handle && !restart) return;
        captureChat();
        const request = ++generation;
        $('ai-loading').classList.remove('hidden'); $('ai-retry').classList.add('hidden');
        $('ai-loading-title').textContent = 'Opening YourGeek';
        $('ai-loading-description').textContent = 'Connecting through Geekfox…';
        status('Connecting YourGeek…');
        starting = (async () => {
            try {
                const engine = window.parent.GeekfoxEngine || window.GeekfoxEngine;
                if (!engine) throw new Error('The Geekfox engine is missing. Rebuild the SVG.');
                const runtime = await engine.start(status);
                if (request !== generation) return;
                if (!handle) {
                    frame = document.createElement('iframe'); frame.className = 'ai-content';
                    frame.title = 'YourGeek chat · Powered by Duck.ai';
                    frame.allow = 'fullscreen; clipboard-write'; frame.allowFullscreen = true;
                    frame.referrerPolicy = 'no-referrer';
                    frame.addEventListener('load', loaded);
                    $('ai-frame-host').replaceChildren(frame);
                    handle = runtime.attach(frame, {url:value => {
                        try { status('Powered by Duck.ai · ' + new URL(value).hostname); clearTimeout(captureTimer);captureTimer=setTimeout(captureChat,600); } catch {}
                    },error:error=>failure(error.message)});
                }
                clearTimeout(timer);
                timer = setTimeout(() => failure('The service is taking too long to load. Try again, or open Duck.ai directly.'), 45000);
                handle.go(destination);
            } catch (error) { failure(error.message || 'The shared relay could not connect.'); }
            finally { starting = null; }
        })();
        return starting;
    }
    window.addEventListener('pagehide',captureChat);
    $('ai-new-chat').addEventListener('click', () => connect(true));
    $('ai-retry').addEventListener('click', () => connect(true));
    $('ai-reload').addEventListener('click', () => {
        if (starting) return;
        if (!handle) return connect();
        $('ai-loading-title').textContent = 'Refreshing YourGeek';
        $('ai-loading-description').textContent = 'Reconnecting to your current conversation…';
        $('ai-loading').classList.remove('hidden'); $('ai-retry').classList.add('hidden');
        clearTimeout(timer);
        timer = setTimeout(() => failure('The service is taking too long to reload. Try again, or open Duck.ai directly.'), 45000);
        try { handle.reload(); } catch (error) { failure(error.message || 'The conversation could not reload.'); }
    });
    function exitFullscreen() {
        $('ai-browser').classList.remove('ai-expanded');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    $('ai-fullscreen').addEventListener('click', async () => {
        $('ai-browser').classList.add('ai-expanded');
        try { await $('ai-browser').requestFullscreen(); } catch {}
    });
    $('ai-exit-fullscreen').addEventListener('click', exitFullscreen);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) $('ai-browser').classList.remove('ai-expanded'); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('ai-browser').classList.contains('ai-expanded')) exitFullscreen(); });
    return {open() { reveal($('ai-browser')); return connect(); }};
}
