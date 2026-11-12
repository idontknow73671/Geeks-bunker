import { loadGeekfoxBlocker, geekfoxShouldBlock } from "./geekfox-features.js";
export function g8meFrameSandbox(enabled=true) {
    return 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads allow-modals allow-presentation'+(enabled?'':' allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
}
// Injected only into direct GN documents, before any title scripts run.
function installG8meGuard(sourceUrl) {
    const blocked=(input,type)=>{try{return !!parent.__gbG8meFilter?.({url:new URL(String(input),document.baseURI).href,sourceUrl,type});}catch{return false;}};
    Object.defineProperty(window,'open',{configurable:true,writable:true,value:()=>null});
    document.addEventListener('click',event=>{const anchor=event.target.closest?.('a[target]');if(anchor&&anchor.target&&!['_self','_parent'].includes(anchor.target.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();}},true);
    const fetch=window.fetch;window.fetch=function(input,options){if(blocked(typeof input==='string'||input instanceof URL?input:input.url,'xmlhttprequest'))return Promise.resolve(new Response(null,{status:204}));return fetch.call(this,input,options);};
    const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send,urls=new WeakMap();
    XMLHttpRequest.prototype.open=function(method,url,...args){urls.set(this,url);return open.call(this,method,url,...args);};
    XMLHttpRequest.prototype.send=function(...args){if(blocked(urls.get(this),'xmlhttprequest')){this.abort();this.dispatchEvent(new Event('error'));this.dispatchEvent(new Event('loadend'));return;}return send.apply(this,args);};
    function clean(node){
        if(node.nodeType!==1&&node.nodeType!==11)return true;
        if(node.nodeType===1){const tag=node.tagName.toLowerCase(),type={script:'script',iframe:'sub_frame',img:'image',embed:'object',object:'object',link:'stylesheet'}[tag];const url=node.getAttribute(tag==='object'?'data':tag==='link'?'href':'src');if(type&&url&&blocked(url,type))return false;}
        for(const child of [...node.childNodes])if(!clean(child))child.remove();return true;
    }
    for(const method of ['appendChild','insertBefore','replaceChild']){const original=Node.prototype[method];Node.prototype[method]=function(node,...args){if(!clean(node))return method==='replaceChild'?args[0]:node;return original.call(this,node,...args);};}
}
export function createG8meGuard({button,status,reload}) {
    let enabled=true,engine=null,Request=null,count=0,ready=false,coverage=true;
    try{enabled=localStorage.getItem('gbG8meBlocker')!=='off';}catch{}
    const paint=()=>{button.textContent='Ad blocker: '+(enabled?'On':'Off');button.setAttribute('aria-pressed',String(enabled));status.textContent=enabled?(!coverage?'Popups blocked · Use p8y for ad filtering':ready?'Ads filtered · '+count+' requests blocked · Popups blocked':'Popup protection on'):'G8me ad blocker off';};
    function filter(details){if(!enabled||!engine)return false;const result=geekfoxShouldBlock(engine,Request,details);if(result){count++;paint();}return result;}
    window.__gbG8meFilter=filter;
    button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem('gbG8meBlocker',enabled?'on':'off');}catch{}paint();reload();});paint();
    return {get enabled(){return enabled;},filterRequest:filter,async prepare(networkCoverage=true){coverage=networkCoverage;count=0;if(enabled&&coverage){try{({engine,Request}=await loadGeekfoxBlocker());ready=true;}catch(error){status.textContent='Popup protection on · Ad filters unavailable: '+error.message;return;}}paint();},
        protectHTML(html,url){if(!enabled||!engine)return html;const doc=new DOMParser().parseFromString(html,'text/html');
            for(const node of doc.querySelectorAll('script[src],iframe[src],img[src],link[href],object[data],embed[src]')){const tag=node.localName,type={script:'script',iframe:'sub_frame',img:'image',link:'stylesheet',object:'object',embed:'object'}[tag],value=node.getAttribute(tag==='link'?'href':tag==='object'?'data':'src');try{if(filter({url:new URL(value,url).href,sourceUrl:url,type}))node.remove();}catch{}}
            const script=doc.createElement('script');script.textContent='('+installG8meGuard.toString()+')('+JSON.stringify(url).replace(/</g,'\\u003c')+');';doc.head.prepend(script);return '<!doctype html>'+doc.documentElement.outerHTML;
        }
    };
}
