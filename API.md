# Koda API Reference

JSON-RPC 2.0 API exposed by the sidecar over Unix socket.

**Socket path:** `~/.koda/koda.sock` (default) or `/tmp/koda-e2e-test/koda-test.sock` (test mode)

**HTTP endpoint (test mode):** `http://localhost:3848/rpc`

---

## Protocol

All requests follow JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "method": "ping",
  "params": {},
  "id": 1
}
```

Responses:

```json
{
  "jsonrpc": "2.0",
  "result": { "status": "ok" },
  "id": 1
}
```

---

## Methods

### Health

| Method | Params | Description |
|--------|--------|-------------|
| `ping` | none | Health check, returns `{ status: "ok" }` |
| `getStatus` | none | Get sidecar status and config |

---

### Repos

| Method | Params | Description |
|--------|--------|-------------|
| `repo.create` | `{ path, name?, remoteName?, remoteUrl? }` | Register a repository |
| `repo.get` | `{ id }` | Get repo by ID |
| `repo.list` | none | List all repos |
| `repo.delete` | `{ id }` | Delete repo |

---

### Workspaces

Workspaces are containers that hold worktrees and agent sessions.

| Method | Params | Description |
|--------|--------|-------------|
| `workspace.create` | `{ repoId, name?, branch?, baseBranch? }` | Create workspace with new worktree |
| `workspace.createStandalone` | `{ name }` | Create workspace without repo |
| `workspace.get` | `{ id }` | Get workspace by ID |
| `workspace.getWithContents` | `{ id }` | Get workspace with worktrees and sessions |
| `workspace.list` | none | List all workspaces |
| `workspace.update` | `{ id, name?, status? }` | Update workspace |
| `workspace.delete` | `{ id }` | Delete workspace |
| `workspace.getDiff` | `{ workspaceId }` | Get git diff for workspace |

---

### Worktrees

Git worktrees for branch isolation.

| Method | Params | Description |
|--------|--------|-------------|
| `worktree.create` | `{ repoId, branch, baseBranch? }` | Create git worktree |
| `worktree.delete` | `{ id }` | Delete worktree |
| `worktree.get` | `{ id }` | Get worktree by ID |
| `worktree.list` | `{ repoId }` | List worktrees for repo |
| `worktree.listAll` | `{ limit?, offset? }` | List all worktrees |
| `worktree.listByWorkspace` | `{ workspaceId }` | List worktrees in workspace |
| `worktree.addToWorkspace` | `{ worktreeId, workspaceId }` | Add worktree to workspace |
| `worktree.removeFromWorkspace` | `{ worktreeId, workspaceId }` | Remove worktree from workspace |
| `worktree.getDiff` | `{ worktreeId, staged? }` | Get git diff |
| `worktree.enableCollaboration` | `{ worktreeId }` | Enable Liveblocks sync |
| `worktree.disableCollaboration` | `{ worktreeId }` | Disable Liveblocks sync |

---

### Workspace Repos (Multi-Repo)

Attach multiple repos to a single workspace.

| Method | Params | Description |
|--------|--------|-------------|
| `workspaceRepo.attach` | `{ workspaceId, repoId }` | Attach repo to workspace |
| `workspaceRepo.detach` | `{ workspaceId, repoId }` | Detach repo from workspace |
| `workspaceRepo.list` | `{ workspaceId }` | List repos in workspace |

---

### Claude Agent

| Method | Params | Description |
|--------|--------|-------------|
| `claude.start` | `{ workspaceId, prompt, model? }` | Start new Claude session |
| `claude.resume` | `{ sessionId }` | Resume existing session |
| `claude.cancel` | `{ sessionId }` | Cancel running session |
| `claude.getSession` | `{ sessionId }` | Get session details |
| `claude.getSettings` | none | Get Claude settings |
| `claude.getMessages` | `{ sessionId, limit?, offset? }` | Get session messages |
| `claude.continue` | `{ sessionId, prompt }` | Continue conversation |
| `claude.updateSettings` | `{ model?, maxTokens? }` | Update Claude settings |

---

### Codex Agent

| Method | Params | Description |
|--------|--------|-------------|
| `codex.start` | `{ workspaceId, prompt, model? }` | Start new Codex session |
| `codex.resume` | `{ threadId }` | Resume existing thread |
| `codex.cancel` | `{ sessionId }` | Cancel running session |
| `codex.get` | `{ sessionId }` | Get session details |
| `codex.send` | `{ sessionId, message }` | Send message to session |

---

### Agent question forms

These host-local methods are not available through the collaboration relay.

| Method | Params | Description |
|--------|--------|-------------|
| `question.list` | `{ sessionId?: UUID }` | List pending structured questions; poll or listen for `questionChanged { sessionId }` |
| `question.respond` | `{ sessionId: UUID, requestId: UUID, decision: "submit", answers }` | Submit all answers exactly once |
| `question.respond` | `{ sessionId: UUID, requestId: UUID, decision: "cancel" }` | Cancel the form and stop its turn |

Each request includes `id`, `sessionId`, `agentType`, optional `toolUseId`, `createdAt`, `expiresAt`, and `questions`. Each question has `id`, `header`, `question`, `options: [{ label, description? }]`, `multiSelect`, `allowOther`, and optional `isSecret`. Answers use the exact question IDs: `{ "question-id": { "selected": ["Exact option label"], "text": "Optional custom answer" } }`. Custom text requires `allowOther`; single-choice questions accept exactly one selection or custom answer. All questions are required. Draft answers are not persisted; stopped, expired, resolved, or withdrawn requests cannot be answered.

---

### Kimi Agent

| Method | Params | Description |
|--------|--------|-------------|
| `kimi.session.create` | `{ workspaceId, prompt, model? }` | Start new Kimi session |
| `kimi.session.get` | `{ sessionId }` | Get session details |
| `kimi.session.stop` | `{ sessionId }` | Stop running session |
| `kimi.message.send` | `{ sessionId, message }` | Send message to session |

---

### Checkpoints

Git snapshots for time travel.

| Method | Params | Description |
|--------|--------|-------------|
| `checkpoint.save` | `{ worktreeId, turnId?, label? }` | Save checkpoint |
| `checkpoint.restore` | `{ checkpointId }` | Restore to checkpoint |
| `checkpoint.diff` | `{ fromId, toId }` | Diff between checkpoints |
| `checkpoint.get` | `{ id }` | Get checkpoint by ID |
| `checkpoint.list` | `{ worktreeId }` | List checkpoints for worktree |

---

### PTY (Terminals)

Pseudo-terminal management for agent command execution.

| Method | Params | Description |
|--------|--------|-------------|
| `pty.create` | `{ cwd, shell?, cols?, rows? }` | Create terminal session |
| `pty.write` | `{ sessionId, data }` | Write to terminal |
| `pty.resize` | `{ sessionId, cols, rows }` | Resize terminal |
| `pty.close` | `{ sessionId }` | Close terminal |
| `pty.get` | `{ sessionId }` | Get terminal session |
| `pty.list` | none | List active terminals |
| `pty.snapshot` | `{ sessionId }` | Recent output of a terminal (up to 200 KB) |

**Notifications:** PTY data streams via `pty.data` notification.

### Collaboration

| Method | Params | Description |
|--------|--------|-------------|
| `collaboration.status` | none | Whether Liveblocks is configured, plus this machine's ID and name |
| `collaboration.share` | `{ worktreeId, permission: 'view' \| 'control' }` | Create the workspace's invitation; replaces earlier invitations |
| `collaboration.join` | `{ invitation }` | Store an invitation from another machine |
| `collaboration.list` | none | Joined workspaces with permission, workspace name and host name |
| `collaboration.auth` | `{ roomId, name? }` | Liveblocks token for this machine's UI |

On a collaborator's machine, calls about a joined workspace are answered by the host: `worktree.get`, `worktree.getDiff`, `session.list`, `checkpoint.list`, `github.getChecks`, `activity.list`, `activity.unreadCount`, the Codex and Claude `get`, `getMessages` and `models` methods, `fs.readDirectory` and `fs.readFile` inside the worktree, and `pty.list` and `pty.snapshot` for the worktree's terminals. `worktree.get` adds `remote: { roomId, permission, hostName, hostMachineId }`. `codex.send` and `claude.send` travel through the signed relay and need control permission. Every other method for a joined workspace is refused. The host checks each request against the current invitation and keeps it inside the shared worktree. Its `message`, `sessionStatus`, `pty.data` and `pty.exit` notifications are replayed on the collaborator's machine.

---

### Pulse (Visual Diff)

Automated screenshot capture for visual diffs.

| Method | Params | Description |
|--------|--------|-------------|
| `pulse.start` | `{ worktreeId, url, interval? }` | Start capturing screenshots |
| `pulse.stop` | `{ worktreeId }` | Stop capturing |
| `pulse.status` | `{ worktreeId }` | Get pulse status |
| `pulse.listActive` | none | List active pulses |

---

### GitHub

| Method | Params | Description |
|--------|--------|-------------|
| `github.createPr` | `{ worktreeId, title, body?, draft? }` | Create pull request |
| `github.getChecks` | `{ worktreeId }` | Get CI check status |

---

### Filesystem

| Method | Params | Description |
|--------|--------|-------------|
| `fs.readDirectory` | `{ path, recursive? }` | List directory contents |
| `fs.readFile` | `{ path }` | Read file contents |

---

### Activity Feed

Agent activity tracking for workspace overview.

| Method | Params | Description |
|--------|--------|-------------|
| `activity.create` | `{ workspaceId, type, data }` | Create activity entry |
| `activity.list` | `{ workspaceId, limit?, unreadOnly? }` | List activities |
| `activity.markRead` | `{ ids }` | Mark activities as read |
| `activity.unreadCount` | `{ workspaceId }` | Get unread count |
| `activity.getWorkspacesWithStatus` | none | Get all workspaces with activity status |

---

## Notifications

The sidecar emits notifications for real-time events:

| Notification | Data | Description |
|--------------|------|-------------|
| `pty.data` | `{ sessionId, data }` | Terminal output |
| `claude.message` | `{ sessionId, message }` | Claude streaming message |
| `codex.message` | `{ sessionId, message }` | Codex streaming message |
| `kimi.message` | `{ sessionId, message }` | Kimi streaming message |
| `checkpoint.created` | `{ checkpoint }` | Checkpoint saved |
| `pulse.screenshot` | `{ worktreeId, path }` | Screenshot captured |

---

## Example Usage

### Node.js

```typescript
import { createConnection } from 'net';

const socket = createConnection('/Users/you/.koda/koda.sock');

socket.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'workspace.list',
  params: {},
  id: 1
}) + '\n');

socket.on('data', (data) => {
  console.log(JSON.parse(data.toString()));
});
```

### HTTP (Test Mode)

```bash
curl -X POST http://localhost:3848/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","params":{},"id":1}'
```

---

*Generated from sidecar source. 69 methods registered.*
