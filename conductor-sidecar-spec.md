# Conductor Sidecar - Complete Technical Specification

The sidecar is a Node.js process that orchestrates AI agents (Claude, Codex) and provides the bridge between the Tauri frontend and CLI tools.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TAURI FRONTEND                           │
│                    (React in WebView)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Unix Socket (JSON-RPC 2.0)
                              │ /tmp/conductor-sidecar-{pid}.sock
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     UNIFIED SIDECAR                              │
│                    (index.bundled.js)                           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ FrontendAPI  │  │  RPC Tunnel  │  │  Session Management  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │   Claude Handler     │  │      Codex Handler           │    │
│  │   (Claude SDK)       │  │      (Codex CLI)             │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Conductor MCP Server                         │  │
│  │   (Custom tools: AskUserQuestion, GetDiff, etc.)         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ stdio (stream-json)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLAUDE CLI                                  │
│              (bundled binary, ~182MB)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Source Structure

```
src/
├── index.ts              # Main entry point, UnifiedSidecar class
├── FrontendAPI.ts        # Typed API for frontend communication
├── FrontendRpcTunnel.ts  # JSON-RPC 2.0 transport over socket
├── shellEnv.ts           # Shell environment loading
├── checkpoint.ts         # Git checkpoint creation
├── claude/
│   ├── claudeHandler.ts      # Claude SDK integration
│   └── conductorMCPServer.ts # Custom MCP tools
└── codex/
    └── codexHandler.ts       # Codex CLI integration
```

---

## Communication Protocol

### Transport
- **Socket:** Unix domain socket at `/tmp/conductor-sidecar-{pid}.sock`
- **Protocol:** JSON-RPC 2.0 over newline-delimited JSON
- **Direction:** Bidirectional (frontend ↔ sidecar)

### Message Flow

```
Frontend                          Sidecar                         Claude CLI
   │                                 │                                │
   │──── query (notification) ──────>│                                │
   │                                 │──── spawn/stdin ──────────────>│
   │                                 │                                │
   │                                 │<───── stream-json events ──────│
   │<──── message (notification) ────│                                │
   │<──── message (notification) ────│                                │
   │                                 │                                │
   │                                 │<───── MCP tool call ───────────│
   │<──── askUserQuestion (request) ─│                                │
   │───── response ─────────────────>│                                │
   │                                 │────── tool result ────────────>│
   │                                 │                                │
```

---

## API Reference

### Frontend → Sidecar Methods

#### `query` (notification)
Start a new AI query/conversation turn.

```typescript
interface QueryRequest {
  type: "query";
  id: string;                    // Session ID
  agentType: "claude" | "codex";
  prompt: string;
  options: {
    cwd: string;                 // Working directory
    model?: string;              // opus|sonnet|haiku
    maxThinkingTokens?: number;
    maxTurns?: number;
    permissionMode?: string;     // default|plan|...
    turnId?: string;             // For checkpoint tracking
    shouldResetGenerator?: boolean;
    claudeEnvVars?: string;      // KEY=value pairs
    ghToken?: string;
    conductorEnv?: Record<string, string>;
    additionalDirectories?: string[];
    chromeEnabled?: boolean;
    strictDataPrivacy?: boolean;
  };
}
```

#### `cancel` (method)
Cancel a running query.

```typescript
interface CancelRequest {
  type: "cancel";
  id: string;                    // Session ID
  agentType: "claude" | "codex";
}
```

#### `claudeAuth` (method)
Authenticate Claude CLI in workspace.

```typescript
interface ClaudeAuthRequest {
  type: "claude_auth";
  id: string;
  agentType: "claude";
  options: { cwd: string };
}
// Returns: { success: boolean; error?: string }
```

#### `workspaceInit` (method)
Initialize workspace with Claude context.

```typescript
interface WorkspaceInitRequest {
  type: "workspace_init";
  id: string;
  agentType: "claude";
  options: {
    cwd: string;
    ghToken?: string;
    claudeEnvVars?: string;
  };
}
// Returns: { summary: string } | { error: string }
```

#### `contextUsage` (method)
Get context window usage for session.

```typescript
interface ContextUsageRequest {
  type: "context_usage";
  id: string;
  agentType: "claude";
  options: {
    cwd: string;
    claudeSessionId: string;     // Claude CLI session ID
  };
}
// Returns: { contextUsageData: ... }
```

#### `updatePermissionMode` (notification)
Change permission mode mid-session.

```typescript
interface UpdatePermissionModeRequest {
  type: "update_permission_mode";
  id: string;
  agentType: "claude";
  permissionMode: string;
}
```

#### `resetGenerator` (notification)
Force recreation of the session generator.

```typescript
interface ResetGeneratorRequest {
  type: "reset_generator";
  id: string;
  agentType: "claude";
}
```

---

### Sidecar → Frontend Notifications

#### `message`
Streaming message content from agent.

```typescript
interface MessageNotification {
  type: "assistant" | "user" | "system" | "result";
  session_id: string;
  // ... message content varies by type
}
```

#### `queryError`
Error during query processing.

```typescript
interface QueryErrorNotification {
  sessionId: string;
  error: string;
  errorCode?: string;
  instructions?: string;  // For auth errors
}
```

#### `enterPlanModeNotification`
Agent entering plan mode.

```typescript
interface EnterPlanModeNotification {
  sessionId: string;
}
```

---

### Sidecar → Frontend RPC Methods

#### `exitPlanMode`
Request user approval to exit plan mode.

```typescript
interface ExitPlanModeRequest {
  sessionId: string;
  toolInput: any;  // Plan details
}
interface ExitPlanModeResponse {
  approved: boolean;
  turnId?: string;  // New turn ID if approved
}
```

#### `askUserQuestion`
Interactive Q&A from agent to user.

```typescript
interface AskUserQuestionRequest {
  sessionId: string;
  questions: Array<{
    question: string;
    options: string[];      // Max 4, "Other" auto-added
    multiSelect?: boolean;
  }>;  // Max 4 questions
}
interface AskUserQuestionResponse {
  answers: Array<string | string[]>;  // Or ["USER_CANCELLED"]
}
```

#### `getDiff`
Get workspace diff (merge-base comparison).

```typescript
interface GetDiffRequest {
  sessionId: string;
  file?: string;    // Specific file path
  stat?: boolean;   // Return --stat style output
}
interface GetDiffResponse {
  diff?: string;
  error?: string;
}
```

#### `diffComment`
Post code review comments.

```typescript
interface DiffCommentRequest {
  sessionId: string;
  comments: Array<{
    file: string;
    lineNumber: number;
    body: string;
  }>;
}
interface DiffCommentResponse {
  success: boolean;
}
```

#### `getTerminalOutput`
Get terminal/process output.

```typescript
interface GetTerminalOutputRequest {
  sessionId: string;
  source?: "spotlight" | "run_script" | "terminal" | "auto";
  maxLines?: number;  // Default 1000
}
interface GetTerminalOutputResponse {
  output?: string;
  source: "spotlight" | "run_script" | "terminal" | "none";
  isRunning: boolean;
  error?: string;
}
```

---

## Session Management

### Session State

```typescript
interface ActiveSession {
  generator?: AsyncGenerator;
  sendMesssage?: (message: string) => void;
  sendTerminate?: () => void;
  currentSettings?: {
    claudeEnvVars?: string;
    additionalDirectories?: string[];
    chromeEnabled?: boolean;
    strictDataPrivacy?: boolean;
  };
  currentModel?: string;
  currentMaxThinkingTokens?: number;
  turnId?: string;
  cwd?: string;
}
```

### Generator Lifecycle

1. **New Session**: Create generator when first query arrives
2. **Reuse**: Subsequent queries reuse generator if settings unchanged
3. **Reset**: Force new generator when:
   - `shouldResetGenerator: true`
   - Settings changed (env vars, directories, etc.)
   - Model changed (updates via SDK callback)
4. **Terminate**: Clean up on cancel or session end

---

## Claude SDK Integration

### SDK Options

```typescript
const sdkOptions = {
  maxTurns: 1000,
  model: mappedModel,
  maxThinkingTokens: number | undefined,
  cwd: workingDirectory,
  pathToClaudeCodeExecutable: "/path/to/claude",
  systemPrompt: DEFAULT_PROMPT,
  settingSources: DEFAULT_SETTING_SOURCES,
  canUseTool: async (toolName, input, options) => {...},
  additionalDirectories: string[],
  env: envForClaude,
  disallowedTools: ["AskUserQuestion"],  // Using custom impl
  stderr: (data) => {...},
  hooks: {
    beforeToolUse: async (toolName, input) => {...},
    afterToolUse: async (toolName, input, output) => {...}
  },
  mcpServers: {
    conductor: conductorMCPServer
  }
};
```

### canUseTool Callback

Controls tool permissions:

1. **ExitPlanMode**: Requires user approval via frontend RPC
2. **Edit/Write tools**: Validates path is within allowed directories
3. **Other tools**: Allow by default

### Hooks

- `beforeToolUse`: Pre-tool logging, checkpoint creation
- `afterToolUse`: Post-tool logging

---

## MCP Server (Custom Tools)

The sidecar registers a custom MCP server providing Conductor-specific tools:

### `AskUserQuestion`
Interactive Q&A with the user.
- Max 4 questions, max 4 options each
- "Other" (free-form) option auto-provided
- Supports multi-select

### `GetWorkspaceDiff`
Returns git diff comparing current branch to merge base.
- Includes uncommitted changes
- Options: `stat` (summary), `file` (specific file)

### `DiffComment`
Posts code review comments on the diff.
- Targets specific file + line number
- Stored in `diff_comments` table

### `GetTerminalOutput`
Reads from active terminals/processes.
- Sources: spotlight, run_script, terminal, auto
- Returns running status + output

---

## Environment Handling

### Shell Environment Loading

```typescript
function getShellEnvironment() {
  const shell = process.env.SHELL || "/bin/zsh";
  const command = `echo -n "${DELIMITER}"; env; echo -n "${DELIMITER}"; exit`;
  const output = execSync(`${shell} -ilc '${command}'`, {
    encoding: "utf8",
    timeout: 5000,
    env: { DISABLE_AUTO_UPDATE: "true" }  // Prevent Oh My Zsh blocking
  });
  return parseEnv(output);
}
```

### Stripped Environment Variables
These are removed to prevent auth interference:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `CLAUDE_CODE_USE_BEDROCK`
- `CLAUDE_CODE_USE_VERTEX`

### Environment Precedence
1. Shell environment (loaded at startup)
2. `process.env` (Node.js)
3. `conductorEnv` (from frontend)
4. `claudeEnvVars` (user-configured, KEY=value format)
5. `ghToken` → `GH_TOKEN`

---

## Checkpointing

Git checkpoints are created at turn boundaries:

```typescript
function createCheckpoint(
  sessionId: string,
  turnId: string,
  checkpointType: "start" | "end",
  cwd: string,
  logPrefix: string
) {
  const checkpointId = `session-${sessionId}-turn-${turnId}-${checkpointType}`;
  execSync(`"${checkpointerPath}" save --id "${checkpointId}" --force`, { cwd });
}
```

- Exit code 101 = merge in progress (skipped, not error)
- Checkpoints stored as git refs: `refs/conductor-checkpoints/{id}`

---

## Error Handling

### Error Types

```typescript
class CodexAuthError extends Error {
  errorCode = "CODEX_AUTH_ERROR";
  instructions: string;  // User-facing help
}
```

### Auth Error Detection
```typescript
function isAuthError(error) {
  const message = error.message.toLowerCase();
  return message.includes("unauthorized") ||
         message.includes("authentication") ||
         message.includes("api key") ||
         message.includes("401");
}
```

### Process Cleanup

On shutdown (SIGINT/SIGTERM):
1. Kill child processes (`pgrep -P {pid}`)
2. Remove socket file
3. Close server

---

## Logging

All logs written to `/tmp/conductor-{pid}.log`:

```typescript
console.log = (...args) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFilePath, `[${timestamp}] ${args.join(" ")}\n`);
};
```

Claude SDK stderr → logged with `[CC-SDK-STDERR]` prefix.

---

## Model Mapping

Models are mapped based on provider environment:

```typescript
function mapModelForProvider(model: string, env: Record<string, string>) {
  // Detects Bedrock, Vertex, etc. from env vars
  // Maps model names accordingly
}
```

---

## Complete Message Types

### From Claude SDK (stream-json)

```typescript
type SDKMessage =
  | { type: "user"; session_id: string; message: UserMessage }
  | { type: "assistant"; session_id: string; message: AssistantMessage }
  | { type: "result"; session_id: string; result: Result }
  | { type: "system"; ... };
```

### User Message
```typescript
interface UserMessage {
  role: "user";
  content: Array<{ type: "text"; text: string }>;
}
```

### Assistant Message
```typescript
interface AssistantMessage {
  role: "assistant";
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: any }
    | { type: "thinking"; thinking: string }
  >;
  stop_reason?: "end_turn" | "tool_use" | "max_tokens";
}
```

---

## Implementation Notes

1. **Single Socket**: One Unix socket per sidecar instance
2. **Generator Reuse**: Maintains conversation context across queries
3. **Tool Interception**: `canUseTool` enables custom permission handling
4. **MCP Integration**: Custom tools via MCP protocol
5. **Checkpoint Persistence**: Git refs survive process restarts
6. **Environment Isolation**: Careful handling of API keys and provider settings
