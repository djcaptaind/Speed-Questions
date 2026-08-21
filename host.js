(() => {
  const $ = id => document.getElementById(id);
  const BUILD_VERSION = "MASTER FINAL 2026.08.21";
  const PUBLIC_HOST_URL = "https://djcaptaind.github.io/Speed-Questions/host.html";
  const PUBLIC_TEAM_URL = "https://djcaptaind.github.io/Speed-Questions/index.html";
  let db, roomRef, roomCode, state = {}, questionIndex = 0, previousPhase = null, previousIndex = null, previousScores = {};
  let timerInterval = null, autoLockInFlight = false, serverTimeOffset = 0;

  const configured = () => window.FIREBASE_CONFIG && !String(window.FIREBASE_CONFIG.apiKey).startsWith('PASTE_');
  const esc = (s='') => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const normalize = (s='') => s.trim().replace(/\s+/g, ' ');
  const nameKey = (s='') => normalize(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
  const blocked = ['fuck','shit','bitch','asshole','nigger','nigga','cunt','dick','pussy'];
  const inappropriate = s => blocked.some(w => normalize(s).toLowerCase().replace(/[^a-z0-9]/g,'').includes(w));
  const getQuestions = () => window.GAME_QUESTIONS || [];

  // Change this PIN before publishing if desired.
  // NOTE: This is a client-side deterrent, not strong authentication.
  const INSTRUCTOR_PIN = '1974';
  const PIN_SESSION_KEY = 'chargersInstructorUnlocked';

  function unlockHostUi() {
    const gate = $('pinGate');
    const shell = $('hostAppShell');
    if (gate) gate.classList.add('hidden');
    if (shell) shell.classList.remove('host-locked');
    sessionStorage.setItem(PIN_SESSION_KEY, '1');
    setTimeout(() => $('roomCode')?.focus(), 100);
  }

  function lockHostUi() {
    const gate = $('pinGate');
    const shell = $('hostAppShell');
    if (gate) gate.classList.remove('hidden');
    if (shell) shell.classList.add('host-locked');
  }

  function verifyInstructorPin() {
    const input = $('instructorPin');
    const error = $('pinError');
    const value = String(input?.value || '').trim();
    if (value === INSTRUCTOR_PIN) {
      if (error) error.textContent = '';
      if (input) input.value = '';
      unlockHostUi();
      GameFX.sounds.correct();
      return;
    }
    if (error) error.textContent = 'Incorrect PIN.';
    if (input) {
      input.value = '';
      input.focus();
      input.classList.remove('pin-shake');
      void input.offsetWidth;
      input.classList.add('pin-shake');
    }
    GameFX.sounds.wrong();
  }

  if (sessionStorage.getItem(PIN_SESSION_KEY) === '1') unlockHostUi();
  else lockHostUi();

  $('unlockHostBtn')?.addEventListener('click', verifyInstructorPin);
  $('instructorPin')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') verifyInstructorPin();
  });

  function initFirebase() {
    if (!configured()) return false;
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database();
    db.ref('.info/serverTimeOffset').on('value', snap => { serverTimeOffset = Number(snap.val() || 0); });
    return true;
  }

  function setFullscreenButtonState() {
    const btn = $('fullscreenBtn');
    if (!btn) return;
    const active = !!document.fullscreenElement;
    btn.textContent = active ? '⤢ EXIT FULL SCREEN' : '⛶ FULL SCREEN';
    btn.classList.toggle('is-active', active);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) {
      alert('Full screen could not be started. Try pressing F11.');
    } finally {
      setFullscreenButtonState();
    }
  }

  const fullscreenBtn = $('fullscreenBtn');
  if (fullscreenBtn) fullscreenBtn.onclick = toggleFullscreen;
  document.addEventListener('fullscreenchange', setFullscreenButtonState);
  setFullscreenButtonState();

  function clampTimerSeconds(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 30;
    return Math.max(5, Math.min(300, Math.round(n)));
  }

  function timerSettings() {
    const enabled = $('timerEnabled') ? $('timerEnabled').checked : true;
    const seconds = clampTimerSeconds($('timerSeconds') ? $('timerSeconds').value : 30);
    return { enabled, seconds };
  }

  function saveTimerSettings() {
    const { enabled, seconds } = timerSettings();
    localStorage.setItem('chargersTimerEnabled', enabled ? '1' : '0');
    localStorage.setItem('chargersTimerSeconds', String(seconds));
    if ($('timerSeconds')) $('timerSeconds').value = seconds;
  }

  function loadTimerSettings() {
    const savedSeconds = Number(localStorage.getItem('chargersTimerSeconds'));
    const savedEnabled = localStorage.getItem('chargersTimerEnabled');
    if ($('timerSeconds') && Number.isFinite(savedSeconds) && savedSeconds >= 5) $('timerSeconds').value = clampTimerSeconds(savedSeconds);
    if ($('timerEnabled') && savedEnabled !== null) $('timerEnabled').checked = savedEnabled !== '0';
  }

  function timerRemainingMs(s = state) {
    if (!s || !s.timerEnabled) return null;
    if (s.timerRunning && s.timerEndAt) return Math.max(0, Number(s.timerEndAt) - (Date.now() + serverTimeOffset));
    if (s.timerPausedRemaining != null) return Math.max(0, Number(s.timerPausedRemaining));
    if (s.timerDuration) return Math.max(0, Number(s.timerDuration) * 1000);
    return null;
  }

  function setTimerRing(ring, textEl, remainingMs, durationSec, enabled, running) {
    if (!ring || !textEl) return;
    ring.classList.toggle('timer-disabled', !enabled);
    ring.classList.toggle('timer-paused', enabled && !running && state.phase === 'open');
    ring.classList.toggle('timer-reset', enabled && !running && state.phase === 'revealed');
    if (!enabled) {
      textEl.textContent = 'OFF';
      ring.style.setProperty('--timer-progress', '0deg');
      ring.classList.remove('timer-low', 'timer-critical');
      return;
    }
    const total = Math.max(1, Number(durationSec || 30) * 1000);
    const ms = Math.max(0, remainingMs ?? total);
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    textEl.textContent = mins > 0 ? `${mins}:${String(secs).padStart(2,'0')}` : String(seconds);
    const pct = Math.max(0, Math.min(1, ms / total));
    ring.style.setProperty('--timer-progress', `${pct * 360}deg`);
    ring.classList.toggle('timer-low', seconds <= 10 && seconds > 5);
    ring.classList.toggle('timer-critical', seconds <= 5);
  }

  async function lockAnswers(reason = 'manual') {
    if (!roomRef || state.phase !== 'open') return;
    const remaining = timerRemainingMs();
    const updates = {
      phase: 'locked',
      timerRunning: false,
      timerPausedRemaining: remaining == null ? null : remaining,
      timerLockedReason: reason
    };
    await roomRef.update(updates);
  }

  async function autoLockAtZero() {
    if (autoLockInFlight || !roomRef || state.phase !== 'open' || !state.timerEnabled) return;
    autoLockInFlight = true;
    try {
      const snap = await roomRef.once('value');
      const latest = snap.val() || {};
      const remaining = latest.timerRunning && latest.timerEndAt ? Number(latest.timerEndAt) - (Date.now() + serverTimeOffset) : Number(latest.timerPausedRemaining ?? 1);
      if (latest.phase === 'open' && latest.timerEnabled && remaining <= 0) {
        await roomRef.update({
          phase: 'locked',
          timerRunning: false,
          timerPausedRemaining: 0,
          timerLockedReason: 'timer'
        });
      }
    } finally {
      setTimeout(() => { autoLockInFlight = false; }, 350);
    }
  }

  function updateHostTimer() {
    const ring = $('hostTimerRing');
    const text = $('hostTimerText');
    if (!ring || !text) return;
    const remaining = timerRemainingMs();
    setTimerRing(ring, text, remaining, state.timerDuration, !!state.timerEnabled, !!state.timerRunning);
    if (state.phase === 'open' && state.timerEnabled && state.timerRunning && remaining != null && remaining <= 0) autoLockAtZero();
    if ($('pauseTimerBtn')) {
      $('pauseTimerBtn').disabled = state.phase !== 'open' || !state.timerEnabled;
      $('pauseTimerBtn').textContent = state.timerRunning ? '⏸ PAUSE' : '▶ RESUME';
    }
    if ($('addTimeBtn')) $('addTimeBtn').disabled = state.phase !== 'open' || !state.timerEnabled;
    if ($('applyTimerBtn')) $('applyTimerBtn').disabled = state.phase !== 'open';
  }

  async function pauseResumeTimer() {
    if (!roomRef || state.phase !== 'open' || !state.timerEnabled) return;
    if (state.timerRunning) {
      const remaining = timerRemainingMs();
      await roomRef.update({ timerRunning: false, timerPausedRemaining: remaining, timerEndAt: null });
    } else {
      const remaining = Math.max(0, Number(state.timerPausedRemaining ?? state.timerDuration * 1000));
      await roomRef.update({ timerRunning: true, timerPausedRemaining: null, timerEndAt: Date.now() + serverTimeOffset + remaining });
    }
  }

  async function addFiveSeconds() {
    if (!roomRef || state.phase !== 'open' || !state.timerEnabled) return;
    if (state.timerRunning && state.timerEndAt) await roomRef.child('timerEndAt').set(Number(state.timerEndAt) + 5000);
    else await roomRef.child('timerPausedRemaining').set(Math.max(0, Number(state.timerPausedRemaining || 0)) + 5000);
  }

  async function applyTimerToCurrent() {
    if (!roomRef || state.phase !== 'open') return;
    saveTimerSettings();
    const { enabled, seconds } = timerSettings();
    await roomRef.update({
      timerEnabled: enabled,
      timerDuration: seconds,
      timerRunning: enabled,
      timerEndAt: enabled ? Date.now() + serverTimeOffset + seconds * 1000 : null,
      timerPausedRemaining: enabled ? null : seconds * 1000,
      timerLockedReason: null
    });
  }

  loadTimerSettings();
  if ($('timerSeconds')) $('timerSeconds').addEventListener('change', saveTimerSettings);
  if ($('timerEnabled')) $('timerEnabled').addEventListener('change', saveTimerSettings);
  document.querySelectorAll('[data-timer-preset]').forEach(btn => btn.addEventListener('click', () => {
    if ($('timerSeconds')) $('timerSeconds').value = btn.dataset.timerPreset;
    saveTimerSettings();
  }));
  if ($('pauseTimerBtn')) $('pauseTimerBtn').onclick = pauseResumeTimer;
  if ($('addTimeBtn')) $('addTimeBtn').onclick = addFiveSeconds;
  if ($('applyTimerBtn')) $('applyTimerBtn').onclick = applyTimerToCurrent;
  timerInterval = setInterval(updateHostTimer, 200);

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function showCinematic(eyebrow,main,sub,mode='intro'){const el=$('cinematicOverlay');if(!el)return;$('cinematicEyebrow').textContent=eyebrow;$('cinematicMain').textContent=main;$('cinematicSub').textContent=sub;el.className=`cinematic-overlay mode-${mode} cinematic-live`;el.classList.remove('hidden')}
  function hideCinematic(){const el=$('cinematicOverlay');if(el)el.classList.add('hidden')}
  async function playIntro(){showCinematic('CALLAWAY JROTC PRESENTS','CHARGERS CHALLENGE','GOD MODE','intro');GameFX.sounds.open();await sleep(1700);hideCinematic()}
  function showImpact(k='TIME!',m='ANSWERS LOCKED',s='WAIT FOR THE REVEAL'){const el=$('impactOverlay');if(!el)return;$('impactKicker').textContent=k;$('impactMain').textContent=m;$('impactSub').textContent=s;el.classList.remove('hidden');void el.offsetWidth;el.classList.add('impact-live');setTimeout(()=>{el.classList.add('hidden');el.classList.remove('impact-live')},1400)}
  function podiumHtml(t={}){const a=Object.entries(t).sort((x,y)=>(y[1].score||0)-(x[1].score||0)).slice(0,3),m=['🥇','🥈','🥉'];return a.map(([id,v],i)=>`<div class="podium-place place-${i+1}"><span>${m[i]}</span><strong>${esc(v.name||id)}</strong><b>${v.score||0}</b></div>`).join('')}
  function showChampion(t={}){const a=Object.entries(t).sort((x,y)=>(y[1].score||0)-(x[1].score||0));if(!a.length)return;const[id,v]=a[0];$('championName').textContent=v.name||id;$('championScore').textContent=`${v.score||0} POINTS`;$('podiumBoard').innerHTML=podiumHtml(t);$('championOverlay').classList.remove('hidden');GameFX.burst($('championOverlay'),60);GameFX.sounds.correct()}
  async function countdownToQuestion(index) {
    const questions = getQuestions();
    const q = questions[index];
    if (!q || !roomRef) return;

    const teams = state.teams || {};
    const eligibleTeams = Object.fromEntries(Object.keys(teams).map(id => [id, true]));
    saveTimerSettings();
    const { enabled: timerEnabled, seconds: timerDuration } = timerSettings();

    await roomRef.update({
      questionIndex: index,
      currentQuestion: q,
      phase: 'countdown',
      countdownTargetIndex: index,
      countdownEndAt: Date.now() + serverTimeOffset + 3000,
      answers: null,
      scored: false,
      eligibleTeams,
      message: '',
      timerEnabled,
      timerDuration,
      timerRunning: false,
      timerEndAt: null,
      timerPausedRemaining: timerEnabled ? timerDuration * 1000 : null,
      timerLockedReason: null,
      questionVersion: Date.now(),
      fastestCorrectName: null
    });

    for (const n of ['3','2','1']) {
      showCinematic(`QUESTION ${index+1}`, n, 'GET READY', 'countdown');
      GameFX.sounds.lock();
      await sleep(700);
    }
    showCinematic(`QUESTION ${index+1}`, 'GO!', 'ANSWERS OPEN', 'go');
    GameFX.sounds.correct();
    await sleep(450);
    hideCinematic();

    const endAt = timerEnabled ? Date.now() + serverTimeOffset + timerDuration * 1000 : null;
    await roomRef.update({
      phase: 'open',
      timerRunning: timerEnabled,
      timerEndAt: endAt,
      timerPausedRemaining: timerEnabled ? null : timerDuration * 1000,
      timerLockedReason: null,
      openedAt: Date.now() + serverTimeOffset
    });
  }
  async function revealSequence(){if(!roomRef||!state.currentQuestion||state.phase==='reveal_countdown')return;await roomRef.update({phase:'reveal_countdown',timerRunning:false,timerEndAt:null,revealEndAt:Date.now()+2400});for(const n of ['3','2','1']){showCinematic('ANSWER REVEAL',n,'LOCKED IN','reveal');GameFX.sounds.lock();await sleep(600)}showCinematic('ANSWER REVEAL','REVEAL!','SCORE IMPACT','go');GameFX.sounds.correct();await sleep(400);hideCinematic();await scoreAndReveal()}
  function renderJoinQr() {
    // MASTER FINAL:
    // Always encode the PUBLIC GitHub Pages team URL.
    // Never encode file:///C:/... even when host.html is opened from Downloads.
    const join = new URL(PUBLIC_TEAM_URL);
    join.searchParams.set('room', roomCode);
    join.searchParams.set('v', 'master-final');
    const joinUrl = join.href;

    $('joinRoomCode').textContent = roomCode;

    const urlText = $('joinUrlText');
    if (urlText) urlText.textContent = joinUrl;

    const direct = $('joinDirectLink');
    if (direct) direct.href = joinUrl;

    const qr = $('joinQr');
    const status = $('qrStatus');

    // The bundled QR is the no-dependency fallback.
    // It always opens the public team page; students type the displayed room code.
    qr.innerHTML = '<img src="team-join-qr.png" class="fallback-qr-image" alt="QR code to open the public Chargers Challenge team page">';

    if (window.QRCode) {
      try {
        qr.innerHTML = '';
        new QRCode(qr, {
          text: joinUrl,
          width: 220,
          height: 220,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
        if (status) {
          status.textContent = '✓ PUBLIC QR ACTIVE • ROOM AUTO-FILLS';
          status.classList.remove('qr-fallback-status', 'qr-error');
        }
      } catch (err) {
        console.warn('[Chargers] Dynamic QR failed; using bundled public QR.', err);
        qr.innerHTML = '<img src="team-join-qr.png" class="fallback-qr-image" alt="QR code to open the public Chargers Challenge team page">';
        if (status) {
          status.textContent = '✓ PUBLIC QR ACTIVE • ENTER ROOM CODE';
          status.classList.add('qr-fallback-status');
        }
      }
    } else if (status) {
      status.textContent = '✓ PUBLIC QR ACTIVE • ENTER ROOM CODE';
      status.classList.add('qr-fallback-status');
    }

    document.body.dataset.qrMode = 'public';
    console.log(`[Chargers] ${BUILD_VERSION} QR URL:`, joinUrl);
  }
  $('createBtn').addEventListener('click', async () => {
    $('setupError').textContent = '';
    roomCode = $('roomCode').value.trim().toUpperCase();
    if (!roomCode) return $('setupError').textContent = 'Enter a room code.';
    if (!initFirebase()) return $('setupError').textContent = 'Firebase is not configured.';
    roomRef = db.ref('rooms/' + roomCode);

    try {
      const snap = await roomRef.once('value');
      if (!snap.exists()) {
        await roomRef.set({
          createdAt: Date.now(),
          phase: 'waiting',
          questionIndex: 0,
          teams: {},
          message: 'New game ready.'
        });
      }
      $('setupView').classList.add('hidden');
      $('hostView').classList.remove('hidden');
      $('roomLabel').textContent = roomCode;
      if ($('buildVersion')) $('buildVersion').textContent = BUILD_VERSION;
      if ($('hostLocationStatus')) {
        const local = location.protocol === 'file:';
        $('hostLocationStatus').textContent = local
          ? 'LOCAL HOST • QR STILL USES PUBLIC GITHUB'
          : 'PUBLIC GITHUB HOST';
        $('hostLocationStatus').classList.toggle('local-host-warning', local);
      }
      renderJoinQr();
      GameFX.addSoundToggle();
      GameFX.sounds.join();
      listen();
      setTimeout(playIntro,250);
    } catch (e) {
      $('setupError').textContent = 'Could not open room: ' + (e.message || e);
    }
  });

  function listen() {
    roomRef.on('value', snap => {
      const oldPhase = previousPhase, oldIndex = previousIndex;
      state = snap.val() || {};
      questionIndex = state.questionIndex || 0;
      if (oldIndex !== questionIndex || state.phase !== 'open') autoLockInFlight = false;
      render();
      if (oldIndex !== null && questionIndex !== oldIndex && state.currentQuestion) {
        GameFX.sounds.open();
        GameFX.pulse($('questionText'));
      }
      if (oldPhase && oldPhase !== state.phase && state.phase === 'locked') { GameFX.sounds.lock(); const k=`${questionIndex}:${state.timerLockedReason||'manual'}`; if(k!==lastImpactKey){lastImpactKey=k;showImpact(state.timerLockedReason==='timer'?'TIME!':'LOCKED!','ANSWERS LOCKED','WAIT FOR THE REVEAL')} }
      if (oldPhase && oldPhase !== state.phase && state.phase === 'revealed') GameFX.sounds.correct();
      if (state.phase === 'complete') showChampion(state.teams || {});
      previousPhase = state.phase || 'waiting';
      previousIndex = questionIndex;
    });
  }

  function render() {
    const q = state.currentQuestion;
    const teams = state.teams || {};
    const count = Object.keys(teams).length;
    document.body.dataset.phase = state.phase || 'waiting';

    $('connectedCount').textContent = `${count} Team${count === 1 ? '' : 's'} Connected`;

    const eligible = state.eligibleTeams || {};
    const eligibleIds = Object.keys(eligible).filter(id => eligible[id] && teams[id]);
    const answerCount = eligibleIds.filter(id => state.answers && state.answers[id]).length;
    const totalEligible = eligibleIds.length;
    if ($('submissionCount')) $('submissionCount').textContent = answerCount;
    if ($('submissionTotal')) $('submissionTotal').textContent = totalEligible;
    if ($('submissionBar')) $('submissionBar').style.width = totalEligible ? `${Math.round((answerCount/totalEligible)*100)}%` : '0%';
    $('roundText').textContent = q ? `Question ${questionIndex + 1} of ${getQuestions().length}` : 'Ready';
    $('phaseText').textContent = (state.phase || 'waiting').replace('_',' ').toUpperCase();
    $('questionText').textContent = q?.question || 'Select Start Question.';

    if (q) {
      $('questionText').classList.remove('question-enter');
      void $('questionText').offsetWidth;
      $('questionText').classList.add('question-enter');
    }

    $('choices').innerHTML = q ? q.choices.map((c,i) =>
      `<div class="choice host-choice ${state.phase === 'revealed' && i === q.answer ? 'correct' : ''}"><span class="choice-letter">${String.fromCharCode(65+i)}</span>${esc(c)}</div>`
    ).join('') : '';

    $('correctAnswerDisplay').innerHTML = q && state.phase === 'revealed'
      ? `<span class="choice-letter">${String.fromCharCode(65+q.answer)}</span>${esc(q.choices[q.answer])}`
      : 'Hidden until reveal';

    $('lockBtn').disabled = state.phase !== 'open';
    $('revealBtn').disabled = !['open','locked'].includes(state.phase);
    $('nextBtn').disabled = state.phase !== 'revealed';
    $('startBtn').disabled = !!q || state.phase !== 'waiting';
    if ($('fastestCorrect')) $('fastestCorrect').textContent = state.fastestCorrectName ? `FASTEST CORRECT: ${state.fastestCorrectName}` : 'FASTEST CORRECT: —';

    renderSubmissions();
    renderScores();
    updateHostTimer();
  }

  function renderSubmissions() {
    const teams = state.teams || {};
    const answers = state.answers || {};
    const eligibleTeams = state.eligibleTeams || {};
    const q = state.currentQuestion;
    $('submissions').innerHTML = Object.entries(teams).map(([id,t]) => {
      const a = answers[id];
      const eligible = !!eligibleTeams[id];
      let display = a ? String.fromCharCode(65+a.choice) : '—';
      let result = '';
      if (state.phase === 'revealed') {
        if (a && q) result = a.choice === q.answer ? ' ✓' : ' ✗';
        else if (eligible) result = ' -50';
        else result = '';
      }
      const stateClass = state.phase === 'revealed' ? (a ? (a.choice === q?.answer ? 'submission-correct' : 'submission-wrong') : (eligible ? 'submission-missed' : '')) : (a ? 'submission-ready' : '');
      return `<div class="submission-row ${stateClass}"><strong>${esc(t.name || id)}</strong><span>${display}${result}</span></div>`;
    }).join('') || '<div class="submission-row"><strong>Waiting for teams...</strong><span>—</span></div>';
  }

  function renderScores() {
    const teams = state.teams || {};
    const sorted = Object.entries(teams).sort((a,b) => (b[1].score || 0) - (a[1].score || 0) || (a[1].name || '').localeCompare(b[1].name || ''));
    $('scoreboard').innerHTML = sorted.map(([id,t],idx) => {
      const score = t.score || 0;
      const delta = score - (previousScores[id] ?? score);
      const medal = idx === 0 ? '⚡' : idx === 1 ? '2' : idx === 2 ? '3' : String(idx + 1);
      return `<div class="host-team-row rank-${idx+1}">
        <div class="leader-main">
          <span class="rank-badge">${medal}</span>
          <div class="leader-copy"><strong>${esc(t.name || id)}${t.language==='es'?' <span class="host-lang-badge">ES</span>':t.language==='both'?' <span class="host-lang-badge dual">EN/ES</span>':''}</strong><span class="leader-delta ${delta>0?'score-up':delta<0?'score-down':''}">${delta>0?`+${delta}`:delta<0?`${delta}`:'LIVE SCORE'}${Number(t.streak||0)>=2?` • 🔥 ${t.streak} STREAK`:''}</span></div>
          <span class="leader-score ${score>0?'score-good':score<0?'score-bad':''}">${score}</span>
        </div>
        <div class="adjust">
          <button class="btn btn-ghost" data-id="${id}" data-delta="-50">-50</button>
          <button class="btn btn-primary" data-id="${id}" data-delta="50">+50</button>
          <button class="btn btn-ghost" data-rename="${id}">Rename</button>
          <button class="btn btn-danger" data-remove="${id}">Remove</button>
        </div>
      </div>`;
    }).join('') || '<p class="small">No teams yet.</p>';

    document.querySelectorAll('[data-delta]').forEach(b => b.onclick = () => adjustScore(b.dataset.id, Number(b.dataset.delta)));
    document.querySelectorAll('[data-rename]').forEach(b => b.onclick = () => renameTeam(b.dataset.rename));
    document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => removeTeam(b.dataset.remove));
    previousScores = Object.fromEntries(Object.entries(teams).map(([id,t]) => [id, t.score || 0]));
  }

  async function loadQuestion(index, phase='open') {
    const questions = getQuestions();
    if (!questions[index]) return;
    const currentTeams = state.teams || {};
    const eligibleTeams = Object.fromEntries(Object.keys(currentTeams).map(id => [id, true]));
    saveTimerSettings();
    const { enabled: timerEnabled, seconds: timerDuration } = timerSettings();
    const timerEndAt = timerEnabled && phase === 'open' ? Date.now() + serverTimeOffset + timerDuration * 1000 : null;
    await roomRef.update({
      questionIndex: index,
      currentQuestion: questions[index],
      phase,
      answers: null,
      scored: false,
      eligibleTeams,
      message: '',
      timerEnabled,
      timerDuration,
      timerRunning: timerEnabled && phase === 'open',
      timerEndAt,
      timerPausedRemaining: timerEnabled ? null : timerDuration * 1000,
      timerLockedReason: null
    });
  }

  $('startBtn').onclick = async () => { $('joinPanel').classList.add('hidden'); await countdownToQuestion(questionIndex); };
  $('lockBtn').onclick = () => lockAnswers('manual');
  $('nextBtn').onclick = async () => {
    const next = questionIndex + 1;
    if (next >= getQuestions().length) { await roomRef.update({phase:'complete',currentQuestion:null,answers:null,timerRunning:false,timerEndAt:null,timerPausedRemaining:null,message:'Game complete!'}); return showChampion((await roomRef.once('value')).val()?.teams||{}); }
    await countdownToQuestion(next);
  };
  $('revealBtn').onclick = revealSequence;

  async function scoreAndReveal() {
    const snap = await roomRef.once('value');
    const s = snap.val() || {};
    if (!s.currentQuestion) return;

    const resetMs = Math.max(5, Number(s.timerDuration || timerSettings().seconds || 30)) * 1000;

    if (s.scored) {
      return roomRef.update({
        phase: 'revealed',
        timerRunning: false,
        timerEndAt: null,
        timerPausedRemaining: s.timerEnabled ? resetMs : null,
        timerLockedReason: null
      });
    }

    const teams = s.teams || {};
    const answers = s.answers || {};
    const eligibleTeams = s.eligibleTeams || Object.fromEntries(Object.keys(teams).map(id => [id, true]));
    const q = s.currentQuestion;
    const correctEntries=Object.entries(eligibleTeams).filter(([id,a])=>a&&teams[id]&&answers[id]&&answers[id].choice===q.answer).map(([id])=>({id,submittedAt:Number(answers[id].submittedAt||0)})).filter(x=>x.submittedAt>0).sort((a,b)=>a.submittedAt-b.submittedAt);
    const fastest=correctEntries[0]||null, fastestName=fastest?(teams[fastest.id]?.name||fastest.id):null;
    const updates={phase:'revealed',scored:true,timerRunning:false,timerEndAt:null,timerPausedRemaining:s.timerEnabled?resetMs:null,timerLockedReason:null,fastestCorrectName:fastestName};
    Object.entries(eligibleTeams).forEach(([id,active])=>{if(!active||!teams[id])return;const answer=answers[id],correct=!!answer&&answer.choice===q.answer,delta=!answer?-50:(correct?(q.points||100):-50),streak=correct?Number(teams[id].streak||0)+1:0;updates[`teams/${id}/score`]=(teams[id].score||0)+delta;updates[`teams/${id}/streak`]=streak;updates[`teams/${id}/bestStreak`]=Math.max(Number(teams[id].bestStreak||0),streak);updates[`teams/${id}/lastDelta`]=delta;updates[`teams/${id}/lastResult`]=!answer?'NO ANSWER':(correct?'CORRECT':'WRONG')});

    await roomRef.update(updates);
    if (Object.keys(eligibleTeams).length) setTimeout(() => GameFX.burst(document.querySelector('.stadium-leaderboard'), 28), 180);
  }

  async function renameTeam(id) {
    const team = state.teams?.[id];
    if (!team) return;
    const proposed = prompt('Enter the new team name:', team.name || '');
    if (proposed === null) return;
    const newName = normalize(proposed);
    if (!newName) return alert('Team name cannot be blank.');
    if (newName.length > 20) return alert('Team names can be no more than 20 characters.');
    if (inappropriate(newName)) return alert('Choose a different team name.');

    const newKey = nameKey(newName), oldKey = nameKey(team.name || '');
    if (newKey !== oldKey) {
      const reservation = await roomRef.child('nameRegistry/' + newKey).transaction(v => v || id);
      if (!reservation.committed || reservation.snapshot.val() !== id) return alert('That team name is already being used.');
    }

    const updates = {};
    updates[`teams/${id}/name`] = newName;
    if (state.answers?.[id]) updates[`answers/${id}/teamName`] = newName;
    if (oldKey && oldKey !== newKey) updates[`nameRegistry/${oldKey}`] = null;
    updates[`nameRegistry/${newKey}`] = id;
    await roomRef.update(updates);
  }

  async function removeTeam(id) {
    const team = state.teams?.[id];
    if (!team || !confirm(`Remove ${team.name || 'this team'} from the game?`)) return;
    const updates = {};
    updates[`teams/${id}`] = null;
    updates[`answers/${id}`] = null;
    updates[`eligibleTeams/${id}`] = null;
    const key = nameKey(team.name || '');
    if (key) updates[`nameRegistry/${key}`] = null;
    await roomRef.update(updates);
  }

  async function adjustScore(id, delta) {
    await roomRef.child(`teams/${id}/score`).transaction(v => (v || 0) + delta);
  }

  $('resetBtn').onclick = async () => {
    if (!confirm('Reset all scores and restart the game?')) return;
    const teams = state.teams || {};
    const updates = { phase: 'waiting', questionIndex: 0, currentQuestion: null, answers: null, scored: false, eligibleTeams: null, timerRunning: false, timerEndAt: null, timerPausedRemaining: null, timerLockedReason: null, message: 'New game ready.' };
    Object.keys(teams).forEach(id => updates[`teams/${id}/score`] = 0);
    await roomRef.update(updates);
    $('joinPanel').classList.remove('hidden');
    renderJoinQr();
  };

  GameFX.addSoundToggle();
})();
