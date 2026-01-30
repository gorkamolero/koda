/**
 * Token Encryption Module
 *
 * Provides secure token storage using:
 * - AES-256-GCM for SQLite-based encryption
 * - System keychain integration (when available)
 *
 * Tokens are never stored in plaintext.
 */

import * as crypto from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

export type EncryptionMethod = 'aes-256-gcm' | 'keychain';

export interface TokenEncryption {
  method: EncryptionMethod;
  /** Service name for keychain storage */
  service?: string;
}

// ============================================================================
// Encryption Key Management
// ============================================================================

/**
 * Get or generate the encryption key.
 *
 * In production, this should be derived from:
 * - System keychain
 * - User-provided master password
 * - Hardware-backed key storage
 *
 * For now, we use a deterministic key derived from a secret.
 * TODO: Integrate with system keychain for key storage
 */
function getEncryptionKey(): Buffer {
  // In test/dev environment, use a fixed key derived from an environment variable
  // In production, this should be stored in system keychain
  const secret = process.env.KODA_ENCRYPTION_SECRET || 'koda-default-dev-secret-do-not-use-in-prod';

  // Derive a 256-bit key using PBKDF2
  return crypto.pbkdf2Sync(secret, 'koda-salt', 100000, 32, 'sha256');
}

// ============================================================================
// In-Memory Keychain Mock (for testing)
// ============================================================================

const keychainStore = new Map<string, string>();

/**
 * Mock keychain storage for testing and non-macOS environments
 */
function keychainSet(service: string, account: string, password: string): void {
  keychainStore.set(`${service}:${account}`, password);
}

function keychainGet(service: string, account: string): string | undefined {
  return keychainStore.get(`${service}:${account}`);
}

function keychainDelete(service: string, account: string): boolean {
  return keychainStore.delete(`${service}:${account}`);
}

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

/**
 * Encrypt a token using AES-256-GCM
 *
 * Format: iv:authTag:ciphertext (all base64 encoded)
 */
function encryptAES(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine IV, auth tag, and ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a token encrypted with AES-256-GCM
 */
function decryptAES(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivBase64, authTagBase64, ciphertext] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============================================================================
// Keychain Encryption
// ============================================================================

/**
 * Store token in system keychain (or mock for testing)
 *
 * Returns a reference ID that can be used to retrieve the token
 */
function encryptKeychain(plaintext: string, service: string): string {
  // Generate a unique reference ID
  const refId = crypto.randomUUID();

  // In a real implementation, we would use:
  // - macOS: security add-generic-password
  // - Windows: Credential Manager API
  // - Linux: libsecret/kwallet

  // For now, use mock keychain (still encrypts the token)
  const encrypted = encryptAES(plaintext);
  keychainSet(service, refId, encrypted);

  return `keychain:${service}:${refId}`;
}

/**
 * Retrieve token from system keychain
 */
function decryptKeychain(reference: string): string {
  const parts = reference.split(':');
  if (parts.length !== 3 || parts[0] !== 'keychain') {
    throw new Error('Invalid keychain reference format');
  }

  const [, service, refId] = parts;
  const encrypted = keychainGet(service, refId);

  if (!encrypted) {
    throw new Error('Token not found in keychain');
  }

  return decryptAES(encrypted);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Encrypt a plaintext token
 *
 * @param plaintext - The token to encrypt
 * @param encryption - Encryption configuration
 * @returns Encrypted token string
 */
export function encryptToken(plaintext: string, encryption: TokenEncryption): string {
  switch (encryption.method) {
    case 'aes-256-gcm':
      return encryptAES(plaintext);

    case 'keychain':
      if (!encryption.service) {
        throw new Error('Keychain method requires service name');
      }
      return encryptKeychain(plaintext, encryption.service);

    default:
      throw new Error(`Unknown encryption method: ${encryption.method}`);
  }
}

/**
 * Decrypt an encrypted token
 *
 * @param encryptedData - The encrypted token string
 * @param encryption - Encryption configuration (must match what was used to encrypt)
 * @returns Decrypted plaintext token
 */
export function decryptToken(encryptedData: string, encryption: TokenEncryption): string {
  // Auto-detect keychain references
  if (encryptedData.startsWith('keychain:')) {
    return decryptKeychain(encryptedData);
  }

  switch (encryption.method) {
    case 'aes-256-gcm':
      return decryptAES(encryptedData);

    case 'keychain':
      return decryptKeychain(encryptedData);

    default:
      throw new Error(`Unknown encryption method: ${encryption.method}`);
  }
}

/**
 * Delete a token from keychain storage
 *
 * Only needed for keychain-stored tokens
 */
export function deleteKeychainToken(reference: string): boolean {
  if (!reference.startsWith('keychain:')) {
    return false;
  }

  const parts = reference.split(':');
  if (parts.length !== 3) {
    return false;
  }

  const [, service, refId] = parts;
  return keychainDelete(service, refId);
}

/**
 * Check if the system keychain is available
 *
 * @returns true if keychain is available, false otherwise
 */
export function isKeychainAvailable(): boolean {
  // TODO: Actually check for system keychain availability
  // For now, always return true (mock keychain is always available)
  return true;
}

/**
 * Get the recommended encryption method for the current environment
 */
export function getRecommendedEncryption(): TokenEncryption {
  if (isKeychainAvailable() && process.env.NODE_ENV === 'production') {
    return { method: 'keychain', service: 'com.koda.app' };
  }

  return { method: 'aes-256-gcm' };
}
