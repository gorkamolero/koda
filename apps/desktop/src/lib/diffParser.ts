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
