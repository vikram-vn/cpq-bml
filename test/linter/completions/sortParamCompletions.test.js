const assert = require("assert");
const { resolveParameterCompletions } = require("../../../app/lang/intellisense/paramCompletions");

suite("BML Intellisense - sort() Parameter Suggestions", () => {
    const mockDocument = {
        lineAt: () => ({ text: 'res = sort(a, "")' })
    };
    const mockPosition = { line: 0, character: 15 };

    test("sort() parameter 2 (sortOrder) completion suggestions", () => {
        const activeCall = { funcName: "sort", paramIndex: 1 };
        const items = resolveParameterCompletions(activeCall, mockDocument, mockPosition);
        assert.ok(items && items.length === 2, "Should return 2 sortOrder suggestions");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("asc"), "Should include 'asc'");
        assert.ok(labels.includes("desc"), "Should include 'desc'");
    });

    test("sort() parameter 3 (sortType) completion suggestions", () => {
        const activeCall = { funcName: "sort", paramIndex: 2 };
        const items = resolveParameterCompletions(activeCall, mockDocument, mockPosition);
        assert.ok(items && items.length === 3, "Should return 3 sortType suggestions");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.includes("text"), "Should include 'text'");
        assert.ok(labels.includes("numeric"), "Should include 'numeric'");
        assert.ok(labels.includes("date"), "Should include 'date'");
    });
});
