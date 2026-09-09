/**
 * In-memory ring buffer tracking MCP tool requests and performance.
 * Keeps the latest 50 requests for real-time inspection in the web panel.
 */

const MAX_ENTRIES = 50;
const trafficBuffer = [];
let nextId = 1;

/**
 * Records an MCP request.
 *
 * @param {{ tool: string, durationMs: number, success: boolean, error?: string, args?: any, resultSummary?: string }} entry
 */
function recordMcpRequest(entry) {
    const record = {
        id: nextId++,
        timestamp: new Date().toISOString(),
        tool: entry.tool || 'unknown',
        durationMs: Math.round(entry.durationMs || 0),
        success: !!entry.success,
        error: entry.error || null,
        args: entry.args || null,
        resultSummary: entry.resultSummary || null,
    };

    trafficBuffer.unshift(record);
    if (trafficBuffer.length > MAX_ENTRIES) {
        trafficBuffer.pop();
    }
    return record;
}

/**
 * Returns recent MCP requests.
 */
function getMcpTraffic() {
    return [...trafficBuffer];
}

/**
 * Clears the traffic buffer.
 */
function clearMcpTraffic() {
    trafficBuffer.length = 0;
}

module.exports = {
    recordMcpRequest,
    getMcpTraffic,
    clearMcpTraffic,
};
