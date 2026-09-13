// Mirrors the tab labels shown in webview/src/components/Sidebar.jsx, so the editor
// tab title for the panel always matches whichever settings tab is currently active.
const TAB_LABELS = {
    connection: 'Connection',
    environments: 'Environments',
    operations: 'Operations & REST',
    features: 'Features',
    mcp: 'AI & MCP',
    advanced: 'Advanced',
};

function titleForTab(tab) {
    return `CPQ-BML: ${TAB_LABELS[tab] || TAB_LABELS.connection}`;
}

module.exports = { TAB_LABELS, titleForTab };
