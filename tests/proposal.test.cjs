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
