const { buildStringParamItems } = require('./utils');

const JSON_PATH_TEMPLATES = [
    { name: '$.fieldName', insertText: '$.fieldName', detail: 'JSONPath Root Property', doc: 'Access top-level JSON property.' },
    { name: '$.array[*]', insertText: '$.array[*]', detail: 'JSONPath Array Wildcard', doc: 'Access all elements in a JSON array.' },
    { name: '$.object.field', insertText: '$.object.field', detail: 'JSONPath Nested Property', doc: 'Access nested JSON object property.' },
    { name: '$.array[0]', insertText: '$.array[0]', detail: 'JSONPath Array Element Index', doc: 'Access first element of a JSON array.' }
];

function getJsonPathCompletions(document, position) {
    return buildStringParamItems(JSON_PATH_TEMPLATES, document, position);
}

module.exports = {
    JSON_PATH_TEMPLATES,
    getJsonPathCompletions
};
