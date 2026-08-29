const assert = require('assert');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const bml_beautify = require('../app/lang/beautify/bml/index');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('BML Beautifier formats standard assignments and code', () => {
		const source = 'test="hi";';
		const expected = 'test = "hi";';
		const result = bml_beautify(source, { indent_char: '\t', indent_size: 1 });
		assert.strictEqual(result, expected);
	});

	// Dynamic file-based tests from test/beautify directory
	const testDir = path.join(__dirname, 'beautify', 'fixtures');
	if (fs.existsSync(testDir)) {
		const files = fs.readdirSync(testDir);
		const inputFiles = files.filter(f => f.endsWith('.bml') && !f.endsWith('.expected.bml'));

		for (const file of inputFiles) {
			const testName = path.basename(file, '.bml');
			test(`BML Beautifier fileBased.test: ${testName}`, () => {
				const inputPath = path.join(testDir, file);
				const expectedPath = path.join(testDir, `${testName}.expected.bml`);
				const optionsPath = path.join(testDir, `${testName}.options.json`);

				const source = fs.readFileSync(inputPath, 'utf8');
				const expected = fs.readFileSync(expectedPath, 'utf8');

				let options = { indent_char: '\t', indent_size: 1 };
				if (fs.existsSync(optionsPath)) {
					options = { ...options, ...JSON.parse(fs.readFileSync(optionsPath, 'utf8')) };
				}

				const result = bml_beautify(source, options);
				assert.strictEqual(result.replace(/\r\n/g, '\n').trim(), expected.replace(/\r\n/g, '\n').trim());
			});
		}

		// Re-running the beautifier on its own output must be a no-op - if it isn't,
		// formatting on save would keep producing diffs.
		for (const file of inputFiles) {
			const testName = path.basename(file, '.bml');
			test(`BML Beautifier is idempotent: ${testName}`, () => {
				const inputPath = path.join(testDir, file);
				const optionsPath = path.join(testDir, `${testName}.options.json`);

				const source = fs.readFileSync(inputPath, 'utf8');
				let options = { indent_char: '\t', indent_size: 1 };
				if (fs.existsSync(optionsPath)) {
					options = { ...options, ...JSON.parse(fs.readFileSync(optionsPath, 'utf8')) };
				}

				const once = bml_beautify(source, options);
				const twice = bml_beautify(once, options);
				assert.strictEqual(twice, once);
			});
		}
	}

	suite('BML Beautifier regression checks', () => {
		const opts = { indent_char: '\t', indent_size: 1 };

		test('does not break a single-line condition just because a string precedes AND/OR/NOT', () => {
			// Legacy js-beautify logic forced a newline after any string token that was
			// followed by a reserved word, so `name != "" and id > 0` got wrapped even
			// though the source had no line break there.
			const result = bml_beautify('if(name != "" and id > 0){\nprint("x");\n}', opts);
			assert.strictEqual(result, 'if (name != "" AND id > 0) {\n\tprint("x");\n}');
		});

		test('does not glue a trailing "//" comment onto the previous statement', () => {
			const result = bml_beautify('boolArray = Boolean[]{true, false};\n\n// next section\ntotal = 1 + 2;', opts);
			assert.strictEqual(
				result,
				'boolArray = Boolean[] {true, false};\n\n// next section\ntotal = 1 + 2;'
			);
		});

		test('keeps a same-line trailing comment on that line instead of bumping it down', () => {
			const result = bml_beautify('y = 2; // why\nz = 3;', opts);
			assert.strictEqual(result, 'y = 2; // why\nz = 3;');
		});

		test('preserves blank lines between statements up to max_preserve_newlines', () => {
			const result = bml_beautify('x = 1;\n\n\n\n\ny = 2;', { ...opts, max_preserve_newlines: 1 });
			assert.strictEqual(result, 'x = 1;\n\ny = 2;');
		});

		test('does not treat "while" as a BML control keyword', () => {
			// BML has no while loop - common.json has no entry for it, only
			// break/continue/return/if/elif/else/for are real statement keywords.
			const result = bml_beautify('while=1;\nprint(while);', opts);
			assert.strictEqual(result, 'while = 1;\nprint(while);');
		});

		test('NOT hugs its parenthesis with no space, unlike AND/OR', () => {
			const result = bml_beautify('flag = (a and not(b)) or not c;', opts);
			assert.strictEqual(result, 'flag = (a AND NOT(b)) OR NOT c;');
		});

		test('preserves a blank line between a leading file comment and the first statement', () => {
			// Real CPQ scripts commonly open with a header comment followed by a blank
			// line; beginStatementLine() has nothing to compare against for the very
			// first real token, so this needs its own handling in the main loop.
			const result = bml_beautify('// header\n\nx = 1;', opts);
			assert.strictEqual(result, '// header\n\nx = 1;');
		});

		test('supports calling a built-in like "print" without parentheses', () => {
			// Legacy production BML (e.g. allUpdate.bml) uses `print expr;` as a bare
			// statement in many places, not just `print(expr)` - print is just an
			// ordinary word token, not a keyword, so no special-casing is needed.
			const result = bml_beautify('if(a){\nb=1;\n}\nelse{\nprint "no parens needed";\n}', opts);
			assert.strictEqual(result, 'if (a) {\n\tb = 1;\n} else {\n\tprint "no parens needed";\n}');
		});

		test('respects the disabled option and returns the source untouched', () => {
			const source = 'x=1;\ny=2;';
			const result = bml_beautify(source, { ...opts, disabled: true });
			assert.strictEqual(result, source);
		});

		test('does not throw on empty input', () => {
			assert.doesNotThrow(() => bml_beautify('', opts));
			assert.doesNotThrow(() => bml_beautify(undefined, opts));
		});

		test('keeps an "ignore:start/end" directive block byte-for-byte verbatim', () => {
			const source = '/* beautify ignore:start */\nx=1;\n   y  =2;\n/* beautify ignore:end */\nz=3;';
			const result = bml_beautify(source, opts);
			assert.strictEqual(result, '/* beautify ignore:start */\nx=1;\n   y  =2;\n/* beautify ignore:end */\nz = 3;');
		});

		test('formats a sized array declarator without literal braces', () => {
			assert.strictEqual(bml_beautify('a=Integer[5];', opts), 'a = Integer[5];');
		});

		test('formats a typed array literal compactly with no inner padding', () => {
			assert.strictEqual(
				bml_beautify('a=Integer[]{1,2,3};', opts),
				'a = Integer[] {1, 2, 3};'
			);
		});
	});

	suite('BML Beautifier computeMinimalEdits Suite', () => {
		const { computeMinimalEdits } = require('../app/lang/beautify/index');

		const createMockDocument = (text) => ({
			getText: (range) => {
				if (!range) return text;
				const startOffset = range.start.offset !== undefined ? range.start.offset : 0;
				const endOffset = range.end.offset !== undefined ? range.end.offset : text.length;
				return text.slice(startOffset, endOffset);
			},
			positionAt: (offset) => {
				const lines = text.slice(0, offset).split('\n');
				const line = lines.length - 1;
				const character = lines[lines.length - 1].length;
				const pos = new vscode.Position(line, character);
				pos.offset = offset;
				return pos;
			},
			offsetAt: (pos) => pos.offset !== undefined ? pos.offset : 0,
		});

		test('returns empty edits when text is already formatted', () => {
			const doc = createMockDocument('x = 1;\ny = 2;\n');
			const edits = computeMinimalEdits(doc, 'x = 1;\ny = 2;\n');
			assert.strictEqual(edits.length, 0);
		});

		test('computes minimal range edit for a single middle line change', () => {
			const current = 'line1 = 1;\nline2=2;\nline3 = 3;\n';
			const formatted = 'line1 = 1;\nline2 = 2;\nline3 = 3;\n';
			const doc = createMockDocument(current);
			const edits = computeMinimalEdits(doc, formatted);
			assert.strictEqual(edits.length, 1);
			assert.strictEqual(edits[0].newText, ' = ');
			assert.strictEqual(edits[0].range.start.line, 1);
		});

		test('does not inject semicolons or modify semantics during formatting', () => {
			const source = 'x = 1\ny = 2\n';
			const result = bml_beautify(source);
			assert.strictEqual(result, 'x = 1\ny = 2;\n'.slice(0, -2) + '\n');
			assert.ok(!result.includes(';'), 'formatting must not inject semicolons as a quick fix');
		});

		test('formats BML AND, OR, and NOT logical operators with canonical spacing', () => {
			const source = 'if(a and b or not(c)){x=1;}';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'if (a AND b OR NOT(c)) {\n    x = 1;\n}');
		});

		test('formats BML <> and == comparison operators correctly', () => {
			const source = 'if(x<>10 and y==20){result=true;}';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'if (x <> 10 AND y == 20) {\n    result = true;\n}');
		});

		test('supports brace_style expand option', () => {
			const source = 'if (a) { x = 1; }';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ', brace_style: 'expand' });
			assert.strictEqual(result, 'if (a)\n{\n    x = 1;\n}');
		});

		test('supports space_in_empty_paren option', () => {
			const source = 'func();';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ', space_in_empty_paren: true });
			assert.strictEqual(result, 'func( );');
		});

		test('formats 2D array literals with inner bracket groups cleanly', () => {
			const source = 'matrix = Integer[][]{ {1, 2}, {3, 4} };';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'matrix = Integer[][] {{1, 2}, {3, 4}};');
		});

		test('formats 2D array access without spaces between bracket indices', () => {
			const source = 'val = matrix[ row ][ col ];';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'val = matrix[row][col];');
		});

		test('formats BML for-in loop constructs cleanly', () => {
			const source = 'for row in tableArray { print row; }';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'for row in tableArray {\n    print row;\n}');
		});

		test('formats BMQL queries cleanly with string literal preserved', () => {
			const source = 'res = bmql("SELECT partNumber, price FROM parts WHERE price > $minVal");';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'res = bmql("SELECT partNumber, price FROM parts WHERE price > $minVal");');
		});

		test('formats BML Dictionary declarations and manipulations', () => {
			const source = 'myDict = dict("string");\nput(myDict, "key1", "val1");\nval = get(myDict, "key1");';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'myDict = dict("string");\nput(myDict, "key1", "val1");\nval = get(myDict, "key1");');
		});

		test('formats BML JSON and jsonarray constructs cleanly', () => {
			const source = 'jObj = json("{\\"key\\":\\"value\\"}");\njArr = jsonarray();\njsonput(jObj, "name", "CPQ");';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'jObj = json("{\\"key\\":\\"value\\"}");\njArr = jsonarray();\njsonput(jObj, "name", "CPQ");');
		});

		test('formats string concatenation expressions with + operator', () => {
			const source = 'fullName = firstName + " " + lastName;';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'fullName = firstName + " " + lastName;');
		});

		test('formats if-elif-else conditional chains with collapse brace style', () => {
			const source = 'if (a == 1) { x = 10; } elif (a == 2) { x = 20; } else { x = 30; }';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ', brace_style: 'collapse' });
			assert.strictEqual(result, 'if (a == 1) {\n    x = 10;\n} elif (a == 2) {\n    x = 20;\n} else {\n    x = 30;\n}');
		});

		test('formats sized array declarations without unwanted whitespace', () => {
			const source = 'grid = Float[ 5 ][ 5 ];\nbuffer = String[ 10 ];';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'grid = Float[5][5];\nbuffer = String[10];');
		});

		test('preserves code within beautify ignore directives unchanged', () => {
			const source = '/* beautify ignore:start */\nif(a==1){x=1;}\n/* beautify ignore:end */\ny=2;';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.ok(result.includes('if(a==1){x=1;}'), 'ignored block content must be preserved verbatim');
			assert.ok(result.includes('y = 2;'), 'code outside ignore directive must be formatted');
		});

		test('formats and aligns multi-line block comments with JSDoc style indentation', () => {
			const source = 'if (isValid) {\n/**\n* @param {String} part\n* @return {Float}\n*/\nprice = 100.0;\n}';
			const result = bml_beautify(source, { indent_size: 4, indent_char: ' ' });
			assert.strictEqual(result, 'if (isValid) {\n    /**\n     * @param {String} part\n     * @return {Float}\n     */\n    price = 100.0;\n}');
		});
	});
});






