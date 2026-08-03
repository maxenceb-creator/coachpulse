(function(){
  "use strict";
  const COLORS={
    tactique:"#00843D",technique:"#2563eb",cpa:"#C8A44D",mental:"#7c3aed",
    athle:"#ea580c",match:"#dc2626",transition:"#0891b2",attaque:"#16a34a",
    defense:"#0f766e",jeu:"#00843D",test:"#ca8a04"
  };
  function safe(v){
    try{return typeof esc==="function"?esc(v):String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
    catch(_){return "";}
  }
  function norm(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function colorFor(text){
    const t=norm(text);
    if(t.includes("cpa")||t.includes("arrete"))return COLORS.cpa;
    if(t.includes("mental")||t.includes("attitude")||t.includes("confiance"))return COLORS.mental;
    if(t.includes("athlet")||t.includes("vitesse")||t.includes("coordination")||t.includes("endurance"))return COLORS.athle;
    if(t.includes("technique")||t.includes("conduite")||t.includes("passe")||t.includes("controle"))return COLORS.technique;
    if(t.includes("transition"))return COLORS.transition;
    if(t.includes("sans ballon")||t.includes("defens")||t.includes("s'opposer")||t.includes("opposer"))return COLORS.defense;
    if(t.includes("avec ballon")||t.includes("atta")||t.includes("conserver")||t.includes("deséquilibrer")||t.includes("desequilibrer"))return COLORS.attaque;
    if(t.includes("match"))return COLORS.match;
    if(t.includes("test"))return COLORS.test;
    return COLORS.tactique;
  }
  function bgFor(color){return "color-mix(in srgb, "+color+" 11%, #fff)";}
  function card(title, body, note){
    const c=colorFor(title+" "+body+" "+note);
    return `<div class="v37-color-card" style="--v37-color:${c};--v37-bg:${bgFor(c)}"><span class="v37-kicker">Thème</span><b>${safe(title)}</b><div class="tiny">${safe(body)}</div>${note?`<div class="tiny">${safe(note)}</div>`:""}</div>`;
  }
  window.renderAdn=function(){
    const a=(window.DATA||DATA).adn, el=document.getElementById("adnContent");
    if(!el||!a)return;
    el.innerHTML=`<div class="card"><h2>ADN de jeu</h2><div class="v37-value-row">${(a.values||[]).map(v=>`<span class="v37-value-chip" style="--v37-color:${colorFor(v)}">${safe(v)}</span>`).join("")}</div></div><div class="v37-color-grid" style="margin-top:10px">${(a.avec||[]).map(x=>card(x.title,x.precision,x.note)).join("")}${(a.sans||[]).map(x=>card(x.title,x.precision,"Sans ballon")).join("")}</div>`;
  };
  window.renderBehaviors=function(){
    const data=(window.DATA||DATA).behaviors, el=document.getElementById("behaviorsContent");
    if(!el||!data)return;
    const phases=(data.phases||[]).map(p=>{
      const c=colorFor(p.phase);
      return `<div class="v37-color-card v37-behavior-section" style="--v37-color:${c};--v37-bg:${bgFor(c)}"><span class="v37-kicker">Attendu</span><h3>${safe(p.phase)}</h3><div class="v37-behavior-list">${(p.items||[]).map(i=>`<div class="v37-behavior-item"><b>${safe(i.label)}</b><div class="tiny">${safe(i.value)}</div></div>`).join("")}</div></div>`;
    }).join("");
    const mental=`<div class="card"><h3>Mental</h3><div class="v37-value-row">${(data.mental||[]).map(x=>`<span class="v37-value-chip" style="--v37-color:${colorFor(x+" mental")}">${safe(x)}</span>`).join("")}</div></div>`;
    el.innerHTML=phases+mental;
  };
  function embedded(){try{return window.self!==window.top;}catch(_){return true;}}
  function init(){
    if(embedded())document.body.classList.add("embedded-page");
    try{window.renderAdn();window.renderBehaviors();}catch(_){}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
  window.addEventListener("load",()=>setTimeout(init,250));
})();
