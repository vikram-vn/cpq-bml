const vscode = require('vscode');
const { registerSpellingCommands, getSpellingFixes } = require('./spellingFixes');
const { getSyntaxFixes } = require('./syntaxFixes');
const { getQualityFixes } = require('./qualityFixes');
const { getStyleFixes } = require('./styleFixes');
const { getSuppressionFixes } = require('./suppressionFixes');
const { getPerformanceFixes } = require('./performanceFixes');
const { getBmqlFixes } = require('./bmqlFixes');
const { getApiFixes } = require('./apiFixes');
const { getUnreachableFixes } = require('./unreachableFixes');
const { getSecurityFixes } = require('./securityFixes');

function registerBmlCodeActions(context) {
    const extensionPath = context.extensionPath;

    // Register commands for spelling
    registerSpellingCommands(context);

    // Register main CodeActionsProvider for BML
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('bml', {
            provideCodeActions(document, range, context) {
                const fixes = [];
                context.diagnostics.forEach(diag => {
                    const editRange = diag.originalRange ?? diag.range;

                    fixes.push(
                        ...getSuppressionFixes(document, diag, editRange),
                        ...getSyntaxFixes(document, diag, editRange),
                        ...getQualityFixes(document, diag, editRange, extensionPath),
                        ...getStyleFixes(document, diag, editRange),
                        ...getPerformanceFixes(document, diag, editRange),
                        ...getBmqlFixes(document, diag, editRange),
                        ...getApiFixes(document, diag, editRange),
                        ...getUnreachableFixes(document, diag, editRange),
                        ...getSecurityFixes(document, diag, editRange),
                        ...getSpellingFixes(document, diag, editRange, extensionPath)
                    );
                });
                return fixes;
            }
        })
    );
}

module.exports = { registerBmlCodeActions };
