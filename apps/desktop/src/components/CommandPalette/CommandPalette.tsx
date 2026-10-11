import { useAtomValue, useSetAtom } from 'jotai'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandItem, Kbd } from '@koda/ui'
import {
  commandPaletteVisibleAtom, commandPaletteQueryAtom, filteredCommandsAtom,
  closeCommandPaletteAtom, executeCommandAtom,
} from '@/store/ui'

/** The store owns filtering and execution; Command owns keyboard selection. */
export function CommandPalette() {
  const isVisible = useAtomValue(commandPaletteVisibleAtom)
  const query = useAtomValue(commandPaletteQueryAtom)
  const setQuery = useSetAtom(commandPaletteQueryAtom)
  const commands = useAtomValue(filteredCommandsAtom)
  const close = useSetAtom(closeCommandPaletteAtom)
  const execute = useSetAtom(executeCommandAtom)
  return <CommandDialog open={isVisible} onOpenChange={open => { if (!open) close() }}
    contentProps={{ className: 'top-[15vh] translate-y-0 max-w-xl rounded-xl border-solid border-border-strong glass-popover' }}
    commandProps={{ 'data-testid': 'command-palette', shouldFilter: false }}>
    <CommandInput data-testid="command-palette-input" placeholder="Type a command or search..." value={query} onValueChange={setQuery} />
    <CommandList data-testid="command-palette-results">
      <CommandEmpty>{query ? 'No commands found' : 'Type to search commands'}</CommandEmpty>
      {commands.map(command => <CommandItem key={command.id} value={command.id} onSelect={() => execute(command)} className="w-full justify-between gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary">{command.name}</div>
          {command.description && <div className="text-xs text-text-faint truncate">{command.description}</div>}
        </div>
        <span className="px-2 py-0.5 bg-surface-control rounded text-xs text-text-dim capitalize">{command.category}</span>
        {command.shortcut && <Kbd>{command.shortcut}</Kbd>}
      </CommandItem>)}
    </CommandList>
    <div className="px-4 py-2 border-t border-border-subtle text-xs text-text-dim flex items-center gap-4">
      <span><Kbd className="text-2xs">Enter</Kbd><span className="ml-1.5">to execute</span></span>
      <span><Kbd className="text-2xs">↑↓</Kbd><span className="ml-1.5">to navigate</span></span>
    </div>
  </CommandDialog>
}
