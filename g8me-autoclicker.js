// Synthetic input stays inside the active, accessible g8me document.
export function createG8meClickLoop(click,onChange=()=>{},clock=globalThis) {
    let timer=null,count=0;
    function stop(){if(timer!==null)clock.clearInterval(timer);timer=null;onChange(false,count);}
    return {stop,get running(){return timer!==null;},start(ms,limit=0){stop();count=0;const interval=Number(ms),maximum=Number(limit);if(!Number.isInteger(interval)||interval<10||interval>60000||!Number.isInteger(maximum)||maximum<0||maximum>1000000)return false;timer=clock.setInterval(()=>{try{const result=click();if(result===false){stop();return;}if(result===null)return;count++;onChange(true,count);if(maximum&&count>=maximum)stop();}catch{stop();}},interval);onChange(true,count);return true;}};
}
export function initializeG8meAutoClicker({host,player}) {
    const byId=id=>document.getElementById(id),panel=byId('gn-clicker-controls'),toggle=byId('gn-clicker-btn'),interval=byId('gn-clicker-ms'),limit=byId('gn-clicker-limit'),keyButton=byId('gn-clicker-key'),start=byId('gn-clicker-start'),notice=byId('gn-clicker-status'),badge=byId('gn-clicker-stop');
    let hotkey={code:'F8',ctrl:false,alt:false,shift:false},recording=false,cursor=null,activeDoc=null,cleanup=()=>{};
    try{const saved=JSON.parse(localStorage.getItem('gb-autoclicker')||'{}');if(Number.isInteger(saved.ms)&&saved.ms>=10&&saved.ms<=60000)interval.value=saved.ms;if(Number.isInteger(saved.limit)&&saved.limit>=0&&saved.limit<=1000000)limit.value=saved.limit;if(saved.hotkey&&/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2])|Space)$/.test(saved.hotkey.code))hotkey={code:saved.hotkey.code,ctrl:!!saved.hotkey.ctrl,alt:!!saved.hotkey.alt,shift:!!saved.hotkey.shift};}catch{}
    function label(){return [hotkey.ctrl?'Ctrl':null,hotkey.alt?'Alt':null,hotkey.shift?'Shift':null,hotkey.code.replace(/^Key|^Digit/,'')].filter(Boolean).join(' + ');}
    function save(){try{localStorage.setItem('gb-autoclicker',JSON.stringify({ms:Number(interval.value),limit:Number(limit.value),hotkey}));}catch{}}
    let counterKind='clicks sent',cookieAccepted=0;
    const loop=createG8meClickLoop(()=>{
        if(!cursor)return null;
        const {doc,x,y}=cursor,view=doc.defaultView;
        if(!view||doc.visibilityState==='hidden')return false;
        if(x<0||y<0||x>=view.innerWidth||y>=view.innerHeight)return null;
        const element=doc.elementFromPoint(x,y);if(!element||element.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return null;
        // Cookie Clicker treats detail:0 as keyboard input and caps it at 3 Hz.
        // Real mouse clicks have detail:1; use the normal event path, never mint cookies.
        const game=view.Game,isCookie=element.id==='bigCookie'&&typeof game?.ClickCookie==='function'&&Number.isFinite(game.cookieClicks);
        const before=isCookie?game.cookieClicks:null;
        counterKind=isCookie?'cookie clicks accepted':'clicks sent';
        const options={bubbles:true,cancelable:true,view,clientX:x,clientY:y,button:0,detail:1};
        for(const type of ['pointerdown','mousedown','pointerup','mouseup','click']){const down=type.endsWith('down'),Ctor=type.startsWith('pointer')?view.PointerEvent:view.MouseEvent;element.dispatchEvent(new Ctor(type,{...options,buttons:down?1:0,pointerId:1,pointerType:'mouse',isPrimary:true}));}
        if(isCookie){if(game.cookieClicks===before)return null;cookieAccepted++;}
        return true;
    },(running,count)=>{const shown=counterKind==='cookie clicks accepted'?cookieAccepted:count;start.textContent=running?'Stop':'Start';start.setAttribute('aria-pressed',String(running));badge.classList.toggle('hidden',!running);badge.textContent='Auto-clicker ON · '+shown+' '+counterKind+' · Stop ('+label()+')';if(count||running)notice.textContent=(running?'Running':'Stopped')+' · '+shown+' '+counterKind;});
    function stop(){loop.stop();}
    function run(){if(loop.running){stop();return;}if(!interval.reportValidity()||!limit.reportValidity())return;if(!activeDoc){notice.textContent='This provider is inaccessible. Try launching through p8y.';return;}save();cookieAccepted=0;counterKind='clicks sent';loop.start(Number(interval.value),Number(limit.value));}
    function keydown(e){
        if(e.code==='Escape'){if(loop.running||recording){stop();recording=false;keyButton.textContent=label();notice.textContent='Stopped.';}return;}
        if(recording){e.preventDefault();e.stopImmediatePropagation();if(!/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2])|Space)$/.test(e.code)||e.metaKey)return;hotkey={code:e.code,ctrl:e.ctrlKey,alt:e.altKey,shift:e.shiftKey};recording=false;keyButton.textContent=label();save();notice.textContent='Hotkey saved. Browser-reserved keys may be intercepted.';return;}
        if(e.repeat||e.metaKey||e.code!==hotkey.code||e.ctrlKey!==hotkey.ctrl||e.altKey!==hotkey.alt||e.shiftKey!==hotkey.shift)return;
        if(e.composedPath().some(node=>node.matches?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')))return;
        if(player.classList.contains('hidden'))return;e.preventDefault();e.stopImmediatePropagation();run();
    }
    keyButton.textContent=label();document.addEventListener('keydown',keydown,true);
    toggle.addEventListener('click',()=>{panel.classList.toggle('hidden');toggle.setAttribute('aria-expanded',String(!panel.classList.contains('hidden')));});
    keyButton.addEventListener('click',()=>{stop();recording=true;keyButton.textContent='Press a key…';notice.textContent='Press a key, optionally with Ctrl, Alt or Shift. Escape cancels.';});
    start.addEventListener('click',run);badge.addEventListener('click',stop);
    for(const field of [interval,limit])field.addEventListener('change',()=>{stop();if(interval.checkValidity()&&limit.checkValidity())save();});
    document.addEventListener('pointermove',e=>{if(e.isTrusted)cursor=null;},true);
    new ResizeObserver(()=>{cursor=null;}).observe(host);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
    return {stop,attach(frame){cleanup();cursor=null;activeDoc=null;stop();notice.textContent='Move the cursor over the g8me and press '+label()+', or press Start then move into the g8me.';
        const docs=new Map(),frames=new Map();let disposed=false;
        function bindFrame(child){if(frames.has(child))return;const loaded=()=>{if(disposed)return;stop();cursor=null;try{const doc=child.contentDocument;if(doc&&doc.URL!=='about:blank')bindDoc(doc);else if(child===frame)activeDoc=null;}catch{if(child===frame)activeDoc=null;}};frames.set(child,loaded);child.addEventListener('load',loaded);loaded();}
        function bindDoc(doc){if(docs.has(doc))return;if(!activeDoc)activeDoc=doc;
            const moved=e=>{if(e.isTrusted)cursor={doc,x:e.clientX,y:e.clientY};};
            const left=e=>{if(e.isTrusted&&!e.relatedTarget&&cursor?.doc===doc)cursor=null;};
            doc.addEventListener('keydown',keydown,true);doc.addEventListener('pointermove',moved,true);doc.addEventListener('pointerdown',moved,true);doc.addEventListener('pointerout',left,true);
            const scan=()=>doc.querySelectorAll('iframe').forEach(bindFrame);const observer=new MutationObserver(scan);observer.observe(doc,{childList:true,subtree:true});scan();
            docs.set(doc,()=>{observer.disconnect();doc.removeEventListener('keydown',keydown,true);doc.removeEventListener('pointermove',moved,true);doc.removeEventListener('pointerdown',moved,true);doc.removeEventListener('pointerout',left,true);});
        }
        bindFrame(frame);cleanup=()=>{disposed=true;stop();for(const [child,loaded]of frames)child.removeEventListener('load',loaded);for(const dispose of docs.values())dispose();cursor=null;activeDoc=null;recording=false;keyButton.textContent=label();};return cleanup;
    }};
}
