const assert = require("assert");
const { resolveParameterCompletions } = require("../../app/lang/intellisense/paramCompletions");

suite("BML Intellisense - Array Functions Parameter Suggestions", () => {
    const mockDocument = {
        lineAt: () => ({ text: 'b = bytearray("test", "")' })
    };
    const mockPosition = { line: 0, character: 23 };

    test("bytearray() parameter 2 (charset) completion suggestions", () => {
        const activeCall = { funcName: "bytearray", paramIndex: 1 };
        const items = resolveParameterCompletions(activeCall, mockDocument, mockPosition);
        assert.ok(items && items.length >= 4, "Should return charset suggestions for bytearray");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("UTF-8"), "Should include 'UTF-8'");
        assert.ok(labels.includes("UTF-16"), "Should include 'UTF-16'");
        assert.ok(labels.includes("ASCII"), "Should include 'ASCII'");
        assert.ok(labels.includes("ISO-8859-1"), "Should include 'ISO-8859-1'");
    });
});
