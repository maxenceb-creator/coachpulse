import { cleanText, keyText, stableId, parseDate, normalizeCategorie, normalizeSousCategorie, splitName } from './fichesJoueusesConnector.js';

const BASE_ALIASES = {
  fullName:['joueuse','joueur','nom complet','nom prenom','nom prénom','nom et prenom','nom et prénom','nom prénom concaténé','licencie','licencié','player'],
  nom:['nom','last name','surname'],
  prenom:['prenom','prénom','first name','firstname'],
  categorie:['categorie','catégorie','category','groupe','equipe','équipe','collectif'],
  sousCategorie:['sous categorie','sous catégorie','subcategory','sub category','age','annee','année'],
  dateNaissance:['date naissance','date de naissance','naissance','birthday','birth','dob'],
  date:['date','jour','date test','test date'],
  testName:['test','nom test','test name','atelier','exercice','mesure'],
  value:['valeur','resultat','résultat','score','performance','perf'],
  unit:['unite','unité','unit','mesure unite','mesure unité'],
  season:['saison','season']
};

const TECHNICAL_HINTS = /(jongle|jonglage|pied|pfp|pfm|tete|tête|conduite|passe|technique|max_|reg_|mouv_|dribble|contrôle|controle)/;
const PHYSICAL_HINTS = /(vitesse|sprint|vmi|vma|ift|30 15|endurance|force|detente|détente|agilite|agilité|illinois|physique|yo yo|yoyo|cooper|cmj|sj|navette|luc leger|léger)/;

function detectColumn(header){
  const key = keyText(header);
  for(const [field, aliases] of Object.entries(BASE_ALIASES)){
    if(aliases.some(alias => key === keyText(alias))) return field;
  }
  for(const [field, aliases] of Object.entries(BASE_ALIASES)){
    if(aliases.some(alias => {
      const aliasKey = keyText(alias);
      if(field === 'testName' && aliasKey === 'test') return false;
      return aliasKey.length > 3 && key.includes(aliasKey);
    })) return field;
  }
  return '';
}

function toNumber(value){
  const raw = cleanText(value).replace(',','.');
  if(!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function inferUnit(testName, explicit=''){
  if(explicit) return cleanText(explicit);
  const key = keyText(testName);
  if(/km h|kmh|vmi|ift|30 15/.test(key)) return 'km/h';
  if(/vitesse|sprint|agilite|agilite|illinois|navette/.test(key)) return 's';
  if(/vma|endurance|cooper|yo yo|yoyo|luc leger/.test(key)) return 'palier';
  if(/detente|cmj|sj/.test(key)) return 'cm';
  return '';
}

function playerFromMapped(mapped, rowNumber, connector){
  const names = splitName(mapped);
  const fullName = cleanText(mapped.fullName || '');
  if(!names.nom && !names.prenom && !fullName) return {error:'joueuse non détectée'};
  const sousCategorie = normalizeSousCategorie(mapped.sousCategorie || mapped.categorie || '');
  const categorie = normalizeCategorie(mapped.categorie || sousCategorie || '');
  const dateNaissance = parseDate(mapped.dateNaissance);
  const playerId = stableId('player', names.prenom || fullName, names.nom, dateNaissance || 'no-birth');
  return {type:'player', connector, rowNumber, playerId, nom:names.nom, prenom:names.prenom, fullName, categorie, sousCategorie, dateNaissance, birth:dateNaissance};
}

function shouldUseWideColumn(header, value, mode){
  const key = keyText(header);
  const numeric = toNumber(value);
  if(numeric == null) return false;
  if(mode === 'technical') return TECHNICAL_HINTS.test(key) || (!PHYSICAL_HINTS.test(key) && key.length > 1);
  if(mode === 'physical') return PHYSICAL_HINTS.test(key) || (!TECHNICAL_HINTS.test(key) && key.length > 1);
  return false;
}

export function createTestAnalyzer({mode, connector, itemType}){
  return function analyzeRows(rows, context={}){
    const columns = new Map();
    rows.forEach(row => Object.keys(row || {}).filter(k => !k.startsWith('__')).forEach(header => {
      if(!columns.has(header)) columns.set(header, detectColumn(header));
    }));

    const result = {
      connector,
      fileName:context.fileName || '',
      rowsRead:rows.length,
      columns:[...columns.entries()].map(([header, field]) => ({header, field:field || 'test détectable'})),
      items:[],
      anomalies:[],
      formulas:[]
    };

    const seen = new Set();
    rows.forEach((row, index) => {
      const rowNumber = row.__rowNumber || index + 1;
      const mapped = {};
      const extras = [];
      Object.entries(row || {}).forEach(([header, value]) => {
        if(header.startsWith('__')) return;
        const field = columns.get(header);
        if(field && mapped[field] == null) mapped[field] = value;
        else extras.push({header, value});
      });

      if(row.__formulas){
        Object.entries(row.__formulas).forEach(([header, formula]) => {
          result.formulas.push({row:rowNumber, column:header, formula, value:row[header] || ''});
          if(!cleanText(row[header])) result.anomalies.push({row:rowNumber, level:'warn', message:`Formule sans valeur calculée exploitable dans ${header}`});
        });
      }

      const player = playerFromMapped(mapped, rowNumber, connector);
      if(player.error){
        result.anomalies.push({row:rowNumber, level:player.error.includes('incomplet')?'error':'ignored', message:`Ligne ignorée : ${player.error}`});
        return;
      }
      const date = parseDate(mapped.date);
      const season = cleanText(mapped.season || '');
      const directValue = toNumber(mapped.value);
      if(mapped.testName && directValue != null){
        const testName = cleanText(mapped.testName);
        const testId = stableId(itemType, player.playerId, date || 'date-inconnue', testName);
        const key = `${itemType}:${testId}`;
        if(seen.has(key)) result.anomalies.push({row:rowNumber, level:'warn', message:`Doublon test : ${player.nom} ${player.prenom} ${testName}`});
        seen.add(key);
        result.items.push({
          type:itemType, connector, rowNumber, testId, playerId:player.playerId,
          playerName:player.fullName || `${player.nom} ${player.prenom}`.trim(), nom:player.nom, prenom:player.prenom, fullName:player.fullName, date, season,
          categorie:player.categorie, sousCategorie:player.sousCategorie,
          testName, value:directValue, unit:inferUnit(testName, mapped.unit)
        });
      }

      extras.forEach(({header, value}) => {
        if(!shouldUseWideColumn(header, value, mode)) return;
        const numeric = toNumber(value);
        const testName = cleanText(header);
        const testId = stableId(itemType, player.playerId, date || 'date-inconnue', testName);
        const key = `${itemType}:${testId}`;
        if(seen.has(key)) result.anomalies.push({row:rowNumber, level:'warn', message:`Doublon test : ${player.nom} ${player.prenom} ${testName}`});
        seen.add(key);
        result.items.push({
          type:itemType, connector, rowNumber, testId, playerId:player.playerId,
          playerName:player.fullName || `${player.nom} ${player.prenom}`.trim(), nom:player.nom, prenom:player.prenom, fullName:player.fullName, date, season,
          categorie:player.categorie, sousCategorie:player.sousCategorie,
          testName, value:numeric, unit:inferUnit(testName, mapped.unit)
        });
      });

      if(!result.items.some(item => item.rowNumber === rowNumber && item.type === itemType)){
        result.anomalies.push({row:rowNumber, level:'warn', message:`Aucun résultat de test reconnu pour ${player.nom} ${player.prenom}`});
      }
    });

    return result;
  };
}

export default {createTestAnalyzer};
