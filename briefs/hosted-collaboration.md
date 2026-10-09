# Brief: collaboration without anyone holding the Liveblocks secret

## Problem

Collaboration works, but only for development. Every sidecar reads `LIVEBLOCKS_SECRET_KEY` from `.env.local` and uses it for two things:

1. Minting its own Liveblocks tokens (`token()` in `apps/sidecar/src/sync/LiveblocksClient.ts`).
2. HMAC-signing and verifying invitations (`signCapability` / `verifyCapability` in `apps/sidecar/src/sync/capabilities.ts`, called from `shareWorkspace`, `joinWorkspace`, `listSharedWorkspaces`, `getInvitation`, `authorizeRoom` and the SyncManager).

So both people need the same project secret. That secret gives full admin over every room in the Liveblocks project, and it sits in a plain-text file. The app has no onboarding: without the key, Share fails with "Collaboration requires LIVEBLOCKS_SECRET_KEY in the local env file".

## Goal

A user installs Koda, picks a display name and shares a workspace. Nobody pastes, stores or sees a Liveblocks key. The secret lives in one place: a small hosted token service.

## Design (decided; change it only if you find a real flaw, and say why in the commit)

### Token service

- New package `apps/collab-service`: a Cloudflare Worker with D1 storage. `LIVEBLOCKS_SECRET_KEY` is a Worker secret. Local development reads it from an ignored `.dev.vars`.
- **Identity:** each Koda install has a device keypair (Ed25519). There are no accounts in this version.
  - The sidecar creates the keypair on first use and keeps the private key in its state file (mode 0600, like the existing state).
  - Every request to the service is signed over method, path, service origin, timestamp, nonce and body hash.
  - The service rejects requests outside a 60-second window and rejects reused nonces.
- **Endpoints:**
  - Register a device: public key and display name.
  - Claim a room. The first claimer owns it; a second claim is refused.
  - Delete a room. Owner only.
  - Create a join code for a room. Owner only. Creating a new code revokes the old code and every grant made from it, which matches how replacing an invitation already revokes control at the host.
  - Redeem a join code. This grants the redeeming device access to that room.
  - Get a token for a room, with a role:
    - `host` returns FULL access, for the owner only.
    - `ui` returns READ access, for the owner or a granted device.
    - `guest` returns READ access, for a granted device.
  - Nothing returns the secret, and nothing grants access to a room the device doesn't own or hold a grant for.
- **Limits:** rate-limit device registration per IP, token requests per device, and rooms per device (20). The limits are there to keep an open service from running up the Liveblocks bill.

### Sidecar

- **Mode selection:**
  - If `LIVEBLOCKS_SECRET_KEY` is set locally, keep today's behaviour. It is the development and self-host mode, and the existing proofs and the two-machine recording depend on it.
  - Otherwise use the token service at the configured URL.
  - `collaboration.status` reports which mode is active and whether the service is reachable.
- **Invitations:** sign them with a host-local random signing key kept in the sidecar state, instead of the Liveblocks secret.
  - Only the host ever verifies an invitation.
  - The guest stores the invitation and parses it without verifying the signature.
  - An invitation carries the service join code, and redeeming it is part of `collaboration.join`.
  - The relay and remote-request signing (keyed by the invitation string) stay as they are.
- **Service URL:** the URL is a setting. Read it from `KODA_COLLAB_URL`, otherwise from the settings store, otherwise from a build-time default, which stays empty until the service is deployed. An invitation made against a different service is refused with a clear message.

### Desktop onboarding

- Add a Collaboration section to `apps/desktop/src/pages/Settings.tsx`, in its existing terminal style. It has:
  - A display name field. It becomes the default name in place of the `KODA_USER_NAME` env var; the env var still overrides it so tests keep working.
  - The service URL, as an advanced setting.
  - A status line: development key, connected, or not configured.
- The Share and Join dialogs (`apps/desktop/src/components/WorkspaceSharing.tsx`) show a short setup state that links to Settings when collaboration isn't available, instead of a raw error.
- The first share registers the device automatically. There is no extra step.

## Proof

- **Worker tests** (vitest with the Workers pool, or miniflare) cover:
  - Signature, timestamp and nonce rejection.
  - Room ownership.
  - Join-code redeem and revocation.
  - Each token role, with Liveblocks authorize mocked at the HTTP boundary.
  - The limits.
- **Sidecar tests** cover the service client and invitations that no longer need the Liveblocks secret.
- **E2E:** add a service-mode run of `e2e/proofs/collaboration-proof.spec.ts` (harness in `e2e/proofs/harness.ts`).
  - The harness starts the Worker locally with `wrangler dev`, passing the secret from the env file through the environment. It never writes the secret into a tracked file.
  - It starts both Koda instances without `LIVEBLOCKS_SECRET_KEY` in their environment, and asserts the variable is absent.
  - The existing development-key runs stay and must still pass.

## Rules

- The real env file is `/Users/gorkolas/Developer/koda/.env.local`. Point at it with `KODA_ENV_FILE`. Never copy it, print it or commit it, and keep `.dev.vars` ignored.
- Work on branch `codex/hosted-collaboration`. Commit in small steps with clear messages, push the branch to origin, and don't merge it into `main`.
- Don't deploy the Worker. It needs the owner's Cloudflare account. Add `pnpm collab:deploy` (D1 migrations plus `wrangler deploy`) and document the deploy and `wrangler secret put LIVEBLOCKS_SECRET_KEY` steps in `VERIFY.md`.
- Keep `README.md`, `VERIFY.md`, `FEATURES.md` and `.env.example` accurate. Replace the FEATURES.md line saying collaboration is development-only auth with what is now true. Remove the stale `VITE_LIVEBLOCKS_PUBLIC_KEY` examples if nothing uses them.
- Match the surrounding code style. `pnpm build`, `pnpm lint` and `pnpm test` must pass.

## Done when

`pnpm verify:clean` passes on the pushed branch head, including the new service-mode collaboration proof.
