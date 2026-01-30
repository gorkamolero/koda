import { EditorTabs } from './EditorTabs'
import { MonacoEditor } from './MonacoEditor'

/**
 * Main editor component with tabs and Monaco editor
 */
export function Editor() {
  return (
    <div className="h-full flex flex-col">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        <MonacoEditor />
      </div>
    </div>
  )
}
