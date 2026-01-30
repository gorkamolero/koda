export function Settings() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-primary mb-6">Settings</h1>

        <div className="space-y-6">
          <section className="border border-border rounded-lg p-6 bg-background">
            <h2 className="text-lg font-semibold text-primary mb-4">
              Agent Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Default Agent
                </label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option>Claude Code</option>
                  <option>Codex</option>
                  <option>Kimi Code</option>
                </select>
              </div>
            </div>
          </section>

          <section className="border border-border rounded-lg p-6 bg-background">
            <h2 className="text-lg font-semibold text-primary mb-4">
              Git Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Default Git Identity
                </label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option>Personal (GitHub)</option>
                  <option>Work (GitHub)</option>
                  <option>Add New Identity...</option>
                </select>
              </div>
            </div>
          </section>

          <section className="border border-border rounded-lg p-6 bg-background">
            <h2 className="text-lg font-semibold text-primary mb-4">
              Appearance
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Theme
                </label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option>Light</option>
                  <option>Dark</option>
                  <option>System</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
