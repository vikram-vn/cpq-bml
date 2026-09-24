const configLib = require('@/lang/rest/config');
const { getEnvironments } = require('@/lang/rest/commands/env');
const { getActiveEnvironmentName } = require('@/lang/rest/terminal');
const { normalizeToolArgs } = require('@/lang/mcp/toolArgs');

/**
 * get_connection_status
 *
 * Reports whether CPQ credentials are configured (never the secret values themselves)
 * plus the active site/environment/commerce settings, so an AI can self-diagnose before
 * calling a REST-backed tool instead of discovering a missing credential mid-call.
 * Optionally pings CPQ live (testConnection:true) to confirm the credentials actually work.
 */
async function getConnectionStatus(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
    const settings = configLib.getSettings();
    const environments = getEnvironments();
    const missingCredentials = await configLib.hasMissingCredentials();

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
        isSiteConfigured: Boolean(settings.siteUrl),
        isUsernameConfigured: settings.authMethod === 'bearer' ? true : Boolean(settings.username),
        authMethod: settings.authMethod,
        activeEnvironmentName: getActiveEnvironmentName() || null,
        environmentCount: environments.length,
        pullFolder: settings.pullFolder,
        commerceProcess: settings.commerceProcess,
        commerceDocument: settings.commerceDocument,
    };

    if (args && args.testConnection) {
        status.testResult = await configLib.runTestConnection(tr);
    }

    return status;
}

module.exports = { getConnectionStatus };
