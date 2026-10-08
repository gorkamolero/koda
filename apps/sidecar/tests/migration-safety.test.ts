import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, mkdirSync, readFileSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations, runMigrationsOnConnection } from '../src/db/migrate.js';

const migrationsFolder = fileURLToPath(new URL('../src/db/migrations', import.meta.url));

describe('legacy migration safety', () => {
  let fixture: string;
  let dbPath: string;
  let sqlite: Database.Database;

  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), 'koda-legacy-migration-'));
    dbPath = join(fixture, 'legacy.db');
    const legacyFolder = join(fixture, 'migrations');
    mkdirSync(join(legacyFolder, 'meta'), { recursive: true });
    const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 5);
    writeFileSync(join(legacyFolder, 'meta/_journal.json'), JSON.stringify(journal));
    for (const entry of journal.entries) {
      copyFileSync(join(migrationsFolder, `${entry.tag}.sql`), join(legacyFolder, `${entry.tag}.sql`));
    }
    sqlite = new Database(dbPath);
    migrate(drizzle(sqlite), { migrationsFolder: legacyFolder });
  });

  afterEach(() => {
    if (sqlite.open) sqlite.close();
    rmSync(fixture, { recursive: true, force: true });
  });

  it('blocks the destructive legacy upgrade before changing saved sessions or messages', () => {
    sqlite.prepare("INSERT INTO sessions (id, title) VALUES ('saved-session', 'Keep this session')").run();
    sqlite.prepare("INSERT INTO session_messages (id, session_id, role, content) VALUES ('saved-message', 'saved-session', 'user', 'Keep this message')").run();
    const migrationsBefore = sqlite.prepare('SELECT * FROM __drizzle_migrations').all();

    expect(() => runMigrationsOnConnection(sqlite)).toThrow(/legacy.*saved data/i);
    expect(sqlite.prepare('SELECT title FROM sessions').get()).toEqual({ title: 'Keep this session' });
    expect(sqlite.prepare('SELECT content FROM session_messages').get()).toEqual({ content: 'Keep this message' });
    expect(sqlite.prepare('SELECT * FROM __drizzle_migrations').all()).toEqual(migrationsBefore);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'worktrees'").get()).toBeUndefined();
  });

  it('also guards the normal file-based startup migration path', () => {
    sqlite.prepare("INSERT INTO workspaces (id, directory_name) VALUES ('saved-workspace', 'Saved work')").run();
    sqlite.close();
    expect(() => runMigrations(dbPath)).toThrow(/legacy.*saved data/i);
    sqlite = new Database(dbPath);
    expect(sqlite.prepare('SELECT directory_name FROM workspaces').get()).toEqual({ directory_name: 'Saved work' });
  });

  it('upgrades empty legacy tables while preserving unaffected repository records', () => {
    sqlite.prepare("INSERT INTO repos (id, name) VALUES ('existing-repo', 'Existing repository')").run();
    runMigrationsOnConnection(sqlite);
    expect(sqlite.prepare('SELECT name FROM repos').get()).toEqual({ name: 'Existing repository' });
    expect(sqlite.pragma('table_info(sessions)')).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'codex_thread_id' })]));
  });

  it('allows current databases with saved sessions to reopen normally', () => {
    runMigrationsOnConnection(sqlite);
    sqlite.prepare("INSERT INTO sessions (id, title) VALUES ('current-session', 'Current work')").run();
    runMigrationsOnConnection(sqlite);
    expect(sqlite.prepare('SELECT title FROM sessions').get()).toEqual({ title: 'Current work' });
  });
});
