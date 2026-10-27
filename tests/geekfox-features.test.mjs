import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FiltersEngine,Request} from '../vendor/geekfox-blocker.js';
import {geekfoxYouTubeVideo,geekfoxShouldBlock,fetchGeekfoxDislikes} from '../geekfox-features.js';
const engine=FiltersEngine.parse(fs.readFileSync(new URL('../vendor/geekfox-filters.txt',import.meta.url),'utf8'));
test('real filter snapshot blocks ads and trackers but permits ordinary resources',()=>{
 const sourceUrl='https://example.org/';
 for(const url of ['https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js','https://www.google-analytics.com/analytics.js'])assert(geekfoxShouldBlock(engine,Request,{url,sourceUrl,type:'script'}));
 assert(!geekfoxShouldBlock(engine,Request,{url:'https://example.org/main.js',sourceUrl,type:'script'}));
});
test('allowlisting and top-page navigation bypass filtering',()=>{
 const details={url:'https://www.google-analytics.com/analytics.js',sourceUrl:'https://example.org/',type:'script'};
 assert(!geekfoxShouldBlock(engine,Request,details,['example.org']));
 assert(geekfoxShouldBlock(engine,Request,details,['notexample.org']));
 assert(!geekfoxShouldBlock(engine,Request,{...details,type:'main_frame'}));
 assert(!geekfoxShouldBlock(engine,Request,{...details,url:'data:text/plain,test'}));
});
test('filter exceptions and cosmetic rules use the actual engine',()=>{
 const fixture=FiltersEngine.parse('||ads.example.com^\n@@||ads.example.com/allowed.js\nexample.org##.advert');
 assert(!geekfoxShouldBlock(fixture,Request,{url:'https://ads.example.com/allowed.js',sourceUrl:'https://example.org/',type:'script'}));
 assert(geekfoxShouldBlock(fixture,Request,{url:'https://ads.example.com/other.js',sourceUrl:'https://example.org/',type:'script'}));
 assert(fixture.getCosmeticsFilters({url:'https://example.org/',hostname:'example.org',domain:'example.org',classes:['advert'],ids:[],hrefs:[],getInjectionRules:false,getExtendedRules:false}).styles.includes('.advert'));
});
test('recognizes watch, Shorts and embedded videos with strict hostname boundaries',()=>{
 const id='dQw4w9WgXcQ';
 for(const url of ['https://www.youtube.com/watch?v='+id,'https://m.youtube.com/shorts/'+id,'https://youtube.com/embed/'+id])assert.equal(geekfoxYouTubeVideo(url),id);
 for(const url of ['https://youtube.com.evil.org/watch?v='+id,'https://music.youtube.com/watch?v='+id,'https://www.youtube.com/watch?v=invalid','https://example.org/watch?v='+id])assert.equal(geekfoxYouTubeVideo(url),null);
});
test('dislike reads use only the provided Geekfox fetch function',async()=>{
 const calls=[],controller=new AbortController();
 const data=await fetchGeekfoxDislikes(async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({dislikes:12345}));},'dQw4w9WgXcQ',controller.signal);
 assert.equal(data.dislikes,12345);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://returnyoutubedislikeapi.com/votes?videoId=dQw4w9WgXcQ');assert.equal(calls[0].options.signal,controller.signal);
 assert(!('method' in calls[0].options));
});
test('unavailable and malformed counts are errors, never invented numbers',async()=>{
 await assert.rejects(()=>fetchGeekfoxDislikes(async()=>new Response('',{status:429}),'dQw4w9WgXcQ'),/rate-limiting/);
 for(const dislikes of [undefined,null,'100',-1])await assert.rejects(()=>fetchGeekfoxDislikes(async()=>new Response(JSON.stringify({dislikes})),'dQw4w9WgXcQ'),/did not provide/);
 await assert.rejects(()=>fetchGeekfoxDislikes(()=>{throw new Error('must not fetch');},'invalid'),/Invalid/);
});
