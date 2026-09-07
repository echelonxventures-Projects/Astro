import { describe, it, expect } from 'vitest'
import {
  encrypt,
  decrypt,
  hash,
  verifyHash,
  generateToken,
  generateApiKey,
  encryptCredentials,
  decryptCredentials,
  generateEncryptionKey,
  validateEncryptionKey,
} from '../encryption'

describe('Encryption', () => {
  const testData = 'sensitive-data-to-encrypt'
  const longTestData = 'a'.repeat(1000)

  describe('Encryption Roundtrip', () => {
    it('should encrypt and decrypt data correctly', () => {
      const encrypted = encrypt(testData)
      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(testData)
      expect(typeof encrypted).toBe('string')

      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(testData)
    })

    it('should handle empty strings', () => {
      const encrypted = encrypt('')
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('should handle large data', () => {
      const encrypted = encrypt(longTestData)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(longTestData)
    })

    it('should handle unicode characters', () => {
      const unicodeData = 'Hello 世界 🌍 émojis!'
      const encrypted = encrypt(unicodeData)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(unicodeData)
    })

    it('should produce different encrypted output for same input (random IV)', () => {
      const encrypted1 = encrypt(testData)
      const encrypted2 = encrypt(testData)
      expect(encrypted1).not.toBe(encrypted2)

      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(testData)
      expect(decrypt(encrypted2)).toBe(testData)
    })
  })

  describe('Hash Functions', () => {
    it('should hash data consistently', () => {
      const hash1 = hash(testData)
      const hash2 = hash(testData)
      expect(hash1).toBe(hash2)
      expect(typeof hash1).toBe('string')
      expect(hash1.length).toBe(64) // SHA-256 produces 64 hex chars
    })

    it('should produce different hashes for different data', () => {
      const hash1 = hash('data1')
      const hash2 = hash('data2')
      expect(hash1).not.toBe(hash2)
    })

    it('should verify matching hashes', () => {
      const hashedValue = hash(testData)
      expect(verifyHash(testData, hashedValue)).toBe(true)
    })

    it('should reject non-matching hashes', () => {
      const hashedValue = hash(testData)
      expect(verifyHash('wrong-data', hashedValue)).toBe(false)
    })
  })

  describe('Token Generation', () => {
    it('should generate token of specified length', () => {
      const token = generateToken(16)
      // Hex encoding produces 2 chars per byte
      expect(token.length).toBe(32)
    })

    it('should generate unique tokens', () => {
      const token1 = generateToken(32)
      const token2 = generateToken(32)
      expect(token1).not.toBe(token2)
    })

    it('should generate API key with correct prefix', () => {
      const apiKey = generateApiKey()
      expect(apiKey.startsWith('sk_live_')).toBe(true)
      expect(apiKey.length).toBeGreaterThan(20)
    })

    it('should generate unique API keys', () => {
      const apiKey1 = generateApiKey()
      const apiKey2 = generateApiKey()
      expect(apiKey1).not.toBe(apiKey2)
    })
  })

  describe('Credential Encryption', () => {
    it('should encrypt credentials object', () => {
      const credentials = {
        apiKey: 'sk_test_12345',
        apiSecret: 'secret123',
        webhookSecret: 'whsec_12345',
        publicKey: 'pk_test_12345',
      }

      const encrypted = encryptCredentials(credentials)

      expect(encrypted.apiKey).toBeDefined()
      expect(encrypted.apiKey).not.toBe(credentials.apiKey)
      expect(encrypted.apiSecret).toBeDefined()
      expect(encrypted.apiSecret).not.toBe(credentials.apiSecret)
      expect(encrypted.webhookSecret).toBeDefined()
      expect(encrypted.webhookSecret).not.toBe(credentials.webhookSecret)
      // Public key should not be encrypted
      expect(encrypted.publicKey).toBe(credentials.publicKey)
    })

    it('should handle partial credentials', () => {
      const credentials = {
        apiKey: 'sk_test_12345',
      }

      const encrypted = encryptCredentials(credentials)
      expect(encrypted.apiKey).toBeDefined()
      expect(encrypted.apiSecret).toBeUndefined()
    })

    it('should decrypt credentials correctly', () => {
      const credentials = {
        apiKey: 'sk_test_12345',
        apiSecret: 'secret123',
        webhookSecret: 'whsec_12345',
        publicKey: 'pk_test_12345',
      }

      const encrypted = encryptCredentials(credentials)
      const decrypted = decryptCredentials(encrypted)

      expect(decrypted.apiKey).toBe(credentials.apiKey)
      expect(decrypted.apiSecret).toBe(credentials.apiSecret)
      expect(decrypted.webhookSecret).toBe(credentials.webhookSecret)
      expect(decrypted.publicKey).toBe(credentials.publicKey)
    })

    it('should handle empty credentials', () => {
      const encrypted = encryptCredentials({})
      expect(Object.keys(encrypted).length).toBe(0)

      const decrypted = decryptCredentials({})
      expect(Object.keys(decrypted).length).toBe(0)
    })
  })

  describe('Encryption Key Management', () => {
    it('should generate a valid encryption key', () => {
      const key = generateEncryptionKey()
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThanOrEqual(32)
    })

    it('should validate a strong encryption key', () => {
      const strongKey = 'a'.repeat(64)
      const result = validateEncryptionKey(strongKey)
      expect(result.valid).toBe(true)
      expect(result.message).toBe('Encryption key is valid')
    })

    it('should reject short encryption keys', () => {
      const shortKey = 'short'
      const result = validateEncryptionKey(shortKey)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('at least 32 characters')
    })

    it('should reject weak encryption keys', () => {
      // These keys are long enough to pass length check but contain weak patterns
      const weakKeys = [
        'development-encryption-key-that-is-long-enough',
        'test-key-that-is-very-long-and-should-be-rejected',
        'default-encryption-key-minimum-32-characters',
        'change-in-production-please-update-this-key',
      ]

      for (const key of weakKeys) {
        const result = validateEncryptionKey(key)
        expect(result.valid).toBe(false)
        expect(result.message).toContain('development/test key')
      }
    })

    it('should reject empty encryption key', () => {
      const result = validateEncryptionKey('')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Encryption key is not set')
    })

    it('should reject undefined encryption key', () => {
      const result = validateEncryptionKey(undefined as any)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Encryption key is not set')
    })
  })

  describe('Error Handling', () => {
    it('should throw error if encryption key is not set', () => {
      // Save original key
      const originalKey = process.env.ENCRYPTION_KEY
      delete (process.env as any).ENCRYPTION_KEY

      expect(() => encrypt(testData)).toThrow('ENCRYPTION_KEY environment variable is not set')

      // Restore original key
      process.env.ENCRYPTION_KEY = originalKey
    })

    it('should throw error if encryption key is too short', () => {
      // Save original key
      const originalKey = process.env.ENCRYPTION_KEY
      process.env.ENCRYPTION_KEY = 'short'

      expect(() => encrypt(testData)).toThrow('ENCRYPTION_KEY must be at least 32 characters')

      // Restore original key
      process.env.ENCRYPTION_KEY = originalKey
    })
  })
})
