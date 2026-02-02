import { MonacoEditor } from './MonacoEditor'

/**
 * Main editor component with Monaco editor
 * Note: Editor tabs are rendered in TopBar (row 2) alongside Scratchpad/Chat tabs
 */
export function Editor() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <MonacoEditor />
      </div>
    </div>
  )
}
