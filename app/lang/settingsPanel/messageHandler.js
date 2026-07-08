const config = require('../rest/config');
const { writePassword, writeAuthToken } = require('../rest/commands/secrets');
const { applyEnvironment, addEnvironment, updateEnvironment, deleteEnvironment } = require('../rest/commands/env');
const { buildState } = require('./state');
const { titleForTab } = require('./tabTitles');

const CPQ_SECTION = 'cpqBml';

// Settings the webview may write via 'updateField'; secrets have dedicated message types below.
const ALLOWED_FIELDS = new Set([
    'connection.enabled',
    'connection.siteUrl',
    'connection.authMethod',
    'connection.username',
    'rest.restVersion',
    'rest.commerceProcess',
    'rest.commerceDocument',
    'rest.pullFolder',
    'features.lint',
    'features.comments',
    'features.spelling',
    'features.beautifier',
    'features.intellisense',
    'features.docHeader',
    'features.xslt',
    'features.metrics',
    'features.testing',
    'mcp.enable',
    'mcp.port',
    'mcp.logToTerminal',
    'debug.logRestDetails',
    'debug.logOutputToFile',
    'debug.showResultsAsTable'
]);

// Every mutating case re-sends a fresh 'state' snapshot so the webview never relies on stale state.
async function handleMessage(message, context, vscode, panel) {
    try {
        await dispatch(message || {}, context, vscode, panel);
    } catch (err) {
        panel.webview.postMessage({ type: 'error', message: err.message });
    }
}

async function dispatch(message, context, vscode, panel) {
    const post = (msg) => panel.webview.postMessage(msg);
    const sendState = async () => post({ type: 'state', ...(await buildState(context, vscode)) });

    switch (message.type) {
        case 'ready': {
            const state = await buildState(context, vscode);
            if (panel.targetTab) {
                state.activeTab = panel.targetTab;
                panel.targetTab = null;
            }
            post({ type: 'state', ...state });
            return;
        }

        case 'updateField': {
            const { key, value } = message;
            if (!ALLOWED_FIELDS.has(key)) {
                throw new Error(`CPQ-BML: unknown setting "${key}".`);
            }
            await vscode.workspace.getConfiguration(CPQ_SECTION).update(key, value, vscode.ConfigurationTarget.Global);
            await sendState();
            return;
        }

        case 'setPassword':
            await writePassword(context, vscode, message.value);
            await sendState();
            return;

        case 'setAuthToken':
            await writeAuthToken(context, vscode, message.value);
            await sendState();
            return;

        case 'testConnection': {
            const result = await config.runTestConnection(context, vscode);
            post({ type: 'testConnectionResult', ok: result.ok, message: result.message });
            return;
        }

        case 'activateEnvironment': {
            const environments = vscode.workspace.getConfiguration(CPQ_SECTION).get('connection.environments', []) || [];
            const env = environments[message.index];
            if (!env) throw new Error('CPQ-BML: environment index out of range.');
            await applyEnvironment(vscode, env);
            await sendState();
            return;
        }

        case 'addEnvironment':
            await addEnvironment(vscode, message.env);
            await sendState();
            return;

        case 'updateEnvironment':
            await updateEnvironment(vscode, message.index, message.env);
            await sendState();
            return;

        case 'deleteEnvironment':
            await deleteEnvironment(vscode, message.index);
            await sendState();
            return;

        case 'openNativeSettings':
            await vscode.commands.executeCommand('workbench.action.openSettings', message.filter || CPQ_SECTION);
            return;

        // User clicked a different tab in the sidebar - keep the editor tab title in sync.
        case 'tabChanged':
            panel.title = titleForTab(message.tab);
            return;

        default:
            throw new Error(`CPQ-BML: unknown message type "${message.type}".`);
    }
}

module.exports = { handleMessage, ALLOWED_FIELDS };
