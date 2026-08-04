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

  function escapeHtml(value){
    return String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  const service = {
    show,
    info:(message, options={}) => show(message, {...options, type:'info'}),
    success:(message, options={}) => show(message, {...options, type:'success'}),
    warn:(message, options={}) => show(message, {...options, type:'warn'}),
    error:(message, options={}) => show(message, {...options, type:'error'})
  };

  global.CoachPulseNotify = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
