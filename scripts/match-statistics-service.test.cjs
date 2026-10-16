const assert = require('node:assert/strict');
const Stats = require('../shared/services/match-statistics-service.js');

let checks = 0;
function test(name, callback){
  callback();
  checks += 1;
  console.log(`PASS ${name}`);
}

test('historical live match counters keep their current totals and indicators', () => {
  const players = {
    Alice:{but:2,passe:1,tirCadre:3,tirNonCadre:1,centre:2,progression:4,entree20:3,recup:5},
    Bea:{but:0,passe:1,tirCadre:1,tirNonCadre:2,centre:0,progression:2,entree20:1,recup:3}
  };
  const totals = Stats.collectiveTotals(players, ['Alice','Bea']);
  assert.deepEqual({...totals}, {but:2,passe:2,tirCadre:4,tirNonCadre:3,centre:2,progression:6,entree20:4,recup:8,duelWon:0,duelLost:0});
  assert.deepEqual({...Stats.derivedIndicators(totals, {butAdv:1,tirCadreAdv:2,tirNonCadreAdv:2})}, {
    shots:7, opponentShots:4, shotAccuracy:57, conversionRate:29, goals:2, assists:2, goalsAgainst:1
  });
});

test('match without individual events reads canonical player snapshot', () => {
  const match = {players:{Alice:{playerId:'player-alice',seconds:600,but:0}}};
  assert.equal(Stats.matchHasPlayerParticipation(match, ['player-alice']), true);
});

test('playing time with zero actions is participation', () => {
  assert.equal(Stats.playerHasParticipation({seconds:420,but:0,recup:0}), true);
});

test('positive individual statistic proves legacy participation with unknown time', () => {
  assert.equal(Stats.playerHasParticipation({seconds:null,but:2,tirCadre:3}), true);
  assert.equal(Stats.playerHasParticipation({seconds:null,but:0,tirCadre:0}), false);
});

test('called player who never entered is not participation', () => {
  const match = {called:['Alice'],playerIds:['player-alice'],players:{Alice:{playerId:'player-alice',seconds:0,positionSeconds:{}}}};
  assert.equal(Stats.matchHasPlayerParticipation(match, ['player-alice']), false);
});

test('oversized historical playerIds never proves participation', () => {
  const match = {playerIds:['player-alice'],players:{Other:{playerId:'player-other',seconds:900}}};
  assert.equal(Stats.matchHasPlayerParticipation(match, ['player-alice']), false);
});

test('canonical identifiers and historical name aliases resolve the player', () => {
  const match = {players:{'ALICE MARTIN':{playerId:'canonical-alice',playerSnapshot:{displayName:'Alice M.'},seconds:10}}};
  assert.equal(Stats.matchHasPlayerParticipation(match, ['canonical-alice']), true);
  assert.equal(Stats.matchHasPlayerParticipation(match, ['alice martin']), true);
  assert.equal(Stats.matchHasPlayerParticipation(match, ['Alice M.']), true);
});

test('opponent statistics retain all canonical counters', () => {
  const normalized = Stats.normalizeOpponentStats({butAdv:2,tirCadreAdv:'4',tirNonCadreAdv:3,duelWonAdv:7,duelLostAdv:5,recupAdv:6});
  assert.equal(normalized.butAdv, 2);
  assert.equal(normalized.tirCadreAdv, 4);
  assert.equal(normalized.duelWonAdv, 7);
  assert.equal(normalized.duelLostAdv, 5);
  assert.equal(normalized.recupAdv, 6);
});

test('won and lost duels are normalized and aggregated', () => {
  const players = {Alice:{duelWon:3,duelLost:1},Bea:{duelWon:'2',duelLost:4}};
  const totals = Stats.collectiveTotals(players);
  assert.equal(totals.duelWon, 5);
  assert.equal(totals.duelLost, 5);
});

test('playing and position time normalization matches historical behavior', () => {
  assert.deepEqual(Stats.normalizedPositionSeconds({GB:300,DC:300}, 450), {GB:225,DC:225});
  assert.deepEqual(Stats.normalizedPositionSeconds({GB:120,DC:60}, 300), {GB:120,DC:60});
  assert.deepEqual(Stats.normalizedPositionSeconds({GB:120}, 0), {});
  const normalized = Stats.normalizePlayerStats({playingSeconds:450,positions:{GB:300,DC:300}});
  assert.equal(normalized.seconds, 450);
  assert.deepEqual(normalized.positionSeconds, {GB:225,DC:225});
  assert.deepEqual(Stats.validatePlayerStats({seconds:100,positionSeconds:{GB:80,DC:30}}), [{field:'positionSeconds',code:'EXCEEDS_PLAYING_TIME'}]);
});

test('absent null and zero values remain distinguishable', () => {
  assert.equal(Stats.numberOrUnknown(undefined), null);
  assert.equal(Stats.numberOrUnknown(null), null);
  assert.equal(Stats.numberOrUnknown(''), null);
  assert.equal(Stats.numberOrUnknown(0), 0);
  assert.equal(Stats.normalizePlayerStats({but:null},{unknown:'preserve'}).but, null);
  assert.equal(Stats.normalizePlayerStats({but:0},{unknown:'preserve'}).but, 0);
  assert.equal(Stats.normalizePlayerStats({}).but, 0);
});

test('validation reports invalid and negative values without rewriting input', () => {
  assert.deepEqual(Stats.validatePlayerStats({but:'not-a-number',passe:-1,seconds:-3}), [
    {field:'but',code:'INVALID_NUMBER'},
    {field:'passe',code:'NEGATIVE_VALUE'},
    {field:'seconds',code:'NEGATIVE_VALUE'}
  ]);
});

test('normalizers and calculations do not mutate their inputs', () => {
  const players = {Alice:{seconds:100,positionSeconds:{MC:120},zones:{recup:{1:2}},tirCadre:1}};
  const opponent = {tirCadreAdv:2,zones:{tirCadreAdv:{4:1}}};
  const beforePlayers = structuredClone(players);
  const beforeOpponent = structuredClone(opponent);
  Stats.normalizePlayers(players);
  Stats.collectiveTotals(players);
  Stats.normalizeOpponentStats(opponent);
  assert.deepEqual(players, beforePlayers);
  assert.deepEqual(opponent, beforeOpponent);
});

test('future provenance enumerations are documented without defaulting old matches', () => {
  assert.deepEqual([...Stats.ENTRY_MODES], ['LIVE','QUICK_POST_MATCH','FULL_POST_MATCH']);
  assert.deepEqual([...Stats.STATS_SOURCES], ['EVENTS','MANUAL','MIXED']);
  const historical = Stats.normalizePlayerStats({but:1});
  assert.equal('entryMode' in historical, false);
  assert.equal('statsSource' in historical, false);
});

console.log(`Match statistics service checks passed: ${checks}`);
