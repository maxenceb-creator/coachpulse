// CoachPulse shared match statistics service.
// Pure helpers only: no DOM, storage, network or Firebase dependency.

(function(global){
  const PLAYER_COUNTER_KEYS = Object.freeze([
    'but', 'passe', 'tirCadre', 'tirNonCadre', 'centre',
    'progression', 'entree20', 'recup', 'duelWon', 'duelLost'
  ]);
  const LEGACY_PLAYER_COUNTER_KEYS = Object.freeze(PLAYER_COUNTER_KEYS.slice(0, 8));
  const OPPONENT_COUNTER_KEYS = Object.freeze([
    'butAdv', 'tirCadreAdv', 'tirNonCadreAdv', 'centreAdv',
    'progressionAdv', 'entree20Adv', 'recupAdv', 'duelWonAdv', 'duelLostAdv'
  ]);
  const ENTRY_MODES = Object.freeze(['LIVE', 'QUICK_POST_MATCH', 'FULL_POST_MATCH']);
  const STATS_SOURCES = Object.freeze(['EVENTS', 'MANUAL', 'MIXED']);

  function own(object, key){
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function numberOrUnknown(value){
    if(value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizedCounter(value, {unknown='zero'}={}){
    const number = numberOrUnknown(value);
    if(number === null) return unknown === 'preserve' ? null : 0;
    return Math.max(0, Math.round(number));
  }

  function normalizeCounters(source={}, keys=PLAYER_COUNTER_KEYS, options={}){
    return Object.fromEntries(keys.map(key => [key, normalizedCounter(source?.[key], options)]));
  }

  function cloneZones(zones={}){
    if(!zones || typeof zones !== 'object' || Array.isArray(zones)) return {};
    return Object.fromEntries(Object.entries(zones).map(([stat, values]) => [
      stat,
      values && typeof values === 'object' && !Array.isArray(values)
        ? Object.fromEntries(Object.entries(values).map(([zone, count]) => [zone, normalizedCounter(count)]))
        : {}
    ]));
  }

  function normalizePlayerStats(player={}, options={}){
    const secondsValue = numberOrUnknown(player.seconds ?? player.playingSeconds ?? player.tempsSecondes ?? player.playedSeconds);
    const seconds = secondsValue === null
      ? (options.unknown === 'preserve' ? null : 0)
      : Math.max(0, Math.round(secondsValue));
    return {
      ...player,
      ...normalizeCounters(player, PLAYER_COUNTER_KEYS, options),
      seconds,
      positionSeconds:normalizedPositionSeconds(player.positionSeconds || player.positions || {}, seconds),
      zones:cloneZones(player.zones)
    };
  }

  function normalizeOpponentStats(opponent={}, options={}){
    return {
      ...opponent,
      ...normalizeCounters(opponent, OPPONENT_COUNTER_KEYS, options),
      zones:cloneZones(opponent.zones)
    };
  }

  function createLegacyEmptyPlayerStats(){
    const zones = Object.fromEntries(LEGACY_PLAYER_COUNTER_KEYS.map(key => [key, {}]));
    return {seconds:0, positionSeconds:{}, ...normalizeCounters({}, LEGACY_PLAYER_COUNTER_KEYS), zones};
  }

  function normalizedPositionSeconds(positionSeconds={}, totalSeconds=0){
    const entries = Object.entries(positionSeconds && typeof positionSeconds === 'object' && !Array.isArray(positionSeconds) ? positionSeconds : {})
      .map(([position, seconds]) => [position, Math.max(0, Math.round(Number(seconds) || 0))])
      .filter(([, seconds]) => seconds > 0);
    const total = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const positionTotal = entries.reduce((sum, [, seconds]) => sum + seconds, 0);
    if(!positionTotal || !total) return {};
    if(positionTotal <= total) return Object.fromEntries(entries);
    let remaining = total;
    return Object.fromEntries(entries.map(([position, seconds], index) => {
      const normalized = index === entries.length - 1
        ? remaining
        : Math.min(remaining, Math.round(seconds * total / positionTotal));
      remaining -= normalized;
      return [position, normalized];
    }).filter(([, seconds]) => seconds > 0));
  }

  function normalizePlayers(players={}, options={}){
    return Object.fromEntries(Object.entries(players || {}).map(([name, player]) => [name, normalizePlayerStats(player || {}, options)]));
  }

  function sumPlayerCounter(players={}, playerRefs=Object.keys(players || {}), key=''){
    return (playerRefs || []).reduce((total, reference) => {
      const player = typeof reference === 'string' ? players?.[reference] : reference;
      return total + normalizedCounter(player?.[key]);
    }, 0);
  }

  function collectiveTotals(players={}, playerRefs=Object.keys(players || {})){
    return Object.fromEntries(PLAYER_COUNTER_KEYS.map(key => [key, sumPlayerCounter(players, playerRefs, key)]));
  }

  function derivedIndicators(playerTotals={}, opponentTotals={}){
    const shots = normalizedCounter(playerTotals.tirCadre) + normalizedCounter(playerTotals.tirNonCadre);
    const opponentShots = normalizedCounter(opponentTotals.tirCadreAdv) + normalizedCounter(opponentTotals.tirNonCadreAdv);
    const goals = normalizedCounter(playerTotals.but);
    return {
      shots,
      opponentShots,
      shotAccuracy:shots ? Math.round(normalizedCounter(playerTotals.tirCadre) / shots * 100) : 0,
      conversionRate:shots ? Math.round(goals / shots * 100) : 0,
      goals,
      assists:normalizedCounter(playerTotals.passe),
      goalsAgainst:normalizedCounter(opponentTotals.butAdv)
    };
  }

  function playerHasParticipation(player={}){
    const seconds = numberOrUnknown(player.seconds ?? player.playingSeconds ?? player.tempsSecondes ?? player.playedSeconds) || 0;
    const positionedSeconds = Object.values(player.positionSeconds || player.positions || {})
      .reduce((total, value) => total + Math.max(0, Number(value) || 0), 0);
    const status = String(player.participationStatus || player.status || '').trim().toUpperCase();
    return seconds > 0 || positionedSeconds > 0 || player.entered === true || player.played === true || player.participated === true
      || ['PLAYED', 'PARTICIPATED', 'ENTERED'].includes(status);
  }

  function normalizedIdentity(value){
    return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  function matchPlayer(match={}, aliases=[]){
    const rawAliases = new Set((aliases || []).map(value => String(value || '').trim()).filter(Boolean));
    const nameAliases = new Set([...rawAliases].map(normalizedIdentity).filter(Boolean));
    for(const [playerName, value] of Object.entries(match.players || {})){
      const player = value || {};
      const ids = [player.playerId, player.playerSnapshot?.playerId].map(value => String(value || '').trim()).filter(Boolean);
      const names = [playerName, player.playerName, player.name, player.playerSnapshot?.playerName, player.playerSnapshot?.displayName]
        .map(normalizedIdentity).filter(Boolean);
      if(ids.some(id => rawAliases.has(id)) || names.some(name => nameAliases.has(name))) return {playerName, ...player};
    }
    return null;
  }

  function matchHasPlayerParticipation(match={}, aliases=[]){
    const player = matchPlayer(match, aliases);
    return Boolean(player && playerHasParticipation(player));
  }

  function validatePlayerStats(player={}){
    const errors = [];
    for(const key of PLAYER_COUNTER_KEYS){
      if(own(player, key) && numberOrUnknown(player[key]) === null && player[key] !== null && player[key] !== '') errors.push({field:key, code:'INVALID_NUMBER'});
      if(numberOrUnknown(player[key]) < 0) errors.push({field:key, code:'NEGATIVE_VALUE'});
    }
    const seconds = numberOrUnknown(player.seconds);
    if(seconds !== null && seconds < 0) errors.push({field:'seconds', code:'NEGATIVE_VALUE'});
    const positionTotal = Object.values(player.positionSeconds || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    if(seconds !== null && seconds >= 0 && positionTotal > seconds) errors.push({field:'positionSeconds', code:'EXCEEDS_PLAYING_TIME'});
    return errors;
  }

  const service = {
    PLAYER_COUNTER_KEYS,
    LEGACY_PLAYER_COUNTER_KEYS,
    OPPONENT_COUNTER_KEYS,
    ENTRY_MODES,
    STATS_SOURCES,
    numberOrUnknown,
    normalizedCounter,
    normalizeCounters,
    normalizePlayerStats,
    normalizeOpponentStats,
    createLegacyEmptyPlayerStats,
    normalizedPositionSeconds,
    normalizePlayers,
    sumPlayerCounter,
    collectiveTotals,
    derivedIndicators,
    playerHasParticipation,
    matchPlayer,
    matchHasPlayerParticipation,
    validatePlayerStats
  };

  global.CoachPulseMatchStatistics = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
