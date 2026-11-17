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

function installGdFramePacing(patch) {
    let module=window.Module;
    const hooked=new WeakSet();
    function hook(value){
        if(!value || typeof value!=='object' || hooked.has(value))return;
        hooked.add(value);
        let binary=value.wasmBinary;
        const apply=next=>{value.__gbFramePacing=patch(next)?'browser-paced':'unrecognized-engine';return next;};
        Object.defineProperty(value,'wasmBinary',{configurable:true,enumerable:true,get:()=>binary,set:next=>{binary=apply(next);}});
        if(binary)binary=apply(binary);
    }
    Object.defineProperty(window,'Module',{configurable:true,enumerable:true,get:()=>module,set:value=>{module=value;hook(value);}});
    hook(module);
}

export function withGdFramePacing(html) {
    const script='<script>('+installGdFramePacing.toString()+')('+patchGdFramePacing.toString()+');</script>';
    const first=html.search(/<script\b/i);
    return first<0?script+html:html.slice(0,first)+script+html.slice(first);
}
