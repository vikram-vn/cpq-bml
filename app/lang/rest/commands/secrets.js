const config = require('../config');

// Dual-write: site-specific key plus the legacy global key, so getAuthHeader's fallback lookup works either way.
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

async function deletePassword(context, vscode) {
    const { siteUrl, username } = config.getSettings(vscode);
    if (siteUrl && username) {
        const key = config.getPasswordSecretKey(siteUrl, username);
        await context.secrets.delete(key);
    }
    await context.secrets.delete(config.SECRET_PASSWORD);
}

async function deleteAuthToken(context, vscode) {
    const { siteUrl } = config.getSettings(vscode);
    if (siteUrl) {
        const key = config.getTokenSecretKey(siteUrl);
        await context.secrets.delete(key);
    }
    await context.secrets.delete(config.SECRET_TOKEN);
}

module.exports = {
    runSetPassword,
    runSetAuthToken,
    writePassword,
    writeAuthToken,
    deletePassword,
    deleteAuthToken,
};
