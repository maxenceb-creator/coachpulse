// Shared Firestore query contract for team-scoped reads.

(function(global){
  const DEFAULT_CHUNK_SIZE = 10;

  function cleanTeamIds(teamIds=[]){
    return [...new Set((Array.isArray(teamIds) ? teamIds : [])
      .map(value => String(value || '').trim())
      .filter(Boolean))];
  }

  function chunks(values=[], size=DEFAULT_CHUNK_SIZE){
    const rows = cleanTeamIds(values);
    const out = [];
    for(let index=0;index<rows.length;index+=size) out.push(rows.slice(index,index+size));
    return out;
  }

  function documentRow(snapshot){ return {id:snapshot.id, ...snapshot.data()}; }

  function firestoreDiagnostic(error, context={}){
    const fields = ['task','module','page','function','collection','operation','field','operator','values','teamIds','playerId','matchId','query','critical'];
    const diagnostic = {};
    fields.forEach(field => {
      const value = context[field];
      if(value !== undefined && value !== null && value !== '') diagnostic[field] = Array.isArray(value) ? [...value] : value;
    });
    diagnostic.firebaseCode = String(error?.code || context.firebaseCode || 'unknown');
    diagnostic.firebaseMessage = String(error?.message || context.firebaseMessage || error || 'unknown');
    diagnostic.critical = context.critical === true;
    return diagnostic;
  }

  function reportFirestoreError(error, context={}, logger){
    const diagnostic = firestoreDiagnostic(error, context);
    const output = typeof logger === 'function' ? logger : console.error;
    output('[CoachPulse Firestore Diagnostic]', diagnostic);
    return diagnostic;
  }

  function diagnosticContext(options, collectionName, teamIds, field, operator, values){
    return {
      ...(options.diagnostic || {}), collection:collectionName, operation:'LIST', teamIds,
      field, operator, values,
      query:`where(${field}, ${operator}, ${JSON.stringify(values)})`
    };
  }

  async function readTeamScopedByIdOrIds(collectionName, teamIds, options={}){
    const ids = cleanTeamIds(teamIds);
    if(!ids.length) return [];
    const {firebaseFns, db} = options;
    if(!firebaseFns || !db) throw new Error('Connexion Firebase requise.');
    const fields = options.fields || ['teamId','teamIds'];
    const reads = [];
    chunks(ids, options.chunkSize || DEFAULT_CHUNK_SIZE).forEach(teamChunk => {
      fields.forEach(field => {
        const operator = field === 'teamId' ? 'in' : 'array-contains-any';
        const queryRef = firebaseFns.query(firebaseFns.collection(db, collectionName), firebaseFns.where(field, operator, teamChunk));
        reads.push(firebaseFns.getDocs(queryRef).catch(error => {
          const diagnostic = diagnosticContext(options, collectionName, ids, field, operator, teamChunk);
          if(typeof options.onError === 'function') options.onError(error, firestoreDiagnostic(error, diagnostic));
          else reportFirestoreError(error, diagnostic);
          if(options.ignoreErrors === true) return null;
          error.coachPulseDiagnostic = diagnostic;
          throw error;
        }));
      });
    });
    const snapshots = await Promise.all(reads);
    const byId = new Map();
    snapshots.filter(Boolean).forEach(snapshot => snapshot.forEach(item => {
      const row = options.mapDocument ? options.mapDocument(item) : documentRow(item);
      const id = String(row?.id || item.id || '').trim();
      if(id) byId.set(id, row);
    }));
    return [...byId.values()];
  }

  function scopedReader(collectionName, teamIds, options){ return readTeamScopedByIdOrIds(collectionName, teamIds, options); }
  function readPlayerRosterByTeams(teamIds, options={}){ return scopedReader('players', teamIds, {...options, fields:['teamId','teamIds','rosterTeamIds']}); }
  function readMatchesByTeams(teamIds, options={}){ return scopedReader('matches', teamIds, options); }
  function readMatchEventsByTeams(teamIds, options={}){ return scopedReader('matchEvents', teamIds, options); }
  function readSessionsByTeams(teamIds, options={}){ return scopedReader('sessions', teamIds, options); }
  function readAttendanceByTeams(teamIds, options={}){ return scopedReader('attendance', teamIds, options); }

  const service = {
    cleanTeamIds, chunks, firestoreDiagnostic, reportFirestoreError, readTeamScopedByIdOrIds, readPlayerRosterByTeams,
    readMatchesByTeams, readMatchEventsByTeams, readSessionsByTeams, readAttendanceByTeams
  };
  global.CoachPulseFirestoreQueryService = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
