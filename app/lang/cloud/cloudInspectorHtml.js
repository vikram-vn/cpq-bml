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
function getInspectorHtml(payload = {}, webview, extensionPath) {
  const rootPath = extensionPath || path.join(__dirname, '..', '..', '..');
  const webviewRoot = path.join(rootPath, 'app', 'lang', 'cloud', 'inspector-web-view');

  const templatePath = path.join(webviewRoot, 'index.html');
  const template = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf8')
    : '<!DOCTYPE html><html><body><div id="root"></div></body></html>';

  const scriptUri = webview?.asWebviewUri
    ? webview.asWebviewUri({ fsPath: path.join(webviewRoot, 'dist', 'main.js') })
    : 'dist/main.js';

  const styleUri = webview?.asWebviewUri
    ? webview.asWebviewUri({ fsPath: path.join(webviewRoot, 'css', 'inspector.css') })
    : 'css/inspector.css';

  const nonce = getNonce();
  const cspSource = webview ? webview.cspSource : "'self'";
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');

  const initialDataJson = JSON.stringify(payload || {}).replace(/</g, '\\u003c');

  // Provide initial pre-rendered fallback in #root so tests and initial render have content
  const initialMarkup = `
    <div class="inspector-container">
      <div class="header">
        <span class="badge">${escapeHtml(payload.category || 'Item')}</span>
        <h1>${escapeHtml(payload.title || 'CPQ Metadata')}</h1>
        ${payload.variableName ? `<span class="subtitle">${escapeHtml(payload.variableName)}</span>` : ''}
        ${payload.description ? `<p>${escapeHtml(payload.description)}</p>` : ''}
        ${payload.hasBml ? '<button class="primary">Open BML Script</button>' : ''}
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
