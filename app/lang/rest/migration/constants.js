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
  stylesheet:                'stylesheets',
};

// ─────────────────────────────────────────────────────────────────────────────
// File system helpers
// ─────────────────────────────────────────────────────────────────────────────

function mkdirp(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeReadme(dir, content) {
  const readmePath = pathLib.join(dir, 'README.md');
  fs.writeFileSync(readmePath, content, 'utf8');
}

function sanitizeFolderName(name) {
  return String(name || 'unnamed').replace(/[\\/:*?"<>|]/g, '_').trim();
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
  lines.push('| `backup/` | Local rollback snapshots and pristine copies prior to edit |');
  lines.push('| `modify/` | Local working copies and staged edits prior to deploy |');
  lines.push('');

  return lines.join('\n');
}

function getBaseCategoryDir(siteRoot) {
  const modifyDir = pathLib.join(siteRoot, 'modify');
  if (fs.existsSync(modifyDir)) {
    return modifyDir;
  }
  const modifiedDir = pathLib.join(siteRoot, 'modified');
  if (fs.existsSync(modifiedDir)) {
    return modifiedDir;
  }
  return siteRoot;
}

module.exports = {
  CATEGORY_FOLDER_MAP,
  COMMERCE_CHILD_FOLDER,
  CONFIG_CHILD_FOLDER,
  mkdirp,
  writeReadme,
  sanitizeFolderName,
  formatItems,
  buildCategoryReadme,
  buildItemReadme,
  buildSubfolderReadme,
  buildSiteReadme,
  getBaseCategoryDir,
  getCpqSiteName,
};
