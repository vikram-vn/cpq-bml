'use strict';

const api = require('@/lang/rest/api');
const {
    isSuccess,
    describeError,
    writeRunHeader,
    writeTerminalMessage,
    formatElapsed,
} = require('@/lang/rest/commands/shared');
const { getAiTerminal } = require('@/lang/mcp/aiTerminal');
const { createCapturingTerminal } = require('@/lang/mcp/proxy');

function findFallbackSchema(context, vscodeInstance, tableName) {
    try {
        const { SchemaIntrospector } = require('@/lang/intellisense/schemaIntrospector');
        const { getWorkspaceRoot } = require('@/lang/rest/config');
        const wsRoot = getWorkspaceRoot(vscodeInstance);

        const dtSchema = SchemaIntrospector.getDataTablesSchema(context, wsRoot);
        if (dtSchema) {
            const list = Array.isArray(dtSchema) ? dtSchema : (dtSchema.dataTables || dtSchema.items || []);
            const match = list.find(t => (t.name || t.tableName) === tableName);
            if (match && Array.isArray(match.columns)) {
                return match.columns.map(c => typeof c === 'string'
                    ? { name: c, type: 'String', label: c, isPrimaryKey: false, description: '' }
                    : {
                        name: c.name || c.variableName || '',
                        type: c.type || c.dataType || 'String',
                        label: c.label || c.name || '',
                        isPrimaryKey: Boolean(c.isPrimaryKey || c.primaryKey || c.isKey),
                        description: c.description || '',
                    }
                );
            }
        }

        const cached = SchemaIntrospector.getCachedAttributes(wsRoot, context);
        if (cached && Array.isArray(cached.dataTables)) {
            const match = cached.dataTables.find(t => t.name === tableName);
            if (match && Array.isArray(match.columns)) {
                return match.columns.map(c => typeof c === 'string'
                    ? { name: c, type: 'String', label: c, isPrimaryKey: false, description: '' }
                    : {
                        name: c.name || c.variableName || '',
                        type: c.type || c.dataType || 'String',
                        label: c.label || c.name || '',
                        isPrimaryKey: Boolean(c.isPrimaryKey || c.primaryKey || c.isKey),
                        description: c.description || '',
                    }
                );
            }
        }
    } catch {
        // Fallback error ignored
    }
    return null;
}

async function getDataTableSchema(context, vscode, args, transport) {
    const tableName = args && args.tableName ? args.tableName : '';
    if (!tableName) {
        return { success: false, error: 'tableName parameter is required' };
    }

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    writeRunHeader(terminal, 'Get Data Table Schema', tableName);
    terminal.show();

    try {
        const res = await api.getDataTableSchema(context, vscode, tableName, transport);
        if (res && isSuccess(res.statusCode)) {
            const body = typeof res.body === 'string' ? JSON.parse(res.body) : (res.body || {});
            const rawCols = body.columns || body.fields || body.items || [];
            const columns = rawCols.map(c => ({
                name: c.name || c.variableName || c.columnName || '',
                type: c.type || c.dataType || 'String',
                label: c.label || c.name || '',
                isPrimaryKey: Boolean(c.isPrimaryKey || c.primaryKey || c.isKey),
                description: c.description || '',
            }));

            writeTerminalMessage(
                terminal,
                'Data Table Schema: ',
                `Retrieved ${columns.length} columns for "${tableName}" (${formatElapsed(startedAt)})`,
                '\x1b[32m',
            );

            return {
                success: true,
                tableName,
                columns,
                log: getLines(),
            };
        }

        const fallback = findFallbackSchema(context, vscode, tableName);
        if (fallback) {
            writeTerminalMessage(
                terminal,
                'Data Table Schema (Cached): ',
                `Loaded ${fallback.length} columns from local workspace (${formatElapsed(startedAt)})`,
                '\x1b[33m',
            );
            return {
                success: true,
                tableName,
                columns: fallback,
                source: 'workspace_cache',
                log: getLines(),
            };
        }

        const errMsg = res ? `Failed to retrieve schema for data table "${tableName}" (HTTP ${res.statusCode}).` : `Unable to query schema for "${tableName}".`;
        return { success: false, error: errMsg, log: getLines() };
    } catch (err) {
        const fallback = findFallbackSchema(context, vscode, tableName);
        if (fallback) {
            return {
                success: true,
                tableName,
                columns: fallback,
                source: 'workspace_cache',
                log: getLines(),
            };
        }
        return {
            success: false,
            error: err && err.message ? err.message : String(err),
            log: getLines(),
        };
    }
}

async function getDataTableRows(context, vscode, args, transport) {
    const tableName = args && args.tableName ? args.tableName : '';
    if (!tableName) {
        return { success: false, error: 'tableName parameter is required' };
    }
    const limit = (args && args.limit !== undefined) ? args.limit : 20;
    const offset = (args && args.offset !== undefined) ? args.offset : 0;
    const q = (args && (args.q || args.query)) || undefined;

    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    writeRunHeader(terminal, 'Get Data Table Rows', tableName);
    terminal.show();

    try {
        const res = await api.getDataTableRows(context, vscode, tableName, { limit, offset, q }, transport);
        if (!res || !isSuccess(res.statusCode)) {
            const code = res ? res.statusCode : 500;
            const desc = res ? describeError(res.body) : 'No response from server';
            return {
                success: false,
                error: `Failed to retrieve rows for "${tableName}" (HTTP ${code}). ${desc}`,
                log: getLines(),
            };
        }

        const body = typeof res.body === 'string' ? JSON.parse(res.body) : (res.body || {});
        const rows = Array.isArray(body) ? body : (body.items || []);

        writeTerminalMessage(
            terminal,
            'Data Table Rows: ',
            `Retrieved ${rows.length} rows for "${tableName}" (${formatElapsed(startedAt)})`,
            '\x1b[32m',
        );

        return {
            success: true,
            tableName,
            count: rows.length,
            totalResults: body.totalResults !== undefined ? body.totalResults : rows.length,
            hasMore: Boolean(body.hasMore),
            rows,
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
    getDataTableSchema,
    getDataTableRows,
};
