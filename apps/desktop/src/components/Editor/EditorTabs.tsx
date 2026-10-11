import { memo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Tabs, TabsList, TabsTrigger, IconButton } from '@koda/ui'
import { X } from 'lucide-react'
import { openFilesAtom, activeFilePathAtom, closeFileAtom } from '@/store/fileExplorer'

/** Editor selection and close actions remain owned by the file store. */
export const EditorTabs = memo(function EditorTabs() {
  const openFiles = useAtomValue(openFilesAtom)
  const activeFilePath = useAtomValue(activeFilePathAtom)
  const setActiveFilePath = useSetAtom(activeFilePathAtom)
  const closeFile = useSetAtom(closeFileAtom)
  if (!openFiles.length) return null

  return <Tabs value={activeFilePath ?? undefined} onValueChange={setActiveFilePath} className="overflow-x-auto border-b border-border bg-background">
    <TabsList aria-label="Open files" className="h-auto justify-start rounded-none bg-transparent p-0">
      {openFiles.map(file => <div key={file.path} className="group flex min-w-0 items-center border-r border-border">
        <TabsTrigger value={file.path} data-testid={`editor-tab-${file.name.replace(/\./g, '-').toLowerCase()}`} data-unsaved={file.isDirty || undefined} className="gap-2 rounded-none px-3 py-2 text-sm data-[state=active]:bg-secondary/50 data-[state=active]:shadow-none">
          {file.isDirty && <span className="size-2 shrink-0 rounded-full bg-primary" />}
          <span className="truncate">{file.name}</span>
        </TabsTrigger>
        <IconButton aria-label="Close" title="Close" onClick={() => closeFile(file.path)} className="mr-2 size-auto rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"><X className="size-3" /></IconButton>
      </div>)}
    </TabsList>
  </Tabs>
})
