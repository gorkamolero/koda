import { EditorTabs } from './EditorTabs'
import { MonacoEditor } from './MonacoEditor'

interface EditorProps {
  mockMode?: boolean
}

/**
 * Main editor component with tabs and Monaco editor
 */
export function Editor({ mockMode = false }: EditorProps) {
  return (
    <div className="h-full flex flex-col">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        <MonacoEditor mockMode={mockMode} />
      </div>
    </div>
  )
}
