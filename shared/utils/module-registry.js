// CoachPulse shared module registry.
// Keeps the app navigation catalog outside app.js without changing module behavior.

(function(global){
  const ROLES = {
    core:['ADMIN','RESPONSABLE_CATEGORIE'],
    sportRead:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','OBSERVATEUR_STAFF','LECTURE'],
    sportWrite:['ADMIN','RESPONSABLE_CATEGORIE','COACH'],
    physicalWrite:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE'],
    medicalRead:['ADMIN','RESPONSABLE_CATEGORIE','MEDICAL'],
    medicalWrite:['ADMIN','MEDICAL']
  };

  const DEFAULT_MODULE_REGISTRY = [
    {id:'home', name:'Accueil', icon:'🏠', section:'staff', active:true, collection:'settings', screen:{type:'internal'}, permissions:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','MEDICAL','OBSERVATEUR_STAFF','LECTURE']}, settings:{showInNav:true, showOnDashboard:false}},
    {id:'stats', name:'Matchs', icon:'📊', section:'staff', active:true, collection:'matches', relatedCollections:['matchEvents','players','teams','settings'], screen:{type:'iframe', src:'pages/coach-stats.html'}, permissions:{read:ROLES.sportRead, write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Prise de statistiques et bilan match.'}},
    {id:'presences', name:'Présences', icon:'✅', section:'staff', active:true, collection:'attendance', relatedCollections:['sessions','players','teams','settings'], screen:{type:'iframe', src:'pages/presences.html'}, permissions:{read:ROLES.sportRead, write:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE'], importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Suivi séances, statuts et charge.'}},
    {id:'tests', name:'Tests', icon:'⚡', section:'staff', active:true, collection:'technicalTests', relatedCollections:['physicalTests','players','teams','settings'], screen:{type:'iframe', src:'pages/tests-techniques.html'}, permissions:{read:ROLES.sportRead, write:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE'], importExport:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE']}, settings:{showInNav:true, showOnDashboard:true, description:'Technique, progression et évaluations.'}},
    {id:'tests-athletiques', name:'Tests athlétiques', icon:'🏃', section:'staff', active:true, collection:'physicalTests', relatedCollections:['players','teams','settings'], screen:{type:'iframe', src:'pages/tests-athletiques.html'}, permissions:{read:ROLES.sportRead, write:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE'], importExport:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE']}, settings:{showInNav:true, showOnDashboard:true, description:'VMI, vitesse, agilité, CMJ et bilans physiques branchés sur playerId.'}},
    {id:'methodologie', name:'Bilans & planning', icon:'🧭', section:'staff', active:true, collection:'sessions', relatedCollections:['settings','teams'], screen:{type:'iframe', src:'pages/methodologie.html'}, permissions:{read:ROLES.sportRead, write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Méthodologie, calendrier et attendus.'}},
    {id:'database', name:'Joueuses & base', icon:'🧩', section:'admin', active:true, collection:'players', relatedCollections:['teams','settings','changeLogs'], screen:{type:'iframe', src:'pages/admin-database.html'}, permissions:{read:ROLES.core, write:ROLES.core, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Corriger la base Firestore commune.'}},
    {id:'dataHub', name:'Data Hub', icon:'🗄️', section:'admin', active:true, collection:'syncLogs', relatedCollections:['players','teams','matches','sessions','attendance','technicalTests','physicalTests'], screen:{type:'iframe', src:'pages/data-hub.html'}, permissions:{read:ROLES.core, write:ROLES.core, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Importer, simuler et synchroniser.'}},
    {id:'cloud', name:'Cloud', icon:'☁️', section:'admin', active:true, collection:'syncLogs', relatedCollections:['settings','changeLogs'], screen:{type:'internal'}, permissions:{read:ROLES.core, write:ROLES.core, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Synchronisation Firebase, statut cloud et sauvegardes.'}},
    {id:'admin', name:'Gestion utilisateurs', icon:'👥', section:'admin', active:true, collection:'staff_members', relatedCollections:['settings','changeLogs'], screen:{type:'internal'}, permissions:{read:['ADMIN'], write:['ADMIN'], importExport:['ADMIN']}, settings:{showInNav:true, showOnDashboard:true, description:'Rôles, équipes et comptes.'}},
    {id:'injuries', name:'Blessures', icon:'🩹', section:'future', active:false, collection:'injuries', relatedCollections:['players','teams','settings'], screen:{type:'iframe', src:'pages/blessures.html'}, permissions:{read:ROLES.medicalRead, write:ROLES.medicalWrite, importExport:ROLES.medicalWrite}, settings:{showInNav:false, showOnDashboard:false, description:'Suivi blessures et indisponibilités.'}},
    {id:'workload', name:'Charge de travail', icon:'📈', section:'future', active:false, collection:'workloads', relatedCollections:['players','teams','sessions'], screen:{type:'iframe', src:'pages/charge-travail.html'}, permissions:{read:ROLES.sportRead, write:ROLES.physicalWrite, importExport:ROLES.core}, settings:{showInNav:false, showOnDashboard:false, description:'Charge, volumes et ressentis.'}},
    {id:'convocations', name:'Convocations', icon:'📣', section:'future', active:false, collection:'convocations', relatedCollections:['players','teams','matches'], screen:{type:'iframe', src:'pages/convocations.html'}, permissions:{read:ROLES.sportRead, write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:false, showOnDashboard:false, description:'Groupes, convocations et disponibilités.'}},
    {id:'medical', name:'Suivi médical', icon:'🩺', section:'staff', active:true, collection:'injuries', relatedCollections:['players','teams','injuryUpdates','medicalAppointments','rehabRoutines','settings'], screen:{type:'iframe', src:'pages/suivi-medical.html'}, permissions:{read:ROLES.medicalRead, write:ROLES.medicalWrite, importExport:ROLES.medicalWrite}, settings:{showInNav:true, showOnDashboard:true, description:'Blessures, douleurs, rendez-vous et reprise.'}},
    {id:'playerProfile', name:'Fiche individuelle', icon:'👤', section:'staff', active:true, collection:'players', relatedCollections:['attendance','sessions','matches','matchEvents','technicalTests','physicalTests','injuries','injuryUpdates','medicalAppointments','rehabRoutines','workloads','medicalFollowUps'], screen:{type:'iframe', src:'pages/player-profile.html'}, permissions:{read:ROLES.sportRead, write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Tableau de bord joueuse par playerId, saisons et comparaisons.'}},
    {id:'teamProfile', name:'Fiche équipe', icon:'🛡️', section:'staff', active:true, collection:'teams', relatedCollections:['players','matches','matchEvents','sessions','attendance','technicalTests','physicalTests','injuries','workloads'], screen:{type:'iframe', src:'pages/team-profile.html'}, permissions:{read:ROLES.sportRead, write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Bilan complet équipe par teamId, résultats, effectif et tendances.'}},
    {id:'individualReports', name:'Bilans individuels', icon:'📝', section:'future', active:false, collection:'individualReports', relatedCollections:['players','teams','matches','attendance','technicalTests','physicalTests'], screen:{type:'iframe', src:'pages/bilans-individuels.html'}, permissions:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','OBSERVATEUR_STAFF','LECTURE'], write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:false, showOnDashboard:false, description:'Bilans individuels staff.'}}
  ];

  function parseModuleOverrides(){
    try{ return JSON.parse(global.localStorage?.getItem('coachpulse:moduleSettings') || '{}') || {}; }catch(_e){ return {}; }
  }

  function moduleWithOverrides(module){
    const overrides = parseModuleOverrides()[module.id] || {};
    return {...module, ...overrides, screen:{...(module.screen||{}), ...(overrides.screen||{})}, permissions:{...(module.permissions||{}), ...(overrides.permissions||{})}, settings:{...(module.settings||{}), ...(overrides.settings||{})}};
  }

  function moduleRegistry(){ return DEFAULT_MODULE_REGISTRY.map(moduleWithOverrides); }
  function getModule(id){ return moduleRegistry().find(module => module.id === id); }
  function moduleToTool(module){
    return {
      title:module.name,
      emoji:module.icon,
      src:module.screen?.src || '',
      internal:module.screen?.type === 'internal',
      admin:module.section === 'admin' || module.permissions?.read?.every(role => ['ADMIN','RESPONSABLE','RESPONSABLE_CATEGORIE'].includes(role)),
      module
    };
  }
  function buildTools(){ return Object.fromEntries(moduleRegistry().filter(module => module.active !== false).map(module => [module.id, moduleToTool(module)])); }

  const service = {
    ROLES,
    DEFAULT_MODULE_REGISTRY,
    parseModuleOverrides,
    moduleWithOverrides,
    moduleRegistry,
    getModule,
    moduleToTool,
    buildTools
  };

  global.CoachPulseModuleRegistry = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
