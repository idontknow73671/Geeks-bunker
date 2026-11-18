// Embed a complete HTML document without running it during conversion.
export function htmlToSvg(html,title='Converted website',base='') {
    if(!String(html).trim())throw Error('Choose an HTML file or paste your HTML first.');
    const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    if(base){const url=new URL(base);if(!['http:','https:'].includes(url.protocol))throw Error('The asset address must use HTTP or HTTPS.');const tag='<base href="'+escape(url.href)+'">';html=/<head(?:\s[^>]*)?>/i.test(html)?html.replace(/<head(?:\s[^>]*)?>/i,match=>match+tag):tag+html;}
    if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(html))throw Error('This file contains characters that cannot be stored in XML.');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><title>'+escape(title)+'</title><foreignObject width="100%" height="100%"><iframe xmlns="http://www.w3.org/1999/xhtml" title="'+escape(title)+'" style="position:fixed;inset:0;width:100%;height:100%;border:0" allow="fullscreen; autoplay; clipboard-write" allowfullscreen="allowfullscreen" srcdoc="'+escape(html)+'"></iframe></foreignObject></svg>';
}
export function initializeHtmlSvg(){
    const $=id=>document.getElementById(id),source=$('converter-source'),status=$('converter-status');
    $('converter-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>20000000)throw Error('Choose an HTML file smaller than 20 MB.');source.value=await file.text();$('converter-name').value=file.name.replace(/\.[^.]*$/,'')+'.svg';status.textContent='Loaded '+file.name+'. Ready to convert.';}catch(error){status.textContent=error.message;}};
    $('converter-download').onclick=()=>{try{const svg=htmlToSvg(source.value,$('converter-name').value,$('converter-base').value.trim());const parsed=new DOMParser().parseFromString(svg,'image/svg+xml');if(parsed.querySelector('parsererror'))throw Error('The generated XML could not be validated.');const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=($('converter-name').value.trim()||'website.svg').replace(/[\\/:*?"<>|]/g,'_').replace(/(?:\.svg)?$/i,'.svg');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Downloaded SVG · '+new Intl.NumberFormat().format(blob.size)+' bytes. Original HTML preserved.';}catch(error){status.textContent=error.message;}};
}
