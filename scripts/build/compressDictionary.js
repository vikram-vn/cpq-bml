// Brotli-compresses the English spell-check dictionary for packaging.
// english-words.txt is the readable, editable source (kept in git); this
// generates english-words.txt.br (gitignored, ~5x smaller) that spelling.js
// loads at runtime. Re-run automatically by `npm run compile`/`minify` so the
// packaged extension never ships the uncompressed word list.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const srcPath = path.join(__dirname, '..', '..', 'app', 'lang', 'spellCheck', 'english-words.txt');
const outPath = `${srcPath}.br`;

const data = fs.readFileSync(srcPath);
const compressed = zlib.brotliCompressSync(data, {
    params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
    },
});
fs.writeFileSync(outPath, compressed);
console.log(`compressed english-words.txt: ${data.length} -> ${compressed.length} bytes`);
