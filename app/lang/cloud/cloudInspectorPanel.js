'use strict';

const vscodeModule = require('vscode');
const { openVirtualJsonDocument } = require('@/lang/cloud/cloudDocumentProvider');

let currentPanel = null;
let currentItemContext = null;

/**
 * Normalizes item properties from varied explorer node objects.
 * @param {object} rawItem 
 * @returns {object}
 */
function normalizeInspectorPayload(rawItem) {
  const item = rawItem?.data || rawItem?.part || rawItem || {};
  
  let category = rawItem?.category || rawItem?.type || item?.category || item?.type || 'Item';
  // Capitalize or clean category
  if (category === 'action' || rawItem?.itemType === 'action') category = 'Action';
  else if (category === 'integration' || rawItem?.itemType === 'integration') category = 'Integration';
  else if (category === 'attribute' || rawItem?.itemType === 'attribute') category = 'Attribute';
  else if (category === 'transaction' || rawItem?.itemType === 'transaction') category = 'Transaction';
  else if (category === 'part' || rawItem?.itemType === 'part') category = 'Part';
  else if (category === 'dataTable' || rawItem?.itemType === 'dataTable' || category === 'table') category = 'Data Table';
  else if (category === 'library' || rawItem?.itemType === 'function' || category === 'function') category = 'Function';
  else if (category === 'rule' || category === 'bomRule') category = 'Rule';
  else if (category === 'deploymentTask' || category === 'task') category = 'Deployment Task';

  const variableName = item.variableName || item.name || item.partNumber || item.transactionID_t || item.id || item._id || '';
  const label = item.label || item.displayName || item.name || item.partNumber || item.transactionID_t || variableName;
  const title = (label && variableName && label !== variableName) ? `${label} (${variableName})` : (label || variableName || 'CPQ Metadata');
  const type = item.dataType || item.actionType || item.integrationType || item.ruleType || item.type || '';
  const description = item.description || item.desc || '';

  const hasBml = Boolean(
    item.scriptText || item.bmlScript || item.conditionScript || item.actionScript || item.script ||
    (category === 'Action' && (item.bmlScript || item.scriptText || item.hasScript))
  );

  return {
    category,
    title,
    variableName,
    type,
    description,
    data: item,
    hasBml,
    rawItem
  };
}

/**
 * Opens or reveals the CPQ Cloud Property Inspector panel.
 * @param {object} item 
 * @param {vscode.ExtensionContext} [context] 
 * @param {typeof vscodeModule} [vscodeInstance] 
 * @param {Function} [onOpenBml] 
 * @returns {vscode.WebviewPanel}
 */
async function showCloudInspector(item, context, vscodeInstance = vscodeModule, onOpenBml = null) {
  const norm = normalizeInspectorPayload(item);
  currentItemContext = { ...norm, onOpenBml };

  const column = (vscodeInstance?.window?.activeTextEditor)
    ? (vscodeInstance?.ViewColumn?.Beside ?? 2)
    : (vscodeInstance?.ViewColumn?.One ?? 1);

  const { openWebPanel } = require('@/lang/web-panel/webPanelManager');
  const panel = openWebPanel(context, {
    page: 'interactive',
    payload: norm,
    column,
    vscodeInstance,
    onOpenBml
  });
  currentPanel = panel;
  return panel;
}

/**
 * Handles inspecting an explorer item based on user settings (`inspector` vs `virtualDocument`).
 * @param {object} item 
 * @param {vscode.ExtensionContext} context 
 * @param {typeof vscodeModule} vscodeInstance 
 * @param {Function} [onOpenBml] 
 */
async function inspectItemAccordingToPreference(item, context, vscodeInstance = vscodeModule, onOpenBml = null) {
  const config = vscodeInstance.workspace?.getConfiguration?.('cpqBml.cloud');
  const mode = config ? config.get('openMetadataAs', 'inspector') : 'inspector';

  if (mode === 'virtualDocument' || !vscodeInstance.window?.createWebviewPanel) {
    const norm = normalizeInspectorPayload(item);
    return openVirtualJsonDocument(
      norm.category.toLowerCase().replace(/\s+/g, '-'),
      norm.title,
      norm.data,
      vscodeInstance
    );
  }

  return showCloudInspector(item, context, vscodeInstance, onOpenBml);
}

function _resetInspectorPanel() {
  try {
    const { _resetWebPanel } = require('@/lang/web-panel/webPanelManager');
    _resetWebPanel();
  } catch (_) {}
  if (currentPanel) {
    try {
      if (typeof currentPanel.dispose === 'function') currentPanel.dispose();
    } catch (_) {}
  }
  currentPanel = null;
  currentItemContext = null;
}

module.exports = {
  showCloudInspector,
  inspectItemAccordingToPreference,
  normalizeInspectorPayload,
  _resetInspectorPanel
};

