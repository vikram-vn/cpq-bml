const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { resolveCallAtPosition, getWorkspaceIndex } = require('@/lang/intellisense/workspaceIndex');

function getFunctionFromDocOrPosition(document, position) {
    // 1. Try call at position (e.g., util.myFunc)
    const call = resolveCallAtPosition(document, position);
    if (call) {
        const lineText = document.lineAt(position.line).text;
        const col = lineText.toLowerCase().indexOf(call.name.toLowerCase());
        const range = new vscode.Range(position.line, Math.max(0, col), position.line, Math.max(0, col + call.name.length));
        return {
            name: call.name,
            qualifiedName: call.qualifiedName,
            uri: document.uri,
            range,
        };
    }

    // 2. Try inferring from file path and workspace index
    const fsPath = document.uri.fsPath;
    const baseName = path.basename(fsPath, path.extname(fsPath));
    const normalized = fsPath.replace(/\\/g, '/');
    const prefix = /[\/\\]commerce[\/\\]/i.test(normalized) ? 'commerce' : 'util';
    const qualified = `${prefix}.${baseName}`.toLowerCase();

    const entry = getWorkspaceIndex().get(qualified);
    const line = entry ? entry.line : 0;
    const range = new vscode.Range(line, 0, line, baseName.length);

    return {
        name: baseName,
        qualifiedName: qualified,
        uri: document.uri,
        range,
    };
}

function createCallHierarchyProvider() {
    return {
        prepareCallHierarchy(document, position, token) {
            if (token && token.isCancellationRequested) return null;
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return null;
            }

            const target = getFunctionFromDocOrPosition(document, position);
            if (!target) return null;

            return new vscode.CallHierarchyItem(
                vscode.SymbolKind.Function,
                target.name,
                target.qualifiedName,
                target.uri,
                target.range,
                target.range
            );
        },

        async provideCallHierarchyIncomingCalls(item, token) {
            if (token && token.isCancellationRequested) return [];
            const results = [];
            const targetQualified = (item.detail || item.name).toLowerCase();
            const pattern = new RegExp(`\\b${targetQualified.replace('.', '\\.')}\\b`, 'i');

            const uris = await vscode.workspace.findFiles('**/*.bml', '**/node_modules/**');
            for (const uri of uris) {
                if (token && token.isCancellationRequested) return [];
                let content = '';
                try {
                    content = fs.readFileSync(uri.fsPath, 'utf8');
                } catch {
                    continue;
                }

                if (!pattern.test(content)) continue;

                const lines = content.split(/\r?\n/);
                const fromRanges = [];
                for (let i = 0; i < lines.length; i++) {
                    let m;
                    const linePattern = new RegExp(`\\b${targetQualified.replace('.', '\\.')}\\b`, 'gi');
                    while ((m = linePattern.exec(lines[i])) !== null) {
                        fromRanges.push(new vscode.Range(i, m.index, i, m.index + m[0].length));
                    }
                }

                if (fromRanges.length > 0) {
                    const callerBase = path.basename(uri.fsPath, '.bml');
                    const callerItem = new vscode.CallHierarchyItem(
                        vscode.SymbolKind.Function,
                        callerBase,
                        uri.fsPath,
                        uri,
                        fromRanges[0],
                        fromRanges[0]
                    );
                    results.push(new vscode.CallHierarchyIncomingCall(callerItem, fromRanges));
                }
            }

            return results;
        },

        async provideCallHierarchyOutgoingCalls(item, token) {
            if (token && token.isCancellationRequested) return [];
            const results = [];
            let content = '';
            try {
                content = fs.readFileSync(item.uri.fsPath, 'utf8');
            } catch {
                return [];
            }

            const callRegex = /\b(util|commerce)\.([a-zA-Z_]\w*)\b/g;
            const lines = content.split(/\r?\n/);
            const index = getWorkspaceIndex();

            for (let i = 0; i < lines.length; i++) {
                let m;
                while ((m = callRegex.exec(lines[i])) !== null) {
                    const prefix = m[1];
                    const fnName = m[2];
                    const qualified = `${prefix}.${fnName}`.toLowerCase();
                    const fromRange = new vscode.Range(i, m.index, i, m.index + m[0].length);

                    const entry = index.get(qualified);
                    const targetUri = entry ? vscode.Uri.file(entry.filePath) : item.uri;
                    const targetRange = entry ? new vscode.Range(entry.line, 0, entry.line, fnName.length) : fromRange;

                    const toItem = new vscode.CallHierarchyItem(
                        vscode.SymbolKind.Function,
                        fnName,
                        `${prefix}.${fnName}`,
                        targetUri,
                        targetRange,
                        targetRange
                    );

                    results.push(new vscode.CallHierarchyOutgoingCall(toItem, [fromRange]));
                }
            }

            return results;
        }
    };
}

module.exports = { createCallHierarchyProvider };
