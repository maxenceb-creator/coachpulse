(function(){
  'use strict';

  const ZONES = [1,2,3,4,5,6,7,8,9];
  const US_DANGER = ['but','tirCadre','tirNonCadre','centre','progression','entree20','recup','duelWon','duelLost'];
  const ADV_DANGER = ['butAdv','tirCadreAdv','tirNonCadreAdv','centreAdv','progressionAdv','entree20Adv','recupAdv','duelWonAdv','duelLostAdv'];
  const LABELS = {
    but:'Buts',
    butAdv:'Buts adv.',
    tirCadre:'Tirs cadrés',
    tirCadreAdv:'Tirs cadrés adv.',
    tirNonCadre:'Tirs non cadrés',
    tirNonCadreAdv:'Tirs non cadrés adv.',
    centre:'Centres',
    centreAdv:'Centres adv.',
    progression:'Progressions',
    progressionAdv:'Progressions adv.',
    entree20:'Entrées 20m',
    entree20Adv:'Entrées 20m adv.',
    recup:'Récupérations',
    recupAdv:'Récupérations adv.',
    duelWon:'Duels gagnés',
    duelWonAdv:'Duels gagnés adv.',
    duelLost:'Duels perdus',
    duelLostAdv:'Duels perdus adv.'
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num = value => Number(value || 0) || 0;
  const zoneOk = value => {
    const zone = Number(value);
    return Number.isInteger(zone) && ZONES.includes(zone) ? zone : null;
  };
  const row = zone => Math.ceil(Number(zone) / 3);
  const col = zone => ((Number(zone) - 1) % 3) + 1;

  function zoneName(zone, side){
    const r = row(zone);
    const c = ['gauche','axe','droite'][col(zone) - 1];
    const label = side === 'adv'
      ? (r === 1 ? 'Zone basse adverse' : r === 2 ? 'Zone médiane adverse' : 'Zone haute adverse')
      : (r === 1 ? 'Zone haute ASSE' : r === 2 ? 'Zone médiane ASSE' : 'Zone basse ASSE');
    return `${label} · ${c}`;
  }

  function sideFromCell(cell){
    const parent = cell.closest('.cp-side-adv,.cp-side-us');
    return parent && parent.classList.contains('cp-side-adv') ? 'adv' : 'us';
  }

  function titleFromCell(cell){
    return cell.closest('.cp694-wrap')?.dataset?.title || cell.closest('.cp66-heat-card')?.querySelector('h4')?.textContent || '';
  }

  function keysFromTitle(title, side){
    const t = String(title || '').toLowerCase();
    if(t.includes('récup')) return side === 'adv' ? ['recupAdv'] : ['recup'];
    if(t.includes('tir')) return side === 'adv' ? ['butAdv','tirCadreAdv','tirNonCadreAdv'] : ['but','tirCadre','tirNonCadre'];
    if(t.includes('centre')) return side === 'adv' ? ['centreAdv'] : ['centre'];
    if(t.includes('duel')) return side === 'adv' ? ['duelWonAdv','duelLostAdv'] : ['duelWon','duelLost'];
    if(t.includes('progress') || t.includes('20')) return side === 'adv' ? ['progressionAdv','entree20Adv'] : ['progression','entree20'];
    return side === 'adv' ? ADV_DANGER : US_DANGER;
  }

  function playerFromTitle(title){
    const value = String(title || '');
    if(value.startsWith('Actions ')) return value.replace(/^Actions\s+/, '').trim();
    const parts = value.split(' · ');
    return parts.length > 1 ? parts.slice(1).join(' · ').trim() : null;
  }

  function zoneFromCell(cell){
    const dataZone = zoneOk(cell.dataset?.zone);
    if(dataZone) return dataZone;
    const cells = [...cell.parentElement.querySelectorAll('.cp694-cell')];
    return zoneOk(cells.indexOf(cell) + 1) || 1;
  }

  function visibleCount(cell){
    const counter = cell.querySelector('b');
    return num(counter && counter.textContent);
  }

  function collectCount(side, key, zone, player){
    const checkedZone = zoneOk(zone);
    if(!checkedZone) return 0;
    try{
      if(typeof window.cpHeatCollect === 'function'){
        const collected = window.cpHeatCollect(side, [key], {player:player || undefined}) || {};
        return num(collected[checkedZone]);
      }
    }catch(_error){
      // Fallback below.
    }
    try{
      if(side === 'adv') return num(window.state?.opp?.zones?.[key]?.[checkedZone]);
      const names = player ? [player] : Object.keys(window.state?.players || {});
      return names.reduce((sum, name) => sum + num(window.state?.players?.[name]?.zones?.[key]?.[checkedZone]), 0);
    }catch(_error){
      return 0;
    }
  }

  function buildDetail(cell){
    const side = sideFromCell(cell);
    const title = titleFromCell(cell);
    const player = playerFromTitle(title);
    const zone = zoneFromCell(cell);
    const keys = keysFromTitle(title, side);
    const displayed = visibleCount(cell);
    const rows = [];
    let total = 0;
    keys.forEach(key => {
      const value = collectCount(side, key, zone, player);
      if(value > 0){
        rows.push([LABELS[key] || key, value]);
        total += value;
      }
    });

    const finalTotal = displayed || total;
    if(displayed > 0 && total === 0) rows.push(['Total zone', displayed]);
    else if(displayed > 0 && total !== displayed) rows.push(['Ajustement compteur', displayed - total]);

    return `<b>${esc((player ? player + ' · ' : '') + zoneName(zone, side))}</b><div class="total">${finalTotal} action${finalTotal > 1 ? 's' : ''}</div>`+
      (rows.length ? rows.map(([label, value]) => `<div class="row"><span>${esc(label)}</span><strong>${value}</strong></div>`).join('') : `<div class="row"><span>Aucune action enregistrée</span><strong>0</strong></div>`)+
      `<div class="muted">Même source que la heatmap · Z${zone}</div>`;
  }

  function tooltip(){
    let element = document.getElementById('cp698Tooltip');
    if(!element){
      element = document.createElement('div');
      element.id = 'cp698Tooltip';
      element.className = 'cp698-tooltip';
      document.body.appendChild(element);
    }
    return element;
  }

  function place(event){
    const element = tooltip();
    const pad = 14;
    let x = (event.clientX || 20) + pad;
    let y = (event.clientY || 20) + pad;
    const rect = element.getBoundingClientRect();
    if(x + rect.width > innerWidth - 8) x = (event.clientX || 20) - rect.width - pad;
    if(y + rect.height > innerHeight - 8) y = (event.clientY || 20) - rect.height - pad;
    element.style.left = Math.max(8, x) + 'px';
    element.style.top = Math.max(8, y) + 'px';
  }

  function show(cell, event){
    const element = tooltip();
    element.innerHTML = buildDetail(cell);
    element.classList.add('show');
    place(event);
  }

  document.addEventListener('pointerenter', event => {
    const cell = event.target.closest?.('.cp694-cell');
    if(!cell || cell.closest('.zoneOverlay')) return;
    show(cell, event);
  }, true);

  document.addEventListener('pointermove', event => {
    const element = tooltip();
    if(element.classList.contains('show')) place(event);
  }, true);

  document.addEventListener('pointerleave', event => {
    const cell = event.target.closest?.('.cp694-cell');
    if(!cell) return;
    tooltip().classList.remove('show');
    cell.classList.remove('cp698-open');
  }, true);

  document.addEventListener('click', event => {
    const cell = event.target.closest?.('.cp694-cell');
    if(!cell || cell.closest('.zoneOverlay')) return;
    document.querySelectorAll('.cp694-cell.cp698-open').forEach(openCell => openCell.classList.remove('cp698-open'));
    cell.classList.add('cp698-open');
    show(cell, event);
  }, true);

  document.addEventListener('click', event => {
    if(!event.target.closest?.('.cp694-cell')) tooltip().classList.remove('show');
  }, false);

  window.cpHeatmapTooltipCheck = function(){
    return [...document.querySelectorAll('.cp694-cell')].map(cell => ({
      title:titleFromCell(cell),
      side:sideFromCell(cell),
      zone:zoneFromCell(cell),
      displayed:visibleCount(cell)
    }));
  };
})();
