'use strict';

require('./register-alias');
const fs = require('fs');
const path = require('path');
const config = require('@/lang/rest/config');
const { buildCommerceProcessDepth } = require('@/lang/rest/migrationStructure');

const ROOT = path.join(__dirname, '..');

// ─── Load .env from workspace root if present ────────────────────────────────
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const baseUrl = config.getBaseUrl();
const siteName = config.getCpqSiteName(baseUrl);

if (!siteName) {
  console.error('Error: CPQ site URL is not configured. Set cpqBml.connection.siteUrl in VS Code Settings or CPQ_SITE_URL in .env / environment variables.');
  process.exit(1);
}

const COMMERCE_DIR = path.join(ROOT, 'cpq', siteName, 'commerce');

const sectionTypeMap = {
  'action':                    'actions',
  'actions':                   'actions',
  'action(s)':                 'actions',
  'asset management':          'asset-management',
  'data column':               'data-columns',
  'data columns':              'data-columns',
  'data column(s)':            'data-columns',
  'document':                  'documents',
  'documents':                 'documents',
  'document(s)':               'documents',
  'formula':                   'formulas',
  'formulas':                  'formulas',
  'formula(s)':                'formulas',
  'integration':               'integrations',
  'integrations':              'integrations',
  'integration(s)':            'integrations',
  'process manager column':    'process-manager-columns',
  'process manager columns':   'process-manager-columns',
  'process manager column(s)': 'process-manager-columns',
  'step':                      'steps',
  'steps':                     'steps',
  'step(s)':                   'steps',
  'template':                  'templates',
  'templates':                 'templates',
  'template(s)':               'templates',
  'xsl view':                  'xsl-views',
  'xsl views':                 'xsl-views',
  'xsl view(s)':               'xsl-views',
};

const sectionLabelMap = {
  'actions':                 'Action(s)',
  'asset-management':        'Asset Management',
  'data-columns':            'Data Column(s)',
  'documents':               'Document(s)',
  'formulas':                'Formula(s)',
  'integrations':            'Integration(s)',
  'process-manager-columns': 'Process Manager Column(s)',
  'steps':                   'Step(s)',
  'templates':               'Templates',
  'xsl-views':               'XSL View(s)',
};

function parseProcessReadme(readmePath) {
  const content = fs.readFileSync(readmePath, 'utf8');
  const lines = content.split('\n');

  let name = '';
  let variableName = '';
  let lastModified = '';
  let modifiedByUser = '';
  const children = [];

  let currentType = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ') && !name) {
      name = trimmed.slice(2).trim();
    } else if (trimmed.startsWith('**Variable Name:**')) {
      const m = trimmed.match(/`([^`]+)`/);
      if (m) variableName = m[1];
    } else if (trimmed.startsWith('**Last Modified:**')) {
      lastModified = trimmed.replace('**Last Modified:**', '').trim();
    } else if (trimmed.startsWith('**Modified By:**')) {
      modifiedByUser = trimmed.replace('**Modified By:**', '').trim();
    } else if (trimmed.startsWith('### ')) {
      const secHeader = trimmed.replace(/^###\s+/, '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
      currentType = sectionTypeMap[secHeader] || null;
    } else if (trimmed.startsWith('- **') && currentType) {
      const nameMatch = trimmed.match(/^- \*\*([^*]+)\*\*/);
      if (nameMatch) {
        const itemName = nameMatch[1].trim();
        const varMatch = trimmed.match(/\(`([^`]+)`\)/);
        const itemVar = varMatch ? varMatch[1] : itemName;
        const dateMatch = trimmed.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
        const itemDate = dateMatch ? dateMatch[1] : '';
        children.push({
          name: itemName,
          variableName: itemVar,
          resourceType: currentType,
          resourceTypeLabel: sectionLabelMap[currentType] || currentType,
          lastModified: itemDate,
        });
      }
    }
  }

  return {
    name,
    variableName,
    lastModified,
    modifiedByUser,
    children,
  };
}

function cleanLegacyFolders(procDir) {
  const legacy = ['attributes', 'rules', 'other'];
  for (const leg of legacy) {
    const p = path.join(procDir, leg);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  }

  // Remove any nested before-formulas / after-formulas under actions
  const actionsDir = path.join(procDir, 'actions');
  if (fs.existsSync(actionsDir)) {
    const before = path.join(actionsDir, 'before-formulas');
    const after = path.join(actionsDir, 'after-formulas');
    if (fs.existsSync(before)) fs.rmSync(before, { recursive: true, force: true });
    if (fs.existsSync(after)) fs.rmSync(after, { recursive: true, force: true });
  }

  // Remove any nested default / modify under data-columns
  const dataColDir = path.join(procDir, 'data-columns');
  if (fs.existsSync(dataColDir)) {
    const def = path.join(dataColDir, 'default');
    const mod = path.join(dataColDir, 'modify');
    if (fs.existsSync(def)) fs.rmSync(def, { recursive: true, force: true });
    if (fs.existsSync(mod)) fs.rmSync(mod, { recursive: true, force: true });
  }
}

function run() {
  const processes = fs.readdirSync(COMMERCE_DIR).filter(f => {
    return fs.statSync(path.join(COMMERCE_DIR, f)).isDirectory();
  });

  console.log(`Processing ${processes.length} commerce processes...`);

  for (const procName of processes) {
    const procDir = path.join(COMMERCE_DIR, procName);
    const readmePath = path.join(procDir, 'README.md');
    if (!fs.existsSync(readmePath)) continue;

    const processItem = parseProcessReadme(readmePath);
    if (!processItem.variableName) processItem.variableName = procName;
    if (!processItem.name) processItem.name = procName;

    cleanLegacyFolders(procDir);
    buildCommerceProcessDepth(procDir, processItem);
  }

  console.log('✓ Successfully refreshed all commerce processes to exact plural migration structure!');
}

run();
