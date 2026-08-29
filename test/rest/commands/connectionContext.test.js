const assert = require("assert");
const { createFakeVscode, createFakeContext } = require("../testHelpers");
const { refreshConnectionConfiguredContext } = require("../../../app/lang/rest/commands");

// The editor/title toolbar icons (Save/Validate/Debug/Deploy/etc.) are gated
// in package.json on the cpqBml.connection.configured context key in addition
// to the cpqBml.connection.enabled setting - enabled alone defaults to true,
// so without this key every icon would show up on a fresh install before a
// usable connection (siteUrl + username/password or token) is configured.
// The underlying completeness checks themselves (siteUrl/username/password/
// token, basic vs bearer) are exhaustively covered by hasMissingCredentials's
// own tests in test/settings-panel/index.test.js - this only verifies the
// setContext wiring inverts that verdict correctly.
suite("BML REST commands - connection-configured context key", () => {
    test("sets the context key to false when credentials are missing (no siteUrl)", async () => {
        const calls = [];
        const context = createFakeContext();
        const vscode = createFakeVscode({
            config: {},
            commands: { executeCommand: async (...args) => calls.push(args) },
        });

        await refreshConnectionConfiguredContext(context, vscode);

        assert.deepStrictEqual(calls, [["setContext", "cpqBml.connection.configured", false]]);
    });

    test("sets the context key to false when siteUrl is set but the password secret is missing", async () => {
        const calls = [];
        const context = createFakeContext();
        const vscode = createFakeVscode({
            config: {
                "connection.siteUrl": "testsite",
                "connection.authMethod": "basic",
                "connection.username": "testuser",
            },
            commands: { executeCommand: async (...args) => calls.push(args) },
        });

        await refreshConnectionConfiguredContext(context, vscode);

        assert.deepStrictEqual(calls, [["setContext", "cpqBml.connection.configured", false]]);
    });

    test("sets the context key to true once siteUrl, username and password are all present", async () => {
        const calls = [];
        const context = createFakeContext({
            "cpqBml.connection.password.https___testsite_bigmachines_com.testuser": "mypassword",
        });
        const vscode = createFakeVscode({
            config: {
                "connection.siteUrl": "testsite",
                "connection.authMethod": "basic",
                "connection.username": "testuser",
            },
            commands: { executeCommand: async (...args) => calls.push(args) },
        });

        await refreshConnectionConfiguredContext(context, vscode);

        assert.deepStrictEqual(calls, [["setContext", "cpqBml.connection.configured", true]]);
    });

    test("sets the context key to true for bearer auth once the token secret is present", async () => {
        const calls = [];
        const context = createFakeContext({
            "cpqBml.connection.token.https___testsite_bigmachines_com": "mytoken",
        });
        const vscode = createFakeVscode({
            config: {
                "connection.siteUrl": "testsite",
                "connection.authMethod": "bearer",
            },
            commands: { executeCommand: async (...args) => calls.push(args) },
        });

        await refreshConnectionConfiguredContext(context, vscode);

        assert.deepStrictEqual(calls, [["setContext", "cpqBml.connection.configured", true]]);
    });
});
