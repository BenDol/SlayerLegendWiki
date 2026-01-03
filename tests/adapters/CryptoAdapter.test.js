/**
 * CryptoAdapter Tests
 * Comprehensive tests for encryption/decryption across platforms
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CryptoAdapter } from '../../functions/_shared/adapters/CryptoAdapter.js';

describe('CryptoAdapter', () => {
  const testSecret = 'test-secret-key-32-chars-long!!';
  const testData = 'Hello, World!';
  const testComplexData = JSON.stringify({ user: 'test', id: 12345, data: { nested: true } });

  describe('Netlify Platform', () => {
    let adapter;

    beforeEach(() => {
      adapter = new CryptoAdapter('netlify');
    });

    it('should encrypt data', async () => {
      const encrypted = await adapter.encrypt(testData, testSecret);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(testData);
    });

    it('should decrypt data', async () => {
      const encrypted = await adapter.encrypt(testData, testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt complex data', async () => {
      const encrypted = await adapter.encrypt(testComplexData, testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe(testComplexData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(testComplexData));
    });

    it('should produce different encrypted values for same input', async () => {
      const encrypted1 = await adapter.encrypt(testData, testSecret);
      const encrypted2 = await adapter.encrypt(testData, testSecret);
      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
      // But both should decrypt to same value
      expect(await adapter.decrypt(encrypted1, testSecret)).toBe(testData);
      expect(await adapter.decrypt(encrypted2, testSecret)).toBe(testData);
    });

    it('should fail to decrypt with wrong secret', async () => {
      const encrypted = await adapter.encrypt(testData, testSecret);
      await expect(async () => {
        await adapter.decrypt(encrypted, 'wrong-secret');
      }).rejects.toThrow();
    });

    it('should fail to decrypt invalid data', async () => {
      await expect(async () => {
        await adapter.decrypt('invalid-base64-data', testSecret);
      }).rejects.toThrow();
    });

    it('should hash data', async () => {
      const hash = await adapter.hash(testData);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex string length
    });

    it('should produce same hash for same input', async () => {
      const hash1 = await adapter.hash(testData);
      const hash2 = await adapter.hash(testData);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', async () => {
      const hash1 = await adapter.hash('data1');
      const hash2 = await adapter.hash('data2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Cloudflare Platform', () => {
    let adapter;

    beforeEach(() => {
      adapter = new CryptoAdapter('cloudflare');
    });

    it('should encrypt data', async () => {
      const encrypted = await adapter.encrypt(testData, testSecret);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(testData);
    });

    it('should decrypt data', async () => {
      const encrypted = await adapter.encrypt(testData, testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt complex data', async () => {
      const encrypted = await adapter.encrypt(testComplexData, testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe(testComplexData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(testComplexData));
    });

    it('should produce different encrypted values for same input', async () => {
      const encrypted1 = await adapter.encrypt(testData, testSecret);
      const encrypted2 = await adapter.encrypt(testData, testSecret);
      expect(encrypted1).not.toBe(encrypted2);
      expect(await adapter.decrypt(encrypted1, testSecret)).toBe(testData);
      expect(await adapter.decrypt(encrypted2, testSecret)).toBe(testData);
    });

    it('should fail to decrypt with wrong secret', async () => {
      const encrypted = await adapter.encrypt(testData, testSecret);
      await expect(async () => {
        await adapter.decrypt(encrypted, 'wrong-secret');
      }).rejects.toThrow();
    });

    it('should fail to decrypt invalid data', async () => {
      await expect(async () => {
        await adapter.decrypt('invalid-base64-data', testSecret);
      }).rejects.toThrow();
    });

    it('should hash data', async () => {
      const hash = await adapter.hash(testData);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });

    it('should produce same hash for same input', async () => {
      const hash1 = await adapter.hash(testData);
      const hash2 = await adapter.hash(testData);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', async () => {
      const hash1 = await adapter.hash('data1');
      const hash2 = await adapter.hash('data2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should decrypt Netlify-encrypted data on Cloudflare', async () => {
      const netlifyAdapter = new CryptoAdapter('netlify');
      const cloudflareAdapter = new CryptoAdapter('cloudflare');

      const encrypted = await netlifyAdapter.encrypt(testData, testSecret);
      const decrypted = await cloudflareAdapter.decrypt(encrypted, testSecret);

      expect(decrypted).toBe(testData);
    });

    it('should decrypt Cloudflare-encrypted data on Netlify', async () => {
      const netlifyAdapter = new CryptoAdapter('netlify');
      const cloudflareAdapter = new CryptoAdapter('cloudflare');

      const encrypted = await cloudflareAdapter.encrypt(testData, testSecret);
      const decrypted = await netlifyAdapter.decrypt(encrypted, testSecret);

      expect(decrypted).toBe(testData);
    });

    it('should produce same hash on both platforms', async () => {
      const netlifyAdapter = new CryptoAdapter('netlify');
      const cloudflareAdapter = new CryptoAdapter('cloudflare');

      const netlifyHash = await netlifyAdapter.hash(testData);
      const cloudflareHash = await cloudflareAdapter.hash(testData);

      expect(netlifyHash).toBe(cloudflareHash);
    });

    it('should handle complex data cross-platform', async () => {
      const netlifyAdapter = new CryptoAdapter('netlify');
      const cloudflareAdapter = new CryptoAdapter('cloudflare');

      // Encrypt on Netlify, decrypt on Cloudflare
      const encrypted1 = await netlifyAdapter.encrypt(testComplexData, testSecret);
      const decrypted1 = await cloudflareAdapter.decrypt(encrypted1, testSecret);
      expect(JSON.parse(decrypted1)).toEqual(JSON.parse(testComplexData));

      // Encrypt on Cloudflare, decrypt on Netlify
      const encrypted2 = await cloudflareAdapter.encrypt(testComplexData, testSecret);
      const decrypted2 = await netlifyAdapter.decrypt(encrypted2, testSecret);
      expect(JSON.parse(decrypted2)).toEqual(JSON.parse(testComplexData));
    });
  });

  describe('Edge Cases', () => {
    let adapter;

    beforeEach(() => {
      adapter = new CryptoAdapter('netlify');
    });

    it('should handle empty string', async () => {
      const encrypted = await adapter.encrypt('', testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe('');
    });

    it('should handle very long data', async () => {
      const longData = 'x'.repeat(10000);
      const encrypted = await adapter.encrypt(longData, testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe(longData);
      expect(decrypted.length).toBe(10000);
    });

    it('should handle special characters', async () => {
      const specialData = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = await adapter.encrypt(specialData, testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe(specialData);
    });

    it('should handle unicode characters', async () => {
      const unicodeData = 'Hello 世界 🌍 مرحبا Привет';
      const encrypted = await adapter.encrypt(unicodeData, testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe(unicodeData);
    });

    it('should handle newlines and whitespace', async () => {
      const whitespaceData = 'Line 1\nLine 2\r\nLine 3\t\tTabbed';
      const encrypted = await adapter.encrypt(whitespaceData, testSecret);
      const decrypted = await adapter.decrypt(encrypted, testSecret);
      expect(decrypted).toBe(whitespaceData);
    });
  });

  describe('Security', () => {
    let adapter;

    beforeEach(() => {
      adapter = new CryptoAdapter('netlify');
    });

    it('should use different IV for each encryption', async () => {
      const encrypted1 = await adapter.encrypt(testData, testSecret);
      const encrypted2 = await adapter.encrypt(testData, testSecret);

      // First 12 bytes (base64 encoded) should be different (IV)
      const iv1 = encrypted1.substring(0, 16);
      const iv2 = encrypted2.substring(0, 16);
      expect(iv1).not.toBe(iv2);
    });

    it('should produce cryptographically secure hashes', async () => {
      // SHA-256 should produce 64-character hex string
      const hash = await adapter.hash(testData);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should not reveal plaintext in encrypted data', async () => {
      const secret = 'secret-message-do-not-reveal';
      const encrypted = await adapter.encrypt(secret, testSecret);

      // Encrypted data should not contain plaintext
      expect(encrypted).not.toContain('secret');
      expect(encrypted).not.toContain('message');
      expect(encrypted).not.toContain('reveal');
    });
  });
});
