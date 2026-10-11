# Brief: the Koda design system and its Storybook

## Why

Koda is being presented as a project. Its UI must run on a documented design system with a public Storybook. Today the look lives in 155 component files: 175 raw `<button>` elements, 182 raw palette classes such as `text-zinc-500`, 69 hex colours, 88 one-off pixel sizes and 50 inline styles. Several brand pieces have been rebuilt in more than one place.

The goal is to codify the current brand, not redesign it. That brand is a terminal look with a mono-first type style, `[BRACKET]` actions, the ASCII KODA logo and four themes.

## Where it lives

- **The package:** a new workspace package, `packages/ui` (`@koda/ui`). It holds the tokens, every component below and the Storybook.
- **Tokens:** CSS variables in `tokens.css`, typed objects, and a Tailwind preset that `apps/desktop` uses in place of its own colour config.
- **Desktop:** `apps/desktop` imports components from `@koda/ui`. `apps/desktop/src/components/ui` goes away.
- **Presentational components only:** components take props and render. They make no RPC calls, queries or store reads, so every story runs without a sidecar. Feature components in the desktop keep the data logic and compose these components.
- **Test ids stay:** keep every `data-testid` the e2e proofs use (for example `share-permission-view`, `shared-workspace-badge`, `shared-workspace-link`, `join-workspace`). Move each one onto the new component through props.

## Foundations (tokens)

- **Colour.** Formalize the existing variable set, keep the names, and give every theme a value for each:
  - surfaces: sidebar, topbar, right panel, messages, composer, card (plain, strong, muted), item, control and its states, hover, active, popover, bubble and user bubble, terminal, approval, diff card, review
  - text: primary through dim, plus accent
  - borders: subtle through stronger, plus accent
  - status: success, warning, error, processing, reviewing, ready, unread, unknown
  - the gray scale, from 0 to 14

  The shadcn names (`background`, `primary`, `destructive`, `ring`, `chart-*` and so on) become aliases of Koda tokens, not separate values.
- **Type.** Use `font-ui` (SF Pro) and `font-code` (SF Mono), keeping the mono-first brand. Define named roles: display (the ASCII logo), heading, label (uppercase bracket text), body, caption and code, each with its size, line height and tracking.
- **Spacing, radius, elevation, motion and layers.** Use one spacing scale, the radius set (`--radius`, md and sm), the shadow and blur tokens, and named durations and easings with the existing keyframes. Add z-index layers for base, sticky, popover, modal and toast.
- **Themes.** Obsidian (the dark default), Light, Dim and Graphite all fill the same token names. The theme translator for imported themes keeps working.
- **Icons.** Use lucide-react in three sizes (12, 14 and 16), plus the `FileIcon` mapping.
- **Enforcement.** Add an ESLint rule for `apps/desktop` and `packages/ui` that rejects hex colours, raw Tailwind palette classes, arbitrary pixel values and inline colour styles in components. A token file or a documented exception (such as the terminal's xterm theme) needs a comment to pass.

## Components

For each component, list its variants and states, and build the stories from that list. The "replaces" lines name the current code it takes over.

### Primitives

1. **Button.** Variants: primary, secondary, ghost, outline, destructive, link and bracket (the `[SHARE]` style). Sizes: sm, md, lg and icon. States: hover, focus, active, disabled and loading. Supports `asChild`. It replaces most of the 175 raw buttons, `MessageActionBar`'s `ActionButton`, and the shells of `PulseButton` and `AgentOverviewButton`.
2. **IconButton.** An icon-only button with a required `aria-label` and an optional tooltip.
3. **ButtonGroup and SegmentedControl.** Grouped actions, plus a single-choice toggle (the share dialog's view and control choice).
4. **Kbd.** Key hints such as `[ESC]` and `⌘K`.
5. **Badge.** Neutral, accent and outline styles, each in sm and md.
6. **StatusBadge and StatusDot.** One tone for each status token. It replaces `WorktreeStatusBadge` and the status dots in the sidebar and session list.
7. **Field.** A label, hint and error wrapper around any control.
8. **Input, Textarea and InputGroup.** Inputs with leading and trailing addons, in their invalid and disabled states.
9. **Select.** It also covers the model and permission selects, including a disabled read-only state for collaborators.
10. **Checkbox, RadioGroup and Switch.**
11. **Dialog (Modal).** The brand modal from `WorkspaceSharing`: a title bar, the `[ESC] CLOSE` affordance, a body and footer actions, in sm, md and lg widths. It replaces both `CreateWorkspaceModal`s (in `Sidebar.tsx` and `WorkspaceList.tsx`), `AddRepoModal`, `JoinSharedWorkspaceModal` and the shell of `ConversationHistoryDialog`.
12. **Popover, HoverCard, Tooltip and DropdownMenu.** Restyle them to the tokens.
13. **Command.** The cmdk list, which the command palette, quick open and the mention and slash popovers use.
14. **Tabs.** A panel style and an underline style. It replaces the tab bars in `RightSidebar`, `EditorTabs` and `ActivityFeedTab`.
15. **Layout helpers.** ScrollArea, Separator, ResizablePanels, Collapsible and Accordion.
16. **Progress and Meter.** Linear progress and a segmented meter. The meter replaces `ContextMeter`.
17. **Avatar and AvatarStack.** AvatarStack replaces `PresenceAvatars`, with presence colours and an overflow count.
18. **Toast.** Info, success, warning and error, with an optional action. It replaces `Toast/*`.
19. **Callout.** Info, warning, error and view-only, inline. It replaces the sharing error box, the view-only notes, the "secret answers stay on the host" note and the host-unreachable state.
20. **Card and Surface.** Plain, strong, muted and approval surfaces, with an optional header and footer.

### Brand components

21. **KodaLogo.** The ASCII logo (`KodaAsciiLogo`) in sm, md and lg.
22. **Spinner.** The wave, scan, pulse, matrix and bounce variants from `KodaSpinner.tsx`, plus `LoadingScreen`.
23. **WorkingIndicator.** Full and compact (`WorkingIndicator`, `CompactWorkingIndicator`).
24. **TerminalSection.** The `┌─ NAME ─┐` framed section from `Settings.tsx`, with an optional action in its header.
25. **Panel and PanelHeader.** Sidebar sections and right-panel headers, each with a title, a count and actions.
26. **EmptyState.** ASCII art or an icon, a message and an optional action.
27. **NavItem (ListRow).** A leading icon, a label, secondary meta, a trailing status or count, and hover actions. States: active, unread, running and disabled. It is the base of `SessionButton`, the repo and workspace rows in `Sidebar`, `FileTreeItem` and the shared workspace links.
28. **Tree.** One expandable tree with keyboard navigation. It replaces `DiffView/FileTree` and `FileExplorer/FileTree`.
29. **FileIcon.**
30. **DiffStat.** The `+12 −3` counts and a small change bar.
31. **CodeBlock and InlineCode.** A code block with a language label, a copy button and wrapping.

### Agent and collaboration patterns

All of these are presentational: callbacks come in and nothing is fetched.

32. **MessageBubble.** User, assistant and system variants, with an author label for shared sessions and a hover slot for the action bar.
33. **ToolBlock.** A tool call that is running, done or failed. It is open while running and collapses when done, with a summary row (`ToolCallSummary`).
34. **ApprovalCard.** A command, file or network request, with approve and deny actions. Variants: actionable, read-only (view permission), resolved and withdrawn. It shows the host's name when the viewer is a collaborator. It replaces the markup in `ApprovalRequests`.
35. **QuestionCard.** Single choice, multiple choice, free text and a secret answer. The read-only and "answer on the host" states come from `QuestionRequests`. Merge it with `Interview/QuestionCard`.
36. **Composer.** A textarea, a model selector slot, a permission select, send and stop, an attachments slot and placeholder variants (own session, someone else's session, view only). It is the shell of `InputArea`.
37. **SharedBadge.** `[SHARED BY X · CONTROL]` and `[SHARED BY X · VIEW]`, with its `data-permission` attribute. It also covers the content of `CollaborationStatus`.
38. **TerminalFrame.** Terminal chrome with a title, its status and a "read-only mirror" label for collaborators. The xterm instance renders inside it.
39. **CommandPalette shell.** It is built on Command.
40. **AppShell.** The layout slots for the sidebar, top bar, main area and right panel (from `Layout`, `TopBar` and `RightSidebar`). Document it as a layout pattern with placeholder content.

### Not in the design system

These are feature components: they stay in `apps/desktop` and get rebuilt on the components above.
- `AgentChat`, `MessageList`, `ScrollMinimap`, the popovers' data logic and `PlanModeIndicator`
- `DiffView`, `DiffEditor`, `InlineComments`, `VisualComparison`, `ReviewView` and `ChecksView`
- `Editor` and `MonacoEditor`
- `Scratchpad`, the Interview views, `ActivityFeed`, `AgentOverview` and `ConversationHistory`
- `ThemeSelector`, `GitStatusBar`, `MainHeader`, `TopBar`, `Sidebar`, `RightSidebar` and the pages

Among the vendored `ai-elements`, delete every one nothing uses. Also delete any primitive with no remaining use after the migration (check `carousel` first).

## Storybook

- **Version:** use the current stable Storybook with the React and Vite framework, in `packages/ui`.
- **Addons:** themes (a toolbar switch for all four themes, driven by the same attribute the app uses), a11y, and the Vitest addon so every story also runs as a test.
- **Stories:** every component gets stories for every variant and state listed above, with controls, and a docs page generated from its props. The patterns use realistic Koda content: a Codex tool call, a real-looking approval and a shared session.
- **Pages:**
  - Introduction: what Koda is and how the system is organized.
  - Foundations: colour swatches read from the tokens, the type roles, spacing, radius, elevation, motion and icons.
  - Brand: the logo, spinners, terminal sections and bracket actions.
  - Patterns: a chat turn, the approval flow and a collaborator's shared session.
  - App screens: two composed screens with mock data, the host's workspace view and the collaborator's view of the same shared workspace.
- **Deployment:** add a GitHub Actions workflow that builds the static Storybook on pushes to `main` and deploys it to GitHub Pages. Add the Storybook link and a screenshot to the README.

## Migration

Rebuild `apps/desktop` on `@koda/ui` feature by feature:
1. the sidebar and workspace list
2. agent chat, including the approval and question cards and the composer
3. the workspace view, right panel, terminal, diff, review and checks
4. settings, sharing, the command palette, toasts and the remaining pages

Afterwards, the lint rule passes with no hex colours, raw palette classes or arbitrary values left in components. The app looks the same as before in each of the four themes.

## Rules

- Work on branch `codex/design-system`. Commit in small steps, push only that branch, and never merge into `main`.
- Don't deploy anything and don't change repository settings. The Pages workflow only runs once it reaches `main`.
- Don't print, copy or commit any secret or env file.
- Keep `README.md`, `FEATURES.md` and a new `DESIGN.md` accurate. `DESIGN.md` covers the principles, the tokens, the component list and the lint rule.
- `pnpm build`, `pnpm lint` and `pnpm test` must pass, along with the Storybook build and its story tests.

## Done when

- Every component above is in `@koda/ui` with its stories.
- The desktop app is fully migrated, and the lint rule is on and passing.
- The Storybook builds and its story tests pass.
- The branch is pushed. The full real-service verification is run separately, by the owner of the env file.
