import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

/**
 * Get the database path based on platform
 */
export function getDbPath(): string {
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
 * Initialize database connection
 */
export function initDb(dbPath?: string) {
  const finalPath = dbPath || getDbPath();
  const sqlite = new Database(finalPath);

  // Enable WAL mode for better concurrency
  sqlite.pragma('journal_mode = WAL');

  return drizzle(sqlite, { schema });
}

/**
 * Global database instance
 */
let db: ReturnType<typeof initDb> | null = null;

/**
 * Get or create database instance
 */
export function getDb() {
  if (!db) {
    db = initDb();
  }
  return db;
}
