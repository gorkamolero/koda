import type { Worktree } from '@/lib/rpc'

interface GitStatusBarProps {
  workspace: Worktree | undefined
}

/**
 * Conductor-style git status bar at the bottom of the workspace view.
 * Shows: (env) • workspace-name git:(branch) [status]
 */
export function GitStatusBar({ workspace }: GitStatusBarProps) {
  const branch = workspace?.branch ?? 'main'
  const workspaceName = workspace?.worktreePath?.split('/').pop() ?? workspace?.branch ?? 'workspace'

  return (
    <div className="h-6 px-3 flex items-center gap-2 text-xs font-mono bg-[--surface-terminal] border-t border-border-subtle text-muted-foreground">
      {/* Environment indicator */}
      <span className="text-[--git-yellow]">(base)</span>

      <span className="text-muted-foreground">•</span>

      {/* Workspace name */}
      <span className="text-[--git-green]">{workspaceName}</span>

      {/* Git info */}
      <span className="flex items-center gap-1">
        <span className="text-muted-foreground">git:</span>
        <span className="text-[--git-red]">({branch})</span>
      </span>

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  )
}
