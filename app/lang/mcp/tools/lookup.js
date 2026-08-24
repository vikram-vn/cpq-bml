const path = require('path');
const api = require('../../rest/api');
const config = require('../../rest/config');
const metadataLib = require('../../rest/metadata');
const {
    isSuccess,
    writeRunHeader,
    writeRunningLine,
    writeTerminalMessage,
    findLibraryFunctionByVariableName,
} = require('../../rest/commands/shared');
const { findOrCreateAiCopy } = require('../locate');
const { getAiTerminal } = require('../aiTerminal');
const { createCapturingTerminal } = require('../proxy');

async function listAll(context, vscode, transport, metadataTarget) {
    const label = metadataTarget ? 'List Commerce Functions' : 'List Util Functions';
    const target = metadataTarget ? `${metadataTarget.commerceProcess}/${metadataTarget.commerceDocument}` : 'util library';
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    writeRunHeader(terminal, label, target);
    writeRunningLine(terminal, label, target);
    terminal.show();

    const startedAt = Date.now();
    let allItems = [];
    let offset = 0;
    const limit = 1000;
    for (;;) {
        const { statusCode, body } = await api.listLibraryFunctions(
            context, vscode, { offset, limit }, transport, metadataTarget,
        );
        if (!isSuccess(statusCode)) {
            const message = `Failed to list functions (HTTP ${statusCode}). ${describeError(body)}`;
            writeTerminalMessage(terminal, 'List failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
            return { success: false, error: message, log: getLines() };
        }
        allItems = allItems.concat(body.items || []);
        if (!body.hasMore) break;
        offset += limit;
    }

    terminal.writeLine(`\x1b[32m${getTimestamp()} Found ${allItems.length} function(s) (${formatElapsed(startedAt)})\x1b[0m`);
    return {
        success: true,
        functions: allItems.map((item) => ({
            variableName: item.variableName,
            name: item.name,
            namespace: metadataLib.namespaceOf(item),
        })),
        log: getLines(),
    };
}

async function listUtilFunctions(context, vscode, args, transport) {
    return listAll(context, vscode, transport, undefined);
}

async function listCommerceFunctions(context, vscode, args, transport) {
    const commerceProcess = (args && args.commerceProcess) || config.getCommerceProcess(vscode) || 'oraclecpqo';
    const commerceDocument = (args && args.commerceDocument) || config.getCommerceDocument(vscode) || 'transaction';
    return listAll(context, vscode, transport, { commerceProcess, commerceDocument });
}

async function pullFunction(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    writeRunHeader(terminal, 'Pull', variableName);
    writeRunningLine(terminal, 'Pull', variableName);
    terminal.show();
    const startedAt = Date.now();

    const fail = (message) => {
        writeTerminalMessage(terminal, 'Pull failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
        return { success: false, variableName, error: message, log: getLines() };
    };

    const isCommerce = args.type === 'commerce';
    let commerceProcess;
    let commerceDocument;
    let target;
    if (isCommerce) {
        commerceProcess = args.commerceProcess || config.getCommerceProcess(vscode) || 'oraclecpqo';
        commerceDocument = args.commerceDocument || config.getCommerceDocument(vscode) || 'transaction';
        target = { commerceProcess, commerceDocument };
    }

    const match = await findLibraryFunctionByVariableName(context, vscode, variableName, transport, target);
    if (!match) return fail(`Function "${variableName}" was not found on CPQ.`);

    const nsVarName = metadataLib.namespaceVariableNameFor(match);
    const result = await api.getLibraryFunction(context, vscode, nsVarName, transport, target);
    if (!isSuccess(result.statusCode)) {
        return fail(`Failed to fetch "${variableName}" (HTTP ${result.statusCode}). ${describeError(result.body)}`);
    }

    const { scriptText, metadata } = metadataLib.splitFunctionResponse(result.body);
    if (isCommerce) {
        metadata.commerceProcess = commerceProcess;
        metadata.commerceDocument = commerceDocument;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return fail('No workspace folder is open.');
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const settings = config.getSettings(vscode);

    const bmlPath = isCommerce
        ? path.join(workspaceRoot, settings.pullFolder, commerceProcess, commerceDocument, 'libraries', metadata.variableName, `${metadata.variableName}.bml`)
        : path.join(workspaceRoot, settings.pullFolder, metadata.folderName || metadataLib.namespaceOf(metadata) || '', metadata.variableName, `${metadata.variableName}.bml`);

    const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);
    metadataLib.writeBmlFile(bmlPath, scriptText);
    metadataLib.writeMetadata(metaPath, metadata);

    const aiPath = findOrCreateAiCopy(vscode, metadata.variableName);

    terminal.writeLine(`\x1b[32m${getTimestamp()} Pulled (${formatElapsed(startedAt)})\x1b[0m`);
    return { success: true, variableName, localPath: aiPath || bmlPath, canonicalPath: bmlPath, scriptText, metadata, log: getLines() };
}

// Batch form of pullFunction - each item can independently be a util or commerce function,
// since a single call may need to pull a mix of both. Runs sequentially (not in parallel) so
// a shared, sequential terminal log stays readable and rate limits on the CPQ side aren't hit.
async function pullFunctions(context, vscode, args, transport) {
    const items = args && args.items;
    if (!Array.isArray(items) || items.length === 0) {
        return { success: false, error: 'items (a non-empty array of { variableName, type?, commerceProcess?, commerceDocument? }) is required.' };
    }

    const results = [];
    for (const item of items) {
        if (!item || !item.variableName) {
            results.push({ success: false, variableName: item && item.variableName, error: 'variableName is required.' });
            continue;
        }
        results.push(await pullFunction(context, vscode, item, transport));
    }

    const successCount = results.filter((r) => r.success).length;
    return {
        success: successCount === results.length,
        successCount,
        failureCount: results.length - successCount,
        results,
    };
}

module.exports = { listUtilFunctions, listCommerceFunctions, pullFunction, pullFunctions };
