import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {prepareHalfLife2Audio} from '../hl2-startup.js';
export const audioFixture=`function resumeAudioStack() {
        if (typeof AL !== 'undefined' && AL.currentCtx && AL.currentCtx.audioCtx) {
          if (AL.currentCtx.audioCtx.state === 'suspended') {
            AL.currentCtx.audioCtx.resume().catch(() => {});
          }
        }
      }`;
function setup(extra={}) {
    const events={},doc={visibilityState:'visible',addEventListener:(name,fn)=>events[name]=fn};
    const context={document:doc,window:{addEventListener:(name,fn)=>events[name]=fn},console:{warn(){}},...extra};
    vm.createContext(context);vm.runInContext(prepareHalfLife2Audio(audioFixture),context);
    return {context,events,doc};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('SDL suspended and interrupted playback resumes; running and closed contexts are untouched',async()=>{
    let calls=0;const audio={state:'suspended',resume(){calls++;return Promise.resolve();}};
    const {events}=setup({Module:{SDL2:{audioContext:audio}}});
    events.pointerdown();await flush();audio.state='interrupted';events.focus();await flush();
    audio.state='running';events.keydown();audio.state='closed';events.focus();
    assert.equal(calls,2);
});
test('OpenAL remains supported and overlapping recovery events do not duplicate pending resumes',async()=>{
    let calls=0,resolve;const audio={state:'suspended',resume(){calls++;return new Promise(r=>resolve=r);}};
    const {events}=setup({Module:{SDL2:{audioContext:audio}},AL:{currentCtx:{audioCtx:audio}}});
    events.pointerdown();events.keydown();events.focus();assert.equal(calls,1);
    resolve();await flush();events.pointerdown();assert.equal(calls,2);resolve();await flush();
});
test('failed resumes can retry, hidden tabs stay quiet, and missing backends are harmless',async()=>{
    let calls=0;const {events,doc}=setup({Module:{SDL2:{audioContext:{state:'suspended',resume(){calls++;return Promise.reject(Error('No gesture'));}}}}});
    doc.visibilityState='hidden';events.visibilitychange();assert.equal(calls,0);
    doc.visibilityState='visible';events.pointerdown();await flush();events.keydown();await flush();assert.equal(calls,2);
    assert.doesNotThrow(()=>setup().events.pointerdown());
});
test('audio adapter is idempotent and leaves unknown launchers intact',()=>{
    const output=prepareHalfLife2Audio(audioFixture);assert.equal(prepareHalfLife2Audio(output),output);assert.equal(prepareHalfLife2Audio('<html>new launcher</html>'),'<html>new launcher</html>');
});
