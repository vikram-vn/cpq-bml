/**
 * Offline BMQL Query Validator & Syntax Explainer
 * Validates BMQL queries against Oracle CPQ BMQL specification and best practices.
 */

const UNSUPPORTED_KEYWORDS = [
    { pattern: /\b(JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN)\b/i, name: 'JOIN', reason: 'BMQL does not support table JOINs. Query each data table individually or cache lookups in a dictionary.' },
    { pattern: /\b(GROUP\s+BY)\b/i, name: 'GROUP BY', reason: 'BMQL does not support GROUP BY aggregations. Process groupings in BML recordset loops.' },
    { pattern: /\b(ORDER\s+BY)\b/i, name: 'ORDER BY', reason: 'BMQL does not support ORDER BY. Sort retrieved records in BML using arrays or sorting utilities.' },
    { pattern: /\b(HAVING)\b/i, name: 'HAVING', reason: 'BMQL does not support HAVING clauses.' },
    { pattern: /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i, name: 'DML/DDL', reason: 'BMQL is strictly a read-only SELECT query language. Modify Data Tables via CPQ REST API or bulk data feeds.' },
    { pattern: /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i, name: 'SQL Aggregates', reason: 'BMQL does not support SQL aggregate functions (COUNT, SUM, AVG). Iterate through the recordset in BML.' },
    { pattern: /\(\s*SELECT\b/i, name: 'Subquery', reason: 'BMQL does not support subqueries or nested SELECT statements.' },
];

function validateBmqlQuery(args) {
    const rawQuery = (args && args.query ? args.query : '').trim();
    if (!rawQuery) {
        return {
            isValid: false,
            query: '',
            issues: [{ severity: 'error', message: 'Query string cannot be empty.' }],
            explanation: 'No query provided to validate.'
        };
    }

    const issues = [];
    const normalized = rawQuery.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Check for DML / Unsupported SQL constructs
    for (const kw of UNSUPPORTED_KEYWORDS) {
        if (kw.pattern.test(normalized)) {
            issues.push({
                severity: 'error',
                rule: 'UNSUPPORTED_BMQL_FEATURE',
                keyword: kw.name,
                message: `Unsupported keyword: ${kw.name}`,
                explanation: kw.reason,
            });
        }
    }

    // 2. Check for dynamic concatenation / injection vulnerability
    if (/['"]\s*\+\s*[a-zA-Z0-9_]+\s*\+\s*['"]/.test(rawQuery) || /\+\s*[a-zA-Z0-9_]+\s*$/m.test(rawQuery)) {
        issues.push({
            severity: 'critical',
            rule: 'BMQL_INJECTION_RISK',
            message: 'Dynamic string concatenation detected in BMQL statement.',
            explanation: 'BMQL queries must use parameterized variables ($varName) instead of string concatenation to prevent BMQL injection and parse errors.'
        });
    }

    // 3. Must start with SELECT
    if (!/^SELECT\b/i.test(normalized)) {
        issues.push({
            severity: 'error',
            rule: 'INVALID_SYNTAX',
            message: 'BMQL query must begin with the SELECT keyword.',
            explanation: 'Standard BMQL format: SELECT column1, column2 FROM dataTable WHERE column1 = $param'
        });
        return {
            isValid: false,
            query: rawQuery,
            issues,
            explanation: 'Query does not start with SELECT.'
        };
    }

    // 4. Must contain FROM
    const fromMatch = normalized.match(/\bFROM\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch) {
        issues.push({
            severity: 'error',
            rule: 'MISSING_FROM_CLAUSE',
            message: 'BMQL query is missing a valid FROM <dataTable> clause.',
            explanation: 'Specify the target Data Table name directly after FROM.'
        });
    }

    const tableName = fromMatch ? fromMatch[1] : null;

    // 5. Columns parsing
    const selectPortion = normalized.slice(6, fromMatch ? fromMatch.index : normalized.length).trim();
    const rawColumns = selectPortion.split(',').map(c => c.trim()).filter(Boolean);
    const columns = [];

    for (const col of rawColumns) {
        if (col === '*') {
            issues.push({
                severity: 'warning',
                rule: 'SELECT_STAR_ADVISORY',
                message: 'Using SELECT * in BMQL can degrade memory and performance.',
                explanation: 'Best practice: Explicitly specify only the needed columns to minimize payload size and memory overhead.'
            });
            columns.push('*');
        } else {
            const cleanCol = col.replace(/[^a-zA-Z0-9_]/g, '');
            if (cleanCol) columns.push(cleanCol);
        }
    }

    if (columns.length === 0) {
        issues.push({
            severity: 'error',
            rule: 'NO_COLUMNS_SPECIFIED',
            message: 'No columns specified in SELECT clause.',
            explanation: 'List at least one column name or * after SELECT.'
        });
    }

    // 6. WHERE clause and parameter extraction
    let whereClause = null;
    const whereMatch = normalized.match(/\bWHERE\s+(.+)$/i);
    const parameters = [];

    if (whereMatch) {
        whereClause = whereMatch[1].trim();
        // Extract $variable_name
        const paramMatches = whereClause.match(/\$([a-zA-Z0-9_]+)/g);
        if (paramMatches) {
            for (const p of paramMatches) {
                const pName = p.substring(1);
                if (!parameters.includes(pName)) parameters.push(pName);
            }
        }

        // Check for common equality typos like == instead of =
        if (/==/.test(whereClause)) {
            issues.push({
                severity: 'error',
                rule: 'INVALID_OPERATOR',
                message: 'BMQL uses single "=" for equality comparisons, not "==".',
                explanation: 'Change "==" to "=" in the WHERE clause.'
            });
        }
    } else {
        issues.push({
            severity: 'warning',
            rule: 'UNBOUNDED_QUERY',
            message: 'BMQL query has no WHERE clause.',
            explanation: 'Querying an entire Data Table without filtering can cause performance bottlenecks or timeout errors if the table has thousands of rows.'
        });
    }

    const errorCount = issues.filter(i => i.severity === 'error' || i.severity === 'critical').length;
    const isValid = errorCount === 0;

    const explanation = `BMQL query targeting Data Table "${tableName || 'UNKNOWN'}" retrieving ${columns.length} column(s): [${columns.join(', ')}].` +
        (whereClause ? ` Filtered with WHERE clause referencing ${parameters.length} parameter(s): [${parameters.map(p => '$' + p).join(', ')}].` : ' No WHERE filter applied.');

    return {
        isValid,
        tableName,
        columns,
        whereClause,
        parameters,
        issues,
        explanation,
    };
}

module.exports = { validateBmqlQuery };
