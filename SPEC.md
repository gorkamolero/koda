# Koda - The Review-First Agent IDE

**Working name**: Koda
**Vision**: The editor of the future - humans review, agents write

---

## Core Philosophy

> "Who's building an IDE for reviewing code instead of writing code? Don't only show me diffs. Show me before/after UIs, terminal output, benchmarks, playgrounds, demos, test results." — Johannes Schickling

Koda is a **review-first IDE** for the agentic era. Traditional IDEs are for writing code. Koda is for **orchestrating agents and reviewing their work**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Koda Desktop App (Tauri)                         │
│  Platform: Tauri 2.x (Rust) - Zed-inspired performance              │
│                                                                      │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │       React Frontend        │  │      Native Rust Layer       │  │
│  │  - Monaco Editor            │  │  - File System (fast)        │  │
│  │  - Diff View + Comments     │  │  - Git Operations            │  │
│  │  - File Browser (Zed-like)  │  │  - Process Spawning          │  │
│  │  - Visual Diff Screenshots  │  │  - Hot Path Performance      │  │
│  │  - Workspace Management     │  │  - IPC to Sidecar            │  │
│  └──────────────┬──────────────┘  └──────────────────────────────┘  │
└─────────────────┼───────────────────────────────────────────────────┘
                  │ Unix Socket (JSON-RPC 2.0)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Orchestration Sidecar (Node.js)                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Agent Handlers                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │   Claude    │  │    Codex    │  │    Kimi     │           │   │
│  │  │  (1st class)│  │  (1st class)│  │  (1st class)│           │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │   │
│  │         │                │                │                   │   │
│  │  ┌──────┴────────────────┴────────────────┴──────┐           │   │
│  │  │           Other CLIs (Terminal Only)          │           │   │
│  │  └───────────────────────────────────────────────┘           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐    │
│  │ Ralph Loop     │  │ OpenProse VM   │  │ Visual Diff Engine │    │
│  │ Orchestration  │  │ .prose runner  │  │ (Playwright)       │    │
│  └────────────────┘  └────────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MVP Features (Phase 1)

### 1. Feature Parity with Conductor/Superset

- **Parallel workspaces** with git worktrees
- **Multi-agent sessions** (Claude, Codex, Kimi Code as first-class citizens)
- **Real-time message streaming** to UI
- **Context window tracking** and visualization
- **Git checkpoint system** (undo agent changes per turn)
- **Session persistence** (SQLite)

### 2. Visual Diffs (Killer Differentiator)

- **Before/after UI screenshots** via Playwright/Puppeteer
- Not just code diffs - actual visual comparison of the running app
- **Terminal output capture** and display
- **Test results visualization**

### 3. Zed-Level Snappiness

- Study [Zed repo patterns](https://github.com/zed-industries/zed)
- **Modular Rust/TS architecture** - start in TS, migrate hot paths to Rust
- No compromise on latency - every interaction must feel instant

### 4. Full IDE Capability

- **File browser + navigation** (Zed-like snappiness)
- **Monaco editor** for viewing/editing any file
- **Diff view with inline commenting** (PR-style)
- Comments become review items for agents to address
- **Option to open in external IDE** (VS Code/Cursor)

### 5. Multi-Git Identity

- Multiple GitHub accounts (personal/work/client)
- Multiple platforms (GitHub/GitLab/Bitbucket)
- Per-workspace credential configuration
- Seamless switching

### 6. Agent Integration

**First-class agents** (native UI abstraction like Conductor):
- Claude Code
- OpenAI Codex
- Kimi Code

Features for first-class agents:
- Full access to user's Claude Code setup (skills, hooks, MCP servers)
- Session management, streaming, context tracking
- Native UI controls

**Other CLIs**: Terminal-only support for any CLI agent

---

## Phase 2 Features (Post-MVP)

### 1. Remote Control / API-First

- Control Koda from anywhere (mobile, Telegram, external agents)
- **Expose API/MCP** so other agents (OpenClaw) can orchestrate
- "Set up at home, control from anywhere"

### 2. Micro-Collaboration (Killer Feature)

**Workspace sharing** - Share any workspace with anyone:
- Not team billing - actual collaboration on agent sessions
- Use cases: Twitter collab, work feature sharing, client reviews

**Fork conversations** - "I'll take it from here":
- Take someone's Claude session, continue with Kimi on YOUR machine
- Git-based, natural forking

**Shared terminals** - Type in collaborator's terminal when both online:
- Real-time pair programming with agents in the mix

### 3. Mobile Companion App

- Full control (same as desktop, responsive web)
- Push notifications when agents finish/need approval

### 4. Skill Auto-Discovery

- Detect feature type being built
- Auto-load relevant skills from online

---

## Spec-Based Programming (Core Feature)

This is how modern AI development works. Built directly into Koda.

### Interview Mode → Spec Generation

When starting a feature workspace, option to enter **interview mode**:
- Agent asks questions to understand requirements
- Answers compiled into a **feature spec** stored with the workspace
- Spec becomes the source of truth for the feature

### Ralph Wiggum Mode (Per-Workspace Toggle)

Based on [Geoffrey Huntley's technique](https://ghuntley.com/loop/):

**The Core Pattern (Fresh Agents):**
1. Fresh agent sees the task list (fix_plan.md)
2. Agent picks the **most important task** to work on
3. Agent completes that ONE task
4. **Handoff** to a fresh agent with remaining tasks
5. Repeat until all tasks done

**Why Fresh Agents:**
- Clean context window each iteration
- No accumulated cruft from previous work
- Agent makes fresh priority decisions
- Prevents context bloat on large projects

**What Carries Over (Handoff Data):**
- Git state (code changes)
- Spec / fix_plan.md (remaining tasks)
- Test results
- NOT conversation history

**Spec Hierarchy:**
```
PROMPT.md (high-level goals)
    ↓
specs/ (detailed requirements per feature)
    ↓
fix_plan.md (actionable tasks - agent picks from here)
```

### OpenProse Integration

- Write `.prose` files for complex multi-agent workflows
- Visual execution flow in UI
- State persistence for long-running programs
- Resume from any checkpoint

### Workspace Types

| Type | Description |
|------|-------------|
| **Standard** | Traditional workspace, one-shot interactions |
| **Spec-driven** | Has attached spec, agents work toward it |
| **Ralph** | Fresh agent loop until spec complete |
| **OpenProse** | Running a .prose program with multiple agents |

---

## Technical Stack

### Core Technologies

| Layer | Technology | Notes |
|-------|------------|-------|
| Shell | Tauri 2.x (Rust) | Study Zed for perf patterns |
| Frontend | React 18+ | Consider Solid if perf issues |
| Sidecar | Node.js (TypeScript) | Agent handlers, RPC server |
| Database | SQLite | Collaboration-ready schema |
| IPC | JSON-RPC 2.0 | Unix sockets |

### Tauri Plugins Required

```rust
// Cargo.toml
tauri = "2.0"
tauri-plugin-fs = "2.0"
tauri-plugin-shell = "2.0"
tauri-plugin-sql = "2.0"
tauri-plugin-http = "2.0"
tauri-plugin-notification = "2.0"
tauri-plugin-updater = "2.0"
tauri-plugin-window-state = "2.0"
tauri-plugin-dialog = "2.0"
tauri-plugin-opener = "2.0"
```

### Agent CLIs to Bundle

| Binary | Purpose | Source |
|--------|---------|--------|
| claude | Claude Code CLI | @anthropic-ai/claude-code |
| codex | OpenAI Codex CLI | @openai/codex |
| kimi | Kimi Code CLI | TBD |
| gh | GitHub CLI | brew/download |

---

## Database Schema

**Location**: `~/Library/Application Support/com.koda.app/koda.db`

```sql
-- Users (for collaboration)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Git Identities (multi-account support)
CREATE TABLE git_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    provider TEXT, -- 'github', 'gitlab', 'bitbucket'
    username TEXT,
    email TEXT,
    token_encrypted TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Repositories
CREATE TABLE repos (
    id TEXT PRIMARY KEY,
    remote_url TEXT,
    name TEXT,
    default_branch TEXT DEFAULT 'main',
    root_path TEXT,
    git_identity_id TEXT REFERENCES git_identities(id),
    setup_script TEXT,
    run_script TEXT,
    custom_prompt TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workspaces (isolated branches/worktrees)
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    repository_id TEXT REFERENCES repos(id),
    owner_user_id TEXT REFERENCES users(id),
    directory_name TEXT,
    branch TEXT,
    workspace_type TEXT DEFAULT 'standard', -- 'standard', 'spec-driven', 'ralph', 'openprose'
    state TEXT DEFAULT 'active', -- 'active', 'archived'
    spec_content TEXT, -- The feature spec (for spec-driven/ralph)
    fix_plan_content TEXT, -- Current task list (for ralph)
    ralph_enabled INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workspace Sharing (collaboration)
CREATE TABLE workspace_shares (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    shared_with_user_id TEXT REFERENCES users(id),
    permission TEXT DEFAULT 'view', -- 'view', 'comment', 'control'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions (conversations with agents)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    agent_type TEXT, -- 'claude', 'codex', 'kimi', 'other'
    model TEXT,
    status TEXT DEFAULT 'idle', -- 'idle', 'running', 'paused'
    context_token_count INTEGER DEFAULT 0,
    forked_from_session_id TEXT REFERENCES sessions(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Session Messages
CREATE TABLE session_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    role TEXT, -- 'user', 'assistant'
    content TEXT,
    full_message_json TEXT,
    turn_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Diff Comments (PR-style review)
CREATE TABLE diff_comments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    user_id TEXT REFERENCES users(id),
    file_path TEXT,
    line_number INTEGER,
    body TEXT,
    resolved INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Visual Snapshots (before/after UI)
CREATE TABLE visual_snapshots (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    session_id TEXT REFERENCES sessions(id),
    turn_id TEXT,
    snapshot_type TEXT, -- 'before', 'after'
    image_path TEXT,
    url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Git Checkpoints
CREATE TABLE git_checkpoints (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    turn_id TEXT,
    head_oid TEXT,
    index_tree TEXT,
    worktree_tree TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## IPC Protocol (JSON-RPC 2.0)

### Frontend → Sidecar Methods

```typescript
const SIDECAR_METHODS = {
  // Agent operations
  QUERY: "query",
  CANCEL: "cancel",

  // Workspace operations
  WORKSPACE_INIT: "workspaceInit",
  CREATE_WORKSPACE: "createWorkspace",
  ARCHIVE_WORKSPACE: "archiveWorkspace",

  // Ralph mode
  START_RALPH_LOOP: "startRalphLoop",
  STOP_RALPH_LOOP: "stopRalphLoop",

  // Visual diff
  CAPTURE_SCREENSHOT: "captureScreenshot",

  // Context
  GET_CONTEXT_USAGE: "getContextUsage",

  // Git
  CREATE_CHECKPOINT: "createCheckpoint",
  RESTORE_CHECKPOINT: "restoreCheckpoint",
};
```

### Sidecar → Frontend Notifications

```typescript
const FRONTEND_NOTIFICATIONS = {
  MESSAGE: "message",           // Streaming message
  QUERY_ERROR: "queryError",    // Error occurred
  RALPH_ITERATION: "ralphIteration", // New Ralph loop iteration
  VISUAL_SNAPSHOT: "visualSnapshot", // Screenshot captured
  AGENT_HANDOFF: "agentHandoff", // Ralph handoff to new agent
};
```

---

## Additional Features

- **Notifications** - Push when agent finishes, needs approval, errors
- **Session recording** - Replay agent sessions for review/learning
- **Editable recordings** - Modify for tutorials/documentation
- **Sounds** - Audio feedback for events
- **Cost tracking** - Show API fees per session/workspace

---

## Out of Scope

- Local model hosting (always use external APIs)
- Billing/SaaS features (for now)
- Built-in code execution sandbox (let agent terminals handle it)

---

## Research Required

1. **Deep-dive Superset repo** (open source) - architecture patterns
2. **Study Conductor's interaction patterns** - interface quality bar and workflow expectations
3. **Study Zed repo** - performance patterns for snappiness
4. **Claude Agent SDK** - proper integration patterns
5. **Collaboration architecture** - WebSocket/CRDT for shared terminals
6. **Ralph implementations** - frankbria/ralph-claude-code, official plugin

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Tauri app scaffold with plugins
- [ ] SQLite database with schema
- [ ] Sidecar process launcher
- [ ] JSON-RPC tunnel
- [ ] Basic React frontend with router

### Phase 2: Agent Integration
- [ ] Claude handler (first-class)
- [ ] Codex handler (first-class)
- [ ] Kimi handler (first-class)
- [ ] Message streaming
- [ ] Session persistence

### Phase 3: Review-First Features
- [ ] Visual diff engine (Playwright screenshots)
- [ ] Diff view with inline comments
- [ ] File browser (Zed-like)
- [ ] Monaco editor integration

### Phase 4: Spec-Based Programming
- [ ] Interview mode UI
- [ ] Spec storage per workspace
- [ ] Ralph loop orchestration
- [ ] OpenProse VM integration
- [ ] Workspace type switching

### Phase 5: Collaboration (Phase 2 features)
- [ ] User accounts
- [ ] Workspace sharing
- [ ] Fork conversations
- [ ] Shared terminals
- [ ] Mobile web app

### Phase 6: Polish
- [ ] Notifications
- [ ] Session recording/playback
- [ ] Sounds
- [ ] Cost tracking
- [ ] Auto-updater
