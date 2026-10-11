# Koda design system

`packages/ui` (`@koda/ui`) codifies Koda's current terminal interface. It contains the shared foundations, all 40 component groups in [the brief](briefs/design-system.md), and the Storybook. Desktop consumes the tokens and Tailwind preset now; its component migration is a separate step.

## Principles

- Keep the brand: the original ASCII KODA mark, mono-first typography, terminal frames, and `[BRACKET]` actions.
- Give information a clear hierarchy with semantic surfaces, text, borders and status tokens. A status always has a readable name as well as a color.
- Components receive props and callbacks. They do not fetch data, call RPC, read application stores, or need a sidecar.
- Preserve keyboard operation, visible focus, accessible names and reduced-motion preferences. Radix primitives provide dialog focus management, selection, menus and disclosure behavior.
- Preserve the sharing boundary: collaborators see the same workspace and transcript alongside their own projects. View access disables actions; secret questions direct every collaborator to the host. UI states describe this boundary; the application still enforces permissions.
- Native HTML props carry caller-owned `data-testid` values through to components. Existing defaults such as `shared-workspace-badge` and `data-permission` remain available.

## Foundations

Import `@koda/ui/styles.css` for the compiled component CSS (including tokens and brand styles); run `pnpm --filter @koda/ui build` first. This works without configuring Tailwind in the consuming app. Import `@koda/ui/tokens.css` alone for a token-only consumer such as desktop.

Tailwind consumers can use `@koda/ui/tailwind-preset`, import `@koda/ui/source-styles.css`, and include `../../packages/ui/src/**/*.{ts,tsx}` in their `content` paths (adjust relative to their config). Typed exports live at `@koda/ui/tokens`. Foundations stories read these exports directly, including color swatches and scales.

| Foundation | Source and use |
| --- | --- |
| Themes | `themes.obsidian`, `themes.light`, `themes.dim`, `themes.graphite`; complete matching color namespaces |
| Color | Existing `--surface-*`, `--text-*`, `--border-*`, eight `--status-*` tones, gray 0–14, git and review tokens |
| Compatibility | Shadcn names reference named `--koda-*-hsl` backing tokens; these preserve the original HSL values exactly |
| Contrast | New `--text-secondary`, `--text-action`, status foreground and `--text-on-*` tokens pair foregrounds with legacy dark surfaces without changing desktop colors |
| Type | `--font-ui` (SF Pro) and `--font-code` (SF Mono); display, heading, label, body, caption and code roles define size, line height and tracking |
| Spacing | One exported `spacing` scale, mirrored by `--space-*` variables and Tailwind |
| Radius | `--radius`, `--radius-md`, `--radius-sm`, none and full |
| Elevation | Glow, accent and popover shadows; glass blur and saturation |
| Motion | Named durations and easings, existing blink/shimmer/pulse/fade/slide/scale/accordion keyframes, reduced-motion support |
| Layers | Base, sticky, popover, modal and toast |
| Icons | Lucide at 12, 14 and 16, with the desktop's file-extension mapping in `FileIcon` |

The theme toolbar sets `data-koda-theme="obsidian|light|dim|graphite"` and the desktop's `.dark`/`.light` class. Desktop's theme loader retains its existing theme IDs and imported-theme translator. Tests compare every original resolved token against a captured pre-move fixture in all four themes; CSS and typed objects are checked for parity.

Light intentionally retains some dark terminal and panel surfaces from the existing application. New components use the matching `text-on-*` foreground tokens there. Do not “correct” inherited legacy values during a token-only move.

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

Feature data logic, editors, xterm instances, agent runtimes, and application pages stay in desktop. Desktop copies and unused vendored primitives are removed only during the later component migration, after checking their callers.

## Token lint

`koda/no-raw-tokens` is an ESLint rule exported from `@koda/ui/eslint`. It rejects hex colors, raw Tailwind palette colors (including directional borders and hover/opacity forms), arbitrary pixel values and inline color styles. Numeric React dimensions and locally referenced style objects are checked too; unitless values and the three icon sizes remain allowed. The `koda/css` ESLint processor applies the same rule to CSS declarations, `@apply` utilities and media query parameters, with diagnostics at the original CSS locations. Semantic custom-property references, `currentColor`, inheritance and transparency are allowed. Koda's gray 0–14 names are tokens; Tailwind's gray 50–950 palette is not.

The rule is an **error** for `packages/ui` and a **warning** for desktop components, pages and CSS during this run. Desktop warnings document migration work; they become errors after migration. Other lint errors still fail the build.

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

## Verified implementation

The verification record is [docs/design-system-verification.json](docs/design-system-verification.json). This implementation contains 303 stories and 61 component Docs pages covering the brief's 40 groups. All stories pass in four themes (1,212 browser story runs), including accessibility checks. The workspace has 770 passing unit tests, including 237 desktop tests. Desktop lint reports 311 migration warnings and no errors; the UI package has no lint warnings.

Sixteen Playwright captures cover host and collaborator workspaces, button sizes and open dialogs in every theme. They were visually inspected; the static `/koda/` base, theme attribute, runtime errors and horizontal overflow are also checked by the screenshot script. A host screenshot is committed in the README; local captures and their manifest remain in `packages/ui/visual-review`.

## Publication

The future public URL is <https://gorkamolero.github.io/koda/>. `.github/workflows/storybook.yml` builds and tests on pushes to `main`, then uses the official configure/upload/deploy Pages actions. The Vite production base is `/koda/`.

This branch does not deploy or change repository settings. The owner can enable Pages for GitHub Actions when ready to merge. The workflow has no manual dispatch trigger and does not run on `codex/design-system`.
