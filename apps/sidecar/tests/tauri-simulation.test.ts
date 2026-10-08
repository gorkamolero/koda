/**
 * Tauri Simulation Integration Tests
 *
 * This test simulates what the Tauri backend does:
 * 1. Spawns the sidecar
 * 2. Connects via Unix socket
 * 3. Sends JSON-RPC requests
 * 4. Receives responses
 *
 * This validates the full IPC pipeline from the sidecar perspective.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as net from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import type { JsonRpcResponse } from '../src/types/rpc.js';

describe('Tauri → Sidecar Integration (Full Pipeline)', () => {
  let socketPath: string;
  let sidecarProcess: ChildProcess | null = null;

  beforeAll(async () => {
    // Use temporary socket for testing
    socketPath = path.join(os.tmpdir(), `koda-tauri-sim-${Date.now()}.sock`);

    // Ensure socket doesn't exist
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }

    // Spawn the sidecar process
    const sidecarPath = path.join(__dirname, '../src/index.ts');

    // Spawn Node directly so teardown terminates the actual sidecar, not an
    // npx wrapper that can leave its child and file watchers orphaned.
    sidecarProcess = spawn(process.execPath, ['--import', 'tsx', sidecarPath], {
      env: {
        ...process.env,
        KODA_SOCKET: socketPath,
        // Use in-memory database for tests
        KODA_DB_PATH: ':memory:',
        NODE_ENV: 'test',
      },
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for server to be ready (socket file exists)
    await waitForSocket(socketPath, 10000);
  }, 15000);

  afterAll(async () => {
    // Kill sidecar process
    if (sidecarProcess) {
      sidecarProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        sidecarProcess?.on('exit', resolve);
        setTimeout(resolve, 2000); // Fallback timeout
      });
    }

    // Clean up socket file
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
  });

  describe('Simulated Tauri Commands', () => {
    it('should simulate spawn_sidecar + connect_socket', async () => {
      // Sidecar is already spawned in beforeAll
      // Verify socket exists
      expect(fs.existsSync(socketPath)).toBe(true);

      // Verify we can connect
      const client = net.createConnection(socketPath);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          client.end();
          resolve();
        });
        client.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });

    it('should simulate send_rpc_request("ping")', async () => {
      const response = await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'ping',
        id: 1,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);

      if ('result' in response) {
        expect(response.result).toBe('pong');
      } else {
        throw new Error(`Expected result, got error: ${JSON.stringify(response.error)}`);
      }
    });

    it('should simulate send_rpc_request("getStatus")', async () => {
      const response = await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'getStatus',
        id: 2,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);

      if ('result' in response) {
        expect(response.result).toMatchObject({
          status: 'ok',
          version: expect.any(String),
          timestamp: expect.any(Number),
        });
      } else {
        throw new Error(`Expected result, got error: ${JSON.stringify(response.error)}`);
      }
    });

    it('should simulate send_rpc_request("workspace.create")', async () => {
      const response = await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'workspace.create',
        params: {
          name: 'test-workspace',
        },
        id: 3,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(3);

      if ('result' in response) {
        expect(response.result).toMatchObject({
          id: expect.any(String),
          name: 'test-workspace',
        });
      } else {
        throw new Error(`Expected result, got error: ${JSON.stringify(response.error)}`);
      }
    });

    it('should simulate send_rpc_request("workspace.list")', async () => {
      // First create a workspace
      await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'workspace.create',
        params: {
          name: 'list-test-workspace',
        },
        id: 100,
      });

      const response = await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'workspace.list',
        id: 4,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(4);

      if ('result' in response) {
        expect(Array.isArray(response.result)).toBe(true);
        expect((response.result as unknown[]).length).toBeGreaterThan(0);
      } else {
        throw new Error(`Expected result, got error: ${JSON.stringify(response.error)}`);
      }
    });

    it('should handle error for method_not_found', async () => {
      const response = await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'nonexistent.method',
        id: 5,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(5);

      if ('error' in response) {
        expect(response.error.code).toBe(-32601); // METHOD_NOT_FOUND
      } else {
        throw new Error('Expected error response');
      }
    });

    it('should handle multiple rapid sequential requests (simulating React hooks)', async () => {
      // Simulate what happens when React mounts multiple components
      // that all call useHealth() or similar hooks
      const requests = Array.from({ length: 5 }, (_, i) =>
        sendRpcRequest({
          jsonrpc: '2.0',
          method: 'ping',
          id: `rapid-${i}`,
        })
      );

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(5);

      for (let i = 0; i < 5; i++) {
        const resp = responses[i];
        expect(resp.id).toBe(`rapid-${i}`);
        if ('result' in resp) {
          expect(resp.result).toBe('pong');
        } else {
          throw new Error(`Request ${i} failed: ${JSON.stringify(resp.error)}`);
        }
      }
    });
  });

  describe('Connection Resilience', () => {
    it('should handle connection close and reconnect (simulating app backgrounding)', async () => {
      // First connection
      const response1 = await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'ping',
        id: 'pre-reconnect',
      });

      expect(response1.id).toBe('pre-reconnect');

      // Wait a moment to simulate app being backgrounded
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reconnect and make another request
      const response2 = await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'ping',
        id: 'post-reconnect',
      });

      expect(response2.id).toBe('post-reconnect');
      if ('result' in response2) {
        expect(response2.result).toBe('pong');
      }
    });

    it('should handle request with large params', async () => {
      // Simulate a large workspace name
      const largeString = 'x'.repeat(10000);

      const response = await sendRpcRequest({
        jsonrpc: '2.0',
        method: 'workspace.create',
        params: {
          name: largeString,
        },
        id: 'large-params',
      });

      expect(response.id).toBe('large-params');

      if ('result' in response) {
        expect((response.result as { name: string }).name).toBe(largeString);
      } else {
        throw new Error(`Expected result, got error: ${JSON.stringify(response.error)}`);
      }
    });
  });

  /**
   * Helper: Wait for socket file to exist
   */
  async function waitForSocket(path: string, timeoutMs: number): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (fs.existsSync(path)) {
        // Socket exists, try to connect
        try {
          await new Promise<void>((resolve, reject) => {
            const client = net.createConnection(path);
            client.on('connect', () => {
              client.end();
              resolve();
            });
            client.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 1000);
          });
          return;
        } catch {
          // Socket exists but not ready, wait and retry
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for socket: ${path}`);
  }

  /**
   * Helper: Send RPC request through a fresh connection (like Tauri does)
   */
  async function sendRpcRequest(
    request: { jsonrpc: '2.0'; method: string; params?: unknown; id: string | number }
  ): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(socketPath);
      let buffer = '';

      client.on('connect', () => {
        const message = JSON.stringify(request);
        client.write(message + '\n');
      });

      client.on('data', (data) => {
        buffer += data.toString();

        const lines = buffer.split('\n');
        if (lines.length > 1) {
          try {
            const response = JSON.parse(lines[0]) as JsonRpcResponse;
            client.end();
            resolve(response);
          } catch (err) {
            client.end();
            reject(err);
          }
        }
      });

      client.on('error', (err) => {
        reject(err);
      });

      // Timeout
      setTimeout(() => {
        client.destroy();
        reject(new Error('Request timeout'));
      }, 10000);
    });
  }
});
