const api = require('../../rest/api');
const metadataLib = require('../../rest/metadata');
const {
    isSuccess,
    describeError,
    getTimestamp,
    writeRunHeader,
    writeRunningLine,
    writeTerminalMessage,
    formatElapsed,
} = require('../../rest/commands/shared');
const {
    runSaveCurrentFile,
    runValidateCurrentFile,
    runDebugCurrentFile,
    runDeployCurrentFile,
    runDeployUtilFunctions,
    runDeployCommerceProcess,
} = require('../../rest/commands');
const { createToolVscodeContext, createCapturingTerminal } = require('../proxy');
const { findOrCreateAiCopy } = require('../locate');
const { getAiTerminal } = require('../aiTerminal');
const { pullFunction } = require('./lookup');

// Every lifecycle tool reads/writes the "<variableName>-AI" copy, never the
// pulled (canonical) file directly - that copy is created on first access if
// it doesn't exist yet (see findOrCreateAiCopy), so the pristine pulled
// version always stays available as a diff baseline.
function requireLocalFile(vscode, variableName) {
    const bmlPath = findOrCreateAiCopy(vscode, variableName);
    if (!bmlPath) {
        return { error: `No local file found for "${variableName}". Run pull_function first.` };
    }
    return { bmlPath };
}

function outcomeFrom(messages, lines) {
    const success = messages.error.length === 0;
    return {
        success,
        message: success ? messages.info[0] : messages.error[0],
        log: lines,
    };
}

async function saveFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, error: located.error };

    const { vscodeProxy, messages } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runSaveCurrentFile(context, vscodeProxy, terminal, { transport });
    return outcomeFrom(messages, getLines());
}

async function validateFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, error: located.error };

    const { vscodeProxy, messages } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const diagnosticCollection = { delete: () => {}, set: () => {} };
    await runValidateCurrentFile(context, vscodeProxy, diagnosticCollection, terminal, { transport });
    return outcomeFrom(messages, getLines());
}

async function deployFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, error: located.error };

    const { vscodeProxy, messages } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runDeployCurrentFile(context, vscodeProxy, terminal, { transport });
    return outcomeFrom(messages, getLines());
}

// debug.js caches the last transaction/parameter values per function under
// context.workspaceState and offers a QuickPick to reuse them. Pre-seeding
// that cache with the AI-supplied values, then auto-answering the QuickPick
// with "run with last inputs", reuses the exact same payload-building logic
// without needing a human to type values into an InputBox.
async function debugFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, error: located.error };

    const metadata = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(located.bmlPath));
    if (!metadata) return { success: false, error: `No local metadata found for "${variableName}". Run pull_function first.` };

    const isCommerce = !!metadata.commerceDocument;
    const transactionId = args && args.transactionId;
    if (isCommerce && !transactionId) {
        return { success: false, error: 'transactionId is required to debug a commerce function.' };
    }
    const parameterValues = (args && args.parameters) || {};

    const hasInputs = (metadata.parameters && metadata.parameters.length > 0) || isCommerce;
    if (hasInputs && context.workspaceState) {
        await context.workspaceState.update(`debugCache:${variableName}`, { transactionId, parameterValues });
    }

    const quickPickSelector = (items) => items.find((i) => i.id === 'last');
    const { vscodeProxy, messages } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath, quickPickSelector });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runDebugCurrentFile(context, vscodeProxy, terminal, { transport });
    const success = messages.error.length === 0;
    return { success, message: success ? undefined : messages.error[0], log: getLines() };
}

async function massDeployUtilFunctions(context, vscode, args, transport) {
    const variableNames = args && args.variableNames;
    if (!Array.isArray(variableNames) || variableNames.length === 0) {
        return { success: false, error: 'variableNames (a non-empty array) is required.' };
    }

    const quickPickSelector = (items) => items.filter((i) => variableNames.includes(i.item.variableName));
    const { vscodeProxy, messages } = createToolVscodeContext(vscode, { quickPickSelector });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runDeployUtilFunctions(context, vscodeProxy, terminal, { transport });
    return outcomeFrom(messages, getLines());
}

async function deployCommerceProcess(context, vscode, args, transport) {
    const configOverrides = {};
    if (args && args.processVarName) configOverrides['rest.commerceProcess'] = args.processVarName;

    const { vscodeProxy, messages } = createToolVscodeContext(vscode, { configOverrides });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runDeployCommerceProcess(context, vscodeProxy, terminal, { transport });
    const success = messages.error.length === 0;
    return {
        success,
        message: messages.info[0] || messages.warning[0] || messages.error[0],
        log: getLines(),
    };
}

// Builds and POSTs a new util function directly (no interactive scaffold
// flow), then writes it locally so Save/Validate/Debug work on it right away.
async function createUtilFunction(context, vscode, args, transport) {
    const { variableName, name, description, returnType, parameters, scriptText } = args || {};
    if (!variableName || !name || !returnType) {
        return { success: false, error: 'variableName, name, and returnType are required.' };
    }

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    writeRunHeader(terminal, 'Create', variableName);
    writeRunningLine(terminal, 'Create', variableName);
    terminal.show();

    const metadata = {
        variableName,
        name,
        description: description || '',
        returnType,
        parameters: parameters || [],
        testScript: '',
        useTestScript: false,
        libraryFunctions: [],
        attributes: [],
    };
    const finalScriptText = scriptText || 'return "";';
    const payload = metadataLib.buildFunctionPayload(metadata, finalScriptText);

    const startedAt = Date.now();
    const result = await api.createLibraryFunction(context, vscode, payload, transport);
    if (!isSuccess(result.statusCode)) {
        const message = `Create failed (HTTP ${result.statusCode}). ${describeError(result.body)}`;
        writeTerminalMessage(terminal, 'Create failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
        return { success: false, error: message, log: getLines() };
    }

    // Pull it straight back rather than writing our own local copy: CPQ may
    // assign canonical fields (folderName, namespace) we didn't set on the
    // way in, and pullFunction already knows the one correct on-disk path
    // for a function with those fields - writing locally here too would
    // risk a second, divergent copy of the same function.
    const pulled = await pullFunction(context, vscode, { variableName, type: 'util' }, transport);
    const log = getLines().concat(pulled.log || []);
    if (!pulled.success) {
        const message = `Created "${variableName}" on CPQ, but failed to pull it back locally: ${pulled.error}`;
        writeTerminalMessage(terminal, 'Create: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[33m');
        return { success: true, message, log };
    }
    terminal.writeLine(`\x1b[32m${getTimestamp()} Created (${formatElapsed(startedAt)})\x1b[0m`);
    return { success: true, message: `Created "${variableName}".`, localPath: pulled.localPath, log };
}

module.exports = {
    saveFunction,
    validateFunction,
    deployFunction,
    debugFunction,
    massDeployUtilFunctions,
    deployCommerceProcess,
    createUtilFunction,
};
