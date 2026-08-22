const { buildStringParamItems } = require('./utils');

const DICT_TYPES = [
    { name: 'string', detail: 'dict("string")', doc: 'BML String Dictionary storing key-value pairs where values are String type.' },
    { name: 'integer', detail: 'dict("integer")', doc: 'BML Integer Dictionary storing key-value pairs where values are Integer type.' },
    { name: 'float', detail: 'dict("float")', doc: 'BML Float Dictionary storing key-value pairs where values are Float type.' },
    { name: 'boolean', detail: 'dict("boolean")', doc: 'BML Boolean Dictionary storing key-value pairs where values are Boolean type.' },
    { name: 'date', detail: 'dict("date")', doc: 'BML Date Dictionary storing key-value pairs where values are Date type.' },
    { name: 'json', detail: 'dict("json")', doc: 'BML Json Dictionary storing key-value pairs where values are Json objects.' },
    { name: 'jsonarray', detail: 'dict("jsonarray")', doc: 'BML JsonArray Dictionary storing key-value pairs where values are JsonArray objects.' },
    { name: 'bytearray', detail: 'dict("bytearray")', doc: 'BML ByteArray Dictionary storing key-value pairs where values are ByteArray objects.' },
    { name: 'anytype', detail: 'dict("anytype")', doc: 'BML Generic anytype Dictionary storing values of any data type.' },
    { name: 'dict<string>', detail: 'dict("dict<string>")', doc: 'BML Nested Dictionary storing String Dictionary objects.' },
    { name: 'dict<anytype>', detail: 'dict("dict<anytype>")', doc: 'BML Nested Dictionary storing child Dictionary objects.' },
    { name: 'string[]', detail: 'dict("string[]")', doc: 'BML String Array Dictionary storing key-value pairs of String[] arrays.' },
    { name: 'integer[]', detail: 'dict("integer[]")', doc: 'BML Integer Array Dictionary storing key-value pairs of Integer[] arrays.' },
    { name: 'float[]', detail: 'dict("float[]")', doc: 'BML Float Array Dictionary storing key-value pairs of Float[] arrays.' },
    { name: 'boolean[]', detail: 'dict("boolean[]")', doc: 'BML Boolean Array Dictionary storing key-value pairs of Boolean[] arrays.' }
];

function getDictTypeCompletions(document, position) {
    return buildStringParamItems(DICT_TYPES, document, position);
}

module.exports = {
    DICT_TYPES,
    getDictTypeCompletions
};
