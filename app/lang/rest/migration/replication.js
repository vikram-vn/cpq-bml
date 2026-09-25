'use strict';

const fs = require('fs');
const pathLib = require('path');
const { mkdirp, writeReadme } = require('@/lang/rest/migration/constants');

/**
 * Recursively replicates the directory structure and READMEs from sourceDir to targetDir.
 * Skips 'backup', 'modify', 'modified', and 'migration-packages'.
 */
function replicateStructure(sourceDir, targetDir, scopeTitle, scopeDesc, rootDir) {
  mkdirp(targetDir);
  const baseRoot = rootDir || sourceDir;
  let items;
  try {
    items = fs.readdirSync(sourceDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const item of items) {
    if (!item.isDirectory()) continue;
    if (item.name === 'backup' || item.name === 'modify' || item.name === 'modified' || item.name === 'migration-packages') continue;
    const subSource = pathLib.join(sourceDir, item.name);
    const subTarget = pathLib.join(targetDir, item.name);
    mkdirp(subTarget);
    const sourceReadme = pathLib.join(subSource, 'README.md');
    if (fs.existsSync(sourceReadme)) {
      let title = item.name;
      try {
        const firstLine = fs.readFileSync(sourceReadme, 'utf8').split('\n')[0];
        if (firstLine.startsWith('# ')) {
          title = firstLine.replace(/^#\s*/, '').trim();
        }
      } catch {}
      const relPath = pathLib.relative(baseRoot, subSource).replace(/\\/g, '/');
      const targetRel = `${scopeTitle.toLowerCase()}/${relPath}`;
      const readmeContent = [
        `# ${title} (${scopeTitle})`,
        '',
        `**Scope:** \`${targetRel}\`  `,
        '',
        `> ${scopeDesc}`,
        '',
      ].join('\n');
      writeReadme(subTarget, readmeContent);
    }
    replicateStructure(subSource, subTarget, scopeTitle, scopeDesc, baseRoot);
  }
}

module.exports = {
  replicateStructure,
};
