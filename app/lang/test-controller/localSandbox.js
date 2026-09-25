let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = null;
}

const { runTestCase } = require('@/lang/test-controller/bmlTestRunner');

let scratchpadChannel = null;

function getScratchpadChannel(vscodeInstance = vscode) {
  if (!scratchpadChannel && vscodeInstance && vscodeInstance.window) {
    scratchpadChannel = vscodeInstance.window.createOutputChannel('BML Scratchpad');
  }
  return scratchpadChannel;
}

/**
 * Executes the active editor BML selection (or entire document) locally in sandbox.
 */
async function runBmlLocallyCommand(vscodeInstance = vscode) {
  const vsc = vscodeInstance || vscode;
  if (!vsc || !vsc.window) return;

  const editor = vsc.window.activeTextEditor;
  if (!editor) {
    vsc.window.showErrorMessage('CPQ-BML: Open a BML file or select BML code to run locally.');
    return;
  }

  const selection = editor.selection;
  let codeToRun = '';
  let runScope = 'Selection';

  if (selection && !selection.isEmpty) {
    codeToRun = editor.document.getText(selection);
  } else {
    codeToRun = editor.document.getText();
    runScope = 'Entire Document';
  }

  if (!codeToRun || !codeToRun.trim()) {
    vsc.window.showWarningMessage('CPQ-BML: No code to execute in active editor.');
    return;
  }

  const channel = getScratchpadChannel(vsc);
  if (channel) {
    channel.show(true);
    channel.appendLine(`================================================================`);
    channel.appendLine(`[${new Date().toLocaleTimeString()}] Running BML Scratchpad (${runScope})`);
    channel.appendLine(`================================================================`);
  }

  const result = runTestCase(codeToRun, 5000);

  if (channel) {
    if (result.output && result.output.length > 0) {
      channel.appendLine(`--- Standard Output (print) ---`);
      for (const line of result.output) {
        channel.appendLine(line);
      }
    }

    channel.appendLine(`----------------------------------------------------------------`);
    if (result.passed) {
      channel.appendLine(`Status: PASSED (${result.durationMs}ms)`);
      if (result.returnValue !== undefined) {
        const valStr = typeof result.returnValue === 'object'
          ? JSON.stringify(result.returnValue, null, 2)
          : String(result.returnValue);
        channel.appendLine(`Return Value: ${valStr}`);
      } else {
        channel.appendLine(`Return Value: (void / none)`);
      }
    } else {
      channel.appendLine(`Status: FAILED (${result.durationMs}ms)`);
      channel.appendLine(`Error: ${result.error}`);
    }
    channel.appendLine(``);
  }

  return result;
}

module.exports = {
  runBmlLocallyCommand,
  getScratchpadChannel
};
