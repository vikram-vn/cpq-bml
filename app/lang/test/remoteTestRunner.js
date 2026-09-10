let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { showInformationMessage: () => {}, showErrorMessage: () => {}, createOutputChannel: () => ({ appendLine: () => {}, show: () => {} }), withProgress: async (opt, task) => task({ report: () => {} }) },
    commands: { registerCommand: () => ({ dispose: () => {} }) }
  };
}

const fs = require('fs');
const path = require('path');
const { BmlTestRunner } = require('./bmlTestRunner');
const api = require('../rest/api');
const { getBaseUrl, getAuthHeader } = require('../rest/config');

/**
 * Extracts assertion patterns from BMLT code.
 */
function extractBmltAssertions(code = '') {
  const assertions = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//') || line.startsWith('/*')) continue;

    const equalsMatch = line.match(/assert\.equals\(([^,]+),\s*([^,)]+)(?:,\s*([^)]+))?\)/);
    if (equalsMatch) {
      assertions.push({
        type: 'equals',
        line: i + 1,
        actual: equalsMatch[1].trim(),
        expected: equalsMatch[2].trim(),
        message: equalsMatch[3] ? equalsMatch[3].trim() : ''
      });
      continue;
    }

    const isTrueMatch = line.match(/assert\.isTrue\(([^,)]+)(?:,\s*([^)]+))?\)/);
    if (isTrueMatch) {
      assertions.push({
        type: 'isTrue',
        line: i + 1,
        expression: isTrueMatch[1].trim(),
        message: isTrueMatch[2] ? isTrueMatch[2].trim() : ''
      });
      continue;
    }

    const notNullMatch = line.match(/assert\.notNull\(([^,)]+)(?:,\s*([^)]+))?\)/);
    if (notNullMatch) {
      assertions.push({
        type: 'notNull',
        line: i + 1,
        expression: notNullMatch[1].trim(),
        message: notNullMatch[2] ? notNullMatch[2].trim() : ''
      });
    }
  }

  return assertions;
}

/**
 * Executes a .bmlt test suite against the CPQ server (or local engine if offline).
 */
async function executeRemoteBmltTest(testFilePath, vscodeInstance = vscode, context, customTransport) {
  if (!fs.existsSync(testFilePath)) {
    throw new Error(`Test file not found: ${testFilePath}`);
  }

  const content = fs.readFileSync(testFilePath, 'utf8');
  const testCases = BmlTestRunner.extractTestCases(content);
  if (testCases.length === 0) {
    // Treat whole file as single test case if no @test annotations found
    testCases.push({
      name: path.basename(testFilePath),
      line: 1,
      codeLines: content.split('\n')
    });
  }

  const configured = Boolean(getBaseUrl(vscodeInstance) && getAuthHeader(vscodeInstance));
  const results = [];
  const t0 = Date.now();

  for (const tc of testCases) {
    const code = tc.codeLines.join('\n');
    const assertions = extractBmltAssertions(code);

    let passed = true;
    let error = null;
    let durationMs = 0;
    const logs = [];

    const caseStart = Date.now();

    if (configured) {
      try {
        // Run against live CPQ evaluation/validation endpoint
        const payload = {
          variableName: `test_${tc.name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
          scriptText: code
        };

        const res = await api.validateLibraryFunction(context, vscodeInstance, payload, customTransport);
        durationMs = Date.now() - caseStart;

        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Verify assertions locally if server passed syntax check
          const localCheck = BmlTestRunner.runTestCase(code);
          passed = localCheck.passed;
          error = localCheck.error;
          logs.push(`[Server] Syntax & execution validated on CPQ Cloud (${durationMs}ms)`);
        } else {
          passed = false;
          const msg = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
          error = `Server Error (HTTP ${res.statusCode}): ${msg}`;
        }
      } catch (err) {
        // Fallback to local
        const local = BmlTestRunner.runTestCase(code);
        passed = local.passed;
        error = local.error;
        durationMs = Date.now() - caseStart;
        logs.push(`[Local Fallback] ${err.message}`);
      }
    } else {
      // Offline execution
      const local = BmlTestRunner.runTestCase(code);
      passed = local.passed;
      error = local.error;
      durationMs = local.durationMs || (Date.now() - caseStart);
      logs.push('[Offline Engine] Executed in local sandbox');
    }

    results.push({
      name: tc.name,
      line: tc.line,
      passed,
      error,
      durationMs,
      assertionsCount: assertions.length,
      logs
    });
  }

  const totalDurationMs = Date.now() - t0;
  const allPassed = results.every(r => r.passed);

  return {
    filePath: testFilePath,
    fileName: path.basename(testFilePath),
    testCases: results,
    totalCount: results.length,
    passedCount: results.filter(r => r.passed).length,
    failedCount: results.filter(r => !r.passed).length,
    totalDurationMs,
    allPassed,
    executionMode: configured ? 'Remote (Live CPQ)' : 'Local Sandbox'
  };
}

let remoteTestChannel = null;

function formatTestRunReport(report) {
  const lines = [];
  lines.push(`================================================================================`);
  lines.push(`BMLT Test Run: ${report.fileName} (${report.executionMode})`);
  lines.push(`Executed: ${new Date().toISOString()} | Duration: ${report.totalDurationMs}ms`);
  lines.push(`Status: ${report.allPassed ? 'ALL TESTS PASSED [OK]' : 'TESTS FAILED [X]'}`);
  lines.push(`Passed: ${report.passedCount} / ${report.totalCount}`);
  lines.push(`================================================================================\n`);

  for (const tc of report.testCases) {
    const icon = tc.passed ? '[PASS]' : '[FAIL]';
    lines.push(`${icon} ${tc.name} (${tc.durationMs}ms, ${tc.assertionsCount} assertions)`);
    if (tc.error) {
      lines.push(`       Error: ${tc.error}`);
    }
    for (const log of tc.logs) {
      lines.push(`       Log: ${log}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function registerRemoteTestCommands(context, vscodeInstance = vscode) {
  const disposable = vscodeInstance.commands.registerCommand('cpqBml.test.runRemoteTest', async () => {
    const editor = vscodeInstance.window.activeTextEditor;
    if (!editor) {
      vscodeInstance.window.showErrorMessage('Open a .bmlt or .test.bml file to run.');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    if (!filePath.endsWith('.bmlt') && !filePath.endsWith('.test.bml') && !filePath.endsWith('.bml')) {
      vscodeInstance.window.showErrorMessage('File must be a .bmlt or .bml test suite.');
      return;
    }

    await vscodeInstance.window.withProgress({
      location: 15,
      title: `Running BMLT Tests on ${path.basename(filePath)}...`,
      cancellable: false
    }, async () => {
      try {
        const report = await executeRemoteBmltTest(filePath, vscodeInstance, context);

        if (!remoteTestChannel) {
          remoteTestChannel = vscodeInstance.window.createOutputChannel('BMLT Test Results');
        }
        remoteTestChannel.show(true);
        remoteTestChannel.appendLine(formatTestRunReport(report));

        if (report.allPassed) {
          vscodeInstance.window.showInformationMessage(
            `All ${report.passedCount} BMLT tests passed on ${report.executionMode} (${report.totalDurationMs}ms).`
          );
        } else {
          vscodeInstance.window.showErrorMessage(
            `${report.failedCount} of ${report.totalCount} tests failed on ${report.executionMode}. Check output channel.`
          );
        }
      } catch (err) {
        vscodeInstance.window.showErrorMessage(`Failed to execute BMLT tests: ${err.message}`);
      }
    });
  });

  context.subscriptions.push(disposable);
}

module.exports = {
  extractBmltAssertions,
  executeRemoteBmltTest,
  formatTestRunReport,
  registerRemoteTestCommands
};
