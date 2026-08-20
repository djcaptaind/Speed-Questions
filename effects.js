window.GameFX = (() => {
  let soundEnabled = true;

  function beep(freq=600, duration=0.12, type='sine', volume=0.035) {
    if (!soundEnabled) return;
    try {
      const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function pulse(el, cls='fx-pulse') {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 850);
  }

  function floatScore(text, positive=true, anchorEl=null) {
    const div = document.createElement('div');
    div.className = `score-float ${positive ? 'positive' : 'negative'}`;
    div.textContent = text;
    const rect = (anchorEl || document.body).getBoundingClientRect ? (anchorEl || document.body).getBoundingClientRect() : {left: window.innerWidth/2, top: window.innerHeight/2, width:0};
    div.style.left = `${rect.left + rect.width/2}px`;
    div.style.top = `${Math.max(120, rect.top + window.scrollY)}px`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1300);
  }

  function burst(anchorEl=null, count=18) {
    const rect = (anchorEl || document.body).getBoundingClientRect ? (anchorEl || document.body).getBoundingClientRect() : {left: window.innerWidth/2, top: window.innerHeight/2, width:0, height:0};
    for (let i=0;i<count;i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const x = (Math.random()*260 - 130).toFixed(0) + 'px';
      const y = (Math.random()*-220 - 40).toFixed(0) + 'px';
      const r = (Math.random()*720 - 360).toFixed(0) + 'deg';
      piece.style.left = `${rect.left + rect.width/2 + Math.random()*50 - 25}px`;
      piece.style.top = `${rect.top + rect.height/2 + window.scrollY}px`;
      piece.style.setProperty('--x', x);
      piece.style.setProperty('--y', y);
      piece.style.setProperty('--r', r);
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1400);
    }
  }

  function addSoundToggle() {
    if (document.querySelector('.sound-toggle')) return;
    const btn = document.createElement('button');
    btn.className = 'sound-toggle';
    btn.textContent = '🔊 Sound On';
    btn.onclick = () => {
      soundEnabled = !soundEnabled;
      btn.textContent = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
    };
    document.body.appendChild(btn);
  }

  return {
    pulse,
    burst,
    floatScore,
    addSoundToggle,
    sounds: {
      join: () => beep(660, 0.12, 'triangle'),
      open: () => { beep(750,0.08,'triangle'); setTimeout(()=>beep(900,0.1,'triangle'),70); },
      lock: () => beep(240,0.15,'square'),
      correct: () => { beep(740,0.1,'triangle'); setTimeout(()=>beep(980,0.15,'triangle'),80); },
      wrong: () => { beep(260,0.12,'sawtooth'); setTimeout(()=>beep(180,0.16,'sawtooth'),70); }
    }
  };
})();
