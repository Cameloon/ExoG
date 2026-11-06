const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const req = createRequire(path.resolve(__dirname, '../package.json'));
const ts = req('typescript');
const THREE = req('three');
const {JSDOM} = req('jsdom');
const dom = new JSDOM('<div id="container"></div>');
const effects = [];
const pending = new Map();
let nextId = 0, refIndex = 0, renders = 0, disposals = 0, disconnects = 0;
const react = {useRef: value=>({current: refIndex++===0 ? dom.window.document.getElementById('container') : value}), useEffect: fn=>effects.push(fn)};
class Renderer {
  constructor({canvas}){this.domElement=canvas;}
  setPixelRatio(){} getPixelRatio(){return 1;} setClearAlpha(){} setClearColor(){}
  setSize(w,h){this.domElement.width=w;this.domElement.height=h;}
  render(){renders++;} dispose(){disposals++;} forceContextLoss(){}
}
const ctx = {exports:{}, require: name=>name==='react' ? react : name==='react/jsx-runtime' ? {jsx:()=>null} : name==='three' ? {...THREE,WebGLRenderer:Renderer} : {},
  window:dom.window, document:dom.window.document, console, Uint32Array, Float32Array,
  ResizeObserver:class{observe(){} disconnect(){disconnects++;}},
  IntersectionObserver:class{observe(){} disconnect(){}},
  requestAnimationFrame: fn=>{pending.set(++nextId,fn);return nextId;},
  cancelAnimationFrame:id=>pending.delete(id)};
const source=fs.readFileSync(path.resolve(__dirname, '../src/components/backgrounds/PixelBlast.tsx'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
vm.runInNewContext(code,ctx);
ctx.exports.default({});
const cleanups=effects.map(fn=>fn());
function frame(){for(const [id,fn] of [...pending]){pending.delete(id);fn();}}
frame();
console.log('Before unmount', {scheduledFrames:pending.size,renders,disposals,disconnects});
cleanups.forEach(fn=>fn?.());
frame();
console.log('After unmount and one additional frame', {scheduledFrames:pending.size,renders,disposals,disconnects});

assert.equal(pending.size,0);
assert.equal(renders,1);
assert.equal(disposals,1);
assert.equal(disconnects,1);
console.log("Animation cleanup regression passed");
