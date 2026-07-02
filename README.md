# Koda

**The Review-First Agent IDE**

> "Who's building an IDE for reviewing code instead of writing code? Don't only show me diffs. Show me before/after UIs, terminal output, benchmarks, playgrounds, demos, test results." — Johannes Schickling

Koda is a desktop IDE for the agentic era. Traditional IDEs are for writing code. Koda is for **orchestrating agents and reviewing their work**.

Koda's first milestone was deliberate: match the interface quality bar Conductor set before diverging. Conductor proved what an agent-orchestration UI should feel like; Koda builds from that bar toward review-first workflows, collaboration, shared workspaces, and richer proof surfaces for agent output.

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust toolchain (for Tauri)
- macOS (Windows/Linux support planned)

### Install

```bash
git clone https://github.com/gorkamolero/koda.git
cd koda
pnpm install
```

### Run

```bash
# Start the desktop app (launches sidecar automatically)
pnpm app

# Or run components separately:
pnpm desktop   # Tauri desktop shell
pnpm sidecar   # Node.js orchestration layer
```

### Test

```bash
pnpm test      # Run all tests
pnpm --filter @koda/sidecar test   # Sidecar unit tests
pnpm --filter e2e test             # E2E tests (Playwright)
```

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                  Koda Desktop (Tauri 2.x)                  │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │   React Frontend    │  │     Native Rust Layer       │  │
│  │  - Monaco Editor    │  │  - File System (fast)       │  │
│  │  - Diff View        │  │  - Git Operations           │  │
│  │  - Workspace UI     │  │  - IPC Bridge               │  │
│  └──────────┬──────────┘  └─────────────────────────────┘  │
└─────────────┼──────────────────────────────────────────────┘
              │ Unix Socket (JSON-RPC 2.0)
              ▼
┌────────────────────────────────────────────────────────────┐
│              Orchestration Sidecar (Node.js)               │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │  Claude Agent  │ │  Codex Agent   │ │   Kimi Agent   │  │
│  └────────────────┘ └────────────────┘ └────────────────┘  │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │   SQLite DB    │ │  PTY Manager   │ │ Git Worktrees  │  │
│  └────────────────┘ └────────────────┘ └────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
koda/
├── apps/
│   ├── desktop/          # Tauri + React frontend
│   │   ├── src/          # React components
│   │   └── src-tauri/    # Rust native layer
│   └── sidecar/          # Node.js orchestration
│       ├── src/
│       │   ├── handlers/ # Agent handlers (Claude, Codex, Kimi)
│       │   ├── db/       # SQLite schema + migrations
│       │   └── rpc/      # JSON-RPC router
│       └── tests/
├── e2e/                  # Playwright E2E tests
├── docs/                 # Extended documentation
├── SPEC.md              # Full architecture spec
├── FEATURES.md          # Feature roadmap
└── API.md               # RPC method reference
```

---

## Core Concepts

### Workspaces

Isolated environments for agent work. Each workspace is a git worktree with its own branch, agent sessions, and state.

### Agent Sessions

Conversations with AI agents (Claude, Codex, Kimi). Sessions persist across restarts and can be forked/shared.

### Checkpoints

Git snapshots at each agent turn. Undo any change instantly — time travel for your codebase.

### Visual Diffs

Not just code diffs — before/after screenshots of your running app. See what changed visually.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [SPEC.md](./SPEC.md) | Full architecture and design spec |
| [FEATURES.md](./FEATURES.md) | Feature roadmap and status |
| [API.md](./API.md) | JSON-RPC method reference |
| [docs/koda-collaboration.md](./docs/koda-collaboration.md) | Collaboration architecture |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Shell | Tauri 2.x (Rust) |
| Frontend | React 18, Vite, TailwindCSS |
| Editor | Monaco |
| Sidecar | Node.js, TypeScript |
| Database | SQLite (better-sqlite3) |
| IPC | JSON-RPC 2.0 over Unix sockets |
| Testing | Vitest, Playwright |

---

## License

MIT

---

Built by [Gorka](https://github.com/gorkamolero).
