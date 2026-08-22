const { buildStringParamItems } = require('./utils');

const BMQL_TEMPLATES = [
    {
        name: 'SELECT column1, column2 FROM data_table_name WHERE condition',
        insertText: 'SELECT column1, column2 FROM data_table_name WHERE condition = $var',
        detail: 'BMQL Select Query Template',
        doc: 'Basic BMQL SELECT query statement template.'
    },
    {
        name: 'SELECT column1 FROM data_table_name',
        insertText: 'SELECT column1 FROM data_table_name',
        detail: 'BMQL Select All Query Template',
        doc: 'BMQL query without WHERE clause.'
    }
];

function getBmqlQueryCompletions(document, position) {
    return buildStringParamItems(BMQL_TEMPLATES, document, position);
}

module.exports = {
    BMQL_TEMPLATES,
    getBmqlQueryCompletions
};
