const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function getHtml(context, vscode, webview) {
    const webviewRoot = vscode.Uri.joinPath(context.extensionUri, 'app', 'lang', 'settingsPanel', 'webview');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'dist', 'main.js'));
    const layoutStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'css', 'layout.min.css'));
    const componentsStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'css', 'components.min.css'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'css', 'main.min.css'));

    const templatePath = path.join(context.extensionPath, 'app', 'lang', 'settingsPanel', 'webview', 'index.html');
    const template = fs.readFileSync(templatePath, 'utf8');

    const nonce = getNonce();
    const csp = buildCsp(nonce, webview.cspSource);

    return template
        .replace(/\{\{csp\}\}/g, csp)
        .replace(/\{\{nonce\}\}/g, nonce)
        .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
        .replace(/\{\{layoutStyleUri\}\}/g, layoutStyleUri.toString())
        .replace(/\{\{componentsStyleUri\}\}/g, componentsStyleUri.toString())
        .replace(/\{\{styleUri\}\}/g, styleUri.toString());
}

module.exports = { getHtml, getNonce, buildCsp };
