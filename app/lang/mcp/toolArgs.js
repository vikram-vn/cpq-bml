'use strict';

const { isContextOrVscode, setApiContext, getApiContext } = require('@/lang/rest/apiCore');

/**
 * Normalizes tool invocation arguments so functions can be declared with clean
 * signatures like `myTool(args = {}, transport)` while retaining seamless
 * backwards-compatibility for callers passing legacy `(context, vscode, args, transport)`.
 */
function normalizeToolArgs(callArgs) {
    if (callArgs && callArgs.length >= 2 && isContextOrVscode(callArgs[0])) {
        const ctx = callArgs[0];
        const vsc = callArgs[1];
        setApiContext(ctx, vsc);
        return {
            context: ctx,
            vscode: vsc,
            args: callArgs[2] || {},
            transport: callArgs[3],
        };
    }
    const { context, vscode } = getApiContext();
    return {
        context,
        vscode,
        args: (callArgs && callArgs[0]) || {},
        transport: callArgs && callArgs[1],
    };
}

module.exports = { normalizeToolArgs };
