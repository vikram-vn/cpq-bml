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
    runCreateOverride,
    runRemoveOverride,
} = require('../../rest/commands');
const { createToolVscodeContext, createCapturingTerminal } = require('../proxy');
const { findOrCreateAiCopy } = require('../locate');
const { getAiTerminal } = require('../aiTerminal');
const { pullFunction } = require('./lookup');

// Operates on the "<variableName>_ai" working copy, never the pulled canonical file.
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

// Pre-seeds debug.js's workspaceState cache with the AI-supplied inputs, then auto-answers
// its QuickPick with "run with last inputs" to reuse the same payload-building logic.
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

    // Pulled back instead of written locally: CPQ assigns canonical fields (folderName, namespace) we didn't set.
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

// Standard (system) functions cannot be validated/saved/deployed until overridden -
// this is the step that unblocks that entire pipeline for an AI working on one.
async function createOverride(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, error: located.error };

    const { vscodeProxy, messages } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runCreateOverride(context, vscodeProxy, terminal, { transport });
    return outcomeFrom(messages, getLines());
}

// Destructive: reverts to the system version and discards local override customizations.
// confirm:true is the safety gate here since there is no human at a modal to click through.
async function removeOverride(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    if (args.confirm !== true) {
        return {
            success: false,
            error: 'Removing an override reverts to the CPQ system version and discards local override customizations. Re-call with confirm:true to proceed.',
        };
    }
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, error: located.error };

    const { vscodeProxy, messages } = createToolVscodeContext(vscode, {
        bmlPath: located.bmlPath,
        warningConfirm: 'Remove Override',
    });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runRemoveOverride(context, vscodeProxy, terminal, { transport });
    return outcomeFrom(messages, getLines());
}

module.exports = {
    saveFunction,
    validateFunction,
    deployFunction,
    debugFunction,
    massDeployUtilFunctions,
    deployCommerceProcess,
    createUtilFunction,
    createOverride,
    removeOverride,
};
