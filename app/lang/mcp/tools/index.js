const lookup = require('./lookup');
const lifecycle = require('./lifecycle');
const knowledge = require('./knowledge');
const reference = require('./reference');

module.exports = {
    ...lookup,
    ...lifecycle,
    ...knowledge,
    ...reference,
};
