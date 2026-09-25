'use strict';

const api = require('@/lang/rest/api');
const { getSettings, getWorkspaceRoot, getCpqSiteName, isConfigured } = require('@/lang/rest/config');
const { generateMigrationFolderStructure } = require('@/lang/rest/migrationStructure');
const { normalizeToolArgs } = require('@/lang/mcp/toolArgs');
const fs = require('fs');
const path = require('path');

function safeParse(val) {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

/**
 * list_migration_resources
 * Fetches all 13 migration resource categories and items directly from CPQ.
 * Credentials and base URL are automatically resolved from configuration.
 */
async function listMigrationResources(options = {}, transport) {
  const { args, transport: tr } = normalizeToolArgs(arguments);
  try {
    if (!isConfigured()) {
      return { success: false, error: 'CPQ connection is not configured in settings.' };
    }
    const res = await api.listMigrationResources(args || {}, tr);
    if (!res || res.statusCode !== 200) {
      return {
        success: false,
        error: `Migration resources request failed with status ${res ? res.statusCode : 'unknown'}.`,
        statusCode: res ? res.statusCode : null,
      };
    }

    const body = safeParse(res.body);
    const items = body.items || [];
    const categories = items.map(cat => ({
      name: cat.name,
      category: cat.category,
      childrenCount: cat.children ? cat.children.length : 0,
      children: (cat.children || []).map(c => ({
        name: c.name,
        variableName: c.variableName,
        resourceType: c.resourceType,
        resourceTypeLabel: c.resourceTypeLabel,
      })),
    }));

    return {
      success: true,
      categoriesCount: categories.length,
      categories,
    };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * list_migration_packages
 * Lists all migration packages available on the target CPQ instance.
 */
async function listMigrationPackages(options = {}, transport) {
  const { args, transport: tr } = normalizeToolArgs(arguments);
  try {
    if (!isConfigured()) {
      return { success: false, error: 'CPQ connection is not configured in settings.' };
    }
    const res = await api.listMigrationPackages(args || {}, tr);
    if (!res || res.statusCode !== 200) {
      return {
        success: false,
        error: `Migration packages request failed with status ${res ? res.statusCode : 'unknown'}.`,
        statusCode: res ? res.statusCode : null,
      };
    }

    const body = safeParse(res.body);
    const packages = (body.items || []).map(p => ({
      name: p.name,
      identifier: p.identifier,
      version: p.version,
      description: p.description || '',
      dateModified: p.dateModified || null,
      sourceSiteUrl: p.sourceSiteUrl || null,
    }));

    return {
      success: true,
      count: packages.length,
      packages,
    };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * get_migration_package_contents
 * Retrieves the contents of a specific migration package.
 */
async function getMigrationPackageContents(options = {}, transport) {
  const { args, transport: tr } = normalizeToolArgs(arguments);
  const identifier = args && args.identifier;
  if (!identifier) {
    return { success: false, error: 'identifier is required.' };
  }

  try {
    if (!isConfigured()) {
      return { success: false, error: 'CPQ connection is not configured in settings.' };
    }
    const res = await api.getMigrationPackageContents(identifier, args || {}, tr);
    if (!res || res.statusCode !== 200) {
      return {
        success: false,
        error: `Failed to get package contents: status ${res ? res.statusCode : 'unknown'}.`,
        statusCode: res ? res.statusCode : null,
      };
    }

    const body = safeParse(res.body);
    return {
      success: true,
      identifier,
      contents: body.items || [],
    };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * sync_migration_structure
 * Builds or refreshes the local cpq/<siteName>/ user space folder structure
 * to match the live Oracle CPQ Migration resource hierarchy.
 */
async function syncMigrationStructure(options = {}, transport) {
  const { args, transport: tr } = normalizeToolArgs(arguments);
  try {
    if (!isConfigured()) {
      return { success: false, error: 'CPQ connection is not configured in settings.' };
    }

    const wsRoot = getWorkspaceRoot();
    if (!wsRoot) {
      return { success: false, error: 'No workspace folder is open.' };
    }

    const settings = getSettings();
    const siteName = getCpqSiteName(settings.siteUrl);

    // Fetch live migration resources
    const resResources = await api.listMigrationResources({}, tr);
    if (!resResources || resResources.statusCode !== 200) {
      return {
        success: false,
        error: `Failed to fetch migration resources (HTTP ${resResources ? resResources.statusCode : 'unknown'}).`,
      };
    }
    const resBody = safeParse(resResources.body);
    const categories = resBody.items || [];

    // Generate folder structure
    const result = generateMigrationFolderStructure(wsRoot, siteName, categories);

    // Optionally fetch and index packages
    let packageCount = 0;
    try {
      const resPackages = await api.listMigrationPackages({ limit: 100 }, tr);
      if (resPackages && resPackages.statusCode === 200) {
        const pkgBody = safeParse(resPackages.body);
        const packages = pkgBody.items || [];
        packageCount = packages.length;
        const pkgDir = path.join(result.siteRoot, 'migration-packages');
        for (const pkg of packages) {
          const pkgFolder = path.join(pkgDir, pkg.identifier);
          if (!fs.existsSync(pkgFolder)) {
            fs.mkdirSync(pkgFolder, { recursive: true });
          }
          fs.writeFileSync(
            path.join(pkgFolder, 'package-info.json'),
            JSON.stringify(pkg, null, 2),
            'utf8'
          );
        }
      }
    } catch {
      // Continue even if package listing is partial
    }

    return {
      success: true,
      siteName,
      siteRoot: result.siteRoot,
      manifestPath: result.manifestPath,
      categoriesCount: categories.length,
      packagesCount: packageCount,
      categories: categories.map(c => ({
        name: c.name,
        category: c.category,
        count: c.children ? c.children.length : 0,
      })),
    };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

module.exports = {
  listMigrationResources,
  listMigrationPackages,
  getMigrationPackageContents,
  syncMigrationStructure,
};
