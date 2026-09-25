'use strict';

let _context = null;
let _vscode = null;

function isVscodeObject(val) {
    if (!val || typeof val !== 'object') return false;
    return Boolean(val.workspace || val.window || val.commands || val.languages || val.env);
}

function isContextObject(val) {
    if (!val || typeof val !== 'object') return false;
    return Boolean(
        val.subscriptions ||
        val.globalState ||
        val.workspaceState ||
        val.secrets ||
        val.extensionPath ||
        val.extensionUri ||
        val.storageUri ||
        val.globalStorageUri
    );
}

function isContextOrVscode(val) {
    return isContextObject(val) || isVscodeObject(val);
}

function setExtensionContext(context, vscode) {
    if (isContextObject(context)) _context = context;
    else if (isVscodeObject(context)) _vscode = context;

    if (isVscodeObject(vscode)) _vscode = vscode;
    else if (isContextObject(vscode)) _context = vscode;
}

function getExtensionContext() {
    let effectiveVscode = _vscode;
    if (!effectiveVscode) {
        try {
            effectiveVscode = require('vscode');
        } catch (_) {
            effectiveVscode = null;
        }
    }
    return {
        context: _context,
        vscode: effectiveVscode,
    };
}

function getContext() {
    return _context;
}

function getVscode() {
    return getExtensionContext().vscode;
}

function normalizeCommandArgs(args) {
    if (!args || args.length === 0) return [];
    if (args.length >= 2 && isContextOrVscode(args[0]) && isContextOrVscode(args[1])) {
        setExtensionContext(args[0], args[1]);
        return Array.prototype.slice.call(args, 2);
    }
    if (args.length >= 1 && isContextOrVscode(args[0])) {
        if (isContextObject(args[0])) {
            setExtensionContext(args[0], null);
        } else {
            setExtensionContext(null, args[0]);
        }
        return Array.prototype.slice.call(args, 1);
    }
    return Array.prototype.slice.call(args);
}

function isBmlActive(vsc) {
    const effectiveVscode = vsc || getVscode();
    if (!effectiveVscode || !effectiveVscode.window) return false;
    const editor = effectiveVscode.window.activeTextEditor;
    if (!editor || !editor.document) return false;
    const doc = editor.document;
    if (doc.languageId === 'bml' || doc.languageId === 'bmlt') return true;
    const path = (doc.fileName || (doc.uri && doc.uri.fsPath) || '').toLowerCase();
    return path.endsWith('.bml') || path.endsWith('.bmlt') || path.endsWith('.bmltest.json');
}

module.exports = {
    setExtensionContext,
    getExtensionContext,
    getContext,
    getVscode,
    isContextOrVscode,
    isContextObject,
    isVscodeObject,
    isBmlActive,
    normalizeCommandArgs,
    setGlobalContext: setExtensionContext,
    getGlobalContext: getExtensionContext,
};
