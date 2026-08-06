(function (global) {
  const SYSTEMS = {
    8: ['3-2-2', '3-3-1', '2-4-1', '2-3-2'],
    11: ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'],
  };

  const POSITIONS = {
    '3-2-2': [['GB', 50, 88], ['DCG', 28, 68], ['DC', 50, 66], ['DCD', 72, 68], ['MG', 36, 47], ['MD', 64, 47], ['AG', 40, 24], ['AD', 60, 24]],
    '3-3-1': [['GB', 50, 88], ['DCG', 28, 68], ['DC', 50, 66], ['DCD', 72, 68], ['MG', 30, 47], ['MC', 50, 45], ['MD', 70, 47], ['BU', 50, 22]],
    '2-4-1': [['GB', 50, 88], ['DCG', 36, 68], ['DCD', 64, 68], ['MG', 24, 48], ['MCG', 42, 45], ['MCD', 58, 45], ['MD', 76, 48], ['BU', 50, 22]],
    '2-3-2': [['GB', 50, 88], ['DCG', 36, 68], ['DCD', 64, 68], ['MG', 32, 48], ['MC', 50, 45], ['MD', 68, 48], ['AG', 40, 22], ['AD', 60, 22]],
    '4-3-3': [['GB', 50, 91], ['DG', 20, 73], ['DCG', 39, 76], ['DCD', 61, 76], ['DD', 80, 73], ['MCG', 35, 55], ['MDC', 50, 58], ['MCD', 65, 55], ['AIG', 25, 25], ['BU', 50, 20], ['AID', 75, 25]],
    '4-4-2': [['GB', 50, 91], ['DG', 20, 73], ['DCG', 39, 76], ['DCD', 61, 76], ['DD', 80, 73], ['MG', 25, 50], ['MCG', 42, 52], ['MCD', 58, 52], ['MD', 75, 50], ['AG', 42, 22], ['AD', 58, 22]],
    '3-5-2': [['GB', 50, 91], ['DCG', 32, 76], ['DC', 50, 78], ['DCD', 68, 76], ['MG', 18, 52], ['MCG', 38, 55], ['MDC', 50, 58], ['MCD', 62, 55], ['MD', 82, 52], ['AG', 42, 22], ['AD', 58, 22]],
    '4-2-3-1': [['GB', 50, 91], ['DG', 20, 73], ['DCG', 39, 76], ['DCD', 61, 76], ['DD', 80, 73], ['MDCG', 42, 58], ['MDCD', 58, 58], ['MOG', 30, 39], ['MOC', 50, 36], ['MOD', 70, 39], ['BU', 50, 19]],
  };

  const STATS = ['but', 'passe', 'tirCadre', 'tirNonCadre', 'centre', 'progression', 'entree20', 'recup'];

  const OFFICIAL_ASSE_TEAMS = [
    { teamId: 'team-u7-a', name: 'U7 A', category: 'U7', subCategories: ['U6', 'U7'] },
    { teamId: 'team-u9-a', name: 'U9 A', category: 'U9', subCategories: ['U8', 'U9'] },
    { teamId: 'team-u11-a', name: 'U11 A', category: 'U11', subCategories: ['U10', 'U11'] },
    { teamId: 'team-u13-a', name: 'U13 A', category: 'U13', subCategories: ['U12', 'U13', 'U14'] },
    { teamId: 'team-u13-b', name: 'U13 B', category: 'U13', subCategories: ['U12', 'U13'] },
    { teamId: 'team-u16-a', name: 'U16 A', category: 'U16', subCategories: ['U15', 'U16'] },
    { teamId: 'team-u19', name: 'U19', category: 'U19', subCategories: ['U17', 'U18', 'U19'] },
    { teamId: 'team-r1', name: 'R1', category: 'SENIORS', subCategories: ['SENIORS'] },
  ];

  global.CoachPulseCoachStatsConfig = {
    SYSTEMS,
    POSITIONS,
    STATS,
    OFFICIAL_ASSE_TEAMS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.CoachPulseCoachStatsConfig;
  }
})(typeof window !== 'undefined' ? window : globalThis);
