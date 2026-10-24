// Native dashboard UI; the reference services supply catalogs and playback sources.
export function initializeMedia({read,write,toast,reveal,onPlayback}) {
    const $ = id => document.getElementById(id);
    const apiPool = ['https://api.spf50krem.com','https://api.tuplantaforma.com','https://api.fotograflar.com'];
    let service=read('gbMediaAPI',apiPool[0]);if(!apiPool.includes(service))service=apiPool[0];
    const engine = () => (window.parent.GeekfoxEngine || window.GeekfoxEngine).startMedia(service);
    async function api(path) {
        if(!/^\/api\/(?:music\/ytm\/|movies\/)/.test(path))throw new Error('Unsupported media request.');
        let failure;
        for(const origin of [service,...apiPool.filter(host=>host!==service)]) {
            try {
                const response=await fetch(origin+path,{credentials:'omit',signal:AbortSignal.timeout(15000)});
                if(!response.ok)throw new Error('Media service returned '+response.status+'.');
                let result;
                if(response.headers.get('Content-Type')?.includes('text/event-stream')) {
                    const text=await response.text();result=[];
                    for(const line of text.split(/\r?\n/)) {
                        if(!line.startsWith('data:'))continue;
                        const payload=line.slice(5).trim();if(!payload||payload==='[DONE]')continue;
                        const record=JSON.parse(payload);if(record.error)throw new Error(record.error);result.push(record);
                    }
                } else result=await response.json();
                service=origin;write('gbMediaAPI',origin);return result;
            } catch(error){failure=error;}
        }
        throw failure||new Error('The media services could not connect.');
    }
    const normalizeTrack=track=>({...track,image:track.image||track.thumb||'https://i.ytimg.com/vi/'+encodeURIComponent(track.id)+'/mqdefault.jpg'});
    const normalizeMovie=title=>({...title,poster_path:title.poster_path||title.posterPath||title.poster,release_date:title.release_date||title.releaseDate||title.year,vote_average:title.vote_average||title.voteAverage||title.rating});
    const element = (tag,className,text) => {
        const node = document.createElement(tag); if (className) node.className=className;
        if (text !== undefined) node.textContent=text; return node;
    };
    const button = (label,action,className='button') => {
        const node=element('button',className,label);node.type='button';node.addEventListener('click',action);return node;
    };
    function image(url,className) {
        const node=element('img',className);node.alt='';node.loading='lazy';
        try { const address=new URL(url);if(address.protocol==='https:'||address.protocol==='blob:')node.src=address.href; }catch{}
        node.addEventListener('error',()=>node.remove(),{once:true});return node;
    }
    const clock = seconds => Number.isFinite(seconds) ? Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0') : '0:00';
    const audio=new Audio();audio.preload='metadata';
    let current=null,queue=[],position=-1,shuffle=false,repeat=false,musicView='search',lastSearch='',musicRequest=0;
    let liked=read('gbAudibleLiked',[]);if(!Array.isArray(liked))liked=[];
    audio.volume=Math.max(0,Math.min(1,Number(read('gbAudibleVolume',.65))||0));$('ag-volume').value=audio.volume;
    const localURLs=new Set();
    let movieActive=false;
    function playback() { onPlayback(movieActive||!audio.paused); }
    function now() {
        $('ag-play').disabled=!current;$('ag-like').disabled=!current||!!current.local;
        $('ag-play').textContent=audio.paused?'▶':'Ⅱ';$('ag-play').setAttribute('aria-label',audio.paused?'Play':'Pause');
        $('ag-title').textContent=current?.title||'Nothing playing';$('ag-artist').textContent=current?.artist||'Pick something you love.';
        const art=$('ag-art');if(art.dataset.track!==String(current?.id||'')){art.replaceChildren();if(current?.image)art.append(image(current.image,''));else art.textContent='♫';art.dataset.track=String(current?.id||'');}
        const favorite=!!current&&liked.some(track=>String(track.id)===String(current.id));
        $('ag-like').textContent=favorite?'♥':'♡';$('ag-like').setAttribute('aria-pressed',String(favorite));
    }
    function showTracks(tracks,heading) {
        $('ag-heading').textContent=heading;$('ag-results').replaceChildren();
        for(const [i,track] of tracks.entries()) {
            const row=element('div','track-row');
            const play=button('▶',()=>{queue=[...tracks];position=i;playTrack(track);},'track-play');play.setAttribute('aria-label','Play '+track.title);
            const cover=element('span','track-art');if(track.image)cover.append(image(track.image,''));else cover.textContent='♫';
            const info=element('div','track-info');info.append(element('strong','',track.title),element('span','',track.artist||'Unknown artist'));
            const add=button('＋',()=>{queue.push(track);toast('Added to the queue.');},'geekfox-icon');add.setAttribute('aria-label','Add '+track.title+' to queue');
            row.append(play,cover,info,element('time','track-duration',clock(track.duration)),add);$('ag-results').append(row);
        }
        if(!tracks.length)$('ag-status').textContent=heading==='Liked tracks'?'Tracks you like will appear here.':'No tracks here yet.';
    }
    function setMusicView(view) {
        musicView=view;
        for(const key of ['search','liked','queue'])$('ag-'+key+'-tab').classList.toggle('active',key===view);
        $('ag-status').textContent='';$('ag-retry').classList.add('hidden');
        if(view==='liked')showTracks(liked,'Liked tracks');
        else if(view==='queue')showTracks(queue,'Your queue');
        else if(lastSearch)searchMusic(lastSearch);else loadMusicHome();
    }
    async function searchMusic(query) {
        const request=++musicRequest;lastSearch=query;musicView='search';
        for(const key of ['search','liked','queue'])$('ag-'+key+'-tab').classList.toggle('active',key==='search');
        $('ag-status').textContent='Searching music…';$('ag-retry').classList.add('hidden');$('ag-results').replaceChildren();
        try {
            const result=await api('/api/music/ytm/search?q='+encodeURIComponent(query)+'&limit=30');
            if(request!==musicRequest||musicView!=='search')return;
            const tracks=Array.isArray(result)?result.map(normalizeTrack):[];
            showTracks(tracks,'Search results');$('ag-status').textContent=tracks.length?tracks.length+' tracks found.':'No tracks found. Try another search.';
        } catch(error) {
            if(request!==musicRequest||musicView!=='search')return;
            $('ag-heading').textContent='Music service unavailable';
            $('ag-status').textContent='The music search couldn’t finish: '+error.message+' You can retry or play music files from your device.';
            $('ag-retry').classList.remove('hidden');
        }
    }
    async function playTrack(track,seek=0) {
        audio.pause();current=track;now();
        audio.src=track.local?track.url:service+'/api/sp/audio/'+encodeURIComponent(track.id);
        $('ag-status').textContent='Loading '+track.title+'…';
        if(seek)audio.addEventListener('loadedmetadata',()=>{audio.currentTime=Math.min(seek,audio.duration||seek);},{once:true});
        try{await audio.play();}catch(error){if(error.name!=='AbortError'){$('ag-status').textContent='This track couldn’t play. The music service may be unavailable, or this format may not be supported.';now();}}
    }
    function advance(direction) {
        if(!queue.length)return;
        position=shuffle?Math.floor(Math.random()*queue.length):(position+direction+queue.length)%queue.length;
        playTrack(queue[position]);
    }
    for(const name of ['search','liked','queue'])$('ag-'+name+'-tab').addEventListener('click',()=>{musicRequest++;setMusicView(name);});
    $('ag-search-form').addEventListener('submit',event=>{event.preventDefault();const query=$('ag-query').value.trim();if(query.length>=2)searchMusic(query);});
    $('ag-retry').addEventListener('click',()=>lastSearch?searchMusic(lastSearch):loadMusicHome());
    $('ag-play').addEventListener('click',()=>{if(!current)return;if(audio.paused)audio.play().catch(()=>toast('Playback unavailable. Try another track.'));else audio.pause();});
    $('ag-prev').addEventListener('click',()=>{if(audio.currentTime>3)audio.currentTime=0;else advance(-1);});
    $('ag-next').addEventListener('click',()=>advance(1));
    $('ag-shuffle').addEventListener('click',()=>{$('ag-shuffle').setAttribute('aria-pressed',String(shuffle=!shuffle));});
    $('ag-repeat').addEventListener('click',()=>{$('ag-repeat').setAttribute('aria-pressed',String(repeat=!repeat));});
    $('ag-like').addEventListener('click',()=>{
        if(!current||current.local)return;
        liked=liked.some(track=>String(track.id)===String(current.id))?liked.filter(track=>String(track.id)!==String(current.id)):[...liked,current];
        write('gbAudibleLiked',liked);now();if(musicView==='liked')showTracks(liked,'Liked tracks');
    });
    $('ag-volume').addEventListener('input',event=>{audio.volume=Number(event.target.value);write('gbAudibleVolume',audio.volume);});
    $('ag-seek').addEventListener('input',event=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(event.target.value)/1000;});
    $('ag-files').addEventListener('change',event=>{
        const tracks=[...event.target.files].filter(file=>file.type.startsWith('audio/')||/\.(mp3|m4a|ogg|wav|flac|aac)$/i.test(file.name)).map(file=>{
            const url=URL.createObjectURL(file);localURLs.add(url);return{id:url,title:file.name.replace(/\.[^.]+$/,''),artist:'On your device',local:true,url};
        });
        if(tracks.length){queue.push(...tracks);position=queue.length-tracks.length;playTrack(queue[position]);setMusicView('queue');}
        event.target.value='';
    });
    audio.addEventListener('play',()=>{now();playback();$('ag-status').textContent='Playing '+current.title;});
    audio.addEventListener('pause',()=>{now();playback();if(current)$('ag-status').textContent='Paused '+current.title;});
    audio.addEventListener('error',()=>{$('ag-status').textContent='Playback unavailable. Try another track or open a music file from your device.';now();playback();});
    audio.addEventListener('timeupdate',()=>{$('ag-elapsed').textContent=clock(audio.currentTime);$('ag-duration').textContent=clock(audio.duration);$('ag-seek').disabled=!Number.isFinite(audio.duration);$('ag-seek').value=Number.isFinite(audio.duration)?String(audio.currentTime/audio.duration*1000):'0';});
    audio.addEventListener('ended',()=>{if(repeat){audio.currentTime=0;audio.play().catch(()=>{});}else if(queue.length>1)advance(1);});
    window.addEventListener('pagehide',()=>{audio.pause();for(const url of localURLs)URL.revokeObjectURL(url);});

    let catalog=null,catalogTask=null,category='popular',movie=null,frame=null,handle=null,movieRequest=0,playerTimer=null;
    let watchlist=read('gbMovieWatchlist',[]);if(!Array.isArray(watchlist))watchlist=[];
    const movieName=title=>title.title||title.name||'Untitled';
    function renderMovies(titles,label) {
        const list=Array.isArray(titles)?titles:[];$('gm-grid').replaceChildren();$('gm-status').textContent=list.length+' movies · '+label;
        for(const raw of list) {
            const title=normalizeMovie(raw);
            const card=button('',()=>openMovie(title),'movie-card');
            const artwork=element('span','movie-art');if(title.poster_path)artwork.append(image(service+'/api/movies/img/w500'+title.poster_path,''));else artwork.textContent='▷';
            artwork.append(element('span','movie-card-play','▶'));
            const text=element('span','movie-card-caption');text.append(element('strong','',movieName(title)),element('span','',[(title.release_date||'').slice(0,4),title.vote_average?'★ '+Number(title.vote_average).toFixed(1):''].filter(Boolean).join(' · ')));
            card.append(artwork,text);card.setAttribute('aria-label','Open '+movieName(title));$('gm-grid').append(card);
        }
    }
    async function loadCatalog() {
        if(catalogTask)return catalogTask;
        $('gm-status').textContent='Loading the movie collection…';$('gm-retry').classList.add('hidden');
        catalogTask=(async()=>{
            try {
                const result=await api('/api/movies/home?type=movie');
                const rows=Array.isArray(result.rows)?result.rows:[];
                const unique=items=>[...new Map(items.map(title=>[String(title.id),normalizeMovie(title)])).values()];
                catalog={popular:unique(rows.find(row=>row.title==='Popular')?.items||result.top10||[]),topRated:unique(rows.find(row=>row.title==='Top rated')?.items||[]),discover:unique(rows[0]?.items||result.hero||[]),allTitles:unique(rows.flatMap(row=>row.items||[]))};
                if(!catalog.popular.length)throw new Error('The movie catalog is empty.');
                if(category!=='search'&&category!=='watchlist')renderMovies(catalog[category],category==='topRated'?'Top rated':category==='allTitles'?'All movies':category);
            }catch(error){$('gm-status').textContent='Couldn’t load movies: '+error.message;$('gm-retry').classList.remove('hidden');}
            finally{catalogTask=null;}
        })();return catalogTask;
    }
    function saveLabel() {const saved=!!movie&&watchlist.some(item=>item.id===movie.id);$('gm-save').textContent=saved?'✓ In watchlist':'＋ Watchlist';$('gm-save').setAttribute('aria-pressed',String(saved));}
    async function openMovie(title) {
        movie=title;const request=++movieRequest;movieActive=false;playback();disposeMovie();
        $('gm-room').classList.remove('hidden');$('gm-title').textContent=movieName(title);$('gm-overview').textContent=title.overview||'';saveLabel();
        $('gm-grid').classList.add('hidden');$('gm-source').replaceChildren();$('gm-source').disabled=true;$('gm-watch').disabled=true;
        $('gm-player-status').textContent='Checking playback sources…';reveal($('gm-room'));
        await loadSources(request);
    }
    function loadSources(request=++movieRequest) {
        if(!movie||request!==movieRequest)return;
        const id=encodeURIComponent(movie.id);
        const sources=[{label:'VidZee',url:'https://player.vidzee.wtf/embed/movie/'+id},{label:'vidsrc.su',url:'https://vidsrc.su/embed/movie/'+id},{label:'CineSrc',url:'https://cinesrc.st/embed/movie/'+id+'?color='+encodeURIComponent(read('gbProfileV1',{}).accent||'#8edb44')+'&back=close'}];
        $('gm-source').replaceChildren(...sources.map(source=>{const option=element('option','',source.label);option.value=source.url;return option;}));
        const preferred=read('gbMovieSource','');if(sources.some(source=>source.url.includes(preferred))&&preferred)$('gm-source').value=sources.find(source=>source.url.includes(preferred)).url;
        $('gm-source').disabled=false;$('gm-watch').disabled=false;$('gm-check-sources').disabled=false;
        $('gm-player-status').textContent='Choose a source, then press Watch movie.';
    }
    function disposeMovie(){clearTimeout(playerTimer);handle?.dispose();handle=null;frame?.remove();frame=null;}
    async function watchMovie(){
        const url=$('gm-source').value;if(!url||!movie)return;
        const request=++movieRequest;disposeMovie();audio.pause();$('gm-player-status').textContent='Opening the selected source through Geekfox…';
        try {
            const runtime=await engine();if(request!==movieRequest)return;
            frame=document.createElement('iframe');frame.title=movieName(movie)+' player';frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;
            $('gm-frame-host').replaceChildren(frame);
            handle=runtime.attach(frame,{url:()=>{if(request===movieRequest)$('gm-player-status').textContent='Source opened · If playback fails, choose another source.';},error:error=>{if(request===movieRequest){clearTimeout(playerTimer);$('gm-player-status').textContent=error.message;}}});
            handle.go(url);movieActive=true;playback();
            playerTimer=setTimeout(()=>{if(request===movieRequest)$('gm-player-status').textContent='If the player stays blank, select another source and press Watch movie.';},25000);
            frame.addEventListener('load',()=>{
                if(request!==movieRequest)return;
                try {
                    const doc=frame.contentDocument;if(!doc?.body?.children.length)return;
                    if (/^Error response$/.test(doc.title)||/Internal Service Worker Error|Geekfox connection expired/.test(doc.body.innerText)) {
                        clearTimeout(playerTimer);$('gm-player-status').textContent='The player connection failed. Retry Watch movie or choose another source.';return;
                    }
                } catch {}
                clearTimeout(playerTimer);$('gm-player-status').textContent='Source opened · Playback availability depends on the selected source.';
            });
        }catch(error){if(request===movieRequest){$('gm-player-status').textContent=error.message;movieActive=false;playback();}}
    }
    function closeMovie(){movieRequest++;disposeMovie();movieActive=false;playback();$('gm-room').classList.add('hidden');$('gm-grid').classList.remove('hidden');$('gm-check-sources').disabled=false;}
    $('gm-save').addEventListener('click',()=>{if(!movie)return;watchlist=watchlist.some(item=>item.id===movie.id)?watchlist.filter(item=>item.id!==movie.id):[...watchlist,movie];write('gbMovieWatchlist',watchlist);saveLabel();if(category==='watchlist')renderMovies(watchlist,'Watchlist');});
    $('gm-watchlist').addEventListener('click',()=>{movieRequest++;category='watchlist';closeMovie();renderMovies(watchlist,'Watchlist');setCategory();});
    function setCategory(){document.querySelectorAll('[data-movie-category]').forEach(button=>{const active=button.dataset.movieCategory===category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}
    document.querySelectorAll('[data-movie-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.movieCategory;movieRequest++;closeMovie();setCategory();if(catalog)renderMovies(catalog[category],button.textContent);else loadCatalog();}));
    $('gm-search-form').addEventListener('submit',async event=>{
        event.preventDefault();const query=$('gm-query').value.trim();if(query.length<2){category='popular';setCategory();if(catalog)renderMovies(catalog.popular,'Popular');return;}
        closeMovie();category='search';setCategory();const request=++movieRequest;$('gm-status').textContent='Searching movies…';
        try{const result=await api('/api/movies/search?q='+encodeURIComponent(query)+'&type=movie');if(request===movieRequest)renderMovies(result.results||[], 'Search results');}
        catch(error){if(request===movieRequest)$('gm-status').textContent='Search unavailable: '+error.message;}
    });
    $('gm-retry').addEventListener('click',()=>loadCatalog());$('gm-check-sources').addEventListener('click',()=>loadSources());$('gm-watch').addEventListener('click',watchMovie);
    $('gm-close').addEventListener('click',closeMovie);$('gm-source').addEventListener('change',()=>{write('gbMovieSource',new URL($('gm-source').value).host);disposeMovie();movieActive=false;playback();$('gm-player-status').textContent='Press Watch movie to open this source.';});
    $('gm-fullscreen').addEventListener('click',()=>{$('gm-screen').requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable in this browser.'));});
    $('gm-exit-fullscreen').addEventListener('click',()=>document.exitFullscreen?.());
    let musicHomeLoaded=false;
    async function loadMusicHome(){
        const request=++musicRequest;musicView='search';$('ag-status').textContent='Finding music…';
        try{const sections=await api('/api/music/ytm/home?limit=12');if(request!==musicRequest)return;const tracks=[...new Map(sections.flatMap(section=>section.tracks||[]).map(track=>[track.id,normalizeTrack(track)])).values()];showTracks(tracks,'Discover music');$('ag-status').textContent=tracks.length+' tracks to explore.';musicHomeLoaded=true;}catch(error){if(request===musicRequest){$('ag-status').textContent=error.message;$('ag-retry').classList.remove('hidden');}}
    }
    return {open(name){if(name==='music'&&!musicHomeLoaded&&!lastSearch)loadMusicHome();if(name==='movies'&&!catalog)loadCatalog();if(name!=='movies'&&movieActive)closeMovie();}};
}
