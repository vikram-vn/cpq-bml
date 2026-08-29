const lookup = require('./lookup');
const lifecycle = require('./lifecycle');
const knowledge = require('./knowledge');
const reference = require('./reference');
const status = require('./status');
const testing = require('./testing');
const formatting = require('./formatting');

module.exports = {
    ...lookup,
    ...lifecycle,
    ...knowledge,
    ...reference,
    ...status,
    ...testing,
    ...formatting,
};
