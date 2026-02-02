import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { RpcServer } from './server.js';
import { router } from './rpc/router.js';
import { HttpRpcServer } from './httpServer.js';
import { getDbPath, initDbWithMigrations } from './db/index.js';
import { runMigrations } from './db/migrate.js';

// Import handlers
import { ping, getStatus } from './handlers/health.js';
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  getWorkspaceWithContents,
  updateWorkspace,
  deleteWorkspace,
  CreateWorkspaceSchema,
  GetWorkspaceSchema,
  UpdateWorkspaceSchema,
} from './handlers/workspace.js';

// Import repo handlers
import {
  createRepo,
  getRepo,
  listRepos,
  deleteRepo,
  CreateRepoSchema,
  GetRepoSchema,
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
  claudeContinue,
  claudeUpdateSettings,
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
  listAllWorktrees,
  listWorktreesByWorkspace,
  addWorktreeToWorkspace,
  removeWorktreeFromWorkspace,
  getWorktreeDiff,
  CreateWorktreeSchema,
  DeleteWorktreeSchema,
  GetWorktreeSchema,
  ListWorktreesSchema,
  ListAllWorktreesSchema,
  ListWorktreesByWorkspaceSchema,
  AddWorktreeToWorkspaceSchema,
  RemoveWorktreeFromWorkspaceSchema,
  GetWorktreeDiffSchema,
} from './handlers/worktree.js';

// Import workspace repo handlers
import {
  attachRepo,
  detachRepo,
  listWorkspaceRepos,
  createStandaloneWorkspace,
  AttachRepoSchema,
  DetachRepoSchema,
  ListWorkspaceReposSchema,
  CreateStandaloneWorkspaceSchema,
} from './handlers/workspaceRepo.js';

// Import checkpoint handlers
import {
  rpcSaveCheckpoint,
  rpcRestoreCheckpoint,
  rpcDiffCheckpoints,
  rpcGetCheckpoint,
  rpcGetCheckpointsByWorktree,
  SaveCheckpointSchema,
  RestoreCheckpointSchema,
  DiffCheckpointsSchema,
  GetCheckpointSchema,
  GetCheckpointsByWorktreeSchema,
} from './checkpoint/index.js';

// Import PTY handlers
import {
  createPty,
  writePty,
  resizePty,
  closePty,
  getPty,
  listPtySessions,
  setOnDataCallback,
  setOnExitCallback,
  cleanupAllSessions,
  CreatePtySchema,
  WritePtySchema,
  ResizePtySchema,
  ClosePtySchema,
  GetPtySchema,
} from './handlers/pty.js';

// Import diff handlers
import {
  getWorkspaceDiff,
  GetWorkspaceDiffSchema,
} from './handlers/diff.js';
import { getNotificationEmitter } from './rpc/notifications.js';

// Import pulse handlers
import {
  rpcStartPulse,
  rpcStopPulse,
  rpcGetPulseStatus,
  rpcListActivePulses,
  StartPulseSchema,
  StopPulseSchema,
  GetPulseStatusSchema,
  getPulseManager,
} from './pulse/index.js';

// Import GitHub handlers
import {
  createPr,
  getChecks,
  CreatePrSchema,
  GetChecksSchema,
} from './handlers/github.js';

// Import filesystem handlers
import {
  readDirectory,
  readFile,
  ReadDirectoryInputSchema,
  ReadFileInputSchema,
} from './handlers/fs.js';

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

  // Repos
  router.register('repo.create', createRepo, CreateRepoSchema);
  router.register('repo.get', getRepo, GetRepoSchema);
  router.register('repo.list', listRepos);
  router.register('repo.delete', deleteRepo, DeleteRepoSchema);

  // Workspaces (containers)
  router.register('workspace.create', createWorkspace, CreateWorkspaceSchema);
  router.register('workspace.get', getWorkspace, GetWorkspaceSchema);
  router.register('workspace.getWithContents', getWorkspaceWithContents, GetWorkspaceSchema);
  router.register('workspace.list', listWorkspaces);
  router.register('workspace.update', updateWorkspace, UpdateWorkspaceSchema);
  router.register('workspace.delete', deleteWorkspace, GetWorkspaceSchema);

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
  router.register('claude.continue', claudeContinue);
  router.register('claude.updateSettings', claudeUpdateSettings);

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
  router.register('worktree.listAll', listAllWorktrees, ListAllWorktreesSchema);
  router.register('worktree.listByWorkspace', listWorktreesByWorkspace, ListWorktreesByWorkspaceSchema);
  router.register('worktree.addToWorkspace', addWorktreeToWorkspace, AddWorktreeToWorkspaceSchema);
  router.register('worktree.removeFromWorkspace', removeWorktreeFromWorkspace, RemoveWorktreeFromWorkspaceSchema);
  router.register('worktree.getDiff', getWorktreeDiff, GetWorktreeDiffSchema);

  // Workspace repo management (multi-repo support)
  router.register('workspaceRepo.attach', attachRepo, AttachRepoSchema);
  router.register('workspaceRepo.detach', detachRepo, DetachRepoSchema);
  router.register('workspaceRepo.list', listWorkspaceRepos, ListWorkspaceReposSchema);
  router.register('workspace.createStandalone', createStandaloneWorkspace, CreateStandaloneWorkspaceSchema);

  // Checkpoint management
  router.register('checkpoint.save', rpcSaveCheckpoint, SaveCheckpointSchema);
  router.register('checkpoint.restore', rpcRestoreCheckpoint, RestoreCheckpointSchema);
  router.register('checkpoint.diff', rpcDiffCheckpoints, DiffCheckpointsSchema);
  router.register('checkpoint.get', rpcGetCheckpoint, GetCheckpointSchema);
  router.register('checkpoint.list', rpcGetCheckpointsByWorktree, GetCheckpointsByWorktreeSchema);

  // PTY (terminal) management
  router.register('pty.create', createPty, CreatePtySchema);
  router.register('pty.write', writePty, WritePtySchema);
  router.register('pty.resize', resizePty, ResizePtySchema);
  router.register('pty.close', closePty, ClosePtySchema);
  router.register('pty.get', getPty, GetPtySchema);
  router.register('pty.list', listPtySessions);

  // Diff management (for MCP tools)
  router.register('workspace.getDiff', getWorkspaceDiff, GetWorkspaceDiffSchema);

  // Pulse management
  router.register('pulse.start', rpcStartPulse, StartPulseSchema);
  router.register('pulse.stop', rpcStopPulse, StopPulseSchema);
  router.register('pulse.status', rpcGetPulseStatus, GetPulseStatusSchema);
  router.register('pulse.listActive', rpcListActivePulses);

  // GitHub operations
  router.register('github.createPr', createPr, CreatePrSchema);
  router.register('github.getChecks', getChecks, GetChecksSchema);

  // Filesystem operations
  router.register('fs.readDirectory', readDirectory, ReadDirectoryInputSchema);
  router.register('fs.readFile', readFile, ReadFileInputSchema);

  const methodCount = router.methods().length;
  console.log(`Registered ${methodCount} RPC methods`);
}

/**
 * Initialize database with migrations
 * For :memory: databases, ensures migrations run on the same connection
 */
async function initDatabase() {
  const dbPath = getDbPath();

  if (dbPath === ':memory:') {
    // For in-memory databases, init and migrate on same connection
    initDbWithMigrations(dbPath);
    console.log('In-memory database initialized with migrations');
  } else {
    // For file-based databases, run migrations (uses separate connection)
    runMigrations(dbPath);
    console.log('Database migrations complete');
  }
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

    // Set up PTY callbacks to stream data to connected clients
    const notificationEmitter = getNotificationEmitter();
    setOnDataCallback((sessionId, data) => {
      notificationEmitter.emitPtyData(sessionId, data);
    });
    setOnExitCallback((sessionId, exitCode) => {
      notificationEmitter.emitPtyExit(sessionId, exitCode);
    });

    // Start Unix socket server
    const socketPath = getSocketPath();
    const server = new RpcServer(socketPath);
    await server.start();

    // Start HTTP server for E2E testing and development
    // - Skip in test mode (NODE_ENV=test) unless explicitly requested
    // - In production, only start if KODA_HTTP_PORT is explicitly set
    // - In development, start on default port with graceful fallback
    let httpServer: HttpRpcServer | null = null;
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';
    const httpPort = process.env.KODA_HTTP_PORT;
    const defaultDevPort = 3847;

    if (httpPort && httpPort !== '0') {
      // Explicit port specified - use it
      const port = parseInt(httpPort, 10);
      if (!isNaN(port)) {
        httpServer = new HttpRpcServer(port);
        try {
          await httpServer.start();
        } catch (err) {
          console.warn('Failed to start HTTP server on port', port, '-', err);
          httpServer = null;
        }
      }
    } else if (!isProduction && !isTest) {
      // Development mode - start HTTP server on default port (non-fatal if fails)
      httpServer = new HttpRpcServer(defaultDevPort);
      try {
        await httpServer.start();
      } catch (err) {
        console.warn('Failed to start HTTP server on default port -', err);
        httpServer = null;
      }
    }

    console.log('Koda sidecar ready');

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async (signal?: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      console.log(`\nShutting down${signal ? ` (${signal})` : ''}...`);
      cleanupAllSessions(); // Close all PTY sessions
      await getPulseManager().stopAll(); // Stop all pulse processes
      if (httpServer) {
        await httpServer.stop();
      }
      await server.stop();
      process.exit(0);
    };

    // Handle all termination signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));
    
    // Handle uncaught errors - cleanup before exit
    process.on('uncaughtException', async (err) => {
      console.error('Uncaught exception:', err);
      await shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      await shutdown('unhandledRejection');
    });
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
