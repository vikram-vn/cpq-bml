const lookup = require('./lookup');
const lifecycle = require('./lifecycle');
const knowledge = require('./knowledge');
const reference = require('./reference');
const status = require('./status');
const testing = require('./testing');
const formatting = require('./formatting');
const audit = require('./audit');
const bmqlValidator = require('./bmqlValidator');
const testTools = require('./testTools');
const schemaTools = require('./schemaTools');

module.exports = {
    ...lookup,
    ...lifecycle,
    ...knowledge,
    ...reference,
    ...status,
    ...testing,
    ...formatting,
    ...audit,
    ...bmqlValidator,
    ...testTools,
    ...schemaTools,
};
