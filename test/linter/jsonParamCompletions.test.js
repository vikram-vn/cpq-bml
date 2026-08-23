const assert = require("assert");
const { resolveParameterCompletions } = require("../../app/lang/intellisense/paramCompletions");

suite("BML Intellisense - JSON Functions Parameter Suggestions", () => {
    const mockDocument = {
        lineAt: () => ({ text: 'v = jsonget(j, "key", "")' })
    };
    const mockPosition = { line: 0, character: 23 };

    test("jsonget() parameter 3 (valueType) completion suggestions", () => {
        const activeCall = { funcName: "jsonget", paramIndex: 2 };
        const items = resolveParameterCompletions(activeCall, mockDocument, mockPosition);
        assert.ok(items && items.length >= 6, "Should return valueType suggestions for jsonget");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("string"), "Should include 'string'");
        assert.ok(labels.includes("integer"), "Should include 'integer'");
        assert.ok(labels.includes("float"), "Should include 'float'");
        assert.ok(labels.includes("boolean"), "Should include 'boolean'");
        assert.ok(labels.includes("json"), "Should include 'json'");
        assert.ok(labels.includes("jsonarray"), "Should include 'jsonarray'");
    });

    test("jsonpathgetsingle() parameter 2 (JSONPath) completion suggestions", () => {
        const doc = { lineAt: () => ({ text: 'v = jsonpathgetsingle(j, "")' }) };
        const activeCall = { funcName: "jsonpathgetsingle", paramIndex: 1 };
        const items = resolveParameterCompletions(activeCall, doc, { line: 0, character: 26 });
        assert.ok(items && items.length > 5, "Should return JSONPath templates");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("$.fieldName"), "Should include $.fieldName");
        assert.ok(labels.includes("$.array[0]"), "Should include $.array[0]");
    });
});
