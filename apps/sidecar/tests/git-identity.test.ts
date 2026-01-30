import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import {
  addIdentity,
  listIdentities,
  getIdentity,
  updateIdentity,
  deleteIdentity,
  setDefaultIdentity,
  getDefaultIdentity,
  getDecryptedToken,
  type AddIdentityInput,
  type UpdateIdentityInput,
} from '../src/git/identity.js';
import {
  encryptToken,
  decryptToken,
  type TokenEncryption,
} from '../src/git/crypto.js';
import {
  configureWorktreeIdentity,
  getWorktreeIdentity,
} from '../src/git/worktree.js';

describe('Git Identity Management', () => {
  let dbPath: string;
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let testUserId: string;

  beforeAll(() => {
    // Create temporary database for testing
    dbPath = path.join(os.tmpdir(), `koda-git-identity-test-${Date.now()}.db`);

    // Run migrations
    runMigrations(dbPath);

    // Open database connection
    sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });

    // Set up test user
    testUserId = `user-test-${Date.now()}`;
    db.insert(schema.users).values({ id: testUserId, name: 'Test User' }).run();
  });

  afterAll(() => {
    // Close database
    if (sqlite) {
      sqlite.close();
    }

    // Clean up database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Also clean up WAL files if they exist
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('Token Encryption', () => {
    it('should encrypt and decrypt a token', () => {
      const plainToken = 'ghp_xxxxxxxxxxxxxxxxxxxx';
      const encryption: TokenEncryption = { method: 'aes-256-gcm' };

      const encrypted = encryptToken(plainToken, encryption);
      const decrypted = decryptToken(encrypted, encryption);

      expect(decrypted).toBe(plainToken);
      expect(encrypted).not.toBe(plainToken);
      expect(encrypted).toContain(':'); // Should contain IV separator
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plainToken = 'ghp_xxxxxxxxxxxxxxxxxxxx';
      const encryption: TokenEncryption = { method: 'aes-256-gcm' };

      const encrypted1 = encryptToken(plainToken, encryption);
      const encrypted2 = encryptToken(plainToken, encryption);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptToken(encrypted1, encryption)).toBe(plainToken);
      expect(decryptToken(encrypted2, encryption)).toBe(plainToken);
    });

    it('should throw on invalid encrypted data', () => {
      const encryption: TokenEncryption = { method: 'aes-256-gcm' };

      expect(() => decryptToken('invalid-data', encryption)).toThrow();
    });

    it('should support system keychain method (mock)', () => {
      const plainToken = 'ghp_xxxxxxxxxxxxxxxxxxxx';
      const encryption: TokenEncryption = { method: 'keychain', service: 'koda-test' };

      // In test environment, keychain should fall back to in-memory encryption
      const encrypted = encryptToken(plainToken, encryption);
      const decrypted = decryptToken(encrypted, encryption);

      expect(decrypted).toBe(plainToken);
    });
  });

  describe('Identity CRUD Operations', () => {
    describe('addIdentity', () => {
      it('should add a GitHub identity', () => {
        // Use a dedicated user for this test to avoid interference
        const dedicatedUserId = `user-github-test-${Date.now()}`;
        db.insert(schema.users).values({ id: dedicatedUserId, name: 'GitHub Test User' }).run();

        // First add a dummy identity so the second one won't be default
        addIdentity(db, {
          userId: dedicatedUserId,
          provider: 'github',
          username: 'dummy',
          email: 'dummy@github.com',
          token: 'ghp_dummy',
        });

        const input: AddIdentityInput = {
          userId: dedicatedUserId,
          provider: 'github',
          username: 'testuser',
          email: 'test@github.com',
          token: 'ghp_xxxxxxxxxxxxxxxxxxxx',
        };

        const identity = addIdentity(db, input);

        expect(identity).toBeDefined();
        expect(identity.id).toBeDefined();
        expect(identity.provider).toBe('github');
        expect(identity.username).toBe('testuser');
        expect(identity.email).toBe('test@github.com');
        expect(identity.tokenEncrypted).toBeDefined();
        expect(identity.tokenEncrypted).not.toBe(input.token); // Token should be encrypted
        expect(identity.isDefault).toBe(false);
      });

      it('should add a GitLab identity', () => {
        const input: AddIdentityInput = {
          userId: testUserId,
          provider: 'gitlab',
          username: 'gitlabuser',
          email: 'test@gitlab.com',
          token: 'glpat-xxxxxxxxxxxxxxxxxxxx',
        };

        const identity = addIdentity(db, input);

        expect(identity.provider).toBe('gitlab');
        expect(identity.username).toBe('gitlabuser');
      });

      it('should add a Bitbucket identity', () => {
        const input: AddIdentityInput = {
          userId: testUserId,
          provider: 'bitbucket',
          username: 'bitbucketuser',
          email: 'test@bitbucket.com',
          token: 'bitbucket-app-password',
        };

        const identity = addIdentity(db, input);

        expect(identity.provider).toBe('bitbucket');
        expect(identity.username).toBe('bitbucketuser');
      });

      it('should set first identity as default', () => {
        // Create a new user for this test
        const newUserId = `user-first-default-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'First Default User' }).run();

        const identity = addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'firstuser',
          email: 'first@github.com',
          token: 'ghp_first',
        });

        expect(identity.isDefault).toBe(true);
      });

      it('should not set subsequent identities as default automatically', () => {
        // Create a new user for this test
        const newUserId = `user-subsequent-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Subsequent User' }).run();

        // First identity
        addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'user1',
          email: 'user1@github.com',
          token: 'ghp_1',
        });

        // Second identity
        const second = addIdentity(db, {
          userId: newUserId,
          provider: 'gitlab',
          username: 'user2',
          email: 'user2@gitlab.com',
          token: 'glpat_2',
        });

        expect(second.isDefault).toBe(false);
      });
    });

    describe('listIdentities', () => {
      it('should list all identities for a user', () => {
        const newUserId = `user-list-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'List User' }).run();

        addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'gh-user',
          email: 'gh@example.com',
          token: 'ghp_token',
        });
        addIdentity(db, {
          userId: newUserId,
          provider: 'gitlab',
          username: 'gl-user',
          email: 'gl@example.com',
          token: 'glpat_token',
        });

        const identities = listIdentities(db, newUserId);

        expect(identities).toHaveLength(2);
        expect(identities.map((i) => i.provider).sort()).toEqual(['github', 'gitlab']);
      });

      it('should return empty array for user with no identities', () => {
        const newUserId = `user-empty-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Empty User' }).run();

        const identities = listIdentities(db, newUserId);

        expect(identities).toEqual([]);
      });

      it('should not expose decrypted tokens in list', () => {
        const newUserId = `user-no-expose-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'No Expose User' }).run();

        addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'secure-user',
          email: 'secure@example.com',
          token: 'ghp_secret_token_12345',
        });

        const identities = listIdentities(db, newUserId);

        expect(identities[0].tokenEncrypted).not.toContain('ghp_secret_token_12345');
      });
    });

    describe('getIdentity', () => {
      it('should get an identity by ID', () => {
        const newUserId = `user-get-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Get User' }).run();

        const created = addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'get-user',
          email: 'get@example.com',
          token: 'ghp_get',
        });

        const retrieved = getIdentity(db, created.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.username).toBe('get-user');
      });

      it('should return undefined for non-existent identity', () => {
        const retrieved = getIdentity(db, 'non-existent-id');

        expect(retrieved).toBeUndefined();
      });
    });

    describe('updateIdentity', () => {
      it('should update identity email', () => {
        const newUserId = `user-update-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Update User' }).run();

        const identity = addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'update-user',
          email: 'old@example.com',
          token: 'ghp_update',
        });

        const input: UpdateIdentityInput = {
          email: 'new@example.com',
        };

        const updated = updateIdentity(db, identity.id, input);

        expect(updated).toBeDefined();
        expect(updated?.email).toBe('new@example.com');
      });

      it('should update identity token (re-encrypt)', () => {
        const newUserId = `user-update-token-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Update Token User' }).run();

        const identity = addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'token-user',
          email: 'token@example.com',
          token: 'ghp_old_token',
        });

        const oldEncrypted = identity.tokenEncrypted;

        const updated = updateIdentity(db, identity.id, {
          token: 'ghp_new_token',
        });

        expect(updated?.tokenEncrypted).not.toBe(oldEncrypted);
        expect(updated?.tokenEncrypted).toBeDefined();
      });

      it('should return undefined when updating non-existent identity', () => {
        const updated = updateIdentity(db, 'non-existent-id', { email: 'new@example.com' });

        expect(updated).toBeUndefined();
      });
    });

    describe('deleteIdentity', () => {
      it('should delete an identity', () => {
        const newUserId = `user-delete-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Delete User' }).run();

        const identity = addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'delete-user',
          email: 'delete@example.com',
          token: 'ghp_delete',
        });

        const deleted = deleteIdentity(db, identity.id);

        expect(deleted).toBe(true);
        expect(getIdentity(db, identity.id)).toBeUndefined();
      });

      it('should return false when deleting non-existent identity', () => {
        const deleted = deleteIdentity(db, 'non-existent-id');

        expect(deleted).toBe(false);
      });

      it('should promote next identity to default if default is deleted', () => {
        const newUserId = `user-delete-default-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Delete Default User' }).run();

        // First identity (will be default)
        const first = addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'first-user',
          email: 'first@example.com',
          token: 'ghp_first',
        });

        // Second identity (not default)
        const second = addIdentity(db, {
          userId: newUserId,
          provider: 'gitlab',
          username: 'second-user',
          email: 'second@example.com',
          token: 'glpat_second',
        });

        expect(first.isDefault).toBe(true);
        expect(second.isDefault).toBe(false);

        // Delete the default
        deleteIdentity(db, first.id);

        // Second should now be default
        const updatedSecond = getIdentity(db, second.id);
        expect(updatedSecond?.isDefault).toBe(true);
      });
    });

    describe('setDefaultIdentity', () => {
      it('should set an identity as default', () => {
        const newUserId = `user-set-default-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Set Default User' }).run();

        const first = addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'first',
          email: 'first@example.com',
          token: 'ghp_first',
        });

        const second = addIdentity(db, {
          userId: newUserId,
          provider: 'gitlab',
          username: 'second',
          email: 'second@example.com',
          token: 'glpat_second',
        });

        expect(first.isDefault).toBe(true);
        expect(second.isDefault).toBe(false);

        // Set second as default
        const result = setDefaultIdentity(db, second.id);

        expect(result).toBe(true);

        // Verify changes
        const updatedFirst = getIdentity(db, first.id);
        const updatedSecond = getIdentity(db, second.id);

        expect(updatedFirst?.isDefault).toBe(false);
        expect(updatedSecond?.isDefault).toBe(true);
      });

      it('should return false for non-existent identity', () => {
        const result = setDefaultIdentity(db, 'non-existent-id');

        expect(result).toBe(false);
      });
    });

    describe('getDefaultIdentity', () => {
      it('should get the default identity for a user', () => {
        const newUserId = `user-get-default-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'Get Default User' }).run();

        const first = addIdentity(db, {
          userId: newUserId,
          provider: 'github',
          username: 'default-user',
          email: 'default@example.com',
          token: 'ghp_default',
        });

        addIdentity(db, {
          userId: newUserId,
          provider: 'gitlab',
          username: 'other-user',
          email: 'other@example.com',
          token: 'glpat_other',
        });

        const defaultIdentity = getDefaultIdentity(db, newUserId);

        expect(defaultIdentity).toBeDefined();
        expect(defaultIdentity?.id).toBe(first.id);
        expect(defaultIdentity?.isDefault).toBe(true);
      });

      it('should return undefined if no identities exist', () => {
        const newUserId = `user-no-default-${Date.now()}`;
        db.insert(schema.users).values({ id: newUserId, name: 'No Default User' }).run();

        const defaultIdentity = getDefaultIdentity(db, newUserId);

        expect(defaultIdentity).toBeUndefined();
      });
    });
  });

  describe('Worktree Configuration', () => {
    let tempWorktreePath: string;

    beforeEach(() => {
      // Create a temporary directory for worktree tests
      tempWorktreePath = path.join(os.tmpdir(), `koda-worktree-test-${Date.now()}`);
      fs.mkdirSync(tempWorktreePath, { recursive: true });
      // Initialize a git repo in the temp directory
      const { execSync } = require('child_process');
      execSync('git init', { cwd: tempWorktreePath, stdio: 'pipe' });
    });

    afterAll(() => {
      // Cleanup is handled by the OS eventually for temp directories
    });

    it('should configure git user.name and user.email for a worktree', async () => {
      const identity = {
        id: 'test-id',
        username: 'worktree-user',
        email: 'worktree@example.com',
        provider: 'github' as const,
      };

      await configureWorktreeIdentity(tempWorktreePath, identity);

      const configuredIdentity = await getWorktreeIdentity(tempWorktreePath);

      expect(configuredIdentity.name).toBe('worktree-user');
      expect(configuredIdentity.email).toBe('worktree@example.com');
    });

    it('should use local config only (not global)', async () => {
      const identity = {
        id: 'test-id',
        username: 'local-only-user',
        email: 'local@example.com',
        provider: 'github' as const,
      };

      await configureWorktreeIdentity(tempWorktreePath, identity);

      // Read local config file directly
      const localConfigPath = path.join(tempWorktreePath, '.git', 'config');
      const configContent = fs.readFileSync(localConfigPath, 'utf-8');

      expect(configContent).toContain('local-only-user');
      expect(configContent).toContain('local@example.com');
    });

    it('should handle missing git directory gracefully', async () => {
      const nonGitPath = path.join(os.tmpdir(), `non-git-${Date.now()}`);
      fs.mkdirSync(nonGitPath, { recursive: true });

      await expect(
        configureWorktreeIdentity(nonGitPath, {
          id: 'test',
          username: 'user',
          email: 'email@example.com',
          provider: 'github',
        })
      ).rejects.toThrow();
    });
  });

  describe('Token Retrieval for Operations', () => {
    it('should decrypt token for git operations', () => {
      const newUserId = `user-decrypt-${Date.now()}`;
      db.insert(schema.users).values({ id: newUserId, name: 'Decrypt User' }).run();

      const plainToken = 'ghp_supersecret12345';
      const identity = addIdentity(db, {
        userId: newUserId,
        provider: 'github',
        username: 'decrypt-user',
        email: 'decrypt@example.com',
        token: plainToken,
      });

      const decrypted = getDecryptedToken(db, identity.id);

      expect(decrypted).toBe(plainToken);
    });

    it('should return null for non-existent identity token', () => {
      const decrypted = getDecryptedToken(db, 'non-existent-id');

      expect(decrypted).toBeNull();
    });
  });
});
