(function (global) {
  const TESTS = [
    ['max_pfp', 'MAX PF+', 'max'],
    ['max_pfm', 'MAX PF-', 'max'],
    ['max_alt', 'MAX ALT', 'max'],
    ['max_tete', 'MAX Tête', 'max'],
    ['reg_pfp', 'REG PF+', 'reg'],
    ['reg_pfm', 'REG PF-', 'reg'],
    ['reg_alt', 'REG ALT', 'reg'],
    ['reg_tete', 'REG Tête', 'reg'],
    ['mouv_pfp', 'Libre', 'mouv'],
    ['mouv_pfm', 'MOUV PF-', 'mouv'],
    ['mouv_alt', 'MOUV ALTER', 'mouv'],
  ];

  const GROUPS = {
    max: TESTS.filter((test) => test[2] === 'max'),
    reg: TESTS.filter((test) => test[2] === 'reg'),
    mouv: TESTS.filter((test) => test[2] === 'mouv'),
  };

  const FAMILY_LABEL = {
    max: 'Maximum',
    reg: 'Régularité',
    mouv: 'Mouvement',
  };

  global.CoachPulseTechnicalConfig = {
    TESTS,
    GROUPS,
    FAMILY_LABEL,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.CoachPulseTechnicalConfig;
  }
})(typeof window !== 'undefined' ? window : globalThis);
