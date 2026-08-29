const { registerBmlRestCommands } = require('./commands');

function registerBmlRest(context) {
    registerBmlRestCommands(context);
}

module.exports = { registerBmlRest };
