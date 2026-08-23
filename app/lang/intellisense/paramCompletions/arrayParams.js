const { buildStringParamItems } = require('./utils');

const SORT_ORDERS = [
    { name: 'asc', detail: 'sort(array, "asc")', doc: 'Ascending order (default). Sorts array from lowest to highest value.' },
    { name: 'desc', detail: 'sort(array, "desc")', doc: 'Descending order. Sorts array from highest to lowest value.' }
];

const SORT_TYPES = [
    { name: 'text', detail: 'sort(array, sortOrder, "text")', doc: 'Case-insensitive text sort.' },
    { name: 'numeric', detail: 'sort(array, sortOrder, "numeric")', doc: 'Numeric sort. Elements are parsed as numbers before sorting.' },
    { name: 'date', detail: 'sort(array, sortOrder, "date")', doc: 'Date sort. Can ONLY be used on date[] arrays.' }
];

const BYTEARRAY_CHARSETS = [
    { name: 'UTF-8', detail: 'UTF-8 encoding (default)', doc: 'Standard 8-bit Unicode Transformation Format.' },
    { name: 'UTF-16', detail: 'UTF-16 encoding', doc: '16-bit Unicode Transformation Format.' },
    { name: 'ASCII', detail: 'US-ASCII encoding', doc: '7-bit ASCII encoding.' },
    { name: 'ISO-8859-1', detail: 'ISO-8859-1 encoding', doc: 'ISO Latin Alphabet No. 1 encoding.' },
    { name: 'UTF-32BE', detail: 'UTF-32BE encoding', doc: '32-bit Unicode Transformation Format Big-Endian.' }
];

function getSortOrderCompletions(document, position) {
    return buildStringParamItems(SORT_ORDERS, document, position);
}

function getSortTypeCompletions(document, position) {
    return buildStringParamItems(SORT_TYPES, document, position);
}

function getByteArrayCharsetCompletions(document, position) {
    return buildStringParamItems(BYTEARRAY_CHARSETS, document, position);
}

module.exports = {
    SORT_ORDERS,
    SORT_TYPES,
    BYTEARRAY_CHARSETS,
    getSortOrderCompletions,
    getSortTypeCompletions,
    getByteArrayCharsetCompletions
};
