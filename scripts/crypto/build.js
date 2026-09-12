const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const watPath = path.join(__dirname, 'cipher.wat');
const wasmPath = path.join(__dirname, 'cipher.wasm');
const jsBinPath = path.join(ROOT, 'app', 'lang', 'rest', 'util', 'cipherWasmBinary.js');

async function buildCrypto() {
    if (!fs.existsSync(watPath)) {
        throw new Error(`cipher.wat not found at ${watPath}`);
    }

    console.log('[crypto] Compiling WebAssembly cipher from cipher.wat...');
    const wabt = await require('wabt')();
    const wat = fs.readFileSync(watPath, 'utf8');
    const mod = wabt.parseWat('cipher.wat', wat);
    const { buffer } = mod.toBinary({});

    // Write binary wasm
    fs.writeFileSync(wasmPath, Buffer.from(buffer));
    console.log(`[crypto] Wrote binary to ${path.relative(ROOT, wasmPath)} (${buffer.length} bytes)`);

    // Write base64 JS binary for in-process bundling
    const b64 = Buffer.from(buffer).toString('base64');
    fs.writeFileSync(jsBinPath, `module.exports = Buffer.from('${b64}', 'base64');\n`);
    console.log(`[crypto] Wrote base64 JS module to ${path.relative(ROOT, jsBinPath)}`);

    console.log('[crypto] Build completed successfully.');
}

if (require.main === module) {
    buildCrypto().catch(err => {
        console.error('[crypto] Build failed:', err);
        process.exit(1);
    });
}

module.exports = { buildCrypto };
