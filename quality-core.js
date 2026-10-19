/* Quality metrics describe agreement with teacher references, not universal accuracy. */
(function(root){
  'use strict';
  function signature(result){return JSON.stringify([result.status,...result.criteria.map(c=>[c.number,c.level,c.score]).sort((a,b)=>a[0]-b[0])]);}
  function compare(expected,result){
    const statusMatch=expected.status===result.status;
    const cells=expected.criteria.map(e=>{const a=result.criteria.find(x=>Number(x.number)===e.number);const valid=!!a&&a.score!==null&&Number.isFinite(a.score);return {number:e.number,name:e.name,expected:e.score,expectedLevel:e.level,actual:valid?a.score:null,actualLevel:a?.level||'',match:valid&&a.score===e.score&&a.level===e.level,error:valid?a.score-e.score:null};});
    return {statusMatch,cells,exact:statusMatch&&(expected.status!=='readable'||cells.every(c=>c.match)),scoreable:cells.filter(c=>c.error!==null).length};
  }
  function summarize(report,model){
    let success=0,failed=0,statusMatches=0,exactRuns=0,cellCount=0,cellMatches=0,scoredCells=0,absoluteError=0,signedError=0,latency=0,stable=0,repeatEligible=0,repeatComplete=0;
    const criteria=new Map();
    for(const c of report.cases){
      const runs=c.runs.filter(r=>r.model===model),good=runs.filter(r=>r.status==='success'&&r.result);
      failed+=runs.filter(r=>r.status==='error').length;
      if(report.repetitions>=2){repeatEligible++;if(good.length===report.repetitions){repeatComplete++;if(new Set(good.map(r=>signature(r.result))).size===1)stable++;}}
      for(const r of good){success++;latency+=r.durationMs||0;const cmp=compare(c.expected,r.result);if(cmp.statusMatch)statusMatches++;if(cmp.exact)exactRuns++;
        for(const v of cmp.cells){cellCount++;if(v.match)cellMatches++;if(v.error!==null){scoredCells++;absoluteError+=Math.abs(v.error);signedError+=v.error;}
          const key=c.rubricVersion+'_'+c.question.number+'_'+v.number;const item=criteria.get(key)||{question:c.question.label,criterion:v.name,comparisons:0,matches:0,scored:0,absoluteError:0,signedError:0};item.comparisons++;if(v.match)item.matches++;if(v.error!==null){item.scored++;item.absoluteError+=Math.abs(v.error);item.signedError+=v.error;}criteria.set(key,item);
        }
      }
    }
    return {model,planned:report.cases.length*report.repetitions,success,failed,statusMatches,exactRuns,cellCount,cellMatches,scoredCells,absoluteError,signedError,meanAbsoluteError:scoredCells?absoluteError/scoredCells:null,bias:scoredCells?signedError/scoredCells:null,averageMs:success?latency/success:null,stable,repeatEligible,repeatComplete,criteria:[...criteria.values()]};
  }
  function schedule(report){return report.cases.flatMap((c,ci)=>c.runs.map((r,ri)=>({caseIndex:ci,runIndex:ri,run:r}))).filter(x=>x.run.status==='pending'||x.run.status==='running');}
  const api={signature,compare,summarize,schedule};if(typeof module!=='undefined')module.exports=api;else root.QualityCore=api;
})(typeof window==='undefined'?globalThis:window);
