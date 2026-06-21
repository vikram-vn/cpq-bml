'use strict';
/**
 * generateBmlUtilAttributes.js
 *
 * Reads:
 *   - app/lookups/configuration/attributes.json            (configuration attributes)
 *   - app/lookups/configuration/productFamilyAttributes.json (product family attributes)
 *
 * Writes: app/lang/intellisense/bml_util_attributes_api_usage.json
 *
 * Transforms each configuration attribute from the lookup format:
 *   { variableName, displayLabel, description, dataType }
 * into the intellisense hover/completion format:
 *   { [variableName]: { scope, dataType, syntax, notes, examples[] } }
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '../..');
const CONFIG        = path.join(ROOT, 'app', 'lookups', 'configuration');
const OUTPUT_PATH   = path.join(ROOT, 'app', 'lang', 'intellisense', 'bml_util_attributes_api_usage.json');

const SOURCES = [
    { file: path.join(CONFIG, 'attributes.json'),              context: 'Configuration' },
    { file: path.join(CONFIG, 'productFamilyAttributes.json'), context: 'Product Family' }
];

function getDataType(item) {
    // configuration items may store dataType as string, number or object
    const dt = item.dataType;
    if (!dt) return 'String';
    if (typeof dt === 'string') return dt;
    return dt.displayValue || dt.displayLabel || String(dt);
}

function getKey(item) {
    // configuration attributes use 'variableName'; fallback to 'name'
    return item.variableName || item.name || null;
}

function transformItems(items, context) {
    const result = {};
    for (const item of items) {
        const key = getKey(item);
        if (!key) continue;

        const dataType    = getDataType(item);
        const label       = item.displayLabel || key;
        const description = item.description  || label;

        result[key] = {
            scope:    context,
            dataType: dataType,
            syntax:   key,
            examples: [],
            notes:    description
        };
    }
    return result;
}

function run() {
    const output = {};

    for (const { file, context } of SOURCES) {
        if (!fs.existsSync(file)) {
            console.warn(`[generateBmlUtilAttributes] ⚠ File not found, skipping: ${path.relative(ROOT, file)}`);
            continue;
        }
        console.log(`[generateBmlUtilAttributes] Reading [${context}]: ${path.relative(ROOT, file)}`);
        const raw   = JSON.parse(fs.readFileSync(file, 'utf8'));
        const items = raw.items || [];
        const chunk = transformItems(items, context);
        Object.assign(output, chunk);
        console.log(`[generateBmlUtilAttributes]   → ${items.length} items from ${path.basename(file)}`);
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 4), 'utf8');
    console.log(`[generateBmlUtilAttributes] ✔ ${Object.keys(output).length} util attributes → ${path.relative(ROOT, OUTPUT_PATH)}`);
}

run();
