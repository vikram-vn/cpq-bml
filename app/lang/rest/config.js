const fs = require("fs");
const pathLib = require("path");
const { request } = require("@/lang/rest/client");
const cryptoManager = require("@/lang/rest/crypto");

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

function getWorkspaceRoot(vscode) {
    if (
        vscode &&
        vscode.workspace &&
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
    ) {
        const folder = vscode.workspace.workspaceFolders[0];
        return folder.uri ? folder.uri.fsPath : (typeof folder === "string" ? folder : null);
    }
    return null;
}

function resolveCommerceScope(vscode, { process, document } = {}) {
    return {
        process: process || getCommerceProcess(vscode) || "oraclecpqo",
        document: document || getCommerceDocument(vscode) || "transaction",
    };
}

function getSettings(vscode) {
    const config = vscode && vscode.workspace && typeof vscode.workspace.getConfiguration === "function"
        ? vscode.workspace.getConfiguration("cpqBml")
        : null;

    const getVal = (configKey, defaultVal) => {
        if (config) {
            const val = config.get(configKey);
            if (val !== undefined && val !== null) {
                return val;
            }
        }
        return defaultVal;
    };

    const envSite = process.env.CPQ_SITE_URL || "";
    const envUser = process.env.CPQ_USERNAME || "";
    const envAuthMethod = process.env.CPQ_AUTH_METHOD || (process.env.CPQ_TOKEN ? "bearer" : "basic");
    const envProcess = process.env.CPQ_COMMERCE_PROCESS || "";
    const envDocument = process.env.CPQ_COMMERCE_DOCUMENT || "";
    const envProductFamily = process.env.CPQ_PRODUCT_FAMILY || "";

    return {
        siteUrl: normalizeSiteUrl(getVal("connection.siteUrl", envSite)),
        authMethod: getVal("connection.authMethod", envAuthMethod),
        username: getVal("connection.username", envUser),
        restVersion: getVal("rest.restVersion", DEFAULT_REST_VERSION),
        commerceProcess: getVal("rest.commerceProcess", envProcess || "oraclecpqo"),
        commerceDocument: getVal("rest.commerceDocument", envDocument || "transaction"),
        productFamily: getVal("rest.productFamily", envProductFamily || ""),
        pullFolder: getVal("rest.pullFolder", "library"),
        debugLog: Boolean(getVal("debug.logRestDetails", false)),
        logOutputToFile: Boolean(getVal("debug.logOutputToFile", false)),
        showResultsAsTable: Boolean(getVal("debug.showResultsAsTable", false)),
        debugConcurrency: getDebugConcurrency(vscode),
    };
}

function getSmartDebugReuseInputs(vscode) {
    const config = vscode && vscode.workspace && typeof vscode.workspace.getConfiguration === "function"
        ? vscode.workspace.getConfiguration("cpqBml")
        : null;
    const val = config ? config.get("debug.smartReuseInputs") : undefined;
    return val !== false; // default true
}

function getDebugConcurrency(vscode) {
    const config = vscode && vscode.workspace && typeof vscode.workspace.getConfiguration === "function"
        ? vscode.workspace.getConfiguration("cpqBml")
        : null;
    const val = config ? config.get("debug.concurrency") : undefined;
    if (val !== undefined && val !== null && !isNaN(Number(val))) {
        return Math.max(2, Math.min(10, Math.round(Number(val))));
    }
    return 2;
}

async function saveWorkspaceConfig(vscode, settings) {
    if (!vscode || !vscode.workspace || !settings) return;
    const config = vscode.workspace.getConfiguration("cpqBml");
    if (!config || typeof config.update !== "function") return;
    if (settings.siteUrl !== undefined) await config.update("connection.siteUrl", settings.siteUrl, false);
    if (settings.username !== undefined) await config.update("connection.username", settings.username, false);
    if (settings.authMethod !== undefined) await config.update("connection.authMethod", settings.authMethod, false);
    if (settings.restVersion !== undefined) await config.update("rest.restVersion", settings.restVersion, false);
    if (settings.commerceProcess !== undefined) await config.update("rest.commerceProcess", settings.commerceProcess, false);
    if (settings.commerceDocument !== undefined) await config.update("rest.commerceDocument", settings.commerceDocument, false);
    if (settings.productFamily !== undefined) await config.update("rest.productFamily", settings.productFamily, false);
    if (settings.pullFolder !== undefined) await config.update("rest.pullFolder", settings.pullFolder, false);
    if (settings.debugConcurrency !== undefined) await config.update("debug.concurrency", Math.max(2, Math.min(10, Math.round(Number(settings.debugConcurrency)) || 2)), false);

    // Ensure connection settings are never left in cpq/config
    const root = getWorkspaceRoot(vscode);
    if (root) {
        const obsoleteConfigMin = pathLib.join(root, "cpq", "config", "config.min.json");
        if (fs.existsSync(obsoleteConfigMin)) {
            try { fs.unlinkSync(obsoleteConfigMin); } catch (e) {}
        }
        const obsoleteConfigJson = pathLib.join(root, "cpq", "config", "config.json");
        if (fs.existsSync(obsoleteConfigJson)) {
            try { fs.unlinkSync(obsoleteConfigJson); } catch (e) {}
        }
    }
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

function getEffectiveRestVersion(vscodeOrVersion, minVersion = 19) {
    let version = '';
    if (typeof vscodeOrVersion === 'string') {
        version = vscodeOrVersion;
    } else if (vscodeOrVersion && typeof vscodeOrVersion === 'object') {
        version = getRestVersion(vscodeOrVersion);
    }
    const verNum = parseInt((version || '').replace(/^v/i, ''), 10);
    return !isNaN(verNum) && verNum >= minVersion ? version : `v${minVersion}`;
}

function getCommerceProcess(vscode) {
    return getSettings(vscode).commerceProcess;
}

function getCommerceDocument(vscode) {
    return getSettings(vscode).commerceDocument;
}

function getProductFamily(vscode) {
    return getSettings(vscode).productFamily;
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
    if (!vscode && context && (context.workspace || context.window || context.commands)) {
        vscode = context;
        context = null;
    }
    const { siteUrl, authMethod, username } = getSettings(vscode);
    const config = vscode && vscode.workspace && typeof vscode.workspace.getConfiguration === 'function'
        ? vscode.workspace.getConfiguration('cpqBml')
        : null;
    const environments = config ? (config.get('connection.environments', []) || []) : [];
    const hasMultipleEnvs = environments.length > 1;

    if (authMethod === 'bearer') {
        const siteSpecificKey = getTokenSecretKey(siteUrl);
        let token = context && context.secrets && typeof context.secrets.get === 'function'
            ? await context.secrets.get(siteSpecificKey)
            : null;
        if (!token && !hasMultipleEnvs && context && context.secrets && typeof context.secrets.get === 'function') {
            token = await context.secrets.get(SECRET_TOKEN);
        }
        if (!token && process.env.CPQ_TOKEN) {
            token = process.env.CPQ_TOKEN;
        }
        if (!token) {
            throw new Error('CPQ-BML: no auth token set. Run "CPQ-BML: Set CPQ Auth Token" first.');
        }
        const plainToken = cryptoManager.decryptSecret(token, context, vscode);
        return `Bearer ${plainToken}`;
    }

    if (!username) {
        throw new Error('CPQ-BML: cpqBml.connection.username is not configured.');
    }
    const siteSpecificKey = getPasswordSecretKey(siteUrl, username);
    let password = context && context.secrets && typeof context.secrets.get === 'function'
        ? await context.secrets.get(siteSpecificKey)
        : null;
    if (!password && !hasMultipleEnvs && context && context.secrets && typeof context.secrets.get === 'function') {
        password = await context.secrets.get(SECRET_PASSWORD);
    }
    if (!password && process.env.CPQ_PASSWORD) {
        password = process.env.CPQ_PASSWORD;
    }
    if (!password) {
        throw new Error('CPQ-BML: no password set. Run "CPQ-BML: Set CPQ Password" first.');
    }
    const plainPassword = cryptoManager.decryptSecret(password, context, vscode);
    const encoded = Buffer.from(`${username}:${plainPassword}`).toString('base64');
    return `Basic ${encoded}`;
}

// True if any REST call would fail immediately for lack of siteUrl/username/secret.
async function hasMissingCredentials(context, vscode) {
    const { siteUrl, authMethod, username } = getSettings(vscode);
    if (!siteUrl) {
        return true;
    }
    const config = vscode && vscode.workspace && typeof vscode.workspace.getConfiguration === 'function'
        ? vscode.workspace.getConfiguration('cpqBml')
        : null;
    const environments = config ? (config.get('connection.environments', []) || []) : [];
    const hasMultipleEnvs = environments.length > 1;

    if (authMethod === 'bearer') {
        const siteSpecificKey = getTokenSecretKey(siteUrl);
        let token = context && context.secrets && typeof context.secrets.get === 'function'
            ? await context.secrets.get(siteSpecificKey)
            : null;
        if (!token && !hasMultipleEnvs && context && context.secrets && typeof context.secrets.get === 'function') {
            token = await context.secrets.get(SECRET_TOKEN);
        }
        if (!token && process.env.CPQ_TOKEN) {
            token = process.env.CPQ_TOKEN;
        }
        return !token;
    }
    if (!username) {
        return true;
    }
    const siteSpecificKey = getPasswordSecretKey(siteUrl, username);
    let password = context && context.secrets && typeof context.secrets.get === 'function'
        ? await context.secrets.get(siteSpecificKey)
        : null;
    if (!password && !hasMultipleEnvs && context && context.secrets && typeof context.secrets.get === 'function') {
        password = await context.secrets.get(SECRET_PASSWORD);
    }
    if (!password && process.env.CPQ_PASSWORD) {
        password = process.env.CPQ_PASSWORD;
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
            const encryptedToken = cryptoManager.encryptSecret(value.trim(), context, vscode);
            await context.secrets.store(siteSpecificKey, encryptedToken);
            await context.secrets.store(SECRET_TOKEN, encryptedToken);
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
            const encryptedPassword = cryptoManager.encryptSecret(value, context, vscode);
            await context.secrets.store(siteSpecificKey, encryptedPassword);
            await context.secrets.store(SECRET_PASSWORD, encryptedPassword);
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

function getCpqSiteName(vscodeOrSiteUrl) {
    let siteUrl = '';
    if (typeof vscodeOrSiteUrl === 'string') {
        siteUrl = vscodeOrSiteUrl;
    } else if (vscodeOrSiteUrl) {
        siteUrl = getBaseUrl(vscodeOrSiteUrl) || '';
    }
    let host = '';
    try {
        if (siteUrl) {
            const raw = siteUrl.replace(/^https?:\/\//i, '');
            host = raw.split('/')[0].split(':')[0].split('.')[0];
        }
    } catch {
        host = '';
    }
    host = (host || '').trim();
    if (!host) {
        return 'default';
    }
    if (/^cpq[-_]/i.test(host)) {
        return host.replace(/_/g, '-');
    }
    return host;
}

function getCpqInstanceFolder(vscodeOrSiteUrl) {
    const host = getCpqSiteName(vscodeOrSiteUrl);
    if (host === 'default') {
        return 'cpq-default';
    }
    if (/^cpq[-_]/i.test(host)) {
        return host.replace(/_/g, '-');
    }
    return `cpq-${host}`;
}

function getUtilLibrariesFolder(vscodeOrSiteUrl) {
    const site = getCpqSiteName(vscodeOrSiteUrl);
    return pathLib.join('cpq', site, 'util-libraries');
}

function getCommerceLibrariesFolder(vscodeOrSiteUrl, processName) {
    if (!vscodeOrSiteUrl && !processName) {
        return pathLib.join('cpq', 'commerce-libraries');
    }
    const site = getCpqSiteName(vscodeOrSiteUrl);
    const proc = processName || (vscodeOrSiteUrl && typeof vscodeOrSiteUrl === 'object' && getCommerceProcess(vscodeOrSiteUrl)) || '';
    if (proc) {
        return pathLib.join('cpq', site, proc, 'commerce-libraries');
    }
    return pathLib.join('cpq', site, 'commerce-libraries');
}

function getDataTableFolder(workspaceRoot, vscodeOrSiteUrl) {
    const site = getCpqSiteName(vscodeOrSiteUrl);
    const rel = pathLib.join('cpq', site, 'data-tables');
    return workspaceRoot ? pathLib.join(workspaceRoot, rel) : rel;
}

function isConfigured(vscode) {
    const { siteUrl } = getSettings(vscode);
    return Boolean(siteUrl);
}

module.exports = {
    isConfigured,
    DEFAULT_REST_VERSION,
    DEFAULT_DOMAIN_SUFFIX,
    SECRET_PASSWORD,
    SECRET_TOKEN,
    getPasswordSecretKey,
    getTokenSecretKey,
    normalizeSiteUrl,
    getCpqSiteName,
    getCpqInstanceFolder,
    getUtilLibrariesFolder,
    getCommerceLibrariesFolder,
    getDataTableFolder,
    getSettings,
    getSmartDebugReuseInputs,
    getBaseUrl,
    getRestVersion,
    getEffectiveRestVersion,
    getCommerceProcess,
    getCommerceDocument,
    getProductFamily,
    getAuthHeader,
    getDebugOutputLogPath,
    getDebugPrintLogPath,
    getShowDebugResultsAsTable,
    hasMissingCredentials,
    runTestConnection,
    ensureCredentials,
    saveWorkspaceConfig,
    getDebugConcurrency,
    getWorkspaceRoot,
    resolveCommerceScope,
};
