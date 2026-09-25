'use strict';

const fs = require('fs');
const pathLib = require('path');
const {
  mkdirp,
  writeReadme,
  sanitizeFolderName,
  formatItems,
  buildItemReadme,
  buildSubfolderReadme,
  getBaseCategoryDir,
} = require('@/lang/rest/migration/constants');
const { replicateStructure } = require('@/lang/rest/migration/replication');

function buildCommerceProcessDepth(procDir, processItem) {
  const { name, variableName, children = [] } = processItem;

  writeReadme(procDir, buildItemReadme('COMMERCE', processItem));

  function ensureFolder(rel, content) {
    const dir = pathLib.join(procDir, rel);
    mkdirp(dir);
    if (content) writeReadme(dir, content);
    return dir;
  }

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

  const DOC_CHILD_TYPE_MAP = {
    action:                  'actions',
    actions:                 'actions',
    action_set:              'action-sets',
    action_sets:             'action-sets',
    'action-set':            'action-sets',
    'action-sets':           'action-sets',
    attribute:               'attributes',
    attributes:              'attributes',
    attribute_set:           'attribute-sets',
    attribute_sets:          'attribute-sets',
    'attribute-set':         'attribute-sets',
    'attribute-sets':        'attribute-sets',
    array_attr_set:          'array-attribute-sets',
    array_attr_sets:         'array-attribute-sets',
    'array-attr-set':        'array-attribute-sets',
    'array-attribute-sets':  'array-attribute-sets',
    rule:                    'rules',
    rules:                   'rules',
    library:                 'library-functions',
    libraries:               'library-functions',
    'library-functions':     'library-functions',
    jet_layout:              'layouts',
    redwoodLayoutRule:       'layouts',
    redwood_layout:          'layouts',
    layout:                  'layouts',
    layouts:                 'layouts',
  };

  const STANDARD_DOC_FOLDERS = [
    { key: 'actions',                folder: 'actions',                label: 'Action(s)' },
    { key: 'action-sets',            folder: 'action-sets',            label: 'Action Set(s)' },
    { key: 'attributes',             folder: 'attributes',             label: 'Attribute(s)' },
    { key: 'attribute-sets',         folder: 'attribute-sets',         label: 'Attribute Set(s)' },
    { key: 'array-attribute-sets',   folder: 'array-attribute-sets',   label: 'Array Attribute Set(s)' },
    { key: 'rules',                  folder: 'rules',                  label: 'Rule(s)' },
    { key: 'library-functions',      folder: 'library-functions',      label: 'Library Function(s)' },
    { key: 'layouts',                folder: 'layouts',                label: 'Layout(s)' },
  ];

  const byType = {};
  for (const c of children) {
    const rawType = c.resourceType || 'other';
    const t = COMMERCE_TYPE_MAP[rawType] || rawType;
    if (!byType[t]) byType[t] = [];
    byType[t].push(c);
  }

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

    const catDir = ensureFolder(def.folder, buildSubfolderReadme(
      name + ' — ' + label, 'COMMERCE', variableName, def.key, items
    ));

    if (def.key === 'documents') {
      for (const doc of items) {
        if (!doc.variableName) continue;
        const docDir = pathLib.join(catDir, sanitizeFolderName(doc.variableName));
        mkdirp(docDir);

        const docChildren = doc.children || [];
        const docByType = {};
        for (const dc of docChildren) {
          const rawType = dc.resourceType || 'other';
          const t = DOC_CHILD_TYPE_MAP[rawType] || rawType;
          if (!docByType[t]) docByType[t] = [];
          docByType[t].push(dc);
        }

        const docLines = [
          `# Document: ${doc.name || doc.variableName}`,
          '',
          `**Variable Name:** \`${doc.variableName}\`  `,
          `**Process:** \`${name} (${variableName})\`  `,
          `**Resource Type:** \`document\`  `,
        ];
        if (doc.lastModified) docLines.push(`**Last Modified:** ${doc.lastModified}  `);
        docLines.push('');
        docLines.push('> Commerce Process Document (e.g. Transaction header, Line Item)');
        docLines.push('');
        docLines.push(`## Child Resources (${docChildren.length})`);
        docLines.push('');

        for (const dFolder of STANDARD_DOC_FOLDERS) {
          const dItems = docByType[dFolder.key] || [];
          if (dItems.length > 0) {
            docLines.push(`- **[${dFolder.label}](./${dFolder.folder}/)** (${dItems.length} items)`);
          }
        }
        const knownDocKeys = new Set(STANDARD_DOC_FOLDERS.map(f => f.key));
        for (const [dt, dItems] of Object.entries(docByType)) {
          if (!knownDocKeys.has(dt)) {
            docLines.push(`- **[${dt}](./${dt}/)** (${dItems.length} items)`);
          }
        }
        docLines.push('');
        writeReadme(docDir, docLines.join('\n'));

        for (const dFolder of STANDARD_DOC_FOLDERS) {
          const dItems = docByType[dFolder.key] || [];
          if (!dItems.length) continue;

          const dCatDir = pathLib.join(docDir, dFolder.folder);
          mkdirp(dCatDir);
          writeReadme(dCatDir, buildSubfolderReadme(
            `${doc.name || doc.variableName} — ${dFolder.label}`,
            `COMMERCE/${variableName}/documents`,
            doc.variableName,
            dFolder.key,
            dItems
          ));

          for (const item of dItems) {
            const itemFolder = pathLib.join(dCatDir, sanitizeFolderName(item.variableName || item.name));
            mkdirp(itemFolder);

            const itemLines = [
              `# ${item.name || item.variableName}`,
              '',
              `**Variable Name:** \`${item.variableName || item.name}\`  `,
              `**Document:** \`${doc.name || doc.variableName} (${doc.variableName})\`  `,
              `**Process:** \`${name} (${variableName})\`  `,
              `**Resource Type:** \`${item.resourceTypeLabel || item.resourceType || dFolder.key}\`  `,
            ];
            if (item.lastModified) itemLines.push(`**Last Modified:** ${item.lastModified}  `);
            itemLines.push('');
            itemLines.push('> Source: Oracle CPQ Migration REST API');
            itemLines.push(`> \`GET /migrationResources/COMMERCE/${variableName}\` → Document \`${doc.variableName}\``);
            itemLines.push('');

            if (item.children && item.children.length > 0) {
              itemLines.push(`## Child Items (${item.children.length})`);
              itemLines.push('');
              itemLines.push(formatItems(item.children, 100));
              itemLines.push('');

              for (const subAttr of item.children) {
                const subDir = pathLib.join(itemFolder, sanitizeFolderName(subAttr.variableName || subAttr.name));
                mkdirp(subDir);
                writeReadme(subDir, [
                  `# ${subAttr.name || subAttr.variableName}`,
                  '',
                  `**Variable Name:** \`${subAttr.variableName || subAttr.name}\`  `,
                  `**Parent:** \`${item.name || item.variableName}\`  `,
                  `**Document:** \`${doc.name || doc.variableName}\`  `,
                  `**Process:** \`${name} (${variableName})\`  `,
                  `**Resource Type:** \`${subAttr.resourceTypeLabel || subAttr.resourceType || 'attribute'}\`  `,
                  '',
                ].join('\n'));
              }
            }

            writeReadme(itemFolder, itemLines.join('\n'));

            if (dFolder.key === 'actions') {
              const beforeDir = pathLib.join(itemFolder, 'before-formulas');
              mkdirp(beforeDir);
              writeReadme(beforeDir, `# Before Formulas\n\n> BML executed before formulas evaluate for action \`${item.variableName || item.name}\`.`);
              const afterDir = pathLib.join(itemFolder, 'after-formulas');
              mkdirp(afterDir);
              writeReadme(afterDir, `# After Formulas\n\n> BML executed after formulas evaluate for action \`${item.variableName || item.name}\`.`);
            }

            if (dFolder.key === 'attributes') {
              const defaultDir = pathLib.join(itemFolder, 'default');
              mkdirp(defaultDir);
              writeReadme(defaultDir, `# Default Logic\n\n> BML default value calculation for attribute \`${item.variableName || item.name}\`.`);
              const modifyDir = pathLib.join(itemFolder, 'modify');
              mkdirp(modifyDir);
              writeReadme(modifyDir, `# Modify Logic\n\n> BML modify/recalculation logic for attribute \`${item.variableName || item.name}\`.`);
            }

            if (dFolder.key === 'rules') {
              const condDir = pathLib.join(itemFolder, 'rule-condition');
              mkdirp(condDir);
              writeReadme(condDir, `# Rule Condition\n\n> BML condition or criteria for rule \`${item.variableName || item.name}\`.`);
              const compDir = pathLib.join(itemFolder, 'rule-component');
              mkdirp(compDir);
              writeReadme(compDir, `# Rule Component\n\n> BML component or action logic for rule \`${item.variableName || item.name}\`.`);
            }
          }
        }
      }
    } else {
      for (const item of items) {
        const itemFolder = pathLib.join(catDir, sanitizeFolderName(item.variableName || item.name));
        mkdirp(itemFolder);

        const itemLines = [
          `# ${item.name || item.variableName}`,
          '',
          `**Variable Name:** \`${item.variableName || item.name}\`  `,
          `**Process:** \`${name} (${variableName})\`  `,
          `**Resource Type:** \`${item.resourceTypeLabel || item.resourceType || def.key}\`  `,
          `**Category:** \`COMMERCE\`  `,
        ];
        if (item.lastModified) itemLines.push(`**Last Modified:** ${item.lastModified}  `);
        itemLines.push('');
        itemLines.push('> Source: Oracle CPQ Migration REST API');
        itemLines.push(`> \`GET /migrationResources/COMMERCE/${variableName}\``);
        itemLines.push('');

        if (item.children && item.children.length > 0) {
          itemLines.push(`## Children (${item.children.length})`);
          itemLines.push('');
          itemLines.push(formatItems(item.children, 100));
          itemLines.push('');
        }

        writeReadme(itemFolder, itemLines.join('\n'));

        if (def.key === 'actions') {
          const beforeDir = pathLib.join(itemFolder, 'before-formulas');
          mkdirp(beforeDir);
          writeReadme(beforeDir, `# Before Formulas\n\n> BML executed before formulas evaluate for action \`${item.variableName || item.name}\`.`);
          const afterDir = pathLib.join(itemFolder, 'after-formulas');
          mkdirp(afterDir);
          writeReadme(afterDir, `# After Formulas\n\n> BML executed after formulas evaluate for action \`${item.variableName || item.name}\`.`);
        }

        if (def.key === 'data-columns') {
          const defaultDir = pathLib.join(itemFolder, 'default');
          mkdirp(defaultDir);
          writeReadme(defaultDir, `# Default Logic\n\n> BML default value calculation for data column \`${item.variableName || item.name}\`.`);
          const modifyDir = pathLib.join(itemFolder, 'modify');
          mkdirp(modifyDir);
          writeReadme(modifyDir, `# Modify Logic\n\n> BML modify/recalculation logic for data column \`${item.variableName || item.name}\`.`);
        }
      }
    }
  }

  const knownKeys = new Set(standardFolders.map(s => s.key));
  for (const [type, items] of Object.entries(byType)) {
    if (knownKeys.has(type)) continue;
    const folder = type.replace(/_/g, '-');
    const uCatDir = ensureFolder(folder, buildSubfolderReadme(
      name + ' — ' + ((items[0] && items[0].resourceTypeLabel) || folder),
      'COMMERCE', variableName, type, items
    ));
    for (const item of items) {
      const itemFolder = pathLib.join(uCatDir, sanitizeFolderName(item.variableName || item.name));
      mkdirp(itemFolder);
      writeReadme(itemFolder, [
        `# ${item.name || item.variableName}`,
        '',
        `**Variable Name:** \`${item.variableName || item.name}\`  `,
        `**Process:** \`${name} (${variableName})\`  `,
        `**Resource Type:** \`${item.resourceTypeLabel || item.resourceType || type}\`  `,
        '',
      ].join('\n'));
    }
  }
}

function enrichCommerceProcess(siteRoot, processVarName, processItem) {
  const base = getBaseCategoryDir(siteRoot);
  const procDir = pathLib.join(base, 'commerce', processVarName);
  mkdirp(procDir);
  buildCommerceProcessDepth(procDir, processItem);

  const backupDir = pathLib.join(siteRoot, 'backup');
  if (fs.existsSync(backupDir)) {
    const backupProcDir = pathLib.join(backupDir, 'commerce', processVarName);
    mkdirp(backupProcDir);
    replicateStructure(procDir, backupProcDir, 'Backup', 'Local pristine snapshots and rollback restore points prior to edit.', procDir);
  }
}

module.exports = {
  buildCommerceProcessDepth,
  enrichCommerceProcess,
};
