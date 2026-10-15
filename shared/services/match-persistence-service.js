// CoachPulse versioned match persistence preparation.
// Pure helpers only: no DOM, storage, network or Firebase dependency.

(function(global){
  const SCHEMA_VERSION = 1;
  const ENTRY_MODES = Object.freeze(['LIVE', 'QUICK_POST_MATCH', 'FULL_POST_MATCH']);
  const STATS_SOURCES = Object.freeze(['EVENTS', 'MANUAL', 'MIXED']);
  const MATCH_STATUSES = Object.freeze(['DRAFT', 'COMPLETED']);
  const DELETION_STRATEGIES = Object.freeze(['PHYSICAL', 'LOGICAL']);

  function own(object, key){
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function isPlainObject(value){
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value){
    if(Array.isArray(value)) return value.map(clone);
    if(isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }

  function revisionInfo(value, {present=true}={}){
    if(!present) return {state:'ABSENT', valid:true, revision:0};
    if(Number.isSafeInteger(value) && value >= 0) return {state:'VALID', valid:true, revision:value};
    return {state:'INVALID', valid:false, revision:null};
  }

  function matchVersionInfo(match={}){
    return revisionInfo(match.revision, {present:own(match, 'revision')});
  }

  function compatibleMatch(match={}){
    const source = isPlainObject(match) ? match : {};
    const revision = matchVersionInfo(source);
    return {
      ...clone(source),
      schemaVersion:own(source, 'schemaVersion') ? source.schemaVersion : 0,
      revision:revision.revision,
      entryMode:own(source, 'entryMode') ? source.entryMode : 'LIVE',
      statsSource:own(source, 'statsSource') ? source.statsSource : 'EVENTS',
      status:own(source, 'status') ? source.status : 'COMPLETED',
      updatedAt:own(source, 'updatedAt') ? clone(source.updatedAt) : null,
      revisionState:revision.state
    };
  }

  function conflictMessage(expectedRevision, remoteRevision){
    return `Ce match a ete modifie depuis son ouverture (revision attendue ${expectedRevision}, revision distante ${remoteRevision}). Rechargez les donnees avant de corriger.`;
  }

  function compareRevisions(expected, remote){
    const expectedInfo = revisionInfo(expected, {present:expected !== undefined});
    const remoteInfo = revisionInfo(remote, {present:remote !== undefined});
    if(!expectedInfo.valid){
      return {ok:false, conflict:false, code:'INVALID_EXPECTED_REVISION', expectedRevision:null, remoteRevision:remoteInfo.revision, message:'La revision attendue est invalide.'};
    }
    if(!remoteInfo.valid){
      return {ok:false, conflict:false, code:'INVALID_REMOTE_REVISION', expectedRevision:expectedInfo.revision, remoteRevision:null, message:'La revision distante est invalide.'};
    }
    if(expectedInfo.revision !== remoteInfo.revision){
      return {
        ok:false,
        conflict:true,
        code:'REVISION_CONFLICT',
        expectedRevision:expectedInfo.revision,
        remoteRevision:remoteInfo.revision,
        message:conflictMessage(expectedInfo.revision, remoteInfo.revision)
      };
    }
    return {
      ok:true,
      conflict:false,
      code:'REVISION_MATCH',
      expectedRevision:expectedInfo.revision,
      remoteRevision:remoteInfo.revision,
      nextRevision:remoteInfo.revision + 1,
      message:'La revision distante correspond a la revision attendue.'
    };
  }

  function eventIdentifier(event={}){
    const identifier = event.eventId ?? event.id;
    return typeof identifier === 'string' ? identifier.trim() : '';
  }

  function equalValue(left, right){
    if(Object.is(left, right)) return true;
    if(Array.isArray(left) || Array.isArray(right)){
      return Array.isArray(left) && Array.isArray(right) && left.length === right.length
        && left.every((value, index) => equalValue(value, right[index]));
    }
    if(isPlainObject(left) || isPlainObject(right)){
      if(!isPlainObject(left) || !isPlainObject(right)) return false;
      const leftKeys = Object.keys(left).sort();
      const rightKeys = Object.keys(right).sort();
      return equalValue(leftKeys, rightKeys) && leftKeys.every(key => equalValue(left[key], right[key]));
    }
    return false;
  }

  function indexedEvents(events, label){
    if(!Array.isArray(events)) throw new TypeError(`${label} events must be an array.`);
    const index = new Map();
    events.forEach(event => {
      const eventId = eventIdentifier(event);
      if(!eventId) throw new TypeError(`${label} event is missing a stable identifier.`);
      if(index.has(eventId)) throw new TypeError(`${label} events contain duplicate identifier ${eventId}.`);
      index.set(eventId, event);
    });
    return index;
  }

  function reconcileEvents(previousEvents=[], nextEvents=[], {deletionStrategy='PHYSICAL', nextEventsComplete=false}={}){
    if(!DELETION_STRATEGIES.includes(deletionStrategy)) throw new TypeError('Unknown event deletion strategy.');
    const previous = indexedEvents(previousEvents, 'Previous');
    const next = indexedEvents(nextEvents, 'Next');
    const added = [], modified = [], removed = [], unchanged = [];

    next.forEach((event, eventId) => {
      if(!previous.has(eventId)) added.push({eventId, event:clone(event)});
      else if(equalValue(previous.get(eventId), event)) unchanged.push({eventId, event:clone(event)});
      else modified.push({eventId, before:clone(previous.get(eventId)), after:clone(event)});
    });
    if(nextEventsComplete === true){
      previous.forEach((event, eventId) => {
        if(next.has(eventId)) return;
        removed.push(deletionStrategy === 'LOGICAL'
          ? {eventId, strategy:'LOGICAL', before:clone(event), tombstone:{...clone(event), deleted:true}}
          : {eventId, strategy:'PHYSICAL', before:clone(event)});
      });
    }

    return {added, modified, removed, unchanged, deletionStrategy, nextEventsComplete:nextEventsComplete === true};
  }

  function createChangeRecord({field, oldValue, newValue, author, changedAt, reason='', initialRevision, resultingRevision, targetType='STAT_TOTAL', eventId=null}={}){
    if(!['STAT_TOTAL', 'EVENT'].includes(targetType)) throw new TypeError('Unknown correction target type.');
    const initial = revisionInfo(initialRevision);
    const resulting = revisionInfo(resultingRevision);
    if(!initial.valid || !resulting.valid || resulting.revision !== initial.revision + 1) throw new TypeError('Correction revisions must be valid and consecutive.');
    if(targetType === 'EVENT' && !String(eventId || '').trim()) throw new TypeError('An event correction requires a stable eventId.');
    return {
      field:String(field || '').trim(),
      oldValue:clone(oldValue),
      newValue:clone(newValue),
      author:clone(author),
      changedAt:clone(changedAt),
      reason:String(reason || ''),
      initialRevision:initial.revision,
      resultingRevision:resulting.revision,
      targetType,
      ...(targetType === 'EVENT' ? {eventId:String(eventId).trim()} : {})
    };
  }

  const service = {
    SCHEMA_VERSION,
    ENTRY_MODES,
    STATS_SOURCES,
    MATCH_STATUSES,
    DELETION_STRATEGIES,
    revisionInfo,
    matchVersionInfo,
    compatibleMatch,
    compareRevisions,
    eventIdentifier,
    reconcileEvents,
    createChangeRecord
  };

  global.CoachPulseMatchPersistence = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
