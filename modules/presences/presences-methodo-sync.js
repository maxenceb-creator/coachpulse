(function(){
  "use strict";
  const METHOD_KEY="methodo_events_v24";
  let syncing=false;
  function readMethodoEvents(){
    try{return JSON.parse(localStorage.getItem(METHOD_KEY)||"[]").filter(Boolean);}catch(_){return []}
  }
  function norm(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
  function isSeance(e){return norm(e&&e.type)==="seance";}
  function sessionId(e){return "methodo-"+String(e.id||`${e.date}-${e.title||"seance"}`).replace(/[^a-zA-Z0-9_-]/g,"-");}
  function mapCat(cat){
    const c=String(cat||"").toUpperCase().replace(/\s+/g,"");
    if(c.includes("U19"))return ["U19"];
    if(c.includes("U16")||c.includes("U15")||c.includes("U14"))return ["U14-U15-U16"];
    if(c.includes("U13")||c.includes("U12"))return ["U12-U13"];
    if(c.includes("U11")||c.includes("U10"))return ["U10-U11"];
    if(c.includes("U9")||c.includes("U8"))return ["U8-U9"];
    if(c.includes("U7")||c.includes("U6"))return ["U7"];
    if(c.includes("R1"))return ["R1"];
    return ["U12-U13"];
  }
  function methodoTeamScope(cat){
    try{
      if(typeof presenceScopeFromTeamIds==="function"&&typeof presenceTeamByValue==="function"){
        const teams=mapCat(cat).map(value=>presenceTeamByValue(value)?.teamId).filter(Boolean);
        return presenceScopeFromTeamIds(teams.length?teams:["team-u13-a"]);
      }
    }catch(_){}
    return {categories:mapCat(cat),rawCategories:mapCat(cat),teamId:"",teamIds:[],teamSnapshot:[]};
  }
  function hasSaisie(session){
    return Object.values(session.entries||{}).some(e=>e&&(e.code||Number(e.minutes||0)>0||e.note));
  }
  function syncMethodoSeances(){
    if(syncing)return false;
    if(typeof state==="undefined"||!Array.isArray(state.sessions))return false;
    syncing=true;
    const events=readMethodoEvents().filter(e=>e&&e.date&&isSeance(e));
    const eventIds=new Set(events.map(sessionId));
    let changed=false;
    events.forEach(e=>{
      const id=sessionId(e);
      const scope=methodoTeamScope(e.cat);
      const existing=state.sessions.find(s=>s.id===id);
      if(existing){
        existing.date=e.date;
        existing.type="Séance";
        existing.theme=e.title||"Séance Méthodologie";
        Object.assign(existing, scope);
        existing.source="Méthodologie";
        existing.methodoEventId=e.id;
        existing.note=e.note||"";
        if(existing.duration==null)existing.duration=90;
        if(!existing.entries)existing.entries={};
        changed=true;
      }else{
        state.sessions.unshift({
          id,date:e.date,start:"",end:"",duration:90,type:"Séance",
          theme:e.title||"Séance Méthodologie",
          ...scope,entries:{},
          source:"Méthodologie",methodoEventId:e.id,note:e.note||""
        });
        changed=true;
      }
    });
    const before=state.sessions.length;
    state.sessions=state.sessions.filter(s=>!(s.source==="Méthodologie"&&s.methodoEventId&&!eventIds.has(s.id)&&!hasSaisie(s)));
    if(state.sessions.length!==before)changed=true;
    if(changed){
      if(!state.current||!state.sessions.some(s=>s.id===state.current))state.current=state.sessions[0]?.id||null;
      try{saveNow();renderSessions();renderSaisie();renderLegend();renderDetail(currentSession());}catch(_){}
    }
    syncing=false;
    return changed;
  }
  const oldRenderCalendar=window.renderCalendar||renderCalendar;
  window.renderCalendar=renderCalendar=function(){
    syncMethodoSeances();
    oldRenderCalendar();
  };
  window.addEventListener("storage",e=>{if(e.key===METHOD_KEY&&syncMethodoSeances())try{oldRenderCalendar();}catch(_){}});
  window.addEventListener("message",e=>{if(e.data&&e.data.type==="coachpulse-cloud-updated")setTimeout(()=>{if(syncMethodoSeances())try{oldRenderCalendar();}catch(_){}},50);});
  syncMethodoSeances();
})();
