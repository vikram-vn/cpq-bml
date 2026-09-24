const { registerBmlRestCommands } = require('@/lang/rest/commands');
const { getContext } = require('@/extensionContext');

function registerBmlRest(context) {
    const ctx = context || getContext();
    registerBmlRestCommands(ctx);
}

module.exports = { registerBmlRest };
