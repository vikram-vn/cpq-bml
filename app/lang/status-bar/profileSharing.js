const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const SENSITIVE_KEYS = new Set(['password', 'clientSecret', 'apiKey', 'token', 'secret', 'client_secret']);

function sanitizeEnvironment(env) {
    const sanitized = {};
    for (const [key, value] of Object.entries(env)) {
        if (!SENSITIVE_KEYS.has(key)) {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

async function exportTeamProfiles() {
    const config = vscode.workspace.getConfiguration('cpqBml');
    const environments = config.get('connection.environments', []) || [];

    if (!environments.length) {
        vscode.window.showWarningMessage('No CPQ environments configured to export.');
        return;
    }

    const sanitizedEnvs = environments.map(sanitizeEnvironment);
    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        environments: sanitizedEnvs,
    };

    const wsFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    let targetPath = null;

    if (wsFolder) {
        const cpqDir = path.join(wsFolder.uri.fsPath, '.cpq');
        if (!fs.existsSync(cpqDir)) {
            try { fs.mkdirSync(cpqDir, { recursive: true }); } catch {}
        }
        targetPath = path.join(cpqDir, 'profiles.json');
    } else {
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('cpq-profiles.json'),
            filters: { 'JSON Files': ['json'] },
        });
        if (saveUri) targetPath = saveUri.fsPath;
    }

    if (!targetPath) return;

    try {
        fs.writeFileSync(targetPath, JSON.stringify(exportData, null, 2), 'utf8');
        const openAction = 'Open File';
        const choice = await vscode.window.showInformationMessage(
            `Exported ${sanitizedEnvs.length} environment profiles (secrets omitted) to ${path.basename(targetPath)}`,
            openAction
        );
        if (choice === openAction) {
            const doc = await vscode.workspace.openTextDocument(targetPath);
            await vscode.window.showTextDocument(doc);
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to export profiles: ${err.message}`);
    }
}

async function importTeamProfiles() {
    const wsFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    let sourcePath = null;

    if (wsFolder) {
        const defaultPath = path.join(wsFolder.uri.fsPath, '.cpq', 'profiles.json');
        if (fs.existsSync(defaultPath)) {
            sourcePath = defaultPath;
        }
    }

    if (!sourcePath) {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: { 'JSON Files': ['json'] },
            openLabel: 'Import CPQ Profiles',
        });
        if (uris && uris.length > 0) {
            sourcePath = uris[0].fsPath;
        }
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
        vscode.window.showWarningMessage('No profiles.json found to import.');
        return;
    }

    try {
        const content = fs.readFileSync(sourcePath, 'utf8');
        const data = JSON.parse(content);
        const importedEnvs = Array.isArray(data) ? data : data.environments || [];

        if (!importedEnvs.length) {
            vscode.window.showWarningMessage('No valid environments found in profile file.');
            return;
        }

        const config = vscode.workspace.getConfiguration('cpqBml');
        const existingEnvs = config.get('connection.environments', []) || [];
        const envMap = new Map();

        for (const env of existingEnvs) {
            if (env.name) envMap.set(env.name, env);
        }

        let addedCount = 0;
        let updatedCount = 0;

        for (const imported of importedEnvs) {
            if (!imported.name) continue;
            if (envMap.has(imported.name)) {
                const existing = envMap.get(imported.name);
                envMap.set(imported.name, Object.assign({}, existing, imported));
                updatedCount++;
            } else {
                envMap.set(imported.name, imported);
                addedCount++;
            }
        }

        const merged = Array.from(envMap.values());
        await config.update('connection.environments', merged, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(
            `Imported profiles: ${addedCount} added, ${updatedCount} updated from ${path.basename(sourcePath)}`
        );
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to import profiles: ${err.message}`);
    }
}

module.exports = { exportTeamProfiles, importTeamProfiles, sanitizeEnvironment };
