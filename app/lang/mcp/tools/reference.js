const {
    loadBuiltInFunctionsJson,
    loadCpqJsApiJson,
    loadBuiltInAttributesJson,
    loadUtilAttributesJson,
    loadVariablesJson,
    loadCustomSnippetsJson,
} = require('../../intellisense/apiDataLoader');

// Every category this tool can search, in the order results get merged in.
// Matches the same JSON files apiDataLoader.js already serves to the
// hover/completion providers - this tool just exposes that same reference
// data to an AI agent directly, instead of it having to guess BML syntax.
const CATEGORIES = [
    { category: 'function', load: loadBuiltInFunctionsJson },
    { category: 'cpqjs', load: loadCpqJsApiJson },
    { category: 'attribute', load: loadBuiltInAttributesJson },
    { category: 'utilAttribute', load: loadUtilAttributesJson },
    { category: 'variable', load: loadVariablesJson },
    { category: 'snippet', load: loadCustomSnippetsJson },
];

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * lookup_bml_reference
 *
 * Looks up built-in BML functions/attributes/system variables/snippets by
 * exact name, or browses a category (optionally filtered by attribute
 * scope) when no name is given. Works fully offline - reads the same
 * generated intellisense JSON the editor's own hover/completion uses, so an
 * AI agent can check real syntax/return types/valid attributes instead of
 * guessing.
 */
async function lookupBmlReference(context, vscode, args) {
    const { name, category, scope, limit } = args || {};

    if (!name && !category && !scope) {
        return { success: false, error: 'Provide at least one of: name, category, scope.' };
    }
    if (category && !CATEGORIES.some((c) => c.category === category)) {
        return {
            success: false,
            error: `Unknown category "${category}". Valid categories: ${CATEGORIES.map((c) => c.category).join(', ')}.`,
        };
    }

    const cappedLimit = Math.max(1, Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT));
    const nameLower = name ? name.toLowerCase() : null;
    const results = [];
    let truncated = false;

    for (const { category: cat, load } of CATEGORIES) {
        if (category && category !== cat) continue;

        let data;
        try {
            data = load(context.extensionPath);
        } catch (e) {
            continue; // that JSON failed to load - skip, don't fail the whole lookup
        }

        for (const [key, info] of Object.entries(data)) {
            if (nameLower && key.toLowerCase() !== nameLower) continue;
            if (scope && info.scope !== scope) continue;

            if (results.length >= cappedLimit) {
                truncated = true;
                break;
            }
            results.push({ name: key, category: cat, ...info });
        }
        if (truncated) break;
    }

    return {
        success: true,
        query: { name, category, scope },
        count: results.length,
        truncated,
        results,
    };
}

module.exports = { lookupBmlReference };
