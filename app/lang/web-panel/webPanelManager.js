'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let vscodeModule;
try {
  vscodeModule = require('vscode');
} catch (_) {}

let primaryPanel = null;
const panelsByPage = {
  settings: null,
  graph: null,
  interactive: null
};
let currentInspectorContext = null;

function getNonce() {
  return crypto.randomBytes(16).toString('base64');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildCsp(nonce, cspSource) {
  return [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `style-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');
}

function getTitleForPage(page, payload) {
  if (page === 'graph') {
    const name = payload?.targetName || (payload?.targetFilePath ? path.basename(payload.targetFilePath, '.bml') : '');
    return name ? `Blast Radius: ${name}` : 'CPQ Dependency Graph';
  }
  if (page === 'interactive') {
    return payload?.title ? `Inspect: ${payload.title}` : 'CPQ Cloud Inspector';
  }
  return 'CPQ-BML Settings';
}

function getWebPanelHtml(context, webview, options = {}, vscodeInstance = vscodeModule) {
  const { page = 'settings', graphModel = null, inspectorData = null } = options;
  const rootPath = context?.extensionPath || path.join(__dirname, '..', '..', '..');
  const webviewRoot = path.join(rootPath, 'app', 'lang', 'web-panel');

  const templatePath = path.join(webviewRoot, 'index.html');
  const template = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf8')
    : '<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="{{csp}}"></head><body><div id="root"></div></body></html>';

  const toFileUri = (filePath) => {
    if (vscodeInstance?.Uri?.file && webview?.asWebviewUri) {
      const u = vscodeInstance.Uri.file(filePath);
      if (u && !u.path) {
        u.path = filePath.replace(/\\/g, '/');
      }
      return webview.asWebviewUri(u).toString();
    }
    return filePath.replace(/\\/g, '/');
  };

  const toUri = (subPath) => toFileUri(path.join(webviewRoot, subPath));

  const nonce = getNonce();
  const cspSource = webview?.cspSource || "'self'";
  const csp = buildCsp(nonce, cspSource);

  const styleUri = toFileUri(path.join(rootPath, 'dist', 'web-panel', 'main.css'));
  const shellStyleUri = toUri(path.join('css', 'shell.css'));
  const layoutStyleUri = toUri(path.join('css', 'settings-layout.css'));
  const componentsStyleUri = toUri(path.join('css', 'settings-components.css'));
  const settingsStyleUri = toUri(path.join('css', 'settings-main.css'));
  const graphStyleUri = toUri(path.join('css', 'graph.css'));
  const inspectorStyleUri = toUri(path.join('css', 'inspector.css'));
  const scriptUri = toFileUri(path.join(rootPath, 'dist', 'web-panel', 'main.js'));

  let initialGraphJson = 'null';
  if (graphModel) {
    try {
      initialGraphJson = JSON.stringify(graphModel).replace(/</g, '\\u003c');
    } catch (_) {
      initialGraphJson = 'null';
    }
  }

  let initialInspectorJson = 'null';
  if (inspectorData) {
    try {
      initialInspectorJson = JSON.stringify(inspectorData).replace(/</g, '\\u003c');
    } catch (_) {
      initialInspectorJson = '{}';
    }
  }

  return template
    .replace(/\{\{csp\}\}/g, csp)
    .replace(/\{\{nonce\}\}/g, nonce)
    .replace(/\{\{styleUri\}\}/g, styleUri)
    .replace(/\{\{shellStyleUri\}\}/g, shellStyleUri)
    .replace(/\{\{layoutStyleUri\}\}/g, layoutStyleUri)
    .replace(/\{\{componentsStyleUri\}\}/g, componentsStyleUri)
    .replace(/\{\{settingsStyleUri\}\}/g, settingsStyleUri)
    .replace(/\{\{graphStyleUri\}\}/g, graphStyleUri)
    .replace(/\{\{inspectorStyleUri\}\}/g, inspectorStyleUri)
    .replace(/\{\{scriptUri\}\}/g, scriptUri)
    .replace(/\{\{initialPage\}\}/g, page)
    .replace(/\{\{initialGraphModel\}\}/g, initialGraphJson)
    .replace(/\{\{initialInspectorData\}\}/g, initialInspectorJson);
}

function getInspectorHtml(payload = {}, webview = null, extensionPath = null, vscodeInstance = vscodeModule) {
  const safePayload = payload || {};
  const context = { extensionPath: extensionPath || path.join(__dirname, '..', '..', '..') };
  const html = getWebPanelHtml(context, webview, { page: 'interactive', inspectorData: safePayload }, vscodeInstance);

  const initialMarkup = `
    <div class="inspector-container">
      <div class="header">
        <span class="badge">${escapeHtml(safePayload.category || 'Item')}</span>
        <h1>${escapeHtml(safePayload.title || 'CPQ Metadata')}</h1>
        ${safePayload.variableName ? `<span class="subtitle">${escapeHtml(safePayload.variableName)}</span>` : ''}
        ${safePayload.description ? `<p>${escapeHtml(safePayload.description)}</p>` : ''}
        ${safePayload.hasBml ? '<button class="primary">Open BML Script</button>' : ''}
      </div>
    </div>
  `.trim();

  return html.replace(/<div id="root">.*?<\/div>/s, `<div id="root">${initialMarkup}</div>`);
}

async function dispatchMessage(message, context, vscodeInstance, panel) {
  if (!message) return;

  if (message.command === 'openInNewTab') {
    openWebPanel(context, {
      page: message.page || 'settings',
      payload: message.payload,
      separateTab: true,
      column: vscodeInstance.ViewColumn.Beside,
      vscodeInstance
    });
    return;
  }

  if (message.command === 'panelReady' || message.command === 'ready') {
    return;
  }

  if (message.command === 'pageChanged') {
    if (panel && !panel.isDetached) {
      panel.title = getTitleForPage(message.page);
    }
    return;
  }

  // Handle Graph messages
  if (message.command === 'refresh') {
    const activeTarget = panel?.activeTargetFile;
    if (activeTarget) {
      try {
        const { updatePanelModel } = require('@/lang/graph/dependencyGraphPanel');
        await updatePanelModel(panel, activeTarget);
      } catch (_) {}
    }
    return;
  }

  if (message.command === 'switchTarget' && message.filePath) {
    if (fs.existsSync(message.filePath)) {
      try {
        const { updatePanelModel } = require('@/lang/graph/dependencyGraphPanel');
        panel.activeTargetFile = message.filePath;
        panel.title = getTitleForPage('graph', { targetFilePath: message.filePath });
        await updatePanelModel(panel, message.filePath);
      } catch (_) {}
    }
    return;
  }

  if (message.command === 'graphEntity' && message.entityType && message.entityName) {
    try {
      const { updatePanelEntityModel } = require('@/lang/graph/dependencyGraphPanel');
      panel.title = `CPQ Graph: ${message.entityName}`;
      await updatePanelEntityModel(panel, message.entityType, message.entityName);
    } catch (_) {}
    return;
  }

  if (message.command === 'searchEntities' && typeof message.query === 'string') {
    try {
      const { handleSearchEntities } = require('@/lang/graph/dependencyGraphPanel');
      await handleSearchEntities(panel, message.query);
    } catch (_) {}
    return;
  }

  if (message.command === 'openFile' && message.filePath) {
    if (fs.existsSync(message.filePath)) {
      const doc = await vscodeInstance.workspace.openTextDocument(message.filePath);
      const line = Math.max(0, message.line || 0);
      await vscodeInstance.window.showTextDocument(doc, {
        viewColumn: vscodeInstance.ViewColumn.Beside,
        selection: new vscodeInstance.Range(line, 0, line, 0)
      });
    }
    return;
  }

  if (message.command === 'exportMermaid') {
    try {
      const { exportToMermaid, generateDependencyModel } = require('@/lang/graph/dependencyGraphAnalyzer');
      const activeTarget = panel?.activeTargetFile;
      if (activeTarget && fs.existsSync(activeTarget)) {
        const content = fs.readFileSync(activeTarget, 'utf8');
        const model = generateDependencyModel(activeTarget, [{ filePath: activeTarget, content }], content);
        const mermaidCode = exportToMermaid(model);
        if (vscodeInstance.env?.clipboard?.writeText) {
          await vscodeInstance.env.clipboard.writeText(mermaidCode);
          vscodeInstance.window.showInformationMessage('Mermaid diagram markdown copied to clipboard!');
        }
      }
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to export Mermaid: ${err.message}`);
    }
    return;
  }

  // Handle Inspector messages
  if (message.command === 'copyText' && message.text) {
    if (vscodeInstance.env?.clipboard?.writeText) {
      await vscodeInstance.env.clipboard.writeText(message.text);
    }
    if (vscodeInstance.window?.setStatusBarMessage) {
      vscodeInstance.window.setStatusBarMessage(`CPQ-BML: ${message.label || 'Text'} copied to clipboard`, 3000);
    }
    return;
  }

  if (message.command === 'insertAtCursor' && message.text) {
    const editor = vscodeInstance.window?.activeTextEditor;
    if (editor && editor.selection) {
      await editor.edit((builder) => builder.insert(editor.selection.active, message.text));
    } else if (vscodeInstance.env?.clipboard?.writeText) {
      await vscodeInstance.env.clipboard.writeText(message.text);
      if (vscodeInstance.window?.showInformationMessage) {
        vscodeInstance.window.showInformationMessage(`Copied '${message.text}' to clipboard.`);
      }
    }
    return;
  }

  if (message.command === 'openRawJson') {
    if (currentInspectorContext) {
      const { openVirtualJsonDocument } = require('@/lang/cloud/cloudDocumentProvider');
      await openVirtualJsonDocument(
        (currentInspectorContext.category || 'item').toLowerCase().replace(/\s+/g, '-'),
        currentInspectorContext.title || 'Metadata',
        currentInspectorContext.data || {},
        vscodeInstance
      );
    }
    return;
  }

  if (message.command === 'openBmlScript') {
    if (currentInspectorContext && typeof currentInspectorContext.onOpenBml === 'function') {
      await currentInspectorContext.onOpenBml(currentInspectorContext.rawItem);
    }
    return;
  }

  // If message has command, it was intended for web-panel shell / graph / inspector
  if (message.command) {
    return;
  }

  // Handle Settings messages (messages with type)
  if (message.type) {
    try {
      const { handleMessage } = require('@/lang/settings/messageHandler');
      await handleMessage(message, context, vscodeInstance, panel);
    } catch (_) {}
  }
}

function openWebPanel(context, options = {}) {
  const {
    page = 'settings',
    payload = null,
    column = null,
    separateTab = false,
    vscodeInstance = vscodeModule,
    onOpenBml = null
  } = options;

  if (page === 'interactive' && payload) {
    currentInspectorContext = { ...payload, onOpenBml };
  }

  const targetColumn = column || (vscodeInstance?.window?.activeTextEditor
    ? vscodeInstance.ViewColumn.Active
    : (vscodeInstance?.ViewColumn?.One || 1));

  // If reusing the panel for this specific page
  const existingPanel = panelsByPage[page];
  if (!separateTab && existingPanel) {
    try {
      existingPanel.title = getTitleForPage(page, payload);
      existingPanel.reveal(targetColumn);

      if (page === 'graph') {
        existingPanel.activeTargetFile = payload?.targetFilePath || existingPanel.activeTargetFile;
        existingPanel.webview.postMessage({ type: 'updateGraph', model: payload?.model || payload, autoFocus: true });
      } else if (page === 'interactive') {
        existingPanel.webview.postMessage({ command: 'setData', payload, autoFocus: true });
      } else if (page === 'settings') {
        if (payload?.tab) {
          existingPanel.webview.postMessage({ type: 'switchTab', tab: payload.tab });
        }
      }
      return existingPanel;
    } catch (_) {
      panelsByPage[page] = null;
    }
  }

  const rootPath = context?.extensionPath || path.join(__dirname, '..', '..', '..');
  const localResourceRoots = [];
  if (vscodeInstance?.Uri?.file) {
    localResourceRoots.push(vscodeInstance.Uri.file(rootPath));
  }

  const title = getTitleForPage(page, payload);
  const viewType = 'cpqBmlWebPanel';

  const panel = vscodeInstance.window.createWebviewPanel(
    viewType,
    title,
    { viewColumn: targetColumn, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots
    }
  );

  panel.isDetached = !!separateTab;
  if (!separateTab) {
    panelsByPage[page] = panel;
    primaryPanel = panel;
  }

  if (vscodeInstance?.Uri?.joinPath && context?.extensionUri) {
    try {
      panel.iconPath = vscodeInstance.Uri.joinPath(context.extensionUri, 'app', 'icons', 'logo.svg');
    } catch (_) {}
  }

  if (page === 'graph' && payload?.targetFilePath) {
    panel.activeTargetFile = payload.targetFilePath;
  }

  panel.webview.html = getWebPanelHtml(context, panel.webview, {
    page,
    graphModel: page === 'graph' ? (payload?.model || payload) : null,
    inspectorData: page === 'interactive' ? payload : null
  }, vscodeInstance);

  panel.webview.onDidReceiveMessage((msg) => {
    return dispatchMessage(msg, context, vscodeInstance, panel);
  });

  panel.onDidDispose(() => {
    if (panelsByPage[page] === panel) {
      panelsByPage[page] = null;
    }
    if (primaryPanel === panel) {
      primaryPanel = null;
    }
    if (page === 'interactive') {
      currentInspectorContext = null;
    }
  });

  return panel;
}

function getPrimaryPanel() {
  return primaryPanel;
}

function _resetWebPanel() {
  for (const k of Object.keys(panelsByPage)) {
    if (panelsByPage[k]) {
      try {
        if (typeof panelsByPage[k].dispose === 'function') panelsByPage[k].dispose();
      } catch (_) {}
      panelsByPage[k] = null;
    }
  }
  primaryPanel = null;
  currentInspectorContext = null;
}

module.exports = {
  openWebPanel,
  getPrimaryPanel,
  getWebPanelHtml,
  getInspectorHtml,
  getTitleForPage,
  getNonce,
  buildCsp,
  escapeHtml,
  _resetWebPanel
};
