const assert = require('assert');
const path = require('path');
const { lintText } = require('../fixtures');
const { loadBuiltInFunctions } = require('../../../app/lang/lint/functions');

const projectRoot = path.join(__dirname, '..', '..', '..');
const builtIns = loadBuiltInFunctions(projectRoot);

function getIncompatibleArgForType(expectedType) {
    if (!expectedType) return '"test"';
    const typeStr = Array.isArray(expectedType) ? expectedType[0] : expectedType;
    const lower = typeStr.toLowerCase();

    if (lower.includes('string') && !lower.includes('[]') && !lower.includes('dict')) {
        return 'getdate()';
    }
    if (lower.includes('date') && !lower.includes('[]') && !lower.includes('dict')) {
        return '"2026-01-01"';
    }
    if ((lower.includes('float') || lower.includes('integer') || lower.includes('number') || lower.includes('numeric')) && !lower.includes('[]') && !lower.includes('dict')) {
        return '"invalid_number"';
    }
    if (lower.includes('boolean') && !lower.includes('[]') && !lower.includes('dict')) {
        return '"true"';
    }
    if (lower.includes('jsonarray') && !lower.includes('[]')) {
        return '"not_a_json_array"';
    }
    if (lower.includes('json') && !lower.includes('[]')) {
        return '"not_a_json_object"';
    }
    if (lower.includes('dict') || lower.includes('dictionary')) {
        return '12345';
    }
    if (lower.includes('[]')) {
        return '"single_string"';
    }
    return 'getdate()';
}

suite('Parameter Type Validation - Full BML API Scanner', () => {
    const skippedFunctions = new Set(['dict', 'dictionary', 'bmql', 'jsonnull']);
    let testedCount = 0;

    for (const [funcNameLower, builtIn] of builtIns.entries()) {
        if (skippedFunctions.has(funcNameLower)) continue;

        const overloads = builtIn.overloads || [{ min: builtIn.min, max: builtIn.max, params: builtIn.params }];
        const validOverload = overloads.find(ov => ov.params && ov.params.length > 0 && ov.params.some(p => p.type && p.type.length > 0));

        if (!validOverload) continue;

        const paramIdx = validOverload.params.findIndex(p => p.type && p.type.length > 0);
        if (paramIdx === -1) continue;

        const targetParam = validOverload.params[paramIdx];
        const expectedType = targetParam.type;
        const normType = (Array.isArray(expectedType) ? expectedType[0] : expectedType).toLowerCase();

        if (['any', 'anytype', 'object', 'valuetype'].includes(normType)) continue;

        testedCount++;
        const funcName = builtIn.name || funcNameLower;

        test(`API Scanner [${funcName}]: validates parameter ${paramIdx + 1} (${Array.isArray(expectedType) ? expectedType.join('/') : expectedType})`, () => {
            const badArg = getIncompatibleArgForType(expectedType);
            const argList = validOverload.params.map((p, idx) => idx === paramIdx ? badArg : '"placeholder"').join(', ');
            const code = `res = ${funcName}(${argList}); return "";`;

            const diags = lintText(code);
            const typeErr = diags.find(d => d.code === 'bml-function-arg-type');
            assert.ok(
                typeErr,
                `Function '${funcName}' should flag invalid argument '${badArg}' for parameter ${paramIdx + 1} (expected ${expectedType})`
            );
        });
    }

    test(`Verified parameter type validation across all ${testedCount} built-in BML API functions`, () => {
        assert.ok(testedCount > 50, `Expected over 50 BML functions to be scanned, got ${testedCount}`);
    });
});
