# Koda Feature Roadmap

Living document for planned features.

> **Status, 2026-10-08:** Real Codex and Claude flows cover interactive approvals, persisted permissions, restart, and two-instance Liveblocks collaboration. New chats select either agent and its discovered models. Settings controls the default agent and permissions; this setup defaults to bypass for new chats. Host-side checks enforce view/control invitations. See `VERIFY.md` for reproduction commands, native-versus-browser verification scope, and the clean-clone evidence manifest for the commit under review.

## Codex and Claude desktop flow

- [x] Add a local repository and create an isolated git worktree through the UI.
- [x] Select Codex or Claude for a new chat, discover models from its installed CLI, and stream real agent messages.
- [x] Keep separate model preferences for each agent and restore the saved session's agent/model.
- [x] Approve once, deny, or stop real tool requests in the host chat; recover pending requests after a UI reload.
- [x] Save each chat's permissions across restarts and configure the default for new conversations in Settings.
- [x] Recommend Destructive Command Guard beside the bypass preference, with its setup link and coverage limits.
- [x] See modified and untracked files with diffs.
- [x] Save a checkpoint without changing the working files or staging index.
- [x] Restart both app processes, restore workspace/session/model, and get a fresh reply in the same upstream Codex or Claude conversation.
- [x] Native macOS build/launch, independent instance profiles, terminal startup, and notification-safe native RPC.
- [x] Automated real-service Playwright proofs with per-step screenshots; `pnpm verify:clean` runs every proof from committed source.

Claude uses the official Agent SDK and the user's installed, authenticated Claude CLI. Codex uses its installed CLI's bidirectional app-server protocol. Both agents surface permission requests in the host chat and support an explicit, per-chat bypass mode; provider restrictions still apply. Model catalogs are discovered at runtime, with a custom model ID option; new model releases normally require no Koda code change. CLI support and account access still apply.

---

## 🦀 Crabwalk Integration

**Status:** Planned  
**Priority:** High  
**Research:** N/A (straightforward port)

### Description
Integrate Crabwalk's real-time agent visualization into Koda. Not just monitoring — full command & control.

### Features
- [ ] Real-time graph visualization (ReactFlow)
- [ ] Subagent hierarchy — parent→child column layout
- [ ] Follow mode — auto-pan to track active nodes
- [ ] ExecNode visualization — live terminal output with status colors
- [ ] Session filtering and search

### Control Layer (beyond Crabwalk)
- [ ] Pause/resume agent mid-stream
- [ ] Inject context or corrections
- [ ] Kill wayward subagents
- [ ] Agent handoff (Claude → Codex → Kimi)
- [ ] Approve/reject tool calls before execution

### Integration Strategy
**Git subtree** — Pull Crabwalk components, can still fetch upstream updates:
```bash
git remote add crabwalk https://github.com/luccast/crabwalk.git
git subtree add --prefix=apps/desktop/src/crabwalk crabwalk master --squash
git subtree pull --prefix=apps/desktop/src/crabwalk crabwalk master --squash
```

### Source
- Crabwalk repo: https://github.com/luccast/crabwalk
- Key files: `src/components/monitor/`, `src/lib/graph-layout.ts`

---

## 🌐 Remote Development (SSH-Native)

**Status:** Researched  
**Priority:** High  
**Research:** remote-development notes and architecture sketches

### Description
SSH into home machine, agents run there, but Koda UI feels native. "Set up at home, control from anywhere."

### Architecture Options
1. **Local Tauri shell → SSH tunnel → Remote sidecar** (recommended)
2. Run everything remote, stream UI (VS Code model)
3. Thin local proxy bridging to remote

### Key Challenges
- Unix socket IPC won't work remote — need TCP/WebSocket alternative
- Authentication and tunnel persistence
- Handling Rust native layer when sidecar is remote

### Implementation Notes
- Study VS Code Remote-SSH architecture
- Consider SSH port forwarding + autossh for persistence
- May need JSON-RPC over TCP instead of Unix socket

---

## 👥 Multi-Host Collaboration

**Status:** Same-machine, two-user Liveblocks proof passes
**Priority:** High  
**Research:** `collaboration architecture notes` (41KB)

### Description
Two developers collaborate on same repo(s). Each has agents on their own machine. Shared UI layer — they can see and interact with each other's agents.

"Agentic collaboration tool with multi-hosting."

### Core Insight
"It's just agents in a computer and a UI layer on top" — the complexity is the sync/collaboration layer.

### Already Built (Schema)
- [x] `users` table — multi-user support
- [x] `workspace_shares` table — share with `view` | `comment` | `control` permissions
- [x] `diff_comments` — PR-style review with threading
- [x] `session_recordings` + `recording_frames` — playback
- [x] Conversation forking via `forked_from_session_id`

### Sync Layer
- [x] Sidecar publishes sessions and streaming transcripts through Liveblocks.
- [x] Both users see presence; a guest can view the host's sessions and messages.
- [x] Share/join controls issue signed view or control invitations.
- [x] Control messages reach the host's real Codex or Claude session and both users see its live reply.
- [x] View access is enforced by the host as well as the UI; replacing an invitation revokes the previous grant.
- [x] Relay broadcasts do not expose invitation tokens, and signed requests cannot be modified or replayed to execute twice.
- [x] Keep permission-mode changes and approval decisions host-local; reject untrusted browser origins before HTTP RPC or notification subscriptions.

### Still Needed
- [x] Two isolated instances (two users), live sessions/messages, presence, and relay proved with real Codex and Claude, each using Liveblocks.
- [x] View/control checks and revoked-control rejection proved at the host's authorization boundary.
- [ ] Cross-machine test (two Macs), after the same-machine proof

The development proof uses a backend `LIVEBLOCKS_SECRET_KEY` in an ignored env file on each sidecar. It is not production authentication for mutually untrusted machines. Playwright captures Chromium windows; native WKWebView automation is not claimed.

### Sync Technology Options
1. **Liveblocks** — Managed real-time sync, presence, shared state
2. **Yjs** — Self-hosted CRDT, good for text/state sync
3. **Automerge** — Alternative CRDT, better for structured data

### Agent-to-Agent Visibility
- Agent A on Machine 1 can see Agent B on Machine 2
- Human on Machine 1 can direct Agent B on Machine 2
- Shared workspace state as the coordination layer

---

## 🧠 Skill Auto-Discovery & Installation

**Status:** Planned  
**Priority:** Medium

### Description
Koda detects what you're building and automatically suggests/installs relevant skills for your agents.

### Features
- [ ] Detect feature type from codebase analysis
- [ ] Query skill registry (clawhub.com or similar)
- [ ] Auto-suggest relevant skills
- [ ] One-click install to workspace
- [ ] `skills.lock` per workspace — reproducible skill sets
- [ ] Skill version pinning

### Detection Triggers
- File extensions (.tsx → react skills, .rs → rust skills)
- Package.json/Cargo.toml dependencies
- Code patterns (API calls, DB queries, etc.)
- Manual workspace tags

### Skill Sources
- https://clawhub.com (community skills)
- Local skill directories
- GitHub repos with skill manifests

---

## 📱 Mobile Companion

**Status:** Planned (Phase 2)  
**Priority:** Medium

### Description
Full control from mobile — same capabilities as desktop, responsive web.

### Features
- [ ] Push notifications when agents finish/need approval
- [ ] View agent sessions and diffs
- [ ] Approve/reject from phone
- [ ] Quick context injection
- [ ] Voice input for instructions

---

## 🔀 Conversation Forking

**Status:** Planned (Phase 2)  
**Priority:** Medium

### Description
"I'll take it from here" — take someone's Claude session, continue with Kimi on YOUR machine.

### Features
- [ ] Fork any conversation to new agent
- [ ] Fork to different machine (collaboration)
- [ ] Git-based, natural forking model
- [ ] Merge conversation branches?

---

## 🎤 Session Recording & Replay

**Status:** Planned (Phase 2)  
**Priority:** Low

### Description
Record agent sessions for review, learning, and documentation.

### Features
- [ ] Full session capture (messages, tool calls, outputs)
- [ ] Playback with timeline scrubbing
- [ ] Editable recordings for tutorials
- [ ] Export to video/GIF

---

## 🌳 Work on Main Branch (Not Just Worktrees)

**Status:** Planned  
**Priority:** Medium

### Description
Currently Koda is worktree-based — every workspace is an isolated branch. Add option to work directly on main/master without creating a worktree.

### Use Cases
- Quick fixes that don't need isolation
- Solo projects where branching is overkill
- "Just let me code" mode

### Features
- [ ] "Work on main" option when creating workspace
- [ ] Skip worktree creation, use repo root directly
- [ ] Warning when multiple sessions target same branch
- [ ] Auto-stash uncommitted changes on session switch?

---

## Notes

*Add new feature ideas below.*

### Ideas Backlog
- [x] Migrate to `@anthropic-ai/claude-agent-sdk` (done: the sidecar uses it)
- [x] Codex through the installed CLI app-server in the sidecar
- Subagent view — visualize spawned subagents, hierarchy, status (ties into Crabwalk integration)
- **Rive-based agent UI** — Tobi-endorsed Tensorlake style. Smooth state machine animations for agent thinking/correcting/executing. Reference: https://x.com/tobi/status/2017795986966335853 

---

*Last updated: 2026-10-08*
