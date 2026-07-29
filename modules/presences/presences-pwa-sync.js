(function(){
  "use strict";
  function embedded(){try{return window.self!==window.top;}catch(_){return true;}}
  function readCachedPlayers(){try{const central=JSON.parse(localStorage.getItem("coachpulse:centralPlayers")||"[]").filter(Boolean);const manual=JSON.parse(localStorage.getItem("coachpulse:customPlayers")||"[]").filter(Boolean);const by=new Map();manual.concat(central).forEach(p=>{const key=personKey(p)||p.playerId||p.id;if(key)by.set(key,Object.assign({},by.get(key)||{},p))});return Array.from(by.values())}catch(_){return []}}
  function selectedRosterSeason(){
    const active=document.querySelector(".view.active,.page.active,.tab-pane.active,.section.active")?.id||"";
    const id=active==="bilan"?"bilanSeasonFilter":active==="calendrier"?"chargeSeasonFilter":active==="prevention"?"prevSeasonFilter":"presenceSeasonFilter";
    const el=document.getElementById(id)||document.getElementById("presenceSeasonFilter")||document.getElementById("bilanSeasonFilter");
    const value=el?.value||"__current";
    if(value==="__current"){
      try{return window.parent?.CoachPulseCentralData?.currentSeason?.()||presenceCurrentSeason?.()||"2026-2027"}catch(_){return "2026-2027"}
    }
    return value;
  }
  async function readPlayers(){
    const season=selectedRosterSeason();
    try{
      const api=window.parent&&window.parent.CoachPulseCentralData;
      if(api&&typeof api.listPlayers==="function"){
        const filters=season&&season!=="all"?{season}:season==="all"?{season:"all"}:{};
        const players=await api.listPlayers(filters);
        if(Array.isArray(players)&&players.length)return players;
      }
    }catch(_){}
    return [];
  }
  function slug(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"joueuse"}
  function personKey(p){return [p.nom||p.lastName,p.prenom||p.firstName].map(x=>slug(x)).join("|")}
  function teamCategoryFromSubCategory(value){const raw=String(value||"").toUpperCase().replace(/\s+/g,"");if(raw==="R1"||raw.includes("SENIOR")||raw.includes("SÉNIOR"))return "SENIORS";const n=Number((raw.match(/\d+/)||[])[0]||0);if(!n)return "";if(n<=7)return "U7";if(n<=9)return "U9";if(n<=11)return "U11";if(n<=14)return "U13";if(n<=16)return "U16";return "U19"}
  function normalizeCategory(p){const raw=p.categorie||p.category||"";return /^U([1-9]|1[0-9])$/i.test(String(raw).trim())?teamCategoryFromSubCategory(raw):(raw||teamCategoryFromSubCategory(p.subCategory||p.sousCategorie))}
  function normalizeSubCategory(p){return p.subCategory||p.sousCategorie||(/^U([1-9]|1[0-9])$/i.test(String(p.categorie||p.category||"").trim())?p.categorie||p.category:"")}
  function displayUpperName(p){return [p.prenom,p.nom].filter(Boolean).join(" ").toUpperCase()}
  function toPresencePlayer(p,existing){
    const id=p.playerId||p.id||(existing&&existing.id)||("manual-"+slug((p.prenom||p.firstName||"")+"-"+(p.nom||p.lastName||"")));
    const subCategory=normalizeSubCategory(p)||existing?.subCategory||existing?.sousCategorie||existing?.categorie||"";
    return {
      id,
      playerId:p.playerId||p.id||id,
      nom:String(p.nom||p.lastName||existing?.nom||"").toUpperCase(),
      prenom:String(p.prenom||p.firstName||existing?.prenom||"").toUpperCase(),
      annee:p.birth||p.dateNaissance||p.age||existing?.annee||"",
      categorie:normalizeCategory(p)||existing?.categorie||"",
      subCategory,
      sousCategorie:subCategory,
      team:p.team||existing?.team||"",
      teamId:p.teamId||existing?.teamId||"",
      teamIds:Array.isArray(p.teamIds)&&p.teamIds.length?p.teamIds:(Array.isArray(existing?.teamIds)?existing.teamIds:[]),
      photo:p.photo||existing?.photo||"",
      source:"players-central"
    };
  }
  async function mergeCustomPlayers(){
    if(typeof ROSTER==="undefined"||!Array.isArray(ROSTER))return;
    const previousByPerson=new Map(ROSTER.map(p=>[personKey(p),p]));
    const central=await readPlayers();
    if(!central.length)return;
    const next=[];
    const seen=new Set();
    central.forEach(p=>{
      const key=personKey(p);
      if(!key||seen.has(key))return;
      next.push(toPresencePlayer(p,previousByPerson.get(key)));
      seen.add(key);
    });
    ROSTER.splice(0,ROSTER.length,...next);
    playerSubCategory=window.playerSubCategory=function(p){return p?.subCategory||p?.sousCategorie||(/^U([1-9]|1[0-9])$/i.test(String(p?.categorie||"").trim())?p.categorie:"")};
    bindSeasonReload();
    try{renderFilters();renderAll();renderCalendar();}catch(_){}
  }
  function bindSeasonReload(){
    ["presenceSeasonFilter","bilanSeasonFilter","chargeSeasonFilter","prevSeasonFilter"].forEach(id=>{
      const el=document.getElementById(id);
      if(!el||el.dataset.centralPlayersSeasonBound)return;
      el.dataset.centralPlayersSeasonBound="1";
      el.addEventListener("change",()=>setTimeout(mergeCustomPlayers,0));
    });
  }
  function init(){
    if(embedded())document.body.classList.add("embedded-page");
    bindSeasonReload();
    mergeCustomPlayers();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
  window.addEventListener("message",e=>{if(e.data&&(/coachpulse-(players|cloud)-updated/.test(e.data.type||"")))setTimeout(mergeCustomPlayers,50);});
  window.addEventListener("storage",e=>{if(e.key==="coachpulse:customPlayers"||e.key==="coachpulse:centralPlayers")mergeCustomPlayers();});
  window.addEventListener("message",e=>{if(e.data&&e.data.type==="coachpulse-players-updated")mergeCustomPlayers();});
})();
