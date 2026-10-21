// Same official SDK API used by the supplied Nocturne reference.
const LUMIN_SCRIPT = 'https://cdn.jsdelivr.net/gh/luminsdk/script@main/lumin.min.js';
let sdkPromise;
function deadline(promise, milliseconds, message) {
    let timer;
    return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds);})]).finally(()=>clearTimeout(timer));
}
async function getLuminSdk() {
    if (!sdkPromise) sdkPromise=(async()=>{
        if(!window.Lumin){
            await deadline(new Promise((resolve,reject)=>{
                const script=document.createElement('script');script.src=LUMIN_SCRIPT;script.async=true;
                script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>{script.remove();reject(new Error('The Lumin SDK could not be reached.'));},{once:true});document.head.append(script);
            }),20000,'The Lumin SDK timed out.');
        }
        if(!window.Lumin)throw new Error('The Lumin SDK did not start.');
        await deadline(window.Lumin.init({headless:true}),25000,'Lumin did not connect. Try again or use GN Math.');
        return window.Lumin;
    })().catch(error=>{sdkPromise=null;throw error;});
    return sdkPromise;
}
export async function loadLuminCatalog() {
    const sdk=await getLuminSdk();let page=1,pages=1;const all=[];const ids=new Set();
    do {
        const result=await deadline(sdk.getGames({page,limit:100}),20000,'Lumin catalog request timed out.');
        const batch=Array.isArray(result)?result:result.games;
        if(!Array.isArray(batch))throw new Error('Lumin returned an invalid catalog.');
        let added=0;for(const game of batch){if(game.id==null||!game.name||ids.has(String(game.id)))continue;ids.add(String(game.id));all.push({id:game.id,name:game.name,imageToken:game.image_token,provider:'lumin'});added++;}
        pages=Number(result.pages)||1;page++;
        if(!added)break;
    }while(page<=pages&&page<=100);
    if(!all.length)throw new Error('Lumin returned an empty catalog.');
    return all;
}
export async function loadLuminCover(token) {
    if(!token)return '';const sdk=await getLuminSdk();return deadline(sdk.getImageUrl(token),15000,'Cover unavailable.');
}
export async function resolveLuminGame(id) {
    const sdk=await getLuminSdk();const result=await deadline(sdk.getGameUrl(id),25000,'Lumin could not resolve this game.');
    const url=typeof result==='string'?result:result?.url;
    if(!url||!/^https?:\/\//i.test(url))throw new Error('Lumin did not return a game URL.');return url;
}
