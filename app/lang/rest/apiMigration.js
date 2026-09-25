"use strict";

const { call, normalizeArgs } = require("@/lang/rest/apiCore");

// ==========================================
// MIGRATION PACKAGES
// ==========================================

/**
 * GET /migrationPackages
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
      path: "/migrationPackages",
      method: "GET",
      query,
    },
    tr,
  );
}

/**
 * GET /migrationPackages/{identifier}
 */
async function getMigrationPackage(identifier, transport) {
  const [id, tr] = normalizeArgs(arguments);
  if (!id)
    throw new Error("CPQ-BML: migration package identifier is required.");
  return call(
    {
      path: `/migrationPackages/${encodeURIComponent(id)}`,
      method: "GET",
    },
    tr,
  );
}

/**
 * POST /migrationPackages
 */
async function createMigrationPackage(payload = {}, transport) {
  const [body = {}, tr] = normalizeArgs(arguments);
  return call(
    {
      path: "/migrationPackages",
      method: "POST",
      body,
    },
    tr,
  );
}

/**
 * DELETE /migrationPackages/{identifier}
 */
async function deleteMigrationPackage(identifier, transport) {
  const [id, tr] = normalizeArgs(arguments);
  if (!id)
    throw new Error("CPQ-BML: migration package identifier is required.");
  return call(
    {
      path: `/migrationPackages/${encodeURIComponent(id)}`,
      method: "DELETE",
    },
    tr,
  );
}

/**
 * PATCH /migrationPackages/{identifier}
 */
async function updateMigrationPackage(identifier, payload = {}, transport) {
  const [id, body = {}, tr] = normalizeArgs(arguments);
  if (!id)
    throw new Error("CPQ-BML: migration package identifier is required.");
  return call(
    {
      path: `/migrationPackages/${encodeURIComponent(id)}`,
      method: "PATCH",
      body,
    },
    tr,
  );
}

/**
 * GET /migrationPackages/{identifier}/contents
 */
async function getMigrationPackageContents(
  identifier,
  options = {},
  transport,
) {
  const [id, opts = {}, tr] = normalizeArgs(arguments);
  if (!id)
    throw new Error("CPQ-BML: migration package identifier is required.");
  const query = {};
  if (opts.category) query.category = opts.category;
  return call(
    {
      path: `/migrationPackages/${encodeURIComponent(id)}/contents`,
      method: "GET",
      query,
    },
    tr,
  );
}

/**
 * GET /migrationPackages/{identifier}/contents/{category}
 */
async function getMigrationPackageCategoryContents(
  identifier,
  category,
  transport,
) {
  const [id, cat, tr] = normalizeArgs(arguments);
  if (!id || !cat)
    throw new Error("CPQ-BML: identifier and category are required.");
  return call(
    {
      path: `/migrationPackages/${encodeURIComponent(id)}/contents/${encodeURIComponent(cat)}`,
      method: "GET",
    },
    tr,
  );
}

/**
 * PUT /migrationPackages/{identifier}/contents
 */
async function updateMigrationPackageContents(
  identifier,
  payload = {},
  transport,
) {
  const [id, body = {}, tr] = normalizeArgs(arguments);
  if (!id)
    throw new Error("CPQ-BML: migration package identifier is required.");
  return call(
    {
      path: `/migrationPackages/${encodeURIComponent(id)}/contents`,
      method: "PUT",
      body,
    },
    tr,
  );
}

/**
 * POST /migrationPackages/{identifier}/actions/export
 */
async function exportMigrationPackage(identifier, payload = {}, transport) {
  const [id, body = {}, tr] = normalizeArgs(arguments);
  if (!id)
    throw new Error("CPQ-BML: migration package identifier is required.");
  return call(
    {
      path: `/migrationPackages/${encodeURIComponent(id)}/actions/export`,
      method: "POST",
      body,
    },
    tr,
  );
}

// ==========================================
// MIGRATION RESOURCES
// ==========================================

/**
 * GET /migrationResources
 */
async function listMigrationResources(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const query = {};
  if (opts.q) query.q = opts.q;
  return call(
    {
      path: "/migrationResources",
      method: "GET",
      query,
    },
    tr,
  );
}

/**
 * GET /migrationResources/{category}
 */
async function getMigrationResourceCategory(category, transport) {
  const [cat, tr] = normalizeArgs(arguments);
  if (!cat) throw new Error("CPQ-BML: migration category is required.");
  return call(
    {
      path: `/migrationResources/${encodeURIComponent(cat)}`,
      method: "GET",
    },
    tr,
  );
}

/**
 * GET /migrationResources/{category}/{variableName}
 */
async function getMigrationResourceItem(category, variableName, transport) {
  const [cat, varName, tr] = normalizeArgs(arguments);
  if (!cat || !varName)
    throw new Error("CPQ-BML: category and variableName are required.");
  return call(
    {
      path: `/migrationResources/${encodeURIComponent(cat)}/${encodeURIComponent(varName)}`,
      method: "GET",
    },
    tr,
  );
}

/**
 * POST /migrationResources/dependencies
 */
async function getMigrationResourceDependencies(payload = {}, transport) {
  const [body = {}, tr] = normalizeArgs(arguments);
  return call(
    {
      path: "/migrationResources/dependencies",
      method: "POST",
      body,
    },
    tr,
  );
}

// ==========================================
// MIGRATION TASKS
// ==========================================

/**
 * GET /migrationTasks
 */
async function listMigrationTasks(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { offset = 0, limit = 50, q } = opts;
  const query = { offset, limit };
  if (q) query.q = q;
  return call(
    {
      path: "/migrationTasks",
      method: "GET",
      query,
    },
    tr,
  );
}

/**
 * GET /migrationTasks/{taskId}
 */
async function getMigrationTask(taskId, transport) {
  const [id, tr] = normalizeArgs(arguments);
  if (!id) throw new Error("CPQ-BML: taskId is required.");
  return call(
    {
      path: `/migrationTasks/${encodeURIComponent(id)}`,
      method: "GET",
    },
    tr,
  );
}

/**
 * GET /migrationTasks/{taskId}/categories
 */
async function getMigrationTaskCategories(taskId, transport) {
  const [id, tr] = normalizeArgs(arguments);
  if (!id) throw new Error("CPQ-BML: taskId is required.");
  return call(
    {
      path: `/migrationTasks/${encodeURIComponent(id)}/categories`,
      method: "GET",
    },
    tr,
  );
}

/**
 * POST /migrationTasks/actions/createSnapshot
 */
async function createMigrationSnapshot(payload = {}, transport) {
  const [body = {}, tr] = normalizeArgs(arguments);
  return call(
    {
      path: "/migrationTasks/actions/createSnapshot",
      method: "POST",
      body,
    },
    tr,
  );
}

/**
 * POST /migrationTasks/{taskId}/actions/rollback
 */
async function rollbackMigrationTask(taskId, payload = {}, transport) {
  const [id, body = {}, tr] = normalizeArgs(arguments);
  if (!id) throw new Error("CPQ-BML: taskId is required.");
  return call(
    {
      path: `/migrationTasks/${encodeURIComponent(id)}/actions/rollback`,
      method: "POST",
      body,
    },
    tr,
  );
}

module.exports = {
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
