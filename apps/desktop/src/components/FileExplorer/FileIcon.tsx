import { memo } from 'react'
import { getFileIconType, type FileType } from '@/store/fileExplorer'

interface FileIconProps {
  filename: string
  type: FileType
  isExpanded?: boolean
}

/**
 * File/folder icon component with type-specific styling
 */
export const FileIcon = memo(function FileIcon({
  filename,
  type,
  isExpanded,
}: FileIconProps) {
  if (type === 'directory') {
    return (
      <svg
        data-testid={isExpanded ? 'folder-icon-open' : 'folder-icon'}
        className="w-4 h-4 text-amber-500"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        {isExpanded ? (
          // Open folder
          <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
        ) : (
          // Closed folder
          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        )}
      </svg>
    )
  }

  const iconType = getFileIconType(filename)

  // Color classes based on file type
  const colorClass = {
    ts: 'text-blue-500',
    tsx: 'text-blue-400',
    js: 'text-yellow-500',
    jsx: 'text-yellow-400',
    css: 'text-purple-500',
    json: 'text-yellow-600',
    md: 'text-gray-500',
    html: 'text-orange-500',
    rust: 'text-orange-600',
    default: 'text-gray-400',
  }[iconType]

  return (
    <svg
      data-testid={`file-icon-${iconType}`}
      className={`w-4 h-4 ${colorClass}`}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
    </svg>
  )
})
