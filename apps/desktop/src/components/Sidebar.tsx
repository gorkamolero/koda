import { Link } from '@tanstack/react-router'

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-border bg-secondary/30 flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-primary">Koda</h1>
        <p className="text-xs text-muted-foreground">Review-First Agent IDE</p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          <Link
            to="/"
            className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            activeProps={{
              className: 'bg-accent text-accent-foreground',
            }}
          >
            Workspaces
          </Link>
          <Link
            to="/settings"
            className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            activeProps={{
              className: 'bg-accent text-accent-foreground',
            }}
          >
            Settings
          </Link>
        </div>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>Sidecar Connected</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
