/**
 * PTY (Pseudo Terminal) Handler
 *
 * Provides real terminal sessions using node-pty.
 * Each terminal session is identified by a unique ID and can be
 * created, written to, resized, and destroyed.
 */

import * as pty from 'node-pty'
import * as os from 'os'
import { z } from 'zod'

// ============================================================================
// Types
// ============================================================================

interface PtySession {
  id: string
  pty: pty.IPty
  workingDirectory: string
  createdAt: Date
}

// Active PTY sessions
const sessions = new Map<string, PtySession>()

// Callbacks for PTY output - set by the router
let onDataCallback: ((sessionId: string, data: string) => void) | null = null
let onExitCallback: ((sessionId: string, exitCode: number) => void) | null = null

// ============================================================================
// Schemas
// ============================================================================

export const CreatePtySchema = z.object({
  workingDirectory: z.string().optional(),
  cols: z.number().optional(),
  rows: z.number().optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export const WritePtySchema = z.object({
  sessionId: z.string(),
  data: z.string(),
})

export const ResizePtySchema = z.object({
  sessionId: z.string(),
  cols: z.number(),
  rows: z.number(),
})

export const ClosePtySchema = z.object({
  sessionId: z.string(),
})

export const GetPtySchema = z.object({
  sessionId: z.string(),
})

// ============================================================================
// Handlers
// ============================================================================

/**
 * Create a new PTY session
 */
export function createPty(params: z.infer<typeof CreatePtySchema>): {
  sessionId: string
  pid: number
  cols: number
  rows: number
} {
  const { workingDirectory, cols = 80, rows = 24, env } = params

  // Generate unique session ID
  const sessionId = `pty-${Date.now()}-${Math.random().toString(36).substring(7)}`

  // Determine shell based on platform
  const shell = os.platform() === 'win32'
    ? 'powershell.exe'
    : process.env.SHELL || '/bin/zsh'

  // Create PTY
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: workingDirectory || process.env.HOME || '/',
    env: {
      ...process.env,
      ...env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      // Disable zsh's PROMPT_EOL_MARK (the % shown when output doesn't end with newline)
      PROMPT_EOL_MARK: '',
    },
  })

  // Store session
  const session: PtySession = {
    id: sessionId,
    pty: ptyProcess,
    workingDirectory: workingDirectory || process.env.HOME || '/',
    createdAt: new Date(),
  }
  sessions.set(sessionId, session)

  // Handle data output
  ptyProcess.onData((data) => {
    if (onDataCallback) {
      onDataCallback(sessionId, data)
    }
  })

  // Handle exit
  ptyProcess.onExit(({ exitCode }) => {
    if (onExitCallback) {
      onExitCallback(sessionId, exitCode)
    }
    sessions.delete(sessionId)
  })

  console.log(`[PTY] Created session ${sessionId} with shell ${shell}, PID ${ptyProcess.pid}`)

  return {
    sessionId,
    pid: ptyProcess.pid,
    cols,
    rows,
  }
}

/**
 * Write data to a PTY session
 */
export function writePty(params: z.infer<typeof WritePtySchema>): { success: boolean } {
  const { sessionId, data } = params

  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`PTY session not found: ${sessionId}`)
  }

  session.pty.write(data)
  return { success: true }
}

/**
 * Resize a PTY session
 */
export function resizePty(params: z.infer<typeof ResizePtySchema>): { success: boolean } {
  const { sessionId, cols, rows } = params

  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`PTY session not found: ${sessionId}`)
  }

  session.pty.resize(cols, rows)
  console.log(`[PTY] Resized session ${sessionId} to ${cols}x${rows}`)

  return { success: true }
}

/**
 * Close a PTY session
 */
export function closePty(params: z.infer<typeof ClosePtySchema>): { success: boolean } {
  const { sessionId } = params

  const session = sessions.get(sessionId)
  if (!session) {
    // Already closed, that's fine
    return { success: true }
  }

  session.pty.kill()
  sessions.delete(sessionId)

  console.log(`[PTY] Closed session ${sessionId}`)

  return { success: true }
}

/**
 * Get PTY session info
 */
export function getPty(params: z.infer<typeof GetPtySchema>): {
  sessionId: string
  pid: number
  workingDirectory: string
  createdAt: string
} | null {
  const { sessionId } = params

  const session = sessions.get(sessionId)
  if (!session) {
    return null
  }

  return {
    sessionId: session.id,
    pid: session.pty.pid,
    workingDirectory: session.workingDirectory,
    createdAt: session.createdAt.toISOString(),
  }
}

/**
 * List all active PTY sessions
 */
export function listPtySessions(): Array<{
  sessionId: string
  pid: number
  workingDirectory: string
  createdAt: string
}> {
  return Array.from(sessions.values()).map(session => ({
    sessionId: session.id,
    pid: session.pty.pid,
    workingDirectory: session.workingDirectory,
    createdAt: session.createdAt.toISOString(),
  }))
}

// ============================================================================
// Event Registration
// ============================================================================

/**
 * Set callback for PTY data output
 * Called by the RPC server to forward PTY output to clients
 */
export function setOnDataCallback(callback: (sessionId: string, data: string) => void) {
  onDataCallback = callback
}

/**
 * Set callback for PTY exit
 */
export function setOnExitCallback(callback: (sessionId: string, exitCode: number) => void) {
  onExitCallback = callback
}

/**
 * Clean up all PTY sessions
 * Called on shutdown
 */
export function cleanupAllSessions() {
  for (const session of sessions.values()) {
    try {
      session.pty.kill()
    } catch {
      // Ignore errors during cleanup
    }
  }
  sessions.clear()
  console.log('[PTY] All sessions cleaned up')
}
