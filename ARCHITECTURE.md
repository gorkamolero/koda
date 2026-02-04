# Koda Architecture

Visual guide to Koda's internals.

---

## System Overview

```
                                    ┌─────────────────────────┐
                                    │     User Interface      │
                                    │   (React + Monaco)      │
                                    └───────────┬─────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    │           Tauri Desktop App (Rust Shell)              │
                    │                           │                           │
                    │  ┌────────────────────────┴────────────────────────┐  │
                    │  │                  IPC Bridge                      │  │
                    │  │    (Tauri commands ↔ JSON-RPC forwarding)       │  │
                    │  └────────────────────────┬────────────────────────┘  │
                    │                           │                           │
                    └───────────────────────────┼───────────────────────────┘
                                                │
                                     Unix Socket (JSON-RPC 2.0)
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    │          Orchestration Sidecar (Node.js)              │
                    │                           │                           │
                    │  ┌────────────────────────┴────────────────────────┐  │
                    │  │                   RPC Router                     │  │
                    │  │              (69 registered methods)             │  │
                    │  └─────┬──────────┬──────────┬──────────┬──────────┘  │
                    │        │          │          │          │             │
                    │  ┌─────┴────┐┌────┴────┐┌────┴────┐┌────┴────┐       │
                    │  │  Agent   ││  Git    ││  PTY    ││  Pulse  │       │
                    │  │ Handlers ││ Manager ││ Manager ││ (VDiff) │       │
                    │  └──────────┘└─────────┘└─────────┘└─────────┘       │
                    │        │          │          │          │             │
                    │  ┌─────┴──────────┴──────────┴──────────┴──────────┐  │
                    │  │                  SQLite Database                 │  │
                    │  │     (workspaces, sessions, checkpoints, etc.)   │  │
                    │  └─────────────────────────────────────────────────┘  │
                    │                                                       │
                    └───────────────────────────────────────────────────────┘
```

---

## Data Flow

### Agent Interaction

```
User types prompt
        │
        ▼
┌───────────────┐     JSON-RPC      ┌───────────────┐
│    Frontend   │ ────────────────► │    Sidecar    │
│  (React UI)   │                   │   (Node.js)   │
└───────────────┘                   └───────┬───────┘
        ▲                                   │
        │                                   ▼
        │                           ┌───────────────┐
        │  Streaming                │ Agent Handler │
        │  notifications            │ (Claude/Codex)│
        │                           └───────┬───────┘
        │                                   │
        │                                   ▼
        │                           ┌───────────────┐
        │                           │   Agent CLI   │
        └─────────────────────────  │  (subprocess) │
          (message, token, done)    └───────────────┘
```

### Workspace Creation

```
workspace.create({ repoId, name, branch })
                    │
                    ▼
            ┌───────────────┐
            │  Create DB    │
            │  workspace    │
            │  record       │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │  Create git   │
            │  worktree     │
            │  (isolated)   │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │  Link         │
            │  worktree to  │
            │  workspace    │
            └───────┬───────┘
                    │
                    ▼
            Return workspace with worktree
```

### Checkpoint Flow

```
Agent makes changes
        │
        ▼
checkpoint.save({ worktreeId })
        │
        ▼
┌───────────────────────────────┐
│  Capture git state:           │
│  - HEAD commit                │
│  - Index (staged)             │
│  - Working tree               │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│  Store in git_checkpoints     │
│  table with turn_id           │
└───────────────────────────────┘


checkpoint.restore({ checkpointId })
        │
        ▼
┌───────────────────────────────┐
│  Reset git state:             │
│  - git reset --hard           │
│  - Restore index              │
│  - Restore working tree       │
└───────────────────────────────┘
```

---

## Database Schema

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      users      │     │     repos       │     │   git_identities│
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ email           │     │ remote_url      │     │ user_id (FK)    │
│ name            │     │ name            │     │ provider        │
│ avatar_url      │     │ root_path       │     │ username        │
│ created_at      │     │ git_identity_id │     │ token_encrypted │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   workspaces    │     │   worktrees     │     │workspace_repos  │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ workspace_id    │
│ owner_user_id   │     │ repo_id (FK)    │     │ repo_id         │
│ name            │     │ branch          │     │ created_at      │
│ status          │     │ path            │     └─────────────────┘
│ created_at      │     │ workspace_id    │
└────────┬────────┘     │ created_at      │
         │              └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│    sessions     │     │ git_checkpoints │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ workspace_id    │     │ worktree_id (FK)│
│ worktree_id     │     │ turn_id         │
│ agent_type      │     │ head_oid        │
│ model           │     │ index_tree      │
│ status          │     │ worktree_tree   │
│ forked_from     │     │ created_at      │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│session_messages │
├─────────────────┤
│ id (PK)         │
│ session_id (FK) │
│ role            │
│ content         │
│ turn_id         │
│ created_at      │
└─────────────────┘
```

---

## Agent Handler Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Handler Interface                     │
├─────────────────────────────────────────────────────────────────┤
│  start(workspaceId, prompt, model?) → sessionId                 │
│  resume(sessionId) → void                                        │
│  cancel(sessionId) → void                                        │
│  getSession(sessionId) → SessionDetails                          │
│  send(sessionId, message) → void                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ ClaudeHandler │     │ CodexHandler  │     │  KimiHandler  │
├───────────────┤     ├───────────────┤     ├───────────────┤
│ Uses: claude  │     │ Uses: codex   │     │ Uses: kimi    │
│ CLI binary    │     │ CLI binary    │     │ CLI binary    │
│               │     │               │     │               │
│ Streams via   │     │ Streams via   │     │ Streams via   │
│ stdout/stderr │     │ API polling   │     │ WebSocket     │
└───────────────┘     └───────────────┘     └───────────────┘
```

---

## Collaboration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User A (Machine 1)                        │
│  ┌─────────────┐                              ┌───────────────┐  │
│  │  Koda App   │◄────────────────────────────►│ Agent (local) │  │
│  └──────┬──────┘                              └───────────────┘  │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          │ Liveblocks / WebSocket
          │
┌─────────┼────────────────────────────────────────────────────────┐
│         │                   Sync Layer                           │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Shared State (CRDT)                       │ │
│  │  - Workspace membership                                      │ │
│  │  - Cursor positions                                          │ │
│  │  - Activity feed                                             │ │
│  │  - Agent status                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────┬─────────────────────────────────────────────────────────┘
          │
          │ Liveblocks / WebSocket
          │
┌─────────┼────────────────────────────────────────────────────────┐
│         │                                                        │
│  ┌──────┴──────┐                              ┌───────────────┐  │
│  │  Koda App   │◄────────────────────────────►│ Agent (local) │  │
│  └─────────────┘                              └───────────────┘  │
│                        User B (Machine 2)                        │
└──────────────────────────────────────────────────────────────────┘

Note: Agents run locally on each user's machine.
      Only UI state and metadata sync through the cloud.
      Code changes sync via git (push/pull).
```

---

## Component Boundaries

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| **React Frontend** | UI rendering, user interaction | Tauri IPC |
| **Tauri Shell** | Window management, native APIs | Frontend, Sidecar |
| **Sidecar** | Agent orchestration, business logic | Agents, DB, Git |
| **Agent Handlers** | Agent-specific protocol handling | CLI subprocesses |
| **SQLite DB** | Persistence | Sidecar |
| **Git** | Version control, worktrees | Sidecar, Filesystem |

---

## File Paths

| What | Path |
|------|------|
| App data | `~/Library/Application Support/com.koda.app/` |
| Database | `~/Library/Application Support/com.koda.app/koda.db` |
| Socket | `~/.koda/koda.sock` |
| Worktrees | `~/.koda/worktrees/{repo}/{branch}/` |
| Logs | `~/Library/Logs/com.koda.app/` |

---

*See [SPEC.md](./SPEC.md) for complete technical specification.*
