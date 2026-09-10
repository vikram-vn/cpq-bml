const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  isCodeSpellCheckerInstalled,
  checkSpelling
} = require('@/lang/spell-check/spelling');

suite('Code Spell Checker Integration - Unit Tests', () => {
  function createMockVscode(installedExtensionId = null) {
    function Position(line, character) {
      this.line = line;
      this.character = character;
    }
    function Range(start, end) {
      this.start = start;
      this.end = end;
    }
    function Diagnostic(range, message, severity) {
      this.range = range;
      this.message = message;
      this.severity = severity;
    }

    return {
      Position,
      Range,
      Diagnostic,
      DiagnosticSeverity: { Information: 2 },
      workspace: {
        getConfiguration: () => ({
          get: (key, def) => def
        })
      },
      extensions: {
        getExtension: (id) => {
          if (id === installedExtensionId) {
            return { id, isActive: true };
          }
          return undefined;
        }
      }
    };
  }

  function createMockDoc(text) {
    const lines = text.split(/\r?\n/);
    const lineOffsets = [0];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') lineOffsets.push(i + 1);
    }
    return {
      languageId: 'bml',
      getText: () => text,
      positionAt: (idx) => {
        let low = 0, high = lineOffsets.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (lineOffsets[mid] <= idx) low = mid + 1;
          else high = mid - 1;
        }
        const line = high;
        const col = idx - lineOffsets[line];
        return { line, character: col };
      }
    };
  }

  test('isCodeSpellCheckerInstalled detects streetsidesoftware.code-spell-checker', () => {
    const vs = createMockVscode('streetsidesoftware.code-spell-checker');
    assert.strictEqual(isCodeSpellCheckerInstalled(vs), true);
  });

  test('isCodeSpellCheckerInstalled detects streetsidesoftware.code-spell-checker-canary', () => {
    const vs = createMockVscode('streetsidesoftware.code-spell-checker-canary');
    assert.strictEqual(isCodeSpellCheckerInstalled(vs), true);
  });

  test('isCodeSpellCheckerInstalled returns false when Code Spell Checker is missing', () => {
    const vs = createMockVscode(null);
    assert.strictEqual(isCodeSpellCheckerInstalled(vs), false);
  });

  test('isCodeSpellCheckerInstalled handles null or malformed vscode gracefully', () => {
    assert.strictEqual(isCodeSpellCheckerInstalled(null), false);
    assert.strictEqual(isCodeSpellCheckerInstalled({}), false);
  });

  test('checkSpelling returns empty array when Code Spell Checker is not installed', () => {
    const vs = createMockVscode(null);
    const code = 'mispelledVarName = 123;\nreturn "";';
    const doc = createMockDoc(code);
    const diags = checkSpelling(code, code, code, doc, vs);
    assert.strictEqual(diags.length, 0, 'Should not report any spelling diagnostics when Code Spell Checker is absent');
  });

  test('checkSpelling reports unrecognized BML identifiers when Code Spell Checker is installed', () => {
    const vs = createMockVscode('streetsidesoftware.code-spell-checker');
    const code = 'mispelledVarName = 123;\nreturn "";';
    const doc = createMockDoc(code);
    const diags = checkSpelling(code, code, code, doc, vs);
    assert.ok(diags.length > 0, 'Should report spelling diagnostics for unknown identifier parts');
    assert.ok(diags.some(d => d.message.includes('mispelled')), 'Should flag mispelled');
  });

  test('package.json contributes valid cSpell configuration and dictionary files', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert.ok(pkg.contributes.cSpell, 'package.json must contain contributes.cSpell');
    assert.ok(Array.isArray(pkg.contributes.cSpell.dictionaries), 'cSpell.dictionaries must be an array');
    assert.ok(Array.isArray(pkg.contributes.cSpell.languageSettings), 'cSpell.languageSettings must be an array');

    for (const dict of pkg.contributes.cSpell.dictionaries) {
      const resolvedPath = path.resolve(__dirname, '../../', dict.path);
      assert.ok(fs.existsSync(resolvedPath), `Dictionary file must exist: ${dict.path}`);
      const content = fs.readFileSync(resolvedPath, 'utf8');
      assert.ok(content.length > 0, `Dictionary file must not be empty: ${dict.path}`);
    }
  });
});
