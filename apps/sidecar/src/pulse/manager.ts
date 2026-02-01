import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getNotificationEmitter } from '../rpc/notifications.js';
import type {
  PulseSession,
  PulseInfo,
  PulseStatusNotification,
  PulseLogNotification,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const PULSE_NOTIFICATIONS = {
  STATUS: 'pulse.status',
  LOG: 'pulse.log',
} as const;

// ============================================================================
// PulseManager
// ============================================================================

/**
 * Manages pulse processes for worktrees.
 *
 * Pulse syncs changes from a worktree to the repo root by:
 * 1. Watching for file changes with watchexec
 * 2. Creating git checkpoints on changes
 * 3. Restoring checkpoints to the repo root
 */
export class PulseManager extends EventEmitter {
  private sessions: Map<string, PulseSession> = new Map();
  private processesByWorktree: Map<string, ChildProcess> = new Map();
  private activeRoots: Map<string, string> = new Map(); // repoRootPath -> worktreeId

  /**
   * Get the platform-specific watchexec binary name
   * Tauri externalBin uses target triples as suffixes
   */
  private getWatchexecBinaryName(): string {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'darwin') {
      return arch === 'arm64'
        ? 'watchexec-aarch64-apple-darwin'
        : 'watchexec-x86_64-apple-darwin';
    } else if (platform === 'linux') {
      return arch === 'arm64'
        ? 'watchexec-aarch64-unknown-linux-gnu'
        : 'watchexec-x86_64-unknown-linux-gnu';
    } else if (platform === 'win32') {
      return 'watchexec-x86_64-pc-windows-msvc.exe';
    }

    throw new Error(`Unsupported platform: ${platform}/${arch}`);
  }

  /**
   * Find watchexec binary - checks bundled location first, then PATH
   */
  private findWatchexec(): string {
    // 1. Check environment variable override
    if (process.env.KODA_WATCHEXEC_PATH) {
      return process.env.KODA_WATCHEXEC_PATH;
    }

    // 2. Check bundled location (Tauri resources)
    if (process.env.KODA_RESOURCES_PATH) {
      const binaryName = this.getWatchexecBinaryName();
      // Tauri externalBin goes to resources/../bin/ (sibling to resources)
      const bundledPath = path.join(
        process.env.KODA_RESOURCES_PATH,
        '..',
        'bin',
        binaryName
      );
      if (fs.existsSync(bundledPath)) {
        return bundledPath;
      }
      // Dev mode: check inside resources/bin directly
      const devPath = path.join(process.env.KODA_RESOURCES_PATH, 'bin', binaryName);
      if (fs.existsSync(devPath)) {
        return devPath;
      }
    }

    // 3. Try to find in PATH using 'which'
    try {
      const whichResult = execSync('which watchexec', { encoding: 'utf-8' }).trim();
      if (whichResult && fs.existsSync(whichResult)) {
        return whichResult;
      }
    } catch {
      // 'which' failed, continue to fallback
    }

    // 4. Check common locations
    const commonPaths = [
      '/opt/homebrew/bin/watchexec', // macOS ARM (Homebrew)
      '/usr/local/bin/watchexec',    // macOS Intel (Homebrew)
      '/usr/bin/watchexec',          // Linux
    ];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Not found - will error when trying to start pulse
    throw new Error(
      'watchexec not found. Please ensure Koda was installed correctly.'
    );
  }

  /**
   * Get paths to bundled scripts/binaries
   * Uses KODA_RESOURCES_PATH (set by Tauri) or falls back to repo structure for dev
   */
  private getBinaryPaths(): {
    pulser: string;
    checkpointer: string;
    gitBusyCheck: string;
    watchexec: string;
  } {
    let scriptsDir: string;

    if (process.env.KODA_RESOURCES_PATH) {
      // Production/Tauri mode: scripts are in resources/scripts/
      scriptsDir = path.join(process.env.KODA_RESOURCES_PATH, 'scripts');
    } else {
      // Dev fallback: use conductor-extraction/scripts from repo root
      const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
      scriptsDir = path.join(repoRoot, 'conductor-extraction', 'scripts');
    }

    return {
      pulser: path.join(scriptsDir, 'spotlighter.sh'),
      checkpointer: path.join(scriptsDir, 'checkpointer.sh'),
      gitBusyCheck: path.join(scriptsDir, 'git-busy-check.sh'),
      watchexec: this.findWatchexec(),
    };
  }

  /**
   * Start pulse for a worktree
   */
  async start(
    worktreeId: string,
    worktreePath: string,
    repoRootPath: string
  ): Promise<PulseInfo> {
    // Check if this root already has an active pulse from another worktree
    const existingWorktree = this.activeRoots.get(repoRootPath);
    if (existingWorktree && existingWorktree !== worktreeId) {
      throw new Error(
        `Cannot start pulse: repo root "${repoRootPath}" already has an active pulse from another worktree. Stop that pulse first.`
      );
    }

    // Check if this worktree already has a pulse running
    const existingSession = this.sessions.get(worktreeId);
    if (existingSession) {
      if (
        existingSession.status === 'running' ||
        existingSession.status === 'syncing'
      ) {
        return this.getInfo(worktreeId)!;
      }
    }

    const paths = this.getBinaryPaths();

    const session: PulseSession = {
      worktreeId,
      worktreePath,
      repoRootPath,
      status: 'starting',
      pid: null,
      startedAt: new Date(),
      lastSyncAt: null,
      syncCount: 0,
      errorMessage: null,
    };

    this.sessions.set(worktreeId, session);
    this.activeRoots.set(repoRootPath, worktreeId);
    this.emitStatus(session);

    // Spawn the pulser shell script
    const proc = spawn('bash', [paths.pulser], {
      cwd: worktreePath,
      env: {
        ...process.env,
        CONDUCTOR_ROOT_PATH: repoRootPath,
        CONDUCTOR_INT_CHECKPOINTER_PATH: paths.checkpointer,
        CONDUCTOR_INT_WATCHEXEC_PATH: paths.watchexec,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    session.pid = proc.pid ?? null;
    this.processesByWorktree.set(worktreeId, proc);

    // Handle stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.handleLogLine(worktreeId, line, 'stdout');
      }
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.handleLogLine(worktreeId, line, 'stderr');
      }
    });

    // Handle process exit
    proc.on('close', (code) => {
      const sess = this.sessions.get(worktreeId);
      if (sess) {
        if (code === 0 || sess.status === 'stopping') {
          sess.status = 'idle';
        } else {
          sess.status = 'error';
          sess.errorMessage = `Process exited with code ${code}`;
        }
        this.emitStatus(sess);
      }
      this.processesByWorktree.delete(worktreeId);
      this.activeRoots.delete(repoRootPath);
    });

    proc.on('error', (err) => {
      const sess = this.sessions.get(worktreeId);
      if (sess) {
        sess.status = 'error';
        sess.errorMessage = err.message;
        this.emitStatus(sess);
      }
      this.activeRoots.delete(repoRootPath);
    });

    // Mark as running after a short delay (watchexec takes a moment to start)
    setTimeout(() => {
      const sess = this.sessions.get(worktreeId);
      if (sess && sess.status === 'starting') {
        sess.status = 'running';
        this.emitStatus(sess);
      }
    }, 500);

    return this.getInfo(worktreeId)!;
  }

  /**
   * Handle a log line from pulser
   */
  private handleLogLine(
    worktreeId: string,
    line: string,
    stream: 'stdout' | 'stderr'
  ): void {
    const notifier = getNotificationEmitter();
    notifier.emit<PulseLogNotification>(PULSE_NOTIFICATIONS.LOG, {
      worktreeId,
      line,
      stream,
      timestamp: Date.now(),
    });

    // Detect sync events from log output
    const session = this.sessions.get(worktreeId);
    if (session) {
      if (line.includes('Starting sync...')) {
        session.status = 'syncing';
        this.emitStatus(session);
      } else if (line.includes('Restored checkpoint')) {
        session.syncCount++;
        session.lastSyncAt = new Date();
        session.status = 'running';
        this.emitStatus(session);
      }
    }
  }

  /**
   * Stop pulse for a worktree
   */
  async stop(worktreeId: string): Promise<PulseInfo | null> {
    const session = this.sessions.get(worktreeId);
    if (!session) {
      return null;
    }

    session.status = 'stopping';
    this.emitStatus(session);

    const proc = this.processesByWorktree.get(worktreeId);
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');

      // Give it 2 seconds, then force kill
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 2000);
    }

    return this.getInfo(worktreeId);
  }

  /**
   * Get pulse info for a worktree
   */
  getInfo(worktreeId: string): PulseInfo | null {
    const session = this.sessions.get(worktreeId);
    if (!session) {
      return null;
    }

    return {
      worktreeId: session.worktreeId,
      status: session.status,
      repoRootPath: session.repoRootPath,
      syncCount: session.syncCount,
      lastSyncAt: session.lastSyncAt?.toISOString() ?? null,
      errorMessage: session.errorMessage,
    };
  }

  /**
   * List all active pulses
   */
  listActive(): PulseInfo[] {
    return Array.from(this.sessions.values())
      .filter(
        (s) =>
          s.status === 'running' ||
          s.status === 'syncing' ||
          s.status === 'starting'
      )
      .map((s) => this.getInfo(s.worktreeId)!);
  }

  /**
   * Check if a repo root has an active pulse
   */
  isRootActive(repoRootPath: string): boolean {
    return this.activeRoots.has(repoRootPath);
  }

  /**
   * Emit status notification
   */
  private emitStatus(session: PulseSession): void {
    const notifier = getNotificationEmitter();
    notifier.emit<PulseStatusNotification>(PULSE_NOTIFICATIONS.STATUS, {
      worktreeId: session.worktreeId,
      status: session.status,
      syncCount: session.syncCount,
      lastSyncAt: session.lastSyncAt?.toISOString() ?? null,
      errorMessage: session.errorMessage,
    });
  }

  /**
   * Stop all pulses (for graceful shutdown)
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.sessions.keys()).map((id) => this.stop(id));
    await Promise.all(promises);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let managerInstance: PulseManager | null = null;

export function getPulseManager(): PulseManager {
  if (!managerInstance) {
    managerInstance = new PulseManager();
  }
  return managerInstance;
}
