const assert = require('assert');
const fs = require('fs');
const path = require('path');
const oniguruma = require('vscode-oniguruma');
const { Registry, INITIAL } = require('vscode-textmate');

const GRAMMAR_PATH = path.join(__dirname, '..', 'app', 'lang', 'syntaxes', 'bml.tmLanguage.json');

let grammar;

async function loadGrammar() {
	const wasmBin = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer;
	await oniguruma.loadWASM(wasmBin);

	const onigLib = {
		createOnigScanner(patterns) { return new oniguruma.OnigScanner(patterns); },
		createOnigString(s) { return new oniguruma.OnigString(s); }
	};

	const grammarJson = JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf8'));
	const registry = new Registry({
		onigLib: Promise.resolve(onigLib),
		loadGrammar: async (scopeName) => (scopeName === 'source.bml' ? grammarJson : null)
	});

	return registry.loadGrammar('source.bml');
}

// Tokenizes `line` and returns the full scope chain (space-joined) for the first
// token whose text exactly equals `text`.
function scopesOf(line, text) {
	const result = grammar.tokenizeLine(line, INITIAL);
	for (const token of result.tokens) {
		if (line.substring(token.startIndex, token.endIndex) === text) {
			return token.scopes.join(' ');
		}
	}
	return null;
}

suite('BML Syntax Highlighting (TextMate grammar)', () => {
	suiteSetup(async () => {
		grammar = await loadGrammar();
	});

	suite('operators', () => {
		test('arithmetic operators are scoped as keyword.operator.arithmetic.bml', () => {
			for (const op of ['+', '-', '*', '/', '%']) {
				const line = `x = 1 ${op} 2;`;
				assert.match(scopesOf(line, op), /\bkeyword\.operator\.arithmetic\.bml\b/, `operator "${op}"`);
			}
		});

		test('comparison operators are scoped as keyword.operator.comparison.bml', () => {
			for (const op of ['==', '<>', '<=', '>=', '<', '>']) {
				const line = `if (a ${op} b) {`;
				assert.match(scopesOf(line, op), /\bkeyword\.operator\.comparison\.bml\b/, `operator "${op}"`);
			}
		});

		test('assignment "=" is scoped as keyword.operator.assignment.bml, not comparison', () => {
			assert.match(scopesOf('x = 1;', '='), /\bkeyword\.operator\.assignment\.bml\b/);
		});

		test('logical and/or/not are scoped as keyword.operator.logical.bml regardless of case', () => {
			for (const op of ['and', 'AND', 'or', 'OR', 'not', 'NOT']) {
				const line = `flag = a ${op} b;`;
				assert.match(scopesOf(line, op), /\bkeyword\.operator\.logical\.bml\b/, `operator "${op}"`);
			}
		});
	});

	suite('punctuation', () => {
		test('parens get a scope after a built-in call, not just after custom calls', () => {
			// Regression: #builtins used to win priority over #function-calls for names
			// like print/get/put, which meant the "(" and ")" around a built-in call
			// fell through with no scope at all.
			assert.match(scopesOf('print("x");', '('), /\bpunctuation\.section\.parens\.begin\.bml\b/);
			assert.match(scopesOf('print("x");', ')'), /\bpunctuation\.section\.parens\.end\.bml\b/);
		});

		test('bare grouping parens (not after any identifier) get a scope', () => {
			assert.match(scopesOf('x = (1 + 2);', '('), /\bpunctuation\.section\.parens\.begin\.bml\b/);
			assert.match(scopesOf('x = (1 + 2);', ')'), /\bpunctuation\.section\.parens\.end\.bml\b/);
		});

		test('custom function calls still keep their richer meta.function-call scoping', () => {
			const scopes = scopesOf('myFunc(x);', '(');
			assert.match(scopes, /\bmeta\.function-call\.bml\b/);
			assert.match(scopes, /\bpunctuation\.section\.arguments\.begin\.bml\b/);
		});

		test('square brackets get a scope (array size/index/declarator)', () => {
			assert.match(scopesOf('sz = Integer[5];', '['), /\bpunctuation\.section\.brackets\.begin\.bml\b/);
			assert.match(scopesOf('sz = Integer[5];', ']'), /\bpunctuation\.section\.brackets\.end\.bml\b/);
		});

		test('curly braces get a scope (blocks and array literal bodies)', () => {
			assert.match(scopesOf('if (x) {', '{'), /\bpunctuation\.section\.braces\.begin\.bml\b/);
			assert.match(scopesOf('arr = Integer[]{1, 2}; }', '}'), /\bpunctuation\.section\.braces\.end\.bml\b/);
		});

		test('"." is scoped as punctuation.accessor.bml, not swallowed by punctuation.separator.bml', () => {
			assert.strictEqual(scopesOf('x = a.bField;', '.'), 'source.bml punctuation.accessor.bml');
		});

		test('",", ";" stay scoped as punctuation.separator.bml', () => {
			assert.match(scopesOf('f(a, b);', ','), /\bpunctuation\.separator\.bml\b/);
			assert.match(scopesOf('x = 1;', ';'), /\bpunctuation\.separator\.bml\b/);
		});
	});

	suite('keywords and types', () => {
		test('conditional keywords are scoped as keyword.control.conditional.bml', () => {
			for (const kw of ['if', 'elif', 'else']) {
				const line = `${kw} x;`;
				assert.match(scopesOf(line, kw), /\bkeyword\.control\.conditional\.bml\b/, `keyword "${kw}"`);
			}
		});

		test('other flow keywords are scoped as keyword.control.flow.bml', () => {
			for (const kw of ['for', 'in', 'break', 'continue', 'return']) {
				const line = `${kw} x;`;
				assert.match(scopesOf(line, kw), /\bkeyword\.control\.flow\.bml\b/, `keyword "${kw}"`);
			}
		});

		test('"while" and "throw" are not treated as BML keywords', () => {
			// app/lookups/bml has no entry for either - only throwerror() is real BML,
			// and there is no while loop. Both should fall through as plain variables.
			assert.doesNotMatch(scopesOf('while = 1;', 'while') || '', /keyword\.control\./);
			assert.doesNotMatch(scopesOf('throw = 1;', 'throw') || '', /keyword\.control\./);
		});

		test('_l, _t, _c suffixed identifiers are scoped as attributes even without a dot prefix', () => {
			// _l = transaction line attribute, _t = transaction attribute, _c = custom field
			// on either - app/lookups/commerce/transaction.json and transactionLine.json
			// confirm these suffixes, and real BML scripts use them as bare identifiers too,
			// not just via a "line." prefix.
			assert.match(scopesOf('x = quantity_l;', 'quantity_l'), /\bvariable\.other\.(transaction|line)\.attribute\.bml\b/);
			assert.match(scopesOf('y = status_t;', 'status_t'), /\bvariable\.other\.(transaction|line)\.attribute\.bml\b/);
			assert.match(scopesOf('z = setQuoteLevelFlags_c;', 'setQuoteLevelFlags_c'), /\bvariable\.other\.(transaction|line)\.attribute\.bml\b/);
			// the dotted form keeps its more specific line-attribute scope
			assert.match(scopesOf('w = line.status_l;', 'line.status_l'), /\bvariable\.other\.line\.attribute\.bml\b/);
		});

		test('known system variables that break naming conventions are still scoped as attributes', () => {
			// app/lang/intellisense/bml_util_attributes_api_usage.json and
			// bml_attributes_api_usage.json list these real system variables - they don't
			// start with "_" or end in _c/_t/_l, so they need explicit grammar entries.
			for (const id of ['CRM_CUSTOMER_ID', 'oRCL_charges', 'bs_id', 'createOrderRestResponse', 'includedInBasePrice']) {
				const line = `x = ${id};`;
				assert.match(scopesOf(line, id), /\bvariable\.other\.member\.bml\b/, `identifier "${id}"`);
			}
		});

		test('built-in types are scoped as storage.type.bml', () => {
			for (const type of ['String', 'Integer', 'Float', 'Boolean', 'Date', 'Dictionary']) {
				const line = `x = ${type}[];`;
				assert.match(scopesOf(line, type), /\bstorage\.type\.bml\b/, `type "${type}"`);
			}
		});

		test('true/false/null are scoped as constant.language.bml', () => {
			for (const word of ['true', 'false', 'null']) {
				assert.match(scopesOf(`x = ${word};`, word), /\bconstant\.language\.bml\b/, `constant "${word}"`);
			}
		});
	});
});
