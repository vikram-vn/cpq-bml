'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  showCloudInspector,
  normalizeInspectorPayload,
  inspectItemAccordingToPreference,
  _resetInspectorPanel
} = require('@/lang/cloud/cloudInspectorPanel');
const { getInspectorHtml, escapeHtml } = require('@/lang/web-panel/webPanelManager');
const { viewRawJsonCommand, inspectPropertiesCommand } = require('@/lang/cloud/cloudExplorerCommands');
const { openVirtualJsonDocument, getCloudDocumentProvider } = require('@/lang/cloud/cloudDocumentProvider');
const { createCloudMockVscode } = require('@/test/cloud/cloudTestMocks');

suite('Cloud Inspector - Negative & Edge Cases', () => {
  setup(() => {
    _resetInspectorPanel();
  });

  suite('normalizeInspectorPayload edge & negative cases', () => {
    test('handles null and undefined input gracefully', () => {
      const fromNull = normalizeInspectorPayload(null);
      assert.strictEqual(fromNull.category, 'Item');
      assert.strictEqual(fromNull.title, 'CPQ Metadata');
      assert.strictEqual(fromNull.variableName, '');
      assert.strictEqual(fromNull.hasBml, false);
      assert.deepStrictEqual(fromNull.data, {});

      const fromUndef = normalizeInspectorPayload(undefined);
      assert.strictEqual(fromUndef.category, 'Item');
      assert.strictEqual(fromUndef.title, 'CPQ Metadata');
      assert.strictEqual(fromUndef.variableName, '');
    });

    test('handles empty object and missing property names', () => {
      const norm = normalizeInspectorPayload({});
      assert.strictEqual(norm.category, 'Item');
      assert.strictEqual(norm.title, 'CPQ Metadata');
      assert.strictEqual(norm.variableName, '');
      assert.strictEqual(norm.type, '');
      assert.strictEqual(norm.description, '');
      assert.strictEqual(norm.hasBml, false);
    });

    test('handles corrupt or empty data sub-objects', () => {
      const norm1 = normalizeInspectorPayload({ data: null });
      assert.strictEqual(norm1.title, 'CPQ Metadata');

      const norm2 = normalizeInspectorPayload({ part: null });
      assert.strictEqual(norm2.title, 'CPQ Metadata');
    });

    test('identifies hasBml across various legacy script property names', () => {
      assert.strictEqual(normalizeInspectorPayload({ data: { scriptText: 'x = 1;' } }).hasBml, true);
      assert.strictEqual(normalizeInspectorPayload({ data: { bmlScript: 'x = 1;' } }).hasBml, true);
      assert.strictEqual(normalizeInspectorPayload({ data: { conditionScript: 'return true;' } }).hasBml, true);
      assert.strictEqual(normalizeInspectorPayload({ data: { actionScript: 'print(1);' } }).hasBml, true);
      assert.strictEqual(normalizeInspectorPayload({ data: { script: 'return;' } }).hasBml, true);
      assert.strictEqual(normalizeInspectorPayload({ type: 'action', data: { hasScript: true } }).hasBml, true);
      assert.strictEqual(normalizeInspectorPayload({ type: 'action', data: {} }).hasBml, false);
    });
  });

  suite('getInspectorHtml edge & negative cases', () => {
    test('handles null and undefined payload without crashing', () => {
      const htmlNull = getInspectorHtml(null);
      assert.ok(htmlNull.includes('CPQ Metadata'));
      assert.ok(htmlNull.includes('Item'));

      const htmlUndef = getInspectorHtml(undefined);
      assert.ok(htmlUndef.includes('CPQ Metadata'));
    });

    test('handles circular references in payload safely without throwing', () => {
      const circular = {
        title: 'Circular Item',
        category: 'Test'
      };
      circular.self = circular;

      let html = null;
      assert.doesNotThrow(() => {
        html = getInspectorHtml(circular);
      });
      assert.ok(html);
      assert.ok(html.includes('Circular Item'));
    });

    test('neutralizes script tags and XSS attempts in payload data and title', () => {
      const malicious = {
        category: 'Action',
        title: '<script>alert("xss")</script>',
        variableName: '"><img src=x onerror=alert(1)>',
        description: '</script><script>alert("desc")</script>',
        data: {
          key: '</script><script>alert("json")</script>'
        }
      };

      const html = getInspectorHtml(malicious);
      // HTML escaping in pre-rendered DOM
      assert.ok(!html.includes('<script>alert("xss")</script>'));
      assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));

      // JSON script closing tag escaping
      assert.ok(!html.includes('</script><script>alert("json")'));
      assert.ok(html.includes('\\u003c/script>'));
    });

    test('handles missing or non-existent extensionPath fallback', () => {
      const html = getInspectorHtml({ title: 'Test' }, null, 'C:/non-existent-directory-xyz');
      assert.ok(html.includes('Test'));
      assert.ok(html.includes('Content-Security-Policy'));
    });
  });

  suite('showCloudInspector message handling negative cases', () => {
    test('handles null or undefined messages without error', async () => {
      let msgHandler = null;
      const mockVscode = createCloudMockVscode({
        window: {
          createWebviewPanel: () => ({
            webview: {
              html: '',
              onDidReceiveMessage: (fn) => { msgHandler = fn; }
            },
            onDidDispose: () => {},
            reveal: () => {}
          })
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await showCloudInspector({ data: { variableName: 'test_fn' } }, {}, mockVscode);
      assert.ok(msgHandler);

      // Should not throw
      await msgHandler(null);
      await msgHandler(undefined);
      await msgHandler({});
      await msgHandler({ command: 'unknown_command_xyz' });
    });

    test('handles copyText with empty or null text without calling clipboard', async () => {
      let msgHandler = null;
      let clipboardCalled = false;

      const mockVscode = createCloudMockVscode({
        window: {
          createWebviewPanel: () => ({
            webview: {
              html: '',
              onDidReceiveMessage: (fn) => { msgHandler = fn; }
            },
            onDidDispose: () => {},
            reveal: () => {}
          })
        },
        env: {
          clipboard: {
            writeText: async () => { clipboardCalled = true; }
          }
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await showCloudInspector({ data: { variableName: 'test_fn' } }, {}, mockVscode);
      await msgHandler({ command: 'copyText', text: null });
      await msgHandler({ command: 'copyText', text: '' });
      await msgHandler({ command: 'copyText' });

      assert.strictEqual(clipboardCalled, false);
    });

    test('handles insertAtCursor when activeTextEditor is missing by falling back to clipboard', async () => {
      let msgHandler = null;
      let writtenClipboard = null;
      let infoMsg = null;

      const mockVscode = createCloudMockVscode({
        window: {
          activeTextEditor: undefined,
          createWebviewPanel: () => ({
            webview: {
              html: '',
              onDidReceiveMessage: (fn) => { msgHandler = fn; }
            },
            onDidDispose: () => {},
            reveal: () => {}
          }),
          showInformationMessage: (msg) => { infoMsg = msg; }
        },
        env: {
          clipboard: {
            writeText: async (t) => { writtenClipboard = t; }
          }
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await showCloudInspector({ data: { variableName: 'test_fn' } }, {}, mockVscode);
      await msgHandler({ command: 'insertAtCursor', text: 'myVar_t' });

      assert.strictEqual(writtenClipboard, 'myVar_t');
      assert.ok(infoMsg && infoMsg.includes('myVar_t'));
    });

    test('handles openBmlScript gracefully when no callback or matching category exists', async () => {
      let msgHandler = null;

      const mockVscode = createCloudMockVscode({
        window: {
          createWebviewPanel: () => ({
            webview: {
              html: '',
              onDidReceiveMessage: (fn) => { msgHandler = fn; }
            },
            onDidDispose: () => {},
            reveal: () => {}
          })
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await showCloudInspector({ category: 'Part', data: { partNumber: 'P123' } }, {}, mockVscode);
      // Calling openBmlScript on non-BML category should not throw
      assert.doesNotThrow(async () => {
        await msgHandler({ command: 'openBmlScript' });
      });
    });
  });

  suite('inspectItemAccordingToPreference negative & fallback cases', () => {
    test('falls back to inspector when preference is invalid string', async () => {
      let panelCreated = false;

      const mockVscode = createCloudMockVscode({
        workspace: {
          getConfiguration: () => ({
            get: () => 'invalid_unknown_mode'
          })
        },
        window: {
          createWebviewPanel: () => {
            panelCreated = true;
            return {
              webview: { html: '', onDidReceiveMessage: () => {} },
              onDidDispose: () => {},
              reveal: () => {}
            };
          }
        },
        Uri: { file: (p) => ({ fsPath: p }) }
      });

      await inspectItemAccordingToPreference({ data: { name: 'test' } }, {}, mockVscode);
      assert.strictEqual(panelCreated, true);
    });

    test('falls back to virtual document when createWebviewPanel is not supported', async () => {
      let openedUri = null;

      const mockVscode = createCloudMockVscode({
        workspace: {
          getConfiguration: () => ({ get: () => 'inspector' }),
          openTextDocument: async (uri) => {
            openedUri = uri;
            return { uri };
          },
          registerTextDocumentContentProvider: () => ({ dispose: () => {} })
        },
        window: {
          // createWebviewPanel is undefined
          createWebviewPanel: undefined,
          showTextDocument: async () => {}
        },
        Uri: {
          from: (c) => ({ scheme: c.scheme, path: c.path, toString: () => `${c.scheme}://${c.path}` }),
          file: (p) => ({ fsPath: p })
        }
      });

      await inspectItemAccordingToPreference({ data: { name: 'fallbackItem' } }, {}, mockVscode);
      assert.ok(openedUri);
      assert.strictEqual(openedUri.scheme, 'cpq-cloud');
    });
  });

  suite('Non-extensible VS Code object safety (Bug A regression)', () => {
    test('openVirtualJsonDocument safely handles frozen Uri and frozen TextDocument', async () => {
      const mockVscode = createCloudMockVscode();

      // Ensure openVirtualJsonDocument executes without throwing "Cannot add property content, object is not extensible"
      let doc = null;
      await assert.doesNotReject(async () => {
        doc = await openVirtualJsonDocument('actions', 'testAction', { sample: 123 }, mockVscode);
      });

      assert.ok(doc);
      assert.strictEqual(doc.language, 'json');
      assert.ok(doc.getText().includes('123'));
    });

    test('viewRawJsonCommand works without error on frozen VS Code objects', async () => {
      const mockVscode = createCloudMockVscode();

      await assert.doesNotReject(async () => {
        await viewRawJsonCommand({
          data: {
            variableName: 'controlAttr',
            name: 'Control Attribute',
            dataType: 'Text'
          }
        }, mockVscode);
      });

      const opened = mockVscode.getOpenedDoc();
      assert.ok(opened);
      assert.strictEqual(opened.language, 'json');
      assert.ok(opened.content.includes('controlAttr'));
      assert.ok(opened.content.includes('Control Attribute'));
    });
  });

  suite('Strict Webview Uri & Path Resolution (Bug B regression)', () => {
    test('getInspectorHtml handles strict asWebviewUri requiring .path property', () => {
      const extensionRoot = path.resolve(__dirname, '..', '..');
      const strictWebview = {
        cspSource: 'vscode-webview:',
        asWebviewUri: (resource) => {
          if (!resource || typeof resource.path !== 'string') {
            throw new TypeError("Cannot read properties of undefined (reading 'replace')");
          }
          return `vscode-webview-resource://${resource.path.replace(/^\//, '')}`;
        }
      };

      const mockVscode = createCloudMockVscode();
      let html = null;
      assert.doesNotThrow(() => {
        html = getInspectorHtml(
          {
            title: 'emailProposal_t',
            category: 'Action',
            variableName: 'emailProposal_t',
            data: { commerceProcess: 'oraclecpqo', commerceDocument: 'transaction' }
          },
          strictWebview,
          extensionRoot,
          mockVscode
        );
      });

      assert.ok(html);
      assert.ok(html.includes('emailProposal_t'));
      assert.ok(html.includes('vscode-webview-resource://'));
      assert.ok(html.includes('Content-Security-Policy'));
    });
  });

  suite('Preference routing between Inspector and Virtual Document', () => {
    test('routes to inspector webview panel when openMetadataAs is inspector', async () => {
      const mockVscode = createCloudMockVscode({
        openMetadataAs: 'inspector'
      });

      await inspectItemAccordingToPreference(
        { data: { variableName: 'prefTest', name: 'Preference Test' } },
        {},
        mockVscode
      );

      const panel = mockVscode.getLastWebviewPanel();
      assert.ok(panel);
      assert.strictEqual(panel.viewType, 'cpqBmlWebPanel');
      assert.ok(panel.title.includes('Preference Test'));
    });

    test('routes to virtual document when openMetadataAs is virtualDocument', async () => {
      const mockVscode = createCloudMockVscode({
        openMetadataAs: 'virtualDocument'
      });

      await inspectItemAccordingToPreference(
        { data: { variableName: 'prefDocTest', name: 'Virtual Doc Test' } },
        {},
        mockVscode
      );

      const opened = mockVscode.getOpenedDoc();
      assert.ok(opened);
      assert.strictEqual(opened.language, 'json');
      assert.ok(opened.content.includes('prefDocTest'));
    });

    test('handles disposed webview panel seamlessly without throwing "Webview is disposed."', async () => {
      const mockVscode = createCloudMockVscode({
        openMetadataAs: 'inspector'
      });

      // 1. Initial inspection opens panel
      await inspectPropertiesCommand({
        part: { partNumber: 'SPGM87410-KA4', description: 'Initial Part' }
      }, mockVscode, {});

      const firstPanel = mockVscode.getLastWebviewPanel();
      assert.ok(firstPanel);

      // 2. Panel is closed or disposed by user
      firstPanel.dispose();

      // 3. User clicks on "Hardware" part item
      let secondPanel = null;
      await assert.doesNotReject(async () => {
        await inspectPropertiesCommand({
          part: { partNumber: 'Hardware', description: 'Hardware Part' }
        }, mockVscode, {});
        secondPanel = mockVscode.getLastWebviewPanel();
      });

      assert.ok(secondPanel);
      assert.notStrictEqual(secondPanel, firstPanel);
      assert.ok(secondPanel.title.includes('Hardware'));
    });
  });

  suite('Packaging & Webview Asset Distribution Verification', () => {
    test('all web-panel bundle assets exist on disk', () => {
      const root = path.resolve(__dirname, '..', '..');
      const webviewDir = path.join(root, 'app', 'lang', 'web-panel');
      const htmlPath = path.join(webviewDir, 'index.html');
      const bundlePath = path.join(root, 'dist', 'web-panel', 'main.js');
      const cssPath = path.join(webviewDir, 'css', 'inspector.css');

      assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
      assert.ok(fs.existsSync(bundlePath), 'dist/web-panel/main.js must exist');
      assert.ok(fs.existsSync(cssPath), 'css/inspector.css must exist');

      const bundleStats = fs.statSync(bundlePath);
      assert.ok(bundleStats.size > 1000, 'dist/web-panel/main.js bundle must not be empty');
    });

    test('.vscodeignore correctly includes inspector-web-view distribution files', () => {
      const root = path.resolve(__dirname, '..', '..');
      const ignorePath = path.join(root, '.vscodeignore');
      assert.ok(fs.existsSync(ignorePath), '.vscodeignore must exist');
      const content = fs.readFileSync(ignorePath, 'utf8');

      assert.ok(content.includes('!dist/web-panel/**'));
      assert.ok(content.includes('!app/lang/web-panel/css/**'));
      assert.ok(content.includes('!app/lang/web-panel/index.html'));
    });
  });
});
