# Desktop theme polish verification

Verified on 2026-10-11, directly in the main checkout. Application and harness revision: `f165e14f8e6ff28689a4f9f0250eaa878352920e`. This report is a subsequent documentation-only commit. No push or deployment was performed.

## Implementation commits

- `6a7ffbc` — Shared theme surfaces, readable semantic colors, native Select, status badge foregrounds, avatar foreground pairing, complete compact section borders, stories and token tests.
- `900b1a2` — Desktop semantic surface adoption, terminal theme synchronization and lifecycle regression, removal of detached ASCII fragments.
- `f165e14` — Desktop axe contrast audit and failure-detection regression, documented workflow, configurable approval fixture location.

## Reviewed defects

| Defect | Change |
| --- | --- |
| 1. Light composer toolbar | Replaced the raw black surface with `surface-composer`; Light defines a light surface and matching foreground. |
| 2. Light terminal | Light defines a white terminal surface, making the existing semantic tab header readable. Local and mirrored xterm instances resolve the shared palette, enforce minimum contrast 4.5, and react to theme changes without recreating sessions. Terminal PID text no longer reduces meaningful text opacity. |
| 3. Settings native selects | Shared native Select owns its semantic control background, text and option colors. Removed Settings' black surface override; related Settings inputs and keycaps also use control surfaces. |
| 4. Status and row metadata | Light status, git, accent and metadata tokens use readable colors. Shared StatusBadge supplies status foregrounds. Light secondary surface/foreground aliases fix the Completed pill. Added paired accent/status foreground tokens for counters and avatar initials. |
| 5. Dark secondary text | Raised meaningful faint, dim, subtle and muted tiers at the token level, retaining brighter primary text and accent hierarchy. Token tests enforce 4.5:1 across ten desktop surface roles in every theme. |
| 6. Stray lines | Removed the detached assistant-message footer and sidebar footer bracket. Removed fixed-length Settings heading/footer lines. Shared compact TerminalSection now renders a complete dashed frame with a bracket heading. |
| 7. Desktop contrast regression | Every fixture capture runs axe's color-contrast rule. Violations and measurable short-text failures exit nonzero. A browser regression proves that both low-contrast labels and one-digit counters fail. No rule or selector is disabled. |

Accessible names and test IDs were retained. Native selects remain native for keyboard/platform behavior and proof automation.

## Contrast results

`node scripts/desktop-migration-visuals/snapshot.mjs polished HEAD full` exited 0 and produced 72 captures from the committed revision.

| Theme | Screens audited | Axe passing nodes across captures | Contrast violations |
| --- | ---: | ---: | ---: |
| Obsidian | 18 | 1,279 | 0 |
| Light | 18 | 1,279 | 0 |
| Dim | 18 | 1,279 | 0 |
| Graphite | 18 | 1,279 | 0 |

Each theme also records 157 non-text-glyph review items and one sharing-paragraph overlap-detection review item. These are retained in the manifest, not suppressed. The sharing paragraph was inspected in all four captures: the visible text is unobscured and uses the AA-tested secondary/popover token pair. Intentional ASCII glyphs were retained as terminal decoration. This is a fixture contrast check, not an assertion of complete application accessibility certification. Xterm's canvas is checked through its minimum-contrast setting, palette token tests and visual inspection rather than axe DOM text analysis.

The manifest has zero browser errors, unknown RPC calls, horizontal overflows or collapsed terminal viewports. The preview stopped and its temporary source snapshot was removed.

## Visual inspection

`node scripts/desktop-migration-visuals/review.mjs polished after-dialogs` exited 0 and generated comparison sheets and pixel difference maps.

Opened and inspected all 18 Light screens: workspace list, create workspace, add repo, toast, join workspace, collaboration settings, expanded diff, expanded files, chat, approval, question, sharing, files, checks, review, command palette, settings and Interview.

Opened and inspected workspace list, chat, files and settings in Obsidian, Dim and Graphite. Also inspected sharing in each dark theme to resolve axe's paragraph review item.

Evidence is retained locally under ignored `.migration-visual/polished/`, including `manifest.json`, full-resolution screenshots, comparison sheets and difference maps. Logs are in `.migration-visual/`.

## Checks

| Command | Result |
| --- | --- |
| `pnpm build` | Pass |
| `pnpm lint` | Pass |
| `pnpm test` | Pass: desktop 240, UI 57, sidecar 486, collaboration service 5 tests |
| `pnpm --filter @koda/ui build-storybook` | Pass |
| `pnpm --filter @koda/ui test-storybook:themes` | Pass: 330 tests in each of four themes, 1,320 total |
| `node --test scripts/desktop-migration-visuals/contrast.test.mjs` | Pass |
| `node scripts/desktop-migration-visuals/snapshot.mjs polished HEAD full` | Pass: all 72 fixture audits |
| `node scripts/desktop-migration-visuals/review.mjs polished after-dialogs` | Pass |
| `pnpm --filter e2e test:proof:approvals` | Pass: Codex and Claude, 2 tests, 2.9 minutes |
| `pnpm --filter e2e test:proof:questions` | Pass: Codex and Claude, 2 tests, 1.4 minutes |
| `pnpm --filter e2e typecheck:proof` | Pass |

Approval proofs exercised pending reload, approve, deny, stop and saved bypass restart. Question proofs exercised bypass waiting, reload, answer, cancel and stop. Proofs used repo-owned `TMPDIR` and `KODA_PROOF_OUTSIDE_ROOT`, with `KODA_PROOF_KEEP_NATIVE_SESSIONS=1`; provider history was retained outside this repo. Questions used a separate repo-local output path so approval evidence was preserved. These options do not skip assertions. Task-created temporary edit scripts and proof caches were removed after completion.

## Deliberate scope decisions

Kept mono typography, bracket actions, accent hues, intentional terminal decoration and the existing dark terminal bodies. These preserve the brand and quiet terminal hierarchy; Light now has its own coherent light terminal. Disabled controls retain reduced opacity to communicate their state. Arbitrary imported VS Code themes are outside this four-bundled-theme contrast guarantee.
