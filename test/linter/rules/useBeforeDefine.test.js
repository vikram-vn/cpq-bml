const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - Use Before Define (bml-useBeforeDefine)", () => {
  test("Flags self-referencing uninitialized variable assignment (scope2 = scope2;)", () => {
    const diags = lintText(`
            rPrice_28 = 100.0;
            scope1 = rPrice_28;
            scope2 = scope2;
            return "";
        `);

    const err = diags.find(
      (d) =>
        d.code === "bml-useBeforeDefine" ||
        d.code === "bml-undeclared-variable",
    );
    assert.ok(
      err,
      "Should flag 'scope2 = scope2;' where scope2 is read before initial assignment completes",
    );
    assert.ok(
      err.message.includes("scope2"),
      "Error message should reference variable scope2",
    );
  });

  test("Flags reading an undefined variable (val = undeclaredVar;)", () => {
    const diags = lintText(`
            val = undeclaredVar;
            return "";
        `);

    const err = diags.find((d) => d.code === "bml-undeclared-variable");
    assert.ok(err, "Should flag reading an undefined variable 'undeclaredVar'");
    assert.ok(err.message.includes("undeclaredVar"));
  });

  test("Allows reading a variable defined in a prior statement", () => {
    const diags = lintText(`
            validVar = "hello";
            scope2 = validVar;
            return scope2;
        `);

    const errs = diags.filter(
      (d) =>
        (d.code === "bml-useBeforeDefine" ||
          d.code === "bml-undeclared-variable") &&
        (d.message.includes("validVar") || d.message.includes("scope2")),
    );
    assert.strictEqual(
      errs.length,
      0,
      "Should not flag variables declared in prior statements",
    );
  });

  test("Allows transactionLine and transactionLine in commerce loops without flagging as undeclared", () => {
    const diags = lintText(`
            docNumArr = String[];
            for line in transactionLine {
                docNum = line._document_number;
                append(docNumArr, docNum);
            }
            return "";
        `);
    const undeclared = diags.filter(
      (d) =>
        d.code === "bml-undeclared-variable" &&
        d.message.includes("transactionLine"),
    );
    assert.strictEqual(
      undeclared.length,
      0,
      "Should not flag transactionLine or transactionLine as undeclared",
    );
  });
});
