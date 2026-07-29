(function(global){
  const Stats = global.PlayerProfileStats;
  const Filters = global.PlayerProfileFilters;
  function summaryForPeriod(player, collections, baseState, period){
    return Stats.summarize(player, collections, {...baseState, filters:{...baseState.filters, ...period}});
  }
  function compareSeasons(player, collections, state){
    const first = state.filters.compareSeasonA || state.filters.season;
    const second = state.filters.compareSeasonB || global.PlayerProfileData.currentSeason();
    const a = summaryForPeriod(player, collections, state, {periodMode:'season', season:first});
    const b = summaryForPeriod(player, collections, state, {periodMode:'season', season:second});
    return [
      {label:'Présence', a:a.kpis.presenceRate, b:b.kpis.presenceRate, unit:'%', trend:Stats.trend(b.kpis.presenceRate, a.kpis.presenceRate)},
      {label:'Minutes', a:a.kpis.minutes, b:b.kpis.minutes, unit:'min', trend:Stats.trend(b.kpis.minutes, a.kpis.minutes)},
      {label:'Matchs', a:a.kpis.matches, b:b.kpis.matches, unit:'', trend:Stats.trend(b.kpis.matches, a.kpis.matches)},
      {label:'VMI', a:a.latest.vmi, b:b.latest.vmi, unit:'km/h', trend:Stats.trend(b.latest.vmi, a.latest.vmi)},
      {label:'CMJ', a:a.latest.cmj, b:b.latest.cmj, unit:'cm', trend:Stats.trend(b.latest.cmj, a.latest.cmj)},
      {label:'Blessures', a:a.kpis.injuries, b:b.kpis.injuries, unit:'', trend:Stats.trend(b.kpis.injuries, a.kpis.injuries, true)}
    ];
  }
  function comparePlayers(players=[], collectionMap={}, state){
    return players.map(player => {
      const collections = collectionMap[player.playerId] || {};
      const summary = Stats.summarize(player, collections, state);
      return {player, summary};
    });
  }
  global.PlayerProfileCompare = {compareSeasons, comparePlayers};
})(window);
