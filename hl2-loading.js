import { hl2LoadingAssets } from './hl2-loading-assets.js';

// Self-contained because the launcher runs inside the isolated g8me document.
export function installHalfLife2Loading(assets) {
    const root=document.getElementById('launcher-ui');
    const pictures=Array.from(root.querySelectorAll('.hl2-loading-picture'));
    const sound=root.querySelector('#hl2-loading-sound');
    const music=new Audio(assets.music);
    music.loop=true;music.volume=0.4;
    let index=0,front=0,ended=false,muted=false,blocked=false,fadeFrame=0;
    pictures[0].src=assets.images[0];pictures[0].classList.add('visible');
    // Decode upcoming pictures ahead of their turn, without delaying the engine.
    assets.images.slice(1).forEach(src=>{const image=new Image();image.src=src;});
    function label(){sound.textContent=muted?'Enable loading music':blocked?'Enable loading music':'Mute loading music';sound.setAttribute('aria-pressed',String(!muted&&!blocked));}
    function play(){
        if(ended||muted)return;
        try{const result=music.play();Promise.resolve(result).then(()=>{if(ended){music.pause();return;}blocked=false;label();}).catch(()=>{if(!ended){blocked=true;label();}});}catch{blocked=true;label();}
    }
    function gesture(event){if(event.target?.closest?.('#hl2-loading-sound'))return;if(blocked&&!muted)play();}
    sound.addEventListener('click',()=>{if(ended)return;if(blocked||muted){muted=false;blocked=false;play();}else{muted=true;music.pause();}label();});
    window.addEventListener('pointerdown',gesture);
    window.addEventListener('keydown',gesture);
    label();play();
    const slides=setInterval(()=>{
        if(ended)return;
        index=index+1<assets.images.length?index+1:2; // Valve intros once, then HL2 artwork.
        const next=1-front;pictures[next].src=assets.images[index];
        pictures[next].classList.add('visible');pictures[front].classList.remove('visible');front=next;
    },5000);
    function finish(){
        if(ended)return;ended=true;
        clearInterval(slides);window.removeEventListener('pointerdown',gesture);window.removeEventListener('keydown',gesture);
        root.classList.add('hl2-loading-finished');
        const began=performance.now(),volume=music.volume;
        function fade(now){music.volume=volume*Math.max(0,1-(now-began)/3000);if(now-began<3000)fadeFrame=requestAnimationFrame(fade);}
        fadeFrame=requestAnimationFrame(fade);
        setTimeout(()=>{cancelAnimationFrame(fadeFrame);music.pause();music.removeAttribute('src');music.load();root.style.display='none';document.getElementById('canvas')?.focus();},3000);
    }
    window.addEventListener('pagehide',finish,{once:true});
    return {finish};
}

export function prepareHalfLife2Loading(html) {
    if(html.includes('gbHl2LoadingScreen'))return html;
    const start=html.indexOf('    <div id="launcher-ui">'),end=html.indexOf('    <div id="crash-overlay">',start);
    if(start<0||end<start)return html; // Other launcher versions keep their own UI.
    const dismiss=/      function dismissLauncher\(\) \{[\s\S]*?\n      \}/;
    if(!dismiss.test(html)||!html.includes('      function showCrash(err) {'))throw Error('HL2 loading-screen hooks changed');
    const style=`<style id="gbHl2LoadingScreen">
#launcher-ui{padding:0;background:#000;display:block;opacity:1;transition:opacity 3s ease;overflow:hidden}
#launcher-ui::before{display:none}
#launcher-ui.hl2-loading-finished{opacity:0;pointer-events:none}
.hl2-loading-picture{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;background:#000}
.hl2-loading-picture.visible{animation:hl2-slide 5s ease both}
@keyframes hl2-slide{0%{opacity:0}20%,80%{opacity:1}100%{opacity:0}}
#hl2-loading-footer{position:absolute;bottom:26px;left:32px;right:32px;display:flex;justify-content:space-between;align-items:end;gap:24px;color:#eee;font:13px Arial,sans-serif;text-shadow:0 1px 4px #000}
#progress-box{display:block;width:min(380px,65vw);margin:0}
#txt-status{letter-spacing:.08em;font-size:11px}#txt-file,#txt-bytes{display:none}
.meter-rail{height:2px;background:#ffffff30;margin:10px 0 0}.meter-fill{height:100%;background:#eee;transition:width .3s ease}
#hl2-loading-sound{border:1px solid #ffffff45;border-radius:3px;padding:8px 12px;background:#0008;color:#eee;font:12px Arial,sans-serif;cursor:pointer}
#btn-start{display:none}#gb-hl2-transfer{display:none}
@media(max-width:500px){#hl2-loading-footer{left:16px;right:16px;bottom:16px;gap:12px}#progress-box{width:55vw}}
</style>`;
    const markup=`    <div id="launcher-ui" aria-label="Half-Life 2 loading">
<img class="hl2-loading-picture" alt="Half-Life 2 loading artwork"/><img class="hl2-loading-picture" alt=""/>
<div id="hl2-loading-footer"><div id="progress-box" role="status" aria-live="polite"><span id="txt-status">LOADING HALF-LIFE 2</span><span id="txt-pct" hidden>0%</span><div class="meter-rail"><div id="bar-fill" class="meter-fill"></div></div><span id="txt-file"></span><span id="txt-bytes"></span></div><button id="hl2-loading-sound" type="button">Mute loading music</button></div><button id="btn-start" hidden></button>
</div>\n\n`;
    html=html.slice(0,start)+markup+html.slice(end);
    html=html.replace('</head>',style+'\n</head>');
    html=html.replace(dismiss,`      function dismissLauncher() {
        if(g_engineInitialized)return;
        g_engineInitialized=true;
        window.gbHl2Loading?.finish();
      }`);
    html=html.replace('      function showCrash(err) {','      function showCrash(err) {\n        window.gbHl2Loading?.finish();');
    // This is after Module/loader declarations, so initialization cannot race them.
    const script=`\nwindow.gbHl2Loading=(${installHalfLife2Loading.toString()})(${JSON.stringify(hl2LoadingAssets)});\nstartApp();\n`;
    const closing=html.lastIndexOf('    </script>');
    if(closing<0)throw Error('HL2 launcher script is missing');
    return html.slice(0,closing)+script+html.slice(closing);
}
