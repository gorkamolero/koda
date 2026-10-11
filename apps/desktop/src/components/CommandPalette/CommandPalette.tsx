import { useAtomValue, useSetAtom } from 'jotai'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandItem, Kbd } from '@koda/ui'
import { Command as CommandIcon } from 'lucide-react'
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
    contentProps={{ showClose: false, overlayClassName: 'bg-[color-mix(in_srgb,var(--black-pure)_60%,transparent)] opacity-100 backdrop-blur-sm', className: 'top-[15vh] translate-y-0 w-full max-w-xl rounded-xl border-solid border-border-strong glass-popover shadow-2xl font-ui' }}
    commandProps={{ 'data-testid': 'command-palette', shouldFilter: false, className: 'rounded-none bg-transparent font-ui [&_[cmdk-input]]:h-auto [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-item]]:px-4' }}>
    <CommandInput data-testid="command-palette-input" placeholder="Type a command or search..." value={query} onValueChange={setQuery}
      icon={<CommandIcon aria-hidden="true" className="size-5 shrink-0 text-text-dim mr-3" />}
      trailing={<Kbd className="ml-2 rounded border-0 px-2 py-1 font-mono text-text-faint">Esc</Kbd>}
      wrapperClassName="border-border-subtle px-4 py-3"
      className="h-auto flex-1 rounded-none py-0 font-ui placeholder:text-text-dim focus-visible:ring-0" />
    <CommandList data-testid="command-palette-results">
      <CommandEmpty className="px-4 py-8 font-ui text-text-faint">{query ? 'No commands found' : 'Type to search commands'}</CommandEmpty>
      {commands.map(command => <CommandItem key={command.id} value={command.id} onSelect={() => execute(command)} className="w-full cursor-pointer justify-between gap-3 rounded-none px-4 py-3 font-ui text-left hover:bg-surface-hover transition-colors data-[selected=true]:bg-surface-active">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary">{command.name}</div>
          {command.description && <div className="text-xs text-text-faint truncate">{command.description}</div>}
        </div>
        <span className="px-2 py-0.5 bg-surface-control rounded text-xs text-text-dim capitalize">{command.category}</span>
        {command.shortcut && <Kbd className="rounded border-0 px-2 py-1 font-mono text-text-faint">{command.shortcut}</Kbd>}
      </CommandItem>)}
    </CommandList>
    <div className="px-4 py-2 border-t border-border-subtle text-xs text-text-dim flex items-center gap-4">
      <span><Kbd className="inline rounded border-0 font-mono text-2xs text-text-faint">Enter</Kbd><span className="ml-1.5">to execute</span></span>
      <span><Kbd className="inline rounded border-0 font-mono text-2xs text-text-faint">↑↓</Kbd><span className="ml-1.5">to navigate</span></span>
    </div>
  </CommandDialog>
}
