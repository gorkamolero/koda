import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const db = drizzle(sqlite);

  const migrationsFolder = path.join(__dirname, 'migrations');

  migrate(db, { migrationsFolder });

  sqlite.close();
}

/**
 * Run database migrations on an existing connection
 * Use this for :memory: databases to keep tables after migration
 */
export function runMigrationsOnConnection(sqlite: Database.Database) {
  const db = drizzle(sqlite);
  const migrationsFolder = path.join(__dirname, 'migrations');
  migrate(db, { migrationsFolder });
}
