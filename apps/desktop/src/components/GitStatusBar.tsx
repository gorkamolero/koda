import type { Worktree } from '@/lib/rpc'

interface GitStatusBarProps {
  workspace: Worktree | undefined
}

/**
 * Terminal-style git status bar at the bottom of the workspace view.
 * └─ (env) ─ workspace ─ git:(branch) ─────────────────────────────┘
 */
export function GitStatusBar({ workspace }: GitStatusBarProps) {
  const branch = workspace?.branch ?? 'main'
  const workspaceName = workspace?.worktreePath?.split('/').pop() ?? workspace?.branch ?? 'workspace'

  return (
    <div className="h-6 px-3 flex items-center gap-2 text-xs font-mono bg-[#000000] border-t border-dashed border-border-subtle text-text-faint">
      {/* Left border */}
      <span>└─</span>

      {/* Environment indicator */}
      <span className="text-[--git-yellow]">(base)</span>

      <span>─</span>

      {/* Workspace name */}
      <span className="text-[--git-green]">{workspaceName}</span>

      <span>─</span>

      {/* Git info */}
      <span className="flex items-center gap-1">
        <span>git:</span>
        <span className="text-[--git-red]">({branch})</span>
      </span>

      {/* Fill with dashes */}
      <span className="flex-1 overflow-hidden whitespace-nowrap text-text-faint/30">
        {'─'.repeat(50)}
      </span>

      {/* Right border */}
      <span>─┘</span>
    </div>
  )
}
