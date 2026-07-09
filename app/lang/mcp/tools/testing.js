const fs = require('fs');
const path = require('path');
const { findOrCreateAiCopy } = require('../locate');
const { debugFunction } = require('./lifecycle');

// Headless counterparts to app/lang/testing/runner.js and snapshot.js: those are built for an
// active editor + interactive prompts + an Output Channel, and scrape the return value out of
// rendered terminal text. These reuse debugFunction's already-structured {success, returnValue}
// result directly instead, so no fragile "return value:" line-scraping is needed here.

function locateBmlFile(vscode, variableName) {
    const bmlPath = findOrCreateAiCopy(vscode, variableName);
    if (!bmlPath) {
        return { error: `No local file found for "${variableName}". Run pull_function first.` };
    }
    return { bmlPath };
}

function stringifyReturnValue(value) {
    return value !== undefined && value !== null ? String(value) : null;
}

/**
 * run_bml_tests
 *
 * Runs every case in <variableName>.bmltest.json (an array of
 * { description?, params?, expected?, transactionId? }) against the local AI working copy via
 * debugFunction, comparing each actual return value to its expected one.
 */
async function runBmlTests(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const located = locateBmlFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const testFilePath = path.join(path.dirname(located.bmlPath), `${variableName}.bmltest.json`);
    if (!fs.existsSync(testFilePath)) {
        return {
            success: false,
            variableName,
            error: `No test file found. Create ${variableName}.bmltest.json alongside the .bml file.`,
        };
    }

    let testCases;
    try {
        testCases = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
    } catch (e) {
        return { success: false, variableName, error: `Failed to parse ${variableName}.bmltest.json: ${e.message}` };
    }
    if (!Array.isArray(testCases) || testCases.length === 0) {
        return { success: false, variableName, error: `${variableName}.bmltest.json contains no test cases.` };
    }

    const results = [];
    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i] || {};
        const description = tc.description || `Case ${i + 1}`;
        const debugArgs = { variableName, parameters: tc.params || {} };
        if (tc.transactionId) debugArgs.transactionId = tc.transactionId;

        const debugResult = await debugFunction(context, vscode, debugArgs, transport);
        if (!debugResult.success) {
            results.push({ description, passed: false, error: debugResult.error });
            continue;
        }

        const actual = stringifyReturnValue(debugResult.returnValue);
        const expected = tc.expected !== undefined ? String(tc.expected) : null;
        const passed = expected === null ? true : actual === expected;
        results.push({ description, passed, expected, actual });
    }

    const passedCount = results.filter((r) => r.passed).length;
    return {
        success: passedCount === results.length,
        variableName,
        testFile: testFilePath,
        passedCount,
        failedCount: results.length - passedCount,
        results,
    };
}

/**
 * update_snapshot
 *
 * Runs the local AI working copy with the given parameters and saves the return value to
 * <variableName>.snap.json alongside the .bml file, for compare_snapshot to check against later.
 */
async function updateSnapshot(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const located = locateBmlFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const params = (args && args.parameters) || {};
    const debugArgs = { variableName, parameters: params };
    if (args && args.transactionId) debugArgs.transactionId = args.transactionId;

    const debugResult = await debugFunction(context, vscode, debugArgs, transport);
    if (!debugResult.success) {
        return { success: false, variableName, error: debugResult.error || 'Debug failed while capturing the snapshot.' };
    }

    const output = stringifyReturnValue(debugResult.returnValue) || '';
    const snapshotPath = path.join(path.dirname(located.bmlPath), `${variableName}.snap.json`);
    const snapshot = { variableName, params, output, capturedAt: new Date().toISOString() };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');

    return { success: true, variableName, snapshotPath, output };
}

/**
 * compare_snapshot
 *
 * Reruns the local AI working copy with the saved snapshot's parameters and reports whether the
 * return value still matches - a regression check for changes made since update_snapshot.
 */
async function compareSnapshot(context, vscode, args, transport) {
    const variableName = args && args.variableName;
    if (!variableName) return { success: false, error: 'variableName is required.' };

    const located = locateBmlFile(vscode, variableName);
    if (located.error) return { success: false, variableName, error: located.error };

    const snapshotPath = path.join(path.dirname(located.bmlPath), `${variableName}.snap.json`);
    if (!fs.existsSync(snapshotPath)) {
        return { success: false, variableName, error: `No snapshot found. Run update_snapshot first.` };
    }

    let snapshot;
    try {
        snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch (e) {
        return { success: false, variableName, error: `Failed to read snapshot: ${e.message}` };
    }

    const debugResult = await debugFunction(context, vscode, { variableName, parameters: snapshot.params || {} }, transport);
    if (!debugResult.success) {
        return { success: false, variableName, error: debugResult.error || 'Debug failed while comparing the snapshot.' };
    }

    const actual = stringifyReturnValue(debugResult.returnValue) || '';
    const matches = actual === snapshot.output;

    return {
        success: matches,
        variableName,
        matches,
        expected: snapshot.output,
        actual,
        snapshotPath,
        capturedAt: snapshot.capturedAt,
    };
}

module.exports = { runBmlTests, updateSnapshot, compareSnapshot };
