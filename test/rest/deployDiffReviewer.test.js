const assert = require('assert');
const { compareAndPromptPreDeploy } = require('@/lang/rest/deployDiffReviewer');

suite('Pre-Deploy Diff Reviewer - Unit Tests', () => {
  test('detects identical local and remote code and reports isIdentical', async () => {
    const mockVscode = {
      window: {
        showInformationMessage: async () => 'Deploy Anyway'
      }
    };

    const mockTransport = async () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      text: JSON.stringify({ scriptText: 'return 100;' })
    });

    const result = await compareAndPromptPreDeploy({
      vscode: mockVscode,
      localPath: '/tmp/test.bml',
      localContent: 'return 100;',
      metadata: { variableName: 'testFunc' },
      transport: mockTransport
    });

    assert.strictEqual(result.canProceed, true);
    assert.strictEqual(result.isIdentical, true);
  });

  test('prompts user when remote differs and allows deployment', async () => {
    const mockVscode = {
      window: {
        showWarningMessage: async () => 'Deploy to CPQ'
      }
    };

    const mockTransport = async () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      text: JSON.stringify({ scriptText: 'return 50;' })
    });

    const result = await compareAndPromptPreDeploy({
      vscode: mockVscode,
      localPath: '/tmp/test.bml',
      localContent: 'return 100;',
      metadata: { variableName: 'testFunc' },
      transport: mockTransport
    });

    assert.strictEqual(result.canProceed, true);
    assert.strictEqual(result.remoteContent, 'return 50;');
    assert.strictEqual(result.isNew, false);
  });

  test('handles cancelled deployment gracefully', async () => {
    const mockVscode = {
      window: {
        showWarningMessage: async () => 'Cancel'
      }
    };

    const mockTransport = async () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      text: JSON.stringify({ scriptText: 'return 50;' })
    });

    const result = await compareAndPromptPreDeploy({
      vscode: mockVscode,
      localPath: '/tmp/test.bml',
      localContent: 'return 100;',
      metadata: { variableName: 'testFunc' },
      transport: mockTransport
    });

    assert.strictEqual(result.canProceed, false);
  });
});
