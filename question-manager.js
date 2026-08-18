(() => {
  const STORAGE_KEY = 'callawayAnswerGameQuestionBankV1';
  const defaults = () => JSON.parse(JSON.stringify(window.GAME_QUESTIONS || []));
  let questions = [];
  let editingIndex = -1;

  const $ = id => document.getElementById(id);
  const esc = (s='') => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      questions = Array.isArray(saved) && saved.length ? saved : defaults();
    } catch { questions = defaults(); }
    syncGlobal();
    render();
  }

  function syncGlobal() {
    window.GAME_QUESTIONS.splice(0, window.GAME_QUESTIONS.length, ...questions);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
    syncGlobal();
    render();
    setStatus(`Saved ${questions.length} question${questions.length===1?'':'s'} on this instructor computer.`);
  }

  function setStatus(msg) { $('qmStatus').textContent = msg; }

  function render() {
    $('qmCount').textContent = `${questions.length} Question${questions.length===1?'':'s'}`;
    $('qmList').innerHTML = questions.map((q,i)=>`
      <div class="qm-row">
        <div class="qm-number">${i+1}</div>
        <div class="qm-copy">
          <strong>${esc(q.question)}</strong>
          <small>Correct: ${String.fromCharCode(65+Number(q.answer))} · ${q.points || 100} pts</small>
        </div>
        <div class="qm-actions">
          <button class="btn btn-ghost" data-edit="${i}">Edit</button>
          <button class="btn btn-ghost" data-up="${i}" ${i===0?'disabled':''}>↑</button>
          <button class="btn btn-ghost" data-down="${i}" ${i===questions.length-1?'disabled':''}>↓</button>
          <button class="btn btn-danger" data-delete="${i}">Delete</button>
        </div>
      </div>`).join('') || '<div class="qm-empty">No questions yet. Click Add Question.</div>';

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
    editingIndex=index;
    const q=index>=0 ? questions[index] : {question:'',choices:['','','',''],answer:0,points:100};
    $('qmEditorTitle').textContent=index>=0?'Edit Question':'Add Question';
    $('qmQuestion').value=q.question||'';
    ['A','B','C','D'].forEach((l,i)=>$('qmChoice'+l).value=q.choices?.[i]||'');
    $('qmAnswer').value=String(q.answer ?? 0);
    $('qmPoints').value=String(q.points || 100);
    $('qmEditor').classList.remove('hidden');
    $('qmQuestion').focus();
  }
  function closeEditor(){ $('qmEditor').classList.add('hidden'); editingIndex=-1; }

  function saveEditor() {
    const question=$('qmQuestion').value.trim();
    const choices=['A','B','C','D'].map(l=>$('qmChoice'+l).value.trim());
    const answer=Number($('qmAnswer').value);
    const points=Math.max(0,Number($('qmPoints').value)||100);
    if(!question) return alert('Enter the question.');
    if(choices.some(x=>!x)) return alert('Enter all four answer choices.');
    const q={question,choices,answer,points};
    if(editingIndex>=0) questions[editingIndex]=q; else questions.push(q);
    save(); closeEditor();
  }

  function removeQuestion(i) {
    if(!confirm(`Delete Question ${i+1}?`)) return;
    questions.splice(i,1); save();
  }
  function move(i,d) {
    const j=i+d; if(j<0||j>=questions.length)return;
    [questions[i],questions[j]]=[questions[j],questions[i]]; save();
  }
  function resetDefaults() {
    if(!confirm('Restore the original questions from questions.js? Your saved custom question bank on this computer will be replaced.')) return;
    localStorage.removeItem(STORAGE_KEY); questions=defaults(); syncGlobal(); render(); setStatus('Original questions restored.');
  }
  function exportBank() {
    const blob=new Blob([JSON.stringify(questions,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='callaway-question-bank.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function importBank(file) {
    const r=new FileReader();
    r.onload=()=>{
      try {
        const data=JSON.parse(r.result);
        if(!Array.isArray(data)||!data.every(q=>q.question&&Array.isArray(q.choices)&&q.choices.length===4&&Number.isInteger(Number(q.answer)))) throw new Error();
        questions=data.map(q=>({question:String(q.question),choices:q.choices.map(String),answer:Number(q.answer),points:Number(q.points)||100}));
        save(); setStatus(`Imported ${questions.length} questions.`);
      } catch { alert('That file is not a valid Callaway question bank.'); }
    };
    r.readAsText(file);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    $('manageQuestionsBtn').onclick=openManager;
    $('qmClose').onclick=closeManager;
    $('qmAdd').onclick=()=>openEditor(-1);
    $('qmSave').onclick=saveEditor;
    $('qmCancel').onclick=closeEditor;
    $('qmReset').onclick=resetDefaults;
    $('qmExport').onclick=exportBank;
    $('qmImportBtn').onclick=()=>$('qmImportFile').click();
    $('qmImportFile').onchange=e=>{ if(e.target.files[0]) importBank(e.target.files[0]); e.target.value=''; };
    load();
  });
})();