const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {findingsForHtml} = require('./check-public-personal-data.js');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'pages/tests-techniques/testsTechniquesConfig.js');

function assert(condition, message) {
  if(!condition) throw new Error(message);
}

function extractFunction(source, name) {
  const match = source.match(new RegExp(`function ${name}\\([^\\n]*\\)\\{[^\\n]+\\}`));
  assert(match, `Fonction ${name} introuvable.`);
  return match[0];
}

function checkTechnicalEntry(relativeHtmlPath) {
  const htmlPath = path.join(root, relativeHtmlPath);
  assert(fs.existsSync(htmlPath), `HTML Tests techniques introuvable: ${relativeHtmlPath}`);
  const source = fs.readFileSync(htmlPath, 'utf8');
  const configTag = '<script src="./tests-techniques/testsTechniquesConfig.js"></script>';
  const configPosition = source.indexOf(configTag);
  const applicationPosition = source.indexOf('const technicalConfig=window.CoachPulseTechnicalConfig;');

  assert(configPosition >= 0, `${relativeHtmlPath}: chargement de testsTechniquesConfig.js absent.`);
  assert(applicationPosition > configPosition, `${relativeHtmlPath}: la configuration doit être chargée avant son utilisation.`);
  assert(source.includes('const {TESTS=[],GROUPS={},FAMILY_LABEL={}}=technicalConfig||{};'), `${relativeHtmlPath}: import TESTS/GROUPS/FAMILY_LABEL absent.`);
  assert(source.includes("if(!technicalConfigReady){showTechnicalConfigError();return;}recoverPendingRows();buildFields();"), `${relativeHtmlPath}: l'initialisation doit s'arrêter avant les données et Firestore si la configuration manque.`);
  assert(source.includes('Configuration des tests techniques indisponible.'), `${relativeHtmlPath}: message d'erreur de configuration absent.`);
  assert(source.includes("$('commonSave').addEventListener('click',saveCommon)"), `${relativeHtmlPath}: événement Enregistrer absent.`);
  assert(source.includes("$('commonClear').addEventListener('click',clearCommon)"), `${relativeHtmlPath}: événement Vider absent.`);
  assert(source.includes('function saveCommon()') && source.includes('function clearCommon()'), `${relativeHtmlPath}: gestionnaires des boutons incomplets.`);
  assert(findingsForHtml(source).length === 0, `${relativeHtmlPath}: données personnelles ou image embarquée détectées.`);

  const configSource = fs.readFileSync(configPath, 'utf8');
  const zones = {
    fieldsMax:{children:[], appendChild(node){this.children.push(node);}},
    fieldsReg:{children:[], appendChild(node){this.children.push(node);}},
    fieldsMouv:{children:[], appendChild(node){this.children.push(node);}}
  };
  Object.values(zones).forEach(zone => Object.defineProperty(zone, 'innerHTML', {set(){this.children=[];}}));
  const sandbox = {
    window:{},
    document:{
      getElementById(id){return zones[id] || null;},
      createElement(){return {innerHTML:''};}
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(configSource, sandbox, {filename:configPath});
  sandbox.TESTS = sandbox.window.CoachPulseTechnicalConfig.TESTS;
  sandbox.GROUPS = sandbox.window.CoachPulseTechnicalConfig.GROUPS;
  vm.runInContext(`const $=id=>document.getElementById(id);${extractFunction(source, 'addField')}${extractFunction(source, 'buildFields')}buildFields();`, sandbox, {filename:relativeHtmlPath});

  assert(sandbox.TESTS.length === 11, `${relativeHtmlPath}: 11 définitions de champs attendues.`);
  assert(zones.fieldsMax.children.length === 4, `${relativeHtmlPath}: groupe Maximum incomplet.`);
  assert(zones.fieldsReg.children.length === 4, `${relativeHtmlPath}: groupe Régularité incomplet.`);
  assert(zones.fieldsMouv.children.length === 3, `${relativeHtmlPath}: groupe Mouvement incomplet.`);
  assert(Object.values(zones).reduce((count, zone) => count + zone.children.length, 0) === 11, `${relativeHtmlPath}: 11 champs doivent être générés.`);
}

if(require.main === module) {
  const entries = process.argv.slice(2);
  (entries.length ? entries : ['pages/tests-techniques.html']).forEach(checkTechnicalEntry);
  console.log(`Technical tests entry guards OK (${entries.length || 1} HTML checked; 11 fields generated).`);
}

module.exports = {checkTechnicalEntry};
