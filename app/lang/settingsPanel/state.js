const config = require('../rest/config');
const { getEnvironments } = require('../rest/commands/env');

// Only sends hasPassword/hasToken booleans - actual secret values never leave VS Code Secret Storage.
async function buildState(context, vscode) {
    const settings = config.getSettings(vscode);
    const cpqConfig = vscode.workspace.getConfiguration('cpqBml');
    const environments = getEnvironments(vscode);

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
            // Raw value as typed, not config.js's normalized https:// form.
            siteUrl: cpqConfig.get('connection.siteUrl', ''),
            authMethod: settings.authMethod,
            username: settings.username,
            enabled: cpqConfig.get('connection.enabled', true)
        },
        rest: {
            pullFolder: settings.pullFolder,
            restVersion: settings.restVersion,
            commerceProcess: settings.commerceProcess,
            commerceDocument: settings.commerceDocument
        },
        features: {
            lint: cpqConfig.get('features.lint', true),
            comments: cpqConfig.get('features.comments', true),
            spelling: cpqConfig.get('features.spelling', true)
        },
        mcp: {
            enable: cpqConfig.get('mcp.enable', false),
            port: cpqConfig.get('mcp.port', 47821),
            logToTerminal: cpqConfig.get('mcp.logToTerminal', false)
        },
        debug: {
            logOutputToFile: settings.logOutputToFile,
            logRestDetails: settings.debugLog,
            showResultsAsTable: settings.showResultsAsTable
        },
        environments,
        hasPassword,
        hasToken
    };
}

module.exports = { buildState };
