export const EMPTY_STATE = {
    connection: {
        siteUrl: '',
        authMethod: 'basic',
        username: '',
        enabled: true
    },
    rest: {
        pullFolder: 'library',
        restVersion: 'v18',
        commerceProcess: 'oraclecpqo',
        commerceDocument: 'transaction'
    },
    features: {
        lint: true,
        comments: true,
        spelling: true,
        beautifier: true,
        intellisense: true,
        docHeader: true,
        xslt: true,
        metrics: true,
        testing: true
    },
    mcp: { enable: false, port: 47821, logToTerminal: false },
    debug: { logOutputToFile: false, logRestDetails: false },
    environments: [],
    hasPassword: false,
    hasToken: false
};
