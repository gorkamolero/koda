import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { SidecarStatus, JsonRpcError } from '@/lib/rpc'

/**
 * Type-safe wrapper for Tauri invoke commands
 */
export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
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
  return invokeCommand<HealthResponse>('health_check')
}

/**
 * Spawn the Node.js sidecar process
 */
export async function spawnSidecar(): Promise<SidecarStatus> {
  return invokeCommand<SidecarStatus>('spawn_sidecar')
}

/**
 * Get current sidecar status
 */
export async function getSidecarStatus(): Promise<SidecarStatus> {
  return invokeCommand<SidecarStatus>('get_sidecar_status')
}

/**
 * Stop the sidecar process
 */
export async function stopSidecar(): Promise<SidecarStatus> {
  return invokeCommand<SidecarStatus>('stop_sidecar')
}

/**
 * Connect to the Unix socket
 */
export async function connectSocket(): Promise<string> {
  return invokeCommand<string>('connect_socket')
}

/**
 * Send RPC request through Tauri to the sidecar
 */
export async function rpcRequest<T = unknown>(
  method: string,
  params?: unknown
): Promise<T> {
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
 * Subscribe to sidecar status events
 */
export async function onSidecarStatus(
  callback: (status: SidecarStatus) => void
): Promise<UnlistenFn> {
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
  return listen<RpcErrorEvent['payload']>('rpc-error', (event) => {
    callback(event.payload)
  })
}
