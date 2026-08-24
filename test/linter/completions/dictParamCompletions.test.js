const assert = require("assert");
const { resolveParameterCompletions } = require("../../../app/lang/intellisense/paramCompletions");

suite("BML Intellisense - Dictionary Parameter Suggestions", () => {
    const mockDocument = {
        lineAt: () => ({ text: 'd = dict("")' })
    };
    const mockPosition = { line: 0, character: 10 };

    test("dict() parameter 1 (dictType) completion suggestions", () => {
        const activeCall = { funcName: "dict", paramIndex: 0 };
        const items = resolveParameterCompletions(activeCall, mockDocument, mockPosition);
        assert.ok(items && items.length >= 15, "Should return dictionary type suggestions");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("string"), "Should include 'string'");
        assert.ok(labels.includes("anytype"), "Should include 'anytype'");
        assert.ok(labels.includes("string[]"), "Should include 'string[]'");
        assert.ok(labels.includes("string[][]"), "Should include 'string[][]'");
    });
});
