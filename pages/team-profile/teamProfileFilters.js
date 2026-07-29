(function(global){
  const Data = global.TeamProfileData;
  function periodFromState(state){
    const mode = state.filters.periodMode || 'season';
    if(mode === 'all') return {mode, label:'Toutes saisons'};
    if(mode === 'custom') return {mode, label:`${state.filters.startDate || 'Début'} au ${state.filters.endDate || 'Fin'}`, startDate:state.filters.startDate, endDate:state.filters.endDate};
    return {mode:'season', season:state.filters.season || Data.currentSeason(), label:state.filters.season || Data.currentSeason()};
  }
  function rowInPeriod(row, period){
    if(period.mode === 'all') return true;
    const date = Data.dateOf(row);
    if(period.mode === 'custom'){
      if(period.startDate && (!date || date < period.startDate)) return false;
      if(period.endDate && (!date || date > period.endDate)) return false;
      return true;
    }
    return Data.seasonOf(row) === period.season;
  }
  function filterRows(rows=[], state){ const period = periodFromState(state); return rows.filter(row => rowInPeriod(row, period)); }
  function filterMatches(matches=[], state){
    const period = periodFromState(state);
    const competition = state.filters.competition || '';
    const venue = state.filters.venue || '';
    const result = state.filters.result || '';
    const opponent = (state.filters.opponent || '').toLowerCase();
    return matches.filter(match => {
      if(!rowInPeriod(match, period)) return false;
      if(competition && (match.competition || '') !== competition) return false;
      if(venue && venueOf(match) !== venue) return false;
      if(result && resultOf(match).code !== result) return false;
      if(opponent && !String(match.opponent || match.adversaire || '').toLowerCase().includes(opponent)) return false;
      return true;
    });
  }
  function seasonsFromCollections(collections={}){
    const set = new Set([Data.currentSeason()]);
    Object.values(collections).flat().forEach(row => { const season = Data.seasonOf(row); if(season) set.add(season); });
    return [...set].sort();
  }
  function venueOf(match={}){
    const raw = String(match.venue || match.location || match.lieu || match.homeAway || match.domicileExterieur || '').toLowerCase();
    if(raw.includes('ext') || raw === 'away') return 'away';
    if(raw.includes('dom') || raw === 'home') return 'home';
    return match.isHome === false ? 'away' : 'home';
  }
  function scoreOf(match={}){
    const score = String(match.score || match.result || '').trim();
    const m = score.match(/(\d+)\D+(\d+)/);
    const forGoals = Number(match.goalsFor ?? match.butsPour ?? match.scoreUs ?? (m ? m[1] : 0));
    const againstGoals = Number(match.goalsAgainst ?? match.butsContre ?? match.scoreThem ?? (m ? m[2] : 0));
    return {forGoals:Number.isFinite(forGoals) ? forGoals : 0, againstGoals:Number.isFinite(againstGoals) ? againstGoals : 0};
  }
  function resultOf(match={}){
    const status = String(match.status || match.state || '').toLowerCase();
    if(status.includes('annul')) return {code:'cancelled', label:'Annulé'};
    if(status && !status.includes('termin') && !status.includes('done') && !status.includes('final')) return {code:'planned', label:'À venir'};
    const score = scoreOf(match);
    if(score.forGoals > score.againstGoals) return {code:'win', label:'Victoire'};
    if(score.forGoals < score.againstGoals) return {code:'loss', label:'Défaite'};
    return {code:'draw', label:'Nul'};
  }
  global.TeamProfileFilters = {periodFromState, rowInPeriod, filterRows, filterMatches, seasonsFromCollections, venueOf, scoreOf, resultOf};
})(window);
