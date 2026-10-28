/* Shared theme controls for BioMi and PixelMint. No profile or image data is read. */
function savedMode(){try{const saved=JSON.parse(localStorage.getItem('qbar-appearance-v1')||'{}');const value=saved.mode||localStorage.getItem('qbar-theme');return value==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value==='dark'?'dark':'light'}catch{return 'light'}}
function applyMode(mode,persist=false){
 mode=mode==='dark'?'dark':'light';
 document.documentElement.dataset.mode=mode;document.documentElement.style.colorScheme=mode;
 document.body.classList.toggle('dark',mode==='dark');
 document.querySelectorAll('[data-theme-toggle]').forEach(button=>{button.textContent=mode==='dark'?'☾ Dark':'☀ Light';button.setAttribute('aria-label',mode==='dark'?'Switch to light mode':'Switch to dark mode');button.setAttribute('aria-pressed',String(mode==='dark'));button.title=mode==='dark'?'Switch to light mode':'Switch to dark mode'});
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=mode==='dark'?'#0b0b18':'#f4f5f8';
 if(persist)try{const value=JSON.parse(localStorage.getItem('qbar-appearance-v1')||'{}');value.mode=mode;localStorage.setItem('qbar-appearance-v1',JSON.stringify(value));localStorage.setItem('qbar-theme',mode)}catch{}
}
applyMode(savedMode());
document.addEventListener('click',event=>{if(event.target.closest('[data-theme-toggle]'))applyMode(document.documentElement.dataset.mode==='dark'?'light':'dark',true)});
window.addEventListener('storage',event=>{if(event.key==='qbar-appearance-v1'||event.key==='qbar-theme')applyMode(savedMode())});
