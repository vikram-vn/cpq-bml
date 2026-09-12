const assert = require('assert');
const crypto = require('crypto');
const {
    customAesEncrypt,
    customAesDecrypt,
    isCustomAesEncrypted,
} = require('@/lang/rest/util/customAes');

suite('Custom AES-256 Block Cipher', () => {
    const testKey = crypto.randomBytes(32);

    test('encrypts and decrypts round-trip with matching key', () => {
        const secret = 'MySuperSecretPassword@2026!';
        const encrypted = customAesEncrypt(secret, testKey);

        assert.ok(isCustomAesEncrypted(encrypted));
        assert.ok(encrypted.startsWith('caes:v1:'));
        assert.ok(!encrypted.includes(secret));

        const decrypted = customAesDecrypt(encrypted, testKey);
        assert.strictEqual(decrypted, secret);
    });

    test('handles empty and unicode strings', () => {
        const unicodeStr = '🔒 Password with emoji & спецсимволы $#%^';
        const encrypted = customAesEncrypt(unicodeStr, testKey);
        assert.strictEqual(customAesDecrypt(encrypted, testKey), unicodeStr);

        const emptyStr = '';
        const encEmpty = customAesEncrypt(emptyStr, testKey);
        assert.strictEqual(customAesDecrypt(encEmpty, testKey), emptyStr);
    });

    test('fails to decrypt when wrong key is provided', () => {
        const secret = 'ConfidentialToken123';
        const encrypted = customAesEncrypt(secret, testKey);
        const wrongKey = crypto.randomBytes(32);

        assert.throws(() => {
            customAesDecrypt(encrypted, wrongKey);
        }, /Authentication failed/);
    });

    test('fails to decrypt if payload has been tampered with', () => {
        const secret = 'AnotherSecret';
        const encrypted = customAesEncrypt(secret, testKey);
        const parts = encrypted.split(':');
        // Alter last byte of ciphertext
        const cipherHex = parts[4];
        const tamperedCipherHex = cipherHex.slice(0, -2) + (cipherHex.slice(-2) === 'aa' ? 'bb' : 'aa');
        const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedCipherHex}`;

        assert.throws(() => {
            customAesDecrypt(tampered, testKey);
        }, /Authentication failed/);
    });

    test('transparently returns unencrypted legacy strings', () => {
        const legacy = 'plain-unencrypted-password';
        assert.strictEqual(isCustomAesEncrypted(legacy), false);
        assert.strictEqual(customAesDecrypt(legacy, testKey), legacy);
    });

    test('generates dynamic key-dependent S-box permutations', () => {
        const { _deriveKeyedSBoxes } = require('@/lang/rest/util/customAes');
        const keyA = crypto.randomBytes(32);
        const keyB = crypto.randomBytes(32);

        const { sbox: sboxA, invSbox: invSboxA } = _deriveKeyedSBoxes(keyA);
        const { sbox: sboxB } = _deriveKeyedSBoxes(keyB);

        // Verify distinct S-boxes for distinct keys
        assert.notDeepStrictEqual(sboxA, sboxB, 'S-boxes must be unique to the key');

        // Verify bijectivity: invSbox[sbox[i]] === i
        for (let i = 0; i < 256; i++) {
            assert.strictEqual(invSboxA[sboxA[i]], i);
        }

        // Verify permutation completeness: all 256 values exist
        const uniqueSet = new Set(sboxA);
        assert.strictEqual(uniqueSet.size, 256);
    });
});
