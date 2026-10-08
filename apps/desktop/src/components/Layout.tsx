import { ReactNode, useEffect, useState } from 'react'
import { useSetAtom } from 'jotai'
import { SharedWorkspaceLauncher } from './WorkspaceSharing'
import { Sidebar } from './Sidebar'
import { NotificationProvider } from './Toast'
import { useSidecar } from '@/hooks/useRpc'
import { useSidebarResize } from '@/hooks/useResizable'
import { initializeThemeAtom } from '@/store/theme'
import { cn } from '@/lib/utils'
import { KodaLoadingScreen, KodaWaveSpinner } from '@/components/KodaSpinner'
import { startSidecarRpcListener } from '@/lib/sidecarRpc'

interface LayoutProps {
  children: ReactNode
}

/**
 * Sidecar connection status indicator.
 * Only shows when there's a problem - stays hidden when connected.
 */
function SidecarStatus() {
  const { status, error } = useSidecar()

  // Don't show anything when connected and no errors
  if (status?.running && !error) {
    return null
  }

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 px-3 py-1.5 text-xs rounded-full badge-error animate-in fade-in slide-in-from-bottom-2">
        Sidecar error
      </div>
    )
  }

  if (!status?.running) {
    return (
      <div className="fixed bottom-4 right-4 px-4 py-2 rounded-lg bg-surface-card border border-border-subtle animate-in fade-in slide-in-from-bottom-2">
        <KodaWaveSpinner label="Connecting" speed={120} />
      </div>
    )
  }

  return null
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
 * ┌─────────┬───────────────────────────────────────────┐
 * │ Sidebar │ Main Content (includes TopBar with drag)  │
 * │ (280px) │                                           │
 * │         │                                           │
 * └─────────┴───────────────────────────────────────────┘
 *
 * Note: Window drag region is in TopBar row 1, not a separate titlebar.
 */
const MINIMUM_SPLASH_DURATION = 3000 // 3 seconds minimum
const FADE_OUT_DURATION = 800 // 800ms fade out

export function Layout({ children }: LayoutProps) {
  const initializeTheme = useSetAtom(initializeThemeAtom)
  const sidebar = useSidebarResize()
  const { status } = useSidecar()
  const [loadingState, setLoadingState] = useState<'visible' | 'dissolving' | 'hidden'>('visible')
  const [startTime] = useState(() => Date.now())

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme()
  }, [initializeTheme])

  // Start listening for sidecar RPC requests (for MCP tools)
  useEffect(() => {
    startSidecarRpcListener()
  }, [])

  // Show loading screen for minimum duration, then dissolve elegantly
  useEffect(() => {
    if (status?.running && loadingState === 'visible') {
      const elapsed = Date.now() - startTime
      const remainingTime = Math.max(0, MINIMUM_SPLASH_DURATION - elapsed)

      // Wait for minimum duration, then start dissolve
      const dissolveTimer = setTimeout(() => {
        setLoadingState('dissolving')

        // After fade animation completes, hide completely
        setTimeout(() => {
          setLoadingState('hidden')
        }, FADE_OUT_DURATION)
      }, remainingTime)

      return () => { clearTimeout(dissolveTimer) }
    }
  }, [status?.running, loadingState, startTime])

  // Show KODA loading screen during initial connection
  if (loadingState !== 'hidden') {
    return (
      <div
        className={cn(
          'h-screen w-screen bg-surface-messages flex items-center justify-center',
          'transition-opacity duration-700 ease-out',
          loadingState === 'dissolving' && 'opacity-0'
        )}
      >
        <KodaLoadingScreen message="Initializing" />
      </div>
    )
  }

  return (
    <NotificationProvider>
      <div className="h-screen w-screen overflow-hidden bg-surface-messages grid grid-cols-[var(--sidebar-width)_1fr]">
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
        <SharedWorkspaceLauncher />
      </div>
    </NotificationProvider>
  )
}
