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
  function seasonsFromCollections(collections){
    const set = new Set([Data.currentSeason()]);
    Object.values(collections || {}).flat().forEach(row => {
      const season = seasonOf(row);
      if(season) set.add(season);
    });
    return [...set].sort();
  }
  global.PlayerProfileFilters = {dateOf, seasonOf, periodFromState, rowInPeriod, filterRows, seasonsFromCollections};
})(window);
