const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Mock minimal vscode namespace for standalone Node.js benchmarking
const Module = require('module');
const originalRequire = Module.prototype.require;
function MockPosition(line, character) {
    this.line = line;
    this.character = character;
    this.translate = (lineDelta = 0, charDelta = 0) => new MockPosition(this.line + lineDelta, this.character + charDelta);
    this.isEqual = (other) => other && this.line === other.line && this.character === other.character;
}

const vscodeMock = {
    workspace: {
        getConfiguration: () => ({
            get: (key, def) => def
        }),
        createFileSystemWatcher: () => ({
            onDidChange: () => {},
            onDidCreate: () => {},
            onDidDelete: () => {}
        })
    },
    languages: {
        registerCompletionItemProvider: () => ({ dispose: () => {} }),
        registerHoverProvider: () => ({ dispose: () => {} }),
        registerSignatureHelpProvider: () => ({ dispose: () => {} }),
        registerDefinitionProvider: () => ({ dispose: () => {} }),
        registerReferenceProvider: () => ({ dispose: () => {} }),
        registerRenameProvider: () => ({ dispose: () => {} }),
        registerDocumentSymbolProvider: () => ({ dispose: () => {} }),
        registerInlayHintsProvider: () => ({ dispose: () => {} }),
        registerCodeActionsProvider: () => ({ dispose: () => {} }),
        createDiagnosticCollection: () => ({ set: () => {}, clear: () => {}, delete: () => {}, dispose: () => {} })
    },
    Position: MockPosition,
    Range: function(start, end, startChar, endChar) {
        if (typeof start === 'number') {
            this.start = new MockPosition(start, end);
            this.end = new MockPosition(startChar, endChar);
        } else {
            this.start = start;
            this.end = end;
        }
    },
    Diagnostic: function(range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
        this.tags = [];
    },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    DiagnosticTag: { Unnecessary: 1, Deprecated: 2 },
    CompletionItem: function(label, kind) { this.label = label; this.kind = kind; },
    CompletionItemKind: { Method: 0, Function: 1, Property: 2, Variable: 3, Class: 4 },
    SnippetString: function(value) { this.value = value; },
    MarkdownString: function(value) { this.value = value; this.appendCodeblock = () => {}; this.appendMarkdown = () => {}; },
    ParameterInformation: function(label) { this.label = label; },
    SignatureInformation: function(label, doc) { this.label = label; this.documentation = doc; },
    SignatureHelp: function() { this.signatures = []; this.activeSignature = 0; this.activeParameter = 0; },
    Uri: { file: (f) => ({ fsPath: f, toString: () => f }) },
    Location: function(uri, pos) { this.uri = uri; this.range = pos; },
    WorkspaceEdit: function() { this.replace = () => {}; }
};

Module.prototype.require = function(request) {
    if (request === 'vscode') {
        return vscodeMock;
    }
    return originalRequire.apply(this, arguments);
};

const rootDir = path.resolve(__dirname, '..', '..');
const sampleBmlPath = path.join(rootDir, 'bml', 'sample.bml');
const sampleBml = fs.readFileSync(sampleBmlPath, 'utf8');
const totalLines = sampleBml.split(/\r?\n/).length;

console.log(`\n======================================================================`);
console.log(` 🚀 ORACLE CPQ-BML EXTENSION BENCHMARK SUITE`);
console.log(`======================================================================`);
console.log(` Target File:    bml/sample.bml (${totalLines.toLocaleString()} lines, ${(sampleBml.length / 1024).toFixed(1)} KB)`);
console.log(` Node Version:   ${process.version}`);
console.log(` Platform:       ${process.platform} ${process.arch}`);
console.log(`======================================================================\n`);

const results = [];

function runBenchmark(name, iterations, fn) {
    // Warmup
    fn();
    fn();

    const times = [];
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        fn();
        const t1 = performance.now();
        times.push(t1 - t0);
    }
    const total = performance.now() - start;
    times.sort((a, b) => a - b);

    const avg = total / iterations;
    const min = times[0];
    const max = times[times.length - 1];
    const p95 = times[Math.floor(times.length * 0.95)];
    const throughput = Math.round((totalLines * iterations) / (total / 1000));

    results.push({ name, iterations, avg, min, max, p95, throughput });

    console.log(`⚡ [${name}]`);
    console.log(`   Iterations: ${iterations} runs`);
    console.log(`   Average:    ${avg.toFixed(2)} ms`);
    console.log(`   Min / Max:  ${min.toFixed(2)} ms / ${max.toFixed(2)} ms`);
    console.log(`   p95:        ${p95.toFixed(2)} ms`);
    console.log(`   Throughput: ${throughput.toLocaleString()} lines / sec\n`);
}

// 1. Beautifier Formatter Benchmark
try {
    const beautify = require('../../app/lang/beautify/bml');
    runBenchmark('Beautifier / Formatter (Full File)', 30, () => {
        beautify(sampleBml, { indent_size: 4, space_in_empty_paren: false });
    });
} catch (e) {
    console.error('Beautifier benchmark failed:', e.message);
}

// 2. Spell Checker Benchmark
try {
    const { checkSpelling } = require('../../app/lang/spell-check/spelling');
    const { getCommentRanges } = require('../../app/lang/lint/rules/comments');
    const { getStringRanges } = require('../../app/lang/lint/rules/strings');
    
    // Mock minimal doc
    const mockDoc = {
        getText: () => sampleBml,
        positionAt: (offset) => ({ line: 0, character: 0 }),
        uri: { fsPath: sampleBmlPath }
    };
    const mockVscode = {
        workspace: {
            getConfiguration: () => ({ get: () => [] })
        },
        Diagnostic: function(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        },
        DiagnosticSeverity: { Information: 2, Error: 0, Warning: 1 },
        Range: function(start, end) { this.start = start; this.end = end; }
    };

    const commentRanges = getCommentRanges(sampleBml);
    const cleanText = sampleBml;
    const stringRanges = getStringRanges(cleanText);
    const noStringsText = cleanText;

    runBenchmark('Spell Checker (20,000+ Tokens)', 30, () => {
        checkSpelling(sampleBml, cleanText, noStringsText, mockDoc, mockVscode, rootDir);
    });
} catch (e) {
    console.error('Spell checker benchmark failed:', e.message);
}

// 3. IntelliSense API Loading & Indexing Benchmark
try {
    const { getBmlApiData, invalidateApiData } = require('../../app/lang/intellisense/apiData');
    runBenchmark('IntelliSense Catalog Loading & Query', 100, () => {
        const data = getBmlApiData();
        const info = data['bmql-select'] || data['gettransaction'];
    });
} catch (e) {
    console.error('IntelliSense benchmark failed:', e.message);
}

const lineOffsets = [0];
for (let i = 0; i < sampleBml.length; i++) {
    if (sampleBml[i] === '\n') lineOffsets.push(i + 1);
}

function offsetToPosition(offset) {
    let low = 0, high = lineOffsets.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (lineOffsets[mid] <= offset) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    const line = Math.max(0, high);
    const character = Math.max(0, offset - lineOffsets[line]);
    return new MockPosition(line, character);
}

// 4. Local Variables Scanner Benchmark
try {
    const { collectLocalVariables } = require('../../app/lang/intellisense/bmqlVariableCompletions');
    const sampleLines = sampleBml.split(/\r?\n/);
    const mockDoc = {
        getText: (range) => sampleBml,
        lineCount: sampleLines.length,
        lineAt: (line) => ({ text: sampleLines[line] || '' })
    };
    const position = new MockPosition(totalLines - 1, 10);

    runBenchmark('Local Variables Scope Scanning', 50, () => {
        collectLocalVariables(mockDoc, position);
    });
} catch (e) {
    console.error('Local variables benchmark failed:', e.message);
}

// 5. Signature Help Active Call Detection Benchmark
try {
    const { getActiveFunctionCall } = require('../../app/lang/intellisense/signatureHelp');
    const mockDoc = {
        getText: (range) => sampleBml.slice(Math.max(0, sampleBml.length - 2000)),
        positionAt: (offset) => ({ line: 0, character: 0 })
    };
    const position = new MockPosition(totalLines - 1, 10);

    runBenchmark('Signature Help Function Call Detection', 200, () => {
        getActiveFunctionCall(mockDoc, position);
    });
} catch (e) {
    console.error('Signature help benchmark failed:', e.message);
}

// 6. Full Linter Pass (All 27 Rules) Benchmark
try {
    const { lintBMLCustom } = require('../../app/lang/lint/core/lint');
    const sampleLines = sampleBml.split(/\r?\n/);
    const mockDoc = {
        getText: () => sampleBml,
        positionAt: offsetToPosition,
        lineAt: (line) => ({ text: sampleLines[line] || '' }),
        uri: { fsPath: sampleBmlPath, toString: () => sampleBmlPath }
    };
    const mockCollection = {
        set: () => {},
        clear: () => {},
        delete: () => {}
    };
    const mockVscode = {
        workspace: {
            getConfiguration: () => ({ get: () => true })
        },
        Diagnostic: function(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
            this.tags = [];
        },
        DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
        DiagnosticTag: { Unnecessary: 1, Deprecated: 2 },
        Range: function(start, end) { this.start = start; this.end = end; },
        Position: function(line, character) { this.line = line; this.character = character; }
    };

    runBenchmark('BML Static Linter (All 27 Rules)', 20, () => {
        lintBMLCustom(mockDoc, mockCollection, mockVscode, rootDir);
    });
} catch (e) {
    console.error('Linter benchmark failed:', e.message);
}

// 7. IntelliSense Hover Resolution Benchmark
try {
    const { lookupApiInfo, getBmlApiData } = require('../../app/lang/intellisense/apiData');
    const { formatAsJsDoc } = require('../../app/lang/intellisense/docFormatting');

    runBenchmark('IntelliSense Hover Info Resolution', 200, () => {
        const info = lookupApiInfo('jsonput') || lookupApiInfo('getdate');
        if (info) {
            formatAsJsDoc(info);
        }
    });
} catch (e) {
    console.error('Hover benchmark failed:', e.message);
}

// 8. Workspace Indexing Scan & Lookup Benchmark
try {
    const { getWorkspaceIndex, invalidateIndex } = require('../../app/lang/intellisense/workspaceIndex');

    runBenchmark('Workspace Function Indexing & Lookup', 30, () => {
        invalidateIndex();
        const index = getWorkspaceIndex();
        index.get('util.calculatepricing');
    });
} catch (e) {
    console.error('Workspace index benchmark failed:', e.message);
}

console.log(`======================================================================`);
console.log(` 📊 BENCHMARK SUMMARY REPORT`);
console.log(`======================================================================`);
console.log(`| Subsystem | Avg Time (ms) | p95 (ms) | Throughput (lines/sec) | Status |`);
console.log(`| :--- | :--- | :--- | :--- | :--- |`);
for (const r of results) {
    const status = r.avg < 100 ? '✅ EXCELLENT (<100ms)' : r.avg < 300 ? '⚡ GOOD (<300ms)' : '⚠️ ATTENTION';
    console.log(`| **${r.name}** | ${r.avg.toFixed(2)} ms | ${r.p95.toFixed(2)} ms | ${r.throughput.toLocaleString()} | ${status} |`);
}
console.log(`======================================================================\n`);
