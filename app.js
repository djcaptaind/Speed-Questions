(() => {
  const $ = id => document.getElementById(id);
  let db, roomRef, roomCode, teamId, teamName, currentState = null, selected = null, previousPhase = null, previousQuestionIndex = null, previousMyScore = null;
  let timerInterval = null, serverTimeOffset = 0;

  const BLOCKED_WORDS = ['fuck','shit','bitch','asshole','nigger','nigga','cunt','dick','pussy'];
  function configured() { return window.FIREBASE_CONFIG && !String(window.FIREBASE_CONFIG.apiKey).startsWith('PASTE_'); }
  function normalizeName(s='') { return s.trim().replace(/\s+/g,' '); }
  function nameKey(s='') { return normalizeName(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40); }
  function inappropriateName(s='') { const x = normalizeName(s).toLowerCase().replace(/[^a-z0-9]/g,''); return BLOCKED_WORDS.some(w => x.includes(w)); }
  function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }

  function timerRemainingMs(state = currentState) {
    if (!state || !state.timerEnabled) return null;
    if (state.timerRunning && state.timerEndAt) return Math.max(0, Number(state.timerEndAt) - (Date.now() + serverTimeOffset));
    if (state.timerPausedRemaining != null) return Math.max(0, Number(state.timerPausedRemaining));
    if (state.timerDuration) return Math.max(0, Number(state.timerDuration) * 1000);
    return null;
  }

  function updateTeamTimer() {
    const ring = $('teamTimerRing');
    const text = $('teamTimerText');
    if (!ring || !text) return;
    const state = currentState || {};
    const enabled = !!state.timerEnabled;
    ring.classList.toggle('timer-disabled', !enabled);
    ring.classList.toggle('timer-paused', enabled && !state.timerRunning && state.phase === 'open');
    ring.classList.toggle('timer-reset', enabled && !state.timerRunning && state.phase === 'revealed');
    if (!enabled) {
      text.textContent = 'OFF';
      ring.style.setProperty('--timer-progress', '0deg');
      ring.classList.remove('timer-low', 'timer-critical');
      return;
    }
    const total = Math.max(1, Number(state.timerDuration || 30) * 1000);
    const ms = Math.max(0, timerRemainingMs(state) ?? total);
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    text.textContent = mins > 0 ? `${mins}:${String(secs).padStart(2,'0')}` : String(seconds);
    ring.style.setProperty('--timer-progress', `${Math.max(0, Math.min(1, ms / total)) * 360}deg`);
    ring.classList.toggle('timer-low', seconds <= 10 && seconds > 5);
    ring.classList.toggle('timer-critical', seconds <= 5);
  }

  timerInterval = setInterval(updateTeamTimer, 200);

  function initFirebase() {
    if (!configured()) return false;
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database();
    db.ref('.info/serverTimeOffset').on('value', snap => { serverTimeOffset = Number(snap.val() || 0); });
    return true;
  }

  $('joinBtn').addEventListener('click', async () => {
    $('joinError').textContent = '';
    roomCode = $('roomCode').value.trim().toUpperCase();
    teamName = normalizeName($('teamName').value);
    if (!roomCode || !teamName) return $('joinError').textContent = 'Enter a room code and team name.';
    if (teamName.length > 20) return $('joinError').textContent = 'Team names can be no more than 20 characters.';
    if (inappropriateName(teamName)) return $('joinError').textContent = 'Choose a different team name.';
    if (!initFirebase()) return $('joinError').textContent = 'Firebase is not configured yet.';
    roomRef = db.ref('rooms/' + roomCode);
    const snap = await roomRef.once('value');
    if (!snap.exists()) return $('joinError').textContent = 'That room is not open yet. Ask the instructor to create it first.';

    const storedId = localStorage.getItem('answerGameTeamId_' + roomCode);
    const existingTeam = storedId ? (await roomRef.child('teams/' + storedId).once('value')).val() : null;
    if (existingTeam && normalizeName(existingTeam.name).toLowerCase() === teamName.toLowerCase()) {
      teamId = storedId;
    } else {
      const key = nameKey(teamName);
      if (!key) return $('joinError').textContent = 'Choose a team name with at least one letter or number.';
      const reservation = await roomRef.child('nameRegistry/' + key).transaction(v => v || 'reserved');
      if (!reservation.committed) return $('joinError').textContent = 'That team name is already being used. Choose another name.';
      teamId = roomRef.child('teams').push().key;
      await roomRef.child('teams/' + teamId).set({ name: teamName, score: 0, joinedAt: Date.now() });
      await roomRef.child('nameRegistry/' + key).set(teamId);
      localStorage.setItem('answerGameTeamId_' + roomCode, teamId);
    }

    localStorage.setItem('answerGameRoom', roomCode);
    localStorage.setItem('answerGameTeam', teamName);
    $('joinView').classList.add('hidden');
    $('gameView').classList.remove('hidden');
    $('teamLabel').textContent = teamName;
    $('roomLabel').textContent = roomCode;
    GameFX.addSoundToggle();
    GameFX.sounds.join();
    listen();
  });

  function listen() {
    roomRef.on('value', snap => {
      const nextState = snap.val() || {};
      const oldPhase = previousPhase;
      const oldIndex = previousQuestionIndex;
      currentState = nextState;

      if (oldIndex !== null && currentState.questionIndex !== oldIndex) selected = null;

      renderQuestion(currentState);
      renderScores(currentState.teams || {});

      if (oldIndex !== null && currentState.questionIndex !== oldIndex && currentState.currentQuestion) {
        GameFX.sounds.open();
        GameFX.pulse($('questionText'));
      }

      if (oldPhase && oldPhase !== currentState.phase && currentState.phase === 'locked') GameFX.sounds.lock();
      if (oldPhase && oldPhase !== currentState.phase && currentState.phase === 'revealed') {
        const myAnswer = currentState.answers?.[teamId]?.choice;
        const q = currentState.currentQuestion;
        const eligible = !!currentState.eligibleTeams?.[teamId];
        if (q && eligible) {
          if (myAnswer === undefined) {
            GameFX.sounds.wrong();
            GameFX.floatScore('-50', false, $('statusMessage'));
          } else {
            const ok = myAnswer === q.answer;
            GameFX.sounds[ok ? 'correct' : 'wrong']();
            GameFX.pulse($('statusMessage'));
            GameFX.floatScore(ok ? `+${q.points || 100}` : '-50', ok, $('statusMessage'));
            if (ok) GameFX.burst($('statusMessage'), 18);
          }
        }
      }
      previousPhase = currentState.phase || 'waiting';
      previousQuestionIndex = currentState.questionIndex ?? null;
    });
  }

  function renderQuestion(state) {
    const q = state.currentQuestion;
    const phase = state.phase || 'waiting';
    const eligible = !!state.eligibleTeams?.[teamId];
    document.body.dataset.phase = phase;
    if ($('teamPhasePill')) $('teamPhasePill').textContent = phase.toUpperCase();
    updateTeamTimer();

    if (!q) {
      $('roundText').textContent = 'Waiting for host...';
      $('questionText').textContent = state.message || 'The instructor will start the first question.';
      $('choices').innerHTML = '';
      $('answerState').textContent = '';
      $('statusMessage').textContent = 'Ready.';
      selected = null;
      updateTeamTimer();
      return;
    }

    $('roundText').textContent = `Question ${(state.questionIndex ?? 0) + 1}`;
    $('questionText').textContent = q.question;
    $('questionText').classList.remove('question-enter');
    void $('questionText').offsetWidth;
    $('questionText').classList.add('question-enter');

    $('answerState').textContent =
      phase === 'open' ? 'Answers Open' :
      phase === 'locked' ? 'Answers Locked' :
      phase === 'revealed' ? 'Answer Revealed' : '';

    const myAnswer = state.answers?.[teamId]?.choice;
    if (myAnswer !== undefined) selected = myAnswer;

    $('choices').innerHTML = q.choices.map((choice, i) => {
      let cls = 'choice';
      if (selected === i) cls += ' selected';
      if (phase === 'revealed') cls += i === q.answer ? ' correct' : (selected === i ? ' wrong' : '');
      return `<button class="${cls}" data-choice="${i}" ${phase !== 'open' ? 'disabled' : ''}><span class="choice-letter">${String.fromCharCode(65+i)}</span>${escapeHtml(choice)}</button>`;
    }).join('');

    document.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => submitOrChangeAnswer(Number(btn.dataset.choice))));

    if (phase === 'open') {
      $('statusMessage').textContent = myAnswer !== undefined
        ? `Selected ${String.fromCharCode(65 + myAnswer)}. You may change your answer until the timer ends or the instructor locks answers.`
        : 'Choose an answer. You may change it until the timer ends or the instructor locks answers.';
    }
    if (phase === 'locked') {
      $('statusMessage').textContent = myAnswer !== undefined
        ? `${state.timerLockedReason === 'timer' ? 'TIME EXPIRED • ' : ''}Final answer locked: ${String.fromCharCode(65 + myAnswer)}.`
        : (state.timerLockedReason === 'timer' ? 'TIME EXPIRED. No answer was submitted.' : 'Answers are locked. No answer was submitted.');
    }
    if (phase === 'revealed') {
      const isCorrect = myAnswer === q.answer;
      $('statusMessage').textContent = !eligible ? 'You joined after the question started, so this question was not scored for your team.' :
        myAnswer === undefined ? `No answer submitted. -50 points. Correct answer: ${String.fromCharCode(65+q.answer)}.` :
        isCorrect ? `Correct! +${q.points || 100} points.` : `Incorrect. -50 points. Correct answer: ${String.fromCharCode(65+q.answer)}.`;
    }
  }

  async function submitOrChangeAnswer(choice) {
    if (!currentState || currentState.phase !== 'open') return;
    selected = choice;
    await roomRef.child('answers/' + teamId).set({ choice, submittedAt: Date.now(), teamName });
    $('statusMessage').textContent = `Selected ${String.fromCharCode(65 + choice)}. You may change your answer until the timer ends or the instructor locks answers.`;
  }

  function renderScores(teams) {
    const myScore = teams?.[teamId]?.score ?? 0;
    const scoreDelta = previousMyScore === null ? 0 : myScore - previousMyScore;
    const sorted = Object.entries(teams).sort((a,b) => (b[1].score||0)-(a[1].score||0) || (a[1].name||'').localeCompare(b[1].name||''));
    $('scoreboard').innerHTML = sorted.map(([id,t], idx) => {
      const medal = idx === 0 ? '⚡' : String(idx + 1);
      return `<div class="score-row ${id===teamId?'my-team':''}">
        <div class="rank">${medal}</div>
        <div class="score-name">${escapeHtml(t.name||id)}</div>
        <div class="score-points ${id===teamId&&scoreDelta>0?'score-up':id===teamId&&scoreDelta<0?'score-down':''}">${t.score||0}</div>
      </div>`;
    }).join('') || '<p class="small">No teams yet.</p>';
    previousMyScore = myScore;
  }

  const urlRoom = new URLSearchParams(window.location.search).get('room');
  const savedRoom = localStorage.getItem('answerGameRoom');
  const savedTeam = localStorage.getItem('answerGameTeam');
  if (urlRoom) $('roomCode').value = String(urlRoom).toUpperCase();
  else if (savedRoom) $('roomCode').value = savedRoom;
  if (savedTeam) $('teamName').value = savedTeam;
  GameFX.addSoundToggle();
})();
