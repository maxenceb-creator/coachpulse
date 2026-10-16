(function(global){
  'use strict';

  const CURRENT_WRITE_PROTOCOL = 2;
  const RELEASE_URL = './release.json';
  const CHECK_TTL_MS = 60 * 1000;
  const BACKUP_KEYS = /(?:draft|pending|offline|unsynced|coachStatsV170|presenceEvents)/i;
  let lastCheck = 0;
  let cachedResult = null;
  let pendingCheck = null;

  function protocolError(minimum){
    return Object.assign(new Error(`Cette version de CoachPulse utilise le protocole d’écriture ${CURRENT_WRITE_PROTOCOL}, mais la version ${minimum} est maintenant requise. Vos brouillons restent stockés sur cet appareil.`), {
      code:'CLIENT_WRITE_PROTOCOL_OBSOLETE',
      clientWriteProtocol:CURRENT_WRITE_PROTOCOL,
      minimumWriteProtocol:minimum,
      obsoleteClient:true
    });
  }

  function collectLocalBackup(){
    const items = {};
    try{
      for(let index=0; index<global.localStorage.length; index += 1){
        const key = global.localStorage.key(index);
        if(key && BACKUP_KEYS.test(key)) items[key] = global.localStorage.getItem(key);
      }
    }catch(error){ items.backupError = String(error?.message || error); }
    return {format:'coachpulse-local-write-backup', version:1, exportedAt:new Date().toISOString(), clientWriteProtocol:CURRENT_WRITE_PROTOCOL, items};
  }

  function downloadBackup(){
    const blob = new Blob([JSON.stringify(collectLocalBackup(), null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coachpulse-brouillons-locaux-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showBlockedNotice(error){
    if(!global.document || document.getElementById('coachpulseProtocolBlocked')) return;
    const notice = document.createElement('section');
    notice.id = 'coachpulseProtocolBlocked';
    notice.setAttribute('role', 'alert');
    notice.style.cssText = 'position:fixed;inset:12px;z-index:100000;background:#fff7ed;border:3px solid #c2410c;border-radius:18px;padding:20px;max-width:680px;height:max-content;margin:auto;box-shadow:0 20px 60px #0005;font:16px/1.45 Arial,sans-serif;color:#431407';
    notice.innerHTML = '<h2 style="margin-top:0">Mise à jour obligatoire avant synchronisation</h2><p>Cette version ne peut plus écrire en sécurité. Les brouillons locaux n’ont pas été supprimés.</p><p>Exportez une sauvegarde, puis rechargez CoachPulse. Aucune synchronisation automatique ne sera retentée depuis cette page.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-export>Exporter les données locales</button><button type="button" data-reload>Recharger l’application</button></div>';
    notice.querySelector('[data-export]').addEventListener('click', downloadBackup);
    notice.querySelector('[data-reload]').addEventListener('click', () => global.location.reload());
    document.body.appendChild(notice);
    global.dispatchEvent(new CustomEvent('coachpulse:write-protocol-blocked', {detail:{code:error.code, minimumWriteProtocol:error.minimumWriteProtocol}}));
  }

  async function readCompatibility(options={}){
    const now = Date.now();
    if(!options.force && cachedResult && now - lastCheck < CHECK_TTL_MS) return cachedResult;
    if(pendingCheck) return pendingCheck;
    pendingCheck = (async()=>{
      const response = await fetch(`${RELEASE_URL}?protocol=${now}`, {cache:'no-store', headers:{'Cache-Control':'no-cache'}});
      if(!response.ok) throw Object.assign(new Error(`Contrôle de version indisponible (${response.status}).`), {code:'CLIENT_WRITE_PROTOCOL_CHECK_FAILED'});
      const release = await response.json();
      const minimum = Number(release.minimumWriteProtocol);
      if(!Number.isSafeInteger(minimum) || minimum < 1) throw Object.assign(new Error('Métadonnée minimumWriteProtocol invalide.'), {code:'CLIENT_WRITE_PROTOCOL_CHECK_FAILED'});
      cachedResult = {compatible:CURRENT_WRITE_PROTOCOL >= minimum, minimumWriteProtocol:minimum, release};
      lastCheck = Date.now();
      return cachedResult;
    })().finally(()=>{ pendingCheck = null; });
    return pendingCheck;
  }

  async function assertCompatible(options={}){
    const result = await readCompatibility(options);
    if(result.compatible) return result;
    const error = protocolError(result.minimumWriteProtocol);
    showBlockedNotice(error);
    throw error;
  }

  global.CoachPulseClientWriteProtocol = {CURRENT_WRITE_PROTOCOL, assertCompatible, readCompatibility, collectLocalBackup, downloadBackup};
})(typeof window !== 'undefined' ? window : globalThis);
