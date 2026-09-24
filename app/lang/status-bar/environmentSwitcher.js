const vscode = require('vscode');
const { getActiveEnvironmentName } = require('@/lang/rest/terminal');
const { exportTeamProfiles, importTeamProfiles } = require('@/lang/status-bar/profileSharing');
const { getContext } = require('@/extensionContext');

let statusBarItem = null;

function isBmlActive() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) return false;
    const doc = editor.document;
    if (doc.languageId === 'bml' || doc.languageId === 'bmlt') return true;
    const path = (doc.fileName || (doc.uri && doc.uri.fsPath) || '').toLowerCase();
    return path.endsWith('.bml') || path.endsWith('.bmlt');
}

function updateStatusBar() {
    if (!statusBarItem) return;
    if (!isBmlActive()) {
        statusBarItem.hide();
        return;
    }
    try {
        const config = vscode.workspace.getConfiguration('cpqBml');
        const activeName = getActiveEnvironmentName(vscode);
        const siteUrl = (config.get('connection.siteUrl', '') || '').trim();

        if (activeName) {
            statusBarItem.text = `$(server) CPQ: ${activeName}`;
            statusBarItem.tooltip = `Active CPQ Environment: ${activeName} (${siteUrl})\nClick to switch environment`;
        } else if (siteUrl) {
            let host = siteUrl;
            try { host = new URL(siteUrl).hostname; } catch {}
            statusBarItem.text = `$(server) CPQ: ${host}`;
            statusBarItem.tooltip = `Active CPQ Site: ${siteUrl}\nClick to switch environment`;
        } else {
            statusBarItem.text = '$(server) CPQ: No Env';
            statusBarItem.tooltip = 'No active CPQ environment selected. Click to switch or configure.';
        }
        statusBarItem.show();
    } catch {
        statusBarItem.text = '$(server) CPQ';
        statusBarItem.show();
    }
}

async function switchEnvironment() {
    const config = vscode.workspace.getConfiguration('cpqBml');
    const environments = config.get('connection.environments', []) || [];
    const activeName = getActiveEnvironmentName(vscode);

    const items = environments.map((env) => ({
        label: `${env.name === activeName ? '$(check) ' : ''}${env.name}`,
        description: env.siteUrl || '',
        detail: `User: ${env.username || 'N/A'} (${env.authMethod || 'basic'})`,
        env,
    }));

    items.push({
        label: '$(gear) Open Settings Panel',
        description: 'Configure connections and credentials',
        action: 'openSettings',
    });

    items.push({
        label: '$(export) Export Team Profiles (cpq/profiles.json)',
        description: 'Export sanitized environment profiles without secrets',
        action: 'exportProfiles',
    });

    items.push({
        label: '$(cloud-download) Import Team Profiles',
        description: 'Import environment profiles from team repository',
        action: 'importProfiles',
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select active CPQ environment or profile action',
    });

    if (!selected) return;

    if (selected.action === 'openSettings') {
        vscode.commands.executeCommand('cpqBml.openSettings');
        return;
    }

    if (selected.action === 'exportProfiles') {
        await exportTeamProfiles();
        return;
    }

    if (selected.action === 'importProfiles') {
        await importTeamProfiles();
        return;
    }

    if (selected.env) {
        const env = selected.env;
        await config.update('connection.siteUrl', env.siteUrl || '', vscode.ConfigurationTarget.Global);
        await config.update('connection.username', env.username || '', vscode.ConfigurationTarget.Global);
        await config.update('connection.authMethod', env.authMethod || 'basic', vscode.ConfigurationTarget.Global);
        if (env.password !== undefined) {
            await config.update('connection.password', env.password, vscode.ConfigurationTarget.Global);
        }
        vscode.window.showInformationMessage(`Active CPQ environment switched to "${env.name}"`);
        updateStatusBar();
    }
}

function registerEnvironmentSwitcher(context) {
    context = context || getContext();
    if (vscode.window && typeof vscode.window.createStatusBarItem === 'function') {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        statusBarItem.command = 'cpqBml.switchEnvironment';
        if (context && context.subscriptions) context.subscriptions.push(statusBarItem);
        updateStatusBar();

        if (context && context.subscriptions) {
            context.subscriptions.push(
            vscode.commands.registerCommand('cpqBml.switchEnvironment', switchEnvironment),
            vscode.commands.registerCommand('cpqBml.exportTeamProfiles', exportTeamProfiles),
            vscode.commands.registerCommand('cpqBml.importTeamProfiles', importTeamProfiles),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('cpqBml.connection')) {
                    updateStatusBar();
                }
            }),
            vscode.window.onDidChangeActiveTextEditor(() => {
                updateStatusBar();
            })
        );
        }
    }
}

module.exports = { registerEnvironmentSwitcher, switchEnvironment, updateStatusBar };
