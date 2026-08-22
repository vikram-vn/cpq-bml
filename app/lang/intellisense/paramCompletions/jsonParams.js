const { buildStringParamItems } = require('./utils');

const JSON_PATH_TEMPLATES = [
    { name: '$.fieldName', insertText: '$.fieldName', detail: 'Root Property', doc: 'Access top-level JSON property by key name.' },
    { name: '$.object.field', insertText: '$.object.field', detail: 'Nested Property', doc: 'Access nested JSON object property.' },
    { name: '$..value', insertText: '$..value', detail: 'Deep Scan All Levels ($..key)', doc: 'Deep scan searching for all values corresponding to a key at any nested level.' },
    { name: '$.array[0]', insertText: '$.array[0]', detail: 'Array Index', doc: 'Access element at specific 0-based array index.' },
    { name: '$.array[*]', insertText: '$.array[*]', detail: 'Array Wildcard', doc: 'Access all elements in a JSON array.' },
    { name: '$.array[-1:]', insertText: '$.array[-1:]', detail: 'Array Last Element', doc: 'Access the last element of a JSON array.' },
    { name: '$.array[?(@.field == \'val\')]', insertText: '$.array[?(@.field == \'val\')]', detail: 'Filter Expression (==)', doc: 'Filter JSON array elements where property equals a string or value.' },
    { name: '$.array[?(@.field > 1)]', insertText: '$.array[?(@.field > 1)]', detail: 'Filter Expression (>)', doc: 'Filter JSON array elements using numeric comparison.' },
    { name: '$.array[?(@.field nin [\'val\'])]', insertText: '$.array[?(@.field nin [\'val\'])]', detail: 'Filter Expression (nin / in)', doc: 'Filter array using advanced in/nin set membership operators.' },
    { name: '$.array.length()', insertText: '$.array.length()', detail: 'Array Length Function', doc: 'Evaluate size/length of a JSON array.' },
    { name: '$.array.avg()', insertText: '$.array.avg()', detail: 'Array Avg Function', doc: 'Calculate average of numeric array elements (min, max, avg, stddev).' },
    { name: '$.[\'Special Key\']', insertText: '$.[\'Special Key\']', detail: 'Bracket Notation', doc: 'Access properties with non-alphanumeric or special characters.' }
];

function getJsonPathCompletions(document, position) {
    return buildStringParamItems(JSON_PATH_TEMPLATES, document, position);
}

module.exports = {
    JSON_PATH_TEMPLATES,
    getJsonPathCompletions
};
