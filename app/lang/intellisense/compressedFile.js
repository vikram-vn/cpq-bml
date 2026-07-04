"use strict";
// Single shared home for the "does this bundled text asset exist / read it"
// pattern. Every bundled .md ships brotli-compressed (.md.br) in the .vsix -
// the raw file only exists in dev/test runs that skip the build step. This
// exact check/read pair has been duplicated (and gone stale) in multiple
// places already; new callers should use these instead of hand-rolling it.
const fs = require("fs");
const zlib = require("zlib");

function existsCompressed(filePath) {
    return fs.existsSync(filePath) || fs.existsSync(`${filePath}.br`);
}

/** Returns the file's UTF-8 text content, or null if neither variant exists. */
function readCompressedText(filePath) {
    const brPath = `${filePath}.br`;
    if (fs.existsSync(brPath)) {
        return zlib.brotliDecompressSync(fs.readFileSync(brPath)).toString("utf8");
    }
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf8");
    }
    return null;
}

module.exports = { existsCompressed, readCompressedText };
