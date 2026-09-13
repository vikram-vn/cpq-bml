const api = require('@/lang/rest/api');
const {
    isSuccess,
    describeError,
    getTimestamp,
    writeRunHeader,
    writeTerminalMessage,
    formatElapsed,
} = require('@/lang/rest/commands/shared');
const { getAiTerminal } = require('@/lang/mcp/aiTerminal');
const { createCapturingTerminal } = require('@/lang/mcp/proxy');

async function listParts(context, vscode, args, transport) {
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    writeRunHeader(terminal, 'List Parts Catalog', 'parts');
    terminal.show();

    const offset = (args && args.offset !== undefined) ? args.offset : 0;
    const limit = (args && args.limit !== undefined) ? args.limit : 50;
    const q = (args && (args.q || args.query)) || undefined;
    const fields = (args && args.fields) || undefined;

    terminal.writeLine(`\x1b[36m${getTimestamp()} Querying Oracle CPQ Parts Catalog...\x1b[0m`);

    try {
        const result = await api.listParts(
            context,
            vscode,
            { offset, limit, q, fields },
            transport,
        );

        if (!isSuccess(result.statusCode)) {
            const message = `List parts failed (HTTP ${result.statusCode}). ${describeError(result.body)}`;
            writeTerminalMessage(terminal, 'Parts failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
            return { success: false, error: message, statusCode: result.statusCode, log: getLines() };
        }

        const body = result.body || {};
        const rawItems = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : []);
        const parts = rawItems.map((p) => {
            const partNumber = String(p.partNumber || p.id || p.itemNumber || 'Unknown');
            const description = String(p.description || p.partDescription || '');
            const price = p.price !== undefined ? p.price : '';
            const currency = String(p.currency || p.currencyCode || '');
            const status = String(p.status || '');
            const units = String(p.units || '');
            const dateModified = String(p.dateModified || p._date_modified || '');
            return {
                partNumber,
                description,
                price,
                currency,
                status,
                units,
                dateModified,
                customFields: p.customFields || undefined,
            };
        });

        writeTerminalMessage(
            terminal,
            'List Parts: ',
            `Retrieved ${parts.length} parts (${formatElapsed(startedAt)})`,
            '\x1b[32m',
        );

        return {
            success: true,
            count: parts.length,
            totalResults: body.totalResults !== undefined ? body.totalResults : parts.length,
            hasMore: Boolean(body.hasMore),
            parts,
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

async function getPart(context, vscode, args, transport) {
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    const startedAt = Date.now();
    const partNumber = args && (args.partNumber || args.id || args.itemNumber);
    if (!partNumber) {
        return { success: false, error: 'partNumber is required.' };
    }

    writeRunHeader(terminal, 'Get Part Details', String(partNumber));
    terminal.show();

    try {
        const result = await api.getPart(
            context,
            vscode,
            partNumber,
            { fields: args && args.fields },
            transport,
        );

        if (!isSuccess(result.statusCode)) {
            const message = `Get part "${partNumber}" failed (HTTP ${result.statusCode}). ${describeError(result.body)}`;
            writeTerminalMessage(terminal, 'Get part failed: ', `${message} (${formatElapsed(startedAt)})`, '\x1b[31m');
            return { success: false, error: message, statusCode: result.statusCode, log: getLines() };
        }

        const body = result.body || {};
        writeTerminalMessage(
            terminal,
            'Get Part: ',
            `Loaded part details for "${partNumber}" (${formatElapsed(startedAt)})`,
            '\x1b[32m',
        );

        return {
            success: true,
            partNumber,
            part: body,
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
    listParts,
    getPart,
};
