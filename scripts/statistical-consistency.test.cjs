const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../pages/team-profile/teamProfileMetrics.js'), 'utf8');
const sandbox = {
  window:{}, console,
  TeamProfileData:{dateOf:row=>row.date||'',currentSeason:()=> '2026-2027'},
  TeamProfileFilters:{scoreOf:()=>({forGoals:0,againstGoals:0}),resultOf:()=>({code:'',label:''}),matchTypeOf:()=>'',matchTypeLabel:()=>'',venueOf:()=>''}
};
sandbox.window.TeamProfileData=sandbox.TeamProfileData;
sandbox.window.TeamProfileFilters=sandbox.TeamProfileFilters;
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
const Metrics=sandbox.window.TeamProfileMetrics;

const manual={matchId:'manual',entryMode:'FULL_POST_MATCH',statsSource:'MANUAL',players:{Alice:{but:2,tirCadre:3,tirNonCadre:null,passe:1,recup:4}},opp:{butAdv:1,tirCadreAdv:2,tirNonCadreAdv:null}};
let stats=Metrics.collectiveStats([], [manual]);
assert.equal(stats.attack.goals,2);
assert.equal(stats.attack.shotsOn,3);
assert.equal(stats.attack.shotsOff,null);
assert.equal(stats.defense.recoveries,4);

const mixed={matchId:'mixed',entryMode:'LIVE',statsSource:'MIXED',players:{Alice:{but:3,tirCadre:2}},statsProvenance:{players:{Alice:{but:'CORRECTED'}}}};
const mixedEvents=[{eventId:'g1',matchId:'mixed',player:'Alice',action:'But'},{eventId:'s1',matchId:'mixed',player:'Alice',action:'Tir cadré'}];
stats=Metrics.collectiveStats(mixedEvents,[mixed]);
assert.equal(stats.attack.goals,3,'la correction manuelle est canonique pour les buts');
assert.equal(stats.attack.shotsOn,1,'les événements restent canoniques pour le tir non corrigé');

const xg=Metrics.xgStats([{matchId:'xg',date:'2026-01-01',xg:1.2}], [{eventId:'x1',matchId:'xg',xg:1.2}]);
assert.equal(xg.xg,1.2,'le xG agrégé et sa représentation événementielle ne sont pas additionnés');

console.log('Statistical consistency checks passed: manual, mixed and xG canonical sources.');
