const fs = require('fs');
const path = require('path');
const os = require('os');
const metadataLib = require('./metadata');

/**
 * Safe file writer with interactive conflict detection and side-by-side diff review.
 * Protects developers from silently losing local changes when pulling from CPQ.
 */
async function confirmAndWriteBmlFile(vscode, bmlPath, incomingScriptText, functionName, sessionState = {}) {
    if (!fs.existsSync(bmlPath)) {
        metadataLib.writeBmlFile(bmlPath, incomingScriptText);
        return 'written';
    }

    let existingContent = '';
    try {
        existingContent = fs.readFileSync(bmlPath, 'utf8');
    } catch {
        metadataLib.writeBmlFile(bmlPath, incomingScriptText);
        return 'written';
    }

    // Identical content - no conflict
    if (existingContent.trim() === incomingScriptText.trim()) {
        metadataLib.writeBmlFile(bmlPath, incomingScriptText);
        return 'identical';
    }

    if (sessionState.overwriteAll) {
        metadataLib.writeBmlFile(bmlPath, incomingScriptText);
        return 'overwritten';
    }

    if (sessionState.skipAll) {
        return 'skipped';
    }

    const actionCompare = 'Compare (Diff)';
    const actionOverwrite = 'Overwrite Local';
    const actionSkip = 'Keep Local (Skip)';
    const actionOverwriteAll = 'Overwrite All';
    const actionSkipAll = 'Skip All';

    const choice = await vscode.window.showWarningMessage(
        `Local file for "${functionName}" differs from remote CPQ version.`,
        actionCompare,
        actionOverwrite,
        actionSkip,
        actionOverwriteAll,
        actionSkipAll
    );

    if (choice === actionOverwriteAll) {
        sessionState.overwriteAll = true;
        metadataLib.writeBmlFile(bmlPath, incomingScriptText);
        return 'overwritten';
    }

    if (choice === actionSkipAll) {
        sessionState.skipAll = true;
        return 'skipped';
    }

    if (choice === actionOverwrite) {
        metadataLib.writeBmlFile(bmlPath, incomingScriptText);
        return 'overwritten';
    }

    if (choice === actionCompare) {
        // Create temp file for remote script to show in side-by-side diff
        const tempDir = path.join(os.tmpdir(), 'cpq-bml-diff');
        if (!fs.existsSync(tempDir)) {
            try { fs.mkdirSync(tempDir, { recursive: true }); } catch {}
        }
        const tempRemotePath = path.join(tempDir, `${functionName}.remote.bml`);
        fs.writeFileSync(tempRemotePath, incomingScriptText, 'utf8');

        await vscode.commands.executeCommand(
            'vscode.diff',
            vscode.Uri.file(bmlPath),
            vscode.Uri.file(tempRemotePath),
            `Local ↔ CPQ Remote: ${functionName}`
        );

        const postDiffChoice = await vscode.window.showInformationMessage(
            `After reviewing diff for "${functionName}", would you like to overwrite local file?`,
            'Overwrite Local',
            'Keep Local (Skip)'
        );

        if (postDiffChoice === 'Overwrite Local') {
            metadataLib.writeBmlFile(bmlPath, incomingScriptText);
            return 'overwritten';
        }
        return 'skipped';
    }

    // Default or cancelled
    return 'skipped';
}

module.exports = { confirmAndWriteBmlFile };
