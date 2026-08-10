(function(global){
  const Filters = global.PlayerProfileFilters;
  function n(value){ const out = Number(value); return Number.isFinite(out) ? out : 0; }
  function latest(rows=[]){ return rows.slice().sort((a,b) => Filters.dateOf(b).localeCompare(Filters.dateOf(a)))[0] || null; }
  function text(value){ return String(value ?? '').trim(); }
  function calculateBmi(heightCm, weightKg){
    const height = Number(heightCm || 0) / 100;
    const weight = Number(weightKg || 0);
    return height && weight ? Number((weight / (height * height)).toFixed(2)) : null;
  }
  function readMedicalProfiles(){
    try{ return JSON.parse(localStorage.getItem('coachpulse:medicalProfiles') || '{}') || {}; }
    catch(_e){ return {}; }
  }
  function valueFrom(row={}, keys=[]){
    for(const key of keys){
      const value = row[key] ?? row.profile?.[key] ?? row.morphology?.[key] ?? row.measurements?.[key] ?? row.medicalProfile?.[key];
      if(value != null && text(value) !== '') return value;
    }
    return '';
  }
  function teamMatches(row={}, player={}){
    const rowTeamId = text(row.teamId || row.playerSnapshot?.teamId || row.profile?.teamId || row.morphology?.teamId || row.medicalProfile?.teamId);
    const playerTeamId = text(player.teamId || player.playerSnapshot?.teamId);
    return !rowTeamId || !playerTeamId || rowTeamId === playerTeamId;
  }
  function normalizeMedicalProfile(row={}, player={}){
    const explicitBmi = valueFrom(row, ['imc','bmi']);
    const heightCm = valueFrom(row, ['heightCm','tailleCm','taille','height']);
    const weightKg = valueFrom(row, ['weightKg','poidsKg','poids','weight']);
    const computed = calculateBmi(heightCm, weightKg);
    const value = Number(explicitBmi || computed);
    if(!Number.isFinite(value) || !teamMatches(row, player)) return null;
    return {
      value,
      heightCm,
      weightKg,
      teamId:text(row.teamId || row.profile?.teamId || row.playerSnapshot?.teamId || player.teamId),
      season:text(row.season || row.saison || row.profile?.season || row.medicalProfile?.season),
      date:text(row.date || row.updatedAt || row.updatedAtIso || row.createdAt || row.createdAtIso)
    };
  }
  function medicalProfileBmi(player={}, collections={}, state={}){
    const playerId = text(player.playerId || player.id);
    const stored = readMedicalProfiles();
    const storedRows = [];
    const profile = stored[playerId];
    if(profile) storedRows.push({playerId, ...profile});
    if(Array.isArray(profile?.history)) storedRows.push(...profile.history.map(row => ({playerId, ...row})));
    const rows = [
      ...storedRows,
      ...(collections.injuries || []),
      ...(collections.injuryUpdates || []),
      ...(collections.medicalAppointments || []),
      ...(collections.rehabRoutines || []),
      ...(collections.medicalFollowUps || [])
    ];
    const normalized = rows.map(row => normalizeMedicalProfile(row, player)).filter(Boolean);
    const inPeriod = normalized.filter(row => {
      const hasTemporalData = !!(row.season || row.date);
      return hasTemporalData ? Filters.rowInPeriod(row, Filters.periodFromState(state)) : true;
    });
    return latest(inPeriod.length ? inPeriod : normalized);
  }
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
  function attendanceStatus(row={}){
    return String(row.status || row.code || row.statusCode || '').trim().toUpperCase();
  }
  function isCountedAttendance(row={}){
    return !!attendanceStatus(row) && !['NC','NOT-CONVOKED','NON CONVOQUEE','NON CONVOQUÉE'].includes(attendanceStatus(row));
  }
  function isPresentAttendance(row={}){
    return ['P','PRESENT','PRÉSENT','PRESENTE','PRÉSENTE','R','RETARD','LATE'].includes(attendanceStatus(row));
  }
  function summarize(player, collections, state){
    const attendance = Filters.filterRows(collections.attendance, state).filter(isCountedAttendance);
    const sessions = Filters.filterRows(collections.sessions, state);
    const matchEvents = Filters.filterRows(collections.matchEvents, state);
    const technicalTests = Filters.filterRows(collections.technicalTests, state);
    const physicalTests = Filters.filterRows(collections.physicalTests, state);
    const injuries = Filters.filterRows(collections.injuries, state);
    const medical = Filters.filterRows([...(collections.injuryUpdates || []), ...(collections.medicalAppointments || []), ...(collections.rehabRoutines || []), ...(collections.medicalFollowUps || [])], state);
    const convocations = Filters.filterRows(collections.convocations || [], state);
    const individualReports = Filters.filterRows(collections.individualReports || [], state);
    const bmi = medicalProfileBmi(player, collections, state);
    const present = attendance.filter(isPresentAttendance).length;
    const minutes = attendance.reduce((sum,row) => sum + n(row.minutes || row.duration || row.charge), 0);
    const latestPhysical = latest(physicalTests);
    const latestTechnical = latest(technicalTests);
    const actions = countActions(matchEvents);
    const linkedCounts = {
      presences:attendance.length,
      seances:sessions.length,
      matchs:matchEvents.length,
      testsTechniques:technicalTests.length,
      testsAthletiques:physicalTests.length,
      blessures:injuries.length,
      suiviMedical:medical.length,
      convocations:convocations.length,
      bilansIndividuels:individualReports.length
    };
    return {
      player,
      attendance, sessions, matchEvents, technicalTests, physicalTests, injuries, medical, convocations, individualReports,
      linkedCounts,
      kpis:{
        presenceRate:attendance.length ? Math.round((present / attendance.length) * 100) : 0,
        sessions:attendance.length || sessions.length,
        minutes,
        matches:new Set(matchEvents.map(row => row.matchId).filter(Boolean)).size,
        injuries:injuries.length,
        medical:medical.length,
        bmi:bmi?.value || null
      },
      medicalProfile:{
        bmi,
        hasBmi:!!bmi
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
  global.PlayerProfileStats = {n, latest, countActions, testValue, attendanceStatus, isCountedAttendance, isPresentAttendance, summarize, trend};
})(window);
