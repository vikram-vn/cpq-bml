const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walk(dir) {
  let results = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build' || entry === '.vscode-test') {
      continue;
    }
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
      results.push(full);
    }
  }
  return results;
}

const allJsFiles = walk(ROOT);

console.log('=== CHECK 1: Files with > 500 lines ===');
const longFiles = [];
for (const file of allJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').length;
  if (lines > 500) {
    longFiles.push({ file: path.relative(ROOT, file), lines });
  }
}
longFiles.sort((a, b) => b.lines - a.lines);
console.log(`Found ${longFiles.length} files > 500 lines:`);
longFiles.forEach(f => console.log(`  ${f.lines} lines: ${f.file}`));

console.log('\n=== CHECK 2: Files with relative requires in app/ ===');
const appJsFiles = walk(path.join(ROOT, 'app'));
const relativeRequires = [];
for (const file of appJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const matches = [...line.matchAll(/require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)];
    for (const m of matches) {
      relativeRequires.push({
        file: path.relative(ROOT, file),
        line: idx + 1,
        req: m[1]
      });
    }
  });
}
console.log(`Found ${relativeRequires.length} relative requires in app/:`);
const filesWithRelReqs = new Set(relativeRequires.map(r => r.file));
console.log(`Across ${filesWithRelReqs.size} files.`);
Array.from(filesWithRelReqs).forEach(f => {
  const reqs = relativeRequires.filter(r => r.file === f);
  console.log(`  ${f}:`);
  reqs.forEach(r => console.log(`    line ${r.line}: ${r.req}`));
});

