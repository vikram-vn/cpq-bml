const { toDisplayName } = require('./shared');

// Human-readable label for a BML variable name: drops a trailing "_t" (the common "temp"
// suffix convention) and title-cases the rest, e.g. "status_t" -> "Status",
// "netLaborCostBackup_t" -> "Net Labor Cost Backup".
function labelForVariable(variableName) {
  return toDisplayName(variableName.replace(/_t$/i, ''));
}

// Caps how wide any single cell's column can stretch - without this, one long value (e.g. a
// nested JSON blob) forces every row and the border to pad out to match it, which is what
// actually made the terminal output look broken/wrapped rather than like a table. Long values
// are word-wrapped onto extra lines within the same row instead of being cut off, so the full
// debug result is always shown - never a truncated slice of it.
const MAX_CELL_WIDTH = 60;

function wrapCell(text) {
  if (text.length <= MAX_CELL_WIDTH) return [text];
  const wrapped = [];
  for (let i = 0; i < text.length; i += MAX_CELL_WIDTH) {
    wrapped.push(text.slice(i, i + MAX_CELL_WIDTH));
  }
  return wrapped;
}

// Box-drawing bordered table (┌─┬─┐ style), shared by the header/line dump tables and the
// generic JSON-object table below. Each cell gets one space of padding on either side.
function formatRowsAsTable(headers, rows) {
  const wrappedRows = rows.map((r) => r.map((c) => wrapCell(String(c ?? ''))));
  const widths = headers.map((h, i) => Math.max(h.length, ...wrappedRows.flatMap((r) => r[i]).map((l) => l.length)));

  const border = (left, mid, right) => left + widths.map((w) => '─'.repeat(w + 2)).join(mid) + right;
  const renderLine = (cells) => '│ ' + cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' │ ') + ' │';

  const dataLines = [];
  for (const wrappedRow of wrappedRows) {
    const subLineCount = Math.max(...wrappedRow.map((cellLines) => cellLines.length));
    for (let sub = 0; sub < subLineCount; sub++) {
      dataLines.push(renderLine(wrappedRow.map((cellLines) => cellLines[sub] || '')));
    }
  }

  return [
    border('┌', '┬', '┐'),
    renderLine(headers),
    border('├', '┼', '┤'),
    ...dataLines,
    border('└', '┴', '┘'),
  ].join('\n');
}

function formatAsTable(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  const keys = Object.keys(data);
  if (keys.length === 0) return null;

  const rows = keys.map((k) => {
    const val = data[k];
    const valStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
    return [k, valStr];
  });

  return formatRowsAsTable(['key', 'value'], rows);
}

// Renders parseDocAttributeDump()'s {header, lines} into two readable ascii tables - one
// for the transaction-level (documentNumber 1) attributes, one for the per-line attributes
// (already sorted by documentNumber). Either half is omitted if that half had no rows.
function formatDocAttributeDumpTables(parsed) {
  const headerTable = parsed.header.length > 0
    ? formatRowsAsTable(
        ['Label', 'Variable Name', 'Value'],
        parsed.header.map((h) => [labelForVariable(h.variableName), h.variableName, h.value]),
      )
    : null;

  let lineTable = null;
  if (parsed.lines.length > 0) {
    const variableNames = [];
    for (const line of parsed.lines) {
      for (const key of Object.keys(line)) {
        if (key !== 'documentNumber' && !variableNames.includes(key)) variableNames.push(key);
      }
    }
    // Transposed relative to the raw {documentNumber, ...} rows: one row per variable (with
    // its Label + Variable Name, same as the header table above), one column per line - so
    // both the friendly label and the raw variable name are always visible here too.
    lineTable = formatRowsAsTable(
      ['Label', 'Variable Name', ...parsed.lines.map((line) => `Line ${line.documentNumber}`)],
      variableNames.map((name) => [
        labelForVariable(name),
        name,
        ...parsed.lines.map((line) => line[name]),
      ]),
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
