/*
  © 2026 영쌤클래스 · 교육용으로 제작 · 무단 복제·재배포 금지
  성취기준으로 논서술형 평가 제안받기 — 화면
  흐름: 성취기준 고르기 → 개요 3개 → 하나 골라 완성본 → 고쳐서 복사·인쇄·저장
  자료는 data/*.json 을 한 번만 읽어 쓴다(원문 문항 없음, 구조 분석 결과만).
*/
(function () {
  'use strict';
  const PC = window.ProposalCore, VER = '4.2.0';
  const PS = { step: 'pick', subject: '국어', grade: 4, query: '', std: null, note: '', outlines: null, outline: null, proposal: null, busy: '', error: '' };
  let DATA = null;
  const esc = s => escapeHtml(s);
  const bandOfGrade = g => (g <= 2 ? '1~2' : g <= 4 ? '3~4' : '5~6') + '학년군';

  async function loadData() {
    if (DATA) return DATA;
    const get = async f => { const r = await fetch('data/' + f + '.json?v=' + VER); if (!r.ok) throw Error('자료 파일(' + f + ')을 불러오지 못했습니다.'); return r.json(); };
    const [standards, cases, guide] = await Promise.all([get('standards'), get('cases'), get('guide')]);
    DATA = { standards, cases, guide };
    return DATA;
  }

  function frame(title, body, actions) {
    const steps = [['pick', '① 성취기준'], ['outline', '② 개요 고르기'], ['full', '③ 완성본']];
    showModal(`<h2>${esc(title)}</h2>
      <div class="pp-steps">${steps.map(s => `<span class="${s[0] === PS.step ? 'on' : ''}">${s[1]}</span>`).join('')}</div>
      ${PS.error ? `<div class="info-box warn">${esc(PS.error)}</div>` : ''}
      ${body}
      <div class="modal-actions" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${actions}</div>`);
  }
  function busyView(msg) {
    showModal(`<h2>논서술형 평가 제안</h2><div class="pp-busy"><span class="spinner"></span><p><strong>${esc(msg)}</strong></p><p class="helper">무료 키로는 30초~2분쯤 걸릴 수 있습니다. 창을 닫지 말고 기다려 주세요.</p></div>`);
  }

  /* ---------- ① 성취기준 고르기 ---------- */
  function filtered() {
    const band = bandOfGrade(PS.grade), q = PS.query.replace(/\s+/g, '');
    return DATA.standards.filter(s => s.s === PS.subject && s.g === band && (!q || (s.c + s.t + (s.a || '')).replace(/\s+/g, '').includes(q)));
  }
  function listHtml() {
    const list = filtered();
    if (!list.length) return `<p class="helper" style="padding:14px">${PS.query ? '검색 결과가 없습니다.' : esc(PS.subject) + '과는 ' + bandOfGrade(PS.grade) + '에 성취기준이 없습니다. 학년을 바꿔 보세요.'}</p>`;
    let area = null;
    return list.map(s => {
      const head = s.a !== area ? `<div class="pp-area">${esc(area = s.a)}</div>` : '';
      return head + `<button type="button" class="pp-std ${PS.std && PS.std.c === s.c ? 'on' : ''}" onclick="Proposal.choose('${escapeJs(s.c)}')"><b>${esc(s.c)}</b> ${esc(s.t)}</button>`;
    }).join('');
  }
  function selectedHtml() {
    const s = PS.std; if (!s) return '<p class="helper">위 목록에서 성취기준을 하나 골라 주세요.</p>';
    const n = PC.selectCases(s, DATA.cases, 3), direct = n.filter(x => x.tier <= 2).length;
    return `<div class="pp-picked"><div><b>${esc(s.c)}</b> ${esc(s.t)}</div>
      <table><tr><th>A (상)</th><td>${esc(s.A)}</td></tr><tr><th>B (중)</th><td>${esc(s.B)}</td></tr><tr><th>C (하)</th><td>${esc(s.C)}</td></tr></table>
      <p class="helper">참고 사례: ${direct ? '이 성취기준을 직접 다룬 공식 사례 ' + direct + '개 포함' : '같은 교과의 공식 사례 ' + n.length + '개(이 성취기준을 직접 다룬 사례는 없음)'}</p></div>`;
  }
  function renderPick() {
    PS.step = 'pick';
    frame('성취기준으로 평가 제안받기', `
      <div class="info-box">2022 개정 교육과정 성취기준을 고르면, 교육부·평가원·교육청 자료집의 문항 구조를 참고해 <strong>새 문항</strong>을 제안합니다. 지금은 참고 사례가 있는 국어·사회·수학·과학·영어만 됩니다. 제안은 초안이니 꼭 읽고 고쳐 쓰세요.</div>
      <div class="pp-row">
        <div class="form-row"><label>교과</label><select id="pp-subject" onchange="Proposal.setFilter()">${PC.SUBJECTS.map(s => `<option ${s === PS.subject ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="form-row"><label>실시 학년</label><select id="pp-grade" onchange="Proposal.setFilter()">${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}" ${g === PS.grade ? 'selected' : ''}>${g}학년</option>`).join('')}</select></div>
        <div class="form-row" style="flex:2"><label>찾기 (낱말이나 코드)</label><input type="text" id="pp-query" value="${esc(PS.query)}" placeholder="예: 분수, 4사02" oninput="Proposal.setFilter(true)"></div>
      </div>
      <div id="pp-list" class="pp-list">${listHtml()}</div>
      <div id="pp-picked">${selectedHtml()}</div>
      <div class="form-row"><label>선생님 의견 (선택)</label><textarea id="pp-note" rows="2" style="width:100%" placeholder="예: 우리 고장 소재로, 표 자료를 넣어서, 쓰기 부담은 적게" oninput="Proposal.setNote(this.value)">${esc(PS.note)}</textarea></div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">닫기</button>
       ${PS.outlines ? '<button class="btn btn-secondary" onclick="Proposal.show(\'outline\')">받아 둔 개요 보기</button>' : ''}
       <button class="btn btn-primary" id="pp-go" ${PS.std ? '' : 'disabled'} onclick="Proposal.askOutlines()">개요 3개 제안받기</button>`);
  }

  /* ---------- ② 개요 ---------- */
  async function askOutlines() {
    if (!PS.std) return;
    PS.error = ''; busyView('평가 개요 3개를 구상하고 있습니다…');
    const prompt = PC.buildOutlinePrompt({ standard: PS.std, guide: DATA.guide, selected: PC.selectCases(PS.std, DATA.cases, 3), grade: PS.grade, teacherNote: PS.note, count: 3 });
    const r = await callGeminiJSON(prompt, { maxTokens: 8192 });
    const list = r.success && r.data && Array.isArray(r.data.outlines) ? r.data.outlines.filter(o => o && Array.isArray(o.questions) && o.questions.length) : [];
    if (!list.length) { PS.error = r.success ? 'AI가 개요를 제대로 만들지 못했습니다. 다시 시도해 주세요.' : r.message; return renderPick(); }
    PS.outlines = list; PS.outline = null; PS.proposal = null; renderOutlines();
  }
  function renderOutlines() {
    PS.step = 'outline';
    frame('개요 고르기', `
      <p class="helper" style="margin-bottom:10px"><b>${esc(PS.std.c)}</b> ${esc(PS.std.t)}</p>
      <div class="pp-cards">${PS.outlines.map((o, i) => `<div class="pp-card">
        <div class="pp-tag">${esc(o.type || '서술형')} · ${esc(o.pattern || '')}${o.time_minutes ? ' · 약 ' + esc(o.time_minutes) + '분' : ''}</div>
        <h3>${esc(o.title)}</h3>
        <p>${esc(o.eval_focus || '')}</p>
        <p><b>자료</b> ${esc(o.material_idea || '')}</p>
        <ol>${o.questions.map(q => `<li><b>${esc(q.label)}</b> ${esc(q.asks)}${q.answer ? ` <span class="helper">(${esc(q.answer)})</span>` : ''}</li>`).join('')}</ol>
        ${o.difference ? `<p class="helper">${esc(o.difference)}</p>` : ''}
        <button class="btn btn-primary btn-small" onclick="Proposal.askFull(${i})">이 개요로 완성하기</button></div>`).join('')}</div>`,
      `<button class="btn btn-ghost" onclick="Proposal.show('pick')">← 성취기준 다시 고르기</button>
       ${PS.proposal ? '<button class="btn btn-secondary" onclick="Proposal.show(\'full\')">만들어 둔 완성본 보기</button>' : ''}
       <button class="btn btn-secondary" onclick="Proposal.askOutlines()">개요 다시 제안받기</button>`);
  }

  /* ---------- ③ 완성본 ---------- */
  async function askFull(i) {
    PS.outline = PS.outlines[i]; PS.error = ''; busyView('고른 개요로 문항·예시 답안·채점 기준을 쓰고 있습니다…');
    const prompt = PC.buildProposalPrompt({ standard: PS.std, guide: DATA.guide, selected: PC.selectCases(PS.std, DATA.cases, 3), grade: PS.grade, teacherNote: PS.note, outline: PS.outline });
    const r = await callGeminiJSON(prompt, { maxTokens: 24000 });
    const p = r.success && r.data && Array.isArray(r.data.proposals) ? r.data.proposals[0] : (r.success && r.data && r.data.questions ? r.data : null);
    if (!p || !Array.isArray(p.questions) || !p.questions.length) { PS.error = r.success ? 'AI가 완성본을 제대로 만들지 못했습니다. 다시 시도해 주세요.' : r.message; return renderOutlines(); }
    p.material = p.material || { intro: '', text: '', picture_note: '' };
    p.questions.forEach((q, k) => { q.label = q.label || '1-' + (k + 1); q.conditions = q.conditions || []; q.rubric = q.rubric || []; });
    PS.proposal = p; renderFull();
  }
  const ta = (path, val, rows, cls) => `<textarea data-p="${path}" rows="${rows || 2}" class="${cls || ''}" oninput="Proposal.edit(this)" onchange="Proposal.recheck()">${esc(val == null ? '' : val)}</textarea>`;
  function checkHtml() {
    const p = PS.proposal, v = PC.validateProposal(p, PS.std, DATA.guide), sc = p.self_check || {};
    const li = (a, c) => (a || []).map(x => `<li class="${c}">${esc(x)}</li>`).join('');
    return `<div class="pp-check"><h3>점검 결과</h3>
      ${v.issues.length ? `<p><b>고쳐야 할 점 ${v.issues.length}개</b></p><ul>${li(v.issues, 'bad')}</ul>` : '<p class="ok">✔ 형식 점검 통과 (상·중·하 3수준, 예시 답안, 성취기준 인용)</p>'}
      ${v.warn.length ? `<p><b>확인해 볼 점</b></p><ul>${li(v.warn, 'warn')}</ul>` : ''}
      ${(sc.concerns || []).length ? `<p><b>AI가 남긴 걱정</b></p><ul>${li(sc.concerns, 'warn')}</ul>` : ''}
      ${p.not_covered ? `<p><b>이 평가로 볼 수 없는 부분</b> ${esc(p.not_covered)}</p>` : ''}
      ${p.limits ? `<p><b>한계</b> ${esc(p.limits)}</p>` : ''}</div>`;
  }
  function renderFull() {
    PS.step = 'full';
    const p = PS.proposal, m = p.material, lp = p.level_profile || {};
    frame('완성본 — 읽고 고쳐 쓰세요', `
      <p class="helper" style="margin-bottom:10px"><b>${esc(PS.std.c)}</b> ${esc(PS.std.t)}</p>
      <div class="info-box">칸을 눌러 바로 고칠 수 있습니다. 고친 내용이 복사·인쇄·저장에 그대로 들어갑니다.${p.lesson_link ? '<br><b>실시 시점</b> ' + esc(p.lesson_link) : ''}${p.time_minutes ? ' · 약 ' + esc(p.time_minutes) + '분' : ''}</div>
      <div class="pp-edit">
        <label>평가 이름</label>${ta('title', p.title, 1)}
        <label>자료 위 지시문</label>${ta('material.intro', m.intro, 1)}
        <label>제시 자료 (학생에게 인쇄)</label>${ta('material.text', m.text, 9)}
        ${m.picture_note ? `<label>그림 메모 (인쇄되지 않음 — 그림을 넣는다면)</label>${ta('material.picture_note', m.picture_note, 2)}` : ''}
        ${p.questions.map((q, i) => `<div class="pp-q"><h3>${esc(q.label)} <span class="helper">${esc(q.eval_element || '')}</span></h3>
          <label>발문</label>${ta(`questions.${i}.prompt`, q.prompt, 3)}
          <label>조건 (한 줄에 하나, 없으면 비워 둠)</label>${ta(`questions.${i}.conditions`, q.conditions.join('\n'), Math.max(1, q.conditions.length))}
          <label>답란 형태</label>${ta(`questions.${i}.answer_format`, q.answer_format, 1)}
          <label>예시 답안 (상 수준)</label>${ta(`questions.${i}.model_answer`, q.model_answer, 3)}
          <label>인정 범위</label>${ta(`questions.${i}.also_accept`, q.also_accept, 2)}
          ${q.rubric.map((r, k) => `<div class="pp-rub"><label>채점 요소</label>${ta(`questions.${i}.rubric.${k}.name`, r.name, 1)}
            <table><tr><th></th><th>판정 기준</th><th>이 수준의 답안 예</th><th>피드백</th></tr>
            ${(r.levels || []).map((l, j) => `<tr><th>${esc(l.level)}<br>${4 - (['상', '중', '하'].indexOf(l.level) + 1)}점</th><td>${ta(`questions.${i}.rubric.${k}.levels.${j}.criterion`, l.criterion, 4)}</td><td>${ta(`questions.${i}.rubric.${k}.levels.${j}.example`, l.example, 4)}</td><td>${ta(`questions.${i}.rubric.${k}.levels.${j}.feedback`, l.feedback, 4)}</td></tr>`).join('')}</table></div>`).join('')}
          ${(q.grading_notes || []).length ? `<p class="helper"><b>채점 유의</b> ${q.grading_notes.map(esc).join(' / ')}</p>` : ''}</div>`).join('')}
        ${lp.A ? `<div class="pp-q"><h3>성취수준별 수행 특성</h3><table class="pp-lp"><tr><th>A</th><td>${esc(lp.A)}</td></tr><tr><th>B</th><td>${esc(lp.B)}</td></tr><tr><th>C</th><td>${esc(lp.C)}</td></tr></table></div>` : ''}
        ${(p.expected_errors || []).length ? `<div class="pp-q"><h3>예상 오답과 지도</h3><ul>${p.expected_errors.map(e => `<li>${esc(e.error)} → ${esc(e.response)}</li>`).join('')}</ul></div>` : ''}
      </div>
      <div id="pp-check">${checkHtml()}</div>`,
      `<button class="btn btn-ghost" onclick="Proposal.show('outline')">← 다른 개요 보기</button>
       <button class="btn btn-secondary" onclick="Proposal.copy('sheet')">📋 문제지 복사</button>
       <button class="btn btn-secondary" onclick="Proposal.copy('rubric')">📋 채점 기준 복사</button>
       <button class="btn btn-secondary" onclick="Proposal.print()">🖨 인쇄용 문제지</button>
       <button class="btn btn-primary" id="pp-save" onclick="Proposal.save()">이 평가로 저장</button>`);
  }
  function edit(el) {
    const keys = el.dataset.p.split('.'); let o = PS.proposal;
    keys.slice(0, -1).forEach(k => { o = o[k]; });
    const last = keys[keys.length - 1];
    o[last] = last === 'conditions' ? el.value.split('\n').map(s => s.trim()).filter(Boolean) : el.value;
  }
  function recheck() { const box = $('pp-check'); if (box && PS.proposal) box.innerHTML = checkHtml(); }

  async function copy(kind) {
    const text = kind === 'sheet' ? PC.sheetText(PS.proposal, PS.std, PS.grade) : PC.rubricText(PS.proposal, PS.std);
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    showToast(kind === 'sheet' ? '문제지 글을 복사했습니다. 학교 양식에 붙여 넣으세요.' : '채점 기준을 복사했습니다.');
  }

  function materialHtml(text) {
    const lines = String(text || '').split('\n'), out = []; let rows = [];
    const flush = () => { if (rows.length) { out.push('<table>' + rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</table>'); rows = []; } };
    lines.forEach(l => {
      if ((l.match(/\|/g) || []).length >= 2 || (rows.length && l.includes('|'))) { const cells = l.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim()); if (!cells.every(c => /^:?-+:?$/.test(c))) rows.push(cells); }
      else { flush(); out.push(l.trim() ? `<p>${esc(l)}</p>` : '<div style="height:6pt"></div>'); }
    });
    flush(); return out.join('');
  }
  function print() {
    const p = PS.proposal, m = p.material;
    document.querySelector('.print-area')?.remove();
    const area = document.createElement('div'); area.className = 'print-area pp-print';
    area.innerHTML = `<h1>${esc(p.title)}</h1><div class="pp-name">${esc(PS.std.s)} ${PS.grade}학년 &nbsp; (&nbsp;&nbsp;&nbsp;)반 (&nbsp;&nbsp;&nbsp;)번 &nbsp; 이름: ______________</div>
      <p class="pp-intro">1. ${esc(m.intro || '다음 자료를 읽고 물음에 답하시오.')}</p>
      ${(m.text || '').trim() ? `<div class="pp-mat">${materialHtml(m.text)}</div>` : ''}
      ${p.questions.map(q => `<div class="pp-pq"><p><b>(${esc(q.label)})</b> ${esc(q.prompt)}</p>
        ${q.conditions.length ? `<div class="pp-cond"><b>&lt;조건&gt;</b>${q.conditions.map(c => `<div>· ${esc(c)}</div>`).join('')}</div>` : ''}
        ${Array.from({ length: Math.min(12, Math.max(1, Number(q.answer_lines) || 2)) }, () => '<div class="pp-line"></div>').join('')}</div>`).join('')}`;
    document.body.appendChild(area);
    window.print();
  }

  async function save() {
    if (!state.sheetId) { showToast('먼저 Google 로그인과 시트 연결을 해 주세요.'); return; }
    const v = PC.validateProposal(PS.proposal, PS.std, DATA.guide);
    const conv = PC.toEvaluation(PS.proposal, PS.std, PS.grade);
    const btn = $('pp-save'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>저장 중...';
    try {
      const id = await createEvaluation(conv.data);
      const failed = [];
      for (const r of conv.rubrics) {
        try { await saveRubricForQuestion(id, r.number, r.rubric); } catch (e) { failed.push(conv.data.questions[r.number - 1].label); }
      }
      closeModal();
      showToast(failed.length ? '평가는 저장했지만 ' + failed.join(', ') + ' 채점 기준은 비어 있어 저장하지 못했습니다. 채점 기준 탭에서 채워 주세요.' : '평가·문항·채점 기준을 저장했습니다' + (v.issues.length ? ' (점검에서 나온 문제는 채점 기준 탭에서 확인하세요)' : ''));
      PS.proposal = null; PS.outlines = null; PS.outline = null; PS.step = 'pick';
      await loadEvaluations();
    } catch (e) { btn.disabled = false; btn.textContent = '이 평가로 저장'; showToast('저장 실패: ' + e.message); }
  }

  async function open() {
    if (!getGeminiKey()) { showToast('먼저 설정 탭에서 Gemini API 키를 저장해 주세요.'); switchTab('settings'); return; }
    try { busyView('성취기준 자료를 불러오는 중…'); await loadData(); } catch (e) { closeModal(); showToast(e.message); return; }
    PS.error = ''; show(PS.proposal ? 'full' : PS.outlines ? 'outline' : 'pick');
  }
  function show(step) { PS.error = ''; if (step === 'full' && PS.proposal) renderFull(); else if (step === 'outline' && PS.outlines) renderOutlines(); else renderPick(); }

  window.Proposal = {
    open, show, askOutlines, askFull, edit, recheck, copy, print, save,
    setFilter(keepFocus) {
      PS.subject = $('pp-subject').value; PS.grade = Number($('pp-grade').value); PS.query = $('pp-query').value;
      if (PS.std && (PS.std.s !== PS.subject || PS.std.g !== bandOfGrade(PS.grade))) { PS.std = null; $('pp-picked').innerHTML = selectedHtml(); $('pp-go').disabled = true; }
      $('pp-list').innerHTML = listHtml();
    },
    setNote(v) { PS.note = v.trim(); },
    choose(code) {
      const s = DATA.standards.find(x => x.c === code); if (!s) return;
      if (!PS.std || PS.std.c !== code) { PS.outlines = null; PS.outline = null; PS.proposal = null; }
      PS.std = s; $('pp-list').innerHTML = listHtml(); $('pp-picked').innerHTML = selectedHtml(); $('pp-go').disabled = false;
    },
    _state: PS
  };
})();
