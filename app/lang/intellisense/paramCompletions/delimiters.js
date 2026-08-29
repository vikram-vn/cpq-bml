const { buildStringParamItems } = require('./utils');

const DELIMITERS = [
    { name: ',', detail: 'Comma separator (",")', doc: 'Comma delimiter string.' },
    { name: ';', detail: 'Semicolon separator (";")', doc: 'Semicolon delimiter string.' },
    { name: '|', detail: 'Pipe separator ("|")', doc: 'Pipe delimiter string.' },
    { name: '\\n', detail: 'Newline separator ("\\n")', doc: 'Newline character delimiter.' },
    { name: '\\t', detail: 'Tab separator ("\\t")', doc: 'Tab character delimiter.' },
    { name: ' ', detail: 'Space separator (" ")', doc: 'Single space delimiter.' },
    { name: '-', detail: 'Hyphen separator ("-")', doc: 'Hyphen/dash delimiter string.' },
    { name: '_', detail: 'Underscore separator ("_")', doc: 'Underscore delimiter string.' },
    { name: '~', detail: 'Tilde separator ("~")', doc: 'Tilde delimiter string.' },
    { name: '$$', detail: 'Double-dollar separator ("$$")', doc: 'Double-dollar key-value pair delimiter.' }
];

function getDelimiterCompletions(document, position) {
    return buildStringParamItems(DELIMITERS, document, position);
}

module.exports = {
    DELIMITERS,
    getDelimiterCompletions
};
