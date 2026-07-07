#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_BACKUP = '/Users/sylvainostard/Downloads/coachpulse_firebase_centralise-6.json';
const DEFAULT_CLEAN_PLAYERS = '/Users/sylvainostard/Desktop/ASSE/coachpulse-joueuses-import-coachpulse-safe.json';
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), 'migration-output');
const HISTORY_COLLECTIONS = [
  'attendance',
  'technicalTests',
  'physicalTests',
  'matchEvents',
  'injuries',
  'injuryUpdates',
  'medicalAppointments',
  'rehabRoutines',
  'workloads',
  'convocations',
  'medicalFollowUps',
  'individualReports'
];

function argValue(name, fallback){
  const prefix = `--${name}=`;
  const found = process.argv.find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function readJson(file){
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function asText(value){
  return String(value ?? '').replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ');
}

function keyPart(value){
  return asText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

function stableId(){
  return Array.from(arguments).map(keyPart).filter(Boolean).join('-').slice(0, 120) || `id-${Date.now().toString(36)}`;
}

function parseDate(value){
  const raw = asText(value);
  if(!raw) return '';
  const iso = raw.match(/\b(20\d{2}|19\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if(iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const fr = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-]((?:20|19)?\d{2})\b/);
  if(fr){
    const year = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
    return `${year}-${String(fr[2]).padStart(2, '0')}-${String(fr[1]).padStart(2, '0')}`;
  }
  return raw;
}

function seasonEndYear(season){
  const match = asText(season).match(/(\d{4})\s*-\s*(\d{4})/);
  return match ? Number(match[2]) : 2027;
}

function birthYear(player){
  const value = asText(player.birth || player.dateNaissance || player.birthDate);
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : 0;
}

function subCategoryForSeason(player, season){
  const year = birthYear(player);
  if(!year) return '';
  const age = seasonEndYear(season) - year;
  if(age >= 6 && age <= 19) return `U${age}`;
  if(age > 19) return 'R1';
  return '';
}

function categoryFromSub(value){
  const raw = asText(value).toUpperCase();
  if(raw.includes('R1') || raw.includes('SENIOR')) return 'R1';
  const n = Number((raw.match(/\d+/) || [])[0] || 0);
  if(!n) return raw;
  if(n <= 7) return 'U6-U7';
  if(n <= 9) return 'U8-U9';
  if(n <= 11) return 'U10-U11';
  if(n <= 13) return 'U12-U13';
  if(n <= 14) return 'U12-U13-U14';
  if(n <= 16) return 'U14-U15-U16';
  return 'U19';
}

function splitName(row){
  const full = asText(row.fullName || row.displayName || row.joueuse || row.playerName || row.name);
  let nom = asText(row.nom || row.lastName);
  let prenom = asText(row.prenom || row.firstName);
  if((!nom || !prenom) && full){
    const parts = full.split(/\s+/).filter(Boolean);
    const upper = [];
    while(parts.length && parts[0] === parts[0].toUpperCase()) upper.push(parts.shift());
    if(upper.length && parts.length){
      nom = nom || upper.join(' ');
      prenom = prenom || parts.join(' ');
    }else{
      nom = nom || parts.slice(-1).join(' ');
      prenom = prenom || parts.slice(0, -1).join(' ');
    }
  }
  return {nom:asText(nom).toUpperCase(), prenom:asText(prenom).toUpperCase()};
}

function normalizeCleanPlayer(row){
  const names = splitName(row);
  const birth = parseDate(row.birth || row.dateNaissance || row.birthDate);
  const sourceSeason = asText(row.season || row.saison || '2025-2026');
  const currentSeason = '2026-2027';
  const sourceSub = subCategoryForSeason({birth}, sourceSeason) || asText(row.subCategory || row.sousCategorie);
  const currentSub = subCategoryForSeason({birth}, currentSeason) || sourceSub;
  const sourceCategory = categoryFromSub(sourceSub || row.categorie || row.category);
  const currentCategory = categoryFromSub(currentSub || sourceCategory);
  const playerId = stableId('player', names.nom, names.prenom, birth || 'no-birth');
  const photo = asText(row.photo || row.avatar || row.photoSource);
  const currentTeam = asText(row.team || row.equipe || currentCategory);
  return {
    id:playerId,
    playerId,
    nom:names.nom,
    prenom:names.prenom,
    displayName:[names.prenom, names.nom].filter(Boolean).join(' '),
    birth,
    dateNaissance:birth,
    categorie:currentCategory,
    subCategory:currentSub,
    team:currentTeam,
    teamId:stableId('team', currentTeam || currentCategory),
    poste:asText(row.poste || row.position),
    numero:asText(row.numero || row.number),
    foot:asText(row.foot || row.pied),
    photo,
    status:asText(row.status || 'active').toLowerCase(),
    source:'Migration propre CoachPulse',
    currentSeason,
    seasonStart:'2026-07-01',
    seasonEnd:'2027-06-30',
    seasonHistory:{
      [sourceSeason]:{
        categorie:sourceCategory,
        subCategory:sourceSub,
        team:asText(row.team || row.equipe || sourceCategory)
      },
      [currentSeason]:{
        categorie:currentCategory,
        subCategory:currentSub,
        team:currentTeam
      }
    }
  };
}

function identity(player, withBirth=false){
  const names = splitName(player || {});
  const parts = [names.nom, names.prenom];
  if(withBirth) parts.push(parseDate(player.birth || player.dateNaissance || player.birthDate));
  return parts.map(keyPart).join('|');
}

function makeCleanPlayers(rows){
  const byId = new Map();
  const duplicates = [];
  rows.map(normalizeCleanPlayer).forEach(player => {
    if(byId.has(player.playerId)) duplicates.push({playerId:player.playerId, kept:byId.get(player.playerId), duplicate:player});
    else byId.set(player.playerId, player);
  });
  return {players:[...byId.values()].sort((a,b) => a.displayName.localeCompare(b.displayName, 'fr')), duplicates};
}

function buildCleanIndexes(players){
  const byBirth = new Map();
  const byName = new Map();
  const bySlug = new Map();
  const addSlug = (slug, player) => {
    if(!slug) return;
    bySlug.set(slug, [...(bySlug.get(slug) || []), player]);
  };
  players.forEach(player => {
    byBirth.set(identity(player, true), player);
    const key = identity(player, false);
    byName.set(key, [...(byName.get(key) || []), player]);
    addSlug(stableId(player.nom, player.prenom), player);
    addSlug(stableId(player.prenom, player.nom), player);
  });
  return {byBirth, byName, bySlug};
}

function findCleanPlayer(snapshot, cleanIndexes){
  const birthKey = identity(snapshot, true);
  if(birthKey.replace(/\|/g, '') && cleanIndexes.byBirth.has(birthKey)) return {player:cleanIndexes.byBirth.get(birthKey), strategy:'nom+prenom+birth'};
  const nameKey = identity(snapshot, false);
  const candidates = cleanIndexes.byName.get(nameKey) || [];
  if(candidates.length === 1) return {player:candidates[0], strategy:'nom+prenom unique'};
  return {player:null, strategy:candidates.length > 1 ? 'ambiguous' : 'unmapped'};
}

function findCleanPlayerBySlug(slug, cleanIndexes){
  const candidates = cleanIndexes.bySlug.get(asText(slug)) || [];
  if(candidates.length === 1) return {player:candidates[0], strategy:'legacy-playerId slug'};
  return {player:null, strategy:candidates.length > 1 ? 'ambiguous legacy-playerId slug' : 'unmapped'};
}

function buildOldPlayerIndex(oldPlayers, cleanIndexes){
  const byOldId = new Map();
  const unresolved = [];
  oldPlayers.forEach(oldPlayer => {
    const oldId = oldPlayer.playerId || oldPlayer.id;
    if(!oldId) return;
    const match = findCleanPlayer(oldPlayer, cleanIndexes);
    if(match.player) byOldId.set(oldId, {oldId, newPlayerId:match.player.playerId, strategy:match.strategy, oldPlayer, newPlayer:match.player});
    else unresolved.push({oldId, strategy:match.strategy, oldPlayer});
  });
  return {byOldId, unresolved};
}

function remapDocument(collection, doc, oldIndex, cleanIndexes){
  const oldPlayerId = doc.playerId || doc.idPlayer || '';
  if(oldPlayerId && oldIndex.byOldId.has(oldPlayerId)){
    const match = oldIndex.byOldId.get(oldPlayerId);
    return {status:'mapped', strategy:`oldPlayerId:${match.strategy}`, doc:{...doc, playerId:match.newPlayerId, originalPlayerId:oldPlayerId}};
  }
  if(oldPlayerId){
    const slugMatch = findCleanPlayerBySlug(oldPlayerId, cleanIndexes);
    if(slugMatch.player) return {status:'mapped', strategy:slugMatch.strategy, doc:{...doc, playerId:slugMatch.player.playerId, originalPlayerId:oldPlayerId}};
  }
  const snapshot = doc.playerSnapshot || doc.player || doc;
  const match = findCleanPlayer(snapshot, cleanIndexes);
  if(match.player) return {status:'mapped', strategy:match.strategy, doc:{...doc, playerId:match.player.playerId, originalPlayerId:oldPlayerId || doc.playerId || ''}};
  return {status:'unmapped', reason:match.strategy, collection, doc};
}

function remapHistories(collections, oldIndex, cleanIndexes){
  const output = {};
  const report = {};
  const unmapped = [];
  HISTORY_COLLECTIONS.forEach(collection => {
    const docs = Array.isArray(collections[collection]) ? collections[collection] : [];
    output[collection] = [];
    report[collection] = {total:docs.length, mapped:0, unmapped:0, strategies:{}};
    docs.forEach(doc => {
      const result = remapDocument(collection, doc, oldIndex, cleanIndexes);
      if(result.status === 'mapped'){
        output[collection].push(result.doc);
        report[collection].mapped++;
        report[collection].strategies[result.strategy] = (report[collection].strategies[result.strategy] || 0) + 1;
      }else{
        report[collection].unmapped++;
        unmapped.push({collection, reason:result.reason, id:doc.id || doc.attendanceId || doc.testId || doc.injuryId || '', playerId:doc.playerId || '', playerName:doc.playerName || doc.displayName || ''});
      }
    });
  });
  return {output, report, unmapped};
}

function writeJson(file, data){
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function writeMarkdown(file, lines){
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

function main(){
  const backupFile = argValue('backup', DEFAULT_BACKUP);
  const playersFile = argValue('players', DEFAULT_CLEAN_PLAYERS);
  const outDir = argValue('out', DEFAULT_OUT_DIR);
  fs.mkdirSync(outDir, {recursive:true});

  const backup = readJson(backupFile);
  const cleanSource = readJson(playersFile);
  const cleanRows = Array.isArray(cleanSource) ? cleanSource : (cleanSource.players || []);
  const collections = backup.collections || {};
  const oldPlayers = Array.isArray(collections.players) ? collections.players : [];
  const clean = makeCleanPlayers(cleanRows);
  const cleanIndexes = buildCleanIndexes(clean.players);
  const oldIndex = buildOldPlayerIndex(oldPlayers, cleanIndexes);
  const remap = remapHistories(collections, oldIndex, cleanIndexes);

  const migrationPlan = {
    generatedAtIso:new Date().toISOString(),
    backupFile,
    playersFile,
    cleanPlayers:clean.players,
    oldToNewPlayerIds:[...oldIndex.byOldId.values()].map(row => ({
      oldPlayerId:row.oldId,
      newPlayerId:row.newPlayerId,
      strategy:row.strategy,
      oldName:asText(row.oldPlayer.displayName || `${row.oldPlayer.prenom || ''} ${row.oldPlayer.nom || ''}`),
      newName:row.newPlayer.displayName
    })),
    remappedCollections:remap.output
  };

  writeJson(path.join(outDir, 'migration-plan.json'), migrationPlan);
  writeJson(path.join(outDir, 'players-clean.json'), clean.players);
  writeJson(path.join(outDir, 'unmapped-history.json'), remap.unmapped);
  writeJson(path.join(outDir, 'old-player-unresolved.json'), oldIndex.unresolved);

  writeMarkdown(path.join(outDir, 'players-clean-report.md'), [
    '# Rapport joueuses propres',
    '',
    `Source : ${playersFile}`,
    `Joueuses source : ${cleanRows.length}`,
    `Joueuses uniques générées : ${clean.players.length}`,
    `Doublons internes source : ${clean.duplicates.length}`,
    `Avec photo : ${clean.players.filter(p => p.photo).length}`,
    '',
    '## Catégories 2026-2027',
    '',
    ...Object.entries(clean.players.reduce((acc,p) => {
      const key = `${p.categorie} / ${p.subCategory}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).sort().map(([key,count]) => `- ${key} : ${count}`),
    ''
  ]);

  writeMarkdown(path.join(outDir, 'history-remap-report.md'), [
    '# Rapport remapping historiques',
    '',
    `Export Firebase : ${backupFile}`,
    `Anciennes fiches players : ${oldPlayers.length}`,
    `Anciennes fiches reliées à une joueuse propre : ${oldIndex.byOldId.size}`,
    `Anciennes fiches non reliées : ${oldIndex.unresolved.length}`,
    '',
    '## Collections historiques',
    '',
    ...Object.entries(remap.report).map(([collection, data]) => {
      const strategies = Object.entries(data.strategies).map(([k,v]) => `${k} ${v}`).join(', ') || '-';
      return `- ${collection} : ${data.mapped}/${data.total} mappées, ${data.unmapped} non mappées (${strategies})`;
    }),
    '',
    `Historiques non mappés : ${remap.unmapped.length}`,
    ''
  ]);

  console.log(`Migration simulation written to ${outDir}`);
  console.log(`Clean players: ${clean.players.length}/${cleanRows.length}`);
  console.log(`Old player ids mapped: ${oldIndex.byOldId.size}/${oldPlayers.length}`);
  Object.entries(remap.report).forEach(([collection, data]) => {
    if(data.total) console.log(`${collection}: ${data.mapped}/${data.total} mapped, ${data.unmapped} unmapped`);
  });
}

main();
