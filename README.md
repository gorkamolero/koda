# Koda

**The Review-First, Collaborative Agent IDE**

[![Koda: Claude running on one Mac, a collaborator on another, in the same agent session](https://gorkamolero.github.io/assets/koda/koda-poster.jpg)](https://gorkamolero.github.io/#koda)

Koda runs Codex or Claude sessions in isolated git worktrees on your Mac. Share a workspace and a teammate opens it from their own Koda. They see the same transcript and tool calls live, and with control they can message the agent too. Their message lands in your session, signed with their name.

[Watch the 35-second recording](https://gorkamolero.github.io/#koda) of one Claude session shared live between two Macs.

---

## Quick Start

### Prerequisites

- Node.js 24 recommended (22.12+ required)
- pnpm 9+
- Rust toolchain (for Tauri)
- macOS (Windows/Linux support planned)
- An installed Codex CLI, signed in with `codex login`
- For Claude: an installed Claude CLI, signed in with `claude auth login`

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

Codex is the default agent. New chats can select Codex or Claude, with a separate model picker for each. Koda uses the installed Codex CLI app-server and the official Claude Agent SDK; saved sessions retain their agent, model, and permissions across restarts. Claude authentication stays with the local Claude CLI. See the dated authentication research in [VERIFY.md](./VERIFY.md).

Choose the default for new conversations in **Settings → Agent → New conversation permissions**. This setup defaults to **Bypass permissions**, with **Ask when needed** also available. Each new chat starts with that preference and can override it; existing chats retain their saved mode. Requests needing permission show **Approve once** and **Deny**. Bypass lets tools run outside the worktree without asking and also applies to collaborators with control. Provider-enforced restrictions still apply.

Settings also recommends [Destructive Command Guard](https://github.com/Dicklesworthstone/destructive_command_guard), an optional hook that blocks known destructive commands. It requires separate installation; its Codex coverage is incomplete and it is not a sandbox.

For collaboration, copy `.env.example` to `.env.local` and set `LIVEBLOCKS_SECRET_KEY` to a Liveblocks development secret. It stays on the sidecar and is ignored by git. Open a worktree's **Share workspace** dialog to create a control or view invitation; the other instance joins through **Shared workspaces**.

See [VERIFY.md](./VERIFY.md) for the real-service proofs, screenshots, separate-instance setup, and clean-clone verification.

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

Conversations with Codex or Claude retain their messages, selected model, and upstream agent session for continuation after restarts. Workspaces can be shared with view or control access. Kimi and cross-agent conversation forks are outside the verified flow.

### Checkpoints

Save a worktree snapshot from the chat and restore it when needed. Saving a checkpoint preserves the working files and staging index.

### Visual Diffs

Not just code diffs — before/after screenshots of your running app. See what changed visually.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [SPEC.md](./SPEC.md) | Full architecture and design spec |
| [FEATURES.md](./FEATURES.md) | Feature roadmap and status |
| [VERIFY.md](./VERIFY.md) | Reproduce the Codex, Claude, and collaboration proofs |
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
