// CoachPulse shared presence events service.
// Converts local Presence module events into profile-ready sessions and attendance rows.

(function(global){
  const STORAGE_KEY = 'coachpulse:presenceEvents:v1';
  const STATUS_MAP = {
    present:{code:'P', label:'Présente'},
    absent:{code:'A', label:'Absente'},
    late:{code:'R', label:'En retard'},
    sick:{code:'M', label:'Malade'},
    injured:{code:'B', label:'Blessée'},
    P:{code:'P', label:'Présente'},
    A:{code:'A', label:'Absente'},
    R:{code:'R', label:'En retard'},
    M:{code:'M', label:'Malade'},
    B:{code:'B', label:'Blessée'}
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
    return STATUS_MAP[raw] || STATUS_MAP[raw.toUpperCase()] || STATUS_MAP.absent;
  }
  function eventId(event={}){
    return text(event.id || event.sessionId || event.eventId);
  }
  function sessionFromEvent(event={}){
    const sessionId = eventId(event);
    return {
      id:sessionId,
      sessionId,
      date:text(event.date),
      startTime:text(event.startTime || event.start),
      endTime:text(event.endTime || event.end),
      duration:Number(event.duration || 0),
      type:text(event.type || 'entrainement'),
      theme:text(event.title || event.theme || 'Séance'),
      teamId:text(event.teamId),
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
      return {
        status:status.code,
        statusLabel:status.label,
        minutes:Number(raw.minutes ?? event.duration ?? 0) || 0,
        comment:text(raw.comment || raw.note)
      };
    }
    const status = normalizeStatus(raw);
    return {
      status:status.code,
      statusLabel:status.label,
      minutes:status.code === 'P' || status.code === 'R' ? Number(event.duration || 0) : 0,
      comment:''
    };
  }
  function attendanceRowsFromEvent(event={}){
    const sessionId = eventId(event);
    const attendance = event.attendance || {};
    return Object.entries(attendance).map(([playerId, raw]) => {
      const entry = attendanceEntryFromRaw(raw, event);
      const attendanceId = text(raw?.attendanceId) || `local-attendance-${sessionId}-${playerId}`;
      return {
        id:attendanceId,
        attendanceId,
        sessionId,
        playerId:text(playerId),
        teamId:text(event.teamId),
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
    }).filter(row => row.sessionId && row.playerId);
  }
  function readEvents(){
    const rows = readJson(STORAGE_KEY, []);
    return Array.isArray(rows) ? rows.filter(event => eventId(event)) : [];
  }
  function uniqueRows(rows=[], keyFn){
    return [...new Map(rows.map(row => [keyFn(row), row])).values()];
  }
  function collectionsFromEvents(events=[]){
    return {
      sessions:uniqueRows(events.map(sessionFromEvent).filter(row => row.sessionId), row => row.sessionId),
      attendance:uniqueRows(events.flatMap(attendanceRowsFromEvent), row => row.attendanceId)
    };
  }
  function collectionsForTeam(teamId){
    const target = text(teamId);
    return collectionsFromEvents(readEvents().filter(event => !target || text(event.teamId) === target));
  }
  function collectionsForPlayer(playerIds=[]){
    const ids = new Set((Array.isArray(playerIds) ? playerIds : [playerIds]).map(text).filter(Boolean));
    const events = readEvents();
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
    attendanceRowsFromEvent,
    collectionsFromEvents,
    collectionsForTeam,
    collectionsForPlayer
  };
})(window);
