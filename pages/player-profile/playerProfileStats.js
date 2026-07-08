(function(global){
  const Filters = global.PlayerProfileFilters;
  function n(value){ const out = Number(value); return Number.isFinite(out) ? out : 0; }
  function latest(rows=[]){ return rows.slice().sort((a,b) => Filters.dateOf(b).localeCompare(Filters.dateOf(a)))[0] || null; }
  function countActions(events=[]){
    const out = {};
    events.forEach(row => {
      const key = String(row.action || row.type || row.eventType || 'Action').trim() || 'Action';
      out[key] = (out[key] || 0) + 1;
    });
    return out;
  }
  function testValue(row={}, keys=[]){
    for(const key of keys){
      if(row.tests && row.tests[key] != null) return n(row.tests[key]);
      if(row[key] != null) return n(row[key]);
      if(row.testName === key || row.testType === key) return n(row.value);
    }
    return 0;
  }
  function summarize(player, collections, state){
    const attendance = Filters.filterRows(collections.attendance, state);
    const sessions = Filters.filterRows(collections.sessions, state);
    const matchEvents = Filters.filterRows(collections.matchEvents, state);
    const technicalTests = Filters.filterRows(collections.technicalTests, state);
    const physicalTests = Filters.filterRows(collections.physicalTests, state);
    const injuries = Filters.filterRows(collections.injuries, state);
    const medical = Filters.filterRows([...(collections.injuryUpdates || []), ...(collections.medicalAppointments || []), ...(collections.rehabRoutines || []), ...(collections.medicalFollowUps || [])], state);
    const convocations = Filters.filterRows(collections.convocations || [], state);
    const individualReports = Filters.filterRows(collections.individualReports || [], state);
    const present = attendance.filter(row => ['P','PRESENT','PRÉSENT'].includes(String(row.status || row.code || '').toUpperCase())).length;
    const minutes = attendance.reduce((sum,row) => sum + n(row.minutes || row.duration || row.charge), 0);
    const latestPhysical = latest(physicalTests);
    const latestTechnical = latest(technicalTests);
    const actions = countActions(matchEvents);
    return {
      player,
      attendance, sessions, matchEvents, technicalTests, physicalTests, injuries, medical, convocations, individualReports,
      kpis:{
        presenceRate:attendance.length ? Math.round((present / attendance.length) * 100) : 0,
        sessions:attendance.length || sessions.length,
        minutes,
        matches:new Set(matchEvents.map(row => row.matchId).filter(Boolean)).size,
        injuries:injuries.length,
        medical:medical.length
      },
      latest:{
        physical:latestPhysical,
        technical:latestTechnical,
        vmi:testValue(latestPhysical || {}, ['vmi','VMI']),
        cmj:testValue(latestPhysical || {}, ['cmj','CMJ']),
        technicalScore:testValue(latestTechnical || {}, ['score','global','note'])
      },
      actions
    };
  }
  function trend(current=0, previous=0, lowerIsBetter=false){
    const diff = current - previous;
    const good = lowerIsBetter ? diff < 0 : diff > 0;
    return {diff, label:diff === 0 ? 'stable' : (good ? 'progression' : 'régression'), className:diff === 0 ? 'trend-flat' : (good ? 'trend-up' : 'trend-down')};
  }
  global.PlayerProfileStats = {n, latest, countActions, testValue, summarize, trend};
})(window);
