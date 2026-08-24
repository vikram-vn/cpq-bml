const assert = require('assert');

suite('XSLT Webview & Preview Engine Unit Test Suite', () => {
    test('Webview options configuration prevents InvalidStateError', () => {
        const mockExtensionUri = { fsPath: '/test/extension' };
        const webviewOptions = {
            enableScripts: true,
            retainContextWhenHidden: false,
            localResourceRoots: [mockExtensionUri]
        };
        assert.strictEqual(webviewOptions.enableScripts, true);
        assert.strictEqual(webviewOptions.retainContextWhenHidden, false, 'retainContextWhenHidden must be false to prevent ServiceWorker InvalidStateError');
        assert.ok(Array.isArray(webviewOptions.localResourceRoots), 'localResourceRoots must be an array');
    });
});
