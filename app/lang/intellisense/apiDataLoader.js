"use strict";
const fs = require("fs");
const path = require("path");

let _cached = null;

/**
 * Parses app/lang/intellisense/bml_functions_api_usage.json (~200KB) exactly
 * once per extension-host session and shares the result across the linter
 * (lint/functions.js) and beautifier (beautify/bml/tokenizer.js), instead of
 * each independently reading and JSON.parse-ing its own copy of the same file.
 *
 * @param {string} [extensionPath] - context.extensionPath, when available (most reliable).
 */
function loadBuiltInFunctionsJson(extensionPath) {
  if (_cached) return _cached;

  // Two __dirname-relative candidates since __dirname differs between
  // unbundled source (this file's own directory) and the esbuild bundle,
  // where everything is concatenated into dist/extension.js.
  const candidates = [
    extensionPath && path.join(extensionPath, "app", "lang", "intellisense", "bml_functions_api_usage.json"),
    path.join(__dirname, "bml_functions_api_usage.json"),
    path.join(__dirname, "../app/lang/intellisense/bml_functions_api_usage.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      _cached = JSON.parse(fs.readFileSync(candidate, "utf8"));
      return _cached;
    } catch (_) {
      // try next candidate
    }
  }
  _cached = {};
  return _cached;
}

module.exports = { loadBuiltInFunctionsJson };
