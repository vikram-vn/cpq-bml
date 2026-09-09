const path = require('path');
const api = require('../api');
const config = require('../config');
const metadataLib = require('../metadata');
const { confirmAndWriteBmlFile } = require('../safeSync');
const {
    getTimestamp,
    writeTerminalMessage,
    writeRunHeader,
    writeRunningLine,
    formatElapsed,
    describeError,
    isSuccess,
    ensureCredentials,
} = require('./shared');

async function runPullLibraryFunctions(context, vscode, resultsTerminal, { transport } = {}) {
    const hasCredentials = await ensureCredentials(context, vscode);
    if (!hasCredentials) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('CPQ-BML: open a workspace folder before pulling library functions.');
        return;
    }
    const settings = config.getSettings(vscode);
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    writeRunHeader(resultsTerminal, 'Pull', 'util library');
    writeRunningLine(resultsTerminal, 'Pull', 'util library');
    resultsTerminal.show();
    const startedAt = Date.now();

    let allItems = [];
    let offset = 0;
    const limit = 1000;
    for (;;) {
        const { statusCode, body } = await api.listLibraryFunctions(context, vscode, { offset, limit }, transport);
        if (!isSuccess(statusCode)) {
            const message = `failed to list library functions (HTTP ${statusCode}). ${describeError(body)}`;
            writeTerminalMessage(resultsTerminal, 'Pull failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
            resultsTerminal.show();
            vscode.window.showErrorMessage(`CPQ-BML: ${message}`);
            return;
        }
        let parsedBody = body;
        if (typeof parsedBody === 'string') {
            try { parsedBody = JSON.parse(parsedBody); } catch (e) { parsedBody = {}; }
        }
        const items = Array.isArray(parsedBody)
            ? parsedBody
            : ((parsedBody && parsedBody.items) || []);
        allItems = allItems.concat(items);
        const hasMore = parsedBody && (
            parsedBody.hasMore === true ||
            (parsedBody.hasMore === undefined && items.length > 0 && parsedBody.totalResults !== undefined && offset + items.length < parsedBody.totalResults) ||
            (parsedBody.hasMore === undefined && items.length === limit)
        );
        if (!hasMore || items.length === 0) break;
        offset += items.length;
    }

    if (allItems.length === 0) {
        resultsTerminal.writeLine(`\x1b[33m${getTimestamp()} No library functions found (${formatElapsed(startedAt)})\x1b[0m`);
        resultsTerminal.show();
        vscode.window.showInformationMessage('CPQ-BML: no library functions found.');
        return;
    }

    const picks = allItems.map((item) => ({
        label: item.name || item.variableName,
        description: metadataLib.namespaceVariableNameFor(item),
        item
    }));

    const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: 'Select library functions to pull from CPQ'
    });
    if (!selected || selected.length === 0) {
        resultsTerminal.writeLine(`\x1b[90m${getTimestamp()} Pull cancelled - no functions selected\x1b[0m`);
        return;
    }

    let pulledCount = 0;
    const sessionState = { overwriteAll: false, skipAll: false };
    for (const pick of selected) {
        try {
            const nsVarName = metadataLib.namespaceVariableNameFor(pick.item);
            let result = await api.getLibraryFunction(context, vscode, nsVarName, transport);
            if (!isSuccess(result.statusCode) && pick.item.folderName && !nsVarName.includes('.')) {
                const altResult = await api.getLibraryFunction(context, vscode, `${pick.item.folderName}.${pick.item.variableName}`, transport);
                if (isSuccess(altResult.statusCode)) {
                    result = altResult;
                }
            } else if (!isSuccess(result.statusCode) && nsVarName.includes('.')) {
                const altResult = await api.getLibraryFunction(context, vscode, pick.item.variableName, transport);
                if (isSuccess(altResult.statusCode)) {
                    result = altResult;
                }
            }
            if (!isSuccess(result.statusCode)) {
                const message = `failed to fetch ${nsVarName} (HTTP ${result.statusCode}). ${describeError(result.body)}`;
                writeTerminalMessage(resultsTerminal, 'Pull failed: ', message, '\x1b[31m');
                vscode.window.showErrorMessage(`CPQ-BML: ${message}`);
                continue;
            }
            const { scriptText, metadata } = metadataLib.splitFunctionResponse(result.body);
            metadata.variableName = metadata.variableName || pick.item.variableName || pick.item.name || '';
            metadata.folderName = metadata.folderName || pick.item.folderName || metadataLib.namespaceOf(metadata) || '';
            metadata.name = metadata.name || pick.item.name || metadata.variableName;
            const folder = metadata.folderName || '';

            // Same per-function folder convention as the commerce pull, so every
            // pulled function gets its own folder holding both its .bml and
            // -meta.json sidecar: <pullFolder>/<folder>/<variableName>/<variableName>.bml
            const bmlPath = path.join(
                workspaceRoot,
                settings.pullFolder,
                folder,
                metadata.variableName,
                `${metadata.variableName}.bml`
            );
            const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);

            const writeStatus = await confirmAndWriteBmlFile(vscode, bmlPath, scriptText, metadata.variableName, sessionState);
            if (writeStatus === 'skipped') {
                resultsTerminal.writeLine(`\x1b[33m${getTimestamp()} Skipped ${metadata.variableName} (kept local)\x1b[0m`);
                continue;
            }
            metadataLib.writeMetadata(metaPath, metadata);
            resultsTerminal.writeLine(`\x1b[90m${getTimestamp()} Pulled ${metadata.variableName}\x1b[0m`);
            pulledCount++;
        } catch (err) {
            writeTerminalMessage(resultsTerminal, 'Pull failed: ', err.message, '\x1b[31m');
            vscode.window.showErrorMessage(`CPQ-BML: failed to pull ${pick.label}: ${err.message}`);
        }
    }

    resultsTerminal.writeLine(`\x1b[32m${getTimestamp()} Pulled ${pulledCount} function(s) (${formatElapsed(startedAt)})\x1b[0m`);
    resultsTerminal.show();
    vscode.window.showInformationMessage(`CPQ-BML: pulled ${pulledCount} library function(s) into ${settings.pullFolder}/`);
}

async function runPullCommerceFunctions(context, vscode, resultsTerminal, { transport } = {}) {
    const hasCredentials = await ensureCredentials(context, vscode);
    if (!hasCredentials) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('CPQ-BML: open a workspace folder before pulling commerce functions.');
        return;
    }
    const settings = config.getSettings(vscode);
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    const { commerceProcess, commerceDocument } = settings;
    if (!commerceProcess || !commerceDocument) {
        vscode.window.showErrorMessage('CPQ-BML: configure cpqBml.rest.commerceProcess and cpqBml.rest.commerceDocument before pulling commerce functions.');
        return;
    }

    const commerceMetadata = { commerceProcess, commerceDocument };
    const label = `${commerceProcess}/${commerceDocument}`;
    writeRunHeader(resultsTerminal, 'Pull', label);
    writeRunningLine(resultsTerminal, 'Pull', label);
    resultsTerminal.show();
    const startedAt = Date.now();

    let allItems = [];
    let offset = 0;
    const limit = 1000;
    for (;;) {
        const { statusCode, body } = await api.listLibraryFunctions(context, vscode, { offset, limit }, transport, commerceMetadata);
        if (!isSuccess(statusCode)) {
            const message = `failed to list commerce functions (HTTP ${statusCode}). ${describeError(body)}`;
            writeTerminalMessage(resultsTerminal, 'Pull failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
            resultsTerminal.show();
            vscode.window.showErrorMessage(`CPQ-BML: ${message}`);
            return;
        }
        let parsedBody = body;
        if (typeof parsedBody === 'string') {
            try { parsedBody = JSON.parse(parsedBody); } catch (e) { parsedBody = {}; }
        }
        const items = Array.isArray(parsedBody)
            ? parsedBody
            : ((parsedBody && parsedBody.items) || []);
        allItems = allItems.concat(items);
        const hasMore = parsedBody && (
            parsedBody.hasMore === true ||
            (parsedBody.hasMore === undefined && items.length > 0 && parsedBody.totalResults !== undefined && offset + items.length < parsedBody.totalResults) ||
            (parsedBody.hasMore === undefined && items.length === limit)
        );
        if (!hasMore || items.length === 0) break;
        offset += items.length;
    }

    if (allItems.length === 0) {
        resultsTerminal.writeLine(`\x1b[33m${getTimestamp()} No commerce functions found under ${label} (${formatElapsed(startedAt)})\x1b[0m`);
        resultsTerminal.show();
        vscode.window.showInformationMessage(`CPQ-BML: no commerce functions found under ${commerceProcess}/${commerceDocument}.`);
        return;
    }

    const picks = allItems.map((item) => ({
        label: item.name || item.variableName,
        description: metadataLib.namespaceVariableNameFor(item),
        item
    }));

    const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: `Select commerce functions to pull from ${commerceProcess}/${commerceDocument}`
    });
    if (!selected || selected.length === 0) {
        resultsTerminal.writeLine(`\x1b[90m${getTimestamp()} Pull cancelled - no functions selected\x1b[0m`);
        return;
    }

    let pulledCount = 0;
    const sessionState = { overwriteAll: false, skipAll: false };
    for (const pick of selected) {
        try {
            const nsVarName = metadataLib.namespaceVariableNameFor(pick.item);
            let result = await api.getLibraryFunction(context, vscode, nsVarName, transport, commerceMetadata);
            if (!isSuccess(result.statusCode) && nsVarName.includes('.')) {
                const altResult = await api.getLibraryFunction(context, vscode, pick.item.variableName, transport, commerceMetadata);
                if (isSuccess(altResult.statusCode)) {
                    result = altResult;
                }
            }
            if (!isSuccess(result.statusCode)) {
                const message = `failed to fetch ${nsVarName} (HTTP ${result.statusCode}). ${describeError(result.body)}`;
                writeTerminalMessage(resultsTerminal, 'Pull failed: ', message, '\x1b[31m');
                vscode.window.showErrorMessage(`CPQ-BML: ${message}`);
                continue;
            }
            const { scriptText, metadata } = metadataLib.splitFunctionResponse(result.body);
            metadata.commerceProcess = commerceProcess;
            metadata.commerceDocument = commerceDocument;
            metadata.variableName = metadata.variableName || pick.item.variableName || pick.item.name || '';
            metadata.name = metadata.name || pick.item.name || metadata.variableName;

            // Matches the folder convention inferCommerceFromPath() relies on, so
            // these functions are still recognized as commerce-scoped even if the
            // -meta.json sidecar is ever lost: <process>/<document>/libraries/<variableName>/<variableName>.bml
            const bmlPath = path.join(
                workspaceRoot,
                settings.pullFolder,
                commerceProcess,
                commerceDocument,
                'libraries',
                metadata.variableName,
                `${metadata.variableName}.bml`
            );
            const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);

            const writeStatus = await confirmAndWriteBmlFile(vscode, bmlPath, scriptText, metadata.variableName, sessionState);
            if (writeStatus === 'skipped') {
                resultsTerminal.writeLine(`\x1b[33m${getTimestamp()} Skipped ${metadata.variableName} (kept local)\x1b[0m`);
                continue;
            }
            metadataLib.writeMetadata(metaPath, metadata);
            resultsTerminal.writeLine(`\x1b[90m${getTimestamp()} Pulled ${metadata.variableName}\x1b[0m`);
            pulledCount++;
        } catch (err) {
            writeTerminalMessage(resultsTerminal, 'Pull failed: ', err.message, '\x1b[31m');
            vscode.window.showErrorMessage(`CPQ-BML: failed to pull ${pick.label}: ${err.message}`);
        }
    }

    resultsTerminal.writeLine(`\x1b[32m${getTimestamp()} Pulled ${pulledCount} function(s) (${formatElapsed(startedAt)})\x1b[0m`);
    resultsTerminal.show();
    vscode.window.showInformationMessage(`CPQ-BML: pulled ${pulledCount} commerce function(s) into ${settings.pullFolder}/${commerceProcess}/${commerceDocument}/`);
}

module.exports = { runPullLibraryFunctions, runPullCommerceFunctions };
