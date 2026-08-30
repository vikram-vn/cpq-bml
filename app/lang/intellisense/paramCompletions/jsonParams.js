const { buildStringParamItems } = require('./utils');

const JSON_PATH_TEMPLATES = [
    { name: '$.fieldName', insertText: '$.fieldName', detail: 'Root Property', doc: 'Access top-level JSON property by key name.' },
    { name: '$.object.field', insertText: '$.object.field', detail: 'Nested Property', doc: 'Access nested JSON object property.' },
    { name: '$..value', insertText: '$..value', detail: 'Deep Scan All Levels ($..key)', doc: 'Deep scan searching for all values corresponding to a key at any nested level.' },
    { name: '$.array[0]', insertText: '$.array[0]', detail: 'Array Index', doc: 'Access element at specific 0-based array index.' },
    { name: '$.array[*]', insertText: '$.array[*]', detail: 'Array Wildcard', doc: 'Access all elements in a JSON array.' },
    { name: '$.array[-1:]', insertText: '$.array[-1:]', detail: 'Array Last Element', doc: 'Access the last element of a JSON array.' },
    { name: '$.array[:2]', insertText: '$.array[:2]', detail: 'Array Slice (First N)', doc: 'Slice the first N elements from a JSON array.' },
    { name: '$.array[1:3]', insertText: '$.array[1:3]', detail: 'Array Slice Range', doc: 'Slice elements within index range [start:end].' },
    { name: '$.array[?(@.field == \'val\')]', insertText: '$.array[?(@.field == \'val\')]', detail: 'Filter Expression (==)', doc: 'Filter JSON array elements where property equals a string or value.' },
    { name: '$.array[?(@.field != \'val\')]', insertText: '$.array[?(@.field != \'val\')]', detail: 'Filter Expression (!=)', doc: 'Filter JSON array elements where property does not equal a value.' },
    { name: '$.array[?(@.active == true)]', insertText: '$.array[?(@.active == true)]', detail: 'Boolean Filter Expression', doc: 'Filter JSON array elements where a boolean flag is true/false.' },
    { name: '$.array[?(@.field > 1)]', insertText: '$.array[?(@.field > 1)]', detail: 'Filter Expression (>)', doc: 'Filter JSON array elements using numeric greater-than comparison.' },
    { name: '$.array[?(@.field >= 1)]', insertText: '$.array[?(@.field >= 1)]', detail: 'Filter Expression (>=)', doc: 'Filter JSON array elements using numeric greater-than-or-equal comparison.' },
    { name: '$.array[?(@.field < 100)]', insertText: '$.array[?(@.field < 100)]', detail: 'Filter Expression (<)', doc: 'Filter JSON array elements using numeric less-than comparison.' },
    { name: '$.array[?(@.field <= 100)]', insertText: '$.array[?(@.field <= 100)]', detail: 'Filter Expression (<=)', doc: 'Filter JSON array elements using numeric less-than-or-equal comparison.' },
    { name: '$.array[?(@.field in [\'A\', \'B\'])]', insertText: '$.array[?(@.field in [\'A\', \'B\'])]', detail: 'Filter Expression (in)', doc: 'Filter JSON array elements matching any value in a set.' },
    { name: '$.array[?(@.field nin [\'val\'])]', insertText: '$.array[?(@.field nin [\'val\'])]', detail: 'Filter Expression (nin)', doc: 'Filter JSON array elements excluding values in a set.' },
    { name: '$.array.length()', insertText: '$.array.length()', detail: 'Array Length Function', doc: 'Evaluate size/length of a JSON array.' },
    { name: '$.array.min()', insertText: '$.array.min()', detail: 'Array Min Function', doc: 'Calculate minimum value of numeric array elements.' },
    { name: '$.array.max()', insertText: '$.array.max()', detail: 'Array Max Function', doc: 'Calculate maximum value of numeric array elements.' },
    { name: '$.array.sum()', insertText: '$.array.sum()', detail: 'Array Sum Function', doc: 'Calculate sum of numeric array elements.' },
    { name: '$.array.avg()', insertText: '$.array.avg()', detail: 'Array Avg Function', doc: 'Calculate average of numeric array elements.' },
    { name: '$.array.stddev()', insertText: '$.array.stddev()', detail: 'Array Stddev Function', doc: 'Calculate standard deviation of numeric array elements.' },
    { name: '$.[\'Special Key\']', insertText: '$.[\'Special Key\']', detail: 'Bracket Notation', doc: 'Access properties with non-alphanumeric or special characters.' }
];

const JSON_VALUE_TYPES = [
    { name: 'string', detail: 'valueType "string" (default)', doc: 'Cast extracted JSON value as String.' },
    { name: 'integer', detail: 'valueType "integer"', doc: 'Cast extracted JSON value as Integer.' },
    { name: 'float', detail: 'valueType "float"', doc: 'Cast extracted JSON value as Float.' },
    { name: 'boolean', detail: 'valueType "boolean"', doc: 'Cast extracted JSON value as Boolean.' },
    { name: 'json', detail: 'valueType "json"', doc: 'Extract nested object as Json type.' },
    { name: 'jsonarray', detail: 'valueType "jsonarray"', doc: 'Extract nested array as JsonArray type.' }
];

function getJsonPathCompletions(document, position) {
    return buildStringParamItems(JSON_PATH_TEMPLATES, document, position);
}

function getJsonValueTypeCompletions(document, position) {
    return buildStringParamItems(JSON_VALUE_TYPES, document, position);
}

module.exports = {
    JSON_PATH_TEMPLATES,
    JSON_VALUE_TYPES,
    getJsonPathCompletions,
    getJsonValueTypeCompletions
};
