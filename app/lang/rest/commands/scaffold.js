const path = require('path');
const fs = require('fs');
const metadataLib = require('../metadata');
const shared = require('./shared');
const { getCommerceProcess, getCommerceDocument, getSettings } = require('../config');

const returnTypeMap = {
    'String': 1,
    'Float': 2,
    'Integer': 3,
    'Boolean': 4,
    'Date': 5,
    'Json': 36,
    'JsonArray': 37,
    'String[]': 10,
    'Float[]': 9,
    'Integer[]': 8,
    'Boolean[]': 34,
    'Date[]': 26
};

async function runCreateBmlFunction(context, vscode, { transport } = {}) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('CPQ-BML: open a workspace folder before creating a BML function.');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // 1. Choose function type
    const typeSelection = await vscode.window.showQuickPick([
        { label: 'Utility Library Function', id: 'util', description: 'Create a reusable BML function in the utility library' },
        { label: 'Commerce Library Function', id: 'commerce', description: 'Create a function under a specific commerce process and document' }
    ], { placeHolder: 'Select library function type' });
    if (!typeSelection) return;

    // 2. Variable name
    const varName = await vscode.window.showInputBox({
        prompt: 'Enter function variable name (e.g. calculateDiscount)',
        placeHolder: 'calculateDiscount',
        ignoreFocusOut: true,
        validateInput: (val) => {
            if (!val || !val.trim()) return 'Variable name is required';
            if (!/^[a-zA-Z_]\w*$/.test(val.trim())) {
                return 'Variable name must start with a letter/underscore and contain only letters, numbers, and underscores';
            }
            return null;
        }
    });
    if (!varName) return;
    const variableName = varName.trim();

    // 3. Display name
    const suggestName = shared.toDisplayName(variableName);

    const dispName = await vscode.window.showInputBox({
        prompt: 'Enter display name for the function',
        value: suggestName,
        ignoreFocusOut: true,
        validateInput: (val) => val && val.trim() ? null : 'Display name is required'
    });
    if (!dispName) return;
    const displayName = dispName.trim();

    // 4. Description
    const description = await vscode.window.showInputBox({
        prompt: 'Enter description (optional)',
        placeHolder: 'e.g. Calculates custom logic for the transaction',
        ignoreFocusOut: true
    }) || '';

    let folderName = '';
    let commerceProcess = '';
    let commerceDocument = '';

    if (typeSelection.id !== 'util') {
        commerceProcess = getCommerceProcess(vscode);
        commerceDocument = getCommerceDocument(vscode);
    }

    // 8. Return type selection
    const returnTypes = [
        { label: 'String', description: 'Returns a text value' },
        { label: 'Float', description: 'Returns a floating point decimal' },
        { label: 'Integer', description: 'Returns a whole number' },
        { label: 'Boolean', description: 'Returns true/false' },
        { label: 'Date', description: 'Returns a date' },
        { label: 'Json', description: 'Returns a JSON object' },
        { label: 'JsonArray', description: 'Returns a JSON array' },
        { label: 'String[]', description: 'Returns an array of strings' },
        { label: 'Float[]', description: 'Returns an array of floats' },
        { label: 'Integer[]', description: 'Returns an array of integers' }
    ];
    const typePick = await vscode.window.showQuickPick(returnTypes, {
        placeHolder: 'Select return type',
        ignoreFocusOut: true
    });
    if (!typePick) return;
    const returnTypeLabel = typePick.label;
    const returnTypeValue = returnTypeMap[returnTypeLabel] || 1;
    const returnType = { value: returnTypeValue, displayValue: returnTypeLabel };

    // 9. Boilerplate script template
    let scriptText = 'return "";';
    if (returnTypeLabel === 'Float') {
        scriptText = 'return 0.0;';
    } else if (returnTypeLabel === 'Integer') {
        scriptText = 'return 0;';
    } else if (returnTypeLabel === 'Boolean') {
        scriptText = 'return false;';
    } else if (returnTypeLabel === 'Date') {
        scriptText = 'return getdate();';
    } else if (returnTypeLabel === 'Json') {
        scriptText = 'return json();';
    } else if (returnTypeLabel === 'JsonArray') {
        scriptText = 'return jsonarray();';
    }

    // 10. File paths and metadata structure
    const { pullFolder } = getSettings(vscode);
    let bmlPath = '';
    let metadata = {};

    if (typeSelection.id === 'util') {
        bmlPath = path.join(
            workspaceRoot,
            pullFolder,
            folderName,
            variableName,
            `${variableName}.bml`
        );
        metadata = {
            name: displayName,
            variableName,
            description,
            folderName,
            testScript: '',
            useTestScript: false,
            returnType,
            parameters: [],
            libraryFunctions: [],
            attributes: []
        };
    } else {
        bmlPath = path.join(
            workspaceRoot,
            pullFolder,
            commerceProcess,
            commerceDocument,
            'libraries',
            variableName,
            `${variableName}.bml`
        );
        metadata = {
            name: displayName,
            variableName,
            description,
            testScript: '',
            useTestScript: false,
            returnType,
            parameters: [],
            libraryFunctions: [],
            attributes: [],
            commerceProcess,
            commerceDocument
        };
    }

    const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);

    // 11. Write files and open doc
    try {
        fs.mkdirSync(path.dirname(bmlPath), { recursive: true });
        metadataLib.writeBmlFile(bmlPath, scriptText);
        metadataLib.writeMetadata(metaPath, metadata);

        const doc = await vscode.workspace.openTextDocument(bmlPath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`CPQ-BML: created function "${variableName}" successfully.`);
    } catch (err) {
        vscode.window.showErrorMessage(`CPQ-BML: failed to create function: ${err.message}`);
    }
}

module.exports = { runCreateBmlFunction };
