const assert = require('assert');
const vscode = require('vscode');
const { lintXslt } = require('../../app/lang/xslt/xsltLinter');

suite('XSLT Linter & Diagnostics Test Suite', () => {
    const createMockDocument = (content) => ({
        getText() {
            return content;
        },
        positionAt(offset) {
            const prefix = content.substring(0, offset);
            const lines = prefix.split('\n');
            const line = lines.length - 1;
            const character = lines[lines.length - 1].length;
            return new vscode.Position(line, character);
        },
        uri: vscode.Uri.file('/mock/test.xsl')
    });

    test('Flags missing version attribute on xsl:stylesheet', () => {
        const text = '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n</xsl:stylesheet>';
        const doc = createMockDocument(text);
        const diags = lintXslt(doc);

        assert.ok(diags.some(d => d.code === 'xslt-missing-version'), 'Should report missing version attribute');
    });

    test('Flags missing or invalid XSLT namespace', () => {
        const text = '<xsl:stylesheet version="1.0" xmlns:xsl="http://invalid.namespace">\n</xsl:stylesheet>';
        const doc = createMockDocument(text);
        const diags = lintXslt(doc);

        assert.ok(diags.some(d => d.code === 'xslt-invalid-namespace'), 'Should report invalid XSLT namespace');
    });

    test('Flags xsl:template without match or name', () => {
        const text = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n<xsl:template>\n</xsl:template>\n</xsl:stylesheet>';
        const doc = createMockDocument(text);
        const diags = lintXslt(doc);

        assert.ok(diags.some(d => d.code === 'xslt-missing-match-or-name'), 'Should report missing match/name attribute');
    });

    test('Flags undefined call-template name', () => {
        const text = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n<xsl:call-template name="nonExistent"/>\n</xsl:stylesheet>';
        const doc = createMockDocument(text);
        const diags = lintXslt(doc);

        assert.ok(diags.some(d => d.code === 'xslt-undefined-called-template'), 'Should report undefined target template');
    });

    test('Flags empty select attribute on xsl:value-of', () => {
        const text = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n<xsl:value-of select=""/>\n</xsl:stylesheet>';
        const doc = createMockDocument(text);
        const diags = lintXslt(doc);

        assert.ok(diags.some(d => d.code === 'xslt-empty-select'), 'Should report empty select attribute');
    });
});
