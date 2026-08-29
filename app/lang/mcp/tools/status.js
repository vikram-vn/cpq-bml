const configLib = require('../../rest/config');
const { getEnvironments } = require('../../rest/commands/env');
const { getActiveEnvironmentName } = require('../../rest/terminal');

/**
 * get_connection_status
 *
 * Reports whether CPQ credentials are configured (never the secret values themselves)
 * plus the active site/environment/commerce settings, so an AI can self-diagnose before
 * calling a REST-backed tool instead of discovering a missing credential mid-call.
 * Optionally pings CPQ live (testConnection:true) to confirm the credentials actually work.
 */
async function getConnectionStatus(context, vscode, args, transport) {
    const settings = configLib.getSettings(vscode);
    const environments = getEnvironments(vscode);
    const missingCredentials = await configLib.hasMissingCredentials(context, vscode);

    let missingReason = null;
    if (missingCredentials) {
        if (!settings.siteUrl) missingReason = 'connection.siteUrl is not configured.';
        else if (settings.authMethod !== 'bearer' && !settings.username) missingReason = 'connection.username is not configured.';
        else missingReason = settings.authMethod === 'bearer' ? 'No auth token is set.' : 'No password is set.';
    }

    const status = {
        success: true,
        configured: !missingCredentials,
        missingReason,
        siteUrl: settings.siteUrl || null,
        authMethod: settings.authMethod,
        username: settings.authMethod === 'bearer' ? null : (settings.username || null),
        activeEnvironmentName: getActiveEnvironmentName(vscode) || null,
        environmentCount: environments.length,
        pullFolder: settings.pullFolder,
        commerceProcess: settings.commerceProcess,
        commerceDocument: settings.commerceDocument,
    };

    if (args && args.testConnection) {
        status.testResult = await configLib.runTestConnection(context, vscode, transport);
    }

    return status;
}

module.exports = { getConnectionStatus };
