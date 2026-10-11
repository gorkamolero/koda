import { describe, expect, it } from 'vitest'
// Import the public package entry in Node: helpers used by stores and utilities
// must remain safe without window, document, or a mounted React application.
import { cn } from '../index'

describe('semantic utility composition', () => {
  it.each(['2xs', 'micro', 'tiny', 'caption', 'heading', 'body', 'code'])('keeps %s text sizing independent of its foreground color', role => {
    expect(cn('text-sm text-text-muted', `text-${role} text-text-accent`)).toBe(`text-${role} text-text-accent`)
    expect(cn(`text-${role} text-text-muted`, 'text-status-error')).toBe(`text-${role} text-status-error`)
  })

  it('replaces semantic font sizes while retaining variant foregrounds', () => {
    expect(cn('text-2xs text-text-muted hover:text-text-accent', 'text-caption')).toBe('text-text-muted hover:text-text-accent text-caption')
  })

  it.each(['popover', 'glow', 'accent'])('lets a caller remove or replace the %s shadow', shadow => {
    expect(cn(`shadow-${shadow}`, 'shadow-none')).toBe('shadow-none')
    expect(cn('shadow-none', `shadow-${shadow}`)).toBe(`shadow-${shadow}`)
    expect(cn(`hover:shadow-${shadow}`, 'shadow-none')).toBe(`hover:shadow-${shadow} shadow-none`)
  })
})
