'use strict';
/**
 * generateBmlFunctions.js
 *
 * Reads:  app/lookups/bml/common.json
 * Writes: app/lang/intellisense/bml_functions_api_usage.json
 *
 * Transforms each BML built-in function from the canonical lookup format:
 *   { name, category, description, syntax, example, shortSyntax }
 * into the intellisense hover/completion format:
 *   { [name]: { functionCategory, returnType, fullSignature, syntax, notes, examples[] } }
 *
 * Unlike the previous version, this keeps "category" (STRING/MATH/DATE/...) and
 * the return type as their own fields instead of discarding them - that lets
 * the hover/completion UI render them directly instead of re-deriving them.
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '../..');
const INPUT_PATH  = path.join(ROOT, 'app', 'lookups', 'bml', 'common.json');
const OUTPUT_PATH = path.join(ROOT, 'app', 'lang', 'intellisense', 'bml_functions_api_usage.json');

function stripHtml(str) {
    if (!str) return '';
    return str
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&lt;/g,  '<')
        .replace(/&gt;/g,  '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/&euro;/g, '€')
        .replace(/<\/?(b|strong)>/gi, '')
        .replace(/<\/?(i|em)>/gi, '')
        .replace(/<\/?(tt|code)>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Build a VS Code snippet syntax string from the shortSyntax field.
 * e.g. "atof(str)" → "atof(${1:str})"
 *      "round(x,y)" → "round(${1:x}, ${2:y})"
 */
function toSnippetSyntax(shortSyntax) {
    if (!shortSyntax) return '';
    let idx = 1;
    return shortSyntax.replace(/\(([^)]*)\)/, (_, params) => {
        if (!params.trim()) return '()';
        const parts = params.split(',').map(p => {
            const name = p.trim();
            return `\${${idx++}:${name}}`;
        });
        return `(${parts.join(', ')})`;
    });
}

/**
 * Pulls the return type off the front of a full signature like
 * "Float atof(String str)" or "String[][] gettabledata(...)". Returns
 * undefined for entries whose syntax isn't a real call signature (e.g. the
 * "if...", "if...else" control-flow reference entries also live in this file).
 */
function extractReturnType(fullSignature) {
    const match = (fullSignature || '').match(/^(\w+(?:\[\])*)\s+\w+\(/);
    return match ? match[1] : undefined;
}

function transform(items) {
    const result = {};
    for (const item of items) {
        const key = item.name;
        if (!key) continue;
        const fullSignature = stripHtml(item.syntax || '');
        result[key] = {
            functionCategory: item.category ? item.category.toLowerCase() : undefined,
            returnType:       extractReturnType(fullSignature),
            fullSignature:    fullSignature || undefined,
            syntax:           toSnippetSyntax(item.shortSyntax || item.name),
            examples:         item.example ? [stripHtml(item.example)] : [],
            notes:            stripHtml(item.description || '')
        };
    }
    return result;
}

function run() {
    console.log(`[generateBmlFunctions] Reading: ${path.relative(ROOT, INPUT_PATH)}`);
    const raw    = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    const items  = raw.items || [];
    const output = transform(items);

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 4), 'utf8');
    console.log(`[generateBmlFunctions] ✔ ${Object.keys(output).length} functions → ${path.relative(ROOT, OUTPUT_PATH)}`);
}

run();
