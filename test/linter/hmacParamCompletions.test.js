const assert = require("assert");
const { resolveParameterCompletions } = require("../../app/lang/intellisense/paramCompletions");

suite("BML Intellisense - generatehmacmessage Parameter Suggestions", () => {
    const mockDocument = {
        lineAt: () => ({ text: 'res = generatehmacmessage("msg", "key", "")' })
    };
    const mockPosition = { line: 0, character: 41 };

    test("generatehmacmessage() parameter 3 (algorithm) completion suggestions", () => {
        const activeCall = { funcName: "generatehmacmessage", paramIndex: 2 };
        const items = resolveParameterCompletions(activeCall, mockDocument, mockPosition);
        assert.ok(items && items.length >= 5, "Should return HMAC algorithm suggestions");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("SHA256"), "Should include 'SHA256'");
        assert.ok(labels.includes("SHA384"), "Should include 'SHA384'");
        assert.ok(labels.includes("SHA512"), "Should include 'SHA512'");
        assert.ok(labels.includes("SHA1"), "Should include 'SHA1'");
        assert.ok(labels.includes("MD5"), "Should include 'MD5'");
    });
});
