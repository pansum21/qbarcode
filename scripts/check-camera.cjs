const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const camera=source.slice(source.indexOf('let cameraStream=null'),source.indexOf('function saveLocalFeedback()'));
function element(){return {textContent:'',hidden:false,children:[],setAttribute(){},append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},focus(){},pause(){},async play(){},showModal(){this.open=true},close(){this.open=false},readyState:4}}
const elements=Object.fromEntries(['cameraStart','cameraStatus','cameraView','cameraPlaceholder','error','scanResult','scanDialog','scanAgain'].map(x=>[x,element()]));
let tick,stopped=0,resolveStream,codes=[];
const stream=()=>({getTracks:()=>[{stop(){stopped++}}]});
const context=vm.createContext({URL,console,path:'/scan',$:id=>elements[id],error:t=>elements.error.textContent=t,document:{hidden:false,addEventListener(){},createElement:element},window:{addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>stream()}},setInterval(fn){tick=fn;return 1},clearInterval(){tick=null}});
class Detector{static async getSupportedFormats(){return ['qr_code','code_128']}async detect(){return codes}}
context.BarcodeDetector=Detector;context.window.BarcodeDetector=Detector;
vm.runInContext(camera,context);
(async()=>{
 assert.equal(context.safeScanURL('javascript:alert(1)'),null);assert.equal(context.safeScanURL('data:text/html,test'),null);assert.equal(context.safeScanURL('hello'),null);assert.equal(context.safeScanURL('https://example.com/'),'https://example.com/');
 await context.startCameraScan();assert.equal(elements.cameraStart.textContent,'Stop Camera');assert.equal(elements.cameraView.hidden,false);
 codes=[{format:'qr_code',rawValue:'https://example.com/'}];await tick();assert(stopped===1);assert.equal(elements.cameraView.hidden,true);assert(elements.scanDialog.open);assert.equal(elements.scanResult.children[0].children[2].href,'https://example.com/');
 context.showScanResults([{rawValue:'<img src=x onerror=alert(1)>'}]);assert.equal(elements.scanResult.children[0].children.length,2);assert.equal(elements.scanResult.children[0].children[1].textContent,'<img src=x onerror=alert(1)>');
 context.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolveStream=r);
 const pending=context.startCameraScan();await new Promise(r=>setImmediate(r));context.stopCameraScan();resolveStream(stream());await pending;assert.equal(stopped,2);assert.equal(elements.cameraView.hidden,true);
 delete context.window.BarcodeDetector;await context.startCameraScan();assert(elements.error.textContent.includes('not supported'));assert.equal(elements.cameraStart.textContent,'Scan QR & Barcode');
 const html=fs.readFileSync('dist/pages/scan.html','utf8');assert(!html.includes('id="scanFile"'));assert(!html.includes('id="scanImage"'));assert(html.indexOf('id="cameraView"')<html.indexOf('id="cameraStart"'));assert(html.includes('data-page="/scan"'));
 const home=fs.readFileSync('dist/index.html','utf8');const nav=home.match(/<nav class="home-tool-links">([\s\S]*?)<\/nav>/); // aria label is present; use DOM-independent bounded extraction below.
 const shortcuts=home.slice(home.indexOf('class="home-tool-links"'),home.indexOf('</nav>',home.indexOf('class="home-tool-links"')));assert(shortcuts.indexOf('href="/"')<shortcuts.indexOf('href="/scan"'));
 assert(fs.readFileSync('dist/pages/barcode/bulk.html','utf8').includes('id="brandEnabled"'));
 console.log('PASS: camera lifecycle, delayed-permission cancellation, result popup, safe links, camera-only layout, tool order and bulk branding.');
})().catch(e=>{console.error(e);process.exitCode=1});
