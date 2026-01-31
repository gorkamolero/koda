# Conductor App - Feature Specification (Extracted via Reverse Engineering)

**Version:** 0.33.3
**Bundle ID:** com.conductor.app
**Signed by:** Developer ID Application: Charlie Holtz (27XN666UJ7)

---

## Architecture

### Stack
- **Framework:** Tauri 2.x (Rust backend + WebView frontend)
- **Language:** Rust (compiled binary, ~36MB)
- **Frontend:** React (embedded in binary, likely Vite-bundled)
- **Sidecar:** Node.js process running `index.bundled.js` (JSON-RPC 2.0 over stdio)
- **Database:** SQLite via `tauri-plugin-sql`
- **AI Integration:** Claude CLI (bundled), Codex CLI (bundled)

### Bundled Binaries
| Binary | Size | Purpose |
|--------|------|---------|
| `claude` | 182MB | Claude Code CLI |
| `codex` | 42MB | OpenAI Codex CLI |
| `gh` | 53MB | GitHub CLI |
| `node` | 111MB | Node.js runtime for sidecar |
| `watchexec` | 7MB | File system watcher |
| `index.bundled.js` | 1.1MB | Sidecar (orchestrates agents) |

### Scripts
- `checkpointer.sh` - Git checkpoint save/restore/diff
- `spotlighter.sh` - Spotlight integration
- `git-busy-check.sh` - Detect merge/rebase in progress

---

## Database Schema

### `repos` - Repository configuration
```sql
id TEXT PRIMARY KEY
remote_url TEXT
name TEXT
default_branch TEXT DEFAULT 'main'
root_path TEXT
setup_script TEXT              -- Run on workspace creation
archive_script TEXT            -- Run on workspace archive
run_script TEXT                -- Custom run command
run_script_mode TEXT DEFAULT 'concurrent'
display_order INTEGER DEFAULT 0
storage_version INTEGER DEFAULT 1
remote TEXT
conductor_config TEXT          -- JSON config
custom_prompt_code_review TEXT
custom_prompt_create_pr TEXT
custom_prompt_rename_branch TEXT
custom_prompt_general TEXT
created_at, updated_at
```

### `workspaces` - Active working contexts
```sql
id TEXT PRIMARY KEY
repository_id TEXT
directory_name TEXT            -- Physical directory name
branch TEXT                    -- Git branch
active_session_id TEXT         -- Currently active session
state TEXT DEFAULT 'active'    -- active|archived
derived_status TEXT DEFAULT 'in-progress'  -- Computed status
manual_status TEXT             -- User-set status override
unread INTEGER DEFAULT 0
pinned_at TEXT                 -- NULL or timestamp
notes TEXT                     -- User notes
linked_workspace_ids TEXT      -- JSON array of linked workspaces
intended_target_branch TEXT    -- PR target branch
placeholder_branch_name TEXT   -- For pre-creation
initialization_parent_branch TEXT
initialization_log_path TEXT
initialization_files_copied INTEGER
setup_log_path TEXT
big_terminal_mode INTEGER DEFAULT 0
created_at, updated_at
```

### `sessions` - AI chat sessions
```sql
id TEXT PRIMARY KEY
workspace_id TEXT
title TEXT DEFAULT 'Untitled'
status TEXT DEFAULT 'idle'     -- idle|running|compacting
agent_type TEXT                -- claude|codex|unknown
model TEXT                     -- Per-session model override
permission_mode TEXT DEFAULT 'default'
thinking_enabled INTEGER DEFAULT 1
codex_thinking_level TEXT      -- For Codex agent
context_used_percent FLOAT     -- 0.0-1.0 context usage
context_token_count INTEGER DEFAULT 0
claude_session_id TEXT         -- Claude CLI session ID
is_compacting INTEGER DEFAULT 0
freshly_compacted INTEGER DEFAULT 0
is_hidden INTEGER DEFAULT 0
unread_count INTEGER DEFAULT 0
last_user_message_at TEXT
resume_session_at TEXT
created_at, updated_at
```

### `session_messages` - Chat messages
```sql
id TEXT PRIMARY KEY
session_id TEXT
turn_id TEXT                   -- Groups request/response
role TEXT                      -- user|assistant
content TEXT
full_message TEXT              -- Expanded content (for slash commands)
model TEXT                     -- Model used for this message
sent_at TEXT                   -- NULL = queued, set = sent
cancelled_at TEXT              -- NULL = not cancelled
sdk_message_id TEXT            -- From Claude SDK
last_assistant_message_id TEXT
created_at
```

### `attachments` - File attachments
```sql
id TEXT PRIMARY KEY
type TEXT
original_name TEXT
path TEXT
is_loading INTEGER DEFAULT 0
is_draft INTEGER DEFAULT 1
session_id TEXT
session_message_id TEXT
created_at
```

### `diff_comments` - Code review comments
```sql
id TEXT PRIMARY KEY
workspace_id TEXT
file_path TEXT
line_number INTEGER
body TEXT
state TEXT
location TEXT
author TEXT
thread_id TEXT
reply_to_comment_id TEXT
remote_url TEXT
update_memory INTEGER
created_at, updated_at
```

### `settings` - App settings (key-value)
Known keys:
- `default_model` - opus|sonnet|haiku
- `default_codex_thinking_level` - high|medium|low
- `review_codex_thinking_level`
- `branch_prefix_type` - none|github_username|custom
- `delete_branch_on_archive` - true|false
- `default_open_in` - finder|terminal|vscode
- `mono_font` - Font family for code
- `markdown_style` - tufte|github|...
- `spotlight_testing` - Feature flag
- `experimental_workspace_statuses` - Feature flag
- `conductor_api_token` - API auth token
- `last_clone_directory` - Last used clone path
- `onboarding_step` - Onboarding progress
- `first_time_onboarding_step`
- `last_seen_announcement` - Version string

---

## IPC Architecture

### Frontend ↔ Sidecar (JSON-RPC 2.0)

**Sidecar Methods (Frontend → Sidecar):**
```typescript
SIDECAR_METHODS = {
  CANCEL: "cancel",           // Cancel running operation
  CLAUDE_AUTH: "claudeAuth",  // Authenticate Claude
  WORKSPACE_INIT: "workspaceInit",  // Initialize workspace
  CONTEXT_USAGE: "contextUsage"     // Get context stats
}

SIDECAR_NOTIFICATIONS = {
  QUERY: "query",             // Send prompt to agent
  UPDATE_PERMISSION_MODE: "updatePermissionMode",
  RESET_GENERATOR: "resetGenerator"
}
```

**Frontend Methods (Sidecar → Frontend):**
```typescript
FRONTEND_RPC_METHODS = {
  EXIT_PLAN_MODE: "exitPlanMode",
  ASK_USER_QUESTION: "askUserQuestion",
  GET_DIFF: "getDiff",
  DIFF_COMMENT: "diffComment",
  GET_TERMINAL_OUTPUT: "getTerminalOutput"
}

FRONTEND_NOTIFICATIONS = {
  MESSAGE: "message",         // Streaming response
  QUERY_ERROR: "queryError",
  ENTER_PLAN_MODE: "enterPlanModeNotification"
}
```

### Tauri IPC (Frontend ↔ Rust)

**Custom Commands:**
- `ensure_sidecar_started` - Start Node.js sidecar
- `execute_shell_command` - Run shell commands
- `list_file_tree` - Directory listing
- `fuzzy_filter_files` - Fuzzy file search
- `get_file_metadata` - File info
- `rpc_to_sidecar` - Send message to sidecar
- `rpc_from_sidecar` - Receive from sidecar
- `read_text_file` / `write_text_file`
- `open_settings_page`

**Tauri Plugins Used:**
- `tauri-plugin-fs` - File system
- `tauri-plugin-shell` - Shell execution
- `tauri-plugin-sql` - SQLite
- `tauri-plugin-http` - HTTP client
- `tauri-plugin-dialog` - Native dialogs
- `tauri-plugin-notification` - System notifications
- `tauri-plugin-updater` - Auto-updates
- `tauri-plugin-window-state` - Window persistence
- `tauri-plugin-deep-link` - `conductor://` URL scheme
- `tauri-plugin-opener` - Open URLs/files in default app

---

## MCP Tools (Custom)

Conductor exposes custom MCP tools to Claude:

### `AskUserQuestion`
Interactive Q&A with up to 4 questions, each with up to 4 options. Supports multi-select. "Other" option auto-provided.

### `GetWorkspaceDiff`
Returns git diff comparing current branch (including uncommitted) against merge base.
- `stat: true` - Returns `--stat` style output
- `file: 'path'` - Returns unified diff for specific file

### `DiffComment`
Posts code review comments on the workspace diff with file path and line number.

### `GetTerminalOutput`
Retrieves output from running terminal processes in the workspace.

---

## Agent Integration

### Claude Agent
- Uses `@anthropic-ai/claude-agent-sdk` (v0.2.23)
- Spawns bundled `claude` binary
- Streams via `--output-format stream-json`
- Supports: `--max-thinking-tokens`, `--max-turns`, `--max-budget-usd`, `--model`, `--permission-mode`
- Session persistence with `--resume`

### Codex Agent
- Uses bundled `codex` binary
- Requires `CODEX_API_KEY` or `codex login`
- Supports thinking levels: high|medium|low

---

## Features

### Workspace Management
- Create workspaces from repos (city-named directories)
- Branch per workspace
- Workspace states: active, archived
- Derived status: in-progress, etc.
- Pinning workspaces
- Linking related workspaces
- Notes per workspace
- Big terminal mode toggle

### Session Management
- Multiple sessions per workspace
- Session titles
- Model selection per session (opus/sonnet/haiku)
- Permission modes
- Thinking enabled/disabled
- Context usage tracking
- Session compaction (context reduction)
- Message queueing (sent_at NULL until sent)
- Message cancellation

### Git Integration
- Checkpoint system (save/restore/diff repo state)
- Branch creation and management
- Diff viewing (merge-base comparison)
- Code review comments on diffs
- GitHub integration via bundled `gh`

### Code Review
- Diff comments stored in DB
- Thread support
- Author tracking
- Remote URL linking

### Customization
- Custom prompts per repo (code review, PR creation, branch naming, general)
- Setup scripts (run on workspace creation)
- Archive scripts
- Run scripts with concurrent mode
- Branch prefix configuration
- Font and markdown style selection

### UI Features
- Window state persistence
- System tray support
- Deep linking (`conductor://`)
- Notifications
- Dark/light theme
- Spotlight integration (testing)
- Experimental workspace statuses

---

## Environment Variables

**Sidecar:**
- `CONDUCTOR_BIN_DIR` - Path to bundled binaries
- `DEBUG_CLAUDE_AGENT_SDK` - Enable SDK debug logs
- `CLAUDE_CODE_DEBUG_LOGS_DIR`
- `CLAUDE_CONFIG_DIR`
- `CODEX_API_KEY` - OpenAI API key

**Stripped from shell environment:**
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `CLAUDE_CODE_USE_BEDROCK`
- `CLAUDE_CODE_USE_VERTEX`

---

## File Locations

- **App Support:** `~/Library/Application Support/com.conductor.app/`
  - `conductor.db` - SQLite database
  - `.window-state.json` - Window position/size
  - `bin/` - Runtime binaries (symlinked?)

- **Workspaces:** Configurable, default to repo-specific directories

---

## Extracted Assets

Images found in binary (likely icons):
- 416x415 PNG (app icon?)
- 205x203 PNG (secondary icon?)
- WebP image (68KB)
- 16x16 GIF (favicon/status?)

---

## API Endpoints Referenced

- `https://app.conductor.build/*`
- `https://conductor.build/*`
- `https://app.chorus.sh/*`
- `https://api.github.com/*`
- `https://api.linear.app/graphql`
- `https://statuspage.incident.io/*`
- `http://localhost:*/*` (dev mode)
