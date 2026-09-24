'use strict';

let _context = null;
let _vscode = null;

function isContextOrVscode(val) {
    if (!val || typeof val !== 'object') return false;
    return Boolean(
        val.subscriptions ||
        val.globalState ||
        val.workspaceState ||
        val.secrets ||
        val.extensionPath ||
        val.extensionUri ||
        val.window ||
        val.workspace ||
        val.commands ||
        val.languages
    );
}

function setExtensionContext(context, vscode) {
    if (context) _context = context;
    if (vscode) _vscode = vscode;
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
    if (args && args.length >= 2 && (isContextOrVscode(args[0]) || isContextOrVscode(args[1]))) {
        setExtensionContext(args[0], args[1]);
        return Array.prototype.slice.call(args, 2);
    }
    if (args && args.length >= 1 && isContextOrVscode(args[0])) {
        if (args[0].subscriptions || args[0].globalState || args[0].secrets) {
            setExtensionContext(args[0], null);
        } else {
            setExtensionContext(null, args[0]);
        }
        return Array.prototype.slice.call(args, 1);
    }
    return Array.prototype.slice.call(args || []);
}

module.exports = {
    setExtensionContext,
    getExtensionContext,
    getContext,
    getVscode,
    isContextOrVscode,
    normalizeCommandArgs,
    setGlobalContext: setExtensionContext,
    getGlobalContext: getExtensionContext,
};
