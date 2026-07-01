import { createTestAnalyzer } from './testsConnectorCore.js';

export const analyzeRows = createTestAnalyzer({
  mode:'physical',
  connector:'testsPhysiques',
  itemType:'physicalTest'
});

export default {analyzeRows};
