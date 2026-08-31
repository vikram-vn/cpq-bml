const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const vscode = require("vscode");

let combinedDictionary = null;

const extraAllowed = new Set([
  "don", "can", "won", "isn", "aren", "wasn", "weren", "haven", "hasn", "hadn",
  "doesn", "didn", "couldn", "shouldn", "wouldn", "lets", "whos", "whats", "theres", "heres",
  "todo", "fixme", "bug", "bml", "cpq", "bmql", "json", "xml", "csv", "api", "url", "http",
  "https", "db", "sql", "id", "num", "str", "int", "bool", "val", "param", "params", "usr",
  "sys", "msg", "err", "temp", "tmp", "config", "util", "init", "auth", "diff", "req", "res",
  "doc", "env", "uuid", "hmac", "attr", "attrs", "ctx", "cfg", "idx", "maindoc", "subdoc",
  "recordset", "rollup", "rollups", "abocontext", "bomto", "bomitem", "bomkey", "buyside",
  "opty", "optys", "crm", "impl", "hardcoded", "pdf", "pdfs", "bmi", "jsonforpost", "atr",
  "jmb", "jsoncrit", "jsonof", "chargecount", "assetkey", "tempjson", "arrfor",
  "ldu", "documentnumber", "bsid", "atoi", "atof", "sessionid", "processname", "processvarname",
  "transactionid", "transactionname", "oraclecpqo", "customdiscountvalue", "opportunitynumber",
  "histry", "encodebase", "claz", "qval", "bomflat", "iterationquantity", "jsonin", "itemsjson",
  "basebom", "varname", "boms", "chd", "capped",
  // Common programming, cloud, and developer lexicon
  "async", "sync", "oauth", "jwt", "bearer", "token", "payload", "dto", "vo", "dao", "crud",
  "guid", "hex", "ascii", "ansi", "regex", "eval", "lint", "beautify", "minify", "serialize",
  "deserialize", "unmarshal", "sanitize", "whitelist", "blacklist", "allowlist", "denylist",
  "wildcard", "debounce", "throttle", "callback", "promise", "closure", "schema", "lookup",
  "cache", "flush", "retry", "backoff", "benchmark", "latency", "timeout", "endpoint",
  "webhook", "session", "cookie", "proxy", "middleware", "devkit", "ide", "vsix", "mcp",
  "sdk", "cli", "stdout", "stderr", "stdin", "posix", "utf", "utf8", "unicode",
  "camelcase", "snakecase", "pascalcase", "kebabcase", "boolean", "integer", "float", "string",
  "recordset", "dict", "jsonarray", "jsonpath", "urldata", "readxml", "applytemplate",
  "transformxml", "redwood", "allman", "xpath", "xslt", "metadata", "nullsafe", "refactor",
  // Currency codes
  "usd", "eur", "gbp", "cad", "aud", "jpy", "inr", "chf", "cny", "sgd", "nzd", "hkd", "sek",
  "nok", "mxn", "brl", "zar", "aed", "sar", "krw", "thb", "myr", "idr", "php", "vnd", "pln",
  "czk", "huf", "ils", "clp", "cop", "pen",
  // Common formatting terms
  "pretty", "prettily", "prettier", "prettiest"
]);

const PREFIXES = [
  "un", "re", "de", "pre", "post", "sub", "multi", "auto", "non", "co",
  "mis", "over", "under", "cross", "inter", "intra", "super", "semi", "anti",
  "meta", "micro", "macro", "mini", "maxi", "pseudo", "hyper", "in", "im", "dis"
];

function isInflectionOfKnownWord(word, dict) {
  if (word.length <= 3) return false;

  // 1. Plural / 3rd person singular: -s, -es, -ies
  if (word.endsWith("ies") && word.length > 4) {
    const root = word.slice(0, -3) + "y";
    if (dict.has(root)) return true;
  }
  if (word.endsWith("es") && word.length > 4) {
    const root = word.slice(0, -2);
    if (dict.has(root)) return true;
    const rootE = word.slice(0, -1);
    if (dict.has(rootE)) return true;
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
    const root = word.slice(0, -1);
    if (dict.has(root)) return true;
  }

  // 2. Past tense & participles: -ed, -d, -ied
  if (word.endsWith("ied") && word.length > 4) {
    const root = word.slice(0, -3) + "y";
    if (dict.has(root)) return true;
  }
  if (word.endsWith("ed") && word.length > 4) {
    const root = word.slice(0, -2);
    if (dict.has(root)) return true;
    const rootE = word.slice(0, -1);
    if (dict.has(rootE)) return true;
    if (root.length > 2 && root[root.length - 1] === root[root.length - 2]) {
      const singleRoot = root.slice(0, -1);
      if (dict.has(singleRoot)) return true;
    }
  }

  // 3. Present participle / gerund: -ing
  if (word.endsWith("ing") && word.length > 4) {
    const root = word.slice(0, -3);
    if (dict.has(root)) return true;
    const rootE = root + "e";
    if (dict.has(rootE)) return true;
    if (root.length > 2 && root[root.length - 1] === root[root.length - 2]) {
      const singleRoot = root.slice(0, -1);
      if (dict.has(singleRoot)) return true;
    }
  }

  // 4. Adverbs: -ly, -ally
  if (word.endsWith("ally") && word.length > 5) {
    const root = word.slice(0, -4) + "ic";
    if (dict.has(root)) return true;
    const rootAl = word.slice(0, -2);
    if (dict.has(rootAl)) return true;
  }
  if (word.endsWith("ly") && word.length > 4) {
    const root = word.slice(0, -2);
    if (dict.has(root)) return true;
    if (word.endsWith("ily") && dict.has(word.slice(0, -3) + "y")) return true;
  }

  // 5. Nouns / Nominals: -tion, -ation, -ition, -sion, -ment, -ness, -ity
  if (word.endsWith("tion") && word.length > 5) {
    const root = word.slice(0, -4);
    if (dict.has(root)) return true;
    const rootTe = word.slice(0, -4) + "te";
    if (dict.has(rootTe)) return true;
    const rootT = word.slice(0, -3);
    if (dict.has(rootT)) return true;
  }
  if (word.endsWith("ment") && word.length > 5) {
    const root = word.slice(0, -4);
    if (dict.has(root) || dict.has(root + "e")) return true;
  }
  if (word.endsWith("ness") && word.length > 5) {
    const root = word.slice(0, -4);
    if (dict.has(root)) return true;
    if (word.endsWith("iness") && dict.has(word.slice(0, -5) + "y")) return true;
  }
  if (word.endsWith("ity") && word.length > 5) {
    const root = word.slice(0, -3);
    if (dict.has(root) || dict.has(root + "e") || dict.has(root + "able") || dict.has(root + "ible")) return true;
  }

  // 6. Adjectives / Agents: -able, -ible, -er, -or
  if (word.endsWith("able") && word.length > 5) {
    const root = word.slice(0, -4);
    if (dict.has(root) || dict.has(root + "e")) return true;
  }
  if (word.endsWith("ible") && word.length > 5) {
    const root = word.slice(0, -4);
    if (dict.has(root) || dict.has(root + "e")) return true;
  }
  if ((word.endsWith("er") || word.endsWith("or")) && word.length > 4) {
    const root = word.slice(0, -2);
    if (dict.has(root) || dict.has(root + "e")) return true;
    if (root.length > 2 && root[root.length - 1] === root[root.length - 2]) {
      const singleRoot = root.slice(0, -1);
      if (dict.has(singleRoot)) return true;
    }
  }

  // 7. Suffixes: -ize / -ise / -ized / -ised / -izing / -ising / -ization / -isation
  if (word.endsWith("ized") || word.endsWith("ised")) {
    const root = word.slice(0, -4);
    if (dict.has(root) || dict.has(root + "e")) return true;
  }
  if (word.endsWith("izing") || word.endsWith("ising")) {
    const root = word.slice(0, -5);
    if (dict.has(root) || dict.has(root + "e")) return true;
  }
  if (word.endsWith("ization") || word.endsWith("isation")) {
    const root = word.slice(0, -7);
    if (dict.has(root) || dict.has(root + "e")) return true;
  }
  if (word.endsWith("ize") || word.endsWith("ise")) {
    const root = word.slice(0, -3);
    if (dict.has(root) || dict.has(root + "e")) return true;
  }

  return false;
}

const morphologyCache = new Map();

function computeMorphologicalValidity(word, dict) {
  // Check prefix derivations
  for (const prefix of PREFIXES) {
    if (word.startsWith(prefix) && word.length - prefix.length >= 3) {
      const remainder = word.slice(prefix.length);
      if (dict.has(remainder) || extraAllowed.has(remainder) || isInflectionOfKnownWord(remainder, dict)) {
        return true;
      }
    }
  }

  // Check suffix inflections
  if (isInflectionOfKnownWord(word, dict)) return true;

  // Check trailing numbers (e.g. line1, field2, sha256)
  const trailingNumMatch = word.match(/^([a-zA-Z]+)[0-9]+$/);
  if (trailingNumMatch) {
    const baseWord = trailingNumMatch[1];
    if (dict.has(baseWord) || extraAllowed.has(baseWord) || isInflectionOfKnownWord(baseWord, dict)) {
      return true;
    }
  }

  return false;
}

function isMorphologicallyValid(word, dict) {
  if (morphologyCache.has(word)) return morphologyCache.get(word);
  if (dict.has(word) || extraAllowed.has(word)) {
    if (morphologyCache.size < 20000) morphologyCache.set(word, true);
    return true;
  }
  const res = computeMorphologicalValidity(word, dict);
  if (morphologyCache.size < 20000) morphologyCache.set(word, res);
  return res;
}

function resolveSpellCheckDir(extensionPath) {
  if (extensionPath) {
    return path.join(extensionPath, "app", "lang", "spell-check");
  }
  return __dirname;
}

function readWordListFile(baseDir, fileName) {
  const brPath = path.join(baseDir, `${fileName}.br`);
  if (fs.existsSync(brPath)) {
    return zlib.brotliDecompressSync(fs.readFileSync(brPath)).toString("utf8");
  }
  const plainPath = path.join(baseDir, fileName);
  if (fs.existsSync(plainPath)) {
    return fs.readFileSync(plainPath, "utf8");
  }
  return null;
}

let wordsByLength = null;
const suggestionsCache = new Map();

function loadDictionaries(extensionPath) {
  if (combinedDictionary && combinedDictionary.size > 0) return combinedDictionary;
  combinedDictionary = new Set();
  wordsByLength = new Map();

  const addWord = (raw) => {
    const w = raw.trim().toLowerCase();
    if (!w) return;
    combinedDictionary.add(w);
    const len = w.length;
    let list = wordsByLength.get(len);
    if (!list) {
      list = [];
      wordsByLength.set(len, list);
    }
    list.push(w);
  };

  const baseDir = resolveSpellCheckDir(extensionPath);

  try {
    const content = readWordListFile(baseDir, "bml-words.txt");
    if (content) {
      content.split(/\r?\n/).forEach(addWord);
    }
  } catch (e) {}

  try {
    const content = readWordListFile(baseDir, "english-words.txt");
    if (content) {
      content.split(/\r?\n/).forEach(addWord);
    }
  } catch (e) {}

  return combinedDictionary;
}

let rowPrev = new Uint8Array(64);
let rowCurr = new Uint8Array(64);

function boundedLevenshtein(a, b, maxDist) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;

  if (lb + 1 > rowPrev.length) {
    rowPrev = new Uint8Array(lb + 32);
    rowCurr = new Uint8Array(lb + 32);
  }

  for (let j = 0; j <= lb; j++) rowPrev[j] = j;

  for (let i = 1; i <= la; i++) {
    rowCurr[0] = i;
    let minVal = i;
    const aChar = a.charCodeAt(i - 1);

    for (let j = 1; j <= lb; j++) {
      const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(
        rowPrev[j] + 1,       // deletion
        rowCurr[j - 1] + 1,   // insertion
        rowPrev[j - 1] + cost // substitution
      );
      rowCurr[j] = val;
      if (val < minVal) minVal = val;
    }

    if (minVal > maxDist) return maxDist + 1;

    for (let j = 0; j <= lb; j++) {
      rowPrev[j] = rowCurr[j];
    }
  }
  return rowPrev[lb];
}

function getSpellingSuggestions(word, extensionPath) {
  if (!word || typeof word !== 'string') return [];
  const target = word.toLowerCase();

  const cached = suggestionsCache.get(target);
  if (cached) {
    const isFirstUpper = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
    const isAllUpper = word === word.toUpperCase() && word !== word.toLowerCase();
    return cached.map((m) => {
      if (isAllUpper) return m.toUpperCase();
      if (isFirstUpper) return m.charAt(0).toUpperCase() + m.slice(1);
      return m;
    });
  }

  loadDictionaries(extensionPath);

  let userWords = [];
  try {
    const config = vscode.workspace.getConfiguration("cpqBml");
    userWords = config.get("spelling.userWords") || [];
  } catch (e) {}

  const matches = [];
  const targetLen = target.length;
  const minLen = Math.max(1, targetLen - 2);
  const maxLen = targetLen + 2;

  // Search length-bucketed dictionary words
  if (wordsByLength) {
    for (let len = minLen; len <= maxLen; len++) {
      const bucket = wordsByLength.get(len);
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const cand = bucket[i];
        const dist = boundedLevenshtein(target, cand, 2);
        if (dist <= 2) {
          matches.push({ word: cand, dist });
        }
      }
    }
  }

  // Check user words
  for (let i = 0; i < userWords.length; i++) {
    const w = userWords[i];
    if (!w) continue;
    const cand = w.trim().toLowerCase();
    if (Math.abs(cand.length - targetLen) <= 2) {
      const dist = boundedLevenshtein(target, cand, 2);
      if (dist <= 2) {
        matches.push({ word: cand, dist });
      }
    }
  }

  matches.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.word.localeCompare(b.word);
  });

  const rawResults = matches.slice(0, 5).map(m => m.word);
  if (suggestionsCache.size < 10000) {
    suggestionsCache.set(target, rawResults);
  }

  const isFirstUpper =
    word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
  const isAllUpper = word === word.toUpperCase() && word !== word.toLowerCase();

  return rawResults.map((w) => {
    if (isAllUpper) return w.toUpperCase();
    if (isFirstUpper) return w.charAt(0).toUpperCase() + w.slice(1);
    return w;
  });
}

function levenshtein(a, b) {
  return boundedLevenshtein(a, b, Math.max(a.length, b.length));
}

module.exports = {
  extraAllowed,
  loadDictionaries,
  getSpellingSuggestions,
  levenshtein,
  boundedLevenshtein,
  isMorphologicallyValid,
};
