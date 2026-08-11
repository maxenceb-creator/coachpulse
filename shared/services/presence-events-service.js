// CoachPulse shared presence events service.
// Converts local Presence module events into profile-ready sessions and attendance rows.

(function(global){
  const STORAGE_KEY = 'coachpulse:presenceEvents:v1';
  const RETIRED_PRESENCE_SEASONS = new Set(['2025-2026']);
  const STATUS_MAP = {
    present:{code:'P', label:'Présente'},
    absent:{code:'A', label:'Absente'},
    excused:{code:'AJ', label:'Absence justifiée'},
    late:{code:'R', label:'En retard'},
    'not-convoked':{code:'NC', label:'Non convoquée'},
    'non-convoquee':{code:'NC', label:'Non convoquée'},
    'non-convoquée':{code:'NC', label:'Non convoquée'},
    'NOT-CONVOKED':{code:'NC', label:'Non convoquée'},
    'NON-CONVOQUEE':{code:'NC', label:'Non convoquée'},
    'NON-CONVOQUÉE':{code:'NC', label:'Non convoquée'},
    sick:{code:'M', label:'Malade'},
    injured:{code:'B', label:'Blessée'},
    pole:{code:'PO', label:'Pôle Espoir'},
    district:{code:'D', label:'District'},
    d2:{code:'D2', label:'Entraînement groupe pro'},
    P:{code:'P', label:'Présente'},
    A:{code:'A', label:'Absente'},
    ANJ:{code:'ANJ', label:'Absence non justifiée'},
    AJ:{code:'AJ', label:'Absence justifiée'},
    R:{code:'R', label:'En retard'},
    NC:{code:'NC', label:'Non convoquée'},
    M:{code:'M', label:'Malade'},
    B:{code:'B', label:'Blessée'},
    PO:{code:'PO', label:'Pôle Espoir'},
    D:{code:'D', label:'District'},
    D2:{code:'D2', label:'Entraînement groupe pro'}
  };

  function text(value){ return String(value ?? '').trim(); }
  function readJson(key, fallback){
    try{
      const value = global.localStorage?.getItem(key);
      return value ? JSON.parse(value) : fallback;
    }catch(_error){
      return fallback;
    }
  }
  function normalizeStatus(value){
    const raw = text(value);
    if(!raw) return null;
    return STATUS_MAP[raw] || STATUS_MAP[raw.toUpperCase()] || null;
  }
  function parseDate(value){
    const raw = text(value);
    if(!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(iso){
      const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const fr = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if(fr){
      const date = new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function eventEndDateTime(event={}){
    const snapshot = event.sessionSnapshot || {};
    const date = parseDate(event.date || snapshot.date || event.startDate || event.day || event.start);
    if(!date) return null;
    const time = text(event.endTime || event.end || snapshot.endTime || snapshot.end || event.startTime || event.start || '23:59');
    const match = time.match(/^(\d{1,2}):(\d{2})/);
    if(match) date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    else date.setHours(23, 59, 59, 999);
    return date;
  }
  function isElapsedEvent(event={}, now=new Date()){
    const end = eventEndDateTime(event);
    return !end || end <= now;
  }
  function seasonFromDateValue(value){
    const date = parseDate(value);
    if(!date) return '';
    const year = date.getFullYear();
    return date.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }
  function eventSeason(event={}){
    return text(event.season || event.saison || event.sessionSnapshot?.season || event.sessionSnapshot?.saison)
      || seasonFromDateValue(event.date || event.sessionSnapshot?.date || event.startDate || event.day || event.start);
  }
  function isRetiredPresenceSeasonEvent(event={}){
    return RETIRED_PRESENCE_SEASONS.has(eventSeason(event));
  }
  function uniqueTexts(values=[]){
    return [...new Set(values.map(text).filter(Boolean))];
  }
  function eventId(event={}){
    return text(event.id || event.sessionId || event.eventId);
  }
  function teamIdsFromEvent(event={}){
    return uniqueTexts([
      event.teamId,
      event.team_id,
      event.teamSnapshot?.teamId,
      event.sessionSnapshot?.teamId,
      ...(Array.isArray(event.teamIds) ? event.teamIds : []),
      ...(Array.isArray(event.teamSnapshot?.teamIds) ? event.teamSnapshot.teamIds : []),
      ...(Array.isArray(event.sessionSnapshot?.teamIds) ? event.sessionSnapshot.teamIds : [])
    ]);
  }
  function playerSnapshotFromRaw(raw={}, playerId='', event={}){
    const snapshot = raw && typeof raw === 'object' && raw.playerSnapshot && typeof raw.playerSnapshot === 'object'
      ? raw.playerSnapshot
      : {};
    const teamIds = uniqueTexts([
      ...(Array.isArray(snapshot.teamIds) ? snapshot.teamIds : []),
      ...(Array.isArray(raw?.teamIds) ? raw.teamIds : []),
      ...teamIdsFromEvent(event)
    ]);
    return {
      playerId:text(snapshot.playerId || playerId),
      nom:text(snapshot.nom || snapshot.lastName),
      prenom:text(snapshot.prenom || snapshot.firstName),
      displayName:text(snapshot.displayName || snapshot.name),
      team:text(snapshot.team || event.team),
      teamId:text(snapshot.teamId || raw?.teamId || event.teamId),
      teamIds,
      categorie:text(snapshot.categorie || snapshot.category || event.category || event.categorie),
      subCategory:text(snapshot.subCategory || snapshot.sousCategorie),
      photo:text(snapshot.photo)
    };
  }
  function sessionFromEvent(event={}){
    const sessionId = eventId(event);
    const teamIds = teamIdsFromEvent(event);
    return {
      id:sessionId,
      sessionId,
      date:text(event.date),
      startTime:text(event.startTime || event.start),
      endTime:text(event.endTime || event.end),
      duration:Number(event.duration || 0),
      procedure:event.procedure || event.sessionProcedure || {},
      type:text(event.type || 'entrainement'),
      theme:text(event.title || event.theme || 'Séance'),
      teamId:text(event.teamId),
      teamIds,
      teamSnapshot:{
        teamId:text(event.teamId),
        teamIds,
        name:text(event.team),
        category:text(event.category || event.categorie)
      },
      team:text(event.team),
      category:text(event.category || event.categorie),
      recurrence:text(event.recurrence),
      recurrenceId:text(event.recurrenceId),
      source:'Présences locales',
      createdAt:text(event.createdAt),
      updatedAt:text(event.updatedAt)
    };
  }
  function attendanceEntryFromRaw(raw, event={}){
    if(raw && typeof raw === 'object'){
      const status = normalizeStatus(raw.status);
      if(!status) return {status:'', statusLabel:'', minutes:0, comment:text(raw.comment || raw.note)};
      return {
        status:status.code,
        statusLabel:status.label,
        minutes:Number(raw.minutes ?? event.duration ?? 0) || 0,
        comment:text(raw.comment || raw.note)
      };
    }
    const status = normalizeStatus(raw);
    if(!status) return {status:'', statusLabel:'', minutes:0, comment:''};
    return {
      status:status.code,
      statusLabel:status.label,
      minutes:status.code === 'P' || status.code === 'R' ? Number(event.duration || 0) : 0,
      comment:''
    };
  }
  function attendanceRowsFromEvent(event={}){
    const sessionId = eventId(event);
    const eventTeamIds = teamIdsFromEvent(event);
    const sessionSnapshot = sessionFromEvent(event);
    const attendance = event.attendance || {};
    return Object.entries(attendance).map(([playerId, raw]) => {
      const entry = attendanceEntryFromRaw(raw, event);
      const attendanceId = text(raw?.attendanceId) || `local-attendance-${sessionId}-${playerId}`;
      const playerSnapshot = playerSnapshotFromRaw(raw, playerId, event);
      const teamIds = uniqueTexts([
        ...(Array.isArray(raw?.teamIds) ? raw.teamIds : []),
        ...(Array.isArray(playerSnapshot.teamIds) ? playerSnapshot.teamIds : []),
        ...eventTeamIds
      ]);
      return {
        id:attendanceId,
        attendanceId,
        sessionId,
        playerId:text(playerId),
        teamId:text(raw?.teamId || playerSnapshot.teamId || event.teamId),
        teamIds,
        sessionSnapshot,
        playerSnapshot:{...playerSnapshot, teamIds},
        team:text(event.team),
        date:text(event.date),
        status:entry.status,
        statusLabel:entry.statusLabel,
        minutes:entry.minutes,
        duration:entry.minutes,
        note:entry.comment,
        comment:entry.comment,
        source:'Présences locales',
        createdAt:text(event.createdAt),
        updatedAt:text(event.updatedAt)
      };
    }).filter(row => row.sessionId && row.playerId && row.status);
  }
  function readEvents(){
    const rows = readJson(STORAGE_KEY, []);
    if(!Array.isArray(rows)) return [];
    const kept = rows.filter(event => eventId(event) && !isRetiredPresenceSeasonEvent(event));
    if(kept.length !== rows.length){
      try{ global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(kept)); }catch(_error){}
    }
    return kept;
  }
  function uniqueRows(rows=[], keyFn){
    return [...new Map(rows.map(row => [keyFn(row), row])).values()];
  }
  function collectionsFromEvents(events=[]){
    const elapsedEvents = events.filter(event => isElapsedEvent(event));
    return {
      sessions:uniqueRows(elapsedEvents.map(sessionFromEvent).filter(row => row.sessionId), row => row.sessionId),
      attendance:uniqueRows(elapsedEvents.flatMap(attendanceRowsFromEvent), row => row.attendanceId)
    };
  }
  function collectionsForTeam(teamId){
    const target = text(teamId);
    return collectionsFromEvents(readEvents().filter(event => !target || teamIdsFromEvent(event).includes(target)));
  }
  function collectionsForPlayer(playerIds=[]){
    const ids = new Set((Array.isArray(playerIds) ? playerIds : [playerIds]).map(text).filter(Boolean));
    const events = readEvents().filter(event => isElapsedEvent(event));
    const attendance = events.flatMap(attendanceRowsFromEvent).filter(row => !ids.size || ids.has(row.playerId));
    const sessionIds = new Set(attendance.map(row => row.sessionId));
    return {
      sessions:collectionsFromEvents(events.filter(event => sessionIds.has(eventId(event)))).sessions,
      attendance
    };
  }

  global.CoachPulsePresenceEventsService = {
    STORAGE_KEY,
    readEvents,
    sessionFromEvent,
    teamIdsFromEvent,
    attendanceRowsFromEvent,
    isElapsedEvent,
    isRetiredPresenceSeasonEvent,
    collectionsFromEvents,
    collectionsForTeam,
    collectionsForPlayer
  };
})(window);
