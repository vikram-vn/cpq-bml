const assert = require("assert");
const { lintText } = require("./fixtures");

suite("BML Linter Test Suite - Commerce Attributes Scope tests", () => {
    test("Flags Line Item attribute (_l) accessed on Transaction object", () => {
        const diagnostics = lintText(`
            quantityVal = get(transaction, "quantity_l");
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.ok(diag, "Should flag Line-level attribute (_l) accessed on Transaction object");
        assert.ok(diag.message.includes("Line Item level attribute"));
    });

    test("Flags Transaction attribute (_t) accessed on Line Item object", () => {
        const diagnostics = lintText(`
            totalVal = get(lineRow, "totalAmount_t");
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.ok(diag, "Should flag Transaction-level attribute (_t) accessed on Line Item object");
        assert.ok(diag.message.includes("Transaction header level attribute"));
    });

    test("Flags Line Item attribute via dot notation on Transaction object", () => {
        const diagnostics = lintText(`
            q = transaction.partNumber_l;
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.ok(diag, "Should flag dot notation access of line attribute on transaction object");
    });

    test("Does not flag correct scope: Transaction attribute on Transaction object", () => {
        const diagnostics = lintText(`
            totalVal = get(transaction, "totalAmount_t");
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.strictEqual(diag, undefined);
    });

    test("Does not flag correct scope: Line attribute on Line Item object", () => {
        const diagnostics = lintText(`
            q = get(lineRow, "quantity_l");
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.strictEqual(diag, undefined);
    });

    test("Flags Transaction attribute on custom loop variable iterating _line_items", () => {
        const diagnostics = lintText(`
            for row in _line_items {
                t = get(row, "totalAmount_t");
            }
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.ok(diag, "Should detect 'row' as a Line Item object from for-in loop over _line_items");
    });

    test("Flags Transaction attribute on loop variable iterating transactionLines", () => {
        const diagnostics = lintText(`
            for itm in transactionLines {
                val = get(itm, "status_t");
            }
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.ok(diag, "Should detect 'itm' as a Line Item object from for-in loop over transactionLines");
    });
});
