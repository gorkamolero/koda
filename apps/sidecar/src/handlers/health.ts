import { z } from 'zod';

/**
 * Health check response schema
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.number(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Ping handler - no params
 */
export async function ping(): Promise<string> {
  return 'pong';
}

/**
 * Get server status
 */
export async function getStatus(): Promise<HealthResponse> {
  return {
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0',
  };
}
