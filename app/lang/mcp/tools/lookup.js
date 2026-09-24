const path = require('path');
const api = require('@/lang/rest/api');
const config = require('@/lang/rest/config');
const metadataLib = require('@/lang/rest/metadata');
const commerceAttributes = require('@/lang/rest/commerceAttributes');
const {
    isSuccess,
    describeError,
    getTimestamp,
    writeRunHeader,
    writeRunningLine,
    writeTerminalMessage,
    formatElapsed,
    findLibraryFunctionByVariableName,
} = require('@/lang/rest/commands/shared');
const { findOrCreateAiCopy } = require('@/lang/mcp/locate');
const { getAiTerminal } = require('@/lang/mcp/aiTerminal');
const { createCapturingTerminal } = require('@/lang/mcp/proxy');
const { getDataTableSchema, getDataTableRows } = require('@/lang/mcp/tools/dataTableTools');
const { listParts, getPart } = require('@/lang/mcp/tools/partsTools');
const { normalizeToolArgs } = require('@/lang/mcp/toolArgs');
const { getApiContext } = require('@/lang/rest/apiCore');

async function listAll(transport, metadataTarget) {
    let effectiveTransport = transport;
    let effectiveTarget = metadataTarget;
    if (arguments.length >= 3) {
        // Legacy (context, vscode, transport, metadataTarget)
        effectiveTransport = arguments[2];
        effectiveTarget = arguments[3];
    }
    const label = effectiveTarget ? 'List Commerce Functions' : 'List Util Functions';
    const target = effectiveTarget ? `${effectiveTarget.commerceProcess}/${effectiveTarget.commerceDocument}` : 'util library';
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal());
    writeRunHeader(terminal, label, target);
    writeRunningLine(terminal, label, target);
    terminal.show();

    const startedAt = Date.now();
    let allItems = [];
    let offset = 0;
    const limit = 1000;
    for (;;) {
        const { statusCode, body } = await api.listLibraryFunctions(
            { offset, limit }, effectiveTransport, effectiveTarget,
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

async function listUtilFunctions(options = {}, transport) {
    const { transport: tr } = normalizeToolArgs(arguments);
    return listAll(tr, undefined);
}

async function listCommerceFunctions(options = {}, transport) {
    const { vscode, args, transport: tr } = normalizeToolArgs(arguments);
    const commerceProcess = (args && args.commerceProcess) || config.getCommerceProcess(vscode) || 'oraclecpqo';
    const commerceDocument = (args && args.commerceDocument) || config.getCommerceDocument(vscode) || 'transaction';
    return listAll(tr, { commerceProcess, commerceDocument });
}

async function pullFunction(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal());
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

    const match = await findLibraryFunctionByVariableName(variableName, tr, target);
    if (!match) return fail(`Function "${variableName}" was not found on CPQ.`);

    const nsVarName = metadataLib.namespaceVariableNameFor(match);
    let result = await api.getLibraryFunction(nsVarName, tr, target);
    if (!isSuccess(result.statusCode) && match.folderName && !nsVarName.includes('.')) {
        const altResult = await api.getLibraryFunction(`${match.folderName}.${match.variableName}`, tr, target);
        if (isSuccess(altResult.statusCode)) {
            result = altResult;
        }
    } else if (!isSuccess(result.statusCode) && nsVarName.includes('.')) {
        const altResult = await api.getLibraryFunction(match.variableName, tr, target);
        if (isSuccess(altResult.statusCode)) {
            result = altResult;
        }
    }
    if (!isSuccess(result.statusCode)) {
        return fail(`Failed to fetch "${variableName}" (HTTP ${result.statusCode}). ${describeError(result.body)}`);
    }

    const { scriptText, metadata } = metadataLib.splitFunctionResponse(result.body);
    if (isCommerce) {
        metadata.commerceProcess = commerceProcess;
        metadata.commerceDocument = commerceDocument;
    }
    metadata.variableName = metadata.variableName || match.variableName || variableName;
    metadata.folderName = metadata.folderName || match.folderName || metadataLib.namespaceOf(metadata) || '';
    metadata.name = metadata.name || match.name || metadata.variableName;

    const wsRoot = config.getWorkspaceRoot();
    if (!wsRoot) {
        return fail('No workspace folder is open.');
    }
    const workspaceRoot = wsRoot;

    const { vscode } = getApiContext();
    const bmlPath = isCommerce
        ? path.join(workspaceRoot, config.getCommerceLibrariesFolder(vscode, commerceProcess), metadata.variableName, `${metadata.variableName}.bml`)
        : path.join(workspaceRoot, config.getUtilLibrariesFolder(vscode), metadata.folderName || '', metadata.variableName, `${metadata.variableName}.bml`);

    const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);
    metadataLib.writeBmlFile(bmlPath, scriptText);
    metadataLib.writeMetadata(metaPath, metadata);

    const aiPath = findOrCreateAiCopy(metadata.variableName);

    terminal.writeLine(`\x1b[32m${getTimestamp()} Pulled (${formatElapsed(startedAt)})\x1b[0m`);
    return { success: true, variableName, localPath: aiPath || bmlPath, canonicalPath: bmlPath, scriptText, metadata, log: getLines() };
}

// Batch form of pullFunction - each item can independently be a util or commerce function,
// since a single call may need to pull a mix of both. Runs sequentially (not in parallel) so
// a shared, sequential terminal log stays readable and rate limits on the CPQ side aren't hit.
async function pullFunctions(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
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
        results.push(await pullFunction(item, tr));
    }

    const successCount = results.filter((r) => r.success).length;
    return {
        success: successCount === results.length,
        successCount,
        failureCount: results.length - successCount,
        results,
    };
}

// BML Global Search across all remote BML scripts in Oracle CPQ via GET /rest/v19/bml/scripts
async function globalSearchBml(options = {}, transport) {
    const { vscode, args, transport: tr } = normalizeToolArgs(arguments);
    const query = args && (args.query || args.q);
    if (!query) return { success: false, error: 'query is required.' };

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    writeRunHeader(terminal, 'BML Global Search', query);
    writeRunningLine(terminal, 'BML Global Search', query);
    terminal.show();

    const startedAt = Date.now();
    const result = await api.searchBmlScripts(
        {
            query,
            caseSensitive: args.caseSensitive,
            offset: args.offset,
            limit: args.limit,
            fields: args.fields,
            orderby: args.orderby,
            totalResults: args.totalResults !== false,
            q: args.q,
        },
        tr,
    );

    if (!isSuccess(result.statusCode)) {
        const message = `BML global search failed (HTTP ${result.statusCode}). ${describeError(result.body)}`;
        writeTerminalMessage(terminal, 'Search failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
        return { success: false, query, error: message, statusCode: result.statusCode, log: getLines() };
    }

    const body = result.body || {};
    const items = body.items || [];
    const count = body.count !== undefined ? body.count : items.length;
    const totalResults = body.totalResults !== undefined ? body.totalResults : count;

    terminal.writeLine(`\x1b[32m${getTimestamp()} Found ${count} match(es) (${formatElapsed(startedAt)})\x1b[0m`);
    return {
        success: true,
        query,
        count,
        totalResults,
        hasMore: !!body.hasMore,
        offset: body.offset || args.offset || 0,
        limit: body.limit || args.limit || items.length,
        items,
        log: getLines(),
    };
}

async function getTransactions(options = {}, transport) {
    const { vscode, args, transport: tr } = normalizeToolArgs(arguments);
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();

    const offset = (args && args.offset !== undefined) ? args.offset : 25;
    const limit = (args && args.limit !== undefined) ? args.limit : 25;
    const q = (args && (args.q || args.query)) || undefined;
    const fields = (args && args.fields) || "_id,transactionID_t";
    const excludeFieldTypes = (args && args.excludeFieldTypes !== undefined) ? args.excludeFieldTypes : "yes";
    const process = (args && (args.commerceProcess || args.process)) || undefined;
    const document = (args && (args.commerceDocument || args.document)) || undefined;
    const orderby = (args && args.orderby) || undefined;
    const totalResults = args ? args.totalResults !== false : true;

    terminal.writeLine(`\x1b[36m${getTimestamp()} Pulling commerce transactions...\x1b[0m`);

    const result = await api.getTransactions(
        {
            process,
            document,
            q,
            offset,
            limit,
            fields,
            excludeFieldTypes,
            orderby,
            totalResults,
        },
        tr,
    );

    if (!isSuccess(result.statusCode)) {
        const message = `Get transactions failed (HTTP ${result.statusCode}). ${describeError(result.body)}`;
        writeTerminalMessage(terminal, 'Transactions failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
        return { success: false, error: message, statusCode: result.statusCode, log: getLines() };
    }

    const body = result.body || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems.map((item) => {
        // Minimal response: strictly _id and transactionID_t, no href links
        const clean = {};
        if (item._id !== undefined) clean._id = String(item._id);
        if (item.transactionID_t !== undefined) {
            clean.transactionID_t = String(item.transactionID_t);
        } else if (item.transactionId !== undefined) {
            clean.transactionID_t = String(item.transactionId);
        }
        return clean;
    });

    const count = items.length;
    terminal.writeLine(`\x1b[32m${getTimestamp()} Found ${count} transaction(s) (${formatElapsed(startedAt)})\x1b[0m`);

    return {
        success: true,
        count,
        totalResults: body.totalResults !== undefined ? body.totalResults : count,
        hasMore: !!body.hasMore,
        offset: body.offset !== undefined ? body.offset : offset,
        limit: body.limit !== undefined ? body.limit : limit,
        items,
        log: getLines(),
    };
}

async function lookupCommerceAttribute(options = {}) {
    const { vscode, args } = normalizeToolArgs(arguments);
    const wsRoot = commerceAttributes.getWorkspaceRoot(vscode);
    const query = (args && (args.query || args.name || args.label)) || '';
    const results = commerceAttributes.searchAttributes(query, wsRoot);
    return {
        success: true,
        count: results.length,
        query,
        attributes: results,
    };
}

async function syncCommerceAttributes(options = {}, transport) {
    const { vscode, args, transport: tr } = normalizeToolArgs(arguments);
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    terminal.writeLine(`\x1b[36m${getTimestamp()} Syncing commerce attributes and menu options from CPQ...\x1b[0m`);

    const result = await api.syncCommerceAttributes(args, tr);
    const count = result.count || (result.attributes ? result.attributes.length : 0);
    terminal.writeLine(`\x1b[32m${getTimestamp()} Synced ${count} commerce attributes into local cache (${formatElapsed(startedAt)})\x1b[0m`);

    return {
        success: true,
        process: result.process,
        document: result.document,
        count,
        updatedAt: result.updatedAt,
        log: getLines(),
    };
}

async function syncConfigurationAttributes(options = {}, transport) {
    const { vscode, args, transport: tr } = normalizeToolArgs(arguments);
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    terminal.writeLine(`\x1b[36m${getTimestamp()} Syncing configuration attributes, product families, lines, and models from CPQ...\x1b[0m`);

    const result = await api.syncConfigurationAttributes(args || {}, tr);
    const count = result.count || (result.attributes ? result.attributes.length : 0);
    terminal.writeLine(`\x1b[32m${getTimestamp()} Synced ${count} configuration attributes into local workspace (${formatElapsed(startedAt)})\x1b[0m`);

    return {
        success: true,
        count,
        productFamily: result.productFamily,
        productFamiliesCount: result.productFamilies ? result.productFamilies.length : 0,
        modelsCount: result.models ? result.models.length : 0,
        updatedAt: result.updatedAt,
        log: getLines(),
    };
}

async function listDataTables(options = {}, transport) {
    const { vscode, transport: tr } = normalizeToolArgs(arguments);
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    writeRunHeader(terminal, 'List Data Tables', 'allDataTables');
    terminal.show();

    try {
        const { statusCode, body } = await api.listDataTables(
            { limit: 1000 },
            tr,
        );

        if (!isSuccess(statusCode)) {
            return {
                success: true,
                count: 0,
                dataTables: [],
                message: `Data Tables endpoint responded with HTTP ${statusCode}.`,
                log: getLines(),
            };
        }

        const items = (body && body.items) || [];
        return {
            success: true,
            count: items.length,
            dataTables: items.map(t => ({
                name: t.name || t.variableName,
                description: t.description || '',
                folder: t.folder || '',
            })),
            log: getLines(),
        };
    } catch (err) {
        return {
            success: false,
            error: err && err.message ? err.message : String(err),
            log: getLines(),
        };
    }
}

module.exports = {
    listUtilFunctions,
    listCommerceFunctions,
    pullFunction,
    pullFunctions,
    globalSearchBml,
    searchBmlScripts: globalSearchBml,
    getTransactions,
    listTransactions: getTransactions,
    lookupCommerceAttribute,
    lookupAttribute: lookupCommerceAttribute,
    syncCommerceAttributes,
    syncConfigurationAttributes,
    listDataTables,
    getDataTableSchema,
    getDataTableRows,
    listParts,
    getPart,
};


