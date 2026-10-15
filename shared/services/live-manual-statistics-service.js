// Pure three-way merge used by the in-match manual statistics editor.
// It only changes explicit statistic/event edits and preserves every newer Live field.

(function(global){
  'use strict';

  const PLAYER_STAT_KEYS = Object.freeze([
    'seconds','but','passe','tirCadre','tirNonCadre','centre','progression',
    'entree20','recup','duelWon','duelLost'
  ]);

  function clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function equal(left,right){ return JSON.stringify(left) === JSON.stringify(right); }
  function eventId(event){ return String(event?.eventId || event?.id || '').trim(); }
  function eventMap(events=[]){
    const map=new Map();
    for(const event of events){
      const id=eventId(event);
      if(!id) throw new TypeError('Un événement sans identifiant stable ne peut pas être fusionné.');
      if(map.has(id)) throw new TypeError(`Identifiant d’événement dupliqué : ${id}.`);
      map.set(id,event);
    }
    return map;
  }
  function conflict(target,details){ return {target,...details}; }

  function mergeLiveManual({baseline={},draft={},latest={}}={}){
    const merged=clone(latest);
    merged.players=merged.players||{};
    merged.log=clone(latest.log||[]);
    merged.statsProvenance=clone(latest.statsProvenance||{players:{},opponent:{}});
    merged.statsProvenance.players=merged.statsProvenance.players||{};
    const conflicts=[];

    const names=new Set([...Object.keys(baseline.players||{}),...Object.keys(draft.players||{})]);
    for(const name of names){
      const before=baseline.players?.[name]||{};
      const edited=draft.players?.[name]||{};
      for(const key of PLAYER_STAT_KEYS){
        if(equal(before[key],edited[key])) continue;
        const current=latest.players?.[name]?.[key];
        if(!equal(current,before[key]) && !equal(current,edited[key])){
          conflicts.push(conflict(`players.${name}.${key}`,{baseline:clone(before[key]),draft:clone(edited[key]),latest:clone(current)}));
          continue;
        }
        merged.players[name]=merged.players[name]||{playerName:name};
        merged.players[name][key]=clone(edited[key]);
        merged.statsProvenance.players[name]=merged.statsProvenance.players[name]||{};
        merged.statsProvenance.players[name][key]=before[key] == null ? 'MANUAL' : 'CORRECTED';
      }
    }

    const beforeEvents=eventMap(baseline.log||[]), editedEvents=eventMap(draft.log||[]), latestEvents=eventMap(latest.log||[]);
    const output=new Map([...latestEvents.entries()].map(([id,event])=>[id,clone(event)]));
    for(const [id,event] of editedEvents){
      const before=beforeEvents.get(id), current=latestEvents.get(id);
      if(before && equal(before,event)) continue;
      if(!before){
        if(current && !equal(current,event)) conflicts.push(conflict(`events.${id}`,{baseline:null,draft:clone(event),latest:clone(current)}));
        else output.set(id,clone(event));
        continue;
      }
      if(!current || (!equal(current,before) && !equal(current,event))){
        conflicts.push(conflict(`events.${id}`,{baseline:clone(before),draft:clone(event),latest:clone(current)}));
      }else output.set(id,{...clone(event),correctionSource:'CORRECTED'});
    }
    for(const [id,before] of beforeEvents){
      if(editedEvents.has(id)) continue;
      const current=latestEvents.get(id);
      if(!current) continue;
      if(!equal(current,before)) conflicts.push(conflict(`events.${id}`,{baseline:clone(before),draft:null,latest:clone(current)}));
      else output.delete(id);
    }
    merged.log=[...output.values()];
    merged.statsSource='MIXED';
    return {ok:conflicts.length===0,merged,conflicts};
  }

  const service={PLAYER_STAT_KEYS,mergeLiveManual};
  global.CoachPulseLiveManualStatistics=service;
  if(typeof module!=='undefined'&&module.exports)module.exports=service;
})(typeof window!=='undefined'?window:globalThis);
