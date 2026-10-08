# Reproduce Koda's end-to-end proofs

This document covers the macOS desktop launch and two real-service Playwright proofs. The proofs use the production React UI and Node sidecar, real git worktrees, the Codex SDK, and Liveblocks. Playwright drives Chromium; it does not automate the native macOS WKWebView. Native desktop verification is a separate check below.

## Prerequisites

- macOS with Xcode command-line tools and a Rust toolchain.
- Node.js 24 (see `.nvmrc`) and pnpm 9.15.9. Node 22.12 or later is required.
- An installed, authenticated Codex CLI: run `codex login`, then `codex login status`. Koda uses that CLI through the official Codex TypeScript SDK. See [Codex SDK documentation](https://learn.chatgpt.com/docs/codex-sdk).
- A Liveblocks **development** secret key for the collaboration proof. Both development instances use the same Liveblocks project. No public browser key is needed.
- Internet access for dependencies, Codex, and Liveblocks.

No Claude or Kimi credentials are needed. Select the Codex model in Koda's model picker; the choice is stored with the session.

## Clean clone

These changes are committed locally and are not pushed. To verify an independent clone of this checkout's committed HEAD, configure `.env.local` as described below, commit all source changes, and run:

```sh
pnpm verify:clean
```

This clones the committed source with `git clone --no-local`, installs locked dependencies, builds from source, and runs both real-service proofs. It passes credentials through the inherited environment without copying the env file. Reports, screenshots, logs, and a manifest identifying the tested commit are retained under `proof-results/clean-<commit>-<timestamp>/`. A successful run removes its temporary clone; a failed run reports the retained diagnostic path.

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

## Phase 2: real Liveblocks proof

```sh
pnpm --filter e2e test:proof:collaboration
```

The test uses two isolated sidecars, databases, identities, frontend ports, and browser contexts. User A grants control, user B joins, and both see presence and the streamed conversation. B sends a message to A's actual Codex session through Liveblocks. The test also checks view-only behavior at the UI and the host's authorization boundary.

Run both proofs together:

```sh
pnpm --filter e2e test:proof
pnpm --filter e2e exec playwright show-report proof-report
```

Screenshots, structured evidence, and logs are written under `e2e/proof-results/`; the HTML report is `e2e/proof-report/`. Both directories are ignored. Failure traces may include invitation credentials, so keep them local. The tests stop their own processes and remove their temporary data directories.

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

The host owns the session transcript and validates signed relay requests before dispatching Codex. Browser participants receive read/presence access rather than permission to rewrite the transcript. Control invitations must be kept private; relay broadcasts do not include the invitation token. View invitations do not authorize commands.

This same-machine development setup gives both sidecars a Liveblocks project secret. It is not a production identity service for mutually untrusted machines. Cross-machine deployment and production account/permission management require their own verification.

## Verification record

On 2026-10-07, both real-service proofs passed in the development checkout: the Codex flow including restart and resumed conversation, and the two-instance Liveblocks flow including view enforcement and revoked-control rejection. Each proof saved its screenshot sequence and `evidence.json`.

The final clean-clone result is recorded independently by `pnpm verify:clean` in its generated `manifest.json`: check that `status` is `passed`, both proof tests passed, and `sourceHead` identifies the commit being reviewed. The result directory includes the exact commands and logs for each stage.

Native evidence is separate: `pnpm app` built and launched the macOS shell/sidecar, and two built native windows ran with distinct identities/data directories. The Rust IPC regression confirms that notifications arriving before a `codex.send` response do not break native requests. The screenshot sequences are browser captures, not evidence of native WKWebView automation.
