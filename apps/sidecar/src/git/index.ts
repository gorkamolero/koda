/**
 * Git Identity Management Module
 *
 * Multi-git identity support for the orchestration sidecar.
 *
 * Features:
 * - CRUD operations for git identities
 * - Encrypted token storage (AES-256-GCM or system keychain)
 * - Per-worktree identity configuration
 * - Support for GitHub, GitLab, and Bitbucket
 */

// Identity CRUD
export {
  addIdentity,
  listIdentities,
  getIdentity,
  updateIdentity,
  deleteIdentity,
  setDefaultIdentity,
  getDefaultIdentity,
  getDecryptedToken,
  getIdentityByProvider,
  type AddIdentityInput,
  type UpdateIdentityInput,
  type GitProvider,
} from './identity.js';

// Encryption
export {
  encryptToken,
  decryptToken,
  isKeychainAvailable,
  getRecommendedEncryption,
  type TokenEncryption,
  type EncryptionMethod,
} from './crypto.js';

// Worktree configuration
export {
  configureWorktreeIdentity,
  getWorktreeIdentity,
  clearWorktreeIdentity,
  configureCredentialHelper,
  clearCredentialHelper,
  type WorktreeIdentity,
  type ConfiguredIdentity,
} from './worktree.js';
