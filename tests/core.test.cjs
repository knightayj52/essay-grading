const {test}=require('node:test');const assert=require('node:assert/strict');const C=require('../core.js');
const rubric=[{number:1,name:'이유',scales:[{level:'상',score:3,criterion:'연결함'},{level:'중',score:2,criterion:'제시함'},{level:'하',score:1,criterion:'부족함'}]}];
test('atomic replace deletes matching rows bottom-up and appends literal text',()=>{const r=C.replacementRequests(7,[['header'],['x'],['keep'],['x']],r=>r[0]==='x',[['=IMPORTXML("x")',3,true]]);assert.deepEqual(r.slice(0,2).map(x=>x.deleteDimension.range.startIndex),[3,1]);assert.equal(r[2].appendCells.rows[0].values[0].userEnteredValue.stringValue,'=IMPORTXML("x")');});
test('oversized data rejected before making a destructive request',()=>assert.throws(()=>C.replacementRequests(1,[['h'],['x']],()=>true,[['x'.repeat(45001)]])));
test('page collision is blocked even when total page count matches',()=>assert.throws(()=>C.validateTargets([{number:1,pdfId:'p',startPage:1,endPage:2},{number:2,pdfId:'p',startPage:2,endPage:3}],{p:4}),/여러 학생/));
test('out of range and invalid student IDs are blocked',()=>{assert.throws(()=>C.validateTargets([{number:1,pdfId:'p',startPage:1,endPage:4}],{p:3}));assert.throws(()=>C.validateTargets([{number:0,pdfId:'p',startPage:1,endPage:1}],{p:3}));});
test('missing roster numbers do not affect valid PDF mapping',()=>assert.equal(C.validateTargets([{number:1,pdfId:'p',startPage:1,endPage:1},{number:3,pdfId:'p',startPage:2,endPage:2}],{p:2}),true));
test('AI cannot introduce scores outside teacher rubric',()=>assert.throws(()=>C.normalizeAnswer({status:'readable',text:'답안',criteria:[{number:1,score:99,level:'상',reason:'이유'}]},rubric),/루브릭/));
test('missing and duplicate AI criteria rejected',()=>{assert.throws(()=>C.normalizeAnswer({status:'readable',text:'답안',criteria:[]},rubric));assert.throws(()=>C.normalizeAnswer({status:'readable',text:'답안',criteria:[{number:1},{number:1}]},rubric));});
test('unreadable and blank answers have unresolved scores rather than fabricated zeroes',()=>{for(const status of ['blank','unreadable']){const a=C.normalizeAnswer({status,text:'',criteria:[]},rubric);assert.equal(a.criteria[0].score,null);assert.equal(C.totals([a]).unresolved,true);}});
test('valid response keeps evidence and recomputes totals',()=>{const a=C.normalizeAnswer({status:'readable',text:'문화유산',criteria:[{number:1,score:2,level:'중',reason:'이유',evidence:'문화유산'}]},rubric);assert.deepEqual(C.totals([a]),{total:2,max:3,unresolved:false});});
test('invalid or ambiguous rubric is rejected',()=>{assert.equal(C.validateRubric(rubric),true);assert.throws(()=>C.validateRubric([{number:1,name:'x',scales:[{level:'상',score:3,criterion:''}]}]));});
test('CSV formula injection and quotes are escaped',()=>{assert.equal(C.csvCell('=1+1'),'"\'=1+1"');assert.equal(C.csvCell('a"b'),'"a""b"');});
test('give-up answers keep the rubric score and gain a teacher-check flag',()=>{
  for(const t of ['잘 모르겠어요','모르겠습니다.','몰라요 ㅠㅠ','잘 모름','???','생각이 안 나요']) assert.equal(C.isGiveUpAnswer(t),true,t);
  for(const t of ['순천만 습지는 갈대밭이 넓어서 자랑스럽습니다.','순천만, 갈대, 흑두루미','왜 자랑스러운지는 잘 모르겠지만 순천만에는 철새가 많이 옵니다.','']) assert.equal(C.isGiveUpAnswer(t),false,t);
  const r=[{number:1,name:'내용',scales:[{level:'상',score:3},{level:'중',score:2},{level:'하',score:1}]}];
  const a=C.normalizeAnswer({status:'readable',text:'잘 모르겠어요',criteria:[{number:1,level:'하',score:1,reason:'내용 없음'}],feedback:'',flags:[]},r);
  assert.equal(a.criteria[0].score,1); assert.ok(a.flags.includes('답을 포기한 답안 — 확인 필요'));
  const b=C.normalizeAnswer({status:'readable',text:'순천만 습지는 자랑스럽습니다',criteria:[{number:1,level:'중',score:2,reason:'일부'}],feedback:'',flags:[]},r);
  assert.equal(b.flags.length,0);
});
test('sheet found in the account: marked main wins, a single sheet connects, several ask the teacher',()=>{
  const f=(id,m,main)=>({id,modifiedTime:m,appProperties:main?{egApp:'1',egMain:String(main)}:{}});
  assert.equal(C.chooseSheet([]).auto,null);
  assert.equal(C.chooseSheet([f('a','2026-11-01')]).auto,'a');
  const many=C.chooseSheet([f('a','2026-11-01'),f('b','2026-11-10')]);assert.equal(many.auto,null);assert.deepEqual(many.list.map(x=>x.id),['b','a']);
  assert.equal(C.chooseSheet([f('a','2026-11-01',5),f('b','2026-11-10'),f('c','2026-10-01',9)]).auto,'c');});
