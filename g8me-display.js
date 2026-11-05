// Scale the entire iframe, so canvas pixels, HTML overlays and pointer coordinates agree.
export function fitG8meViewport(width,height,availableWidth,availableHeight,stretch=false) {
    if(![width,height,availableWidth,availableHeight].every(value=>Number.isFinite(value)&&value>0))return null;
    const scale=Math.min(availableWidth/width,availableHeight/height);
    return {scale,scaleX:stretch?availableWidth/width:scale,scaleY:stretch?availableHeight/height:scale,width:stretch?availableWidth:width*scale,height:stretch?availableHeight:height*scale};
}
export function isFluidG8meCanvas(rect,width,height,ratio) {
    const fills=Math.abs(rect.width-width)<=Math.max(2,width*0.06)&&Math.abs(rect.height-height)<=Math.max(2,height*0.06);
    const inside=rect.left>=-2&&rect.top>=-2&&rect.right<=width+2&&rect.bottom<=height+2;
    return fills&&inside&&Math.abs(rect.width/rect.height-ratio)/ratio<0.015;
}
export function attachG8meDisplay(frame,host,getSettings=()=>({})) {
    let doc=null,observer=null,canvasObserver=null,canvas=null,base=null,tick=null,disposed=false;
    const original=frame.getAttribute('style');let bodyStyle=null,bodySaved=false;let canvasStyle=null,canvasSaved=false;
    const hostObserver=new ResizeObserver(()=>schedule());hostObserver.observe(host);
    function schedule(){if(!disposed&&tick===null)tick=requestAnimationFrame(()=>{tick=null;measure();});}
    function paint(){
        if(!base)return;
        const fit=fitG8meViewport(base.width,base.height,host.clientWidth,host.clientHeight,!!getSettings().stretch);if(!fit)return;
        const properties={position:'absolute',left:'50%',top:'50%',width:base.width+'px',height:base.height+'px','max-width':'none','max-height':'none',margin:'0',border:'0',transform:`translate(-50%, -50%) scale(${fit.scaleX}, ${fit.scaleY})`,'transform-origin':'center center'};
        for(const [name,value] of Object.entries(properties))if(frame.style.getPropertyValue(name)!==value)frame.style.setProperty(name,value,'important');
        frame.dataset.g8meAspect=(base.width/base.height).toFixed(6);
    }
    function measure(){
        if(disposed)return;
        const settings=getSettings();
        if(settings.width&&settings.height)base={width:settings.width,height:settings.height};
        paint();
        try{
            if(!doc?.body||doc.fullscreenElement)return;
            const candidates=Array.from(doc.querySelectorAll('canvas')).filter(node=>{
                const rect=node.getBoundingClientRect(),style=doc.defaultView.getComputedStyle(node);
                return rect.width>=160&&rect.height>=90&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0;
            }).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height);
            const next=candidates[0];if(!next)return;
            const rect=next.getBoundingClientRect(),view=doc.defaultView;
            const ratio=next.width/next.height;if(!Number.isFinite(ratio)||ratio<0.1||ratio>10)return;
            if(!base&&!settings.stretch&&isFluidG8meCanvas(rect,view.innerWidth,view.innerHeight,ratio))return; // Fluid engines already fill their viewport correctly.
            if(!base&&rect.width*rect.height<view.innerWidth*view.innerHeight*0.18&&!/^(?:canvas|unity-canvas|GameCanvas)$/i.test(next.id))return;
            if(canvas!==next){canvasObserver?.disconnect();canvas=next;canvasObserver=new ResizeObserver(schedule);canvasObserver.observe(canvas);}
            if(settings.width&&settings.height){
                if(!bodySaved){bodySaved=true;bodyStyle=doc.body.getAttribute('style');doc.body.style.setProperty('margin','0','important');doc.body.style.setProperty('padding','0','important');}
                if(!canvasSaved){canvasStyle=next.getAttribute('style');canvasSaved=true;}
                for(const [key,value] of Object.entries({width:settings.width+'px',height:settings.height+'px','object-fit':settings.stretch?'fill':'contain',margin:'0'}))if(next.style.getPropertyValue(key)!==value)next.style.setProperty(key,value,'important');
                paint();return;
            }
            const width=Math.round(rect.width*100)/100,height=Math.round(width/ratio*100)/100;
            if(width<32||height<32||width>8192||height>8192)return;
            if(!base){bodySaved=true;bodyStyle=doc.body.getAttribute('style');doc.body.style.setProperty('margin','0','important');doc.body.style.setProperty('padding','0','important');}
            if(!base||Math.abs(base.width-width)>1||Math.abs(base.height-height)>1){base={width,height};paint();}
        }catch{ /* Cross-origin provider pages keep their own responsive sizing. */ }
    }
    function detach(){
        observer?.disconnect();canvasObserver?.disconnect();
        if(canvasSaved&&canvas){if(canvasStyle===null)canvas.removeAttribute('style');else canvas.setAttribute('style',canvasStyle);}canvasStyle=null;canvasSaved=false;
        if(doc){doc.defaultView?.removeEventListener('resize',schedule);doc.removeEventListener('fullscreenchange',schedule);if(bodySaved&&doc.body){if(bodyStyle===null)doc.body.removeAttribute('style');else doc.body.setAttribute('style',bodyStyle);}}
        observer=null;canvasObserver=null;canvas=null;doc=null;base=null;bodyStyle=null;bodySaved=false;
    }
    function loaded(){
        detach();if(original===null)frame.removeAttribute('style');else frame.setAttribute('style',original);delete frame.dataset.g8meAspect;
        try{
            doc=frame.contentDocument;if(!doc?.documentElement||doc.URL==='about:blank')return;
            observer=new MutationObserver(schedule);observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['width','height','style','class','hidden']});
            doc.defaultView.addEventListener('resize',schedule);doc.addEventListener('fullscreenchange',schedule);schedule();
        }catch{}
    }
    function settingsChanged(){loaded();}
    host.addEventListener('g8me-display-change',settingsChanged);
    frame.addEventListener('load',loaded);
    return ()=>{disposed=true;host.removeEventListener('g8me-display-change',settingsChanged);frame.removeEventListener('load',loaded);hostObserver.disconnect();detach();if(tick!==null)cancelAnimationFrame(tick);};
}
