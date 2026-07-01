import { cleanText, keyText, stableId, parseDate, normalizeCategorie, normalizeSousCategorie, splitName } from './fichesJoueusesConnector.js';

const STATUS_CODES = new Set(['P','R','ANJ','AJ','M','B','PO','D']);
const PRESENCE_ALIASES = {
  fullName:['joueuse','joueur','nom complet','nom prenom','nom prénom','licencie','licencié','player'],
  nom:['nom','last name','surname'],
  prenom:['prenom','prénom','first name','firstname'],
  categorie:['categorie','catégorie','category','groupe','equipe','équipe','collectif'],
  sousCategorie:['sous categorie','sous catégorie','subcategory','sub category','age','annee','année'],
  date:['date','jour','date seance','date séance','session date'],
  status:['statut','presence','présence','etat','état','code','absence'],
  duration:['duree','durée','duration','minutes','temps','volume'],
  charge:['charge','load','rpe'],
  theme:['theme','thème','contenu','objectif','seance','séance'],
  sessionType:['type seance','type séance','type','nature']
};

export function detectColumn(header){
  const key = keyText(header);
  for(const [field, aliases] of Object.entries(PRESENCE_ALIASES)){
    if(aliases.some(alias => key === keyText(alias))) return field;
  }
  for(const [field, aliases] of Object.entries(PRESENCE_ALIASES)){
    if(aliases.some(alias => {
      const aliasKey = keyText(alias);
      return aliasKey.length > 3 && key.includes(aliasKey);
    })) return field;
  }
  if(parseDate(header)) return 'dateStatus';
  return '';
}

function toNumber(value){
  const n = Number(cleanText(value).replace(',','.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(value){
  const raw = cleanText(value).toUpperCase();
  if(STATUS_CODES.has(raw)) return raw;
  if(['PRESENT','PRÉSENT','PRESENTE','PRÉSENTE','OUI','OK','1','X'].includes(raw)) return 'P';
  if(['ABS','ABSENT','ABSENTE','0','NON'].includes(raw)) return 'ANJ';
  if(raw.includes('MALAD')) return 'M';
  if(raw.includes('BLESS')) return 'B';
  if(raw.includes('REPOS')) return 'R';
  return '';
}

function playerFromMapped(mapped, rowNumber){
  const names = splitName(mapped);
  if(!names.nom && !names.prenom) return {error:'joueuse non détectée'};
  if(!names.nom || !names.prenom) return {error:'nom ou prénom incomplet'};
  const sousCategorie = normalizeSousCategorie(mapped.sousCategorie || mapped.categorie || '');
  const categorie = normalizeCategorie(mapped.categorie || sousCategorie || '');
  const playerId = stableId('player', names.nom, names.prenom, categorie, sousCategorie);
  return {
    type:'player',
    connector:'presences',
    rowNumber,
    playerId,
    nom:names.nom,
    prenom:names.prenom,
    categorie,
    sousCategorie
  };
}

function sessionItem({date, mapped, player, source, rowNumber}){
  const theme = cleanText(mapped.theme || 'Import présence');
  const sessionType = cleanText(mapped.sessionType || 'Séance');
  const duration = toNumber(mapped.duration || 0);
  const sessionId = stableId('session', date || 'date-inconnue', theme, player.categorie || '', player.sousCategorie || '');
  return {
    type:'session',
    connector:'presences',
    rowNumber,
    sessionId,
    date,
    categorie:player.categorie || '',
    sousCategorie:player.sousCategorie || '',
    theme,
    sessionType,
    duration,
    source
  };
}

function attendanceItem({session, player, status, mapped, rowNumber}){
  const duration = toNumber(mapped.duration || session.duration || 0);
  const charge = toNumber(mapped.charge || duration || 0);
  const attendanceId = stableId('attendance', session.sessionId, player.playerId);
  return {
    type:'attendance',
    connector:'presences',
    rowNumber,
    attendanceId,
    playerId:player.playerId,
    playerName:`${player.nom} ${player.prenom}`.trim(),
    sessionId:session.sessionId,
    date:session.date,
    status,
    duration,
    charge
  };
}

export function analyzeRows(rows, context={}){
  const columns = new Map();
  rows.forEach(row => Object.keys(row || {}).filter(k => !k.startsWith('__')).forEach(header => {
    if(!columns.has(header)) columns.set(header, detectColumn(header));
  }));

  const result = {
    connector:'presences',
    fileName:context.fileName || '',
    rowsRead:rows.length,
    columns:[...columns.entries()].map(([header, field]) => ({header, field:field || 'non reconnu'})),
    items:[],
    anomalies:[],
    formulas:[]
  };

  const seen = new Set();
  rows.forEach((row, index) => {
    const rowNumber = row.__rowNumber || index + 1;
    const mapped = {};
    const dateColumns = [];
    Object.entries(row || {}).forEach(([header, value]) => {
      if(header.startsWith('__')) return;
      const field = columns.get(header);
      if(field === 'dateStatus') dateColumns.push({header, value});
      else if(field && mapped[field] == null) mapped[field] = value;
    });

    if(row.__formulas){
      Object.entries(row.__formulas).forEach(([header, formula]) => {
        result.formulas.push({row:rowNumber, column:header, formula, value:row[header] || ''});
        if(!cleanText(row[header])) result.anomalies.push({row:rowNumber, level:'warn', message:`Formule sans valeur calculée exploitable dans ${header}`});
      });
    }

    const player = playerFromMapped(mapped, rowNumber);
    if(player.error){
      result.anomalies.push({row:rowNumber, level:player.error.includes('incomplet')?'error':'ignored', message:`Ligne ignorée : ${player.error}`});
      return;
    }
    result.items.push(player);

    const directDate = parseDate(mapped.date);
    const directStatus = normalizeStatus(mapped.status);
    if(directDate && directStatus){
      const session = sessionItem({date:directDate, mapped, player, source:context.fileName || '', rowNumber});
      const attendance = attendanceItem({session, player, status:directStatus, mapped, rowNumber});
      const key = attendance.attendanceId;
      if(seen.has(key)) result.anomalies.push({row:rowNumber, level:'warn', message:`Doublon présence : ${player.nom} ${player.prenom} ${directDate}`});
      seen.add(key);
      result.items.push(session, attendance);
    }

    dateColumns.forEach(({header, value}) => {
      const status = normalizeStatus(value);
      const date = parseDate(header);
      if(!date || !status) return;
      const session = sessionItem({date, mapped, player, source:context.fileName || '', rowNumber});
      const attendance = attendanceItem({session, player, status, mapped, rowNumber});
      if(seen.has(attendance.attendanceId)) result.anomalies.push({row:rowNumber, level:'warn', message:`Doublon présence : ${player.nom} ${player.prenom} ${date}`});
      seen.add(attendance.attendanceId);
      result.items.push(session, attendance);
    });

    if(!directStatus && !dateColumns.some(c => normalizeStatus(c.value))){
      result.anomalies.push({row:rowNumber, level:'warn', message:`Aucun statut de présence reconnu pour ${player.nom} ${player.prenom}`});
    }
  });

  return result;
}

export default {analyzeRows, detectColumn};
