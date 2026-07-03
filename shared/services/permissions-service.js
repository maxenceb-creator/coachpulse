// CoachPulse shared permissions service.
// Central role and permission helpers. Kept framework-free for legacy pages.

(function(global){
  const ROLES = {
    ADMIN:'ADMIN',
    RESPONSABLE_CATEGORIE:'RESPONSABLE_CATEGORIE',
    COACH:'COACH',
    PREPARATEUR_ATHLETIQUE:'PREPARATEUR_ATHLETIQUE',
    MEDICAL:'MEDICAL',
    OBSERVATEUR_STAFF:'OBSERVATEUR_STAFF',
    LECTURE:'LECTURE',
    JOUEUSE_PARENT:'JOUEUSE_PARENT'
  };

  const ROLE_ALIASES = {
    RESPONSABLE:'RESPONSABLE_CATEGORIE',
    RESPONSABLE_CATEGORIE:'RESPONSABLE_CATEGORIE',
    RESPONSABLE_CATEGORY:'RESPONSABLE_CATEGORIE',
    EDUCATEUR:'COACH',
    EDUCATEUR_SPORTIF:'COACH',
    STAFF:'OBSERVATEUR_STAFF',
    KINE:'MEDICAL',
    KINÉ:'MEDICAL',
    MEDICAL_KINE:'MEDICAL',
    PREPARATEUR:'PREPARATEUR_ATHLETIQUE',
    PREPARATEUR_PHYSIQUE:'PREPARATEUR_ATHLETIQUE',
    OBSERVATEUR:'OBSERVATEUR_STAFF',
    LECTURE_SEULE:'LECTURE',
    PARENT:'JOUEUSE_PARENT',
    JOUEUSE:'JOUEUSE_PARENT'
  };

  const ROLE_LABELS = {
    ADMIN:'Admin',
    RESPONSABLE_CATEGORIE:'Responsable catégorie',
    COACH:'Coach',
    PREPARATEUR_ATHLETIQUE:'Préparateur athlétique',
    MEDICAL:'Médical / Kiné',
    OBSERVATEUR_STAFF:'Observateur staff',
    LECTURE:'Lecture seule',
    JOUEUSE_PARENT:'Joueuse / Parent'
  };

  const ADMIN_ROLES = ['ADMIN'];
  const CORE_DATA_ROLES = ['ADMIN', 'RESPONSABLE_CATEGORIE'];
  const READ_ONLY_ROLES = ['LECTURE', 'OBSERVATEUR_STAFF', 'JOUEUSE_PARENT'];
  const ALL_STAFF_ROLES = [
    'ADMIN',
    'RESPONSABLE_CATEGORIE',
    'COACH',
    'PREPARATEUR_ATHLETIQUE',
    'MEDICAL',
    'OBSERVATEUR_STAFF',
    'LECTURE'
  ];

  const MODULE_PERMISSIONS = {
    home:{read:ALL_STAFF_ROLES},
    stats:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','COACH'], importExport:['ADMIN','RESPONSABLE_CATEGORIE']},
    presences:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE'], importExport:['ADMIN','RESPONSABLE_CATEGORIE']},
    tests:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE'], importExport:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE']},
    methodologie:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','COACH'], importExport:['ADMIN','RESPONSABLE_CATEGORIE']},
    database:{read:['ADMIN','RESPONSABLE_CATEGORIE'], write:['ADMIN','RESPONSABLE_CATEGORIE'], importExport:['ADMIN','RESPONSABLE_CATEGORIE']},
    dataHub:{read:['ADMIN','RESPONSABLE_CATEGORIE'], write:['ADMIN','RESPONSABLE_CATEGORIE'], importExport:['ADMIN','RESPONSABLE_CATEGORIE']},
    admin:{read:['ADMIN'], write:['ADMIN'], importExport:['ADMIN']},
    medical:{read:['ADMIN','RESPONSABLE_CATEGORIE','MEDICAL'], write:['ADMIN','MEDICAL'], importExport:['ADMIN','MEDICAL']},
    injuries:{read:['ADMIN','RESPONSABLE_CATEGORIE','MEDICAL'], write:['ADMIN','MEDICAL'], importExport:['ADMIN','MEDICAL']},
    workload:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE']},
    convocations:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','COACH']},
    individualReports:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','COACH']},
    'tests-athletiques':{read:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE','COACH','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE']},
    'tests-techniques':{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','OBSERVATEUR_STAFF','LECTURE'], write:['ADMIN','RESPONSABLE_CATEGORIE','COACH']}
  };

  function asText(value){ return String(value ?? '').trim(); }
  function normalizeRole(role){
    const raw = asText(role || 'OBSERVATEUR_STAFF').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return ROLES[raw] ? raw : (ROLE_ALIASES[raw] || raw || 'OBSERVATEUR_STAFF');
  }
  function roleLabel(role){ return ROLE_LABELS[normalizeRole(role)] || asText(role) || 'Staff'; }

  function getRole(profile={}, fallback='OBSERVATEUR_STAFF'){
    return normalizeRole(profile?.role || profile?.userRole || fallback);
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

  function roleAllowed(role, allowedRoles=[]){
    const current = normalizeRole(role);
    return (allowedRoles || []).map(normalizeRole).includes(current);
  }

  function modulePermission(moduleOrId, action='read'){
    const id = typeof moduleOrId === 'string' ? moduleOrId : moduleOrId?.id;
    const fromRegistry = typeof moduleOrId === 'object' ? moduleOrId?.permissions || {} : {};
    const fromMatrix = MODULE_PERMISSIONS[id] || {};
    return fromMatrix[action] || fromRegistry[action] || fromMatrix.read || fromRegistry.read || [];
  }

  function canUseModule(profileOrModule, maybeModuleOrRole, action='read'){
    const legacyCall = profileOrModule && profileOrModule.id && typeof maybeModuleOrRole === 'string';
    const profile = legacyCall ? {role:maybeModuleOrRole, status:'ACTIVE'} : profileOrModule;
    const module = legacyCall ? profileOrModule : maybeModuleOrRole;
    if(!module || module.active === false || !isActive(profile)) return false;
    const role = getRole(profile);
    if(role === 'ADMIN') return true;
    const overrides = moduleOverrides(profile)[module.id] || {};
    if(overrides[action] === true || (action === 'read' && overrides.read === true)) return true;
    if(overrides[action] === false || (action === 'read' && overrides.read === false)) return false;
    if(action !== 'read' && READ_ONLY_ROLES.includes(role)) return false;
    return roleAllowed(role, modulePermission(module, action));
  }

  function canViewModule(profile, module){ return canUseModule(profile, module, 'read'); }
  function canEditModule(profile, module){ return canUseModule(profile, module, 'write'); }
  function canDeleteData(profile){ return getRole(profile) === 'ADMIN' && isActive(profile); }
  function canManageUsers(profile){ return getRole(profile) === 'ADMIN' && isActive(profile); }
  function canManageCoreData(profile){ return CORE_DATA_ROLES.includes(getRole(profile)) && isActive(profile); }

  function canAccessTeam(profile={}, teamId=''){
    if(!isActive(profile)) return false;
    const role = getRole(profile);
    if(role === 'ADMIN') return true;
    const allowed = teamIds(profile);
    if(!allowed.length) return role !== 'JOUEUSE_PARENT';
    const target = asText(teamId).toLowerCase();
    return Boolean(target) && allowed.includes(target);
  }

  function canAccessPlayer(profile={}, player={}){
    if(!isActive(profile)) return false;
    const role = getRole(profile);
    if(role === 'ADMIN') return true;
    const ownPlayerIds = list(profile?.playerIds || profile?.allowedPlayerIds).map(v => v.toLowerCase());
    const playerId = asText(player?.playerId || player?.id || player).toLowerCase();
    if(role === 'JOUEUSE_PARENT') return Boolean(playerId) && ownPlayerIds.includes(playerId);
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

  function defaultProfile(user={}, role='COACH'){
    return {
      uid:user.uid || '',
      email:user.email || '',
      name:user.displayName || user.email || '',
      role:normalizeRole(role),
      roleLabel:roleLabel(role),
      status:'ACTIVE',
      teamIds:[],
      allowedTeamIds:[],
      allowedModules:[],
      modulePermissions:{},
      userType:normalizeRole(role) === 'JOUEUSE_PARENT' ? 'external' : 'staff'
    };
  }

  const service = {
    ROLES, ROLE_ALIASES, ROLE_LABELS, ADMIN_ROLES, CORE_DATA_ROLES, READ_ONLY_ROLES,
    ALL_STAFF_ROLES, MODULE_PERMISSIONS,
    normalizeRole, roleLabel, getRole, isActive,
    roleAllowed, canUseModule, canViewModule, canEditModule, canDeleteData,
    canManageUsers, canManageCoreData, canAccessTeam, canAccessPlayer,
    visibleModules, teamIds, moduleOverrides, defaultProfile
  };

  global.CoachPulsePermissionsService = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
