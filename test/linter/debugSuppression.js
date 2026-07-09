// Debug script - run with: node test/linter/debugSuppression.js
const { computeSuppressions } = require('../../app/lang/lint/suppressions');
const { getCommentRanges } = require('../../app/lang/lint/comments');

function test(label, text, line, code) {
    const ranges = getCommentRanges(text);
    console.log(`\n[${label}]`);
    console.log('  commentRanges:', ranges.map(([s,e]) => `"${text.slice(s,e).replace(/\n/g,'\\n')}"`));
    const sup = computeSuppressions(text, ranges);
    console.log(`  isSuppressed(line=${line}, code=${code}):`, sup.isSuppressed(line, code));
}

// Test 1: block comment disable-next-line
const t1 = '\n            /* bml-lint-disable-next-line */\n            x = 10 / 0;\n        ';
const lines1 = t1.split('\n');
lines1.forEach((l, i) => console.log(`  L${i}: ${JSON.stringify(l)}`));
test('block comment disable-next-line', t1, 2, undefined);

// Test 2: mixed case
const t2 = '\n            // Bml-Lint-Disable-Next-Line\n            x = 10 / 0;\n        ';
test('mixed-case disable-next-line', t2, 2, undefined);
