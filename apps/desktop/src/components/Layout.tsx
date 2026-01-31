import { ReactNode, useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { Sidebar } from './Sidebar'
import { NotificationProvider } from './Toast'
import { useSidecar } from '@/hooks/useRpc'
import { useSidebarResize } from '@/hooks/useResizable'
import { initializeThemeAtom } from '@/store/theme'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: ReactNode
}

/**
 * Sidecar connection status indicator.
 */
function SidecarStatus() {
  const { status, error } = useSidecar()

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 px-3 py-1.5 text-xs rounded-full badge-error">
        Sidecar error
      </div>
    )
  }

  if (!status?.running) {
    return (
      <div className="fixed bottom-4 right-4 px-3 py-1.5 text-xs rounded-full badge-warning">
        Connecting...
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 px-3 py-1.5 text-xs rounded-full badge-success">
      <div className="flex items-center gap-2">
        <span className="status-dot-ready" />
        <span>Connected</span>
      </div>
    </div>
  )
}

/**
 * Resize handle for the sidebar.
 */
function SidebarResizer({
  handleProps,
  isDragging,
}: {
  handleProps: ReturnType<typeof useSidebarResize>['handleProps']
  isDragging: boolean
}) {
  return (
    <div
      {...handleProps}
      className={cn(
        'absolute top-0 right-0 w-1 h-full z-10',
        'hover:bg-border-accent transition-colors',
        isDragging && 'bg-border-accent'
      )}
      style={{
        ...handleProps.style,
        // Extend hit area for easier grabbing
        marginRight: '-2px',
        width: '5px',
      }}
    />
  )
}

/**
 * Main application layout with CSS Grid structure.
 *
 * Layout structure:
 * ┌─────────────────────────────────────────────────────┐
 * │ Titlebar (24px, drag region)                        │
 * ├─────────┬───────────────────────────────────────────┤
 * │ Sidebar │ Main Content                              │
 * │ (280px) │                                           │
 * │         │                                           │
 * └─────────┴───────────────────────────────────────────┘
 */
export function Layout({ children }: LayoutProps) {
  const initializeTheme = useSetAtom(initializeThemeAtom)
  const sidebar = useSidebarResize()

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme()
  }, [initializeTheme])

  return (
    <NotificationProvider>
      <div className="h-screen w-screen overflow-hidden bg-surface-messages grid grid-rows-[var(--titlebar-height)_1fr] grid-cols-[var(--sidebar-width)_1fr]">
        {/* Titlebar - drag region for window */}
        <div
          className="col-span-2 glass-topbar border-b border-border-subtle"
          data-tauri-drag-region
        >
          {/* Window controls are handled natively by Tauri on macOS */}
        </div>

        {/* Sidebar */}
        <aside className="relative glass-sidebar border-r border-border-subtle overflow-hidden">
          <Sidebar />
          <SidebarResizer
            handleProps={sidebar.handleProps}
            isDragging={sidebar.isDragging}
          />
        </aside>

        {/* Main content area */}
        <main className="overflow-hidden bg-surface-messages">
          {children}
        </main>

        {/* Status indicator */}
        <SidecarStatus />
      </div>
    </NotificationProvider>
  )
}
