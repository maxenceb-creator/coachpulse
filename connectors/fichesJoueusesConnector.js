const CATEGORY_GROUPS = [
  {max:7, value:'U7'},
  {max:9, value:'U8-U9'},
  {max:11, value:'U10-U11'},
  {max:13, value:'U12-U13'},
  {max:14, value:'U12-U13-U14'},
  {max:16, value:'U14-U15-U16'},
  {max:99, value:'U19'}
];

const PLAYER_ALIASES = {
  fullName:['joueuse','joueur','nom complet','nom prenom','nom prénom','licencie','licencié','player','athlete','athlète'],
  nom:['nom','last name','surname'],
  prenom:['prenom','prénom','first name','firstname'],
  categorie:['categorie','catégorie','category','groupe','equipe','équipe','collectif'],
  sousCategorie:['sous categorie','sous catégorie','subcategory','sub category','age','annee','année'],
  poste:['poste','position','role','rôle'],
  photo:['photo','image','avatar'],
  dateNaissance:['date naissance','date de naissance','naissance','birthday','birth','dob']
};

export function cleanText(value){
  return String(value ?? '').replace(/\u00a0/g,' ').trim().replace(/\s+/g,' ');
}

export function keyText(value){
  return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_/.-]+/g,' ').replace(/\s+/g,' ').trim();
}

export function stableId(){
  return Array.from(arguments).filter(Boolean).join('-').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120) || 'item';
}

function coachPulseApi(){
  try{ return globalThis.parent?.CoachPulseCentralData || globalThis.CoachPulseCentralData || {}; }
  catch(_e){ return globalThis.CoachPulseCentralData || {}; }
}

function centralNormalizePlayer(raw={}){
  return coachPulseApi().normalizePlayer?.(raw) || null;
}

export function normalizeConnectorPlayer(raw={}){
  const central = centralNormalizePlayer(raw);
  if(central) return central;
  const names = splitName(raw);
  const birth = parseDate(raw.dateNaissance || raw.birth || raw.birthDate) || cleanText(raw.dateNaissance || raw.birth || raw.birthDate || '');
  const subCategory = normalizeSousCategorie(raw.subCategory || raw.sousCategorie || raw.categorie || raw.category || '');
  const categorie = normalizeCategorie(raw.categorie || raw.category || subCategory || '');
  const playerId = stableId('player', names.prenom, names.nom, birth || 'no-birth');
  return {
    ...raw,
    id:playerId,
    playerId,
    nom:names.nom,
    prenom:names.prenom,
    displayName:[names.prenom, names.nom].filter(Boolean).join(' ').trim().toUpperCase(),
    categorie,
    subCategory,
    sousCategorie:subCategory,
    birth,
    dateNaissance:birth
  };
}

export function detectColumn(header){
  const key = keyText(header);
  for(const [field, aliases] of Object.entries(PLAYER_ALIASES)){
    if(aliases.some(alias => key === keyText(alias))) return field;
  }
  for(const [field, aliases] of Object.entries(PLAYER_ALIASES)){
    if(aliases.some(alias => {
      const aliasKey = keyText(alias);
      return aliasKey.length > 3 && key.includes(aliasKey);
    })) return field;
  }
  return '';
}

export function parseDate(value){
  if(value == null || value === '') return '';
  if(typeof value === 'number'){
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0,10);
  }
  const raw = cleanText(value);
  const iso = raw.match(/\b(19\d{2}|20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if(iso) return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`;
  const fr = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-]((?:19|20)?\d{2})\b/);
  if(!fr) return '';
  const year = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
  return `${year}-${String(fr[2]).padStart(2,'0')}-${String(fr[1]).padStart(2,'0')}`;
}

export function normalizeSousCategorie(value){
  const raw = cleanText(value).toUpperCase().replace('SENIORS','R1').replace('SÉNIORS','R1');
  if(raw.includes('R1')) return 'R1';
  const n = Number((raw.match(/\d+/) || [])[0] || 0);
  return n ? `U${n}` : raw;
}

export function normalizeCategorie(value){
  const sub = normalizeSousCategorie(value);
  if(sub === 'R1') return 'R1';
  const n = Number((sub.match(/\d+/) || [])[0] || 0);
  if(!n) return cleanText(value);
  return CATEGORY_GROUPS.find(group => n <= group.max)?.value || 'U19';
}

export function splitName(mapped){
  let nom = cleanText(mapped.nom || '');
  let prenom = cleanText(mapped.prenom || '');
  const full = cleanText(mapped.fullName || '');
  if((!nom || !prenom) && full){
    const bits = full.split(/\s+/).filter(Boolean);
    const upper = [];
    while(bits.length && bits[0] === bits[0].toUpperCase()) upper.push(bits.shift());
    if(upper.length && bits.length){
      nom = nom || upper.join(' ');
      prenom = prenom || bits.join(' ');
    }else{
      nom = nom || bits.slice(0, -1).join(' ');
      prenom = prenom || bits.slice(-1).join(' ');
    }
  }
  return {nom:nom.toUpperCase(), prenom};
}

export function analyzeRows(rows, context={}){
  const columns = new Map();
  rows.forEach(row => Object.keys(row || {}).filter(k => !k.startsWith('__')).forEach(header => {
    if(!columns.has(header)) columns.set(header, detectColumn(header));
  }));

  const result = {
    connector:'fichesJoueuses',
    fileName:context.fileName || '',
    rowsRead:rows.length,
    columns:[...columns.entries()].map(([header, field]) => ({header, field:field || 'non reconnu'})),
    items:[],
    anomalies:[],
    formulas:[]
  };

  const seen = new Set();
  rows.forEach((row, index) => {
    const mapped = {};
    Object.entries(row || {}).forEach(([header, value]) => {
      if(header.startsWith('__')) return;
      const field = columns.get(header);
      if(field && mapped[field] == null) mapped[field] = value;
    });

    if(row.__formulas){
      Object.entries(row.__formulas).forEach(([header, formula]) => {
        result.formulas.push({row:row.__rowNumber || index + 1, column:header, formula, value:row[header] || ''});
        if(!cleanText(row[header])) result.anomalies.push({row:row.__rowNumber || index + 1, level:'warn', message:`Formule sans valeur calculée exploitable dans ${header}`});
      });
    }

    const names = splitName(mapped);
    if(!names.nom && !names.prenom){
      result.anomalies.push({row:row.__rowNumber || index + 1, level:'ignored', message:'Ligne ignorée : joueuse non détectée'});
      return;
    }
    if(!names.nom || !names.prenom){
      result.anomalies.push({row:row.__rowNumber || index + 1, level:'error', message:'Nom ou prénom incomplet'});
      return;
    }

    const dateNaissance = parseDate(mapped.dateNaissance);
    const centralPlayer = normalizeConnectorPlayer({nom:names.nom, prenom:names.prenom, categorie:mapped.categorie, subCategory:mapped.sousCategorie, birth:dateNaissance, dateNaissance});
    const playerId = centralPlayer.playerId;
    const duplicateKey = stableId(names.prenom, names.nom, dateNaissance || 'no-birth');
    if(!dateNaissance){
      result.anomalies.push({row:row.__rowNumber || index + 1, level:'warn', message:`Date de naissance manquante : playerId provisoire pour ${names.nom} ${names.prenom}`});
    }
    if(seen.has(duplicateKey)){
      result.anomalies.push({row:row.__rowNumber || index + 1, level:'warn', message:`Doublon potentiel dans le fichier : ${names.nom} ${names.prenom}`});
    }
    seen.add(duplicateKey);

    result.items.push({
      type:'player',
      connector:'fichesJoueuses',
      rowNumber:row.__rowNumber || index + 1,
      playerId,
      nom:names.nom,
      prenom:names.prenom,
      categorie:centralPlayer.categorie || '',
      sousCategorie:centralPlayer.subCategory || centralPlayer.sousCategorie || '',
      subCategory:centralPlayer.subCategory || centralPlayer.sousCategorie || '',
      team:centralPlayer.team || '',
      teamId:centralPlayer.teamId || '',
      poste:cleanText(mapped.poste || ''),
      photo:cleanText(mapped.photo || ''),
      dateNaissance,
      raw:row
    });
  });

  return result;
}

export default {analyzeRows, detectColumn, cleanText, keyText, stableId, normalizeConnectorPlayer};
