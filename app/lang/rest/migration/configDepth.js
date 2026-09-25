'use strict';

const fs = require('fs');
const pathLib = require('path');
const {
  CONFIG_CHILD_FOLDER,
  mkdirp,
  writeReadme,
  sanitizeFolderName,
  buildItemReadme,
  buildSubfolderReadme,
  getBaseCategoryDir,
} = require('@/lang/rest/migration/constants');
const { replicateStructure } = require('@/lang/rest/migration/replication');

function buildConfigFamilyDepth(familyDir, familyItem) {
  const { variableName, name, children = [], productLines = [] } = familyItem;

  writeReadme(familyDir, buildItemReadme('CONFIGURATION', familyItem));

  const byType = {};
  for (const c of children) {
    const t = c.resourceType || 'other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(c);
  }

  const hasRules = Object.keys(byType).some(t => t.startsWith('rule_'));
  if (hasRules) {
    const rulesDir = pathLib.join(familyDir, 'rules');
    mkdirp(rulesDir);
    writeReadme(rulesDir, [
      `# ${name || variableName} — Configuration Rules`,
      '',
      `**Product Family:** \`${variableName}\`  `,
      `**Category:** \`CONFIGURATION\`  `,
      '',
      '> Configuration rules define recommendations, constraints, hiding, recommended items, and flows.',
      '',
    ].join('\n'));
  }

  for (const [type, items] of Object.entries(byType)) {
    const rel = CONFIG_CHILD_FOLDER[type] || `other/${type.replace(/_/g, '-')}`;
    if (rel === '.') continue;

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

    for (const item of items) {
      const itemFolder = pathLib.join(subDir, sanitizeFolderName(item.variableName || item.name));
      mkdirp(itemFolder);

      const itemLines = [
        `# ${item.name || item.variableName}`,
        '',
        `**Variable Name:** \`${item.variableName || item.name}\`  `,
        `**Product Family:** \`${name || variableName} (${variableName})\`  `,
        `**Resource Type:** \`${item.resourceTypeLabel || item.resourceType || type}\`  `,
        `**Category:** \`CONFIGURATION\`  `,
      ];
      if (item.lastModified) itemLines.push(`**Last Modified:** ${item.lastModified}  `);
      itemLines.push('');
      itemLines.push('> Source: Oracle CPQ Migration REST API');
      itemLines.push(`> \`GET /migrationResources/CONFIGURATION/${variableName}\``);
      itemLines.push('');

      writeReadme(itemFolder, itemLines.join('\n'));

      if (type === 'attribute') {
        const defaultDir = pathLib.join(itemFolder, 'default');
        mkdirp(defaultDir);
        writeReadme(defaultDir, `# Default Logic\n\n> Default logic for attribute \`${item.variableName || item.name}\`.`);

        const modifyDir = pathLib.join(itemFolder, 'modify');
        mkdirp(modifyDir);
        writeReadme(modifyDir, `# Modify Logic\n\n> Modify/recalculation logic for attribute \`${item.variableName || item.name}\`.`);
      }

      if (type.startsWith('rule_')) {
        const condDir = pathLib.join(itemFolder, 'rule-condition');
        mkdirp(condDir);
        writeReadme(condDir, `# Rule Condition\n\n> Condition and criteria for rule \`${item.variableName || item.name}\`.`);

        const compDir = pathLib.join(itemFolder, 'rule-component');
        mkdirp(compDir);
        writeReadme(compDir, `# Rule Component\n\n> Action and component logic for rule \`${item.variableName || item.name}\`.`);
      }
    }
  }

  const modelsDir = pathLib.join(familyDir, 'models');
  mkdirp(modelsDir);

  const linesToRender = productLines.length > 0 ? productLines : (familyItem.lines || []);
  const modelsReadmeLines = [
    `# ${name || variableName} — Product Lines & Models`,
    '',
    `**Product Family:** \`${variableName}\`  `,
    `**Category:** \`CONFIGURATION\` / \`CATALOG\`  `,
    '',
    '> Product Lines and Models belonging to this Product Family.',
    '',
  ];

  if (linesToRender.length > 0) {
    modelsReadmeLines.push('## Product Lines');
    modelsReadmeLines.push('');
    for (const pl of linesToRender) {
      const modelCount = (pl.models || []).length;
      modelsReadmeLines.push(`- **[${pl.name || pl.variableName}](./${sanitizeFolderName(pl.variableName)}/)** (${modelCount} models)`);
    }
    modelsReadmeLines.push('');
    writeReadme(modelsDir, modelsReadmeLines.join('\n'));

    for (const pl of linesToRender) {
      const plDir = pathLib.join(modelsDir, sanitizeFolderName(pl.variableName || pl.name));
      mkdirp(plDir);

      const plLines = [
        `# Product Line: ${pl.name || pl.variableName}`,
        '',
        `**Variable Name:** \`${pl.variableName}\`  `,
        `**Product Family:** \`${variableName}\`  `,
        `**Models Count:** ${(pl.models || []).length}`,
        '',
        '## Models',
        '',
      ];
      for (const m of (pl.models || [])) {
        plLines.push(`- **[${m.name || m.variableName}](./${sanitizeFolderName(m.variableName)}/)**`);
      }
      plLines.push('');
      writeReadme(plDir, plLines.join('\n'));

      for (const m of (pl.models || [])) {
        const mDir = pathLib.join(plDir, sanitizeFolderName(m.variableName || m.name));
        mkdirp(mDir);

        writeReadme(mDir, [
          `# Model: ${m.name || m.variableName}`,
          '',
          `**Variable Name:** \`${m.variableName}\`  `,
          `**Product Line:** \`${pl.variableName}\`  `,
          `**Product Family:** \`${variableName}\`  `,
          '',
          '## Sub-resources',
          '- [Attributes](./attributes/)',
          '- [Rules](./rules/)',
          '- [Layouts](./layouts/)',
          '',
        ].join('\n'));

        const mAttrDir = pathLib.join(mDir, 'attributes');
        mkdirp(mAttrDir);
        writeReadme(mAttrDir, `# Model Attributes: ${m.name || m.variableName}\n\n> Model-level configuration attributes.`);

        const mRuleDir = pathLib.join(mDir, 'rules');
        mkdirp(mRuleDir);
        writeReadme(mRuleDir, `# Model Rules: ${m.name || m.variableName}\n\n> Model-level configuration rules.`);

        const mLayoutDir = pathLib.join(mDir, 'layouts');
        mkdirp(mLayoutDir);
        writeReadme(mLayoutDir, `# Model Layouts: ${m.name || m.variableName}\n\n> Model configuration layout templates.`);
      }
    }
  } else {
    modelsReadmeLines.push('## Product Lines');
    modelsReadmeLines.push('');
    modelsReadmeLines.push('_None or not discovered._');
    modelsReadmeLines.push('');
    writeReadme(modelsDir, modelsReadmeLines.join('\n'));
  }
}

function buildDataTableFolderDepth(folderDir, folderItem) {
  const { variableName, children = [] } = folderItem;

  writeReadme(folderDir, buildItemReadme('DATA_TABLE', folderItem));

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

function enrichConfigFamily(siteRoot, familyVarName, familyItem) {
  const base = getBaseCategoryDir(siteRoot);
  const famDir = pathLib.join(base, 'configuration', familyVarName);
  mkdirp(famDir);
  buildConfigFamilyDepth(famDir, familyItem);

  const backupDir = pathLib.join(siteRoot, 'backup');
  if (fs.existsSync(backupDir)) {
    const backupFamDir = pathLib.join(backupDir, 'configuration', familyVarName);
    mkdirp(backupFamDir);
    replicateStructure(famDir, backupFamDir, 'Backup', 'Local pristine snapshots and rollback restore points prior to edit.', famDir);
  }
}

function enrichDataTableFolder(siteRoot, folderVarName, folderItem) {
  const base = getBaseCategoryDir(siteRoot);
  const folderDir = pathLib.join(base, 'data-tables', folderVarName);
  mkdirp(folderDir);
  buildDataTableFolderDepth(folderDir, folderItem);

  const backupDir = pathLib.join(siteRoot, 'backup');
  if (fs.existsSync(backupDir)) {
    const backupFolderDir = pathLib.join(backupDir, 'data-tables', folderVarName);
    mkdirp(backupFolderDir);
    replicateStructure(folderDir, backupFolderDir, 'Backup', 'Local pristine snapshots and rollback restore points prior to edit.', folderDir);
  }
}

module.exports = {
  buildConfigFamilyDepth,
  buildDataTableFolderDepth,
  enrichConfigFamily,
  enrichDataTableFolder,
};
