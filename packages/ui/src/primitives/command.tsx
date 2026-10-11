"use client"

import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive, useCommandState } from "cmdk"
import { Search } from "lucide-react"

import { cn } from "./utils"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./dialog"

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, children, ...props }, ref) => {
  const root = React.useRef<HTMLDivElement | null>(null)
  return <CommandPrimitive ref={node => { root.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node }}
    className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-surface-popover font-code text-text-primary', className)} {...props}>
    {children}<CommandSelectionA11y root={root} />
  </CommandPrimitive>
})
/** cmdk can retain a removed option id after filtering. Keep both focus owners
 * synchronized with the actual selected option after React commits the list. */
function CommandSelectionA11y({ root }: { root: React.RefObject<HTMLDivElement> }) {
  const selection = useCommandState(state => `${state.search}\0${state.value}\0${state.selectedItemId}`)
  React.useLayoutEffect(() => {
    const selected = root.current?.querySelector('[cmdk-item][aria-selected="true"]')
    root.current?.querySelectorAll('[cmdk-input], [cmdk-list]').forEach(element => {
      if (selected?.id) element.setAttribute('aria-activedescendant', selected.id)
      else element.removeAttribute('aria-activedescendant')
    })
  }, [root, selection])
  return null
}
Command.displayName = CommandPrimitive.displayName

export interface CommandDialogProps extends DialogProps {
  /** Props for the command's DOM root, including ARIA, callbacks and test ids. */
  commandProps?: Omit<React.ComponentPropsWithoutRef<typeof Command>, 'children'> & { [attribute: `data-${string}`]: string | number | boolean | undefined }
  /** Customize the modal surface without replacing its focus management. */
  contentProps?: Omit<React.ComponentPropsWithoutRef<typeof DialogContent>, 'children'>
}
const CommandDialog = ({ children, commandProps, contentProps, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent {...contentProps} className={cn("overflow-hidden p-0", contentProps?.className)}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search commands and files</DialogDescription>
        <Command label="Command palette" {...commandProps} className={cn("[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-secondary [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4", commandProps?.className)}>
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b border-border-muted px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md bg-transparent py-3 font-code text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus placeholder:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-80 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
))

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const empty = useCommandState(state => state.filtered.count === 0)
    return empty ? <div ref={ref} role="option" aria-disabled="true" aria-selected="false" className={cn('py-6 text-center font-code text-sm text-text-secondary', className)} {...props} /> : null
  }
)

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-text-primary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-secondary",
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border-muted", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 font-code text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-surface-hover data-[selected=true]:text-text-strong data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-text-secondary",
        className
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = "CommandShortcut"

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
