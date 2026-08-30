const assert = require('assert');
const { extractParamName, shouldSuppressHint, resolveParamNames, isInsideCommentOrString, inferVariableType } = require('../../../app/lang/intellisense/inlayHints');
const { collectLocalVariables } = require('../../../app/lang/intellisense/bmqlVariableCompletions');

suite('Inlay Hints & BMQL Variable Completions Test Suite', () => {
    test('extracts parameter names cleanly from BML signature labels', () => {
        assert.strictEqual(extractParamName('String url'), 'url');
        assert.strictEqual(extractParamName('Dictionary headers'), 'headers');
        assert.strictEqual(extractParamName('[Boolean enableLoopback]'), 'enableLoopback');
        assert.strictEqual(extractParamName('query'), 'query');
    });

    test('resolves curated, idiomatic BML parameter names', () => {
        // replace: parameter names from JSON
        const replaceParams = resolveParamNames('replace', 3, {});
        assert.deepStrictEqual(replaceParams, ['str', 'old', 'new', 'n']);

        // Math functions: x, y
        assert.deepStrictEqual(resolveParamNames('fmod', 2, {}), ['x', 'y']);
        assert.deepStrictEqual(resolveParamNames('pow', 2, {}), ['x', 'y']);
        assert.deepStrictEqual(resolveParamNames('hypot', 2, {}), ['x', 'y']);

        // Array functions
        assert.deepStrictEqual(resolveParamNames('append', 2, {}), ['arrayIdentifier', 'appendValue']);
        assert.deepStrictEqual(resolveParamNames('findinarray', 2, {}), ['arrayIdentifier', 'elementToFind']);

        // JSON & Dict
        assert.deepStrictEqual(resolveParamNames('put', 3, {}), ['dictionaryIdentifier', 'key', 'value']);
        assert.deepStrictEqual(resolveParamNames('get', 2, {}), ['dictionaryIdentifier', 'key']);
        assert.deepStrictEqual(resolveParamNames('containskey', 2, {}), ['dictionaryIdentifier', 'key']);
        assert.deepStrictEqual(resolveParamNames('jsonarrayget', 2, {}), ['jsonArrayIdentifier', 'index', 'valueType']);
        assert.deepStrictEqual(resolveParamNames('getfloat', 2, {}), ['record', 'fieldName']);
    });

    test('dynamically handles variadic BML functions (sbappend, stringbuilder, gettabledata)', () => {
        // sbappend with 2 args (sb, val)
        assert.deepStrictEqual(resolveParamNames('sbappend', 2, {}), ['stringBuilder', 'value']);

        // sbappend with 4 args (sb, val1, val2, val3)
        assert.deepStrictEqual(resolveParamNames('sbappend', 4, {}), ['stringBuilder', 'value1', 'value2', 'value3']);

        // stringbuilder with 3 args (val1, val2, val3)
        assert.deepStrictEqual(resolveParamNames('stringbuilder', 3, {}), ['value1', 'value2', 'value3']);

        // gettabledata with table, cols, and where clauses
        assert.deepStrictEqual(resolveParamNames('gettabledata', 4, {}), ['tableName', 'selectColumns', 'whereColumn', 'whereValue']);
        assert.deepStrictEqual(resolveParamNames('gettabledata', 6, {}), ['tableName', 'selectColumns', 'whereColumn1', 'whereValue1', 'whereColumn2', 'whereValue2']);
    });

    test('dynamically extracts parameter names from fullSignature or syntax when not curated', () => {
        const mockApiData = {
            'custom_api_call': {
                syntax: 'custom_api_call(stringVariableName, [integerIndex])'
            },
            'customfn': {
                fullSignature: 'String customfn(String customerId, Integer orderCount)'
            }
        };

        assert.deepStrictEqual(
            resolveParamNames('custom_api_call', 2, mockApiData),
            ['stringVariableName', 'integerIndex']
        );
        assert.deepStrictEqual(
            resolveParamNames('customfn', 2, mockApiData),
            ['customerId', 'orderCount']
        );
    });

    test('resolves CPQJS client-side function parameter signatures accurately', () => {
        // CPQJS Action and Attribute existence
        assert.deepStrictEqual(resolveParamNames('cpqjs.actionexists', 1, {}), ['stringVariableName']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.attributeexists', 1, {}), ['stringVariableName']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.tableexists', 1, {}), ['stringVariableName']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.gettableinfo', 1, {}), ['stringVariableName']);

        // CPQJS Event Listeners (action, attribute, table)
        assert.deepStrictEqual(resolveParamNames('cpqjs.onactioncomplete', 2, {}), ['stringVariableName', 'functionHandler']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.onattributechange', 2, {}), ['stringVariableName', 'functionHandler']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.ontableloaded', 2, {}), ['stringVariableName', 'functionHandler']);
        assert.deepStrictEqual(resolveParamNames('cpqjsready', 1, {}), ['function']);

        // CPQJS Overloaded methods (1-arg vs 2-arg vs 3-arg)
        assert.deepStrictEqual(resolveParamNames('cpqjs.getattributeval', 1, {}), ['attributeVarName']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.getattributeval', 2, {}), ['attributeVarName', 'index']);

        assert.deepStrictEqual(resolveParamNames('cpqjs.openpopup', 1, {}), ['content']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.openpopup', 2, {}), ['content', 'title']);

        assert.deepStrictEqual(resolveParamNames('cpqjs.setattributeval', 2, {}), ['attributeVarName', 'value']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.setattributeval', 3, {}), ['attributeVarName', 'value', 'index']);

        assert.deepStrictEqual(resolveParamNames('cpqjs.setattributestate', 2, {}), ['attributeVarName', 'state']);
        assert.deepStrictEqual(resolveParamNames('cpqjs.setattributestate', 3, {}), ['attributeVarName', 'state', 'index']);
    });

    test('resolves REST HTTP functions and complex network APIs', () => {
        const urlParams = resolveParamNames('urldata', 7, {});
        assert.deepStrictEqual(urlParams, ['url', 'httpMethod', 'headers', 'parameters', 'timeout', 'formData', 'enableLoopback']);

        assert.deepStrictEqual(resolveParamNames('urldatabyget', 6, {}), ['url', 'url_param', 'default_value', 'timeout', 'headers', 'enableLoopback']);
        assert.deepStrictEqual(resolveParamNames('urldatabypost', 7, {}), ['url', 'url_param', 'default_value', 'headers', 'returnErrorResponse', 'timeout', 'enableLoopback']);
    });

    test('resolves JSON and XML data manipulation functions', () => {
        assert.deepStrictEqual(resolveParamNames('jsonput', 3, {}), ['jsonIdentifier', 'key', 'value']);
        assert.deepStrictEqual(resolveParamNames('jsonget', 4, {}), ['jsonIdentifier', 'key', 'valueType', 'defaultValue']);
        assert.deepStrictEqual(resolveParamNames('jsonremove', 2, {}), ['jsonIdentifier', 'key']);
        assert.deepStrictEqual(resolveParamNames('jsonpathgetsingle', 4, {}), ['jsonIdentifier', 'jsonPath', 'valueType', 'defaultValue']);
        assert.deepStrictEqual(resolveParamNames('jsonpathset', 3, {}), ['jsonIdentifier', 'jsonPath', 'value']);
        assert.deepStrictEqual(resolveParamNames('readxmlsingle', 3, {}), ['xmlPayload', 'xpaths', 'defaultErrorMessage']);
        assert.deepStrictEqual(resolveParamNames('transformxml', 3, {}), ['xml', 'xslFileLocation', 'defaultErrorMessage']);
    });

    test('resolves Date & Time functions accurately', () => {
        assert.deepStrictEqual(resolveParamNames('datetostr', 3, {}), ['date', 'format', 'timeZone']);
        assert.deepStrictEqual(resolveParamNames('strtojavadate', 3, {}), ['dateStr', 'format', 'timeZone']);
        assert.deepStrictEqual(resolveParamNames('getdiffindays', 2, {}), ['date1', 'date2']);
        assert.deepStrictEqual(resolveParamNames('addmonths', 2, {}), ['date', 'num_of_months']);
        assert.deepStrictEqual(resolveParamNames('adddays', 2, {}), ['date', 'num_of_days']);
    });

    test('handles single-parameter functions without truncation', () => {
        assert.deepStrictEqual(resolveParamNames('len', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('lower', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('upper', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('trim', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('html', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('encodebase64', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('decodebase64', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('atof', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('atoi', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('isnumber', 1, {}), ['str']);
        assert.deepStrictEqual(resolveParamNames('dict', 1, {}), ['dictType']);
        assert.deepStrictEqual(resolveParamNames('json', 1, {}), ['jsonFormatStr']);
        assert.deepStrictEqual(resolveParamNames('sizeofarray', 1, {}), ['arrayIdentifier']);
        assert.deepStrictEqual(resolveParamNames('keys', 1, {}), ['dictionaryIdentifier']);
        assert.deepStrictEqual(resolveParamNames('values', 1, {}), ['dictionaryIdentifier']);
    });

    test('suppresses inlay hint when argument matches parameter name', () => {
        // Suppress matching names
        assert.strictEqual(shouldSuppressHint('record', 'record', true), true);
        assert.strictEqual(shouldSuppressHint('fieldName', '"fieldName"', true), true);
        assert.strictEqual(shouldSuppressHint('url', 'url', true), true);
        assert.strictEqual(shouldSuppressHint('headers', '_headers', true), true);

        // Do not suppress differing names
        assert.strictEqual(shouldSuppressHint('array', 'categories50Array', true), false);
        assert.strictEqual(shouldSuppressHint('fieldName', '"price"', true), false);
        assert.strictEqual(shouldSuppressHint('record', 'rRow_50', true), false);

        // Do not suppress if setting is false
        assert.strictEqual(shouldSuppressHint('record', 'record', false), false);
    });

    test('ignores function calls inside comments and string literals', () => {
        const text1 = '// resReplace = replace(sampleStr, "BML", "EXT");';
        const callPos1 = text1.indexOf('replace');
        assert.strictEqual(isInsideCommentOrString(text1, callPos1), true, 'Single line comment should be detected');

        const text2 = '/* \n resSplit = split(str, " "); \n */';
        const callPos2 = text2.indexOf('split');
        assert.strictEqual(isInsideCommentOrString(text2, callPos2), true, 'Block comment should be detected');

        const text3 = 'codeStr = "replace(a, b)";';
        const callPos3 = text3.indexOf('replace');
        assert.strictEqual(isInsideCommentOrString(text3, callPos3), true, 'String literal should be detected');

        const text4 = 'resReplace = replace(sampleStr, "BML", "EXT");';
        const callPos4 = text4.indexOf('replace');
        assert.strictEqual(isInsideCommentOrString(text4, callPos4), false, 'Normal active code should not be detected as comment');
    });

    test('infers variable types accurately from RHS expressions', () => {
        assert.strictEqual(inferVariableType('bmql("SELECT price FROM Parts")'), 'RecordSet');
        assert.strictEqual(inferVariableType('dict("string")'), 'Dictionary');
        assert.strictEqual(inferVariableType('json()'), 'Json');
        assert.strictEqual(inferVariableType('jsonarray()'), 'JsonArray');
        assert.strictEqual(inferVariableType('stringbuilder()'), 'StringBuilder');
        assert.strictEqual(inferVariableType('recordset()'), 'RecordSet');
        assert.strictEqual(inferVariableType('bytearray("data", "UTF-8")'), 'ByteArray');
        assert.strictEqual(inferVariableType('string[]'), 'String[]');
        assert.strictEqual(inferVariableType('integer[]'), 'Integer[]');
        assert.strictEqual(inferVariableType('boolean[]'), 'Boolean[]');
        assert.strictEqual(inferVariableType('date[]'), 'Date[]');
        assert.strictEqual(inferVariableType('float[]'), 'Float[]');
        assert.strictEqual(inferVariableType('string[][]'), 'String[][]');
        assert.strictEqual(inferVariableType('integer[][]'), 'Integer[][]');
        assert.strictEqual(inferVariableType('float[][]'), 'Float[][]');
        assert.strictEqual(inferVariableType('boolean[][]'), 'Boolean[][]');
        assert.strictEqual(inferVariableType('date[][]'), 'Date[][]');
        assert.strictEqual(inferVariableType('"test value"'), 'String');
        assert.strictEqual(inferVariableType('100'), 'Integer');
        assert.strictEqual(inferVariableType('10.5'), 'Float');
        assert.strictEqual(inferVariableType('true'), 'Boolean');
        assert.strictEqual(inferVariableType('false'), 'Boolean');
        assert.strictEqual(inferVariableType('replace(str, "a", "b")'), 'String');
        assert.strictEqual(inferVariableType('split(str, ",")'), 'String[]');
        assert.strictEqual(inferVariableType('getfloat(rRow, "price")'), 'Float');
        assert.strictEqual(inferVariableType('getint(rRow, "qty")'), 'Integer');
        assert.strictEqual(inferVariableType('getboolean(rRow, "active")'), 'Boolean');
        assert.strictEqual(inferVariableType('atoi("42")'), 'Integer');
        assert.strictEqual(inferVariableType('isnumber("100")'), 'Boolean');
        assert.strictEqual(inferVariableType('getdate()'), 'Date');
        assert.strictEqual(inferVariableType('adddays(dt, 5)'), 'Date');
        assert.strictEqual(inferVariableType('datetostr(dt)'), 'String');
        assert.strictEqual(inferVariableType('saveconfigbom(jsonObj, dictObj)'), 'Integer');
        assert.strictEqual(inferVariableType('savebom(123, jsonObj)'), 'Integer');
        assert.strictEqual(inferVariableType('configureabo(123, "key")'), 'Integer');
        assert.strictEqual(inferVariableType('getconfigurationbom(123)'), 'Json');
        assert.strictEqual(inferVariableType('jsoncopy(jsonObj)'), 'Json');
        assert.strictEqual(inferVariableType('jsonarraycopy(jsonArr)'), 'JsonArray');
    });

    test('dynamically retrieves return types map from JSON catalogs', () => {
        const { getReturnTypesMap } = require('../../../app/lang/intellisense/inlayHints/typeInferrer');
        const returnTypes = getReturnTypesMap();
        assert.ok(returnTypes, 'Return types map should not be null');
        assert.strictEqual(returnTypes['saveconfigbom'], 'Integer');
        assert.strictEqual(returnTypes['savebom'], 'Integer');
        assert.strictEqual(returnTypes['configureabo'], 'Integer');
        assert.strictEqual(returnTypes['getdate'], 'Date');
        assert.strictEqual(returnTypes['datetostr'], 'String');
        assert.strictEqual(returnTypes['split'], 'String[]');
    });

    test('collects local variables in scope and ignores out-of-scope variables', () => {
        const mockLines = [
            'outerVar = "root";',                 // Line 0 (depth 0, in scope)
            'if (true) {',                        // Line 1 (depth 1)
            '    innerVar = "inside_if";',        // Line 2 (depth 1, in scope inside block)
            '}',                                  // Line 3 (block closed)
            'for item in items {',               // Line 4 (depth 1)
            '    loopVar = item;',               // Line 5 (depth 1, in scope inside loop)
            '}'                                   // Line 6 (loop closed)
        ];

        const makeDoc = (lines) => ({
            lineCount: lines.length,
            lineAt(idx) { return { text: lines[idx] }; }
        });

        // 1. Cursor on Line 2 (inside if block): outerVar AND innerVar are in scope
        const varsInsideIf = collectLocalVariables(makeDoc(mockLines), { line: 2, character: 25 });
        const namesInsideIf = varsInsideIf.map(v => v.name);
        assert.ok(namesInsideIf.includes('outerVar'), 'outerVar should be in scope inside if block');
        assert.ok(namesInsideIf.includes('innerVar'), 'innerVar should be in scope inside if block');

        // 2. Cursor on Line 3 (after if block closed): outerVar IS in scope, innerVar IS NOT in scope
        const varsAfterIf = collectLocalVariables(makeDoc(mockLines), { line: 3, character: 1 });
        const namesAfterIf = varsAfterIf.map(v => v.name);
        assert.ok(namesAfterIf.includes('outerVar'), 'outerVar should be in scope after if block');
        assert.strictEqual(namesAfterIf.includes('innerVar'), false, 'innerVar must NOT be in scope after if block ends');

        // 3. Cursor on Line 5 (inside for loop): outerVar, item, loopVar are in scope, innerVar is NOT
        const varsInsideLoop = collectLocalVariables(makeDoc(mockLines), { line: 5, character: 18 });
        const namesInsideLoop = varsInsideLoop.map(v => v.name);
        assert.ok(namesInsideLoop.includes('outerVar'));
        assert.ok(namesInsideLoop.includes('item'));
        assert.ok(namesInsideLoop.includes('loopVar'));
        assert.strictEqual(namesInsideLoop.includes('innerVar'), false);
    });

    test('excludes LHS variable currently being defined on active line from RHS completions (scope2 = sc)', () => {
        const mockLines = [
            'rPrice_28 = getfloat(rRow_28, "price");', // Line 0
            'scope1 = rPrice_28;',                     // Line 1
            '            scope2 = sc'                   // Line 2 (typing RHS for scope2 at pos 23)
        ];

        const doc = {
            lineCount: mockLines.length,
            lineAt(idx) { return { text: mockLines[idx] }; }
        };

        // Cursor at pos 23 (right after '            scope2 = sc')
        const vars = collectLocalVariables(doc, { line: 2, character: 23 });
        const names = vars.map(v => v.name);

        assert.ok(names.includes('rPrice_28'), 'rPrice_28 should be suggested on RHS');
        assert.ok(names.includes('scope1'), 'scope1 should be suggested on RHS');
        assert.strictEqual(names.includes('scope2'), false, 'scope2 MUST NOT suggest itself on RHS of scope2 = sc!');
    });
});
