const fs = require("fs");
const pathLib = require("path");
const { request } = require("./client");

const DEFAULT_REST_VERSION = 'v18';
const DEFAULT_DOMAIN_SUFFIX = '.bigmachines.com';

const SECRET_PASSWORD = 'cpqBml.connection.password';
const SECRET_TOKEN = 'cpqBml.connection.token';

// Normalizes any accepted siteUrl form to canonical "https://host" (no trailing slash).
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
        restVersion: config.get('rest.restVersion', DEFAULT_REST_VERSION),
        commerceProcess: config.get('rest.commerceProcess', 'oraclecpqo'),
        commerceDocument: config.get('rest.commerceDocument', 'transaction'),
        pullFolder: config.get('rest.pullFolder', 'library'),
        debugLog: config.get('debug.logRestDetails', false),
        logOutputToFile: config.get('debug.logOutputToFile', false),
        showResultsAsTable: config.get('debug.showResultsAsTable', false)
    };
}

function getDebugOutputLogPath(vscode) {
    const { logOutputToFile } = getSettings(vscode);
    if (!logOutputToFile) return null;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;
    const logsDir = pathLib.join(folders[0].uri.fsPath, 'logs', 'transaction-debug-logs');
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (e) {}
    return pathLib.join(logsDir, 'bml_debug_output.log');
}

function getDebugPrintLogPath(vscode) {
    const { logOutputToFile } = getSettings(vscode);
    if (!logOutputToFile) return null;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;
    const logsDir = pathLib.join(folders[0].uri.fsPath, 'logs', 'transaction-debug-logs');
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (e) {}
    return pathLib.join(logsDir, 'bml_debug_print.log');
}

function getBaseUrl(vscode) {
    return getSettings(vscode).siteUrl;
}

function getShowDebugResultsAsTable(vscode) {
    return vscode.workspace.getConfiguration('cpqBml').get('debug.showResultsAsTable', false);
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
    const config = vscode.workspace.getConfiguration('cpqBml');
    const environments = config.get('connection.environments', []) || [];
    const hasMultipleEnvs = environments.length > 1;

    if (authMethod === 'bearer') {
        const siteSpecificKey = getTokenSecretKey(siteUrl);
        let token = await context.secrets.get(siteSpecificKey);
        if (!token && !hasMultipleEnvs) {
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
    if (!password && !hasMultipleEnvs) {
        password = await context.secrets.get(SECRET_PASSWORD);
    }
    if (!password) {
        throw new Error('CPQ-BML: no password set. Run "CPQ-BML: Set CPQ Password" first.');
    }
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    return `Basic ${encoded}`;
}

// True if any REST call would fail immediately for lack of siteUrl/username/secret.
async function hasMissingCredentials(context, vscode) {
    const { siteUrl, authMethod, username } = getSettings(vscode);
    if (!siteUrl) {
        return true;
    }
    const config = vscode.workspace.getConfiguration('cpqBml');
    const environments = config.get('connection.environments', []) || [];
    const hasMultipleEnvs = environments.length > 1;

    if (authMethod === 'bearer') {
        const siteSpecificKey = getTokenSecretKey(siteUrl);
        let token = await context.secrets.get(siteSpecificKey);
        if (!token && !hasMultipleEnvs) {
            token = await context.secrets.get(SECRET_TOKEN);
        }
        return !token;
    }
    if (!username) {
        return true;
    }
    const siteSpecificKey = getPasswordSecretKey(siteUrl, username);
    let password = await context.secrets.get(siteSpecificKey);
    if (!password && !hasMultipleEnvs) {
        password = await context.secrets.get(SECRET_PASSWORD);
    }
    return !password;
}

// No prompts/toasts — just a structured result. `reason` lets callers (ensureCredentials below) distinguish blocking failures (auth/permission) from non-blocking ones (network/config).
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

    const environments = config.get('connection.environments', []) || [];
    const hasMultipleEnvs = environments.length > 1;

    if (authMethod === 'bearer') {
        const siteSpecificKey = getTokenSecretKey(normalizedSite);
        let token = await context.secrets.get(siteSpecificKey);
        if (!token && !hasMultipleEnvs) {
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
        if (!password && !hasMultipleEnvs) {
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

    // Only auth/permission failures block; network/config issues let the user proceed.
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
    getShowDebugResultsAsTable,
    hasMissingCredentials,
    runTestConnection,
    ensureCredentials
};
