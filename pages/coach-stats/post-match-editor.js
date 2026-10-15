(function(global){
  'use strict';

  const PLAYER_STATS = [
    ['seconds','Temps (min)'],['but','Buts'],['passe','Passes D.'],['tirCadre','Tirs cadrés'],
    ['tirNonCadre','Tirs non cadrés'],['centre','Centres'],['progression','Progressions'],
    ['entree20','Entrées 20 m'],['recup','Récupérations'],['duelWon','Duels gagnés'],['duelLost','Duels perdus']
  ];
  const OPP_STATS = [
    ['butAdv','Buts adverses'],['tirCadreAdv','Tirs cadrés adv.'],['tirNonCadreAdv','Tirs non cadrés adv.'],
    ['centreAdv','Centres adv.'],['progressionAdv','Progressions adv.'],['entree20Adv','Entrées 20 m adv.'],
    ['recupAdv','Récupérations adv.'],['duelWonAdv','Duels gagnés adv.'],['duelLostAdv','Duels perdus adv.']
  ];
  const STORE_KEY = 'coachStatsPostMatchDraftV1';
  const LEGACY_LIVE_DRAFT_KEY = 'coachStatsLiveManualDraftV1';
  let editor = {draft:null, baseline:null, selectedPlayer:'', dirty:false, conflict:null, mode:'collective', persistenceWarning:false};

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function finiteOrNull(value){ if(value === '' || value == null) return null; const number=Number(value); return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null; }
  function currentPlayers(){ return Array.isArray(global.PLAYER_DB) ? global.PLAYER_DB : (typeof PLAYER_DB !== 'undefined' ? PLAYER_DB : []); }
  function currentMatches(){ return typeof state !== 'undefined' && Array.isArray(state.savedMatches) ? state.savedMatches : []; }
  function notify(type, message){ (global.CoachStatsNotify?.[type] || console[type === 'error' ? 'error' : 'log'])(message); }
  function persistDraft(){
    if(!editor.draft){ global.CoachStatsStorage?.remove(STORE_KEY); return; }
    const wasWarning=editor.persistenceWarning;
    const stored=global.CoachStatsStorage?.setJson(STORE_KEY,{draft:editor.draft,baseline:editor.baseline,selectedPlayer:editor.selectedPlayer,dirty:editor.dirty,conflict:editor.conflict},{recover:true});
    editor.persistenceWarning=stored===false;
    if(editor.persistenceWarning&&!wasWarning)notify('error','Stockage du navigateur saturé : le brouillon n’est conservé qu’en mémoire. Exportez une copie avant de fermer.');
    return stored;
  }
  function loadDraft(){
    const saved=global.CoachStatsStorage?.getJson(STORE_KEY,null);
    if(saved?.draft) editor={...editor,...saved};
  }
  function legacyLiveDraftRaw(){ return global.CoachStatsStorage?.get(LEGACY_LIVE_DRAFT_KEY, '') || ''; }
  function legacyLiveDraftNotice(){
    if(!legacyLiveDraftRaw()) return '';
    return `<div class="card postMatchNotice warn" id="legacyLiveDraftNotice"><b>Ancien brouillon Live manuel détecté.</b> Il est conservé localement et ne sera pas supprimé automatiquement. Exportez-le avant de nettoyer le stockage, ou ouvrez sa copie dans l’éditeur Après-match.<div class="postMatchToolbar" style="margin-top:8px"><button type="button" id="legacyLiveDraftExport">Exporter le brouillon</button><button type="button" class="warn" id="legacyLiveDraftRecover">Ouvrir une copie Après-match</button></div></div>`;
  }
  function recoveryNotice(){
    if(!editor.persistenceWarning)return '';
    return `<div class="card postMatchNotice warn" id="postMatchStorageWarning"><b>Stockage du navigateur saturé.</b> Le brouillon reste disponible tant que cette page est ouverte, mais il n’est pas confirmé comme sauvegardé durablement. Exportez une copie de secours avant de fermer.<div class="postMatchToolbar" style="margin-top:8px"><button type="button" id="postMatchDraftExport">Exporter le brouillon</button><label class="button ghost" for="postMatchDraftImport">Importer une copie</label><input class="hide" type="file" accept="application/json,.json" id="postMatchDraftImport"></div></div>`;
  }
  function exportDraft(){
    if(!editor.draft)return;
    const payload={format:'coachpulse-post-match-draft',version:1,exportedAt:new Date().toISOString(),draft:editor.draft,baseline:editor.baseline,dirty:editor.dirty};
    if(typeof download==='function')download(`coachpulse-brouillon-apres-match-${editor.draft.matchId||new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
  }
  async function importDraft(file){
    try{
      const payload=JSON.parse(await file.text());
      if(payload?.format!=='coachpulse-post-match-draft'||payload?.version!==1||!payload?.draft)throw new Error('Format de brouillon non reconnu.');
      await confirmReplace(()=>{editor.draft=normalizedLoaded(payload.draft);editor.baseline=normalizedLoaded(payload.baseline||payload.draft);editor.dirty=payload.dirty!==false;editor.conflict=null;persistDraft();render();});
    }catch(error){notify('error',error.message||'Import du brouillon impossible.');}
  }
  function exportLegacyLiveDraft(){
    const raw=legacyLiveDraftRaw(); if(!raw)return;
    if(typeof download==='function')download(`coachpulse-brouillon-live-manuel-${new Date().toISOString().slice(0,10)}.json`,raw,'application/json;charset=utf-8');
  }
  async function recoverLegacyLiveDraft(){
    let saved;
    try{saved=JSON.parse(legacyLiveDraftRaw());}catch(_error){notify('error','Le brouillon Live local est illisible. Exportez-le pour diagnostic.');return;}
    if(!saved?.draft){notify('error','Aucune donnée de match récupérable dans ce brouillon.');return;}
    await confirmReplace(()=>{openDraft(saved.draft);editor.dirty=true;persistDraft();render();notify('info','Une copie du brouillon Live est ouverte en Après-match. Le brouillon original reste conservé.');});
  }
  function sourceFor(playerName,key){
    const explicit=editor.draft?.statsProvenance?.players?.[playerName]?.[key];if(explicit)return explicit;
    if(editor.draft?.statsSource==='MIXED')return editor.draft?.entryMode==='LIVE'?'EVENTS':'MANUAL';
    return editor.draft?.statsSource || (editor.draft?.entryMode==='LIVE'?'EVENTS':'MANUAL');
  }
  function markOrigin(playerName,key){
    const draft=editor.draft;
    draft.statsProvenance=draft.statsProvenance||{players:{},opponent:{}};
    draft.statsProvenance.players=draft.statsProvenance.players||{};
    draft.statsProvenance.players[playerName]=draft.statsProvenance.players[playerName]||{};
    const previous=editor.baseline?.players?.[playerName]?.[key];
    draft.statsProvenance.players[playerName][key]=(previous === undefined || previous === null) ? 'MANUAL' : 'CORRECTED';
    draft.statsSource=draft.entryMode==='LIVE'?'MIXED':Object.values(draft.statsProvenance.players).some(row=>Object.values(row).includes('CORRECTED'))?'MIXED':'MANUAL';
  }
  function markDirty(){ editor.dirty=true; editor.conflict=null; persistDraft(); renderStatus(); }
  function statusText(){
    if(editor.conflict) return `Conflit : révision locale ${editor.conflict.expectedRevision ?? '—'}, distante ${editor.conflict.remoteRevision ?? '—'}`;
    return editor.dirty?'Modifications non enregistrées':'Toutes les modifications sont enregistrées';
  }
  function renderStatus(){
    const badge=document.getElementById('postMatchStatus'); if(!badge)return;
    badge.textContent=statusText(); badge.className=`postMatchStatus ${editor.conflict?'conflict':editor.dirty?'dirty':''}`;
    const conflict=document.getElementById('postMatchConflict');
    if(conflict) conflict.classList.toggle('hide',!editor.conflict);
  }
  function newDraft(){
    const now=new Date(); const matchId=typeof createMatchId==='function'?createMatchId():`match-${Date.now()}`;
    const team=typeof state!=='undefined'?state.team:''; const teamId=typeof state!=='undefined'?state.teamId:'';
    return {id:matchId,matchId,team,teamId,date:now.toISOString().slice(0,10),createdAt:now.toISOString(),opponent:'',matchType:'',format:'',system:'',elapsed:null,duration:null,scoreUs:null,scoreThem:null,called:[],lineup:{},bench:[],players:{},opp:{},log:[],events:[],entryMode:'FULL_POST_MATCH',statsSource:'MANUAL',statsProvenance:{players:{},opponent:{}},status:'COMPLETED',revision:0,eventsRevision:0,deletionStrategy:'PHYSICAL',syncStatus:'pendingSync'};
  }
  function normalizedLoaded(raw){
    const draft=clone(raw||{}); draft.matchId=draft.matchId||draft.id; draft.id=draft.id||draft.matchId;
    draft.players=draft.players||{}; draft.opp=draft.opp||{}; draft.called=draft.called||Object.keys(draft.players);
    draft.lineup=draft.lineup||{}; draft.bench=draft.bench||[]; draft.log=clone(draft.log||draft.events||[]);
    draft.log.forEach((event,index)=>{event.eventId=event.eventId||event.id||stableMatchEventId(draft.matchId,event,index);});
    draft.entryMode=draft.entryMode||'FULL_POST_MATCH';
    draft.statsSource=draft.statsSource||(raw?.entryMode==='LIVE'?'EVENTS':'MANUAL');
    draft.statsProvenance=draft.statsProvenance||{players:{},opponent:{}};
    draft.revision=Number.isSafeInteger(draft.revision)?draft.revision:0;
    return draft;
  }
  function openDraft(raw){
    editor.draft=normalizedLoaded(raw||newDraft()); editor.baseline=clone(editor.draft); editor.dirty=false; editor.conflict=null;
    editor.selectedPlayer=editor.draft.called[0]||Object.keys(editor.draft.players)[0]||''; persistDraft(); render();
  }
  function addPlayer(player){
    if(!editor.draft||!player?.name)return;
    const name=player.name; if(!editor.draft.players[name]){
      editor.draft.players[name]={playerId:player.playerId||player.id||'',playerName:name,teamId:player.teamId||editor.draft.teamId||'',team:player.team||editor.draft.team||'',participated:true,seconds:null,playerSnapshot:{playerId:player.playerId||player.id||'',playerName:name,displayName:name,teamId:player.teamId||editor.draft.teamId||'',team:player.team||editor.draft.team||''}};
    }
    if(!editor.draft.called.includes(name))editor.draft.called.push(name);
    editor.selectedPlayer=name; markDirty(); render();
  }
  function removePlayer(name){
    editor.draft.called=editor.draft.called.filter(item=>item!==name); delete editor.draft.players[name];
    Object.keys(editor.draft.lineup||{}).forEach(position=>{if(editor.draft.lineup[position]===name)delete editor.draft.lineup[position]});
    editor.draft.bench=(editor.draft.bench||[]).filter(item=>item!==name);
    if(editor.selectedPlayer===name)editor.selectedPlayer=editor.draft.called[0]||''; markDirty(); render();
  }
  function setPlayerStat(name,key,value){
    const player=editor.draft.players[name]||(editor.draft.players[name]={playerName:name});
    player[key]=key==='seconds'&&value!==''?finiteOrNull(value)*60:finiteOrNull(value); markOrigin(name,key); markDirty(); renderOriginsOnly();
  }
  function displayStat(player,key){ const value=player?.[key]; if(value==null)return''; return key==='seconds'?Math.round(value/60):value; }
  function eventStatKey(event={}){
    const value=String(event.key||event.action||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(/passe decisive|assist/.test(value))return'passe';
    if(/tir.*non.*cadr|non.*cadre/.test(value))return'tirNonCadre';
    if(/tir.*cadr/.test(value))return'tirCadre';
    if(/but/.test(value))return'but';
    if(/centre/.test(value))return'centre';
    if(/progression/.test(value))return'progression';
    if(/entree20|20m/.test(value))return'entree20';
    if(/recup/.test(value))return'recup';
    if(/duel.*gagn|duelwon/.test(value))return'duelWon';
    if(/duel.*perd|duellost/.test(value))return'duelLost';
    return'';
  }
  function adjustEventEffect(event,delta){
    const key=eventStatKey(event);if(!key)return;
    const name=event.player||Object.keys(editor.draft.players||{}).find(playerName=>editor.draft.players[playerName]?.playerId&&editor.draft.players[playerName].playerId===event.playerId);
    if(!name||!editor.draft.players[name]||sourceFor(name,key)!=='EVENTS')return;
    const current=Number(editor.draft.players[name][key]);editor.draft.players[name][key]=Math.max(0,(Number.isFinite(current)?current:0)+delta);
  }
  function refreshConsistency(){
    const eventGoals=(editor.draft.log||[]).filter(event=>eventStatKey(event)==='but'&&!/adv|adverse|opponent/i.test(String(event.side||event.teamSide||event.player||''))).length;
    const score=editor.draft.scoreUs==null?null:Number(editor.draft.scoreUs);editor.draft.consistencyConflicts=Number.isFinite(score)&&score!==eventGoals&&editor.draft.statsSource!=='MANUAL'?[{code:'SCORE_EVENTS_MISMATCH',score,eventGoals}]:[];
  }
  function consistencyNotice(){return editor.draft.consistencyConflicts?.length?'<div class="card postMatchNotice warn"><b>Incohérence détectée.</b> Le score ne correspond plus aux événements But. Le score n’a pas été modifié automatiquement.</div>':'';}
  function updateMeta(key,value){
    if(['scoreUs','scoreThem','duration'].includes(key))editor.draft[key]=finiteOrNull(value);
    else editor.draft[key]=value;
    if(key==='duration')editor.draft.elapsed=value===''?null:finiteOrNull(value)*60;
    if(key==='teamId'){
      const team=(typeof officialTeamById==='function'?officialTeamById(value):null); editor.draft.teamId=value; editor.draft.team=team?.name||'';
    }
    markDirty();
  }
  function playerRows(){
    return editor.draft.called.map(name=>{const player=editor.draft.players[name]||{};return `<tr><td><div class="playerCell"><button type="button" class="ghost" data-select-player="${esc(name)}">${esc(name)}</button><button type="button" class="bad" title="Retirer" data-remove-player="${esc(name)}">×</button></div></td>${PLAYER_STATS.map(([key])=>`<td><input data-player="${esc(name)}" data-stat="${key}" min="0" step="1" inputmode="numeric" type="number" value="${esc(displayStat(player,key))}" aria-label="${esc(name)} ${key}"><span class="statOrigin ${esc(sourceFor(name,key))}">${esc(sourceFor(name,key))}</span></td>`).join('')}</tr>`}).join('');
  }
  function collectiveHTML(){
    return `<div class="card"><div class="postMatchToolbar"><input id="postMatchPlayerSearch" placeholder="Ajouter une joueuse…" aria-label="Rechercher une joueuse"><button type="button" class="good" id="postMatchAddFirst">Ajouter</button></div><div id="postMatchSearchResults"></div></div><div class="card"><h2>Tableau collectif</h2><p class="tiny">Une cellule vide reste inconnue. La saisie d’un total manuel ne crée aucun événement.</p><div class="postMatchTableWrap"><table class="postMatchTable"><thead><tr><th>Joueuse</th>${PLAYER_STATS.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${playerRows()||`<tr><td colspan="${PLAYER_STATS.length+1}"><div class="postMatchEmpty">Ajoutez les joueuses présentes pour commencer la saisie.</div></td></tr>`}</tbody></table></div></div>`;
  }
  function individualHTML(){
    const names=editor.draft.called; const name=names.includes(editor.selectedPlayer)?editor.selectedPlayer:names[0]; editor.selectedPlayer=name||'';
    const player=editor.draft.players[name]||{};
    return `<div class="postMatchShell"><div><div class="card"><h2>${name?esc(name):'Fiche individuelle'}</h2>${name?`<div class="postMatchIndividualGrid">${PLAYER_STATS.map(([key,label])=>`<div class="postMatchField"><label>${esc(label)} <span class="statOrigin ${esc(sourceFor(name,key))}">${esc(sourceFor(name,key))}</span></label><input data-player="${esc(name)}" data-stat="${key}" min="0" step="1" inputmode="numeric" type="number" value="${esc(displayStat(player,key))}"></div>`).join('')}</div>`:'<div class="postMatchEmpty">Sélectionnez une joueuse.</div>'}</div><div class="card"><h2>Événements associés</h2><p class="tiny">Les identifiants existants sont conservés. Seuls les événements réels sont affichés ici.</p><div class="postMatchEvents">${eventRows(name)}</div></div></div><aside class="card"><h3>Joueuses présentes</h3><div class="postMatchPlayerList">${names.map(item=>`<button type="button" class="postMatchPlayerButton ${item===name?'active':''}" data-select-player="${esc(item)}"><span>${esc(item)}</span><small>${esc(sourceFor(item,'seconds'))}</small></button>`).join('')||'<div class="postMatchEmpty">Aucune joueuse</div>'}</div></aside></div>`;
  }
  function eventRows(name){
    const rows=(editor.draft.log||[]).map((event,index)=>({event,index})).filter(({event})=>!name||event.player===name||event.playerId===editor.draft.players[name]?.playerId);
    return rows.map(({event,index})=>`<div class="postMatchEvent"><input data-event-index="${index}" data-event-field="t" value="${esc(event.t||event.minute||'')}" aria-label="Temps de l’événement"><input data-event-index="${index}" data-event-field="action" value="${esc(event.action||'')}" aria-label="Action"><button type="button" class="bad" data-delete-event="${index}">Supprimer</button><small>ID ${esc(event.eventId||event.id)} · ${esc(event.source||'Live')}</small></div>`).join('')||'<div class="postMatchEmpty">Aucun événement associé.</div>';
  }
  function metaHTML(){
    const d=editor.draft; const teams=typeof officialTeams==='function'?officialTeams():[];
    return `<div class="card"><h2>${editor.baseline?.matchId===d.matchId&&currentMatches().some(m=>String(m.matchId||m.id)===String(d.matchId))?'Modifier un match terminé':'Ajouter un match sans Live'}</h2><div class="postMatchMeta"><div class="postMatchField"><label>Équipe *</label><select data-meta="teamId"><option value="">Choisir…</option>${teams.map(team=>`<option value="${esc(team.teamId)}" ${String(team.teamId)===String(d.teamId)?'selected':''}>${esc(team.name)}</option>`).join('')}</select></div><div class="postMatchField"><label>Date</label><input type="date" data-meta="date" value="${esc(String(d.date||d.createdAt||'').slice(0,10))}"></div><div class="postMatchField wide"><label>Adversaire</label><input data-meta="opponent" value="${esc(d.opponent||'')}"></div><div class="postMatchField"><label>Type</label><select data-meta="matchType"><option value="">Inconnu</option>${[['championship','Championnat'],['tournament','Tournoi'],['futsal','Futsal'],['friendly','Amical']].map(([value,label])=>`<option value="${value}" ${d.matchType===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="postMatchField"><label>Format</label><select data-meta="format"><option value="">Inconnu</option><option value="8" ${String(d.format)==='8'?'selected':''}>Foot à 8</option><option value="11" ${String(d.format)==='11'?'selected':''}>Foot à 11</option></select></div><div class="postMatchField"><label>Score CoachPulse</label><input type="number" min="0" data-meta="scoreUs" value="${esc(d.scoreUs??'')}"></div><div class="postMatchField"><label>Score adversaire</label><input type="number" min="0" data-meta="scoreThem" value="${esc(d.scoreThem??'')}"></div><div class="postMatchField"><label>Durée (minutes)</label><input type="number" min="0" data-meta="duration" value="${esc(d.elapsed==null?'':Math.round(d.elapsed/60))}"></div><div class="postMatchField wide"><label>Composition / notes (facultatif)</label><input data-meta="lineupNotes" value="${esc(d.lineupNotes||'')}" placeholder="Postes et temps si connus"></div></div></div>`;
  }
  function render(){
    const root=document.getElementById('post-match-editor'); if(!root||!editor.draft)return;
    root.innerHTML=`${legacyLiveDraftNotice()}<div class="postMatchToolbar"><button type="button" class="good" id="postMatchNew">➕ Ajouter un match sans Live</button><select id="postMatchExisting"><option value="">Modifier un match terminé…</option>${currentMatches().slice().reverse().map(match=>`<option value="${esc(match.matchId||match.id)}">${esc((match.date||match.createdAt||'').slice(0,10))} · ${esc(match.team||'')} ${esc(match.scoreUs??'—')}-${esc(match.scoreThem??'—')} ${esc(match.opponent||'Adversaire')}</option>`).join('')}</select><span id="postMatchStatus" class="postMatchStatus"></span></div><div id="postMatchConflict" class="card postMatchNotice warn hide"><b>Conflit de révision.</b> Vos modifications restent dans ce brouillon.<div class="postMatchToolbar" style="margin-top:8px"><button type="button" id="postMatchReload">Recharger la version distante</button><button type="button" class="warn" id="postMatchKeep">Conserver le brouillon</button></div></div>${consistencyNotice()}${metaHTML()}<div class="card"><div class="postMatchToolbar"><button type="button" class="${editor.mode==='collective'?'good':'ghost'}" data-mode="collective">Tableau collectif</button><button type="button" class="${editor.mode==='individual'?'good':'ghost'}" data-mode="individual">Fiche individuelle</button></div></div><div id="postMatchWorkspace">${editor.mode==='collective'?collectiveHTML():individualHTML()}</div><div class="postMatchActions"><button type="button" class="good" id="postMatchSave">💾 Enregistrer les statistiques</button><button type="button" class="ghost" id="postMatchDiscard">Annuler les modifications</button></div>`;
    if(editor.persistenceWarning)root.insertAdjacentHTML('afterbegin',recoveryNotice());
    if(editor.conflict?.upgradeRequired){
      const conflict=root.querySelector('#postMatchConflict');
      conflict.innerHTML='<b>Ce match utilise un ancien format de sauvegarde.</b> Une mise à jour sécurisée est nécessaire avant de pouvoir enregistrer vos modifications. Aucun événement ne sera modifié pendant cette préparation.<div class="postMatchToolbar" style="margin-top:8px"><button type="button" class="good" id="postMatchPrepare">Préparer la sauvegarde</button><button type="button" class="warn" id="postMatchKeep">Conserver le brouillon</button></div>';
    }
    bind(); renderStatus();
  }
  function renderOriginsOnly(){ document.querySelectorAll('[data-player][data-stat]').forEach(input=>{const badge=input.parentElement?.querySelector('.statOrigin');if(badge){const source=sourceFor(input.dataset.player,input.dataset.stat);badge.textContent=source;badge.className=`statOrigin ${source}`;}}); }
  function bind(){
    document.querySelectorAll('[data-meta]').forEach(input=>input.addEventListener('input',()=>updateMeta(input.dataset.meta,input.value)));
    document.querySelectorAll('[data-player][data-stat]').forEach(input=>input.addEventListener('input',()=>setPlayerStat(input.dataset.player,input.dataset.stat,input.value)));
    document.querySelectorAll('[data-select-player]').forEach(button=>button.addEventListener('click',()=>{editor.selectedPlayer=button.dataset.selectPlayer;editor.mode='individual';persistDraft();render();}));
    document.querySelectorAll('[data-remove-player]').forEach(button=>button.addEventListener('click',async()=>{if(await global.CoachStatsNotify.ask(`Retirer ${button.dataset.removePlayer} de ce match ?`,{danger:true,confirmLabel:'Retirer'}))removePlayer(button.dataset.removePlayer);}));
    document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{editor.mode=button.dataset.mode;render();}));
    document.querySelectorAll('[data-event-index][data-event-field]').forEach(input=>input.addEventListener('input',()=>{const event=editor.draft.log[Number(input.dataset.eventIndex)];adjustEventEffect(event,-1);event[input.dataset.eventField]=input.value;event.correctionSource='CORRECTED';adjustEventEffect(event,1);refreshConsistency();markDirty();}));
    document.querySelectorAll('[data-delete-event]').forEach(button=>button.addEventListener('click',async()=>{if(await global.CoachStatsNotify.ask('Supprimer cet événement ? Cette action sera atomique avec la sauvegarde.',{danger:true,confirmLabel:'Supprimer'})){const[event]=editor.draft.log.splice(Number(button.dataset.deleteEvent),1);adjustEventEffect(event,-1);refreshConsistency();markDirty();render();}}));
    document.getElementById('postMatchNew')?.addEventListener('click',()=>confirmReplace(()=>openDraft(newDraft())));
    document.getElementById('postMatchExisting')?.addEventListener('change',event=>{const match=currentMatches().find(item=>String(item.matchId||item.id)===event.target.value);if(match)confirmReplace(()=>openDraft(match));});
    document.getElementById('postMatchSave')?.addEventListener('click',saveDraft);
    document.getElementById('postMatchDiscard')?.addEventListener('click',()=>{if(editor.baseline)openDraft(editor.baseline);});
    document.getElementById('postMatchReload')?.addEventListener('click',reloadRemote);
    document.getElementById('postMatchPrepare')?.addEventListener('click',prepareHistoricalSave);
    document.getElementById('postMatchKeep')?.addEventListener('click',()=>{editor.conflict=null;persistDraft();renderStatus();});
    document.getElementById('postMatchDraftExport')?.addEventListener('click',exportDraft);
    document.getElementById('postMatchDraftImport')?.addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importDraft(file);});
    document.getElementById('legacyLiveDraftExport')?.addEventListener('click',exportLegacyLiveDraft);
    document.getElementById('legacyLiveDraftRecover')?.addEventListener('click',recoverLegacyLiveDraft);
    const search=document.getElementById('postMatchPlayerSearch'); if(search){search.addEventListener('input',renderSearch);document.getElementById('postMatchAddFirst')?.addEventListener('click',()=>{const first=searchMatches(search.value)[0];if(first)addPlayer(first);});renderSearch();}
  }
  function searchMatches(term){const needle=String(term||'').trim().toLowerCase();return currentPlayers().filter(player=>!editor.draft.called.includes(player.name)&&(!needle||[player.name,player.team,player.category,player.subCategory].join(' ').toLowerCase().includes(needle))).slice(0,8);}
  function renderSearch(){const input=document.getElementById('postMatchPlayerSearch'),results=document.getElementById('postMatchSearchResults');if(!input||!results)return;results.innerHTML=`<div class="postMatchToolbar" style="margin-top:8px">${searchMatches(input.value).map(player=>`<button type="button" class="ghost" data-add-player="${esc(player.name)}">${esc(player.name)}</button>`).join('')}</div>`;results.querySelectorAll('[data-add-player]').forEach(button=>button.addEventListener('click',()=>addPlayer(currentPlayers().find(player=>player.name===button.dataset.addPlayer))));}
  async function confirmReplace(callback){if(editor.dirty&&!await global.CoachStatsNotify.ask('Abandonner les modifications non enregistrées ?',{danger:true,confirmLabel:'Abandonner'}))return;callback();}
  function validate(){const errors=[];if(!editor.draft.teamId)errors.push('Sélectionnez une équipe.');if(!editor.draft.matchId)errors.push('Identifiant du match manquant.');for(const [name,player] of Object.entries(editor.draft.players||{})){const invalid=global.CoachPulseMatchStatistics?.validatePlayerStats(player)||[];if(invalid.length)errors.push(`${name} : valeur statistique invalide.`);}return errors;}
  function localUpsert(draft){const snapshot=clone(draft);snapshot.log=clone(draft.log||[]);snapshot.events=undefined;snapshot.updatedAtIso=new Date().toISOString();ensureSavedMatchIdentity(snapshot);const index=state.savedMatches.findIndex(match=>String(match.matchId||match.id)===String(snapshot.matchId));if(index>=0)state.savedMatches[index]=snapshot;else state.savedMatches.push(snapshot);save();renderAll();return snapshot;}
  async function saveDraft(){
    const errors=validate();if(errors.length){notify('error',errors[0]);return;}
    const api=typeof matchCloudApi==='function'?matchCloudApi():null; const snapshot=clone(editor.draft); snapshot.updatedAtIso=new Date().toISOString(); snapshot.createdAt=snapshot.createdAt||`${snapshot.date||new Date().toISOString().slice(0,10)}T12:00:00.000Z`; snapshot.status='COMPLETED'; snapshot.entryMode=snapshot.entryMode||'FULL_POST_MATCH';
    if(!api?.matchSavePostMatchTransactional||!navigator.onLine){snapshot.syncStatus='pendingSync';editor.draft=localUpsert(snapshot);editor.baseline=clone(editor.draft);editor.dirty=false;const durable=persistDraft();if(durable===false)editor.dirty=true;render();notify(durable===false?'error':'warn',durable===false?'Le brouillon reste ouvert, mais sa sauvegarde durable a échoué. Exportez une copie avant de fermer.':'Match enregistré localement. La synchronisation cloud sera proposée au retour en ligne.');return;}
    try{
      const result=await api.matchSavePostMatchTransactional(snapshot,{entryMode:snapshot.entryMode,nextEventsComplete:true,deletionStrategy:snapshot.deletionStrategy||'PHYSICAL'});
      snapshot.revision=result.revision;snapshot.eventsRevision=result.eventsRevision;snapshot.syncStatus='synced';snapshot.syncedAt=new Date().toISOString();editor.draft=localUpsert(snapshot);editor.baseline=clone(editor.draft);editor.dirty=false;editor.conflict=null;persistDraft();render();notify('success','Match et statistiques enregistrés atomiquement ✅');
    }catch(error){
      snapshot.syncStatus=error?.conflict?'conflict':'syncError';snapshot.syncError=String(error?.message||error);editor.draft=localUpsert(snapshot);editor.dirty=true;editor.conflict=error?.conflict?{expectedRevision:error.expectedRevision??error.expectedEventsRevision,remoteRevision:error.remoteRevision??error.remoteEventsRevision,message:error.message,upgradeRequired:error.upgradeRequired===true}:null;persistDraft();render();notify(error?.conflict?'warn':'error',error?.conflict?`${error.message||'Conflit détecté'} Le brouillon local a été conservé.`:'Échec de la sauvegarde cloud. Le brouillon local est conservé.');
    }
  }
  function mergedReloadedEvents(remoteEvents,localEvents,baselineEvents){
    const id=event=>String(event?.eventId||event?.id||'');
    const localIds=new Set((localEvents||[]).map(id).filter(Boolean));
    const baselineIds=new Set((baselineEvents||[]).map(id).filter(Boolean));
    const merged=new Map((localEvents||[]).map(event=>[id(event),clone(event)]).filter(([eventId])=>eventId));
    (remoteEvents||[]).forEach(event=>{const eventId=id(event);if(eventId&&!localIds.has(eventId)&&!baselineIds.has(eventId))merged.set(eventId,clone(event));});
    return [...merged.values()];
  }
  async function prepareHistoricalSave(){
    const api=typeof matchCloudApi==='function'?matchCloudApi():null;
    if(!api?.matchPrepareHistoricalEventsRevision||!api?.matchListFromFirestore){notify('error','Préparation sécurisée indisponible. Le brouillon reste conservé.');return;}
    const local=clone(editor.draft);const baseline=clone(editor.baseline||editor.draft);
    try{
      await api.matchPrepareHistoricalEventsRevision(local);
      const matches=await api.matchListFromFirestore({teamId:local.teamId});
      const remote=matches.find(match=>String(match.matchId||match.id)===String(local.matchId));
      if(!remote||!Number.isSafeInteger(remote.eventsRevision))throw new Error('Le match préparé n’a pas pu être rechargé intégralement.');
      local.log=mergedReloadedEvents(remote.log||remote.events||[],local.log||[],baseline.log||[]);
      local.revision=remote.revision;local.eventsRevision=remote.eventsRevision;local.syncStatus='pendingSync';
      editor.draft=local;editor.baseline=normalizedLoaded(remote);editor.dirty=true;editor.conflict=null;persistDraft();render();
      notify('success','Sauvegarde préparée sans modifier les événements. Vérifiez puis enregistrez à nouveau.');
    }catch(error){
      editor.draft=local;editor.baseline=baseline;editor.dirty=true;editor.conflict={expectedRevision:error?.expectedRevision,remoteRevision:error?.remoteRevision,message:error?.message,upgradeRequired:true};persistDraft();render();notify('error',`${error?.message||'Préparation impossible.'} Le brouillon local a été conservé.`);
    }
  }
  async function reloadRemote(){
    const api=typeof matchCloudApi==='function'?matchCloudApi():null;if(!api?.matchListFromFirestore)return;
    try{const matches=await api.matchListFromFirestore({teamId:editor.draft.teamId});const remote=matches.find(match=>String(match.matchId||match.id)===String(editor.draft.matchId));if(!remote)throw new Error('Version distante introuvable.');openDraft(remote);notify('success','Version distante rechargée.');}catch(error){notify('error',error.message||'Rechargement impossible.');}
  }
  function install(){
    const nav=document.querySelector('.tt-nav.tabs'); const main=document.querySelector('main.page'); if(!nav||!main||document.getElementById('post-match'))return;
    const button=document.createElement('button');button.type='button';button.className='postMatchNav';button.innerHTML='<span class="nav-ico">✏️</span><span>Après-match</span>';button.addEventListener('click',()=>showTab('post-match',button));nav.appendChild(button);
    const section=document.createElement('section');section.className='tab hide';section.id='post-match';section.innerHTML='<div id="post-match-editor"></div>';main.appendChild(section);
    const prepTools=document.querySelector('#prep .matchSaveBox .tools');if(prepTools){const quick=document.createElement('button');quick.type='button';quick.className='good';quick.textContent='➕ Ajouter un match sans Live';quick.addEventListener('click',()=>{openDraft(newDraft());showTab('post-match',button);});prepTools.prepend(quick);}
    loadDraft();if(!editor.draft)openDraft(newDraft());else render();
  }
  function editMatch(matchId){
    const match=currentMatches().find(item=>String(item.matchId||item.id)===String(matchId));
    if(!match){notify('error','Match introuvable dans l’historique.');return;}
    confirmReplace(()=>{
      openDraft(match);
      const button=document.querySelector('.postMatchNav');
      if(button&&typeof showTab==='function')showTab('post-match',button);
    });
  }
  global.addEventListener('beforeunload',event=>{if(!editor.dirty)return;event.preventDefault();event.returnValue='';});
  global.CoachPulsePostMatchEditor={install,openDraft,newDraft,editMatch,getState:()=>clone(editor)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
