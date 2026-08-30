const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { formatAsJsDoc } = require('../../app/lang/intellisense/docFormatting');

// docFormatting.js used to read+parse markdown from a knowledge base at hover
// time (a separate "offline docs" webview, plus runtime extraction of the
// relevant "## <name>" section). That's gone now: the extraction and
// hover-safe sanitization (converting parameter tables to bullets, turning
// ":::admonition:::" containers into blockquotes, replacing images with an
// alt-text placeholder - images aren't shipped or rendered at all) happens
// once in scripts/bml_intellisense/knowledge_docs.py at generation time, and
// is embedded directly as bml-functions-api-usage.json's "docs" field.
// formatAsJsDoc() just appends that pre-built string - no file reads, no
// markdown parsing, no separate webview tab needed at all.
const REPO_ROOT = path.join(__dirname, '..', '..');
const FUNCTIONS_JSON_PATH = path.join(REPO_ROOT, 'app', 'lang', 'intellisense', 'bml-functions-api-usage.json');

suite('docFormatting - info.docs rendering', () => {
    test('appends info.docs under a clear "From the Docs" heading when present', () => {
        const info = { category: 'function', name: 'atoi', syntax: 'atoi(str)', functionCategory: 'string', docs: 'Some pre-generated excerpt.' };
        const md = formatAsJsDoc(info);
        assert.match(md.value, /\*\*📚 From the Docs\*\*\n\nSome pre-generated excerpt\./);
    });

    test('omits the section entirely when info.docs is absent', () => {
        const info = { category: 'function', name: 'bmql', syntax: 'bmql(sqlQuery)', functionCategory: 'direct_db_access' };
        const md = formatAsJsDoc(info);
        assert.doesNotMatch(md.value, /From the Docs/);
    });

    test('does not break the existing JSON-driven notes/examples rendering', () => {
        // Purely additive: info.docs is appended after the existing
        // notes/examples content, not a replacement for it.
        const info = {
            category: 'function',
            name: 'decodebase64',
            syntax: 'decodebase64(str)',
            functionCategory: 'string',
            notes: 'Takes an encoded Base64 string and returns it as a plain text string',
            examples: ['1. decodebase64("YWJj") returns "abc".'],
            docs: 'Full parameter table and return type would go here.',
        };
        const md = formatAsJsDoc(info);

        assert.match(md.value, /\*\*Usage Notes?:\*\*/);
        assert.match(md.value, /decodebase64\("YWJj"\)/);
        assert.match(md.value, /returns "abc"/);
        assert.match(md.value, /Full parameter table and return type would go here\./);
    });
});

suite('docFormatting - real generated bml-functions-api-usage.json integration', () => {
    // Validates the full pipeline end to end: Python generation
    // (knowledge_docs.py's extraction/sanitization) -> the JSON it writes ->
    // formatAsJsDoc() rendering that JSON's "docs" field.
    let functionsData;
    suiteSetup(() => {
        functionsData = JSON.parse(fs.readFileSync(FUNCTIONS_JSON_PATH, 'utf8'));
    });

    test('atoi has a docs excerpt with real prose, a bulleted parameter table, and no raw markdown table/images/admonition syntax', () => {
        const entry = functionsData.atoi;
        assert.ok(entry, 'expected an "atoi" entry in bml-functions-api-usage.json');
        assert.ok(entry.docs, 'expected atoi to have a docs excerpt (string.md documents it)');

        const md = formatAsJsDoc({ category: 'function', name: 'atoi', syntax: entry.syntax, functionCategory: entry.functionCategory, docs: entry.docs });

        assert.match(md.value, /converts text that represents a number into an integer/i);
        assert.match(md.value, /\*\*Parameter:\*\* str · \*\*Data Type:\*\* String/);
        assert.doesNotMatch(md.value, /^\s*\|.*\|\s*$/m, 'no raw markdown table row should remain');
        assert.doesNotMatch(md.value, /!\[/, 'images should have been stripped to alt-text placeholders');
        assert.doesNotMatch(md.value, /:::/, 'admonition container syntax should have been converted to blockquotes');
    });

    test('functions with no exact-matching knowledge-base heading simply have no docs field', () => {
        // direct-db-access/directDbAccess.md documents "recordset" under
        // "## recordset()" and "## recordset and SQL Queries" - neither is an
        // exact "## recordset" heading match, so this one correctly has no
        // excerpt rather than a wrong/partial one.
        const entry = functionsData.recordset;
        assert.ok(entry, 'expected a "recordset" entry in bml-functions-api-usage.json');
        assert.strictEqual(entry.docs, null);
    });

    test('getfloat produces a clean hover tooltip without duplication or placeholder parameter noise', () => {
        const entry = functionsData.getfloat;
        assert.ok(entry, 'expected a "getfloat" entry in bml-functions-api-usage.json');

        const md = formatAsJsDoc(Object.assign({ category: 'function' }, entry));
        
        // 1. Signature and category
        assert.match(md.value, /Float getfloat\(Record record, String fieldName\)/);
        assert.match(md.value, /\*database function\*/);
        
        // 2. Parameters clean table without placeholder text
        assert.match(md.value, /### Parameters/);
        assert.match(md.value, /\|\s*`record`\s*\|\s*`Record`\s*\|\s*Yes\s*\|\s*-\s*\|/);
        assert.match(md.value, /\|\s*`fieldName`\s*\|\s*`String`\s*\|\s*Yes\s*\|\s*-\s*\|/);
        assert.doesNotMatch(md.value, /Input parameter/i);
        
        // 3. Exactly one Example block with bml code
        assert.match(md.value, /### Example/);
        assert.match(md.value, /val = getfloat\(row, "intcol"\);/);
        
        // 4. No duplicate "From the Docs" section since docs is identical to notes
        assert.doesNotMatch(md.value, /From the Docs/);
    });

    test('parameter custom descriptions are preserved while placeholder descriptions are omitted', () => {
        const info = {
            category: 'function',
            name: 'customFunc',
            syntax: 'customFunc(String name, Integer age)',
            parameters: [
                { name: 'name', type: 'String', description: 'Input parameter `name` of type `String`.' },
                { name: 'age', type: 'Integer', description: 'The customer age in years.' }
            ]
        };
        const md = formatAsJsDoc(info);
        assert.match(md.value, /### Parameters/);
        assert.match(md.value, /\|\s*`name`\s*\|\s*`String`\s*\|\s*Yes\s*\|\s*-\s*\|/);
        assert.match(md.value, /\|\s*`age`\s*\|\s*`Integer`\s*\|\s*Yes\s*\|\s*The customer age in years\.\s*\|/);
    });

    test('deduplicates identical code examples when provided with and without titles', () => {
        const info = {
            category: 'function',
            name: 'testFunc',
            syntax: 'testFunc()',
            examples: [
                '1. Query and iterate records\n\nExample:\n\nrows = bmql("select id from table");\nfor r in rows { print r; }',
                'rows = bmql("select id from table");\nfor r in rows { print r; }'
            ]
        };
        const md = formatAsJsDoc(info);
        // Only 1 example should be rendered, with title and code block
        assert.match(md.value, /### Example/);
        assert.match(md.value, /Query and iterate records:/);
        assert.match(md.value, /rows = bmql\("select id from table"\);/);
        // Ensure the code block is not repeated
        const occurrences = (md.value.match(/select id from table/g) || []).length;
        assert.strictEqual(occurrences, 1, 'code block should only appear once');
    });

    test('renders Oracle CPQ Best Practice advisory blockquote for core functions', () => {
        const bmqlMd = formatAsJsDoc({ category: 'function', name: 'bmql', syntax: 'bmql(query)' });
        assert.match(bmqlMd.value, /> 💡 \*\*Performance Best Practice\*\*/);
        assert.match(bmqlMd.value, /> Avoid executing BMQL inside loops/);
        assert.match(bmqlMd.value, /Performance Best Practices/);

        const printMd = formatAsJsDoc({ category: 'function', name: 'print', syntax: 'print(val)' });
        assert.match(printMd.value, /> 💡 \*\*Production Advisory\*\*/);
        assert.match(printMd.value, /> Remove or comment out `print` statements/);

        const atoiMd = formatAsJsDoc({ category: 'function', name: 'atoi', syntax: 'atoi(str)' });
        assert.match(atoiMd.value, /> 💡 \*\*Safe Parsing Best Practice\*\*/);
        assert.match(atoiMd.value, /> Validate input strings with `isnumber\(\)`/);
    });

    test('loads BEST_PRACTICE_ADVISORIES and KEYWORD_HOVERS from JSON files', () => {
        const { KEYWORD_HOVERS, BEST_PRACTICE_ADVISORIES } = require('../../app/lang/intellisense/docFormatting');
        assert.ok(KEYWORD_HOVERS.if, 'expected keyword hover for if');
        assert.ok(KEYWORD_HOVERS.bmql, 'expected keyword hover for bmql');
        assert.ok(BEST_PRACTICE_ADVISORIES.bmql, 'expected best practice advisory for bmql');
        assert.strictEqual(BEST_PRACTICE_ADVISORIES.bmql.title, 'Performance Best Practice');
    });
});
