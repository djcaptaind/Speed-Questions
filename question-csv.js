(() => {
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];

      if (c === '"' && quoted && n === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = !quoted;
      } else if (c === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && n === '\n') i++;
        row.push(cell);
        if (row.some(x => String(x).trim() !== '')) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += c;
      }
    }

    row.push(cell);
    if (row.some(x => String(x).trim() !== '')) rows.push(row);
    return rows;
  }

  const norm = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  function findColumn(headers, ...names) {
    for (const name of names) {
      const i = headers.indexOf(norm(name));
      if (i >= 0) return i;
    }
    return -1;
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  window.QuestionCSV = {
    parse(text) {
      const rows = parseCSV(String(text).replace(/^\uFEFF/, ''));
      if (rows.length < 2) throw new Error('The CSV contains no question rows.');

      const headers = rows[0].map(norm);
      const qi = findColumn(headers, 'Question');
      const ai = findColumn(headers, 'Answer A');
      const bi = findColumn(headers, 'Answer B');
      const ci = findColumn(headers, 'Answer C');
      const di = findColumn(headers, 'Answer D');
      const ri = findColumn(headers, 'Correct Answer', 'Correct');
      const pi = findColumn(headers, 'Points');
      const qesi = findColumn(headers, 'Question Spanish', 'Pregunta', 'Pregunta Español', 'Question ES');
      const aesi = findColumn(headers, 'Answer A Spanish', 'Respuesta A', 'Answer A ES');
      const besi = findColumn(headers, 'Answer B Spanish', 'Respuesta B', 'Answer B ES');
      const cesi = findColumn(headers, 'Answer C Spanish', 'Respuesta C', 'Answer C ES');
      const desi = findColumn(headers, 'Answer D Spanish', 'Respuesta D', 'Answer D ES');

      if ([qi, ai, bi, ci, di, ri].some(i => i < 0)) {
        throw new Error('Required columns: Question, Answer A, Answer B, Answer C, Answer D, Correct Answer.');
      }

      return rows.slice(1).map((r, index) => {
        const correctLetter = String(r[ri] || '').trim().toUpperCase();
        const answer = {A:0, B:1, C:2, D:3}[correctLetter];

        if (answer === undefined) {
          throw new Error(`Row ${index + 2}: Correct Answer must be A, B, C, or D.`);
        }

        const question = String(r[qi] || '').trim();
        const choices = [r[ai], r[bi], r[ci], r[di]].map(v => String(v || '').trim());
        const points = pi >= 0 && String(r[pi] || '').trim() !== '' ? Number(r[pi]) : 100;

        if (!question) throw new Error(`Row ${index + 2}: Question is blank.`);
        if (choices.some(v => !v)) throw new Error(`Row ${index + 2}: all four answer choices are required.`);

        const questionEs = qesi >= 0 ? String(r[qesi] || '').trim() : '';
        const choicesEs = [aesi, besi, cesi, desi].map(i => i >= 0 ? String(r[i] || '').trim() : '');
        const spanishComplete = questionEs && choicesEs.every(Boolean);

        return {
          question,
          choices,
          answer,
          points: Number.isFinite(points) ? points : 100,
          ...(spanishComplete ? { questionEs, choicesEs } : {})
        };
      });
    },

    export(questions) {
      const rows = [
        ['Question','Answer A','Answer B','Answer C','Answer D','Correct Answer','Points','Question Spanish','Answer A Spanish','Answer B Spanish','Answer C Spanish','Answer D Spanish'],
        ...questions.map(q => [
          q.question,
          q.choices[0],
          q.choices[1],
          q.choices[2],
          q.choices[3],
          String.fromCharCode(65 + Number(q.answer)),
          q.points || 100,
          q.questionEs || '',
          q.choicesEs?.[0] || '',
          q.choicesEs?.[1] || '',
          q.choicesEs?.[2] || '',
          q.choicesEs?.[3] || ''
        ])
      ];

      return '\uFEFF' + rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
    }
  };
})();