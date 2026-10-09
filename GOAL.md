# Goal

You are Astra Ultra, so delegate grunt work to subagents and stay high-level.

Get Koda (this repo) fully working end to end on macOS with Codex as the agent, then prove that its existing collaboration works.

## Context

- Koda is a desktop app for working collaboratively with coding agents: Tauri and React in `apps/desktop`, a Node sidecar in `apps/sidecar`. It paused when Claude removed the third-party access path. Codex (`@openai/codex-sdk`, already in `apps/sidecar`) is the agent to use now.
- Collaboration is already built on Liveblocks but has never been proven end to end:
  - `apps/desktop/src/lib/liveblocks.ts`
  - `apps/desktop/src/components/CollaborativeWorkspaceProvider.tsx`
  - `apps/desktop/src/components/PresenceAvatars.tsx`
  - `apps/desktop/src/hooks/useCollaboration.ts`
  - `apps/desktop/src/hooks/useRemoteMessageRelay.ts`
  - `apps/sidecar/src/sync/LiveblocksClient.ts`
- `FEATURES.md` describes the current state.

## Phase 1: it works with Codex

- Install, build and launch the desktop app and sidecar (`pnpm app`). Fix whatever is broken.
- Make Codex the default agent. Claude and Kimi can stay, but they must not block startup or the flow.
- This flow must work end to end:
  1. Add a local repo.
  2. Create a workspace with its own git worktree.
  3. Start a Codex session and send it a task.
  4. Stream the agent's messages live in the UI.
  5. See the changed files and diffs.
  6. Create a checkpoint.
  7. Restart the app and find the workspace and session still there.
- Prove it with an automated e2e test (Playwright, in `e2e/`) that runs this flow against a throwaway repo and passes. Save a screenshot of each step.

## Phase 2: prove the collaboration

- Get the Liveblocks collaboration working with a Liveblocks dev key read from an env file. Never commit the key; add the env file to `.gitignore` and document the variable.
- Run two Koda instances on the same machine with separate data directories, as two users.
- User A shares a workspace with user B with `control` permission:
  - B sees A's workspace, sessions and Codex messages streaming live, and sees A's presence.
  - B sends a message to A's Codex session through the relay.
  - A sees B's message and the agent's reply live.
- With `view` permission, B can watch but cannot send. If that isn't enforced, enforce it.
- Prove it with an e2e test that drives both instances, plus a screenshot sequence of the two windows side by side.

## Rules

- Commit in small steps with clear messages.
- Keep `FEATURES.md` accurate as things get proven or fixed.
- Write `VERIFY.md` at the repo root with the exact commands to reproduce both proofs from a clean clone.

## Done when

Both e2e tests pass from a clean clone by following `VERIFY.md`.
