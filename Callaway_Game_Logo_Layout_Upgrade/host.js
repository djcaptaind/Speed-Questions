(() => {
  const $ = id => document.getElementById(id);
  let db, roomRef, roomCode, state = {}, questionIndex = 0, previousPhase = null, previousIndex = null, previousScores = {};

  const configured = () => window.FIREBASE_CONFIG && !String(window.FIREBASE_CONFIG.apiKey).startsWith('PASTE_');
  const esc = (s='') => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const normalize = (s='') => s.trim().replace(/\s+/g, ' ');
  const nameKey = (s='') => normalize(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
  const blocked = ['fuck','shit','bitch','asshole','nigger','nigga','cunt','dick','pussy'];
  const inappropriate = s => blocked.some(w => normalize(s).toLowerCase().replace(/[^a-z0-9]/g,'').includes(w));
  const getQuestions = () => window.GAME_QUESTIONS || [];

  function initFirebase() {
    if (!configured()) return false;
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database();
    return true;
  }

  function renderJoinQr() {
    const joinUrl = new URL('index.html', window.location.href).href;
    $('joinRoomCode').textContent = roomCode;
    $('joinUrlText').textContent = joinUrl;
    $('joinQr').innerHTML = '';
    if (window.QRCode) new QRCode($('joinQr'), { text: joinUrl, width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M });
    else $('joinQr').textContent = 'QR unavailable';
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
      renderJoinQr();
      GameFX.addSoundToggle();
      GameFX.sounds.join();
      listen();
    } catch (e) {
      $('setupError').textContent = 'Could not open room: ' + (e.message || e);
    }
  });

  function listen() {
    roomRef.on('value', snap => {
      const oldPhase = previousPhase, oldIndex = previousIndex;
      state = snap.val() || {};
      questionIndex = state.questionIndex || 0;
      render();
      if (oldIndex !== null && questionIndex !== oldIndex && state.currentQuestion) {
        GameFX.sounds.open();
        GameFX.pulse($('questionText'));
      }
      if (oldPhase && oldPhase !== state.phase && state.phase === 'locked') GameFX.sounds.lock();
      if (oldPhase && oldPhase !== state.phase && state.phase === 'revealed') GameFX.sounds.correct();
      previousPhase = state.phase || 'waiting';
      previousIndex = questionIndex;
    });
  }

  function render() {
    const q = state.currentQuestion;
    const teams = state.teams || {};
    const count = Object.keys(teams).length;

    $('connectedCount').textContent = `${count} Team${count === 1 ? '' : 's'} Connected`;
    $('roundText').textContent = q ? `Question ${questionIndex + 1} of ${getQuestions().length}` : 'Ready';
    $('phaseText').textContent = (state.phase || 'waiting').toUpperCase();
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
    $('startBtn').disabled = !!q && state.phase !== 'waiting';

    renderSubmissions();
    renderScores();
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
      return `<div class="submission-row"><strong>${esc(t.name || id)}</strong><span>${display}${result}</span></div>`;
    }).join('') || '<div class="submission-row"><strong>Waiting for teams...</strong><span>—</span></div>';
  }

  function renderScores() {
    const teams = state.teams || {};
    const sorted = Object.entries(teams).sort((a,b) => (b[1].score || 0) - (a[1].score || 0) || (a[1].name || '').localeCompare(b[1].name || ''));
    $('scoreboard').innerHTML = sorted.map(([id,t],idx) => {
      const score = t.score || 0;
      const delta = score - (previousScores[id] ?? score);
      const sc = score > 0 ? 'score-good' : score < 0 ? 'score-bad' : '';
      return `<div class="host-team-row ${idx===0 && state.phase==='revealed' ? 'leaderboard-winner' : ''}">
        <div>
          <strong>${idx+1}. ${esc(t.name || id)}</strong>
          <div class="small ${delta>0 ? 'score-up' : delta<0 ? 'score-down' : ''} ${sc}">${score} points</div>
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
    await roomRef.update({
      questionIndex: index,
      currentQuestion: questions[index],
      phase,
      answers: null,
      scored: false,
      eligibleTeams,
      message: ''
    });
  }

  $('startBtn').onclick = async () => {
    await loadQuestion(questionIndex, 'open');
    $('joinPanel').classList.add('hidden');
  };
  $('lockBtn').onclick = () => roomRef.child('phase').set('locked');
  $('nextBtn').onclick = async () => {
    const next = questionIndex + 1;
    if (next >= getQuestions().length) {
      return roomRef.update({ phase: 'waiting', currentQuestion: null, answers: null, message: 'Game complete! Final scores are on the board.' });
    }
    await loadQuestion(next, 'open');
  };
  $('revealBtn').onclick = scoreAndReveal;

  async function scoreAndReveal() {
    const snap = await roomRef.once('value');
    const s = snap.val() || {};
    if (s.scored || !s.currentQuestion) return roomRef.update({ phase: 'revealed' });

    const teams = s.teams || {};
    const answers = s.answers || {};
    const eligibleTeams = s.eligibleTeams || Object.fromEntries(Object.keys(teams).map(id => [id, true]));
    const q = s.currentQuestion;
    const updates = { phase: 'revealed', scored: true };

    Object.entries(eligibleTeams).forEach(([id, active]) => {
      if (!active || !teams[id]) return;
      const answer = answers[id];
      const delta = !answer ? -50 : (answer.choice === q.answer ? (q.points || 100) : -50);
      updates[`teams/${id}/score`] = (teams[id].score || 0) + delta;
    });

    await roomRef.update(updates);
    if (Object.keys(eligibleTeams).length) setTimeout(() => GameFX.burst(document.querySelector('.host-leaderboard'), 28), 180);
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
    const updates = { phase: 'waiting', questionIndex: 0, currentQuestion: null, answers: null, scored: false, eligibleTeams: null, message: 'New game ready.' };
    Object.keys(teams).forEach(id => updates[`teams/${id}/score`] = 0);
    await roomRef.update(updates);
    $('joinPanel').classList.remove('hidden');
    renderJoinQr();
  };

  GameFX.addSoundToggle();
})();
