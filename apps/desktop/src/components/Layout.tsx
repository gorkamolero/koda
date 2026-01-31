import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { NotificationProvider } from './Toast'
import { useSidecar } from '@/hooks/useRpc'

interface LayoutProps {
  children: ReactNode
}

function SidecarStatus() {
  const { status, error } = useSidecar()

  // Sidecar is now spawned by Rust during app setup - no need to spawn from frontend

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
