'use strict';
/**
 * generateBmlAttributes.js
 *
 * Reads:
 *   - app/lookups/commerce/transaction.json     (transaction-level attributes)
 *   - app/lookups/commerce/transactionLine.json (line-item-level attributes)
 *   - app/lookups/commerce/systemVariables.json (commerce system variables)
 *
 * Writes: app/lang/intellisense/bml_attributes_api_usage.json
 *
 * Transforms each attribute from the lookup format:
 *   { name, description, displayLabel, dataType: { displayValue } }
 * into the intellisense hover/completion format:
 *   { [name]: { scope, dataType, syntax, notes, examples[], values? } }
 *
 * Attributes from transaction.json get scope "Transaction", transactionLine.json
 * get "Line Item", systemVariables.json get "System". "scope"/"dataType" are kept
 * as their own fields (not flattened into a "[Transaction] [String] ..." prefix
 * on notes), and menu-type attributes keep their valid values as a real "values"
 * array instead of an appended "Values: a, b, c" text blob.
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '../..');
const COMMERCE    = path.join(ROOT, 'app', 'lookups', 'commerce');
const OUTPUT_PATH = path.join(ROOT, 'app', 'lang', 'intellisense', 'bml_attributes_api_usage.json');

const SOURCES = [
    { file: path.join(COMMERCE, 'transaction.json'),     context: 'Transaction' },
    { file: path.join(COMMERCE, 'transactionLine.json'), context: 'Line Item' },
    { file: path.join(COMMERCE, 'systemVariables.json'), context: 'System' }
];

function getDataType(item) {
    if (!item.dataType) return 'String';
    return item.dataType.displayValue || item.dataType.displayLabel || 'String';
}

function getMenuValues(item) {
    if (!item.isMenuType || !Array.isArray(item.availableElements) || item.availableElements.length === 0) {
        return undefined;
    }
    return item.availableElements
        .map(e => e.displayValue || e.value)
        .slice(0, 10); // cap long menus
}

function transformItems(items, context) {
    const result = {};
    for (const item of items) {
        const key = item.name;
        if (!key) continue;
        result[key] = {
            scope:    context,
            dataType: getDataType(item),
            syntax:   key,
            examples: [],
            notes:    item.description || item.displayLabel || '',
            values:   getMenuValues(item)
        };
    }
    return result;
}

function run() {
    const output = {};

    for (const { file, context } of SOURCES) {
        if (!fs.existsSync(file)) {
            console.warn(`[generateBmlAttributes] ⚠ File not found, skipping: ${path.relative(ROOT, file)}`);
            continue;
        }
        console.log(`[generateBmlAttributes] Reading [${context}]: ${path.relative(ROOT, file)}`);
        const raw   = JSON.parse(fs.readFileSync(file, 'utf8'));
        const items = raw.items || [];
        const chunk = transformItems(items, context);
        Object.assign(output, chunk);
        console.log(`[generateBmlAttributes]   → ${items.length} items from ${path.basename(file)}`);
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 4), 'utf8');
    console.log(`[generateBmlAttributes] ✔ ${Object.keys(output).length} attributes → ${path.relative(ROOT, OUTPUT_PATH)}`);
}

run();
