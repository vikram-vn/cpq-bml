const assert = require("assert");
const { formatAsJsDoc, formatWorkspaceFunctionHover, KEYWORD_HOVERS } = require("../../app/lang/intellisense/docFormatting");

suite("BML Intellisense - Hover Documentation Enhancements", () => {
    test("formatAsJsDoc formats built-in function info into Markdown", () => {
        const info = {
            category: "function",
            functionCategory: "direct_db_access",
            fullSignature: "recordset bmql(String query)",
            notes: "Executes BMQL query.",
            examples: ["res = bmql(\"SELECT name FROM table\");"]
        };
        const md = formatAsJsDoc(info);
        assert.ok(md && md.value, "Should return a MarkdownString");
        assert.ok(md.value.includes("bmql"), "Markdown should contain function signature");
        assert.ok(md.value.includes("database function"), "Markdown should contain database function metadata label");
        assert.ok(md.value.includes("Executes BMQL query."), "Markdown should contain usage notes");
    });

    test("formatWorkspaceFunctionHover formats workspace indexed function", () => {
        const wsInfo = {
            qualifiedName: "util.calculateDiscount",
            filePath: "c:/project/library/calculateDiscount.bml",
            line: 5,
            parameters: [
                { name: "price", dataType: "Float" },
                { name: "discountPct", dataType: "Float" }
            ],
            returnType: "Float",
            docHeader: "Calculates net price after applying percentage discount."
        };
        const md = formatWorkspaceFunctionHover(wsInfo);
        assert.ok(md && md.value, "Should return a MarkdownString for workspace function");
        assert.ok(md.value.includes("util.calculateDiscount"), "Markdown should contain qualified function name");
        assert.ok(md.value.includes("Workspace BML Function"), "Markdown should identify it as Workspace BML Function");
        assert.ok(md.value.includes("discountPct"), "Markdown should list parameters");
        assert.ok(md.value.includes("Returns:** `Float`"), "Markdown should list return type");
        assert.ok(md.value.includes("Source: `util.calculateDiscount`"), "Markdown should include source link");
    });

    test("KEYWORD_HOVERS provides hover for BML control keywords", () => {
        assert.ok(KEYWORD_HOVERS["if"], "Should contain 'if' hover");
        assert.ok(KEYWORD_HOVERS["return"], "Should contain 'return' hover");
        assert.ok(KEYWORD_HOVERS["bmql"], "Should contain 'bmql' hover");

        const ifHover = formatAsJsDoc(KEYWORD_HOVERS["if"]);
        assert.ok(ifHover.value.includes("if (condition)"), "Should format 'if' keyword syntax");
    });
});
