const KEY='qbar-appearance-v1';
const validHex=value=>/^#[0-9a-f]{6}$/i.test(value||'');
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function contrastColor(a,b){const values=[a,b].map(hex=>{const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722});const l=(values[0]+values[1])/2;return (l+.05)/.05>=1.05/(l+.05)?'#182438':'#ffffff'}
function apply(preferences=read()){
 const a=preferences||{},body=document.body;
 const mode=a.mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):a.mode;
 if(mode==='light'||mode==='dark'){body.classList.toggle('dark',mode==='dark');document.documentElement.dataset.mode=mode;document.documentElement.style.colorScheme=mode}
 body.dataset.suiteAppearance='true';body.dataset.suiteMorphism=['glass','water','neumorphic','clay','aurora','holo','skeuo'].includes(a.morphism)?a.morphism:'glass';
 const radius=Number.isFinite(Number(a.radius))?Math.max(0,Math.min(32,Number(a.radius))):18;body.style.setProperty('--suite-card-radius',radius+'px');
 const shape=['square','capsule'].includes(a.buttonShape)?a.buttonShape:'rounded';body.style.setProperty('--suite-button-radius',shape==='square'?'3px':shape==='capsule'?'999px':'11px');
 const blur={off:0,soft:14,frosted:22,liquid:28}[a.glass]??14;body.style.setProperty('--suite-blur',blur+'px');
 const accent=validHex(a.accent)?a.accent:null;if(accent)body.style.setProperty('--suite-accent',accent);else body.style.removeProperty('--suite-accent');
 if(validHex(a.glowA)&&validHex(a.glowB)){body.dataset.suiteBackground='custom';body.style.setProperty('--suite-glow-a',a.glowA);body.style.setProperty('--suite-glow-b',a.glowB)}else delete body.dataset.suiteBackground;
 const fill=['solid','gradient'].includes(a.buttonFill)?a.buttonFill:'auto';body.dataset.suiteButtonFill=fill;
 if(fill!=='auto'){const colorA=validHex(a.buttonColorA)?a.buttonColorA:'#c6e5ff',colorB=validHex(a.buttonColorB)?a.buttonColorB:'#ffd2e7',angle=Number.isFinite(Number(a.buttonAngle))?Number(a.buttonAngle):115;body.style.setProperty('--suite-button-fill',fill==='solid'?colorA:'linear-gradient('+angle+'deg,'+colorA+','+colorB+')');body.style.setProperty('--suite-button-ink',contrastColor(colorA,fill==='solid'?colorA:colorB))}
 const originTool=new URLSearchParams(location.search).get('return')||'/studio';document.querySelectorAll('.qbar-code-settings').forEach(section=>section.hidden=originTool.startsWith('/biomi')||originTool.startsWith('/pixelmint'));
 document.querySelectorAll('a[data-suite-settings],a[href="/settings"]').forEach(link=>{link.removeAttribute('data-route');link.href='/settings?return='+encodeURIComponent(location.pathname==='/settings'?'/studio':location.pathname)});
}
window.applySuiteAppearance=apply;apply();
window.addEventListener('storage',event=>{if(event.key===KEY)apply()});
document.addEventListener('suite:appearance',()=>apply());
if(location.pathname.startsWith('/biomi/dashboard')){
 document.body.classList.add('suite-biomi-editor');
 const area=document.querySelector('.top-actions');if(area&&!area.querySelector('[data-suite-settings]')){const link=document.createElement('a');link.className='btn suite-settings-link';link.dataset.suiteSettings='true';link.href='/settings?return=%2Fbiomi%2Fdashboard';link.textContent='⚙ Settings';area.prepend(link)}
}
const systemMedia=matchMedia('(prefers-color-scheme: dark)');systemMedia.addEventListener?.('change',()=>{if(read().mode==='system')apply()});
