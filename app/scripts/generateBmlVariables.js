'use strict';
/**
 * generateBmlVariables.js
 *
 * Reads:  app/lookups/bml/commonVariables.json
 * Writes: app/lang/intellisense/bml_variables_api_usage.json
 *
 * Transforms each BML system/common variable from the lookup format:
 *   { lookupCode, displayLabel, description, dataType: { displayLabel } }
 * into the intellisense hover/completion format:
 *   { [lookupCode]: { scope, dataType, syntax, notes, examples[] } }
 *
 * These are site-level system variables available in all BML scripts,
 * e.g. _user_name, _current_date, _site_url, _user_email, etc. "scope" and
 * "dataType" are kept as their own fields (not flattened into a "[BML
 * Variable] [String] ..." prefix on notes) so the hover/completion UI can
 * render them directly instead of re-parsing them out of plain text.
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '../..');
const INPUT_PATH  = path.join(ROOT, 'app', 'lookups', 'bml', 'commonVariables.json');
const OUTPUT_PATH = path.join(ROOT, 'app', 'lang', 'intellisense', 'bml_variables_api_usage.json');

function transform(items) {
    const result = {};
    for (const item of items) {
        const key = item.lookupCode;
        if (!key) continue;

        const dataType = item.dataType ? item.dataType.displayLabel : 'String';
        const label    = item.displayLabel || key;
        const desc     = item.description  || label;

        result[key] = {
            scope:    'BML Variable',
            dataType: dataType,
            syntax:   key,
            examples: [],
            notes:    desc
        };
    }
    return result;
}

function run() {
    console.log(`[generateBmlVariables] Reading: ${path.relative(ROOT, INPUT_PATH)}`);
    const raw    = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    const items  = raw.items || [];
    const output = transform(items);

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 4), 'utf8');
    console.log(`[generateBmlVariables] ✔ ${Object.keys(output).length} variables → ${path.relative(ROOT, OUTPUT_PATH)}`);
}

run();
