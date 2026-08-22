const assert = require('assert');
const vscode = require('vscode');
const { activateExtension } = require('./extensionHelper');

suite('BML IntelliSense', () => {
	suiteSetup(async () => {
		// Activation isn't guaranteed just from opening a "bml" document in the test
		// host (the extension declares no explicit activationEvents), so activate it
		// directly to make sure the hover/completion providers are actually registered.
		await activateExtension(vscode);
	});

	test('hover resolves dotted attribute access (line.x) via the bare attribute key', async () => {
		// app/lang/intellisense/bml-attributes-api-usage.json keys attributes without any
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
		// bml-functions-api-usage.json "examples" are almost always numbered prose
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

	test('completion list for transaction. only includes Transaction attributes', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = transaction.' });
		const position = new vscode.Position(0, 16);
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);
		
		assert.ok(labels.includes('createdBy_t'), 'expected createdBy_t in transaction completions');
		assert.ok(!labels.includes('priceType_l'), 'did not expect priceType_l in transaction completions');
		assert.ok(!labels.includes('atof'), 'did not expect atof in transaction completions');
	});

	test('completion list for line. only includes Line Item attributes', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = line.' });
		const position = new vscode.Position(0, 9);
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);
		
		assert.ok(labels.includes('priceType_l'), 'expected priceType_l in line completions');
		assert.ok(!labels.includes('createdBy_t'), 'did not expect createdBy_t in line completions');
		assert.ok(!labels.includes('atof'), 'did not expect atof in line completions');
	});

	test('completion list for CPQJS. includes stripped CPQJS methods', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'CPQJS.' });
		const position = new vscode.Position(0, 6);
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);
		
		assert.ok(labels.includes('actionExists'), 'expected actionExists in CPQJS completions');
		assert.ok(!labels.includes('CPQJS.actionExists'), 'did not expect full CPQJS.actionExists in CPQJS completions');
		assert.ok(!labels.includes('atof'), 'did not expect atof in CPQJS completions');
	});

	test('global completion list does not include attributes', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = ' });
		const position = new vscode.Position(0, 4);
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);
		
		assert.ok(labels.includes('atof'), 'expected atof in global completions');
		assert.ok(labels.includes('_site_url'), 'expected _site_url in global completions');
		assert.ok(!labels.includes('createdBy_t'), 'did not expect createdBy_t in global completions');
		assert.ok(!labels.includes('priceType_l'), 'did not expect priceType_l in global completions');
	});

	test('signature help resolves active BML function and parameter highlights', async () => {
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = datetostr(getdate(), ' });
		const position = new vscode.Position(0, 24);
		const sigHelp = await vscode.commands.executeCommand('vscode.executeSignatureHelpProvider', doc.uri, position);
		
		assert.ok(sigHelp, 'expected signature help to be returned');
		assert.strictEqual(sigHelp.signatures.length, 1, 'expected 1 signature');
		const activeSig = sigHelp.signatures[0];
		assert.match(activeSig.label, /datetostr/i);
		assert.strictEqual(sigHelp.activeParameter, 1, 'expected active parameter index to be 1');
	});

	test('completion in 3rd parameter of datetostr suggests timezones including GMT+4', async () => {
		const content = 'twelvehour = datetostr(testDate, "yyyy-MM-dd hh:mm:ss a", "");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 58); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('GMT+4'), 'expected GMT+4 in timezone completions');
		assert.ok(labels.includes('GMT-6'), 'expected GMT-6 in timezone completions');
		assert.ok(labels.includes('UTC'), 'expected UTC in timezone completions');
		assert.ok(labels.includes('America/New_York'), 'expected America/New_York in timezone completions');
		assert.ok(labels.includes('Europe/Paris'), 'expected Europe/Paris in timezone completions');
	});

	test('completion in 3rd parameter of strtojavadate suggests Europe/Paris and America/Chicago', async () => {
		const content = 'parisdate = strtojavadate("01/02/2010 16:30:40", "dd/MM/yyyy HH:mm:ss", "");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 73); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('Europe/Paris'), 'expected Europe/Paris in strtojavadate timezone completions');
		assert.ok(labels.includes('America/Chicago'), 'expected America/Chicago in strtojavadate timezone completions');
		assert.ok(labels.includes('GMT+4'), 'expected GMT+4 in strtojavadate timezone completions');
	});

	test('completion in 2nd parameter of formatascurrency suggests currency codes', async () => {
		const content = 'val = formatascurrency(100.0, "");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 31); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('USD'), 'expected USD in currency completions');
		assert.ok(labels.includes('EUR'), 'expected EUR in currency completions');
		assert.ok(labels.includes('GBP'), 'expected GBP in currency completions');
	});

	test('completion in 2nd parameter of split suggests delimiters', async () => {
		const content = 'arr = split(str, "");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 18); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes(','), 'expected comma in split delimiter completions');
		assert.ok(labels.includes(';'), 'expected semicolon in split delimiter completions');
		assert.ok(labels.includes('|'), 'expected pipe in split delimiter completions');
	});

	test('completion in 1st parameter of urldataaccess suggests HTTP methods', async () => {
		const content = 'res = urldataaccess("");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 21); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('GET'), 'expected GET in HTTP method completions');
		assert.ok(labels.includes('POST'), 'expected POST in HTTP method completions');
		assert.ok(labels.includes('PUT'), 'expected PUT in HTTP method completions');
		assert.ok(labels.includes('DELETE'), 'expected DELETE in HTTP method completions');
	});

	test('completion in 4th parameter of sendmail suggests content types', async () => {
		const content = 'sendmail("to@test.com", "subject", "body", "");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 44); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('text/html'), 'expected text/html in sendmail content type completions');
		assert.ok(labels.includes('text/plain'), 'expected text/plain in sendmail content type completions');
	});

	test('completion in 1st parameter of bmql suggests BMQL select template', async () => {
		const content = 'rs = bmql("");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 11); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.some(l => l.includes('SELECT')), 'expected BMQL SELECT template');
	});

	test('completion in 1st parameter of CPQJS.getTableInfo suggests lineItemGrid', async () => {
		const content = 'CPQJS.getTableInfo("");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 20); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('lineItemGrid'), 'expected lineItemGrid in CPQJS table completions');
	});

	test('completion in 2nd parameter of jsonpathgetsingle and jsonpathgetmultiple suggests JSONPath templates', async () => {
		const content = 'val = jsonpathgetsingle(jsonObj, "");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 34); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('$.fieldName'), 'expected $.fieldName in JSONPath completions');
		assert.ok(labels.includes('$..value'), 'expected $..value deep scan in JSONPath completions');
	});

	test('completion in 1st parameter of CPQJS.performAction suggests action variables', async () => {
		const content = 'CPQJS.performAction("");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 21); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('saveAction'), 'expected saveAction in CPQJS action completions');
		assert.ok(labels.includes('submitQuote'), 'expected submitQuote in CPQJS action completions');
	});

	test('completion in 1st parameter of dict suggests dictionary data types', async () => {
		const content = 'configDictVal = dict("");';
		const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
		const position = new vscode.Position(0, 22); // inside ""
		const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
		const labels = list.items.map(i => i.label);

		assert.ok(labels.includes('string'), 'expected "string" in dict parameter completions');
		assert.ok(labels.includes('integer'), 'expected "integer" in dict parameter completions');
		assert.ok(labels.includes('dict<anytype>'), 'expected "dict<anytype>" in dict parameter completions');
	});
});
