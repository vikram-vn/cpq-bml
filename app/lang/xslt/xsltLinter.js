const vscode = require('vscode');

/**
 * Perform static analysis on XSLT documents (.xsl, .xslt).
 */
function lintXslt(document) {
    const diagnostics = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // 1. Check root element for version and namespace
    const stylesheetMatch = text.match(/<xsl:(?:stylesheet|transform)\b([^>]*)>/i);
    if (stylesheetMatch) {
        const attrs = stylesheetMatch[1];
        const rootOffset = stylesheetMatch.index;
        const rootPos = document.positionAt(rootOffset);
        const rootEndPos = document.positionAt(rootOffset + stylesheetMatch[0].length);
        const range = new vscode.Range(rootPos, rootEndPos);

        if (!/\bversion=["'][^"']+["']/i.test(attrs)) {
            const diag = new vscode.Diagnostic(
                range,
                "XSLT Error: <xsl:stylesheet> is missing required 'version' attribute (e.g. version=\"1.0\").",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'xslt-missing-version';
            diagnostics.push(diag);
        }

        if (!/xmlns:xsl=["']http:\/\/www\.w3\.org\/1999\/XSL\/Transform["']/i.test(attrs)) {
            const diag = new vscode.Diagnostic(
                range,
                "XSLT Warning: Missing or invalid XSLT namespace declaration. Expected: xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\".",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'xslt-invalid-namespace';
            diagnostics.push(diag);
        }
    }

    // 2. Track defined template names and called template names
    const definedTemplates = new Map(); // name -> Range
    const calledTemplates = []; // { name, range }

    // Regex for templates
    const templateRegex = /<xsl:template\b([^>]*)>/gi;
    let match;
    while ((match = templateRegex.exec(text)) !== null) {
        const attrs = match[1];
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const hasMatch = /\bmatch=["'][^"']*["']/i.test(attrs);
        const nameMatch = /\bname=["']([^"']+)["']/i.exec(attrs);

        if (!hasMatch && !nameMatch) {
            const diag = new vscode.Diagnostic(
                range,
                "XSLT Error: <xsl:template> must specify either a 'match' or 'name' attribute.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'xslt-missing-match-or-name';
            diagnostics.push(diag);
        }

        if (nameMatch) {
            definedTemplates.set(nameMatch[1], range);
        }
    }

    // Regex for call-template
    const callRegex = /<xsl:call-template\b([^>]*)>/gi;
    while ((match = callRegex.exec(text)) !== null) {
        const attrs = match[1];
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const nameMatch = /\bname=["']([^"']+)["']/i.exec(attrs);
        if (!nameMatch) {
            const diag = new vscode.Diagnostic(
                range,
                "XSLT Error: <xsl:call-template> requires a 'name' attribute.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'xslt-missing-call-name';
            diagnostics.push(diag);
        } else {
            calledTemplates.push({ name: nameMatch[1], range });
        }
    }

    // Verify called templates exist
    for (const called of calledTemplates) {
        if (!definedTemplates.has(called.name)) {
            const diag = new vscode.Diagnostic(
                called.range,
                `XSLT Error: Target template '${called.name}' is not defined in this stylesheet.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'xslt-undefined-called-template';
            diagnostics.push(diag);
        }
    }

    // Warn on unused named templates
    const calledSet = new Set(calledTemplates.map(c => c.name));
    for (const [name, range] of definedTemplates.entries()) {
        if (!calledSet.has(name)) {
            const diag = new vscode.Diagnostic(
                range,
                `XSLT Hint: Named template '${name}' is never called with <xsl:call-template>.`,
                vscode.DiagnosticSeverity.Information
            );
            diag.code = 'xslt-unused-template';
            diagnostics.push(diag);
        }
    }

    // 3. Check for empty select attributes in value-of / for-each / variable
    const selectElemRegex = /<xsl:(value-of|for-each|apply-templates|variable)\b([^>]*)>/gi;
    while ((match = selectElemRegex.exec(text)) !== null) {
        const tag = match[1];
        const attrs = match[2];
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const selectMatch = /\bselect=["']([^"']*)["']/i.exec(attrs);
        if (!selectMatch && tag !== 'variable') {
            const diag = new vscode.Diagnostic(
                range,
                `XSLT Error: <xsl:${tag}> requires a 'select' attribute.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'xslt-empty-select';
            diagnostics.push(diag);
        } else if (selectMatch && selectMatch[1].trim() === '') {
            const diag = new vscode.Diagnostic(
                range,
                `XSLT Error: <xsl:${tag}> 'select' attribute cannot be empty.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'xslt-empty-select';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { lintXslt };
