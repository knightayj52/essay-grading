/*
  © 2026 영쌤클래스 · 교육용으로 제작 · 무단 복제·재배포 금지
  논서술형 평가 제안 — 핵심 로직 (화면·네트워크와 무관한 순수 함수)
  - selectCases: 성취기준에 맞는 참고 사례 고르기
  - buildProposalPrompt: Gemini에 보낼 지시문 만들기
  - validateProposal: 받은 제안을 기계적으로 점검하기
  브라우저(window.ProposalCore)와 Node(module.exports) 양쪽에서 쓴다.
*/
(function (root) {
  'use strict';

  const LEVELS3 = ['상', '중', '하'];

  function bandOf(std) { return String(std.g || '').trim(); }           // "3~4학년군"
  function caseBand(c) { return c.band_2022 || c.band; }

  /* ---------- 참고 사례 고르기 ---------- */
  function selectCases(std, cases, max) {
    max = max || 3;
    const band = bandOf(std), subj = std.s;
    const scored = [];
    cases.forEach(c => {
      let tier = 0, why = '';
      const direct = (c.codes2022 || []).includes(std.c);
      if (direct && (c.link === '직접' || c.link === '대응')) { tier = 1; why = '이 성취기준을 다룬 사례'; }
      else if (direct) { tier = 2; why = '이 성취기준과 연결되지만 ' + c.link + ' 사례'; }
      else if (c.subject === subj && caseBand(c) === band) { tier = 3; why = '같은 교과·같은 학년군 사례'; }
      else if (c.subject === subj) { tier = 4; why = '같은 교과·다른 학년군 사례(난도는 학년군 특성에 맞춰 조정)'; }
      if (!tier) return;
      // 같은 단계 안에서는: 2022 기준 > 신뢰도 높음 > 구조만 참고 표시가 없는 것
      const q = (c.curriculum === '2022' ? 0 : 1) + (c.confidence === '높음' ? 0 : 2) + (c.link === '부분 대응' || c.link === '학년군 이동' ? 1 : 0);
      scored.push({ c, tier, q, why });
    });
    scored.sort((a, b) => a.tier - b.tier || a.q - b.q);
    // 같은 자료·같은 구성만 겹치지 않게: 한 자료(source)에서 최대 2개
    const out = [], perSource = {};
    for (const s of scored) {
      perSource[s.c.source] = (perSource[s.c.source] || 0) + 1;
      if (perSource[s.c.source] > 2) continue;
      out.push(s); if (out.length >= max) break;
    }
    return out;
  }

  /* ---------- 사례를 지시문용으로 줄이기 (구조만) ---------- */
  function compactCase(sel) {
    const c = sel.c, L = [];
    L.push(`■ 사례 ${c.id} (${c.subject} ${c.grade}, ${c.curriculum} 개정 기준) — ${sel.why}`);
    L.push(`  활용: ${c.use_as}`);
    L.push(`  주제: ${c.topic}`);
    if (c.context) L.push(`  맥락 설정: ${c.context}`);
    c.items.slice(0, 4).forEach(i => {
      L.push(`  [문항 ${i.no} · ${i.type} · 틀: ${i.pattern}] 평가 요소: ${i.eval_element}`);
      L.push(`    자료: ${(i.materials || []).join(' / ')}`);
      L.push(`    흐름: ${(i.flow || []).join(' → ')}`);
      if (i.conditions && i.conditions.summary) L.push(`    조건(${i.conditions.count}개): ${i.conditions.summary}`);
      L.push(`    답란: ${(i.answer_format || []).join(', ')} · 분량: ${i.answer_length}${i.scaffold ? ' · 발판: ' + i.scaffold : ''}`);
      const r = i.rubric || {};
      L.push(`    채점: 요소 ${(r.elements || []).join(' / ')} · 구분 방식 ${(r.split || []).join(', ')}`);
      if (r.top_requires) L.push(`      최고 수준: ${r.top_requires}`);
      if (r.low_looks_like) L.push(`      낮은 수준: ${r.low_looks_like}`);
      (i.cautions || []).slice(0, 3).forEach(x => L.push(`      유의: ${x}`));
    });
    (c.transferable || []).slice(0, 3).forEach(t => L.push(`  옮겨 쓸 아이디어: ${t}`));
    return L.join('\n');
  }

  function rulesText(list) { return (list || []).map(r => '- ' + r.rule + (r.why ? ' (' + r.why + ')' : '')).join('\n'); }

  /* ---------- 지시문 만들기 ---------- */
  function buildProposalPrompt(opt) {
    const std = opt.standard, g = opt.guide, selected = opt.selected || [];
    const band = bandOf(std), gb = g.grade_bands[band] || {}, sj = g.subjects[std.s];
    const hasSubjectEvidence = !!(sj && sj.evidence && sj.evidence !== '없음');
    const n = opt.outline ? 1 : (opt.count || 2);
    const P = [];

    P.push('당신은 한국 초등학교 교사를 돕는 평가 전문가입니다. 교사가 고른 2022 개정 교육과정 성취기준 하나에 대해, 수업에서 바로 쓸 수 있는 **서·논술형 평가안 ' + n + '개**를 제안하세요. 교사가 고르고 고쳐 쓸 초안입니다.');

    P.push('\n## 1. 성취기준\n' +
      `- 교과·학년군: ${std.s} ${band}${std.a ? ' · 영역: ' + std.a : ''}\n` +
      `- 성취기준 ${std.c}: ${std.t}\n` +
      `- 성취수준 A: ${std.A}\n- 성취수준 B: ${std.B}\n- 성취수준 C: ${std.C}` +
      (opt.grade ? `\n- 실시 학년: ${opt.grade}학년` : '') +
      (opt.teacherNote ? `\n- 교사가 덧붙인 말: ${opt.teacherNote}` : ''));

    P.push('\n## 2. 이 학년군의 문항 수준 (공식 자료의 사례에서 관찰한 것)\n' +
      `- 자료: ${gb.materials || ''}\n- 묻는 방식: ${gb.asks || ''}\n- 이유를 묻는 방식: ${gb.reason_request || ''}\n` +
      `- 조건: ${gb.conditions || ''}\n- 답안 분량: ${gb.answer_length || ''}\n- 답란 형태: ${(gb.answer_formats || []).join(', ')}\n` +
      `- 채점: ${gb.rubric || ''}` + (gb.notes ? `\n- 참고: ${gb.notes}` : '') + (gb.admin ? `\n- 실시: ${gb.admin}` : ''));

    if (hasSubjectEvidence) {
      P.push(`\n## 3. ${std.s}과 문항의 특성\n- 무엇을 평가하나: ${sj.what || ''}\n- 자료: ${sj.materials || ''}\n- 전형적인 흐름: ${sj.typical || ''}\n- 채점: ${sj.rubric || ''}\n- 참고: ${sj.notes || ''}`);
    } else {
      P.push(`\n## 3. ${std.s}과 문항의 특성\n이 교과는 참고할 공식 사례가 없습니다. 아래 공통 원칙과 학년군 수준만으로 설계하고, 평가안의 "limits"에 그 사실을 적으세요. 태도·실천 의지처럼 답안지로 확인할 수 없는 것은 묻지 말고, 글로 드러나는 이해·판단·이유·계획을 묻습니다.`);
    }

    P.push('\n## 4. 문항 설계 원칙\n### 해야 할 것\n' + rulesText(g.prompt_rules.do) +
      '\n### 피해야 할 것\n' + rulesText(g.prompt_rules.avoid) +
      '\n### 자료·조건·답란\n' + rulesText([].concat(g.components['자료'].slice(0, 2), g.components['조건'].slice(0, 3), g.components['답란'], g.components['예시답안'])) +
      '\n### 유형\n- 서술형: ' + g.item_types[0].definition + ' (' + g.item_types[0].length + ')\n- 논술형: ' + g.item_types[1].definition + ' (' + g.item_types[1].length + ')\n' + rulesText(g.item_type_notes));

    const pats = g.subitem_patterns.filter(p => !['정보 옮겨 쓰기', '예시문 바꿔 쓰기'].includes(p.id) || std.s === '영어')
      .map(p => `- ${p.id}: ${p.desc}${p.subjects[std.s] ? ' [' + std.s + ' 사례 ' + p.subjects[std.s] + '문항]' : ''}`).join('\n');
    P.push('\n## 5. 소문항 구성 틀 (이 중에서 성취기준의 동사와 내용에 맞는 것을 고르세요)\n' + pats);

    const levelRules = g.rubric_rules.levels.filter(r => !/최하 수준은|수준 수는 실제로/.test(r.rule));   // 3단계 고정과 충돌하는 두 원칙 제외
    P.push('\n## 6. 채점기준 원칙\n' + rulesText([].concat(g.rubric_rules.structure.slice(1, 3), levelRules)) +
      '\n### 수준을 가르는 방법\n' + g.rubric_rules.split_methods.filter(s => s.id !== '도움 여부').map(s => `- ${s.id}: ${s.how} (예: ${s.example_shape})`).join('\n') +
      '\n### 채점 판단 규칙 (채점기준과 유의점에 반영하세요)\n' + rulesText(g.grading_rules.rules.filter(r => !/영어|수학/.test(r.rule) || r.rule.startsWith(std.s))) +
      '\n### 성취수준 연결\n' + rulesText(g.achievement_link.rules.slice(2)) +
      `\n- A 수준의 모습: ${g.achievement_link.level_profile.A}\n- B 수준의 모습: ${g.achievement_link.level_profile.B}\n- C 수준의 모습: ${g.achievement_link.level_profile.C}`);

    if (selected.length) {
      P.push('\n## 7. 참고 사례 (구조만 참고합니다. 사례의 소재·문항을 그대로 쓰지 말고 새로 만드세요)\n' + selected.map(compactCase).join('\n\n'));
    } else {
      P.push('\n## 7. 참고 사례\n이 교과에는 참고 사례가 없습니다.');
    }

    P.push(`\n## 8. 이 앱의 형식 제약 (반드시 지키세요)
- 채점 척도는 **3단계(상·중·하)** 입니다. 채점 요소마다 상(3점)·중(2점)·하(1점) 세 수준의 판정 기준을 씁니다. 상=성취수준 A, 중=B, 하=C에 대응하게 쓰세요.
- 이 앱에는 0점이 없습니다. 공식 자료에서 0점으로 처리하는 답(판단이 틀린 답, 관계를 반대로 쓴 답, 자료와 무관한 답, 자료를 옮겨 적기만 한 답)은 모두 **"하"** 에 넣습니다. 그래서 "하"만은 여러 경우를 함께 받아도 됩니다. 무응답·판독 불가는 교사가 따로 처리하므로 "하"에 넣지 않습니다.
- 조건이 채점 요소보다 많으면, 남는 조건은 한 채점 요소의 인정 요건으로 묶어도 됩니다(어느 요소에 묶었는지 grading_notes에 적으세요).
- 답란 틀(칸 이름, 첫머리)을 인쇄해 주는 문항에서는 글의 형식을 채점 요소로 두지 않습니다.
- answer_lines는 그 소문항 답란의 **줄 수 합계**입니다.
- 평가안 하나는 **큰 문항 1개 + 소문항 2~4개**(1-1, 1-2 …)를 기본으로 합니다. 소문항은 각각 따로 채점되므로 소문항마다 채점 요소 1~2개를 둡니다.
- 학생은 종이 시험지에 손으로 답을 씁니다. 평가안 하나가 A4 한 쪽(길면 두 쪽)에 들어가야 합니다.
- **자료는 교사가 그대로 인쇄할 수 있는 글·표·대화로 직접 써 주세요.** 그림·사진·그래프가 꼭 필요하면 무엇을 그려야 하는지 설명하고("그림 설명"), 그림 없이도 풀 수 있는 글·표 자료를 함께 주세요. 실제 통계·기사·특정 지역 이름처럼 확인이 필요한 사실은 지어내지 말고 가상의 이름("○○시", "가람 마을")을 쓰거나 교사가 채울 자리로 표시하세요.
- 문제지에 인쇄된 문구를 그대로 옮겨 적으면 높은 점수를 받는 구조가 되지 않게 하세요.
` + (opt.outline
      ? '- 평가안은 **1개만** 만듭니다(proposals 배열에 1개). 아래 "교사가 고른 개요"의 틀·자료·소문항 흐름을 그대로 따르되, 원칙에 어긋나는 부분은 고치고 무엇을 고쳤는지 self_check.concerns에 적으세요.'
      : `- ${n}개의 평가안은 **소문항 구성 틀이 서로 달라야** 합니다. 하나는 서술형 중심, 다른 하나는 마지막 소문항이 짧은 논술형(학년군 수준에 맞는 분량)이 되게 하세요.`));
    if (opt.outline) P.push('\n## 교사가 고른 개요 (이 개요를 완성본으로 만드세요)\n' + outlineText(opt.outline));

    P.push(`\n## 9. 출력 (JSON만 출력하세요. 설명 문장이나 코드 울타리 없이)
{
  "proposals": [
    {
      "title": "평가 이름 (교사가 알아볼 수 있게)",
      "pattern": "5번 목록에서 고른 틀 이름",
      "type": "서술형 | 서술형+논술형",
      "eval_focus": "이 평가가 성취기준의 어느 부분을 보는지 한 문장",
      "standard_quote": "성취기준 문장에서 이 평가가 겨냥한 부분을 그대로 인용",
      "not_covered": "성취기준 가운데 이 평가로는 볼 수 없는 부분 (없으면 빈 문자열)",
      "lesson_link": "어떤 수업 활동 뒤에 실시하면 좋은지 한 문장",
      "time_minutes": 20,
      "pages": 1,
      "material": {
        "intro": "자료 위에 인쇄할 머리 지시문 (예: 다음 자료를 읽고 물음에 답하시오.)",
        "text": "학생에게 인쇄해 줄 자료 본문 전체 (글·표·대화. 표는 줄바꿈과 | 로 표현)",
        "picture_note": "그림이 있으면 좋은 경우 무엇을 그릴지 설명 (필요 없으면 빈 문자열)"
      },
      "questions": [
        {
          "label": "1-1",
          "eval_element": "평가 요소 ('~하기' 꼴)",
          "prompt": "학생에게 인쇄할 발문 전체",
          "conditions": ["조건이 있으면 '~할 것.' 꼴로 하나씩 (없으면 빈 배열)"],
          "answer_format": "답란 형태 (예: 점선 2줄, 표 채우기, '왜냐하면' 첫머리 인쇄 + 2줄)",
          "answer_lines": 2,
          "model_answer": "예시 답안 (상 수준, 학생이 실제로 쓸 만한 문장으로)",
          "also_accept": "인정할 수 있는 다른 답의 범위",
          "key_elements": ["답안에 담겨야 할 요소"],
          "rubric": [
            {
              "name": "채점 요소 이름",
              "split": "수준을 가른 방법 (6번 목록의 이름)",
              "levels": [
                {"level": "상", "score": 3, "criterion": "판정 기준", "example": "이 수준의 답안 예", "feedback": "이 수준 학생에게 줄 피드백"},
                {"level": "중", "score": 2, "criterion": "", "example": "", "feedback": ""},
                {"level": "하", "score": 1, "criterion": "", "example": "", "feedback": ""}
              ]
            }
          ],
          "grading_notes": ["채점 시 유의점 (감점·불인정 규칙)"]
        }
      ],
      "level_profile": {"A": "A 수준 학생이 이 평가에서 보일 수행", "B": "", "C": ""},
      "expected_errors": [{"error": "예상되는 오답 유형", "response": "그 학생에게 할 질문이나 안내"}],
      "self_check": {"passed": ["스스로 점검해 통과한 항목"], "concerns": ["남은 걱정이나 교사가 확인할 점"]},
      "limits": "이 평가안의 한계 (참고 사례가 없는 교과라면 그 사실 포함)"
    }
  ]
}

출력 전에 다음을 스스로 점검하고 결과를 self_check에 적으세요:
${g.review_checklist.item.map(x => '- ' + x).join('\n')}
${g.review_checklist.rubric.map(x => '- ' + x).join('\n')}`);

    return P.join('\n');
  }

  function outlineText(o) {
    const L = ['- 평가 이름: ' + (o.title || ''), '- 구성 틀: ' + (o.pattern || '') + ' · 유형: ' + (o.type || ''), '- 겨냥하는 부분: ' + (o.eval_focus || ''), '- 자료 구상: ' + (o.material_idea || '')];
    (o.questions || []).forEach(q => L.push(`- 소문항 ${q.label}: ${q.asks}${q.answer ? ' (답란: ' + q.answer + ')' : ''}`));
    return L.join('\n');
  }

  /* ---------- 1단계: 개요 지시문 (짧게 여러 개) ---------- */
  function buildOutlinePrompt(opt) {
    const std = opt.standard, g = opt.guide, selected = opt.selected || [];
    const band = bandOf(std), gb = g.grade_bands[band] || {}, sj = g.subjects[std.s] || {};
    const n = opt.count || 3, P = [];
    P.push('당신은 한국 초등학교 교사를 돕는 평가 전문가입니다. 교사가 고른 2022 개정 교육과정 성취기준 하나에 대해, 서·논술형 평가의 **개요 ' + n + '개**를 제안하세요. 교사가 이 가운데 하나를 고르면 그때 완성본을 만듭니다. 지금은 문항 전문·채점기준을 쓰지 말고 개요만 짧게 씁니다.');
    P.push('\n## 1. 성취기준\n' + `- 교과·학년군: ${std.s} ${band}${std.a ? ' · 영역: ' + std.a : ''}\n- 성취기준 ${std.c}: ${std.t}\n- 성취수준 A: ${std.A}\n- 성취수준 B: ${std.B}\n- 성취수준 C: ${std.C}` +
      (opt.grade ? `\n- 실시 학년: ${opt.grade}학년` : '') + (opt.teacherNote ? `\n- 교사가 덧붙인 말(가능한 한 반영하세요): ${opt.teacherNote}` : ''));
    P.push('\n## 2. 이 학년군·교과의 문항 수준\n' + `- 자료: ${gb.materials || ''}\n- 묻는 방식: ${gb.asks || ''}\n- 답안 분량: ${gb.answer_length || ''}\n- 답란 형태: ${(gb.answer_formats || []).join(', ')}` +
      (sj.what ? `\n- ${std.s}과에서 평가하는 것: ${sj.what}\n- ${std.s}과의 전형적인 흐름: ${sj.typical || ''}` : ''));
    P.push('\n## 3. 소문항 구성 틀\n' + g.subitem_patterns.filter(p => !['정보 옮겨 쓰기', '예시문 바꿔 쓰기'].includes(p.id) || std.s === '영어').map(p => `- ${p.id}: ${p.desc}`).join('\n'));
    if (selected.length) P.push('\n## 4. 참고 사례 (구조만 참고합니다. 소재·문항을 그대로 쓰지 말고 새로 구상하세요)\n' + selected.map(compactCase).join('\n\n'));
    P.push(`\n## 5. 지킬 것
- 개요 ${n}개는 **구성 틀과 자료(소재)가 서로 달라야** 합니다. 교사가 실제로 고를 만한 차이가 나게 하세요. 적어도 하나는 서술형만으로, 적어도 하나는 마지막 소문항이 짧은 논술형이 되게 합니다.
- 개요 하나는 큰 문항 1개 + 소문항 2~4개(1-1, 1-2 …)이고 A4 한 쪽에 들어갑니다. 학생은 종이에 손으로 답을 씁니다.
- 자료는 교사가 그대로 인쇄할 수 있는 글·표·대화여야 합니다(그림·사진·실제 통계에 기대지 않습니다).
- 태도·실천 의지처럼 답안지로 확인할 수 없는 것은 묻지 않습니다. 성취기준의 동사(설명한다, 비교한다 …)가 소문항의 요구에 드러나야 합니다.
- 채점은 상·중·하 3단계로 할 것이므로, 답안의 수준 차이가 드러날 수 있는 요구를 구상하세요.

## 6. 출력 (JSON만 출력하세요)
{
  "outlines": [
    {
      "title": "평가 이름",
      "pattern": "3번 목록에서 고른 틀 이름",
      "type": "서술형 | 서술형+논술형",
      "eval_focus": "성취기준의 어느 부분을 보는지 한 문장",
      "material_idea": "어떤 자료를 줄지 두 문장 이내 (소재와 형태)",
      "questions": [{"label": "1-1", "asks": "이 소문항이 요구하는 것 한 문장", "answer": "답란 형태와 분량 (예: 점선 2줄)"}],
      "difference": "다른 개요와 무엇이 다른지, 어떤 학급에 맞는지 한 문장",
      "time_minutes": 20
    }
  ]
}`);
    return P.join('\n');
  }

  /* ---------- 완성본 → 앱의 평가·문항·루브릭 구조 ---------- */
  function questionContent(p, q) {
    const cond = (q.conditions || []).filter(Boolean);
    const m = p.material || {};
    return [q.prompt || '', cond.length ? '<조건>\n' + cond.map(c => '- ' + c).join('\n') : '', (m.text || '').trim() ? '[제시 자료]\n' + m.text.trim() : ''].filter(Boolean).join('\n\n');
  }
  function toEvaluation(p, std, grade) {
    const questions = (p.questions || []).map((q, i) => ({
      number: i + 1, group: 1, sub: i + 1, label: q.label || ('1-' + (i + 1)), content: questionContent(p, q),
      modelAnswer: [q.model_answer || '', q.also_accept ? '[인정 범위] ' + q.also_accept : '', (q.grading_notes || []).length ? '[채점 유의] ' + q.grading_notes.join(' / ') : ''].filter(Boolean).join('\n'),
      keyElements: (q.key_elements || []).join(', '), page: 1, hint: q.answer_format || ''
    }));
    const rubrics = (p.questions || []).map((q, i) => ({
      number: i + 1,
      rubric: (q.rubric || []).map((r, k) => ({ number: k + 1, name: r.name, scales: LEVELS3.map(lv => { const l = (r.levels || []).find(x => x.level === lv) || {}; return { level: lv, score: 3 - LEVELS3.indexOf(lv), criterion: String(l.criterion || '').trim(), feedback: String(l.feedback || '').trim() }; }) }))
    }));
    const data = { subject: std.s, grade: Number(grade) || Number(String(std.g).charAt(0)) || 1, unit: std.c + (std.a ? ' ' + std.a : ''), name: (p.title || '').trim() || std.c + ' 서·논술형 평가',
      scaleType: '3단계', useAI: true, evalType: '다중문항', questions, questionCount: questions.length, pagesPerStudent: 1, gradingMethod: '총점비율', question: '' };
    return { data, rubrics };
  }

  /* ---------- 복사·인쇄용 글 ---------- */
  function sheetText(p, std, grade) {
    const m = p.material || {}, L = [];
    L.push(p.title || ''); L.push(`${std.s} ${grade ? grade + '학년' : ''}    (   )반 (   )번  이름:`); L.push('');
    L.push('1. ' + (m.intro || '다음 자료를 읽고 물음에 답하시오.')); L.push('');
    if (m.text) { L.push(m.text.trim()); L.push(''); }
    if (m.picture_note) { L.push('[그림 자리: ' + m.picture_note + ']'); L.push(''); }
    (p.questions || []).forEach(q => {
      L.push(`(${q.label}) ${q.prompt || ''}`);
      const cond = (q.conditions || []).filter(Boolean);
      if (cond.length) { L.push('<조건>'); cond.forEach(c => L.push('  · ' + c)); }
      L.push('[답란: ' + (q.answer_format || (q.answer_lines || 2) + '줄') + ']'); L.push('');
    });
    return L.join('\n').trim() + '\n';
  }
  function rubricText(p, std) {
    const L = [];
    L.push('[채점 기준] ' + (p.title || '')); L.push(`성취기준 ${std.c} ${std.t}`); L.push('평가 초점: ' + (p.eval_focus || '')); L.push('');
    (p.questions || []).forEach(q => {
      L.push(`■ ${q.label} ${q.eval_element || ''}`);
      L.push('예시 답안: ' + (q.model_answer || ''));
      if (q.also_accept) L.push('인정 범위: ' + q.also_accept);
      (q.rubric || []).forEach(r => { L.push('- 채점 요소: ' + r.name); LEVELS3.forEach(lv => { const l = (r.levels || []).find(x => x.level === lv) || {}; L.push(`   ${lv}(${3 - LEVELS3.indexOf(lv)}점): ${l.criterion || ''}${l.example ? '  예) ' + l.example : ''}`); }); });
      (q.grading_notes || []).forEach(n => L.push('- 유의: ' + n));
      L.push('');
    });
    const lp = p.level_profile || {};
    if (lp.A || lp.B || lp.C) { L.push('■ 성취수준별 수행 특성'); ['A', 'B', 'C'].forEach(k => L.push(`  ${k}: ${lp[k] || ''}`)); L.push(''); }
    if ((p.expected_errors || []).length) { L.push('■ 예상 오답과 지도'); p.expected_errors.forEach(e => L.push(`  · ${e.error} → ${e.response}`)); }
    return L.join('\n').trim() + '\n';
  }

  /* ---------- 받은 제안 기계 점검 ---------- */
  function validateProposal(p, std, guide) {
    const issues = [], warn = [];
    const band = bandOf(std);
    const maxLines = band === '1~2학년군' ? 4 : band === '3~4학년군' ? 8 : 20;
    const norm = s => String(s || '').replace(/\s+/g, '');
    if (!p || !Array.isArray(p.questions) || !p.questions.length) { issues.push('문항이 없습니다'); return { issues, warn }; }
    if (p.standard_quote && !norm(std.t).includes(norm(p.standard_quote))) issues.push('standard_quote가 성취기준 원문에 없습니다: ' + p.standard_quote);
    if (!p.standard_quote) issues.push('성취기준 인용이 비어 있습니다');
    if (p.questions.length > 5) warn.push('소문항이 5개를 넘습니다(' + p.questions.length + '개)');
    const mat = norm((p.material || {}).text);
    if (!mat) warn.push('인쇄할 자료 본문이 없습니다');
    p.questions.forEach(q => {
      const tag = '[' + q.label + '] ';
      if (!q.prompt) issues.push(tag + '발문이 없습니다');
      if (!q.model_answer) issues.push(tag + '예시 답안이 없습니다');
      if (!Array.isArray(q.rubric) || !q.rubric.length) { issues.push(tag + '채점 요소가 없습니다'); return; }
      if (q.rubric.length > 2) warn.push(tag + '채점 요소가 ' + q.rubric.length + '개입니다(소문항당 1~2개 권장)');
      if ((q.answer_lines || 0) > maxLines) warn.push(tag + `답란 ${q.answer_lines}줄은 ${band} 사례의 최대(${maxLines}줄)를 넘습니다`);
      if ((q.conditions || []).some(c => (c.match(/하고,|하며,|하고 |하며 /g) || []).length >= 2)) warn.push(tag + '한 조건에 여러 요구가 섞였을 수 있습니다');
      // 예시 답안이 자료를 그대로 옮긴 것인지: 15자 이상 연속 일치
      const ma = norm(q.model_answer);
      for (let i = 0; i + 15 <= ma.length; i += 5) { if (mat.includes(ma.slice(i, i + 15))) { warn.push(tag + '예시 답안이 자료 문장을 그대로 옮긴 부분이 있습니다: "' + ma.slice(i, i + 15) + '…"'); break; } }
      q.rubric.forEach(r => {
        const lv = (r.levels || []).map(l => l.level);
        if (LEVELS3.some(x => !lv.includes(x)) || lv.length !== 3) issues.push(tag + `"${r.name}" 수준이 상·중·하 3개가 아닙니다`);
        const cr = (r.levels || []).map(l => norm(l.criterion));
        if (new Set(cr).size !== cr.length) issues.push(tag + `"${r.name}" 수준 진술이 서로 같습니다`);
        if (cr.some(c => !c)) issues.push(tag + `"${r.name}" 빈 판정 기준이 있습니다`);
        if ((r.levels || []).some(l => /무응답|쓰지않|백지/.test(norm(l.criterion)) && l.level === '하')) warn.push(tag + `"${r.name}" '하'에 무응답이 들어 있습니다(무응답은 교사가 따로 처리)`);
        if ((r.levels || []).some(l => /또는/.test(l.criterion || ''))) warn.push(tag + `"${r.name}" 한 수준에 '또는'으로 다른 경우를 묶었습니다`);
        if ((r.levels || []).some(l => /도움을받아/.test(norm(l.criterion)))) warn.push(tag + `"${r.name}" 답안지로 판정할 수 없는 '도움 여부'가 들어 있습니다`);
      });
    });
    ['A', 'B', 'C'].forEach(k => { if (!p.level_profile || !p.level_profile[k]) issues.push('성취수준별 수행 특성 ' + k + '가 없습니다'); });
    return { issues, warn };
  }

  const SUBJECTS = ['국어', '사회', '수학', '과학', '영어'];   // 참고 사례가 있는 교과만 제안
  const api = { SUBJECTS, bandOf, selectCases, compactCase, buildOutlinePrompt, buildProposalPrompt, validateProposal, toEvaluation, sheetText, rubricText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ProposalCore = api;
})(typeof self !== 'undefined' ? self : this);
