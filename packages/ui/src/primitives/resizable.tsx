import type * as React from 'react'
import { PanelGroup as BaseGroup, Panel as BasePanel, PanelResizeHandle as BaseHandle } from 'react-resizable-panels'
import { cn, focusRing } from './utils'
/** Keyboard and pointer resizable panels. Arrow keys resize the focused handle. */
export function ResizablePanels({ className, ...props }: React.ComponentProps<typeof BaseGroup>) { return <BaseGroup className={cn('h-full w-full overflow-hidden font-code text-text-primary', className)} {...props} /> }
export const ResizablePanel = BasePanel
export function ResizableHandle({ className, ...props }: React.ComponentProps<typeof BaseHandle>) { return <BaseHandle className={cn('relative w-1 shrink-0 bg-border-muted transition-colors duration-fast hover:bg-border-accent data-[panel-group-direction=vertical]:h-1 data-[panel-group-direction=vertical]:w-full', focusRing, className)} {...props} /> }
