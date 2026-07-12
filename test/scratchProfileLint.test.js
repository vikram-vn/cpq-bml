const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

// Throwaway profiling harness: mirrors lintBMLCustom's exact checker sequence
// (see app/lang/lint/lint.js) but times each checker separately per file
// across the real library under bml/, then dumps aggregate timings + per-rule
// hit counts to scratch_lint_profile.json. Deleted after the audit.
const { getCommentRanges } = require('../app/lang/lint/comments');
const { getConditionRanges } = require('../app/lang/lint/conditions');
const { getDeclaredVariables, checkVariableDiagnostics } = require('../app/lang/lint/variables');
const { checkMissingSemicolons } = require('../app/lang/lint/semicolon');
const { checkAssignmentInCondition } = require('../app/lang/lint/assignment');
const { checkOperators } = require('../app/lang/lint/operators');
const { checkPerformance } = require('../app/lang/lint/performance');
const { checkBestPractices } = require('../app/lang/lint/best-practices');
const { checkStyle } = require('../app/lang/lint/style');
const { checkBoundaries } = require('../app/lang/lint/boundaries');
const { checkFunctionCalls } = require('../app/lang/lint/functions');
const { checkSystemVariables } = require('../app/lang/lint/systemVariables');
const { checkAssignmentTypeConsistency, inferLiteralType } = require('../app/lang/lint/typeCheck');
const { checkMetadataTypeConsistency, getDeclaredParameterTypes } = require('../app/lang/lint/metadataTypes');
const { checkConstantConditions } = require('../app/lang/lint/constantConditions');
const { checkUnreachableCode } = require('../app/lang/lint/unreachable');
const { checkDuplicateConditionBranches, parseConditionalChains } = require('../app/lang/lint/duplicateBranches');
const { checkMixedOperators } = require('../app/lang/lint/mixedOperators');
const { checkLonelyIf } = require('../app/lang/lint/lonelyIf');
const { checkUnusedExpressions } = require('../app/lang/lint/unusedExpressions');
const { checkUseBeforeDefine } = require('../app/lang/lint/useBeforeDefine');
const { getStringRanges, checkUnclosedStrings } = require('../app/lang/lint/strings');
const { checkSpelling } = require('../app/lang/spell-check/spelling');
const { checkNullSafety } = require('../app/lang/lint/nullSafety');
const { checkInfiniteLoop } = require('../app/lang/lint/infiniteLoop');
const { checkShadowedVariables } = require('../app/lang/lint/shadowedVariables');

function blankRanges(text, ranges) {
    const chars = text.split('');
    for (const [start, end] of ranges) {
        for (let i = start; i < end; i++) {
            const ch = chars[i];
            if (ch !== '\n' && ch !== '\r') chars[i] = ' ';
        }
    }
    return chars.join('');
}

function findBmlFiles(dir, results) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) findBmlFiles(full, results);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.bml')) results.push(full);
    }
}

suite('SCRATCH: profile linter on real library', () => {
    test('time each checker per file, dump aggregates', function () {
        this.timeout(300000);
        const extensionPath = path.join(__dirname, '..');
        const libraryRoot = path.join(__dirname, '..', 'bml', 'library');
        const bmlFiles = [];
        findBmlFiles(libraryRoot, bmlFiles);

        const checkerStats = {}; // name -> { totalMs, maxMs, maxFile }
        const ruleHits = {};     // code -> count
        const fileTotals = [];   // { file, lineCount, totalMs }

        // Warmup pass: run every checker once against a real file with a
        // -meta.json sidecar and function calls, so all lazy one-time loads
        // (spell dictionaries, functions-API JSON, lookup tables) happen
        // before timing starts. Separates one-time load hiccups from real
        // per-keystroke steady-state cost.
        const warmupFile = bmlFiles.find((f) => fs.existsSync(f.replace(/\.bml$/i, '-meta.json'))) || bmlFiles[0];
        bmlFiles.unshift(warmupFile);
        let warmupDone = false;

        const timeIt = (name, file, fn) => {
            const t0 = process.hrtime.bigint();
            let diags = [];
            try {
                diags = fn() || [];
            } catch (e) {
                diags = [];
                checkerStats[name] = checkerStats[name] || { totalMs: 0, maxMs: 0, maxFile: '', errors: [] };
                (checkerStats[name].errors = checkerStats[name].errors || []).push({ file, error: e.message });
            }
            const ms = Number(process.hrtime.bigint() - t0) / 1e6;
            if (!warmupDone) return ms; // discard warmup timings and hits
            const s = (checkerStats[name] = checkerStats[name] || { totalMs: 0, maxMs: 0, maxFile: '' });
            s.totalMs += ms;
            if (ms > s.maxMs) { s.maxMs = ms; s.maxFile = file; }
            for (const d of diags) {
                if (d && d.code) ruleHits[d.code] = (ruleHits[d.code] || 0) + 1;
            }
            return ms;
        };

        for (const filePath of bmlFiles) {
            const text = fs.readFileSync(filePath, 'utf8');
            const relFile = path.relative(libraryRoot, filePath);
            const doc = {
                languageId: 'bml',
                getText: () => text,
                positionAt: (idx) => {
                    const lines = text.slice(0, idx).split(/\r?\n/);
                    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
                },
                uri: vscode.Uri.file(filePath),
            };

            const tFile0 = process.hrtime.bigint();
            const commentRanges = getCommentRanges(text);
            const conditionRanges = getConditionRanges(text);
            const cleanText = blankRanges(text, commentRanges);
            const stringRanges = getStringRanges(cleanText);
            const noStringsText = blankRanges(cleanText, stringRanges);
            const declaredVars = getDeclaredVariables(noStringsText, doc);

            timeIt('variableDiagnostics', relFile, () => checkVariableDiagnostics(noStringsText, declaredVars, doc));
            timeIt('missingSemicolons', relFile, () => checkMissingSemicolons(cleanText, noStringsText, conditionRanges));
            timeIt('assignmentInCondition', relFile, () => checkAssignmentInCondition(noStringsText, conditionRanges, doc));
            timeIt('operators', relFile, () => checkOperators(noStringsText, doc));
            timeIt('performance', relFile, () => checkPerformance(cleanText, noStringsText, doc));
            timeIt('bestPractices', relFile, () => checkBestPractices(cleanText, noStringsText, doc));
            timeIt('style', relFile, () => checkStyle(cleanText, noStringsText, doc, declaredVars));
            timeIt('boundaries', relFile, () => checkBoundaries(cleanText, noStringsText, doc));
            timeIt('functionCalls', relFile, () => checkFunctionCalls(cleanText, noStringsText, doc, vscode, extensionPath));
            timeIt('systemVariables', relFile, () => checkSystemVariables(noStringsText, doc, vscode, extensionPath));
            const declaredParamTypes = getDeclaredParameterTypes(doc.uri && doc.uri.fsPath);
            timeIt('assignmentTypeConsistency', relFile, () => checkAssignmentTypeConsistency(cleanText, doc, vscode, declaredParamTypes, extensionPath));
            timeIt('metadataTypeConsistency', relFile, () => checkMetadataTypeConsistency(cleanText, doc, vscode, inferLiteralType, extensionPath));
            timeIt('constantConditions', relFile, () => checkConstantConditions(cleanText, conditionRanges, doc, vscode));
            let conditionalChains;
            timeIt('parseConditionalChains', relFile, () => { conditionalChains = parseConditionalChains(cleanText); return []; });
            timeIt('unreachableCode', relFile, () => checkUnreachableCode(noStringsText, doc, vscode, conditionalChains));
            timeIt('duplicateBranches', relFile, () => checkDuplicateConditionBranches(conditionalChains, doc, vscode));
            timeIt('lonelyIf', relFile, () => checkLonelyIf(cleanText, conditionalChains, doc, vscode));
            timeIt('mixedOperators', relFile, () => checkMixedOperators(cleanText, conditionRanges, doc, vscode));
            timeIt('unusedExpressions', relFile, () => checkUnusedExpressions(cleanText, doc, vscode));
            timeIt('useBeforeDefine', relFile, () => checkUseBeforeDefine(noStringsText, doc, vscode, declaredVars, extensionPath));
            timeIt('nullSafety', relFile, () => checkNullSafety(cleanText, noStringsText, doc));
            timeIt('unclosedStrings', relFile, () => checkUnclosedStrings(cleanText, doc, vscode));
            timeIt('infiniteLoop', relFile, () => checkInfiniteLoop(noStringsText, doc));
            timeIt('shadowedVariables', relFile, () => checkShadowedVariables(noStringsText, doc));
            timeIt('spelling', relFile, () => checkSpelling(text, cleanText, noStringsText, doc, vscode, extensionPath));

            const totalMs = Number(process.hrtime.bigint() - tFile0) / 1e6;
            if (!warmupDone) { warmupDone = true; continue; } // first iteration was the warmup copy
            fileTotals.push({ file: relFile, lineCount: text.split(/\r?\n/).length, totalMs: Math.round(totalMs * 10) / 10 });
        }

        const checkers = Object.entries(checkerStats)
            .map(([name, s]) => ({ name, totalMs: Math.round(s.totalMs), maxMs: Math.round(s.maxMs * 10) / 10, maxFile: s.maxFile, errors: s.errors }))
            .sort((a, b) => b.totalMs - a.totalMs);
        fileTotals.sort((a, b) => b.totalMs - a.totalMs);

        const out = {
            fileCount: bmlFiles.length,
            checkers,
            slowestFiles: fileTotals.slice(0, 15),
            ruleHits: Object.fromEntries(Object.entries(ruleHits).sort((a, b) => b[1] - a[1])),
        };
        const outPath = path.join(__dirname, '..', 'scratch_lint_profile.json');
        fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
        console.log(`Profiled ${bmlFiles.length} files -> ${outPath}`);
    });
});
