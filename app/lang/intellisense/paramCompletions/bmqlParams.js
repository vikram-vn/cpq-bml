const { buildStringParamItems } = require('./utils');

const BMQL_TEMPLATES = [
    {
        name: 'SELECT column1, column2 FROM dataTable WHERE condition',
        insertText: 'SELECT column1, column2 FROM dataTable WHERE column1 = $var',
        detail: 'BMQL SELECT Query Template',
        doc: 'Basic BMQL SELECT query statement template.'
    },
    {
        name: 'SELECT DISTINCT column1 FROM dataTable WHERE condition',
        insertText: 'SELECT DISTINCT column1 FROM dataTable WHERE column1 = $var ORDER BY column1 ASC',
        detail: 'BMQL SELECT DISTINCT & ORDER BY Query Template',
        doc: 'BMQL SELECT query returning distinct records sorted by column. Capped at 1,000 records.'
    },
    {
        name: 'INSERT INTO dataTable (column1, column2) VALUES ($val1, $val2)',
        insertText: 'INSERT INTO dataTable (column1, column2) VALUES ($val1, $val2)',
        detail: 'BMQL INSERT Statement Template',
        doc: 'BMQL INSERT query to insert new records into a Live Data Table.'
    },
    {
        name: 'UPDATE dataTable SET column1 = $newVal WHERE column2 = $val',
        insertText: 'UPDATE dataTable SET column1 = $newVal WHERE column2 = $val',
        detail: 'BMQL UPDATE Statement Template',
        doc: 'BMQL UPDATE query to modify existing records in a Live Data Table.'
    },
    {
        name: 'MODIFY dataTable SET column1 = $newVal WHERE column2 = $val',
        insertText: 'MODIFY dataTable SET column1 = $newVal WHERE column2 = $val',
        detail: 'BMQL MODIFY Statement Template',
        doc: 'BMQL MODIFY query to update or insert records in a Live Data Table.'
    },
    {
        name: 'DELETE FROM dataTable WHERE column1 = $val',
        insertText: 'DELETE FROM dataTable WHERE column1 = $val',
        detail: 'BMQL DELETE Statement Template',
        doc: 'BMQL DELETE query to remove records matching WHERE condition from a Live Data Table.'
    },
    {
        name: 'SELECT T1.col1, T2.col2 FROM Table1 T1 INNER JOIN Table2 T2 ON T1.key = T2.key',
        insertText: 'SELECT T1.col1, T2.col2 FROM Table1 T1 INNER JOIN Table2 T2 ON T1.key = T2.key',
        detail: 'BMQL INNER JOIN Query Template',
        doc: 'BMQL JOIN query between two Data Tables.'
    },
    {
        name: 'SELECT column1 FROM dataTable WHERE column2 IN ($arrayVar)',
        insertText: 'SELECT column1 FROM dataTable WHERE column2 IN ($arrayVar)',
        detail: 'BMQL IN Array Query Template',
        doc: 'BMQL SELECT query using a BML array in an IN clause.'
    },
    {
        name: 'SELECT $columns FROM $table WHERE $where (Dynamic Query)',
        insertText: 'SELECT $columns FROM $table WHERE $where',
        detail: 'BMQL Dynamic Query Template',
        doc: 'Fully dynamic BMQL query using $table, $columns, and $where substitutions with a fieldMap dictionary.'
    },
    {
        name: 'SELECT column1 FROM dataTable WHERE column2 LIKE $pattern',
        insertText: 'SELECT column1 FROM dataTable WHERE column2 LIKE $pattern',
        detail: 'BMQL LIKE Query Template',
        doc: 'BMQL query with wildcard pattern matching (e.g. $pattern = "%term%").'
    },
    {
        name: 'SELECT column1 FROM dataTable WHERE column2 BETWEEN $minVal AND $maxVal',
        insertText: 'SELECT column1 FROM dataTable WHERE column2 BETWEEN $minVal AND $maxVal',
        detail: 'BMQL BETWEEN Query Template',
        doc: 'BMQL query filtering rows within a range of values.'
    }
];

function getBmqlQueryCompletions(document, position) {
    return buildStringParamItems(BMQL_TEMPLATES, document, position);
}

module.exports = {
    BMQL_TEMPLATES,
    getBmqlQueryCompletions
};
