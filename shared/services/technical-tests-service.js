(function (global) {
  const TEST_KEYS = ['max_pfp','max_pfm','max_alt','max_tete','reg_pfp','reg_pfm','reg_alt','reg_tete','mouv_pfp','mouv_pfm','mouv_alt'];
  const LEGACY_METRIC_KEYS = {
    'MAX PF+':'max_pfp', 'MAX PF-':'max_pfm', 'MAX ALT':'max_alt', 'MAX TETE':'max_tete',
    'REG PF+':'reg_pfp', 'REG PF-':'reg_pfm', 'REG ALT':'reg_alt', 'REG TETE':'reg_tete',
    'MOUV PF+':'mouv_pfp', 'MOUV PF-':'mouv_pfm', 'MOUV ALTER':'mouv_alt'
  };
  function number(value) {
    if (value === '' || value == null) return '';
    const parsed = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : '';
  }
  function legacyMetricKey(value = '') {
    const label = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
    return LEGACY_METRIC_KEYS[label] || '';
  }
  function testsFromRow(row = {}) {
    const tests = {};
    const source = row.tests && typeof row.tests === 'object' ? row.tests : {};
    TEST_KEYS.forEach((key) => {
      const value = number(source[key] ?? row[key]);
      if (value !== '') tests[key] = value;
    });
    const metricKey = legacyMetricKey(row.testName || row.testType || row.metric || row.type);
    if (metricKey) {
      const value = number(row.value ?? row.valeur ?? row.result ?? row.resultat ?? row.score);
      if (value !== '') tests[metricKey] = value;
    }
    return tests;
  }
  const api = {TEST_KEYS, legacyMetricKey, testsFromRow};
  global.CoachPulseTechnicalTestsService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
