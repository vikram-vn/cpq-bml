const crypto = require('crypto');
const {
    customAesEncrypt,
    customAesDecrypt,
    isCustomAesEncrypted,
} = require('@/lang/rest/util/customAes');

const GLOBAL_SEED_KEY = 'cpqBml.security.masterSeed';
const { getExtensionContext } = require('@/extensionContext');

// In-memory key cache for the active extension process
let inMemoryMasterKey = null;

/**
 * Derives a machine-bound 32-byte master key from random entropy and installation identity.
 * The random seed is held in extension globalState (separate from secretStorage).
 *
 * @param {object} [context] VS Code extension context
 * @param {object} [vscode] VS Code module
 * @returns {Buffer} 32-byte master key
 */
function getMasterKey(context, vscode) {
    if (inMemoryMasterKey) {
        return inMemoryMasterKey;
    }

    const g = getExtensionContext();
    const ctx = context || g.context;
    const vsc = vscode || g.vscode;

    let seed = null;
    if (ctx && ctx.globalState && typeof ctx.globalState.get === 'function') {
        seed = ctx.globalState.get(GLOBAL_SEED_KEY);
    }

    if (!seed) {
        // Generate cryptographically random 32-byte seed
        seed = crypto.randomBytes(32).toString('hex');
        if (ctx && ctx.globalState && typeof ctx.globalState.update === 'function') {
            try {
                ctx.globalState.update(GLOBAL_SEED_KEY, seed);
            } catch (_) {}
        }
    }

    // Bind seed with installation entropy (machineId) so the key is tied to this environment
    const machineId = (vsc && vsc.env && vsc.env.machineId) ? vsc.env.machineId : 'cpq-bml-local-machine';
    const hmac = crypto.createHmac('sha256', Buffer.from(seed, 'hex'));
    hmac.update(`cpq-bml-vault-${machineId}`);
    inMemoryMasterKey = hmac.digest();

    return inMemoryMasterKey;
}

/**
 * Encrypts a secret using the random Master Key and Custom AES-256.
 *
 * @param {string} plainText The raw password or token
 * @param {object} context VS Code extension context
 * @param {object} vscode VS Code module
 * @returns {string} Encrypted string: "caes:v1:..."
 */
function encryptSecret(plainText, context, vscode) {
    if (!plainText) return plainText;
    const key = getMasterKey(context, vscode);
    return customAesEncrypt(plainText, key);
}

/**
 * Decrypts a secret. If the string is unencrypted legacy text, returns it unchanged.
 *
 * @param {string} cipherText The stored secret
 * @param {object} context VS Code extension context
 * @param {object} vscode VS Code module
 * @returns {string} Decrypted plaintext
 */
function decryptSecret(cipherText, context, vscode) {
    if (!cipherText || !isCustomAesEncrypted(cipherText)) {
        return cipherText;
    }
    const key = getMasterKey(context, vscode);
    return customAesDecrypt(cipherText, key);
}

/**
 * Resets the in-memory cache (primarily used in tests).
 */
function resetKeyCache() {
    inMemoryMasterKey = null;
}

/**
 * Sets an explicit key for testing or overrides.
 */
function setMasterKeyForTesting(keyBuf) {
    inMemoryMasterKey = keyBuf;
}

module.exports = {
    getMasterKey,
    encryptSecret,
    decryptSecret,
    isCustomAesEncrypted,
    resetKeyCache,
    setMasterKeyForTesting,
    GLOBAL_SEED_KEY,
};
