/**
 * Crypto Adapter
 *
 * Abstracts cryptographic operations between Node.js and Cloudflare Workers
 * Handles differences in crypto APIs and base64 encoding
 */

/**
 * Unified Crypto Adapter
 * Abstracts Node.js crypto.webcrypto vs global crypto differences
 * Abstracts Buffer vs btoa/atob for base64 encoding
 */
export class CryptoAdapter {
  constructor(platform) {
    this.platform = platform;
    this.crypto = this._getCrypto();
  }

  /**
   * Get platform-specific crypto object
   * @private
   * @returns {Crypto} Crypto API object
   */
  _getCrypto() {
    if (this.platform === 'netlify') {
      // Node.js environment - use webcrypto from crypto module
      // Dynamic import to avoid bundling issues
      const { webcrypto } = require('crypto');
      return webcrypto;
    } else {
      // Cloudflare Workers - use global crypto
      return crypto;
    }
  }

  /**
   * Encrypt data using AES-GCM
   * @param {string} data - Data to encrypt
   * @param {string} secret - Encryption secret (will be padded to 32 bytes)
   * @returns {Promise<string>} Base64-encoded encrypted data with IV
   */
  async encrypt(data, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret.padEnd(32, '0').substring(0, 32));

    // Import key
    const key = await this.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Generate random IV
    const iv = this.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await this.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64
    return this._toBase64(combined);
  }

  /**
   * Decrypt data using AES-GCM
   * @param {string} encryptedData - Base64-encoded encrypted data with IV
   * @param {string} secret - Encryption secret (will be padded to 32 bytes)
   * @returns {Promise<string>} Decrypted data
   */
  async decrypt(encryptedData, secret) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const keyData = encoder.encode(secret.padEnd(32, '0').substring(0, 32));

    // Import key
    const key = await this.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decode base64
    const combined = this._fromBase64(encryptedData);

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt
    const decrypted = await this.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    return decoder.decode(decrypted);
  }

  /**
   * Hash data using SHA-256
   * @param {string} data - Data to hash
   * @returns {Promise<string>} Hex-encoded hash
   */
  async hash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await this.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert Uint8Array to base64
   * Platform-specific: Node.js uses Buffer, Cloudflare uses btoa
   * @private
   * @param {Uint8Array} buffer - Buffer to encode
   * @returns {string} Base64-encoded string
   */
  _toBase64(buffer) {
    if (this.platform === 'netlify') {
      // Node.js - use Buffer
      return Buffer.from(buffer).toString('base64');
    } else {
      // Cloudflare - use btoa
      return btoa(String.fromCharCode(...buffer));
    }
  }

  /**
   * Convert base64 to Uint8Array
   * Platform-specific: Node.js uses Buffer, Cloudflare uses atob
   * @private
   * @param {string} base64 - Base64-encoded string
   * @returns {Uint8Array} Decoded buffer
   */
  _fromBase64(base64) {
    if (this.platform === 'netlify') {
      // Node.js - use Buffer
      return Buffer.from(base64, 'base64');
    } else {
      // Cloudflare - use atob
      return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    }
  }
}
