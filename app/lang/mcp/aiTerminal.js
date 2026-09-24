const { getResultsTerminal } = require('@/lang/rest/terminal');
const { getConfigContext } = require('@/lang/rest/config');

// Gated behind cpqBml.mcp.logToTerminal, re-checked per call so toggling takes effect without a reload.
// Returns null in unit tests, where vscode.window.createTerminal isn't available.
function getAiTerminal(vscode) {
    const v = vscode || (getConfigContext() && getConfigContext().vscode);
    if (!v || !v.workspace || typeof v.workspace.getConfiguration !== 'function') return null;
    const enabled = v.workspace.getConfiguration('cpqBml').get('mcp.logToTerminal', false);
    if (!enabled) return null;
    if (typeof v.window?.createTerminal !== 'function' || typeof v.EventEmitter !== 'function') {
        return null;
    }
    try {
        return getResultsTerminal(v);
    } catch (e) {
        return null;
    }
}

module.exports = { getAiTerminal };
