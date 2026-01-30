# Koda Sidecar

Node.js orchestration sidecar for Koda agent management.

## Architecture

- **JSON-RPC 2.0** over Unix domain sockets
- **Type-safe** routing with Zod validation
- **SQLite** database with Drizzle ORM
- **Multi-process** support via socket-based IPC

## Project Structure

```
src/
├── index.ts           # Entry point, socket server initialization
├── server.ts          # JSON-RPC server implementation
├── rpc/
│   └── router.ts      # Type-safe method routing
├── db/
│   ├── index.ts       # Drizzle client
│   ├── schema.ts      # Database schema
│   └── migrations/
│       └── 0001_init.sql
├── handlers/
│   ├── health.ts      # Health check endpoints
│   └── workspace.ts   # Workspace CRUD
└── types/
    └── rpc.ts         # JSON-RPC type definitions
```

## Socket Location

The sidecar binds to a Unix domain socket at:

- **macOS**: `~/Library/Application Support/com.koda.app/koda.sock`
- **Linux**: `/tmp/koda-{uid}.sock`
- **Windows**: `\\.\pipe\koda`

Override with `KODA_SOCKET` environment variable.

## Database Location

SQLite database is stored at:

- **macOS**: `~/Library/Application Support/com.koda.app/koda.db`
- **Linux**: `~/.local/share/koda/koda.db`
- **Windows**: `%APPDATA%\koda\koda.db`

## Available RPC Methods

### Health

- `ping` - Simple ping/pong test
- `getStatus` - Get server status and version

### Workspaces

- `workspace.create` - Create new workspace
- `workspace.get` - Get workspace by ID
- `workspace.list` - List all workspaces

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build
pnpm build
```

## Testing

Tests use Vitest and verify:

- Unix socket connection
- JSON-RPC message parsing
- Method routing
- Error handling

Run tests with `pnpm test` or `pnpm test:watch` for watch mode.
