// Transactional persistence reserved for future post-match entry modes.
// This service is intentionally not connected to the existing Live workflow.

(function(global){
  const MAX_TRANSACTION_WRITES = 500;
  const MAX_DOCUMENT_BYTES = 1_000_000;
  const POST_MATCH_MODES = Object.freeze(['QUICK_POST_MATCH', 'FULL_POST_MATCH']);

  function dependency(name, commonJsPath){
    if(global[name]) return global[name];
    if(typeof require === 'function') return require(commonJsPath);
    return null;
  }

  const Persistence = dependency('CoachPulseMatchPersistence', './match-persistence-service.js');
  const Statistics = dependency('CoachPulseMatchStatistics', './match-statistics-service.js');
  const Permissions = dependency('CoachPulsePermissionsService', './permissions-service.js');

  function failure(code, message, details={}){
    return {ok:false, status:'REJECTED', code, message, ...details};
  }

  function text(value){ return String(value || '').trim(); }

  function documentData(snapshot){
    return snapshot && typeof snapshot.data === 'function' ? snapshot.data() : null;
  }

  function documentExists(snapshot){
    return Boolean(snapshot && (typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists));
  }

  function queryDocuments(snapshot){
    return Array.isArray(snapshot?.docs) ? snapshot.docs : [];
  }

  function byteSize(value){
    const json = JSON.stringify(value);
    if(typeof TextEncoder !== 'undefined') return new TextEncoder().encode(json).length;
    return typeof Buffer !== 'undefined' ? Buffer.byteLength(json, 'utf8') : json.length * 2;
  }

  function assertDocumentSize(label, value){
    const bytes = byteSize(value);
    if(bytes > MAX_DOCUMENT_BYTES){
      throw Object.assign(new Error(`${label} depasse la taille documentaire autorisee.`), {code:'DOCUMENT_TOO_LARGE', bytes});
    }
  }

  function authorize(profile, matchSnapshot){
    if(!Permissions?.canEditModule(profile, {id:'stats', active:true})){
      return failure('PERMISSION_DENIED', 'Le profil ne peut pas modifier le module stats.');
    }
    const teamIds = [matchSnapshot?.teamId, ...(Array.isArray(matchSnapshot?.teamIds) ? matchSnapshot.teamIds : [])]
      .map(text).filter(Boolean);
    if(!teamIds.length || !teamIds.some(teamId => Permissions.canAccessTeam(profile, teamId))){
      return failure('TEAM_SCOPE_DENIED', "Le profil n'est autorise pour aucune equipe du match.");
    }
    return null;
  }

  function normalizedMatchSnapshot(matchSnapshot, matchId, nextRevision, serverTimestamp){
    const players = Statistics.normalizePlayers(matchSnapshot.players || {});
    const opponentSource = matchSnapshot.opp || matchSnapshot.opponent || {};
    const normalized = {
      ...matchSnapshot,
      matchId,
      players,
      ...(Object.prototype.hasOwnProperty.call(matchSnapshot, 'opp') ? {opp:Statistics.normalizeOpponentStats(opponentSource)} : {}),
      ...(Object.prototype.hasOwnProperty.call(matchSnapshot, 'opponent') ? {opponent:Statistics.normalizeOpponentStats(opponentSource)} : {}),
      schemaVersion:Persistence.SCHEMA_VERSION,
      revision:nextRevision,
      updatedAt:serverTimestamp
    };
    delete normalized.revisionState;
    return normalized;
  }

  function normalizeEvent(event, matchId, matchSnapshot, serverTimestamp){
    const eventId = Persistence.eventIdentifier(event);
    return {
      ...event,
      eventId,
      matchId,
      teamId:matchSnapshot.teamId,
      ...(Array.isArray(matchSnapshot.teamIds) ? {teamIds:matchSnapshot.teamIds} : {}),
      updatedAt:serverTimestamp
    };
  }

  function validateRequest(input){
    const matchId = text(input.matchId);
    if(!matchId) return failure('INVALID_MATCH_ID', 'Un matchId stable est obligatoire.');
    if(!POST_MATCH_MODES.includes(input.matchSnapshot?.entryMode)){
      return failure('INVALID_ENTRY_MODE', 'Ce service accepte uniquement les modes Apres-match.');
    }
    if(!text(input.matchSnapshot?.teamId)){
      return failure('INVALID_TEAM_SCOPE', 'Un teamId canonique est obligatoire pour une sauvegarde Apres-match.');
    }
    const expected = Persistence.revisionInfo(input.expectedRevision);
    if(!expected.valid) return failure('INVALID_EXPECTED_REVISION', 'La revision attendue est invalide.');
    if(!Array.isArray(input.nextEvents)) return failure('INVALID_EVENTS', 'nextEvents doit etre une liste.');
    if(input.deletionStrategy && !Persistence.DELETION_STRATEGIES.includes(input.deletionStrategy)){
      return failure('INVALID_DELETION_STRATEGY', 'La strategie de suppression est invalide.');
    }
    return null;
  }

  async function savePostMatchTransactional(input={}){
    const invalid = validateRequest(input);
    if(invalid) return invalid;
    const denied = authorize(input.profile, input.matchSnapshot);
    if(denied) return denied;

    const firestore = input.firestore || {};
    const required = ['runTransaction','doc','collection','query','where','getDocs','serverTimestamp'];
    const missing = required.filter(name => typeof firestore[name] !== 'function');
    if(missing.length) return failure('INVALID_FIRESTORE_ADAPTER', `Adaptateur Firestore incomplet: ${missing.join(', ')}.`);

    const matchId = text(input.matchId);
    const matchRef = firestore.doc(input.db, 'matches', matchId);
    const eventsQuery = firestore.query(
      firestore.collection(input.db, 'matchEvents'),
      firestore.where('matchId', '==', matchId),
      firestore.where('teamId', '==', input.matchSnapshot.teamId)
    );

    try{
      // The Web Firestore Transaction API reads DocumentReferences only. Discover
      // the scoped event references first, then re-read every document inside the
      // transaction so their contents participate in conflict detection.
      const discoveredEvents = queryDocuments(await firestore.getDocs(eventsQuery));
      return await firestore.runTransaction(input.db, async transaction => {
        // Firestore requires every read before the first write in a transaction.
        const remoteMatchSnapshot = await transaction.get(matchRef);
        const remoteEventSnapshots = await Promise.all(discoveredEvents.map(snapshot => transaction.get(
          snapshot.ref || firestore.doc(input.db, 'matchEvents', text(snapshot.id))
        )));
        const remoteMatch = documentExists(remoteMatchSnapshot) ? (documentData(remoteMatchSnapshot) || {}) : {};
        const comparison = Persistence.compareRevisions(input.expectedRevision, remoteMatch.revision);
        if(!comparison.ok) return failure(comparison.code, comparison.message, {
          conflict:comparison.conflict,
          expectedRevision:comparison.expectedRevision,
          remoteRevision:comparison.remoteRevision
        });

        const remoteEvents = remoteEventSnapshots.filter(documentExists).map(snapshot => ({
          ...(documentData(snapshot) || {}),
          eventId:Persistence.eventIdentifier(documentData(snapshot) || {}) || text(snapshot.id)
        }));
        const reconciliation = Persistence.reconcileEvents(remoteEvents, input.nextEvents, {
          deletionStrategy:input.deletionStrategy || 'PHYSICAL',
          nextEventsComplete:input.nextEventsComplete === true
        });
        const writes = 1 + reconciliation.added.length + reconciliation.modified.length + reconciliation.removed.length;
        if(writes > MAX_TRANSACTION_WRITES){
          return failure('TRANSACTION_TOO_LARGE', `La sauvegarde exige ${writes} ecritures, au-dela de la limite de ${MAX_TRANSACTION_WRITES}.`, {writes});
        }

        const timestamp = firestore.serverTimestamp();
        const canonicalMatch = normalizedMatchSnapshot(input.matchSnapshot, matchId, comparison.nextRevision, timestamp);
        assertDocumentSize('Le snapshot du match', canonicalMatch);
        const eventWrites = [...reconciliation.added, ...reconciliation.modified].map(change => {
          const source = change.event || change.after;
          const data = normalizeEvent(source, matchId, input.matchSnapshot, timestamp);
          assertDocumentSize(`L'evenement ${change.eventId}`, data);
          return {eventId:change.eventId, data};
        });
        const removals = reconciliation.removed.map(change => {
          const data = change.strategy === 'LOGICAL'
            ? normalizeEvent(change.tombstone, matchId, input.matchSnapshot, timestamp)
            : null;
          if(data) assertDocumentSize(`L'evenement ${change.eventId}`, data);
          return {...change, data};
        });

        transaction.set(matchRef, canonicalMatch, {merge:true});
        eventWrites.forEach(write => transaction.set(
          firestore.doc(input.db, 'matchEvents', write.eventId), write.data, {merge:true}
        ));
        removals.forEach(removal => {
          const ref = firestore.doc(input.db, 'matchEvents', removal.eventId);
          if(removal.strategy === 'LOGICAL') transaction.set(ref, removal.data, {merge:true});
          else transaction.delete(ref);
        });

        return {
          ok:true,
          status:'SAVED',
          code:'POST_MATCH_SAVED',
          matchId,
          previousRevision:comparison.remoteRevision,
          revision:comparison.nextRevision,
          writes,
          events:{
            added:reconciliation.added.length,
            modified:reconciliation.modified.length,
            removed:reconciliation.removed.length,
            unchanged:reconciliation.unchanged.length,
            deletionStrategy:reconciliation.deletionStrategy,
            nextEventsComplete:reconciliation.nextEventsComplete
          }
        };
      });
    }catch(error){
      return failure(error?.code || 'TRANSACTION_FAILED', error?.message || 'La transaction Firestore a echoue.', {cause:error});
    }
  }

  const service = {MAX_TRANSACTION_WRITES, MAX_DOCUMENT_BYTES, POST_MATCH_MODES, savePostMatchTransactional};
  global.CoachPulsePostMatchTransactionalPersistence = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
