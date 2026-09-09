const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const BML_DATA_TYPES = [
    'String', 'Integer', 'Float', 'Boolean', 'Date',
    'Dict', 'JsonArray', 'JsonObject', 'StringBuilder'
];

async function scaffoldLibraryFunction(targetUri) {
    let targetDir = '';
    if (targetUri && targetUri.fsPath) {
        const stat = fs.statSync(targetUri.fsPath);
        targetDir = stat.isDirectory() ? targetUri.fsPath : path.dirname(targetUri.fsPath);
    } else {
        const ws = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        if (!ws) {
            vscode.window.showErrorMessage('Please open a workspace folder before scaffolding BML functions.');
            return;
        }
        targetDir = path.join(ws.uri.fsPath, 'util');
    }

    const fnName = await vscode.window.showInputBox({
        prompt: 'Enter the function name (e.g. calculateDiscount)',
        validateInput: (val) => (!val || !/^[a-zA-Z_]\w*$/.test(val)) ? 'Must be a valid identifier (letters, numbers, underscore)' : null
    });
    if (!fnName) return;

    const description = await vscode.window.showInputBox({
        prompt: 'Enter function description',
        value: `Utility function for ${fnName}`
    }) || '';

    const returnType = await vscode.window.showQuickPick(BML_DATA_TYPES, {
        placeHolder: 'Select return data type'
    }) || 'String';

    const paramsInput = await vscode.window.showInputBox({
        prompt: 'Enter parameters as name:Type pairs separated by commas (optional)',
        placeHolder: 'e.g. totalAmount:Float, customerId:String'
    });

    const parameters = [];
    if (paramsInput && paramsInput.trim()) {
        const pairs = paramsInput.split(',');
        for (const pair of pairs) {
            const parts = pair.trim().split(':');
            const pName = parts[0] ? parts[0].trim() : '';
            const pType = parts[1] ? parts[1].trim() : 'String';
            if (pName) {
                parameters.push({ name: pName, dataType: pType });
            }
        }
    }

    const fnDir = path.join(targetDir, fnName);
    if (!fs.existsSync(fnDir)) {
        try { fs.mkdirSync(fnDir, { recursive: true }); } catch {}
    }

    const bmlPath = path.join(fnDir, `${fnName}.bml`);
    const metaPath = path.join(fnDir, `${fnName}-meta.json`);

    // Format docHeader
    const paramDocs = parameters.length > 0
        ? parameters.map(p => `//   - ${p.name} (${p.dataType})`).join('\n')
        : '//   (None)';

    let initialValue = '""';
    if (returnType === 'Integer') initialValue = '0';
    else if (returnType === 'Float') initialValue = '0.0';
    else if (returnType === 'Boolean') initialValue = 'true';
    else if (returnType === 'Dict') initialValue = 'dict("string")';
    else if (returnType === 'JsonObject') initialValue = 'json()';
    else if (returnType === 'JsonArray') initialValue = 'jsonarray()';
    else if (returnType === 'StringBuilder') initialValue = 'stringbuilder()';

    const bmlContent = `// ==============================================================================
// Function:    ${fnName}
// Description: ${description}
// Parameters:
${paramDocs}
// Return Type: ${returnType}
// ==============================================================================

// Implementation:
result = ${initialValue};

return result;
`;

    const metaContent = JSON.stringify({
        name: fnName,
        variableName: fnName,
        description,
        returnType,
        parameters
    }, null, 2);

    fs.writeFileSync(bmlPath, bmlContent, 'utf8');
    fs.writeFileSync(metaPath, metaContent, 'utf8');

    const doc = await vscode.workspace.openTextDocument(bmlPath);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(`Scaffolded BML library function "${fnName}" with meta sidecar.`);
}

async function scaffoldBmqlQuery() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Open a BML file to insert a BMQL query scaffold.');
        return;
    }

    const tableName = await vscode.window.showInputBox({
        prompt: 'Enter CPQ Data Table name to query (e.g. Pricing_Rules)',
        validateInput: (v) => !v ? 'Data table name required' : null
    });
    if (!tableName) return;

    const columns = await vscode.window.showInputBox({
        prompt: 'Enter column names separated by commas (e.g. part_number, unit_price, tier)',
        value: 'part_number, unit_price'
    }) || 'part_number';

    const paramName = await vscode.window.showInputBox({
        prompt: 'Enter where clause parameter variable name (e.g. selectedTier)',
        value: 'filterValue'
    }) || 'filterValue';

    const colList = columns.split(',').map(c => c.trim()).filter(Boolean);
    const firstCol = colList[0] || 'part_number';

    const snippet = `// Query Data Table: ${tableName}
records = bmql("SELECT ${colList.join(', ')} FROM ${tableName} WHERE ${firstCol} = $${paramName}");
for record in records {
    val = get(record, "${firstCol}");
    // Process record...
}
`;

    editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, snippet);
    });
}

function registerScaffolder(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('cpqBml.scaffoldLibraryFunction', scaffoldLibraryFunction),
        vscode.commands.registerCommand('cpqBml.scaffoldBmqlQuery', scaffoldBmqlQuery)
    );
}

module.exports = { registerScaffolder, scaffoldLibraryFunction, scaffoldBmqlQuery };
