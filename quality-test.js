/* Isolated quality lab: reads confirmed work, never writes student grades. */
const quality={key:'',suite:null,report:null,ev:null,questions:[],rubrics:{},running:false,stop:false,token:0};
const qualityBaseSwitch=switchTab;
switchTab=function(name){if(quality.running&&name!=='quality')return showToast('테스트를 일시정지한 뒤 이동하세요.');qualityBaseSwitch(name);if(name==='quality'&&workspace.tab==='quality')openQuality().catch(e=>showToast(e.message));};
const qh=escapeHtml;
const statusNames={readable:'읽을 수 있음',blank:'빈 답안',unreadable:'판독 불가'};
function qualitySave(){try{localStorage.setItem(quality.key,JSON.stringify({schema:1,suite:quality.suite,report:quality.report}));return true;}catch{quality.stop=true;showToast('테스트 저장 공간이 부족합니다. 결과 JSON을 내려받은 뒤 기록을 정리하세요.');return false;}}
async function openQuality(id){
 if(quality.running)return;
 const token=++quality.token;
 const ev=state.evaluations.find(e=>e.id===(id||workspace.evaluationId))||state.evaluations[0];
 if(!ev){$('quality-content').innerHTML='<div class="card empty-state">평가와 채점 기준을 먼저 만들어 주세요.</div>';return;}
 const key=draftKey('quality_'+ev.id);
 const [questions,rubrics]=await Promise.all([getQuestionList(ev),getRubricGroupedByQuestion(ev.id)]);
 if(token!==quality.token)return;
 quality.ev=ev;quality.questions=questions;quality.rubrics=rubrics;workspace.evaluationId=ev.id;renderContext();setSaveStatus('품질 테스트 · 이 브라우저에 저장');
 if(quality.key!==key){quality.key=key;const saved=readLocal(key,{});quality.suite=saved.suite||[];quality.report=saved.report||null;
  if(quality.report)for(const c of quality.report.cases)for(const r of c.runs)if(r.status==='running'){r.status='pending';r.recovery='새로고침으로 중단된 요청입니다. 재개하면 API 요청이 반복될 수 있습니다.';}
 }
 renderQuality();
}
function qualityOptions(){const models=[...workspace.models,...MODELS,{id:getModel(),name:getModel()}];return [...new Map(models.map(m=>[m.id,m])).values()].map(m=>`<option value="${qh(m.id)}">${qh(m.name||m.id)}</option>`).join('');}
function renderQuality(){
 const busy=quality.running?'disabled':'';
 $('quality-content').innerHTML=`<div class="info-box">교사 기준과 Gemini 판정을 비교하는 실험 공간입니다. 학생 성적에는 반영되지 않으며, 테스트 답안과 결과는 이 브라우저에 저장됩니다. 기준 점수와 교사 메모는 AI에 보내지 않습니다.</div>
 <div class="card quality-setup"><div class="form-row"><label for="quality-eval">테스트할 평가</label><select id="quality-eval" ${busy} onchange="openQuality(this.value).catch(e=>showToast(e.message))">${state.evaluations.map(e=>`<option value="${qh(e.id)}" ${e.id===quality.ev.id?'selected':''}>${qh(e.name)}</option>`).join('')}</select></div>
 <div class="toolbar"><button class="btn btn-primary" ${busy} onclick="qualityManual()">+ 기준 답안 직접 입력</button><button class="btn btn-secondary" ${busy} onclick="qualityImport().catch(e=>showToast(e.message))">확정 답안에서 가져오기</button></div>
 <p class="helper">최대 20개 · 상·중·하, 경계 점수, 빈 답안 등을 고르게 넣어 보세요. 가져온 기준은 그 시점의 사본이며 평가를 수정해도 자동으로 바뀌지 않습니다.</p>
 <div class="quality-cases">${quality.suite.length?quality.suite.map((c,i)=>`<div class="quality-case"><div><strong>${qh(c.title)}</strong><small>문항 ${qh(c.question.label)} · ${c.mode==='pdf'?'PDF 인식 + 채점':'텍스트 채점'} · ${qh(statusNames[c.expected.status])} · ${c.expected.criteria.map(x=>qh(x.name)+': '+x.score).join(' / ')}</small><p>${qh((c.input.text||c.expected.text||'(빈 답안)').slice(0,140))}</p></div><button class="btn btn-ghost btn-small" ${busy} onclick="qualityRemove(${i})" aria-label="${qh(c.title)} 삭제">삭제</button></div>`).join(''):'<div class="empty-state">먼저 선생님의 기준 답안을 추가하세요.</div>'}</div>
 <div class="quality-controls"><div class="form-row"><label for="quality-model">기본 모델</label><select id="quality-model" ${busy}>${qualityOptions()}</select></div><div class="form-row"><label for="quality-model2">비교 모델 (선택)</label><select id="quality-model2" ${busy}><option value="">비교하지 않음</option>${qualityOptions()}</select></div><div class="form-row"><label for="quality-reps">답안별 반복 횟수</label><select id="quality-reps" ${busy}><option value="1">1회</option><option value="2">2회</option><option value="3">3회</option></select></div></div>
 <div class="toolbar"><button class="btn btn-primary" ${busy} ${!quality.suite.length?'disabled':''} onclick="qualityPrepare()">${workspace.demo?'가상 테스트 결과 보기':'테스트 실행'}</button><span class="helper">${workspace.demo?'샘플 모드 · Gemini 호출 없음':'API 사용량이 발생합니다. 설정의 요청 간격을 적용합니다.'}</span></div></div>
 <div id="quality-report" aria-live="polite"></div>`;
 $('quality-model').value=getModel();renderQualityReport();
}
function qualityRemove(i){if(quality.running)return;quality.suite.splice(i,1);qualitySave();renderQuality();}
function qualityManual(){if(quality.running)return;showModal(`<div class="modal-header"><strong>기준 답안 직접 입력</strong><button class="modal-close" onclick="closeModal()">×</button></div><div class="form-row"><label for="quality-question">문항</label><select id="quality-question" onchange="qualityManualFields()">${quality.questions.map((q,i)=>`<option value="${i}">문항 ${qh(q.label)}</option>`).join('')}</select></div><div class="form-row"><label for="quality-title">답안 별칭 (학생 이름 제외)</label><input id="quality-title" maxlength="60" placeholder="예: 이유는 맞지만 실천이 모호한 답안"></div><div class="form-row"><label for="quality-input">학생 답안 텍스트</label><textarea id="quality-input" rows="5" maxlength="20000"></textarea></div><div class="form-row"><label for="quality-status">교사 기준: 답안 상태</label><select id="quality-status" onchange="qualityManualFields()"><option value="readable">읽을 수 있음</option><option value="blank">빈 답안</option></select></div><div id="quality-expected"></div><p class="helper">판독 불가·필기 인식은 확정 답안을 PDF 방식으로 가져와 테스트하세요.</p><div class="form-row"><label for="quality-note">교사 메모 (AI에 전송하지 않음)</label><input id="quality-note" maxlength="500"></div><button class="btn btn-primary" onclick="qualityAddManual().catch(e=>showToast(e.message))">기준 답안 추가</button>`);qualityManualFields();}
function qualityManualFields(){const q=quality.questions[Number($('quality-question').value)],rubric=quality.rubrics[q.number]||[];try{GradingCore.validateRubric(rubric);}catch(e){$('quality-expected').textContent=e.message;return;}$('quality-expected').innerHTML=$('quality-status').value==='blank'?'<p class="helper">빈 답안은 점수 대신 상태 판정의 일치 여부를 비교합니다.</p>':rubric.map((c,i)=>`<div class="form-row"><label for="quality-score-${i}">${qh(c.name)} · 교사 기준 점수</label><select id="quality-score-${i}"><option value="">선택하세요</option>${c.scales.map((s,k)=>`<option value="${k}">${qh(s.level)} · ${s.score}점 — ${qh(s.criterion)}</option>`).join('')}</select></div>`).join('');}
async function qualityAddManual(){
 if(quality.running)return;if(quality.suite.length>=20)throw Error('기준 답안은 최대 20개입니다.');
 const q=quality.questions[Number($('quality-question').value)],rubric=quality.rubrics[q.number];GradingCore.validateRubric(rubric);
 const status=$('quality-status').value,text=$('quality-input').value.trim();if(status==='readable'&&!text)throw Error('학생 답안 텍스트를 입력하세요.');if(status==='blank'&&text)throw Error('빈 답안의 텍스트를 비워 주세요.');
 const criteria=status==='readable'?rubric.map((c,i)=>{const v=$('quality-score-'+i).value;if(v==='')throw Error('모든 기준 점수를 선택하세요.');const s=c.scales[Number(v)];return{number:c.number,name:c.name,level:s.level,score:s.score};}):[];
 quality.suite.push({id:crypto.randomUUID(),title:$('quality-title').value.trim()||'기준 답안 '+(quality.suite.length+1),mode:'text',ev:{subject:quality.ev.subject,grade:quality.ev.grade},question:structuredClone(q),questions:structuredClone(quality.questions),rubric:structuredClone(rubric),rubricVersion:await fingerprint({q,rubric}),input:{text},expected:{status,text,criteria,note:$('quality-note').value.trim()}});
 qualitySave();closeModal();renderQuality();
}
async function qualityImport(){
 if(quality.running)return;
 const jobs=(await loadJobs(quality.ev.id)).filter(j=>j.confirmed);quality.imports=[];
 for(const j of jobs)for(const a of j.answers){const q=j.questions.find(q=>q.number===a.number),rubric=j.rubrics[a.number];if(!q||!rubric)continue;try{GradingCore.validateRubric(rubric);}catch{continue;}
 if(a.status==='readable'&&rubric.some(c=>!a.criteria.some(v=>v.number===c.number&&c.scales.some(s=>s.level===v.level&&s.score===v.score))))continue;
 quality.imports.push({j,a,q,rubric});}
 showModal(`<div class="modal-header"><strong>확정 답안을 기준으로 가져오기</strong><button class="modal-close" onclick="closeModal()">×</button></div><p class="helper">선택한 답안의 교사 수정 텍스트·점수·루브릭 사본을 저장합니다. 기준 답안은 직접 검토한 자료를 사용하세요.</p><div class="form-row"><label for="quality-mode">테스트 방식</label><select id="quality-mode"><option value="text">텍스트 채점 — 교사가 수정한 글 사용</option><option value="pdf" ${workspace.demo?'disabled':''}>PDF 인식 + 채점 — 원본 답안 이미지 사용</option></select></div><div class="quality-imports">${quality.imports.length?quality.imports.map(({j,q},i)=>`<label><input type="checkbox" class="quality-import" value="${i}"> ${j.grade}학년 ${j.classNum}반 ${j.number}번 · 문항 ${qh(q.label)}</label>`).join(''):'확정된 답안이 없습니다. 검토·결과에서 답안을 확인하고 확정하세요.'}</div><button class="btn btn-primary" onclick="qualityAddImports().catch(e=>showToast(e.message))">선택 답안 가져오기</button>`);
}
async function qualityAddImports(){
 if(quality.running)return;const selected=[...document.querySelectorAll('.quality-import:checked')].map(x=>quality.imports[Number(x.value)]),mode=$('quality-mode').value;if(!selected.length)throw Error('답안을 선택하세요.');if(quality.suite.length+selected.length>20)throw Error('최대 20개까지 추가할 수 있습니다.');
 const cases=[];for(const {j,a,q,rubric} of selected){if(mode==='text'&&a.status==='unreadable')throw Error('판독 불가 답안은 PDF 방식으로 가져오세요.');if(mode==='pdf'&&!j.pdfId)throw Error('원본 PDF 연결이 없는 답안입니다.');cases.push({id:crypto.randomUUID(),title:'기준 답안 '+(quality.suite.length+cases.length+1),mode,ev:{subject:j.ev.subject,grade:j.grade},question:structuredClone(q),questions:structuredClone(j.questions),rubric:structuredClone(rubric),rubricVersion:await fingerprint({q,rubric}),input:mode==='text'?{text:a.text}:{pdfId:j.pdfId,startPage:j.startPage,endPage:j.endPage},expected:{status:a.status,text:a.text,criteria:a.status==='readable'?a.criteria.map(c=>({number:c.number,name:c.name,level:c.level,score:c.score})):[],note:''}});}
 quality.suite.push(...cases);qualitySave();closeModal();renderQuality();
}
function qualityPrepare(){
 if(quality.running||!quality.suite.length)return;
 const models=[...new Set([$('quality-model').value,$('quality-model2').value].filter(Boolean))],repetitions=Number($('quality-reps').value);
 quality.prepared={models,repetitions};
 showModal(`<div class="modal-header"><strong>품질 테스트 실행 확인</strong><button class="modal-close" onclick="closeModal()">×</button></div><p>기준 답안 ${quality.suite.length}개 × 모델 ${models.length}개 × ${repetitions}회 = <strong>${quality.suite.length*models.length*repetitions}건</strong></p><p class="helper">실패 요청의 자동 재시도는 추가 호출될 수 있습니다. ${workspace.demo?'체험용 가상 결과만 생성합니다.':'문항·루브릭·답안 텍스트 또는 PDF 이미지가 Gemini로 전송됩니다. 이미지에는 학생 이름이 포함될 수 있습니다.'}<br>교사 기준 점수·메모와 다른 학생의 참고 답안은 보내지 않습니다. 기존 테스트 보고서는 새 결과로 교체됩니다. 필요한 결과는 먼저 JSON으로 내려받으세요.</p><label class="toolbar"><input type="checkbox" id="quality-consent"> ${workspace.demo?'가상 결과임을 확인했습니다.':'위 자료를 Gemini에 보내 품질 테스트를 실행합니다.'}</label><button class="btn btn-primary" onclick="qualityStart().catch(e=>showToast(e.message))">실행</button>`);
}
async function qualityStart(){
 if(quality.running||!$('quality-consent')?.checked)return showToast('실행 내용을 확인해 주세요.');if(!workspace.demo&&!getGeminiKey())throw Error('설정에서 Gemini API 키를 입력하세요.');
 const {models,repetitions}=quality.prepared;
 quality.report={schema:1,appVersion:'4.1.0',promptVersion:'grading-v4-isolated',createdAt:new Date().toISOString(),mock:workspace.demo,models,repetitions,cases:structuredClone(quality.suite).map(c=>({...c,runs:models.flatMap(model=>Array.from({length:repetitions},(_,i)=>({model,repeat:i+1,status:'pending',attempts:[]})))}))};
 closeModal();if(!qualitySave())return;await qualityRun();
}
function qualityJob(c,model){return{ev:c.ev,grade:c.ev.grade,questions:c.questions,rubrics:{[c.question.number]:c.rubric},pdfId:c.input.pdfId,startPage:c.input.startPage,endPage:c.input.endPage,model,samples:[]};}
function qualityMock(c,repeat){const criteria=c.expected.criteria.map((v,i)=>{const s=repeat===2&&i===0?c.rubric[i].scales.find(s=>s.score!==v.score):null;return{...v,...(s?{score:s.score,level:s.level}:{}),reason:'체험용 가상 판정입니다.',evidence:c.expected.text};});return GradingCore.normalizeAnswer({status:c.expected.status,text:c.expected.text,criteria,feedback:'이 결과는 화면 체험용이며 Gemini를 호출하지 않았습니다.',flags:['가상 결과']},c.rubric);}
async function qualityRun(retry=false){
 if(workspace.busy||!quality.report)return;
 const execute=async(lock)=>{if(lock===null)return showToast('다른 탭에서 채점 중입니다.');
 if(retry)for(const c of quality.report.cases)for(const r of c.runs)if(r.status==='error')r.status='pending';
 quality.running=true;workspace.busy=true;quality.stop=false;grading.stop=false;renderQuality();
 try{for(const slot of QualityCore.schedule(quality.report)){
  if(quality.stop)break;const c=quality.report.cases[slot.caseIndex],r=c.runs[slot.runIndex];r.status='running';r.error='';const started=Date.now();if(!qualitySave()){r.status='pending';break;}renderQualityReport();
  try{r.result=quality.report.mock?qualityMock(c,r.repeat):await gradeQuestion(qualityJob(c,r.model),c.question,c.mode==='text'?c.input.text:undefined,{captureRaw:true});r.status='success';}
  catch(e){r.status='error';r.error=e.message;r.rawResponse=e.rawResponse||null;if(/API 키|401|403|404|로그인/.test(e.message))quality.stop=true;}
  r.durationMs=Date.now()-started;r.finishedAt=new Date().toISOString();r.attempts.push({status:r.status,error:r.error,durationMs:r.durationMs,finishedAt:r.finishedAt});qualitySave();renderQualityReport();
 }}finally{quality.running=false;workspace.busy=false;quality.report.updatedAt=new Date().toISOString();qualitySave();renderQuality();}
 };
 if(navigator.locks)await navigator.locks.request('eg-grade-'+state.sheetId,{ifAvailable:true},execute);else await execute(undefined);
}
function qualityPause(){quality.stop=true;showToast('현재 테스트 요청을 저장한 뒤 멈춥니다.');}
function qualityExport(){if(!quality.report)return;const blob=new Blob([JSON.stringify(quality.report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='채점_품질테스트_'+quality.report.createdAt.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function qualityClearReport(){if(quality.running||!confirm('현재 테스트 결과를 삭제할까요? 기준 답안은 유지됩니다.'))return;quality.report=null;qualitySave();renderQualityReport();}
function renderQualityReport(){
 const host=$('quality-report'),r=quality.report;if(!host)return;if(!r){host.innerHTML='';return;}
 const runs=r.cases.flatMap(c=>c.runs),done=runs.filter(x=>['success','error'].includes(x.status)).length,pending=runs.filter(x=>['pending','running'].includes(x.status)).length;
 host.innerHTML=`<div class="card quality-report"><div class="toolbar"><div><div class="eyebrow">${r.mock?'SIMULATION · GEMINI 호출 아님':'TEST REPORT'}</div><h3>${r.mock?'가상 결과 · Gemini 호출 아님':'품질 테스트 결과'}</h3><small>${qh(r.createdAt)} · ${done}/${runs.length}건 처리 ${quality.running?'· 실행 중':''}</small></div><button class="btn btn-secondary" onclick="qualityExport()">결과 JSON 다운로드</button></div><progress max="${runs.length||1}" value="${done}"></progress><div class="toolbar">${quality.running?'<button class="btn btn-secondary" onclick="qualityPause()">현재 요청 후 일시정지</button>':`${pending?'<button class="btn btn-primary" onclick="qualityRun().catch(e=>showToast(e.message))">남은 테스트 재개</button>':''}${runs.some(x=>x.status==='error')?'<button class="btn btn-secondary" onclick="qualityRun(true).catch(e=>showToast(e.message))">실패한 요청만 재시도</button>':''}<button class="btn btn-ghost" onclick="qualityClearReport()">결과 삭제</button>`}</div>
 ${runs.some(x=>x.recovery)?'<p class="info-box">새로고침으로 중단된 요청이 있습니다. 재개 시 해당 API 요청은 다시 전송됩니다.</p>':''}
 <p class="helper">점수 일치율은 성공 응답의 기준별 수준·점수가 모두 같은 비율입니다. 판독 불가 판정은 불일치로 포함합니다. 실패·미완료 건은 아래에 별도로 표시하며 지표에서 제외됩니다. 평균 오차는 점수를 비교할 수 있는 항목만 계산합니다. 작은 표본의 결과를 전체 채점의 정확도로 해석하지 마세요.</p>
 <div class="quality-models">${r.models.map(model=>{const s=QualityCore.summarize(r,model);return `<div class="quality-model"><strong>${qh(model)}</strong><div class="quality-metrics"><div><small>기준별 점수 일치</small><b>${s.cellCount?Math.round(100*s.cellMatches/s.cellCount)+'%':'—'}</b><small>${s.cellMatches}/${s.cellCount}항목</small></div><div><small>평균 절대 오차</small><b>${s.meanAbsoluteError===null?'—':s.meanAbsoluteError.toFixed(2)+'점'}</b><small>${s.scoredCells}항목 · 편향 ${s.bias===null?'—':s.bias.toFixed(2)}</small></div><div><small>반복 점수 일관성</small><b>${r.repetitions<2?'2회 이상 필요':s.stable+'/'+s.repeatComplete}</b><small>${s.repeatComplete}/${s.repeatEligible}답안 반복 완료</small></div></div><p>성공 ${s.success} · 실패 ${s.failed} · 미완료 ${s.planned-s.success-s.failed}<br>답안 상태 일치 ${s.statusMatches}/${s.success} · 전체 판정 일치 ${s.exactRuns}/${s.success}</p></div>`;}).join('')}</div>
 <h3>답안별 판정 근거</h3><p class="helper">PDF 방식은 교사 전사문과 AI 전사문을 나란히 검토하세요. 필기 인식 오류가 점수에 미치는 영향을 확인할 수 있습니다.</p>${r.cases.map(c=>`<details class="quality-detail"><summary>${qh(c.title)} · 문항 ${qh(c.question.label)} · ${c.mode==='pdf'?'PDF 인식 + 채점':'텍스트 채점'}</summary><div class="quality-texts"><div><strong>교사 기준 전사문</strong><p>${qh(c.expected.text||'(빈 답안)')}</p><small>상태: ${qh(statusNames[c.expected.status])} · ${qh(c.expected.note||'')}</small></div></div>${c.runs.map(run=>{if(run.status!=='success')return `<p class="quality-run">${qh(run.model)} · ${run.repeat}회: ${qh(({pending:'대기',running:'실행 중',error:'실패'})[run.status])} ${qh(run.error||'')}</p>`;const cmp=QualityCore.compare(c.expected,run.result);return `<div class="quality-run"><strong>${qh(run.model)} · ${run.repeat}회 · ${cmp.exact?'일치':'검토 필요'}</strong><p>AI 전사문: ${qh(run.result.text||'(없음)')}</p><p>상태: ${qh(statusNames[run.result.status])}</p><div class="table-wrap"><table><thead><tr><th>기준</th><th>교사</th><th>Gemini</th><th>차이</th><th>근거</th></tr></thead><tbody>${cmp.cells.map(v=>`<tr><td>${qh(v.name)}</td><td>${qh(v.expectedLevel)} ${v.expected}</td><td>${qh(v.actualLevel)} ${v.actual??'미정'}</td><td>${v.error===null?'비교 불가':(v.error>0?'+':'')+v.error}</td><td>${qh(run.result.criteria.find(x=>x.number===v.number)?.reason||'')}</td></tr>`).join('')}</tbody></table></div><p>${qh(run.result.feedback||'')}</p><small>${qh((run.result.flags||[]).join(' · '))}</small></div>`;}).join('')}</details>`).join('')}<p class="helper">다운로드 파일에는 답안 내용·교사 기준·모델 판정과 PDF 파일 ID(해당 시)가 포함됩니다. 보관·공유 전에 내용을 확인하세요. API 키는 포함하지 않습니다.</p></div>`;
}
