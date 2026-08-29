const fs = require('fs');
const path = require('path');
const bml_beautify = require('../../app/lang/beautify/bml/index');

const sourcePath = path.join(__dirname, '..', 'beautify', 'fixtures', 'bml_comprehensive_features.bml');
const expectedPath = path.join(__dirname, '..', 'beautify', 'fixtures', 'bml_comprehensive_features.expected.bml');

const source = fs.readFileSync(sourcePath, 'utf8');
const result = bml_beautify(source, { indent_char: '\t', indent_size: 1 });
fs.writeFileSync(expectedPath, result, 'utf8');
console.log('Formatted and saved expected output.');
