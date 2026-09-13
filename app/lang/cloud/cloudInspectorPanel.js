'use strict';

const vscodeModule = require('vscode');
const path = require('path');
const fs = require('fs');
const { getInspectorHtml } = require('@/lang/cloud/cloudInspectorHtml');
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

  if (currentPanel) {
    try {
      currentPanel.title = `Inspect: ${norm.title}`;
      const rootPath = context?.extensionPath || path.join(__dirname, '..', '..', '..');
      if (typeof currentPanel.webview?.postMessage === 'function') {
        currentPanel.webview.postMessage({ command: 'setData', payload: norm });
      } else {
        currentPanel.webview.html = getInspectorHtml(norm, currentPanel.webview, rootPath, vscodeInstance);
      }
      currentPanel.reveal(column, true);
      return currentPanel;
    } catch (_) {
      currentPanel = null;
      currentItemContext = null;
    }
  }

  const rootPath = context?.extensionPath || path.join(__dirname, '..', '..', '..');
  const localResourceRoots = [];
  if (vscodeInstance?.Uri?.file) {
    localResourceRoots.push(vscodeInstance.Uri.file(rootPath));
  }

  const panel = vscodeInstance.window.createWebviewPanel(
    'cpqBmlCloudInspector',
    `Inspect: ${norm.title}`,
    { viewColumn: column, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots
    }
  );

  panel.onDidDispose(() => {
    if (currentPanel === panel) {
      currentPanel = null;
      currentItemContext = null;
    }
  });

  currentPanel = panel;

  try {
    if (vscodeInstance?.Uri?.file) {
      const iconUri = vscodeInstance.Uri.file(path.join(rootPath, 'app', 'icons', 'brand', 'logo.png'));
      if (fs.existsSync(iconUri.fsPath)) {
        panel.iconPath = iconUri;
      }
    }

    panel.webview.html = getInspectorHtml(norm, panel.webview, rootPath, vscodeInstance);
  } catch (err) {
    currentPanel = null;
    currentItemContext = null;
    try { panel.dispose(); } catch (_) {}
    throw err;
  }

  panel.webview.onDidReceiveMessage(async (message) => {
    if (!message) return;

    try {
      switch (message.command) {
        case 'copyText':
          if (message.text) {
            if (vscodeInstance.env?.clipboard?.writeText) {
              await vscodeInstance.env.clipboard.writeText(message.text);
            }
            if (vscodeInstance.window && vscodeInstance.window.setStatusBarMessage) {
              vscodeInstance.window.setStatusBarMessage(`CPQ-BML: ${message.label || 'Text'} copied to clipboard`, 3000);
            }
          }
          break;

        case 'insertAtCursor':
          if (message.text) {
            const editor = vscodeInstance.window?.activeTextEditor;
            if (editor && editor.selection) {
              await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, message.text);
              });
            } else if (vscodeInstance.env?.clipboard?.writeText) {
              await vscodeInstance.env.clipboard.writeText(message.text);
              if (vscodeInstance.window?.showInformationMessage) {
                vscodeInstance.window.showInformationMessage(`Copied '${message.text}' to clipboard.`);
              }
            }
          }
          break;

        case 'openRawJson':
          if (currentItemContext) {
            await openVirtualJsonDocument(
              (currentItemContext.category || 'item').toLowerCase().replace(/\s+/g, '-'),
              currentItemContext.title || 'Metadata',
              currentItemContext.data || {},
              vscodeInstance
            );
          }
          break;

        case 'openBmlScript':
          if (currentItemContext && typeof currentItemContext.onOpenBml === 'function') {
            await currentItemContext.onOpenBml(currentItemContext.rawItem);
          } else if (currentItemContext && currentItemContext.category === 'Action') {
            if (vscodeInstance.commands?.executeCommand) {
              vscodeInstance.commands.executeCommand('cpqBml.cloud.openActionBml', currentItemContext.rawItem);
            }
          } else if (currentItemContext && currentItemContext.category === 'Rule') {
            if (vscodeInstance.commands?.executeCommand) {
              vscodeInstance.commands.executeCommand('cpqBml.cloud.openRuleBml', currentItemContext.rawItem);
            }
          }
          break;

        default:
          break;
      }
    } catch {
      // Safe fallback - avoid unhandled rejections from malformed webview messages
    }
  });

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

