(function(global){
  'use strict';

  const SHOW_DELAY_MS = 200;
  const MIN_VISIBLE_MS = 400;
  const SUCCESS_VISIBLE_MS = 1400;
  const operations = new Map();
  let sequence = 0;
  let visibleSince = 0;
  let showTimer = null;
  let hideTimer = null;
  let lastError = null;
  let expanded = false;
  let root = null;

  function debugEnabled(){
    try{ return global.localStorage?.getItem('coachpulse:debugPerf') === '1'; }
    catch(_error){ return false; }
  }

  function clearTimer(name){
    if(name === 'show' && showTimer){ global.clearTimeout(showTimer); showTimer = null; }
    if(name === 'hide' && hideTimer){ global.clearTimeout(hideTimer); hideTimer = null; }
  }

  function ensureUi(){
    if(root || !global.document?.body) return root;
    const style = document.createElement('style');
    style.id = 'coachpulseGlobalLoadingStyles';
    style.textContent = `
      .cp-global-loading{position:fixed;z-index:820;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));display:flex;align-items:center;gap:9px;max-width:min(360px,calc(100vw - 24px));min-height:52px;padding:7px 11px 7px 8px;border:1px solid rgba(205,183,137,.62);border-radius:18px;background:rgba(255,255,255,.96);color:#06351f;box-shadow:0 12px 32px rgba(6,23,13,.2);font:800 12px/1.25 Inter,system-ui,sans-serif;opacity:0;visibility:hidden;transform:translateY(8px) scale(.98);transition:opacity .18s ease,transform .18s ease,visibility 0s linear .18s;pointer-events:none}
      .cp-global-loading.is-visible{opacity:1;visibility:visible;transform:none;transition-delay:0s;pointer-events:auto}
      .cp-global-loading__logo-wrap{position:relative;display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px}
      .cp-global-loading__logo{display:block;width:34px;height:34px;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(6,23,13,.16))}
      .cp-global-loading.is-active .cp-global-loading__logo{animation:cp-loading-pulse 1.5s ease-in-out infinite}
      .cp-global-loading__badge{position:absolute;right:-3px;bottom:-2px;display:grid;place-items:center;width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:#15803d;color:#fff;font-size:11px;line-height:1}
      .cp-global-loading.is-error{border-color:#f0a6a6;background:rgba(255,248,248,.98);color:#8c1d1d}
      .cp-global-loading.is-error .cp-global-loading__badge{background:#c62828}
      .cp-global-loading__copy{min-width:0;text-align:left}
      .cp-global-loading__label{display:block;font-weight:950;white-space:nowrap}
      .cp-global-loading__detail{display:none;margin-top:2px;max-width:270px;color:#66756d;font-size:10px;font-weight:750;overflow-wrap:anywhere}
      .cp-global-loading.is-expanded .cp-global-loading__detail,.cp-global-loading.is-debug .cp-global-loading__detail{display:block}
      @keyframes cp-loading-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}
      @media(max-width:560px){.cp-global-loading{right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));min-height:48px;border-radius:16px}.cp-global-loading__logo-wrap{width:34px;height:34px;flex-basis:34px}.cp-global-loading__logo{width:31px;height:31px}}
      @media(prefers-reduced-motion:reduce){.cp-global-loading,.cp-global-loading.is-visible{transition:none}.cp-global-loading.is-active .cp-global-loading__logo{animation:none}.cp-global-loading.is-active .cp-global-loading__badge{box-shadow:0 0 0 3px rgba(29,153,91,.2)}}
    `;
    document.head.appendChild(style);
    root = document.createElement('button');
    root.id = 'coachpulseGlobalLoading';
    root.type = 'button';
    root.className = 'cp-global-loading';
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    root.innerHTML = '<span class="cp-global-loading__logo-wrap"><img class="cp-global-loading__logo" src="assets/asse-logo-officiel.png" alt=""><span class="cp-global-loading__badge" aria-hidden="true"></span></span><span class="cp-global-loading__copy"><span class="cp-global-loading__label"></span><span class="cp-global-loading__detail"></span></span>';
    root.addEventListener('click', () => {
      if(!lastError && !debugEnabled()) return;
      expanded = !expanded;
      render();
    });
    document.body.appendChild(root);
    return root;
  }

  function activeRows(){ return [...operations.values()]; }
  function activeLabel(rows){
    return rows.some(row => row.kind === 'loading') ? 'Chargement…' : 'Synchronisation…';
  }
  function debugDetail(rows){
    const labels = [...new Set(rows.map(row => row.label).filter(Boolean))];
    return labels.join(', ');
  }

  function setVisible(visible){
    if(!ensureUi()) return;
    root.classList.toggle('is-visible', visible);
    if(visible && !visibleSince) visibleSince = Date.now();
    if(!visible) visibleSince = 0;
  }

  function render(forcedState){
    if(!ensureUi()) return;
    const rows = activeRows();
    const debug = debugEnabled();
    const visible = root.classList.contains('is-visible');
    let state = forcedState || (rows.length ? 'active' : lastError ? 'error' : 'idle');
    root.className = `cp-global-loading${visible ? ' is-visible' : ''}${state === 'active' ? ' is-active' : ''}${state === 'error' ? ' is-error' : ''}${expanded ? ' is-expanded' : ''}${debug ? ' is-debug' : ''}`;
    const label = root.querySelector('.cp-global-loading__label');
    const detail = root.querySelector('.cp-global-loading__detail');
    const badge = root.querySelector('.cp-global-loading__badge');
    if(state === 'active'){
      label.textContent = activeLabel(rows);
      detail.textContent = debug ? debugDetail(rows) : '';
      badge.textContent = '';
      root.title = debug ? detail.textContent : label.textContent;
    }else if(state === 'success'){
      label.textContent = 'À jour';
      detail.textContent = '';
      badge.textContent = '✓';
      root.title = 'Toutes les opérations sont terminées.';
    }else if(state === 'error'){
      label.textContent = lastError?.offline ? 'Hors ligne · local actif' : 'Erreur de synchronisation';
      detail.textContent = lastError?.message || 'Données locales disponibles — synchronisation impossible';
      badge.textContent = '!';
      root.title = `${label.textContent} — cliquer pour les détails`;
    }
  }

  function scheduleActiveDisplay(){
    clearTimer('hide');
    if(root?.classList.contains('is-visible')){ render(); return; }
    if(showTimer) return;
    showTimer = global.setTimeout(() => {
      showTimer = null;
      if(!operations.size) return;
      render();
      setVisible(true);
    }, SHOW_DELAY_MS);
  }

  function finishDisplay(){
    clearTimer('show');
    if(operations.size){ render(); return; }
    if(lastError){ render(); setVisible(true); return; }
    if(!root?.classList.contains('is-visible')) return;
    const waitForMinimum = Math.max(0, MIN_VISIBLE_MS - (Date.now() - visibleSince));
    clearTimer('hide');
    hideTimer = global.setTimeout(() => {
      render('success');
      hideTimer = global.setTimeout(() => { setVisible(false); hideTimer = null; }, SUCCESS_VISIBLE_MS);
    }, waitForMinimum);
  }

  function start(label='operation', options={}){
    const id = `cp-op-${++sequence}`;
    const row = {id, label:String(label || 'operation'), kind:options.kind === 'loading' ? 'loading' : 'sync', startedAt:Date.now()};
    operations.set(id, row);
    if(debugEnabled()) console.info('[CoachPulse Loading] active operations:', debugDetail(activeRows()));
    scheduleActiveDisplay();
    let ended = false;
    return {
      id,
      end(){
        if(ended) return;
        ended = true;
        operations.delete(id);
        if(lastError?.label === row.label){ lastError = null; expanded = false; }
        if(debugEnabled()) console.info('[CoachPulse Loading] active operations:', debugDetail(activeRows()) || 'none');
        finishDisplay();
      },
      fail(error, failureOptions={}){ if(ended) return; ended = true; operations.delete(id); reportError(error, {...failureOptions, label:row.label}); }
    };
  }

  function track(promise, label, options={}){
    const operation = start(label, options);
    return Promise.resolve(promise).then(
      value => { operation.end(); return value; },
      error => { operation.fail(error, options); throw error; }
    );
  }

  function reportError(error, options={}){
    clearTimer('show');
    clearTimer('hide');
    const raw = String(options.message || error?.message || error || 'Données locales disponibles — synchronisation impossible');
    lastError = {message:raw, label:options.label || '', offline:options.offline === true, at:Date.now()};
    expanded = false;
    render();
    setVisible(true);
  }

  function clearError(){
    lastError = null;
    expanded = false;
    if(operations.size) scheduleActiveDisplay();
    else finishDisplay();
  }

  function snapshot(){ return {active:activeRows().map(row => ({...row})), error:lastError ? {...lastError} : null, visible:Boolean(root?.classList.contains('is-visible'))}; }

  const api = {start, track, reportError, clearError, snapshot, constants:{SHOW_DELAY_MS,MIN_VISIBLE_MS,SUCCESS_VISIBLE_MS}};
  global.CoachPulseLoading = api;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUi, {once:true});
  else ensureUi();
})(window);
