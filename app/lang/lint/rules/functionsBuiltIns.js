const {
  parseParameterSignature,
  splitArgumentsList,
} = require("./functionSignature");
const { levenshtein } = require('../core/levenshtein');
const { inferLiteralType, inferExpressionType } = require("./typeCheck");
const { loadJson } = require('../../intellisense/apiDataLoader');

function inferArgumentType(argText, firstTypeByVar, returnTypes) {
  if (!argText) return null;
  const trimmed = argText.trim();
  if (!trimmed) return null;

  const lit = inferLiteralType(trimmed);
  if (lit) return lit;

  if (/^[a-zA-Z_]\w*$/.test(trimmed)) {
    const keyLower = trimmed.toLowerCase();
    if (firstTypeByVar) {
      const entry = firstTypeByVar.get(keyLower) || firstTypeByVar.get(trimmed);
      if (entry && entry.type) return entry.type;
    }
    if (/^(true|false)$/i.test(trimmed)) return "Boolean";
    if (/^null$/i.test(trimmed)) return "Null";
  }

  return inferExpressionType(trimmed);
}

let builtInFunctions = null;
const controlKeywords = new Set([
  "if",
  "elif",
  "else",
  "for",
  "in",
  "break",
  "continue",
  "return",
  "true",
  "false",
  "null",
  "and",
  "or",
  "not",
  "bmql",
]);
const keywords = new Set([
  ...controlKeywords,
  "string",
  "integer",
  "float",
  "boolean",
  "date",
  "json",
  "jsonarray",
  "jsonnull",
  "jnan",
  "bytearray",
  "record",
  "recordset",
  "stringbuilder",
  "dictionary",
  "dict",
]);
const storageTypeNames = new Set(["float", "boolean", "date", "record", "dictionary", "dict", "stringbuilder", "jsonnull"]);
const deprecated = new Set(["strtodate", "gettabledata", "getpartsdata"]);

function parseSyntax(syntax) {
  const { min, max } = parseParameterSignature(syntax);
  return { min, max };
}

let cachedBuiltIns = null;

function loadBuiltInFunctions(extensionPath) {
  if (cachedBuiltIns) return cachedBuiltIns;
  builtInFunctions = new Map();
  try {
    const data = loadJson('bml-functions-api-usage', extensionPath);
    if (data) {
      Object.keys(data).forEach((name) => {
        const item = data[name];
        if (item && item.fullSignature && item.fullSignature.includes("(")) {
          const nameLower = name.toLowerCase();
          const overloads = item.fullSignature.split(
            /\s+OR\s+|\r?\n\s*\(or\)\s*\r?\n/i,
          );
          const parsedOverloads = overloads.map((sig) => {
            return parseParameterSignature(sig);
          });
          const first = parsedOverloads[0];
          builtInFunctions.set(nameLower, {
            overloads: parsedOverloads,
            min: first.min,
            max: first.max,
            params: first.params,
            syntax: item.fullSignature,
            name,
          });
        }
      });
    }
  } catch (e) {
    // Fallback to empty map if file can't be loaded
  }

  const FALLBACK_BUILTINS = {
    append: {
      name: "append",
      syntax: "append(Array array, Any element)",
      overloads: [
        { min: 2, max: 2, params: [{ type: "Array" }, { type: "Any" }] },
      ],
    },
    findinarray: {
      name: "findinarray",
      syntax: "findinarray(Array array, Any element)",
      overloads: [
        { min: 2, max: 2, params: [{ type: "Array" }, { type: "Any" }] },
      ],
    },
    max: {
      name: "max",
      syntax: "max(Array array) OR max(Float num1, Float num2)",
      overloads: [
        { min: 1, max: 1, params: [{ type: "Array" }] },
        { min: 2, max: 2, params: [{ type: "Float" }, { type: "Float" }] },
      ],
    },
    min: {
      name: "min",
      syntax: "min(Array array) OR min(Float num1, Float num2)",
      overloads: [
        { min: 1, max: 1, params: [{ type: "Array" }] },
        { min: 2, max: 2, params: [{ type: "Float" }, { type: "Float" }] },
      ],
    },
    clear: {
      name: "clear",
      syntax: "clear(Dictionary dictionary)",
      overloads: [{ min: 1, max: 1, params: [{ type: "Dictionary" }] }],
    },
    size: {
      name: "size",
      syntax: "size(Dictionary dictionary)",
      overloads: [{ min: 1, max: 1, params: [{ type: "Dictionary" }] }],
    },
    removexmlnode: {
      name: "removexmlnode",
      syntax: "removexmlnode(String xmlString, String xpath)",
      overloads: [
        { min: 2, max: 2, params: [{ type: "String" }, { type: "String" }] },
      ],
    },
    appendxmlnode: {
      name: "appendxmlnode",
      syntax:
        "appendxmlnode(String xmlString, String parentXpath, String nodeXml)",
      overloads: [
        {
          min: 3,
          max: 3,
          params: [{ type: "String" }, { type: "String" }, { type: "String" }],
        },
      ],
    },
    getarraystr: {
      name: "getarraystr",
      syntax: "getarraystr(String arrayIdentifier)",
      overloads: [{ min: 1, max: 1, params: [{ type: "String" }] }],
    },
    sbappend: {
      name: "sbappend",
      syntax: "sbappend(StringBuilder sb, String text)",
      overloads: [
        {
          min: 0,
          max: Infinity,
          params: [{ type: "StringBuilder" }, { type: "String" }],
        },
      ],
    },
    validatequoteforagreement: {
      name: "validatequoteforagreement",
      syntax: "validatequoteforagreement()",
      overloads: [{ min: 0, max: 0, params: [] }],
    },
    addpartstotransaction: {
      name: "addpartstotransaction",
      syntax: "addpartstotransaction(JsonArray parts)",
      overloads: [
        { min: 1, max: 1, params: [{ type: ["JsonArray", "Json", "String"] }] },
      ],
    },
  };

  for (const [key, val] of Object.entries(FALLBACK_BUILTINS)) {
    const existing = builtInFunctions.get(key);
    if (!existing || !existing.params) {
      builtInFunctions.set(key, val);
    }
  }

  cachedBuiltIns = builtInFunctions;
  return builtInFunctions;
}

function getArgumentsTextAndEnd(text, startIndex) {
  let depth = 1;
  for (let i = startIndex; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode === 40)
      depth++; // '('
    else if (charCode === 41) {
      // ')'
      depth--;
      if (depth === 0) {
        return {
          text: text.substring(startIndex, i),
          endIndex: i,
        };
      }
    }
  }
  return null;
}

function countArguments(argsText) {
  if (!argsText || !argsText.trim()) return 0;
  const args = splitArgumentsList(argsText);
  return args.filter((a) => a.trim().length > 0).length;
}

function findClosestBuiltInFunction(name, builtIns) {
  const nameLower = name.toLowerCase();
  const nameLen = nameLower.length;
  let best = null;
  let bestDist = Infinity;
  for (const [lower, info] of builtIns.entries()) {
    if (Math.abs(lower.length - nameLen) > 2) continue;
    const dist = levenshtein(nameLower, lower);
    if (dist < bestDist) {
      bestDist = dist;
      best = info.name;
    }
  }
  return best && bestDist <= 2 && bestDist > 0 ? best : null;
}

function findClosestWorkspaceFunction(fullName, wsFunctions) {
  const fullNameLower = fullName.toLowerCase();
  const fullNameLen = fullNameLower.length;
  let best = null;
  let bestDist = Infinity;
  for (const key of wsFunctions.keys()) {
    if (Math.abs(key.length - fullNameLen) > 2) continue;
    const dist = levenshtein(fullNameLower, key);
    if (dist < bestDist) {
      bestDist = dist;
      const target = wsFunctions.get(key);
      best = `${target.namespace}.${target.name}`;
    }
  }
  return best && bestDist <= 2 && bestDist > 0 ? best : null;
}

function normalizeType(type) {
  if (!type) return null;
  let clean = type.toLowerCase().trim();
  if (
    clean.startsWith("dict(") ||
    clean.startsWith("dictionary(") ||
    clean.startsWith("dict<") ||
    clean.startsWith("dictionary<")
  ) {
    clean = clean.startsWith("dict") ? "dict" : "dictionary";
  }
  const match = clean.match(/^([a-z_]\w*)((?:\[\])*)$/);
  if (!match) return clean;
  return `${match[1]}${match[2]}`;
}

// Numeric types (Integer, Float, Number, Long, Double, Currency, Percent) are accepted for Float/Number/Numeric parameters; everything else must match.
function argumentTypeCompatible(expectedType, actualType) {
  if (!expectedType || !actualType) return true;
  if (Array.isArray(expectedType)) {
    return expectedType.some((exp) => argumentTypeCompatible(exp, actualType));
  }
  const expected = normalizeType(expectedType);
  const actual = normalizeType(actualType);
  if (
    expected === "any" ||
    expected === "anytype" ||
    expected === "object" ||
    expected === "valuetype"
  )
    return true;
  if (actual === "any" || actual === "anytype" || actual === "object")
    return true;
  if (expected === actual) return true;
  if (
    (expected === "string" || expected === "text") &&
    (actual === "string" || actual === "text")
  )
    return true;

  const NUMERIC_TYPES = new Set(['integer', 'float', 'long', 'double', 'number', 'numeric', 'currency', 'percent']);
  const FLOAT_LIKE = new Set(['float', 'double', 'number', 'numeric', 'currency', 'percent', 'long']);
  if (FLOAT_LIKE.has(expected) && NUMERIC_TYPES.has(actual)) return true;
  if (expected === "integer" && (actual === "integer" || actual === "number")) return true;
  if (expected === "long" && (actual === "integer" || actual === "long" || actual === "number")) return true;

  if (expected === "array" && actual.endsWith("[]")) return true;
  if (
    expected === "singlearray" &&
    actual.endsWith("[]") &&
    !actual.endsWith("[][]")
  )
    return true;
  if (expected === "doublearray" && actual.endsWith("[][]")) return true;
  if (
    (expected === "dictionary" || expected === "dict") &&
    (actual === "dict" || actual === "dictionary")
  )
    return true;
  if (expected === "function" && (actual === "string" || actual === "function"))
    return true;
  return false;
}

module.exports = {
  inferArgumentType,
  controlKeywords,
  keywords,
  storageTypeNames,
  deprecated,
  parseSyntax,
  loadBuiltInFunctions,
  getArgumentsTextAndEnd,
  countArguments,
  findClosestBuiltInFunction,
  findClosestWorkspaceFunction,
  normalizeType,
  argumentTypeCompatible
};
