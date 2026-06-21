const assert = require("assert");
const { createFakeVscode } = require("../test-helpers");
const { refreshConnectionConfiguredContext } = require("../../../app/lang/rest/commands");

// The editor/title toolbar icons (Save/Validate/Debug/Deploy/etc.) are gated
// in package.json on the cpqBml.connection.configured context key in addition
// to the cpqBml.connection.enabled setting - enabled alone defaults to true,
// so without this key every icon would show up on a fresh install before any
// siteUrl is ever configured.
suite("BML REST commands - connection-configured context key", () => {
    test("sets the context key to false when no siteUrl is configured", () => {
        const calls = [];
        const vscode = createFakeVscode({
            config: {},
            commands: { executeCommand: async (...args) => calls.push(args) },
        });

        refreshConnectionConfiguredContext(vscode);

        assert.deepStrictEqual(calls, [["setContext", "cpqBml.connection.configured", false]]);
    });

    test("sets the context key to true once a siteUrl is configured", () => {
        const calls = [];
        const vscode = createFakeVscode({
            config: { "connection.siteUrl": "https://sitename.oracle.com" },
            commands: { executeCommand: async (...args) => calls.push(args) },
        });

        refreshConnectionConfiguredContext(vscode);

        assert.deepStrictEqual(calls, [["setContext", "cpqBml.connection.configured", true]]);
    });

    test("treats a blank/whitespace-only siteUrl as not configured", () => {
        const calls = [];
        const vscode = createFakeVscode({
            config: { "connection.siteUrl": "   " },
            commands: { executeCommand: async (...args) => calls.push(args) },
        });

        refreshConnectionConfiguredContext(vscode);

        assert.deepStrictEqual(calls, [["setContext", "cpqBml.connection.configured", false]]);
    });
});
