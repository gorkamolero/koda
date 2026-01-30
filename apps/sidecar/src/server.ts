import * as net from 'node:net';
import * as fs from 'node:fs';
import {
  JsonRpcRequestSchema,
  RpcErrorCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './types/rpc.js';
import { router } from './rpc/router.js';

/**
 * JSON-RPC 2.0 server over Unix domain socket
 */
export class RpcServer {
  private server: net.Server | null = null;
  private socketPath: string;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Remove existing socket file if it exists
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        console.error('Server error:', err);
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        console.log(`RPC server listening on ${this.socketPath}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        // Clean up socket file
        if (fs.existsSync(this.socketPath)) {
          fs.unlinkSync(this.socketPath);
        }

        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Handle incoming socket connection
   */
  private handleConnection(socket: net.Socket): void {
    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Process complete messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete message in buffer

      for (const line of lines) {
        if (line.trim()) {
          const response = await this.handleMessage(line);
          socket.write(JSON.stringify(response) + '\n');
        }
      }
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });

    socket.on('end', () => {
      // Connection closed
    });
  }

  /**
   * Handle a single JSON-RPC message
   */
  private async handleMessage(message: string): Promise<JsonRpcResponse> {
    let request: JsonRpcRequest;

    // Parse JSON
    try {
      const parsed = JSON.parse(message);
      request = JsonRpcRequestSchema.parse(parsed);
    } catch (err) {
      return {
        jsonrpc: '2.0',
        error: {
          code: RpcErrorCode.PARSE_ERROR,
          message: 'Parse error',
          data: err instanceof Error ? err.message : String(err),
        },
        id: null,
      };
    }

    // Validate request
    const validation = JsonRpcRequestSchema.safeParse(request);
    if (!validation.success) {
      return {
        jsonrpc: '2.0',
        error: {
          code: RpcErrorCode.INVALID_REQUEST,
          message: 'Invalid Request',
          data: validation.error.message,
        },
        id: request.id ?? null,
      };
    }

    // Find handler
    const handler = router.get(request.method);
    if (!handler) {
      return {
        jsonrpc: '2.0',
        error: {
          code: RpcErrorCode.METHOD_NOT_FOUND,
          message: `Method not found: ${request.method}`,
        },
        id: request.id ?? null,
      };
    }

    // Execute handler
    try {
      const result = await handler(request.params);
      return {
        jsonrpc: '2.0',
        result,
        id: request.id ?? null,
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        error: {
          code: RpcErrorCode.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : String(err),
          data: err instanceof Error ? err.stack : undefined,
        },
        id: request.id ?? null,
      };
    }
  }
}
