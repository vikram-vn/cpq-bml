const vscode = require("vscode");
const { getCommentRanges } = require("../lint/rules/comments");
const { getStringRanges } = require("../lint/rules/strings");
const {
  extraAllowed,
  loadDictionaries,
  getSpellingSuggestions
} = require("./spellingDict");

function splitIdentifier(token) {
  const parts = token.split(/[^a-zA-Z]/);
  const subWords = [];

  parts.forEach((part) => {
    if (!part) return;
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
  if (
    clean.includes("http://") ||
    clean.includes("https://") ||
    clean.includes("HTTP://") ||
    clean.includes("HTTPS://")
  ) {
    clean = clean.replace(/https?:\/\/[^\s]+/gi, (m) => " ".repeat(m.length));
  }
  if (clean.includes("@")) {
    clean = clean.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      (m) => " ".repeat(m.length),
    );
  }
  if (clean.includes("`")) {
    clean = clean.replace(/`[^`]+`/g, (m) => " ".repeat(m.length));
  }
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

// Short technical tokens accepted as compound segments even below the 4-char
// minimum (json, xml, ...), and connectors accepted only as a trailing
// segment (numberof, linesby, followon, ...). Both lists were tuned against
// the real pulled library: this segmentation clears the all-lowercase
// compound identifiers the camelCase splitter can't split (linejson,
// dummyarray, orderline, ...) while still flagging 17 of 18 known real typos
// in that corpus (struture, servcie, hiearchy, ...). The 4-char segment
// minimum is what keeps the typos flagged - the full english wordlist
// contains junk 3-letter fragments (ure, ing, hie) that would otherwise
// let typos through as bogus segment pairs.
const SHORT_TECH_SEGMENTS = new Set([
  "json", "xml", "doc", "log", "map", "get", "set", "ref", "app", "bom",
  "txn", "grp", "arr", "str", "num", "val", "obj", "seq", "pac", "ids",
  "sub", "pre", "post", "util", "func", "svc", "abo", "dict", "bool", "int",
  "db", "ws", "id", "api", "url", "uri", "sql", "csv", "pdf", "jsp", "xsi",
  "utf", "www", "tag", "key", "row", "col", "var", "arg", "res", "req",
  "err", "msg", "sb",
]);
const COMPOUND_CONNECTORS = new Set(["of", "by", "on", "in", "to", "for", "up", "down", "at", "as"]);

// True if `word` can be segmented into 2-3 known chunks (dictionary words of
// 4+ chars or short tech tokens, optionally ending in a connector).
function segmentsIntoKnownWords(word, dict, depth) {
  if (depth <= 0) return false;
  const okSeg = (s) => (s.length >= 4 && dict.has(s)) || SHORT_TECH_SEGMENTS.has(s);
  for (let i = 2; i <= word.length - 2; i++) {
    const head = word.slice(0, i);
    if (!okSeg(head)) continue;
    const rest = word.slice(i);
    if (okSeg(rest) || COMPOUND_CONNECTORS.has(rest)) return true;
    if (segmentsIntoKnownWords(rest, dict, depth - 1)) return true;
  }
  return false;
}

function checkWord(word, extensionPath, allowCompound = true) {
  if (word.length <= 1 || word.length > 50) return true;
  const wordLower = word.toLowerCase();

  if (extraAllowed.has(wordLower)) return true;

  if (word === word.toUpperCase() && word !== word.toLowerCase()) return true;

  const dict = loadDictionaries(extensionPath);
  if (dict.has(wordLower)) return true;

  // Compound fallback: all-lowercase glued identifiers (linejson, orderline,
  // sizeofline) have no camelCase boundary for splitIdentifier to split on,
  // so accept them when they segment cleanly into known words. Identifiers
  // and enum-style string values only - comment text is prose, where a glued
  // word is far more likely a real typo (calclate = calc+late would slip
  // through), so comments keep the strict single-word check.
  if (!allowCompound) return false;
  return wordLower.length >= 5 && segmentsIntoKnownWords(wordLower, dict, 3);
}

let globalWordCache = new Map();

function checkSpelling(
  text,
  cleanText,
  noStringsText,
  doc,
  vscode,
  extensionPath,
) {
  const diagnostics = [];
  const commentRanges = getCommentRanges(text);
  const stringRanges = getStringRanges(cleanText);

  let userWords = new Set();
  try {
    const config = vscode.workspace.getConfiguration("cpqBml");
    const words = config.get("spelling.userWords") || [];
    words.forEach(w => {
      const wLower = w.trim().toLowerCase();
      if (wLower) userWords.add(wLower);
    });
  } catch (e) {}

  const identCache = new Map();

  const checkWordCached = (word, allowCompound = true) => {
    const wordLower = word.toLowerCase();
    if (userWords.has(wordLower)) return true;
    const cacheKey = `${wordLower}|${allowCompound}`;
    if (globalWordCache.has(cacheKey)) return globalWordCache.get(cacheKey);
    const res = checkWord(word, extensionPath, allowCompound);
    if (globalWordCache.size < 15000) {
      globalWordCache.set(cacheKey, res);
    }
    return res;
  };

  // Walks a token's subWords, returning the misspelled ones with their offset
  // in the token. A failing subWord is forgiven when merging it with its
  // neighbor forms a known word: the camelCase splitter breaks acronym+suffix
  // tokens like "RESTful" into "RES"+"Tful" ("RES" passes the all-caps rule,
  // "Tful" would be flagged), but "res"+"tful" = "restful" is in the dictionary.
  const collectFlaggedSubWords = (token, minLen, allowCompound = true) => {
    const subWords = splitIdentifier(token);
    const flagged = [];
    let offset = 0;
    for (let i = 0; i < subWords.length; i++) {
      const subWord = subWords[i];
      const relIndex = token.indexOf(subWord, offset);
      if (relIndex === -1) continue;
      offset = relIndex + subWord.length;
      if (subWord.length <= minLen) continue;
      if (checkWordCached(subWord, allowCompound)) continue;
      const prev = i > 0 ? subWords[i - 1] : null;
      if (prev && checkWordCached((prev + subWord).toLowerCase(), allowCompound)) continue;
      const next = i + 1 < subWords.length ? subWords[i + 1] : null;
      if (next && checkWordCached((subWord + next).toLowerCase(), allowCompound)) continue;
      flagged.push({ subWord, relIndex });
    }
    return flagged;
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

  // Comment words are split on camelCase/acronym boundaries like identifiers, since docHeader
  // comments (e.g. "// Function Name : abo_getOneAssetState") routinely embed identifiers by name.
  commentRanges.forEach(([start, end]) => {
    const rawComment = text.substring(start, end);
    const cleanedComment = cleanCommentText(rawComment);

    const wordRegex = /[a-zA-Z]+/g;
    let match;
    while ((match = wordRegex.exec(cleanedComment)) !== null) {
      const word = match[0];
      // allowCompound=false: comment text is prose - see checkWord.
      collectFlaggedSubWords(word, 1, false).forEach((err) => {
        addSpellingDiagnostic(err.subWord, start + match.index + err.relIndex);
      });
    }
  });

  const identRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
  let match;
  while ((match = identRegex.exec(noStringsText)) !== null) {
    const ident = match[0];

    if (/^[0-9_]+$/.test(ident)) continue;

    let errors = identCache.get(ident);
    if (errors === undefined) {
      errors = collectFlaggedSubWords(ident, 1);
      identCache.set(ident, errors);
    }

    errors.forEach((err) => {
      addSpellingDiagnostic(err.subWord, match.index + err.relIndex);
    });
  }

  // String literals are split on camelCase/acronym boundaries too, since BML string values are
  // often enum/state-code identifiers (e.g. "waitingForInternalApproval") rather than prose.
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
      collectFlaggedSubWords(word, 2).forEach((err) => {
        addSpellingDiagnostic(err.subWord, start + 1 + match.index + err.relIndex);
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
  loadDictionaries,
};
