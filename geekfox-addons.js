import { initializeGeekfoxFeatures } from "./geekfox-features.js";
import { initializeGeekfoxWebExtensions } from "./geekfox-webextensions.js";
// Style tools are separate from the Firefox package compatibility runtime.
export function validateGeekfoxAddon(value) {
    if (!value || value.format !== 'geekfox-style-v1') throw new Error('Choose a Geekfox style add-on JSON file.');
    if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw new Error('Add-on name must be 1–80 characters.');
    if (!Array.isArray(value.hosts) || !value.hosts.length || value.hosts.length > 30 || value.hosts.some(host => typeof host !== 'string' || !/^(\*|(?:\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.test(host))) throw new Error('Use hostnames such as example.com, *.example.com, or *.');
    if (typeof value.css !== 'string' || !value.css.trim() || value.css.length > 40000) throw new Error('Add-on CSS must be 1–40,000 characters.');
    // Forbid escapes/comments too, so URL/import spellings cannot be disguised.
    if (/[\\]|\/\*|@import|url\s*\(|image-set\s*\(/i.test(value.css)) throw new Error('Use local CSS declarations only, without imports, URLs, escapes, or comments.');
    return {format:'geekfox-style-v1',name:value.name.trim(),description:typeof value.description === 'string' ? value.description.slice(0,240) : '',hosts:value.hosts.map(host=>host.toLowerCase()),css:value.css};
}
export function geekfoxAddonMatches(hosts, hostname) {
    return hosts.some(host => host === '*' || host === hostname || (host.startsWith('*.') && (hostname === host.slice(2) || hostname.endsWith(host.slice(1)))));
}
export function initializeGeekfoxAddons({read,write,frames,reload,fetchThroughGeekfox}) {
    const features=initializeGeekfoxFeatures({read,write,frames,reload,fetchThroughGeekfox});
    const webextensions=initializeGeekfoxWebExtensions({frames,reload});
    const $=id=>document.getElementById(id), key='gbGeekfoxAddonsV1';
    const builtins=[
        {id:'text',name:'Larger text',description:'Increase paragraph and form text for easier reading.',hosts:['*'],css:'p,li,article,main,label,input,textarea,select { font-size: max(18px, 1.15em) !important; line-height:1.65 !important; }'},
        {id:'motion',name:'Reduce motion',description:'Stop CSS animations and smooth scrolling on websites.',hosts:['*'],css:'*,*::before,*::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; }'},
        {id:'media',name:'Hide images and video',description:'Hide page images and video. Downloads may still occur.',hosts:['*'],css:'img,picture,video,svg,canvas { visibility:hidden !important; }'}
    ];
    const saved=read(key,{}); let custom=[];
    for (const entry of Array.isArray(saved?.custom)?saved.custom.slice(0,20):[]) {
        try { if(typeof entry.id==='string' && /^custom-[a-z0-9-]+$/.test(entry.id)) custom.push({...validateGeekfoxAddon(entry),id:entry.id}); } catch {}
    }
    const enabled=new Set(Array.isArray(saved?.enabled)?saved.enabled:[]), docs=new Map();
    const all=()=>[...builtins,...custom];
    function persist() { write(key,{custom,enabled:[...enabled].filter(id=>all().some(item=>item.id===id))}); }
    function apply(frame) {
        webextensions.apply(frame);
        features.apply(frame);
        try {
            const doc=frame.contentDocument;
            if(!doc?.head) return;
            const entry=frames().find(item=>item.frame===frame);
            const url=entry?.handle?.currentURL?.() || entry?.url;
            const host=new URL(url).hostname.toLowerCase();
            let style=docs.get(frame)?.style;
            if(!style || style.ownerDocument!==doc) {
                docs.get(frame)?.observer.disconnect();
                style=doc.createElement('style'); style.dataset.geekfoxAddon='true';
                const observer=new MutationObserver(()=>{ if(!style.isConnected && doc.head) doc.head.append(style); });
                observer.observe(doc.documentElement,{childList:true,subtree:true}); docs.set(frame,{style,observer});
            }
            const css=all().filter(item=>enabled.has(item.id) && geekfoxAddonMatches(item.hosts,host)).map(item=>item.css).join('\n');
            if(style.textContent!==css) style.textContent=css;
            if(!style.isConnected) doc.head.append(style);
        } catch { /* The website may temporarily be crossing document origins. */ }
    }
    function refresh() {
        webextensions.refresh();
        features.refresh();
        const current=frames();
        for(const [frame,entry] of docs) if(!current.some(item=>item.frame===frame)) { entry.observer.disconnect(); docs.delete(frame); }
        current.forEach(item=>apply(item.frame));
    }
    function render() {
        $('geekfox-addons-list').replaceChildren(...all().map(item=>{
            const row=document.createElement('div'); row.className='geekfox-addon-row';
            const label=document.createElement('label'), toggle=document.createElement('input'); toggle.type='checkbox'; toggle.checked=enabled.has(item.id);
            const caption=document.createElement('span'), name=document.createElement('strong'), note=document.createElement('small');
            name.textContent=item.name; note.textContent=item.description + (item.id.startsWith('custom-')?' · Sites: '+item.hosts.join(', '):'');
            caption.append(name,note); label.append(toggle,caption); row.append(label);
            toggle.addEventListener('change',()=>{toggle.checked?enabled.add(item.id):enabled.delete(item.id);persist();refresh();});
            if(item.id.startsWith('custom-')) { const remove=document.createElement('button'); remove.className='button quiet';remove.textContent='Remove'; remove.setAttribute('aria-label','Remove '+item.name); remove.onclick=()=>{custom=custom.filter(entry=>entry!==item);enabled.delete(item.id);persist();refresh();render();};row.append(remove); }
            return row;
        }));
    }
    $('geekfox-addons').onclick=()=>{render();$('geekfox-addons-dialog').showModal();};
    $('geekfox-addons-close').onclick=()=>$('geekfox-addons-dialog').close();
    $('geekfox-addon-import').onclick=()=>$('geekfox-addon-file').click();
    $('geekfox-addon-file').addEventListener('change',async event=>{
        const file=event.target.files[0]; if(!file)return;
        try {
            if(custom.length>=20) throw new Error('Remove an imported add-on before adding another.');
            if(file.size>65536) throw new Error('Add-on file must be smaller than 64 KiB.');
            const addon=validateGeekfoxAddon(JSON.parse(await file.text())); addon.id='custom-'+crypto.randomUUID(); custom.push(addon);persist();render();
            $('geekfox-addon-status').textContent='Imported '+addon.name+'. Enable it above to apply its styles.';
        } catch(error) { $('geekfox-addon-status').textContent=error instanceof SyntaxError?'Invalid JSON. Download the example for the supported format.':error.message; }
        finally {event.target.value='';}
    });
    $('geekfox-addon-example').onclick=()=>{
        const example={format:'geekfox-style-v1',name:'Comfortable Wikipedia',description:'A larger, more spacious article.',hosts:['*.wikipedia.org'],css:'.mw-body { max-width: 960px !important; margin-inline: auto !important; } p { line-height: 1.8 !important; }'};
        const url=URL.createObjectURL(new Blob([JSON.stringify(example,null,2)],{type:'application/json'}));
        const link=document.createElement('a');link.href=url;link.download='geekfox-addon-example.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    return {apply,refresh,prepare:features.prepare,filterRequest:features.filterRequest};
}
