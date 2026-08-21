(() => {
  const $ = id => document.getElementById(id);
  let db, roomRef, roomCode, teamId, teamName, currentState = null, selected = null, previousPhase = null, previousQuestionIndex = null, previousMyScore = null;
  let timerInterval = null, serverTimeOffset = 0;

  // GOD MODE / PERFORMANCE runtime state.
  // These MUST be declared before the Firebase room listener runs.
  let previousCinematicKey = '';
  let lastRenderedQuestionKey = '';
  let lastRenderedPhase = '';
  let lastTeamsSignature = '';
  let answerWriteTimer = null;
  let answerWriteInFlight = false;
  let queuedChoice = null;
  const ANSWER_WRITE_DEBOUNCE_MS = 90;

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

  function showCinematic(eyebrow,main,sub,mode='countdown'){const el=$('cinematicOverlay');if(!el)return;$('cinematicEyebrow').textContent=eyebrow;$('cinematicMain').textContent=main;$('cinematicSub').textContent=sub;el.className=`cinematic-overlay mode-${mode} cinematic-live`;el.classList.remove('hidden')}
  function hideCinematic(){const el=$('cinematicOverlay');if(el)el.classList.add('hidden')}
  function showImpact(k='TIME!',m='ANSWERS LOCKED',s='WAIT FOR THE REVEAL'){const el=$('impactOverlay');if(!el)return;$('impactKicker').textContent=k;$('impactMain').textContent=m;$('impactSub').textContent=s;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),1400)}
  function showChampion(t={}){const a=Object.entries(t).sort((x,y)=>(y[1].score||0)-(x[1].score||0)).slice(0,3);if(!a.length)return;const[id,v]=a[0],m=['🥇','🥈','🥉'];$('championName').textContent=v.name||id;$('championScore').textContent=`${v.score||0} POINTS`;$('podiumBoard').innerHTML=a.map(([i,x],n)=>`<div class="podium-place place-${n+1}"><span>${m[n]}</span><strong>${escapeHtml(x.name||i)}</strong><b>${x.score||0}</b></div>`).join('');$('championOverlay').classList.remove('hidden');GameFX.burst($('championOverlay'),50)}
  function syncCinematic(s){const p=s.phase||'waiting';if(p==='countdown'&&s.countdownEndAt){const rem=Math.max(0,Number(s.countdownEndAt)-Date.now()),n=Math.max(1,Math.min(3,Math.ceil(rem/700))),k=`c:${s.countdownTargetIndex}:${n}`;if(k!==previousCinematicKey){previousCinematicKey=k;showCinematic(`QUESTION ${(s.countdownTargetIndex||0)+1}`,String(n),'GET READY','countdown')}return}if(p==='reveal_countdown'&&s.revealEndAt){const rem=Math.max(0,Number(s.revealEndAt)-Date.now()),n=Math.max(1,Math.min(3,Math.ceil(rem/600))),k=`r:${s.questionIndex}:${n}`;if(k!==previousCinematicKey){previousCinematicKey=k;showCinematic('ANSWER REVEAL',String(n),'LOCKED IN','reveal')}return}if(p==='complete'){hideCinematic();showChampion(s.teams||{});return}if(previousCinematicKey&&!['countdown','reveal_countdown'].includes(p)){previousCinematicKey='';hideCinematic()}}
  function initFirebase() {
    if (!configured()) return false;
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database();
    db.ref('.info/serverTimeOffset').on('value', snap => { serverTimeOffset = Number(snap.val() || 0); });
    db.ref('.info/connected').on('value', snap => {
      const connected = snap.val() === true;
      document.body.dataset.firebaseConnected = connected ? 'true' : 'false';
      const badge = $('connectionBadge');
      if (badge) {
        badge.textContent = connected ? '● LIVE' : '● RECONNECTING';
        badge.classList.toggle('connection-offline', !connected);
      }
    });
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
    attachCriticalStateListeners();
  });

  function listen() {
    roomRef.on('value', snap => {
      const nextState = snap.val() || {};
      const badge = $('connectionBadge');
      if (badge) {
        badge.textContent = '● LIVE';
        badge.classList.remove('connection-offline');
      }
      const oldPhase = previousPhase;
      const oldIndex = previousQuestionIndex;
      currentState = nextState;

      // Visual effects are non-critical. Never allow an animation failure to stop
      // the Firebase question/phase listener from updating the cadet screen.
      try {
        syncCinematic(currentState);
      } catch (fxError) {
        console.warn('Cinematic effect skipped:', fxError);
        hideCinematic();
      }

      if (oldIndex !== null && currentState.questionIndex !== oldIndex) selected = null;

      const q = currentState.currentQuestion;
      const questionKey = q
        ? `${currentState.questionIndex}:${currentState.questionVersion || ''}:${q.question}:${(q.choices || []).join('~')}`
        : `${currentState.phase}:none`;
      const phaseChanged = (currentState.phase || 'waiting') !== lastRenderedPhase;
      const questionChanged = questionKey !== lastRenderedQuestionKey;

      // PERFORMANCE MODE:
      // Answer writes arrive through the room listener too. Do not rebuild all A/B/C/D
      // buttons for those answer-only updates. Re-render only on a question/phase change.
      if (questionChanged || phaseChanged) {
        renderQuestion(currentState);
        lastRenderedQuestionKey = questionKey;
        lastRenderedPhase = currentState.phase || 'waiting';
      } else {
        syncMySelectionFromState(currentState);
        updateTeamTimer();
      }

      const teamsSignature = Object.entries(currentState.teams || {})
        .map(([id,t]) => `${id}:${t.score||0}:${t.streak||0}:${t.name||''}`)
        .sort().join('|');
      if (teamsSignature !== lastTeamsSignature) {
        renderScores(currentState.teams || {});
        lastTeamsSignature = teamsSignature;
      }

      if (oldIndex !== null && currentState.questionIndex !== oldIndex && currentState.currentQuestion) {
        GameFX.sounds.open();
        GameFX.pulse($('questionText'));
      }

      if (oldPhase && oldPhase !== currentState.phase && currentState.phase === 'locked') { GameFX.sounds.lock(); showImpact(currentState.timerLockedReason==='timer'?'TIME!':'LOCKED!','ANSWERS LOCKED','WAIT FOR THE REVEAL'); }
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
      if (oldPhase === 'open' && currentState.phase !== 'open') {
        clearTimeout(answerWriteTimer);
        // Any selection already sent remains authoritative. Stop queued post-lock writes.
        queuedChoice = null;
      }
      previousPhase = currentState.phase || 'waiting';
      previousQuestionIndex = currentState.questionIndex ?? null;
    });
  }

  function attachCriticalStateListeners() {
    if (!roomRef) return;
    roomRef.child('currentQuestion').on('value', snap => {
      const q = snap.val();
      if (!q || !currentState) return;
      currentState.currentQuestion = q;
      const key = `${currentState.questionIndex || 0}:${currentState.questionVersion || ''}:${q.question}:${(q.choices || []).join('~')}`;
      if (key !== lastRenderedQuestionKey) {
        renderQuestion(currentState);
        lastRenderedQuestionKey = key;
      }
    });
    roomRef.child('phase').on('value', snap => {
      const phase = snap.val();
      if (!phase || !currentState || phase === currentState.phase) return;
      currentState.phase = phase;
      renderQuestion(currentState);
      lastRenderedPhase = phase;
    });
  }

  function paintSelectedChoice(choice) {
    document.querySelectorAll('[data-choice]').forEach(btn => {
      btn.classList.toggle('selected', Number(btn.dataset.choice) === choice);
    });
  }

  function syncMySelectionFromState(state) {
    if (!state || !teamId) return;
    const serverChoice = state.answers?.[teamId]?.choice;
    // Do not let an older Firebase echo visually overwrite a newer local tap.
    if (queuedChoice !== null || answerWriteInFlight) return;
    if (serverChoice !== undefined && serverChoice !== selected) {
      selected = serverChoice;
      paintSelectedChoice(selected);
    }
  }

  async function flushQueuedAnswer() {
    if (answerWriteInFlight || queuedChoice === null || !roomRef || !teamId) return;
    if (!currentState || currentState.phase !== 'open') {
      queuedChoice = null;
      return;
    }

    const choiceToWrite = queuedChoice;
    queuedChoice = null;
    answerWriteInFlight = true;
    try {
      // Write only this team's answer node. This is the smallest possible Firebase update.
      await roomRef.child('answers/' + teamId).set({
        choice: choiceToWrite,
        submittedAt: Date.now(),
        teamName
      });
    } catch (err) {
      console.error('Answer write failed:', err);
      $('statusMessage').textContent = 'Connection issue — tap your answer again.';
    } finally {
      answerWriteInFlight = false;
      // If the cadet changed again while the previous write was traveling, send only the newest choice.
      if (queuedChoice !== null && currentState?.phase === 'open') {
        clearTimeout(answerWriteTimer);
        answerWriteTimer = setTimeout(flushQueuedAnswer, 35);
      }
    }
  }

  function renderQuestion(state) {
    const q = state.currentQuestion;
    const phase = state.phase || 'waiting';
    const eligible = !!state.eligibleTeams?.[teamId];
    document.body.dataset.phase = phase;
    if ($('teamPhasePill')) $('teamPhasePill').textContent = phase.toUpperCase();
    updateTeamTimer();

    if (phase === 'countdown') {
      $('roundText').textContent = `Question ${(state.countdownTargetIndex ?? state.questionIndex ?? 0) + 1} incoming`;
      $('answerState').textContent = 'Countdown';
      $('statusMessage').textContent = 'Get ready. Answers open at GO.';
      if (q) {
        $('questionText').textContent = q.question;
        $('choices').innerHTML = q.choices.map((choice, i) =>
          `<button class="choice preview-choice" data-choice="${i}" disabled><span class="choice-letter">${String.fromCharCode(65+i)}</span>${escapeHtml(choice)}</button>`
        ).join('');
      } else {
        $('questionText').textContent = 'Question loading...';
        $('choices').innerHTML = '';
      }
      updateTeamTimer();
      return;
    }
    if (phase === 'reveal_countdown') { $('answerState').textContent='Reveal Countdown'; $('statusMessage').textContent='Answers are locked. Correct answer incoming...'; }
    if (!q) {
      $('roundText').textContent = phase === 'complete' ? 'FINAL RESULTS' : 'Waiting for host...';
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
    if (`${state.questionIndex}:${q.question}` !== lastRenderedQuestionKey) {
      $('questionText').classList.remove('question-enter');
      void $('questionText').offsetWidth;
      $('questionText').classList.add('question-enter');
    }

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

  function submitOrChangeAnswer(choice) {
    if (!currentState || currentState.phase !== 'open') return;

    // OPTIMISTIC UI: selection changes instantly; never wait on the network to paint the button.
    selected = choice;
    paintSelectedChoice(choice);
    $('statusMessage').textContent = `Selected ${String.fromCharCode(65 + choice)}. You may change your answer until the timer ends or the instructor locks answers.`;

    // Keep only the cadet's newest rapid selection and send it after a tiny debounce.
    queuedChoice = choice;
    clearTimeout(answerWriteTimer);
    answerWriteTimer = setTimeout(flushQueuedAnswer, ANSWER_WRITE_DEBOUNCE_MS);
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
