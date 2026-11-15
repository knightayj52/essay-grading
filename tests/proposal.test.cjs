const {test}=require('node:test');const assert=require('node:assert/strict');
const P=require('../proposal-core.js'),C=require('../core.js');
const S=require('../data/standards.json'),K=require('../data/cases.json'),G=require('../data/guide.json');
const lv=(a,b,c)=>[{level:'상',score:3,criterion:a,example:'e',feedback:'f'},{level:'중',score:2,criterion:b},{level:'하',score:1,criterion:c}];
const sample=std=>({title:'평가',standard_quote:std.t.slice(0,8),material:{intro:'읽고 답하시오.',text:'가 | 나\n1 | 2'},level_profile:{A:'a',B:'b',C:'c'},
  questions:[{label:'1-1',prompt:'까닭을 쓰시오.',conditions:['두 가지를 쓸 것.'],answer_format:'점선 2줄',answer_lines:2,model_answer:'왜냐하면 그렇기 때문이다.',also_accept:'비슷한 답',key_elements:['까닭'],grading_notes:['옮겨 쓴 답은 하'],rubric:[{name:'까닭',levels:lv('둘 다 씀','하나만 씀','쓰지 못함')}]},
             {label:'1-2',prompt:'의견을 쓰시오.',conditions:[],model_answer:'나는 찬성한다.',rubric:[{name:'의견',levels:lv('근거와 함께','의견만','무관한 내용')}]}]});
test('data covers only the five supported subjects and every case code exists',()=>{
  assert.deepEqual([...new Set(S.map(s=>s.s))].sort(),[...P.SUBJECTS].sort());
  const codes=new Set(S.map(s=>s.c));assert.equal(new Set(S.map(s=>s.c)).size,S.length);
  for(const c of K)for(const k of c.codes2022)assert.ok(codes.has(k),k);
  for(const s of S)assert.ok(s.t&&s.A&&s.B&&s.C&&G.grade_bands[s.g],s.c);});
test('every standard gets reference cases from its own subject, direct ones first',()=>{
  for(const s of S){const sel=P.selectCases(s,K,3);assert.ok(sel.length>0,s.c);assert.ok(sel.every(x=>x.c.subject===s.s));assert.ok(sel.every((x,i)=>!i||sel[i-1].tier<=x.tier));}});
test('outline and full prompts carry the standard, the teacher note and the 3-level rule',()=>{
  const s=S.find(x=>x.s==='사회'),sel=P.selectCases(s,K,3);
  const o=P.buildOutlinePrompt({standard:s,guide:G,selected:sel,grade:4,teacherNote:'우리 고장 소재'});
  assert.ok(o.includes(s.t)&&o.includes('우리 고장 소재')&&o.includes('"outlines"')&&o.includes('개요 3개'));
  const f=P.buildProposalPrompt({standard:s,guide:G,selected:sel,grade:4,teacherNote:'우리 고장 소재',outline:{title:'장소 소개',pattern:'선택-근거',questions:[{label:'1-1',asks:'장소 고르기'}]}});
  assert.ok(f.includes('평가안 1개')&&f.includes('장소 소개')&&f.includes('우리 고장 소재')&&f.includes('3단계(상·중·하)')&&!f.includes('서로 달라야'));});
test('a finished proposal converts into an evaluation the grading core accepts',()=>{
  const s=S[0],p=sample(s),{data,rubrics}=P.toEvaluation(p,s,4);
  assert.equal(data.evalType,'다중문항');assert.equal(data.scaleType,'3단계');assert.equal(data.questionCount,2);assert.equal(data.subject,s.s);
  assert.ok(data.questions[0].content.includes('까닭을 쓰시오.')&&data.questions[0].content.includes('두 가지를 쓸 것.')&&data.questions[0].content.includes('가 | 나'));
  assert.ok(data.questions[0].modelAnswer.includes('옮겨 쓴 답은 하'));
  for(const r of rubrics){assert.equal(C.validateRubric(r.rubric),true);assert.deepEqual(r.rubric[0].scales.map(x=>x.score),[3,2,1]);}
  assert.deepEqual(P.validateProposal(p,s,G).issues,[]);});
test('machine check catches missing levels and copy/print text holds no answers',()=>{
  const s=S[0],p=sample(s);p.questions[1].rubric[0].levels.pop();p.standard_quote='성취기준에 없는 말';
  assert.equal(P.validateProposal(p,s,G).issues.length,2);
  const sheet=P.sheetText(sample(s),s,4),rub=P.rubricText(sample(s),s);
  assert.ok(sheet.includes('(1-1) 까닭을 쓰시오.')&&!sheet.includes('왜냐하면 그렇기'));assert.ok(rub.includes('상(3점): 둘 다 씀')&&rub.includes(s.c));});
const sumFix=require('./fixtures-summative.cjs');
const SS=S.filter(s=>/\[4사0[89]-0[12]\]|\[4사10-01\]/.test(s.c));
test('summative points always add up to the total and follow element counts',()=>{
  assert.deepEqual(P.allocatePoints([2,3,3],100),[30,35,35]);
  for(const total of [50,60,90,100,120])for(const counts of [[2,2],[3,3],[2,3,3],[3,2,2,3],[2,2,2,2,3]])assert.equal(P.allocatePoints(counts,total).reduce((a,b)=>a+b,0),total);
  for(const pts of [15,20,25,30,35,40,50]){const l=P.levelsFor({points:pts,elements:[{slot:'a',name:'a',accept:['x']},{slot:'b',name:'b',accept:['y']}]}).map(x=>x.score);assert.ok(l[0]===pts&&l[0]>l[1]&&l[1]>l[2]&&l[2]>0,pts+':'+l);}});
test('summative prompts list every chosen standard and the count-based grading rule',()=>{
  assert.equal(SS.length,5);const opt={standards:SS,guide:G,selected:P.mergeCases(SS,K,3),grade:4,questionCount:3,total:100,teacherNote:'가상 지역으로'};
  const o=P.buildSummativeOutlinePrompt(opt),f=P.buildSummativePrompt({...opt,outline:{title:'구성 가',questions:[{label:'1',standards:['[4사08-01]'],elements:['모습','좋은 점']}]}});
  for(const s of SS)assert.ok(o.includes(s.c)&&f.includes(s.c));
  assert.ok(o.includes('"outlines"')&&o.includes('3문항, 100점 만점')&&o.includes('갖춘 요소의 개수')&&o.includes('가상 지역으로'));assert.ok(f.includes('구성 가')&&f.includes('"accept"'));
  assert.ok(opt.selected.length>0&&opt.selected.every(x=>x.c.subject==='사회'));});
test('a summative proposal becomes three 100-point questions the grading core accepts',()=>{
  const p=P.normalizeSummative(sumFix(),100);assert.deepEqual(p.questions.map(q=>q.points),[30,35,35]);
  assert.deepEqual(P.validateSummative(p,SS,{questionCount:3}).issues,[]);
  const {data,rubrics}=P.summativeToEvaluation(p,SS,4);
  assert.equal(data.questionCount,3);assert.deepEqual(data.questions.map(q=>[q.group,q.sub]),[[1,0],[2,0],[3,0]]);
  assert.ok(data.questions[1].content.includes('세워진 차 | 21대')&&data.questions[1].content.includes('[답란 칸] 원인 / 해결 방안 / 까닭'));
  assert.equal(rubrics.reduce((a,r)=>a+r.rubric[0].scales[0].score,0),100);
  for(const r of rubrics){assert.equal(C.validateRubric(r.rubric),true);assert.equal(r.rubric.length,1);}
  assert.deepEqual(rubrics[1].rubric[0].scales.map(x=>x.score),[35,25,10]);assert.ok(rubrics[1].rubric[0].scales[0].criterion.includes('인정: 내려 줄 곳이 없음 / 주차장이 멂'));
  p.questions[0].points=45;P.normalizeSummative(p,100);assert.equal(p.questions[0].points,45,'교사가 고친 배점은 유지');assert.equal(P.validateSummative(p,SS).issues.length,1);});
test('summative check flags vague wording, wrong element counts and uncovered standards',()=>{
  const p=P.normalizeSummative(sumFix(),100);p.questions[2].elements.splice(1);p.questions[1].elements[0].accept=['원인을 구체적으로 씀'];p.questions[0].standards=['[4사08-01]'];
  const v=P.validateSummative(p,SS,{questionCount:3});
  assert.ok(v.issues.some(x=>x.includes('채점 요소가 1개')));assert.ok(v.warn.some(x=>x.includes('정도 표현')));assert.ok(v.warn.some(x=>x.includes('[4사08-02]')));
  const sheet=P.summativeSheetText(P.normalizeSummative(sumFix(),100),SS,4),rub=P.summativeRubricText(P.normalizeSummative(sumFix(),100),SS);
  assert.ok(sheet.includes('[35점]')&&sheet.includes('원인:')&&!sheet.includes('내려 주는 곳을 만든다'));assert.ok(rub.includes('상 3개 모두 (35점) / 중 2개 (25점) / 하 1개 이하 (10점)'));});
