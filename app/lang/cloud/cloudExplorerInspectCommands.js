const { vscode, safeParseJson } = require('@/lang/cloud/cloudVscodeShim');
const { showCloudInspector, normalizeInspectorPayload } = require('@/lang/cloud/cloudInspectorPanel');
const { openVirtualJsonDocument } = require('@/lang/cloud/cloudDocumentProvider');

/**
 * Directly opens the Property Inspector webview for any CPQ cloud item.
 */
async function inspectPropertiesCommand(item, vscodeInstance = vscode, context) {
  const target = item?.data || item?.part || item;
  if (!target) return;
  return showCloudInspector(item, context, vscodeInstance);
}

/**
 * Directly opens the clean, read-only virtual JSON document for any CPQ cloud item.
 */
async function viewRawJsonCommand(item, vscodeInstance = vscode) {
  const target = item?.data || item?.part || item;
  if (!target) return;
  const norm = normalizeInspectorPayload(item);
  return openVirtualJsonDocument(
    norm.category.toLowerCase().replace(/\s+/g, '-'),
    norm.title,
    norm.data,
    vscodeInstance
  );
}

/**
 * Opens the Property Inspector webview for a Commerce Array Set.
 * Ensures all member fields/attributes are fetched from CPQ if not already present.
 */
async function inspectArraySetCommand(item, vscodeInstance = vscode, context) {
  const target = item?.data || item;
  if (!target) return;
  const varName = target.variableName || target.name;
  const process = item.process || target.process || target.commerceProcess || 'oraclecpqo';
  const document = item.docName || target.docName || target.commerceDocument || 'transaction';

  let attrs = target.attributes || [];
  if ((!attrs || attrs.length === 0) && varName) {
    try {
      const api = require('@/lang/rest/apiCommerce');
      if (typeof api.listArraySetAttributes === 'function') {
        const res = await api.listArraySetAttributes(context, vscodeInstance, varName, {
          process,
          document
        });
        const raw = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;
        attrs = Array.isArray(raw) ? raw : ((raw && raw.items) || []);
      }
    } catch (_) {}
  }

  const payload = {
    ...target,
    type: 'arraySet',
    category: 'Array Set',
    variableName: varName,
    commerceProcess: process,
    commerceDocument: document,
    attributes: attrs
  };
  return showCloudInspector({ ...item, data: payload, category: 'Array Set' }, context, vscodeInstance);
}

/**
 * Opens the Architecture Dependency & Blast Radius graph focused on a specific CPQ cloud entity.
 * For Commerce Attributes, queries the live CPQ server endpoint:
 * GET /commerceProcessSetups/{process}/documents/{document}/attributes/{attributeVarName}/references
 * to trace all Rules, Actions, and Integrations referencing this attribute on the server!
 */
async function analyzeBlastRadiusCommand(item, vscodeInstance = vscode, context) {
  const target = item?.data || item;
  if (!target) return;
  const varName = target.variableName || target.name || target.id;
  if (!varName) return;

  const entityType = (item.type === 'attribute' || target.type === 'attribute' || target.dataType)
    ? 'attribute'
    : (item.type === 'arraySet' || target.type === 'arraySet' ? 'arraySet' : (item.type === 'action' || target.actionType ? 'action' : 'attribute'));

  const process = item.process || target.process || target.commerceProcess || 'oraclecpqo';
  const document = item.docName || target.docName || target.commerceDocument || 'transaction';

  const { showEntityDependencyGraph } = require('@/lang/graph/dependencyGraphPanel');
  return showEntityDependencyGraph(context, entityType, varName, { process, document }, vscodeInstance);
}

module.exports = {
  inspectPropertiesCommand,
  viewRawJsonCommand,
  inspectArraySetCommand,
  analyzeBlastRadiusCommand
};
