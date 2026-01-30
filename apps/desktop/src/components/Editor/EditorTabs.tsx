import { memo, useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  openFilesAtom,
  activeFilePathAtom,
  closeFileAtom,
} from '@/store/fileExplorer'

/**
 * Editor tabs showing open files
 */
export const EditorTabs = memo(function EditorTabs() {
  const openFiles = useAtomValue(openFilesAtom)
  const activeFilePath = useAtomValue(activeFilePathAtom)
  const setActiveFilePath = useSetAtom(activeFilePathAtom)
  const closeFile = useSetAtom(closeFileAtom)

  const handleTabClick = useCallback(
    (path: string) => {
      setActiveFilePath(path)
    },
    [setActiveFilePath]
  )

  const handleCloseClick = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation()
      closeFile(path)
    },
    [closeFile]
  )

  if (openFiles.length === 0) {
    return null
  }

  return (
    <div className="flex items-center border-b border-border bg-background overflow-x-auto">
      {openFiles.map((file) => {
        const testId = `editor-tab-${file.name.replace(/\./g, '-').toLowerCase()}`
        const isActive = file.path === activeFilePath

        return (
          <button
            key={file.path}
            data-testid={testId}
            data-unsaved={file.isDirty || undefined}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm border-r border-border
              hover:bg-accent/50 transition-colors min-w-0
              ${isActive ? 'bg-secondary/50' : ''}
            `}
            onClick={() => {
              handleTabClick(file.path)
            }}
          >
            {/* Dirty indicator */}
            {file.isDirty && (
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}

            {/* File name */}
            <span className="truncate">{file.name}</span>

            {/* Close button */}
            <button
              className="p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                handleCloseClick(e, file.path)
              }}
              title="Close"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </button>
        )
      })}
    </div>
  )
})
