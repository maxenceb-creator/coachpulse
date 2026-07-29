const TRAINING_CATEGORIES=['U7','U9','U11','U13','U16','U19','SENIORS'];
const CAT_STYLE={'U7':'u7','U8-U9':'u8','U10-U11':'u10','U12-U13':'u12','U12-U13-U14':'u12','U14-U15-U16':'u14','U19':'u19','R1':'r1'};
const CATEGORY_MAP={'U6-U7':['U6','U7'],'U7':['U6','U7'],'U8-U9':['U8','U9'],'U10-U11':['U10','U11'],'U12-U13':['U12','U13'],'U12-U13-U14':['U12','U13','U14'],'U14-U15-U16':['U14','U15','U16'],'U19':['U19'],'R1':['R1']};
const PRESENCE_FALLBACK_TEAMS=[
  {name:'U7 A',category:'U7',subCategories:['U6','U7'],teamId:'team-u7-a'},
  {name:'U9 A',category:'U9',subCategories:['U8','U9'],teamId:'team-u9-a'},
  {name:'U11 A',category:'U11',subCategories:['U10','U11'],teamId:'team-u11-a'},
  {name:'U13 A',category:'U13',subCategories:['U12','U13','U14'],teamId:'team-u13-a'},
  {name:'U13 B',category:'U13',subCategories:['U12','U13'],teamId:'team-u13-b'},
  {name:'U16 A',category:'U16',subCategories:['U15','U16'],teamId:'team-u16-a'},
  {name:'U19',category:'U19',subCategories:['U17','U18','U19'],teamId:'team-u19'},
  {name:'R1',category:'SENIORS',subCategories:['SENIORS'],teamId:'team-r1'}
];
function presenceTeamsService(){try{return window.CoachPulseTeamsService||window.parent?.CoachPulseTeamsService||null}catch(_){return window.CoachPulseTeamsService||null}}
function presenceTrainingTeams(){const service=presenceTeamsService();try{return (service?.officialTeamRows?.()||PRESENCE_FALLBACK_TEAMS).filter(t=>t&&t.teamId)}catch(_){return PRESENCE_FALLBACK_TEAMS}}
function presenceCompactTeamKey(value){return String(value||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'')}
function presenceLegacyTeamName(value){
  const key=presenceCompactTeamKey(value);
  if(key==='U6U7'||key==='U7')return 'U7 A';
  if(key==='U8U9'||key==='U9')return 'U9 A';
  if(key==='U10U11'||key==='U11')return 'U11 A';
  if(key==='U12U13'||key==='U12U13U14'||key==='U13')return 'U13 A';
  if(key==='U14U15U16'||key==='U16')return 'U16 A';
  if(key==='U19')return 'U19';
  if(key==='R1'||key==='SENIORS')return 'R1';
  return '';
}
function presenceTeamByValue(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  const compact=presenceCompactTeamKey(raw);
  const legacy=presenceLegacyTeamName(raw);
  const legacyKey=presenceCompactTeamKey(legacy);
  return presenceTrainingTeams().find(team=>team.teamId===raw||presenceCompactTeamKey(team.name)===compact||presenceCompactTeamKey(team.name)===legacyKey||presenceCompactTeamKey(team.category)===compact||(team.subCategories||[]).some(sub=>presenceCompactTeamKey(sub)===compact))||null;
}
function presenceScopeFromTeamIds(teamIds=[]){
  const teams=[...new Set(teamIds)].map(presenceTeamByValue).filter(Boolean);
  const categories=[...new Set(teams.map(team=>team.category).filter(Boolean))];
  const rawCategories=[...new Set(teams.flatMap(team=>team.subCategories||[]).filter(Boolean))];
  return {
    teamId:teams[0]?.teamId||'',
    teamIds:teams.map(team=>team.teamId),
    teamSnapshot:teams.map(team=>({teamId:team.teamId,name:team.name,category:team.category,subCategories:team.subCategories||[]})),
    categories,
    rawCategories
  };
}
function presenceSessionTeamIds(session){
  const direct=[session?.teamId,...(session?.teamIds||[])].filter(Boolean);
  if(direct.length)return [...new Set(direct.map(value=>presenceTeamByValue(value)?.teamId||value).filter(Boolean))];
  const legacy=[...(session?.rawCategories||[]),...(session?.categories||[])].filter(Boolean);
  return [...new Set(legacy.map(value=>presenceTeamByValue(value)?.teamId).filter(Boolean))];
}
function presenceSessionTeamNames(session){
  const names=presenceSessionTeamIds(session).map(id=>presenceTeamByValue(id)?.name).filter(Boolean);
  return names.length?names:(session?.categories||[]);
}
const ROSTER = [{"id":"sayad-dilya","nom":"SAYAD","prenom":"Dilya","annee":"","categorie":"U11"},{"id":"zenya-amaliya","nom":"ZENYA","prenom":"Amaliya","annee":"","categorie":"U11"},{"id":"mathevon-cilia","nom":"MATHEVON","prenom":"Cilia","annee":"","categorie":"U12"},{"id":"kasperczak-mila","nom":"KASPERCZAK","prenom":"Mila","annee":"","categorie":"U12"},{"id":"celle-collange-rose","nom":"CELLE COLLANGE","prenom":"Rose","annee":"","categorie":"U12"},{"id":"tifra-jade","nom":"TIFRA","prenom":"Jade","annee":"","categorie":"U12"},{"id":"chhan-lola","nom":"CHHAN","prenom":"Lola","annee":"","categorie":"U12"},{"id":"khodja-inaya","nom":"KHODJA","prenom":"Inaya","annee":"","categorie":"U12"},{"id":"nouvet-emma","nom":"NOUVET","prenom":"Emma","annee":"","categorie":"U12"},{"id":"soualmi-anaelle","nom":"SOUALMI","prenom":"Anaëlle","annee":"","categorie":"U12"},{"id":"sadouni-salma","nom":"SADOUNI","prenom":"Salma","annee":"","categorie":"U12"},{"id":"bosser-clara","nom":"BOSSER","prenom":"Clara","annee":"","categorie":"U13"},{"id":"fournier-keira","nom":"FOURNIER","prenom":"Keïra","annee":"","categorie":"U13"},{"id":"el-mouzazi-hana","nom":"EL MOUZAZI","prenom":"Hana","annee":"","categorie":"U13"},{"id":"sbaa-jade","nom":"SBAA","prenom":"Jade","annee":"","categorie":"U13"},{"id":"hay-yi-sary-line","nom":"HAY YI SARY","prenom":"Line","annee":"","categorie":"U13"},{"id":"sadot-jade","nom":"SADOT","prenom":"Jade","annee":"","categorie":"U13"},{"id":"laurent-lysea","nom":"LAURENT","prenom":"Lyséa","annee":"","categorie":"U13"},{"id":"zeboudji-sirine","nom":"ZEBOUDJI","prenom":"Sirine","annee":"","categorie":"U14"},{"id":"mpika-olivia","nom":"MPIKA","prenom":"Olivia","annee":"","categorie":"U14"},{"id":"gaillard-lola","nom":"GAILLARD","prenom":"Lola","annee":"","categorie":"U14"},{"id":"thevenon-maena","nom":"THEVENON","prenom":"Maëna","annee":"","categorie":"U14"},{"id":"barbara-haustete-lea","nom":"BARBARA HAUSTETE","prenom":"Léa","annee":"","categorie":"U14"},{"id":"taghbaloute-dounya","nom":"TAGHBALOUTE","prenom":"Dounya","annee":"","categorie":"U14"},{"id":"bonnefond-maelya","nom":"BONNEFOND","prenom":"Maelya","annee":"","categorie":"U14"},{"id":"faure-ines","nom":"FAURE","prenom":"Ines","annee":"","categorie":"U10"},{"id":"percet-jade","nom":"PERCET","prenom":"Jade","annee":"","categorie":"U11"},{"id":"ligneres-jasmine","nom":"LIGNERES","prenom":"Jasmine","annee":"","categorie":"U11"},{"id":"pol-jasmine","nom":"POL","prenom":"Jasmine","annee":"","categorie":"U11"},{"id":"brun-maxine-heloise","nom":"BRUN","prenom":"Maxine-Héloise","annee":"","categorie":"U11"},{"id":"aktepe-meylin","nom":"AKTEPE","prenom":"Meylin","annee":"","categorie":"U10"},{"id":"bouchakal-naila","nom":"BOUCHAKAL","prenom":"Naïla","annee":"","categorie":"U10"},{"id":"pelardy-salma","nom":"PELARDY","prenom":"Salma","annee":"","categorie":"U10"},{"id":"baik-assia","nom":"BAIK","prenom":"Assia","annee":"","categorie":"U10"},{"id":"sehili-elya","nom":"SEHILI","prenom":"Elya","annee":"","categorie":"U6"},{"id":"soler-louise","nom":"SOLER","prenom":"Louise","annee":"","categorie":"U6"},{"id":"ben-rayana-ilyne","nom":"BEN RAYANA","prenom":"Ilyne","annee":"","categorie":"U6"},{"id":"chelihi-nehlya","nom":"CHELIHI","prenom":"Nehlya","annee":"","categorie":"U6"},{"id":"hernandez-mathilde","nom":"HERNANDEZ","prenom":"Mathilde","annee":"","categorie":"U6"},{"id":"gourguechon-manel","nom":"GOURGUECHON","prenom":"Manel","annee":"","categorie":"U6"},{"id":"hebert-nesrine","nom":"HEBERT","prenom":"Nesrine","annee":"","categorie":"U7"},{"id":"rekkas-ilyana","nom":"REKKAS","prenom":"Ilyana","annee":"","categorie":"U7"},{"id":"salamone-ambre","nom":"SALAMONE","prenom":"Ambre","annee":"","categorie":"U7"},{"id":"mouhli-mayssa","nom":"MOUHLI","prenom":"Mayssa","annee":"","categorie":"U7"},{"id":"bisaccia-elina","nom":"BISACCIA","prenom":"Elina","annee":"","categorie":"U7"},{"id":"pestel-emma","nom":"PESTEL","prenom":"Emma","annee":"","categorie":"U8"},{"id":"sehili-wissem","nom":"SEHILI","prenom":"Wissem","annee":"","categorie":"U8"},{"id":"souchon-lindsay","nom":"SOUCHON","prenom":"Lindsay","annee":"","categorie":"U8"},{"id":"gammoudi-malak","nom":"GAMMOUDI","prenom":"Malak","annee":"","categorie":"U8"},{"id":"danoun-ismahene","nom":"DANOUN","prenom":"Ismahène","annee":"","categorie":"U8"},{"id":"bombard-lisa","nom":"BOMBARD","prenom":"Lisa","annee":"","categorie":"U8"},{"id":"el-mardi-naelle","nom":"EL MARDI","prenom":"Naëlle","annee":"","categorie":"U8"},{"id":"toko-liendra","nom":"TOKO","prenom":"Liendra","annee":"","categorie":"U8"},{"id":"blal-thania","nom":"BLAL","prenom":"Thania","annee":"","categorie":"U9"},{"id":"geneste-eva","nom":"GENESTE","prenom":"Eva","annee":"","categorie":"U9"},{"id":"aissaoui-lyne","nom":"AISSAOUI","prenom":"Lyne","annee":"","categorie":"U9"},{"id":"goutagny-melina","nom":"GOUTAGNY","prenom":"Mélina","annee":"","categorie":"U9"},{"id":"chevalier-leopoldine","nom":"CHEVALIER","prenom":"Léopoldine","annee":"","categorie":"U10"},{"id":"miramand-cayla","nom":"MIRAMAND","prenom":"Cayla","annee":"","categorie":"U11"}];
const CODES={P:{label:'Présente',present:true,absence:false,min:true,color:'green'},R:{label:'Retard',present:true,absence:false,min:true,color:'yellow'},ANJ:{label:'Absence non justifiée',present:false,absence:true,min:false,color:'red'},AJ:{label:'Absence justifiée',present:false,absence:true,min:false,color:'orange'},M:{label:'Malade',present:false,absence:true,min:false,color:'black'},B:{label:'Blessée',present:false,absence:true,min:false,color:'black'},PO:{label:'Pôle Espoir',present:false,absence:true,min:false,color:'purple'},D:{label:'District',present:false,absence:true,min:false,color:'blue'}};
const STATUS_ORDER=['P','R','ANJ','AJ','M','B','PO','D'];
const LEGACY_CODES={PR:'R',AB:'B',AM:'M',AMR:'AJ',PPE:'PO',PPPF:'D','PSS+':'P','PSS-':'P',SA:'AJ'};
function normalizeCode(code){return LEGACY_CODES[code]||code||'P'}
function playerSubCategory(p){return p.subCategory||p.sousCategorie||(/^U([1-9]|1[0-9])$/i.test(String(p.categorie||'').trim())?p.categorie:'')}
function sessionSubCategories(session){const teamSubs=presenceSessionTeamIds(session).flatMap(id=>presenceTeamByValue(id)?.subCategories||[]);return [...new Set((teamSubs.length?teamSubs:(session?.categories||[]).flatMap(c=>CATEGORY_MAP[c]||[c])).filter(Boolean))]}
function playerMatchesSession(p,session){const sessionTeamIds=presenceSessionTeamIds(session);const playerTeamIds=[p.teamId,...(p.teamIds||[])].filter(Boolean);if(sessionTeamIds.length&&playerTeamIds.length&&sessionTeamIds.some(id=>playerTeamIds.includes(id)))return true;const subs=sessionSubCategories(session);return !subs.length || subs.includes(playerSubCategory(p))}
function eligiblePlayers(session){return ROSTER.filter(p=>playerMatchesSession(p,session))}
const INITIAL_EXCEL_STATE = window.PRESENCES_INITIAL_EXCEL_STATE || {sessions:[], current:null};
let state=JSON.parse(localStorage.getItem('presenceSeanceV3_6_Excel')||JSON.stringify(INITIAL_EXCEL_STATE));
state.sessions=(state.sessions||[]).map(s=>{const scope=presenceSessionTeamIds(s).length?presenceScopeFromTeamIds(presenceSessionTeamIds(s)):{};return {...s,...scope,start:s.start||'',end:s.end||'',categories:scope.categories||s.categories||inferCats(s),rawCategories:s.rawCategories||scope.rawCategories||s.categories||inferCats(s),entries:Object.fromEntries(Object.entries(s.entries||{}).map(([pid,e])=>[pid,{...e,code:normalizeCode(e.code)}]))}});
let viewDate=new Date(); let activeCat='Toutes';
function today(){return new Date().toISOString().slice(0,10)}
function inferCats(s){return s.category?[s.category]:['U12-U13']}
function durationFromTimes(start,end){if(!start||!end)return Number(sessionDuration?.value||90);const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);let mins=(eh*60+em)-(sh*60+sm);return mins>0?mins:90}
function saveNow(){localStorage.setItem('presenceSeanceV3_6_Excel',JSON.stringify(state));}
function showView(id,btn){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active')); if(btn){btn.classList.add('active')}else if(event&&event.target){event.target.closest('.tab')?.classList.add('active')} if(id==='planning')renderCalendar(); if(id==='bilan')renderBilan(); if(id==='calendrier')renderHeat(); if(id==='prevention')renderPrevention(); if(id==='saisie')renderAll();}
function categoryChecks(containerId,defaults=[]){const defaultIds=defaults.map(value=>presenceTeamByValue(value)?.teamId||value);document.getElementById(containerId).innerHTML=presenceTrainingTeams().map(team=>`<label class="check"><input type="checkbox" value="${team.teamId}" ${defaultIds.includes(team.teamId)?'checked':''}>${team.name}</label>`).join('')}
function selectedChecks(containerId){return [...document.querySelectorAll(`#${containerId} input:checked`)].map(i=>i.value)}
document.getElementById('sessionDate').value=today();document.getElementById('calDate').value=today();categoryChecks('calCategories',['U13 A']);categoryChecks('sessionCategories',['U13 A']);setDefaultRecurringUntil();
function createSessionFromCalendar(){const date=calDate.value||today(),start=calStart.value,end=calEnd.value,duration=durationFromTimes(start,end),type=calType.value,theme=calTheme.value.trim(),teamIds=selectedChecks('calCategories');createSessionObj({date,start,end,duration,type,theme,...presenceScopeFromTeamIds(teamIds.length?teamIds:['team-u13-a'])});showViewById('saisie')}
function createSession(){const date=sessionDate.value||today(),start=sessionStart.value,end=sessionEnd.value,duration=Number(sessionDuration.value||durationFromTimes(start,end)),type=sessionType.value,theme=sessionTheme.value.trim(),teamIds=selectedChecks('sessionCategories');createSessionObj({date,start,end,duration,type,theme,...presenceScopeFromTeamIds(teamIds.length?teamIds:['team-u13-a'])})}
function createSessionObj(data){const id='s'+Date.now()+Math.floor(Math.random()*999);const entries={};ROSTER.forEach(p=>entries[p.id]={code:'P',minutes:data.duration,note:''});state.sessions.unshift({id,...data,entries});state.current=id;saveNow();renderAll();renderCalendar();renderDetail(state.sessions[0])}
function setDefaultRecurringUntil(){if(!window.recurUntil)return;const d=new Date();d.setMonth(d.getMonth()+3);recurUntil.value=d.toISOString().slice(0,10)}
function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d}
function addMonths(date,months){const d=new Date(date);const day=d.getDate();d.setMonth(d.getMonth()+months);if(d.getDate()!==day)d.setDate(0);return d}
function sessionExistsOn(date,start,teamIds){return state.sessions.some(s=>s.date===date&&s.start===start&&sameCats(presenceSessionTeamIds(s),teamIds))}
function createRecurringAdvanced(){const startDate=calDate.value||today();const until=recurUntil?.value||startDate;const freq=recurFreq?.value||'weekly';const maxCount=Math.max(1,Math.min(120,Number(recurMax?.value||40)));const teamIds=selectedChecks('calCategories');const scope=presenceScopeFromTeamIds(teamIds.length?teamIds:['team-u13-a']);const cats=scope.teamIds;let cur=new Date(startDate+'T00:00:00'),end=new Date(until+'T00:00:00');if(end<cur){alert('La date de fin doit être après la date de départ.');return}let created=0,skipped=0,guard=0;while(cur<=end&&created<maxCount&&guard<160){const ds=cur.toISOString().slice(0,10);if(sessionExistsOn(ds,calStart.value,cats)){skipped++}else{createSessionObj({date:ds,start:calStart.value,end:calEnd.value,duration:durationFromTimes(calStart.value,calEnd.value),type:calType.value,theme:calTheme.value.trim(),...scope,recurrence:freq});created++}cur=freq==='monthly'?addMonths(cur,1):addDays(cur,freq==='biweekly'?14:7);guard++}alert(created+' séance(s) créée(s) · '+skipped+' doublon(s) ignoré(s).');renderCalendar();renderAll()}
function sameCats(a,b){return (a||[]).sort().join('|')===(b||[]).sort().join('|')}
function showViewById(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.textContent.toLowerCase().includes(id==='planning'?'calendrier séances':id==='saisie'?'saisie':id)));renderAll()}
function renderCatChips(){catChips.innerHTML=['Toutes',...presenceTrainingTeams().map(team=>team.teamId)].map(c=>{const label=c==='Toutes'?'Toutes':presenceTeamByValue(c)?.name||c;return `<button class="chip ${activeCat===c?'active':''}" onclick="activeCat='${c}';renderCalendar()">${label}</button>`}).join('')}
function moveMonth(n){viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+n,1);renderCalendar()}function goToday(){viewDate=new Date();renderCalendar()}
function monthSessions(){const y=viewDate.getFullYear(),m=viewDate.getMonth();return state.sessions.filter(s=>{const d=new Date(s.date+'T00:00:00');return d.getFullYear()===y&&d.getMonth()===m&&(activeCat==='Toutes'||sessionMatchesTrainingCategory(s,activeCat))}).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start))}
function renderCalendar(){renderCatChips();monthTitle.textContent=viewDate.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());const y=viewDate.getFullYear(),m=viewDate.getMonth();const first=new Date(y,m,1);const startOffset=(first.getDay()+6)%7;const start=new Date(y,m,1-startOffset);const wds=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];let html=wds.map(w=>`<div class="weekday">${w}</div>`).join('');const sessions=monthSessions();for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const ds=d.toISOString().slice(0,10);const daySessions=sessions.filter(s=>s.date===ds);html+=`<div class="cal-day ${d.getMonth()!==m?'out':''}"><div class="date-num">${d.getDate()}</div>${daySessions.map(s=>eventBtn(s)).join('')}</div>`}calendarGrid.innerHTML=html}
function eventBtn(s){const first=(s.categories||[])[0]||'';return `<button class="event ${CAT_STYLE[first]||''}" onclick="selectSession('${s.id}')"><span>${s.start||''}${s.end?' - '+s.end:''}</span><small>${presenceSessionTeamNames(s).join(' / ')}</small><small>${s.theme||s.type}</small></button>`}
function selectSession(id){state.current=id;saveNow();const s=currentSession();renderDetail(s);renderSessions();renderSaisie()}
function renderDetail(s){if(!s){sessionDetail.innerHTML='<span class="muted">Clique sur une séance du calendrier pour afficher les détails.</span>';return}let pres=0,abs=0,min=0;eligiblePlayers(s).forEach(p=>{const e=s.entries[p.id]||{};const code=normalizeCode(e.code);if(CODES[code]?.present)pres++;if(CODES[code]?.absence)abs++;min+=Number(e.minutes||0)});sessionDetail.innerHTML=`<div class="detail-title">${fmtDate(s.date)}</div><div class="detail-line"><b>Horaire</b><br>${s.start||'—'} ${s.end?'→ '+s.end:''} · ${s.duration} min</div><div class="detail-line"><b>Équipes</b><br>${presenceSessionTeamNames(s).map(c=>`<span class="tag">${c}</span>`).join('')}</div><div class="detail-line"><b>Thème</b><br>${s.theme||s.type||'Sans thème'}</div><div class="detail-line"><b>Bilan rapide</b><br>${pres} présentes · ${abs} absentes · ${min} min de charge</div><button class="btn primary" style="width:100%" onclick="showViewById('saisie')">Ouvrir la feuille de présence</button><button class="btn danger" style="width:100%;margin-top:8px" onclick="deleteCurrentSession()">Supprimer cette séance</button>`}
function deleteCurrentSession(){const s=currentSession();if(!s)return;if(confirm('Supprimer cette séance ?')){state.sessions=state.sessions.filter(x=>x.id!==s.id);state.current=state.sessions[0]?.id||null;saveNow();renderAll();renderCalendar();renderDetail(currentSession())}}
function currentSession(){return state.sessions.find(s=>s.id===state.current)||state.sessions[0]}
function renderSessions(){const box=document.getElementById('sessionList');if(!state.sessions.length){box.innerHTML='<div class="empty">Aucune séance créée.</div>';return}box.innerHTML=state.sessions.map(s=>`<div class="session-item ${s.id===state.current?'active':''}" onclick="selectSession('${s.id}')"><b>${fmtDate(s.date)}</b><br><span class="tag">${s.start||''}${s.end?' - '+s.end:''}</span><span class="tag">${s.duration} min</span><span class="tag">${presenceSessionTeamNames(s).join(' / ')}</span><div class="muted">${s.theme||s.type||'Sans thème'}</div></div>`).join('')}
function renderFilters(){catFilter.innerHTML='<option value="">Toutes catégories joueuses</option>'+[...new Set(ROSTER.map(p=>p.categorie).filter(Boolean))].sort().map(c=>`<option>${c}</option>`).join('');statusFilter.innerHTML='<option value="">Tous statuts</option>'+STATUS_ORDER.map(c=>`<option>${c}</option>`).join('');if(window.bilanCatFilter){bilanCatFilter.innerHTML='<option value="">Toutes catégories de séance</option>'+TRAINING_CATEGORIES.map(c=>`<option>${c}</option>`).join('');bilanSubFilter.innerHTML='<option value="">Toutes catégories joueuses</option>'+[...new Set(ROSTER.map(p=>p.categorie).filter(Boolean))].sort().map(c=>`<option>${c}</option>`).join('');bilanDay.value=bilanDay.value||today();bilanMonth.value=bilanMonth.value||today().slice(0,7)}if(window.chargeCatFilter){chargeCatFilter.innerHTML='<option value="">Toutes catégories de séance</option>'+TRAINING_CATEGORIES.map(c=>`<option>${c}</option>`).join('');chargeSubFilter.innerHTML='<option value="">Toutes catégories joueuses</option>'+[...new Set(ROSTER.map(p=>p.categorie).filter(Boolean))].sort().map(c=>`<option>${c}</option>`).join('');chargeMonthFilter.value=chargeMonthFilter.value||today().slice(0,7)}if(window.prevCatFilter){prevCatFilter.innerHTML='<option value="">Toutes catégories de séance</option>'+TRAINING_CATEGORIES.map(c=>`<option>${c}</option>`).join('');prevSubFilter.innerHTML='<option value="">Toutes catégories joueuses</option>'+[...new Set(ROSTER.map(p=>p.categorie).filter(Boolean))].sort().map(c=>`<option>${c}</option>`).join('');prevWeekFilter.value=prevWeekFilter.value||isoWeekString(new Date())}}
function codeClass(code){return code.replace('+','plus').replace('-','moins')}
function setCode(pid,code){const s=currentSession();if(!s)return;const e=s.entries[pid]||(s.entries[pid]={});e.code=code;if(!CODES[code].min)e.minutes=0;else if(!e.minutes)e.minutes=s.duration;saveNow();renderSaisie();renderDetail(s)}
function setMinutes(pid,val){const s=currentSession();s.entries[pid].minutes=Math.max(0,Number(val||0));saveNow();renderKpis();renderDetail(s)}
function setNote(pid,val){const s=currentSession();s.entries[pid].note=val;saveNow()}
function applyAllPresent(){const s=currentSession();if(!s)return;eligiblePlayers(s).forEach(p=>s.entries[p.id]={...(s.entries[p.id]||{}),code:'P',minutes:s.duration});saveNow();renderSaisie();renderDetail(s)}
function renderSaisie(){const s=currentSession();currentTitle.textContent=s?`Séance du ${fmtDate(s.date)} · ${s.start||''}${s.end?' - '+s.end:''} · ${presenceSessionTeamNames(s).join(' / ')} · ${s.theme||s.type}`:'Aucune séance sélectionnée';if(!s){playersBody.innerHTML='<tr><td colspan="6" class="empty">Crée une séance pour commencer.</td></tr>';renderKpis();return}const q=search.value.toLowerCase(),cf=catFilter.value,sf=statusFilter.value;let list=eligiblePlayers(s).filter(p=>(!cf||p.categorie===cf)&&(`${p.nom} ${p.prenom}`.toLowerCase().includes(q)));if(sf)list=list.filter(p=>normalizeCode(s.entries[p.id]?.code)===sf);playersBody.innerHTML=list.map(p=>{const e=s.entries[p.id]||{code:'P',minutes:s.duration,note:''};e.code=normalizeCode(e.code);const buttons=STATUS_ORDER.map(c=>`<button class="code-btn ${e.code===c?'active':''}" title="${CODES[c].label}" onclick="setCode('${p.id}','${c}')">${c}</button>`).join('');return `<tr><td><div class="player-name">${p.prenom} ${p.nom}</div><div class="muted">${p.annee}</div></td><td>${p.categorie||''}</td><td><span class="pill ${codeClass(e.code)}">${e.code}</span></td><td><div class="quick">${buttons}</div></td><td><input class="mini" type="number" value="${e.minutes||0}" min="0" onchange="setMinutes('${p.id}',this.value)"></td><td><input placeholder="note" value="${escapeHtml(e.note||'')}" onchange="setNote('${p.id}',this.value)"></td></tr>`}).join('')||`<tr><td colspan="6" class="empty">Aucune joueuse ne correspond aux équipes de cette séance : ${presenceSessionTeamNames(s).join(', ')}</td></tr>`;renderKpis()}
function renderKpis(){const s=currentSession();if(!s){kpiPresent.textContent=kpiAbsent.textContent=kpiMinutes.textContent='0';kpiRate.textContent='0%';return}let pres=0,abs=0,min=0;eligiblePlayers(s).forEach(p=>{const e=s.entries[p.id]||{};const c=CODES[normalizeCode(e.code)];if(c?.present)pres++;if(c?.absence)abs++;min+=Number(e.minutes||0)});const total=eligiblePlayers(s).length||1;kpiPresent.textContent=pres;kpiAbsent.textContent=abs;kpiMinutes.textContent=min+' min';kpiRate.textContent=Math.round(pres/total*100)+'%'}
function sessionPassesBilanFilters(s){const cat=bilanCatFilter?.value||'',ptype=bilanPeriodType?.value||'all';if(cat && !(s.categories||[]).includes(cat))return false;const d=s.date||'';if(ptype==='day')return d===(bilanDay?.value||'');if(ptype==='month')return d.slice(0,7)===(bilanMonth?.value||'');if(ptype==='week'){const val=bilanWeek?.value;if(!val)return true;return isoWeekString(new Date(d+'T00:00:00'))===val}return true}
function isoWeekString(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));const week=Math.ceil((((d-yearStart)/86400000)+1)/7);return d.getUTCFullYear()+'-W'+String(week).padStart(2,'0')}
function toggleBilanPeriod(){if(!window.bilanPeriodType)return;const t=bilanPeriodType.value;bilanDay.style.display=t==='day'?'block':'none';bilanMonth.style.display=t==='month'?'block':'none';bilanWeekWrap.style.display=t==='week'?'block':'none'}
function filteredSessions(){return state.sessions.filter(sessionPassesBilanFilters)}
function filteredPlayersForBilan(sessions){const sub=bilanSubFilter?.value||'';let ids=new Set();sessions.forEach(s=>eligiblePlayers(s).forEach(p=>ids.add(p.id)));let players=ROSTER.filter(p=>ids.has(p.id));if(sub)players=players.filter(p=>p.categorie===sub);return players}
function playerStats(){const sessions=filteredSessions();const players=filteredPlayersForBilan(sessions);return players.map(p=>{let pres=0,abs=0,ret=0,bl=0,min=0,total=0;sessions.forEach(s=>{if(!playerMatchesSession(p,s))return;total++;const e=s.entries[p.id]||{};const c=normalizeCode(e.code);if(CODES[c]?.present)pres++;if(CODES[c]?.absence)abs++;if(c==='R')ret++;if(c==='B')bl++;min+=Number(e.minutes||0)});return {...p,pres,abs,ret,bl,min,rate:total?Math.round(pres/total*100):0,total}})}
function renderBilan(){toggleBilanPeriod();const sessions=filteredSessions();const stats=playerStats();sumSessions.textContent=sessions.length;sumPlayers.textContent=stats.length;sumMinutes.textContent=stats.reduce((a,b)=>a+b.min,0)+' min';sumRate.textContent=stats.length?Math.round(stats.reduce((a,b)=>a+b.rate,0)/stats.length)+'%':'0%';const maxMin=Math.max(1,...stats.map(s=>s.min));chargeBars.innerHTML=stats.length?stats.slice().sort((a,b)=>b.min-a.min).slice(0,10).map(s=>bar(`${s.prenom} ${s.nom}`,s.min,maxMin,'min')).join(''):'<div class="empty">Aucune donnée avec ces filtres.</div>';rateBars.innerHTML=stats.length?stats.slice().sort((a,b)=>b.rate-a.rate||b.min-a.min).slice(0,10).map(s=>bar(`${s.prenom} ${s.nom}`,s.rate,100,'%')).join(''):'<div class="empty">Aucune donnée avec ces filtres.</div>';summaryBody.innerHTML=stats.length?stats.sort((a,b)=>b.min-a.min).map(s=>`<tr><td><b>${s.prenom} ${s.nom}</b></td><td>${s.categorie}</td><td>${s.pres}</td><td>${s.abs}</td><td>${s.ret}</td><td>${s.bl}</td><td><b>${s.min} min</b></td><td>${s.rate}%</td></tr>`).join(''):'<tr><td colspan="8" class="empty">Aucune joueuse dans cette sélection.</td></tr>';bilanNotice.textContent=`${sessions.length} séance(s) analysée(s) · ${stats.length} joueuse(s) concernée(s).`}
function bar(name,val,max,suf){return `<div class="bar-row"><b>${name}</b><div class="bar-bg"><div class="bar-fill" style="width:${Math.min(100,val/max*100)}%"></div></div><span>${val}${suf}</span></div>`}
function chargeFilteredSessions(){const cat=chargeCatFilter?.value||'',month=chargeMonthFilter?.value||'';return state.sessions.filter(s=>{if(cat&&!(s.categories||[]).includes(cat))return false;if(month&&(s.date||'').slice(0,7)!==month)return false;return true})}
function chargePlayersForSession(s){const sub=chargeSubFilter?.value||'';let players=eligiblePlayers(s);if(sub)players=players.filter(p=>p.categorie===sub);return players}
function weeklyChargeData(){const sessions=chargeFilteredSessions();const byWeek={};const playerWeeks={};sessions.forEach(s=>{const week=isoWeekString(new Date(s.date+'T00:00:00'));if(!byWeek[week])byWeek[week]={week,minutes:0,sessions:0};byWeek[week].sessions++;chargePlayersForSession(s).forEach(p=>{const e=s.entries[p.id]||{};const mins=Number(e.minutes||0);byWeek[week].minutes+=mins;const key=p.id+'|'+week;if(!playerWeeks[key])playerWeeks[key]={player:p,week,minutes:0};playerWeeks[key].minutes+=mins})});return {sessions,weeks:Object.values(byWeek).sort((a,b)=>a.week.localeCompare(b.week)),playerWeeks:Object.values(playerWeeks)}}
function chargeLevel(mins){if(mins>=360)return '🔴';if(mins>=270)return '🟠';if(mins>=180)return '🟡';return '🟢'}
function renderHeat(){const data=weeklyChargeData();const maxWeek=Math.max(1,...data.weeks.map(w=>w.minutes));chargeSessionCount.textContent=data.sessions.length;chargePeakWeek.textContent=data.weeks.length?Math.max(...data.weeks.map(w=>w.minutes))+' min':'0';chargeAvgWeek.textContent=data.weeks.length?Math.round(data.weeks.reduce((a,b)=>a+b.minutes,0)/data.weeks.length)+' min':'0';weeklyBars.innerHTML=data.weeks.length?data.weeks.map(w=>`<div class="bar-row"><b>${w.week}</b><div class="bar-bg"><div class="bar-fill" style="width:${Math.min(100,w.minutes/maxWeek*100)}%"></div></div><span>${chargeLevel(w.minutes)} ${w.minutes}min</span></div><div class="muted" style="margin:-6px 0 4px 0">${w.sessions} séance(s)</div>`).join(''):'<div class="empty">Aucune séance avec ces filtres.</div>';const watch=data.playerWeeks.filter(x=>x.minutes>=270).sort((a,b)=>b.minutes-a.minutes);chargeWatchCount.textContent=watch.length;watchList.innerHTML=watch.length?watch.slice(0,12).map(x=>`<div class="bar-row"><b>${x.player.prenom} ${x.player.nom}</b><div class="bar-bg"><div class="bar-fill" style="width:${Math.min(100,x.minutes/420*100)}%"></div></div><span>${chargeLevel(x.minutes)} ${x.minutes}min</span></div><div class="muted" style="margin:-6px 0 4px 0">${x.week} · ${x.player.categorie}</div>`).join(''):'<div class="empty">Aucune alerte charge sur la sélection.</div>';const max=Math.max(1,...data.sessions.map(s=>chargePlayersForSession(s).reduce((a,p)=>a+Number((s.entries[p.id]||{}).minutes||0),0)));heat.innerHTML=data.sessions.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(s=>{const m=chargePlayersForSession(s).reduce((a,p)=>a+Number((s.entries[p.id]||{}).minutes||0),0);const level=m>max*.75?4:m>max*.5?3:m>max*.25?2:1;return `<div class="day hot${level}" title="${fmtDate(s.date)} · ${m} min">${new Date(s.date).getDate()}</div>`}).join('')||'<div class="empty">Aucune séance</div>'}
function resetChargeFilters(){if(window.chargeCatFilter)chargeCatFilter.value='';if(window.chargeSubFilter)chargeSubFilter.value='';if(window.chargeMonthFilter)chargeMonthFilter.value='';renderHeat()}

function preventionSessions(){const cat=prevCatFilter?.value||'';return state.sessions.filter(s=>!cat||(s.categories||[]).includes(cat))}
function prevPlayersForSession(s){const sub=prevSubFilter?.value||'';let players=eligiblePlayers(s);if(sub)players=players.filter(p=>p.categorie===sub);return players}
function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d}
function previousIsoWeek(week){if(!week)return'';const [y,w]=week.split('-W').map(Number);const d=new Date(y,0,1+(w-1)*7);const day=d.getDay()||7;const monday=addDays(d,1-day);return isoWeekString(addDays(monday,-7))}
function preventionData(){const target=prevWeekFilter?.value||isoWeekString(new Date());const prev=previousIsoWeek(target);const playerMap={};ROSTER.forEach(p=>playerMap[p.id]={player:p,current:0,previous:0,unavailable:0,statuses:[]});preventionSessions().forEach(s=>{const w=isoWeekString(new Date(s.date+'T00:00:00'));if(w!==target&&w!==prev)return;prevPlayersForSession(s).forEach(p=>{const e=s.entries[p.id]||{};const mins=Number(e.minutes||0);const c=normalizeCode(e.code);if(w===target)playerMap[p.id].current+=mins;if(w===prev)playerMap[p.id].previous+=mins;if(w===target&&['B','M'].includes(c)){playerMap[p.id].unavailable++;playerMap[p.id].statuses.push(c)}})});let players=Object.values(playerMap).filter(x=>x.current||x.previous||x.unavailable);const sub=prevSubFilter?.value||'';if(sub)players=players.filter(x=>x.player.categorie===sub);players=players.map(x=>{const diff=x.current-x.previous;const pct=x.previous?Math.round(diff/x.previous*100):(x.current>0?100:0);let level='ok';if(x.current>=360||pct>=50||x.unavailable)level='red';else if(x.current>=270||pct>=30)level='watch';return {...x,diff,pct,level}});return {target,prev,players}}
function riskLabel(x){if(x.unavailable)return x.statuses.includes('B')?'Blessée':'Malade';if(x.current>=360)return 'Surcharge';if(x.pct>=50)return 'Pic brutal';if(x.current>=270)return 'Charge haute';if(x.pct>=30)return 'Hausse forte';return 'OK'}
function makeSuggestions(data){const red=data.players.filter(x=>x.level==='red');const watch=data.players.filter(x=>x.level==='watch');const unav=data.players.filter(x=>x.unavailable);const avg=data.players.length?Math.round(data.players.reduce((a,b)=>a+b.current,0)/data.players.length):0;const out=[];if(red.length>=3)out.push(['Séance allégée recommandée','Plusieurs joueuses sont en zone rouge : privilégier technique, conservation courte, jeu réduit à intensité contrôlée et récupération active.']);else if(red.length)out.push(['Individualiser la charge','Prévoir un groupe aménagé pour les joueuses en rouge : volume réduit, moins de courses longues, retour au calme plus important.']);if(watch.length>=4)out.push(['Limiter les pics d’intensité','Le groupe présente plusieurs hausses de charge : éviter d’enchaîner trop de séquences longues à haute intensité.']);if(unav.length>=2)out.push(['Prévention blessure / santé','Plusieurs joueuses sont blessées ou malades : adapter les oppositions, limiter les contacts et suivre les retours progressivement.']);if(avg<120&&data.players.length)out.push(['Charge faible possible','La charge moyenne est basse : séance normale possible, avec un bloc intensité si le contexte sportif le permet.']);if(!out.length)out.push(['Séance normale possible','Aucune alerte majeure détectée : tu peux garder une séance complète, en surveillant les ressentis en début d’échauffement.']);return out}
function renderPrevention(){if(!window.prevCatFilter)return;const data=preventionData();const red=data.players.filter(x=>x.level==='red');const watch=data.players.filter(x=>x.level==='watch');const ok=data.players.filter(x=>x.level==='ok');const spikes=data.players.filter(x=>x.pct>=30);const unav=data.players.filter(x=>x.unavailable);riskRedCount.textContent=red.length;riskSpikeCount.textContent=spikes.length;riskUnavailableCount.textContent=unav.length;riskGroupLevel.textContent=red.length?'🔴 Rouge':watch.length?'🟡 Vigilance':'🟢 OK';goodRiskBox.textContent=ok.length?`${ok.length} joueuse(s) en charge maîtrisée sur ${data.target}.`:'Aucune joueuse en zone maîtrisée avec ces filtres.';watchRiskBox.textContent=watch.length?`${watch.length} joueuse(s) à surveiller : charge haute ou hausse supérieure à 30%.`:'Aucune vigilance particulière.';dangerRiskBox.textContent=red.length?`${red.length} alerte(s) rouge : surcharge, pic brutal ou indisponibilité.`:'Aucune alerte rouge.';sessionSuggestions.innerHTML=makeSuggestions(data).map(s=>`<div class="suggestion"><b>${s[0]}</b><span class="muted">${s[1]}</span></div>`).join('');const rows=data.players.filter(x=>x.level!=='ok'||x.unavailable).sort((a,b)=>b.current-a.current||b.pct-a.pct);riskPlayersBody.innerHTML=rows.length?rows.map(x=>`<tr><td><b>${x.player.prenom} ${x.player.nom}</b></td><td>${x.player.categorie}</td><td>${x.current} min</td><td>${x.previous} min</td><td>${x.pct>0?'+':''}${x.pct}%</td><td>${riskLabel(x)}</td></tr>`).join(''):`<tr><td colspan="6" class="empty">Aucune joueuse à surveiller sur ${data.target}.</td></tr>`}
function resetPreventionFilters(){if(window.prevCatFilter)prevCatFilter.value='';if(window.prevSubFilter)prevSubFilter.value='';if(window.prevWeekFilter)prevWeekFilter.value=isoWeekString(new Date());renderPrevention()}

function renderLegend(){legend.innerHTML=Object.entries(CODES).map(([c,d])=>`<div class="legend-item"><span class="pill ${codeClass(c)}">${c}</span> <b>${d.label}</b></div>`).join('')}
function renderAll(){renderSessions();renderSaisie();renderLegend();renderDetail(currentSession());if(window.prevCatFilter)renderPrevention()}
function fmtDate(d){return d?new Date(d+'T00:00:00').toLocaleDateString('fr-FR'):''}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function exportJSON(){download('presence_seances_asse_v3_3.json',JSON.stringify(state,null,2),'application/json')}
function importJSON(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{state=JSON.parse(r.result);state.sessions=(state.sessions||[]).map(s=>{const scope=presenceSessionTeamIds(s).length?presenceScopeFromTeamIds(presenceSessionTeamIds(s)):{};return {...s,...scope,start:s.start||'',end:s.end||'',categories:scope.categories||s.categories||inferCats(s),rawCategories:s.rawCategories||scope.rawCategories||s.categories||inferCats(s),entries:Object.fromEntries(Object.entries(s.entries||{}).map(([pid,e])=>[pid,{...e,code:normalizeCode(e.code)}]))}});saveNow();renderAll();renderCalendar()};r.readAsText(f)}
function exportCSV(){let rows=[['date','debut','fin','teamIds','equipes','categories','type','theme','joueuse','categorie_joueuse','code','minutes','note']];state.sessions.forEach(s=>ROSTER.forEach(p=>{const e=s.entries[p.id]||{};rows.push([s.date,s.start||'',s.end||'',presenceSessionTeamIds(s).join('|'),presenceSessionTeamNames(s).join('|'),(s.categories||[]).join('|'),s.type,s.theme,`${p.prenom} ${p.nom}`,p.categorie,e.code||'',e.minutes||0,e.note||''])}));download('presence_seances_asse_v3_3.csv',rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(';')).join('\n'),'text/csv;charset=utf-8')}
function downloadEmptyCSV(){download('modele_presence_seances_v2.csv','date;debut;fin;teamIds;equipes;categories;type;theme;joueuse;categorie_joueuse;code;minutes;note\n','text/csv')}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function resetAll(){if(confirm('Supprimer toutes les séances enregistrées dans ce navigateur ?')){state={sessions:[],current:null};saveNow();renderAll();renderCalendar()}}


/* ===== V3.9 — correction globale des filtres =====
   - Les filtres ne reposent plus sur les variables globales créées par les id HTML.
   - Les catégories sont filtrées par recouvrement de sous-catégories : ex. U12-U13 matche aussi U12-U13-U14 si besoin.
   - U7 intègre U6 + U7 pour les données Excel importées.
   - Les filtres sont branchés en addEventListener input/change dans tous les onglets.
*/
CATEGORY_MAP['U6-U7']=['U6','U7'];
CATEGORY_MAP['U7']=['U6','U7'];
const qsId=(id)=>document.getElementById(id);
function safeVal(id,def=''){const el=qsId(id);return el?el.value:def}
function setOptions(id,html,previous=''){const el=qsId(id);if(!el)return;el.innerHTML=html;if(previous && [...el.options].some(o=>o.value===previous||o.textContent===previous))el.value=previous}
function categoryToSubs(cat){return [...new Set((CATEGORY_MAP[cat]||[cat]).filter(Boolean))]}
function presenceSeasonFromDate(d){try{return window.parent?.CoachPulseCentralData?.seasonFromDate?.(d)||''}catch(_){const x=new Date((d||'')+'T00:00:00');if(Number.isNaN(x.getTime()))return'';const y=x.getFullYear();return x.getMonth()>=6?`${y}-${y+1}`:`${y-1}-${y}`}}
function presenceCurrentSeason(){try{return window.parent?.CoachPulseCentralData?.currentSeason?.()||presenceSeasonFromDate(new Date().toISOString().slice(0,10))||'2026-2027'}catch(_){return presenceSeasonFromDate(new Date().toISOString().slice(0,10))||'2026-2027'}}
function sessionSeason(s){return s?.season||presenceSeasonFromDate(s?.date)}
function seasonFilterValue(id){const v=safeVal(id,'__current');return v==='__current'?presenceCurrentSeason():v}
function sessionMatchesSeason(s,id){const v=seasonFilterValue(id);return v==='all'||!v||sessionSeason(s)===v}
function ensureSeasonSelect(id,beforeId){if(qsId(id)||!qsId(beforeId))return;qsId(beforeId).insertAdjacentHTML('beforebegin',`<select id="${id}"><option value="__current">Saison courante</option><option value="all">Toutes saisons</option></select>`)}
function seasonOptionsHtml(previous='__current'){const seasons=[...new Set([presenceCurrentSeason(),...state.sessions.map(sessionSeason).filter(Boolean)])].sort();return `<option value="__current" ${previous==='__current'?'selected':''}>Saison courante</option><option value="all" ${previous==='all'?'selected':''}>Toutes saisons</option>`+seasons.map(s=>`<option value="${s}" ${previous===s?'selected':''}>${s}</option>`).join('')}
function sessionSubs(session){
  const teamSubs=presenceSessionTeamIds(session).flatMap(id=>presenceTeamByValue(id)?.subCategories||[]);
  if(teamSubs.length)return [...new Set(teamSubs.filter(Boolean))];
  const raw=[...(session?.rawCategories||[]),...(session?.categories||[])].filter(Boolean);
  return [...new Set(raw.flatMap(c=>CATEGORY_MAP[c]||[c]).filter(Boolean))];
}
function sessionMatchesTrainingCategory(session,cat){
  if(!cat)return true;
  const team=presenceTeamByValue(cat);
  if(team){
    const teamIds=presenceSessionTeamIds(session);
    if(teamIds.length)return teamIds.includes(team.teamId);
  }
  const target=categoryToSubs(cat);
  const subs=sessionSubs(session);
  return !target.length || !subs.length || target.some(x=>subs.includes(x));
}
function playerMatchesSession(p,session){
  const teamIds=presenceSessionTeamIds(session);
  const playerTeamIds=[p.teamId,...(p.teamIds||[])].filter(Boolean);
  if(teamIds.length&&playerTeamIds.length&&teamIds.some(id=>playerTeamIds.includes(id)))return true;
  const subs=sessionSubs(session);
  return !subs.length || subs.includes(playerSubCategory(p));
}
function eligiblePlayers(session){return ROSTER.filter(p=>playerMatchesSession(p,session))}
function monthSessions(){
  const y=viewDate.getFullYear(),m=viewDate.getMonth();
  return state.sessions.filter(s=>{
    const d=new Date((s.date||'')+'T00:00:00');
    return d.getFullYear()===y && d.getMonth()===m && (activeCat==='Toutes'||sessionMatchesTrainingCategory(s,activeCat));
  }).sort((a,b)=>((a.date||'')+(a.start||'')).localeCompare((b.date||'')+(b.start||'')))
}
function sessionPassesBilanFilters(s){
  const cat=safeVal('bilanCatFilter'),ptype=safeVal('bilanPeriodType','all');
  if(!sessionMatchesSeason(s,'bilanSeasonFilter'))return false;
  if(!sessionMatchesTrainingCategory(s,cat))return false;
  const d=s.date||'';
  if(ptype==='day')return d===safeVal('bilanDay');
  if(ptype==='month')return d.slice(0,7)===safeVal('bilanMonth');
  if(ptype==='week'){const val=safeVal('bilanWeek');return !val || isoWeekString(new Date(d+'T00:00:00'))===val}
  return true;
}
function chargeFilteredSessions(){
  const cat=safeVal('chargeCatFilter'),month=safeVal('chargeMonthFilter');
  return state.sessions.filter(s=>{
    if(!sessionMatchesSeason(s,'chargeSeasonFilter'))return false;
    if(!sessionMatchesTrainingCategory(s,cat))return false;
    if(month&&(s.date||'').slice(0,7)!==month)return false;
    return true;
  })
}
function preventionSessions(){
  const cat=safeVal('prevCatFilter');
  return state.sessions.filter(s=>sessionMatchesSeason(s,'prevSeasonFilter')&&sessionMatchesTrainingCategory(s,cat));
}

function playerMatchesTrainingCategoryFilter(p,cat){
  if(!cat)return true;
  const team=presenceTeamByValue(cat);
  if(team){
    const playerTeamIds=[p.teamId,...(p.teamIds||[])].filter(Boolean);
    if(playerTeamIds.length)return playerTeamIds.includes(team.teamId);
  }
  return categoryToSubs(cat).includes(playerSubCategory(p));
}
function filteredPlayersForBilan(sessions){
  const cat=safeVal('bilanCatFilter'),sub=safeVal('bilanSubFilter');
  let ids=new Set();
  sessions.forEach(s=>eligiblePlayers(s).forEach(p=>ids.add(p.id)));
  let players=ROSTER.filter(p=>ids.has(p.id));
  if(cat)players=players.filter(p=>playerMatchesTrainingCategoryFilter(p,cat));
  if(sub)players=players.filter(p=>p.categorie===sub);
  return players;
}
function chargePlayersForSession(s){
  const cat=safeVal('chargeCatFilter'),sub=safeVal('chargeSubFilter');
  let players=eligiblePlayers(s);
  if(cat)players=players.filter(p=>playerMatchesTrainingCategoryFilter(p,cat));
  if(sub)players=players.filter(p=>p.categorie===sub);
  return players;
}
function prevPlayersForSession(s){
  const cat=safeVal('prevCatFilter'),sub=safeVal('prevSubFilter');
  let players=eligiblePlayers(s);
  if(cat)players=players.filter(p=>playerMatchesTrainingCategoryFilter(p,cat));
  if(sub)players=players.filter(p=>p.categorie===sub);
  return players;
}
function renderFilters(){
  const playerCats=[...new Set(ROSTER.map(p=>p.categorie).filter(Boolean))].sort();
  const teams=presenceTrainingTeams();
  ensureSeasonSelect('presenceSeasonFilter','catFilter');
  ensureSeasonSelect('bilanSeasonFilter','bilanCatFilter');
  ensureSeasonSelect('chargeSeasonFilter','chargeCatFilter');
  ensureSeasonSelect('prevSeasonFilter','prevCatFilter');
  const old={
    cat:safeVal('catFilter'),status:safeVal('statusFilter'),presenceSeason:safeVal('presenceSeasonFilter','__current'),
    bilanSeason:safeVal('bilanSeasonFilter','__current'),bilanCat:safeVal('bilanCatFilter'),bilanSub:safeVal('bilanSubFilter'),bilanPeriod:safeVal('bilanPeriodType'),bilanDay:safeVal('bilanDay'),bilanMonth:safeVal('bilanMonth'),bilanWeek:safeVal('bilanWeek'),
    chargeSeason:safeVal('chargeSeasonFilter','__current'),chargeCat:safeVal('chargeCatFilter'),chargeSub:safeVal('chargeSubFilter'),chargeMonth:safeVal('chargeMonthFilter'),
    prevSeason:safeVal('prevSeasonFilter','__current'),prevCat:safeVal('prevCatFilter'),prevSub:safeVal('prevSubFilter'),prevWeek:safeVal('prevWeekFilter')
  };
  setOptions('presenceSeasonFilter',seasonOptionsHtml(old.presenceSeason),old.presenceSeason);
  setOptions('bilanSeasonFilter',seasonOptionsHtml(old.bilanSeason),old.bilanSeason);
  setOptions('chargeSeasonFilter',seasonOptionsHtml(old.chargeSeason),old.chargeSeason);
  setOptions('prevSeasonFilter',seasonOptionsHtml(old.prevSeason),old.prevSeason);
  setOptions('catFilter','<option value="">Toutes catégories joueuses</option>'+playerCats.map(c=>`<option value="${c}">${c}</option>`).join(''),old.cat);
  setOptions('statusFilter','<option value="">Tous statuts</option>'+STATUS_ORDER.map(c=>`<option value="${c}">${c}</option>`).join(''),old.status);
  setOptions('bilanCatFilter','<option value="">Toutes équipes de séance</option>'+teams.map(team=>`<option value="${team.teamId}">${team.name}</option>`).join(''),old.bilanCat);
  setOptions('bilanSubFilter','<option value="">Toutes catégories joueuses</option>'+playerCats.map(c=>`<option value="${c}">${c}</option>`).join(''),old.bilanSub);
  if(qsId('bilanPeriodType')&&old.bilanPeriod)qsId('bilanPeriodType').value=old.bilanPeriod;
  if(qsId('bilanDay'))qsId('bilanDay').value=old.bilanDay||today();
  if(qsId('bilanMonth'))qsId('bilanMonth').value=old.bilanMonth||today().slice(0,7);
  if(qsId('bilanWeek'))qsId('bilanWeek').value=old.bilanWeek||isoWeekString(new Date());
  setOptions('chargeCatFilter','<option value="">Toutes équipes de séance</option>'+teams.map(team=>`<option value="${team.teamId}">${team.name}</option>`).join(''),old.chargeCat);
  setOptions('chargeSubFilter','<option value="">Toutes catégories joueuses</option>'+playerCats.map(c=>`<option value="${c}">${c}</option>`).join(''),old.chargeSub);
  if(qsId('chargeMonthFilter'))qsId('chargeMonthFilter').value=old.chargeMonth||'';
  setOptions('prevCatFilter','<option value="">Toutes équipes de séance</option>'+teams.map(team=>`<option value="${team.teamId}">${team.name}</option>`).join(''),old.prevCat);
  setOptions('prevSubFilter','<option value="">Toutes catégories joueuses</option>'+playerCats.map(c=>`<option value="${c}">${c}</option>`).join(''),old.prevSub);
  if(qsId('prevWeekFilter'))qsId('prevWeekFilter').value=old.prevWeek||isoWeekString(new Date());
  toggleBilanPeriod?.();
}
function installFilterEvents(){
  const map={
    search:renderSaisie,catFilter:renderSaisie,statusFilter:renderSaisie,presenceSeasonFilter:renderSaisie,
    bilanSeasonFilter:renderBilan,bilanCatFilter:renderBilan,bilanSubFilter:renderBilan,bilanPeriodType:()=>{toggleBilanPeriod();renderBilan()},bilanDay:renderBilan,bilanMonth:renderBilan,bilanWeek:renderBilan,
    chargeSeasonFilter:renderHeat,chargeCatFilter:renderHeat,chargeSubFilter:renderHeat,chargeMonthFilter:renderHeat,
    prevSeasonFilter:renderPrevention,prevCatFilter:renderPrevention,prevSubFilter:renderPrevention,prevWeekFilter:renderPrevention
  };
  Object.entries(map).forEach(([id,fn])=>{
    const el=qsId(id); if(!el)return;
    el.oninput=fn; el.onchange=fn;
  });
}
function showView(id,btn){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  qsId(id)?.classList.add('active');
  document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  if(id==='planning')renderCalendar();
  if(id==='saisie')renderSaisie();
  if(id==='bilan')renderBilan();
  if(id==='calendrier')renderHeat();
  if(id==='prevention')renderPrevention();
}
function showViewById(id){
  const btn=[...document.querySelectorAll('.tabs .tab')].find(b=>(b.getAttribute('onclick')||'').includes(`'${id}'`)||(b.getAttribute('onclick')||'').includes(`"${id}"`));
  showView(id,btn||null);
}
function renderAll(){
  renderSessions();renderSaisie();renderLegend();renderDetail(currentSession());
  const active=qsId('bilan')?.classList.contains('active')?'bilan':qsId('calendrier')?.classList.contains('active')?'calendrier':qsId('prevention')?.classList.contains('active')?'prevention':'';
  if(active==='bilan')renderBilan();
  if(active==='calendrier')renderHeat();
  if(active==='prevention')renderPrevention();
}

renderFilters();installFilterEvents();renderAll();renderCalendar();
