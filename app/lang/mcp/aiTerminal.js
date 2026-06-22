// Gated behind cpqBml.mcp.logToTerminal, re-checked per call so toggling takes effect without a reload.
// Returns null in unit tests, where vscode.window.createTerminal isn't available.
function getAiTerminal(vscode) {
    const enabled = vscode.workspace.getConfiguration('cpqBml').get('mcp.logToTerminal', false);
    if (!enabled) return null;
    if (typeof vscode.window.createTerminal !== 'function' || typeof vscode.EventEmitter !== 'function') {
        return null;
    }
    try {
        const { getResultsTerminal } = require('../rest/terminal');
        return getResultsTerminal(vscode);
    } catch (e) {
        return null;
    }
}

module.exports = { getAiTerminal };
