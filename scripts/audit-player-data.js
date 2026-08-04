const fs = require('fs');
const path = require('path');
const playersService = require('../shared/services/players-service.js');

const PLAYER_COLLECTIONS = ['players', 'joueuses'];
const LINKED_COLLECTIONS = [
  'matchEvents',
  'attendance',
  'technicalTests',
  'physicalTests',
  'injuries',
  'injuryUpdates',
  'medicalAppointments',
  'rehabRoutines',
  'workloads',
  'medicalFollowUps',
  'convocations',
  'individualReports'
];

function usage(){
  return [
    'Usage: node scripts/audit-player-data.js --file export.json [--strict] [--json]',
    '',
    'Formats acceptes:',
    '- { collections: { players:[], attendance:[], ... } }',
    '- { players:[], attendance:[], ... }',
    '- [ { playerId, nom, prenom, ... }, ... ]'
  ].join('\n');
}

function parseArgs(argv){
  const args = {file:'', strict:false, json:false, help:false};
  for(let i = 0; i < argv.length; i += 1){
    const arg = argv[i];
    if(arg === '--file' || arg === '-f'){
      args.file = argv[i + 1] || '';
      i += 1;
    }else if(arg === '--strict'){
      args.strict = true;
    }else if(arg === '--json'){
      args.json = true;
    }else if(arg === '--help' || arg === '-h'){
      args.help = true;
    }else if(!args.file && !arg.startsWith('-')){
      args.file = arg;
    }
  }
  return args;
}

function readJson(filePath){
  const absolute = path.resolve(process.cwd(), filePath);
  if(!fs.existsSync(absolute)) throw new Error(`Fichier introuvable: ${filePath}`);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function asArray(value){
  if(Array.isArray(value)) return value;
  if(value && typeof value === 'object') return Object.entries(value).map(([id, row]) => ({id, ...(row || {})}));
  return [];
}

function collectionsFromExport(data){
  if(Array.isArray(data)) return {players:data};
  const source = data?.collections && typeof data.collections === 'object' ? data.collections : data;
  const collections = {};
  [...PLAYER_COLLECTIONS, ...LINKED_COLLECTIONS].forEach(name => {
    collections[name] = asArray(source?.[name]);
  });
  if(!collections.players.length && collections.joueuses.length) collections.players = collections.joueuses;
  return collections;
}

function playerIdOf(row){
  return String(row?.playerId || row?.id || row?.player_id || row?.playerID || '').trim();
}

function statusOf(row){
  return String(row?.status || row?.statut || 'active').trim().toLowerCase();
}

function isArchived(row){
  return statusOf(row) === 'archived' || statusOf(row) === 'archivee' || statusOf(row) === 'archivée';
}

function activePlayers(players){
  return players.filter(player => !isArchived(player));
}

function rowId(collectionName, row, index){
  return String(row?.id || row?.[`${collectionName}Id`] || row?.testId || row?.attendanceId || row?.sessionId || `${collectionName}:${index + 1}`);
}

function linkedPlayerIds(row){
  const ids = [
    row?.playerId,
    row?.player_id,
    row?.playerID,
    row?.legacyPlayerId,
    row?.oldPlayerId,
    row?.previousPlayerId,
    row?.playerSnapshot?.playerId,
    row?.playerSnapshot?.id,
    row?.player?.playerId,
    row?.player?.id
  ];
  if(Array.isArray(row?.playerIds)) ids.push(...row.playerIds);
  if(Array.isArray(row?.legacyPlayerIds)) ids.push(...row.legacyPlayerIds);
  return [...new Set(ids.map(value => String(value || '').trim()).filter(Boolean))];
}

function pushIssue(bucket, type, message, details={}){
  bucket.push({type, message, ...details});
}

function auditPlayers(collections){
  const rawPlayers = asArray(collections.players);
  const normalizedPlayers = rawPlayers.map((row, index) => {
    const id = playerIdOf(row);
    const normalized = playersService.normalizePlayer({...row, playerId:id || row.playerId || row.id});
    const finalId = id || normalized.playerId || normalized.id || '';
    return {...row, ...normalized, playerId:finalId, id:finalId || row.id, __auditIndex:index};
  });
  const active = activePlayers(normalizedPlayers);
  const archived = normalizedPlayers.filter(isArchived);
  const playerIds = new Set(normalizedPlayers.map(playerIdOf).filter(Boolean));
  const activeIds = new Set(active.map(playerIdOf).filter(Boolean));
  const errors = [];
  const warnings = [];
  const infos = [];

  normalizedPlayers.forEach(player => {
    const id = playerIdOf(player);
    const label = playersService.displayName(player) || `ligne ${player.__auditIndex + 1}`;
    if(!id) pushIssue(errors, 'missing-player-id', `Joueuse sans playerId: ${label}`, {player:label});
    if(!player.nom || !player.prenom) pushIssue(warnings, 'missing-name-part', `Nom ou prénom incomplet: ${label}`, {playerId:id, player:label});
    if(!player.birth && !player.dateNaissance && !player.birthDate) pushIssue(warnings, 'missing-birth', `Date de naissance absente: ${label}`, {playerId:id, player:label});
  });

  const byId = new Map();
  normalizedPlayers.forEach(player => {
    const id = playerIdOf(player);
    if(!id) return;
    const rows = byId.get(id) || [];
    rows.push(player);
    byId.set(id, rows);
  });
  byId.forEach((rows, id) => {
    if(rows.length > 1) pushIssue(errors, 'duplicate-player-id', `playerId dupliqué: ${id} (${rows.length} fiches)`, {playerId:id, count:rows.length});
  });

  const activeByIdentity = new Map();
  active.forEach(player => {
    const key = playersService.identityKey(player, true) || playersService.personKey(player);
    if(!key) return;
    const rows = activeByIdentity.get(key) || [];
    rows.push(player);
    activeByIdentity.set(key, rows);
  });
  activeByIdentity.forEach(rows => {
    if(rows.length > 1){
      pushIssue(errors, 'duplicate-active-identity', `Doublon actif probable: ${rows.map(player => playersService.displayName(player) || playerIdOf(player)).join(' / ')}`, {
        playerIds:rows.map(playerIdOf).filter(Boolean),
        count:rows.length
      });
    }
  });

  active.forEach(player => {
    const id = playerIdOf(player);
    const label = playersService.displayName(player) || id;
    const history = player.seasonHistory && typeof player.seasonHistory === 'object' ? player.seasonHistory : {};
    Object.entries(history).forEach(([season, snapshot]) => {
      const expected = playersService.playerSeasonSnapshot(player, season);
      if(snapshot?.subCategory && expected.subCategory && snapshot.subCategory !== expected.subCategory){
        pushIssue(warnings, 'season-subcategory-mismatch', `Sous-catégorie à vérifier pour ${label} en ${season}: ${snapshot.subCategory} vs ${expected.subCategory}`, {playerId:id, season});
      }
      if(snapshot?.team && expected.team && snapshot.team !== expected.team){
        pushIssue(warnings, 'season-team-mismatch', `Équipe à vérifier pour ${label} en ${season}: ${snapshot.team} vs ${expected.team}`, {playerId:id, season});
      }
    });
  });

  const linkedCountsByPlayer = new Map();
  LINKED_COLLECTIONS.forEach(collectionName => {
    asArray(collections[collectionName]).forEach((row, index) => {
      const ids = linkedPlayerIds(row);
      if(!ids.length) return;
      ids.forEach(id => {
        linkedCountsByPlayer.set(id, (linkedCountsByPlayer.get(id) || 0) + 1);
        if(!playerIds.has(id)){
          pushIssue(warnings, 'unknown-linked-player', `Historique ${collectionName}/${rowId(collectionName, row, index)} lié à un playerId absent: ${id}`, {collection:collectionName, playerId:id});
        }
      });
    });
  });

  archived.forEach(player => {
    const id = playerIdOf(player);
    const count = linkedCountsByPlayer.get(id) || 0;
    if(count > 0){
      pushIssue(infos, 'archived-player-with-history', `Joueuse archivée avec historique lié: ${playersService.displayName(player) || id} (${count} document(s))`, {playerId:id, linkedDocuments:count});
    }
    if(!player.mergedIntoPlayerId && count > 0){
      pushIssue(warnings, 'archived-player-not-merged', `Joueuse archivée avec historique mais sans mergedIntoPlayerId: ${playersService.displayName(player) || id}`, {playerId:id});
    }
  });

  const linkedArchivedPlayerIds = [...linkedCountsByPlayer.keys()].filter(id => !activeIds.has(id) && playerIds.has(id));

  return {
    ok:errors.length === 0,
    counts:{
      players:normalizedPlayers.length,
      activePlayers:active.length,
      archivedPlayers:archived.length,
      linkedPlayerIds:linkedCountsByPlayer.size,
      linkedArchivedPlayerIds:linkedArchivedPlayerIds.length
    },
    errors,
    warnings,
    infos
  };
}

function printReport(report){
  console.log('Audit données joueuses CoachPulse');
  console.log(`- joueuses: ${report.counts.players}`);
  console.log(`- actives: ${report.counts.activePlayers}`);
  console.log(`- archivées: ${report.counts.archivedPlayers}`);
  console.log(`- playerId liés à un historique: ${report.counts.linkedPlayerIds}`);
  if(report.errors.length){
    console.error('\nErreurs');
    report.errors.forEach(issue => console.error(`- ${issue.message}`));
  }
  if(report.warnings.length){
    console.warn('\nAlertes');
    report.warnings.forEach(issue => console.warn(`- ${issue.message}`));
  }
  if(report.infos.length){
    console.log('\nInformations');
    report.infos.slice(0, 20).forEach(issue => console.log(`- ${issue.message}`));
    if(report.infos.length > 20) console.log(`- ... ${report.infos.length - 20} information(s) supplémentaire(s)`);
  }
  console.log(report.ok ? '\nAudit données joueuses OK' : '\nAudit données joueuses avec erreurs');
}

function main(){
  const args = parseArgs(process.argv.slice(2));
  if(args.help){
    console.log(usage());
    return;
  }
  if(!args.file){
    console.log(usage());
    console.log('\nAucun fichier fourni: audit non exécuté.');
    return;
  }
  const data = readJson(args.file);
  const report = auditPlayers(collectionsFromExport(data));
  if(args.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  if(report.errors.length || (args.strict && report.warnings.length)) process.exit(1);
}

if(require.main === module) main();

module.exports = {auditPlayers, collectionsFromExport, linkedPlayerIds};
