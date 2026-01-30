import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { RpcServer } from './server.js';
import { router } from './rpc/router.js';
import { getDbPath } from './db/index.js';
import { runMigrations } from './db/migrate.js';

// Import handlers
import { ping, getStatus } from './handlers/health.js';
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  CreateWorkspaceSchema,
  GetWorkspaceSchema,
} from './handlers/workspace.js';

// Import repo handlers
import {
  createRepo,
  getRepo,
  listRepos,
  deleteRepo,
  CreateRepoSchema,
  GetRepoSchema,
  ListReposSchema,
  DeleteRepoSchema,
} from './handlers/repo.js';

// Import Codex agent handlers
import {
  startCodexSession,
  resumeCodexSession,
  cancelCodexSession,
  getCodexSession,
  sendCodexMessage,
  StartSessionSchema,
  ResumeSessionSchema,
  CancelSessionSchema,
  GetSessionSchema,
  SendMessageSchema,
} from './agents/codex.js';

// Import Claude agent handlers
import {
  claudeStart,
  claudeResume,
  claudeCancel,
  claudeGetSession,
  claudeGetSettings,
  claudeGetMessages,
  ClaudeStartParamsSchema,
  ClaudeResumeParamsSchema,
  ClaudeCancelParamsSchema,
  ClaudeGetSessionParamsSchema,
  ClaudeGetMessagesParamsSchema,
} from './agents/claude.js';

// Import Kimi agent handlers
import {
  createKimiSession,
  sendKimiMessage,
  getKimiSession,
  stopKimiSession,
  CreateKimiSessionSchema,
  SendKimiMessageSchema,
  GetKimiSessionSchema,
  StopKimiSessionSchema,
} from './agents/kimi.js';

// Import worktree handlers
import {
  createWorktree,
  deleteWorktree,
  getWorktree,
  listWorktrees,
  CreateWorktreeSchema,
  DeleteWorktreeSchema,
  GetWorktreeSchema,
  ListWorktreesSchema,
} from './handlers/worktree.js';

// Import checkpoint handlers
import {
  rpcSaveCheckpoint,
  rpcRestoreCheckpoint,
  rpcDiffCheckpoints,
  rpcGetCheckpoint,
  rpcGetCheckpointsByWorkspace,
  SaveCheckpointSchema,
  RestoreCheckpointSchema,
  DiffCheckpointsSchema,
  GetCheckpointSchema,
  GetCheckpointsByWorkspaceSchema,
} from './checkpoint/index.js';

/**
 * Get the Unix socket path based on platform
 */
function getSocketPath(): string {
  const envPath = process.env.KODA_SOCKET;
  if (envPath) {
    return envPath;
  }

  const platform = os.platform();

  if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/com.koda.app/koda.sock
    const appSupport = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'com.koda.app'
    );
    fs.mkdirSync(appSupport, { recursive: true });
    return path.join(appSupport, 'koda.sock');
  } else if (platform === 'linux') {
    // Linux: /tmp/koda-{uid}.sock
    return `/tmp/koda-${process.getuid?.() ?? 'unknown'}.sock`;
  } else if (platform === 'win32') {
    // Windows: \\.\pipe\koda
    return '\\\\.\\pipe\\koda';
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Register all RPC methods
 */
function registerMethods() {
  // Health checks
  router.register('ping', ping);
  router.register('getStatus', getStatus);

  // Workspaces
  router.register('workspace.create', createWorkspace, CreateWorkspaceSchema);
  router.register('workspace.get', getWorkspace, GetWorkspaceSchema);
  router.register('workspace.list', listWorkspaces);

  // Codex agent
  router.register('codex.start', startCodexSession, StartSessionSchema);
  router.register('codex.resume', resumeCodexSession, ResumeSessionSchema);
  router.register('codex.cancel', cancelCodexSession, CancelSessionSchema);
  router.register('codex.get', getCodexSession, GetSessionSchema);
  router.register('codex.send', sendCodexMessage, SendMessageSchema);

  // Claude agent
  router.register('claude.start', claudeStart, ClaudeStartParamsSchema);
  router.register('claude.resume', claudeResume, ClaudeResumeParamsSchema);
  router.register('claude.cancel', claudeCancel, ClaudeCancelParamsSchema);
  router.register('claude.getSession', claudeGetSession, ClaudeGetSessionParamsSchema);
  router.register('claude.getSettings', claudeGetSettings);
  router.register('claude.getMessages', claudeGetMessages, ClaudeGetMessagesParamsSchema);

  // Kimi agent
  router.register('kimi.session.create', createKimiSession, CreateKimiSessionSchema);
  router.register('kimi.session.get', getKimiSession, GetKimiSessionSchema);
  router.register('kimi.session.stop', stopKimiSession, StopKimiSessionSchema);
  router.register('kimi.message.send', sendKimiMessage, SendKimiMessageSchema);

  // Worktree management
  router.register('worktree.create', createWorktree, CreateWorktreeSchema);
  router.register('worktree.delete', deleteWorktree, DeleteWorktreeSchema);
  router.register('worktree.get', getWorktree, GetWorktreeSchema);
  router.register('worktree.list', listWorktrees, ListWorktreesSchema);

  // Checkpoint management
  router.register('checkpoint.save', rpcSaveCheckpoint, SaveCheckpointSchema);
  router.register('checkpoint.restore', rpcRestoreCheckpoint, RestoreCheckpointSchema);
  router.register('checkpoint.diff', rpcDiffCheckpoints, DiffCheckpointsSchema);
  router.register('checkpoint.get', rpcGetCheckpoint, GetCheckpointSchema);
  router.register('checkpoint.list', rpcGetCheckpointsByWorkspace, GetCheckpointsByWorkspaceSchema);

  const methodCount = router.methods().length;
  console.log(`Registered ${methodCount} RPC methods`);
}

/**
 * Initialize database with migrations
 */
async function initDatabase() {
  const dbPath = getDbPath();
  runMigrations(dbPath);
  console.log('Database migrations complete');
}

/**
 * Main entry point
 */
async function main() {
  try {
    console.log('Starting Koda sidecar...');

    // Initialize database
    await initDatabase();

    // Register RPC methods
    registerMethods();

    // Start server
    const socketPath = getSocketPath();
    const server = new RpcServer(socketPath);
    await server.start();

    console.log('Koda sidecar ready');

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
