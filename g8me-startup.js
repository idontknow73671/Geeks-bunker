// FivePlay's main WASM thread reads this cache before attempting synchronous XHR.
// Populate it asynchronously in its own loader worker; no g8me assets are bundled.
export function isFivePlayLoader(url) {
    try{const parsed=new URL(url);return parsed.protocol==='https:'&&['fiveplay.lol','cdn.fiveplay.lol'].includes(parsed.hostname)&&/^\/b\/[^/]+\/loader\.js$/.test(parsed.pathname);}catch{return false;}
}
export function prepareFivePlayLoader(script) {
    if(script.includes('gbFivePlayManifestReady'))return script;
    const handler=/self\.onmessage\s*=\s*\(ev\)\s*=>\s*\{/;
    const message=/const m = ev\.data;/;
    if(!handler.test(script)||!message.test(script))throw Error('FivePlay changed its loader. Its compatibility adapter needs an update.');
    const preload=`const m = ev.data;
    // gbFivePlayManifestReady: avoid the disabled synchronous XHR fallback.
    try {
    const gbManifestResponse=await fetch('https://fiveplay.lol/data/manifest.json',{cache:'no-store'});
    if(!gbManifestResponse.ok)throw new Error('FivePlay manifest returned HTTP '+gbManifestResponse.status);
    const gbManifestText=await gbManifestResponse.text();
    const gbManifestData=JSON.parse(gbManifestText);
    if(!Array.isArray(gbManifestData.files)||!gbManifestData.files.some(file=>file[0]==='x64/audio/audio.rpf'))throw new Error('FivePlay manifest is missing the startup audio archive.');
    globalThis.__httpfsManifest=new TextEncoder().encode(gbManifestText);
    } catch(error) {
        if(typeof BroadcastChannel==='function'){const channel=new BroadcastChannel('game-crash');channel.postMessage({kind:'manifest',text:String(error.message||error),tail:[]});channel.close();}
        throw error;
    }`;
    return script.replace(handler,'self.onmessage = async (ev) => {').replace(message,preload);
}
export function g8meStartupFailure(text) {
    const message=String(text||'').trim();
    return /^The game stopped\s*\(/i.test(message)?message.slice(0,600):null;
}
export function watchG8meStartup(frame,onFailure) {
    let observer=null,reported=false;
    function loaded(){observer?.disconnect();reported=false;try{const hud=frame.contentDocument?.getElementById('hud');if(!hud)return;const check=()=>{const failure=g8meStartupFailure(hud.textContent);if(failure&&!reported){reported=true;onFailure(failure);}};observer=new MutationObserver(check);observer.observe(hud,{childList:true,subtree:true,characterData:true});check();}catch{}}
    frame.addEventListener('load',loaded);
    return ()=>{observer?.disconnect();frame.removeEventListener('load',loaded);};
}
