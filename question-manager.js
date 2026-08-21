(() => {
  const STORAGE_KEY = 'callawayAnswerGameQuestionBankV3';
  let originalQuestions = JSON.parse(JSON.stringify(window.GAME_QUESTIONS || []));
  let questions = [];
  let editingIndex = -1;

  const $ = id => document.getElementById(id);
  const esc = (s='') => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      questions = Array.isArray(saved) ? saved : originalQuestions;
    } catch {
      questions = originalQuestions;
    }
    if (!questions.length) questions = originalQuestions;
    syncGlobal();
    render();
  }

  function syncGlobal() {
    if (!Array.isArray(window.GAME_QUESTIONS)) window.GAME_QUESTIONS = [];
    window.GAME_QUESTIONS.splice(0, window.GAME_QUESTIONS.length, ...questions);
  }

  function save(message) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
    syncGlobal();
    render();
    setStatus(message || `Saved ${questions.length} questions on this instructor computer.`);
  }

  function setStatus(msg) { $('qmStatus').textContent = msg; }

  function render() {
    $('qmCount').textContent = `${questions.length} Question${questions.length===1?'':'s'}`;

    $('qmList').innerHTML = questions.map((q,i)=>`
      <div class="qm-row">
        <div class="qm-number">${i+1}</div>
        <div class="qm-copy">
          <strong>${esc(q.question)}</strong>
          <small>Correct: ${String.fromCharCode(65+Number(q.answer))} · ${q.points || 100} pts ${q.questionEs && q.choicesEs?.length===4 ? '· 🇲🇽 Spanish ready' : '· English only'}</small>
        </div>
        <div class="qm-actions">
          <button class="btn btn-ghost" data-edit="${i}">Edit</button>
          <button class="btn btn-ghost" data-up="${i}" ${i===0?'disabled':''}>↑</button>
          <button class="btn btn-ghost" data-down="${i}" ${i===questions.length-1?'disabled':''}>↓</button>
          <button class="btn btn-danger" data-delete="${i}">Delete</button>
        </div>
      </div>`).join('') || '<div class="qm-empty">No questions yet. Add or import questions.</div>';

    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(Number(b.dataset.edit)));
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeQuestion(Number(b.dataset.delete)));
    document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>move(Number(b.dataset.up),-1));
    document.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>move(Number(b.dataset.down),1));
  }

  function openManager() {
    $('questionManager').classList.remove('hidden');
    render();
  }

  function closeManager() {
    $('questionManager').classList.add('hidden');
    closeEditor();
  }

  function openEditor(index=-1) {
    editingIndex = index;
    const q = index >= 0
      ? questions[index]
      : {question:'', choices:['','','',''], questionEs:'', choicesEs:['','','',''], answer:0, points:100};

    $('qmEditorTitle').textContent = index >= 0 ? 'Edit Question' : 'Add Question';
    $('qmQuestion').value = q.question || '';
    ['A','B','C','D'].forEach((l,i)=>$('qmChoice'+l).value=q.choices?.[i]||'');
    $('qmQuestionEs').value = q.questionEs || '';
    ['A','B','C','D'].forEach((l,i)=>$('qmChoice'+l+'Es').value=q.choicesEs?.[i]||'');
    $('qmAnswer').value = String(q.answer ?? 0);
    $('qmPoints').value = String(q.points || 100);
    $('qmEditor').classList.remove('hidden');
    $('qmQuestion').focus();
  }

  function closeEditor() {
    $('qmEditor').classList.add('hidden');
    editingIndex = -1;
  }

  function saveEditor() {
    const question = $('qmQuestion').value.trim();
    const choices = ['A','B','C','D'].map(l=>$('qmChoice'+l).value.trim());
    const questionEs = $('qmQuestionEs').value.trim();
    const choicesEs = ['A','B','C','D'].map(l=>$('qmChoice'+l+'Es').value.trim());
    const answer = Number($('qmAnswer').value);
    const points = Number($('qmPoints').value) || 100;

    if (!question) return alert('Enter the question.');
    if (choices.some(x=>!x)) return alert('Enter all four answer choices.');
    const anySpanish = questionEs || choicesEs.some(Boolean);
    if (anySpanish && (!questionEs || choicesEs.some(x=>!x))) {
      return alert('For Spanish support, enter the Spanish question and all four Spanish answer choices.');
    }

    const q = {question, choices, answer, points, ...(anySpanish ? {questionEs, choicesEs} : {})};

    if (editingIndex >= 0) questions[editingIndex] = q;
    else questions.push(q);

    save(`Question ${editingIndex >= 0 ? 'updated' : 'added'}. ${questions.length} questions total.`);
    closeEditor();
  }

  function removeQuestion(i) {
    if (!confirm(`Delete Question ${i+1}?`)) return;
    questions.splice(i,1);
    save(`Question deleted. ${questions.length} questions remain.`);
  }

  function move(i,d) {
    const j = i + d;
    if (j < 0 || j >= questions.length) return;
    [questions[i],questions[j]] = [questions[j],questions[i]];
    save('Question order updated.');
  }

  function resetDefaults() {
    if (!confirm('Restore the original questions from questions.js? This replaces your saved question bank on this computer.')) return;
    questions = JSON.parse(JSON.stringify(originalQuestions));
    save('Original questions restored.');
  }

  function downloadFile(contents, filename, type) {
    const blob = new Blob([contents], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function exportCSV() {
    downloadFile(
      window.QuestionCSV.export(questions),
      'callaway-question-bank.csv',
      'text/csv;charset=utf-8'
    );
    setStatus('CSV exported. Open it directly in Excel.');
  }

  function exportJSON() {
    downloadFile(
      JSON.stringify(questions,null,2),
      'callaway-question-bank.json',
      'application/json'
    );
    setStatus('JSON question bank exported.');
  }

  function importCSV(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = window.QuestionCSV.parse(reader.result);
        if (!imported.length) throw new Error('No questions found.');
        questions = imported;
        save(`Imported ${questions.length} questions from CSV.`);
      } catch (e) {
        alert('CSV import failed: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('JSON must contain an array of questions.');
        const cleaned = data.map((q,i)=>{
          if (!q.question || !Array.isArray(q.choices) || q.choices.length !== 4) {
            throw new Error(`Question ${i+1} is incomplete.`);
          }
          const questionEs = String(q.questionEs || '').trim();
          const choicesEs = Array.isArray(q.choicesEs) ? q.choicesEs.map(String) : [];
          const spanishComplete = questionEs && choicesEs.length === 4 && choicesEs.every(x => String(x).trim());
          return {
            question: String(q.question),
            choices: q.choices.map(String),
            answer: Number(q.answer),
            points: Number(q.points) || 100,
            ...(spanishComplete ? {questionEs, choicesEs} : {})
          };
        });
        questions = cleaned;
        save(`Imported ${questions.length} questions from JSON.`);
      } catch(e) {
        alert('JSON import failed: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    $('manageQuestionsBtn').onclick = openManager;
    $('manageQuestionsBtnGame').onclick = openManager;
    $('qmClose').onclick = closeManager;
    $('qmAdd').onclick = ()=>openEditor(-1);
    $('qmSave').onclick = saveEditor;
    $('qmCancel').onclick = closeEditor;
    $('qmReset').onclick = resetDefaults;

    $('qmImportCsvBtn').onclick = ()=>$('qmImportCsvFile').click();
    $('qmImportCsvFile').onchange = e=>{
      if (e.target.files[0]) importCSV(e.target.files[0]);
      e.target.value = '';
    };
    $('qmExportCsv').onclick = exportCSV;

    $('qmImportJsonBtn').onclick = ()=>$('qmImportJsonFile').click();
    $('qmImportJsonFile').onchange = e=>{
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    };
    $('qmExportJson').onclick = exportJSON;

    load();
  });
})();