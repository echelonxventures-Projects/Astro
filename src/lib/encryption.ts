/**
 * Secure Encryption Utility
 * Uses AES-256-GCM for encrypting sensitive credentials
 * Production-ready encryption for API keys, secrets, and personal data
 */

import crypto from 'crypto'

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

/**
 * Derive encryption key from master key and salt
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    100000, // Iterations
    32, // Key length (256 bits)
    'sha512'
  )
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(data: string): string {
  const masterKey = process.env.ENCRYPTION_KEY

  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  if (masterKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)

  // Derive key
  const key = deriveKey(masterKey, salt)

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ])

  // Get auth tag
  const authTag = cipher.getAuthTag()

  // Combine salt + iv + authTag + encrypted
  const combined = Buffer.concat([salt, iv, authTag, encrypted])

  // Return as base64
  return combined.toString('base64')
}

/**
 * Decrypt data encrypted with AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  const masterKey = process.env.ENCRYPTION_KEY

  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  // Decode base64
  const combined = Buffer.from(encryptedData, 'base64')

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  )
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

  // Derive key
  const key = deriveKey(masterKey, salt)

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * Hash a value (one-way, for comparison)
 */
export function hash(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex')
}

/**
 * Verify a hash
 */
export function verifyHash(value: string, hashedValue: string): boolean {
  return hash(value) === hashedValue
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Generate a secure API key
 */
export function generateApiKey(): string {
  const prefix = 'sk_live_'
  const randomPart = crypto.randomBytes(24).toString('base64url')
  return `${prefix}${randomPart}`
}

/**
 * Encrypt API credentials for storage
 */
export function encryptCredentials(credentials: {
  apiKey?: string
  apiSecret?: string
  webhookSecret?: string
  publicKey?: string
}): {
  apiKey?: string
  apiSecret?: string
  webhookSecret?: string
  publicKey?: string
} {
  const encrypted: any = {}

  if (credentials.apiKey) {
    encrypted.apiKey = encrypt(credentials.apiKey)
  }
  if (credentials.apiSecret) {
    encrypted.apiSecret = encrypt(credentials.apiSecret)
  }
  if (credentials.webhookSecret) {
    encrypted.webhookSecret = encrypt(credentials.webhookSecret)
  }
  if (credentials.publicKey) {
    encrypted.publicKey = credentials.publicKey // Public keys don't need encryption
  }

  return encrypted
}

/**
 * Decrypt API credentials from storage
 */
export function decryptCredentials(encrypted: {
  apiKey?: string
  apiSecret?: string
  webhookSecret?: string
  publicKey?: string
}): {
  apiKey?: string
  apiSecret?: string
  webhookSecret?: string
  publicKey?: string
} {
  const decrypted: any = {}

  if (encrypted.apiKey) {
    decrypted.apiKey = decrypt(encrypted.apiKey)
  }
  if (encrypted.apiSecret) {
    decrypted.apiSecret = decrypt(encrypted.apiSecret)
  }
  if (encrypted.webhookSecret) {
    decrypted.webhookSecret = decrypt(encrypted.webhookSecret)
  }
  if (encrypted.publicKey) {
    decrypted.publicKey = encrypted.publicKey
  }

  return decrypted
}

/**
 * Generate encryption key for production
 * Run this once and store in environment
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64')
}

/**
 * Validate encryption key strength
 */
export function validateEncryptionKey(key: string): {
  valid: boolean
  message: string
} {
  if (!key) {
    return { valid: false, message: 'Encryption key is not set' }
  }

  if (key.length < 32) {
    return { valid: false, message: 'Encryption key must be at least 32 characters' }
  }

  // Check for common weak keys
  const weakKeys = [
    'development-encryption-key',
    'test-key',
    'default-encryption-key',
    'change-in-production',
  ]

  if (weakKeys.some(weak => key.toLowerCase().includes(weak))) {
    return { valid: false, message: 'Encryption key appears to be a development/test key. Please use a secure production key.' }
  }

  return { valid: true, message: 'Encryption key is valid' }
}