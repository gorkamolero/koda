import { registerCollaborationMethods } from './sync/register.js';
import { RpcServer } from './server.js';
import { router } from './rpc/router.js';
import { HttpRpcServer } from './httpServer.js';
import { getDb, getDbPath, initDbWithMigrations } from './db/index.js';
import { getSessionsByWorktree } from './db/sessions.js';
import { runMigrations } from './db/migrate.js';
import { config, logConfig } from './config.js';
import { listCodexModels } from './agents/codexModels.js';

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
  listCodexSessions,
  getCodexMessages,
  getCodexHandler,
  updateCodexSettings,
  UpdateSettingsSchema,
  ListSessionsSchema,
  GetMessagesSchema,
  StartSessionSchema,
  ResumeSessionSchema,
  CancelSessionSchema,
  GetSessionSchema,
  SendMessageSchema,
} from './agents/codex.js';

// Import Claude agent handlers
import {
  claudeStart,
  claudeSend,
  claudeResume,
  claudeCancel,
  claudeGetSession,
  claudeList,
  claudeGetMessages,
  claudeContinue,
  claudeUpdateSettings,
  getClaudeHandler,
  ClaudeSendParamsSchema,
  ClaudeListParamsSchema,
  ClaudeContinueParamsSchema,
  ClaudeUpdateSettingsParamsSchema,
  ClaudeStartParamsSchema,
  ClaudeResumeParamsSchema,
  ClaudeCancelParamsSchema,
  ClaudeGetSessionParamsSchema,
  ClaudeGetMessagesParamsSchema,
} from './agents/claude.js';
import { getClaudeStatus, listClaudeModels } from './agents/claudeModels.js';
import {
  ApprovalListParamsSchema,
  ApprovalRespondParamsSchema,
  approvalList,
  approvalRespond,
  getApprovalBroker,
} from './agents/approvalBroker.js';
import {
  QuestionListParamsSchema, QuestionRespondParamsSchema,
  questionList, questionRespond, getQuestionBroker,
} from './agents/questionBroker.js';

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
  enableCollaboration,
  disableCollaboration,
  CreateWorktreeSchema,
  DeleteWorktreeSchema,
  GetWorktreeSchema,
  ListWorktreesSchema,
  ListAllWorktreesSchema,
  ListWorktreesByWorkspaceSchema,
  AddWorktreeToWorkspaceSchema,
  RemoveWorktreeFromWorkspaceSchema,
  GetWorktreeDiffSchema,
  EnableCollaborationSchema,
  DisableCollaborationSchema,
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
  snapshotPty,
  setOnDataCallback,
  setOnExitCallback,
  cleanupAllSessions,
  CreatePtySchema,
  WritePtySchema,
  ResizePtySchema,
  ClosePtySchema,
  GetPtySchema,
  SnapshotPtySchema,
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

// Import activity handlers
import {
  createActivity,
  listActivity,
  markRead,
  unreadCount,
  getWorkspacesWithStatus,
  CreateActivitySchema,
  ListActivitySchema,
  MarkReadSchema,
  UnreadCountSchema,
  GetWorkspacesWithStatusSchema,
} from './handlers/activity.js';

// Import file watcher
import { startFileWatching, stopFileWatching } from './handlers/fileWatcher.js';

/**
 * Get the Unix socket path from config
 */
function getSocketPath(): string {
  return config.socketPath;
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
  router.register('codex.list', listCodexSessions, ListSessionsSchema);
  router.register('codex.getMessages', getCodexMessages, GetMessagesSchema);
  router.register('codex.models', listCodexModels);
  router.register('codex.updateSettings', updateCodexSettings, UpdateSettingsSchema);
  router.register('approval.list', approvalList, ApprovalListParamsSchema);
  router.register('approval.respond', approvalRespond, ApprovalRespondParamsSchema);
  router.register('question.list', questionList, QuestionListParamsSchema);
  router.register('question.respond', questionRespond, QuestionRespondParamsSchema);
  router.register('session.list', async (input: { worktreeId: string }) => getSessionsByWorktree(getDb(), input.worktreeId), ListSessionsSchema);

  // Claude agent
  router.register('claude.start', claudeStart, ClaudeStartParamsSchema);
  router.register('claude.send', claudeSend, ClaudeSendParamsSchema);
  router.register('claude.resume', claudeResume, ClaudeResumeParamsSchema);
  router.register('claude.cancel', claudeCancel, ClaudeCancelParamsSchema);
  router.register('claude.getSession', claudeGetSession, ClaudeGetSessionParamsSchema);
  router.register('claude.get', claudeGetSession, ClaudeGetSessionParamsSchema);
  router.register('claude.list', claudeList, ClaudeListParamsSchema);
  router.register('claude.models', listClaudeModels);
  router.register('claude.status', getClaudeStatus);
  router.register('claude.getMessages', claudeGetMessages, ClaudeGetMessagesParamsSchema);
  router.register('claude.continue', claudeContinue, ClaudeContinueParamsSchema);
  router.register('claude.updateSettings', claudeUpdateSettings, ClaudeUpdateSettingsParamsSchema);

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
  router.register('worktree.enableCollaboration', enableCollaboration, EnableCollaborationSchema);
  router.register('worktree.disableCollaboration', disableCollaboration, DisableCollaborationSchema);

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
  router.register('pty.snapshot', snapshotPty, SnapshotPtySchema);

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

  // Activity feed (Agent Overview & Activity Feed)
  router.register('activity.create', createActivity, CreateActivitySchema);
  router.register('activity.list', listActivity, ListActivitySchema);
  router.register('activity.markRead', markRead, MarkReadSchema);
  router.register('activity.unreadCount', unreadCount, UnreadCountSchema);
  router.register('activity.getWorkspacesWithStatus', getWorkspacesWithStatus, GetWorkspacesWithStatusSchema);

  registerCollaborationMethods();

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

    // Log configuration
    logConfig();

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

    // Start Unix socket server (local mode only)
    let server: RpcServer | null = null;
    if (config.socketServerEnabled) {
      const socketPath = getSocketPath();
      server = new RpcServer(socketPath);
      await server.start();
    } else {
      console.log('[Server] Unix socket server disabled (remote mode)');
    }

    // Start HTTP server
    // - Remote mode: Always enabled, required for communication
    // - Local mode: Optional, for E2E testing and development
    let httpServer: HttpRpcServer | null = null;
    const isTest = process.env.NODE_ENV === 'test';

    if (config.httpServerEnabled || config.mode === 'remote') {
      // HTTP server is required
      httpServer = new HttpRpcServer(config.httpPort, config.httpHost);
      await httpServer.start();
    } else if (!isTest && process.env.NODE_ENV !== 'production') {
      // Development mode - start HTTP server on default port (non-fatal if fails)
      httpServer = new HttpRpcServer();
      try {
        await httpServer.start();
      } catch (err) {
        console.warn('Failed to start HTTP server -', err);
        httpServer = null;
      }
    }

    // Start file watching for activity feed
    startFileWatching();

    console.log(`Koda sidecar ready (${config.mode} mode)`);

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async (signal?: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      console.log(`\nShutting down${signal ? ` (${signal})` : ''}...`);
      stopFileWatching(); // Stop file watching
      getApprovalBroker().dispose();
      getQuestionBroker().dispose();
      await getCodexHandler().cleanup();
      await getClaudeHandler().dispose();
      cleanupAllSessions(); // Close all PTY sessions
      await getPulseManager().stopAll(); // Stop all pulse processes
      if (httpServer) {
        await httpServer.stop();
      }
      if (server) {
        await server.stop();
      }
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
