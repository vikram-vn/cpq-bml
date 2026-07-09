const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Auto Doc-Header Insertion
 *
 * Triggered when the user types `///` at the beginning of a line in a .bml file.
 * Inserts a fully-formed BML docHeader block comment, pre-populated from the
 * file's -meta.json sidecar when available.
 *
 * Template:
 *   /*
 *    * Function Name: <name>
 *    * Description: 
 *    * Inputs: <param1> (<type>), ...
 *    * Returns: <returnType>
 *    *\/
 */
function registerDocHeaderCompletion(context) {
    const provider = vscode.languages.registerCompletionItemProvider(
        'bml',
        {
            provideCompletionItems(document, position) {
                if (!vscode.workspace.getConfiguration('cpqBml').get('features.docHeader', true)) {
                    return undefined;
                }
                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                if (!linePrefix.trimStart().startsWith('///')) return undefined;

                // Build the doc header from sidecar metadata if available
                const bmlPath = document.fileName;
                const baseName = path.basename(bmlPath, '.bml').replace(/-AI$/i, '').replace(/_ai$/i, '');
                const metaPath = path.join(path.dirname(bmlPath), baseName + '-meta.json');

                let funcName = baseName;
                let params = [];
                let returnType = 'String';

                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    funcName = meta.name || meta.displayName || baseName;
                    params = (meta.params || meta.parameters || []).map(p => ({
                        name: p.name || p.variableName || 'param',
                        dataType: p.dataType || p.type || 'String',
                    }));
                    returnType = meta.returnType || meta.returnDataType || 'String';
                } catch { /* no sidecar — use defaults */ }

                const inputsLine = params.length > 0
                    ? params.map(p => `${p.name} (${p.dataType})`).join(', ')
                    : 'None';

                const header = [
                    '/*',
                    ` * Function Name: ${funcName}`,
                    ' * Description: ',
                    ` * Inputs: ${inputsLine}`,
                    ` * Returns: ${returnType}`,
                    ' */',
                ].join('\n');

                const item = new vscode.CompletionItem('/// BML Doc Header', vscode.CompletionItemKind.Snippet);
                item.detail = 'Insert BML function documentation header';
                item.documentation = new vscode.MarkdownString('Inserts a `/* Function Name / Description / Inputs / Returns */` doc block pre-filled from the function\'s metadata sidecar.');
                item.insertText = new vscode.SnippetString(
                    header.replace('Description: ', 'Description: ${1:}')
                );
                // Replace the `///` the user typed
                item.additionalTextEdits = [
                    vscode.TextEdit.delete(new vscode.Range(
                        position.line, linePrefix.indexOf('///'),
                        position.line, position.character
                    ))
                ];
                item.sortText = '0'; // appear first

                return [item];
            }
        },
        '/' // trigger on third slash
    );

    context.subscriptions.push(provider);
}

module.exports = { registerDocHeaderCompletion };
