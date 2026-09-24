const { getExtensionContext, normalizeCommandArgs } = require('@/extensionContext');

function getEnvironments(vscode) {
    const v = (vscode && vscode.workspace) ? vscode : getExtensionContext().vscode;
    return v?.workspace?.getConfiguration('cpqBml')?.get('connection.environments', []) || [];
}

async function setEnvironments(vscodeOrEnvs, maybeEnvs) {
    const v = (maybeEnvs !== undefined && vscodeOrEnvs && vscodeOrEnvs.workspace) ? vscodeOrEnvs : getExtensionContext().vscode;
    const environments = maybeEnvs !== undefined ? maybeEnvs : vscodeOrEnvs;
    await v.workspace.getConfiguration('cpqBml').update('connection.environments', environments, v.ConfigurationTarget?.Global || 1);
}

// Excludes password/token deliberately — secrets are looked up separately by site+username in config.js's getAuthHeader.
async function applyEnvironment(vscodeOrEnv, maybeEnv) {
    const v = (maybeEnv !== undefined && vscodeOrEnv && vscodeOrEnv.workspace) ? vscodeOrEnv : getExtensionContext().vscode;
    const env = maybeEnv !== undefined ? maybeEnv : vscodeOrEnv;
    const config = v.workspace.getConfiguration('cpqBml');
    await config.update('connection.siteUrl', env.siteUrl || '', v.ConfigurationTarget?.Global || 1);
    await config.update('connection.username', env.username || '', v.ConfigurationTarget?.Global || 1);
    await config.update('connection.authMethod', env.authMethod || 'basic', v.ConfigurationTarget?.Global || 1);
}

function validateEnvironment(env) {
    if (!env || !env.name || !env.name.trim() || !env.siteUrl || !env.siteUrl.trim()) {
        throw new Error('CPQ-BML: environment requires a name and a siteUrl.');
    }
}

function normalizeEnvironment(env) {
    return {
        name: env.name.trim(),
        siteUrl: env.siteUrl.trim(),
        username: (env.username || '').trim(),
        authMethod: env.authMethod || 'basic'
    };
}

async function addEnvironment(vscode, env) {
    validateEnvironment(env);
    const environments = [...getEnvironments(vscode)];
    environments.push(normalizeEnvironment(env));
    await setEnvironments(vscode, environments);
    return environments;
}

async function updateEnvironment(vscode, index, env) {
    validateEnvironment(env);
    const environments = [...getEnvironments(vscode)];
    if (!(index >= 0 && index < environments.length)) {
        throw new Error('CPQ-BML: environment index out of range.');
    }
    environments[index] = normalizeEnvironment(env);
    await setEnvironments(vscode, environments);
    return environments;
}

async function deleteEnvironment(vscode, index) {
    const environments = [...getEnvironments(vscode)];
    if (!(index >= 0 && index < environments.length)) {
        throw new Error('CPQ-BML: environment index out of range.');
    }
    environments.splice(index, 1);
    await setEnvironments(vscode, environments);
    return environments;
}

async function runChangeEnvironment() {
    normalizeCommandArgs(arguments);
    const { vscode } = getExtensionContext();
    const environments = getEnvironments(vscode);

    if (!Array.isArray(environments) || environments.length === 0) {
        const option = await vscode.window.showWarningMessage(
            'No environments configured. Please add environments in settings first.',
            'Open Settings'
        );
        if (option === 'Open Settings') {
            vscode.commands.executeCommand('cpqBml.settings.open', 'environments');
        }
        return;
    }

    const picks = environments.map((env, index) => {
        const name = env.name || `Env ${index + 1}`;
        const site = env.siteUrl || '(no URL)';
        const user = env.username ? ` | User: ${env.username}` : '';
        const method = env.authMethod ? ` (${env.authMethod})` : '';
        return {
            label: name,
            description: `${site}${user}${method}`,
            env
        };
    });

    const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Select CPQ environment to activate',
        ignoreFocusOut: true
    });
    if (!selected) return;

    const { env } = selected;
    await applyEnvironment(vscode, env);

    // Refresh cloud explorer views, transactions, and status bar
    try {
        if (vscode.commands && typeof vscode.commands.executeCommand === 'function') {
            vscode.commands.executeCommand('cpqCloudExplorer.refresh');
            vscode.commands.executeCommand('cpqCloudTransactions.refresh');
            vscode.commands.executeCommand('cpqBml.internal.refreshStatus');
        }
    } catch {}

    // Check if metadata for this environment exists or is outdated
    try {
        const { getMetadataStatus } = require('@/lang/rest/commerceAttributes');
        const status = getMetadataStatus(vscode);
        if (!status || !status.isSynced) {
            const action = await vscode.window.showInformationMessage(
                `CPQ-BML: Switched to "${env.name}". Metadata is not synced yet for this environment.`,
                'Sync Metadata Now'
            );
            if (action === 'Sync Metadata Now') {
                vscode.commands.executeCommand('cpqBml.rest.syncCommerceMetadata');
            }
            return;
        } else if (status.isStale) {
            const action = await vscode.window.showInformationMessage(
                `CPQ-BML: Switched to "${env.name}". Metadata is over 24 hours old.`,
                'Refresh Metadata',
                'Keep Cached'
            );
            if (action === 'Refresh Metadata') {
                vscode.commands.executeCommand('cpqBml.rest.syncCommerceMetadata');
            }
            return;
        }
    } catch {}

    vscode.window.showInformationMessage(`CPQ-BML: Switched to environment "${env.name}".`);
}

async function runForceSyncEnvironment(context, vscode, resultsTerminal) {
    const { getWorkspaceRoot, getSettings } = require('@/lang/rest/config');
    const { getCpqSiteName } = require('@/lang/rest/folders');
    const { clearAttributesCache } = require('@/lang/rest/commerceAttributes');

    const wsRoot = getWorkspaceRoot(vscode);
    const siteUrl = getSettings(vscode).siteUrl;
    const siteKey = getCpqSiteName(siteUrl);

    clearAttributesCache(wsRoot, siteKey);

    if (vscode.commands && typeof vscode.commands.executeCommand === 'function') {
        await vscode.commands.executeCommand('cpqBml.rest.syncCommerceMetadata');
        vscode.commands.executeCommand('cpqCloudExplorer.refresh');
        vscode.commands.executeCommand('cpqCloudTransactions.refresh');
        vscode.commands.executeCommand('cpqBml.internal.refreshStatus');
    }
}

module.exports = {
    runChangeEnvironment,
    runForceSyncEnvironment,
    getEnvironments,
    applyEnvironment,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment
};
