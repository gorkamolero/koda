# Desktop migration visual review

Capture desktop screens from an exact git revision, in Obsidian, Light, Dim and Graphite, without a sidecar or collaboration credentials. All fixture workspaces, repositories, agent events, approvals, questions, terminal output and checks are synthetic. JSON-RPC and terminal WebSockets are intercepted in Playwright; the fixture does not fetch real project data or use env files.

From a checkout with dependencies installed:

```sh
pnpm install --frozen-lockfile
pnpm --filter @koda/ui exec playwright install chromium
node scripts/desktop-migration-visuals/snapshot.mjs before 1993d88 full --install-dependencies
node scripts/desktop-migration-visuals/snapshot.mjs after HEAD full
node scripts/desktop-migration-visuals/review.mjs after before
```

The scripts resolve the repository from their own location, so invocation from another working directory also works. `snapshot.mjs` accepts `label`, `git-ref` and an optional scenario group. Labels contain lowercase letters, digits and hyphens. Use `WORKTREE` instead of a git ref only for an uncommitted diagnostic copy; its manifest is marked accordingly.

| Group | Captures |
| --- | --- |
| `full` (default) | 72: all 18 scenarios in all four themes |
| `all` | 52: the core 13-screen matrix |
| `batch1` | 12: workspace list, create workspace, add repository |
| `details` | 8: expanded diff and file tree; then navigate away to check cleanup |
| `extras` | 12: toast, join shared workspace, scrolled collaboration settings |

The core matrix also covers chat and tool blocks, approvals, questions, sharing, files, checks, review, the command palette, settings and Interview. Browser size is 1440 × 1000 at device scale 1, with UTC, reduced motion and a fixed clock. The fixture's “237 tests passed” terminal output is illustrative content, not a test result from the captured revision.

`snapshot.mjs` archives only explicitly listed frontend source/config files, including `packages/ui`. Vite aliases and the Tailwind preset point into that snapshot. By default, installed dependencies are reused from the checkout. Use `--install-dependencies` for historical refs that import packages removed by the migration: it archives that revision's package/workspace/lockfiles and declared dependency patches, and installs desktop/UI dependencies only inside the disposable snapshot, using `--frozen-lockfile --ignore-scripts`. The current checkout's dependencies remain untouched. Its dependency optimizer cache lives inside the temporary snapshot, so parallel proofs cannot invalidate it. It selects an unused loopback port, records the commit and process, and removes its temporary source snapshot and stops its preview after capture. No environment files are copied or read from the snapshot.

Outputs remain under ignored `.migration-visual/<label>/`: full-resolution PNGs, `manifest.json`, theme contact sheets, optional before/after sheets and highlighted pixel maps. Process metadata and Vite logs sit beside each output directory. The manifest records browser errors, unknown RPC methods, theme attributes, horizontal overflow, fonts, dialog shadows and terminal viewport measurements. Any browser error, unknown RPC call, horizontal overflow or collapsed terminal viewport makes capture exit nonzero while preserving the evidence.

`review.mjs <label> [baseline-label]` uses Playwright canvas to compose sheets and compare pixels; it adds no image-processing dependency. Pixel statistics use a 15-channel-value threshold and are review aids, not an automatic appearance approval. Inspect the screenshots yourself. This fixture review supplements unit tests, Storybook tests and real-service proofs; it does not replace them.
