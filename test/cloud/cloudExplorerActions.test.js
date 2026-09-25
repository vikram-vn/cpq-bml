const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  deployFunctionCommand,
  debugFunctionCommand,
  debugConfigureFunctionCommand,
  viewFunctionMetadataCommand
} = require('@/lang/cloud/cloudExplorer');
const { createCloudMockVscode } = require('@/test/cloud/cloudTestMocks');

suite('Cloud Explorer - Deploy, Debug, and Metadata Commands', () => {
  test('deployFunctionCommand opens local file and invokes deployCurrentFile when local file exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-deploy-test-'));
    const fnDir = path.join(tempDir, 'cpq', 'cpq-demo', 'util-libraries', 'finance', 'calcTax');
    fs.mkdirSync(fnDir, { recursive: true });
    const localFile = path.join(fnDir, 'calcTax.bml');
    fs.writeFileSync(localFile, 'return 0.05;\n', 'utf8');

    let executedCommand = null;
    let openedFile = null;

    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (k) => k === 'connection.siteUrl' ? 'https://cpq-demo.bigmachines.com' : ''
        }),
        openTextDocument: async (uri) => {
          openedFile = uri.fsPath;
          return { uri };
        }
      },
      commands: {
        executeCommand: async (cmd) => {
          executedCommand = cmd;
        }
      },
      Uri: {
        file: (f) => ({ fsPath: f, scheme: 'file' })
      }
    });

    try {
      const item = {
        data: {
          variableName: 'calcTax',
          name: 'Calculate Tax',
          folderName: 'finance'
        }
      };

      await deployFunctionCommand(item, mockVscode, {});
      assert.strictEqual(openedFile, localFile);
      assert.strictEqual(executedCommand, 'cpqBml.rest.deployCurrentFile');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('debugFunctionCommand opens local file and invokes debugCurrentFile with configureInputs: false (Smart Debug)', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-debug-test-'));
    const fnDir = path.join(tempDir, 'cpq', 'cpq-demo', 'util-libraries', 'finance', 'calcDiscount');
    fs.mkdirSync(fnDir, { recursive: true });
    const localFile = path.join(fnDir, 'calcDiscount.bml');
    fs.writeFileSync(localFile, 'return 10.0;\n', 'utf8');

    let executedCommand = null;
    let executedOptions = null;
    let openedFile = null;

    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (k) => k === 'connection.siteUrl' ? 'https://cpq-demo.bigmachines.com' : ''
        }),
        openTextDocument: async (uri) => {
          openedFile = uri.fsPath;
          return { uri, languageId: 'bml' };
        }
      },
      commands: {
        executeCommand: async (cmd, opts) => {
          executedCommand = cmd;
          executedOptions = opts;
        }
      },
      Uri: {
        file: (f) => ({ fsPath: f, scheme: 'file' })
      }
    });

    try {
      const item = {
        data: {
          variableName: 'calcDiscount',
          name: 'Calculate Discount',
          folderName: 'finance'
        }
      };

      await debugFunctionCommand(item, mockVscode, {});
      assert.strictEqual(openedFile, localFile);
      assert.strictEqual(executedCommand, 'cpqBml.rest.debugCurrentFile');
      assert.strictEqual(executedOptions.configureInputs, false);
      assert.strictEqual(executedOptions.file, localFile);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('debugConfigureFunctionCommand opens local file and invokes debugConfigureInputs with configureInputs: true', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-debug-cfg-test-'));
    const fnDir = path.join(tempDir, 'cpq', 'cpq-demo', 'util-libraries', 'finance', 'calcDiscount');
    fs.mkdirSync(fnDir, { recursive: true });
    const localFile = path.join(fnDir, 'calcDiscount.bml');
    fs.writeFileSync(localFile, 'return 10.0;\n', 'utf8');

    let executedCommand = null;
    let executedOptions = null;
    let openedFile = null;

    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (k) => k === 'connection.siteUrl' ? 'https://cpq-demo.bigmachines.com' : ''
        }),
        openTextDocument: async (uri) => {
          openedFile = uri.fsPath;
          return { uri, languageId: 'bml' };
        }
      },
      commands: {
        executeCommand: async (cmd, opts) => {
          executedCommand = cmd;
          executedOptions = opts;
        }
      },
      Uri: {
        file: (f) => ({ fsPath: f, scheme: 'file' })
      }
    });

    try {
      const item = {
        data: {
          variableName: 'calcDiscount',
          name: 'Calculate Discount',
          folderName: 'finance'
        }
      };

      await debugConfigureFunctionCommand(item, mockVscode, {});
      assert.strictEqual(openedFile, localFile);
      assert.strictEqual(executedCommand, 'cpqBml.rest.debugConfigureInputs');
      assert.strictEqual(executedOptions.configureInputs, true);
      assert.strictEqual(executedOptions.file, localFile);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('debugFunctionCommand shows warning and does not run debug when function is missing locally and pull is declined', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-debug-missing-'));
    let warned = false;
    let executedCommand = null;

    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (k) => k === 'connection.siteUrl' ? 'https://cpq-demo.bigmachines.com' : ''
        })
      },
      window: {
        showWarningMessage: async () => {
          warned = true;
          return undefined;
        }
      },
      commands: {
        executeCommand: async (cmd) => {
          executedCommand = cmd;
        }
      }
    });

    try {
      const item = {
        data: {
          variableName: 'missingFunc',
          name: 'Missing Function',
          folderName: 'util'
        }
      };

      await debugFunctionCommand(item, mockVscode, {});
      assert.ok(warned);
      assert.strictEqual(executedCommand, null);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('viewFunctionMetadataCommand opens local -meta.json if present or fetches remote metadata', async () => {
    const api = require('@/lang/rest/api');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-meta-test-'));
    const fnDir = path.join(tempDir, 'cpq', 'cpq-demo', 'util-libraries', 'finance', 'calcFee');
    fs.mkdirSync(fnDir, { recursive: true });
    const metaFile = path.join(fnDir, 'calcFee-meta.json');
    fs.writeFileSync(metaFile, JSON.stringify({ variableName: 'calcFee', returnType: 'Float' }), 'utf8');
    const bmlFile = path.join(fnDir, 'calcFee.bml');
    fs.writeFileSync(bmlFile, 'return 1.5;\n', 'utf8');

    let openedDocPath = null;
    let openedJsonContent = null;

    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (k) => {
            if (k === 'connection.siteUrl') return 'https://cpq-demo.bigmachines.com';
            if (k === 'openMetadataAs') return 'virtualDocument';
            return '';
          }
        }),
        openTextDocument: async (target) => {
          const { getCloudDocumentProvider } = require('@/lang/cloud/cloudDocumentProvider');
          const content = getCloudDocumentProvider().provideTextDocumentContent(target);
          if (content) {
            openedJsonContent = content;
            return { uri: target, content, getText: () => content };
          }
          openedDocPath = target?.fsPath;
          return target;
        }
      },
      Uri: {
        file: (f) => ({ fsPath: f, scheme: 'file' })
      }
    });

    try {
      const localItem = {
        data: {
          variableName: 'calcFee',
          name: 'Calculate Fee',
          folderName: 'finance'
        }
      };
      await viewFunctionMetadataCommand(localItem, mockVscode, {});
      assert.strictEqual(openedDocPath, metaFile);

      const origGetFunc = api.getLibraryFunction;
      api.getLibraryFunction = async () => ({
        statusCode: 200,
        body: {
          variableName: 'cloudOnlyFunc',
          name: 'Cloud Only Func',
          returnType: 'String',
          description: 'Remote cloud function metadata'
        }
      });

      try {
        const remoteItem = {
          data: {
            variableName: 'cloudOnlyFunc',
            name: 'Cloud Only Func',
            folderName: 'remote'
          }
        };
        await viewFunctionMetadataCommand(remoteItem, mockVscode, {});
        assert.ok(openedJsonContent);
        assert.ok(openedJsonContent.includes('cloudOnlyFunc'));
        assert.ok(openedJsonContent.includes('Remote cloud function metadata'));
      } finally {
        api.getLibraryFunction = origGetFunc;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
