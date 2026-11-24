// Stable access identity and stale-work guard for the Presences module.

(function(global){
  function text(value){ return String(value || '').trim(); }
  function upper(value){ return text(value).toUpperCase(); }
  function uniqueSorted(values=[]){ return [...new Set(values.map(text).filter(Boolean))].sort(); }

  function scopeAllowsAllPlayers(scope){
    if(scope === true) return true;
    if(typeof scope === 'string') return ['ALL_PLAYERS','ALLPLAYERS','TOUTES_JOUEUSES','TOUTES'].includes(upper(scope));
    if(Array.isArray(scope)) return scope.some(scopeAllowsAllPlayers);
    if(!scope || typeof scope !== 'object') return false;
    return scope.allPlayers === true
      || scope.allPlayers === 'true'
      || String(scope.players || '').toLowerCase() === 'all'
      || String(scope.playerScope || '').toLowerCase() === 'all'
      || scope.scope === 'allPlayers';
  }

  function contextParts(context={}){
    const profile = context.profile || context;
    const user = context.user || {};
    const teams = uniqueSorted([
      ...(profile.authorizedTeamIds || []),
      ...(profile.teamIds || []),
      ...(profile.allowedTeamIds || [])
    ]);
    const permissionLevel = upper(profile.permissionLevel || context.permissionLevel);
    const role = upper(profile.role || context.role);
    const allPlayers = permissionLevel === 'ADMIN'
      || role === 'ADMIN'
      || context.allPlayers === true
      || scopeAllowsAllPlayers(profile.moduleScopes?.presences);
    const moduleAccess = context.modules?.presences || profile.modulePermissions?.presences || {};
    const permissions = ['read','write','delete'].map(name => moduleAccess?.[name] === true ? '1' : '0').join('');
    return {
      uid:text(user.uid || profile.uid || context.uid),
      permissionLevel,
      role,
      allPlayers,
      teams,
      permissions
    };
  }

  function contextKey(context={}){
    const value = contextParts(context);
    return [value.uid, value.permissionLevel, value.role, value.allPlayers ? 'allPlayers' : 'teamScope', value.permissions, value.teams.join(',')].join('|');
  }

  function eventTeamIds(event={}){
    return uniqueSorted([
      event.teamId,
      ...(event.teamIds || []),
      event.teamSnapshot?.teamId,
      ...(event.teamSnapshot?.teamIds || []),
      event.sessionSnapshot?.teamId,
      ...(event.sessionSnapshot?.teamIds || [])
    ]);
  }

  function playerTeamIds(player={}){
    const history = player.seasonHistory || player.seasons || {};
    const assignments = Array.isArray(player.teamAssignments) ? player.teamAssignments : [];
    return uniqueSorted([
      player.teamId,
      ...(player.teamIds || []),
      ...(player.rosterTeamIds || []),
      ...Object.values(history).flatMap(row => [row?.teamId, ...(row?.teamIds || [])]),
      ...assignments.flatMap(row => [row?.teamId, ...(row?.teamIds || [])])
    ]);
  }

  function canAccessEvent(context={}, event={}){
    const access = contextParts(context);
    if(!access.uid) return false;
    if(access.allPlayers) return true;
    const allowed = new Set(access.teams);
    return eventTeamIds(event).some(teamId => allowed.has(teamId));
  }

  function filterEvents(context={}, events=[]){
    return (Array.isArray(events) ? events : []).filter(event => canAccessEvent(context, event));
  }

  function filterLocalEventSources(context={}, sources={}, normalizeEvent, filterDeleted){
    const normalize = typeof normalizeEvent === 'function' ? normalizeEvent : event => event;
    const rows = [
      ...(Array.isArray(sources.presence) ? sources.presence : []).map(event => normalize(event, 'presences')),
      ...(Array.isArray(sources.methodology) ? sources.methodology : []).map(event => normalize(event, 'methodologie')),
      ...(Array.isArray(sources.legacy) ? sources.legacy : []).map(event => normalize(event, 'presences'))
    ].filter(Boolean);
    const activeRows = typeof filterDeleted === 'function' ? filterDeleted(rows) : rows;
    return filterEvents(context, activeRows);
  }

  function canAccessPlayer(context={}, player={}){
    const access = contextParts(context);
    if(!access.uid) return false;
    if(access.allPlayers) return true;
    const allowed = new Set(access.teams);
    return playerTeamIds(player).some(teamId => allowed.has(teamId));
  }

  function filterPlayers(context={}, players=[]){
    return (Array.isArray(players) ? players : []).filter(player => canAccessPlayer(context, player));
  }

  function createTracker(initialContext){
    let key = '';
    let generation = 0;
    let context = null;
    function update(nextContext){
      const nextKey = contextKey(nextContext || {});
      const changed = nextKey !== key;
      if(changed){
        key = nextKey;
        context = nextContext || null;
        generation += 1;
      }
      return {changed, key, generation, context};
    }
    function capture(){ return {key, generation}; }
    function isCurrent(token){ return Boolean(token && token.key === key && token.generation === generation); }
    function monthKey(month){ return `${key}::${text(month)}`; }
    if(initialContext !== undefined) update(initialContext);
    return {update, capture, isCurrent, monthKey, key:() => key, generation:() => generation, context:() => context};
  }

  const service = {contextParts, contextKey, eventTeamIds, playerTeamIds, canAccessEvent, filterEvents, filterLocalEventSources, canAccessPlayer, filterPlayers, createTracker};
  global.CoachPulsePresenceAccessContext = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
