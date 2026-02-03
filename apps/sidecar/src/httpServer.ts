/**
 * HTTP Server for E2E Testing
 *
 * Provides HTTP access to the JSON-RPC API for browser-based E2E tests
 * that can't use Unix sockets (Playwright/Chromium).
 *
 * This is ONLY used for testing - production uses Unix sockets via Tauri.
 */

import * as http from 'node:http'
import { router } from './rpc/router.js'
import { RpcErrorCode, type JsonRpcRequest, type JsonRpcResponse } from './types/rpc.js'

export class HttpRpcServer {
  private server: http.Server | null = null
  private port: number

  constructor(port: number) {
    this.port = port
  }

  async start(maxRetries = 5, retryDelayMs = 1000): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.tryStart()
        return
      } catch (err) {
        const error = err as NodeJS.ErrnoException
        if (error.code === 'EADDRINUSE' && attempt < maxRetries - 1) {
          console.log(`[HttpRpcServer] Port ${this.port} in use, retrying in ${retryDelayMs}ms... (attempt ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, retryDelayMs))
        } else {
          throw err
        }
      }
    }
  }

  private async tryStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Handle CORS for browser requests
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        // Health check endpoint for Playwright webServer URL check
        if (req.method === 'GET' && req.url === '/rpc') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'ok', message: 'HTTP RPC server ready. Use POST for RPC calls.' }))
          return
        }

        if (req.method !== 'POST' || req.url !== '/rpc') {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Not found. Use POST /rpc' }))
          return
        }

        // Collect request body
        let body = ''
        req.on('data', (chunk) => {
          body += chunk.toString()
        })

        req.on('end', async () => {
          const response = await this.handleRequest(body)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(response))
        })
      })

      this.server.on('error', (err) => {
        console.error('[HttpRpcServer] Server error:', err)
        reject(err)
      })

      this.server.listen(this.port, () => {
        console.log(`[HttpRpcServer] HTTP RPC server listening on http://localhost:${this.port}/rpc`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }

      this.server.close(() => {
        this.server = null
        resolve()
      })
    })
  }

  private async handleRequest(body: string): Promise<JsonRpcResponse> {
    let request: JsonRpcRequest

    // Parse JSON
    try {
      request = JSON.parse(body)
    } catch (err) {
      return {
        jsonrpc: '2.0',
        error: {
          code: RpcErrorCode.PARSE_ERROR,
          message: 'Parse error',
          data: err instanceof Error ? err.message : String(err),
        },
        id: null,
      }
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
      }
    }

    // Find handler
    const handler = router.get(request.method)
    if (!handler) {
      return {
        jsonrpc: '2.0',
        error: {
          code: RpcErrorCode.METHOD_NOT_FOUND,
          message: `Method not found: ${request.method}`,
        },
        id: request.id ?? null,
      }
    }

    // Execute handler
    try {
      const result = await handler(request.params)
      return {
        jsonrpc: '2.0',
        result,
        id: request.id ?? null,
      }
    } catch (err) {
      return {
        jsonrpc: '2.0',
        error: {
          code: RpcErrorCode.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : String(err),
          data: err instanceof Error ? err.stack : undefined,
        },
        id: request.id ?? null,
      }
    }
  }
}
