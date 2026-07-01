const lookup = require('./lookup');
const lifecycle = require('./lifecycle');
const knowledge = require('./knowledge');

module.exports = {
    ...lookup,
    ...lifecycle,
    ...knowledge,
};
