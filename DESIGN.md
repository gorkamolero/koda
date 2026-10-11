# Koda design system

`packages/ui` (`@koda/ui`) codifies Koda's current terminal interface. It contains the shared foundations, all 40 component groups in [the brief](briefs/design-system.md), and the Storybook. Desktop composes these shared components while retaining its queries, stores, agent runtimes, and permission checks.

## Principles

- Keep the brand: the original ASCII KODA mark, mono-first typography, terminal frames, and `[BRACKET]` actions.
- Give information a clear hierarchy with semantic surfaces, text, borders and status tokens. A status always has a readable name as well as a color.
- Components receive props and callbacks. They do not fetch data, call RPC, read application stores, or need a sidecar.
- Preserve keyboard operation, visible focus, accessible names and reduced-motion preferences. Radix primitives provide dialog focus management, selection, menus and disclosure behavior.
- Preserve the sharing boundary: collaborators see the same workspace and transcript alongside their own projects. View access disables actions; secret questions direct every collaborator to the host. UI states describe this boundary; the application still enforces permissions.
- Native HTML props carry caller-owned `data-testid` values through to components. Existing defaults such as `shared-workspace-badge` and `data-permission` remain available.

## Foundations

Import `@koda/ui/styles.css` for the compiled component CSS (including tokens and brand styles); run `pnpm --filter @koda/ui build` first. This works without configuring Tailwind in the consuming app. Import `@koda/ui/tokens.css` alone for a token-only consumer.

Tailwind consumers can use `@koda/ui/tailwind-preset`, import `@koda/ui/source-styles.css`, and include `../../packages/ui/src/**/*.{ts,tsx}` in their `content` paths (adjust relative to their config). Typed exports live at `@koda/ui/tokens`. Foundations stories read these exports directly, including color swatches and scales.

| Foundation | Source and use |
| --- | --- |
| Themes | `themes.obsidian`, `themes.light`, `themes.dim`, `themes.graphite`; complete matching color namespaces |
| Color | Existing `--surface-*`, `--text-*`, `--border-*`, eight `--status-*` tones, gray 0–14, git and review tokens |
| Compatibility | Shadcn names reference named `--koda-*-hsl` backing tokens; these pair surfaces and foregrounds in every theme |
| Contrast | `--text-secondary`, `--text-action`, status foreground and `--text-on-*` tokens provide AA text on their matching theme surfaces |
| Type | `--font-ui` (SF Pro) and `--font-code` (SF Mono); display, heading, label, body, caption and code roles define size, line height and tracking |
| Spacing | One exported `spacing` scale, mirrored by `--space-*` variables and Tailwind |
| Radius | `--radius`, `--radius-md`, `--radius-sm`, none and full |
| Elevation | Glow, accent and popover shadows; glass blur and saturation |
| Motion | Named durations and easings, existing blink/shimmer/pulse/fade/slide/scale/accordion keyframes, reduced-motion support |
| Layers | Base, sticky, popover, modal and toast |
| Icons | Lucide at 12, 14 and 16, with the desktop's file-extension mapping in `FileIcon` |

The theme toolbar sets `data-koda-theme="obsidian|light|dim|graphite"` and the desktop's `.dark`/`.light` class. Desktop's theme loader retains its existing theme IDs and imported-theme translator. Tests enforce WCAG AA (4.5:1) for meaningful text and status foregrounds on desktop surfaces in all four themes; CSS and typed objects are checked for parity. The pre-move fixture remains historical evidence, not an appearance constraint.

Light uses light composer, terminal, control, panel and badge surfaces. Use semantic surface tokens instead of black palette tokens in components. Quiet, faint and dim text carry readable metadata; reserve reduced opacity for decoration or disabled controls. `--text-on-accent` and `--text-on-status` pair with filled accent and status backgrounds, including counters and avatars. Native `Select` owns its control surface, option surface and text color. Compact `TerminalSection` uses a complete dashed border and bracket heading; do not append fixed-width ASCII footer fragments.

## Component inventory and states

The brief numbers 40 groups; groups containing several controls expose those controls separately. Component Docs pages are generated from TypeScript props. Stories enumerate the following variants and states, with interaction tests for keyboard and callback behavior.

| # | Component group | Variants and states |
| --- | --- | --- |
| 1 | Button | Primary, secondary, ghost, outline, destructive, link, bracket; sm/md/lg/icon; hover, focus, active, disabled, loading, `asChild` |
| 2 | IconButton | Required accessible label, optional tooltip, disabled |
| 3 | ButtonGroup, SegmentedControl | Grouped actions; single-choice selection and disabled choices |
| 4 | Kbd | Escape and command shortcuts |
| 5 | Badge | Neutral/accent/outline, sm/md |
| 6 | StatusBadge, StatusDot | Success, warning, error, processing, reviewing, ready, unread, unknown |
| 7 | Field | Label, hint, error, associated control |
| 8 | Input, Textarea, InputGroup | Leading/trailing addons, invalid and disabled controls |
| 9 | Select | Model and permission choices; disabled collaborator state |
| 10 | Checkbox, RadioGroup, Switch | Checked/unchecked, mixed checkbox, disabled; keyboard operation |
| 11 | Dialog / Modal | Terminal title bar, `[ESC] CLOSE`, body/footer, sm/md/lg, open/closed, Escape and focus restoration |
| 12 | Popover, HoverCard, Tooltip, DropdownMenu | Token surfaces, open/closed, keyboard/focus interactions |
| 13 | Command | Search, grouped results, empty and disabled results, selection |
| 14 | Tabs | Panel and underline, selected and disabled tabs |
| 15 | ScrollArea, Separator, ResizablePanels, Collapsible, Accordion | Overflow, orientations, resize/disclosure and keyboard interactions |
| 16 | Progress, Meter | Determinate/indeterminate progress; segmented empty/normal/warning/full context usage |
| 17 | Avatar, AvatarStack | Image/fallback, stable token-based participant colors, separate presence dots and overflow count |
| 18 | Toast | Info/success/warning/error, optional action and dismissal |
| 19 | Callout | Info/warning/error/view-only, host unreachable and secret-on-host notes |
| 20 | Card, Surface | Plain/strong/muted/approval, optional header/footer |
| 21 | KodaLogo | Original ASCII, sm/md/lg and animated |
| 22 | Spinner, LoadingScreen | Wave/scan/pulse/matrix/bounce, progress and status label |
| 23 | WorkingIndicator | Full and compact, elapsed time supplied by caller |
| 24 | TerminalSection | Terminal border, optional description and header action |
| 25 | Panel, PanelHeader | Sidebar/right panel, title/count/actions |
| 26 | EmptyState | ASCII or icon, message, optional action |
| 27 | NavItem / ListRow | Active, unread, running, disabled; icon/meta/trailing/hover actions |
| 28 | Tree | Expanded/collapsed, selected/disabled, arrows/Home/End/typeahead |
| 29 | FileIcon | File extension mapping, folder open/closed, three icon sizes |
| 30 | DiffStat | Additions/deletions, optional change bar, empty |
| 31 | CodeBlock, InlineCode | Language label, caller-owned copy callback/state, wrapping |
| 32 | MessageBubble | User/assistant/system, author, timestamp and hover actions |
| 33 | ToolBlock, ToolCallSummary | Running/done/failed; opens while running, collapses on completion |
| 34 | ApprovalCard | Command/file/network; actionable/read-only/resolved/withdrawn; host name, busy and error |
| 35 | QuestionCard | Single/multiple/text/secret; actionable/read-only/resolved/withdrawn; secret-on-host, busy and error |
| 36 | Composer | Own/shared/view-only placeholders; model/permission/attachment slots, send/stop, disabled |
| 37 | SharedBadge | Control/view, `data-permission`, connection states |
| 38 | TerminalFrame | Ready/running/disconnected, collaborator read-only mirror |
| 39 | CommandPalette | Embedded/modal shell, search, groups, disabled results and callbacks |
| 40 | AppShell | Sidebar/topbar/main/right/bottom slots, host and collaborator layouts |

Feature data logic, editors, xterm instances, agent runtimes, and application pages stay in desktop. Desktop no longer has a `components/ui` or `ai-elements` directory. Streaming Markdown and reasoning adapters stay beside the transcript; they compose the shared controls. The duplicated logo, spinner, file icon and CSS primitives have been removed.

## Token lint

`koda/no-raw-tokens` is an ESLint rule exported from `@koda/ui/eslint`. It rejects hex colors, raw Tailwind palette colors (including directional borders and hover/opacity forms), arbitrary pixel values and inline color styles. Numeric React dimensions and locally referenced style objects are checked too; unitless values and the three icon sizes remain allowed. The `koda/css` ESLint processor applies the same rule to CSS declarations, `@apply` utilities and media query parameters, with diagnostics at the original CSS locations. Semantic custom-property references, `currentColor`, inheritance and transparency are allowed. Koda's gray 0–14 names are tokens; Tailwind's gray 50–950 palette is not.

The rule is an **error** in both `packages/ui` and desktop components, pages and CSS. Component styling must use the shared tokens; there is no migration warning exemption.

An unavoidable adapter exception must explain its purpose immediately beside the relevant expression:

```tsx
// koda-token-exception: Xterm requires a literal palette at its API boundary.
const terminalForeground = '#c5c5c5'
```

Canonical token definitions use a `koda-token-file: reason` comment in the first five lines. Neither marker is a blanket excuse for component styling. RuleTester cases cover both rejection and documented exceptions.

## Run and verify

```bash
pnpm install
pnpm --filter @koda/ui exec playwright install chromium
pnpm storybook                 # http://localhost:6006
pnpm build-storybook           # packages/ui/storybook-static
pnpm test-storybook            # real Chromium interactions + axe accessibility
pnpm --filter @koda/ui test-storybook:themes  # repeat every story in all four themes
pnpm --filter @koda/ui test     # token parity and lint-rule unit tests
pnpm --filter @koda/ui screenshots
pnpm build
pnpm lint
pnpm test
pnpm --filter desktop test
```

Storybook uses stable **10.6.1**, React and Vite, with themes, generated docs, a11y and Vitest addons. `parameters.a11y.test = 'error'` makes real violations fail. No accessibility rules are disabled. The screenshot command serves the static build at its real `/koda/` base path, captures multiple stories in all four themes, and records browser errors and overflow checks in `packages/ui/visual-review`.

The five documentation areas are Introduction, Foundations, Brand, Patterns, and App screens. Host and collaborator examples use the same mock `sharing-permissions` worktree. They never connect to real services.

## Desktop migration

The migration preserves feature-owned data and callbacks. The four batches replace:

1. Sidebar, workspace/repository/session rows: `NavItem`, `StatusBadge` and `StatusDot`. Both workspace-creation modals share one feature controller, and creation/add-repository shells use `Dialog`.
2. Agent chat: `MessageBubble`, `ToolBlock`, `ApprovalCard`, `QuestionCard`, `Composer`, native `Select`, `Command`, and the shared working indicator. Native selects preserve platform selection and proof automation. Request lifecycle, permission validation and secret-answer restrictions remain feature logic.
3. Workspace, right panel, terminal, files, diffs, checks and review: shared controls and tabs, `TerminalFrame`, one `Tree`, continuous `Meter`, and compact `AvatarStack`. Controlled expansion, lazy folder loading and virtualization callbacks stay in desktop. Keyboard navigation scrolls measured offsets without leaving a pending virtualizer callback after unmount. Diff arrows retain file selection, and Tree updates preserve composer focus.
4. Settings, sharing, Interview and remaining surfaces: `TerminalSection`, `Dialog`, `SegmentedControl`, `SharedBadge`, `Callout`, `Command`, `Toast`, `AppShell`, and shared inputs/actions. Interview composes the same `QuestionCard` as agent requests.

Desktop imports `source-styles.css` and scans the UI sources with the shared Tailwind preset. Named small text, geometry, presence and file-extension tokens preserve the original dimensions and colors. The shared `cn` understands semantic font sizes and shadows, so overrides do not accidentally remove text colors or retain an unwanted popover shadow. `Button`'s `unstyled` variant retains common focus/disabled handling for custom terminal action layouts. Presentation options (native select, compact terminal sections, filled file icons, continuous meter, composed dialog content) are documented by stories.

All existing proof test IDs are forwarded to their corresponding controls, including the share permission choices, shared workspace link/badge and its `data-permission`, join action, approval/question actions, composer, terminals and file rows. The file-row tests now assert the padding on the shared Tree row; their behavior assertions remain intact.

Documented adapter exceptions are limited to:

- `Terminal/terminalOptions.ts`: xterm receives resolved shared CSS colors, with a 4.5 minimum contrast ratio. Theme changes update local and mirrored terminals without recreating their sessions; observers disconnect on disposal. The initial fallback palette remains at this API boundary.
- `Scratchpad/Scratchpad.tsx`: Monaco's theme API requires literal hex colors.
- `PresenceAvatars.tsx` and shared `AvatarStack`: known wire identity colors map to named tokens; an unknown externally supplied identity color remains a documented adapter value.

## Verified implementation

The original package verification is recorded in [docs/design-system-verification.json](docs/design-system-verification.json). The desktop migration results, batch commits, screenshot comparisons, tests, and real-agent proof outcomes are recorded separately in [docs/desktop-migration-verification.json](docs/desktop-migration-verification.json).

Playwright captures the actual desktop with deterministic browser RPC fixtures in all four themes. Core screens, expanded file/diff trees, sharing/join dialogs, settings and toast states are compared before and after the batches. The Add Repo and Join Workspace dialogs now portal to the center of the window: their previous overlays were accidentally confined to the sidebar. The terminal uses @xterm/xterm 6, which fixes the xterm 5.3 viewport disposal race reproduced in the baseline without a dependency patch. Its browser regression exercises the public terminal lifecycle and verifies pending animation frames are cancelled; the shared TerminalFrame also has a fill-height regression story. Reduced-motion CSS disables transitions completely so synchronous renderer font measurements remain accurate. See [the visual capture scripts](scripts/desktop-migration-visuals/README.md) to reproduce the comparisons.

`pnpm build`, `pnpm lint`, `pnpm test`, the Storybook build and browser story tests are required. Real Codex, Claude, approval and question proofs run separately from the mock screenshot fixtures. Collaboration and `verify:clean` remain owner-run because they require the owner's environment file. A restricted proof run can set `KODA_PROOF_KEEP_NATIVE_SESSIONS=1` to retain provider history outside its fixture directory; this changes cleanup only, not runtime assertions.

## Publication

The public Storybook is <https://gorkamolero.github.io/koda/>, on GitHub Pages. `pnpm storybook:pages` builds it with `STORYBOOK_BASE=/koda/` and commits the output to the `gh-pages` branch from a temporary directory, as a fast-forward on the previous deploy; GitHub's branch build serves it (with `.nojekyll`, so Storybook's files pass through untouched). There is no Actions workflow.

A mirror is <https://koda-storybook.pages.dev> on Cloudflare Pages (project `koda-storybook`). `pnpm storybook:deploy` builds it for the site root and publishes it with `wrangler pages deploy`, using the Cloudflare account wrangler is signed in to. Storybook's own frame and its docs pages use the Obsidian tokens (`.storybook/kodaTheme.ts`).

### Floating surfaces

Use `--surface-popover` for dialogs, menus, tooltips, selects, hover cards and toasts. It is opaque in every bundled theme (Light: `#ffffff`); `--surface-card` and status tints can be translucent and are only suitable inside an opaque surface. Desktop dialogs inherit the shared dashed border and popover shadow without surface overrides.

`--surface-overlay` includes its alpha: Obsidian, Dim and Graphite use `rgba(0, 0, 0, 0.8)`; Light uses `rgba(0, 0, 0, 0.45)`. Apply it directly without additional opacity. The `.light` fallback also uses 45% black.

Use `--text-secondary` for dialog labels, hints and close labels, and `--text-action` for action text. Secondary text on the popover surface meets WCAG AA (4.5:1) in all four themes; token tests enforce this pairing. Do not use decorative `--text-dim` or `--text-faint` for these labels.

## Desktop theme polish checks

`node scripts/desktop-migration-visuals/snapshot.mjs polished HEAD full` captures and audits all 18 fixture screens in all four themes. Axe `color-contrast` violations fail capture, including measurable failures that axe classifies as short-text review items. The manifest retains selectors, ratios, passing node counts and incomplete results for visual review. Canvas terminal output is covered by the token tests, xterm's minimum contrast setting and capture inspection. Run `node --test scripts/desktop-migration-visuals/contrast.test.mjs` to verify the audit rejects low-contrast labels and counters.

For a proof run restricted to repository cleanup, set `TMPDIR` to a repo-owned temp directory, `KODA_PROOF_OUTSIDE_ROOT` to a separate repo-owned directory outside the agent fixture worktree, and `KODA_PROOF_KEEP_NATIVE_SESSIONS=1`. The approval probe remains outside the agent's allowed worktree while provider history is retained. These settings do not skip proof assertions.
