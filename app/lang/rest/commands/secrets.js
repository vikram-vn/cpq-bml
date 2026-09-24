const config = require('@/lang/rest/config');
const cryptoManager = require('@/lang/rest/crypto');
const { getExtensionContext } = require('@/extensionContext');

// Dual-write: site-specific key plus the legacy global key, so getAuthHeader's fallback lookup works either way.
// Always encrypts with Custom AES-256 and the machine-bound random master key before persisting.
async function writePassword(contextOrVal, vscodeOrVal, maybeVal) {
    let val = contextOrVal;
    let ctx = getExtensionContext().context;
    let vsc = getExtensionContext().vscode;
    if (maybeVal !== undefined) {
        ctx = contextOrVal || ctx;
        vsc = vscodeOrVal || vsc;
        val = maybeVal;
    }
    const encrypted = val ? cryptoManager.encryptSecret(val, ctx, vsc) : val;
    const { siteUrl, username } = config.getSettings(vsc);
    if (siteUrl && ctx && ctx.secrets) {
        const key = config.getPasswordSecretKey(siteUrl, username);
        await ctx.secrets.store(key, encrypted);
    }
    if (ctx && ctx.secrets) {
        await ctx.secrets.store(config.SECRET_PASSWORD, encrypted);
    }
}

async function writeAuthToken(contextOrVal, vscodeOrVal, maybeVal) {
    let val = contextOrVal;
    let ctx = getExtensionContext().context;
    let vsc = getExtensionContext().vscode;
    if (maybeVal !== undefined) {
        ctx = contextOrVal || ctx;
        vsc = vscodeOrVal || vsc;
        val = maybeVal;
    }
    const encrypted = val ? cryptoManager.encryptSecret(val, ctx, vsc) : val;
    const { siteUrl } = config.getSettings(vsc);
    if (siteUrl && ctx && ctx.secrets) {
        const key = config.getTokenSecretKey(siteUrl);
        await ctx.secrets.store(key, encrypted);
    }
    if (ctx && ctx.secrets) {
        await ctx.secrets.store(config.SECRET_TOKEN, encrypted);
    }
}

async function runSetPassword(context, vscode) {
    const vsc = vscode || getExtensionContext().vscode;
    const ctx = context || getExtensionContext().context;
    const value = await vsc.window.showInputBox({ prompt: 'CPQ Password', password: true, ignoreFocusOut: true });
    if (value === undefined) return;

    await writePassword(ctx, vsc, value);
    vsc.window.showInformationMessage('CPQ-BML: password saved.');
}

async function runSetAuthToken(context, vscode) {
    const vsc = vscode || getExtensionContext().vscode;
    const ctx = context || getExtensionContext().context;
    const value = await vsc.window.showInputBox({ prompt: 'CPQ Auth Token', password: true, ignoreFocusOut: true });
    if (value === undefined) return;

    await writeAuthToken(ctx, vsc, value);
    vsc.window.showInformationMessage('CPQ-BML: auth token saved.');
}

async function deletePassword(context, vscode) {
    const ctx = context || getExtensionContext().context;
    const vsc = vscode || getExtensionContext().vscode;
    const { siteUrl, username } = config.getSettings(vsc);
    if (siteUrl && username && ctx && ctx.secrets) {
        const key = config.getPasswordSecretKey(siteUrl, username);
        await ctx.secrets.delete(key);
    }
    if (ctx && ctx.secrets) {
        await ctx.secrets.delete(config.SECRET_PASSWORD);
    }
}

async function deleteAuthToken(context, vscode) {
    const ctx = context || getExtensionContext().context;
    const vsc = vscode || getExtensionContext().vscode;
    const { siteUrl } = config.getSettings(vsc);
    if (siteUrl && ctx && ctx.secrets) {
        const key = config.getTokenSecretKey(siteUrl);
        await ctx.secrets.delete(key);
    }
    if (ctx && ctx.secrets) {
        await ctx.secrets.delete(config.SECRET_TOKEN);
    }
}

module.exports = {
    runSetPassword,
    runSetAuthToken,
    writePassword,
    writeAuthToken,
    deletePassword,
    deleteAuthToken,
};
