(function(global){
  'use strict';

  const STORE_KEY='coachStatsLiveManualDraftV1';
  const STATS=[['seconds','Temps (min)'],['but','Buts'],['passe','Passes D.'],['tirCadre','Tirs cadrés'],['tirNonCadre','Tirs non cadrés'],['centre','Centres'],['progression','Progressions'],['entree20','Entrées 20 m'],['recup','Récupérations'],['duelWon','Duels gagnés'],['duelLost','Duels perdus']];
  let editor={baseline:null,draft:null,selectedPlayer:'',mode:'collective',dirty:false,conflicts:[],syncStatus:'local',pendingRemovedEventIds:[]};

  const clone=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number=value=>value===''?null:Math.max(0,Math.round(Number(value)||0));
  const current=()=>typeof state!=='undefined'?state:null;
  const api=()=>typeof matchCloudApi==='function'?matchCloudApi():null;
  const canWrite=()=>api()?.matchSyncCapabilities?.()?.canWrite!==false;
  const notify=(type,message)=>(global.CoachStatsNotify?.[type]||console[type==='error'?'error':'log'])(message);
  const eventId=(event,index,matchId)=>event.eventId||event.id||(typeof stableMatchEventId==='function'?stableMatchEventId(matchId,event,index):`manual-${matchId}-${Date.now()}-${index}`);

  function snapshotLive(){
    const source=clone(current());
    source.players=typeof matchPlayersWithIds==='function'?matchPlayersWithIds(source.players,source.teamId,source.team):source.players;
    source.log=(source.log||[]).map((event,index)=>({...event,eventId:eventId(event,index,source.matchId)}));
    source.revision=Number.isSafeInteger(source.liveRevision)?source.liveRevision:0;
    source.entryMode='LIVE';source.status='DRAFT';source.statsSource=source.statsSource||'EVENTS';
    source.statsProvenance=source.statsProvenance||{players:{},opponent:{}};
    return source;
  }
  function persist(){ global.CoachStatsStorage?.setJson(STORE_KEY,editor,{recover:true}); }
  function clearPersisted(){ global.CoachStatsStorage?.remove(STORE_KEY); }
  function setDirty(){editor.dirty=true;editor.conflicts=[];editor.syncStatus='local';persist();renderStatus();}
  function sourceFor(name,key){return editor.draft?.statsProvenance?.players?.[name]?.[key]||'LIVE';}
  function statusText(){
    if(editor.conflicts.length)return `Conflit détecté (${editor.conflicts.length}) · brouillon conservé`;
    if(editor.dirty)return 'Modifications non enregistrées';
    if(editor.syncStatus==='pendingSync')return 'Enregistré localement · synchronisation en attente';
    if(editor.syncStatus==='syncError')return 'Enregistré localement · erreur de synchronisation';
    if(editor.syncStatus==='synced')return 'Enregistré et synchronisé';
    return 'Aucune modification';
  }
  function renderStatus(){const node=document.getElementById('liveManualStatus');if(node){node.textContent=statusText();node.className=`postMatchStatus ${editor.conflicts.length?'conflict':editor.dirty||editor.syncStatus!=='synced'?'dirty':''}`;}}
  function open(){
    if(!canWrite()){notify('error','Vous n’avez pas la permission de modifier les statistiques de cette équipe.');return;}
    const latest=snapshotLive();
    if(editor.dirty&&editor.baseline?.matchId===latest.matchId){
      render();
    }else{
      editor={baseline:clone(latest),draft:clone(latest),selectedPlayer:latest.selected||latest.called?.[0]||'',mode:'collective',dirty:false,conflicts:[],syncStatus:latest.liveManualSyncStatus||'local',pendingRemovedEventIds:[]};
      persist();render();
    }
    showTab('live-manual',document.getElementById('liveManualNav'));
  }
  function back(){showTab('live',document.querySelector('.tt-nav.tabs button[onclick*="live"]'));}
  function setStat(name,key,value){
    const player=editor.draft.players[name]||(editor.draft.players[name]={playerName:name});
    player[key]=key==='seconds'&&value!==''?number(value)*60:number(value);
    const before=editor.baseline.players?.[name]?.[key];
    editor.draft.statsProvenance=editor.draft.statsProvenance||{players:{},opponent:{}};
    editor.draft.statsProvenance.players=editor.draft.statsProvenance.players||{};
    editor.draft.statsProvenance.players[name]=editor.draft.statsProvenance.players[name]||{};
    editor.draft.statsProvenance.players[name][key]=before==null?'MANUAL':'CORRECTED';
    setDirty();renderOrigins();
  }
  function display(player,key){const value=player?.[key];return value==null?'':key==='seconds'?Math.round(value/60):value;}
  function renderOrigins(){document.querySelectorAll('#live-manual [data-player][data-stat]').forEach(input=>{const badge=input.parentElement?.querySelector('.statOrigin');if(badge){const value=sourceFor(input.dataset.player,input.dataset.stat);badge.textContent=value;badge.className=`statOrigin ${value}`;}});}
  function collective(){return `<div class="card"><h2>Tableau collectif</h2><p class="tiny">Les cellules vides restent inconnues. Les changements manuels ne créent aucun événement fictif.</p><div class="postMatchTableWrap"><table class="postMatchTable"><thead><tr><th>Joueuse</th>${STATS.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${(editor.draft.called||[]).map(name=>`<tr><td><button type="button" class="ghost" data-select-player="${esc(name)}">${esc(name)}</button></td>${STATS.map(([key])=>`<td><input type="number" min="0" step="1" inputmode="numeric" data-player="${esc(name)}" data-stat="${key}" value="${esc(display(editor.draft.players?.[name],key))}"><span class="statOrigin ${esc(sourceFor(name,key))}">${esc(sourceFor(name,key))}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;}
  function eventRows(name){
    const playerId=editor.draft.players?.[name]?.playerId;
    const rows=(editor.draft.log||[]).map((event,index)=>({event,index})).filter(({event})=>event.player===name||event.playerId===playerId);
    return rows.map(({event,index})=>`<div class="postMatchEvent"><input data-event-index="${index}" data-event-field="t" value="${esc(event.t||event.minute||'')}" aria-label="Minute"><input data-event-index="${index}" data-event-field="action" value="${esc(event.action||'')}" aria-label="Action"><button type="button" class="bad" data-delete-event="${index}">Supprimer</button><small>ID ${esc(event.eventId)} · ${esc(event.source||'LIVE')}</small></div>`).join('')||'<div class="postMatchEmpty">Aucun événement pour cette joueuse.</div>';
  }
  function individual(){
    const names=editor.draft.called||[];const name=names.includes(editor.selectedPlayer)?editor.selectedPlayer:names[0];editor.selectedPlayer=name||'';const player=editor.draft.players?.[name]||{};
    return `<div class="postMatchShell"><div><div class="card"><h2>${esc(name||'Fiche individuelle')}</h2><div class="postMatchIndividualGrid">${STATS.map(([key,label])=>`<div class="postMatchField"><label>${esc(label)} <span class="statOrigin ${esc(sourceFor(name,key))}">${esc(sourceFor(name,key))}</span></label><input type="number" min="0" step="1" inputmode="numeric" data-player="${esc(name)}" data-stat="${key}" value="${esc(display(player,key))}"></div>`).join('')}</div></div><div class="card"><div class="postMatchToolbar"><h2>Événements</h2><button type="button" class="good" id="liveManualAddEvent">➕ Ajouter un événement</button></div><p class="tiny">Un événement manuel ne modifie jamais automatiquement le score ou les totaux.</p><div class="postMatchEvents">${eventRows(name)}</div></div></div><aside class="card"><h3>Joueuses de la rencontre</h3><div class="postMatchPlayerList">${names.map(item=>`<button type="button" class="postMatchPlayerButton ${item===name?'active':''}" data-select-player="${esc(item)}"><span>${esc(item)}</span><small>${esc(sourceFor(item,'seconds'))}</small></button>`).join('')}</div></aside></div>`;
  }
  function goalWarning(){const playerGoals=Object.values(editor.draft.players||{}).reduce((sum,player)=>sum+(Number(player.but)||0),0);return playerGoals===Number(editor.draft.scoreUs||0)?'':`<div class="card postMatchNotice warn"><b>Score non modifié.</b> Le total des buts joueuses (${playerGoals}) diffère du score Live (${editor.draft.scoreUs||0}). Vérifiez le score dans le Live : aucune correction automatique n’est appliquée.</div>`;}
  function render(){
    const root=document.getElementById('live-manual-editor');if(!root||!editor.draft)return;
    root.innerHTML=`<div class="liveManualHeader"><div><h1>✏️ Saisie manuelle pendant le match</h1><p>Le chronomètre continue. Composition, postes, remplacements et score restent pilotés par le Live.</p></div><button type="button" class="dark" id="liveManualBack">↩ Retour au Live</button></div><div class="postMatchToolbar"><button type="button" class="${editor.mode==='collective'?'good':'ghost'}" data-mode="collective">Tableau collectif</button><button type="button" class="${editor.mode==='individual'?'good':'ghost'}" data-mode="individual">Fiche individuelle</button><span id="liveManualStatus" class="postMatchStatus"></span></div>${editor.conflicts.length?`<div class="card postMatchNotice warn"><b>Conflit de modification.</b> ${editor.conflicts.map(item=>esc(item.target)).join(', ')}. Revenez au Live puis rouvrez l’éditeur pour repartir des données récentes.</div>`:''}${goalWarning()}<div id="liveManualWorkspace">${editor.mode==='collective'?collective():individual()}</div><div class="postMatchActions"><button type="button" class="good" id="liveManualSave">💾 Enregistrer sans interrompre le Live</button><button type="button" class="ghost" id="liveManualDiscard">Annuler les modifications</button><button type="button" class="dark" id="liveManualBackBottom">↩ Retour au Live</button></div>`;
    bind();renderStatus();
  }
  function addEvent(){
    const name=editor.selectedPlayer;if(!name)return;
    const event={eventId:`manual-${editor.draft.matchId}-${Date.now()}`,t:typeof fmt==='function'?fmt(current().elapsed||0):'',player:name,playerId:editor.draft.players?.[name]?.playerId||'',teamId:editor.draft.teamId||'',action:'Événement manuel',ts:Date.now(),source:'MANUAL'};
    editor.draft.log.push(event);setDirty();render();
  }
  function bind(){
    document.querySelectorAll('#live-manual [data-player][data-stat]').forEach(input=>input.addEventListener('input',()=>setStat(input.dataset.player,input.dataset.stat,input.value)));
    document.querySelectorAll('#live-manual [data-select-player]').forEach(button=>button.addEventListener('click',()=>{editor.selectedPlayer=button.dataset.selectPlayer;editor.mode='individual';persist();render();}));
    document.querySelectorAll('#live-manual [data-mode]').forEach(button=>button.addEventListener('click',()=>{editor.mode=button.dataset.mode;persist();render();}));
    document.querySelectorAll('#live-manual [data-event-index][data-event-field]').forEach(input=>input.addEventListener('input',()=>{const event=editor.draft.log[Number(input.dataset.eventIndex)];event[input.dataset.eventField]=input.value;event.correctionSource='CORRECTED';setDirty();}));
    document.querySelectorAll('#live-manual [data-delete-event]').forEach(button=>button.addEventListener('click',async()=>{if(await global.CoachStatsNotify.ask('Supprimer cet événement ?',{danger:true,confirmLabel:'Supprimer'})){editor.draft.log.splice(Number(button.dataset.deleteEvent),1);setDirty();render();}}));
    document.getElementById('liveManualAddEvent')?.addEventListener('click',addEvent);
    document.getElementById('liveManualSave')?.addEventListener('click',saveChanges);
    document.getElementById('liveManualDiscard')?.addEventListener('click',()=>{editor.draft=clone(editor.baseline);editor.dirty=false;editor.conflicts=[];persist();render();});
    document.getElementById('liveManualBack')?.addEventListener('click',back);document.getElementById('liveManualBackBottom')?.addEventListener('click',back);
  }
  async function sync(snapshot,removedEventIds=editor.pendingRemovedEventIds||[]){
    const cloud=api();
    if(!navigator.onLine||!cloud?.matchSavePostMatchTransactional){editor.syncStatus='pendingSync';current().liveManualSyncStatus='pendingSync';persist();save();renderStatus();return false;}
    try{
      const result=await cloud.matchSavePostMatchTransactional(snapshot,{entryMode:'LIVE',nextEventsComplete:false,removedEventIds,deletionStrategy:'PHYSICAL'});
      current().liveRevision=result.revision;current().liveManualSyncStatus='synced';editor.draft.revision=result.revision;editor.baseline.revision=result.revision;editor.syncStatus='synced';editor.pendingRemovedEventIds=[];persist();save();renderStatus();notify('success','Statistiques Live enregistrées et synchronisées ✅');return true;
    }catch(error){
      editor.syncStatus=error?.conflict?'conflict':'syncError';editor.conflicts=error?.conflict?[{target:'revision',...error}]:editor.conflicts;current().liveManualSyncStatus=editor.syncStatus;persist();save();render();notify(error?.conflict?'warn':'error',error?.conflict?'Conflit de révision : vos modifications locales sont conservées.':'Synchronisation impossible : vos modifications locales sont conservées.');return false;
    }
  }
  async function saveChanges(){
    if(!editor.dirty&&editor.syncStatus!=='pendingSync')return;
    const merger=global.CoachPulseLiveManualStatistics;if(!merger){notify('error','Service de fusion Live indisponible.');return;}
    let result;
    try{result=merger.mergeLiveManual({baseline:editor.baseline,draft:editor.draft,latest:snapshotLive()});}catch(error){notify('error',error.message);return;}
    if(!result.ok){editor.conflicts=result.conflicts;persist();render();notify('warn','Conflit détecté : aucune donnée récente du Live n’a été écrasée.');return;}
    const latest=current();latest.players=result.merged.players;latest.log=result.merged.log;latest.statsProvenance=result.merged.statsProvenance;latest.statsSource='MIXED';latest.liveManualSyncStatus='pendingSync';
    save();renderAll();
    const cloudSnapshot=snapshotLive();cloudSnapshot.revision=Number.isSafeInteger(editor.baseline.revision)?editor.baseline.revision:0;cloudSnapshot.entryMode='LIVE';cloudSnapshot.status='DRAFT';
    const currentIds=new Set((cloudSnapshot.log||[]).map(event=>event.eventId));
    const removedEventIds=(editor.baseline?.log||[]).map(event=>event.eventId).filter(id=>id&&!currentIds.has(id));
    editor.baseline=clone(cloudSnapshot);editor.draft=clone(cloudSnapshot);editor.dirty=false;editor.conflicts=[];editor.syncStatus='pendingSync';editor.pendingRemovedEventIds=removedEventIds;persist();render();
    notify('info',navigator.onLine?'Modifications conservées dans le Live · synchronisation en cours…':'Modifications conservées localement · synchronisation au retour en ligne.');
    await sync(cloudSnapshot,removedEventIds);
  }
  function install(){
    const live=document.getElementById('live'),main=document.querySelector('main.page');if(!live||!main||document.getElementById('live-manual'))return;
    const button=document.createElement('button');button.type='button';button.id='liveManualButton';button.className='good liveManualButton';button.textContent='✏️ Saisie manuelle';button.addEventListener('click',open);document.querySelector('#live .chronoControls')?.appendChild(button);
    const section=document.createElement('section');section.id='live-manual';section.className='tab hide';section.innerHTML='<div id="live-manual-editor"></div>';main.appendChild(section);
    const saved=global.CoachStatsStorage?.getJson(STORE_KEY,null);if(saved?.draft&&saved.baseline?.matchId===current()?.matchId)editor={...editor,...saved};
    global.addEventListener('online',()=>{if(editor.syncStatus==='pendingSync'&&editor.baseline?.matchId===current()?.matchId)sync(snapshotLive());});
  }
  global.addEventListener('beforeunload',event=>{if(!editor.dirty)return;event.preventDefault();event.returnValue='';});
  global.CoachPulseLiveManualEditor={install,open,back,saveChanges,getState:()=>clone(editor),clearDraft:clearPersisted};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
