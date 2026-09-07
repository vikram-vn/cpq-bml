/**
 * dynamicFolderIcons.js
 * 
 * Dynamic rule-based Material folder icon generator for CPQ-BML.
 * Analyzes folder names and assigns Material icons dynamically based on semantic
 * rules for BML language features, CPQ domain concepts, workflows, and tools.
 * 
 * Works both at build time (Node.js) and runtime (VS Code extension host).
 */

const fs = require('fs');
const path = require('path');
const { RULE_MATCHERS, CPQ_BML_DOMAIN_CONCEPTS } = require('./folderRules');

// ─────────────────────────────────────────────────────────────────────────────
// High-Speed Matcher & LRU Cache
// ─────────────────────────────────────────────────────────────────────────────
const matchCache = new Map();

/**
 * Matches a folder name to its corresponding Material folder icon identifier.
 * Uses an internal LRU cache for high-speed repetitive lookups.
 * 
 * @param {string} name - The folder name or relative path segment
 * @returns {string|null} - Icon identifier (e.g. 'folder-database') or null
 */
function matchFolderIcon(name) {
  if (!name || typeof name !== 'string') return null;
  const cleanName = name.trim();
  if (!cleanName) return null;

  if (matchCache.has(cleanName)) {
    return matchCache.get(cleanName);
  }

  let matchedIcon = null;

  // 1. Direct Regex Rule Matching
  for (const rule of RULE_MATCHERS) {
    if (rule.regex.test(cleanName)) {
      matchedIcon = rule.icon;
      break;
    }
  }

  // 2. Token-Based Substring Matching (for compound words like 'bmlCommercePricingRules')
  if (!matchedIcon) {
    const tokens = cleanName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .split(/[-_./\s]+/);

    for (const token of tokens) {
      if (!token) continue;
      for (const rule of RULE_MATCHERS) {
        if (rule.regex.test(token)) {
          matchedIcon = rule.icon;
          break;
        }
      }
      if (matchedIcon) break;
    }
  }

  if (matchCache.size > 5000) {
    matchCache.clear();
  }
  matchCache.set(cleanName, matchedIcon);

  return matchedIcon;
}

/**
 * Returns full metadata of the rule that matches the folder name.
 * 
 * @param {string} name - Folder name
 * @returns {object|null} - The matched rule definition or null
 */
function getMatchingRule(name) {
  if (!name || typeof name !== 'string') return null;
  const cleanName = name.trim();

  for (const rule of RULE_MATCHERS) {
    if (rule.regex.test(cleanName)) return rule;
  }

  const tokens = cleanName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split(/[-_./\s]+/);

  for (const token of tokens) {
    if (!token) continue;
    for (const rule of RULE_MATCHERS) {
      if (rule.regex.test(token)) return rule;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Casing, Affix & Morphological Variation Generator
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Expands a candidate folder name into multiple casing, affix, and plural/singular forms.
 * 
 * @param {string} name - Base folder name (e.g. 'commerce-libraries')
 * @returns {string[]} - Array of variations
 */
function expandVariations(name) {
  if (!name || typeof name !== 'string') return [];
  const baseName = name.trim();
  if (!baseName) return [];

  const rawForms = new Set([baseName, baseName.toLowerCase()]);

  // Plural / Singular inflections
  if (baseName.endsWith('ies')) rawForms.add(baseName.slice(0, -3) + 'y');
  else if (baseName.endsWith('y') && !/[aeiou]y$/i.test(baseName)) rawForms.add(baseName.slice(0, -1) + 'ies');
  else if (baseName.endsWith('es') && /(?:s|sh|ch|x|z)es$/i.test(baseName)) rawForms.add(baseName.slice(0, -2));
  else if (baseName.endsWith('s') && !baseName.endsWith('ss')) rawForms.add(baseName.slice(0, -1));
  else if (!baseName.endsWith('s')) rawForms.add(baseName + 's');

  const toCamel = (s) => s.replace(/[-_./](\w)/g, (_, c) => c.toUpperCase());
  const toPascal = (s) => { const c = toCamel(s); return c.charAt(0).toUpperCase() + c.slice(1); };
  const toKebab = (s) => s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s.]+/g, '-').toLowerCase();
  const toSnake = (s) => s.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[-\s.]+/g, '_').toLowerCase();

  const result = new Set();
  for (const form of rawForms) {
    const k = toKebab(form);
    const s = toSnake(form);
    const c = toCamel(form);
    const p = toPascal(form);
    result.add(k);
    result.add(s);
    result.add(c);
    result.add(p);
    result.add('.' + k);
  }

  return Array.from(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace & Directory Discovery Scanner
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_IGNORED = new Set([
  'node_modules', '.git', '.vscode-test', 'dist', 'logs', 'scratch',
  '__pycache__', '.nyc_output', '.coverage', 'coverage', 'build', 'out'
]);

/**
 * Scans directories in a root path recursively (skipping build/cache folders).
 * Supports contextual hierarchy detection (e.g. catalog-definition -> all-product-families -> [family] -> [model]).
 * 
 * @param {string} rootDir - Root directory to scan
 * @param {number} maxDepth - Maximum recursion depth (default 8)
 * @param {Set<string>|string[]} customIgnores - Optional custom directories to ignore
 * @param {Map<string, string>} contextualAssignments - Optional map to record contextual icon mappings
 * @returns {string[]} - Discovered folder names
 */
function scanDirFolders(rootDir, maxDepth = 8, customIgnores = null, contextualAssignments = null) {
  const dirs = new Set();
  const ignored = customIgnores
    ? new Set([...DEFAULT_IGNORED, ...customIgnores])
    : DEFAULT_IGNORED;

  function walk(current, depth, parentName = '', grandParentName = '') {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !ignored.has(e.name) && !e.name.startsWith('.git')) {
          dirs.add(e.name);

          // Contextual CPQ catalog hierarchy detection:
          // e.g. catalog-definition / all-product-families / <product-family> / <model> / ...
          if (contextualAssignments && typeof contextualAssignments.set === 'function') {
            const p = parentName.toLowerCase();
            const gp = grandParentName.toLowerCase();
            if (p === 'all-product-families' || p === 'product-families') {
              // Any direct child of all-product-families is a Product Family (arbitrary name)
              contextualAssignments.set(e.name, 'folder-cluster');
            } else if (gp === 'all-product-families' || gp === 'product-families') {
              // Any child of a Product Family is a Model (arbitrary name, unless it is a rules/actions subfolder)
              const matched = matchFolderIcon(e.name);
              if (!matched || matched === 'folder-cluster' || matched === 'folder-container') {
                contextualAssignments.set(e.name, 'folder-cluster');
              }
            }
          }

          walk(path.join(current, e.name), depth + 1, e.name, parentName);
        }
      }
    } catch (err) {}
  }

  walk(rootDir, 0, path.basename(rootDir));
  return Array.from(dirs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Synchronization & JSON Generation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Synchronizes discovered folder names into a VS Code Material theme object.
 * 
 * @param {object} theme - The theme object (from bml-icons.json)
 * @param {Iterable<string>|Map<string, string>} folderCandidates - Collection of folder names or map of explicit icons
 * @param {object} [options] - Optional configuration
 * @param {boolean} [options.sortKeys=true] - Whether to sort keys alphabetically
 * @returns {number} - Number of new folder mappings added
 */
function syncFoldersIntoTheme(theme, folderCandidates, options = { sortKeys: true }) {
  let added = 0;
  const folderNames = theme.folderNames || (theme.folderNames = {});
  const folderNamesExp = theme.folderNamesExpanded || (theme.folderNamesExpanded = {});
  const iconDefs = theme.iconDefinitions || {};

  const isMap = folderCandidates instanceof Map;
  const entries = isMap ? Array.from(folderCandidates.entries()) : folderCandidates;

  for (const item of entries) {
    let candidate;
    let explicitIcon = null;

    if (isMap || (Array.isArray(item) && item.length === 2)) {
      candidate = item[0];
      explicitIcon = item[1];
    } else if (typeof item === 'object' && item !== null && item.name) {
      candidate = item.name;
      explicitIcon = item.icon;
    } else {
      candidate = item;
    }

    if (!candidate || typeof candidate !== 'string') continue;

    const iconId = explicitIcon || matchFolderIcon(candidate);
    if (!iconId) continue;

    const openIconId = iconId + '-open';
    if (!iconDefs[iconId] || !iconDefs[openIconId]) continue;

    const variants = new Set([candidate, ...expandVariations(candidate)]);
    for (const variant of variants) {
      if (!folderNames[variant]) {
        folderNames[variant] = iconId;
        folderNamesExp[variant] = openIconId;
        added++;
      }
    }
  }

  if (options.sortKeys && added > 0) {
    const sortObj = (obj) => {
      const sorted = {};
      for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
      return sorted;
    };
    theme.folderNames = sortObj(theme.folderNames);
    theme.folderNamesExpanded = sortObj(theme.folderNamesExpanded);
  }

  return added;
}

/**
 * Main build-time execution: updates themes/bml-icons.json and bml-icons.min.json.
 * 
 * @param {string} [projectRoot] - Path to CPQ-BML workspace root
 * @param {object} [options] - Optional settings
 * @returns {number} - Number of new folder mappings synced
 */
function generateDynamicIcons(projectRoot, options = {}) {
  const root = projectRoot || path.join(__dirname, '..', '..', '..');
  const themePath = path.join(root, 'themes', 'bml-icons.json');
  const minThemePath = path.join(root, 'themes', 'bml-icons.min.json');

  if (!fs.existsSync(themePath)) return 0;

  const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));

  // 1. Scan actual project directories with deep hierarchy and contextual detection
  const scanRoots = ['app', '.agents', 'knowledge', 'scripts', 'themes', 'test', 'tests', 'docs', '.gemini', 'modified'];
  let discovered = [];
  const contextualAssignments = new Map();
  for (const r of scanRoots) {
    const target = path.join(root, r);
    if (fs.existsSync(target)) {
      discovered = discovered.concat(scanDirFolders(target, 8, null, contextualAssignments));
    }
  }

  // 2. Scan IntelliSense & Metadata terms
  const intelDir = path.join(root, 'app', 'lang', 'intellisense');
  const intelTerms = [];
  try {
    const hovers = path.join(intelDir, 'keyword-hovers.json');
    if (fs.existsSync(hovers)) {
      intelTerms.push(...Object.keys(JSON.parse(fs.readFileSync(hovers, 'utf8'))));
    }
    const cats = path.join(intelDir, 'category-labels.json');
    if (fs.existsSync(cats)) {
      const catData = JSON.parse(fs.readFileSync(cats, 'utf8'));
      if (catData.categories) intelTerms.push(...Object.keys(catData.categories));
      if (catData.functionCategories) intelTerms.push(...Object.keys(catData.functionCategories));
    }
    const params = path.join(intelDir, 'param-completions.json');
    if (fs.existsSync(params)) {
      intelTerms.push(...Object.keys(JSON.parse(fs.readFileSync(params, 'utf8'))));
    }
  } catch (err) {}

  // 3. Assemble candidate pool with practical BML & CPQ prefixes
  const candidates = new Set([...discovered, ...intelTerms, ...CPQ_BML_DOMAIN_CONCEPTS]);
  const prefixes = ['bml', 'cpq'];
  for (const prefix of prefixes) {
    for (const concept of CPQ_BML_DOMAIN_CONCEPTS) {
      candidates.add(`${prefix}-${concept}`);
      candidates.add(`${concept}-${prefix}`);
    }
  }

  let added = syncFoldersIntoTheme(theme, candidates, { sortKeys: true });
  if (contextualAssignments.size > 0) {
    added += syncFoldersIntoTheme(theme, contextualAssignments, { sortKeys: true });
  }

  // Write updated theme files
  if (added > 0 || options.forceWrite) {
    fs.writeFileSync(themePath, JSON.stringify(theme, null, 2) + '\n', 'utf8');
    fs.writeFileSync(minThemePath, JSON.stringify(theme) + '\n', 'utf8');
  }

  if (!options.silent) {
    console.log(`Dynamic folder generator (JavaScript): synced ${added} new folder mappings.`);
  }

  return added;
}

/**
 * Runtime execution for VS Code extension host (called on activation/workspace open).
 * 
 * @param {object} extensionContext - VS Code ExtensionContext
 * @param {Array<object|string>} workspaceFolders - VS Code workspace folders
 */
function syncRuntimeWorkspaceFolders(extensionContext, workspaceFolders) {
  if (!extensionContext || !workspaceFolders || !workspaceFolders.length) return;

  try {
    const minThemePath = extensionContext.asAbsolutePath(path.join('themes', 'bml-icons.min.json'));
    if (!fs.existsSync(minThemePath)) return;

    const theme = JSON.parse(fs.readFileSync(minThemePath, 'utf8'));
    const folderNames = new Set();
    const contextualAssignments = new Map();

    for (const folder of workspaceFolders) {
      const fsPath = folder.uri ? folder.uri.fsPath : folder;
      if (fs.existsSync(fsPath)) {
        folderNames.add(path.basename(fsPath));
        for (const name of scanDirFolders(fsPath, 8, null, contextualAssignments)) {
          folderNames.add(name);
        }
      }
    }

    let added = syncFoldersIntoTheme(theme, folderNames, { sortKeys: false });
    if (contextualAssignments.size > 0) {
      added += syncFoldersIntoTheme(theme, contextualAssignments, { sortKeys: false });
    }
    if (added > 0) {
      fs.writeFileSync(minThemePath, JSON.stringify(theme) + '\n', 'utf8');
    }
  } catch (err) {}
}

/**
 * Calculates classification coverage against a list of sample folder names.
 * 
 * @param {object} theme - Theme object
 * @param {string[]} sampleList - List of folder names
 * @returns {object} - Statistics
 */
function getFolderIconCoverage(theme, sampleList) {
  const samples = sampleList || CPQ_BML_DOMAIN_CONCEPTS;
  let matched = 0;
  const unmatched = [];

  for (const sample of samples) {
    const icon = matchFolderIcon(sample);
    if (icon) matched++;
    else unmatched.push(sample);
  }

  return {
    total: samples.length,
    matched,
    unmatched,
    coveragePercent: ((matched / samples.length) * 100).toFixed(1) + '%'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct CLI Execution
// ─────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const root = path.join(__dirname, '..', '..', '..');

  if (args.includes('--coverage') || args.includes('-c')) {
    console.log('CPQ-BML Folder Icon Coverage:', getFolderIconCoverage(null, CPQ_BML_DOMAIN_CONCEPTS));
  } else {
    generateDynamicIcons(root, { forceWrite: args.includes('--force') });
  }
}

module.exports = {
  RULE_MATCHERS,
  CPQ_BML_DOMAIN_CONCEPTS,
  matchFolderIcon,
  getMatchingRule,
  expandVariations,
  scanDirFolders,
  syncFoldersIntoTheme,
  generateDynamicIcons,
  syncRuntimeWorkspaceFolders,
  getFolderIconCoverage
};
