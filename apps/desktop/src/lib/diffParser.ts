/**
 * Unified diff parser utility
 *
 * Converts unified diff patches into original/modified content pairs
 * for display in Monaco's DiffEditor.
 */

export interface ParsedDiff {
  originalContent: string
  modifiedContent: string
}

/**
 * Parsed file from a multi-file unified diff
 */
export interface ParsedFileDiff {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  diff: string
}

/**
 * Parse a multi-file unified diff into individual file diffs
 *
 * @param fullDiff - The full unified diff output from `git diff`
 * @returns Array of parsed file diffs
 */
export function parseMultiFileDiff(fullDiff: string): ParsedFileDiff[] {
  if (!fullDiff?.trim()) {
    return []
  }

  const files: ParsedFileDiff[] = []
  const lines = fullDiff.split('\n')

  let currentFile: ParsedFileDiff | null = null
  let currentDiff: string[] = []
  let additions = 0
  let deletions = 0

  const flushCurrentFile = () => {
    if (currentFile) {
      currentFile.diff = currentDiff.join('\n')
      currentFile.additions = additions
      currentFile.deletions = deletions
      files.push(currentFile)
    }
    currentDiff = []
    additions = 0
    deletions = 0
  }

  for (const line of lines) {
    // New file header
    if (line.startsWith('diff --git ')) {
      flushCurrentFile()

      // Extract path from "diff --git a/path b/path"
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
      if (match) {
        const [, oldPath, newPath] = match
        // Use newPath for display (handles renames)
        currentFile = {
          path: newPath ?? oldPath ?? 'unknown',
          status: 'modified',
          additions: 0,
          deletions: 0,
          diff: '',
        }
        currentDiff.push(line)
      }
      continue
    }

    // Detect file status
    if (currentFile) {
      if (line.startsWith('new file mode')) {
        currentFile.status = 'added'
      } else if (line.startsWith('deleted file mode')) {
        currentFile.status = 'deleted'
      } else if (line.startsWith('rename from')) {
        currentFile.status = 'renamed'
      }
    }

    // Count additions/deletions in hunks
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++
    }

    // Collect diff content
    if (currentFile) {
      currentDiff.push(line)
    }
  }

  // Don't forget the last file
  flushCurrentFile()

  return files
}

/**
 * Parse a unified diff into original and modified content
 *
 * @param unifiedDiff - The unified diff string (from `git diff`)
 * @returns Object with originalContent and modifiedContent
 */
export function parseUnifiedDiff(unifiedDiff: string | undefined): ParsedDiff {
  if (!unifiedDiff) {
    return { originalContent: '', modifiedContent: '' }
  }

  const originalLines: string[] = []
  const modifiedLines: string[] = []

  // Split into lines, skip the header (diff --git, ---, +++)
  const lines = unifiedDiff.split('\n')
  let inHunk = false

  for (const line of lines) {
    // Skip header lines
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('new file mode') ||
      line.startsWith('deleted file mode') ||
      line.startsWith('old mode') ||
      line.startsWith('new mode')
    ) {
      continue
    }

    // Hunk header starts content
    if (line.startsWith('@@')) {
      inHunk = true
      continue
    }

    if (!inHunk) continue

    if (line.startsWith('-')) {
      // Removed line - only in original
      originalLines.push(line.slice(1))
    } else if (line.startsWith('+')) {
      // Added line - only in modified
      modifiedLines.push(line.slice(1))
    } else if (line.startsWith(' ') || line === '') {
      // Context line - in both
      const content = line.startsWith(' ') ? line.slice(1) : line
      originalLines.push(content)
      modifiedLines.push(content)
    }
  }

  return {
    originalContent: originalLines.join('\n'),
    modifiedContent: modifiedLines.join('\n'),
  }
}

/**
 * Get file extension for language detection
 */
export function getExtension(path: string): string {
  const parts = path.split('.')
  return parts.length > 1 ? parts[parts.length - 1] ?? '' : ''
}

/**
 * Map file extension to Monaco language
 */
export function extensionToLanguage(ext: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
  }
  return map[ext.toLowerCase()] ?? 'plaintext'
}
