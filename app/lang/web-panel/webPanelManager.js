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
    return name ? `References: ${name}` : 'CPQ Dependency Graph';
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

  const nonce = getNonce();
  const cspSource = webview?.cspSource || "'self'";
  const csp = buildCsp(nonce, cspSource);

  const styleUri = toFileUri(path.join(rootPath, 'dist', 'web-panel', 'main.css'));
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
      await updatePanelEntityModel(panel, message.entityType, message.entityName, message, vscodeInstance);
    } catch (_) {}
    return;
  }

  if (message.command === 'showEntityReferences' || message.command === 'analyzeBlastRadius') {
    try {
      const { showEntityDependencyGraph } = require('@/lang/graph/dependencyGraphPanel');
      const entityType = message.entityType || 'attribute';
      const entityName = message.entityName || message.variableName;
      if (entityName) {
        await showEntityDependencyGraph(context, entityType, entityName, message, vscodeInstance);
      }
    } catch (_) {}
    return;
  }

  if (message.command === 'fetchCloudReferences') {
    try {
      const apiCommerce = require('@/lang/rest/apiCommerce');
      const apiAttributes = require('@/lang/rest/apiCommerceAttributes');
      const varName = message.variableName || message.entityName;
      const isAction = message.category === 'Action' || message.entityType === 'action' || Boolean(message.actionType);
      const isLibrary = message.category === 'Library' || message.category === 'Function' || (typeof message.category === 'string' && message.category.includes('Library')) || message.entityType === 'library' || message.entityType === 'function';
      const effectiveProc = message.process || message.commerceProcess;
      const effectiveDoc = message.document || message.commerceDocument;

      let items = [];
      let statusCode = 200;

      if (isAction && varName && typeof apiCommerce.getCommerceAction === 'function') {
        const res = await apiCommerce.getCommerceAction(context, vscodeInstance, varName, {
          process: effectiveProc,
          document: effectiveDoc,
        });
        statusCode = res?.statusCode || 200;
        const body = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;
        const deps = body?.dependencies || {};

        if (Array.isArray(deps.attributes)) {
          for (const a of deps.attributes) {
            items.push({
              name: a,
              variableName: a,
              type: 'Dependent Attribute',
              description: 'Attribute referenced, modified, or validated by this action',
              category: 'Attribute',
              document: effectiveDoc,
            });
          }
        }
        if (Array.isArray(deps.actions)) {
          for (const act of deps.actions) {
            items.push({
              name: act,
              variableName: act,
              type: 'Associated Action',
              description: 'Chained or prerequisite action in process flow',
              category: 'Action',
              document: effectiveDoc,
            });
          }
        }
        if (Array.isArray(deps.groups)) {
          for (const g of deps.groups) {
            items.push({
              name: g,
              variableName: g,
              type: 'Layout Tab / Group',
              description: 'Layout group or panel state affected by action',
              category: 'Layout',
              document: effectiveDoc,
            });
          }
        }
        if (Array.isArray(deps.resources)) {
          for (const r of deps.resources) {
            items.push({
              name: r,
              variableName: r,
              type: 'Resource',
              description: 'Subdocument or resource affected by action',
              category: 'Resource',
              document: effectiveDoc,
            });
          }
        }
      } else if (isLibrary && varName) {
        // 1. Live BML Global Search across Oracle CPQ Cloud
        try {
          const apiRest = require('@/lang/rest/api');
          if (typeof apiRest.searchBmlScripts === 'function') {
            const res = await apiRest.searchBmlScripts(context, vscodeInstance, { query: varName, limit: 50 });
            statusCode = res?.statusCode || 200;
            const body = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;
            const bmlItems = Array.isArray(body?.items) ? body.items : [];
            for (const it of bmlItems) {
              items.push({
                name: it.path || 'BML Script',
                variableName: it.path,
                type: 'Remote Script (CPQ Cloud)',
                description: it.dateModified ? `Last modified: ${it.dateModified}` : `Referencing ${varName}`,
                category: 'Library',
                document: effectiveDoc,
              });
            }
          }
        } catch (_) {}

        // 2. Local workspace callers from BML call graph
        try {
          const { loadWorkspaceBmlFiles } = require('@/lang/graph/dependencyGraphPanel');
          const { buildWorkspaceCallGraph, computeBlastRadius } = require('@/lang/graph/dependencyGraphAnalyzer');
          const files = await loadWorkspaceBmlFiles();
          const workspaceGraph = buildWorkspaceCallGraph(files);
          const blast = computeBlastRadius(varName.toLowerCase(), workspaceGraph);
          for (const caller of blast.callers) {
            items.push({
              name: caller.name,
              variableName: caller.qualifiedName,
              type: `Workspace Caller (Depth ${caller.depth})`,
              description: `Calls ${varName} on line(s) [${caller.lines ? caller.lines.map(l => l + 1).join(', ') : '1'}]`,
              category: 'Library',
              filePath: caller.filePath,
              line: caller.lines?.[0],
              document: effectiveDoc,
            });
          }
        } catch (_) {}
      } else if (varName && typeof apiAttributes.listCommerceAttributeReferences === 'function') {
        const res = await apiAttributes.listCommerceAttributeReferences(context, vscodeInstance, varName, {
          process: effectiveProc,
          document: effectiveDoc,
        });
        statusCode = res?.statusCode || 200;
        const raw = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;

        if (raw && typeof raw === 'object') {
          if (Array.isArray(raw.ruleAssocs)) {
            for (const r of raw.ruleAssocs) {
              items.push({
                name: r.label || r.name,
                type: r.type || 'Rule Association',
                description: r.href || 'Rule referencing attribute',
                category: 'Rule',
                document: effectiveDoc,
              });
            }
          }
          if (Array.isArray(raw.libFuncAssocs)) {
            for (const f of raw.libFuncAssocs) {
              items.push({
                name: f.label || f.name,
                type: 'Library Function Association',
                description: f.id ? `Function ID: ${f.id}` : 'Library function referencing attribute',
                category: 'Function',
                document: effectiveDoc,
              });
            }
          }
          if (Array.isArray(raw.integrationAssocs)) {
            for (const i of raw.integrationAssocs) {
              items.push({
                name: i.label || i.name,
                type: 'Integration Association',
                description: i.id ? `Integration ID: ${i.id}` : 'Integration mapping referencing attribute',
                category: 'Integration',
                document: effectiveDoc,
              });
            }
          }
          if (Array.isArray(raw.layoutReferences)) {
            for (const l of raw.layoutReferences) {
              items.push({
                name: l.path || 'Layout Panel',
                type: `Layout (${l.layoutType || 'UI'})`,
                description: l.path || 'UI layout panel/tab',
                category: 'Layout',
                document: effectiveDoc,
              });
            }
          }
        }

        if (items.length === 0) {
          items = Array.isArray(raw) ? raw : (raw?.items || raw?.references || raw?.usages || []);
        }
      }

      panel?.webview?.postMessage({
        command: 'cloudReferencesLoaded',
        variableName: varName,
        references: items,
        statusCode,
      });
    } catch (err) {
      panel?.webview?.postMessage({
        command: 'cloudReferencesLoaded',
        variableName: message.variableName || message.entityName,
        references: [],
        error: err.message,
      });
    }
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
