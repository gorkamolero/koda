import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Migration 0005 replaces the original workspace/worktree model and drops these
// tables without copying their rows. It is safe only for an empty legacy schema.
// Keep its historical SQL intact, but never apply it to saved user data.
function protectLegacyData(sqlite: Database.Database) {
  const tableNames = new Set(
    (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
      .map(({ name }) => name)
  );
  if (tableNames.has('__drizzle_migrations')) {
    const latest = sqlite.prepare('SELECT MAX(created_at) AS timestamp FROM __drizzle_migrations').get() as { timestamp: number | null };
    if (latest.timestamp !== null && latest.timestamp >= 1769920000000) return;
  }
  const affectedTables = [
    'workspaces', 'workspace_repos', 'workspace_shares', 'sessions', 'session_messages',
    'attachments', 'session_recordings', 'recording_frames', 'diff_comments',
    'visual_snapshots', 'git_checkpoints',
  ];
  const populated = affectedTables.filter((table) => tableNames.has(table)
    && sqlite.prepare(`SELECT 1 FROM "${table}" LIMIT 1`).get() !== undefined);
  if (populated.length) {
    throw new Error(
      `Cannot automatically upgrade this legacy Koda database: migration 0005 would delete saved data (${populated.join(', ')}). `
      + 'The database has been left unchanged. Keep this data directory for recovery; use a new KODA_DATA_DIR to launch the current version.'
    );
  }
}

/**
 * Run database migrations
 *
 * For file-based databases: creates a new connection, runs migrations, closes it
 * For :memory: databases: use runMigrationsOnConnection() with an existing connection
 */
export function runMigrations(dbPath: string) {
  // For in-memory databases, this won't work correctly since the connection
  // is closed after migration. Use runMigrationsOnConnection() instead.
  if (dbPath === ':memory:') {
    console.warn('runMigrations with :memory: will lose tables. Use runMigrationsOnConnection() instead.');
  }

  const sqlite = new Database(dbPath);
  try {
    runMigrationsOnConnection(sqlite);
  } finally {
    sqlite.close();
  }
}

/**
 * Run database migrations on an existing connection
 * Use this for :memory: databases to keep tables after migration
 */
export function runMigrationsOnConnection(sqlite: Database.Database) {
  protectLegacyData(sqlite);
  const db = drizzle(sqlite);
  const migrationsFolder = path.join(__dirname, 'migrations');
  migrate(db, { migrationsFolder });
}
