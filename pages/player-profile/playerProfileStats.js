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
      date:text(row.measuredAt || row.date || row.updatedAtIso)
    };
  }
  function medicalProfileBmi(player={}, collections={}, state={}){
    const playerId = text(player.playerId || player.id);
    const rows = (collections.playerMeasurements || []).filter(row => text(row.playerId) === playerId);
    const normalized = rows.map(row => normalizeMedicalProfile(row, player)).filter(Boolean);
    return latest(normalized);
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
  function attendanceBreakdown(attendance=[], sessions=[]){
    const statusCounts = {
      present:0,
      late:0,
      absenceNonJustifiee:0,
      absenceJustifiee:0,
      malade:0,
      blessee:0,
      poleEspoir:0,
      selection:0,
      groupePro:0,
      autresAbsences:0
    };
    attendance.forEach(row => {
      const status = attendanceStatus(row);
      if(!isCountedAttendance(row)) return;
      if(['P','PRESENT','PRÉSENT','PRESENTE','PRÉSENTE'].includes(status)) statusCounts.present += 1;
      else if(['R','RETARD','LATE'].includes(status)){
        statusCounts.present += 1;
        statusCounts.late += 1;
      }else if(['A','ANJ','ABSENT','ABSENTE','ABSENCE NON JUSTIFIEE','ABSENCE NON JUSTIFIÉE'].includes(status)) statusCounts.absenceNonJustifiee += 1;
      else if(['AJ','EXCUSED','ABSENCE JUSTIFIEE','ABSENCE JUSTIFIÉE'].includes(status)) statusCounts.absenceJustifiee += 1;
      else if(['M','MALADE','SICK'].includes(status)) statusCounts.malade += 1;
      else if(['B','BLESSEE','BLESSÉE','INJURED'].includes(status)) statusCounts.blessee += 1;
      else if(['PO','POLE','PÔLE','PÔLE ESPOIR','POLE ESPOIR'].includes(status)) statusCounts.poleEspoir += 1;
      else if(['D','S','DISTRICT','SELECTION','SÉLECTION'].includes(status)) statusCounts.selection += 1;
      else if(['D2','GROUPE PRO','ENTRAINEMENT GROUPE PRO','ENTRAÎNEMENT GROUPE PRO'].includes(status)) statusCounts.groupePro += 1;
      else if(status) statusCounts.autresAbsences += 1;
    });
    const absenceTotal = statusCounts.absenceNonJustifiee
      + statusCounts.absenceJustifiee
      + statusCounts.malade
      + statusCounts.blessee
      + statusCounts.poleEspoir
      + statusCounts.selection
      + statusCounts.groupePro
      + statusCounts.autresAbsences;
    const totalCategorySessions = Math.max(sessions.length, attendance.length);
    return {
      totalCategorySessions,
      presentSessions:statusCounts.present,
      lateSessions:statusCounts.late,
      absenceTotal,
      statusCounts,
      presenceRate:totalCategorySessions ? Math.round((statusCounts.present / totalCategorySessions) * 100) : 0
    };
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
    const playerMeasurements = (collections.playerMeasurements || []).slice().sort((a,b)=>text(b.measuredAt).localeCompare(text(a.measuredAt)));
    const bmi = medicalProfileBmi(player, collections, state);
    const minutes = attendance.reduce((sum,row) => sum + n(row.minutes || row.duration || row.charge), 0);
    const latestPhysical = latest(physicalTests);
    const latestTechnical = latest(technicalTests);
    const actions = countActions(matchEvents);
    const attendanceSummary = attendanceBreakdown(attendance, sessions);
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
      attendance, sessions, matchEvents, technicalTests, physicalTests, playerMeasurements, injuries, medical, convocations, individualReports,
      linkedCounts,
      kpis:{
        presenceRate:attendanceSummary.presenceRate,
        sessions:attendanceSummary.totalCategorySessions,
        minutes,
        matches:new Set(matchEvents.map(row => row.matchId).filter(Boolean)).size,
        injuries:injuries.length,
        medical:medical.length,
        bmi:bmi?.value || null
      },
      attendanceSummary,
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
  global.PlayerProfileStats = {n, latest, countActions, testValue, attendanceStatus, attendanceBreakdown, isCountedAttendance, isPresentAttendance, summarize, trend};
})(window);
