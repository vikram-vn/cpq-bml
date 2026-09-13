'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Escapes HTML characters.
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates the Inspector Webview HTML by loading the React + CSS bundle.
 * @param {object} payload
 * @param {any} webview VS Code webview instance
 * @param {string} [extensionPath] Root path of extension
 * @returns {string} HTML content
 */
function getInspectorHtml(payload = {}, webview, extensionPath, vscodeInstance = null) {
  const safePayload = payload || {};
  const rootPath = extensionPath || path.join(__dirname, '..', '..', '..');
  const webviewRoot = path.join(rootPath, 'app', 'lang', 'cloud', 'inspector-web-view');

  const templatePath = path.join(webviewRoot, 'index.html');
  const template = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf8')
    : '<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="{{csp}}"></head><body><div id="root"></div></body></html>';

  let vscodeModule = vscodeInstance;
  if (!vscodeModule) {
    try {
      vscodeModule = require('vscode');
    } catch (_) {}
  }

  const toUri = (p) => {
    if (vscodeModule?.Uri?.file) {
      const u = vscodeModule.Uri.file(p);
      if (u && !u.path) {
        u.path = p.replace(/\\/g, '/');
      }
      return u;
    }
    return { fsPath: p, path: p.replace(/\\/g, '/') };
  };

  const scriptUri = webview?.asWebviewUri
    ? webview.asWebviewUri(toUri(path.join(webviewRoot, 'dist', 'main.js')))
    : 'dist/main.js';

  const styleUri = webview?.asWebviewUri
    ? webview.asWebviewUri(toUri(path.join(webviewRoot, 'css', 'inspector.css')))
    : 'css/inspector.css';

  const nonce = getNonce();
  const cspSource = webview ? webview.cspSource : "'self'";
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');

  let initialDataJson;
  try {
    initialDataJson = JSON.stringify(safePayload).replace(/</g, '\\u003c');
  } catch {
    initialDataJson = '{}';
  }

  // Provide initial pre-rendered fallback in #root so tests and initial render have content
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

  let html = template
    .replace(/<div id="root">.*?<\/div>/s, `<div id="root">${initialMarkup}</div>`)
    .replace(/\{\{csp\}\}/g, csp)
    .replace(/\{\{nonce\}\}/g, nonce)
    .replace(/\{\{styleUri\}\}/g, String(styleUri))
    .replace(/\{\{scriptUri\}\}/g, String(scriptUri))
    .replace(/\{\{initialData\}\}/g, initialDataJson);

  return html;
}

module.exports = {
  getInspectorHtml,
  escapeHtml,
  getNonce
};
