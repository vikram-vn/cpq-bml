const assert = require('assert');
const vscode = require('vscode');
const { performance } = require('perf_hooks');
const { computeComplexity } = require('../app/lang/metrics/complexity');
const { lintBMLCustom } = require('../app/lang/lint/lint');
const { getFixAllSafeAction } = require('../app/lang/lint/code-actions/fixAllSafe');

suite('Extension Speed Metrics Benchmark', () => {

    test('Benchmark: Linter & Diagnostics Speed across 1,000 lines', async () => {
        const lineBlock = [
            'user_name = "test";',
            'my_items = string[];',
            'my_data = dict("string");',
            'if (true) { print("hello"); }',
            'for i in integer[]{1, 2, 3} { total = total + i; }'
        ].join('\n');

        const bigBml = lineBlock.repeat(200); // 1,000 lines

        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: bigBml
        });

        const collection = vscode.languages.createDiagnosticCollection('bml-bench');

        // Warm up
        lintBMLCustom(doc, collection, vscode);

        // Timed run
        const start = performance.now();
        const runs = 5;
        for (let i = 0; i < runs; i++) {
            lintBMLCustom(doc, collection, vscode);
        }
        const totalDuration = performance.now() - start;
        const avgDuration = totalDuration / runs;

        console.log(`\n================ SPEED METRICS ================`);
        console.log(`1. Full Document Linting (1,000 lines): ${avgDuration.toFixed(2)} ms / run`);
        console.log(`   Throughput: ${(1000 / avgDuration * 1000).toFixed(0)} lines / second`);

        assert.ok(avgDuration < 250, `Linter must complete 1,000 lines in < 250ms (actual: ${avgDuration.toFixed(2)}ms)`);
    });

    test('Benchmark: CodeActions & Fix-All Execution across 1,000 lines', async () => {
        const lineBlock = [
            'user_name = "test";',
            'my_items = string[];',
            'my_data = dict("string");',
            'if (true) {}',
            'unused_helper = 123;'
        ].join('\n');

        const bigBml = lineBlock.repeat(200); // 1,000 lines

        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: bigBml
        });

        const collection = vscode.languages.createDiagnosticCollection('bml-bench2');
        lintBMLCustom(doc, collection, vscode);
        const diags = collection.get(doc.uri) || [];

        // Timed run for CodeActions provider query
        const startQuery = performance.now();
        const codeActions = await vscode.commands.executeCommand(
            'vscode.executeCodeActionProvider',
            doc.uri,
            new vscode.Range(0, 0, 10, 0)
        );
        const queryDuration = performance.now() - startQuery;

        console.log(`2. CodeActions Provider Query Latency: ${queryDuration.toFixed(2)} ms`);
        console.log(`   Actions Returned: ${codeActions ? codeActions.length : 0}`);

        // Timed run for Fix All AST Rewriter
        const startFixAll = performance.now();
        const fixAllActions = getFixAllSafeAction(doc, diags);
        const fixAllDuration = performance.now() - startFixAll;

        console.log(`3. Whole-Document Fix-All AST Rewrite (1,000 lines): ${fixAllDuration.toFixed(2)} ms`);
        console.log(`   Diagnostics Processed: ${diags.length}`);

        assert.ok(queryDuration < 500, `CodeActions query must return in < 500ms (actual: ${queryDuration.toFixed(2)}ms)`);
        assert.ok(fixAllDuration < 250, `FixAll must process 1,000 lines in < 250ms (actual: ${fixAllDuration.toFixed(2)}ms)`);
    });

    test('Benchmark: Complexity Analysis Engine across 2,000 lines', async () => {
        const bigCode = `
string res = "";
for i in integer[]{1, 2, 3, 4, 5, 6, 7, 8, 9, 10} {
    if (i > 5) {
        res = res + "gt";
    } elif (i < 2) {
        res = res + "lt";
    } else {
        res = res + "mid";
    }
}
return res;
`.repeat(200); // 2,000 lines

        const start = performance.now();
        const runs = 10;
        let res;
        for (let i = 0; i < runs; i++) {
            res = computeComplexity(bigCode);
        }
        const avgDuration = (performance.now() - start) / runs;

        console.log(`4. Complexity Metrics Engine (2,000 lines): ${avgDuration.toFixed(2)} ms`);
        console.log(`   Cyclomatic Complexity: ${res.cyclomaticComplexity}, Lines: ${res.lineCount}`);
        console.log(`===============================================\n`);

        assert.ok(avgDuration < 100, `Complexity engine must compute 2,000 lines in < 100ms (actual: ${avgDuration.toFixed(2)}ms)`);
    });
});
