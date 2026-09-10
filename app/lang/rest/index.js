const { registerBmlRestCommands } = require('@/lang/rest/commands');

function registerBmlRest(context) {
    registerBmlRestCommands(context);
}

module.exports = { registerBmlRest };
