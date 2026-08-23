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
const { getFixAllSafeAction } = require('./fixAllSafe');

function registerBmlCodeActions(context) {
    const extensionPath = context.extensionPath;

    // Register commands for spelling
    registerSpellingCommands(context);

    // Register main CodeActionsProvider for BML
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('bml', {
            provideCodeActions(document, range, context) {
                const constructiveFixes = [];
                const suppressionFixes = [];

                context.diagnostics.forEach(diag => {
                    const editRange = diag.originalRange ?? diag.range;

                    constructiveFixes.push(
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

                    suppressionFixes.push(
                        ...getSuppressionFixes(document, diag, editRange)
                    );
                });

                const docDiags = (vscode.languages && vscode.languages.getDiagnostics)
                    ? (vscode.languages.getDiagnostics(document.uri) || context.diagnostics)
                    : context.diagnostics;

                const fixAllActions = getFixAllSafeAction(document, docDiags && docDiags.length > 0 ? docDiags : context.diagnostics);

                // Priority Order:
                // 1. Constructive Quick Fixes (camelCase, type suffixes, code quality fixes)
                // 2. File-level & Category-level Safe Refactors
                // 3. Fallback Suppressions (Disable for line/file)
                return [
                    ...constructiveFixes,
                    ...(fixAllActions || []),
                    ...suppressionFixes
                ];
            }
        }, {
            providedCodeActionKinds: [
                vscode.CodeActionKind.QuickFix,
                vscode.CodeActionKind.Refactor,
                vscode.CodeActionKind.RefactorRewrite,
                vscode.CodeActionKind.RefactorExtract,
                vscode.CodeActionKind.SourceFixAll
            ]
        })
    );
}

module.exports = { registerBmlCodeActions };
