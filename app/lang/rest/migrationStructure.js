'use strict';

const fs = require('fs');
const pathLib = require('path');
const {
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
} = require('@/lang/rest/migration/constants');

const { replicateStructure } = require('@/lang/rest/migration/replication');
const { buildCommerceProcessDepth, enrichCommerceProcess } = require('@/lang/rest/migration/commerceDepth');
const {
  buildConfigFamilyDepth,
  buildDataTableFolderDepth,
  enrichConfigFamily,
  enrichDataTableFolder,
} = require('@/lang/rest/migration/configDepth');

/**
 * Builds the full hierarchical user space cpq/ folder structure mirroring
 * the Oracle CPQ Migration API taxonomy, with per-folder README.md files
 * containing the REST response details.
 *
 * @param {string} workspaceRoot Absolute path to workspace root
 * @param {string} siteName CPQ site name string (e.g. "cpq-mysite")
 * @param {Array} migrationCategories Array of category objects from /migrationResources
 * @param {number} [packageCount=0] Number of migration packages for site README
 * @returns {{ success, siteRoot, manifestPath, manifest }}
 */
function generateMigrationFolderStructure(workspaceRoot, siteName, migrationCategories = [], packageCount = 0) {
  if (!workspaceRoot) throw new Error('workspaceRoot is required.');

  const site = getCpqSiteName(siteName);
  const siteRoot = pathLib.join(workspaceRoot, 'cpq', site);
  mkdirp(siteRoot);

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

    writeReadme(catDir, buildCategoryReadme(catCode, cat, children));

    if (catCode === 'UTIL_LIBRARY') {
      for (const fn of children) {
        if (!fn.variableName) continue;
        const fnDir = pathLib.join(catDir, fn.variableName);
        mkdirp(fnDir);
        writeReadme(fnDir, buildItemReadme('UTIL_LIBRARY', fn));
      }
    } else if (catCode === 'COMMERCE') {
      for (const proc of children) {
        if (!proc.variableName) continue;
        const procDir = pathLib.join(catDir, proc.variableName);
        mkdirp(procDir);
        buildCommerceProcessDepth(procDir, proc);
      }
    } else if (catCode === 'PRODUCT_DEFINITION') {
      for (const fam of children) {
        if (!fam.variableName) continue;
        const famDir = pathLib.join(modifyDir, 'configuration', fam.variableName);
        mkdirp(famDir);
        const readmePath = pathLib.join(famDir, 'README.md');
        if (!fs.existsSync(readmePath)) {
          writeReadme(famDir, buildItemReadme('PRODUCT_DEFINITION', fam));
        }
      }
    } else if (catCode === 'CONFIGURATION') {
      for (const fam of children) {
        if (!fam.variableName) continue;
        const famDir = pathLib.join(modifyDir, 'configuration', fam.variableName);
        mkdirp(famDir);
        buildConfigFamilyDepth(famDir, fam);
      }
    } else if (catCode === 'CATALOG') {
      for (const line of children) {
        if (!line.variableName) continue;
        const lineDir = pathLib.join(catDir, line.variableName);
        mkdirp(lineDir);
        writeReadme(lineDir, buildItemReadme('CATALOG', line));
      }
    } else if (catCode === 'DATA_TABLE') {
      for (const folder of children) {
        if (!folder.variableName) continue;
        const folderDir = pathLib.join(catDir, folder.variableName);
        mkdirp(folderDir);
        buildDataTableFolderDepth(folderDir, folder);
      }
    } else if (catCode === 'DOCUMENT_ENGINE' || catCode === 'DOCUMENT_DESIGNER' || catCode === 'EMAIL_DESIGNER') {
      for (const set of children) {
        if (!set.variableName) continue;
        const setDir = pathLib.join(catDir, set.variableName);
        mkdirp(setDir);
        writeReadme(setDir, buildItemReadme(catCode, set));
      }
    } else if (catCode === 'FILE_MANAGER') {
      for (const folder of children) {
        if (!folder.variableName) continue;
        const folderDir = pathLib.join(catDir, folder.variableName);
        mkdirp(folderDir);
        writeReadme(folderDir, buildItemReadme('FILE_MANAGER', folder));
      }
    } else if (catCode === 'ELIGIBILITY_RULE') {
      for (const rule of children) {
        if (!rule.variableName) continue;
        const ruleDir = pathLib.join(catDir, rule.variableName);
        mkdirp(ruleDir);
        writeReadme(ruleDir, buildItemReadme('ELIGIBILITY_RULE', rule));
      }
    } else if (catCode === 'PART_CUSTOM_FIELD') {
      for (const field of children) {
        if (!field.variableName) continue;
        const fieldDir = pathLib.join(catDir, field.variableName);
        mkdirp(fieldDir);
        writeReadme(fieldDir, buildItemReadme('PART_CUSTOM_FIELD', field));
      }
    } else if (catCode === 'PRICING') {
      for (const pricing of children) {
        if (!pricing.variableName) continue;
        const pDir = pathLib.join(catDir, pricing.variableName);
        mkdirp(pDir);
        writeReadme(pDir, buildItemReadme('PRICING', pricing));
      }
    }
  }

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
