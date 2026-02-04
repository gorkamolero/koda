# Contributing to Koda

Quick guide to getting set up and contributing.

---

## Prerequisites

- **Node.js 20+** — `node -v`
- **pnpm 9+** — `npm i -g pnpm`
- **Rust toolchain** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Tauri CLI** — `cargo install tauri-cli`
- **macOS** — Primary platform (Windows/Linux support planned)

---

## Setup

```bash
# Clone
git clone https://github.com/gorkamolero/koda.git
cd koda

# Install dependencies
pnpm install

# Run the app
pnpm app
```

---

## Project Structure

```
koda/
├── apps/
│   ├── desktop/          # Tauri + React frontend
│   │   ├── src/          # React components
│   │   ├── src-tauri/    # Rust native layer
│   │   └── package.json
│   └── sidecar/          # Node.js orchestration
│       ├── src/
│       │   ├── handlers/ # Agent handlers
│       │   ├── db/       # Database layer
│       │   └── rpc/      # RPC router
│       ├── tests/
│       └── package.json
├── e2e/                  # Playwright E2E tests
└── package.json          # Workspace root
```

---

## Development Commands

```bash
# Run the full app (desktop + sidecar)
pnpm app

# Run components separately
pnpm desktop        # Tauri shell + React frontend
pnpm sidecar        # Node.js sidecar only

# Build
pnpm build          # Build all packages

# Test
pnpm test           # All tests
pnpm --filter @koda/sidecar test    # Sidecar unit tests
pnpm --filter e2e test              # E2E tests

# Lint
pnpm lint           # Lint all packages
```

---

## Testing

### Unit Tests (Vitest)

```bash
# Run sidecar tests
cd apps/sidecar
pnpm test

# Watch mode
pnpm test -- --watch

# Single file
pnpm vitest run tests/db.test.ts
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
cd e2e
pnpm test

# Run specific test
pnpm playwright test tests/git-changes.spec.ts

# Debug mode (headed browser)
pnpm playwright test --headed

# Generate test report
pnpm playwright show-report
```

---

## Database

SQLite database with Drizzle ORM.

### Migrations

```bash
cd apps/sidecar

# Generate migration after schema change
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (DB browser)
pnpm db:studio
```

### Schema Location

`apps/sidecar/src/db/schema.ts`

---

## Adding an Agent Handler

1. Create handler file in `apps/sidecar/src/handlers/`
2. Implement the agent interface:

```typescript
// handlers/myagent.ts
import { z } from 'zod';

export const StartSchema = z.object({
  workspaceId: z.string().uuid(),
  prompt: z.string(),
  model: z.string().optional(),
});

export async function start(params: z.infer<typeof StartSchema>) {
  // Spawn agent subprocess
  // Stream output via notifications
  // Persist session to DB
}

export async function cancel(params: { sessionId: string }) {
  // Kill subprocess
  // Update session status
}
```

3. Register methods in `apps/sidecar/src/index.ts`:

```typescript
router.register('myagent.start', start, StartSchema);
router.register('myagent.cancel', cancel, CancelSchema);
```

---

## Code Style

- **TypeScript** — Strict mode enabled
- **Formatting** — Prettier (run `pnpm format`)
- **Linting** — ESLint (run `pnpm lint`)
- **Naming** — camelCase for functions, PascalCase for types

---

## Commit Messages

Follow conventional commits:

```
feat: add Kimi agent handler
fix: resolve checkpoint restore race condition
docs: update API reference
test: add E2E tests for collaboration
refactor: extract RPC router to separate module
```

---

## Pull Requests

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes and test
4. Commit with conventional message
5. Push and open PR

### PR Checklist

- [ ] Tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Types check (`pnpm typecheck`)
- [ ] Docs updated if needed
- [ ] Commit messages follow convention

---

## Architecture Decisions

Major decisions are documented in the specs:

- [SPEC.md](./SPEC.md) — Core architecture
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Visual diagrams
- [docs/koda-collaboration.md](./docs/koda-collaboration.md) — Collaboration design

When proposing significant changes, update the relevant spec first.

---

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- For architecture questions, reference the specs

---

*Built with 🪽 by the Koda team*
