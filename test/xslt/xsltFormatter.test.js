const assert = require('assert');
const { formatXml } = require('../../app/lang/xslt/formatter');

suite('XML/XSLT Formatter Test Suite (inuris algorithm)', () => {
    test('Formats nested XML elements with indent', () => {
        const unformatted = '<root><child><item>val</item></child></root>';
        const result = formatXml(unformatted, '  ');
        assert.ok(result.includes('<root>'));
        assert.ok(result.includes('  <child>'));
        assert.ok(result.includes('<item>val</item>'));
    });

    test('Handles XSLT attributes containing > operator without breaking formatting', () => {
        const xslt = '<xsl:stylesheet><xsl:if test="count(node) > 0"><xsl:value-of select="node"/></xsl:if></xsl:stylesheet>';
        const result = formatXml(xslt, '  ');
        assert.ok(result.includes('<xsl:if test="count(node) > 0">'));
        assert.ok(result.includes('<xsl:value-of select="node"/>'));
    });

    test('Handles CDATA sections and comments', () => {
        const xml = '<root><!-- comment --><![CDATA[<data>]]></root>';
        const result = formatXml(xml, '  ');
        assert.ok(result.includes('<!-- comment -->'));
        assert.ok(result.includes('<![CDATA[<data>]]>'));
    });

    test('Formats paragraph containing inline tags', () => {
        const xml = '<p><b>bold</b> <i>italic</i></p>';
        const result = formatXml(xml, '  ');
        assert.ok(result.includes('<b>bold</b>'));
        assert.ok(result.includes('<i>italic</i>'));
    });
});
