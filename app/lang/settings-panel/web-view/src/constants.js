export const EMPTY_STATE = {
    connection: {
        siteUrl: '',
        authMethod: 'basic',
        username: '',
        enabled: true
    },
    rest: {
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
    inlayHints: {
        enabled: true,
        suppressWhenArgumentMatchesName: true,
        variableTypes: false
    },
    mcp: { enable: false, port: 47821, logToTerminal: false },
    debug: { logOutputToFile: false, logRestDetails: false, showResultsAsTable: false, concurrency: 2 },
    environments: [],
    hasPassword: false,
    hasToken: false
};
