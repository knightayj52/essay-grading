/* Pure rules shared by the app and regression tests. */
(function(root) {
  'use strict';
  function replacementRequests(sheetId, values, predicate, rows) {
    const requests = [];
    for (let i=values.length-1; i>=1; i--) if (predicate(values[i] || [])) requests.push({deleteDimension:{range:{sheetId,dimension:'ROWS',startIndex:i,endIndex:i+1}}});
    if (rows.length) requests.push({appendCells:{sheetId,rows:rows.map(row=>({values:row.map(value=> {
      if (typeof value==='number' && !Number.isFinite(value)) throw Error('유효하지 않은 숫자');
      if (String(value ?? '').length>45000) throw Error('저장할 내용이 너무 깁니다. 답안을 문항별로 나누어 주세요.');
      return {userEnteredValue:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:{stringValue:String(value ?? '')}};
    })})),fields:'userEnteredValue'}});
    return requests;
  }
  function validateTargets(targets, counts) {
    if (!targets.length) throw Error('채점할 답안이 없습니다.');
    const pages=new Set(), nums=new Set();
    for (const t of targets) {
      if (!Number.isInteger(t.number)||t.number<1||nums.has(t.number)) throw Error('학생 번호가 잘못되었거나 중복됩니다.');
      nums.add(t.number);
      if (!t.pdfId||!Number.isInteger(t.startPage)||!Number.isInteger(t.endPage)||t.startPage<1||t.endPage<t.startPage||t.endPage>counts[t.pdfId]) throw Error(t.number+'번의 PDF 페이지 범위를 확인해 주세요.');
      for(let p=t.startPage;p<=t.endPage;p++) { const k=t.pdfId+':'+p; if(pages.has(k)) throw Error('같은 PDF 페이지가 여러 학생에게 연결되어 있습니다: '+p+'쪽'); pages.add(k); }
    }
    return true;
  }
  function validateRubric(rubric) {
    if(!Array.isArray(rubric)||!rubric.length) throw Error('문항마다 채점 기준을 저장해 주세요.');
    const ids=new Set();
    for(const c of rubric) {
      if(ids.has(c.number)||!c.name||!c.scales?.length) throw Error('루브릭의 기준명·번호·척도를 확인해 주세요.');
      ids.add(c.number);
      const levels=new Set();
      for(const s of c.scales) { if(!s.level||levels.has(s.level)||!s.criterion?.trim()||!Number.isFinite(s.score)||s.score<0) throw Error('모든 척도에 서로 다른 이름, 판정 기준, 0 이상의 점수가 필요합니다.'); levels.add(s.level); }
      if(Math.max(...c.scales.map(s=>s.score))<=0) throw Error('기준별 만점은 0보다 커야 합니다.');
    }
    return true;
  }
  function normalizeAnswer(data, rubric) {
    if(!data||!['readable','blank','unreadable'].includes(data.status)||typeof data.text!=='string'||!Array.isArray(data.criteria)) throw Error('AI 응답 구조가 올바르지 않습니다. 다시 시도하세요.');
    const unresolved=data.status!=='readable';
    if(!unresolved&&!data.text.trim()) throw Error('인식된 답안이 비어 있습니다.');
    if(!unresolved&&data.criteria.length!==rubric.length) throw Error('AI가 일부 평가 기준을 누락했습니다.');
    const seen=new Set();
    for(const x of data.criteria) { if(seen.has(Number(x.number))) throw Error('AI 평가 기준이 중복되었습니다.'); seen.add(Number(x.number)); }
    const criteria=rubric.map(c=>{
      const a=data.criteria.find(x=>Number(x.number)===c.number);
      const scale=!unresolved&&a&&c.scales.find(s=>s.level===a.level&&Number(a.score)===s.score);
      if(!unresolved&&(!scale||typeof a.reason!=='string'||!a.reason.trim())) throw Error('AI 점수 또는 판정 근거가 루브릭과 맞지 않습니다.');
      return {number:c.number,name:c.name,score:unresolved?null:scale.score,level:unresolved?'':scale.level,reason:String(a?.reason||''),evidence:String(a?.evidence||''),max:Math.max(...c.scales.map(s=>s.score))};
    });
    return {status:data.status,text:data.text,criteria,feedback:String(data.feedback||''),flags:[...(Array.isArray(data.flags)?data.flags.map(String):[]),...(data.status==='blank'?['무응답 확인 필요']:data.status==='unreadable'?['글씨 판독 확인 필요']:[])].slice(0,8)};
  }
  function totals(answers) { let total=0,max=0,unresolved=false; for(const a of answers) for(const c of a.criteria) { max+=c.max; if(c.score===null||!Number.isFinite(c.score)) unresolved=true; else total+=c.score; } return {total,max,unresolved}; }
  function csvCell(value) { let s=String(value??''); if(/^[\s]*[=+\-@]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; }
  const api={replacementRequests,validateTargets,validateRubric,normalizeAnswer,totals,csvCell};
  if(typeof module!=='undefined') module.exports=api; else root.GradingCore=api;
})(typeof window==='undefined'?globalThis:window);
