const config = require('../rest/config');

// Assembles the one JSON snapshot sent to the webview. Never includes a
// secret's actual value - only hasPassword/hasToken booleans - so the panel
// can show "set"/"not set" status without the password/token ever leaving
// VS Code Secret Storage.
async function buildState(context, vscode) {
    const settings = config.getSettings(vscode);
    const cpqConfig = vscode.workspace.getConfiguration('cpqBml');
    const environments = cpqConfig.get('connection.environments', []) || [];

    const passwordKey = settings.username ? config.getPasswordSecretKey(settings.siteUrl, settings.username) : null;
    const tokenKey = settings.siteUrl ? config.getTokenSecretKey(settings.siteUrl) : null;

    const hasPassword = !!(
        (passwordKey && await context.secrets.get(passwordKey)) ||
        await context.secrets.get(config.SECRET_PASSWORD)
    );
    const hasToken = !!(
        (tokenKey && await context.secrets.get(tokenKey)) ||
        await context.secrets.get(config.SECRET_TOKEN)
    );

    return {
        connection: {
            // Raw (un-normalized) value, so the field shows back exactly what
            // the user typed (e.g. "mycompany") rather than the expanded
            // "https://mycompany.bigmachines.com" form config.js resolves it to.
            siteUrl: cpqConfig.get('connection.siteUrl', ''),
            authMethod: settings.authMethod,
            username: settings.username,
            restVersion: settings.restVersion,
            commerceProcess: settings.commerceProcess,
            commerceDocument: settings.commerceDocument,
            debugLog: settings.debugLog,
            enabled: cpqConfig.get('connection.enabled', true)
        },
        rest: {
            pullFolder: settings.pullFolder
        },
        lint: {
            enable: cpqConfig.get('lint.enable', true)
        },
        mcp: {
            enable: cpqConfig.get('mcp.enable', false),
            port: cpqConfig.get('mcp.port', 47821),
            logToTerminal: cpqConfig.get('mcp.logToTerminal', false)
        },
        debug: {
            logOutputToFile: settings.logOutputToFile
        },
        environments,
        hasPassword,
        hasToken
    };
}

module.exports = { buildState };
