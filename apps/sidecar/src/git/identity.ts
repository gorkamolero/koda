/**
 * Git Identity Management Module
 *
 * CRUD operations for git identities.
 * Supports multiple providers (GitHub, GitLab, Bitbucket).
 * Tokens are encrypted at rest.
 */

import { eq, and, desc } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';
import { gitIdentities, type GitIdentity } from '../db/schema.js';
import { encryptToken, decryptToken, getRecommendedEncryption, type TokenEncryption } from './crypto.js';

// Type for the database instance
type Db = BetterSQLite3Database<typeof schema>;

// ============================================================================
// Types
// ============================================================================

export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

export interface AddIdentityInput {
  userId: string;
  provider: GitProvider;
  username: string;
  email: string;
  token: string;
}

export interface UpdateIdentityInput {
  username?: string;
  email?: string;
  token?: string;
}

// ============================================================================
// ID Generation
// ============================================================================

function generateId(): string {
  return `git-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// Encryption Helpers
// ============================================================================

/**
 * Get the encryption configuration for tokens
 */
function getTokenEncryption(): TokenEncryption {
  return getRecommendedEncryption();
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Add a new git identity
 *
 * @param db - Database instance
 * @param input - Identity details including plaintext token
 * @returns The created identity (with encrypted token)
 */
export function addIdentity(db: Db, input: AddIdentityInput): GitIdentity {
  const id = generateId();
  const encryption = getTokenEncryption();
  const encryptedToken = encryptToken(input.token, encryption);

  // Check if this user has any existing identities
  const existingIdentities = db
    .select()
    .from(gitIdentities)
    .where(eq(gitIdentities.userId, input.userId))
    .all();

  // First identity for a user becomes the default
  const isDefault = existingIdentities.length === 0;

  db.insert(gitIdentities)
    .values({
      id,
      userId: input.userId,
      provider: input.provider,
      username: input.username,
      email: input.email,
      tokenEncrypted: encryptedToken,
      isDefault,
    })
    .run();

  return getIdentity(db, id)!;
}

/**
 * List all identities for a user
 *
 * @param db - Database instance
 * @param userId - User ID to list identities for
 * @returns Array of identities (tokens remain encrypted)
 */
export function listIdentities(db: Db, userId: string): GitIdentity[] {
  return db
    .select()
    .from(gitIdentities)
    .where(eq(gitIdentities.userId, userId))
    .orderBy(desc(gitIdentities.isDefault), desc(gitIdentities.createdAt))
    .all();
}

/**
 * Get a specific identity by ID
 *
 * @param db - Database instance
 * @param identityId - Identity ID
 * @returns The identity or undefined
 */
export function getIdentity(db: Db, identityId: string): GitIdentity | undefined {
  return db
    .select()
    .from(gitIdentities)
    .where(eq(gitIdentities.id, identityId))
    .get();
}

/**
 * Update an existing identity
 *
 * @param db - Database instance
 * @param identityId - Identity ID to update
 * @param input - Fields to update
 * @returns Updated identity or undefined if not found
 */
export function updateIdentity(
  db: Db,
  identityId: string,
  input: UpdateIdentityInput
): GitIdentity | undefined {
  const existing = getIdentity(db, identityId);
  if (!existing) {
    return undefined;
  }

  const updateData: Record<string, unknown> = {};

  if (input.username !== undefined) {
    updateData.username = input.username;
  }

  if (input.email !== undefined) {
    updateData.email = input.email;
  }

  if (input.token !== undefined) {
    const encryption = getTokenEncryption();
    updateData.tokenEncrypted = encryptToken(input.token, encryption);
  }

  if (Object.keys(updateData).length > 0) {
    db.update(gitIdentities)
      .set(updateData)
      .where(eq(gitIdentities.id, identityId))
      .run();
  }

  return getIdentity(db, identityId);
}

/**
 * Delete an identity
 *
 * @param db - Database instance
 * @param identityId - Identity ID to delete
 * @returns true if deleted, false if not found
 */
export function deleteIdentity(db: Db, identityId: string): boolean {
  const existing = getIdentity(db, identityId);
  if (!existing) {
    return false;
  }

  const wasDefault = existing.isDefault;
  const userId = existing.userId;

  // Delete the identity
  db.delete(gitIdentities).where(eq(gitIdentities.id, identityId)).run();

  // If we deleted the default, promote the next available identity
  if (wasDefault && userId) {
    const remaining = db
      .select()
      .from(gitIdentities)
      .where(eq(gitIdentities.userId, userId))
      .orderBy(desc(gitIdentities.createdAt))
      .limit(1)
      .all();

    if (remaining.length > 0) {
      db.update(gitIdentities)
        .set({ isDefault: true })
        .where(eq(gitIdentities.id, remaining[0].id))
        .run();
    }
  }

  return true;
}

/**
 * Set an identity as the default for its user
 *
 * @param db - Database instance
 * @param identityId - Identity ID to set as default
 * @returns true if successful, false if identity not found
 */
export function setDefaultIdentity(db: Db, identityId: string): boolean {
  const identity = getIdentity(db, identityId);
  if (!identity || !identity.userId) {
    return false;
  }

  // Clear existing default for this user
  db.update(gitIdentities)
    .set({ isDefault: false })
    .where(eq(gitIdentities.userId, identity.userId))
    .run();

  // Set the new default
  db.update(gitIdentities)
    .set({ isDefault: true })
    .where(eq(gitIdentities.id, identityId))
    .run();

  return true;
}

/**
 * Get the default identity for a user
 *
 * @param db - Database instance
 * @param userId - User ID
 * @returns The default identity or undefined
 */
export function getDefaultIdentity(db: Db, userId: string): GitIdentity | undefined {
  return db
    .select()
    .from(gitIdentities)
    .where(and(eq(gitIdentities.userId, userId), eq(gitIdentities.isDefault, true)))
    .get();
}

/**
 * Get decrypted token for git operations
 *
 * This should only be used when actually performing git operations
 * that require authentication.
 *
 * @param db - Database instance
 * @param identityId - Identity ID
 * @returns Decrypted token or null if not found
 */
export function getDecryptedToken(db: Db, identityId: string): string | null {
  const identity = getIdentity(db, identityId);
  if (!identity || !identity.tokenEncrypted) {
    return null;
  }

  const encryption = getTokenEncryption();
  return decryptToken(identity.tokenEncrypted, encryption);
}

/**
 * Get identity by provider and username
 *
 * @param db - Database instance
 * @param userId - User ID
 * @param provider - Git provider
 * @param username - Provider username
 * @returns The identity or undefined
 */
export function getIdentityByProvider(
  db: Db,
  userId: string,
  provider: GitProvider,
  username: string
): GitIdentity | undefined {
  return db
    .select()
    .from(gitIdentities)
    .where(
      and(
        eq(gitIdentities.userId, userId),
        eq(gitIdentities.provider, provider),
        eq(gitIdentities.username, username)
      )
    )
    .get();
}
