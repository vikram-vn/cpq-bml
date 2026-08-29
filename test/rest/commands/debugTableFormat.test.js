const assert = require("assert");
const {
  formatRowsAsTable,
  tableLinesToString,
  formatDocAttributeDumpTables,
} = require("../../../app/lang/rest/commands/debugTableFormat");

suite("BML REST commands - debugTableFormat", () => {
  suite("formatRowsAsTable", () => {
    test("renders a box-drawing bordered table with aligned columns, typed by line (border/header/data)", () => {
      const tableLines = formatRowsAsTable(["Variable", "Value"], [["flag", "false"], ["total", "0.0"]]);
      const texts = tableLines.map((l) => l.text);

      assert.strictEqual(texts[0], "┌──────────┬───────┐");
      assert.strictEqual(texts[1], "│ Variable │ Value │");
      assert.strictEqual(texts[2], "├──────────┼───────┤");
      assert.strictEqual(texts[3], "│ flag     │ false │");
      assert.strictEqual(texts[4], "├──────────┼───────┤"); // a border between every row, not just after the header
      assert.strictEqual(texts[5], "│ total    │ 0.0   │");
      assert.strictEqual(texts[6], "└──────────┴───────┘");

      assert.deepStrictEqual(
        tableLines.map((l) => l.type),
        ["border", "header", "border", "data", "border", "data", "border"],
      );
    });

    test("word-wraps a value long enough to otherwise blow out every row's width, instead of losing any of it", () => {
      const longValue = "abcdefghij".repeat(30); // 300 distinct-ish chars, wraps into 5 x 60-char chunks
      const table = tableLinesToString(formatRowsAsTable(
        ["Variable", "Value"],
        [["bigOne", longValue], ["flag", "false"]],
      ));
      const lines = table.split("\n");

      // No line should come anywhere close to the original 300-char value's width.
      assert.ok(lines.every((l) => l.length < 100), "no rendered line should be anywhere near 300 chars wide");
      // Every 60-char chunk of the original value must appear somewhere - nothing dropped.
      for (let i = 0; i < longValue.length; i += 60) {
        const chunk = longValue.slice(i, i + 60);
        assert.ok(table.includes(chunk), `chunk "${chunk}" should be present, not truncated away`);
      }
      assert.ok(!table.includes("…"), "no data should be dropped/ellipsized");
      // The short row must not carry huge trailing padding to match the long value's original width.
      const flagLine = lines.find((l) => l.includes("flag"));
      assert.ok(flagLine.length < 100);
    });
  });

  suite("formatDocAttributeDumpTables", () => {
    test("adds a Label column: strips a trailing _t/_c/_l and title-cases the rest of the variable name", () => {
      const parsed = {
        header: [
          { variableName: "status_t", value: "Active" },
          { variableName: "netLaborCostBackup_t", value: "123" },
          { variableName: "customerName", value: "Acme" },
          { variableName: "discount_c", value: "5" },
          { variableName: "qty_l", value: "10" },
        ],
        lines: [],
      };
      const { headerTable } = formatDocAttributeDumpTables(parsed);
      const table = tableLinesToString(headerTable);
      const lines = table.split("\n");

      assert.ok(lines[1].includes("Label") && lines[1].includes("Variable Name") && lines[1].includes("Value"));
      assert.ok(lines.some((l) => l.includes("Status") && l.includes("status_t") && l.includes("Active")));
      assert.ok(lines.some((l) => l.includes("Net Labor Cost Backup") && l.includes("netLaborCostBackup_t")));
      // No _t/_c/_l suffix to strip - just title-cased as-is.
      assert.ok(lines.some((l) => l.includes("Customer Name") && l.includes("customerName") && l.includes("Acme")));
      assert.ok(lines.some((l) => l.includes("Discount") && l.includes("discount_c") && l.includes("5")));
      assert.ok(lines.some((l) => l.includes("Qty") && l.includes("qty_l") && l.includes("10")));
      // A border row between every data row, not just after the header.
      const borderCount = headerTable.filter((l) => l.type === "border").length;
      assert.strictEqual(borderCount, 1 /* top */ + 1 /* header sep */ + 4 /* between the 5 rows */ + 1 /* bottom */);
    });

    test("word-wraps long header values so the whole header table stays a reasonable width, without dropping any data", () => {
      const longValue = JSON.stringify({
        "Gardner L1-L2 Gen labor": "19.64$$21.0$$5.56$$2.6",
        "Irrigation": "23.0$$21.0$$5.56$$2.6",
        "Gardner L3-L4 Advanced labor": "24.21$$21.0$$5.56$$2.6",
      });
      const parsed = {
        header: [
          { variableName: "netLaborCostBackup_t", value: longValue },
          { variableName: "subcontractorFlag_t", value: "false" },
        ],
        lines: [],
      };
      const { headerTable } = formatDocAttributeDumpTables(parsed);
      const table = tableLinesToString(headerTable);
      const lines = table.split("\n");

      // Label + Variable Name + a MAX_CELL_WIDTH(60)-wrapped Value column, plus borders -
      // bounded and predictable, not the original bug's unbounded 300+ char blowout.
      assert.ok(lines.every((l) => l.length < 130), "header table lines should stay reasonably narrow");
      assert.ok(!table.includes("…"), "no data should be dropped/ellipsized");
      for (let i = 0; i < longValue.length; i += 60) {
        assert.ok(table.includes(longValue.slice(i, i + 60)), "every chunk of the long value should be present");
      }
      // Every line (border, header, rows) must be the same width - a real rectangular table.
      const widths = new Set(lines.map((l) => l.length));
      assert.strictEqual(widths.size, 1, "all lines should be the same width");
    });

    test("transposed line table also gets a border between every variable row", () => {
      const parsed = {
        header: [],
        lines: [
          { documentNumber: 2, qty_t: "10", price_t: "99.99" },
          { documentNumber: 3, qty_t: "5", price_t: "49.99" },
        ],
      };
      const { lineTable } = formatDocAttributeDumpTables(parsed);
      const borderCount = lineTable.filter((l) => l.type === "border").length;
      // top + header-sep + 1 separator between the 2 variable rows (Qty, Price) + bottom
      assert.strictEqual(borderCount, 1 + 1 + 1 + 1);
    });
  });
});
