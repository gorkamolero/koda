/**
 * HTTP Server for Koda Sidecar
 *
 * Provides HTTP and WebSocket access to the JSON-RPC API.
 * - Local mode: For browser-based E2E tests and development
 * - Remote mode: Primary communication channel with auth and CORS
 */

import * as http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { router } from './rpc/router.js';
import { RpcErrorCode, type JsonRpcRequest, type JsonRpcResponse } from './types/rpc.js';
import { config } from './config.js';
import { getNotificationEmitter } from './rpc/notifications.js';

// Package version for health endpoint
const VERSION = process.env.npm_package_version || '0.1.0';

/**
 * Check if the request origin is allowed
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Allow non-browser requests
  return config.corsOrigins.some((allowed) => {
    if (allowed === '*') return true;
    return origin === allowed || origin.startsWith(allowed);
  });
}

/**
 * Set CORS headers on response
 */
function setCorsHeaders(res: http.ServerResponse, origin: string | undefined): void {
  const allowedOrigin = origin && isOriginAllowed(origin) ? origin : config.corsOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Verify authorization token
 */
function verifyAuth(authHeader: string | undefined): boolean {
  if (!config.authEnabled) return true;
  if (!config.authToken) return false; // No token configured, reject all

  const token = authHeader?.replace(/^Bearer\s+/i, '');
  return token === config.authToken;
}

/**
 * Send JSON response
 */
function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export class HttpRpcServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private port: number;
  private host: string;
  private startTime: number = Date.now();

  constructor(port?: number, host?: string) {
    this.port = port ?? config.httpPort;
    this.host = host ?? config.httpHost;
  }

  async start(maxRetries = 5, retryDelayMs = 1000): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.tryStart();
        return;
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EADDRINUSE' && attempt < maxRetries - 1) {
          console.log(
            `[HttpRpcServer] Port ${this.port} in use, retrying in ${retryDelayMs}ms... ` +
              `(attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        } else {
          throw err;
        }
      }
    }
  }

  private async tryStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err) => {
        console.error('[HttpRpcServer] Server error:', err);
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(
          `[HttpRpcServer] HTTP RPC server listening on http://${this.host}:${this.port}`
        );
        this.startTime = Date.now();
        this.setupWebSocket();
        resolve();
      });
    });
  }

  /**
   * Set up WebSocket server for streaming notifications
   */
  private setupWebSocket(): void {
    if (!this.server) return;

    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      // Verify auth token from query string
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (config.authEnabled && token !== config.authToken) {
        console.log('[WebSocket] Connection rejected: invalid token');
        ws.close(4001, 'Unauthorized');
        return;
      }

      console.log('[WebSocket] Client connected');

      // Subscribe to notifications
      const emitter = getNotificationEmitter();

      // Create a fake socket interface for the emitter
      // We need a mutable state object to track destroyed status
      const socketState = { destroyed: false };
      const fakeSocket = {
        get destroyed() {
          return socketState.destroyed;
        },
        write: (data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.trimEnd());
          }
        },
        on: (event: string, cb: () => void) => {
          if (event === 'close' || event === 'error') {
            ws.on(event, cb);
          }
        },
      } as unknown as import('node:net').Socket;

      emitter.addSocket(fakeSocket);

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        emitter.removeSocket(fakeSocket);
        socketState.destroyed = true;
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] Client error:', err);
        emitter.removeSocket(fakeSocket);
        socketState.destroyed = true;
      });

      // Handle incoming messages (for future bidirectional communication)
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('[WebSocket] Received message type:', typeof message.method === 'string' ? message.method : 'unknown');
          // Future: Handle WebSocket RPC requests
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      });

      // Send initial connection confirmation
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'connection.ready',
          params: { timestamp: Date.now() },
        })
      );
    });

    console.log(`[HttpRpcServer] WebSocket server ready on ws://${this.host}:${this.port}/ws`);
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const origin = req.headers.origin;

    // Set CORS headers on all responses
    setCorsHeaders(res, origin);

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Parse URL
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // Health check endpoint (no auth required)
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        status: 'healthy',
        mode: config.mode,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        version: VERSION,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // RPC endpoint - check auth for non-GET requests
    if (url.pathname === '/rpc') {
      // GET /rpc - Health check for Playwright (no auth)
      if (req.method === 'GET') {
        sendJson(res, 200, {
          status: 'ok',
          message: 'HTTP RPC server ready. Use POST for RPC calls.',
        });
        return;
      }

      // POST /rpc - Require auth in remote mode
      if (req.method === 'POST') {
        if (!verifyAuth(req.headers.authorization)) {
          sendJson(res, 401, {
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Unauthorized: Invalid or missing authentication token',
            },
            id: null,
          });
          return;
        }

        // Collect request body
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          const response = await this.handleRpcRequest(body);
          sendJson(res, 200, response);
        });
        return;
      }
    }

    // Not found
    sendJson(res, 404, { error: 'Not found. Available endpoints: GET /health, POST /rpc' });
  }

  private async handleRpcRequest(body: string): Promise<JsonRpcResponse> {
    let request: JsonRpcRequest;

    // Parse JSON
    try {
      request = JSON.parse(body);
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

    // Validate basic structure
    if (!request.jsonrpc || request.jsonrpc !== '2.0' || !request.method) {
      return {
        jsonrpc: '2.0',
        error: {
          code: RpcErrorCode.INVALID_REQUEST,
          message: 'Invalid Request: must have jsonrpc: "2.0" and method',
        },
        id: request?.id ?? null,
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

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close WebSocket server first
      if (this.wss) {
        for (const client of this.wss.clients) client.terminate();
        this.wss.close(() => {
          console.log('[HttpRpcServer] WebSocket server closed');
        });
        this.wss = null;
      }

      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        console.log('[HttpRpcServer] HTTP server closed');
        this.server = null;
        resolve();
      });
    });
  }
}
