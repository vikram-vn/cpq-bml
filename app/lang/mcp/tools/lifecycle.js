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
const { findOrCreateAiCopy, findLocalBmlPath, resetAiCopy } = require('../locate');
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

// Common shape for every tool below: wraps a rest/commands run*() function's structured
// {success, errorMessage, ...} result into the tool's consistent shape - "error" is only
// ever present on failure, everything else the underlying command returned (elapsedMs,
// statusCode, processVarName, etc.) passes through untouched. extra (e.g. {variableName})
// is spread first so the caller never has to cross-reference its own input args to know
// what the result is about, but a same-named field on the underlying result (e.g. a
// resolved processVarName) always wins since it reflects what actually happened.
function structuredOutcome(extra, result, lines) {
    const { success, errorMessage, ...rest } = result || {};
    if (!success) {
        return { success: false, ...extra, error: errorMessage || 'Operation failed for an unknown reason.', ...rest, log: lines };
    }
    return { success: true, ...extra, ...rest, log: lines };
}

async function saveFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const { vscodeProxy } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const result = await runSaveCurrentFile(context, vscodeProxy, terminal, { transport });
    return structuredOutcome({ variableName }, result, getLines());
}

async function validateFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const { vscodeProxy } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const diagnosticCollection = { delete: () => {}, set: () => {} };
    const result = await runValidateCurrentFile(context, vscodeProxy, diagnosticCollection, terminal, { transport });

    if (!result || !result.success) {
        return {
            success: false,
            variableName,
            error: (result && result.errorMessage) || 'Validation failed for an unknown reason.',
            errorLine: result && result.errorLine,
            log: getLines(),
        };
    }
    return { success: true, variableName, elapsedMs: result.elapsedMs, log: getLines() };
}

async function deployFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    if (args.confirm !== true) {
        return {
            success: false,
            variableName,
            error: 'Deploying a function to the live CPQ environment requires human permission. Re-call with confirm:true to proceed.',
        };
    }
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const { vscodeProxy } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath, warningConfirm: 'Deploy' });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const result = await runDeployCurrentFile(context, vscodeProxy, terminal, { transport });
    return structuredOutcome({ variableName }, result, getLines());
}

// Pre-seeds debug.js's workspaceState cache with the AI-supplied inputs, then auto-answers
// its QuickPick with "run with last inputs" to reuse the same payload-building logic.
async function debugFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const metadata = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(located.bmlPath));
    if (!metadata) return { success: false, variableName, error: `No local metadata found for "${variableName}". Run pull_function first.` };

    const isCommerce = !!metadata.commerceDocument;
    const transactionId = args && args.transactionId;
    if (isCommerce && !transactionId) {
        return { success: false, variableName, error: 'transactionId is required to debug a commerce function.' };
    }
    const parameterValues = (args && args.parameters) || {};

    const hasInputs = (metadata.parameters && metadata.parameters.length > 0) || isCommerce;
    if (hasInputs && context.workspaceState) {
        await context.workspaceState.update(`debugCache:${variableName}`, { transactionId, parameterValues });
    }

    const quickPickSelector = (items) => items.find((i) => i.id === 'last');
    const { vscodeProxy } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath, quickPickSelector });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const result = await runDebugCurrentFile(context, vscodeProxy, terminal, { transport });

    if (!result || !result.success) {
        return {
            success: false,
            variableName,
            error: (result && result.errorMessage) || 'Debug failed for an unknown reason.',
            errorLine: result && result.errorLine,
            log: getLines(),
        };
    }

    // table is populated only when returnValue matches the "documentNumber~variableName~value"
    // transaction dump format - a header (transaction-level) table plus a per-line table, split
    // out for the caller instead of making it re-parse the raw pipe/tilde-delimited string.
    const isPrintOnly = !!(
        args &&
        (args.printOnly ||
            args.showDebugPrintOnly ||
            args.debugPrintOnly ||
            args.printResultsOnly ||
            args.showDebugPrintResultsOnly)
    );

    if (isPrintOnly) {
        return {
            success: true,
            variableName,
            printOutput: result.printOutput,
            scriptSize: result.scriptSize,
            elapsedMs: result.elapsedMs,
            log: getLines(),
        };
    }

    return {
        success: true,
        variableName,
        returnValue: result.returnValue,
        table: result.table,
        printOutput: result.printOutput,
        scriptSize: result.scriptSize,
        elapsedMs: result.elapsedMs,
        log: getLines(),
    };
}

async function massDeployUtilFunctions(context, vscode, args, transport) {
    const variableNames = args && args.variableNames;
    if (!Array.isArray(variableNames) || variableNames.length === 0) {
        return { success: false, error: 'variableNames (a non-empty array) is required.' };
    }
    if (args.confirm !== true) {
        return {
            success: false,
            variableNames,
            error: 'Mass deploying util functions to the live CPQ environment requires human permission. Re-call with confirm:true to proceed.',
        };
    }

    const quickPickSelector = (items) => items.filter((i) => variableNames.includes(i.item.variableName));
    const { vscodeProxy } = createToolVscodeContext(vscode, { quickPickSelector, warningConfirm: 'Deploy' });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const result = await runDeployUtilFunctions(context, vscodeProxy, terminal, { transport });
    return structuredOutcome({ variableNames }, result, getLines());
}

async function deployCommerceProcess(context, vscode, args, transport) {
    if (args && args.confirm !== true) {
        return {
            success: false,
            error: 'Deploying a commerce process setup to the live CPQ environment requires human permission. Re-call with confirm:true to proceed.',
        };
    }
    const configOverrides = {};
    if (args && args.processVarName) configOverrides['rest.commerceProcess'] = args.processVarName;

    const { vscodeProxy } = createToolVscodeContext(vscode, { configOverrides, warningConfirm: 'Deploy' });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const result = await runDeployCommerceProcess(context, vscodeProxy, terminal, { transport });
    // No extra fields passed in: result.processVarName reflects what was actually resolved
    // (config default when args.processVarName was omitted), which is more accurate than
    // echoing back a possibly-undefined arg.
    return structuredOutcome({}, result, getLines());
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
        return { success: false, variableName, error: message, log: getLines() };
    }

    // Pulled back instead of written locally: CPQ assigns canonical fields (folderName, namespace) we didn't set.
    const pulled = await pullFunction(context, vscode, { variableName, type: 'util' }, transport);
    const log = getLines().concat(pulled.log || []);
    if (!pulled.success) {
        const message = `Created "${variableName}" on CPQ, but failed to pull it back locally: ${pulled.error}`;
        writeTerminalMessage(terminal, 'Create: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[33m');
        return { success: true, variableName, message, log };
    }
    terminal.writeLine(`\x1b[32m${getTimestamp()} Created (${formatElapsed(startedAt)})\x1b[0m`);
    return { success: true, variableName, message: `Created "${variableName}".`, localPath: pulled.localPath, log };
}

// Standard (system) functions cannot be validated/saved/deployed until overridden -
// this is the step that unblocks that entire pipeline for an AI working on one.
async function createOverride(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const { vscodeProxy } = createToolVscodeContext(vscode, { bmlPath: located.bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const result = await runCreateOverride(context, vscodeProxy, terminal, { transport });
    return structuredOutcome({ variableName }, result, getLines());
}

// Destructive: reverts to the system version and discards local override customizations.
// confirm:true is the safety gate here since there is no human at a modal to click through.
async function removeOverride(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    if (args.confirm !== true) {
        return {
            success: false,
            variableName,
            error: 'Removing an override reverts to the CPQ system version and discards local override customizations. Re-call with confirm:true to proceed.',
        };
    }
    const located = requireLocalFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const { vscodeProxy } = createToolVscodeContext(vscode, {
        bmlPath: located.bmlPath,
        warningConfirm: 'Remove Override',
    });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const result = await runRemoveOverride(context, vscodeProxy, terminal, { transport });
    return structuredOutcome({ variableName }, result, getLines());
}

// Destructive: discards whatever the AI has changed in its working copy so far.
// confirm:true is the safety gate here since there is no human at a modal to click through.
async function resetAiCopyTool(context, vscode, args) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };
    if (args.confirm !== true) {
        return {
            success: false,
            variableName,
            error: 'Resetting discards all edits made to the AI working copy. Re-call with confirm:true to proceed.',
        };
    }
    if (!findLocalBmlPath(vscode, variableName)) {
        return { success: false, variableName, error: `No local file found for "${variableName}". Run pull_function first.` };
    }

    const aiPath = resetAiCopy(vscode, variableName);
    return { success: true, variableName, filePath: aiPath };
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
    resetAiCopy: resetAiCopyTool,
};
