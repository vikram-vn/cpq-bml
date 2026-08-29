const assert = require("assert");
const { lintText } = require("../fixtures");

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

    test("Allows Transaction attribute (_t) accessed on Line Item object", () => {
        const diagnostics = lintText(`
            totalVal = get(lineRow, "totalAmount_t");
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.strictEqual(diag, undefined, "Should allow _t attributes on Line Item object");
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

    test("Allows Transaction attribute (_t) on loop variable iterating transactionLine", () => {
        const diagnostics = lintText(`
            for itm in transactionLine {
                val = get(itm, "status_t");
            }
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-commerce-attribute-scope-mismatch');
        assert.strictEqual(diag, undefined, "Should allow _t attributes inside transactionLine loop");
    });
});
