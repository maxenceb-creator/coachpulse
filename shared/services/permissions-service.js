// CoachPulse shared permissions service.
// Separates club role, team/module scope and actual permission level.

(function(global){
  const ROLES = {
    RESPONSABLE_POLE:'RESPONSABLE_POLE',
    ENTRAINEUR:'ENTRAINEUR',
    ENTRAINEUR_ADJOINT:'ENTRAINEUR_ADJOINT',
    PREPARATEUR_PHYSIQUE:'PREPARATEUR_PHYSIQUE',
    KINE:'KINE',
    MEDECIN:'MEDECIN',
    DIRIGEANT:'DIRIGEANT'
  };

  const ROLE_ALIASES = {
    ADMIN:'DIRIGEANT',
    RESPONSABLE:'RESPONSABLE_POLE',
    RESPONSABLE_CATEGORIE:'RESPONSABLE_POLE',
    RESPONSABLE_CATEGORY:'RESPONSABLE_POLE',
    COACH:'ENTRAINEUR',
    EDUCATEUR:'ENTRAINEUR',
    EDUCATEUR_SPORTIF:'ENTRAINEUR',
    ADJOINT:'ENTRAINEUR_ADJOINT',
    ENTRAINEUR_ADJOINT:'ENTRAINEUR_ADJOINT',
    ENTRAINEUR_ADJOINT_E:'ENTRAINEUR_ADJOINT',
    PREPARATEUR:'PREPARATEUR_PHYSIQUE',
    PREPARATEUR_ATHLETIQUE:'PREPARATEUR_PHYSIQUE',
    PREPARATEUR_PHYSIQUE:'PREPARATEUR_PHYSIQUE',
    MEDICAL:'KINE',
    KINE:'KINE',
    KINÉ:'KINE',
    MEDECIN:'MEDECIN',
    MÉDECIN:'MEDECIN',
    STAFF:'DIRIGEANT',
    OBSERVATEUR:'DIRIGEANT',
    OBSERVATEUR_STAFF:'DIRIGEANT',
    LECTURE:'DIRIGEANT',
    LECTURE_SEULE:'DIRIGEANT',
    PARENT:'DIRIGEANT',
    JOUEUSE:'DIRIGEANT',
    JOUEUSE_PARENT:'DIRIGEANT'
  };

  const ROLE_LABELS = {
    RESPONSABLE_POLE:'Responsable de pôle',
    ENTRAINEUR:'Entraîneur',
    ENTRAINEUR_ADJOINT:'Entraîneur adjoint',
    PREPARATEUR_PHYSIQUE:'Préparateur physique',
    KINE:'Kiné',
    MEDECIN:'Médecin',
    DIRIGEANT:'Dirigeant'
  };

  const PERMISSIONS = {
    LECTEUR:'LECTEUR',
    SAISIE:'SAISIE',
    EDITEUR:'EDITEUR',
    ADMIN:'ADMIN'
  };

  const PERMISSION_LABELS = {
    LECTEUR:'Lecteur',
    SAISIE:'Saisie',
    EDITEUR:'Éditeur',
    ADMIN:'Admin'
  };

  const PERMISSION_RANK = {
    LECTEUR:1,
    SAISIE:2,
    EDITEUR:3,
    ADMIN:4
  };

  const MODULE_PERMISSIONS = {
    home:{read:true},
    stats:{read:true, write:true, importExport:true},
    presences:{read:true, write:true, importExport:true},
    tests:{read:true, write:true, importExport:true},
    methodologie:{read:true, write:true, importExport:true},
    database:{read:true, write:true, importExport:true},
    dataHub:{read:true, write:true, importExport:true},
    admin:{read:true, write:true, importExport:true},
    medical:{read:true, write:true, importExport:true},
    playerProfile:{read:true, write:true, importExport:true},
    injuries:{read:true, write:true, importExport:true},
    workload:{read:true, write:true, importExport:true},
    convocations:{read:true, write:true, importExport:true},
    individualReports:{read:true, write:true, importExport:true},
    'tests-athletiques':{read:true, write:true, importExport:true},
    'tests-techniques':{read:true, write:true}
  };

  const LEGACY_ROLE_MODULES = {
    ADMIN:'*',
    RESPONSABLE:['stats','presences','tests','methodologie','database','dataHub','admin','medical','playerProfile','injuries','workload','convocations','individualReports'],
    RESPONSABLE_CATEGORIE:['stats','presences','tests','methodologie','database','dataHub','medical','playerProfile','injuries','workload','convocations','individualReports'],
    EDUCATEUR:['stats','presences','tests','methodologie','playerProfile','workload','convocations','individualReports'],
    COACH:['stats','presences','tests','methodologie','playerProfile','workload','convocations','individualReports'],
    PREPARATEUR_ATHLETIQUE:['presences','tests','workload'],
    PREPARATEUR_PHYSIQUE:['presences','tests','workload'],
    MEDICAL:['medical','injuries'],
    KINE:['medical','injuries'],
    MEDECIN:['medical','injuries'],
    OBSERVATEUR_STAFF:['stats','presences','tests','methodologie','playerProfile','individualReports'],
    LECTURE:['stats','presences','tests','methodologie','playerProfile','individualReports']
  };

  function asText(value){ return String(value ?? '').trim(); }
  function normalizeKey(value, fallback=''){
    const raw = asText(value || fallback).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return raw || fallback;
  }

  function normalizeRole(role){
    const raw = normalizeKey(role, 'DIRIGEANT');
    return ROLES[raw] ? raw : (ROLE_ALIASES[raw] || 'DIRIGEANT');
  }
  function roleLabel(role){ return ROLE_LABELS[normalizeRole(role)] || asText(role) || 'Dirigeant'; }
  function getRole(profile={}, fallback='DIRIGEANT'){
    return normalizeRole(profile?.businessRole || profile?.role || profile?.userRole || fallback);
  }

  function legacyPermissionFromRole(role){
    const raw = normalizeKey(role, '');
    if(raw === 'ADMIN') return 'ADMIN';
    if(raw === 'RESPONSABLE' || raw === 'RESPONSABLE_CATEGORIE') return 'EDITEUR';
    if(['LECTURE','LECTURE_SEULE','OBSERVATEUR','OBSERVATEUR_STAFF','JOUEUSE','PARENT','JOUEUSE_PARENT'].includes(raw)) return 'LECTEUR';
    return 'SAISIE';
  }

  function normalizePermission(permission, profile={}){
    const explicit = permission ?? profile?.permissionLevel ?? profile?.permission ?? profile?.accessLevel;
    const raw = normalizeKey(explicit || '', '');
    if(PERMISSIONS[raw]) return raw;
    return legacyPermissionFromRole(profile?.legacyRole || profile?.role || profile?.userRole);
  }
  function permissionLabel(permission, profile){ return PERMISSION_LABELS[normalizePermission(permission, profile)] || 'Lecteur'; }
  function hasPermission(profile={}, minimum='LECTEUR'){
    if(!isActive(profile)) return false;
    return (PERMISSION_RANK[normalizePermission(null, profile)] || 0) >= (PERMISSION_RANK[normalizePermission(minimum)] || 1);
  }

  function isActive(profile={}){
    return !['ARCHIVED','INACTIVE','DISABLED'].includes(asText(profile?.status || 'ACTIVE').toUpperCase());
  }

  function list(value){
    if(Array.isArray(value)) return value.map(asText).filter(Boolean);
    if(value == null || value === '') return [];
    return String(value).split(/[,;\n]+/).map(asText).filter(Boolean);
  }

  function teamIds(profile={}){
    return [
      ...list(profile?.teamIds),
      ...list(profile?.allowedTeamIds),
      ...list(profile?.authorizedTeams),
      ...list(profile?.equipesAutorisees),
      ...list(profile?.scope)
    ].map(v => v.toLowerCase());
  }

  function moduleOverrides(profile={}){
    const out = {};
    const allowedModules = list(profile?.allowedModules || profile?.modulesAutorises);
    allowedModules.forEach(moduleId => {
      out[moduleId] = {...(out[moduleId] || {}), read:true};
    });
    const specific = profile?.modulePermissions || profile?.permissionsSpecifiques || {};
    Object.entries(specific || {}).forEach(([moduleId, permissions]) => {
      out[moduleId] = {...(out[moduleId] || {}), ...(permissions || {})};
    });
    return out;
  }

  function hasExplicitModuleScope(profile={}){
    if(normalizePermission(null, profile) === 'ADMIN') return false;
    return list(profile?.allowedModules || profile?.modulesAutorises).length > 0
      || Object.keys(profile?.modulePermissions || profile?.permissionsSpecifiques || {}).length > 0;
  }

  function legacyRoleModules(profile={}){
    const raw = normalizeKey(profile?.legacyRole || profile?.role || profile?.userRole || '', '');
    return LEGACY_ROLE_MODULES[raw] || LEGACY_ROLE_MODULES[normalizeRole(raw)] || [];
  }

  function moduleAllowedByScope(profile={}, moduleId=''){
    if(normalizePermission(null, profile) === 'ADMIN') return true;
    if(moduleId === 'home') return true;
    if(!hasExplicitModuleScope(profile)){
      const legacy = legacyRoleModules(profile);
      return legacy === '*' || legacy.includes(moduleId);
    }
    const overrides = moduleOverrides(profile)[moduleId] || {};
    return overrides.read === true;
  }

  function canUseModule(profileOrModule, maybeModuleOrRole, action='read'){
    const legacyCall = profileOrModule && profileOrModule.id && typeof maybeModuleOrRole === 'string';
    const profile = legacyCall ? {role:maybeModuleOrRole, status:'ACTIVE'} : profileOrModule;
    const module = legacyCall ? profileOrModule : maybeModuleOrRole;
    if(!module || module.active === false || !isActive(profile)) return false;
    const moduleId = module.id || String(module || '');
    if(!moduleAllowedByScope(profile, moduleId)) return false;
    if(action === 'read') return hasPermission(profile, 'LECTEUR');
    if(action === 'write') return hasPermission(profile, 'SAISIE');
    if(action === 'importExport') return hasPermission(profile, 'EDITEUR');
    if(action === 'delete') return hasPermission(profile, 'EDITEUR');
    return hasPermission(profile, 'LECTEUR');
  }

  function canViewModule(profile, module){ return canUseModule(profile, module, 'read'); }
  function canEditModule(profile, module){ return canUseModule(profile, module, 'write'); }
  function canDeleteData(profile){ return hasPermission(profile, 'EDITEUR'); }
  function canManageUsers(profile){ return hasPermission(profile, 'EDITEUR') && (moduleAllowedByScope(profile, 'admin') || !hasExplicitModuleScope(profile)); }
  function canManageCoreData(profile){
    return hasPermission(profile, 'EDITEUR')
      && (moduleAllowedByScope(profile, 'database') || moduleAllowedByScope(profile, 'dataHub') || !hasExplicitModuleScope(profile));
  }

  function canAccessTeam(profile={}, teamId=''){
    if(!isActive(profile)) return false;
    if(normalizePermission(null, profile) === 'ADMIN') return true;
    const allowed = teamIds(profile);
    if(!allowed.length) return true;
    const target = asText(teamId).toLowerCase();
    return Boolean(target) && allowed.includes(target);
  }

  function canAccessPlayer(profile={}, player={}){
    if(!isActive(profile)) return false;
    if(normalizePermission(null, profile) === 'ADMIN') return true;
    const ownPlayerIds = list(profile?.playerIds || profile?.allowedPlayerIds).map(v => v.toLowerCase());
    const playerId = asText(player?.playerId || player?.id || player).toLowerCase();
    if(ownPlayerIds.length) return Boolean(playerId) && ownPlayerIds.includes(playerId);
    return canAccessTeam(profile, player?.teamId || player?.team || player?.categorie || player?.subCategory || '');
  }

  function visibleModules(modules=[], profileOrRole, section){
    const profile = typeof profileOrRole === 'string' ? {role:profileOrRole, status:'ACTIVE'} : profileOrRole;
    return modules.filter(module =>
      module
      && module.active !== false
      && module.settings?.showInNav !== false
      && (!section || module.section === section)
      && canViewModule(profile, module)
    );
  }

  function defaultProfile(user={}, role='ENTRAINEUR', permissionLevel='LECTEUR'){
    return {
      uid:user.uid || '',
      email:user.email || '',
      name:user.displayName || user.email || '',
      role:normalizeRole(role),
      roleLabel:roleLabel(role),
      permissionLevel:normalizePermission(permissionLevel),
      permissionLabel:permissionLabel(permissionLevel),
      status:'ACTIVE',
      teamIds:[],
      allowedTeamIds:[],
      allowedModules:[],
      modulePermissions:{},
      userType:'staff'
    };
  }

  const service = {
    ROLES, ROLE_ALIASES, ROLE_LABELS, PERMISSIONS, PERMISSION_LABELS, PERMISSION_RANK,
    MODULE_PERMISSIONS, LEGACY_ROLE_MODULES,
    normalizeRole, roleLabel, getRole, normalizePermission, permissionLabel, hasPermission, isActive,
    canUseModule, canViewModule, canEditModule, canDeleteData,
    canManageUsers, canManageCoreData, canAccessTeam, canAccessPlayer,
    visibleModules, teamIds, moduleOverrides, hasExplicitModuleScope, defaultProfile
  };

  global.CoachPulsePermissionsService = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
