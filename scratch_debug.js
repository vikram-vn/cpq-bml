const Module = require('module');
const originalRequire = Module.prototype.require;

const mockVscode = {
    Diagnostic: function(range, msg, severity) {
        this.range = range;
        this.message = msg;
        this.severity = severity;
    },
    DiagnosticSeverity: {
        Warning: 1,
        Error: 2
    },
    Range: function(start, end) {
        this.start = start;
        this.end = end;
    },
    Position: function(line, char) {
        this.line = line;
        this.character = char;
        this.translate = function(l, c) {
            return new mockVscode.Position(line + l, char + c);
        };
    }
};

Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

const { checkNullSafety } = require('./app/lang/lint/nullSafety');

function test(text) {
    const doc = {
        positionAt: (idx) => {
            const lines = text.slice(0, idx).split(/\n/);
            const line = lines.length - 1;
            const char = lines[lines.length - 1].length;
            return new mockVscode.Position(line, char);
        },
    };
    const noStringsText = text.replace(/"[^"]*"/g, (m) => " ".repeat(m.length));
    const cleanText = noStringsText;
    return checkNullSafety(cleanText, noStringsText, doc);
}

console.log("No guard:", JSON.stringify(test(`
    rows = bmql("SELECT id FROM table");
    x = rows[0];
    return x;
`), null, 2));

console.log("isnull guard:", JSON.stringify(test(`
    rows = bmql("SELECT id FROM table");
    if (isnull(rows)) {
        return "";
    }
    x = rows[0];
    return x;
`), null, 2));

console.log("sizeofarray guard:", JSON.stringify(test(`
    rows = bmql("SELECT id FROM table");
    if (sizeofarray(rows) > 0) {
        x = rows[0];
    }
    return "";
`), null, 2));
