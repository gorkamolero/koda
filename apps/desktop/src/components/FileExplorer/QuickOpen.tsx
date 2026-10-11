import { useEffect, useCallback } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { CommandDialog, CommandInput, CommandList, CommandItem, FileIcon, Kbd } from '@koda/ui'
import { quickOpenVisibleAtom, quickOpenQueryAtom, quickOpenResultsAtom, type FileEntry } from '@/store/fileExplorer'

interface QuickOpenProps { onFileSelect: (file: FileEntry) => void }

/** The feature keeps fuzzy file matching; Command provides keyboard selection and modal focus. */
export function QuickOpen({ onFileSelect }: QuickOpenProps) {
  const [isVisible, setIsVisible] = useAtom(quickOpenVisibleAtom)
  const [query, setQuery] = useAtom(quickOpenQueryAtom)
  const results = useAtomValue(quickOpenResultsAtom)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'p') { event.preventDefault(); setIsVisible(true) }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setIsVisible])
  const handleClose = useCallback(() => { setIsVisible(false); setQuery('') }, [setIsVisible, setQuery])

  return <CommandDialog open={isVisible} onOpenChange={open => { if (!open) handleClose() }} commandProps={{ shouldFilter: false, 'data-testid': 'quick-open-dialog', label: 'Quick open' }} contentProps={{ className: 'top-[15vh] max-w-xl translate-y-0 rounded-xl border-solid' }}>
    <CommandInput data-testid="quick-open-input" aria-label="Search files" value={query} onValueChange={setQuery} placeholder="Search files by name..." />
    <CommandList data-testid="quick-open-results">
      {!results.length && <div className="px-4 py-8 text-center text-sm text-text-faint">{query ? 'No files found' : 'Type to search for files'}</div>}
      {results.map(file => <CommandItem key={file.path} value={file.path} data-testid={`quick-open-result-${file.name.replace(/\./g, '-').toLowerCase()}`} onSelect={() => { onFileSelect(file); handleClose() }} className="gap-3 px-4 py-2.5">
        <FileIcon filename={file.name} type={file.type} />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-text-primary">{file.name}</div><div className="truncate text-xs text-text-faint">{file.path}</div></div>
      </CommandItem>)}
    </CommandList>
    <div className="flex items-center gap-4 border-t border-border-subtle px-4 py-2 text-xs text-text-dim"><span><Kbd>Enter</Kbd><span className="ml-1.5">to open</span></span><span><Kbd>Esc</Kbd><span className="ml-1.5">to close</span></span></div>
  </CommandDialog>
}
