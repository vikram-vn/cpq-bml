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
  "jmb", "jsoncrit", "jsonof", "chargecount", "caculate", "assetkey", "tempjson", "arrfor",
  "ldu", "documentnumber", "bsid", "atoi", "atof", "sessionid", "processname", "processvarname",
  "transactionid", "transactionname", "oraclecpqo", "customdiscountvalue", "opportunitynumber",
  "histry", "encodebase", "claz", "qval", "bomflat", "iterationquantity", "jsonin", "itemsjson",
  "basebom", "varname", "boms", "chd", "capped",
  "usd", "eur", "gbp", "cad", "aud", "jpy", "inr", "chf", "cny", "sgd", "nzd", "hkd", "sek",
  "nok", "mxn", "brl", "zar", "aed", "sar", "krw", "thb", "myr", "idr", "php", "vnd", "pln",
  "czk", "huf", "ils", "clp", "cop", "pen"
]);

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

function loadDictionaries(extensionPath) {
  if (combinedDictionary && combinedDictionary.size > 0) return combinedDictionary;
  combinedDictionary = new Set();

  const baseDir = resolveSpellCheckDir(extensionPath);

  try {
    const content = readWordListFile(baseDir, "bml-words.txt");
    if (content) {
      content.split(/\r?\n/).forEach((line) => {
        const w = line.trim().toLowerCase();
        if (w) combinedDictionary.add(w);
      });
    }
  } catch (e) {}

  try {
    const content = readWordListFile(baseDir, "english-words.txt");
    if (content) {
      content.split(/\r?\n/).forEach((line) => {
        const w = line.trim().toLowerCase();
        if (w) combinedDictionary.add(w);
      });
    }
  } catch (e) {}

  return combinedDictionary;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function getSpellingSuggestions(word, extensionPath) {
  const dict = loadDictionaries(extensionPath);
  let userWords = [];
  try {
    const config = vscode.workspace.getConfiguration("cpqBml");
    userWords = config.get("spelling.userWords") || [];
  } catch (e) {}

  const candidates = new Set(dict);
  for (const w of userWords) {
    const wLower = w.trim().toLowerCase();
    if (wLower) candidates.add(wLower);
  }

  const target = word.toLowerCase();
  const matches = [];

  for (const cand of candidates) {
    if (Math.abs(cand.length - target.length) > 3) continue;
    const dist = levenshtein(target, cand);
    if (dist <= 2) {
      matches.push({ word: cand, dist });
    }
  }

  matches.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.word.localeCompare(b.word);
  });

  const isFirstUpper =
    word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
  const isAllUpper = word === word.toUpperCase() && word !== word.toLowerCase();

  return matches.slice(0, 5).map((m) => {
    if (isAllUpper) return m.word.toUpperCase();
    if (isFirstUpper) return m.word.charAt(0).toUpperCase() + m.word.slice(1);
    return m.word;
  });
}

module.exports = {
  extraAllowed,
  loadDictionaries,
  getSpellingSuggestions,
  levenshtein
};
