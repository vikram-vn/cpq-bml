const Module = require('module');
const origRequire = Module.prototype.require;
const vscodeMock = {
    Uri: { file: (p) => ({ fsPath: p, toString: () => p }) },
    Range: function(s, e) { this.start = s; this.end = e; },
    Position: function(l, c) { this.line = l; this.character = c; this.translate = (dl, dc) => new vscodeMock.Position(l + dl, c + dc); },
    Diagnostic: function(range, msg, sev) { this.range = range; this.message = msg; this.severity = sev; },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    DiagnosticTag: { Unnecessary: 1 },
    workspace: { getConfiguration: () => ({ get: (k, d) => d }) }
};
Module.prototype.require = function(path) {
    if (path === 'vscode') return vscodeMock;
    return origRequire.apply(this, arguments);
};

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const sampleCode = fs.readFileSync(path.join(__dirname, 'bml', 'sample.bml'), 'utf8');

console.log('======================================================================');
console.log('COMMENTS, MCP, XSLT & METRICS PERFORMANCE BENCHMARK');
console.log('======================================================================\n');

// 1. Comments Decorate
const { buildCommentDecorations } = require('../app/lang/comments/decorate');
const t0 = performance.now();
const runs = 100;
for (let i = 0; i < runs; i++) buildCommentDecorations(sampleCode);
const t1 = performance.now();
console.log(`💬 Comments Decoration (2,771 lines) : ${((t1 - t0) / runs).toFixed(3)} ms`);

// 2. Metrics Complexity
const { computeComplexity } = require('../app/lang/metrics/complexity');
const t2 = performance.now();
for (let i = 0; i < runs; i++) computeComplexity(sampleCode);
const t3 = performance.now();
console.log(`📊 Metrics Complexity (2,771 lines)  : ${((t3 - t2) / runs).toFixed(3)} ms`);

// 3. XSLT Formatter
const { formatXml } = require('../app/lang/xslt/formatter');
const { lintXslt } = require('../app/lang/xslt/xsltLinter');
const xsltSample = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/"><html><body><h1><xsl:value-of select="title"/></h1><p>Test</p></body></html></xsl:template></xsl:stylesheet>';

const t4 = performance.now();
for (let i = 0; i < runs; i++) formatXml(xsltSample, 4);
const t5 = performance.now();
console.log(`📄 XSLT Formatter (Sample XSLT)      : ${((t5 - t4) / runs).toFixed(3)} ms`);

const xsltDoc = {
    getText: () => xsltSample,
    positionAt: (idx) => new vscodeMock.Position(0, idx)
};
const t4b = performance.now();
for (let i = 0; i < runs; i++) lintXslt(xsltDoc);
const t5b = performance.now();
console.log(`📄 XSLT Linter (Sample XSLT)         : ${((t5b - t4b) / runs).toFixed(3)} ms`);

// 4. MCP Tools Diff & Lint
const { computeLineDiff } = require('../app/lang/mcp/tools/knowledge');
const linesOld = sampleCode.split(/\r?\n/);
const linesNew = [...linesOld];
linesNew[10] = '// Modified line 10';
linesNew[500] = '// Modified line 500';

const t6 = performance.now();
for (let i = 0; i < runs; i++) computeLineDiff(linesOld, linesNew);
const t7 = performance.now();
console.log(`🤖 MCP Fast Diff (2,771 lines)       : ${((t7 - t6) / runs).toFixed(3)} ms`);

console.log('\n======================================================================');
