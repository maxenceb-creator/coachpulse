const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public');

const entries = [
  'index.html',
  'app.js',
  'sw.js',
  'manifest.json',
  'release.json',
  'dev-release.json',
  'assets',
  'css',
  'icons',
  'pages',
  'connectors',
  'modules',
  'shared/services',
  'data'
];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
}

function shouldCopy(name) {
  if(name.startsWith('.')) return false;
  if(name === 'README.md') return false;
  return true;
}

function copyRecursive(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(outDir, relativePath);
  const stat = fs.statSync(source);

  if(stat.isDirectory()) {
    ensureDir(target);
    fs.readdirSync(source)
      .filter(shouldCopy)
      .forEach(child => copyRecursive(path.join(relativePath, child)));
    return;
  }

  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

fs.rmSync(outDir, {recursive: true, force: true});
ensureDir(outDir);

entries.filter(exists).forEach(copyRecursive);

console.log(`CoachPulse public build ready: ${path.relative(root, outDir)}`);
