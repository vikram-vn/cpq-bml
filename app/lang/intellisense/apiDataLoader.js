"use strict";
const fs = require("fs");
const path = require("path");

// ── Per-file cache ──────────────────────────────────────────────────────────
const _cache = Object.create(null);

/**
 * Drops all cached parsed JSON so the next loadJson() call re-reads from disk.
 * Used by index.js's file watcher after `yarn generate:intellisense` rewrites
 * these files while the extension host is running.
 */
function invalidateCache() {
    for (const key of Object.keys(_cache)) {
        delete _cache[key];
    }
}

/**
 * Loads a minified intellisense JSON file (.min.json, produced by
 * scripts/build/minify_json.py), falling back to the pretty .json when the
 * .min.json is absent (e.g. unit-test runs that skip the build step).
 * Results are cached by filename for the lifetime of the extension host
 * process.
 *
 * @param {string} baseName      - Filename WITHOUT any extension,
 *                                 e.g. "bml_functions_api_usage"
 * @param {string} [extPath]     - context.extensionPath (most reliable root).
 * @returns {object|Array}
 */
function loadJson(baseName, extPath) {
    if (_cache[baseName]) return _cache[baseName];

    const minFile  = `${baseName}.min.json`;
    const jsonFile = `${baseName}.json`;
    const relDir   = path.join("app", "lang", "intellisense");

    const candidates = [
        // Minified variant (preferred — ships in .vsix)
        extPath && path.join(extPath, relDir, minFile),
        path.join(__dirname, minFile),
        path.join(__dirname, "..", relDir, minFile),
        // Pretty fallback for dev / test runs without a build step
        extPath && path.join(extPath, relDir, jsonFile),
        path.join(__dirname, jsonFile),
        path.join(__dirname, "..", relDir, jsonFile),
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            const text = fs.readFileSync(candidate, "utf8");
            _cache[baseName] = JSON.parse(text);
            return _cache[baseName];
        } catch (_) {
            // try next candidate
        }
    }

    _cache[baseName] = {};
    return _cache[baseName];
}

// ── Named convenience exports (one per JSON file) ───────────────────────────

/** BML built-in functions, including per-function doc excerpts */
function loadBuiltInFunctionsJson(extPath) {
    return loadJson("bml_functions_api_usage", extPath);
}

/** BML attribute definitions */
function loadBuiltInAttributesJson(extPath) {
    return loadJson("bml_attributes_api_usage", extPath);
}

/** CPQ JS API usage data */
function loadCpqJsApiJson(extPath) {
    return loadJson("bml_cpq_js_api_usage", extPath);
}

/** Util library attribute definitions */
function loadUtilAttributesJson(extPath) {
    return loadJson("bml_util_attributes_api_usage", extPath);
}

/** BML system variables */
function loadVariablesJson(extPath) {
    return loadJson("bml_variables_api_usage", extPath);
}

/** Custom user snippets */
function loadCustomSnippetsJson(extPath) {
    return loadJson("custom_snippets", extPath);
}

/** Function parameter data type metadata */
function loadFunctionParamDataTypesJson(extPath) {
    return loadJson("functionParamDataTypes", extPath);
}

/** Function return type metadata */
function loadFunctionReturnTypesJson(extPath) {
    return loadJson("functionReturnTypes", extPath);
}

module.exports = {
    loadJson,
    invalidateCache,
    loadBuiltInFunctionsJson,
    loadBuiltInAttributesJson,
    loadCpqJsApiJson,
    loadUtilAttributesJson,
    loadVariablesJson,
    loadCustomSnippetsJson,
    loadFunctionParamDataTypesJson,
    loadFunctionReturnTypesJson,
};
