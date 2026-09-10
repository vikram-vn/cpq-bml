const assert = require('assert');
const vscode = require('vscode');
const { adaptCompletionsForLineContext } = require('@/lang/intellisense/completionContext');

function createMockDocument(lineText) {
    return {
        lineAt(pos) {
            const line = typeof pos === 'number' ? pos : pos.line;
            return {
                text: lineText,
                range: new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lineText.length))
            };
        },
        getWordRangeAtPosition(pos) {
            const text = lineText;
            const char = pos.character;
            let start = char;
            while (start > 0 && /[\w]/.test(text[start - 1])) {
                start--;
            }
            let end = char;
            while (end < text.length && /[\w]/.test(text[end])) {
                end++;
            }
            if (start === end) return undefined;
            return new vscode.Range(new vscode.Position(pos.line, start), new vscode.Position(pos.line, end));
        }
    };
}

suite('IntelliSense Context-Aware Completion Tests', () => {
    test('keeps only method name when typing before existing parentheses (json, "key")', () => {
        // User types 'json' right before existing argument list: json|(json, "key");
        const doc = createMockDocument('json(json, "key");');
        const pos = new vscode.Position(0, 4); // right after 'json', before '('

        const originalItem = new vscode.CompletionItem('jsonget', vscode.CompletionItemKind.Function);
        originalItem.insertText = new vscode.SnippetString('jsonget(${1:jsonIdentifier}, ${2:key}, ${3:valueType}, ${4:defaultValue})');

        const adapted = adaptCompletionsForLineContext([originalItem], doc, pos);
        assert.strictEqual(adapted.length, 1);
        assert.strictEqual(adapted[0].insertText, 'jsonget', 'Should only insert method name without parentheses/placeholders');
    });

    test('handles unclosed quotes/arguments (json, "key) as in user scenario', () => {
        // Line: json|(json, "key);
        const doc = createMockDocument('json(json, "key);');
        const pos = new vscode.Position(0, 4);

        const originalItem = new vscode.CompletionItem('jsonget', vscode.CompletionItemKind.Function);
        originalItem.insertText = new vscode.SnippetString('jsonget(${1:jsonIdentifier}, ${2:key})');

        const adapted = adaptCompletionsForLineContext([originalItem], doc, pos);
        assert.strictEqual(adapted.length, 1);
        assert.strictEqual(adapted[0].insertText, 'jsonget');
    });

    test('consumes whitespace before ( when spaces exist between cursor and parenthesis', () => {
        // Line: json  |(json, "key")
        const doc = createMockDocument('json  (json, "key");');
        const pos = new vscode.Position(0, 4); // cursor right after 'json', before 2 spaces and '('

        const originalItem = new vscode.CompletionItem('jsonget', vscode.CompletionItemKind.Function);
        originalItem.insertText = new vscode.SnippetString('jsonget(${1:jsonIdentifier}, ${2:key})');

        const adapted = adaptCompletionsForLineContext([originalItem], doc, pos);
        assert.strictEqual(adapted.length, 1);
        assert.strictEqual(adapted[0].insertText, 'jsonget');
        assert.ok(adapted[0].range, 'Should set range to consume whitespace before (');
        assert.strictEqual(adapted[0].range.start.character, 0); // start of 'json'
        assert.strictEqual(adapted[0].range.end.character, 6);   // end of spaces, right before '('
    });

    test('preserves full snippet with placeholders when NO parenthesis follows', () => {
        // Line: val = json|
        const doc = createMockDocument('val = json');
        const pos = new vscode.Position(0, 10);

        const originalItem = new vscode.CompletionItem('jsonget', vscode.CompletionItemKind.Function);
        const snippet = new vscode.SnippetString('jsonget(${1:jsonIdentifier}, ${2:key})');
        originalItem.insertText = snippet;

        const adapted = adaptCompletionsForLineContext([originalItem], doc, pos);
        assert.strictEqual(adapted.length, 1);
        assert.strictEqual(adapted[0].insertText, snippet, 'Full snippet should be preserved when no parenthesis follows');
    });

    test('does not mutate non-function items (e.g. variables)', () => {
        // Line: myVar|(json, "key");
        const doc = createMockDocument('myVar(json, "key");');
        const pos = new vscode.Position(0, 5);

        const varItem = new vscode.CompletionItem('myVar', vscode.CompletionItemKind.Variable);
        varItem.insertText = 'myVar';

        const adapted = adaptCompletionsForLineContext([varItem], doc, pos);
        assert.strictEqual(adapted.length, 1);
        assert.strictEqual(adapted[0].insertText, 'myVar');
    });

    test('handles CPQJS and object methods correctly', () => {
        // Line: CPQJS.act|(val);
        const doc = createMockDocument('CPQJS.act(val);');
        const pos = new vscode.Position(0, 9);

        const methodItem = new vscode.CompletionItem('actionExists', vscode.CompletionItemKind.Method);
        methodItem.insertText = new vscode.SnippetString('actionExists(${1:actionName})');

        const adapted = adaptCompletionsForLineContext([methodItem], doc, pos);
        assert.strictEqual(adapted.length, 1);
        assert.strictEqual(adapted[0].insertText, 'actionExists');
    });

    test('universally applies to all BML functions across all categories', () => {
        const testCases = [
            { category: 'String', line: 'spl("a,b", ",");', cursor: 3, func: 'split', fullSnippet: 'split(${1:str}, ${2:delim})' },
            { category: 'Array', line: 'app(items, 1);', cursor: 3, func: 'append', fullSnippet: 'append(${1:arr}, ${2:elem})' },
            { category: 'Date', line: 'add(today, 5);', cursor: 3, func: 'adddays', fullSnippet: 'adddays(${1:date}, ${2:numDays})' },
            { category: 'Math', line: 'fab(-10.5);', cursor: 3, func: 'fabs', fullSnippet: 'fabs(${1:num})' },
            { category: 'DB', line: 'bmq("SELECT name FROM _parts");', cursor: 3, func: 'bmql', fullSnippet: 'bmql(${1:query})' },
            { category: 'Web', line: 'url("https://api.com", "GET");', cursor: 3, func: 'urldata', fullSnippet: 'urldata(${1:url}, ${2:method})' },
            { category: 'StringBuilder', line: 'sba(sb, "text");', cursor: 3, func: 'sbappend', fullSnippet: 'sbappend(${1:sb}, ${2:text})' },
        ];

        for (const tc of testCases) {
            const docWithParen = createMockDocument(tc.line);
            const posWithParen = new vscode.Position(0, tc.cursor);
            const itemWithParen = new vscode.CompletionItem(tc.func, vscode.CompletionItemKind.Function);
            itemWithParen.insertText = new vscode.SnippetString(tc.fullSnippet);

            // 1. With half code present: keeps only method name
            const adaptedWithParen = adaptCompletionsForLineContext([itemWithParen], docWithParen, posWithParen);
            assert.strictEqual(
                adaptedWithParen[0].insertText,
                tc.func,
                `Category ${tc.category} (${tc.func}) should insert only method name when '(' is present`
            );

            // 2. Without half code: keeps full syntax with placeholders
            const docNoParen = createMockDocument(`val = ${tc.func}`);
            const posNoParen = new vscode.Position(0, 6 + tc.func.length);
            const itemNoParen = new vscode.CompletionItem(tc.func, vscode.CompletionItemKind.Function);
            itemNoParen.insertText = new vscode.SnippetString(tc.fullSnippet);

            const adaptedNoParen = adaptCompletionsForLineContext([itemNoParen], docNoParen, posNoParen);
            assert.strictEqual(
                adaptedNoParen[0].insertText.value,
                tc.fullSnippet,
                `Category ${tc.category} (${tc.func}) should insert full syntax when no '(' follows`
            );
        }
    });

    test('handles namespaced/workspace functions (util.math.calc)', () => {
        // User typed: util.math.calc|(10, 20);
        const doc = createMockDocument('util.math.calc(10, 20);');
        const pos = new vscode.Position(0, 14);

        const wsItem = new vscode.CompletionItem('util.math.calculate', vscode.CompletionItemKind.Function);
        wsItem.insertText = new vscode.SnippetString('util.math.calculate(${1:x}, ${2:y})');

        const adapted = adaptCompletionsForLineContext([wsItem], doc, pos);
        assert.strictEqual(adapted.length, 1);
        assert.strictEqual(adapted[0].insertText, 'calculate', 'Should strip prefix when prefix already on line before cursor');
    });
});
