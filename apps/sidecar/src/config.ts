/**
 * Koda Sidecar Configuration
 *
 * Environment-aware configuration for local and remote modes.
 * - Local mode: Unix socket, no auth, permissive CORS
 * - Remote mode: HTTP only, auth required, strict CORS
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { getDbPath } from './db/index.js';

export type KodaMode = 'local' | 'remote';

export interface KodaConfig {
  // Server mode
  mode: KodaMode;

  // HTTP server
  httpPort: number;
  httpHost: string;

  // Unix socket (local mode only)
  socketPath: string;

  // Database
  dbPath: string;

  // CORS
  corsOrigins: string[];

  // Authentication
  authEnabled: boolean;
  authToken: string | undefined;

  // API keys for agents
  anthropicApiKey: string | undefined;
  openaiApiKey: string | undefined;

  // Feature flags
  httpServerEnabled: boolean;
  socketServerEnabled: boolean;
}

/**
 * Get the default Unix socket path based on platform
 */
function getDefaultSocketPath(): string {
  if (process.env.KODA_DATA_DIR) {
    fs.mkdirSync(process.env.KODA_DATA_DIR, { recursive: true });
    return path.join(process.env.KODA_DATA_DIR, 'koda.sock');
  }
  const platform = os.platform();

  if (platform === 'darwin') {
    const appSupport = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'com.koda.app'
    );
    fs.mkdirSync(appSupport, { recursive: true });
    return path.join(appSupport, 'koda.sock');
  } else if (platform === 'linux') {
    return `/tmp/koda-${process.getuid?.() ?? 'unknown'}.sock`;
  } else if (platform === 'win32') {
    return '\\\\.\\pipe\\koda';
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Get the default database path
 */
/**
 * Parse CORS origins from environment variable
 */
function parseCorsOrigins(envValue: string | undefined): string[] {
  const defaults = [
    'https://koda-umber.vercel.app',
    'http://localhost:1420',
    'http://localhost:5173',
  ];

  if (!envValue) {
    return defaults;
  }

  return envValue.split(',').map((origin) => origin.trim()).filter(Boolean);
}

/**
 * Build the configuration from environment variables
 */
function buildConfig(): KodaConfig {
  const mode = (process.env.KODA_MODE || 'local') as KodaMode;
  const isRemote = mode === 'remote';

  // In remote mode, auth is required unless explicitly disabled
  const authEnabled =
    process.env.KODA_AUTH_ENABLED === 'true' ||
    (isRemote && process.env.KODA_AUTH_ENABLED !== 'false');

  // Validate auth token in remote mode
  const authToken = process.env.KODA_AUTH_TOKEN;
  if (authEnabled && !authToken) {
    console.warn(
      '[Config] WARNING: Auth is enabled but KODA_AUTH_TOKEN is not set. ' +
        'All requests will be rejected.'
    );
  }

  return {
    mode,

    // HTTP server settings
    httpPort: parseInt(process.env.KODA_HTTP_PORT || '3847', 10),
    httpHost: process.env.KODA_HTTP_HOST || (isRemote ? '0.0.0.0' : 'localhost'),

    // Unix socket (local mode)
    socketPath: process.env.KODA_SOCKET || getDefaultSocketPath(),

    // Database
    dbPath: getDbPath(),

    // CORS
    corsOrigins: parseCorsOrigins(process.env.KODA_CORS_ORIGINS),

    // Auth
    authEnabled,
    authToken,

    // API keys
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,

    // Server feature flags
    // - Local mode: Socket always on, HTTP optional (for dev/testing)
    // - Remote mode: HTTP always on, Socket disabled
    httpServerEnabled: isRemote || !!process.env.KODA_HTTP_PORT,
    socketServerEnabled: !isRemote,
  };
}

/**
 * Global configuration instance
 */
export const config = buildConfig();

/**
 * Log configuration (redacted for security)
 */
export function logConfig(): void {
  console.log('[Config] Koda sidecar configuration:');
  console.log(`  Mode: ${config.mode}`);
  console.log(`  HTTP: ${config.httpServerEnabled ? `${config.httpHost}:${config.httpPort}` : 'disabled'}`);
  console.log(`  Socket: ${config.socketServerEnabled ? config.socketPath : 'disabled'}`);
  console.log(`  Database: ${config.dbPath}`);
  console.log(`  CORS origins: ${config.corsOrigins.join(', ')}`);
  console.log(`  Auth enabled: ${config.authEnabled}`);
  console.log(`  Auth token: ${config.authToken ? '***' : '(not set)'}`);
  console.log(`  Anthropic API key: ${config.anthropicApiKey ? '***' : '(not set)'}`);
  console.log(`  OpenAI API key: ${config.openaiApiKey ? '***' : '(not set)'}`);
}
