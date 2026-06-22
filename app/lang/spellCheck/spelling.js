const fs = require("fs");
const path = require("path");
const { getCommentRanges } = require("../lint/comments");
const { getStringRanges } = require("../lint/strings");

let combinedDictionary = null;

// Common tech jargon, abbreviations, and contraction roots to ignore
const extraAllowed = new Set([
  "don",
  "can",
  "won",
  "isn",
  "aren",
  "wasn",
  "weren",
  "haven",
  "hasn",
  "hadn",
  "doesn",
  "didn",
  "couldn",
  "shouldn",
  "wouldn",
  "lets",
  "whos",
  "whats",
  "theres",
  "heres",
  "todo",
  "fixme",
  "bug",
  "bml",
  "cpq",
  "bmql",
  "json",
  "xml",
  "csv",
  "api",
  "url",
  "http",
  "https",
  "db",
  "sql",
  "id",
  "num",
  "str",
  "int",
  "bool",
  "val",
  "param",
  "params",
  "usr",
  "sys",
  "msg",
  "err",
  "temp",
  "tmp",
  "config",
  "util",
  "init",
  "auth",
  "diff",
  "req",
  "res",
  "doc",
  "env",
  "uuid",
  "hmac",
  "attr",
  "attrs",
  "ctx",
  "cfg",
  "idx",
  "maindoc",
  "subdoc",
  "recordset",
]);

// __dirname is correct when this file is required directly (plain Node, as
// every test in this repo does) - but esbuild bundles this whole module into
// a single dist/extension.js, and at runtime __dirname for bundled code
// resolves to dist/, not this file's original folder. bml-words.txt /
// english-words.txt are plain data files esbuild never moves into dist/, so
// a real installed extension would silently find neither file and fall back
// to an almost-empty dictionary (everything not in extraAllowed gets
// flagged, including ordinary words). context.extensionPath (threaded down
// from registerBmlLinter/registerBmlCodeActions, same convention already
// used by app/lang/intellisense/index.js's loadApiData) is the one anchor
// that stays correct regardless of bundling, so it's preferred whenever
// available; __dirname remains the fallback for the plain-Node/test context
// where there is no bundle and no extensionPath to pass.
function resolveSpellCheckDir(extensionPath) {
  if (extensionPath) {
    return path.join(extensionPath, "app", "lang", "spellCheck");
  }
  return __dirname;
}

function loadDictionaries(extensionPath) {
  if (combinedDictionary) return combinedDictionary;
  combinedDictionary = new Set();

  const baseDir = resolveSpellCheckDir(extensionPath);

  // 1. Load BML specific custom dictionary
  try {
    const bmlWordsPath = path.join(baseDir, "bml-words.txt");
    if (fs.existsSync(bmlWordsPath)) {
      const content = fs.readFileSync(bmlWordsPath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const w = line.trim().toLowerCase();
        if (w) combinedDictionary.add(w);
      });
    }
  } catch (e) {
    // Fallback silently if file loading fails
  }

  // 2. Load English word list
  try {
    const englishWordsPath = path.join(baseDir, "english-words.txt");
    if (fs.existsSync(englishWordsPath)) {
      const content = fs.readFileSync(englishWordsPath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const w = line.trim().toLowerCase();
        if (w) combinedDictionary.add(w);
      });
    }
  } catch (e) {
    // Fallback silently if file loading fails
  }

  return combinedDictionary;
}

// Levenshtein distance implementation for spellcheck suggestions
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
  const suggestions = [];
  const wordLower = word.toLowerCase();

  for (const dictWord of dict) {
    if (Math.abs(dictWord.length - wordLower.length) > 2) continue;
    if (wordLower.length > 3 && dictWord[0] !== wordLower[0]) continue;

    const dist = levenshtein(wordLower, dictWord);
    if (dist <= 2) {
      suggestions.push({ word: dictWord, dist });
    }
  }

  suggestions.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.word.localeCompare(b.word);
  });

  const isFirstUpper =
    word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
  const isAllUpper = word === word.toUpperCase() && word !== word.toLowerCase();

  return suggestions.slice(0, 5).map((s) => {
    if (isAllUpper) return s.word.toUpperCase();
    if (isFirstUpper) return s.word.charAt(0).toUpperCase() + s.word.slice(1);
    return s.word;
  });
}

function splitIdentifier(token) {
  // Split by non-alphabetic characters like underscores, dots, or numbers
  const parts = token.split(/[^a-zA-Z]/);
  const subWords = [];

  parts.forEach((part) => {
    if (!part) return;
    // Split camelCase and consecutive uppercase acronyms
    // e.g., customerPrice -> customer, Price
    // e.g., XMLDocument -> XML, Document
    const camelParts = part
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(/\s+/);

    camelParts.forEach((cp) => {
      if (cp) subWords.push(cp);
    });
  });

  return subWords;
}

function cleanCommentText(text) {
  let clean = text;
  // Remove URLs
  if (
    clean.includes("http://") ||
    clean.includes("https://") ||
    clean.includes("HTTP://") ||
    clean.includes("HTTPS://")
  ) {
    clean = clean.replace(/https?:\/\/[^\s]+/gi, (m) => " ".repeat(m.length));
  }
  // Remove email addresses
  if (clean.includes("@")) {
    clean = clean.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      (m) => " ".repeat(m.length),
    );
  }
  // Remove inline code ticks
  if (clean.includes("`")) {
    clean = clean.replace(/`[^`]+`/g, (m) => " ".repeat(m.length));
  }
  // Clean contraction endings so root word can be checked
  if (clean.includes("'")) {
    clean = clean
      .replace(/'s\b/g, "  ")
      .replace(/'t\b/g, "  ")
      .replace(/'d\b/g, "  ")
      .replace(/'ll\b/g, "   ")
      .replace(/'re\b/g, "   ")
      .replace(/'ve\b/g, "   ")
      .replace(/'m\b/g, "  ");
  }
  return clean;
}

function checkWord(word, extensionPath) {
  if (word.length <= 1 || word.length > 50) return true;
  const wordLower = word.toLowerCase();

  // If it's a known extra allowed word or acronym, it's correct
  if (extraAllowed.has(wordLower)) return true;

  // Check if it consists only of uppercase letters (acronym)
  if (word === word.toUpperCase() && word !== word.toLowerCase()) return true;

  const dict = loadDictionaries(extensionPath);
  return dict.has(wordLower);
}

function checkSpelling(text, cleanText, noStringsText, doc, vscode, extensionPath) {
  const diagnostics = [];
  const commentRanges = getCommentRanges(text);
  const stringRanges = getStringRanges(cleanText);

  // Caches to avoid redundant splits and lookups within the same file run
  const wordCache = new Map();
  const identCache = new Map();

  const checkWordCached = (word) => {
    const wordLower = word.toLowerCase();
    if (wordCache.has(wordLower)) return wordCache.get(wordLower);
    const res = checkWord(word, extensionPath);
    wordCache.set(wordLower, res);
    return res;
  };

  const addSpellingDiagnostic = (word, startOffset) => {
    const startPos = doc.positionAt(startOffset);
    const endPos = doc.positionAt(startOffset + word.length);
    const range = new vscode.Range(startPos, endPos);
    const diag = new vscode.Diagnostic(
      range,
      `Spelling: "${word}" is not in the dictionary.`,
      vscode.DiagnosticSeverity.Information,
    );
    diag.code = "bml-spelling-error";
    diagnostics.push(diag);
  };

  // 1. Check spelling in Comments. Doc-header blocks (e.g.
  // "// Function Name : abo_getOneAssetState") are a widespread convention
  // in real BML library code and routinely mention camelCase identifiers
  // by name - so a comment "word" run is split the same way an identifier
  // is (camelCase/acronym boundaries) before checking each piece, instead
  // of checking the whole compound run as one giant "word" that can never
  // match the dictionary.
  commentRanges.forEach(([start, end]) => {
    const rawComment = text.substring(start, end);
    const cleanedComment = cleanCommentText(rawComment);

    const wordRegex = /[a-zA-Z]+/g;
    let match;
    while ((match = wordRegex.exec(cleanedComment)) !== null) {
      const word = match[0];
      const subWords = splitIdentifier(word);
      let offset = 0;
      subWords.forEach((subWord) => {
        const relIndex = word.indexOf(subWord, offset);
        if (relIndex === -1) return;
        offset = relIndex + subWord.length;
        if (!checkWordCached(subWord)) {
          addSpellingDiagnostic(subWord, start + match.index + relIndex);
        }
      });
    }
  });

  // 2. Check spelling in Identifiers (Variables, Functions, etc.)
  const identRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
  let match;
  while ((match = identRegex.exec(noStringsText)) !== null) {
    const ident = match[0];

    // Skip keywords or pure numbers
    if (/^[0-9_]+$/.test(ident)) continue;

    let errors = identCache.get(ident);
    if (errors === undefined) {
      errors = [];
      const subWords = splitIdentifier(ident);
      let offset = 0;
      subWords.forEach((subWord) => {
        const relIndex = ident.indexOf(subWord, offset);
        if (relIndex !== -1) {
          offset = relIndex + subWord.length;
          if (!checkWordCached(subWord)) {
            errors.push({ subWord, relIndex });
          }
        }
      });
      identCache.set(ident, errors);
    }

    errors.forEach((err) => {
      addSpellingDiagnostic(err.subWord, match.index + err.relIndex);
    });
  }

  // 3. Check spelling in String Literals. BML string values are routinely
  // used as enum/state-code-style identifiers (e.g.
  // "waitingForInternalApproval", "orderCancelled") rather than natural-
  // language prose, so - same as the identifier and comment checks above -
  // each matched word run is split on camelCase/acronym boundaries before
  // checking each piece. Without this, a value like
  // "waitingForInternalApproval" is checked as one single, unsplit run and
  // can never match the dictionary, no matter how ordinary its parts are.
  // Already space-separated natural-language strings (e.g. "Waiting for
  // Internal Approval") are unaffected - the word regex already separates
  // those at the spaces, and splitIdentifier returns a single-word run
  // unchanged when it has no internal camelCase boundary.
  stringRanges.forEach(([start, end]) => {
    const rawString = cleanText.substring(start, end);
    const content = rawString.slice(1, -1); // strip quotes

    if (content.trim().startsWith("{") || content.trim().startsWith("["))
      return; // JSON
    if (content.includes("/") || content.includes("\\")) return; // Path / URL
    if (/\b(?:select|from|where|insert|update|delete|create)\b/i.test(content))
      return; // BMQL/SQL

    const cleanedString = cleanCommentText(content);
    const wordRegex = /[a-zA-Z]+/g;
    let match;
    while ((match = wordRegex.exec(cleanedString)) !== null) {
      const word = match[0];
      if (word.length <= 2) continue;
      const subWords = splitIdentifier(word);
      let offset = 0;
      subWords.forEach((subWord) => {
        if (subWord.length <= 2) return;
        const relIndex = word.indexOf(subWord, offset);
        if (relIndex === -1) return;
        offset = relIndex + subWord.length;
        if (!checkWordCached(subWord)) {
          addSpellingDiagnostic(subWord, start + 1 + match.index + relIndex);
        }
      });
    }
  });

  return diagnostics;
}

module.exports = {
  checkSpelling,
  getSpellingSuggestions,
  splitIdentifier,
  cleanCommentText,
};
