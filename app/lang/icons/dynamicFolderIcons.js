/**
 * dynamicFolderIcons.js
 * 
 * Dynamic rule-based Material folder icon generator for CPQ-BML.
 * Analyzes folder names and assigns Material icons dynamically based on semantic
 * rules for BML language features, CPQ domain concepts, workflows, and tools.
 * 
 * Works both at build time (Node.js) and runtime (VS Code extension host on install/activation).
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Decision Engine: Ordered Rules & Classifiers
// ─────────────────────────────────────────────────────────────────────────────
const RULE_MATCHERS = [
  // 1. Modifications / Updates
  { regex: /(?:^|[-_])(modify|updates?|edits?|changes?)(?:[-_]|$)/i, icon: 'folder-update' },

  // 2. Database, BMQL, Data Tables, System Lookups & Queries
  { regex: /(?:^|[-_])(db|database|bmql|lookups?|datatables?|data[-_]tables?|sql|queries|query|tables?|records?)(?:[-_]|$)/i, icon: 'folder-database' },

  // 3. Workflows, Processes, Steps, Lifecycles
  { regex: /(?:^|[-_])(workflow|workflows|flow|flows|steps?|process|pipeline|lifecycle)(?:[-_]|$)/i, icon: 'folder-flow' },

  // 4. JSON & Dictionary Data Structures
  { regex: /(?:^|[-_])(json|dicts?|dictionary|dictionaries|globaldict|hash)(?:[-_]|$)/i, icon: 'folder-json' },

  // 5. XML, XSL, XSLT, and Templates
  { regex: /(?:^|[-_])(xslt?|xml|markup|template|templates)(?:[-_]|$)/i, icon: 'folder-xml' },

  // 6. Web Services, REST, APIs, Endpoints, SOAP & Urldata
  { regex: /(?:^|[-_])(rest|apis?|web[-_]?services?|webservices?|soap|http|urldata|endpoints?)(?:[-_]|$)/i, icon: 'folder-api' },

  // 7. Model Context Protocol (MCP), Integrations & Remote Connections
  { regex: /(?:^|[-_])(mcp|connections?|integrations?|rpc|client|server)(?:[-_]|$)/i, icon: 'folder-connection' },

  // 8. Utilities, Tools, Tool-defs & Helpers
  { regex: /(?:^|[-_])(util[-_]?libraries|util[-_]?library|utils?|utilities|helpers?|tool[-_]?defs?|tools?)(?:[-_]|$)/i, icon: 'folder-utils' },

  // 9. Commerce Processes, Cart, Pricing, Quotes, Transactions & Orders
  { regex: /(?:^|[-_])(commerce[-_]?libraries|commerce[-_]?library|commerce|e[-_]?commerce|cart|shop|pricing|prices?|transactions?|orders?|quotes?)(?:[-_]|$)/i, icon: 'folder-cart' },

  // 10. Configuration, Setup, Admin Settings, Preferences
  { regex: /(?:^|[-_])(config|configuration|setup|setups|settings?[-_]?panel|settings?|options?|preferences?|prefs?)(?:[-_]|$)/i, icon: 'folder-config' },

  // 11. Rules, Policies, Approvals & Best Practices
  { regex: /(?:^|[-_])(rules?|policies|policy|approvals?|best[-_]?practices?)(?:[-_]|$)/i, icon: 'folder-rules' },

  // 12. Constraints, Guardrails & Input Restrictions
  { regex: /(?:^|[-_])(constraints?|guards?|restrictions?|limits?)(?:[-_]|$)/i, icon: 'folder-guard' },

  // 13. Recommendations, Recommended Items, Starred Items
  { regex: /(?:^|[-_])(recommendations?|recommended[-_]?items?|recommended[-_]?item|favorites?|stars?|featured)(?:[-_]|$)/i, icon: 'folder-favicon' },

  // 14. Access Control, Security, User Rights & Permissions
  { regex: /(?:^|[-_])(access(?:[-_]?rights)?|security|auth|permissions?|roles?|usersession)(?:[-_]|$)/i, icon: 'folder-secure' },

  // 15. Attributes, Variables, Inlay Hints & Parameter Completions
  { regex: /(?:^|[-_])(attributes?|variables?|elements?|params?|parameters?|param[-_]?completions?|inlay[-_]?hints?)(?:[-_]|$)/i, icon: 'folder-element' },

  // 16. Constants, Enums, Literals & Strings
  { regex: /(?:^|[-_])(constants?|enums?|strings?|literals?)(?:[-_]|$)/i, icon: 'folder-constant' },

  // 17. Pitfalls, Errors, Warnings & Deprecations
  { regex: /(?:^|[-_])(pitfalls?|errors?|warnings?|bugs?|deprecated|issues?)(?:[-_]|$)/i, icon: 'folder-error' },

  // 18. Linters, Code Review & Diagnostic Inspections
  { regex: /(?:^|[-_])(linters?|lint|reviews?|inspections?|quality|advisories)(?:[-_]|$)/i, icon: 'folder-review' },

  // 19. Beautifier, Code Formatter & Prettifier
  { regex: /(?:^|[-_])(beautify|formatters?|formatting|pretty|prettify|cleanup)(?:[-_]|$)/i, icon: 'folder-beautify' },

  // 20. Code Metrics, Benchmarks, Analytics & Coverage
  { regex: /(?:^|[-_])(metrics?|benchmarks?|analytics|stats|measurements?|coverage)(?:[-_]|$)/i, icon: 'folder-metrics' },

  // 21. Artificial Intelligence, LLMs, Agents, Crawlers & IntelliSense
  { regex: /(?:^|[-_])(ai|agents?|gemini|llm|copilot|bots?|prompts?|crawlers?|intellisense)(?:[-_]|$)/i, icon: 'folder-gemini-ai' },

  // 22. Library Modules & Packages
  { regex: /(?:^|[-_])(libraries|library|libs?)(?:[-_]|$)/i, icon: 'folder-lib' },

  // 23. Categories, Filters, Groupings & Types
  { regex: /(?:^|[-_])(categories|category|filters?|types?|classes|groupings?)(?:[-_]|$)/i, icon: 'folder-filter' },

  // 24. Webviews, Layouts, UI Panels & Tabs
  { regex: /(?:^|[-_])(web[-_]?views?|layouts?|views?|ui|screens?|windows?|tabs?)(?:[-_]|$)/i, icon: 'folder-layout' },

  // 25. Themes, Material Icons & Appearance
  { regex: /(?:^|[-_])(material|themes?|styles?|css|icons?|appearance)(?:[-_]|$)/i, icon: 'folder-theme' },

  // 26. Actions, Triggers & Commands
  { regex: /(?:^|[-_])(actions?|triggers?|commands?|events?)(?:[-_]|$)/i, icon: 'folder-trigger' },

  // 27. Comments, Annotations, Messages & Discussions
  { regex: /(?:^|[-_])(comments?|messages?|chat|discussions?|notes?)(?:[-_]|$)/i, icon: 'folder-messages' },

  // 28. Tests, Testing Suites & Runners
  { regex: /(?:^|[-_])(tests?|testing|specs?|suites?)(?:[-_]|$)/i, icon: 'folder-test' },

  // 29. Snapshots, Backups & History
  { regex: /(?:^|[-_])(snapshots?|backups?|history|archives?)(?:[-_]|$)/i, icon: 'folder-backup' },

  // 30. Syntaxes, Grammars, Spell Checking & Spelling
  { regex: /(?:^|[-_])(syntaxes?|syntax|spell[-_]?check|spelling|grammar)(?:[-_]|$)/i, icon: 'folder-syntax' },

  // 31. Mathematics & Mathematical Formulas
  { regex: /(?:^|[-_])(math|formulas?|calculations?)(?:[-_]|$)/i, icon: 'folder-functions' },

  // 32. Dates, DateTime & Event Calendars
  { regex: /(?:^|[-_])(dates?|datetime|time|events?|calendar)(?:[-_]|$)/i, icon: 'folder-event' },

  // 33. Arrays, Queues & Line Items
  { regex: /(?:^|[-_])(arrays?|queues?|lists?|line[-_]?items?)(?:[-_]|$)/i, icon: 'folder-queue' },

  // 34. BOM (Bill of Materials) & Hierarchy Trees
  { regex: /(?:^|[-_])(bom|bill[-_]?of[-_]?materials?|hierarchy|trees?|clusters?)(?:[-_]|$)/i, icon: 'folder-cluster' },

  // 35. Web Links & Hyperlinks
  { regex: /(?:^|[-_])(urls?|links?|href)(?:[-_]|$)/i, icon: 'folder-link' },

  // 36. Documentation, Markdown & DocMD
  { regex: /(?:^|[-_])(docs?|documentations?|markdown|docmd|html2docmd)(?:[-_]|$)/i, icon: 'folder-docs' },

  // 37. Skills & Capabilities
  { regex: /(?:^|[-_])(skills?)(?:[-_]|$)/i, icon: 'folder-skills' },

  // 38. Privacy & Hiding Rules
  { regex: /(?:^|[-_])(hiding|hidden|privates?)(?:[-_]|$)/i, icon: 'folder-private' },

  // 39. Language Fallbacks: Any unclassified BML folder gets BML icon
  { regex: /bml/i, icon: 'folder-bml' },

  // 40. Domain Fallbacks: Any unclassified CPQ folder gets CPQ Cart icon
  { regex: /cpq/i, icon: 'folder-cart' }
];

function matchFolderIcon(name) {
  for (const rule of RULE_MATCHERS) {
    if (rule.regex.test(name)) return rule.icon;
  }
  return null;
}

function expandVariations(name) {
  const vars = new Set();
  vars.add(name);
  vars.add(name.toLowerCase());

  const addAffixes = (n) => {
    vars.add(n);
    vars.add('.' + n);
    vars.add('_' + n);
    vars.add('-' + n);
    vars.add('__' + n + '__');
  };

  for (const base of Array.from(vars)) {
    addAffixes(base);
  }

  if (name.includes('-')) {
    const camel = name.replace(/-([a-zA-Z])/g, (_, g) => g.toUpperCase());
    const snake = name.replace(/-/g, '_');
    const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
    for (const form of [camel, snake, pascal]) addAffixes(form);
  }

  if (name.includes('_')) {
    const kebab = name.replace(/_/g, '-');
    const camel = kebab.replace(/-([a-zA-Z])/g, (_, g) => g.toUpperCase());
    const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
    for (const form of [kebab, camel, pascal]) addAffixes(form);
  }

  return Array.from(vars);
}

/**
 * Scans directories in a root path (skipping build/cache folders)
 */
function scanDirFolders(rootDir, maxDepth = 4) {
  const dirs = new Set();
  const ignored = new Set(['node_modules', '.git', '.vscode-test', 'dist', 'logs', 'scratch', '__pycache__']);

  function walk(current, depth) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !ignored.has(e.name) && !e.name.startsWith('.git')) {
          dirs.add(e.name);
          walk(path.join(current, e.name), depth + 1);
        }
      }
    } catch (err) {}
  }

  walk(rootDir, 0);
  return Array.from(dirs);
}

/**
 * Synchronizes discovered folder names into a theme object and returns count added
 */
function syncFoldersIntoTheme(theme, folderCandidates) {
  let added = 0;
  const folderNames = theme.folderNames || (theme.folderNames = {});
  const folderNamesExp = theme.folderNamesExpanded || (theme.folderNamesExpanded = {});
  const iconDefs = theme.iconDefinitions || {};

  for (const candidate of folderCandidates) {
    const iconId = matchFolderIcon(candidate);
    if (!iconId) continue;

    const openIconId = iconId + '-open';
    if (!iconDefs[iconId] || !iconDefs[openIconId]) continue;

    for (const variant of expandVariations(candidate)) {
      if (!folderNames[variant]) {
        folderNames[variant] = iconId;
        folderNamesExp[variant] = openIconId;
        added++;
      }
    }
  }

  return added;
}

/**
 * Main build-time execution: updates themes/bml-icons.json and bml-icons.min.json
 */
function generateDynamicIcons(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..', '..');
  const themePath = path.join(root, 'themes', 'bml-icons.json');
  const minThemePath = path.join(root, 'themes', 'bml-icons.min.json');

  if (!fs.existsSync(themePath)) return 0;

  const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));

  // 1. Scan actual project directories
  const scanRoots = ['app', '.agents', 'knowledge', 'scripts', 'themes'];
  let discovered = [];
  for (const r of scanRoots) {
    const target = path.join(root, r);
    if (fs.existsSync(target)) {
      discovered = discovered.concat(scanDirFolders(target, 4));
    }
  }

  // 2. Scan IntelliSense terms if available
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
  } catch (err) {}

  // 3. Known CPQ and BML domain concepts
  const domainConcepts = [
    'modify', 'rules', 'configuration', 'recommendation', 'recommended-item',
    'constraint', 'access', 'attributes', 'libraries', 'util-libraries',
    'commerce-libraries', 'validation', 'approvals', 'pricing', 'bom',
    'integrations', 'transactions', 'line-items', 'bmql', 'variables',
    'constants', 'dictionary', 'arrays', 'math', 'date', 'strings',
    'urldata', 'debug', 'testing', 'snapshots', 'hiding', 'web-services',
    'tool-defs', 'categories', 'material', 'web-view'
  ];

  const candidates = new Set([...discovered, ...intelTerms, ...domainConcepts]);

  // Prefix combinations
  const prefixes = ['bml', 'cpq', 'util', 'commerce', 'bmql'];
  for (const prefix of prefixes) {
    for (const concept of domainConcepts) {
      candidates.add(`${prefix}-${concept}`);
      candidates.add(`${concept}-${prefix}`);
    }
  }

  const added = syncFoldersIntoTheme(theme, candidates);

  // Write updated theme files
  fs.writeFileSync(themePath, JSON.stringify(theme, null, 2) + '\n', 'utf8');
  fs.writeFileSync(minThemePath, JSON.stringify(theme) + '\n', 'utf8');

  console.log(`Dynamic folder generator (JavaScript): synced ${added} new folder mappings.`);
  return added;
}

/**
 * Runtime execution for VS Code extension host (called on activation/workspace open)
 */
function syncRuntimeWorkspaceFolders(extensionContext, workspaceFolders) {
  if (!extensionContext || !workspaceFolders || !workspaceFolders.length) return;

  try {
    const minThemePath = extensionContext.asAbsolutePath(path.join('themes', 'bml-icons.min.json'));
    if (!fs.existsSync(minThemePath)) return;

    const theme = JSON.parse(fs.readFileSync(minThemePath, 'utf8'));
    const folderNames = new Set();

    for (const folder of workspaceFolders) {
      const fsPath = folder.uri ? folder.uri.fsPath : folder;
      if (fs.existsSync(fsPath)) {
        folderNames.add(path.basename(fsPath));
        for (const name of scanDirFolders(fsPath, 2)) {
          folderNames.add(name);
        }
      }
    }

    const added = syncFoldersIntoTheme(theme, folderNames);
    if (added > 0) {
      fs.writeFileSync(minThemePath, JSON.stringify(theme) + '\n', 'utf8');
    }
  } catch (err) {
    // Non-fatal if filesystem is read-only in some environments
  }
}

module.exports = {
  RULE_MATCHERS,
  matchFolderIcon,
  expandVariations,
  scanDirFolders,
  syncFoldersIntoTheme,
  generateDynamicIcons,
  syncRuntimeWorkspaceFolders
};
