const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Install bundled CSpell config into workspace
 * @param {vscode.ExtensionContext} context
 */
function installCSpellConfig(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const vscodeFolder = path.join(workspaceRoot, '.vscode');
    const targetPath = path.join(vscodeFolder, 'cspell.json'); // no leading dot
    const sourcePath = path.join(context.extensionPath, 'cspell.json');

    if (!fs.existsSync(sourcePath)) {
        console.warn('No bundled .cspell.json found in extension.');
        return;
    }

    // Create .vscode folder if it doesn't exist
    if (!fs.existsSync(vscodeFolder)) {
        fs.mkdirSync(vscodeFolder, { recursive: true });
    }

    // Copy config if it doesn't exist
    if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
        vscode.window.showInformationMessage('CSpell config installed from CPQ-BML extension.');
    } else {
        console.log('Workspace already has .vscode/cspell.json; skipping installation.');
    }
}

module.exports = { installCSpellConfig };
