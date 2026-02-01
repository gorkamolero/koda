import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { runMigrationsOnConnection } from './migrate.js';

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

  const platform = os.platform();

  if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/com.koda.app/koda.db
    const appSupport = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'com.koda.app'
    );
    fs.mkdirSync(appSupport, { recursive: true });
    return path.join(appSupport, 'koda.db');
  } else if (platform === 'linux') {
    // Linux: ~/.local/share/koda/koda.db
    const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    const appDir = path.join(dataHome, 'koda');
    fs.mkdirSync(appDir, { recursive: true });
    return path.join(appDir, 'koda.db');
  } else if (platform === 'win32') {
    // Windows: %APPDATA%\koda\koda.db
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const appDir = path.join(appData, 'koda');
    fs.mkdirSync(appDir, { recursive: true });
    return path.join(appDir, 'koda.db');
  }

  throw new Error(`Unsupported platform: ${platform}`);
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
  runMigrationsOnConnection(sqlite);

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
