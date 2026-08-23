const assert = require('assert');
const { extractParamName } = require('../../app/lang/intellisense/inlayHints');
const { collectLocalVariables } = require('../../app/lang/intellisense/bmqlVariableCompletions');

suite('Inlay Hints & BMQL Variable Completions Test Suite', () => {
    test('extracts parameter names cleanly from BML signature labels', () => {
        assert.strictEqual(extractParamName('String url'), 'url');
        assert.strictEqual(extractParamName('Dictionary headers'), 'headers');
        assert.strictEqual(extractParamName('[Boolean enableLoopback]'), 'enableLoopback');
        assert.strictEqual(extractParamName('query'), 'query');
    });

    test('collects local variables from mock BML code', () => {
        const mockDoc = {
            lineCount: 5,
            lineAt(idx) {
                const lines = [
                    'String customerName = "Acme Corp";',
                    'Integer orderId = 12345;',
                    'rs = bmql("SELECT col FROM table WHERE name = $customerName");',
                    'print customerName;',
                    'return "";'
                ];
                return { text: lines[idx] };
            }
        };

        const vars = collectLocalVariables(mockDoc, { line: 4, character: 0 });
        const names = vars.map(v => v.name);
        assert.ok(names.includes('customerName'));
        assert.ok(names.includes('orderId'));
        assert.ok(names.includes('rs'));
        assert.strictEqual(names.includes('print'), false);
    });
});
