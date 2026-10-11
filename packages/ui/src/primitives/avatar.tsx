"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { StatusDot, type Status } from "./badge"
import { cn } from "./utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 font-code text-text-primary overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-surface-control",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }

/** Participant identity colors are independent of availability status. */
export type PresenceTone = 'blue' | 'green' | 'amber' | 'rose' | 'cyan' | 'terracotta'
const presenceClasses: Record<PresenceTone, string> = {
  blue: 'bg-status-unread text-gray-0',
  green: 'bg-status-ready text-gray-0',
  amber: 'bg-status-warning text-gray-0',
  rose: 'bg-status-error text-gray-0',
  cyan: 'bg-status-reviewing text-gray-0',
  terracotta: 'bg-status-processing text-gray-0',
}
const presenceTones = Object.keys(presenceClasses) as PresenceTone[]
function defaultPresenceTone(id: string): PresenceTone {
  const hash = Array.from(id).reduce((value, character) => (Math.imul(value, 31) + character.codePointAt(0)!) >>> 0, 0)
  return presenceTones[hash % presenceTones.length]!
}
export interface AvatarStackPerson {
  id: string
  name: string
  src?: string
  status?: Status
  /** Token palette key for identity; omitted values are stable hashes of id. */
  tone?: PresenceTone
}
export interface AvatarStackProps extends React.HTMLAttributes<HTMLDivElement> {
  people: AvatarStackPerson[]
  maxVisible?: number
  size?: 'sm' | 'md'
}
export function AvatarStack({ people, maxVisible = 3, size = 'sm', className, ...props }: AvatarStackProps) {
  const visible = people.slice(0, Math.max(1, maxVisible))
  const overflow = people.length - visible.length
  return <div role="group" aria-label="Workspace collaborators" className={cn('flex -space-x-2 font-code text-xs text-text-primary', className)} {...props}>
    {visible.map(person => {
      const tone = person.tone ?? defaultPresenceTone(person.id)
      return <div key={person.id} className="relative" title={person.name}>
        <Avatar className={cn('border-2 border-surface-card', size === 'sm' ? 'size-7' : 'size-9')}>
          <AvatarImage src={person.src} alt={person.name} />
          <AvatarFallback role="img" aria-label={person.name} data-presence-tone={tone} className={presenceClasses[tone]}>
            {person.name.trim().split(/\s+/).map(part => part[0]).join('').toUpperCase().slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        {person.status && <StatusDot status={person.status} label={`${person.name}: ${person.status}`} className="absolute bottom-0 right-0 ring-2 ring-surface-card" />}
      </div>
    })}
    {overflow > 0 && <span role="img" title={people.slice(visible.length).map(person => person.name).join(', ')} aria-label={`${overflow} more collaborators`} className={cn('flex items-center justify-center rounded-full border-2 border-surface-card bg-surface-control', size === 'sm' ? 'size-7' : 'size-9')}>+{overflow}</span>}
  </div>
}
