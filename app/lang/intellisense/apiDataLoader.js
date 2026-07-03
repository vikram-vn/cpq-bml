"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ── Per-file cache ──────────────────────────────────────────────────────────
const _cache = Object.create(null);

/**
 * Loads a brotli-compressed intellisense JSON file (.json.br), falling back
 * to the uncompressed .json when the .br is absent (e.g. unit-test runs that
 * skip the build step). Results are cached by filename for the lifetime of
 * the extension host process.
 *
 * @param {string} baseName      - Filename WITHOUT any extension,
 *                                 e.g. "bml_functions_api_usage"
 * @param {string} [extPath]     - context.extensionPath (most reliable root).
 * @returns {object|Array}
 */
function loadJson(baseName, extPath) {
    if (_cache[baseName]) return _cache[baseName];

    const jsonFile = `${baseName}.json`;
    const brFile   = `${baseName}.json.br`;
    const relDir   = path.join("app", "lang", "intellisense");

    const candidates = [
        // Compressed variant (preferred — ships in .vsix)
        extPath && path.join(extPath, relDir, brFile),
        path.join(__dirname, brFile),
        path.join(__dirname, "..", relDir, brFile),
        // Uncompressed fallback for dev / test runs without a build step
        extPath && path.join(extPath, relDir, jsonFile),
        path.join(__dirname, jsonFile),
        path.join(__dirname, "..", relDir, jsonFile),
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            const raw  = fs.readFileSync(candidate);
            const text = candidate.endsWith(".br")
                ? zlib.brotliDecompressSync(raw).toString("utf8")
                : raw.toString("utf8");
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

/** BML built-in functions (~196 KB raw, ~32 KB brotli) */
function loadBuiltInFunctionsJson(extPath) {
    return loadJson("bml_functions_api_usage", extPath);
}

/** BML attribute definitions (~188 KB raw, ~17 KB brotli) */
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
    loadBuiltInFunctionsJson,
    loadBuiltInAttributesJson,
    loadCpqJsApiJson,
    loadUtilAttributesJson,
    loadVariablesJson,
    loadCustomSnippetsJson,
    loadFunctionParamDataTypesJson,
    loadFunctionReturnTypesJson,
};
