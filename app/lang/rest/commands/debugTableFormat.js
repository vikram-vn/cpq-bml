function formatAsTable(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  const keys = Object.keys(data);
  if (keys.length === 0) return null;

  let maxKeyLen = 3; // "key"
  let maxValLen = 5; // "value"

  const rows = keys.map(k => {
    const val = data[k];
    const valStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
    maxKeyLen = Math.max(maxKeyLen, k.length);
    maxValLen = Math.max(maxValLen, valStr.length);
    return { key: k, val: valStr };
  });

  const headerKey = "key".padEnd(maxKeyLen);
  const headerVal = "value".padEnd(maxValLen);
  const separator = "-".repeat(maxKeyLen) + "-+-" + "-".repeat(maxValLen);

  const lines = [
    `${headerKey} | ${headerVal}`,
    separator
  ];

  for (const row of rows) {
    lines.push(`${row.key.padEnd(maxKeyLen)} | ${row.val}`);
  }

  return lines.join('\n');
}

// Generic aligned-column ascii table renderer, shared by the header/line tables below.
function formatRowsAsTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
  const renderRow = (cells) => cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' | ');
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');
  return [renderRow(headers), separator, ...rows.map(renderRow)].join('\n');
}

// Renders parseDocAttributeDump()'s {header, lines} into two readable ascii tables - one
// for the transaction-level (documentNumber 1) attributes, one for the per-line attributes
// (already sorted by documentNumber). Either half is omitted if that half had no rows.
function formatDocAttributeDumpTables(parsed) {
  const headerTable = parsed.header.length > 0
    ? formatRowsAsTable(['Variable', 'Value'], parsed.header.map((h) => [h.variableName, h.value]))
    : null;

  let lineTable = null;
  if (parsed.lines.length > 0) {
    const columns = [];
    for (const line of parsed.lines) {
      for (const key of Object.keys(line)) {
        if (key !== 'documentNumber' && !columns.includes(key)) columns.push(key);
      }
    }
    lineTable = formatRowsAsTable(
      ['Line', ...columns],
      parsed.lines.map((line) => [line.documentNumber, ...columns.map((c) => line[c])]),
    );
  }

  return { headerTable, lineTable };
}

// Parses a "documentNumber~variableName~value" pipe-delimited transaction dump into a
// header table (documentNumber 1, transaction-level attributes) and a line table (documentNumber
// 2+, one row per transaction line). Splits on the first two "~" only, so values containing "~"
// stay intact. Returns null when the text doesn't look like this format at all.
function parseDocAttributeDump(text) {
  if (typeof text !== 'string' || text.indexOf('~') === -1) return null;

  const segments = text.split('|').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  const header = [];
  const lineRows = new Map();
  let matched = 0;

  for (const seg of segments) {
    const firstTilde = seg.indexOf('~');
    const secondTilde = firstTilde === -1 ? -1 : seg.indexOf('~', firstTilde + 1);
    if (firstTilde === -1 || secondTilde === -1) continue;

    const docNumStr = seg.slice(0, firstTilde);
    if (!/^\d+$/.test(docNumStr)) continue;

    const variableName = seg.slice(firstTilde + 1, secondTilde);
    const value = seg.slice(secondTilde + 1);
    matched++;

    const docNum = parseInt(docNumStr, 10);
    if (docNum === 1) {
      header.push({ variableName, value });
    } else {
      if (!lineRows.has(docNum)) lineRows.set(docNum, { documentNumber: docNum });
      lineRows.get(docNum)[variableName] = value;
    }
  }

  if (matched === 0) return null;

  const lines = Array.from(lineRows.keys())
    .sort((a, b) => a - b)
    .map((docNum) => lineRows.get(docNum));

  return { header, lines };
}

module.exports = { formatAsTable, formatRowsAsTable, formatDocAttributeDumpTables, parseDocAttributeDump };
