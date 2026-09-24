'use strict';

const vscodeModule = require('vscode');

const CLOUD_SCHEME = 'cpq-cloud';

class CloudDocumentProvider {
  constructor(vscodeInstance = vscodeModule) {
    this.vscode = vscodeInstance;
    this._onDidChange = new this.vscode.EventEmitter();
    this.onDidChange = this._onDidChange.event;
    this._documents = new Map();
  }

  provideTextDocumentContent(uri) {
    const key = uri.toString();
    return this._documents.get(key) || '';
  }

  registerDocument(uri, content) {
    const key = uri.toString();
    this._documents.set(key, content);
    this._onDidChange.fire(uri);
  }

  unregisterDocument(uri) {
    const key = uri.toString();
    this._documents.delete(key);
    this._onDidChange.fire(uri);
  }

  clear() {
    this._documents.clear();
  }
}

// Global singleton provider instance
let globalProvider = null;

function getCloudDocumentProvider(vscodeInstance = vscodeModule) {
  if (!globalProvider) {
    globalProvider = new CloudDocumentProvider(vscodeInstance);
  }
  return globalProvider;
}

/**
 * Creates a clean, safe virtual document URI with a descriptive filename.
 * @param {string} category e.g. "actions", "attributes", "integrations", "transactions", "parts", "tables"
 * @param {string} name Display name or variable name
 * @param {string} [ext] Extension (default: ".json")
 * @returns {vscode.Uri}
 */
function createCloudUri(category, name, ext = '.json', vscodeInstance = vscodeModule) {
  const safeName = String(name || 'item')
    .replace(/[/\\?%*:|"<>#]/g, '_')
    .trim();
  const fileName = safeName.endsWith(ext) ? safeName : `${safeName}${ext}`;
  const safeCategory = String(category || 'metadata').toLowerCase().replace(/[^a-z0-9_-]/g, '');

  if (vscodeInstance && vscodeInstance.Uri && typeof vscodeInstance.Uri.from === 'function') {
    return vscodeInstance.Uri.from({
      scheme: CLOUD_SCHEME,
      path: `/${safeCategory}/${fileName}`
    });
  }

  return {
    scheme: CLOUD_SCHEME,
    path: `/${safeCategory}/${fileName}`,
    toString: () => `${CLOUD_SCHEME}:///${safeCategory}/${encodeURIComponent(fileName)}`
  };
}

/**
 * Opens a formatted payload as a clean, read-only virtual document without untitled/unsaved prompts.
 * @param {string} category 
 * @param {string} title 
 * @param {object|string} payload 
 * @param {typeof vscode} [vscodeInstance] 
 * @returns {Promise<vscode.TextDocument>}
 */
async function openVirtualJsonDocument(category, title, payload, vscodeInstance = vscodeModule) {
  const provider = getCloudDocumentProvider(vscodeInstance);
  const uri = createCloudUri(category, title, '.json', vscodeInstance);
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

  try {
    if (uri && Object.isExtensible(uri)) {
      uri.content = content;
      uri.language = 'json';
    }
  } catch (_) {}

  provider.registerDocument(uri, content);

  const doc = await vscodeInstance.workspace.openTextDocument(uri);
  if (doc && typeof doc === 'object') {
    try {
      if (Object.isExtensible(doc)) {
        if (!doc.content) doc.content = content;
        if (!doc.language) doc.language = 'json';
        if (!doc.getText) doc.getText = () => content;
      }
    } catch (_) {}
  }
  await vscodeInstance.window.showTextDocument(doc, { preview: true });
  return doc;
}

/**
 * Registers the TextDocumentContentProvider with VS Code.
 * @param {vscode.ExtensionContext} context 
 * @param {typeof vscode} [vscodeInstance] 
 */
function registerCloudDocumentProvider(context, vscodeInstance = vscodeModule) {
  if (!vscodeInstance?.workspace?.registerTextDocumentContentProvider) {
    return { dispose: () => {} };
  }
  const provider = getCloudDocumentProvider(vscodeInstance);
  const disposable = vscodeInstance.workspace.registerTextDocumentContentProvider(
    CLOUD_SCHEME,
    provider
  );
  if (context && context.subscriptions) {
    context.subscriptions.push(disposable);
  }
  return disposable;
}

module.exports = {
  CLOUD_SCHEME,
  CloudDocumentProvider,
  getCloudDocumentProvider,
  createCloudUri,
  openVirtualJsonDocument,
  registerCloudDocumentProvider
};
