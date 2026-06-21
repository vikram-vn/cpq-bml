// Every MCP tool call streams its progress into the same shared "CPQ-BML"
// terminal that human-triggered editor/title commands already use (see
// app/lang/rest/terminal.js's getResultsTerminal) - one terminal instead of
// a separate one per side.
//
// Gated behind cpqBml.mcp.logToTerminal (off by default) - re-checked on
// every call (not just once) so toggling the setting takes effect
// immediately without a window reload. Tool results always carry a full log
// regardless of this setting (see proxy.js's createCapturingTerminal); only
// the human-visible terminal output is what this controls.
//
// Also falls back to null when vscode.window.createTerminal / vscode.EventEmitter
// aren't available - true in unit tests, which pass a plain object in place
// of the real vscode module.
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
