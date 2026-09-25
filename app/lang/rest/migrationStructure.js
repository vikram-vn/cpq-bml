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
 */
const COMMERCE_CHILD_FOLDER = {
  action:           'actions',
  asset_management: 'asset-management',
  data_col:         'attributes',
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
    `> Source: \`GET /rest/v19/migrationResources/${category}\``,
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
  lines.push(`> \`GET /rest/v19/migrationResources/${category}/${item.variableName}\``);
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
  lines.push('| `commerce/` | Commerce process BML: actions, formulas, rules, attributes, steps, integrations |');
  lines.push('| `configuration/` | Product family configuration: attributes, attribute sets, rules |');
  lines.push('| `catalog/` | Product Lines and Models catalog |');
  lines.push('| `data-tables/` | Data Tables (schema + CSV rows) |');
  lines.push('| `documents/` | Document Designer, Email Designer, and Document Engine templates |');
  lines.push('| `file-manager/` | Static file assets (CSS, images, JS) |');
  lines.push('| `parts/` | Part custom field definitions |');
  lines.push('| `pricing/` | Pricing engine configurations |');
  lines.push('| `eligibility-rules/` | Product eligibility rules |');
  lines.push('| `migration-packages/` | Migration package manifests |');
  lines.push('| `backup/` | Local rollback snapshots |');
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

/**
 * Builds full depth for a COMMERCE process.
 * commerce/<processName>/
 *   actions/           → type: action
 *   asset-management/  → type: asset_management
 *   attributes/        → type: data_col
 *   documents/         → type: document
 *   formulas/          → type: formula
 *   integrations/      → type: integration
 *   process-manager-columns/ → type: process_mgr_col
 *   steps/             → type: step
 *   templates/         → type: template
 *   xsl-views/         → type: xsl_view
 */
function buildCommerceProcessDepth(procDir, processItem) {
  const { name, variableName, children = [] } = processItem;

  // Root README for this process
  writeReadme(procDir, buildItemReadme('COMMERCE', processItem));

  // Group children by type
  const byType = {};
  for (const c of children) {
    const t = c.resourceType || 'other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(c);
  }

  // Create typed subfolders with their own READMEs
  for (const [type, items] of Object.entries(byType)) {
    const subFolderName = COMMERCE_CHILD_FOLDER[type] || type.replace(/_/g, '-');
    const subDir = pathLib.join(procDir, subFolderName);
    mkdirp(subDir);

    const label = items[0].resourceTypeLabel || subFolderName;
    writeReadme(subDir, buildSubfolderReadme(
      `${name} — ${label}`,
      'COMMERCE',
      variableName,
      type,
      items
    ));

    // For document type: create per-document subdirs (e.g. transaction/, transactionLine/)
    if (type === 'document') {
      for (const doc of items) {
        const docDir = pathLib.join(subDir, doc.variableName);
        mkdirp(docDir);
        writeReadme(docDir, [
          `# Document: ${doc.name}`,
          '',
          `**Variable Name:** \`${doc.variableName}\`  `,
          `**Process:** \`${variableName}\`  `,
          `**Resource Type:** \`document\`  `,
          '',
          '> Commerce Process Document (e.g. Transaction header, Line Item)',
          '',
        ].join('\n'));
      }
    }
  }
}

/**
 * Builds full depth for a CONFIGURATION product family.
 * configuration/<familyName>/
 *   attributes/            → type: attribute
 *   attribute-sets/        → type: attribute_set
 *   models/                → type: product_line, model
 *   rules/
 *     recommendations/     → type: rule_recommendation
 *     recommended-items/   → type: rule_recommended_item
 *     hiding/              → type: rule_hiding
 *     constraints/         → type: rule_constraint
 *     configuration-flow/  → type: rule_configuration_flow
 *     initialization/      → type: rule_initialization
 */
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
      '- `<tableName>.csv` — Table row data',
      '- `<tableName>-schema.json` — Column schema (types, primary keys)',
      '',
      '> Source: `GET /rest/v19/migrationResources/DATA_TABLE/' + table.variableName + '`',
      '',
    ].join('\n'));
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
 * @param {Array} migrationCategories Array of category objects from /rest/v19/migrationResources
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

  for (const cat of migrationCategories) {
    const catCode = cat.category || cat.name;
    const folderSub = CATEGORY_FOLDER_MAP[catCode] || catCode.toLowerCase().replace(/_/g, '-');
    const catDir = pathLib.join(siteRoot, folderSub);
    mkdirp(catDir);

    const children = cat.children || [];
    manifest.categories[catCode] = {
      name: cat.name,
      folder: pathLib.join('cpq', site, folderSub).replace(/\\/g, '/'),
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

    else if (catCode === 'CONFIGURATION' || catCode === 'PRODUCT_DEFINITION') {
      // configuration/<familyName>/ with full subfolder depth
      for (const fam of children) {
        if (!fam.variableName) continue;
        const famDir = pathLib.join(siteRoot, 'configuration', fam.variableName);
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
      // data-tables/<folderName>/<tableName>/
      for (const folder of children) {
        if (!folder.variableName) continue;
        const folderDir = pathLib.join(catDir, folder.variableName);
        mkdirp(folderDir);
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

  // Always ensure backup and migration-packages folders exist
  const backupDir = pathLib.join(siteRoot, 'backup');
  mkdirp(backupDir);
  writeReadme(backupDir, [
    '# Backup',
    '',
    'Local snapshots and rollback restore points created by the CPQ-BML extension.',
    '',
    '> These are generated locally and are not synced to the CPQ server.',
    '',
  ].join('\n'));

  const pkgDir = pathLib.join(siteRoot, 'migration-packages');
  mkdirp(pkgDir);
  writeReadme(pkgDir, [
    '# Migration Packages',
    '',
    'Migration package manifests and metadata retrieved from Oracle CPQ.',
    '',
    '> Source: `GET /rest/v19/migrationPackages`',
    '',
    'Each subfolder corresponds to a migration package identifier and contains',
    'a `package-info.json` with the full package metadata from the REST API.',
    '',
  ].join('\n'));

  // Write manifest
  const manifestPath = pathLib.join(siteRoot, 'cpq-migration-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return { success: true, siteRoot, manifestPath, manifest };
}

/**
 * Enriches a commerce process folder with deep children fetched from granular API.
 * Called after the top-level structure is built, when granular data is available.
 */
function enrichCommerceProcess(siteRoot, processVarName, processItem) {
  const procDir = pathLib.join(siteRoot, 'commerce', processVarName);
  mkdirp(procDir);
  buildCommerceProcessDepth(procDir, processItem);
}

/**
 * Enriches a configuration family folder with deep children from granular API.
 */
function enrichConfigFamily(siteRoot, familyVarName, familyItem) {
  const famDir = pathLib.join(siteRoot, 'configuration', familyVarName);
  mkdirp(famDir);
  buildConfigFamilyDepth(famDir, familyItem);
}

/**
 * Enriches a data-table folder with deep children from granular API.
 */
function enrichDataTableFolder(siteRoot, folderVarName, folderItem) {
  const folderDir = pathLib.join(siteRoot, 'data-tables', folderVarName);
  mkdirp(folderDir);
  buildDataTableFolderDepth(folderDir, folderItem);
}

module.exports = {
  CATEGORY_FOLDER_MAP,
  COMMERCE_CHILD_FOLDER,
  CONFIG_CHILD_FOLDER,
  generateMigrationFolderStructure,
  enrichCommerceProcess,
  enrichConfigFamily,
  enrichDataTableFolder,
  writeReadme,
  buildItemReadme,
  buildCategoryReadme,
};
