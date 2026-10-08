import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { initDbWithMigrations, resetDb, getDb } from '../src/db/index.js';
import { repos, worktrees } from '../src/db/schema.js';
import { getWorktreeDiff } from '../src/handlers/worktree.js';

describe('worktree diff for local agent edits', () => {
  let directory: string;
  let worktreeId: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'koda-diff-'));
    git('init', '-b', 'main');
    git('config', 'user.name', 'Koda Test');
    git('config', 'user.email', 'test@example.invalid');
    writeFileSync(join(directory, 'README.md'), 'initial\n');
    git('add', '.');
    git('commit', '-m', 'Initial');
    initDbWithMigrations(':memory:');
    const repoId = randomUUID();
    worktreeId = randomUUID();
    getDb().insert(repos).values({ id: repoId, rootPath: directory, defaultBranch: 'main' }).run();
    getDb().insert(worktrees).values({ id: worktreeId, repoId, worktreePath: directory }).run();
  });
  afterEach(() => { resetDb(); rmSync(directory, { recursive: true, force: true }); });

  it('shows new files with spaces and shell characters without staging them', async () => {
    const filename = "new file's $(not-a-command).txt";
    writeFileSync(join(directory, filename), 'new content\n');
    const indexBefore = git('write-tree');
    const diff = await getWorktreeDiff({ worktreeId });
    expect(diff.files).toEqual([expect.objectContaining({ path: filename, status: 'added', additions: 1 })]);
    expect(diff.files[0].diff).toContain('+new content');
    expect(git('write-tree')).toBe(indexBefore);
  });

  it('includes committed branch changes even when the repository has no origin', async () => {
    git('checkout', '-b', 'feature');
    writeFileSync(join(directory, 'README.md'), 'changed\n');
    git('add', '.');
    git('commit', '-m', 'Branch edit');
    const diff = await getWorktreeDiff({ worktreeId });
    expect(diff.mergeBase).toBe(git('rev-parse', 'main').trim());
    expect(diff.files[0]).toMatchObject({ path: 'README.md', status: 'modified', additions: 1, deletions: 1 });
  });
});
