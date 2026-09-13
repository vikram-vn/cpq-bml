'use strict';

const assert = require('assert');
const {
  CLOUD_SCHEME,
  CloudDocumentProvider,
  createCloudUri,
  openVirtualJsonDocument,
  registerCloudDocumentProvider
} = require('@/lang/cloud/cloudDocumentProvider');
const { getInspectorHtml, escapeHtml } = require('@/lang/cloud/cloudInspectorHtml');
const {
  normalizeInspectorPayload,
  showCloudInspector,
  inspectItemAccordingToPreference,
  _resetInspectorPanel
} = require('@/lang/cloud/cloudInspectorPanel');
const {
  openCommerceActionCommand,
  inspectPropertiesCommand,
  viewRawJsonCommand
} = require('@/lang/cloud/cloudExplorerCommands');
const { inspectIntegrationCommand } = require('@/lang/cloud/cloudCommerceExplorer');
const { inspectTransactionCommand } = require('@/lang/cloud/cloudTransactions');
const { inspectPartCommand } = require('@/lang/cloud/cloudParts');
const { inspectDeploymentTaskCommand } = require('@/lang/cloud/cloudDeploymentCenter');
const { createCloudMockVscode } = require('./cloudTestMocks');

suite('CPQ Cloud Document Provider & Property Inspector (Option 3)', () => {
  setup(() => {
    _resetInspectorPanel();
  });

  suite('CloudDocumentProvider & URI Scheme', () => {
    test('creates safe cpq-cloud URIs without illegal characters', () => {
      const uri = createCloudUri('actions', 'Email Proposal/Quote?#1', '.json');
      assert.strictEqual(uri.scheme, CLOUD_SCHEME);
      assert.ok(uri.path.includes('/actions/'));
      assert.ok(!uri.path.includes('?'));
      assert.ok(!uri.path.includes('#'));
      assert.ok(uri.path.endsWith('.json'));
    });

    test('registers and retrieves text document content', () => {
      let changeFired = false;
      const listeners = [];
      const mockVscode = createCloudMockVscode({
        EventEmitter: function () {
          return {
            event: (cb) => { listeners.push(cb); return { dispose: () => {} }; },
            fire: (val) => { changeFired = true; listeners.forEach(cb => cb(val)); }
          };
        }
      });
      const provider = new CloudDocumentProvider(mockVscode);
      const uri = createCloudUri('actions', 'testAction', '.json', mockVscode);

      provider.onDidChange(() => {
        changeFired = true;
      });

      provider.registerDocument(uri, '{"test": true}');
      assert.strictEqual(changeFired, true);

      const content = provider.provideTextDocumentContent(uri);
      assert.strictEqual(content, '{"test": true}');

      provider.unregisterDocument(uri);
      assert.strictEqual(provider.provideTextDocumentContent(uri), '');
    });

    test('openVirtualJsonDocument registers document and opens it via workspace.openTextDocument(uri)', async () => {
      let openedUri = null;
      let shownDoc = null;

      const mockVscode = createCloudMockVscode({
        workspace: {
          openTextDocument: async (uri) => {
            openedUri = uri;
            return { uri };
          },
          registerTextDocumentContentProvider: () => ({ dispose: () => {} })
        },
        window: {
          showTextDocument: async (doc) => {
            shownDoc = doc;
            return doc;
          }
        },
        Uri: {
          from: (components) => ({
            scheme: components.scheme,
            path: components.path,
            toString: () => `${components.scheme}://${components.path}`
          })
        }
      });

      const doc = await openVirtualJsonDocument('actions', 'Submit Order (submitOrder_t)', { id: 123 }, mockVscode);
      assert.ok(doc);
      assert.ok(openedUri);
      assert.strictEqual(openedUri.scheme, 'cpq-cloud');
      assert.ok(openedUri.path.includes('Submit Order'));
      assert.ok(shownDoc);
    });

    test('registerCloudDocumentProvider adds disposable to subscriptions', () => {
      const subscriptions = [];
      const mockVscode = createCloudMockVscode({
        workspace: {
          registerTextDocumentContentProvider: (scheme, provider) => {
            assert.strictEqual(scheme, 'cpq-cloud');
            return { dispose: () => {} };
          }
        }
      });

      registerCloudDocumentProvider({ subscriptions }, mockVscode);
      assert.strictEqual(subscriptions.length, 1);
    });
  });

  suite('cloudInspectorHtml (Webview HTML generation)', () => {
    test('escapes special characters properly', () => {
      assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      assert.strictEqual(escapeHtml(null), '');
      assert.strictEqual(escapeHtml(undefined), '');
    });

    test('generates HTML containing category, title, variable name, and properties', () => {
      const html = getInspectorHtml({
        category: 'Action',
        title: 'Email Proposal (emailProposal_t)',
        variableName: 'emailProposal_t',
        type: 'Modify',
        description: 'Sends proposal email to customer',
        data: {
          commerceProcess: 'oraclecpqo',
          commerceDocument: 'transaction',
          lastUpdatedBy: 'admin',
          menuOptions: [
            { displayValue: 'Option A', value: 'OPT_A' },
            { displayValue: 'Option B', value: 'OPT_B' }
          ]
        },
        hasBml: true
      }, { cspSource: 'vscode-webview:' });

      assert.ok(html.includes('Email Proposal (emailProposal_t)'));
      assert.ok(html.includes('emailProposal_t'));
      assert.ok(html.includes('Action'));
      assert.ok(html.includes('Sends proposal email to customer'));
      assert.ok(html.includes('oraclecpqo'));
      assert.ok(html.includes('transaction'));
      assert.ok(html.includes('Option A'));
      assert.ok(html.includes('OPT_A'));
      assert.ok(html.includes('Open BML Script'));
      assert.ok(html.includes('Content-Security-Policy'));
    });
  });

  suite('cloudInspectorPanel & Preferences', () => {
    test('normalizes payloads from varied tree items', () => {
      const actNorm = normalizeInspectorPayload({
        type: 'action',
        data: { name: 'emailProposal_t', label: 'Email Proposal', actionType: 'Modify' }
      });
      assert.strictEqual(actNorm.category, 'Action');
      assert.strictEqual(actNorm.variableName, 'emailProposal_t');
      assert.strictEqual(actNorm.title, 'Email Proposal (emailProposal_t)');

      const partNorm = normalizeInspectorPayload({
        type: 'part',
        part: { partNumber: 'CPU-INTEL-I9', price: 499, currency: 'USD' }
      });
      assert.strictEqual(partNorm.category, 'Part');
      assert.strictEqual(partNorm.variableName, 'CPU-INTEL-I9');
    });

    test('showCloudInspector creates webview panel and receives messages', async () => {
      let createdPanel = null;
      let messageHandler = null;
      let clipboardWritten = null;

      const mockVscode = createCloudMockVscode({
        window: {
          createWebviewPanel: (viewType, title, showOptions, options) => {
            const panel = {
              viewType,
              title,
              webview: {
                html: '',
                cspSource: 'vscode-webview:',
                onDidReceiveMessage: (fn) => { messageHandler = fn; }
              },
              onDidDispose: () => {},
              reveal: () => {}
            };
            createdPanel = panel;
            return panel;
          }
        },
        env: {
          clipboard: {
            writeText: async (txt) => { clipboardWritten = txt; }
          }
        },
        Uri: {
          file: (p) => ({ fsPath: p })
        }
      });

      const item = {
        data: { variableName: 'discount_t', label: 'Discount Percent', dataType: 'Float' }
      };

      const panel = await showCloudInspector(item, { extensionPath: 'c:/test' }, mockVscode);
      assert.ok(panel);
      assert.ok(createdPanel);
      assert.ok(createdPanel.title.includes('Discount Percent'));

      // Test message handler for copying text
      assert.ok(messageHandler);
      await messageHandler({ command: 'copyText', text: 'discount_t' });
      assert.strictEqual(clipboardWritten, 'discount_t');
    });

    test('inspectItemAccordingToPreference respects user setting "virtualDocument"', async () => {
      let openedUri = null;

      const mockVscode = createCloudMockVscode({
        workspace: {
          getConfiguration: (sec) => ({
            get: (k, def) => (k === 'openMetadataAs' ? 'virtualDocument' : def)
          }),
          openTextDocument: async (uri) => {
            openedUri = uri;
            return { uri };
          },
          registerTextDocumentContentProvider: () => ({ dispose: () => {} })
        },
        window: {
          showTextDocument: async () => {}
        },
        Uri: {
          from: (components) => ({
            scheme: components.scheme,
            path: components.path,
            toString: () => `${components.scheme}://${components.path}`
          })
        }
      });

      const item = {
        data: { variableName: 'testAction', label: 'Test Action', actionType: 'Modify' }
      };

      await inspectItemAccordingToPreference(item, {}, mockVscode);
      assert.ok(openedUri);
      assert.strictEqual(openedUri.scheme, 'cpq-cloud');
      assert.ok(openedUri.path.includes('testAction'));
    });

    test('inspectItemAccordingToPreference defaults to "inspector"', async () => {
      let createdPanel = false;

      const mockVscode = createCloudMockVscode({
        workspace: {
          getConfiguration: () => ({
            get: (k, def) => def
          })
        },
        window: {
          createWebviewPanel: () => {
            createdPanel = true;
            return {
              webview: { html: '', onDidReceiveMessage: () => {} },
              onDidDispose: () => {},
              reveal: () => {}
            };
          }
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      const item = {
        data: { variableName: 'testAction', label: 'Test Action' }
      };

      await inspectItemAccordingToPreference(item, {}, mockVscode);
      assert.strictEqual(createdPanel, true);
    });
  });

  suite('Explorer inspect commands route to Option 3 (no untitled json)', () => {
    test('inspectCommerceActionCommand does not create untitled document', async () => {
      let createdUntitled = false;
      let createdInspector = false;

      const mockVscode = createCloudMockVscode({
        workspace: {
          openTextDocument: async (arg) => {
            if (arg && arg.content !== undefined) createdUntitled = true;
            return arg;
          },
          getConfiguration: () => ({ get: () => 'inspector' })
        },
        window: {
          createWebviewPanel: () => {
            createdInspector = true;
            return {
              webview: { html: '', onDidReceiveMessage: () => {} },
              onDidDispose: () => {},
              reveal: () => {}
            };
          },
          withProgress: async (opts, fn) => fn()
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await openCommerceActionCommand({ data: { variableName: 'act1', name: 'act1' } }, mockVscode, {});
      assert.strictEqual(createdUntitled, false, 'Should not open untitled document');
      assert.strictEqual(createdInspector, true, 'Should open inspector panel');
    });

    test('inspectIntegrationCommand does not create untitled document', async () => {
      let createdUntitled = false;
      let createdInspector = false;

      const mockVscode = createCloudMockVscode({
        workspace: {
          openTextDocument: async (arg) => {
            if (arg && arg.content !== undefined) createdUntitled = true;
            return arg;
          },
          getConfiguration: () => ({ get: () => 'inspector' })
        },
        window: {
          createWebviewPanel: () => {
            createdInspector = true;
            return {
              webview: { html: '', onDidReceiveMessage: () => {} },
              onDidDispose: () => {},
              reveal: () => {}
            };
          },
          withProgress: async (opts, fn) => fn()
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await inspectIntegrationCommand({ data: { variableName: 'itg1', name: 'itg1' } }, mockVscode, {});
      assert.strictEqual(createdUntitled, false);
      assert.strictEqual(createdInspector, true);
    });

    test('inspectTransactionCommand does not create untitled document', async () => {
      let createdUntitled = false;
      let createdInspector = false;

      const mockVscode = createCloudMockVscode({
        workspace: {
          openTextDocument: async (arg) => {
            if (arg && arg.content !== undefined) createdUntitled = true;
            return arg;
          },
          getConfiguration: () => ({ get: () => 'inspector' })
        },
        window: {
          createWebviewPanel: () => {
            createdInspector = true;
            return {
              webview: { html: '', onDidReceiveMessage: () => {} },
              onDidDispose: () => {},
              reveal: () => {}
            };
          },
          withProgress: async (opts, fn) => fn()
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await inspectTransactionCommand({ data: { transactionID_t: 'TX-100' } }, mockVscode);
      assert.strictEqual(createdUntitled, false);
      assert.strictEqual(createdInspector, true);
    });

    test('inspectPartCommand does not create untitled document', async () => {
      let createdUntitled = false;
      let createdInspector = false;

      const mockVscode = createCloudMockVscode({
        workspace: {
          openTextDocument: async (arg) => {
            if (arg && arg.content !== undefined) createdUntitled = true;
            return arg;
          },
          getConfiguration: () => ({ get: () => 'inspector' })
        },
        window: {
          createWebviewPanel: () => {
            createdInspector = true;
            return {
              webview: { html: '', onDidReceiveMessage: () => {} },
              onDidDispose: () => {},
              reveal: () => {}
            };
          },
          withProgress: async (opts, fn) => fn()
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await inspectPartCommand({ part: { partNumber: 'PART-001' } }, mockVscode);
      assert.strictEqual(createdUntitled, false);
      assert.strictEqual(createdInspector, true);
    });
  });

});
