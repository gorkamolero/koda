# Reproduce Koda's end-to-end proofs

This document covers the macOS desktop launch and real-service Playwright proofs for Codex, Claude, and collaboration with each agent. The proofs use the production React UI and Node sidecar, real git worktrees, the installed Codex app-server, the official Claude Agent SDK, and Liveblocks. Playwright drives Chromium; it does not automate the native macOS WKWebView. Native desktop verification is a separate check below.

## Prerequisites

- macOS with Xcode command-line tools and a Rust toolchain.
- Node.js 24 (see `.nvmrc`) and pnpm 9.15.9. Node 22.12 or later is required.
- An installed, authenticated Codex CLI: run `codex login`, then `codex login status`. Koda uses its official bidirectional app-server protocol for streaming and interactive approvals. See [Codex app-server documentation](https://learn.chatgpt.com/docs/app-server).
- An installed, authenticated Claude CLI for the Claude proofs: run `claude auth login`, then `claude auth status`. Koda runs the official Claude Agent SDK with the installed CLI; authentication remains with Claude.
- A Liveblocks **development** secret key for the collaboration proof. Both development instances use the same Liveblocks project. No public browser key is needed.
- Internet access for dependencies, the selected agent, and Liveblocks.

Codex remains the default. Choose Codex or Claude when starting a new chat, then select its model in the UI. The agent, model, and permission mode are stored with the session. Kimi is not part of the verified flow. The Codex-only proof does not require Claude authentication.

If Claude is installed outside `PATH`, set `KODA_CLAUDE_PATH` to its executable. Models are selected in the UI rather than environment variables. Claude inherits its official CLI settings. Koda explicitly sets each chat's permission mode; normal mode requires the CLI sandbox for ordinary shell commands and forwards real permission requests to the host.

Model catalogs are discovered from each installed CLI, with a one-minute cache. New model releases normally need no Koda code changes: keep the CLI updated and reopen Koda to refresh its catalog. The custom model ID field also accepts models supported by the CLI and your account. An old CLI or missing account entitlement can still prevent a model from working.

### Tool approvals and bypass

**Settings → Agent → New conversation permissions** controls the initial mode for both agents. This setup defaults to **Bypass permissions**, as requested; **Ask when needed** is also available. The preference persists in the local UI profile. Each new chat can override it, while existing chats retain their saved mode. Requests needing a decision show their tool, command or path, reason, and input details in the host chat. **Approve once** permits that request; **Deny** rejects it. The host can stop a waiting turn. Pending requests survive a UI reload while the sidecar stays running; cancellation, a sidecar shutdown, or a ten-minute expiry clears them with denial.

The host can change permissions while the chat is idle. Its mode remains visible in the toolbar and applies to subsequent collaborator requests too. Changing a chat's mode does not change the Settings preference. Guests cannot answer requests or change the host's mode through the collaboration relay.

The adjacent recommendation links to [Destructive Command Guard](https://github.com/Dicklesworthstone/destructive_command_guard), which intercepts known destructive shell and git commands through agent hooks. Upstream supports Claude and Codex but documents incomplete interception of Codex shell execution. It is an optional additional guard, not a sandbox or a guarantee against every destructive operation. Koda does not install it or claim it is active; use its setup and verification instructions before relying on it.

Codex normal mode uses `on-request` with a worktree write sandbox and a human reviewer; bypass uses `never` with `danger-full-access`. Claude normal mode uses the official SDK's `default` permissions and native shell sandbox; bypass uses its `bypassPermissions` option and disables that sandbox. These settings use provider-supported modes, without changing global CLI configuration. Koda launches Codex in the selected worktree with its optional `shell_snapshot` and `shell_snapshot_v2` features disabled for that child process. This keeps execution on the native sandbox path tested here; an actual inside write succeeds while an ordinary outside write receives an OS permission denial before an approved retry. Do not remove those launch options without rerunning the approval proofs. [Claude's permission rules](https://code.claude.com/docs/en/agent-sdk/permissions) can still require a decision in bypass mode; Koda displays every callback rather than overriding it. Managed policies and hooks remain authoritative.

Claude's configured permission hooks remain active. Anthropic documents that a `PermissionRequest` hook and the SDK's host callback run concurrently, and the first decision wins. A hook, including one connected to an external reviewer, can therefore resolve a visible request without a Koda button click; Koda clears the cancelled callback. Live Bash and Write diagnostics confirmed that behavior. See [Claude's PermissionRequest lifecycle](https://code.claude.com/docs/en/hooks#permissionrequest).

Codex runs a `PermissionRequest` hook before it asks the client, and waits for it. An approval app's hook (Vibe Island's waits up to two hours) would hold every request where Koda never sees it. For its own Codex chats, Koda therefore lists the hooks with `hooks/list` and switches off the user's unmanaged `PermissionRequest` hooks for that thread only, through the thread's config. Global configuration is unchanged, managed hooks stay authoritative, and every other hook event, including command guards, still runs. This was verified with CLI `0.162.0-alpha.2`.

### Agent question forms

Claude's `AskUserQuestion` and Codex's `item/tool/requestUserInput` show a form in the host chat. Choose one option, choose multiple options when Claude requests it, or enter a custom answer when the question allows it. Text-only questions and Codex secret inputs are supported. No answer is selected automatically, including in bypass mode. Every question must be answered before **Submit answers** resumes the waiting tool. **Cancel and stop**, the toolbar's **Stop**, or a ten-minute expiry ends the turn and clears the form.

Pending forms survive a UI reload while the sidecar runs. Draft answers live only in the mounted form and are discarded on reload or navigation. Requests are bound to the exact session and can be answered once; incomplete, invalid, cross-session, or stale replies are rejected. Sidecar shutdown clears pending requests. Provider withdrawal also clears its request, without cancelling a turn that the provider already resolved elsewhere.

Only the host can see or answer the form. Direct form payloads and submitted answers are not written to Koda's conversation transcript or sent through the collaboration relay. The provider receives the answers and may include them in ordinary assistant replies, which remain shared; its own session storage and hooks still apply. Codex enables `default_mode_request_user_input` for its child process so questions work during normal coding, without switching to plan mode or changing global CLI settings. This was verified with CLI `0.162.0-alpha.2`. Generic MCP elicitation and OAuth/URL forms remain unsupported and stop with an explicit error.

### Claude authentication research (2026-10-08)

[Anthropic's October 7 support update](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) says the Agent SDK, `claude -p`, and third-party app usage can still draw from subscription limits. [Hermes' official experimental provider](https://hermes-agent.nousresearch.com/docs/plugins/claude-subscription-directsdk) uses the installed Claude CLI and leaves authentication with that CLI. Koda uses the official Agent SDK's agent loop and the existing local Claude login; it does not copy login tokens or implement a separate OAuth flow.

The [SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) separately restricts third-party products offering their own claude.ai login or rate limits without approval. This local integration does not establish permission to redistribute subscription access to other customers. Account entitlements and extra-usage settings still apply; a reported API-equivalent cost is not proof of an actual subscription charge.

## Clean clone

These changes are committed locally and are not pushed. To verify an independent clone of this checkout's committed HEAD, configure `.env.local` as described below, commit all source changes, and run:

```sh
pnpm verify:clean
```

This clones the committed source with `git clone --no-local`, installs locked dependencies, builds from source, and runs every real-service proof. It passes credentials through the inherited environment without copying the env file. The installed agent CLIs use their own existing login stores. Reports, screenshots, logs, and a manifest identifying the tested commit are retained under `proof-results/clean-<commit>-<timestamp>/`. A successful run removes its temporary clone; a failed run reports the retained diagnostic path.

To perform the setup and proofs manually from a clean checkout containing these commits:

```sh
pnpm install --frozen-lockfile
pnpm --filter e2e exec playwright install chromium
pnpm build
cp .env.example .env.local
open -a "Zed Preview" .env.local
```

Set `LIVEBLOCKS_SECRET_KEY` in `.env.local` and save it. The file is ignored by git. Do not put the secret in a `VITE_` variable, source code, screenshots, or a commit. `KODA_ENV_FILE` can select another local environment file. Exported environment variables take precedence.

## Phase 1: real Codex proof

```sh
pnpm --filter e2e test:proof:codex
```

The test creates a disposable git repository, adds it through the UI, creates an isolated worktree, sends a real Codex task, observes an assistant message while the turn is still running, and checks the edited and newly created files in the diff panel. It saves a checkpoint, stops and restarts the frontend and sidecar processes, checks the saved workspace/session/checkpoint, and continues the same Codex thread.

The source repository is checked to remain unchanged. Screenshots are captured for each step. The test fails when credentials, the service, streaming, or an assertion fail; it does not replace Codex with a fixture.

## Real Claude proof

```sh
pnpm --filter e2e test:proof:claude
```

This exercises the same repository, worktree, streamed task, diff, and checkpoint flow with Claude selected in the UI. It explicitly selects bypass for the unattended workflow; the separate approval proofs cover normal-mode decisions. After both app processes restart, it checks the saved Claude session, model, and upstream session ID, then continues the conversation. Authentication or service failures fail the proof rather than skipping it or substituting a mocked response.

## Real approval proofs

```sh
pnpm --filter e2e test:proof:approvals
```

For each agent, this selects normal approvals and requests a harmless marker-file write in a task-owned directory outside the worktree and OS temporary directories. It holds the request for ten seconds while checking that the file stays absent, reloads the UI and recovers the same request, approves through the visible button, then verifies the expected output file. Separate requests exercise Deny and Stop and confirm their files remain absent. It selects bypass through the UI, restarts both app processes, confirms the saved mode and upstream conversation, and verifies an outside write finishes without a pending request. New chats must follow the Settings preference independently of the previous chat's mode. The fixture directories and owned processes are removed afterward.

Leave external approval prompts unanswered during these tests: the proof must make its decisions through Koda. Claude hooks remain enabled; Codex chats skip only the user's own permission hooks, as described above. A hook that independently resolves a request will cause the manual-decision assertions to fail; that failure must not be presented as a passing manual approval proof.

## Real question-form proofs

```sh
pnpm --filter e2e test:proof:questions
```

For each agent, this starts a real chat with bypass permissions, requests its built-in question tool, and confirms it waits without selecting or submitting an answer. The proof rejects a wrong-session response and an incomplete answer, reloads the same pending request, and checks Stop remains reachable in a compact window. It submits choices and custom text through the visible form and verifies the agent received them; Claude also receives multiple selections. Further turns exercise **Cancel and stop**, the toolbar's **Stop**, and rejection of stale replies. The test retains screenshots and `question-evidence.json`, removes its disposable app data, and cleans up only its own native agent sessions. Leave external question prompts unanswered so Koda supplies the answers.

## Real Liveblocks proofs

```sh
pnpm --filter e2e test:proof:collaboration
```

Each agent's collaboration test uses two isolated sidecars, databases, identities, frontend ports, and browser contexts. User A grants control and user B joins from B's own sidebar, which keeps B's projects and lists A's workspace under Shared. B gets the normal workspace view of A's session: the streamed conversation with tool calls, A's changes, and a read-only mirror of A's terminal, with presence on both sides. B sends a message to A's actual Codex or Claude session through Liveblocks, and each message shows its author. With both agents, a real permission request appears on both screens and B approves it from their own Koda; the command then runs on A's machine. The tests also check view-only behavior at the UI and the host's authorization boundary, including rejection of a replaced control invitation. The Claude workflow explicitly uses bypass; the approval proofs separately exercise normal mode. Backend regressions verify that a relayed message cannot carry approval or permission-mode fields, and that answers, approvals and stops from a collaborator need control and run once.

Run all proofs together:

```sh
pnpm --filter e2e test:proof
pnpm --filter e2e exec playwright show-report proof-report
```

Screenshots, structured evidence, and logs are written under `e2e/proof-results/`; the HTML report is `e2e/proof-report/`. Both directories are ignored. Failure traces may include invitation credentials, so keep them local. The tests stop their own processes and remove their temporary data directories.

## Record the collaboration on two machines

The recording uses two Macs. This one hosts the workspace and runs Claude; the collaborator Mac runs its own Koda sidecar, frontend and headless Chromium. The collaborator needs this checkout at `~/Developer/koda` with dependencies installed, a `.env.local` with the same Liveblocks development secret, and SSH access by host alias. It does not need Claude; with a signed-in Codex CLI it opens on its own project, otherwise on its home screen.

```sh
pnpm --filter e2e record:two-machine
```

`KODA_COLLABORATOR_SSH` selects the collaborator's SSH alias (default `cyberyogin`); `KODA_HOST_NAME` and `KODA_GUEST_NAME` set the names shown in the session (default `Gorka` and `Alex`). The collaborator's browser keeps its debugging port on localhost; this machine reaches it through an SSH tunnel for the length of the run. The host's Claude session explicitly uses bypass so the filmed turns do not wait on approval cards.

Before filming, the script creates both users' projects, starts a Claude session, shares it with control permission and joins it from the collaborator, so no invitation appears on screen. It then captures both screens while the collaborator opens the shared workspace from their own sidebar, the host asks Claude for a change, and the collaborator asks for a follow-up that arrives under their name. The collaborator uses the KODA Graphite theme so the two screens are easy to tell apart.

Each screen is a 1280×1440 window captured at 1920×2160 and up to 60 fps on its own machine; the collaborator's frames are aligned by the clock offset measured at the start. Side by side they fill a 3840×2160 frame. `A.mp4`, `B.mp4`, the raw frames and `timeline.json` (beat times for editing) are kept under `proof-results/two-machine-video/<timestamp>/`. Repositories, data directories, collaborator processes and the Liveblocks room are removed afterwards. The capture is Chromium rendering the production UI, not native macOS window capture.

## Native macOS launch

```sh
pnpm app
```

This builds the sidecar and launches the Tauri desktop shell and Vite frontend. It does not kill processes occupying a port. The native window communicates with its own sidecar through a Unix socket.

Use `KODA_DATA_DIR` to keep test or development instance data separate from the normal application:

```sh
KODA_DATA_DIR="$PWD/.koda-local/user-a" pnpm app --no-watch
```

For two native windows at once, build the local debug app once:

```sh
pnpm --filter desktop tauri build --debug --bundles app
```

Then run each command in its own terminal, from the repository root:

```sh
KODA_DATA_DIR="$PWD/.koda-local/user-a" KODA_HTTP_PORT=3847 KODA_USER_NAME="User A" pnpm app:built
KODA_DATA_DIR="$PWD/.koda-local/user-b" KODA_HTTP_PORT=3849 KODA_USER_NAME="User B" pnpm app:built
```

Each instance has its own database, worktrees, socket, identity, window state, and macOS webview profile. macOS 14 or newer supports the separate webview profiles. This debug bundle references the checkout's sidecar; it is a local development build, not a standalone signed release.

If startup reports an unsupported legacy database, Koda preserves it and stops before the old destructive migration. Keep that data directory for recovery and use a new `KODA_DATA_DIR`; automatic conversion of populated pre-0005 databases is not implemented.

## Supporting checks

```sh
pnpm --filter @koda/sidecar exec vitest run
pnpm --filter desktop test:run
cargo check --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Development trust boundary

The host owns the session transcript and validates signed relay requests before dispatching the session's agent. Browser participants receive read/presence access rather than permission to rewrite the transcript. Control invitations must be kept private; relay broadcasts do not include the invitation token. View invitations do not authorize commands. Local HTTP RPC and WebSocket subscriptions reject untrusted browser origins using exact configured-origin matches, including simple POST requests that do not require a browser preflight.

This same-machine development setup gives both sidecars a Liveblocks project secret. It is not a production identity service for mutually untrusted machines. Cross-machine deployment and production account/permission management require their own verification.

## Verification record

On 2026-10-07, both real-service proofs passed in the development checkout: the Codex flow including restart and resumed conversation, and the two-instance Liveblocks flow including view enforcement and revoked-control rejection. Each proof saved its screenshot sequence and `evidence.json`.

The current clean-clone result is recorded independently by `pnpm verify:clean` in its generated `manifest.json`: check that `status` is `passed`, all expected proof tests passed, and `sourceHead` identifies the commit being reviewed. The result directory includes the exact commands and logs for each stage. An earlier result is not evidence for later source changes or newly added agents.

Native evidence is separate: `pnpm app` built and launched the macOS shell/sidecar, and two built native windows ran with distinct identities/data directories. The Rust IPC regression confirms that notifications arriving before a `codex.send` response do not break native requests. The screenshot sequences are browser captures, not evidence of native WKWebView automation.
