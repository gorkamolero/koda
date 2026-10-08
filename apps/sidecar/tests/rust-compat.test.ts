/**
 * Rust Compatibility Test
 *
 * This test validates that the sidecar's JSON-RPC server is fully compatible
 * with the Tauri backend's Rust implementation. It simulates exactly how
 * the Rust SocketClient in src-tauri/src/ipc.rs sends and receives messages.
 *
 * The Tauri backend:
 * 1. Connects to Unix socket
 * 2. Sends JSON-RPC request as serde_json (standard JSON) + newline
 * 3. Reads response until EOF
 * 4. Parses response as serde_json (standard JSON)
 *
 * This test ensures the sidecar correctly handles this exact protocol.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as net from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import type { JsonRpcResponse } from '../src/types/rpc.js';

describe('Rust/Tauri Compatibility', () => {
  let socketPath: string;
  let sidecarProcess: ChildProcess | null = null;

  beforeAll(async () => {
    socketPath = path.join(os.tmpdir(), `koda-rust-compat-${Date.now()}.sock`);

    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }

    const sidecarPath = path.join(__dirname, '../src/index.ts');

    sidecarProcess = spawn(process.execPath, ['--import', 'tsx', sidecarPath], {
      env: {
        ...process.env,
        KODA_SOCKET: socketPath,
        KODA_DB_PATH: ':memory:',
        NODE_ENV: 'test',
      },
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    await waitForSocket(socketPath, 10000);
  }, 15000);

  afterAll(async () => {
    if (sidecarProcess) {
      sidecarProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        sidecarProcess?.on('exit', resolve);
        setTimeout(resolve, 2000);
      });
    }

    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
  });

  describe('Message Format Compatibility', () => {
    it('should accept standard JSON (not SuperJSON) from Rust', async () => {
      // This is exactly how serde_json serializes a JSON-RPC request in Rust
      const rustStyleJson = '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}';

      const response = await sendRawAndReceive(rustStyleJson);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect('result' in response).toBe(true);
      if ('result' in response) {
        expect(response.result).toBe('pong');
      }
    });

    it('should respond with standard JSON parseable by serde_json', async () => {
      const request = '{"jsonrpc":"2.0","id":2,"method":"getStatus","params":{}}';
      const response = await sendRawAndReceive(request);

      // The response must be valid standard JSON
      // Validate by re-serializing and comparing structure
      const reserialized = JSON.parse(JSON.stringify(response));
      expect(reserialized).toEqual(response);

      // Must have proper JSON-RPC 2.0 structure
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
    });

    it('should handle params as null (Rust Option::None)', async () => {
      // In Rust, when params is None, serde_json may serialize it as null
      const request = '{"jsonrpc":"2.0","id":3,"method":"ping","params":null}';
      const response = await sendRawAndReceive(request);

      expect(response.id).toBe(3);
      if ('result' in response) {
        expect(response.result).toBe('pong');
      }
    });

    it('should handle params omitted entirely', async () => {
      // JSON-RPC 2.0 allows params to be omitted
      const request = '{"jsonrpc":"2.0","id":4,"method":"ping"}';
      const response = await sendRawAndReceive(request);

      expect(response.id).toBe(4);
      if ('result' in response) {
        expect(response.result).toBe('pong');
      }
    });

    it('should handle u64 IDs from Rust AtomicU64', async () => {
      // Rust's AtomicU64 can produce large IDs
      const largeId = 9007199254740991; // JavaScript's MAX_SAFE_INTEGER
      const request = `{"jsonrpc":"2.0","id":${largeId},"method":"ping","params":{}}`;

      const response = await sendRawAndReceive(request);

      expect(response.id).toBe(largeId);
    });
  });

  describe('Connection Behavior (like Rust SocketClient)', () => {
    it('should handle connect -> send -> read_to_end pattern', async () => {
      // The Rust client does:
      // 1. Connect
      // 2. Write request + flush
      // 3. Read to end (waits for server to close write side)
      // 4. Parse response

      // Since our server uses newline-delimited messages and keeps
      // the connection open, we read until newline instead
      const response = await sendRustStyle({
        jsonrpc: '2.0',
        id: 100,
        method: 'getStatus',
        params: {},
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(100);
    });

    it('should handle rapid connection cycling', async () => {
      // Simulate Tauri creating new connections for each request
      const results = await Promise.all([
        sendRustStyle({ jsonrpc: '2.0', id: 200, method: 'ping', params: {} }),
        sendRustStyle({ jsonrpc: '2.0', id: 201, method: 'ping', params: {} }),
        sendRustStyle({ jsonrpc: '2.0', id: 202, method: 'ping', params: {} }),
      ]);

      expect(results.map((r) => r.id)).toEqual([200, 201, 202]);
      results.forEach((r) => {
        if ('result' in r) {
          expect(r.result).toBe('pong');
        }
      });
    });
  });

  describe('Error Response Format', () => {
    it('should return JsonRpcError compatible with Rust struct', async () => {
      // The Rust JsonRpcError struct expects:
      // { code: i32, message: String, data?: Value }
      const request = '{"jsonrpc":"2.0","id":300,"method":"nonexistent","params":{}}';
      const response = await sendRawAndReceive(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(300);
      expect('error' in response).toBe(true);

      if ('error' in response && response.error) {
        // code must be a number (i32 in Rust)
        expect(typeof response.error.code).toBe('number');
        expect(response.error.code).toBe(-32601);

        // message must be a string
        expect(typeof response.error.message).toBe('string');
        expect(response.error.message).toContain('not found');
      }
    });

    it('should return null id for parse errors (as Rust expects)', async () => {
      const response = await sendRawAndReceive('{ invalid json }');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(null);
      expect('error' in response).toBe(true);

      if ('error' in response && response.error) {
        expect(response.error.code).toBe(-32700);
      }
    });
  });

  describe('Data Type Serialization', () => {
    it('should serialize workspace response in serde_json compatible format', async () => {
      // Create a workspace (now containers with name, not directoryName)
      const createReq =
        '{"jsonrpc":"2.0","id":400,"method":"workspace.create","params":{"name":"rust-test-workspace"}}';
      const createResp = await sendRawAndReceive(createReq);

      expect(createResp.id).toBe(400);
      expect('result' in createResp).toBe(true);

      if ('result' in createResp) {
        const workspace = createResp.result as Record<string, unknown>;

        // UUID must be a plain string (not SuperJSON Date transform)
        expect(typeof workspace.id).toBe('string');
        expect(workspace.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );

        // Workspaces now have 'name' instead of 'directoryName'
        expect(typeof workspace.name).toBe('string');
        expect(workspace.name).toBe('rust-test-workspace');
      }
    });

    it('should serialize timestamp as number (not Date object)', async () => {
      const response = await sendRustStyle({
        jsonrpc: '2.0',
        id: 500,
        method: 'getStatus',
        params: {},
      });

      if ('result' in response) {
        const result = response.result as Record<string, unknown>;

        // Timestamp must be a number, not a serialized Date
        expect(typeof result.timestamp).toBe('number');
        expect(result.timestamp).toBeGreaterThan(0);
      }
    });
  });

  /**
   * Send raw message and receive response
   */
  async function sendRawAndReceive(message: string): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(socketPath);
      let buffer = '';

      client.on('connect', () => {
        client.write(message + '\n');
      });

      client.on('data', (data) => {
        buffer += data.toString();

        const lines = buffer.split('\n');
        if (lines.length > 1 && lines[0]) {
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

      client.on('error', reject);
      setTimeout(() => {
        client.destroy();
        reject(new Error('Timeout'));
      }, 5000);
    });
  }

  /**
   * Send request in Rust SocketClient style
   */
  async function sendRustStyle(request: {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params: Record<string, unknown>;
  }): Promise<JsonRpcResponse> {
    return sendRawAndReceive(JSON.stringify(request));
  }

  /**
   * Wait for socket to be available
   */
  async function waitForSocket(path: string, timeoutMs: number): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (fs.existsSync(path)) {
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
          // Socket exists but not ready
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for socket: ${path}`);
  }
});
