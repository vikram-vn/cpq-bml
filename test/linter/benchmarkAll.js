const fs = require('fs');
const path = require('path');
const Module = require('module');

// Set up mock vscode environment for benchmarking outside VS Code host
const origRequire = Module.prototype.require;
const vscodeMock = {
    Uri: { file: (p) => ({ fsPath: p, toString: () => p }) },
    Range: function(s, e) { this.start = s; this.end = e; },
    Position: function(l, c) { this.line = l; this.character = c; this.translate = (dl, dc) => new vscodeMock.Position(l + dl, c + dc); },
    Diagnostic: function(range, msg, sev) { this.range = range; this.message = msg; this.severity = sev; },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    DiagnosticTag: { Unnecessary: 1 },
    workspace: { getConfiguration: () => ({ get: (k, d) => d }) },
    window: { visibleTextEditors: [] }
};
Module.prototype.require = function(p) {
    if (p === 'vscode') return vscodeMock;
    return origRequire.apply(this, arguments);
};

const { lintBMLCustom } = require('../../app/lang/lint/lint');
const { checkSpelling } = require('../../app/lang/spell-check/spelling');
const bml_beautify = require('../../app/lang/beautify/bml');
const { getDeclaredVariables } = require('../../app/lang/lint/variables');

function createMockDoc(text, fsPath = 'test.bml') {
    const lines = text.split(/\r?\n/);
    const lineOffsets = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') lineOffsets.push(i + 1);
    }
    return {
        getText: () => text,
        languageId: 'bml',
        lineCount: lines.length,
        version: 1,
        uri: vscodeMock.Uri.file(fsPath),
        lineAt: (line) => ({ text: lines[line] || '', range: new vscodeMock.Range(new vscodeMock.Position(line, 0), new vscodeMock.Position(line, (lines[line] || '').length)) }),
        positionAt: (offset) => {
            let low = 0, high = lineOffsets.length - 1;
            while (low <= high) {
                const mid = (low + high) >> 1;
                if (lineOffsets[mid] <= offset) low = mid + 1;
                else high = mid - 1;
            }
            const line = high;
            const character = offset - lineOffsets[line];
            return new vscodeMock.Position(line, character);
        }
    };
}

const smallCode = `
x = 10;
y = 20;
if (x > 5) {
    print("x is greater: " + string(x));
}
return string(x + y);
`;

const mediumCode = `
// Process customer transaction quotes
quoteId = 12345;
customerName = "ACME Corp";
discountRate = 0.15;
items = string[]{"SKU-001", "SKU-002", "SKU-003"};

records = bmql("SELECT part_number, price FROM _parts WHERE active = true");
total = 0.0;
for row in records {
    price = getfloat(row, "price");
    if (price > 0.0) {
        total = total + price;
    }
}

dictData = dict("string");
put(dictData, "quoteId", string(quoteId));
put(dictData, "status", "APPROVED");

jsonRes = json();
jsonput(jsonRes, "total", total);
jsonput(jsonRes, "customer", customerName);

return jsontostr(jsonRes);
`.repeat(5); // ~110 lines

const sampleBmlPath = path.join(__dirname, '..', 'bml', 'sample.bml');
const largeCode = fs.readFileSync(sampleBmlPath, 'utf8'); // 2,771 lines

function benchmark(name, fn, iterations = 20) {
    // Warmup
    for (let i = 0; i < 3; i++) fn();

    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = process.hrtime.bigint();
    const totalMs = Number(end - start) / 1e6;
    const avgMs = totalMs / iterations;
    return { name, avgMs, iterations, totalMs };
}

console.log('='.repeat(70));
console.log('CPQ-BML EXTENSION PERFORMANCE BENCHMARK SUITE');
console.log('='.repeat(70));

const results = {};

// 1. LINTING BENCHMARKS (Full 25+ checkers)
console.log('\n[1/4] Running Linting Benchmarks (Full 25+ Rules)...');
const mockCollection = { set: () => {}, delete: () => {} };
const extPath = path.join(__dirname, '..', '..');

const smallDoc = createMockDoc(smallCode);
const medDoc = createMockDoc(mediumCode);
const largeDoc = createMockDoc(largeCode, sampleBmlPath);

results.lintSmall = benchmark('Lint Small Script (7 lines)', () => {
    lintBMLCustom(smallDoc, mockCollection, vscodeMock, extPath);
}, 50);

results.lintMed = benchmark('Lint Medium Script (110 lines)', () => {
    lintBMLCustom(medDoc, mockCollection, vscodeMock, extPath);
}, 30);

results.lintLarge = benchmark('Lint Massive Suite (2,771 lines)', () => {
    lintBMLCustom(largeDoc, mockCollection, vscodeMock, extPath);
}, 10);

// 2. SPELL-CHECK BENCHMARKS
console.log('[2/4] Running Spell-Check Benchmarks...');
function runSpellCheck(doc) {
    const text = doc.getText();
    const cleanText = text;
    const noStringsText = text;
    checkSpelling(text, cleanText, noStringsText, doc, vscodeMock, extPath);
}

results.spellSmall = benchmark('Spell-Check Small (7 lines)', () => runSpellCheck(smallDoc), 50);
results.spellMed = benchmark('Spell-Check Medium (110 lines)', () => runSpellCheck(medDoc), 30);
results.spellLarge = benchmark('Spell-Check Massive (2,771 lines)', () => runSpellCheck(largeDoc), 10);

// 3. BEAUTIFY / FORMATTER BENCHMARKS
console.log('[3/4] Running Beautify / Formatter Benchmarks...');
results.formatSmall = benchmark('Beautify Small (7 lines)', () => bml_beautify(smallCode, { indent_size: 4 }), 50);
results.formatMed = benchmark('Beautify Medium (110 lines)', () => bml_beautify(mediumCode, { indent_size: 4 }), 30);
results.formatLarge = benchmark('Beautify Massive (2,771 lines)', () => bml_beautify(largeCode, { indent_size: 4 }), 10);

// 4. INTELLISENSE / METADATA LOOKUP BENCHMARKS
console.log('[4/6] Running Intellisense / Variable Analysis Benchmarks...');
results.intelSmall = benchmark('Scope Analysis Small', () => getDeclaredVariables(smallCode, smallDoc), 50);
results.intelMed = benchmark('Scope Analysis Medium', () => getDeclaredVariables(mediumCode, medDoc), 30);
results.intelLarge = benchmark('Scope Analysis Massive', () => getDeclaredVariables(largeCode, largeDoc), 10);

// 5. COMMENTS & METRICS BENCHMARKS
console.log('[5/6] Running Comments & Code Metrics Benchmarks...');
const { buildCommentDecorations } = require('../../app/lang/comments/decorate');
const { computeComplexity } = require('../../app/lang/metrics/complexity');

results.commentMed = benchmark('Comment Tags & Docs (110 lines)', () => buildCommentDecorations(mediumCode), 50);
results.commentLarge = benchmark('Comment Tags & Docs (2,771 lines)', () => buildCommentDecorations(largeCode), 20);
results.metricsMed = benchmark('Metrics Complexity (110 lines)', () => computeComplexity(mediumCode), 50);
results.metricsLarge = benchmark('Metrics Complexity (2,771 lines)', () => computeComplexity(largeCode), 20);

// 6. XSLT & MCP TOOLS BENCHMARKS
console.log('[6/6] Running XSLT & MCP Knowledge Tools Benchmarks...');
const { formatXml } = require('../../app/lang/xslt/formatter');
const { lintXslt } = require('../../app/lang/xslt/xsltLinter');
const { computeLineDiff } = require('../../app/lang/mcp/tools/knowledge');

const xsltSample = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/"><html><body><h1><xsl:value-of select="title"/></h1><p>Test</p></body></html></xsl:template></xsl:stylesheet>';
const xsltDoc = createMockDoc(xsltSample, 'sample.xsl');

results.xsltFormat = benchmark('XSLT Formatter', () => formatXml(xsltSample, 4), 50);
results.xsltLint = benchmark('XSLT Linter', () => lintXslt(xsltDoc), 50);

const linesOld = largeCode.split(/\r?\n/);
const linesNew = [...linesOld];
linesNew[10] = '// Modified line 10';
linesNew[500] = '// Modified line 500';
results.mcpDiff = benchmark('MCP Function Diff (2,771 lines)', () => computeLineDiff(linesOld, linesNew), 20);

console.log('\n' + '='.repeat(70));
console.log('BENCHMARK RESULTS SUMMARY');
console.log('='.repeat(70));
console.log(String('Feature / Test Case').padEnd(38) + String('Avg Latency').padStart(14) + String('Status').padStart(14));
console.log('-'.repeat(70));

for (const [key, res] of Object.entries(results)) {
    const latencyStr = res.avgMs < 1 ? `${(res.avgMs * 1000).toFixed(0)} \u03BCs` : `${res.avgMs.toFixed(2)} ms`;
    const rating = res.avgMs < 20 ? '⚡ Ultra Fast' : (res.avgMs < 100 ? '✅ Fast' : '⏱️ Acceptable');
    console.log(res.name.padEnd(38) + latencyStr.padStart(14) + rating.padStart(14));
}
console.log('='.repeat(70));
