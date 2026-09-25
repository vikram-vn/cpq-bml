'use strict';

const fs = require('fs');
const pathLib = require('path');
const { getCpqSiteName } = require('@/lang/rest/folders');

// ─────────────────────────────────────────────────────────────────────────────
// Resource type → subfolder mappings
// ─────────────────────────────────────────────────────────────────────────────

/** Top-level category → folder under cpq/<site>/ */
const CATEGORY_FOLDER_MAP = {
  UTIL_LIBRARY:       'util-libraries',
  COMMERCE:           'commerce',
  PRODUCT_DEFINITION: 'configuration',
  CATALOG:            'catalog',
  CONFIGURATION:      'configuration',
  DATA_TABLE:         'data-tables',
  DOCUMENT_ENGINE:    'documents/document-engine',
  DOCUMENT_DESIGNER:  'documents/document-designer',
  EMAIL_DESIGNER:     'documents/email-designer',
  FILE_MANAGER:       'file-manager',
  ELIGIBILITY_RULE:   'eligibility-rules',
  PRICING:            'pricing',
  PART_CUSTOM_FIELD:  'parts/custom-fields',
};

/**
 * Commerce child resource types → subfolders under commerce/<process>/
 * Some types produce sub-subfolders (e.g. actions/before-formulas, attributes/default).
 */
const COMMERCE_CHILD_FOLDER = {
  action:           'actions',
  asset_management: 'asset-management',
  data_col:         'data-columns',
  document:         'documents',
  formula:          'formulas',
  integration:      'integrations',
  process_mgr_col:  'process-manager-columns',
  step:             'steps',
  template:         'templates',
  xsl_view:         'xsl-views',
};

/**
 * Configuration child resource types → subfolders under configuration/<family>/
 */
const CONFIG_CHILD_FOLDER = {
  attribute:                 'attributes',
  attribute_set:             'attribute-sets',
  product_family:            '.',  // the family itself
  rule_recommendation:       'rules/recommendations',
  rule_recommended_item:     'rules/recommended-items',
  rule_hiding:               'rules/hiding',
  rule_constraint:           'rules/constraints',
  rule_configuration_flow:   'rules/configuration-flow',
  rule_initialization:       'rules/initialization',
  product_line:              'models',
  model:                     'models',
};

// ─────────────────────────────────────────────────────────────────────────────
// README builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Writes README.md to a directory with REST response details.
 */
function writeReadme(dir, content) {
  const readmePath = pathLib.join(dir, 'README.md');
  fs.writeFileSync(readmePath, content, 'utf8');
}

function formatItems(items = [], maxShow = 50) {
  if (!items.length) return '_None_';
  const shown = items.slice(0, maxShow);
  const lines = shown.map(i => {
    const label = i.name || i.variableName || i;
    const varName = (i.variableName && i.variableName !== label) ? ` (\`${i.variableName}\`)` : '';
    const type = i.resourceType ? ` — _${i.resourceType}_` : '';
    const modified = i.lastModified ? ` — ${i.lastModified}` : '';
    return `- **${label}**${varName}${type}${modified}`;
  });
  if (items.length > maxShow) {
    lines.push(`\n_...and ${items.length - maxShow} more._`);
  }
  return lines.join('\n');
}

function buildCategoryReadme(category, item, children = []) {
  const name = item.name || category;
  const count = children.length;
  const lines = [
    `# ${name}`,
    '',
    `**Category:** \`${category}\`  `,
    `**Total Resources:** ${count}`,
    '',
    '> This folder was generated from the Oracle CPQ Migration REST API.',
    `> Source: \`GET /migrationResources/${category}\``,
    '',
  ];

  // Group children by resourceType
  const byType = {};
  for (const c of children) {
    const t = c.resourceType || 'other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(c);
  }

  for (const [type, items] of Object.entries(byType)) {
    lines.push(`## ${items[0].resourceTypeLabel || type} (${items.length})`);
    lines.push('');
    lines.push(formatItems(items));
    lines.push('');
  }

  return lines.join('\n');
}

function buildItemReadme(category, item) {
  const lines = [
    `# ${item.name || item.variableName}`,
    '',
    `**Variable Name:** \`${item.variableName}\`  `,
    `**Resource Type:** \`${item.resourceType || 'N/A'}\`  `,
    `**Category:** \`${category}\`  `,
  ];

  if (item.lastModified) lines.push(`**Last Modified:** ${item.lastModified}  `);
  if (item.modifiedByUser) lines.push(`**Modified By:** ${item.modifiedByUser}  `);

  lines.push('');
  lines.push('> Source: Oracle CPQ Migration REST API');
  lines.push(`> \`GET /migrationResources/${category}/${item.variableName}\``);
  lines.push('');

  if (item.children && item.children.length > 0) {
    lines.push(`## Children (${item.children.length})`);
    lines.push('');

    const byType = {};
    for (const c of item.children) {
      const t = c.resourceType || 'other';
      if (!byType[t]) byType[t] = [];
      byType[t].push(c);
    }

    for (const [type, children] of Object.entries(byType)) {
      lines.push(`### ${children[0].resourceTypeLabel || type} (${children.length})`);
      lines.push('');
      lines.push(formatItems(children, 100));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildSubfolderReadme(title, parentCategory, parentVarName, resourceType, items = []) {
  const lines = [
    `# ${title}`,
    '',
    `**Parent:** \`${parentCategory}/${parentVarName}\`  `,
    `**Resource Type:** \`${resourceType}\`  `,
    `**Count:** ${items.length}`,
    '',
    '> Granular sub-resources under this category item from Oracle CPQ Migration REST API.',
    '',
    '## Items',
    '',
    formatItems(items, 200),
    '',
  ];
  return lines.join('\n');
}

function buildSiteReadme(siteName, categories, packageCount) {
  const lines = [
    `# Oracle CPQ Site: ${siteName}`,
    '',
    '> This directory structure mirrors the Oracle CPQ Migration REST API resource hierarchy.',
    '> It was generated by the CPQ-BML VS Code Extension.',
    '',
    `**Site:** \`${siteName}\`  `,
    `**Generated:** ${new Date().toISOString()}  `,
    `**Migration Resource Categories:** ${categories.length}  `,
    `**Migration Packages:** ${packageCount}  `,
    '',
    '## Directory Structure',
    '',
    '| Category | Folder | Items |',
    '|:---|:---|---:|',
  ];

  for (const cat of categories) {
    const folder = CATEGORY_FOLDER_MAP[cat.category] || cat.category.toLowerCase();
    const count = cat.children ? cat.children.length : 0;
    lines.push(`| ${cat.name} (\`${cat.category}\`) | \`${folder}/\` | ${count} |`);
  }

  lines.push('');
  lines.push('## Quick Reference');
  lines.push('');
  lines.push('| Folder | Purpose |');
  lines.push('|:---|:---|');
  lines.push('| `util-libraries/` | Global BML Util Library functions |');
  lines.push('| `commerce/` | Commerce process BML: actions, formulas, data columns, documents, steps, integrations |');
  lines.push('| `configuration/` | Product family configuration: attributes, attribute sets, rules |');
  lines.push('| `catalog/` | Product Lines and Models catalog |');
  lines.push('| `data-tables/` | Data Tables (schema + CSV rows) |');
  lines.push('| `documents/` | Document Designer, Email Designer, and Document Engine templates |');
  lines.push('| `file-manager/` | Static file assets (CSS, images, JS) |');
  lines.push('| `parts/` | Part custom field definitions |');
  lines.push('| `pricing/` | Pricing engine configurations |');
  lines.push('| `eligibility-rules/` | Product eligibility rules |');
  lines.push('| `migration-packages/` | Migration package manifests |');
  lines.push('| `backup/` | Local rollback snapshots and pristine copies prior to edit |');
  lines.push('| `modified/` | Local modified working copies and staged edits prior to deploy |');
  lines.push('');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// mkdir helper
// ─────────────────────────────────────────────────────────────────────────────
function mkdirp(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep structure builders per category
// ─────────────────────────────────────────────────────────────────────────────

function buildCommerceProcessDepth(procDir, processItem) {
  const { name, variableName, children = [] } = processItem;

  writeReadme(procDir, buildItemReadme('COMMERCE', processItem));

  // Helper: ensure folder + write README
  function ensureFolder(rel, content) {
    const dir = pathLib.join(procDir, rel);
    mkdirp(dir);
    writeReadme(dir, content);
    return dir;
  }

  // Canonical plural mapping for Commerce resource types
  const COMMERCE_TYPE_MAP = {
    action:                  'actions',
    actions:                 'actions',
    asset_management:        'asset-management',
    'asset-management':      'asset-management',
    data_col:                'data-columns',
    data_cols:               'data-columns',
    data_column:             'data-columns',
    data_columns:            'data-columns',
    'data-column':           'data-columns',
    'data-columns':          'data-columns',
    document:                'documents',
    documents:               'documents',
    formula:                 'formulas',
    formulas:                'formulas',
    integration:             'integrations',
    integrations:            'integrations',
    process_mgr_col:         'process-manager-columns',
    process_mgr_cols:        'process-manager-columns',
    process_manager_column:  'process-manager-columns',
    process_manager_columns: 'process-manager-columns',
    'process-manager-column': 'process-manager-columns',
    'process-manager-columns': 'process-manager-columns',
    step:                    'steps',
    steps:                   'steps',
    template:                'templates',
    templates:               'templates',
    xsl_view:                'xsl-views',
    xsl_views:               'xsl-views',
    'xsl-view':              'xsl-views',
    'xsl-views':             'xsl-views',
  };

  // Group children by normalized plural resourceType
  const byType = {};
  for (const c of children) {
    const rawType = c.resourceType || 'other';
    const t = COMMERCE_TYPE_MAP[rawType] || rawType;
    if (!byType[t]) byType[t] = [];
    byType[t].push(c);
  }

  // Exact 10 standard plural folders matching CPQ Migration Center:
  // 1. Action(s)                 → actions/
  // 2. Asset Management          → asset-management/
  // 3. Data Column(s)            → data-columns/
  // 4. Document(s)               → documents/ (with per-document subfolders)
  // 5. Formula(s)                → formulas/
  // 6. Integration(s)            → integrations/
  // 7. Process Manager Column(s) → process-manager-columns/
  // 8. Step(s)                   → steps/
  // 9. Templates                 → templates/
  // 10. XSL View(s)              → xsl-views/
  const standardFolders = [
    { key: 'actions',                 folder: 'actions',                 label: 'Action(s)' },
    { key: 'asset-management',        folder: 'asset-management',        label: 'Asset Management' },
    { key: 'data-columns',            folder: 'data-columns',            label: 'Data Column(s)' },
    { key: 'documents',               folder: 'documents',               label: 'Document(s)' },
    { key: 'formulas',                folder: 'formulas',                label: 'Formula(s)' },
    { key: 'integrations',            folder: 'integrations',            label: 'Integration(s)' },
    { key: 'process-manager-columns', folder: 'process-manager-columns', label: 'Process Manager Column(s)' },
    { key: 'steps',                   folder: 'steps',                   label: 'Step(s)' },
    { key: 'templates',               folder: 'templates',               label: 'Templates' },
    { key: 'xsl-views',               folder: 'xsl-views',               label: 'XSL View(s)' },
  ];

  for (const def of standardFolders) {
    const items = byType[def.key] || [];
    const label = (items[0] && items[0].resourceTypeLabel) || def.label;

    ensureFolder(def.folder, buildSubfolderReadme(
      name + ' — ' + label, 'COMMERCE', variableName, def.key, items
    ));

    // Per-document subdirectories under documents/ (e.g. transaction/, transactionLine/)
    if (def.key === 'documents') {
      for (const doc of items) {
        if (!doc.variableName) continue;
        ensureFolder(def.folder + '/' + doc.variableName, [
          '# Document: ' + (doc.name || doc.variableName),
          '',
          '**Variable Name:** `' + doc.variableName + '`  ',
          '**Process:** `' + variableName + '`  ',
          '**Resource Type:** `document`  ',
          '',
          '> Commerce Process Document (e.g. Transaction header, Line Item)',
          '',
        ].join('\n'));
      }
    }
  }

  // Any unexpected types from the API
  const knownKeys = new Set(standardFolders.map(s => s.key));
  for (const [type, items] of Object.entries(byType)) {
    if (knownKeys.has(type)) continue;
    const folder = type.replace(/_/g, '-');
    ensureFolder(folder, buildSubfolderReadme(
      name + ' — ' + ((items[0] && items[0].resourceTypeLabel) || folder),
      'COMMERCE', variableName, type, items
    ));
  }
}
function buildConfigFamilyDepth(familyDir, familyItem) {
  const { variableName, children = [] } = familyItem;

  // Root README
  writeReadme(familyDir, buildItemReadme('CONFIGURATION', familyItem));

  const byType = {};
  for (const c of children) {
    const t = c.resourceType || 'other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(c);
  }

  for (const [type, items] of Object.entries(byType)) {
    const rel = CONFIG_CHILD_FOLDER[type] || `other/${type.replace(/_/g, '-')}`;
    if (rel === '.') continue; // product_family itself, skip separate subfolder

    const subDir = pathLib.join(familyDir, rel);
    mkdirp(subDir);

    const label = items[0].resourceTypeLabel || rel;
    writeReadme(subDir, buildSubfolderReadme(
      label,
      'CONFIGURATION',
      variableName,
      type,
      items
    ));
  }
}

/**
 * Builds full depth for DATA_TABLE folder.
 * data-tables/<folderVariableName>/
 *   <tableName>/     (if table has children items)
 */
function buildDataTableFolderDepth(folderDir, folderItem) {
  const { variableName, children = [] } = folderItem;

  writeReadme(folderDir, buildItemReadme('DATA_TABLE', folderItem));

  // Each child is a data table inside this folder
  for (const table of children) {
    if (!table.variableName) continue;
    const tableDir = pathLib.join(folderDir, table.variableName);
    mkdirp(tableDir);
    writeReadme(tableDir, [
      `# Data Table: ${table.name}`,
      '',
      `**Variable Name:** \`${table.variableName}\`  `,
      `**Folder:** \`${variableName}\`  `,
      `**Resource Type:** \`${table.resourceType || 'data_table'}\`  `,
      '',
      '## Files',
      `- \`${table.variableName}.csv\` — Table row data`,
      `- \`${table.variableName}-schema.json\` — Column schema (types, primary keys)`,
      '',
      '> Source: Oracle CPQ Migration REST API',
      '> `GET /migrationResources/DATA_TABLE`',
      `> _(nested under folder \`${variableName}\`)_`,
      '',
    ].join('\n'));
  }
}

/**
 * Recursively replicates the directory structure and READMEs from sourceDir to targetDir.
 * Skips 'backup', 'modified', and 'migration-packages'.
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

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the full hierarchical user space cpq/ folder structure mirroring
 * the Oracle CPQ Migration API taxonomy, with per-folder README.md files
 * containing the REST response details.
 *
 * @param {string} workspaceRoot Absolute path to workspace root
 * @param {string} siteName CPQ site name string (e.g. "cpq-10124")
 * @param {Array} migrationCategories Array of category objects from /migrationResources
 * @param {number} [packageCount=0] Number of migration packages for site README
 * @returns {{ success, siteRoot, manifestPath, manifest }}
 */
function generateMigrationFolderStructure(workspaceRoot, siteName, migrationCategories = [], packageCount = 0) {
  if (!workspaceRoot) throw new Error('workspaceRoot is required.');

  const site = getCpqSiteName(siteName);
  const siteRoot = pathLib.join(workspaceRoot, 'cpq', site);
  mkdirp(siteRoot);

  // Write site-level README
  writeReadme(siteRoot, buildSiteReadme(site, migrationCategories, packageCount));

  const manifest = {
    siteName: site,
    generatedAt: new Date().toISOString(),
    totalCategories: migrationCategories.length,
    categories: {},
  };

  const modifyDir = pathLib.join(siteRoot, 'modify');
  mkdirp(modifyDir);
  writeReadme(modifyDir, [
    '# Modify',
    '',
    'Local working copies and staged edits created by the CPQ-BML extension.',
    'Follows the identical hierarchy as the Oracle CPQ Migration API taxonomy.',
    '',
    '> These reflect local edits before deployment to the CPQ server.',
    '',
  ].join('\n'));

  for (const cat of migrationCategories) {
    const catCode = cat.category || cat.name;
    const folderSub = CATEGORY_FOLDER_MAP[catCode] || catCode.toLowerCase().replace(/_/g, '-');
    const catDir = pathLib.join(modifyDir, folderSub);
    mkdirp(catDir);

    const children = cat.children || [];
    manifest.categories[catCode] = {
      name: cat.name,
      folder: pathLib.join('cpq', site, 'modify', folderSub).replace(/\\/g, '/'),
      count: children.length,
      items: children.map(c => ({
        name: c.name,
        variableName: c.variableName,
        resourceType: c.resourceType,
      })),
    };

    // Write category-level README
    writeReadme(catDir, buildCategoryReadme(catCode, cat, children));

    // ── Per-category deep structure ──────────────────────────────────────────

    if (catCode === 'UTIL_LIBRARY') {
      // util-libraries/<functionVarName>/ per function
      for (const fn of children) {
        if (!fn.variableName) continue;
        const fnDir = pathLib.join(catDir, fn.variableName);
        mkdirp(fnDir);
        writeReadme(fnDir, buildItemReadme('UTIL_LIBRARY', fn));
      }
    }

    else if (catCode === 'COMMERCE') {
      // commerce/<processName>/ with full subfolder depth
      for (const proc of children) {
        if (!proc.variableName) continue;
        const procDir = pathLib.join(catDir, proc.variableName);
        mkdirp(procDir);
        // Note: proc.children may be populated when fetching at /migrationResources/COMMERCE/<varName>
        // Here we build with whatever is available in the top-level response
        buildCommerceProcessDepth(procDir, proc);
      }
    }

    else if (catCode === 'PRODUCT_DEFINITION') {
      // Product families: top-level family listing only (no granular per-family endpoint)
      // Deep enrichment comes from CONFIGURATION category which has the same families
      for (const fam of children) {
        if (!fam.variableName) continue;
        const famDir = pathLib.join(modifyDir, 'configuration', fam.variableName);
        mkdirp(famDir);
        // Only write README if not already written by CONFIGURATION pass
        const readmePath = pathLib.join(famDir, 'README.md');
        if (!fs.existsSync(readmePath)) {
          writeReadme(famDir, buildItemReadme('PRODUCT_DEFINITION', fam));
        }
      }
    }

    else if (catCode === 'CONFIGURATION') {
      // Configuration families with full rule/attribute depth
      for (const fam of children) {
        if (!fam.variableName) continue;
        const famDir = pathLib.join(modifyDir, 'configuration', fam.variableName);
        mkdirp(famDir);
        buildConfigFamilyDepth(famDir, fam);
      }
    }

    else if (catCode === 'CATALOG') {
      for (const line of children) {
        if (!line.variableName) continue;
        const lineDir = pathLib.join(catDir, line.variableName);
        mkdirp(lineDir);
        writeReadme(lineDir, buildItemReadme('CATALOG', line));
      }
    }

    else if (catCode === 'DATA_TABLE') {
      // DATA_TABLE: category response already contains nested children (folder → tables)
      // The variableName for folders like "_default" returns 404 on granular endpoint;
      // all data is already present in the category-level response.
      for (const folder of children) {
        if (!folder.variableName) continue;
        const folderDir = pathLib.join(catDir, folder.variableName);
        mkdirp(folderDir);
        // folder.children contains the actual data tables inside this folder
        buildDataTableFolderDepth(folderDir, folder);
      }
    }

    else if (catCode === 'DOCUMENT_ENGINE' || catCode === 'DOCUMENT_DESIGNER' || catCode === 'EMAIL_DESIGNER') {
      for (const set of children) {
        if (!set.variableName) continue;
        const setDir = pathLib.join(catDir, set.variableName);
        mkdirp(setDir);
        writeReadme(setDir, buildItemReadme(catCode, set));
      }
    }

    else if (catCode === 'FILE_MANAGER') {
      for (const folder of children) {
        if (!folder.variableName) continue;
        const folderDir = pathLib.join(catDir, folder.variableName);
        mkdirp(folderDir);
        writeReadme(folderDir, buildItemReadme('FILE_MANAGER', folder));
      }
    }

    else if (catCode === 'ELIGIBILITY_RULE') {
      for (const rule of children) {
        if (!rule.variableName) continue;
        const ruleDir = pathLib.join(catDir, rule.variableName);
        mkdirp(ruleDir);
        writeReadme(ruleDir, buildItemReadme('ELIGIBILITY_RULE', rule));
      }
    }

    else if (catCode === 'PART_CUSTOM_FIELD') {
      for (const field of children) {
        if (!field.variableName) continue;
        const fieldDir = pathLib.join(catDir, field.variableName);
        mkdirp(fieldDir);
        writeReadme(fieldDir, buildItemReadme('PART_CUSTOM_FIELD', field));
      }
    }

    else if (catCode === 'PRICING') {
      for (const pricing of children) {
        if (!pricing.variableName) continue;
        const pDir = pathLib.join(catDir, pricing.variableName);
        mkdirp(pDir);
        writeReadme(pDir, buildItemReadme('PRICING', pricing));
      }
    }
  }

  // Always ensure backup, modify, and migration-packages folders exist with mirrored structure
  const backupDir = pathLib.join(siteRoot, 'backup');
  mkdirp(backupDir);
  writeReadme(backupDir, [
    '# Backup',
    '',
    'Local snapshots and pristine rollback restore points created by the CPQ-BML extension.',
    'Follows the identical hierarchy as the live CPQ environment.',
    '',
    '> These are generated locally prior to modifications and are not synced to the CPQ server.',
    '',
  ].join('\n'));
  replicateStructure(modifyDir, backupDir, 'Backup', 'Local pristine snapshots and rollback restore points prior to edit.', modifyDir);

  return { success: true, siteRoot, manifest };
}

function getBaseCategoryDir(siteRoot) {
  if (fs.existsSync(pathLib.join(siteRoot, 'modify'))) {
    return pathLib.join(siteRoot, 'modify');
  }
  return siteRoot;
}

/**
 * Enriches a commerce process folder with deep children fetched from granular API.
 * Called after the top-level structure is built, when granular data is available.
 */
function enrichCommerceProcess(siteRoot, processVarName, processItem) {
  const base = getBaseCategoryDir(siteRoot);
  const procDir = pathLib.join(base, 'commerce', processVarName);
  mkdirp(procDir);
  buildCommerceProcessDepth(procDir, processItem);
}

/**
 * Enriches a configuration family folder with deep children from granular API.
 */
function enrichConfigFamily(siteRoot, familyVarName, familyItem) {
  const base = getBaseCategoryDir(siteRoot);
  const famDir = pathLib.join(base, 'configuration', familyVarName);
  mkdirp(famDir);
  buildConfigFamilyDepth(famDir, familyItem);
}

/**
 * Enriches a data-table folder with deep children from granular API.
 */
function enrichDataTableFolder(siteRoot, folderVarName, folderItem) {
  const base = getBaseCategoryDir(siteRoot);
  const folderDir = pathLib.join(base, 'data-tables', folderVarName);
  mkdirp(folderDir);
  buildDataTableFolderDepth(folderDir, folderItem);
}

module.exports = {
  CATEGORY_FOLDER_MAP,
  COMMERCE_CHILD_FOLDER,
  CONFIG_CHILD_FOLDER,
  generateMigrationFolderStructure,
  buildCommerceProcessDepth,
  enrichCommerceProcess,
  enrichConfigFamily,
  enrichDataTableFolder,
  replicateStructure,
  writeReadme,
  buildItemReadme,
  buildCategoryReadme,
};
