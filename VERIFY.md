# Reproduce Koda's end-to-end proofs

This document covers the macOS desktop launch and real-service Playwright proofs for Codex, Claude, and collaboration with each agent. The proofs use the production React UI and Node sidecar, real git worktrees, the official agent SDKs, and Liveblocks. Playwright drives Chromium; it does not automate the native macOS WKWebView. Native desktop verification is a separate check below.

## Prerequisites

- macOS with Xcode command-line tools and a Rust toolchain.
- Node.js 24 (see `.nvmrc`) and pnpm 9.15.9. Node 22.12 or later is required.
- An installed, authenticated Codex CLI: run `codex login`, then `codex login status`. Koda uses that CLI through the official Codex TypeScript SDK. See [Codex SDK documentation](https://learn.chatgpt.com/docs/codex-sdk).
- An installed, authenticated Claude CLI for the Claude proofs: run `claude auth login`, then `claude auth status`. Koda runs the official Claude Agent SDK with the installed CLI; authentication remains with Claude.
- A Liveblocks **development** secret key for the collaboration proof. Both development instances use the same Liveblocks project. No public browser key is needed.
- Internet access for dependencies, the selected agent, and Liveblocks.

Codex remains the default. Choose Codex or Claude when starting a new chat, then select its model in the UI. The agent and model are stored with the session. Kimi is not part of the verified flow. The Codex-only proof does not require Claude authentication.

If Claude is installed outside `PATH`, set `KODA_CLAUDE_PATH` to its executable. Models are selected in the UI rather than environment variables. Claude inherits its official CLI settings; Koda allows file changes within the selected worktree and requires the CLI sandbox for shell commands. Requests needing broader approval fail visibly instead of waiting on an unavailable approval dialog.

Model catalogs are discovered from each installed CLI, with a one-minute cache. New model releases normally need no Koda code changes: keep the CLI updated and reopen Koda to refresh its catalog. The custom model ID field also accepts models supported by the CLI and your account. An old CLI or missing account entitlement can still prevent a model from working.

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

This exercises the same repository, worktree, streamed task, diff, and checkpoint flow with Claude selected in the UI. After both app processes restart, it checks the saved Claude session, model, and upstream session ID, then continues the conversation. Authentication or service failures fail the proof rather than skipping it or substituting a mocked response.

## Real Liveblocks proofs

```sh
pnpm --filter e2e test:proof:collaboration
```

Each agent's collaboration test uses two isolated sidecars, databases, identities, frontend ports, and browser contexts. User A grants control, user B joins, and both see presence and the streamed conversation. B sends a message to A's actual Codex or Claude session through Liveblocks. The tests also check view-only behavior at the UI and the host's authorization boundary, including rejection of a replaced control invitation.

Run all proofs together:

```sh
pnpm --filter e2e test:proof
pnpm --filter e2e exec playwright show-report proof-report
```

Screenshots, structured evidence, and logs are written under `e2e/proof-results/`; the HTML report is `e2e/proof-report/`. Both directories are ignored. Failure traces may include invitation credentials, so keep them local. The tests stop their own processes and remove their temporary data directories.

## Record the collaboration

After the live proofs pass, with Claude signed in, Liveblocks configured, and `ffmpeg` available:

```sh
pnpm --filter e2e record:collaboration
```

The recording shows two actual browser clients and isolated sidecars side by side at 1920×1080: Claude drafts a launch plan, a collaborator requests a revision through the relay, then a view-only collaborator watches another update. The setup and invitations are kept outside the filmed sequence. The host runs the real Claude CLI; the collaborator sends requests and receives the shared transcript through Liveblocks.

The original `user-A.raw.webm` and `user-B.raw.webm` recordings, a synchronized side-by-side `collaboration.mp4`, a final frame, and `evidence.json` are retained under `proof-results/collaboration-video/<timestamp>/`. The evidence records synchronization and the composition of the two actual browser recordings. This is a silent browser recording, not native macOS window capture. Temporary repositories, data directories, processes, and the test Liveblocks room are cleaned up after recording.

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

The host owns the session transcript and validates signed relay requests before dispatching the session's agent. Browser participants receive read/presence access rather than permission to rewrite the transcript. Control invitations must be kept private; relay broadcasts do not include the invitation token. View invitations do not authorize commands.

This same-machine development setup gives both sidecars a Liveblocks project secret. It is not a production identity service for mutually untrusted machines. Cross-machine deployment and production account/permission management require their own verification.

## Verification record

On 2026-10-07, both real-service proofs passed in the development checkout: the Codex flow including restart and resumed conversation, and the two-instance Liveblocks flow including view enforcement and revoked-control rejection. Each proof saved its screenshot sequence and `evidence.json`.

The current clean-clone result is recorded independently by `pnpm verify:clean` in its generated `manifest.json`: check that `status` is `passed`, all expected proof tests passed, and `sourceHead` identifies the commit being reviewed. The result directory includes the exact commands and logs for each stage. An earlier result is not evidence for later source changes or newly added agents.

Native evidence is separate: `pnpm app` built and launched the macOS shell/sidecar, and two built native windows ran with distinct identities/data directories. The Rust IPC regression confirms that notifications arriving before a `codex.send` response do not break native requests. The screenshot sequences are browser captures, not evidence of native WKWebView automation.
