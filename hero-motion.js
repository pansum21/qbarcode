const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const buttons=document.querySelectorAll('[data-motion-toggle]');
function sync(){buttons.forEach(button=>{button.disabled=reduced.matches;button.textContent=reduced.matches?'Animation reduced':document.body.dataset.heroMotionPaused==='true'?'Play animation':'Pause animation';button.setAttribute('aria-pressed',String(document.body.dataset.heroMotionPaused==='true'))})}
buttons.forEach(button=>button.addEventListener('click',()=>{document.body.dataset.heroMotionPaused=String(document.body.dataset.heroMotionPaused!=='true');sync()}));
reduced.addEventListener?.('change',sync);sync();
