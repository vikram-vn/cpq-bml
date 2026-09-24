'use strict';

const api = require('@/lang/rest/api');
const { isConfigured, getSettings, getWorkspaceRoot } = require('@/lang/rest/config');
const {
    isSuccess,
    describeError,
    writeRunHeader,
    writeTerminalMessage,
    formatElapsed,
} = require('@/lang/rest/commands/shared');
const { getAiTerminal } = require('@/lang/mcp/aiTerminal');
const { createCapturingTerminal } = require('@/lang/mcp/proxy');
const { SchemaIntrospector } = require('@/lang/intellisense/schemaIntrospector');
const { listUtilFunctions, listDataTables, getTransactions } = require('@/lang/mcp/tools/lookup');
const { listParts } = require('@/lang/mcp/tools/partsTools');
const { normalizeToolArgs } = require('@/lang/mcp/toolArgs');
const fs = require('fs');
const path = require('path');

function safeParse(val) {
    if (!val) return {};
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch {
        return {};
    }
}

async function listCommerceProcesses(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal());
    const startedAt = Date.now();
    writeRunHeader(terminal, 'List Commerce Processes', 'processes');
    terminal.show();

    try {
        if (isConfigured()) {
            try {
                const res = await api.listCommerceProcesses(args || {}, tr);
                if (res && (res.statusCode === 401 || res.statusCode === 403)) {
                    const errMsg = `Live CPQ Authentication Failed (HTTP ${res.statusCode}). Check your credentials.`;
                    writeTerminalMessage(terminal, 'Auth Error: ', errMsg, '\x1b[31m');
                    return { success: false, error: errMsg, statusCode: res.statusCode, log: getLines() };
                }
                if (res && isSuccess(res.statusCode)) {
                    const body = safeParse(res.body);
                    const items = Array.isArray(body) ? body : (body.items || []);
                    const processes = items.map(p => ({
                        variableName: p.variableName || p.name || '',
                        label: p.label || p.name || '',
                        description: p.description || '',
                        documents: p.documents || undefined,
                    }));
                    writeTerminalMessage(terminal, 'Processes: ', `Found ${processes.length} processes (${formatElapsed(startedAt)})`, '\x1b[32m');
                    return { success: true, count: processes.length, processes, log: getLines() };
                }
            } catch {
                // Network/live call failed, fall back to local workspace
            }
        }

        // Workspace fallback
        const wsRoot = getWorkspaceRoot();
        const processes = [];
        if (wsRoot) {
            for (const sub of ['cpq/commerce', '.cpq/commerce']) {
                const p = path.join(wsRoot, sub);
                if (fs.existsSync(p)) {
                    const entries = fs.readdirSync(p, { withFileTypes: true });
                    for (const e of entries) {
                        if (e.isDirectory()) {
                            processes.push({ variableName: e.name, label: e.name, source: 'workspace' });
                        }
                    }
                }
            }
        }
        if (processes.length === 0) {
            const settings = getSettings();
            const defProc = settings.commerceProcess || 'oraclecpqo';
            processes.push({ variableName: defProc, label: defProc, source: 'settings' });
        }
        return { success: true, count: processes.length, processes, source: 'workspace', log: getLines() };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function listConfigurationHierarchy(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal());
    const startedAt = Date.now();
    writeRunHeader(terminal, 'List Configuration Hierarchy', 'catalog');
    terminal.show();

    try {
        const familyFilter = args && args.productFamily;
        let families = [];

        if (isConfigured()) {
            const famRes = await api.listProductFamilies({ limit: 100 }, tr);
            if (famRes && (famRes.statusCode === 401 || famRes.statusCode === 403)) {
                const errMsg = `Live CPQ Authentication Failed (HTTP ${famRes.statusCode}). Check your credentials.`;
                return { success: false, error: errMsg, statusCode: famRes.statusCode, log: getLines() };
            }
            if (famRes && isSuccess(famRes.statusCode)) {
                const famBody = safeParse(famRes.body);
                const rawFams = Array.isArray(famBody) ? famBody : (famBody.items || []);
                families = rawFams.map(f => ({
                    variableName: f.variableName || f.name,
                    label: f.label || f.name,
                    description: f.description || '',
                    productLines: [],
                }));
            }
        }

        if (families.length === 0) {
            const wsRoot = getWorkspaceRoot();
            const confSchema = wsRoot ? SchemaIntrospector.getConfigSchema(null, wsRoot) : null;
            if (confSchema && Array.isArray(confSchema.families)) {
                families = confSchema.families.map(f => ({
                    variableName: f.variableName || f.name,
                    label: f.label || f.name,
                    description: f.description || '',
                    productLines: f.productLines || [],
                }));
            }
        }

        if (familyFilter) {
            families = families.filter(f => f.variableName === familyFilter || f.label === familyFilter);
        }

        for (const fam of families) {
            if (fam.productLines && fam.productLines.length > 0) continue;
            try {
                const lineRes = await api.listProductLines({ productFamily: fam.variableName }, tr);
                if (lineRes && isSuccess(lineRes.statusCode)) {
                    const lineBody = safeParse(lineRes.body);
                    const rawLines = Array.isArray(lineBody) ? lineBody : (lineBody.items || []);
                    fam.productLines = rawLines.map(l => ({
                        variableName: l.variableName || l.name,
                        label: l.label || l.name,
                        models: [],
                    }));

                    for (const pl of fam.productLines) {
                        try {
                            const modRes = await api.listModels({ productFamily: fam.variableName, productLine: pl.variableName }, tr);
                            if (modRes && isSuccess(modRes.statusCode)) {
                                const modBody = safeParse(modRes.body);
                                const rawMods = Array.isArray(modBody) ? modBody : (modBody.items || []);
                                pl.models = rawMods.map(m => ({
                                    variableName: m.variableName || m.name,
                                    label: m.label || m.name,
                                    description: m.description || '',
                                }));
                            }
                        } catch {}
                    }
                }
            } catch {}
        }

        writeTerminalMessage(terminal, 'Configuration: ', `Loaded ${families.length} product families (${formatElapsed(startedAt)})`, '\x1b[32m');
        return { success: true, count: families.length, families, log: getLines() };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function listConfigurationAttributes(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal());
    const startedAt = Date.now();
    writeRunHeader(terminal, 'List Configuration Attributes', args && args.productFamily || 'global');
    terminal.show();

    try {
        let res;
        const fam = args && args.productFamily;
        const line = args && args.productLine;

        if (fam && line) {
            res = await api.listProductLineAttributes({ productFamily: fam, productLine: line }, tr);
        } else if (fam) {
            res = await api.listProductFamilyAttributes({ productFamily: fam }, tr);
        } else {
            res = await api.listConfigurationAttributes({ limit: 1000 }, tr);
        }

        if (res && isSuccess(res.statusCode)) {
            const body = safeParse(res.body);
            const items = Array.isArray(body) ? body : (body.items || []);
            const attributes = items.map(a => ({
                variableName: a.variableName || a.name,
                label: a.label || a.name,
                dataType: a.dataType || a.type || 'String',
                description: a.description || '',
                menuItems: a.menuItems || undefined,
            }));
            return { success: true, count: attributes.length, attributes, log: getLines() };
        }

        return { success: false, error: res ? describeError(res.body) : 'Failed to query configuration attributes', log: getLines() };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function listDeploymentTasks(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal());
    const startedAt = Date.now();
    writeRunHeader(terminal, 'List Deployment Tasks', 'tasks');
    terminal.show();

    const limit = (args && args.limit !== undefined) ? args.limit : 30;
    const offset = (args && args.offset !== undefined) ? args.offset : 0;
    const orderby = (args && args.orderby) || 'dateModified:desc';
    const q = args && (args.q || args.query);

    try {
        const res = await api.listTasks({ limit, offset, orderby, q }, tr);
        if (!res || !isSuccess(res.statusCode)) {
            const code = res ? res.statusCode : 500;
            return {
                success: false,
                error: `Failed to retrieve deployment tasks (HTTP ${code}). ${res ? describeError(res.body) : ''}`,
                log: getLines(),
            };
        }

        const body = safeParse(res.body);
        const rawItems = Array.isArray(body) ? body : (body.items || []);
        const tasks = rawItems.map(t => ({
            id: t.id || t._id,
            name: t.name || t.taskName || '',
            category: t.category,
            status: t.status || t.state || '',
            percentComplete: t.percentComplete !== undefined ? t.percentComplete : 100,
            dateModified: t.dateModified || t._date_modified || '',
            dateAdded: t.dateAdded || t._date_added || '',
            message: t.message || t.statusMessage || '',
        }));

        writeTerminalMessage(terminal, 'Deployment: ', `Retrieved ${tasks.length} tasks (${formatElapsed(startedAt)})`, '\x1b[32m');
        return { success: true, count: tasks.length, totalResults: body.totalResults, tasks, log: getLines() };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function getTransactionData(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
    const transactionId = args && (args.transactionId || args.id);
    if (!transactionId) {
        return { success: false, error: 'transactionId parameter is required' };
    }

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal());
    const startedAt = Date.now();
    writeRunHeader(terminal, 'Get Transaction Data', String(transactionId));
    terminal.show();

    try {
        const settings = getSettings();
        const process = (args && args.commerceProcess) || settings.commerceProcess || 'oraclecpqo';
        const document = (args && args.commerceDocument) || settings.commerceDocument || 'transaction';

        const res = await api.getTransaction(transactionId, { process, document }, tr);
        if (!res || !isSuccess(res.statusCode)) {
            const code = res ? res.statusCode : 500;
            return {
                success: false,
                error: `Failed to retrieve transaction "${transactionId}" (HTTP ${code}). ${res ? describeError(res.body) : ''}`,
                log: getLines(),
            };
        }

        const body = safeParse(res.body);
        writeTerminalMessage(terminal, 'Transaction: ', `Retrieved transaction "${transactionId}" (${formatElapsed(startedAt)})`, '\x1b[32m');
        return { success: true, transactionId, process, document, transaction: body, log: getLines() };
    } catch (err) {
        return { success: false, error: err && err.message ? err.message : String(err), log: getLines() };
    }
}

async function getCloudExplorerOverview(options = {}, transport) {
    const { args, transport: tr } = normalizeToolArgs(arguments);
    const section = (args && args.section) || 'all';
    const overview = {};

    if (section === 'all' || section === 'util') {
        try {
            const res = await listUtilFunctions({}, tr);
            overview.utilLibraries = {
                count: res.functions ? res.functions.length : 0,
                functions: (res.functions || []).slice(0, 30).map(f => ({
                    variableName: f.variableName,
                    name: f.name,
                    folderName: f.folderName,
                    returnType: f.returnType,
                })),
            };
        } catch {
            overview.utilLibraries = { count: 0, functions: [] };
        }
    }

    if (section === 'all' || section === 'commerce') {
        try {
            const procRes = await listCommerceProcesses({}, tr);
            overview.commerce = {
                processesCount: procRes.count || 0,
                processes: procRes.processes || [],
            };
        } catch {
            overview.commerce = { processesCount: 0, processes: [] };
        }
    }

    if (section === 'all' || section === 'config') {
        try {
            const hierRes = await listConfigurationHierarchy({}, tr);
            overview.configuration = {
                familyCount: hierRes.count || 0,
                families: hierRes.families || [],
            };
        } catch {
            overview.configuration = { familyCount: 0, families: [] };
        }
    }

    if (section === 'all' || section === 'datatables') {
        try {
            const dtRes = await listDataTables({}, tr);
            overview.dataTables = {
                count: dtRes.dataTables ? dtRes.dataTables.length : 0,
                tables: dtRes.dataTables || [],
            };
        } catch {
            overview.dataTables = { count: 0, tables: [] };
        }
    }

    if (section === 'all' || section === 'transactions') {
        try {
            const txRes = await getTransactions({ limit: 10 }, tr);
            overview.recentTransactions = {
                count: txRes.transactions ? txRes.transactions.length : 0,
                transactions: txRes.transactions || [],
            };
        } catch {
            overview.recentTransactions = { count: 0, transactions: [] };
        }
    }

    if (section === 'all' || section === 'parts') {
        try {
            const partsRes = await listParts({ limit: 15 }, tr);
            overview.partsCatalog = {
                count: partsRes.count || 0,
                totalResults: partsRes.totalResults,
                parts: (partsRes.parts || []).slice(0, 15),
            };
        } catch {
            overview.partsCatalog = { count: 0, parts: [] };
        }
    }

    if (section === 'all' || section === 'deployment') {
        try {
            const depRes = await listDeploymentTasks({ limit: 10 }, tr);
            overview.deploymentCenter = {
                count: depRes.count || 0,
                tasks: depRes.tasks || [],
            };
        } catch {
            overview.deploymentCenter = { count: 0, tasks: [] };
        }
    }

    return {
        success: true,
        section,
        overview,
    };
}

module.exports = {
    getCloudExplorerOverview,
    listCommerceProcesses,
    listConfigurationHierarchy,
    listConfigurationAttributes,
    listDeploymentTasks,
    getTransactionData,
};
