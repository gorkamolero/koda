import { z } from 'zod';
import type { RpcHandler, RpcRouterMap } from '../types/rpc.js';

/**
 * Type-safe RPC router with Zod validation
 */
export type RpcInterceptor = (method: string, params: unknown) => Promise<{ result: unknown } | undefined>

export class RpcRouter {
  private handlers: RpcRouterMap = {};
  private interceptor: RpcInterceptor | undefined;

  /** Lets shared workspaces answer calls for IDs that live on another machine. */
  setInterceptor(interceptor: RpcInterceptor | undefined): void {
    this.interceptor = interceptor;
  }

  /**
   * Register a method handler with optional schema validation
   */
  register<TInput, TOutput>(
    method: string,
    handler: RpcHandler<TInput, TOutput>,
    schema?: z.ZodType<TInput> | z.ZodType<TInput | undefined>
  ): void {
    if (this.handlers[method]) {
      throw new Error(`Method "${method}" is already registered`);
    }

    const wrappedHandler: RpcHandler<unknown, TOutput> = async (params) => {
      // Validate params if schema provided
      if (schema) {
        const parsed = schema.safeParse(params);
        if (!parsed.success) {
          throw new Error(`Invalid params: ${parsed.error.message}`);
        }
        return handler(parsed.data as TInput);
      }
      return handler(params as TInput);
    };

    this.handlers[method] = wrappedHandler;
  }

  /**
   * Get handler for a method
   */
  get(method: string): RpcHandler | undefined {
    const local = this.handlers[method];
    const interceptor = this.interceptor;
    if (!local || !interceptor) return local;
    return async (params) => {
      const routed = await interceptor(method, params);
      return routed ? routed.result : local(params);
    };
  }

  /** The handler on this machine, never forwarded. */
  getLocal(method: string): RpcHandler | undefined {
    return this.handlers[method];
  }

  /**
   * Check if a method is registered
   */
  has(method: string): boolean {
    return method in this.handlers;
  }

  /**
   * Get all registered method names
   */
  methods(): string[] {
    return Object.keys(this.handlers);
  }
}

/**
 * Global router instance
 */
export const router = new RpcRouter();
