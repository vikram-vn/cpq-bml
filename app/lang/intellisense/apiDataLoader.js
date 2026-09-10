"use strict";
const fs = require("fs");
const path = require("path");

// ── Per-file cache ──────────────────────────────────────────────────────────
const _cache = Object.create(null);
let _resolvedBaseDir = null;

// Drops cached JSON data so next loadJson() re-reads from disk.
function invalidateCache() {
    for (const key of Object.keys(_cache)) {
        delete _cache[key];
    }
    _resolvedBaseDir = null;
}

// Loads minified or fallback JSON data, cached by filename.
function loadJson(baseName, extPath) {
    if (_cache[baseName] && Object.keys(_cache[baseName]).length > 0) return _cache[baseName];

    const minFile  = `${baseName}.min.json`;
    const jsonFile = `${baseName}.json`;
    const relDir   = path.join("app", "lang", "intellisense");

    // Fast path: check previously resolved directory first
    if (_resolvedBaseDir) {
        const minCandidate = path.join(_resolvedBaseDir, minFile);
        try {
            const text = fs.readFileSync(minCandidate, "utf8");
            _cache[baseName] = JSON.parse(text);
            return _cache[baseName];
        } catch (_) {}

        const jsonCandidate = path.join(_resolvedBaseDir, jsonFile);
        try {
            const text = fs.readFileSync(jsonCandidate, "utf8");
            _cache[baseName] = JSON.parse(text);
            return _cache[baseName];
        } catch (_) {}
    }

    // Candidate directories to probe (prefer __dirname first)
    const candidateDirs = [
        __dirname,
        extPath && path.join(extPath, relDir),
        path.join(process.cwd(), relDir),
        extPath && path.join(extPath, "app", "lang", "snippets"),
        path.join(process.cwd(), "app", "lang", "snippets"),
        path.join(__dirname, "..", "snippets"),
        path.join(__dirname, "..", relDir)
    ].filter(Boolean);

    for (const dir of candidateDirs) {
        for (const file of [minFile, jsonFile]) {
            const candidate = path.join(dir, file);
            try {
                const text = fs.readFileSync(candidate, "utf8");
                _cache[baseName] = JSON.parse(text);
                _resolvedBaseDir = dir;
                return _cache[baseName];
            } catch (_) {
                // try next
            }
        }
    }

    _cache[baseName] = {};
    return _cache[baseName];
}

// Named convenience exports (one per JSON file)

// BML built-in functions
function loadBuiltInFunctionsJson(extPath) {
    return loadJson("bml-functions-api-usage", extPath);
}

// BML attribute definitions
function loadBuiltInAttributesJson(extPath) {
    return loadJson("bml-attributes-api-usage", extPath);
}

// CPQ JS API usage data
function loadCpqJsApiJson(extPath) {
    return loadJson("bml-cpq-js-api-usage", extPath);
}

// Util library attribute definitions
function loadUtilAttributesJson(extPath) {
    return loadJson("bml-util-attributes-api-usage", extPath);
}

// BML system variables
function loadVariablesJson(extPath) {
    return loadJson("bml-variables-api-usage", extPath);
}

// Custom user snippets
function loadCustomSnippetsJson(extPath) {
    return loadJson("custom-snippets", extPath);
}

// Function parameter data type metadata
function loadFunctionParamDataTypesJson(extPath) {
    return loadJson("function-param-data-types", extPath);
}

// Function return type metadata
function loadFunctionReturnTypesJson(extPath) {
    return loadJson("function-return-types", extPath);
}

// Best practice advisories
function loadBestPracticeAdvisoriesJson(extPath) {
    return loadJson("best-practice-advisories", extPath);
}

// Keyword hovers
function loadKeywordHoversJson(extPath) {
    return loadJson("keyword-hovers", extPath);
}

// Category labels
function loadCategoryLabelsJson(extPath) {
    return loadJson("category-labels", extPath);
}

// Curated parameter names
function loadCuratedParamsJson(extPath) {
    return loadJson("curated-params", extPath);
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
    loadBestPracticeAdvisoriesJson,
    loadKeywordHoversJson,
    loadCategoryLabelsJson,
    loadCuratedParamsJson
};
