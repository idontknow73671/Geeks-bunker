// Native Geekfox features. These do not install or impersonate Firefox extensions.
const geekfoxBlockerModule = 'vendor/geekfox-blocker.js.gz';
const geekfoxFilterList = 'vendor/geekfox-filters.txt.gz';
export function geekfoxYouTubeVideo(input) {
    try {
        const url=new URL(input);
        if(!['http:','https:'].includes(url.protocol)||!['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))return null;
        const id=url.pathname==='/watch'?url.searchParams.get('v'):/^\/(?:shorts|embed)\/([^/]+)/.exec(url.pathname)?.[1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?id:null;
    } catch {return null;}
}
export async function fetchGeekfoxDislikes(fetchThroughGeekfox,id,signal) {
    if(!/^[a-zA-Z0-9_-]{11}$/.test(id))throw new Error('Invalid YouTube video ID.');
    const response=await fetchThroughGeekfox('https://returnyoutubedislikeapi.com/votes?videoId='+encodeURIComponent(id),{signal});
    if(!response.ok)throw new Error(response.status===429?'Return YouTube Dislike is rate-limiting requests.':'Return YouTube Dislike returned HTTP '+response.status+'.');
    const data=await response.json();
    if(typeof data.dislikes!=='number'||!Number.isFinite(data.dislikes)||data.dislikes<0)throw new Error('Return YouTube Dislike did not provide a count for this video.');
    return {dislikes:Math.round(data.dislikes),fetchedAt:Date.now()};
}
export function geekfoxShouldBlock(filterEngine,Request,details,allowlist=[]) {
    const {url,sourceUrl,type}=details;
    let target,source;try{target=new URL(url);source=new URL(sourceUrl);}catch{return false;}
    if(!['http:','https:'].includes(target.protocol)||type==='main_frame'||allowlist.includes(source.hostname))return false;
    return !!filterEngine.match(Request.fromRawDetails({url:target.href,sourceUrl:source.href,type:type||'other'})).match;
}
export function initializeGeekfoxFeatures({read,write,frames,reload,fetchThroughGeekfox}) {
    const $=id=>document.getElementById(id),key='gbGeekfoxFeaturesV1',saved=read(key,{});
    const state={blocker:saved?.blocker===true,dislikes:saved?.dislikes===true,allow:Array.isArray(saved?.allow)?saved.allow.filter(host=>typeof host==='string'&&/^[a-z0-9.-]+$/.test(host)).slice(0,100):[]};
    let engine=null,Request=null,loading=null,blocked=0,paintTimer=null;
    const records=new Map(),counts=new Map();
    const persist=()=>write(key,state);
    const activeHost=()=>{try{const tab=frames().find(tab=>!tab.panel.hidden);return new URL(tab?.handle?.currentURL?.()||tab?.url).hostname;}catch{return null;}};
    function paint() {
        $('geekfox-blocker-toggle').checked=state.blocker;$('geekfox-dislikes-toggle').checked=state.dislikes;
        const host=activeHost(),allowed=state.allow.includes(host);
        $('geekfox-blocker-site').disabled=!host;
        $('geekfox-blocker-site').textContent=host?(allowed?'Resume blocking on ':'Allow ')+host:'Open a website to manage its blocking';
        if(engine)$('geekfox-blocker-status').textContent=(state.blocker?'Active':'Off')+' · '+blocked.toLocaleString()+' requests blocked this visit · EasyList + EasyPrivacy';
    }
    async function ensureBlocker() {
        if(engine)return;
        if(!loading)loading=(async()=>{
            $('geekfox-blocker-status').textContent='Loading the bundled blocker and filter lists…';
            try {
                const [codeResponse,listResponse]=await Promise.all([fetch(new URL(geekfoxBlockerModule,document.baseURI)),fetch(new URL(geekfoxFilterList,document.baseURI))]);
                if(!codeResponse.ok||!listResponse.ok)throw new Error('Bundled filtering assets could not load.');
                const [code,text]=await Promise.all([codeResponse,listResponse].map(response=>new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text()));
                const moduleURL=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
                let module;try{module=await import(moduleURL);}finally{URL.revokeObjectURL(moduleURL);}
                engine=module.FiltersEngine.parse(text,{loadNetworkFilters:true,loadCosmeticFilters:true});Request=module.Request;
                paint();
            }catch(error){$('geekfox-blocker-status').textContent='Blocker unavailable: '+error.message;throw error;}
            finally{loading=null;}
        })();
        return loading;
    }
    function dispose(record) {record.observer.disconnect();clearTimeout(record.timer);record.controller?.abort();record.cosmetic.remove();record.counter.remove();}
    function cleanup() {
        for(const [frame,record] of records)if(!frames().some(tab=>tab.frame===frame)||frame.contentDocument!==record.doc){dispose(record);records.delete(frame);}
    }
    function showCount(record,url) {
        const id=geekfoxYouTubeVideo(url);
        if(!state.dislikes||!id){record.controller?.abort();record.video=null;record.data=null;record.counter.remove();return;}
        if(record.video!==id){
            record.controller?.abort();record.counter.remove();record.data=null;record.video=id;record.failed=false;
            const cached=counts.get(id);
            if(cached&&Date.now()-cached.fetchedAt<600000)record.data=cached;
            else {
                record.controller=new AbortController();
                const signal=AbortSignal.any([record.controller.signal,AbortSignal.timeout(20000)]);
                $('geekfox-dislikes-status').textContent='Fetching estimated dislikes through Geekfox…';
                fetchGeekfoxDislikes(fetchThroughGeekfox,id,signal).then(data=>{
                    if(record.video!==id||record.controller.signal.aborted||!state.dislikes)return;
                    if(counts.size>=100)counts.delete(counts.keys().next().value);counts.set(id,data);record.data=data;update(record);
                }).catch(error=>{if(record.video!==id||record.controller.signal.aborted)return;record.failed=true;$('geekfox-dislikes-status').textContent='Count unavailable: '+error.message;});
            }
        }
        if(!record.data)return;
        const number=new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(record.data.dislikes);
        const full=record.data.dislikes.toLocaleString();
        const root=record.doc.querySelector('ytd-watch-flexy:not([hidden]), ytd-watch-grid:not([hidden]), ytm-watch, ytd-reel-video-renderer[is-active], ytm-reel-item-renderer[is-active]')||record.doc;
        const candidates=Array.from(root.querySelectorAll('#menu-container #top-level-buttons-computed, ytd-menu-renderer.ytd-watch-metadata > div, ytd-menu-renderer.ytd-video-primary-info-renderer > div, .slim-video-action-bar-actions'));
        const actions=candidates.find(node=>node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
        const segment=actions?.querySelector('segmented-like-dislike-button-view-model, ytd-segmented-like-dislike-button-renderer, .segmented-buttons');
        const text=segment?'↓ '+number:'Dislikes (estimate): '+number+' · RYD';
        if(record.counter.textContent!==text)record.counter.textContent=text;
        record.counter.title=full+' estimated dislikes · Powered by Return YouTube Dislike';
        record.counter.setAttribute('aria-label',full+' estimated dislikes, powered by Return YouTube Dislike');
        record.counter.style.cssText=segment?'display:inline-block!important;padding:0 8px;white-space:nowrap;font:13px system-ui;color:inherit;pointer-events:none;':'position:fixed;bottom:16px;left:16px;z-index:2147483646;padding:9px 12px;border-radius:5px;background:#20242b;color:#fff;border:1px solid #687080;font:13px system-ui;pointer-events:none;';
        if(segment){if(record.counter.parentElement!==actions||segment.nextElementSibling!==record.counter)segment.after(record.counter);}
        else if(record.counter.parentElement!==record.doc.body)record.doc.body.append(record.counter);
        $('geekfox-dislikes-status').textContent=full+' estimated dislikes · Powered by Return YouTube Dislike · Read-only';
    }
    function update(record) {
        const tab=frames().find(tab=>tab.frame===record.frame);if(!tab)return;
        const url=tab.handle?.currentURL?.()||tab.url;
        try {
            const host=new URL(url).hostname;
            if(state.blocker&&engine&&!state.allow.includes(host)){
                const nodes=Array.from(record.doc.querySelectorAll('[id],[class]')).slice(0,2000),ids=[],classes=[];
                for(const node of nodes){if(node.id)ids.push(node.id);classes.push(...node.classList);}
                const signature=host+'|'+ids.join(',')+'|'+classes.join(',');
                if(signature!==record.signature){
                    record.signature=signature;const request=Request.fromRawDetails({url,type:'main_frame'});
                    const result=engine.getCosmeticsFilters({url,hostname:host,domain:request.domain,ids,classes,hrefs:[],getInjectionRules:false,getExtendedRules:false});
                    if(record.cosmetic.textContent!==result.styles)record.cosmetic.textContent=result.styles||'';
                    if(!record.cosmetic.isConnected)record.doc.head.append(record.cosmetic);
                }
            }else {record.cosmetic.remove();record.signature='';}
            showCount(record,url);
        }catch(error){$('geekfox-dislikes-status').textContent='Page tool unavailable: '+error.message;}
    }
    function apply(frame) {
        cleanup();const tab=frames().find(tab=>tab.frame===frame);if(!tab)return;
        let doc;try{doc=frame.contentDocument;if(!doc?.body||doc.readyState!=='complete'||doc.URL.startsWith('about:'))return;}catch{return;}
        let record=records.get(frame);
        if(!record){
            const cosmetic=doc.createElement('style'),counter=doc.createElement('span');counter.dataset.geekfoxDislikes='true';
            record={frame,doc,cosmetic,counter,signature:'',video:null,data:null,controller:null,timer:null};
            record.observer=new MutationObserver(()=>{if(!record.timer)record.timer=setTimeout(()=>{record.timer=null;update(record);},700);});
            record.observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','id','hidden','is-active']});records.set(frame,record);
        }
        update(record);paint();
    }
    $('geekfox-blocker-toggle').onchange=async event=>{
        const enabled=event.target.checked;event.target.disabled=true;state.blocker=enabled;
        try{if(enabled)await ensureBlocker();persist();reload();}
        catch{state.blocker=false;persist();}
        finally{event.target.disabled=false;paint();}
    };
    $('geekfox-dislikes-toggle').onchange=event=>{state.dislikes=event.target.checked;persist();if(!state.dislikes){for(const record of records.values()){record.controller?.abort();record.counter.remove();record.video=null;}}reload();paint();};
    $('geekfox-blocker-site').onclick=()=>{const host=activeHost();if(!host)return;state.allow=state.allow.includes(host)?state.allow.filter(item=>item!==host):[...state.allow.slice(-99),host];persist();reload();paint();};
    $('geekfox-dislikes-retry').onclick=()=>{for(const record of records.values()){if(record.failed){record.video=null;update(record);}}};
    paint();
    return {
        apply,refresh(){cleanup();frames().forEach(tab=>apply(tab.frame));paint();},
        async prepare(){if(state.blocker)try{await ensureBlocker();}catch{state.blocker=false;persist();paint();}},
        filterRequest(details){
            if(!state.blocker||!engine)return false;
            const result=geekfoxShouldBlock(engine,Request,details,state.allow);
            if(result){blocked++;if(!paintTimer)paintTimer=setTimeout(()=>{paintTimer=null;paint();},200);}
            return result;
        }
    };
}
