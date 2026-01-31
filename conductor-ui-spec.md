# Conductor UI - Complete Specification

Extracted from `index-E1eQSGVB.js` (frontend bundle) and DOM snapshot.

---

## Tech Stack

- **Framework:** React 18+
- **Router:** React Router (`BrowserRouter`)
- **State:** Jotai (atoms) + Zustand (stores)
- **Styling:** Tailwind CSS + CSS Variables (design tokens)
- **UI Components:** Radix UI primitives + custom components
- **Icons:** Lucide React + React Icons (Fa*, Si*, Vsc*, etc.)
- **Code:** CodeMirror 6
- **Markdown:** Custom renderer with Mermaid support
- **Animation:** Lottie (for logo/loading)
- **DnD:** @dnd-kit

---

## Routes

```typescript
const routes = [
  { path: "/", element: <HomePage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "/all-workspaces", element: <AllWorkspacesPage /> },
  { path: "/repository/:repositoryId", element: <RepositoryPage /> },
  { path: "/workspace/:workspaceId", element: <WorkspacePage /> },
  { path: "/cloud/workspace/:id", element: <CloudWorkspacePage /> },
];
```

---

## Design System (CSS Variables)

### Colors (Dark Theme)
```css
:root {
  /* Core */
  --background: 24 10% 7%;
  --foreground: 30 8% 91%;
  --muted: 24 9% 12%;
  --muted-foreground: 23 5% 63%;

  /* Accents */
  --primary: 30 9% 95%;
  --primary-foreground: 25 8% 16%;
  --accent: 25 8% 16%;
  --accent-foreground: 30 9% 95%;

  /* Semantic */
  --destructive: 0 91% 71%;
  --success: 142 69% 58%;
  --warning: 360 15% 22%;
  --info: 217 91% 60%;

  /* Sidebar */
  --sidebar-background: 24 9% 12%;
  --sidebar-foreground: 0 0% 100% / 0.9;
  --sidebar-muted-foreground: 0 0% 100% / 0.6;
  --sidebar-accent: 0 0% 100% / 0.05;
  --sidebar-border: 0 0% 100% / 0.1;

  /* Git */
  --git-green: 142 69% 58%;
  --git-red: 0 91% 71%;
  --git-yellow: 50 100% 75%;

  /* Special */
  --highlight: 5 19% 14%;
  --unread: 19 35% 69%;
  --plan-border: 4 12% 46%;
}
```

---

## Component Hierarchy

### App Shell
```
App
├── AuthGuard
├── DeepLinkHandler
├── AutoUpdater
├── ThemeProvider
├── ConductorConfigProvider
├── ShortcutsRegistryProvider
└── AppContent
    ├── TopBar
    ├── WorkspaceSidebar (left)
    ├── MainContent (center)
    └── GitPanel / TerminalPanel (right/bottom)
```

### Page Components
```
HomePage
├── RepositoryList
│   └── RepositorySection (per repo)
│       └── WorkspaceItem (per workspace)
└── AddRepositoryButtons

WorkspacePage
├── WorkspaceProvider
├── WorkspaceHotkeys
├── TopBar
│   ├── BranchCombo
│   ├── ModelDisplay
│   └── OpenInMenu
├── MainWorkspaceContent
│   ├── ChatTab / SessionTab
│   │   ├── Session
│   │   │   ├── Turn (per turn)
│   │   │   │   ├── UserMessage
│   │   │   │   └── AssistantMessage
│   │   │   └── Composer
│   │   └── SessionHistory
│   ├── GitTab
│   │   └── DiffView
│   ├── FileTab
│   │   └── FileTreeView
│   └── TerminalTab
│       └── Terminal
└── WorkspaceSidebar
    ├── SessionButton (per session)
    └── NewSessionContextPicker

SettingsPage
├── SettingsHeader
└── SettingsContent
    ├── AccountTab
    ├── AppearanceTab
    ├── ClaudeCodeTab
    ├── ReposTab
    ├── StorageTab
    ├── ExperimentalTab
    └── KeyboardShortcutDefinitions*
```

---

## Key Components

### Message Components
```typescript
// Chat message types
UserMessage          // User input with attachments
AssistantMessage     // AI response with tool calls
SystemMessage        // System notifications
ResultMessage        // Tool results
SummaryMessage       // Compaction summaries
CompactedSummary     // Collapsed previous context

// Tool display components
ToolView             // Generic tool wrapper
ToolIcon             // Tool-specific icon
ToolError            // Error display
GenericTool          // Fallback tool display
GenericToolInputOutput

// Specific tools
BashTool
BashOutputTool
ReadTool
WriteTool
EditTool
MultiEditTool
GrepTool
GlobTool
TaskTool
TaskCreateTool
TaskGetTool
TaskListTool
TaskUpdateTool
ThinkingTool
SkillTool
SlashCommandTool
WebTool
DiffCommentTool
ExitPlanModeTool
GetWorkspaceDiffTool
GetTerminalOutputTool
AskUserQuestionTool
AskUserQuestionBlock
Context7MCPTool
LinearMCPTool
UnknownTool
```

### Git Components
```typescript
GitPanel
GitPanelHeader
GitEmptyState
GitFileItem
GitStatusBadge
GitTruncatedPath
GitDiffFile
GitDiffFileContent
GitDiffFileHeader

DiffView
DiffViewer
DiffStats
DiffFileHeader
DiffLineRenderer

BranchCombo
BranchItem
BranchWithChanges
BranchNameEditable
RemoteBranchItem
RemoteCombo
```

### Workspace Components
```typescript
WorkspaceItem
WorkspaceItemWithMetadata
WorkspaceStatusSelector
WorkspaceSetupStatus
WorkspaceWorldMapButton
WorkspaceWorldMapDialog
LinkedWorkspaceBadge

ArchiveDialogContent
ArchiveSuggestion
ArchiveWorkspaceDialog
DeleteDialogContent
RevertDialogContent
RevertFileButton
RevertFileDialog
RevertToTurnButton
```

### Editor Components
```typescript
CodeMirrorDiffLanguageWrapper
CodeMirrorFileViewer
CodeMirrorFileWrapper
CodeMirrorScriptEditor
CodeViewer

Markdown
StyledMarkdown
MermaidPreview

Terminal
RunTerminal
SetupTerminal
TerminalFontSelector
TerminalPanel
```

### Dialog Components
```typescript
ChangeRootPathDialog
CloneFromURLDialog
CloseRunningSessionDialog
ConfirmQuitDialog
ConductorJsonDialog
CreateFromTemplateDialog
DeleteCloudWorkspaceDialog
DeleteRepoDialog
FeedbackDialog
FilePickerDialog
MCPStatusDialog
QuickStartDialog
ShareWithTeamDialog
SparseCheckoutDialog
```

---

## Custom Hooks

### Data Hooks
```typescript
// Repository & Workspace
useAddLocalRepository()
useArchiveWorkspace()
useArchiveWorkspaceFlow()
useConductorRoot()
useConductorConfig()
useConductorConfigValue()
useChangeRootPath()
useChangeTargetBranch()

// Git
useAllBranches()
useAllFilesChanged()
useBranchCommits()

// Session
useClearSession()
useChatSearch()
useChatSearchStore()

// Auth
useClaudeAuthResult()
useCodexAuthResult()
useBuiltInCodexAuthResult()
useClaudeWorkspaceInit()
```

### Settings Hooks
```typescript
useAppearance()
useAppearanceTag()
useBranchPrefixType()
useBranchPrefixCustom()
useArchiveOnMerge()
useChromeModeEnabled()
useClaudeEnvVars()
useCodexApiKey()
useCodexProvider()
useConductorApiToken()
useAutoConvertLongTextSetting()
useAlwaysShowContextWheel()
```

### UI Hooks
```typescript
useBlockDisplay()
useAnimation()
useConductorLoaderAnimation()
useConductorLogoAnimation()
useCommandWithDelay()
useContextMenuContext()
useCollapsibleContext()
useFocusProvider()
```

---

## State Management

### Zustand Stores
```typescript
useChatSearchStore     // Chat search state
useCloudStore          // Cloud workspace state
useCloudSocketStore    // WebSocket connection
useCloudWorkspaceStore // Cloud workspace data
```

### Context Providers
```typescript
ConductorConfigProvider
WorkspaceProvider
CloudWorkspaceProvider
RepoProvider
ThemeProvider
FocusProvider
ShortcutsRegistryProvider
TreeProvider
PathContext
CanvasContext
```

---

## Tailwind Classes (Common Patterns)

### Layout
```css
.h-screen.overflow-hidden          /* App container */
.h-full.bg-sidebar-background/60   /* Sidebar */
.flex.flex-col.gap-1               /* Vertical stack */
.flex.items-center.gap-2           /* Horizontal row */
.min-w-0.truncate                  /* Overflow handling */
```

### Sidebar Item
```css
.group.rounded-md.py-2
.hover:bg-sidebar-accent
.cursor-pointer.relative
.text-sidebar-foreground
.data-[active=true]:bg-sidebar-accent
```

### Button Variants
```css
/* Ghost button */
.inline-flex.items-center.gap-2
.hover:bg-sidebar-accent
.text-sidebar-muted-foreground
.hover:text-sidebar-foreground

/* Icon button */
.size-6.rounded-sm
.text-sidebar-muted-foreground
```

### Status Indicators
```css
.text-git-green    /* Added lines */
.text-git-red      /* Removed lines */
.text-unread       /* Unread indicator */
.text-status-in-progress
.text-status-done
```

---

## Icon Usage

### Lucide Icons (Primary)
```typescript
// Navigation
lucide-arrow-left, lucide-arrow-right
lucide-chevron-down, lucide-chevron-up

// Actions
lucide-plus, lucide-ellipsis
lucide-archive, lucide-trash

// Status
lucide-layers  // Workspaces
```

### Simple Icons (Tech/Brands)
```typescript
SiClaude, SiOpenai           // AI providers
SiGithub, SiGit              // Git
SiTypescript, SiJavascript   // Languages
SiReact, SiNextdotjs         // Frameworks
SiDocker, SiTerraform        // DevOps
```

### VS Code Icons
```typescript
VscFolder, VscFolderOpened
VscJson
VscLayoutSidebarLeft, VscLayoutSidebarLeftOff
VscLayoutSidebarRight, VscLayoutSidebarRightOff
VscSettingsGear
```

---

## Animation

### Lottie Animations
- `ConductorLoader` - Loading spinner
- `ConductorLoadingLogo` - Logo animation
- `RunningAnimation` - Processing indicator

### CSS Animations
- `AnimatedPlanBorder` - Plan mode border glow
- Hover transitions on all interactive elements
- Smooth scrolling in message lists

---

## Keyboard Shortcuts

Defined in:
- `KeyboardShortcutDefinitionsGlobal`
- `KeyboardShortcutDefinitionsWorkspace`

Common shortcuts use `KeyBadge` and `KeybindingLabel` components.

---

## File Icons

Uses `FileBadge` and `FileChangeBadge` with mappings:
```typescript
FaFile, FaFileAlt, FaFileCode
FaFileArchive, FaFileAudio, FaFileVideo
FaFileCsv, FaFileImage, FaFilePdf
```

---

## Notable Features

1. **Drag & Drop** - Workspace reordering via @dnd-kit
2. **Command Palette** - `CommandPalette` component
3. **Table of Contents** - `TableOfContents`, `TOCCompactView`, `TOCExpandedPopover`
4. **Suggestions** - `Suggestion`, `SuggestionsOverlay`, `OnboardingPromptSuggestions`
5. **Web Preview** - `WebPreview` component for web content
6. **Audio** - `AudioElement` for audio playback
7. **Image Diff** - `ImageDiffContent` for image comparisons

---

## Cloud Features

```typescript
CloudWorkspacePage
CloudWorkspaceProvider
CloudComposer
CloudDiffSheet
CloudGitEmptyState
CloudGitFileItem
CloudGitPanel
CloudOpenInMenu
CloudTemplatesTab
CloudTopBar
CloudTurn
CloudUserMessage
CloudAssistantMessage
CloudWorkspacesSection
```

---

## Onboarding Flow

```typescript
OnboardingPage
├── OnboardingStepOne
├── OnboardingStepTwo
├── OnboardingStepThree
└── OnboardingStepFour

OnboardingPromptSuggestions
QuickStartDialog
```
