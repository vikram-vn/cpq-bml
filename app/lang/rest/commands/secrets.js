const config = require('../config');

// Dual-write: the site+username (or site)-specific key plus the legacy
// global key, so getAuthHeader's fallback lookup keeps working regardless of
// which key it finds first. No prompt - the settings webview calls these
// directly with a value it already has; runSetPassword/runSetAuthToken below
// are the prompt-driven CLI/Command Palette flow built on top.
async function writePassword(context, vscode, value) {
    const { siteUrl, username } = config.getSettings(vscode);
    if (siteUrl) {
        const key = config.getPasswordSecretKey(siteUrl, username);
        await context.secrets.store(key, value);
    }
    await context.secrets.store(config.SECRET_PASSWORD, value);
}

async function writeAuthToken(context, vscode, value) {
    const { siteUrl } = config.getSettings(vscode);
    if (siteUrl) {
        const key = config.getTokenSecretKey(siteUrl);
        await context.secrets.store(key, value);
    }
    await context.secrets.store(config.SECRET_TOKEN, value);
}

async function runSetPassword(context, vscode) {
    const value = await vscode.window.showInputBox({ prompt: 'CPQ Password', password: true, ignoreFocusOut: true });
    if (value === undefined) return;

    await writePassword(context, vscode, value);
    vscode.window.showInformationMessage('CPQ-BML: password saved.');
}

async function runSetAuthToken(context, vscode) {
    const value = await vscode.window.showInputBox({ prompt: 'CPQ Auth Token', password: true, ignoreFocusOut: true });
    if (value === undefined) return;

    await writeAuthToken(context, vscode, value);
    vscode.window.showInformationMessage('CPQ-BML: auth token saved.');
}

module.exports = { runSetPassword, runSetAuthToken, writePassword, writeAuthToken };
