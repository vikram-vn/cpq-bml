const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');
const {
    checkMetadataTypeConsistency,
    getDeclaredParameterTypes,
    normalizeTypeLabel,
    getReturnTypeLabels,
    getParamTypeLabels,
} = require('../../app/lang/lint/metadataTypes');
const { inferLiteralType, checkAssignmentTypeConsistency } = require('../../app/lang/lint/typeCheck');

function withTempDir(fn) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bml-metadata-types-test-'));
    try {
        return fn(tmpDir);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function writeBmlWithMeta(dir, name, bmlText, meta) {
    const bmlPath = path.join(dir, `${name}.bml`);
    fs.writeFileSync(bmlPath, bmlText, 'utf8');
    fs.writeFileSync(path.join(dir, `${name}-meta.json`), JSON.stringify(meta), 'utf8');
    return bmlPath;
}

function makeDoc(bmlPath, text) {
    return {
        uri: { fsPath: bmlPath },
        positionAt: (idx) => {
            const lines = text.slice(0, idx).split(/\r?\n/);
            return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
        },
    };
}

suite('BML Linter Test Suite - metadata sidecar type validation', () => {
    test('Loads real lookup tables with entries', () => {
        assert.ok(getReturnTypeLabels().size > 0);
        assert.ok(getParamTypeLabels().size > 0);
    });

    test('normalizeTypeLabel collapses all Dictionary variants to Dictionary', () => {
        assert.strictEqual(normalizeTypeLabel('String Dictionary'), 'Dictionary');
        assert.strictEqual(normalizeTypeLabel('Anytype Dictionary'), 'Dictionary');
        assert.strictEqual(normalizeTypeLabel('Dictionary of String Dictionaries'), 'Dictionary');
    });

    test('normalizeTypeLabel lowercases the element type of array labels', () => {
        assert.strictEqual(normalizeTypeLabel('String[]'), 'string[]');
        assert.strictEqual(normalizeTypeLabel('Integer[][]'), 'integer[][]');
    });

    test('normalizeTypeLabel leaves plain primitives and named constructors unchanged', () => {
        assert.strictEqual(normalizeTypeLabel('String'), 'String');
        assert.strictEqual(normalizeTypeLabel('Json'), 'Json');
        assert.strictEqual(normalizeTypeLabel('ByteArray'), 'ByteArray');
    });

    test('Flags a return statement that conflicts with the declared return type', () => {
        withTempDir((dir) => {
            const text = 'return "not a number";';
            const bmlPath = writeBmlWithMeta(dir, 'fn', text, {
                returnType: { value: 3, displayValue: 'Integer' },
                parameters: [],
            });
            const doc = makeDoc(bmlPath, text);
            const diags = checkMetadataTypeConsistency(text, doc, vscode, inferLiteralType);
            const diag = diags.find((d) => d.code === 'bml-return-type-mismatch');
            assert.ok(diag, 'Should flag the return type mismatch');
            assert.ok(diag.message.includes('Integer') && diag.message.includes('String'));
        });
    });

    test('Does not flag a return statement matching the declared return type', () => {
        withTempDir((dir) => {
            const text = 'return 42;';
            const bmlPath = writeBmlWithMeta(dir, 'fn', text, {
                returnType: { value: 3, displayValue: 'Integer' },
                parameters: [],
            });
            const doc = makeDoc(bmlPath, text);
            const diags = checkMetadataTypeConsistency(text, doc, vscode, inferLiteralType);
            assert.strictEqual(diags.find((d) => d.code === 'bml-return-type-mismatch'), undefined);
        });
    });

    test('Does not flag a Dictionary-family return type when the body returns dict()', () => {
        withTempDir((dir) => {
            const text = 'return dict();';
            const bmlPath = writeBmlWithMeta(dir, 'fn', text, {
                returnType: { value: 15, displayValue: 'String Dictionary' },
                parameters: [],
            });
            const doc = makeDoc(bmlPath, text);
            const diags = checkMetadataTypeConsistency(text, doc, vscode, inferLiteralType);
            assert.strictEqual(diags.find((d) => d.code === 'bml-return-type-mismatch'), undefined);
        });
    });

    test('Flags corrupted metadata where returnType.value does not match its own displayValue', () => {
        withTempDir((dir) => {
            const text = 'return 1;';
            // lookupCode 3 in functionReturnTypes.json is "Integer", not "String".
            const bmlPath = writeBmlWithMeta(dir, 'fn', text, {
                returnType: { value: 3, displayValue: 'String' },
                parameters: [],
            });
            const doc = makeDoc(bmlPath, text);
            const diags = checkMetadataTypeConsistency(text, doc, vscode, inferLiteralType);
            const diag = diags.find((d) => d.code === 'bml-metadata-return-type-inconsistent');
            assert.ok(diag, 'Should flag the inconsistent metadata');
            assert.ok(diag.message.includes('Integer'));
        });
    });

    test('Flags corrupted metadata where a parameter dataType.value does not match its displayValue', () => {
        withTempDir((dir) => {
            const text = 'return "";';
            const bmlPath = writeBmlWithMeta(dir, 'fn', text, {
                parameters: [{ name: 'siteUrl', dataType: { value: 2, displayValue: 'Boolean' } }],
            });
            const doc = makeDoc(bmlPath, text);
            const diags = checkMetadataTypeConsistency(text, doc, vscode, inferLiteralType);
            const diag = diags.find((d) => d.code === 'bml-metadata-param-type-inconsistent');
            assert.ok(diag, 'Should flag the inconsistent parameter metadata');
            assert.ok(diag.message.includes('siteUrl'));
        });
    });

    test('getDeclaredParameterTypes seeds a parameter so a conflicting reassignment in the body is flagged', () => {
        withTempDir((dir) => {
            const text = 'siteUrl = 5;';
            const bmlPath = writeBmlWithMeta(dir, 'fn', text, {
                parameters: [{ name: 'siteUrl', dataType: { value: 2, displayValue: 'String' } }],
            });
            const doc = makeDoc(bmlPath, text);
            const declared = getDeclaredParameterTypes(bmlPath);
            assert.strictEqual(declared.get('siteurl'), 'String');

            const diags = checkAssignmentTypeConsistency(text, doc, vscode, declared);
            const diag = diags.find((d) => d.code === 'bml-type-mismatch');
            assert.ok(diag, 'Reassigning the siteUrl parameter to an Integer should be flagged');
            assert.ok(diag.message.includes('declared as a String parameter'));
        });
    });

    test('Returns no diagnostics when there is no local -meta.json sidecar', () => {
        withTempDir((dir) => {
            const text = 'return 1;';
            const bmlPath = path.join(dir, 'noMeta.bml');
            fs.writeFileSync(bmlPath, text, 'utf8');
            const doc = makeDoc(bmlPath, text);
            assert.deepStrictEqual(checkMetadataTypeConsistency(text, doc, vscode, inferLiteralType), []);
            assert.strictEqual(getDeclaredParameterTypes(bmlPath).size, 0);
        });
    });

    test('readLocalMetadata handles invalid file paths gracefully', () => {
        const { readLocalMetadata } = require('../../app/lang/lint/metadataTypes');
        assert.strictEqual(readLocalMetadata('nonexistent.bml'), null);
        assert.strictEqual(readLocalMetadata(null), null);
    });

    test('normalizeTypeLabel returns non-string inputs unchanged', () => {
        assert.strictEqual(normalizeTypeLabel(null), null);
        assert.strictEqual(normalizeTypeLabel(42), 42);
    });
});
