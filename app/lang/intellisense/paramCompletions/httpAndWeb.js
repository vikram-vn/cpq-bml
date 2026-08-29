const { buildStringParamItems } = require('./utils');

const HTTP_METHODS = [
    { name: 'GET', detail: 'HTTP GET Method', doc: 'Retrieve data from endpoint.' },
    { name: 'POST', detail: 'HTTP POST Method', doc: 'Send data to endpoint.' },
    { name: 'PUT', detail: 'HTTP PUT Method', doc: 'Update data at endpoint.' },
    { name: 'PATCH', detail: 'HTTP PATCH Method', doc: 'Modify data at endpoint.' },
    { name: 'DELETE', detail: 'HTTP DELETE Method', doc: 'Delete data at endpoint.' }
];

const CONTENT_TYPES = [
    { name: 'text/plain', detail: 'Plain text content type', doc: 'MIME type text/plain' },
    { name: 'text/html', detail: 'HTML content type', doc: 'MIME type text/html' },
    { name: 'application/json', detail: 'JSON content type', doc: 'MIME type application/json' },
    { name: 'application/xml', detail: 'XML content type', doc: 'MIME type application/xml' },
    { name: 'application/x-www-form-urlencoded', detail: 'Form urlencoded type', doc: 'MIME type application/x-www-form-urlencoded' },
    { name: 'multipart/form-data', detail: 'Multipart form data type', doc: 'MIME type multipart/form-data' }
];

const ENCODINGS = [
    { name: 'UTF-8', detail: 'UTF-8 Encoding', doc: 'Standard UTF-8 character encoding.' },
    { name: 'ISO-8859-1', detail: 'ISO-8859-1 (Latin-1)', doc: 'Latin-1 character encoding.' },
    { name: 'US-ASCII', detail: 'ASCII Encoding', doc: '7-bit ASCII character encoding.' },
    { name: 'UTF-16', detail: 'UTF-16 Encoding', doc: 'UTF-16 character encoding.' }
];

const HMAC_ALGORITHMS = [
    { name: 'SHA256', detail: 'HMAC-SHA256 (Default)', doc: 'SHA-256 secure hash authentication algorithm.' },
    { name: 'SHA384', detail: 'HMAC-SHA384', doc: 'SHA-384 secure hash authentication algorithm.' },
    { name: 'SHA512', detail: 'HMAC-SHA512', doc: 'SHA-512 secure hash authentication algorithm.' },
    { name: 'SHA1', detail: 'HMAC-SHA1', doc: 'SHA-1 secure hash authentication algorithm.' },
    { name: 'MD5', detail: 'HMAC-MD5', doc: 'MD5 message digest hash algorithm.' }
];

function getHttpMethodCompletions(document, position) {
    return buildStringParamItems(HTTP_METHODS, document, position);
}

function getContentTypeCompletions(document, position) {
    return buildStringParamItems(CONTENT_TYPES, document, position);
}

function getEncodingCompletions(document, position) {
    return buildStringParamItems(ENCODINGS, document, position);
}

function getHmacAlgorithmCompletions(document, position) {
    return buildStringParamItems(HMAC_ALGORITHMS, document, position);
}

module.exports = {
    HTTP_METHODS,
    CONTENT_TYPES,
    ENCODINGS,
    HMAC_ALGORITHMS,
    getHttpMethodCompletions,
    getContentTypeCompletions,
    getEncodingCompletions,
    getHmacAlgorithmCompletions
};
