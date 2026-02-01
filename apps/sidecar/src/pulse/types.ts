import { z } from 'zod';

// ============================================================================
// Input Schemas
// ============================================================================

export const StartPulseSchema = z.object({
  worktreeId: z.string().uuid(),
  repoRootPath: z.string().min(1),
});

export const StopPulseSchema = z.object({
  worktreeId: z.string().uuid(),
});

export const GetPulseStatusSchema = z.object({
  worktreeId: z.string().uuid(),
});

// ============================================================================
// Types
// ============================================================================

export type PulseStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'syncing'
  | 'error'
  | 'stopping';

export interface PulseSession {
  worktreeId: string;
  worktreePath: string;
  repoRootPath: string;
  status: PulseStatus;
  pid: number | null;
  startedAt: Date;
  lastSyncAt: Date | null;
  syncCount: number;
  errorMessage: string | null;
}

export interface PulseInfo {
  worktreeId: string;
  status: PulseStatus;
  repoRootPath: string;
  syncCount: number;
  lastSyncAt: string | null;
  errorMessage: string | null;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface PulseStatusNotification {
  worktreeId: string;
  status: PulseStatus;
  syncCount: number;
  lastSyncAt: string | null;
  errorMessage: string | null;
}

export interface PulseLogNotification {
  worktreeId: string;
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: number;
}
