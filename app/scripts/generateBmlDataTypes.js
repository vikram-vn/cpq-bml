'use strict';
/**
 * generateBmlDataTypes.js
 *
 * Reads:  app/lookups/bml/functionParamDataTypes.json
 *         app/lookups/bml/functionReturnTypes.json
 * Writes: app/lang/intellisense/functionParamDataTypes.json
 *         app/lang/intellisense/functionReturnTypes.json
 *
 * Transforms each Oracle lookupCode -> displayLabel table from the lookup
 * format:
 *   { items: [{ lookupCode, displayLabel }] }
 * into a plain object keyed by the (string) lookupCode:
 *   { [lookupCode]: displayLabel }
 *
 * Param and return type codes use *different* numbering for the same label
 * (e.g. param Boolean = 0, return Boolean = 4), which is why both tables are
 * kept and generated separately rather than merged into one.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const LOOKUPS_DIR = path.join(ROOT, 'app', 'lookups', 'bml');
const OUTPUT_DIR  = path.join(ROOT, 'app', 'lang', 'intellisense');

const FILES = ['functionParamDataTypes.json', 'functionReturnTypes.json'];

function transform(items) {
    const result = {};
    for (const item of items) {
        if (typeof item.lookupCode !== 'number') continue;
        result[item.lookupCode] = item.displayLabel;
    }
    return result;
}

function run() {
    for (const fileName of FILES) {
        const inputPath  = path.join(LOOKUPS_DIR, fileName);
        const outputPath = path.join(OUTPUT_DIR, fileName);

        console.log(`[generateBmlDataTypes] Reading: ${path.relative(ROOT, inputPath)}`);
        const raw   = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        const items = raw.items || [];
        const output = transform(items);

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 4), 'utf8');
        console.log(`[generateBmlDataTypes] ✔ ${Object.keys(output).length} entries → ${path.relative(ROOT, outputPath)}`);
    }
}

run();
