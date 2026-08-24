const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Unused Variables & Hint Diagnostics', function() {
    this.timeout(15000);

    test('Unused variable produces Hint severity and Unnecessary tag', () => {
        const diagnostics = lintText(`
            testName = "123";
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-unused-variable');
        assert.ok(diag, 'Should flag testName as unused');
        assert.strictEqual(diag.message, 'Unused variable: testName');
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Hint, 'Must be Hint severity');
        assert.ok(diag.tags && diag.tags.includes(vscode.DiagnosticTag.Unnecessary), 'Must have Unnecessary tag for editor fading');
        assert.strictEqual(diag.range.start.line, 1);
        assert.strictEqual(diag.range.start.character, 12);
    });

    test('Used variable is not flagged as unused', () => {
        const diagnostics = lintText(`
            activeVar = "hello";
            result = activeVar + " world";
            return result;
        `);

        const diag = diagnostics.find(d => d.code === 'bml-unused-variable' && d.message.includes('activeVar'));
        assert.strictEqual(diag, undefined, 'activeVar is referenced in expression and should not be flagged');
    });

    test('Dynamic BMQL reference ($varName) counts as usage', () => {
        const diagnostics = lintText(`
            filterVal = "APPROVED";
            records = bmql("SELECT id FROM parts WHERE status = $filterVal");
            for row in records {
                print(getstring(row, "id"));
            }
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-unused-variable' && d.message.includes('filterVal'));
        assert.strictEqual(diag, undefined, '$filterVal inside BMQL string literal is a valid usage');
    });

    test('Ignored naming conventions are exempt from unused variable hints', () => {
        const diagnostics = lintText(`
            dummy = "val1";
            temp = "val2";
            unused = "val3";
            trigger_action = "val4";
            _sys_param = "val5";
            custom_c = "val6";
            trans_t = "val7";
            line_l = "val8";
            commerce = "val9";
            util = "val10";
            return "";
        `);

        const unusedDiags = diagnostics.filter(d => d.code === 'bml-unused-variable');
        assert.strictEqual(unusedDiags.length, 0, 'Exempt prefixes/suffixes/names should not produce unused warnings');
    });

    test('Unused loop variable produces Information severity and bml-unused-loop-var code', () => {
        const diagnostics = lintText(`
            items = string[]{"a", "b", "c"};
            count = 0;
            for loopItem in items {
                count = count + 1;
            }
            return string(count);
        `);

        const loopDiag = diagnostics.find(d => d.code === 'bml-unused-loop-var');
        assert.ok(loopDiag, 'Should flag unused loop variable with dedicated code');
        assert.strictEqual(loopDiag.severity, vscode.DiagnosticSeverity.Information, 'Loop var should be Information severity');
        assert.ok(loopDiag.tags && loopDiag.tags.includes(vscode.DiagnosticTag.Unnecessary), 'Loop var must have Unnecessary tag');

        const normalUnused = diagnostics.find(d => d.code === 'bml-unused-variable' && d.message.includes('loopItem'));
        assert.strictEqual(normalUnused, undefined, 'Should not duplicate as regular bml-unused-variable');
    });

    test('Property access does not count as variable usage', () => {
        const diagnostics = lintText(`
            status = "pending";
            val = record.status;
            return val;
        `);

        const unusedStatus = diagnostics.find(d => d.code === 'bml-unused-variable' && d.message.includes('status'));
        assert.ok(unusedStatus, 'status variable is never read directly, only record.status property was accessed');
    });

    test('Reassigned variable with zero reads flags first declaration site', () => {
        const diagnostics = lintText(`
            unobserved = 10;
            unobserved = 20;
            return "";
        `);

        const unobservedDiags = diagnostics.filter(d => d.code === 'bml-unused-variable' && d.message.includes('unobserved'));
        assert.strictEqual(unobservedDiags.length, 1, 'Should flag the unused variable once at its initial declaration');
    });

    test('test/bml/sample.bml - Flags unused variables testName and system variable assignments as Hints with Unnecessary tag', () => {
        const fs = require('fs');
        const path = require('path');
        const sampleBmlPath = path.join(__dirname, '..', 'bml', 'sample.bml');
        const bmlContent = fs.readFileSync(sampleBmlPath, 'utf8');

        const diagnostics = lintText(bmlContent, sampleBmlPath);

        // 1. Verify unused dictionary variable in sample.bml is flagged as Hint with Unnecessary tag
        const unusedSampleDiag = diagnostics.find(d => d.code === 'bml-unused-variable');
        assert.ok(unusedSampleDiag, 'sample.bml must flag unused variables');
        assert.strictEqual(unusedSampleDiag.severity, vscode.DiagnosticSeverity.Hint, 'Unused variable must have Hint severity');
        assert.ok(unusedSampleDiag.tags && unusedSampleDiag.tags.includes(vscode.DiagnosticTag.Unnecessary), 'Unused variable must have Unnecessary tag');

        // 2. Verify active used variables inside test/bml/sample.bml are NOT falsely flagged as unused
        const usedVars = ['sampleJson', 'sampleJsonArr', 'categories01Array', 'tiers01Array', 'matchCount01', 'bmqlSum01'];
        for (const varName of usedVars) {
            const falselyFlagged = diagnostics.find(d => d.code === 'bml-unused-variable' && d.message === `Unused variable: ${varName}`);
            assert.strictEqual(falselyFlagged, undefined, `${varName} is used in sample.bml and should not be flagged as unused`);
        }

        // 3. Verify total unused variables flagged in sample.bml are all Hint severity with Unnecessary tag
        const allUnused = diagnostics.filter(d => d.code === 'bml-unused-variable');
        assert.ok(allUnused.length > 50, `Expected many unused variables in sample.bml (found: ${allUnused.length})`);
        for (const d of allUnused) {
            assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Hint, `Diagnostic for '${d.message}' must be Hint severity`);
            assert.ok(d.tags && d.tags.includes(vscode.DiagnosticTag.Unnecessary), `Diagnostic for '${d.message}' must include Unnecessary tag`);
        }
    });
});
