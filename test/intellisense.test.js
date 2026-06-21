const assert = require('assert');
const vscode = require('vscode');

suite('BML IntelliSense', () => {
	suiteSetup(async () => {
		// Activation isn't guaranteed just from opening a "bml" document in the test
		// host (the extension declares no explicit activationEvents), so activate it
		// directly to make sure the hover/completion providers are actually registered.
		const ext = vscode.extensions.getExtension('vikram-n.cpq-bml');
		await ext.activate();
	});

	test('hover resolves dotted attribute access (line.x) via the bare attribute key', async () => {
		// app/lang/intellisense/bml_attributes_api_usage.json keys attributes without any
		// object prefix (e.g. "annualvalue_l"), but real BML code accesses them as
		// "line.annualValue_l" - the word-range regex captures the whole dotted run, so
		// the lookup has to fall back to the segment after the last ".".
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = line.annualValue_l;' });
		const position = new vscode.Position(0, 12); // inside "annualValue_l"
		const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, position);
		assert.ok(hovers && hovers.length > 0, 'expected a hover result for line.annualValue_l');
	});

	test('hover still resolves dotted keys that are themselves the canonical name (CPQJS.actionExists)', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'CPQJS.actionExists();' });
		const position = new vscode.Position(0, 10); // inside "actionExists"
		const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, position);
		assert.ok(hovers && hovers.length > 0, 'expected a hover result for CPQJS.actionExists');
	});

	test('hover returns nothing for an unknown word', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'totallyMadeUpName;' });
		const position = new vscode.Position(0, 5);
		const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, position);
		assert.strictEqual(hovers.length, 0);
	});

	test('completion list includes known built-in functions', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = ' });
		const position = new vscode.Position(0, 4);
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);
		assert.ok(labels.includes('atof'), 'expected "atof" in the completion list');
	});

	test('completion item documentation is resolved lazily via resolveCompletionItem', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = ' });
		const position = new vscode.Position(0, 4);

		// Asking VS Code to resolve items runs resolveCompletionItem, which is where
		// formatAsJsDoc actually builds the documentation (deferred from list-build time).
		const resolved = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position, undefined, 9999);
		const resolvedItem = resolved.items.find(i => i.label === 'atof');
		assert.ok(resolvedItem, 'expected an "atof" completion item');
		assert.match(resolvedItem.documentation.value, /atof/i);
	});

	test('hover for an attribute renders its scope/dataType fields as a metadata line', async () => {
		// app/scripts/generateBmlAttributes.js keeps scope ("Transaction") and dataType
		// ("String") as their own JSON fields rather than a "[Transaction] [String] ..."
		// text prefix on notes - this should render as "*Transaction · String*" above
		// the plain description, with no literal brackets anywhere.
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = createdBy_t;' });
		const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, new vscode.Position(0, 6));
		const value = hovers[0].contents.map(c => c.value).join('\n');
		assert.match(value, /\*Transaction · String\*/);
		assert.doesNotMatch(value, /\[Transaction\]/);
	});

	test('hover for a function renders its functionCategory as a metadata line', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = decodebase64("YWJj");' });
		const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, new vscode.Position(0, 6));
		const value = hovers[0].contents.map(c => c.value).join('\n');
		assert.match(value, /\*string function\*/);
	});

	test('hover for a menu-type attribute lists its valid values', async () => {
		// transaction.json's currency_t has isMenuType + availableElements (USD/GBP/EUR) -
		// generateBmlAttributes.js keeps those as a real "values" array.
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = currency_t;' });
		const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, new vscode.Position(0, 6));
		const value = hovers[0].contents.map(c => c.value).join('\n');
		assert.match(value, /\*\*Values:\*\* `USD`, `GBP`, `EUR`/);
	});

	test('hover for a function with a full typed signature shows return and param types', async () => {
		// generateBmlFunctions.js now keeps "Float atof(String str)" as fullSignature
		// instead of discarding it in favor of just the snippet-insertion form.
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = atof("1");' });
		const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, new vscode.Position(0, 5));
		const value = hovers[0].contents.map(c => c.value).join('\n');
		assert.match(value, /Float atof\(String str\)/);
	});

	test('hover for a function renders numbered usage notes as markdown text, not a code block', async () => {
		// bml_functions_api_usage.json "examples" are almost always numbered prose
		// ("1. This function..."), not runnable code - that must not be wrapped in a
		// ```bml fenced block, and any embedded call like decodebase64("YWJj") should
		// still read as inline code.
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = decodebase64("YWJj");' });
		const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, new vscode.Position(0, 6));
		const value = hovers[0].contents.map(c => c.value).join('\n');
		assert.match(value, /\*\*Usage Notes?:\*\*/);
		assert.match(value, /`decodebase64\("YWJj"\)`/);
		// only one fenced code block (the syntax header) - the prose notes aren't fenced
		assert.strictEqual((value.match(/```/g) || []).length, 2);
	});

	test('hover for a snippet with real multi-line code keeps it as a fenced code block', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = 1;' });
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, new vscode.Position(0, 0), undefined, 9999);
		const snippetItem = list.items.find(i => i.label === 'for...loop');
		assert.ok(snippetItem, 'expected the "for...loop" snippet in the completion list');
		const value = snippetItem.documentation.value;
		// the real BML loop body in its example must still be fenced, not flattened to prose
		assert.match(value, /```bml\nresult=""/);
	});
});
