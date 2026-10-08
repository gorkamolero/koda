import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { HttpRpcServer } from '../src/httpServer.js';

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn(async () => ({ accepted: true })) }));
vi.mock('../src/config.js', () => ({ config: {
  mode: 'local', authEnabled: false, corsOrigins: ['http://localhost:1420', 'https://koda-umber.vercel.app'],
} }));
vi.mock('../src/rpc/router.js', () => ({ router: { get: () => dispatch } }));

describe('HTTP browser origin boundary', () => {
  let server: HttpRpcServer;
  let base: string;
  beforeAll(async () => {
    server = new HttpRpcServer(0, '127.0.0.1');
    await server.start();
    const address = (server as unknown as { server: Server }).server.address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
  });
  beforeEach(() => { dispatch.mockClear(); });
  afterAll(async () => { await server.stop(); });

  async function respond(origin?: string) {
    return fetch(`${base}/rpc`, {
      method: 'POST',
      // text/plain is a browser simple request: there need not be a preflight.
      headers: { 'Content-Type': 'text/plain', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'approval.respond', params: { decision: 'allow' } }),
    });
  }

  it.each(['https://untrusted.example', 'https://koda-umber.vercel.app.evil.example', 'http://localhost:14200', 'null'])(
    'blocks RPC execution from %s even without preflight', async origin => {
      const response = await respond(origin);
      expect(response.status).toBe(403);
      expect(response.headers.has('access-control-allow-origin')).toBe(false);
      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  it('accepts only the exact configured browser origin', async () => {
    const response = await respond('http://localhost:1420');
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:1420');
    expect(response.headers.get('vary')).toBe('Origin');
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('continues to allow local non-browser RPC clients', async () => {
    expect((await respond()).status).toBe(200);
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('rejects untrusted preflight requests', async () => {
    const response = await fetch(`${base}/rpc`, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example' } });
    expect(response.status).toBe(403);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('rejects WebSocket subscriptions before sharing notifications with an untrusted origin', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const client = new WebSocket(base.replace('http:', 'ws:') + '/ws', { origin: 'https://koda-umber.vercel.app.evil.example' });
      client.once('open', () => { client.terminate(); reject(new Error('Untrusted WebSocket was accepted')); });
      client.once('unexpected-response', (_request, response) => {
        response.resume();
        resolve(response.statusCode!);
        client.terminate();
      });
      client.on('error', () => { /* Expected after terminating a rejected handshake. */ });
    });
    expect(status).toBe(401);
  });

  it('allows notification subscriptions from the exact trusted origin', async () => {
    const message = await new Promise<string>((resolve, reject) => {
      const client = new WebSocket(base.replace('http:', 'ws:') + '/ws', { origin: 'http://localhost:1420' });
      client.once('error', reject);
      client.once('message', data => { resolve(data.toString()); client.close(); });
    });
    expect(JSON.parse(message).method).toBe('connection.ready');
  });
});
