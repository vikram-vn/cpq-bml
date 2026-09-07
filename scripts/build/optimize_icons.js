const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RULE_MATCHERS, CPQ_BML_DOMAIN_CONCEPTS } = require('../../app/lang/icons/folderRules');
const { expandVariations, matchFolderIcon } = require('../../app/lang/icons/dynamicFolderIcons');

const ROOT = path.join(__dirname, '..', '..');
const MATERIAL_DIR = path.join(ROOT, 'app', 'icons', 'material');
const THEME_PATH = path.join(ROOT, 'themes', 'bml-icons.json');
const MIN_THEME_PATH = path.join(ROOT, 'themes', 'bml-icons.min.json');

// 1. Precise set of folder categories to keep (covers all CPQ rules + all common dev & workspace folders)
const KEEP_FOLDER_CATS = new Set([
  // Workspace root folders
  'app', 'node', 'vscode', 'test', 'docs', 'log', 'temp', 'dist', 'scripts', 'theme', 'git', 'github', 'skills', 'gemini-ai', 'sandbox',
  // Common dev folders
  'src', 'lib', 'config', 'server', 'client', 'build', 'env', 'package',
  'models', 'views', 'controllers', 'services', 'resources', 'assets',
  'sass', 'css', 'html', 'svg', 'docker', 'gitlab', 'shared', 'public', 'core'
]);

// Add all categories from RULE_MATCHERS
for (const r of RULE_MATCHERS) {
  KEEP_FOLDER_CATS.add(r.icon.replace(/^folder-/, ''));
}

const KEEP_FOLDER_ICONS = new Set([
  'folder', 'folder-open', 'folder-root', 'folder-root-open'
]);
for (const cat of KEEP_FOLDER_CATS) {
  KEEP_FOLDER_ICONS.add('folder-' + cat);
  KEEP_FOLDER_ICONS.add('folder-' + cat + '-open');
}

// 2. Core file icons needed for CPQ BML and web/scripts development
const KEEP_FILE_BASE = new Set([
  'bml', 'xml', 'xsl', 'xslt', 'html', 'css', 'sass', 'less', 'svg',
  'json', 'yaml', 'toml', 'ini', 'table', 'csv', 'database', 'sql',
  'javascript', 'typescript', 'nodejs', 'js', 'ts', 'jsconfig', 'tsconfig',
  'python', 'shell', 'powershell', 'console', 'command', 'bat',
  'git', 'github', 'diff',
  'markdown', 'document', 'readme', 'license', 'settings', 'tune', 'url', 'log', 'pdf', 'text',
  'docker', 'npm', 'yarn', 'vscode', 'test-js', 'test-jsx', 'test-ts', 'test-tsx', 'eslint', 'prettier',
  'image', 'font', 'video', 'audio', 'zip', 'file',
  'certificate', 'key', 'lock', 'http', 'openapi', 'swagger'
]);

function shouldKeep(filename) {
  if (filename.endsWith('.clone.svg')) return false;
  const id = filename.replace(/\.svg$/, '');
  const base = id.replace(/_light$/, '');

  if (filename.startsWith('folder')) {
    return KEEP_FOLDER_ICONS.has(id);
  }
  return KEEP_FILE_BASE.has(id) || KEEP_FILE_BASE.has(base);
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
  console.log(`SVG icons in material directory: kept ${kept}, pruned ${deleted}`);

  // Base theme from dcecf53
  let baseTheme;
  try {
    const raw = execSync('git show dcecf53:themes/bml-icons.json', { cwd: ROOT, maxBuffer: 30 * 1024 * 1024 }).toString('utf8');
    baseTheme = JSON.parse(raw);
  } catch (e) {
    baseTheme = JSON.parse(fs.readFileSync(THEME_PATH, 'utf8'));
  }

  const currentFiles = fs.readdirSync(MATERIAL_DIR);
  const availableIcons = new Set(currentFiles.map(f => f.replace(/\.svg$/, '')));

  // 1. Build iconDefinitions
  const iconDefinitions = {};
  for (const iconId of availableIcons) {
    iconDefinitions[iconId] = {
      iconPath: './../app/icons/material/' + iconId + '.svg'
    };
  }

  // 2. Base folder mappings (filtered by kept icons)
  const folderNames = {};
  const folderNamesExpanded = {};
  for (const [k, v] of Object.entries(baseTheme.folderNames || {})) {
    if (availableIcons.has(v) && availableIcons.has(v + '-open')) {
      folderNames[k] = v;
      folderNamesExpanded[k] = v + '-open';
    }
  }

  // 3. Workspace explicit overrides
  const customFolders = {
    'knowledge': 'folder-docs',
    '.knowledge': 'folder-docs',
    'scratch': 'folder-temp',
    '.scratch': 'folder-temp',
    '.agents': 'folder-skills',
    '.vscode': 'folder-vscode',
    '.vscode-test': 'folder-vscode',
    'app': 'folder-app',
    'test': 'folder-test',
    'tests': 'folder-test',
    'logs': 'folder-log',
    'node_modules': 'folder-node',
    'dist': 'folder-dist',
    'scripts': 'folder-scripts',
    'themes': 'folder-theme',
    '.github': 'folder-github',
    'modified': 'folder-update',
    'catalog-definition': 'folder-cluster',
    'all-product-families': 'folder-cluster',
    'bom-rules': 'folder-rules',
    'stylesheet': 'folder-css'
  };
  for (const [k, v] of Object.entries(customFolders)) {
    if (availableIcons.has(v) && availableIcons.has(v + '-open')) {
      folderNames[k] = v;
      folderNamesExpanded[k] = v + '-open';
    }
  }

  // 4. Dynamic CPQ/BML domain concepts
  for (const concept of CPQ_BML_DOMAIN_CONCEPTS) {
    const variations = expandVariations(concept);
    for (const prefix of ['bml', 'cpq']) {
      variations.push(...expandVariations(prefix + '-' + concept));
      variations.push(...expandVariations(concept + '-' + prefix));
    }
    for (const v of variations) {
      const icon = matchFolderIcon(v);
      if (icon && availableIcons.has(icon) && availableIcons.has(icon + '-open')) {
        folderNames[v] = icon;
        folderNamesExpanded[v] = icon + '-open';
      }
    }
  }

  // 5. File extensions and names
  const fileExtensions = {};
  for (const [k, v] of Object.entries(baseTheme.fileExtensions || {})) {
    if (availableIcons.has(v)) fileExtensions[k] = v;
  }
  const fileNames = {};
  for (const [k, v] of Object.entries(baseTheme.fileNames || {})) {
    if (availableIcons.has(v)) fileNames[k] = v;
  }
  const languageIds = {};
  for (const [k, v] of Object.entries(baseTheme.languageIds || {})) {
    if (availableIcons.has(v)) languageIds[k] = v;
  }

  const newTheme = {
    iconDefinitions,
    folderNames,
    folderNamesExpanded,
    rootFolderNames: baseTheme.rootFolderNames || {},
    rootFolderNamesExpanded: baseTheme.rootFolderNamesExpanded || {},
    fileExtensions,
    fileNames,
    languageIds,
    light: baseTheme.light || {},
    highContrast: baseTheme.highContrast || {},
    file: 'file',
    hidesExplorerArrows: false,
    folder: 'folder',
    folderExpanded: 'folder-open',
    rootFolder: 'folder-root',
    rootFolderExpanded: 'folder-root-open'
  };

  fs.writeFileSync(THEME_PATH, JSON.stringify(newTheme, null, 2) + '\n', 'utf8');
  fs.writeFileSync(MIN_THEME_PATH, JSON.stringify(newTheme) + '\n', 'utf8');
  console.log(`Generated complete bml-icons.json: ${Object.keys(iconDefinitions).length} icons, ${Object.keys(folderNames).length} folder mappings.`);
}

optimizeIcons();
