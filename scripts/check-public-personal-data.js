const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const LARGE_INLINE_IMAGE_BYTES = 4096;

function htmlFiles(entry) {
  if(!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if(stat.isFile()) return entry.toLowerCase().endsWith('.html') ? [entry] : [];
  return fs.readdirSync(entry, {withFileTypes:true}).flatMap(item => {
    if(item.name.startsWith('.')) return [];
    return htmlFiles(path.join(entry, item.name));
  });
}

function findingsForHtml(source) {
  const findings = [];
  const inlineImages = source.matchAll(/data:image\/[^;]+;base64,([a-z0-9+/=]+)/gi);
  for(const match of inlineImages) {
    if(match[1].length >= LARGE_INLINE_IMAGE_BYTES) {
      findings.push('large-inline-image');
      break;
    }
  }

  const embeddedDatasetRules = [
    ['embedded-tests-player-roster', /const\s+DATA\s*=\s*\{[\s\S]{0,500}?["']?players["']?\s*:\s*\[\s*\{/],
    ['embedded-coach-player-roster', /const\s+PLAYER_DB\s*=\s*\[\s*\{/],
    ['embedded-real-player-records', /["']?(?:players|roster|joueuses)["']?\s*[:=]\s*\[[\s\S]{0,1000}?["']?(?:dateNaissance|birth|photo)["']?\s*:/i]
  ];
  embeddedDatasetRules.forEach(([name, rule]) => {
    if(rule.test(source)) findings.push(name);
  });
  return findings;
}

function scanEntries(entries) {
  const failures = [];
  [...new Set(entries.flatMap(entry => htmlFiles(path.resolve(root, entry))))].forEach(file => {
    const findings = findingsForHtml(fs.readFileSync(file, 'utf8'));
    if(findings.length) failures.push({file:path.relative(root, file), findings});
  });
  return failures;
}

function assertPublicHtmlSafe(entries) {
  const failures = scanEntries(entries);
  if(!failures.length) return;
  failures.forEach(({file, findings}) => {
    console.error(`Public HTML privacy check failed: ${file} (${findings.join(', ')})`);
  });
  throw new Error(`Public HTML privacy check blocked ${failures.length} file(s).`);
}

if(require.main === module) {
  const entries = process.argv.slice(2);
  assertPublicHtmlSafe(entries.length ? entries : ['public']);
  console.log('Public HTML privacy check passed.');
}

module.exports = {LARGE_INLINE_IMAGE_BYTES, findingsForHtml, scanEntries, assertPublicHtmlSafe};
