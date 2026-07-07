const fs = require('fs');
const api = require('../api');
const config = require('../config');
const metadataLib = require('../metadata');

// e.g. "calculateDiscount" -> "Calculate Discount"
function toDisplayName(input) {
    return input
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b[a-z]/g, c => c.toUpperCase());
}

function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}]`;
}

function writeTerminalMessage(resultsTerminal, prefix, message, colorCode) {
    if (message === undefined || message === null) return;
    const lines = String(message).split(/\r?\n/);
    const timestamp = getTimestamp();
    const firstLinePrefix = `${timestamp} ${prefix}`;
    const indent = ' '.repeat(firstLinePrefix.length);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0) {
            resultsTerminal.writeLine(`${colorCode}${firstLinePrefix}${line}\x1b[0m`);
        } else {
            resultsTerminal.writeLine(`${colorCode}${indent}${line}\x1b[0m`);
        }
    }
}

function writeRunHeader(resultsTerminal, commandLabel, variableName) {
    resultsTerminal.writeLine('');
    resultsTerminal.writeLine(`\x1b[1m\x1b[36m--- ${commandLabel}: ${variableName} ---\x1b[0m`);
}

function writeRunningLine(resultsTerminal, commandLabel, variableName) {
    resultsTerminal.writeLine(`\x1b[90m${getTimestamp()} Running ${commandLabel} for "${variableName}"...\x1b[0m`);
}

function formatElapsed(startedAt) {
    const ms = Date.now() - startedAt;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function describeError(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    const details = body['o:errorDetails'] || body.errorDetails || body['o:errorMessages'] || body.errorMessages;
    if (Array.isArray(details) && details.length > 0) {
        return details.map((d) => d.title || d.detail || d.message || JSON.stringify(d)).join('\n');
    }
    return body.detail || body.title || body.message || JSON.stringify(body);
}

function isSuccess(statusCode) {
    return statusCode >= 200 && statusCode < 300;
}

function parseErrorLine(message) {
    if (!message) return null;
    const match = message.match(/(?:on|at|near)?\s*line\s+(\d+)\b/i);
    return match ? parseInt(match[1], 10) : null;
}

function mergeAttributes(existing, dependent) {
    const normalizedExisting = metadataLib.normalizeAttributes(existing);
    const normalizedDependent = metadataLib.normalizeAttributes(dependent);
    const merged = [...normalizedExisting];
    for (const dep of normalizedDependent) {
        if (!merged.some(item => item.name === dep.name)) {
            merged.push(dep);
        }
    }
    return merged;
}

// Paginates the full library looking for an exact variableName match (util and commerce share the same collection).
async function findLibraryFunctionByVariableName(context, vscode, variableName, transport, metadata) {
    let offset = 0;
    const limit = 1000;
    for (;;) {
        const { statusCode, body } = await api.listLibraryFunctions(context, vscode, { offset, limit }, transport, metadata);
        if (!isSuccess(statusCode)) return null;
        const found = (body.items || []).find((item) => item.variableName === variableName);
        if (found) return found;
        if (!body.hasMore) return null;
        offset += limit;
    }
}

// Local <name>-meta.json sidecar first (fast path); otherwise looks up the variableName live and caches the result as a new sidecar. Returns null if neither finds it.
async function resolveMetadataForFile(context, vscode, bmlFilePath, transport) {
    const metaPath = metadataLib.bmlPathToMetaPath(bmlFilePath);
    const localMetadata = metadataLib.readMetadata(metaPath);
    let metadata = localMetadata;
    if (!metadata) {
        const variableName = metadataLib.variableNameFromBmlPath(bmlFilePath);
        const inferred = metadataLib.inferCommerceFromPath(bmlFilePath);
        let match = null;
        let matchedTarget = null;
        let selection = null;

        if (inferred) {
            match = await findLibraryFunctionByVariableName(context, vscode, variableName, transport, inferred);
            if (match) {
                matchedTarget = inferred;
            }
        }

        if (!match) {
            const commerceDocument = config.getCommerceDocument(vscode) || 'transaction';
            const picks = [
                { label: 'Fetch Utility Library Function Metadata', id: 'fetch_util', description: 'Fetch utility library function from CPQ' },
                { label: `Fetch Commerce Function Metadata (${commerceDocument})`, id: 'fetch_commerce', description: 'Fetch commerce library function from CPQ' },
                { label: 'Create New Function Metadata', id: 'create', description: 'Create function metadata sidecar locally' }
            ];
            selection = await vscode.window.showQuickPick(picks, {
                placeHolder: `Metadata not found for "${variableName}". Choose an option:`,
                ignoreFocusOut: true
            });
            if (!selection) return null;

            if (selection.id === 'fetch_util') {
                matchedTarget = null;
                match = await findLibraryFunctionByVariableName(context, vscode, variableName, transport, undefined);
            } else if (selection.id === 'fetch_commerce') {
                const process = config.getCommerceProcess(vscode) || 'oraclecpqo';
                matchedTarget = { commerceProcess: process, commerceDocument: commerceDocument };
                match = await findLibraryFunctionByVariableName(context, vscode, variableName, transport, matchedTarget);
            } else if (selection.id === 'create') {
                const typePick = await vscode.window.showQuickPick([
                    { label: 'Utility Library Function', id: 'util' },
                    { label: 'Commerce Library Function', id: 'commerce' }
                ], { placeHolder: 'Select function type to create' });
                if (!typePick) return null;

                const suggestName = toDisplayName(variableName);

                const displayName = await vscode.window.showInputBox({
                    prompt: 'Enter display name for the function',
                    value: suggestName,
                    ignoreFocusOut: true,
                    validateInput: (val) => val && val.trim() ? null : 'Display name is required'
                });
                if (!displayName) return null;

                const description = await vscode.window.showInputBox({
                    prompt: 'Enter description (optional)',
                    ignoreFocusOut: true
                }) || '';

                let folderName = '';

                const returnTypes = [
                    { label: 'String' },
                    { label: 'Float' },
                    { label: 'Integer' },
                    { label: 'Boolean' },
                    { label: 'Date' },
                    { label: 'Json' },
                    { label: 'JsonArray' }
                ];
                const typeSelection = await vscode.window.showQuickPick(returnTypes, {
                    placeHolder: 'Select return type',
                    ignoreFocusOut: true
                });
                if (!typeSelection) return null;

                const returnTypeLabel = typeSelection.label;
                const returnTypeMap = {
                    'String': 1, 'Float': 2, 'Integer': 3, 'Boolean': 4, 'Date': 5, 'Json': 36, 'JsonArray': 37
                };
                const returnTypeValue = returnTypeMap[returnTypeLabel] || 1;
                const returnType = { value: returnTypeValue, displayValue: returnTypeLabel };

                let scriptText = 'return "";';
                if (returnTypeLabel === 'Float') scriptText = 'return 0.0;';
                else if (returnTypeLabel === 'Integer') scriptText = 'return 0;';
                else if (returnTypeLabel === 'Boolean') scriptText = 'return false;';
                else if (returnTypeLabel === 'Date') scriptText = 'return getdate();';
                else if (returnTypeLabel === 'Json') scriptText = 'return json();';
                else if (returnTypeLabel === 'JsonArray') scriptText = 'return jsonarray();';

                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) return null;
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                const pullFolder = config.getSettings(vscode).pullFolder || 'library';

                let createdMetadata = {};
                const pathLib = require('path');
                let finalBmlPath = '';

                if (typePick.id === 'util') {
                    finalBmlPath = pathLib.join(workspaceRoot, pullFolder, folderName, variableName, `${variableName}.bml`);
                    createdMetadata = {
                        name: displayName,
                        variableName,
                        description,
                        folderName,
                        testScript: '',
                        useTestScript: false,
                        returnType,
                        parameters: [],
                        libraryFunctions: [],
                        attributes: []
                    };
                } else {
                    const commerceProcess = config.getCommerceProcess(vscode) || 'oraclecpqo';
                    const commerceDocument = config.getCommerceDocument(vscode) || 'transaction';
                    finalBmlPath = pathLib.join(workspaceRoot, pullFolder, commerceProcess, commerceDocument, 'libraries', variableName, `${variableName}.bml`);
                    createdMetadata = {
                        name: displayName,
                        variableName,
                        description,
                        testScript: '',
                        useTestScript: false,
                        returnType,
                        parameters: [],
                        libraryFunctions: [],
                        attributes: [],
                        commerceProcess,
                        commerceDocument
                    };
                }

                const finalMetaPath = metadataLib.bmlPathToMetaPath(finalBmlPath);
                fs.mkdirSync(pathLib.dirname(finalBmlPath), { recursive: true });

                metadataLib.writeMetadata(finalMetaPath, createdMetadata);
                if (!fs.existsSync(bmlFilePath)) {
                    metadataLib.writeBmlFile(bmlFilePath, scriptText);
                } else if (bmlFilePath !== finalBmlPath) {
                    metadataLib.writeBmlFile(finalBmlPath, fs.readFileSync(bmlFilePath, 'utf8') || scriptText);
                }

                const activeMetaPath = metadataLib.bmlPathToMetaPath(bmlFilePath);
                if (activeMetaPath !== finalMetaPath) {
                    metadataLib.writeMetadata(activeMetaPath, createdMetadata);
                }

                vscode.window.showInformationMessage(`CPQ-BML: created metadata for "${variableName}" successfully.`);
                metadata = createdMetadata;
            }
        }

        if (match && (!selection || selection.id !== 'create')) {
            const nsVarName = metadataLib.namespaceVariableNameFor(match);
            const result = await api.getLibraryFunction(context, vscode, nsVarName, transport, matchedTarget || undefined);
            if (!isSuccess(result.statusCode)) return null;

            const { metadata: fetchedMetadata } = metadataLib.splitFunctionResponse(result.body);
            if (matchedTarget) {
                fetchedMetadata.commerceProcess = matchedTarget.commerceProcess;
                fetchedMetadata.commerceDocument = matchedTarget.commerceDocument;
            }
            metadataLib.writeMetadata(metaPath, fetchedMetadata);
            metadata = fetchedMetadata;
        }
    }

    if (metadata && !metadata.commerceDocument) {
        const inferred = metadataLib.inferCommerceFromPath(bmlFilePath);
        if (inferred) {
            metadata.commerceProcess = inferred.commerceProcess;
            metadata.commerceDocument = inferred.commerceDocument;
        }
    }

    if (metadata && metadata.commerceDocument && metadata.libraryFunctions && metadata.libraryFunctions.length > 0) {
        const normalizedDeps = metadataLib.normalizeLibraryFunctions(metadata.libraryFunctions);
        const depResult = await api.getDependentAttributes(
            context,
            vscode,
            {
                libraryFunctions: normalizedDeps,
                commerceProcess: metadata.commerceProcess,
                commerceDocument: metadata.commerceDocument,
            },
            transport
        );
        if (isSuccess(depResult.statusCode)) {
            const depData = depResult.body || {};
            metadata.systemAttributes = mergeAttributes(metadata.systemAttributes, depData.systemAttributes);
            metadata.mainDocAttributes = mergeAttributes(metadata.mainDocAttributes, depData.mainDocAttributes);
            metadata.subDocAttributes = mergeAttributes(metadata.subDocAttributes, depData.subDocAttributes);
            metadataLib.writeMetadata(metaPath, metadata);
        }
    }

    return metadata;
}

// logPath comes from config.getDebugOutputLogPath(); pass null to skip.
function appendDebugOutputToFile(logPath, variableName, returnVal) {
    if (!logPath) return;
    const timestamp = getTimestamp();
    const value = (returnVal !== undefined && returnVal !== null && returnVal !== '')
        ? String(returnVal)
        : '(no output)';
    const entry = `${timestamp} [${variableName}] Output:\n${value}\n${'─'.repeat(60)}\n`;
    try { fs.appendFileSync(logPath, entry, 'utf8'); } catch (e) {}
}

// logPath comes from config.getDebugPrintLogPath(); pass null to skip.
function appendDebugPrintToFile(logPath, variableName, printText) {
    if (!logPath || !printText) return;
    const timestamp = getTimestamp();
    const entry = `${timestamp} [${variableName}] Print:\n${String(printText)}\n${'─'.repeat(60)}\n`;
    try { fs.appendFileSync(logPath, entry, 'utf8'); } catch (e) {}
}


async function ensureCredentials(context, vscode) {
    return config.ensureCredentials(context, vscode);
}

module.exports = {
    toDisplayName,
    getTimestamp,
    writeTerminalMessage,
    writeRunHeader,
    writeRunningLine,
    formatElapsed,
    describeError,
    isSuccess,
    parseErrorLine,
    mergeAttributes,
    findLibraryFunctionByVariableName,
    resolveMetadataForFile,
    appendDebugOutputToFile,
    appendDebugPrintToFile,
    ensureCredentials
};
