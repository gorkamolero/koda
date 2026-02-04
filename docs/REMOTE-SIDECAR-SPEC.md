# Koda Remote Sidecar Deployment Spec

**Goal:** Make https://koda-umber.vercel.app fully functional by deploying the sidecar to a remote server.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Static)                              │
│                                                                 │
│    https://koda-umber.vercel.app                               │
│    React Frontend (Monaco, UI, etc.)                           │
│                                                                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS / WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Railway / Fly.io                             │
│                                                                 │
│    https://koda-sidecar.up.railway.app                         │
│    Node.js Sidecar                                              │
│    - HTTP RPC endpoint (/rpc)                                   │
│    - WebSocket for streaming                                    │
│    - SQLite (persistent volume)                                 │
│    - Agent CLI binaries (claude, codex)                         │
│                                                                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External APIs                                │
│                                                                 │
│    Anthropic API (Claude)                                       │
│    OpenAI API (Codex)                                           │
│    GitHub API (repos, auth)                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Sidecar Modifications

#### 1.1 Environment-Aware Configuration

```typescript
// src/config.ts
export const config = {
  // Server mode
  mode: process.env.KODA_MODE || 'local', // 'local' | 'remote'
  
  // HTTP server (always on in remote mode)
  httpPort: parseInt(process.env.KODA_HTTP_PORT || '3847'),
  httpHost: process.env.KODA_HTTP_HOST || '0.0.0.0',
  
  // Unix socket (local mode only)
  socketPath: process.env.KODA_SOCKET_PATH || getDefaultSocketPath(),
  
  // Database
  dbPath: process.env.KODA_DB_PATH || getDefaultDbPath(),
  
  // CORS (remote mode)
  corsOrigins: process.env.KODA_CORS_ORIGINS?.split(',') || [
    'https://koda-umber.vercel.app',
    'http://localhost:1420',
    'http://localhost:5173',
  ],
  
  // Auth (remote mode requires auth)
  authEnabled: process.env.KODA_AUTH_ENABLED === 'true',
  authToken: process.env.KODA_AUTH_TOKEN,
  
  // Agent API keys (passed to CLIs)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
};
```

#### 1.2 Authentication Middleware

```typescript
// src/middleware/auth.ts
import { config } from '../config.js';

export function authMiddleware(req: Request): boolean {
  if (!config.authEnabled) return true;
  
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  return token === config.authToken;
}

// Add to HTTP server
app.use('/rpc', (req, res, next) => {
  if (!authMiddleware(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

#### 1.3 WebSocket Streaming

```typescript
// src/ws.ts
import { WebSocketServer } from 'ws';

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    // Verify auth token from query string
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (config.authEnabled && token !== config.authToken) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    
    // Register for notifications
    notificationBus.subscribe((notification) => {
      ws.send(JSON.stringify(notification));
    });
  });
}
```

#### 1.4 CORS Configuration

```typescript
// src/httpServer.ts
import cors from 'cors';

app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
```

---

### 2. Frontend Modifications

#### 2.1 API Client Configuration

```typescript
// src/lib/api.ts
const SIDECAR_URL = import.meta.env.VITE_SIDECAR_URL || 'http://localhost:3847';
const AUTH_TOKEN = import.meta.env.VITE_SIDECAR_TOKEN || '';

export class KodaClient {
  private baseUrl: string;
  private token: string;
  private ws: WebSocket | null = null;
  
  constructor() {
    this.baseUrl = SIDECAR_URL;
    this.token = AUTH_TOKEN;
  }
  
  async rpc<T>(method: string, params?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      }),
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }
  
  connectWebSocket(onMessage: (msg: unknown) => void) {
    const wsUrl = this.baseUrl.replace('http', 'ws');
    this.ws = new WebSocket(`${wsUrl}/ws?token=${this.token}`);
    this.ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  }
}
```

#### 2.2 Environment Variables

```bash
# apps/desktop/.env.production
VITE_SIDECAR_URL=https://koda-sidecar.up.railway.app
VITE_SIDECAR_TOKEN=<generated-token>
```

---

### 3. Deployment Configuration

#### 3.1 Railway (Recommended)

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 30

[[volumes]]
name = "koda-data"
mountPath = "/data"
```

```bash
# Environment variables on Railway
KODA_MODE=remote
KODA_HTTP_PORT=8080
KODA_DB_PATH=/data/koda.db
KODA_AUTH_ENABLED=true
KODA_AUTH_TOKEN=<generate-secure-token>
KODA_CORS_ORIGINS=https://koda-umber.vercel.app
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>
```

#### 3.2 Dockerfile (Alternative)

```dockerfile
# apps/sidecar/Dockerfile
FROM node:20-slim

# Install git (required for workspace operations)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Data volume
VOLUME /data

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8080/health || exit 1

# Start
CMD ["node", "dist/index.js"]
```

#### 3.3 fly.toml (Fly.io Alternative)

```toml
app = "koda-sidecar"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  KODA_MODE = "remote"
  KODA_HTTP_PORT = "8080"
  KODA_DB_PATH = "/data/koda.db"
  KODA_AUTH_ENABLED = "true"

[mounts]
  source = "koda_data"
  destination = "/data"

[http_service]
  internal_port = 8080
  force_https = true

[[http_service.checks]]
  path = "/health"
  interval = "30s"
  timeout = "5s"
```

---

### 4. Health Endpoint

```typescript
// src/httpServer.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: config.mode,
    uptime: process.uptime(),
    version: pkg.version,
  });
});
```

---

## Security Considerations

### 4.1 Authentication

- **Required in remote mode** — No anonymous access
- **Bearer token auth** — Simple but effective
- **Token rotation** — Generate new tokens periodically

### 4.2 Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

app.use('/rpc', limiter);
```

### 4.3 Input Validation

- All RPC methods already use Zod schemas
- No additional work needed

### 4.4 Workspace Isolation

- Each user should have isolated workspaces
- For MVP: single-user mode (one token = one user)
- Future: proper user accounts with JWT

---

## Implementation Tasks

### Phase 1: Sidecar Remote Mode

- [ ] Add config.ts with environment-aware settings
- [ ] Add auth middleware to HTTP server
- [ ] Add CORS configuration
- [ ] Add health endpoint
- [ ] Add WebSocket server for streaming
- [ ] Test locally with `KODA_MODE=remote`

### Phase 2: Frontend Remote Support

- [ ] Add API client with configurable base URL
- [ ] Add auth token to all requests
- [ ] Add WebSocket connection for streaming
- [ ] Add environment variables for production
- [ ] Test against local remote-mode sidecar

### Phase 3: Deploy

- [ ] Create Railway project
- [ ] Configure environment variables
- [ ] Set up persistent volume for SQLite
- [ ] Deploy sidecar
- [ ] Update Vercel env vars with sidecar URL
- [ ] Redeploy frontend
- [ ] Test full flow

### Phase 4: Agent Binaries (Stretch)

- [ ] Bundle `claude` CLI in Docker image
- [ ] Bundle `codex` CLI in Docker image  
- [ ] Or: Use API directly instead of CLI wrappers

---

## API Endpoints (Final)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/rpc` | Yes | JSON-RPC 2.0 endpoint |
| WS | `/ws` | Yes (query) | WebSocket for streaming |

---

## Environment Variables Summary

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KODA_MODE` | No | `local` | `local` or `remote` |
| `KODA_HTTP_PORT` | No | `3847` | HTTP server port |
| `KODA_HTTP_HOST` | No | `0.0.0.0` | HTTP server host |
| `KODA_DB_PATH` | No | (platform default) | SQLite database path |
| `KODA_AUTH_ENABLED` | No | `false` | Enable auth (required for remote) |
| `KODA_AUTH_TOKEN` | If auth | — | Bearer token for auth |
| `KODA_CORS_ORIGINS` | No | (defaults) | Comma-separated allowed origins |
| `ANTHROPIC_API_KEY` | For Claude | — | Anthropic API key |
| `OPENAI_API_KEY` | For Codex | — | OpenAI API key |

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Sidecar remote mode | 2-3 hours |
| Frontend remote support | 1-2 hours |
| Deploy + test | 1 hour |
| **Total** | **4-6 hours** |

---

## Success Criteria

1. ✅ https://koda-umber.vercel.app loads
2. ✅ User can authenticate with token
3. ✅ User can create/list workspaces
4. ✅ User can start agent sessions
5. ✅ Streaming output appears in real-time
6. ✅ Data persists across deploys (SQLite on volume)
