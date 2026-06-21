const DEFAULT_REST_VERSION = 'v18';
const DEFAULT_DOMAIN_SUFFIX = '.bigmachines.com';

const SECRET_PASSWORD = 'cpqBml.connection.password';
const SECRET_TOKEN = 'cpqBml.connection.token';

// Accepts any of the documented cpqBml.connection.siteUrl forms and normalizes
// them to a single canonical "https://host" (no trailing slash) form:
//   https://sitename.bigmachines.com/  -> https://sitename.bigmachines.com
//   https://sitename.bigmachines.com   -> https://sitename.bigmachines.com
//   sitename.bigmachines.com/          -> https://sitename.bigmachines.com
//   sitename.bigmachines.com           -> https://sitename.bigmachines.com
//   sitename                           -> https://sitename.bigmachines.com
function normalizeSiteUrl(rawSiteUrl) {
    let value = (rawSiteUrl || '').trim().replace(/\/+$/, '');
    if (!value) return '';

    if (!/^https?:\/\//i.test(value)) {
        value = `https://${value}`;
    }

    const url = new URL(value);
    if (!url.hostname.includes('.')) {
        url.hostname = `${url.hostname}${DEFAULT_DOMAIN_SUFFIX}`;
        value = url.toString().replace(/\/+$/, '');
    }

    return value;
}

function getSettings(vscode) {
    const config = vscode.workspace.getConfiguration('cpqBml');
    return {
        siteUrl: normalizeSiteUrl(config.get('connection.siteUrl', '')),
        authMethod: config.get('connection.authMethod', 'basic'),
        username: config.get('connection.username', ''),
        restVersion: config.get('connection.restVersion', DEFAULT_REST_VERSION),
        commerceProcess: config.get('connection.commerceProcess', 'oraclecpqo'),
        commerceDocument: config.get('connection.commerceDocument', 'transaction'),
        pullFolder: config.get('rest.pullFolder', 'library'),
        debugLog: config.get('connection.debugLog', false),
        logOutputToFile: config.get('debug.logOutputToFile', false)
    };
}

// Both helpers below are gated on the same cpqBml.debug.logOutputToFile toggle
// so the user only needs to flip one switch to get both log files.
// Returns null when the setting is off or no workspace folder is open.

// Script return value log  →  <workspace>/bml_debug_output.log
function getDebugOutputLogPath(vscode) {
    const { logOutputToFile } = getSettings(vscode);
    if (!logOutputToFile) return null;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;
    const pathLib = require('path');
    return pathLib.join(folders[0].uri.fsPath, 'bml_debug_output.log');
}

// Print statement log  →  <workspace>/bml_debug_print.log
function getDebugPrintLogPath(vscode) {
    const { logOutputToFile } = getSettings(vscode);
    if (!logOutputToFile) return null;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;
    const pathLib = require('path');
    return pathLib.join(folders[0].uri.fsPath, 'bml_debug_print.log');
}

// e.g. siteUrl "https://sitename.oracle.com" -> "https://sitename.oracle.com"
// (the /rest/<version>/... portion is appended per-call by api.js, since
// client.js's request() only looks at the hostname/port of this base URL.)
function getBaseUrl(vscode) {
    return getSettings(vscode).siteUrl;
}

function getRestVersion(vscode) {
    return getSettings(vscode).restVersion;
}

function getCommerceProcess(vscode) {
    return getSettings(vscode).commerceProcess;
}

function getCommerceDocument(vscode) {
    return getSettings(vscode).commerceDocument;
}

function getPasswordSecretKey(siteUrl, username) {
    const normalizedSite = normalizeSiteUrl(siteUrl).replace(/[^a-zA-Z0-9]/g, '_');
    const normalizedUser = (username || '').trim().replace(/[^a-zA-Z0-9]/g, '_');
    return `cpqBml.connection.password.${normalizedSite}.${normalizedUser}`;
}

function getTokenSecretKey(siteUrl) {
    const normalizedSite = normalizeSiteUrl(siteUrl).replace(/[^a-zA-Z0-9]/g, '_');
    return `cpqBml.connection.token.${normalizedSite}`;
}

async function getAuthHeader(context, vscode) {
    const { siteUrl, authMethod, username } = getSettings(vscode);

    if (authMethod === 'bearer') {
        const siteSpecificKey = getTokenSecretKey(siteUrl);
        let token = await context.secrets.get(siteSpecificKey);
        if (!token) {
            token = await context.secrets.get(SECRET_TOKEN);
        }
        if (!token) {
            throw new Error('CPQ-BML: no auth token set. Run "CPQ-BML: Set CPQ Auth Token" first.');
        }
        return `Bearer ${token}`;
    }

    if (!username) {
        throw new Error('CPQ-BML: cpqBml.connection.username is not configured.');
    }
    const siteSpecificKey = getPasswordSecretKey(siteUrl, username);
    let password = await context.secrets.get(siteSpecificKey);
    if (!password) {
        password = await context.secrets.get(SECRET_PASSWORD);
    }
    if (!password) {
        throw new Error('CPQ-BML: no password set. Run "CPQ-BML: Set CPQ Password" first.');
    }
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    return `Basic ${encoded}`;
}

// Live connectivity + permission check against current settings/secrets -
// no prompts, no toasts, just a structured result. `reason` lets callers
// distinguish failures that should block (auth/permission) from ones that
// shouldn't (network/config) - see ensureCredentials below, which is the
// toast-driven CLI/QuickPick flow built on top of this. The settings webview's
// "Test Connection" button calls this directly instead.
async function runTestConnection(context, vscode, transport) {
    const siteUrl = getBaseUrl(vscode);
    if (!siteUrl) {
        return { ok: false, reason: 'config', message: 'CPQ-BML: cpqBml.connection.siteUrl is not configured.' };
    }

    let authHeader;
    try {
        authHeader = await getAuthHeader(context, vscode);
    } catch (err) {
        return { ok: false, reason: 'config', message: err.message };
    }

    try {
        const version = getRestVersion(vscode);
        const { request } = require('./client');
        const { statusCode, body } = await request({
            baseUrl: normalizeSiteUrl(siteUrl),
            path: `/rest/${version}/currentUser`,
            method: 'GET',
            authHeader,
            transport
        });
        if (statusCode === 401 || statusCode === 403) {
            return { ok: false, reason: 'auth', message: 'CPQ-BML: Authentication failed. Please check your CPQ username and password/token.' };
        }
        if (statusCode >= 200 && statusCode < 300) {
            if (body && typeof body === 'object' && body.isSystemAdmin === false) {
                return { ok: false, reason: 'permission', message: 'CPQ-BML: User is not a System Administrator. Please ensure your user has FullAdmin permissions to use CPQ REST functions.' };
            }
            return { ok: true, message: 'CPQ-BML: connection successful.' };
        }
        return { ok: false, reason: 'network', message: `CPQ-BML: unexpected response (HTTP ${statusCode}).` };
    } catch (err) {
        return { ok: false, reason: 'network', message: `CPQ-BML: connection failed - ${err.message}` };
    }
}

async function ensureCredentials(context, vscode) {
    const config = vscode.workspace.getConfiguration('cpqBml');
    let siteUrl = config.get('connection.siteUrl', '').trim();
    let username = config.get('connection.username', '').trim();
    const authMethod = config.get('connection.authMethod', 'basic');

    if (!siteUrl) {
        const value = await vscode.window.showInputBox({
            prompt: 'Enter CPQ Site URL (e.g. sitename or sitename.bigmachines.com)',
            placeHolder: 'sitename.bigmachines.com',
            ignoreFocusOut: true,
            validateInput: (val) => val && val.trim() ? null : 'Site URL is required'
        });
        if (value === undefined) return false;
        siteUrl = value.trim();
        await config.update('connection.siteUrl', siteUrl, vscode.ConfigurationTarget.Global);
    }

    const normalizedSite = normalizeSiteUrl(siteUrl);

    if (authMethod === 'bearer') {
        const siteSpecificKey = getTokenSecretKey(normalizedSite);
        let token = await context.secrets.get(siteSpecificKey);
        if (!token) {
            token = await context.secrets.get(SECRET_TOKEN);
        }
        if (!token) {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter CPQ Bearer Token',
                password: true,
                ignoreFocusOut: true,
                validateInput: (val) => val && val.trim() ? null : 'Token is required'
            });
            if (value === undefined) return false;
            await context.secrets.store(siteSpecificKey, value.trim());
            await context.secrets.store(SECRET_TOKEN, value.trim());
        }
    } else {
        if (!username) {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter CPQ Username',
                placeHolder: 'username',
                ignoreFocusOut: true,
                validateInput: (val) => val && val.trim() ? null : 'Username is required'
            });
            if (value === undefined) return false;
            username = value.trim();
            await config.update('connection.username', username, vscode.ConfigurationTarget.Global);
        }

        const siteSpecificKey = getPasswordSecretKey(normalizedSite, username);
        let password = await context.secrets.get(siteSpecificKey);
        if (!password) {
            password = await context.secrets.get(SECRET_PASSWORD);
        }
        if (!password) {
            const value = await vscode.window.showInputBox({
                prompt: 'Enter CPQ Password',
                password: true,
                ignoreFocusOut: true,
                validateInput: (val) => val && val.length > 0 ? null : 'Password is required'
            });
            if (value === undefined) return false;
            await context.secrets.store(siteSpecificKey, value);
            await context.secrets.store(SECRET_PASSWORD, value);
        }
    }

    if (process.env.VSCODE_TEXTTEST_MODULE || typeof global.it === 'function') {
        return true;
    }

    // Auth/permission failures block and surface a toast; network/config
    // issues let the user proceed (same as the inline check this replaced).
    const result = await runTestConnection(context, vscode);
    if (!result.ok && (result.reason === 'auth' || result.reason === 'permission')) {
        vscode.window.showErrorMessage(result.message);
        return false;
    }

    return true;
}

module.exports = {
    DEFAULT_REST_VERSION,
    DEFAULT_DOMAIN_SUFFIX,
    SECRET_PASSWORD,
    SECRET_TOKEN,
    getPasswordSecretKey,
    getTokenSecretKey,
    normalizeSiteUrl,
    getSettings,
    getBaseUrl,
    getRestVersion,
    getCommerceProcess,
    getCommerceDocument,
    getAuthHeader,
    getDebugOutputLogPath,
    getDebugPrintLogPath,
    runTestConnection,
    ensureCredentials
};
