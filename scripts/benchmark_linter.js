// Mock VS Code API for standalone node benchmarking
const mockVscode = {
    Position: class Position {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
        translate(lineDelta = 0, charDelta = 0) {
            return new Position(this.line + lineDelta, this.character + charDelta);
        }
    },
    Range: class Range {
        constructor(start, end) {
            this.start = start;
            this.end = end;
        }
    },
    Diagnostic: class Diagnostic {
        constructor(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        }
    },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    DiagnosticTag: { Unnecessary: 1, Deprecated: 2 },
    Uri: { file: (path) => ({ fsPath: path, toString: () => path }) },
    workspace: {
        getConfiguration: () => ({
            get: (key, defaultValue) => {
                if (key === 'features.spelling') return false;
                return defaultValue;
            }
        })
    }
};

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
    if (request === 'vscode') return mockVscode;
    return originalRequire.apply(this, arguments);
};

const { lintBMLCustom } = require("../app/lang/lint/lint");

// Build a realistic 1,000 line BML script
const sampleBlock = `
    // Section header comment
    urlParamsStr = makeurlparam({ "grant_type" : "client_credentials" });
    endpointUrlStr = "";
    configResultSet = bmql("SELECT endpoint_url FROM integration_config WHERE config_key = 'HEALTH_CHECK_URL'");
    for configRow in configResultSet {
        endpointUrlStr = get(configRow, "endpoint_url");
    }

    if (endpointUrlStr <> "") {
        urlResponseDict = urldata(endpointUrlStr, "GET");
    }

    urlStatusCodeStr = "";
    if (containskey(urlResponseDict, "Status-Code")) {
        urlStatusCodeStr = get(urlResponseDict, "Status-Code");
    }

    if (urlStatusCodeStr <> "-1" and startswith(urlStatusCodeStr, "200")) {
        urlResponseBodyStr = get(urlResponseDict, "Message-Body");
    } else if (containskey(urlResponseDict, "Error-Message")) {
        urlErrorMsgStr = get(urlResponseDict, "Error-Message");
    }

    items = string[]{"item1", "item2", "item3"};
    total = 0.0;
    for item in items {
        price = 19.99;
        total = total + price;
    }
`;

const largeBMLText = sampleBlock.repeat(40) + '\nreturn "";\n';
const lineCount = largeBMLText.split(/\r?\n/).length;

const lineOffsets = [0];
for (let i = 0; i < largeBMLText.length; i++) {
    if (largeBMLText[i] === '\n') lineOffsets.push(i + 1);
}

const doc = {
    languageId: 'bml',
    getText: () => largeBMLText,
    positionAt: (idx) => {
        let low = 0, high = lineOffsets.length - 1;
        let line = 0;
        while (low <= high) {
            const mid = (low + high) >> 1;
            if (lineOffsets[mid] <= idx) {
                line = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        const col = idx - lineOffsets[line];
        return new mockVscode.Position(line, col);
    },
    uri: mockVscode.Uri.file('/mock/test.bml')
};

const collection = { set: () => {}, delete: () => {}, clear: () => {} };

const path = require("path");
const rootPath = path.resolve(__dirname, "..");

// Warm up pass
lintBMLCustom(doc, collection, mockVscode, rootPath);

// Benchmark 50 runs
const iterations = 50;
const start = performance.now();
for (let i = 0; i < iterations; i++) {
    lintBMLCustom(doc, collection, mockVscode, rootPath);
}
const end = performance.now();

const totalMs = end - start;
const avgMs = totalMs / iterations;
const throughput = Math.round(1000 / avgMs);

console.log(`\n======================================================`);
console.log(` BML Linter Standalone Speed Benchmark Results`);
console.log(`======================================================`);
console.log(` Document Size:      ${lineCount} lines`);
console.log(` Benchmark Runs:     ${iterations} iterations`);
console.log(` Total Elapsed Time: ${totalMs.toFixed(2)} ms`);
console.log(` Avg Time per Pass:  ${avgMs.toFixed(2)} ms / 1,000 lines`);
console.log(` Throughput:         ${throughput} passes / second`);
console.log(` Latency Status:     ${avgMs < 20 ? 'SUPER FAST (<20ms)' : 'ACCEPTABLE'}`);
console.log(`======================================================\n`);
