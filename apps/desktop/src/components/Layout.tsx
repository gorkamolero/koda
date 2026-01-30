import { ReactNode, useEffect, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { NotificationProvider } from './Toast'
import { useSidecar } from '@/hooks/useRpc'

interface LayoutProps {
  children: ReactNode
}

function SidecarStatus() {
  const { status, error, spawn } = useSidecar()
  const spawnAttempted = useRef(false)

  // Auto-spawn sidecar on mount (only once)
  useEffect(() => {
    if (!spawnAttempted.current) {
      spawnAttempted.current = true
      spawn()
    }
  }, [spawn])

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 px-3 py-1.5 text-xs rounded-full bg-destructive/10 text-destructive border border-destructive/20">
        Sidecar error
      </div>
    )
  }

  if (!status?.running) {
    return (
      <div className="fixed bottom-4 right-4 px-3 py-1.5 text-xs rounded-full bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
        Connecting...
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 px-3 py-1.5 text-xs rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
      Connected
    </div>
  )
}

export function Layout({ children }: LayoutProps) {
  return (
    <NotificationProvider>
      <div className="flex h-full w-full overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
        <SidecarStatus />
      </div>
    </NotificationProvider>
  )
}
