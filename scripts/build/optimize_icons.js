const fs = require('fs');
const path = require('path');
const { RULE_MATCHERS, CPQ_BML_DOMAIN_CONCEPTS } = require('../../app/lang/icons/folderRules');
const { expandVariations, matchFolderIcon } = require('../../app/lang/icons/dynamicFolderIcons');

const ROOT = path.join(__dirname, '..', '..');
const MATERIAL_DIR = path.join(ROOT, 'app', 'icons', 'material');
const THEME_PATH = path.join(ROOT, 'themes', 'bml-icons.json');
const MIN_THEME_PATH = path.join(ROOT, 'themes', 'bml-icons.min.json');

// 1. Collect all folder icon names needed by rules and common CPQ/web development
const KEEP_FOLDER_ICONS = new Set([
  'folder', 'folder-open', 'folder-root', 'folder-root-open'
]);

for (const r of RULE_MATCHERS) {
  KEEP_FOLDER_ICONS.add(r.icon);
  KEEP_FOLDER_ICONS.add(r.icon + '-open');
}

const COMMON_DEV_FOLDERS = [
  'folder-oracle', 'folder-plugin', 'folder-shared', 'folder-public', 'folder-sass', 'folder-css',
  'folder-html', 'folder-svg', 'folder-swagger', 'folder-project', 'folder-policy', 'folder-postgres',
  'folder-mysql', 'folder-mariadb', 'folder-mongodb', 'folder-docker', 'folder-github', 'folder-gitlab',
  'folder-npm', 'folder-yarn', 'folder-ci', 'folder-build', 'folder-env', 'folder-package',
  'folder-server', 'folder-client', 'folder-node', 'folder-graphql', 'folder-rest', 'folder-auth',
  'folder-views', 'folder-models', 'folder-controllers', 'folder-services', 'folder-resources', 'folder-assets',
  'folder-core', 'folder-base', 'folder-common', 'folder-global', 'folder-custom'
];
for (const f of COMMON_DEV_FOLDERS) {
  KEEP_FOLDER_ICONS.add(f);
  KEEP_FOLDER_ICONS.add(f + '-open');
}

// 2. Core file icons needed for CPQ BML and web/scripts development
const KEEP_FILE_BASE = new Set([
  'bml', 'xml', 'xsl', 'xslt', 'html', 'css', 'sass', 'less', 'svg',
  'json', 'yaml', 'toml', 'ini', 'table', 'csv', 'database', 'sql',
  'javascript', 'typescript', 'nodejs', 'js', 'ts', 'jsconfig', 'tsconfig',
  'python',
  'shell', 'powershell', 'console', 'command', 'bat',
  'git', 'github', 'diff',
  'markdown', 'document', 'readme', 'license', 'settings', 'tune', 'url', 'log', 'pdf', 'text',
  'docker', 'npm', 'yarn', 'vscode', 'test-js', 'test-jsx', 'test-ts', 'test-tsx', 'eslint', 'prettier',
  'image', 'font', 'video', 'audio', 'zip', 'file',
  'certificate', 'key', 'lock', 'http', 'openapi', 'swagger'
]);

function shouldKeep(filename) {
  if (filename.endsWith('.clone.svg')) return false;
  const name = filename.replace(/\.svg$/, '');
  const base = name.replace(/_light$/, '');

  if (filename.startsWith('folder')) {
    return KEEP_FOLDER_ICONS.has(name) || KEEP_FOLDER_ICONS.has(base);
  }
  return KEEP_FILE_BASE.has(base) || KEEP_FILE_BASE.has(name);
}

function optimizeIcons() {
  const allFiles = fs.readdirSync(MATERIAL_DIR);
  let kept = 0;
  let deleted = 0;

  for (const f of allFiles) {
    if (shouldKeep(f)) {
      kept++;
    } else {
      fs.unlinkSync(path.join(MATERIAL_DIR, f));
      deleted++;
    }
  }
  console.log(`Optimized SVG icons: kept ${kept}, pruned ${deleted}`);

  // Update themes/bml-icons.json
  const theme = JSON.parse(fs.readFileSync(THEME_PATH, 'utf8'));
  const keptIconDefs = new Set();

  for (const [key, val] of Object.entries(theme.iconDefinitions)) {
    const iconName = path.basename(val.iconPath || '');
    if (shouldKeep(iconName)) {
      keptIconDefs.add(key);
    }
  }

  // Generate clean folder names
  const cleanFolderNames = {};
  const cleanFolderNamesExp = {};

  for (const concept of CPQ_BML_DOMAIN_CONCEPTS) {
    const variations = expandVariations(concept);
    for (const prefix of ['bml', 'cpq']) {
      variations.push(...expandVariations(prefix + '-' + concept));
      variations.push(...expandVariations(concept + '-' + prefix));
    }
    for (const v of variations) {
      const icon = matchFolderIcon(v);
      if (icon && keptIconDefs.has(icon)) {
        cleanFolderNames[v] = icon;
        cleanFolderNamesExp[v] = icon + '-open';
      }
    }
  }

  const newTheme = {
    iconDefinitions: {},
    folderNames: cleanFolderNames,
    folderNamesExpanded: cleanFolderNamesExp,
    rootFolderNames: theme.rootFolderNames || {},
    rootFolderNamesExpanded: theme.rootFolderNamesExpanded || {},
    fileExtensions: {},
    fileNames: {},
    languageIds: {},
    light: theme.light || {},
    highContrast: theme.highContrast || {},
    file: theme.file || 'file',
    hidesExplorerArrows: theme.hidesExplorerArrows || false,
    folder: theme.folder || 'folder',
    folderExpanded: theme.folderExpanded || 'folder-open',
    rootFolder: theme.rootFolder || 'folder-root',
    rootFolderExpanded: theme.rootFolderExpanded || 'folder-root-open'
  };

  for (const [k, v] of Object.entries(theme.iconDefinitions)) {
    if (keptIconDefs.has(k)) newTheme.iconDefinitions[k] = v;
  }
  for (const [k, v] of Object.entries(theme.fileExtensions || {})) {
    if (keptIconDefs.has(v)) newTheme.fileExtensions[k] = v;
  }
  for (const [k, v] of Object.entries(theme.fileNames || {})) {
    if (keptIconDefs.has(v)) newTheme.fileNames[k] = v;
  }
  for (const [k, v] of Object.entries(theme.languageIds || {})) {
    if (keptIconDefs.has(v)) newTheme.languageIds[k] = v;
  }

  fs.writeFileSync(THEME_PATH, JSON.stringify(newTheme, null, 2) + '\n', 'utf8');
  fs.writeFileSync(MIN_THEME_PATH, JSON.stringify(newTheme) + '\n', 'utf8');
  console.log(`Cleaned bml-icons.json: ${Object.keys(newTheme.iconDefinitions).length} icons, ${Object.keys(newTheme.folderNames).length} folder mappings.`);
}

optimizeIcons();
