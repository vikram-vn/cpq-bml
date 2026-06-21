// A single, lazily-created integrated terminal that every MCP tool call
// streams its progress into - distinct from the "CPQ-BML" terminal used by
// human-triggered editor/title commands, so it's obvious at a glance which
// activity came from an AI agent versus a person clicking an icon.
//
// Gated behind cpqBml.mcp.logToTerminal (off by default) - re-checked on
// every call (not just once at creation) so toggling the setting takes
// effect immediately without a window reload. Tool results always carry a
// full log regardless of this setting (see proxy.js's createCapturingTerminal);
// only the human-visible terminal output is what this controls.
//
// Also falls back to null when vscode.window.createTerminal / vscode.EventEmitter
// aren't available - true in unit tests, which pass a plain object in place
// of the real vscode module.
let terminal = null;

function getAiTerminal(vscode) {
    const enabled = vscode.workspace.getConfiguration('cpqBml').get('mcp.logToTerminal', false);
    if (!enabled) return null;
    if (terminal) return terminal;
    if (typeof vscode.window.createTerminal !== 'function' || typeof vscode.EventEmitter !== 'function') {
        return null;
    }
    try {
        const { createResultsTerminal } = require('../rest/terminal');
        terminal = createResultsTerminal(vscode, 'CPQ-BML (AI)');
    } catch (e) {
        terminal = null;
    }
    return terminal;
}

module.exports = { getAiTerminal };
