// CoachPulse shared permissions service.
// Phase 1: standalone helper. Existing app.js functions can fallback safely.

(function(global){
  const ADMIN_ROLES = ['ADMIN', 'RESPONSABLE'];

  function normalizeRole(role){
    return String(role || 'STAFF').trim().toUpperCase();
  }

  function getRole(profile={}, fallback='STAFF'){
    return normalizeRole(profile.role || fallback);
  }

  function isAdminRole(role){
    return ADMIN_ROLES.includes(normalizeRole(role));
  }

  function isSuperAdminRole(role){
    return normalizeRole(role) === 'ADMIN';
  }

  function roleAllowed(role, allowedRoles=[]){
    const current = normalizeRole(role);
    return (allowedRoles || []).map(normalizeRole).includes(current);
  }

  function canUseModule(module, role, action='read'){
    if(!module || module.active === false) return false;
    const permissions = module.permissions || {};
    const allowed = permissions[action] || permissions.read || [];
    return roleAllowed(role, allowed);
  }

  function visibleModules(modules=[], role, section){
    return modules.filter(module =>
      module
      && module.active !== false
      && module.settings?.showInNav !== false
      && (!section || module.section === section)
      && canUseModule(module, role, 'read')
    );
  }

  const service = {
    ADMIN_ROLES,
    normalizeRole,
    getRole,
    isAdminRole,
    isSuperAdminRole,
    roleAllowed,
    canUseModule,
    visibleModules
  };

  global.CoachPulsePermissionsService = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
