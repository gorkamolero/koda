import type { Workspace } from '@/lib/rpc'
import { useWorkspaceDiffStats } from '@/hooks/useRpc'

interface GitStatusBarProps {
  workspace: Workspace | undefined
}

/**
 * Conductor-style git status bar at the bottom of the workspace view.
 * Shows: (env) • workspace-name git:(branch) [status]
 */
export function GitStatusBar({ workspace }: GitStatusBarProps) {
  const { data: diffStats } = useWorkspaceDiffStats(workspace?.id ?? '')

  const branch = workspace?.branch ?? 'main'
  const workspaceName = workspace?.directoryName ?? 'workspace'
  const hasChanges = (diffStats?.filesChanged ?? 0) > 0

  // Git status indicator
  const statusIndicator = hasChanges ? '•' : ''

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

      {/* Status indicator */}
      <span className="text-muted-foreground">
        [{statusIndicator && <span className="text-[--git-yellow]">{statusIndicator}</span>}]
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Optional: Show diff stats */}
      {hasChanges && diffStats && (
        <span className="flex items-center gap-2">
          <span className="text-[--git-green]">+{diffStats.additions}</span>
          <span className="text-[--git-red]">-{diffStats.deletions}</span>
        </span>
      )}
    </div>
  )
}
