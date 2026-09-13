const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getWebPanelHtml } = require('@/lang/web-panel/webPanelManager');

function getNonce() {
    return crypto.randomBytes(16).toString('base64');
}

// Strict CSP: only the nonce-tagged script and assets from webview.cspSource; no inline/remote/eval.
function buildCsp(nonce, cspSource) {
    return [
        "default-src 'none'",
        `img-src ${cspSource}`,
        `style-src ${cspSource}`,
        `script-src 'nonce-${nonce}'`
    ].join('; ');
}

let cachedTemplate = null;

function getTemplate(context) {
    if (!cachedTemplate) {
        const templatePath = path.join(context.extensionPath, 'app', 'lang', 'web-panel', 'index.html');
        cachedTemplate = fs.readFileSync(templatePath, 'utf8');
    }
    return cachedTemplate;
}

function getHtml(context, vscode, webview) {
    return getWebPanelHtml(context, webview, { page: 'settings' }, vscode);
}

module.exports = { getHtml, getNonce, buildCsp };
