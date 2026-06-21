'use strict';
/**
 * index.js — BML Intellisense Data Generator
 *
 * Runs all CPQ lookup-to-intellisense transform scripts in order.
 * Each script reads from app/lookups/** and writes to app/lang/intellisense/*.json.
 *
 * Run with:  node app/scripts/index.js
 */

const start = Date.now();
const scripts = [
    { name: 'generateBmlFunctions',     module: './generateBmlFunctions'     },
    { name: 'generateBmlVariables',     module: './generateBmlVariables'     },
    { name: 'generateBmlAttributes',    module: './generateBmlAttributes'    },
    { name: 'generateBmlUtilAttributes', module: './generateBmlUtilAttributes' }
];

let failed = 0;
for (const { name, module: mod } of scripts) {
    try {
        require(mod);
    } catch (err) {
        console.error(`\n❌ [${name}] FAILED: ${err.message}\n`);
        failed++;
    }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(2);
if (failed === 0) {
    console.log(`\n✅ All ${scripts.length} scripts completed successfully in ${elapsed}s`);
} else {
    console.log(`\n⚠  ${scripts.length - failed}/${scripts.length} scripts succeeded, ${failed} failed (${elapsed}s)`);
    process.exit(1);
}
