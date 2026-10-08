import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { runMigrationsOnConnection } from './migrate.js';

/**
 * Get the Koda data directory based on platform
 * All Koda-managed data (db, worktrees, etc.) lives under this directory
 *
 * Paths:
 * - macOS: ~/.koda
 * - Linux: ~/.koda
 * - Windows: %USERPROFILE%\.koda
 */
export function getKodaDataDir(): string {
  // Check for override (used by tests)
  const dataOverride = process.env.KODA_DATA_DIR;
  if (dataOverride) {
    fs.mkdirSync(dataOverride, { recursive: true });
    return dataOverride;
  }

  // Simple, consistent path across platforms: ~/.koda
  const kodaDir = path.join(os.homedir(), '.koda');
  fs.mkdirSync(kodaDir, { recursive: true });
  return kodaDir;
}

/**
 * Get the worktrees directory
 * All git worktrees are stored here: ~/.koda/worktrees/{repoName}/{branchName}
 */
export function getWorktreesDir(): string {
  const worktreesDir = path.join(getKodaDataDir(), 'worktrees');
  fs.mkdirSync(worktreesDir, { recursive: true });
  return worktreesDir;
}

/**
 * Get the database path based on platform
 * Supports environment variable overrides for testing:
 * - KODA_DB_PATH: Direct database path override (e.g., ':memory:' for tests)
 * - KODA_TEST_DB: Alias for KODA_DB_PATH (legacy)
 */
export function getDbPath(): string {
  // Check for database path override (used by tests)
  const dbPathOverride = process.env.KODA_DB_PATH || process.env.KODA_TEST_DB;
  if (dbPathOverride) {
    // Handle special ':memory:' case
    if (dbPathOverride === ':memory:') {
      return ':memory:';
    }
    const testDbDir = path.dirname(dbPathOverride);
    fs.mkdirSync(testDbDir, { recursive: true });
    return dbPathOverride;
  }

  // Use centralized Koda data directory
  return path.join(getKodaDataDir(), 'koda.db');
}

/**
 * Global database instances
 */
let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Initialize database connection and run migrations
 * For :memory: databases, runs migrations on the same connection
 */
export function initDbWithMigrations(dbPath?: string) {
  const finalPath = dbPath || getDbPath();
  sqlite = new Database(finalPath);

  // Enable WAL mode for better concurrency (not supported for in-memory DBs)
  if (finalPath !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }

  // Run migrations on this connection
  try {
    runMigrationsOnConnection(sqlite);
  } catch (error) {
    sqlite.close();
    sqlite = null;
    db = null;
    throw error;
  }

  db = drizzle(sqlite, { schema });
  return db;
}

/**
 * Initialize database connection without migrations
 * Use this when you want to run migrations separately (for file-based DBs)
 */
export function initDb(dbPath?: string) {
  const finalPath = dbPath || getDbPath();
  sqlite = new Database(finalPath);

  // Enable WAL mode for better concurrency (not supported for in-memory DBs)
  if (finalPath !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }

  db = drizzle(sqlite, { schema });
  return db;
}

/**
 * Get or create database instance
 * For :memory: databases, also runs migrations
 */
export function getDb() {
  if (!db) {
    const dbPath = getDbPath();
    if (dbPath === ':memory:') {
      // For in-memory, init with migrations on same connection
      db = initDbWithMigrations(dbPath);
    } else {
      // For file-based, just init (migrations should have been run separately)
      db = initDb(dbPath);
    }
  }
  return db;
}

/**
 * Get the underlying SQLite connection
 * Useful for running migrations on existing connection
 */
export function getSqlite(): Database.Database | null {
  return sqlite;
}

/**
 * Reset the global database instance (for testing)
 */
export function resetDb() {
  if (sqlite) {
    sqlite.close();
  }
  sqlite = null;
  db = null;
}
