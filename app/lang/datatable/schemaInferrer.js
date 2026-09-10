/**
 * Infers Oracle CPQ Data Table schema (.dt.json) and typed records
 * directly from CSV spreadsheets.
 */
/**
 * Parses CSV text supporting quoted values, commas, and newlines.
 */
function parseCsv(csvText = '') {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const nextCh = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (nextCh === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r') {
        if (nextCh === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (ch === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
  }

  return rows;
}

/**
 * Sanitizes header into a valid CPQ column identifier.
 */
function sanitizeColumnName(rawHeader = '', index = 0) {
  let clean = rawHeader
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!clean || /^[0-9]/.test(clean)) {
    clean = `col_${clean || (index + 1)}`;
  }

  return clean;
}

/**
 * Infers BML Data Table type for an array of string values.
 */
function inferColumnType(values = []) {
  const nonNulls = values.filter(v => v !== undefined && v !== null && v !== '');
  if (nonNulls.length === 0) return 'String';

  let allInt = true;
  let allFloat = true;
  let allBool = true;
  let allDate = true;

  for (const val of nonNulls) {
    const vLower = val.toLowerCase();

    // Integer check
    if (!/^-?\d+$/.test(val)) allInt = false;

    // Float check
    if (!/^-?\d+(\.\d+)?$/.test(val)) allFloat = false;

    // Boolean check
    if (!['true', 'false', '1', '0', 'y', 'n', 'yes', 'no'].includes(vLower)) {
      allBool = false;
    }

    // Date check (YYYY-MM-DD or MM/DD/YYYY)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
      allDate = false;
    }
  }

  if (allInt) return 'Integer';
  if (allFloat) return 'Float';
  if (allBool) return 'Boolean';
  if (allDate) return 'Date';
  return 'String';
}

/**
 * Converts raw string value to typed JS primitive based on column type.
 */
function castValue(val, type) {
  if (val === '' || val === undefined || val === null) return null;
  if (type === 'Integer') {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }
  if (type === 'Float') {
    const f = parseFloat(val);
    return isNaN(f) ? 0.0 : f;
  }
  if (type === 'Boolean') {
    const lower = String(val).toLowerCase();
    return ['true', '1', 'y', 'yes'].includes(lower);
  }
  return String(val);
}

/**
 * Full inference pipeline: converts CSV text into CPQ .dt.json schema object.
 */
function inferFromCsv(csvText, tableName = 'InferredTable') {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error('CSV is empty. No headers or data found.');
  }

  const rawHeaders = rows[0];
  const dataRows = rows.slice(1);

  const columns = [];
  const usedNames = new Set();

  for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
    let colName = sanitizeColumnName(rawHeaders[colIdx], colIdx);

    // Ensure uniqueness
    let uniqueName = colName;
    let counter = 2;
    while (usedNames.has(uniqueName)) {
      uniqueName = `${colName}_${counter++}`;
    }
    usedNames.add(uniqueName);

    const colValues = dataRows.map(r => r[colIdx]);
    const colType = inferColumnType(colValues);

    // Detect uniqueness for Primary Key candidate
    const nonNulls = colValues.filter(v => v !== undefined && v !== '');
    const isUnique = nonNulls.length > 0 && new Set(nonNulls).size === nonNulls.length;

    columns.push({
      name: uniqueName,
      type: colType,
      isKey: false,
      _uniqueCandidate: isUnique
    });
  }

  // Determine primary key: prefer named like id, part, key, code
  const keyCandidate = columns.find(c =>
    c._uniqueCandidate && /^(id|part|code|key|number)/i.test(c.name)
  ) || columns.find(c => c._uniqueCandidate) || columns[0];

  if (keyCandidate) {
    keyCandidate.isKey = true;
  }

  // Build typed records
  const records = dataRows.map(row => {
    const rec = {};
    columns.forEach((col, idx) => {
      rec[col.name] = castValue(row[idx], col.type);
    });
    return rec;
  });

  // Cleanup internal temporary property
  const cleanColumns = columns.map(({ _uniqueCandidate, ...rest }) => rest);

  return {
    name: tableName,
    description: `Auto-inferred Data Table schema from CSV (${records.length} records)`,
    columns: cleanColumns,
    records
  };
}

const SchemaInferrer = {
  parseCsv,
  sanitizeColumnName,
  inferColumnType,
  castValue,
  inferFromCsv
};

module.exports = {
  parseCsv,
  sanitizeColumnName,
  inferColumnType,
  castValue,
  inferFromCsv,
  SchemaInferrer
};
