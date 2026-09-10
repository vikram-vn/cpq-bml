// Mock helper using prototype pattern (no ES6 classes)
function MockPosition(line, character) {
    this.line = line;
    this.character = character;
}
MockPosition.prototype.translate = function(l, c) {
    return new MockPosition(this.line + (l || 0), this.character + (c || 0));
};

function MockRange(startLine, startChar, endLine, endChar) {
    this.start = new MockPosition(startLine, startChar);
    this.end = new MockPosition(endLine, endChar);
}

function MockDiagnostic(range, message, severity, code) {
    this.range = range;
    this.message = message;
    this.severity = severity;
    this.code = code;
}

function createMockDoc(content) {
    const lines = content.split('\n');
    return {
        getText: function(range) {
            if (!range) return content;
            if (range.start.line === range.end.line) {
                return lines[range.start.line].substring(range.start.character, range.end.character);
            }
            return lines[range.start.line].substring(range.start.character);
        },
        lineAt: function(idx) {
            return {
                text: lines[idx],
                range: new MockRange(idx, 0, idx, lines[idx].length)
            };
        },
        uri: { fsPath: '/test/script.bml', toString: function() { return 'file:///test/script.bml'; } }
    };
}

module.exports = {
    MockPosition,
    MockRange,
    MockDiagnostic,
    createMockDoc
};
