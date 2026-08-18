(() => {
  const $ = id => document.getElementById(id);
  let db, roomRef, roomCode, state = {}, questionIndex = 0;
  const questions = window.GAME_QUESTIONS || [];
  const configured = () => window.FIREBASE_CONFIG && !String(window.FIREBASE_CONFIG.apiKey).startsWith('PASTE_');
  const escapeHtml = (s='') => s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const BLOCKED_WORDS = ['fuck','shit','bitch','asshole','nigger','nigga','cunt','dick','pussy'];
  const normalizeName = (s='') => s.trim().replace(/\s+/g,' ');
  const nameKey = (s='') => normalizeName(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
  const inappropriateName = (s='') => { const x=normalizeName(s).toLowerCase().replace(/[^a-z0-9]/g,''); return BLOCKED_WORDS.some(w=>x.includes(w)); };

  function initFirebase() {
    if (!configured()) return false;
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database(); return true;
  }

  $('createBtn').addEventListener('click', async () => {
    $('setupError').textContent='';
    roomCode = $('roomCode').value.trim().toUpperCase();
    if (!roomCode) return $('setupError').textContent='Enter a room code.';
    if (!initFirebase()) return $('setupError').innerHTML='Firebase is not configured. Complete <span class="code">firebase-config.js</span> first.';
    roomRef = db.ref('rooms/' + roomCode);
    const snap = await roomRef.once('value');
    if (!snap.exists()) await roomRef.set({ createdAt: Date.now(), phase:'waiting', questionIndex:0, teams:{} });
    $('setupView').classList.add('hidden'); $('hostView').classList.remove('hidden'); $('roomLabel').textContent=roomCode;
    listen();
  });

  function listen() {
    roomRef.on('value', snap => { state=snap.val()||{}; questionIndex=state.questionIndex||0; render(); });
  }

  function render() {
    const q=state.currentQuestion;
    $('roundText').textContent = q ? `Question ${questionIndex+1} of ${questions.length}` : 'Ready';
    $('phaseText').textContent=(state.phase||'waiting').toUpperCase();
    $('questionText').textContent=q?.question || 'Select Start Question.';
    $('choices').innerHTML=q ? q.choices.map((c,i)=>`<div class="choice host-choice ${state.phase==='revealed'&&i===q.answer?'correct':''}"><span class="choice-letter">${String.fromCharCode(65+i)}</span>${escapeHtml(c)}</div>`).join('') : '';
    $('lockBtn').disabled=state.phase!=='open';
    $('revealBtn').disabled=!['open','locked'].includes(state.phase);
    $('nextBtn').disabled=state.phase!=='revealed';
    $('startBtn').disabled=!!q && state.phase!=='waiting';
    renderSubmissions(); renderScores();
  }

  function renderSubmissions() {
    const teams=state.teams||{}, answers=state.answers||{};
    $('submissions').innerHTML=Object.entries(teams).map(([id,t])=>{
      const a=answers[id]; const display=a ? String.fromCharCode(65+a.choice) : '—';
      const result=state.phase==='revealed'&&a ? (a.choice===state.currentQuestion.answer?' ✓':' ✗') : '';
      return `<div class="submission-row"><strong>${escapeHtml(t.name||id)}</strong><span>${display}${result}</span></div>`;
    }).join('') || '<p class="small">Teams will appear here after they join.</p>';
  }

  function renderScores() {
    const teams=state.teams||{};
    const sorted=Object.entries(teams).sort((a,b)=>(b[1].score||0)-(a[1].score||0));
    $('scoreboard').innerHTML=sorted.map(([id,t],idx)=>`<div class="host-team-row"><div><strong>${idx+1}. ${escapeHtml(t.name||id)}</strong><div class="small">${t.score||0} points</div></div><div class="adjust"><button class="btn btn-ghost" data-id="${id}" data-delta="-50">−50</button><button class="btn btn-primary" data-id="${id}" data-delta="50">+50</button><button class="btn btn-ghost" data-rename="${id}">Rename</button><button class="btn btn-danger" data-remove="${id}">Remove</button></div></div>`).join('') || '<p class="small">No teams yet.</p>';
    document.querySelectorAll('[data-delta]').forEach(b=>b.addEventListener('click',()=>adjustScore(b.dataset.id,Number(b.dataset.delta))));
    document.querySelectorAll('[data-rename]').forEach(b=>b.addEventListener('click',()=>renameTeam(b.dataset.rename)));
    document.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeTeam(b.dataset.remove)));
  }

  async function loadQuestion(index, phase='open') {
    if (!questions[index]) return;
    const q=questions[index];
    await roomRef.update({ questionIndex:index, currentQuestion:q, phase, answers:null, scored:false });
  }
  $('startBtn').addEventListener('click',()=>loadQuestion(questionIndex,'open'));
  $('lockBtn').addEventListener('click',()=>roomRef.child('phase').set('locked'));
  $('nextBtn').addEventListener('click',async()=>{
    const next=questionIndex+1;
    if (next>=questions.length) return roomRef.update({ phase:'waiting', currentQuestion:null, answers:null, message:'Game complete! Final scores are on the board.' });
    await loadQuestion(next,'open');
  });
  $('revealBtn').addEventListener('click',scoreAndReveal);

  async function scoreAndReveal() {
    const snap=await roomRef.once('value'); const s=snap.val()||{};
    if (s.scored || !s.currentQuestion) return roomRef.update({phase:'revealed'});
    const teams=s.teams||{}, answers=s.answers||{}, q=s.currentQuestion;
    const updates={ phase:'revealed', scored:true };
    Object.entries(teams).forEach(([id,t])=>{
      if (!answers[id]) return;
      const delta = answers[id].choice===q.answer ? (q.points||100) : -50;
      updates[`teams/${id}/score`] = (t.score||0) + delta;
    });
    await roomRef.update(updates);
  }

  async function renameTeam(id) {
    const team = state.teams?.[id];
    if (!team) return;
    const proposed = prompt('Enter the new team name:', team.name || '');
    if (proposed === null) return;
    const newName = normalizeName(proposed);
    if (!newName) return alert('Team name cannot be blank.');
    if (newName.length > 20) return alert('Team names can be no more than 20 characters.');
    if (inappropriateName(newName)) return alert('Choose a different team name.');
    const newKey = nameKey(newName), oldKey = nameKey(team.name || '');
    if (!newKey) return alert('Use at least one letter or number.');
    if (newKey !== oldKey) {
      const reservation = await roomRef.child('nameRegistry/' + newKey).transaction(v => v || id);
      if (!reservation.committed || (reservation.snapshot.val() !== id)) return alert('That team name is already being used.');
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
    if (!team) return;
    if (!confirm(`Remove ${team.name || 'this team'} from the game?`)) return;
    const updates = {};
    updates[`teams/${id}`] = null;
    updates[`answers/${id}`] = null;
    const key = nameKey(team.name || '');
    if (key) updates[`nameRegistry/${key}`] = null;
    await roomRef.update(updates);
  }

  async function adjustScore(id,delta) {
    const ref=roomRef.child(`teams/${id}/score`);
    await ref.transaction(v=>(v||0)+delta);
  }

  $('resetBtn').addEventListener('click', async()=>{
    if (!confirm('Reset all scores and restart the game?')) return;
    const teams=state.teams||{}, updates={ phase:'waiting', questionIndex:0, currentQuestion:null, answers:null, scored:false, message:'New game ready.' };
    Object.keys(teams).forEach(id=>updates[`teams/${id}/score`]=0);
    await roomRef.update(updates);
  });
})();
