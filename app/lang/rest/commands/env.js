function getEnvironments(vscode) {
    return vscode.workspace.getConfiguration('cpqBml').get('connection.environments', []) || [];
}

async function setEnvironments(vscode, environments) {
    await vscode.workspace.getConfiguration('cpqBml').update('connection.environments', environments, vscode.ConfigurationTarget.Global);
}

// Copies the 3 identifying fields of a saved environment into the active
// cpqBml.connection.* settings. Deliberately excludes password/token -
// environments never carry a password/token field; once active, the
// site+username-keyed secret lookup in config.js's getAuthHeader takes over.
async function applyEnvironment(vscode, env) {
    const config = vscode.workspace.getConfiguration('cpqBml');
    await config.update('connection.siteUrl', env.siteUrl || '', vscode.ConfigurationTarget.Global);
    await config.update('connection.username', env.username || '', vscode.ConfigurationTarget.Global);
    await config.update('connection.authMethod', env.authMethod || 'basic', vscode.ConfigurationTarget.Global);
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

async function runChangeEnvironment(context, vscode) {
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
    vscode.window.showInformationMessage(`CPQ-BML: Switched to environment "${env.name}".`);
}

module.exports = {
    runChangeEnvironment,
    getEnvironments,
    applyEnvironment,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment
};
