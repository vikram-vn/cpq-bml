const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { lintText } = require('./fixtures');
const { parseParameterSignature } = require('../../app/lang/lint/functionSignature');

function getSafeLiteralForType(type, index) {
    if (!type) return `arg${index}`;
    const typeLower = Array.isArray(type) ? type[0].toLowerCase() : type.toLowerCase();
    if (typeLower.includes('record')) {
        return `arg${index}`;
    }
    if (typeLower.includes('jsonarray')) return 'jsonarray()';
    if (typeLower.includes('json')) return 'json()';
    if (typeLower.includes('integer[]') || typeLower.includes('long[]')) return 'integer[]{1}';
    if (typeLower.includes('float[]') || typeLower.includes('numeric[]') || typeLower.includes('double[]')) return 'float[]{0.5}';
    if (typeLower.includes('boolean[]')) return 'boolean[]{true}';
    if (typeLower.includes('date[]')) return 'date[]{getdate()}';
    if (typeLower.includes('array') || typeLower.includes('[]')) {
        return 'string[]{"123"}';
    }
    if (typeLower.includes('integer') || typeLower.includes('long')) return '1';
    if (typeLower.includes('float') || typeLower.includes('numeric') || typeLower.includes('double')) return '0.5';
    if (typeLower.includes('boolean')) return 'true';
    if (typeLower.includes('date')) return 'getdate()';
    if (typeLower.includes('stringbuilder')) return 'stringbuilder()';
    if (typeLower.includes('dictionary') || typeLower.includes('dict')) return 'dict("string")';
    return '"123"';
}

function runDynamicTestsForCategory(category, suiteTitle) {
    const apiUsagePath = path.join(__dirname, '../../app/lang/intellisense/bml_functions_api_usage.json');
    const apiData = JSON.parse(fs.readFileSync(apiUsagePath, 'utf8'));

    const localKeywords = new Set([
        'if', 'elif', 'else', 'for', 'in', 'break', 'continue', 'return',
        'true', 'false', 'null', 'and', 'or', 'not',
        'string', 'integer', 'float', 'boolean', 'date', 'json', 'jsonarray',
        'jsonnull', 'bytearray', 'record', 'recordset', 'stringbuilder', 'dictionary', 'dict',
        'bmql',
    ]);
    const deprecated = new Set(['strtodate', 'gettabledata', 'getpartsdata']);

    Object.keys(apiData).forEach(name => {
        const nameLower = name.toLowerCase();
        if (nameLower === 'nan' || nameLower === 'jnan' || name.startsWith('BM_') || !/^[a-zA-Z0-9_]+$/.test(name) || localKeywords.has(nameLower) || deprecated.has(nameLower)) {
            return; // Skip keywords, deprecated, and constants
        }

        const item = apiData[name];
        if (item.functionCategory !== category) {
            return;
        }

        const overloads = item.fullSignature.split(/\r?\n\s*\(or\)\s*\r?\n/).map(sig => parseParameterSignature(sig));
        if (nameLower === 'put') {
            overloads[0].params = [{type: 'dictionary'}, {type: 'string'}, {type: 'string'}];
        } else if (nameLower === 'sbappend') {
            overloads[0].params = [{type: 'stringbuilder'}, {type: 'string'}];
        }

        suite(`Dynamic Function: ${name}`, () => {
            const globalMin = Math.min(...overloads.map(ov => ov.min));
            const globalMax = Math.max(...overloads.map(ov => ov.max));
            const firstMin = overloads[0].min;

            test('1. validates correct argument count with variables', () => {
                const args = overloads[0].params.map((p, idx) => `var_${idx}`);
                const decls = overloads[0].params.map((p, idx) => `var_${idx} = ${getSafeLiteralForType(p.type, idx)};`).join('\n');
                const code = `${decls}\n${name}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.strictEqual(err, undefined);
            });

            test('2. rejects too few arguments with variables', () => {
                if (globalMin === 0) return;
                const args = [];
                for (let idx = 0; idx < globalMin - 1; idx++) {
                    args.push(`var_${idx}`);
                }
                const decls = overloads[0].params.map((p, idx) => `var_${idx} = ${getSafeLiteralForType(p.type, idx)};`).join('\n');
                const code = `${decls}\n${name}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err, `Should fail with too few args for ${name}`);
            });

            test('3. rejects too many arguments with variables', () => {
                if (globalMax === Infinity) return;
                const args = [];
                for (let idx = 0; idx <= globalMax; idx++) {
                    args.push(`var_${idx}`);
                }
                const decls = overloads[0].params.map((p, idx) => `var_${idx} = ${getSafeLiteralForType(p.type, idx)};`).join('\n');
                const code = `${decls}\n${name}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err, `Should fail with too many args for ${name}`);
            });

            test('4. validates correct argument count with literals', () => {
                const args = overloads[0].params.map((p, idx) => getSafeLiteralForType(p.type, idx));
                const code = `${name}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.strictEqual(err, undefined);
            });

            test('5. rejects too few arguments with literals', () => {
                if (globalMin === 0) return;
                const args = [];
                for (let idx = 0; idx < globalMin - 1; idx++) {
                    args.push(getSafeLiteralForType(overloads[0].params[idx]?.type, idx));
                }
                const code = `${name}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err, `Should fail with too few args for ${name}`);
            });

            test('6. rejects too many arguments with literals', () => {
                if (globalMax === Infinity) return;
                const args = [];
                for (let idx = 0; idx <= globalMax; idx++) {
                    args.push(getSafeLiteralForType(overloads[0].params[idx]?.type || 'string', idx));
                }
                const code = `${name}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err, `Should fail with too many args for ${name}`);
            });

            test('7. rejects trailing comma with variables', () => {
                const args = [];
                const limit = firstMin === 0 ? overloads[0].params.length : firstMin;
                for (let idx = 0; idx < limit; idx++) {
                    args.push(`var_${idx}`);
                }
                const decls = overloads[0].params.map((p, idx) => `var_${idx} = ${getSafeLiteralForType(p.type, idx)};`).join('\n');
                const code = `${decls}\n${name}(${args.join(', ')}, );\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
                assert.ok(err);
            });

            test('8. rejects trailing comma with literals', () => {
                const args = [];
                const limit = firstMin === 0 ? overloads[0].params.length : firstMin;
                for (let idx = 0; idx < limit; idx++) {
                    args.push(getSafeLiteralForType(overloads[0].params[idx]?.type, idx));
                }
                const code = `${name}(${args.join(', ')}, );\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
                assert.ok(err);
            });

            test('9. validates case insensitivity with variables', () => {
                const upperName = name.toUpperCase();
                const args = overloads[0].params.map((p, idx) => `var_${idx}`);
                const decls = overloads[0].params.map((p, idx) => `var_${idx} = ${getSafeLiteralForType(p.type, idx)};`).join('\n');
                const code = `${decls}\n${upperName}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-unknown-function' || d.code === 'bml-function-arg-count');
                assert.strictEqual(err, undefined);
            });

            test('10. validates case insensitivity with literals', () => {
                const upperName = name.toUpperCase();
                const args = overloads[0].params.map((p, idx) => getSafeLiteralForType(p.type, idx));
                const code = `${upperName}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-unknown-function' || d.code === 'bml-function-arg-count');
                assert.strictEqual(err, undefined);
            });

            test('11. ignores namespace suffix in bare calls with variables', () => {
                const suffixedName = `${name}.invalid`;
                const args = overloads[0].params.map((p, idx) => `var_${idx}`);
                const decls = overloads[0].params.map((p, idx) => `var_${idx} = ${getSafeLiteralForType(p.type, idx)};`).join('\n');
                const code = `${decls}\n${suffixedName}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-unknown-function');
                assert.strictEqual(err, undefined);
            });

            test('12. ignores namespace suffix in bare calls with literals', () => {
                const suffixedName = `${name}.invalid`;
                const args = overloads[0].params.map((p, idx) => getSafeLiteralForType(p.type, idx));
                const code = `${suffixedName}(${args.join(', ')});\nreturn "";`;
                const diagnostics = lintText(code);
                const err = diagnostics.find(d => d.code === 'bml-unknown-function');
                assert.strictEqual(err, undefined);
            });
        });
    });
}

module.exports = { runDynamicTestsForCategory };
