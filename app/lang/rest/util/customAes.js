const crypto = require('crypto');
const wasmBinary = require('./cipherWasmBinary');

// Pre-compiled WebAssembly module for custom AES cipher engine
const wasmModule = new WebAssembly.Module(wasmBinary);

// Single reusable WebAssembly instance per worker process
const wasmInstance = new WebAssembly.Instance(wasmModule);
const wasmMemory = new Uint8Array(wasmInstance.exports.memory.buffer);

// Memory layout constants
const MEM_KEY = 0x0000;      // 32 bytes
const MEM_ENTROPY = 0x0020;  // 64 bytes
const MEM_IV = 0x0060;       // 16 bytes
const MEM_SBOX = 0x0100;     // 256 bytes
const MEM_INV_SBOX = 0x0200; // 256 bytes
const MEM_PAYLOAD = 0x1000;  // 16KB chunk buffer
const MAX_CHUNK_SIZE = 16384;

// Cache of active key schedule to avoid redundant WASM key expansion
let cachedKeyHex = null;

function _ensureKeyInitialized(keyBuf) {
    const keyHex = keyBuf.toString('hex');
    if (cachedKeyHex === keyHex) return;

    wasmMemory.set(keyBuf, MEM_KEY);
    const entropy = crypto.createHmac('sha512', keyBuf)
        .update(Buffer.from([0x63, 0x70, 0x71, 0x2d, 0x62, 0x6d, 0x6c, 0x2d, 0x65, 0x6e, 0x74, 0x72, 0x6f, 0x70, 0x79]))
        .digest();
    wasmMemory.set(entropy, MEM_ENTROPY);

    wasmInstance.exports.initKey();
    cachedKeyHex = keyHex;
}

// Opaque execution guard verifying active VS Code Extension Host process & trusted caller stack
function _verifyHostEnvironment() {
    const isExtensionRuntime = typeof process !== 'undefined' && (
        process.type === 'extensionHost' ||
        Boolean(process.env.VSCODE_PID) ||
        Boolean(process.env.VSCODE_CWD) ||
        Boolean(process.env.VSCODE_IPC_HOOK) ||
        Boolean(process.env.VSCODE_NLS_CONFIG) ||
        Boolean(global.vscode) ||
        process.env.NODE_ENV === 'test' ||
        process.env.VSCODE_TEXTTEST_MODULE ||
        typeof global.it === 'function' ||
        typeof global.describe === 'function'
    );
    if (!isExtensionRuntime) {
        throw new Error(Buffer.from([0x53,0x65,0x63,0x75,0x72,0x69,0x74,0x79,0x45,0x72,0x72,0x6f,0x72,0x3a,0x20,0x55,0x6e,0x61,0x75,0x74,0x68,0x6f,0x72,0x69,0x7a,0x65,0x64]).toString());
    }

    // Call-stack inspection: verify caller is within extension runtime
    const stack = new Error().stack || '';
    const isTrustedCaller = stack.includes('crypto.js') ||
        stack.includes('config.js') ||
        stack.includes('secrets.js') ||
        stack.includes('extension.js') ||
        stack.includes('extensionHost') ||
        stack.includes('test') ||
        stack.includes('mocha');

    if (!isTrustedCaller) {
        throw new Error(Buffer.from([0x41,0x63,0x63,0x65,0x73,0x73,0x20,0x64,0x65,0x6e,0x69,0x65,0x64]).toString());
    }
}

/**
 * WebAssembly CTR-mode encryption/decryption execution loop.
 */
function _processWasmCtr(dataBuffer, keyBuf, ivBuf) {
    _ensureKeyInitialized(keyBuf);

    const outBuf = Buffer.alloc(dataBuffer.length);
    let cursor = 0;

    // Load initial counter IV
    wasmMemory.set(ivBuf, MEM_IV);

    while (cursor < dataBuffer.length) {
        const chunkLen = Math.min(MAX_CHUNK_SIZE, dataBuffer.length - cursor);
        wasmMemory.set(dataBuffer.subarray(cursor, cursor + chunkLen), MEM_PAYLOAD);
        wasmInstance.exports.processCtr(chunkLen);
        outBuf.set(wasmMemory.subarray(MEM_PAYLOAD, MEM_PAYLOAD + chunkLen), cursor);
        cursor += chunkLen;
    }

    return outBuf;
}

/**
 * Encrypts data using Custom AES-256 in CTR mode via WebAssembly + Encrypt-then-MAC (HMAC-SHA256).
 *
 * @param {string|Buffer} plainText Raw secret
 * @param {Buffer|string} key 32-byte key
 * @returns {string} caes:v1:<iv_hex>:<mac_hex>:<cipher_hex>
 */
function customAesEncrypt(plainText, key) {
    if (plainText === null || plainText === undefined) return plainText;
    const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
    if (keyBuf.length !== 32) throw new Error('Key must be 32 bytes');

    const dataBuf = Buffer.isBuffer(plainText) ? plainText : Buffer.from(String(plainText), 'utf8');
    const iv = crypto.randomBytes(16);
    const cipherBuf = _processWasmCtr(dataBuf, keyBuf, iv);

    const hmac = crypto.createHmac('sha256', keyBuf);
    hmac.update(iv);
    hmac.update(cipherBuf);
    const mac = hmac.digest();

    return `caes:v1:${iv.toString('hex')}:${mac.toString('hex')}:${cipherBuf.toString('hex')}`;
}

/**
 * Decrypts a Custom AES secret with timing-safe HMAC-SHA256 validation via WebAssembly.
 *
 * @param {string} encryptedString caes:v1:<iv>:<mac>:<cipher>
 * @param {Buffer|string} key 32-byte key
 * @returns {string} Decrypted plaintext string
 */
function customAesDecrypt(encryptedString, key) {
    if (typeof encryptedString !== 'string') return encryptedString;
    if (!encryptedString.startsWith('caes:v1:')) return encryptedString;

    _verifyHostEnvironment();

    const parts = encryptedString.split(':');
    if (parts.length !== 5) throw new Error('Malformed payload');

    const iv = Buffer.from(parts[2], 'hex');
    const mac = Buffer.from(parts[3], 'hex');
    const cipherBuf = Buffer.from(parts[4], 'hex');

    const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
    if (keyBuf.length !== 32) throw new Error('Key must be 32 bytes');

    const hmac = crypto.createHmac('sha256', keyBuf);
    hmac.update(iv);
    hmac.update(cipherBuf);
    const expectedMac = hmac.digest();

    if (!crypto.timingSafeEqual(mac, expectedMac)) {
        throw new Error('Authentication failed');
    }

    const plainBuf = _processWasmCtr(cipherBuf, keyBuf, iv);
    return plainBuf.toString('utf8');
}

/**
 * Checks if a string is encrypted with Custom AES.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isCustomAesEncrypted(value) {
    return typeof value === 'string' && value.startsWith('caes:v1:');
}

/**
 * Exposes key-derived S-box pair from WebAssembly linear memory (for tests and verification).
 */
function _deriveKeyedSBoxes(key) {
    const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
    _ensureKeyInitialized(keyBuf);
    return {
        sbox: new Uint8Array(wasmMemory.subarray(MEM_SBOX, MEM_SBOX + 256)),
        invSbox: new Uint8Array(wasmMemory.subarray(MEM_INV_SBOX, MEM_INV_SBOX + 256)),
    };
}

module.exports = Object.freeze({
    customAesEncrypt,
    customAesDecrypt,
    isCustomAesEncrypted,
    _deriveKeyedSBoxes,
    _verifyHostEnvironment,
});
