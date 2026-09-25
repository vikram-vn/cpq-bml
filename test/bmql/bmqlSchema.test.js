const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkBmqlSchema } = require('@/lang/lint/rules/bmqlSchema');

suite('BMQL Static Schema Validator - Unit Tests', () => {
  let tempWs;

  setup(() => {
    tempWs = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-bmql-schema-test-'));
    // Create a mock Data Table schema Pricing.dt.json
    fs.writeFileSync(
      path.join(tempWs, 'Pricing.dt.json'),
      JSON.stringify({
        name: 'Pricing',
        columns: [
          { name: 'partNumber', type: 'string' },
          { name: 'listPrice', type: 'float' },
          { name: 'currency', type: 'string' }
        ]
      }),
      'utf8'
    );
  });

  teardown(() => {
    try {
      fs.rmSync(tempWs, { recursive: true, force: true });
    } catch {}
  });

  test('validates valid columns in BMQL query without errors', () => {
    const code = `
      res = bmql("SELECT partNumber, listPrice FROM Pricing WHERE currency == 'USD'");
    `;
    const mockDoc = { uri: { fsPath: path.join(tempWs, 'test.bml') } };
    const mockVscode = {
      workspace: {
        getWorkspaceFolder: () => ({ uri: { fsPath: tempWs } })
      },
      Diagnostic: function (range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
      },
      DiagnosticSeverity: { Error: 0, Warning: 1 },
      Range: function (sl, sc, el, ec) {
        this.start = { line: sl, character: sc };
        this.end = { line: el, character: ec };
      }
    };

    const diagnostics = checkBmqlSchema(code, mockDoc, mockVscode);
    assert.strictEqual(diagnostics.length, 0);
  });

  test('flags error when selecting non-existent column from known Data Table', () => {
    const code = `
      res = bmql("SELECT invalidColumn, listPrice FROM Pricing");
    `;
    const mockDoc = { uri: { fsPath: path.join(tempWs, 'test.bml') } };
    const mockVscode = {
      workspace: {
        getWorkspaceFolder: () => ({ uri: { fsPath: tempWs } })
      },
      Diagnostic: function (range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
      },
      DiagnosticSeverity: { Error: 0, Warning: 1 },
      Range: function (sl, sc, el, ec) {
        this.start = { line: sl, character: sc };
        this.end = { line: el, character: ec };
      }
    };

    const diagnostics = checkBmqlSchema(code, mockDoc, mockVscode);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'bml-bmql-invalid-column');
    assert.ok(diagnostics[0].message.includes("Column 'invalidColumn' does not exist on Data Table 'Pricing'"));
  });

  test('flags warning when referencing unknown Data Table', () => {
    const code = `
      res = bmql("SELECT id FROM NonExistentTable");
    `;
    const mockDoc = { uri: { fsPath: path.join(tempWs, 'test.bml') } };
    const mockVscode = {
      workspace: {
        getWorkspaceFolder: () => ({ uri: { fsPath: tempWs } })
      },
      Diagnostic: function (range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
      },
      DiagnosticSeverity: { Error: 0, Warning: 1 },
      Range: function (sl, sc, el, ec) {
        this.start = { line: sl, character: sc };
        this.end = { line: el, character: ec };
      }
    };

    const diagnostics = checkBmqlSchema(code, mockDoc, mockVscode);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'bml-bmql-unknown-table');
    assert.ok(diagnostics[0].message.includes("references unknown Data Table 'NonExistentTable'"));
  });
});
