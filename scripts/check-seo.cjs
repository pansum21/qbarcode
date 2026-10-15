const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json')));
const read=p=>fs.readFileSync(path.join(out,p),'utf8');
const urls=[...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
assert.equal(urls.length,14);
for(const url of urls){
 const route=new URL(url).pathname,rule=config.rewrites.find(r=>r.source===route);
 const html=read(route==='/'?'index.html':rule.destination.slice(1));
 assert(html.includes('rel="canonical" href="'+url+'"'),url);
 assert(html.includes('name="robots" content="index,follow"'),url);
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
 assert(main.includes('<h1>')&&main.length>300&&!main.includes('undefined'),url);
 assert(html.includes('property="og:url" content="'+url+'"'),url);
}
for(const route of ['/account','/projects','/settings','/feedback','/admin']){
 assert(!urls.includes('https://qbarcode.vercel.app'+route));
 assert(read(config.rewrites.find(r=>r.source===route).destination.slice(1)).includes('name="robots" content="noindex,follow"'));
}
for(const rule of config.rewrites)assert(fs.existsSync(path.join(out,rule.destination)),rule.source);
assert(!config.rewrites.some(r=>r.source.includes(':')||r.source.includes('*')));
for(const route of ['/qr/logo-styling','/qr/wifi-vcard','/barcode','/barcode/bulk','/scan']){
 const html=read(config.rewrites.find(r=>r.source===route).destination.slice(1));
 assert(/<input|<textarea/.test(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1]));
}
assert(fs.statSync(path.join(out,'qbar-logo.webp')).size>1000);
let scripts=0;
for(const m of read('index.html').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 if(!m[2].trim()||m[1].includes('application/ld+json'))continue;
 new vm.Script(m[2]);scripts++;
}
console.log('PASS: 14 public pages, 5 noindex pages, explicit route targets, static forms, canonical/OG tags, logo, and '+scripts+' inline scripts.');
const home=read('index.html');
assert(Buffer.byteLength(home)<60000,'Initial HTML must stay under 60 KB');
assert(!home.includes('data:image/webp;base64,'),'No duplicated inline brand image');
const appURL=home.match(/<script defer src="(\/assets\/qbar-app\.[^"]+)"/)[1];
const app=read(appURL.slice(1));
new vm.Script(app);
for(const url of urls){
 const route=new URL(url).pathname;
 const html=read(route==='/'?'index.html':config.rewrites.find(r=>r.source===route).destination.slice(1));
 assert(html.includes(appURL),'All routes share one cached app');
 for(const m of html.matchAll(/(?:src|href)="(\/assets\/[^"#]+)"/g))assert(fs.existsSync(path.join(out,m[1])));
}
const logoPath=app.match(/const brandLogoURI="(\/assets\/[^"\n]+)"/)[1];
assert(fs.readFileSync(path.join(out,logoPath)).equals(fs.readFileSync(path.join(out,'qbar-logo.webp'))),'Export branding keeps the exact logo');
assert(config.headers.some(rule=>rule.source==='/assets/(.*)'&&rule.headers.some(h=>h.value.includes('immutable'))));
// Execute the packaged engines and verify real code encoding still works.
const engineEnd=app.indexOf("(()=>{'use strict';");
assert(engineEnd>0);
const engines=vm.createContext({});
engines.window=engines;
engines.self=engines;
vm.runInContext(app.slice(0,engineEnd),engines);
assert.equal(typeof engines.QRCodeStyling,'function');
for(const [format,value] of [['CODE128','ABC-12345'],['EAN13','5901234123457'],['UPCE','04252614']]){
 const target={};engines.JsBarcode(target,value,{format});assert(target.encodings.length>0,format);
}
console.log('PASS: shared deferred bundle, cached assets, unchanged export logo, QR engine loads and barcode encoding works; homepage '+Buffer.byteLength(home)+' bytes.');
