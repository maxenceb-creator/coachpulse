(function(global){
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function donut(parts=[], center=''){
    const total = parts.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
    let offset = 0;
    const circles = parts.map(item => {
      const value = Number(item.value || 0);
      const dash = value / total * 100;
      const circle = `<circle r="42" cx="50" cy="50" fill="none" stroke="${esc(item.color)}" stroke-width="14" stroke-dasharray="${dash} ${100-dash}" stroke-dashoffset="${-offset}" pathLength="100"></circle>`;
      offset += dash;
      return circle;
    }).join('');
    return `<div class="donut"><svg viewBox="0 0 100 100" role="img">${circles}<circle r="30" cx="50" cy="50" fill="#fff"></circle></svg><b>${esc(center)}</b></div>`;
  }
  function sparkline(values=[], color='#1d995b'){
    const nums = values.map(Number).filter(Number.isFinite);
    if(!nums.length) return '<div class="empty-mini">Aucune donnée</div>';
    const max = Math.max(...nums, 1), min = Math.min(...nums, 0), span = Math.max(1, max - min);
    const points = nums.map((value, idx) => `${idx/(Math.max(1, nums.length-1))*100},${90-((value-min)/span*75)}`).join(' ');
    return `<svg class="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="${esc(color)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
  }
  function heatmap(zones={}){
    const order = [3,6,9,2,5,8,1,4,7];
    const max = Math.max(1, ...Object.values(zones).map(Number));
    return `<div class="team-heatmap">${order.map(zone => {
      const value = Number(zones[zone] || 0);
      const level = Math.min(5, Math.ceil(value / max * 5));
      return `<div class="heat heat-${level}" title="Zone ${zone} · ${value} événement(s)"><b>${zone}</b><span>${value}</span></div>`;
    }).join('')}</div>`;
  }
  global.TeamProfileCharts = {donut, sparkline, heatmap};
})(window);
