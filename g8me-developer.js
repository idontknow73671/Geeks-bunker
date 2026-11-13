// Injected before title scripts when capture is explicitly enabled.
export function installG8meConsole(win=window,emit=null) {
    if(win.__gbDeveloperCapture){if(emit){win.__gbDeveloperCapture.emit=emit;for(const entry of win.__gbDeveloperCapture.pending||[])emit(entry);win.__gbDeveloperCapture.pending=[];win.__gbDeveloperCapture.send?.('system',['Capture connected.']);}return;}
    const capture=win.__gbDeveloperCapture={emit,pending:[]};
    const token=Date.now().toString(36)+Math.random().toString(36).slice(2);let sequence=0;
    const format=value=>{
        try {
            const seen=new WeakSet();let budget=120;
            const visit=(item,depth)=>{
                if(typeof item==='string')return item.slice(0,6000);
                if(typeof item==='bigint')return String(item);
                if(!item||typeof item!=='object')return item;
                if(item instanceof win.Error)return String(item.stack||item.message).slice(0,6000);
                if(seen.has(item))return '[Circular]';
                if(depth>4||--budget<0)return '[Truncated]';seen.add(item);
                const result=Array.isArray(item)?[]:{};
                for(const key of Object.keys(item).slice(0,30)){try{result[key]=visit(item[key],depth+1);}catch{result[key]='[Unreadable]';}}
                return result;
            };
            return typeof value==='string'?value.slice(0,6000):JSON.stringify(visit(value,0))??String(value);
        }catch{return '[Unserializable value]';}
    };
    let count=0,started=win.performance.now();
    const send=(level,args)=>{
        // Bound noisy titles before they can flood the parent message queue.
        const now=win.performance.now();if(now-started>1000){count=0;started=now;}if(++count>80)return;
        try{const entry={type:'gb-g8me-console',id:token+':'+(++sequence),level,text:args.map(format).join(' ').slice(0,6000),time:Date.now()};if(capture.emit)capture.emit(entry);else {capture.pending.push(entry);if(capture.pending.length>300)capture.pending.shift();win.parent.postMessage(entry,'*');}}catch{}
    };
    capture.send=send;
    for(const level of ['log','info','debug','warn','error']){
        const original=win.console[level];win.console[level]=function(...args){try{original.apply(this,args);}finally{send(level,args);}};
    }
    win.addEventListener('error',event=>send('error',[event.error?.stack||event.message||('Resource failed: '+(event.target?.src||event.target?.href||'unknown'))]),true);
    win.addEventListener('unhandledrejection',event=>send('error',['Unhandled promise rejection:',event.reason]));
    const address=value=>{try{const url=new win.URL(String(value),win.document.baseURI);return url.origin+url.pathname;}catch{return String(value).split(/[?#]/)[0];}};
    const fetch=win.fetch;
    if(fetch)win.fetch=async function(input,options){const start=win.performance.now(),url=address(typeof input==='string'||input instanceof win.URL?input:input.url);try{const response=await fetch.call(this,input,options);send('network',[(options?.method||input?.method||'GET')+' '+url+' → '+response.status+' ('+Math.round(win.performance.now()-start)+' ms; headers)']);return response;}catch(error){send('network',[url+' → failed: '+error.message]);throw error;}};
    const XHR=win.XMLHttpRequest;
    if(XHR){const open=XHR.prototype.open,sendXHR=XHR.prototype.send;const requests=new WeakMap();XHR.prototype.open=function(method,url,...rest){requests.set(this,{method,url:address(url)});return open.call(this,method,url,...rest);};XHR.prototype.send=function(...args){const request=requests.get(this),start=win.performance.now();if(request)this.addEventListener('loadend',()=>send('network',[request.method+' '+request.url+' → '+this.status+' ('+Math.round(win.performance.now()-start)+' ms)']),{once:true});return sendXHR.apply(this,args);};}
    send('system',['Capture connected. Request URLs omit query strings; bodies and headers are not recorded.']);
}

export function withG8meDeveloper(html,enabled) {
    if(!enabled)return html;
    const script='<script>('+installG8meConsole.toString()+')();</script>';
    const first=html.search(/<script\b/i);
    return first<0?script+html:html.slice(0,first)+script+html.slice(first);
}

export function createG8meDeveloper({button,panel,reload}) {
    let enabled=false,paused=false,frame=null,rows=[],download=null,seen=new Set();
    try{enabled=localStorage.getItem('gbG8meDeveloper')==='on';}catch{}
    panel.innerHTML='<div class="gn-dev-controls"><strong>Developer console</strong><label><input type="checkbox" data-dev="enabled"> Capture logs</label><label><input type="checkbox" data-dev="pause"> Pause display</label><select data-dev="level" aria-label="Log level"><option value="all">All levels</option><option value="error">Errors</option><option value="warn">Warnings</option><option value="network">Network</option><option value="console">Console</option></select><input data-dev="search" type="search" placeholder="Filter logs" aria-label="Filter logs"><button data-dev="clear" class="button">Clear</button><button data-dev="export" class="button">Export logs</button><button data-dev="reload" class="button">Reload g8me</button><a data-dev="download" class="hidden" download="g8me-console.txt">Save log file</a></div><p data-dev="status" role="status"></p><p class="gn-dev-note">Enabling capture reloads the g8me after saving. Logs stay in this tab; review them before sharing. Cross-origin frames and worker-internal logs may be unavailable.</p><pre data-dev="output" tabindex="0" aria-label="G8me console logs"></pre>';
    const $=name=>panel.querySelector('[data-dev="'+name+'"]');$('enabled').checked=enabled;
    function paint(){const level=$('level').value,query=$('search').value.toLowerCase();const visible=rows.filter(row=>(level==='all'||row.level===level||(level==='console'&&['log','info','debug','warn','error'].includes(row.level)))&&row.text.toLowerCase().includes(query));const output=$('output'),bottom=output.scrollHeight-output.scrollTop-output.clientHeight<40;output.textContent=visible.map(row=>'['+new Date(row.time).toLocaleTimeString()+'] '+row.level.toUpperCase()+' '+row.text).join('\n');if(bottom)output.scrollTop=output.scrollHeight;}
    let pending=false;
    function record(level,text,time=Date.now()){rows.push({level,text:String(text).slice(0,6000),time});if(rows.length>300)rows.splice(0,rows.length-300);if(!paused&&!pending){pending=true;requestAnimationFrame(()=>{pending=false;paint();});}}
    function reset(game,mode){frame=null;rows=[];seen.clear();paint();$('status').textContent=enabled?'Waiting for capture connection…':'Capture is off.';record('system',game.name+' · '+mode+' · host viewport '+innerWidth+'×'+innerHeight);}
    const receive=event=>{const data=event.data;if(!enabled||event.source!==frame?.contentWindow||data?.type!=='gb-g8me-console'||!['log','info','debug','warn','error','network','system'].includes(data.level)||typeof data.text!=='string')return;if(typeof data.id==='string'){if(seen.has(data.id))return;seen.add(data.id);if(seen.size>600)seen.delete(seen.values().next().value);}if(data.level==='system')$('status').textContent='Capture connected · latest 300 entries';record(data.level,data.text,Number.isFinite(data.time)&&Math.abs(data.time-Date.now())<86400000?data.time:Date.now());};
    window.addEventListener('message',receive);
    button.addEventListener('click',()=>{panel.classList.toggle('hidden');button.setAttribute('aria-expanded',String(!panel.classList.contains('hidden')));if(!panel.classList.contains('hidden'))paint();});
    $('enabled').addEventListener('change',()=>{enabled=$('enabled').checked;try{localStorage.setItem('gbG8meDeveloper',enabled?'on':'off');}catch{}reload();});
    $('pause').addEventListener('change',()=>{paused=$('pause').checked;if(!paused)paint();});
    $('level').addEventListener('change',paint);$('search').addEventListener('input',paint);
    $('clear').onclick=()=>{rows=[];paint();};$('reload').onclick=reload;
    $('export').onclick=()=>{if(download)URL.revokeObjectURL(download);download=URL.createObjectURL(new Blob([rows.map(row=>new Date(row.time).toISOString()+' '+row.level.toUpperCase()+' '+row.text).join('\n')],{type:'text/plain'}));const link=$('download');link.href=download;link.classList.remove('hidden');link.click();};
    return {get enabled(){return enabled;},reset,record,attach(target){frame=target;if(!enabled)return;target.addEventListener('load',()=>{if(frame!==target||!enabled)return;try{if(target.contentDocument?.URL==='about:blank')return;installG8meConsole(target.contentWindow,data=>receive({source:target.contentWindow,data}));}catch{$('status').textContent='Capture unavailable in this external frame; launch details are still recorded.';}});}};
}
