(function(global){
  const Data = global.PlayerProfileData;
  function dateOf(row={}){
    return Data.text(row.date || row.declaredAt || row.createdAtIso || row.updatedAtIso || row.startDate || row.appointmentDate || row.completedAt).slice(0,10);
  }
  function seasonOf(row={}){
    return Data.text(row.season || row.saison || row.currentSeason) || Data.seasonFromDate(dateOf(row));
  }
  function periodFromState(state){
    const mode = state.filters.periodMode;
    const current = Data.currentSeason();
    if(mode === 'all') return {label:'Toutes saisons', mode, season:'all'};
    if(mode === 'custom') return {label:`${state.filters.startDate || 'Début'} au ${state.filters.endDate || 'Fin'}`, mode, startDate:state.filters.startDate, endDate:state.filters.endDate};
    const season = state.filters.season || current;
    return {label:season, mode:'season', season};
  }
  function rowInPeriod(row, period){
    if(period.mode === 'all') return true;
    const d = dateOf(row);
    if(period.mode === 'custom'){
      if(period.startDate && (!d || d < period.startDate)) return false;
      if(period.endDate && (!d || d > period.endDate)) return false;
      return true;
    }
    return seasonOf(row) === period.season;
  }
  function filterRows(rows=[], state){ const p = periodFromState(state); return rows.filter(row => rowInPeriod(row, p)); }
  function matchTypeOf(match={}){
    const raw = Data.text(match.matchType || match.match_type).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if(['championship','championnat','league'].includes(raw)) return 'championship';
    if(['tournament','tournoi'].includes(raw)) return 'tournament';
    if(raw === 'futsal') return 'futsal';
    if(['friendly','amical','match amical'].includes(raw)) return 'friendly';
    return '';
  }
  function matchTypeLabel(match={}){
    return {championship:'Championnat', tournament:'Tournoi', futsal:'Futsal', friendly:'Match amical'}[matchTypeOf(match)] || 'Non renseigné';
  }
  function filterMatches(matches=[], state){
    const period = periodFromState(state);
    const matchType = state.filters.matchType || '';
    return matches.filter(match => rowInPeriod(match, period) && (!matchType || matchTypeOf(match) === matchType));
  }
  function seasonsFromCollections(collections){
    const set = new Set([Data.currentSeason()]);
    Object.values(collections || {}).flat().forEach(row => {
      const season = seasonOf(row);
      if(season) set.add(season);
    });
    return [...set].sort();
  }
  global.PlayerProfileFilters = {dateOf, seasonOf, periodFromState, rowInPeriod, filterRows, filterMatches, matchTypeOf, matchTypeLabel, seasonsFromCollections};
})(window);
