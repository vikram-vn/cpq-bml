const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * BML Unit Test Runner
 *
 * Reads a *.bmltest.json sidecar file next to a .bml file.
 * Format:
 *   [
 *     { "description": "basic case", "params": { "x": "1" }, "expected": "hello" },
 *     ...
 *   ]
 *
 * For each test case, calls the CPQ debug endpoint with the given params,
 * captures the return value, and compares to `expected`.
 *
 * Results are written to a dedicated "BML Test Runner" Output Channel.
 */

let testOutputChannel = null;

function getTestChannel() {
    if (!testOutputChannel) {
        testOutputChannel = vscode.window.createOutputChannel('BML Test Runner');
    }
    return testOutputChannel;
}

async function runBmlTests(context, vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.bml')) {
        vscode.window.showErrorMessage('CPQ-BML: Open a .bml file first to run its tests.');
        return;
    }

    const bmlPath = editor.document.fileName;
    const baseName = path.basename(bmlPath, '.bml');
    const testFilePath = path.join(path.dirname(bmlPath), baseName + '.bmltest.json');

    if (!fs.existsSync(testFilePath)) {
        vscode.window.showErrorMessage(
            `CPQ-BML: No test file found. Create ${baseName}.bmltest.json alongside ${baseName}.bml.`
        );
        return;
    }

    let testCases;
    try {
        testCases = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
    } catch (e) {
        vscode.window.showErrorMessage(`CPQ-BML: Failed to parse ${baseName}.bmltest.json: ${e.message}`);
        return;
    }

    const channel = getTestChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`BML Test Runner — ${baseName}`);
    channel.appendLine(`${'─'.repeat(60)}`);
    channel.appendLine(`Found ${testCases.length} test case(s)\n`);

    // Lazy-load the debug command to avoid circular deps
    const { runDebugCurrentFile } = require('../rest/commands');
    const { createToolVscodeContext, createCapturingTerminal } = require('../mcp/proxy');
    const { getAiTerminal } = require('../mcp/aiTerminal');

    let passed = 0, failed = 0;
    const start = Date.now();

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const desc = tc.description || `Case ${i + 1}`;
        const params = tc.params || {};
        const expected = tc.expected !== undefined ? String(tc.expected) : null;

        channel.appendLine(`  ▶ ${desc}`);

        try {
            // Create a proxy context pointing at the current file
            const { vscodeProxy, messages } = createToolVscodeContext(vscode, { bmlPath });
            const { terminal, getLines } = createCapturingTerminal(getAiTerminal(vscode));

            await runDebugCurrentFile(context, vscodeProxy, terminal, { parameters: params });

            // Extract the return value from the captured terminal output
            const outputLines = getLines();
            const returnLine = outputLines.find(l => /return value:/i.test(l));
            const actual = returnLine ? returnLine.replace(/.*return value:\s*/i, '').trim() : null;

            if (expected === null) {
                channel.appendLine(`    ✅ PASS (no expected value, ran without error)`);
                passed++;
            } else if (actual === expected) {
                channel.appendLine(`    ✅ PASS`);
                passed++;
            } else {
                channel.appendLine(`    ❌ FAIL`);
                channel.appendLine(`       Expected: ${expected}`);
                channel.appendLine(`       Actual:   ${actual ?? '(no return value captured)'}`);
                failed++;
            }
        } catch (e) {
            channel.appendLine(`    ❌ ERROR: ${e.message}`);
            failed++;
        }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    channel.appendLine(`\n${'─'.repeat(60)}`);
    channel.appendLine(`Results: ${passed} passed, ${failed} failed  (${elapsed}s)`);

    if (failed > 0) {
        vscode.window.showWarningMessage(`BML Tests: ${failed} of ${testCases.length} failed. See "BML Test Runner" output.`);
    } else {
        vscode.window.showInformationMessage(`BML Tests: All ${passed} tests passed ✅`);
    }
}

function registerBmlTestRunner(context) {
    const vscode = require('vscode');
    const runCmd = vscode.commands.registerCommand('cpqBml.test.runTests', () => runBmlTests(context, vscode));
    context.subscriptions.push(runCmd);
}

module.exports = { registerBmlTestRunner, runBmlTests };
