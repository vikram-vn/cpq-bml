"use strict";
const vscode = require('vscode');
const { buildCommentDecorations } = require('./decorate');
const { DEFAULT_TAGS } = require('./tags');
const { getHoverMarkdown } = require('./hover');

function isCommentsEnabled() {
    return vscode.workspace.getConfiguration('cpqBml').get('features.comments', true);
}

function createDecorationTypes() {
    const tagTypes = new Map();
    for (const tag of DEFAULT_TAGS) {
        tagTypes.set(tag.id, vscode.window.createTextEditorDecorationType({
            color: tag.color,
            fontWeight: tag.bold ? 'bold' : undefined,
            fontStyle: tag.italic ? 'italic' : undefined,
            textDecoration: tag.strikethrough ? 'line-through' : (tag.underline ? 'underline' : undefined),
            light: {
                color: tag.lightColor || tag.color
            }
        }));
    }
    // Directives change tool behavior - styled with light gray instead of bright purple.
    const directiveType = vscode.window.createTextEditorDecorationType({
        color: '#AAAAAA',
        fontWeight: 'normal',
        backgroundColor: 'rgba(170, 170, 170, 0.12)',
        light: {
            color: '#666666',
            backgroundColor: 'rgba(102, 102, 102, 0.08)'
        }
    });
    const docHeaderType = vscode.window.createTextEditorDecorationType({
        fontStyle: 'italic',
        backgroundColor: 'rgba(100, 149, 237, 0.08)',
        light: {
            backgroundColor: 'rgba(70, 130, 180, 0.06)'
        }
    });
    return { tagTypes, directiveType, docHeaderType };
}

function toVscodeRanges(document, offsetRanges) {
    return offsetRanges.map(([start, end]) => new vscode.Range(document.positionAt(start), document.positionAt(end)));
}

function applyDecorations(editor, decorationTypes) {
    if (!editor || editor.document.languageId !== 'bml') return;
    const document = editor.document;
    const { tags, directives, docHeaders } = buildCommentDecorations(document.getText());

    for (const [tagId, type] of decorationTypes.tagTypes) {
        editor.setDecorations(type, toVscodeRanges(document, tags.get(tagId) || []));
    }
    editor.setDecorations(decorationTypes.directiveType, toVscodeRanges(document, directives));
    editor.setDecorations(decorationTypes.docHeaderType, toVscodeRanges(document, docHeaders));
}

function clearDecorations(editor, decorationTypes) {
    if (!editor) return;
    for (const type of decorationTypes.tagTypes.values()) editor.setDecorations(type, []);
    editor.setDecorations(decorationTypes.directiveType, []);
    editor.setDecorations(decorationTypes.docHeaderType, []);
}

function registerBmlComments(context) {
    const decorationTypes = createDecorationTypes();
    for (const type of decorationTypes.tagTypes.values()) context.subscriptions.push(type);
    context.subscriptions.push(decorationTypes.directiveType, decorationTypes.docHeaderType);

    const decorateDelay = 300;
    const decorateTimers = new Map();

    const triggerDecorate = (editor) => {
        if (!editor) return;
        const uri = editor.document.uri.toString();
        if (decorateTimers.has(uri)) {
            clearTimeout(decorateTimers.get(uri));
        }
        decorateTimers.set(uri, setTimeout(() => {
            decorateTimers.delete(uri);
            if (!isCommentsEnabled()) {
                clearDecorations(editor, decorationTypes);
                return;
            }
            applyDecorations(editor, decorationTypes);
        }, decorateDelay));
    };

    context.subscriptions.push({
        dispose: () => {
            for (const timer of decorateTimers.values()) {
                clearTimeout(timer);
            }
            decorateTimers.clear();
        }
    });

    vscode.window.onDidChangeActiveTextEditor(triggerDecorate, null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument((e) => {
        vscode.window.visibleTextEditors.forEach((editor) => {
            if (editor.document === e.document) triggerDecorate(editor);
        });
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('cpqBml.features.comments')) return;
        if (!isCommentsEnabled()) {
            vscode.window.visibleTextEditors.forEach((editor) => clearDecorations(editor, decorationTypes));
            return;
        }
        vscode.window.visibleTextEditors.forEach(triggerDecorate);
    }, null, context.subscriptions);

    const hoverProvider = vscode.languages.registerHoverProvider('bml', {
        provideHover(document, position) {
            if (!isCommentsEnabled()) return null;
            const markdown = getHoverMarkdown(document.getText(), document.offsetAt(position));
            return markdown ? new vscode.Hover(new vscode.MarkdownString(markdown)) : null;
        }
    });
    context.subscriptions.push(hoverProvider);

    if (vscode.window.activeTextEditor) triggerDecorate(vscode.window.activeTextEditor);
}

module.exports = { registerBmlComments };
