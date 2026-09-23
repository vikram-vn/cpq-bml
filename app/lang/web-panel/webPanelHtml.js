'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let vscodeModule;
try {
  vscodeModule = require('vscode');
} catch (_) {}

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

module.exports = {
  getNonce,
  escapeHtml,
  buildCsp,
  getTitleForPage,
  getWebPanelHtml,
  getInspectorHtml
};
