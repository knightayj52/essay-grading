module.exports=()=>({title:'4학년 2학기 사회 총괄평가',plan:'단원마다 한 문항',not_covered:'',questions:[
 {label:'1',standards:['[4사08-01]','[4사08-02]'],eval_element:'민주주의와 주민 참여 설명하기',material:{intro:'다음 글을 읽고 물음에 답하시오.',text:'가람 마을 주민들은 마을 회관에 모여 놀이터를 어떻게 고칠지 회의를 열었습니다.\n주민들은 투표를 했고 표를 적게 얻은 의견도 살렸습니다.'},prompt:'다음 두 가지를 쓰시오.',conditions:[],
  elements:[{slot:'민주주의를 실천한 모습 (1가지)',lines:2,name:'민주주의 실천 모습',accept:['모여서 회의함','투표로 정함','적은 표를 얻은 의견도 반영함'],reject:['놀이터가 낡았다']},{slot:'주민이 참여해서 좋은 점 (1가지)',lines:2,name:'참여의 좋은 점',accept:['쓰는 사람의 필요가 반영됨','결과를 잘 따름'],reject:[]}],
  model_answer:['누구나 의견을 말하고 투표로 정했다.','놀이터를 쓰는 사람들의 생각이 반영된다.'],feedback:{상:'잘했어요',중:'하나 더',하:'다시 읽어 봐요'},grading_notes:['두 칸에 같은 내용이면 한 번만 인정']},
 {label:'2',standards:['[4사09-01]'],material:{intro:'다음 자료를 보고 물음에 답하시오.',text:'시간 | 오전 | 낮\n세워진 차 | 21대 | 6대'},prompt:'다음 세 가지를 쓰시오.',conditions:['까닭에는 자료에 나온 내용을 넣어 쓸 것.'],
  elements:[{slot:'원인',lines:2,name:'원인',accept:['내려 줄 곳이 없음','주차장이 멂']},{slot:'해결 방안',lines:2,name:'방안',accept:['내려 주는 곳 만들기']},{slot:'까닭',lines:3,name:'까닭',accept:['자료의 내용이 1개 이상 들어감']}],model_answer:['내려 줄 곳이 없다.','내려 주는 곳을 만든다.','아침에 차가 가장 많기 때문이다.']},
 {label:'3',standards:['[4사10-01]'],material:{intro:'표를 보고 답하시오.',text:'바닷가 | 갯벌 | 항구'},prompt:'다음 세 가지를 쓰시오.',conditions:[],
  elements:[{slot:'좋아진 점',name:'좋아진 점',accept:['관광객이 늘어남']},{slot:'문제점',name:'문제점',accept:['철새가 줄어듦']},{slot:'내 생각',name:'생각',accept:['주민의 생활과 자연이 둘 다 들어감']}],model_answer:['관광객이 늘었다.','철새가 줄었다.','갯벌 체험장으로 쓴다.']}],
 level_profile:{A:'a',B:'b',C:'c'}});
