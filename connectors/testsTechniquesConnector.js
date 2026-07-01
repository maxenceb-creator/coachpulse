import { createTestAnalyzer } from './testsConnectorCore.js';

export const analyzeRows = createTestAnalyzer({
  mode:'technical',
  connector:'testsTechniques',
  itemType:'technicalTest'
});

export default {analyzeRows};
