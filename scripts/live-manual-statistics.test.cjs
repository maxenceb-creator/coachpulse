const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Merge=require('../shared/services/live-manual-statistics-service.js');

const root=path.resolve(__dirname,'..');
const editor=fs.readFileSync(path.join(root,'pages/coach-stats/live-manual-editor.js'),'utf8');
const html=fs.readFileSync(path.join(root,'pages/coach-stats.html'),'utf8');

function fixture(){
  return {
    matchId:'live-1',elapsed:60,running:true,phase:'1ère période',scoreUs:1,scoreThem:0,
    lineup:{GB:'Alice'},bench:['Bea'],players:{Alice:{but:1,recup:0,seconds:60},Bea:{but:0,recup:0,seconds:0}},
    log:[{eventId:'goal-1',player:'Alice',action:'But',t:'01:00',source:'LIVE'}],statsProvenance:{players:{},opponent:{}}
  };
}

assert.match(html,/live-manual-statistics-service\.js\?v=236/);
assert.match(html,/live-manual-editor\.js\?v=236/);
assert.match(editor,/✏️ Saisie manuelle/);
assert.match(editor,/entryMode='LIVE'/);
assert.match(editor,/status='DRAFT'/);
assert.match(editor,/nextEventsComplete:false/);
assert.match(editor,/removedEventIds/);
assert.match(editor,/beforeunload/);
assert.doesNotMatch(editor,/state\.running\s*=/);
assert.doesNotMatch(editor,/state\.lineup\s*=/);
assert.doesNotMatch(editor,/state\.scoreUs\s*=/);

{
  const baseline=fixture(),draft=structuredClone(baseline),latest=structuredClone(baseline);
  draft.players.Alice.recup=2;
  latest.elapsed=75;latest.players.Alice.seconds=75;latest.lineup={GB:'Bea'};latest.bench=['Alice'];
  latest.log.push({eventId:'shot-2',player:'Bea',action:'Tir cadré',source:'LIVE'});
  const result=Merge.mergeLiveManual({baseline,draft,latest});
  assert.equal(result.ok,true);
  assert.equal(result.merged.players.Alice.recup,2);
  assert.equal(result.merged.players.Alice.seconds,75);
  assert.equal(result.merged.elapsed,75);
  assert.deepEqual(result.merged.lineup,{GB:'Bea'});
  assert.equal(result.merged.log.length,2);
}

{
  const baseline=fixture(),draft=structuredClone(baseline),latest=structuredClone(baseline);
  draft.players.Alice.recup=2;latest.players.Alice.recup=3;
  const result=Merge.mergeLiveManual({baseline,draft,latest});
  assert.equal(result.ok,false);assert.equal(result.conflicts[0].target,'players.Alice.recup');
}

{
  const baseline=fixture(),draft=structuredClone(baseline),latest=structuredClone(baseline);
  draft.log[0].t='01:03';latest.log.push({eventId:'live-new',player:'Bea',action:'Récupération',source:'LIVE'});
  draft.log.push({eventId:'manual-new',player:'Alice',action:'Observation',source:'MANUAL'});
  const result=Merge.mergeLiveManual({baseline,draft,latest});
  assert.equal(result.ok,true);assert.equal(result.merged.log.length,3);
  assert.equal(result.merged.log.find(event=>event.eventId==='goal-1').correctionSource,'CORRECTED');
}

{
  const baseline=fixture(),draft=structuredClone(baseline),latest=structuredClone(baseline);
  draft.log=[];latest.log[0].action='But corrigé par le Live';
  const result=Merge.mergeLiveManual({baseline,draft,latest});
  assert.equal(result.ok,false);assert.equal(result.merged.log.length,1);
}

console.log('Live manual statistics checks passed: safe merge, concurrent Live preservation, explicit conflicts and UI wiring.');
