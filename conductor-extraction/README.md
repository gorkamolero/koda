# Conductor App Extraction

Extracted from `/Applications/Conductor.app` v0.33.3

## Contents

### Files
- `all_strings.txt` - All strings extracted from binary (650KB)
- `db_schema.sql` - Complete SQLite database schema
- `sidecar.js` - Node.js sidecar bundle (28K lines, 1.1MB)

### Assets
- `assets/` - Extracted images (PNG, WebP, GIF)
- `image1.png` - 416x415 (app icon)
- `image2.png` - 205x203 (secondary icon)
- `image.webp` - WebP icon variant
- `image.gif` - 16x16 (favicon/status)

### Scripts
- `scripts/checkpointer.sh` - Git checkpoint save/restore/diff
- `scripts/spotlighter.sh` - Spotlight integration
- `scripts/git-busy-check.sh` - Detect merge/rebase in progress

### Binwalk Extraction
- `binwalk_extract/` - Full binwalk extraction output

## Tools Used

- `binwalk` - Embedded file extraction
- `rabin2` (radare2) - Binary analysis
- `strings` - String extraction
- `otool` - Mach-O analysis
- `sqlite3` - Database inspection
- `xxd` - Hex dump

## Key Findings

1. **Architecture**: Tauri 2.x (Rust + WebView)
2. **AI Integration**: Claude SDK + Codex CLI
3. **Data Model**: repos → workspaces → sessions → messages
4. **IPC**: JSON-RPC 2.0 between frontend ↔ sidecar
5. **Custom MCP Tools**: AskUserQuestion, GetWorkspaceDiff, DiffComment, GetTerminalOutput
