const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * BML Snapshot Testing
 *
 * updateSnapshot: run the active BML function with test params and save the
 *   output to a <name>.snap.json file alongside the .bml file.
 *
 * compareSnapshot: rerun with the same params and diff against the saved
 *   snapshot, flagging any regressions as VS Code diagnostics.
 *
 * Snapshot file format:
 *   {
 *     "variableName": "myFunc",
 *     "params": { "x": "1" },
 *     "output": "expected output",
 *     "capturedAt": "ISO timestamp"
 *   }
 */

async function updateSnapshot(context, vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.bml')) {
        vscode.window.showErrorMessage('CPQ-BML: Open a .bml file to update its snapshot.');
        return;
    }

    const bmlPath = editor.document.fileName;
    const baseName = path.basename(bmlPath, '.bml');

    // Prompt for params (simple JSON input)
    const paramsInput = await vscode.window.showInputBox({
        prompt: `Enter parameters as JSON object (e.g. {"x":"1"}) or leave blank`,
        placeHolder: '{}',
        value: '{}',
    });
    if (paramsInput === undefined) return;

    let params = {};
    try { params = JSON.parse(paramsInput || '{}'); } catch {
        vscode.window.showErrorMessage('CPQ-BML: Invalid JSON for parameters.');
        return;
    }

    // Run the function
    const { runDebugCurrentFile } = require('../rest/commands');
    const { createToolVscodeContext, createCapturingTerminal } = require('../mcp/proxy');
    const { getAiTerminal } = require('../mcp/aiTerminal');

    const { vscodeProxy } = createToolVscodeContext(vscode, { bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runDebugCurrentFile(context, vscodeProxy, terminal, { parameters: params });

    const outputLines = getLines();
    const returnLine = outputLines.find(l => /return value:/i.test(l));
    const output = returnLine ? returnLine.replace(/.*return value:\s*/i, '').trim() : outputLines.join('\n');

    const snapPath = path.join(path.dirname(bmlPath), baseName + '.snap.json');
    const snap = { variableName: baseName, params, output, capturedAt: new Date().toISOString() };
    fs.writeFileSync(snapPath, JSON.stringify(snap, null, 2), 'utf8');

    vscode.window.showInformationMessage(`Snapshot saved: ${path.basename(snapPath)}`);
}

async function compareSnapshot(context, vscode, diagnosticCollection) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.bml')) {
        vscode.window.showErrorMessage('CPQ-BML: Open a .bml file to compare its snapshot.');
        return;
    }

    const bmlPath = editor.document.fileName;
    const baseName = path.basename(bmlPath, '.bml');
    const snapPath = path.join(path.dirname(bmlPath), baseName + '.snap.json');

    if (!fs.existsSync(snapPath)) {
        vscode.window.showErrorMessage(`CPQ-BML: No snapshot found. Run "Update Snapshot" first.`);
        return;
    }

    let snap;
    try { snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')); } catch (e) {
        vscode.window.showErrorMessage(`CPQ-BML: Failed to read snapshot: ${e.message}`);
        return;
    }

    const { runDebugCurrentFile } = require('../rest/commands');
    const { createToolVscodeContext, createCapturingTerminal } = require('../mcp/proxy');
    const { getAiTerminal } = require('../mcp/aiTerminal');

    const { vscodeProxy } = createToolVscodeContext(vscode, { bmlPath });
    const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));
    await runDebugCurrentFile(context, vscodeProxy, terminal, { parameters: snap.params || {} });

    const outputLines = getLines();
    const returnLine = outputLines.find(l => /return value:/i.test(l));
    const actual = returnLine ? returnLine.replace(/.*return value:\s*/i, '').trim() : outputLines.join('\n');

    if (actual === snap.output) {
        // Clear any prior snapshot diagnostics
        if (diagnosticCollection) diagnosticCollection.set(editor.document.uri, []);
        vscode.window.showInformationMessage(`✅ Snapshot matches for ${baseName}`);
    } else {
        const diag = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            `Snapshot regression in "${baseName}":\n  Expected: ${snap.output}\n  Actual:   ${actual}`,
            vscode.DiagnosticSeverity.Error
        );
        diag.code = 'bml-snapshot-regression';
        if (diagnosticCollection) diagnosticCollection.set(editor.document.uri, [diag]);
        vscode.window.showWarningMessage(`❌ Snapshot mismatch for ${baseName}. See Problems panel.`);
    }
}

function registerBmlSnapshot(context) {
    const vscode = require('vscode');
    const snapshotDiagnostics = vscode.languages.createDiagnosticCollection('bml-snapshot');
    context.subscriptions.push(snapshotDiagnostics);

    const updateCmd = vscode.commands.registerCommand('cpqBml.test.updateSnapshot', () => updateSnapshot(context, vscode));
    const compareCmd = vscode.commands.registerCommand('cpqBml.test.compareSnapshot', () => compareSnapshot(context, vscode, snapshotDiagnostics));
    context.subscriptions.push(updateCmd, compareCmd);
}

module.exports = { registerBmlSnapshot, updateSnapshot, compareSnapshot };
