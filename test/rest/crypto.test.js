const assert = require('assert');
const {
    getMasterKey,
    encryptSecret,
    decryptSecret,
    isCustomAesEncrypted,
    resetKeyCache,
    GLOBAL_SEED_KEY,
} = require('@/lang/rest/crypto');

function createMockContext(initialState = {}) {
    const state = { ...initialState };
    return {
        globalState: {
            get: (k) => state[k],
            update: (k, v) => { state[k] = v; return Promise.resolve(); },
        },
    };
}

const mockVscode = {
    env: { machineId: 'test-machine-uuid-1234' },
};

suite('Crypto Manager - Random Master Key & Custom AES', () => {
    setup(() => {
        resetKeyCache();
    });

    test('generates and persists random seed in globalState', () => {
        const context = createMockContext();
        const key1 = getMasterKey(context, mockVscode);
        assert.ok(Buffer.isBuffer(key1));
        assert.strictEqual(key1.length, 32);

        // Verify seed was written to globalState
        assert.ok(context.globalState.get(GLOBAL_SEED_KEY));

        // Subsequent call derives identical key
        resetKeyCache();
        const key2 = getMasterKey(context, mockVscode);
        assert.deepStrictEqual(key1, key2);
    });

    test('encrypts by default and decrypts round-trip', () => {
        const context = createMockContext();
        const password = 'SecretPassword123!';

        const encrypted = encryptSecret(password, context, mockVscode);
        assert.ok(isCustomAesEncrypted(encrypted));
        assert.ok(!encrypted.includes('SecretPassword123!'));

        const decrypted = decryptSecret(encrypted, context, mockVscode);
        assert.strictEqual(decrypted, password);
    });

    test('transparently supports legacy unencrypted secrets', () => {
        const context = createMockContext();
        const legacyPlaintext = 'legacy-unencrypted-secret';

        assert.strictEqual(isCustomAesEncrypted(legacyPlaintext), false);
        const decrypted = decryptSecret(legacyPlaintext, context, mockVscode);
        assert.strictEqual(decrypted, legacyPlaintext);
    });
});
