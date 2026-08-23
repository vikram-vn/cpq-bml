const vscode = require('vscode');

const XSLT_ELEMENTS = [
    { label: 'xsl:stylesheet', snippet: 'xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n\t$0\n</xsl:stylesheet>', doc: 'Root element of an XSLT stylesheet' },
    { label: 'xsl:template', snippet: 'xsl:template match="${1:node}">\n\t$0\n</xsl:template>', doc: 'Defines a template rule' },
    { label: 'xsl:template (named)', snippet: 'xsl:template name="${1:templateName}">\n\t$0\n</xsl:template>', doc: 'Defines a named template' },
    { label: 'xsl:value-of', snippet: 'xsl:value-of select="${1:path}"/>', doc: 'Outputs the string value of a node or expression' },
    { label: 'xsl:for-each', snippet: 'xsl:for-each select="${1:nodes}">\n\t$0\n</xsl:for-each>', doc: 'Iterates over a node-set' },
    { label: 'xsl:if', snippet: 'xsl:if test="${1:condition}">\n\t$0\n</xsl:if>', doc: 'Conditional template execution' },
    { label: 'xsl:choose', snippet: 'xsl:choose>\n\t<xsl:when test="${1:condition}">\n\t\t$2\n\t</xsl:when>\n\t<xsl:otherwise>\n\t\t$0\n\t</xsl:otherwise>\n</xsl:choose>', doc: 'Multi-branch conditional block' },
    { label: 'xsl:when', snippet: 'xsl:when test="${1:condition}">\n\t$0\n</xsl:when>', doc: 'Branch inside xsl:choose' },
    { label: 'xsl:otherwise', snippet: 'xsl:otherwise>\n\t$0\n</xsl:otherwise>', doc: 'Fallback branch inside xsl:choose' },
    { label: 'xsl:call-template', snippet: 'xsl:call-template name="${1:templateName}">\n\t<xsl:with-param name="${2:paramName}" select="${3:value}"/>\n</xsl:call-template>', doc: 'Invokes a named template' },
    { label: 'xsl:variable', snippet: 'xsl:variable name="${1:varName}" select="${2:expression}"/>', doc: 'Binds a local or global variable' },
    { label: 'xsl:param', snippet: 'xsl:param name="${1:paramName}" select="${2:defaultValue}"/>', doc: 'Declares a template parameter' },
    { label: 'xsl:with-param', snippet: 'xsl:with-param name="${1:paramName}" select="${2:value}"/>', doc: 'Passes a parameter to a template' },
    { label: 'xsl:attribute', snippet: 'xsl:attribute name="${1:attrName}">${2:value}</xsl:attribute>', doc: 'Creates an output attribute' },
    { label: 'xsl:element', snippet: 'xsl:element name="${1:elemName}">\n\t$0\n</xsl:element>', doc: 'Creates a dynamic output element' },
    { label: 'xsl:apply-templates', snippet: 'xsl:apply-templates select="${1:path}"/>', doc: 'Applies templates to matching child nodes' },
    { label: 'xsl:copy-of', snippet: 'xsl:copy-of select="${1:path}"/>', doc: 'Copies node-set into result tree' },
    { label: 'xsl:output', snippet: 'xsl:output method="${1|xml,html,text|}" indent="${2|yes,no|}"/>', doc: 'Specifies transformation output format' }
];

function registerXsltCompletions(context) {
    const provider = {
        provideCompletionItems(document, position) {
            const lineTillCursor = document.getText(new vscode.Range(position.line, 0, position.line, position.character));
            const fullText = document.getText();

            // 1. Template name completion for xsl:call-template name="..."
            if (lineTillCursor.includes('call-template') && lineTillCursor.includes('name=')) {
                const items = [];
                const templateNameRegex = /<xsl:template\b[^>]*\bname=["']([^"']+)["']/gi;
                let match;
                while ((match = templateNameRegex.exec(fullText)) !== null) {
                    const templateName = match[1];
                    const item = new vscode.CompletionItem(templateName, vscode.CompletionItemKind.Function);
                    item.detail = 'XSLT Named Template';
                    item.documentation = new vscode.MarkdownString(`Call named template \`<xsl:template name="${templateName}">\``);
                    items.push(item);
                }
                return items;
            }

            // 2. Element completions
            const completionItems = XSLT_ELEMENTS.map(elem => {
                const item = new vscode.CompletionItem(elem.label, vscode.CompletionItemKind.Snippet);
                item.insertText = new vscode.SnippetString(elem.snippet);
                item.detail = 'XSLT Element';
                item.documentation = new vscode.MarkdownString(elem.doc);
                return item;
            });

            return completionItems;
        }
    };

    const selector = [
        { language: 'xsl', scheme: 'file' },
        { language: 'xslt', scheme: 'file' },
        { language: 'xml', scheme: 'file' }
    ];

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(selector, provider, '<', ' ', '"', "'")
    );
}

module.exports = { registerXsltCompletions };
