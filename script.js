import { initializeGnMath } from "./gn-math.js";

const $ = id => document.getElementById(id);
const read = (key, fallback = null) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Your browser could not save this preference.'); } };
const WALLPAPERS = [
    { id: 'windows', name: 'Windows 11', url: 'images/wallpapers/windows11.jpg' },
    { id: 'playstation', name: 'PlayStation', url: 'images/wallpapers/playstation.jpg' },
    { id: 'macos', name: 'macOS', url: 'images/wallpapers/macos.jpg' }
];
const ACCENTS = [['#8edb44','Xbox green'],['#72b6ff','Sky blue'],['#b4a0ff','Violet'],['#ffb86c','Amber'],['#ff8eb5','Rose'],['#e6eaf0','Silver']];
const DEFAULT_PROFILE = { name: 'Player', wallpaper: 'windows', accent: '#8edb44' };
let profile = read('gbProfileV1');
if (!profile || !WALLPAPERS.some(x => x.id === profile.wallpaper) || !ACCENTS.some(x => x[0] === profile.accent)) profile = null;
let draft = { ...(profile || DEFAULT_PROFILE) };
let route = 'home';
let currentSource = 'gn';
let library;
let featured = [];
let lastGame = null;
let linksPromise;
let builtin = [];
let linkMatches = [];
let linksShown = 0;
const defaultIcon = $('favicon-link').href;
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3800); }
const menuMusic = new Audio('audio/ps4-menu.mp3');
menuMusic.loop = true;
menuMusic.preload = 'none';
const selectSound = new Audio('audio/ps4-select.mp3');
selectSound.preload = 'auto';
selectSound.volume = .4;
let audioUnlocked = false;
let gameIsOpen = false;
let musicEnabled = read('gbMusicEnabled', true);
let musicVolume = Math.min(1, Math.max(0, Number(read('gbMusicVolume', .18)) || 0));
let musicContext;
let musicGain;
let musicSource;
let lastSelectTime = -Infinity;
function updateMusicControls() {
    $('music-toggle').checked = musicEnabled;
    $('music-shortcut').setAttribute('aria-pressed', String(musicEnabled));
    const action = musicEnabled ? 'Turn background music off' : 'Turn background music on';
    $('music-shortcut').setAttribute('aria-label', action);
    $('music-shortcut').title = action;
    $('music-waves').classList.toggle('hidden', !musicEnabled);
    $('music-muted').classList.toggle('hidden', musicEnabled);
    $('music-volume').value = String(Math.round(musicVolume * 100));
    $('music-volume-value').textContent = `${Math.round(musicVolume * 100)}%`;
    if (!musicEnabled) $('music-status').textContent = 'Background music is off.';
    else if (gameIsOpen) $('music-status').textContent = 'Music is paused while a game is open.';
    else if (!audioUnlocked) $('music-status').textContent = 'Music starts after your first click or tap.';
    else if (!menuMusic.paused) $('music-status').textContent = 'Playing softly in the background.';
    else $('music-status').textContent = 'Music is ready to play.';
}
function prepareMusicOutput() {
    // A gain node also controls volume on mobile browsers that ignore audio.volume.
    if (!musicContext) {
        const AudioContextType = window.AudioContext || window.webkitAudioContext;
        if (AudioContextType) {
            musicContext = new AudioContextType();
            musicSource = musicContext.createMediaElementSource(menuMusic);
            musicGain = musicContext.createGain();
            musicSource.connect(musicGain).connect(musicContext.destination);
        }
    }
    if (musicGain) { menuMusic.volume = 1; musicGain.gain.setValueAtTime(musicVolume, musicContext.currentTime); }
    else menuMusic.volume = musicVolume;
    musicContext?.resume().catch(() => {});
}
function syncMusic() {
    if (!musicEnabled || gameIsOpen || !audioUnlocked) { menuMusic.pause(); updateMusicControls(); return; }
    try { prepareMusicOutput(); } catch { menuMusic.volume = musicVolume; }
    if (!menuMusic.paused) { updateMusicControls(); return; }
    menuMusic.play().then(updateMusicControls).catch(error => {
        if (error.name === 'AbortError') return;
        updateMusicControls();
        if (musicEnabled && !gameIsOpen) $('music-status').textContent = 'Tap the speaker button to start the music.';
    });
}
function setMusicEnabled(enabled) {
    musicEnabled = enabled; write('gbMusicEnabled', enabled); syncMusic();
}
function sound() {
    if (!read('gbSounds', true)) return;
    const now = performance.now(); if (now - lastSelectTime < 75) return;
    lastSelectTime = now;
    selectSound.currentTime = 0;
    selectSound.play().catch(() => {});
}
function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    syncMusic();
}
document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    unlockAudio();
    if (event.target.closest('button, a, input[type="checkbox"]')) sound();
}, true);
document.addEventListener('keydown', event => {
    if (['Tab', 'Enter', ' '].includes(event.key)) unlockAudio();
}, true);
$('music-shortcut').addEventListener('click', () => setMusicEnabled(!musicEnabled));
$('music-toggle').addEventListener('change', event => setMusicEnabled(event.target.checked));
$('music-volume').addEventListener('input', event => {
    musicVolume = Number(event.target.value) / 100;
    write('gbMusicVolume', musicVolume);
    syncMusic();
});
menuMusic.addEventListener('playing', updateMusicControls);
menuMusic.addEventListener('pause', updateMusicControls);
menuMusic.addEventListener('error', () => { $('music-status').textContent = 'The music could not be loaded. Try refreshing the page.'; });
updateMusicControls();
// Cancel an interrupted animation before starting the next interaction.
const activeMotions = new Map();
const reducedMotion = () => document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateElement(element, frames, options = {}) {
    if (!element) return Promise.resolve();
    activeMotions.get(element)?.cancel();
    if (reducedMotion() || !element.animate) return Promise.resolve();
    const animation = element.animate(frames, { duration: 240, easing: 'cubic-bezier(.2,.75,.2,1)', ...options });
    activeMotions.set(element, animation);
    return animation.finished.catch(() => {}).finally(() => {
        if (activeMotions.get(element) === animation) activeMotions.delete(element);
        animation.cancel();
    });
}
function reveal(element) {
    return animateElement(element, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }]);
}
function updateIndicators() {
    for (const [container, selected] of [
        [document.querySelector('.topbar nav'), document.querySelector('.nav-item.active')],
        [document.querySelector('.provider-tabs'), document.querySelector('[data-source][aria-selected="true"]')]
    ]) {
        if (!container) continue;
        if (!selected) { container.classList.remove('indicator-ready'); continue; }
        if (!selected.offsetWidth) continue;
        container.style.setProperty('--indicator-x', `${selected.offsetLeft}px`);
        container.style.setProperty('--indicator-width', `${selected.offsetWidth}px`);
        container.classList.add('indicator-ready');
    }
}
window.addEventListener('resize', () => requestAnimationFrame(updateIndicators));
new MutationObserver(updateIndicators).observe(document.querySelector('.provider-tabs'), { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
let setupClosing = false;
async function closePersonalize() {
    if (setupClosing) return;
    const dialog = $('personalize-dialog');
    setupClosing = true;
    try {
        await animateElement(dialog, [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(5px) scale(.985)' }], { duration: 140, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
        dialog.close();
    } finally { setupClosing = false; }
}
function updateChoices() {
    document.querySelectorAll('.accent-choice').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.accent === draft.accent)));
    document.querySelectorAll('.wallpaper-choice').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wallpaper === draft.wallpaper)));
}
function applyProfile(value) {
    const wallpaper = WALLPAPERS.find(x => x.id === value.wallpaper) || WALLPAPERS[0];
    document.documentElement.style.setProperty('--wallpaper', `url("${wallpaper.url}")`);
    document.documentElement.style.setProperty('--accent', value.accent);
    $('welcome-name').textContent = value.name || 'Player';
    $('profile-name').textContent = value.name || 'Player';
    $('profile-avatar').textContent = (value.name || 'P').slice(0, 1).toUpperCase();
}
function renderChoices() {
    $('accent-choices').replaceChildren(...ACCENTS.map(([color,name]) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'accent-choice';
        button.dataset.accent = color; button.style.setProperty('--choice', color); button.setAttribute('aria-label', name); button.setAttribute('aria-pressed', String(draft.accent === color));
        button.addEventListener('click', () => { draft.accent = color; applyProfile(draft); updateChoices(); }); return button;
    }));
    $('wallpaper-choices').replaceChildren(...WALLPAPERS.map(wallpaper => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'wallpaper-choice';
        button.dataset.wallpaper = wallpaper.id; button.setAttribute('aria-label', `${wallpaper.name} wallpaper`); button.setAttribute('aria-pressed', String(draft.wallpaper === wallpaper.id));
        const image = document.createElement('img'); image.src = wallpaper.url; image.alt = '';
        const label = document.createElement('span'); label.textContent = wallpaper.name; button.append(image,label);
        button.addEventListener('click', () => { draft.wallpaper = wallpaper.id; applyProfile(draft); updateChoices(); }); return button;
    }));
}
function personalize() {
    if (setupClosing || $('personalize-dialog').open) return;
    draft = { ...(profile || DEFAULT_PROFILE) };
    $('display-name-input').value = profile?.name || '';
    $('setup-title').textContent = profile ? 'Your dashboard. Your rules.' : 'Make yourself at home.';
    $('setup-eyebrow').textContent = profile ? 'PERSONALIZE YOUR SPACE' : 'WELCOME TO YOUR BUNKER';
    $('setup-cancel').textContent = profile ? 'Cancel' : 'Use defaults';
    $('setup-save').firstChild.textContent = profile ? 'Save changes ' : "Let's play ";
    renderChoices(); $('personalize-dialog').showModal();
    animateElement($('personalize-dialog'), [{opacity:0,transform:'translateY(10px) scale(.975)'},{opacity:1,transform:'translateY(0) scale(1)'}], {duration:260});
}
$('personalize-form').addEventListener('submit', event => {
    event.preventDefault(); if (setupClosing) return; draft.name = $('display-name-input').value.trim() || 'Player';
    profile = { ...draft }; write('gbProfileV1', profile); applyProfile(profile); closePersonalize(); sound();
});
$('setup-cancel').addEventListener('click', () => {
    if (setupClosing) return;
    if (!profile) { profile = { ...DEFAULT_PROFILE }; write('gbProfileV1', profile); }
    applyProfile(profile); closePersonalize();
});
$('personalize-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    if (profile) { applyProfile(profile); closePersonalize(); }
});
$('display-name-input').addEventListener('input', () => { draft.name = $('display-name-input').value.trim() || 'Player'; applyProfile(draft); });
for (const id of ['profile-btn','home-personalize','settings-personalize']) $(id).addEventListener('click', personalize);
function showView(name) {
    if (!['home','games','links','settings','credits'].includes(name)) name = 'home';
    const changed = route !== name;
    route = name;
    document.querySelectorAll('main>.page').forEach(page => page.classList.toggle('hidden', page.id !== `view-${name}`));
    document.querySelectorAll('.nav-item').forEach(button => {
        const active = button.dataset.view === name; button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    updateIndicators();
    if (changed) reveal($(`view-${name}`));
    try { window.parent.location.hash = name; } catch {}
    if (name === 'links') loadWebsites();
    window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('click', event => {
    const nav = event.target.closest('[data-view]');
    if (nav) { event.preventDefault(); sound(); showView(nav.dataset.view); }
});
function updateClock() { $('dashboard-clock').textContent = new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date()); }
updateClock(); setInterval(updateClock,30000);
$('sound-toggle').checked = read('gbSounds',true);
$('sound-toggle').addEventListener('change', event => { write('gbSounds',event.target.checked); sound(); });
$('motion-toggle').checked = read('gbReduceMotion',false);
document.body.classList.toggle('reduce-motion',$('motion-toggle').checked);
$('motion-toggle').addEventListener('change',event => { write('gbReduceMotion',event.target.checked); document.body.classList.toggle('reduce-motion',event.target.checked); if (event.target.checked) for (const motion of activeMotions.values()) motion.cancel(); });
try { $('tab-title-input').value = localStorage.getItem('customTabTitle') || ''; $('tab-icon-select').value = localStorage.getItem('customTabIcon') || ''; } catch {}
function applyTab() { document.title = $('tab-title-input').value.trim() || 'Geeks Bunker'; $('favicon-link').href = $('tab-icon-select').value || defaultIcon; }
applyTab();
$('tab-settings-form').addEventListener('submit',event => {
    event.preventDefault(); applyTab();
    try { localStorage.setItem('customTabTitle',$('tab-title-input').value.trim()); localStorage.setItem('customTabIcon',$('tab-icon-select').value); } catch {}
    $('tab-status').textContent = 'Tab settings saved.';
});
$('about-blank-btn').addEventListener('click', () => {
    const win = window.open('about:blank','_blank'); if (!win) return toast('Allow pop-ups to open a blank tab.');
    win.document.title = document.title;
    Object.assign(win.document.body.style,{margin:'0',height:'100vh',background:'#101318'});
    const frame = win.document.createElement('iframe'); frame.src = document.baseURI;
    Object.assign(frame.style,{width:'100%',height:'100%',border:'0'}); frame.allow = 'fullscreen; autoplay; gamepad; clipboard-write'; frame.allowFullscreen = true;
    win.document.body.append(frame);
    window.parent.location.replace('https://www.google.com');
});
function renderSaved() {
    const saved = read('userSavedLinks',[]);
    $('user-links-grid').replaceChildren();
    if (!Array.isArray(saved) || !saved.length) { const p = document.createElement('p'); p.className='muted'; p.textContent='Keep your favorites close. Save a website to get started.'; $('user-links-grid').append(p); return; }
    saved.forEach((item,index) => {
        const row=document.createElement('div'); row.className='saved-link';
        const link=document.createElement('a'); link.textContent=item.name; link.href=item.url; link.target='_blank'; link.rel='noopener noreferrer';
        const remove=document.createElement('button'); remove.className='delete-link'; remove.textContent='×'; remove.setAttribute('aria-label',`Delete ${item.name}`);
        remove.addEventListener('click',()=>{ saved.splice(index,1); write('userSavedLinks',saved); renderSaved(); }); row.append(link,remove); $('user-links-grid').append(row);
    });
}
$('save-link-form').addEventListener('submit',event => {
    event.preventDefault();
    try {
        let url=$('custom-link-url').value.trim(); if (!/^https?:\/\//i.test(url)) url='https://'+url;
        const parsed=new URL(url); if (!['http:','https:'].includes(parsed.protocol)) throw new Error();
        const saved=read('userSavedLinks',[]); saved.push({name:$('custom-link-name').value.trim(),url:parsed.href}); write('userSavedLinks',saved);
        $('save-link-form').reset(); $('link-feedback').textContent='Website saved.'; renderSaved();
    } catch { $('link-feedback').textContent='Enter a valid website URL.'; }
});
async function getLinks() {
    if (!linksPromise) linksPromise=(async()=>{
        const embedded=$('embedded-links');
        if (embedded) {
            const bytes=Uint8Array.from(atob(embedded.textContent.trim()),char=>char.charCodeAt(0));
            return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
        }
        return (await import('./links.js')).links;
    })().catch(error=>{linksPromise=null;throw error;});
    return linksPromise;
}
function appendWebsites() {
    const fragment=document.createDocumentFragment(); const batch=linkMatches.slice(linksShown,linksShown+100);
    for(const item of batch) { const button=document.createElement('button'); button.className='website-link'; button.textContent=item.name||'Website'; button.addEventListener('click',()=>window.open(typeof item==='string'?item:item.url,'_blank','noopener,noreferrer')); fragment.append(button); }
    linksShown+=batch.length; $('built-in-links-grid').append(fragment); $('website-more').classList.toggle('hidden',linksShown>=linkMatches.length);
    $('builtin-count').textContent=`${linkMatches.length.toLocaleString()} websites · ${linksShown.toLocaleString()} shown`;
}
function filterWebsites() { const query=$('website-search').value.trim().toLowerCase(); linkMatches=builtin.filter(x=>`${x.name} ${x.url}`.toLowerCase().includes(query)); linksShown=0; $('built-in-links-grid').replaceChildren(); appendWebsites(); }
async function loadWebsites() {
    renderSaved(); $('builtin-count').textContent='Loading collection...';
    try { builtin=await getLinks(); filterWebsites(); } catch { $('builtin-count').textContent='Collection unavailable. Select Websites to retry.'; }
}
$('website-search').addEventListener('input',filterWebsites); $('website-more').addEventListener('click',appendWebsites);
$('feeling-lucky-btn').addEventListener('click',async()=>{
    const win=window.open('about:blank','_blank'); if(!win)return toast('Allow pop-ups to open a random website.');
    try { const all=await getLinks(); const item=all[Math.floor(Math.random()*all.length)]; win.opener=null; win.location.href=typeof item==='string'?item:item.url; } catch { win.close();toast('Could not load the website collection.'); }
});
function renderFeatured(games) {
    const picks=[1,6,114,82].map(id=>games.find(g=>g.id===id)).filter(Boolean); featured=picks.length===4?picks:games.slice(0,4);
    $('featured-games').replaceChildren(...featured.map(game=>{
        const card=document.createElement('button'); card.className='featured-card'; card.setAttribute('aria-label',`Play ${game.name}`);
        const image=document.createElement('img'); image.src=game.cover; image.alt=''; image.addEventListener('error',()=>image.remove(),{once:true});
        const label=document.createElement('span'); label.className='featured-caption';label.textContent=game.name;
        card.append(image,label); card.addEventListener('click',()=>library.launch(game,card)); return card;
    }));
}
document.addEventListener('catalogready',event=>{ if(event.detail.source==='gn') renderFeatured(event.detail.games); });
document.addEventListener('gameplayed',event=>{ lastGame=event.detail; write('gbRecentGame',{name:lastGame.name,source:lastGame.provider||'gn',id:lastGame.id}); updateRecent(); });
function updateRecent() { const recent=read('gbRecentGame'); if(recent){$('recent-title').textContent=recent.name;$('recent-description').textContent=`Continue from ${recent.source==='lumin'?'Lumin':'GN Math'}`;} }
$('recent-game').addEventListener('click',async()=>{
    if(lastGame)return library.launch(lastGame,$('recent-game'));
    const recent=read('gbRecentGame'); if(recent){showView('games');await library.setSource(recent.source);const game=library.getGames().find(x=>String(x.id)===String(recent.id));if(game)return library.launch(game,$('recent-game'));} else showView('games');
});
for(const button of document.querySelectorAll('[data-source]'))button.addEventListener('click',()=>{sound();currentSource=button.dataset.source;library.setSource(currentSource);});
document.querySelectorAll('[data-source]').forEach(button=>button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?'gn':event.key==='End'?'lumin':button.dataset.source==='gn'?'lumin':'gn';
    library.setSource(next);document.querySelector(`[data-source="${next}"]`).focus();
}));
library=initializeGnMath({
    rebuildButtons:()=>{},
    onOpen:()=>{ gameIsOpen=true; syncMusic(); reveal($('gn-game-player')); },
    onClose:()=>{ gameIsOpen=false; syncMusic(); reveal($(`view-${route}`)); },
    playSound:sound
});
applyProfile(profile||DEFAULT_PROFILE);updateRecent();
let initial='home';try{initial=window.parent.location.hash.slice(1)||'home';}catch{}showView(initial);
if(!profile)personalize();
