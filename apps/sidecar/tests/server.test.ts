import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as net from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { RpcServer } from '../src/server.js';
import { router } from '../src/rpc/router.js';
import { ping, getStatus } from '../src/handlers/health.js';
import type { JsonRpcRequest, JsonRpcResponse } from '../src/types/rpc.js';

describe('RPC Server', () => {
  let server: RpcServer;
  let socketPath: string;

  beforeAll(async () => {
    // Use temporary socket for testing
    socketPath = path.join(os.tmpdir(), `koda-test-${Date.now()}.sock`);

    // Register test methods
    router.register('ping', ping);
    router.register('getStatus', getStatus);

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

  it('should connect to Unix socket', async () => {
    const client = net.createConnection(socketPath);

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.end();
        resolve();
      });

      client.on('error', reject);
    });
  });

  it('should handle ping method', async () => {
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
      throw new Error(`Expected success response, got error: ${JSON.stringify(response.error)}`);
    }
  });

  it('should handle getStatus method', async () => {
    const response = await sendRpcRequest({
      jsonrpc: '2.0',
      method: 'getStatus',
      id: 2,
    });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(2);
    if ('result' in response) {
      expect(response.result).toHaveProperty('status', 'ok');
      expect(response.result).toHaveProperty('timestamp');
      expect(response.result).toHaveProperty('version');
    } else {
      throw new Error(`Expected success response, got error: ${JSON.stringify(response.error)}`);
    }
  });

  it('should return error for unknown method', async () => {
    const response = await sendRpcRequest({
      jsonrpc: '2.0',
      method: 'unknownMethod',
      id: 3,
    });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(3);
    if ('error' in response) {
      expect(response.error.code).toBe(-32601); // METHOD_NOT_FOUND
    } else {
      throw new Error('Expected error response');
    }
  });

  it('should handle malformed JSON', async () => {
    const response = await sendRawMessage('{ invalid json }');

    expect(response.jsonrpc).toBe('2.0');
    if ('error' in response) {
      expect(response.error.code).toBe(-32700); // PARSE_ERROR
    } else {
      throw new Error('Expected error response');
    }
  });

  /**
   * Helper: Send RPC request and get response
   */
  async function sendRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    return sendRawMessage(JSON.stringify(request));
  }

  /**
   * Helper: Send raw message and get parsed response
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
    });
  }
});
