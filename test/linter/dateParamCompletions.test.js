const assert = require("assert");
const { resolveParameterCompletions } = require("../../app/lang/intellisense/paramCompletions");

suite("BML Intellisense - Date Functions Parameter Suggestions", () => {
    const mockDocument = {
        lineAt: () => ({ text: 'd = getdate()' })
    };
    const mockPosition = { line: 0, character: 12 };

    test("getdate() parameter 1 (includeTime) completion suggestions", () => {
        const activeCall = { funcName: "getdate", paramIndex: 0 };
        const items = resolveParameterCompletions(activeCall, mockDocument, mockPosition);
        assert.ok(items && items.length === 2, "Should return true/false for getdate()");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("true"), "Should include 'true'");
        assert.ok(labels.includes("false"), "Should include 'false'");
    });

    test("strtojavadate() parameter 2 (dateFormat) completion suggestions", () => {
        const doc = { lineAt: () => ({ text: 'd = strtojavadate("01/01/2020", "")' }) };
        const activeCall = { funcName: "strtojavadate", paramIndex: 1 };
        const items = resolveParameterCompletions(activeCall, doc, { line: 0, character: 32 });
        assert.ok(items && items.length > 5, "Should return date formats");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("yyyy-MM-dd HH:mm:ss"), "Should include standard 24-hr format");
        assert.ok(labels.includes("MM/dd/yyyy"), "Should include US date format");
    });
});
