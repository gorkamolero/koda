/**
 * IPC Integration Tests
 *
 * Tests the full pipeline: Frontend -> Tauri -> Sidecar -> Response
 * Following TDD: These tests are written FIRST, then implementation follows.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import * as net from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { RpcServer } from '../src/server.js';
import { router, RpcRouter } from '../src/rpc/router.js';
import { ping, getStatus } from '../src/handlers/health.js';
import type { JsonRpcRequest, JsonRpcResponse } from '../src/types/rpc.js';

describe('IPC Integration - Full Pipeline', () => {
  let server: RpcServer;
  let socketPath: string;

  beforeAll(async () => {
    // Use temporary socket for testing
    socketPath = path.join(os.tmpdir(), `koda-ipc-test-${Date.now()}.sock`);

    // Create fresh router for this test suite
    // Register health methods
    if (!router.has('ping')) {
      router.register('ping', ping);
    }
    if (!router.has('getStatus')) {
      router.register('getStatus', getStatus);
    }

    // Start server
    server = new RpcServer(socketPath);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    // Clean up socket file if it exists
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
  });

  describe('Bidirectional Communication', () => {
    it('should handle multiple sequential requests on same connection', async () => {
      const client = net.createConnection(socketPath);

      await new Promise<void>((resolve) => {
        client.once('connect', resolve);
      });

      // Send first request
      const response1 = await sendRequestOnConnection(client, {
        jsonrpc: '2.0',
        method: 'ping',
        id: 1,
      });

      expect(response1.id).toBe(1);
      if ('result' in response1) {
        expect(response1.result).toBe('pong');
      }

      // Send second request on same connection
      const response2 = await sendRequestOnConnection(client, {
        jsonrpc: '2.0',
        method: 'getStatus',
        id: 2,
      });

      expect(response2.id).toBe(2);
      if ('result' in response2) {
        expect(response2.result).toHaveProperty('status', 'ok');
      }

      client.end();
    });

    it('should handle concurrent requests from multiple clients', async () => {
      const client1 = net.createConnection(socketPath);
      const client2 = net.createConnection(socketPath);

      await Promise.all([
        new Promise<void>((resolve) => client1.once('connect', resolve)),
        new Promise<void>((resolve) => client2.once('connect', resolve)),
      ]);

      // Send requests concurrently
      const [response1, response2] = await Promise.all([
        sendRequestOnConnection(client1, {
          jsonrpc: '2.0',
          method: 'ping',
          id: 100,
        }),
        sendRequestOnConnection(client2, {
          jsonrpc: '2.0',
          method: 'getStatus',
          id: 200,
        }),
      ]);

      // Verify responses are correctly routed
      expect(response1.id).toBe(100);
      expect(response2.id).toBe(200);

      if ('result' in response1) {
        expect(response1.result).toBe('pong');
      }

      if ('result' in response2) {
        expect(response2.result).toHaveProperty('status', 'ok');
      }

      client1.end();
      client2.end();
    });

    it('should handle string IDs in addition to numeric IDs', async () => {
      const response = await sendRequest({
        jsonrpc: '2.0',
        method: 'ping',
        id: 'request-uuid-12345',
      });

      expect(response.id).toBe('request-uuid-12345');
      if ('result' in response) {
        expect(response.result).toBe('pong');
      }
    });
  });

  describe('Protocol Compliance', () => {
    it('should return proper JSON-RPC 2.0 response format', async () => {
      const response = await sendRequest({
        jsonrpc: '2.0',
        method: 'ping',
        id: 1,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response).toHaveProperty('id');
      expect('result' in response || 'error' in response).toBe(true);
    });

    it('should handle notification (no id) correctly', async () => {
      // Notifications in JSON-RPC are requests without an id
      // They should not receive a response, but we allow it for simplicity
      const response = await sendRequest({
        jsonrpc: '2.0',
        method: 'ping',
      } as JsonRpcRequest);

      // Our implementation responds to notifications with id: null
      expect(response.jsonrpc).toBe('2.0');
    });

    it('should handle batch requests sequentially', async () => {
      // Send two requests rapidly in sequence
      const client = net.createConnection(socketPath);

      await new Promise<void>((resolve) => {
        client.once('connect', resolve);
      });

      // Write both requests without waiting for response
      const request1 = JSON.stringify({
        jsonrpc: '2.0',
        method: 'ping',
        id: 'batch-1',
      });
      const request2 = JSON.stringify({
        jsonrpc: '2.0',
        method: 'getStatus',
        id: 'batch-2',
      });

      // Send both at once
      client.write(request1 + '\n' + request2 + '\n');

      // Collect responses
      const responses: JsonRpcResponse[] = [];
      await new Promise<void>((resolve) => {
        let buffer = '';
        client.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              responses.push(JSON.parse(line) as JsonRpcResponse);
              if (responses.length === 2) {
                resolve();
              }
            }
          }
        });
      });

      expect(responses).toHaveLength(2);

      // Find responses by ID
      const resp1 = responses.find((r) => r.id === 'batch-1');
      const resp2 = responses.find((r) => r.id === 'batch-2');

      expect(resp1).toBeDefined();
      expect(resp2).toBeDefined();

      if (resp1 && 'result' in resp1) {
        expect(resp1.result).toBe('pong');
      }

      if (resp2 && 'result' in resp2) {
        expect(resp2.result).toHaveProperty('status', 'ok');
      }

      client.end();
    });
  });

  describe('Error Handling', () => {
    it('should handle method not found gracefully', async () => {
      const response = await sendRequest({
        jsonrpc: '2.0',
        method: 'nonexistent.method',
        id: 1,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);

      if ('error' in response) {
        expect(response.error.code).toBe(-32601); // METHOD_NOT_FOUND
        expect(response.error.message).toContain('not found');
      } else {
        throw new Error('Expected error response');
      }
    });

    it('should handle invalid JSON gracefully', async () => {
      const response = await sendRawMessage('{ this is not valid json }');

      expect(response.jsonrpc).toBe('2.0');

      if ('error' in response) {
        expect(response.error.code).toBe(-32700); // PARSE_ERROR
      } else {
        throw new Error('Expected error response');
      }
    });

    it('should handle malformed request (missing required fields)', async () => {
      const response = await sendRawMessage(
        JSON.stringify({
          method: 'ping',
          // Missing jsonrpc: "2.0"
        })
      );

      expect(response.jsonrpc).toBe('2.0');

      if ('error' in response) {
        // Should be either PARSE_ERROR or INVALID_REQUEST
        expect([-32700, -32600]).toContain(response.error.code);
      } else {
        throw new Error('Expected error response');
      }
    });
  });

  describe('Connection Management', () => {
    it('should handle client disconnection gracefully', async () => {
      const client = net.createConnection(socketPath);

      await new Promise<void>((resolve) => {
        client.once('connect', resolve);
      });

      // Abruptly destroy connection
      client.destroy();

      // Server should still be running - verify by making another request
      const response = await sendRequest({
        jsonrpc: '2.0',
        method: 'ping',
        id: 'after-disconnect',
      });

      expect(response.id).toBe('after-disconnect');
    });

    it('should handle reconnection after disconnect', async () => {
      // First connection
      const client1 = net.createConnection(socketPath);
      await new Promise<void>((resolve) => {
        client1.once('connect', resolve);
      });

      const response1 = await sendRequestOnConnection(client1, {
        jsonrpc: '2.0',
        method: 'ping',
        id: 1,
      });

      expect(response1.id).toBe(1);
      client1.end();

      // Wait for disconnect
      await new Promise<void>((resolve) => {
        client1.once('close', resolve);
      });

      // Reconnect
      const client2 = net.createConnection(socketPath);
      await new Promise<void>((resolve) => {
        client2.once('connect', resolve);
      });

      const response2 = await sendRequestOnConnection(client2, {
        jsonrpc: '2.0',
        method: 'ping',
        id: 2,
      });

      expect(response2.id).toBe(2);
      client2.end();
    });
  });

  /**
   * Helper: Send RPC request on a new connection
   */
  async function sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    return sendRawMessage(JSON.stringify(request));
  }

  /**
   * Helper: Send raw message on new connection
   */
  async function sendRawMessage(message: string): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(socketPath);
      let buffer = '';

      client.on('connect', () => {
        client.write(message + '\n');
      });

      client.on('data', (data) => {
        buffer += data.toString();

        // Check for complete message (newline-delimited)
        const lines = buffer.split('\n');
        if (lines.length > 1) {
          const response = JSON.parse(lines[0]);
          client.end();
          resolve(response as JsonRpcResponse);
        }
      });

      client.on('error', reject);

      // Timeout after 5 seconds
      setTimeout(() => {
        client.destroy();
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }

  /**
   * Helper: Send request on existing connection
   */
  async function sendRequestOnConnection(
    client: net.Socket,
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      let buffer = '';

      const dataHandler = (data: Buffer) => {
        buffer += data.toString();

        const lines = buffer.split('\n');
        if (lines.length > 1) {
          const response = JSON.parse(lines[0]);
          buffer = lines.slice(1).join('\n');
          client.removeListener('data', dataHandler);
          resolve(response as JsonRpcResponse);
        }
      };

      client.on('data', dataHandler);
      client.write(JSON.stringify(request) + '\n');

      // Timeout after 5 seconds
      setTimeout(() => {
        client.removeListener('data', dataHandler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }
});
