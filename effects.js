(() => {
  let audioCtx = null;
  let enabled = localStorage.getItem('answerGameSound') !== 'off';

  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, start, dur, type='sine', gain=.05) {
    if (!enabled) return;
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + start);
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + .01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g); g.connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + .02);
  }
  const sounds = {
    join(){ tone(523,.00,.11,'triangle'); tone(659,.10,.11,'triangle'); tone(784,.20,.16,'triangle'); },
    open(){ tone(440,.00,.09,'sine'); tone(660,.09,.12,'sine'); },
    lock(){ tone(240,.00,.09,'square'); tone(180,.10,.15,'square'); },
    correct(){ tone(523,.00,.12,'triangle',.06); tone(659,.12,.12,'triangle',.06); tone(784,.24,.18,'triangle',.07); },
    wrong(){ tone(220,.00,.18,'sawtooth',.035); tone(164,.17,.25,'sawtooth',.035); },
    tick(){ tone(720,0,.06,'square',.025); },
    winner(){ [523,659,784,1047].forEach((f,i)=>tone(f,i*.12,.18,'triangle',.06)); }
  };
  function burst(target=document.body, count=28) {
    const r = target.getBoundingClientRect?.() || {left:innerWidth/2,top:innerHeight/2,width:0,height:0};
    for(let i=0;i<count;i++){
      const p=document.createElement('i'); p.className='confetti-piece';
      p.style.left=(r.left+r.width/2)+'px'; p.style.top=(r.top+Math.min(r.height/2,160))+'px';
      p.style.setProperty('--x', ((Math.random()-.5)*420)+'px');
      p.style.setProperty('--y', (120+Math.random()*260)+'px');
      p.style.setProperty('--r', (Math.random()*720-360)+'deg');
      p.style.animationDelay=(Math.random()*.12)+'s'; document.body.appendChild(p);
      setTimeout(()=>p.remove(),1500);
    }
  }
  function pulse(el, cls='fx-pulse'){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(()=>el.classList.remove(cls),800); }
  function floatScore(text, positive=true, anchor=document.body){
    const d=document.createElement('div'); d.className='score-float '+(positive?'positive':'negative'); d.textContent=text;
    const r=anchor.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight/2,width:0}; d.style.left=(r.left+r.width/2)+'px'; d.style.top=(r.top+50)+'px'; document.body.appendChild(d); setTimeout(()=>d.remove(),1300);
  }
  function addSoundToggle(container=document.body){
    if(document.getElementById('soundToggle')) return;
    const b=document.createElement('button'); b.id='soundToggle'; b.className='sound-toggle'; b.type='button';
    const paint=()=>b.textContent=enabled?'🔊 Sound On':'🔇 Sound Off'; paint();
    b.onclick=()=>{ enabled=!enabled; localStorage.setItem('answerGameSound', enabled?'on':'off'); paint(); if(enabled) sounds.open(); };
    container.appendChild(b);
  }
  window.GameFX={ sounds, burst, pulse, floatScore, addSoundToggle, isSoundOn:()=>enabled };
  document.addEventListener('pointerdown',()=>{ if(enabled){ try{ctx();}catch(e){} } },{once:true});
})();
