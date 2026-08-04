// CoachPulse shared notifications service.
// Replaces blocking alert() calls with non-blocking, tablet-friendly messages.

(function(global){
  const DEFAULT_DURATION_MS = 4600;
  const MAX_VISIBLE = 4;
  let host = null;

  function ensureStyles(){
    if(global.document?.getElementById('coachpulse-notifications-style')) return;
    const style = global.document?.createElement('style');
    if(!style) return;
    style.id = 'coachpulse-notifications-style';
    style.textContent = `
      .cp-notify-host{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:1200;display:grid;gap:10px;width:min(420px,calc(100vw - 28px));pointer-events:none}
      .cp-notify{pointer-events:auto;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;padding:13px 14px;border-radius:18px;border:1px solid rgba(205,183,137,.46);background:rgba(255,255,255,.96);color:#06351f;box-shadow:0 18px 44px rgba(6,23,13,.18);font:700 14px/1.35 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;transform:translateY(8px);opacity:0;transition:opacity .18s ease,transform .18s ease}
      .cp-notify.show{opacity:1;transform:none}
      .cp-notify-icon{font-size:20px;line-height:1.1}
      .cp-notify strong{display:block;margin-bottom:2px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#06351f}
      .cp-notify p{margin:0;color:#203a2e;font-weight:750}
      .cp-notify button{background:transparent;border:0;color:#66756d;font:900 18px/1 system-ui;cursor:pointer;padding:0 2px}
      .cp-notify.success{border-color:rgba(29,153,91,.35);box-shadow:inset 5px 0 0 #008b49,0 18px 44px rgba(6,23,13,.16)}
      .cp-notify.error{border-color:rgba(220,38,38,.28);box-shadow:inset 5px 0 0 #dc2626,0 18px 44px rgba(6,23,13,.16)}
      .cp-notify.warn{border-color:rgba(205,183,137,.70);box-shadow:inset 5px 0 0 #caa84a,0 18px 44px rgba(6,23,13,.16)}
      .cp-notify.info{box-shadow:inset 5px 0 0 #1d995b,0 18px 44px rgba(6,23,13,.16)}
      .cp-confirm-backdrop{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;padding:18px;background:rgba(0,32,18,.42);backdrop-filter:blur(5px)}
      .cp-confirm{width:min(520px,100%);border:1px solid rgba(205,183,137,.58);border-radius:22px;background:#fff;color:#06351f;box-shadow:0 24px 70px rgba(6,23,13,.32);padding:18px;font:800 15px/1.4 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .cp-confirm h2{margin:0 0 8px;font-size:20px;color:#06351f}
      .cp-confirm p{margin:0;color:#203a2e;white-space:pre-line}
      .cp-confirm-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px;flex-wrap:wrap}
      .cp-confirm-actions button{border:1px solid rgba(0,63,36,.14);border-radius:12px;padding:10px 14px;background:#f8fafc;color:#06351f;font:900 14px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
      .cp-confirm-actions .primary{background:linear-gradient(135deg,#1d995b,#006936);border-color:#006936;color:#fff}
      .cp-confirm-actions .danger{background:#fee2e2;border-color:#fecaca;color:#991b1b}
      @media(max-width:680px){.cp-notify-host{right:10px;bottom:10px;width:calc(100vw - 20px)}.cp-notify{border-radius:14px}}
    `;
    global.document.head.appendChild(style);
  }

  function ensureHost(){
    if(host?.isConnected) return host;
    ensureStyles();
    host = global.document?.createElement('div');
    if(!host) return null;
    host.className = 'cp-notify-host';
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-relevant', 'additions');
    global.document.body.appendChild(host);
    return host;
  }

  function titleForType(type){
    return ({success:'Succès', error:'Erreur', warn:'Attention', info:'CoachPulse'})[type] || 'CoachPulse';
  }

  function iconForType(type){
    return ({success:'✅', error:'⚠️', warn:'⚠️', info:'ℹ️'})[type] || 'ℹ️';
  }

  function normalizeType(type){
    return ['success','error','warn','info'].includes(type) ? type : 'info';
  }

  function dismiss(node){
    if(!node) return;
    node.classList.remove('show');
    global.setTimeout(() => node.remove(), 180);
  }

  function show(message, options={}){
    const box = ensureHost();
    const text = String(message || '').trim();
    if(!box || !text){
      if(text) console.info(text);
      return null;
    }
    const type = normalizeType(options.type);
    while(box.children.length >= MAX_VISIBLE) dismiss(box.firstElementChild);
    const node = global.document.createElement('div');
    node.className = `cp-notify ${type}`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    node.innerHTML = `<span class="cp-notify-icon" aria-hidden="true">${iconForType(type)}</span><div><strong>${escapeHtml(options.title || titleForType(type))}</strong><p>${escapeHtml(text)}</p></div><button type="button" aria-label="Fermer">×</button>`;
    node.querySelector('button')?.addEventListener('click', () => dismiss(node));
    box.appendChild(node);
    global.requestAnimationFrame?.(() => node.classList.add('show')) || node.classList.add('show');
    const duration = Number(options.durationMs || DEFAULT_DURATION_MS);
    if(duration > 0) global.setTimeout(() => dismiss(node), duration);
    return node;
  }

  function confirm(message, options={}){
    const text = String(message || '').trim();
    if(!global.document || !text) return Promise.resolve(false);
    ensureStyles();
    return new Promise(resolve => {
      let settled = false;
      const backdrop = global.document.createElement('div');
      backdrop.className = 'cp-confirm-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.innerHTML = `<section class="cp-confirm"><h2>${escapeHtml(options.title || 'Confirmation')}</h2><p>${escapeHtml(text)}</p><div class="cp-confirm-actions"><button type="button" data-cancel>${escapeHtml(options.cancelLabel || 'Annuler')}</button><button type="button" class="${options.danger ? 'danger' : 'primary'}" data-confirm>${escapeHtml(options.confirmLabel || 'Confirmer')}</button></div></section>`;
      function close(value){
        if(settled) return;
        settled = true;
        global.document.removeEventListener('keydown', onKey);
        backdrop.remove();
        resolve(value);
      }
      function onKey(event){
        if(event.key === 'Escape') close(false);
        if(event.key === 'Enter') close(true);
      }
      backdrop.addEventListener('click', event => {
        if(event.target === backdrop || event.target.closest('[data-cancel]')) close(false);
        if(event.target.closest('[data-confirm]')) close(true);
      });
      global.document.addEventListener('keydown', onKey);
      global.document.body.appendChild(backdrop);
      backdrop.querySelector('[data-confirm]')?.focus();
    });
  }

  function escapeHtml(value){
    return String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  const service = {
    show,
    confirm,
    info:(message, options={}) => show(message, {...options, type:'info'}),
    success:(message, options={}) => show(message, {...options, type:'success'}),
    warn:(message, options={}) => show(message, {...options, type:'warn'}),
    error:(message, options={}) => show(message, {...options, type:'error'})
  };

  global.CoachPulseNotify = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
