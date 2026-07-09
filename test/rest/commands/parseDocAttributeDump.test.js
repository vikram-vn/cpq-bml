const assert = require("assert");
const { parseDocAttributeDump } = require("../../../app/lang/rest/commands/debug");

suite("BML REST commands - debug - parseDocAttributeDump", () => {
  test("splits documentNumber 1 into header and 2+ into per-line rows", () => {
    const dump = "1~customerName~Acme|1~customerId~12345|2~quantity~10|2~price~99.99|3~quantity~5|3~price~49.99";
    const result = parseDocAttributeDump(dump);

    assert.deepStrictEqual(result.header, [
      { variableName: "customerName", value: "Acme" },
      { variableName: "customerId", value: "12345" },
    ]);
    assert.deepStrictEqual(result.lines, [
      { documentNumber: 2, quantity: "10", price: "99.99" },
      { documentNumber: 3, quantity: "5", price: "49.99" },
    ]);
  });

  test("sorts line rows by documentNumber regardless of input order", () => {
    const dump = "3~qty~5|1~name~Acme|2~qty~10";
    const result = parseDocAttributeDump(dump);
    assert.deepStrictEqual(result.lines.map((l) => l.documentNumber), [2, 3]);
  });

  test("keeps a value containing its own ~ characters intact", () => {
    const dump = "1~note~a~b~c";
    const result = parseDocAttributeDump(dump);
    assert.deepStrictEqual(result.header, [{ variableName: "note", value: "a~b~c" }]);
  });

  test("ignores malformed segments (missing a second ~ or a non-numeric prefix)", () => {
    const dump = "1~customerName~Acme|garbage|notanumber~x~y";
    const result = parseDocAttributeDump(dump);
    assert.deepStrictEqual(result.header, [{ variableName: "customerName", value: "Acme" }]);
    assert.deepStrictEqual(result.lines, []);
  });

  test("returns null for plain text with no ~ at all", () => {
    assert.strictEqual(parseDocAttributeDump("just a normal return value"), null);
  });

  test("returns null for a non-string input", () => {
    assert.strictEqual(parseDocAttributeDump({ foo: "bar" }), null);
    assert.strictEqual(parseDocAttributeDump(undefined), null);
    assert.strictEqual(parseDocAttributeDump(null), null);
  });

  test("returns null when every segment fails to match the format", () => {
    assert.strictEqual(parseDocAttributeDump("a~b|c~d"), null);
  });
});
