'use strict';

const {
  call,
  normalizeArgs,
} = require('@/lang/rest/apiCore');

const MIGRATION_REST_VERSION = 'v19';

/**
 * Helper to build migration path with v19 version prefix.
 */
function migrationPath(subPath) {
  const clean = (subPath || '').startsWith('/') ? subPath : `/${subPath}`;
  return `/rest/${MIGRATION_REST_VERSION}${clean}`;
}

// ==========================================
// MIGRATION PACKAGES
// ==========================================

/**
 * GET /rest/v19/migrationPackages
 * Retrieves a list of migration packages with optional query filters and ordering.
 */
async function listMigrationPackages(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { q, fields, orderby, expand, offset = 0, limit = 100 } = opts;
  const query = { offset, limit };
  if (q) query.q = q;
  if (fields) query.fields = fields;
  if (orderby) query.orderby = orderby;
  if (expand) query.expand = expand;

  return call(
    {
      path: migrationPath('/migrationPackages'),
      method: 'GET',
      query,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * GET /rest/v19/migrationPackages/{identifier}
 * Retrieves single migration package metadata.
 */
async function getMigrationPackage(identifier, transport) {
  const [id, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: migration package identifier is required.');
  return call(
    {
      path: migrationPath(`/migrationPackages/${encodeURIComponent(id)}`),
      method: 'GET',
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * POST /rest/v19/migrationPackages
 * Creates a new migration package.
 */
async function createMigrationPackage(payload = {}, transport) {
  const [body = {}, tr] = normalizeArgs(arguments);
  return call(
    {
      path: migrationPath('/migrationPackages'),
      method: 'POST',
      body,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * DELETE /rest/v19/migrationPackages/{identifier}
 * Deletes a migration package.
 */
async function deleteMigrationPackage(identifier, transport) {
  const [id, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: migration package identifier is required.');
  return call(
    {
      path: migrationPath(`/migrationPackages/${encodeURIComponent(id)}`),
      method: 'DELETE',
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * PATCH /rest/v19/migrationPackages/{identifier}
 * Updates migration package metadata.
 */
async function updateMigrationPackage(identifier, payload = {}, transport) {
  const [id, body = {}, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: migration package identifier is required.');
  return call(
    {
      path: migrationPath(`/migrationPackages/${encodeURIComponent(id)}`),
      method: 'PATCH',
      body,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * GET /rest/v19/migrationPackages/{identifier}/contents
 * Retrieves contents of a migration package.
 */
async function getMigrationPackageContents(identifier, options = {}, transport) {
  const [id, opts = {}, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: migration package identifier is required.');
  const query = {};
  if (opts.category) query.category = opts.category;
  return call(
    {
      path: migrationPath(`/migrationPackages/${encodeURIComponent(id)}/contents`),
      method: 'GET',
      query,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * GET /rest/v19/migrationPackages/{identifier}/contents/{category}
 * Retrieves category-specific items inside a package.
 */
async function getMigrationPackageCategoryContents(identifier, category, transport) {
  const [id, cat, tr] = normalizeArgs(arguments);
  if (!id || !cat) throw new Error('CPQ-BML: identifier and category are required.');
  return call(
    {
      path: migrationPath(`/migrationPackages/${encodeURIComponent(id)}/contents/${encodeURIComponent(cat)}`),
      method: 'GET',
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * PUT /rest/v19/migrationPackages/{identifier}/contents
 * Adds or updates contents within a package.
 */
async function updateMigrationPackageContents(identifier, payload = {}, transport) {
  const [id, body = {}, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: migration package identifier is required.');
  return call(
    {
      path: migrationPath(`/migrationPackages/${encodeURIComponent(id)}/contents`),
      method: 'PUT',
      body,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * POST /rest/v19/migrationPackages/{identifier}/actions/export
 * Triggers package export task on CPQ.
 */
async function exportMigrationPackage(identifier, payload = {}, transport) {
  const [id, body = {}, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: migration package identifier is required.');
  return call(
    {
      path: migrationPath(`/migrationPackages/${encodeURIComponent(id)}/actions/export`),
      method: 'POST',
      body,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

// ==========================================
// MIGRATION RESOURCES (Full Site Hierarchy)
// ==========================================

/**
 * GET /rest/v19/migrationResources
 * Retrieves all migration resources grouped by categories across the instance.
 */
async function listMigrationResources(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const query = {};
  if (opts.q) query.q = opts.q;
  return call(
    {
      path: migrationPath('/migrationResources'),
      method: 'GET',
      query,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * GET /rest/v19/migrationResources/{category}
 * Retrieves resources belonging to a specific category (e.g. UTIL_LIBRARY, COMMERCE, DATA_TABLE).
 */
async function getMigrationResourceCategory(category, transport) {
  const [cat, tr] = normalizeArgs(arguments);
  if (!cat) throw new Error('CPQ-BML: migration category is required.');
  return call(
    {
      path: migrationPath(`/migrationResources/${encodeURIComponent(cat)}`),
      method: 'GET',
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * GET /rest/v19/migrationResources/{category}/{variableName}
 * Retrieves granular migration resource metadata and children.
 */
async function getMigrationResourceItem(category, variableName, transport) {
  const [cat, varName, tr] = normalizeArgs(arguments);
  if (!cat || !varName) throw new Error('CPQ-BML: category and variableName are required.');
  return call(
    {
      path: migrationPath(`/migrationResources/${encodeURIComponent(cat)}/${encodeURIComponent(varName)}`),
      method: 'GET',
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * POST /rest/v19/migrationResources/dependencies
 * Calculates dependencies for the specified resources before migration.
 */
async function getMigrationResourceDependencies(payload = {}, transport) {
  const [body = {}, tr] = normalizeArgs(arguments);
  return call(
    {
      path: migrationPath('/migrationResources/dependencies'),
      method: 'POST',
      body,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

// ==========================================
// MIGRATION TASKS
// ==========================================

/**
 * GET /rest/v19/migrationTasks
 * Lists migration tasks (exports, imports, migrations).
 */
async function listMigrationTasks(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { offset = 0, limit = 50, q } = opts;
  const query = { offset, limit };
  if (q) query.q = q;
  return call(
    {
      path: migrationPath('/migrationTasks'),
      method: 'GET',
      query,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * GET /rest/v19/migrationTasks/{taskId}
 * Retrieves status and details of a specific migration task.
 */
async function getMigrationTask(taskId, transport) {
  const [id, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: taskId is required.');
  return call(
    {
      path: migrationPath(`/migrationTasks/${encodeURIComponent(id)}`),
      method: 'GET',
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * GET /rest/v19/migrationTasks/{taskId}/categories
 * Retrieves categories involved in a migration task.
 */
async function getMigrationTaskCategories(taskId, transport) {
  const [id, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: taskId is required.');
  return call(
    {
      path: migrationPath(`/migrationTasks/${encodeURIComponent(id)}/categories`),
      method: 'GET',
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * POST /rest/v19/migrationTasks/actions/createSnapshot
 * Creates a system snapshot task.
 */
async function createMigrationSnapshot(payload = {}, transport) {
  const [body = {}, tr] = normalizeArgs(arguments);
  return call(
    {
      path: migrationPath('/migrationTasks/actions/createSnapshot'),
      method: 'POST',
      body,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

/**
 * POST /rest/v19/migrationTasks/{taskId}/actions/rollback
 * Rolls back a completed or failed migration task.
 */
async function rollbackMigrationTask(taskId, payload = {}, transport) {
  const [id, body = {}, tr] = normalizeArgs(arguments);
  if (!id) throw new Error('CPQ-BML: taskId is required.');
  return call(
    {
      path: migrationPath(`/migrationTasks/${encodeURIComponent(id)}/actions/rollback`),
      method: 'POST',
      body,
      version: MIGRATION_REST_VERSION,
    },
    tr
  );
}

module.exports = {
  MIGRATION_REST_VERSION,
  listMigrationPackages,
  getMigrationPackage,
  createMigrationPackage,
  deleteMigrationPackage,
  updateMigrationPackage,
  getMigrationPackageContents,
  getMigrationPackageCategoryContents,
  updateMigrationPackageContents,
  exportMigrationPackage,
  listMigrationResources,
  getMigrationResourceCategory,
  getMigrationResourceItem,
  getMigrationResourceDependencies,
  listMigrationTasks,
  getMigrationTask,
  getMigrationTaskCategories,
  createMigrationSnapshot,
  rollbackMigrationTask,
};
