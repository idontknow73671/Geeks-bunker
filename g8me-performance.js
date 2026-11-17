// The pinned GD port retains Application::run's native clock-polling wait even
// though presentation already yields to requestAnimationFrame. On slower CPUs
// that burns the time the browser needs for audio, input and the next frame.
export function patchGdFramePacing(binary) {
    const bytes=ArrayBuffer.isView(binary)?new Uint8Array(binary.buffer,binary.byteOffset,binary.byteLength):binary instanceof ArrayBuffer?new Uint8Array(binary):null;
    if(!bytes || bytes.length<8 || bytes[0]!==0 || bytes[1]!==97 || bytes[2]!==115 || bytes[3]!==109 || bytes[4]!==1)return false;
    let at=8,limit=bytes.length;
    function integer(){let value=0,shift=0;for(let i=0;i<5;i++){if(at>=limit)throw Error('Truncated WASM');const byte=bytes[at++];value+=(byte&127)*2**shift;if(!(byte&128))return value;shift+=7;}throw Error('Invalid WASM integer');}
    let bodyStart=0,bodyEnd=0,knownBoot=false;
    try {
        while(at<bytes.length){
            limit=bytes.length;const section=bytes[at++],length=integer(),end=at+length;if(end>bytes.length)return false;limit=end;
            if(section===7){
                const count=integer();
                for(let i=0;i<count;i++){
                    const size=integer();if(at+size>=end)return false;
                    const name=size===7?String.fromCharCode(...bytes.subarray(at,at+size)):'';at+=size;
                    const kind=bytes[at++],index=integer();if(name==='gd_boot')knownBoot=kind===0&&index===21275;
                }
            }
            if(section===10){
                const count=integer();if(count<=2287)return false;
                // Function 2424, minus the 137 imports in this exact engine.
                for(let i=0;i<=2287;i++){const size=integer(),start=at;if(start+size>end)return false;if(i===2287){bodyStart=start;bodyEnd=start+size;}at+=size;}
                break;
            }
            at=end;
        }
        if(!knownBoot || bodyEnd-bodyStart!==15140)return false;
        // Guard the complete original function, not just a coincidental opcode
        // match. A provider engine update must be reviewed before patching it.
        let hash=0x811c9dc5;
        for(let i=bodyStart;i<bodyEnd;i++)hash=Math.imul(hash^bytes[i],0x01000193)>>>0;
        if(hash===0xcfff1ae2)return true; // Already patched.
        if(hash!==0x24f8c008)return false;
        const pattern=[0x7d,0x22,0x21,0x20,0x15,0x7d,0x22,0x22,0x20,0x21,0x85,0x20,0x15,0x20,0x21,0x85,0x83,0x20,0x22,0x85,0x42,0,0x53,0x0d,0x0e];
        let match=-1;
        for(let i=bodyStart;i<=bodyEnd-pattern.length;i++){
            if(pattern.every((byte,j)=>bytes[i+j]===byte)){if(match!==-1)return false;match=i;}
        }
        if(match===-1)return false;
        // br_if -> drop;nop: skip only the redundant busy-wait branch. Keep
        // real timestamps, simulation deltas, rendering and browser yields.
        bytes[match+23]=0x1a;bytes[match+24]=0x01;
        return true;
    } catch {return false;}
}

export function installGdGraphics(win=window) {
    if(!win.HTMLCanvasElement||!win.navigator)return;
    const lowEnd=/CrOS/.test(win.navigator.userAgent)||win.navigator.deviceMemory<=4||win.navigator.hardwareConcurrency<=4;
    const prototype=win.HTMLCanvasElement.prototype,getContext=prototype.getContext;
    prototype.getContext=function(type,options){
        if(this.id!=='canvas'||!/^webgl2?$|^experimental-webgl$/.test(type))return getContext.call(this,type,options);
        const gl=getContext.call(this,type,{...options,preserveDrawingBuffer:false,antialias:false,powerPreference:'high-performance'});
        if(!gl||gl.__gbGraphics)return gl;
        const canvas=this,logicalWidth=canvas.width,logicalHeight=canvas.height;
        const viewport=gl.viewport.bind(gl),scissor=gl.scissor.bind(gl),parameter=gl.getParameter.bind(gl);
        let logicalViewport=[0,0,logicalWidth,logicalHeight],logicalScissor=[0,0,logicalWidth,logicalHeight];
        const screen=()=>!parameter(gl.FRAMEBUFFER_BINDING);
        const scaled=args=>args.map((value,i)=>Math.round(value*(i%2?canvas.height/logicalHeight:canvas.width/logicalWidth)));
        gl.viewport=(...args)=>{if(screen()){logicalViewport=args;viewport(...scaled(args));}else viewport(...args);};
        gl.scissor=(...args)=>{if(screen()){logicalScissor=args;scissor(...scaled(args));}else scissor(...args);};
        gl.getParameter=name=>name===gl.VIEWPORT&&screen()?new Int32Array(logicalViewport):name===gl.SCISSOR_BOX&&screen()?new Int32Array(logicalScissor):parameter(name);
        const resize=height=>{
            // CSS and the engine's logical coordinates remain unchanged. Only
            // the default framebuffer uses fewer pixels; FBOs keep native sizes.
            canvas.width=Math.round(logicalWidth*height/logicalHeight);canvas.height=height;
            if(screen()){viewport(...scaled(logicalViewport));scissor(...scaled(logicalScissor));}
            gl.__gbGraphics.height=height;
        };
        gl.__gbGraphics={height:logicalHeight,logicalWidth,logicalHeight};
        if(lowEnd&&logicalHeight>540)resize(540);
        // Native frame count, not browser RAF count: a 60 Hz page can still
        // present a game running at 10 FPS. Downshift once after sustained load.
        let lastTime=0,lastFrames=0,slow=0;
        function sample(time){
            if(time-lastTime>=2000){
                const frames=win.__gdGameStarted?win.Module?._gd_frames_get?.():undefined;
                if(Number.isFinite(frames)){
                    const fps=(frames-lastFrames)*1000/(time-lastTime);
                    slow=lastTime&&!win.document.hidden&&fps>0&&fps<35?slow+1:0;
                    if(slow>=2&&gl.__gbGraphics.height>(lowEnd?360:480)){resize(gl.__gbGraphics.height>480?480:360);slow=0;}
                    gl.__gbGraphics.fps=fps;lastFrames=frames;
                }
                lastTime=time;
            }
            win.requestAnimationFrame(sample);
        }
        win.requestAnimationFrame(sample);
        return gl;
    };
}

function installGdFramePacing(patch,graphics) {
    graphics(window);
    let module=window.Module;
    const hooked=new WeakSet();
    function hook(value){
        if(!value || typeof value!=='object' || hooked.has(value))return;
        hooked.add(value);
        let binary=value.wasmBinary;
        const apply=next=>{if(next)value.__gbFramePacing=patch(next)?'browser-paced':'unrecognized-engine';return next;};
        Object.defineProperty(value,'wasmBinary',{configurable:true,enumerable:true,get:()=>binary,set:next=>{binary=apply(next);}});
        if(binary)binary=apply(binary);
        const initialized=value.onRuntimeInitialized;
        if(initialized)value.onRuntimeInitialized=function(...args){
            // Compilation and filesystem preload are complete. Drop bootstrap
            // references instead of retaining the decompressed WASM as well.
            value.wasmBinary=null;winRelease();value.getPreloadedPackage=null;
            return initialized.apply(this,args);
        };
        function winRelease(){if('wasmBinary' in window)window.wasmBinary=null;}
    }
    Object.defineProperty(window,'Module',{configurable:true,enumerable:true,get:()=>module,set:value=>{module=value;hook(value);}});
    hook(module);
}

export function withGdFramePacing(html) {
    const script='<script>('+installGdFramePacing.toString()+')('+patchGdFramePacing.toString()+','+installGdGraphics.toString()+');</script>';
    const first=html.search(/<script\b/i);
    return first<0?script+html:html.slice(0,first)+script+html.slice(first);
}
