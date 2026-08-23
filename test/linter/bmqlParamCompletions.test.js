const assert = require("assert");
const { resolveParameterCompletions } = require("../../app/lang/intellisense/paramCompletions");

suite("BML Intellisense - bmql() Parameter Suggestions", () => {
    const mockDocument = {
        lineAt: () => ({ text: 'res = bmql("")' })
    };
    const mockPosition = { line: 0, character: 12 };

    test("bmql() parameter 1 query template suggestions", () => {
        const activeCall = { funcName: "bmql", paramIndex: 0 };
        const items = resolveParameterCompletions(activeCall, mockDocument, mockPosition);
        assert.ok(items && items.length >= 6, "Should return BMQL query templates");

        const labels = items.map(i => i.label || i.name);
        assert.ok(labels.some(l => l.includes("SELECT")), "Should include SELECT template");
        assert.ok(labels.some(l => l.includes("INSERT")), "Should include INSERT template");
        assert.ok(labels.some(l => l.includes("UPDATE")), "Should include UPDATE template");
        assert.ok(labels.some(l => l.includes("MODIFY")), "Should include MODIFY template");
        assert.ok(labels.some(l => l.includes("DELETE")), "Should include DELETE template");
        assert.ok(labels.some(l => l.includes("JOIN")), "Should include JOIN template");
    });
});
