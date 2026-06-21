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
	const testDir = path.join(__dirname, 'beautify');
	if (fs.existsSync(testDir)) {
		const files = fs.readdirSync(testDir);
		const inputFiles = files.filter(f => f.endsWith('.bml') && !f.endsWith('.expected.bml'));

		for (const file of inputFiles) {
			const testName = path.basename(file, '.bml');
			test(`BML Beautifier file-based test: ${testName}`, () => {
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
			// BML has no while loop - app/lookups/bml has no entry for it, only
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
});
