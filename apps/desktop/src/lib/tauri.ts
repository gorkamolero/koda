import type { SidecarStatus, JsonRpcError } from '@/lib/rpc'

/**
 * Check if we're running in Tauri context
 * In E2E tests (Playwright), we run in regular Chromium and Tauri APIs aren't available
 */
export function isTauriContext(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * HTTP RPC URL for E2E testing
 * When running in browser context without Tauri, we use HTTP to reach the sidecar
 * Port is configurable via VITE_HTTP_RPC_PORT env var (tests use 3848, dev uses 3847)
 */
function getHttpRpcUrl(): string {
  const port = (import.meta as { env?: { VITE_HTTP_RPC_PORT?: string } }).env?.VITE_HTTP_RPC_PORT || '3847'
  return `http://localhost:${port}/rpc`
}

/**
 * Send RPC request via HTTP (for E2E testing)
 */
async function httpRpcRequest<T = unknown>(
  method: string,
  params?: unknown
): Promise<T> {
  const response = await fetch(getHttpRpcUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: params ?? null,
    }),
  })

  const data = await response.json() as { result?: T; error?: { message?: string } }

  if (data.error) {
    throw new Error(data.error.message ?? 'RPC error')
  }

  return data.result as T
}

/**
 * Type-safe wrapper for Tauri invoke commands
 * Uses dynamic import to avoid loading @tauri-apps/api in non-Tauri contexts
 */
export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export interface HealthResponse {
  status: string
  version: string
}

/**
 * Health check - verifies Tauri app is responsive
 */
export async function healthCheck(): Promise<HealthResponse> {
  if (!isTauriContext()) {
    // In E2E tests, return a mock health response
    return { status: 'ok', version: 'e2e-test' }
  }
  return invokeCommand<HealthResponse>('health_check')
}

/**
 * Spawn the Node.js sidecar process
 */
export async function spawnSidecar(): Promise<SidecarStatus> {
  if (!isTauriContext()) {
    // In E2E tests, sidecar is already running
    return { running: true, socket_path: 'http' }
  }
  return invokeCommand<SidecarStatus>('spawn_sidecar')
}

/**
 * Get current sidecar status
 */
export async function getSidecarStatus(): Promise<SidecarStatus> {
  if (!isTauriContext()) {
    // In E2E tests, check via HTTP ping
    try {
      await httpRpcRequest('ping')
      return { running: true, socket_path: 'http' }
    } catch {
      return { running: false, socket_path: '' }
    }
  }
  return invokeCommand<SidecarStatus>('get_sidecar_status')
}

/**
 * Stop the sidecar process
 */
export async function stopSidecar(): Promise<SidecarStatus> {
  if (!isTauriContext()) {
    // In E2E tests, we don't control the sidecar
    return { running: false, socket_path: '' }
  }
  return invokeCommand<SidecarStatus>('stop_sidecar')
}

/**
 * Connect to the Unix socket
 */
export async function connectSocket(): Promise<string> {
  if (!isTauriContext()) {
    // In E2E tests, we use HTTP instead
    return 'http'
  }
  return invokeCommand<string>('connect_socket')
}

/**
 * Send RPC request through Tauri to the sidecar
 * Falls back to HTTP when not in Tauri context (E2E tests)
 */
export async function rpcRequest<T = unknown>(
  method: string,
  params?: unknown
): Promise<T> {
  if (!isTauriContext()) {
    return httpRpcRequest<T>(method, params)
  }
  return invokeCommand<T>('send_rpc_request', {
    method,
    params: params ?? null,
  })
}

/**
 * Event listener types
 */
export interface SidecarStatusEvent {
  payload: SidecarStatus
}

export interface RpcErrorEvent {
  payload: {
    method: string
    error: JsonRpcError
  }
}

/**
 * Unlisten function type
 */
type UnlistenFn = () => void

/**
 * Subscribe to sidecar status events
 */
export async function onSidecarStatus(
  callback: (status: SidecarStatus) => void
): Promise<UnlistenFn> {
  if (!isTauriContext()) {
    // In E2E tests, return a no-op unlisten function
    return () => {}
  }
  const { listen } = await import('@tauri-apps/api/event')
  return listen<SidecarStatus>('sidecar-status', (event) => {
    callback(event.payload)
  })
}

/**
 * Subscribe to RPC error events
 */
export async function onRpcError(
  callback: (error: RpcErrorEvent['payload']) => void
): Promise<UnlistenFn> {
  if (!isTauriContext()) {
    // In E2E tests, return a no-op unlisten function
    return () => {}
  }
  const { listen } = await import('@tauri-apps/api/event')
  return listen<RpcErrorEvent['payload']>('rpc-error', (event) => {
    callback(event.payload)
  })
}

/**
 * Subscribe to JSON-RPC notifications from sidecar
 * This is for notifications sent by the sidecar (e.g., pulse status updates)
 */
export async function onNotification<T>(
  method: string,
  callback: (payload: T) => void
): Promise<UnlistenFn> {
  if (!isTauriContext()) {
    // The browser uses the sidecar's real notification transport.
    let stopped = false
    let socket: WebSocket | undefined
    let reconnect: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      socket = new WebSocket(getHttpRpcUrl().replace('http:', 'ws:').replace('/rpc', '/ws'))
      socket.onmessage = (event) => {
        try {
          const notification = JSON.parse(String(event.data)) as { method?: string; params?: T }
          if (notification.method === method && notification.params) callback(notification.params)
        } catch {
          // Ignore malformed notifications; the persisted event log can be reloaded.
        }
      }
      socket.onclose = () => {
        if (!stopped) reconnect = setTimeout(connect, 1000)
      }
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(reconnect)
      socket?.close()
    }
  }
  const { listen } = await import('@tauri-apps/api/event')
  return listen<{ method: string; params: T }>('sidecar-notification', (event) => {
    if (event.payload.method === method) callback(event.payload.params)
  })
}
